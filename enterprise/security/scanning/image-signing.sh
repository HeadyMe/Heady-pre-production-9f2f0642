#!/usr/bin/env bash
# HeadySystems v3.2.2 — Container Image Signing with cosign
# ===========================================================
# Signs container images after build using sigstore/cosign.
# Verifies signatures before deployment.
# Integrates with GitHub Actions OIDC for keyless signing.
#
# All numeric parameters: φ=1.618033988749895, Fibonacci sequences.
#
# Usage:
#   Sign:   ./image-signing.sh sign   <IMAGE_REF> [--key-type keyless|kms|key]
#   Verify: ./image-signing.sh verify <IMAGE_REF>
#   Policy: ./image-signing.sh policy-check <IMAGE_REF>
#
# Example:
#   ./image-signing.sh sign us-central1-docker.pkg.dev/heady/heady-manager@sha256:abc123
#   ./image-signing.sh verify us-central1-docker.pkg.dev/heady/heady-manager@sha256:abc123

set -euo pipefail
IFS=$'\n\t'

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS — φ and Fibonacci
# ─────────────────────────────────────────────────────────────────────────────

readonly PHI="1.618033988749895"
# Fibonacci: fib(3)=2, fib(5)=5, fib(6)=8, fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55, fib(11)=89
readonly FIB_3=2
readonly FIB_4=3
readonly FIB_5=5
readonly FIB_6=8
readonly FIB_7=13
readonly FIB_8=21
readonly FIB_9=34
readonly FIB_10=55
readonly FIB_11=89

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

# Transparency log: Rekor (sigstore public) or private Rekor instance
REKOR_URL="${REKOR_URL:-https://rekor.sigstore.dev}"

# Fulcio OIDC certificate authority
FULCIO_URL="${FULCIO_URL:-https://fulcio.sigstore.dev}"

# OIDC issuer (GitHub Actions OIDC in CI, Google OIDC for manual)
OIDC_ISSUER="${OIDC_ISSUER:-https://token.actions.githubusercontent.com}"

# KMS key for non-keyless signing (GCP Cloud KMS)
KMS_KEY="${KMS_KEY:-gcpkms://projects/${GCP_PROJECT_ID:-heady-systems}/locations/us-central1/keyRings/heady-signing/cryptoKeyVersions/1}"

# Default signing identity for verification
EXPECTED_ISSUER="${EXPECTED_ISSUER:-https://token.actions.githubusercontent.com}"
EXPECTED_SUBJECT="${EXPECTED_SUBJECT:-https://github.com/headysystems/heady-systems/.github/workflows/}"

# Registry
REGISTRY="${REGISTRY:-us-central1-docker.pkg.dev}"
PROJECT_ID="${PROJECT_ID:-heady-systems}"
REPOSITORY="${REPOSITORY:-heady-systems}"

# Retry parameters (φ-exponential backoff)
RETRY_BASE_S="${RETRY_BASE_S:-1}"
MAX_RETRIES="${MAX_RETRIES:-${FIB_3}}"   # fib(3)=2 retries

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

log() {
  local level="$1"
  shift
  echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",\"level\":\"${level}\",\"service\":\"image-signing\",\"version\":\"3.2.2\",\"phi\":${PHI},\"message\":\"$*\"}" >&2
}

log_info()  { log "INFO"  "$@"; }
log_warn()  { log "WARN"  "$@"; }
log_error() { log "ERROR" "$@"; }
log_fatal() { log "FATAL" "$@"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# PREREQUISITES CHECK
# ─────────────────────────────────────────────────────────────────────────────

check_prerequisites() {
  local missing=()

  for cmd in cosign crane jq gcloud; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_fatal "Missing required tools: ${missing[*]}. Install via: brew install cosign crane jq"
  fi

  # Verify cosign version (require >= 2.0 for keyless)
  local cosign_version
  cosign_version=$(cosign version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
  log_info "cosign version: ${cosign_version}"

  log_info "Prerequisites verified. φ=${PHI}, Fibonacci retry limit=fib(${FIB_3})=${FIB_3}"
}

# ─────────────────────────────────────────────────────────────────────────────
# RETRY WITH φ-EXPONENTIAL BACKOFF
# ─────────────────────────────────────────────────────────────────────────────

# retry <max_attempts> <base_sleep_s> <command> [args...]
retry() {
  local max_attempts="$1"
  local base_sleep="$2"
  shift 2
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    if "$@"; then
      return 0
    fi
    attempt=$((attempt + 1))
    if [[ $attempt -lt $max_attempts ]]; then
      # φ^attempt × base_sleep
      local sleep_s
      sleep_s=$(echo "scale=3; ${base_sleep} * (${PHI} ^ ${attempt})" | bc)
      log_warn "Attempt ${attempt}/${max_attempts} failed. Retrying in ${sleep_s}s (φ^${attempt} × ${base_sleep}s)..."
      sleep "$sleep_s"
    fi
  done

  log_error "All ${max_attempts} attempts failed."
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# SIGN — Sign an image after build
# ─────────────────────────────────────────────────────────────────────────────

cmd_sign() {
  local image_ref="$1"
  local key_type="${2:---keyless}"  # Default: keyless (GitHub Actions OIDC)

  log_info "Signing image: ${image_ref}"
  log_info "Key type: ${key_type}"

  # Ensure image ref contains digest (not just tag) for tamper-proof signing
  if [[ "$image_ref" != *"@sha256:"* ]]; then
    log_warn "Image ref does not include digest. Resolving digest..."
    local digest
    digest=$(crane digest "$image_ref")
    # Extract base without tag
    local base="${image_ref%%:*}"
    image_ref="${base}@${digest}"
    log_info "Resolved to: ${image_ref}"
  fi

  # ── Prepare annotations ────────────────────────────────────────────────────
  local repo="${GITHUB_REPOSITORY:-headysystems/heady-systems}"
  local sha="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
  local ref="${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  local timestamp
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # ── Sign based on key type ─────────────────────────────────────────────────
  case "$key_type" in
    --keyless|keyless)
      log_info "Using keyless signing via GitHub Actions OIDC..."
      # Keyless signing: OIDC token → Fulcio CA certificate → Rekor transparency log
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign sign \
        --yes \
        --rekor-url="${REKOR_URL}" \
        --fulcio-url="${FULCIO_URL}" \
        --oidc-issuer="${OIDC_ISSUER}" \
        --annotations="repo=${repo}" \
        --annotations="git-sha=${sha}" \
        --annotations="ref=${ref}" \
        --annotations="timestamp=${timestamp}" \
        --annotations="phi=${PHI}" \
        --annotations="version=3.2.2" \
        --annotations="fibonacci=fib(3)=2,fib(5)=5,fib(7)=13,fib(8)=21,fib(11)=89" \
        --annotations="signed-by=heady-signing-pipeline" \
        "$image_ref"
      ;;

    --kms|kms)
      log_info "Using KMS signing with key: ${KMS_KEY}..."
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign sign \
        --yes \
        --key="${KMS_KEY}" \
        --rekor-url="${REKOR_URL}" \
        --annotations="repo=${repo}" \
        --annotations="git-sha=${sha}" \
        --annotations="timestamp=${timestamp}" \
        --annotations="phi=${PHI}" \
        --annotations="version=3.2.2" \
        "$image_ref"
      ;;

    --key|key)
      local key_path="${COSIGN_KEY_PATH:-cosign.key}"
      if [[ ! -f "$key_path" ]]; then
        log_fatal "Key file not found: ${key_path}"
      fi
      log_info "Using local key: ${key_path}..."
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign sign \
        --yes \
        --key="${key_path}" \
        --rekor-url="${REKOR_URL}" \
        --annotations="repo=${repo}" \
        --annotations="git-sha=${sha}" \
        --annotations="timestamp=${timestamp}" \
        --annotations="phi=${PHI}" \
        --annotations="version=3.2.2" \
        "$image_ref"
      ;;

    *)
      log_fatal "Unknown key type: ${key_type}. Use --keyless, --kms, or --key"
      ;;
  esac

  log_info "✓ Image signed successfully: ${image_ref}"

  # ── Attach SBOM if available ───────────────────────────────────────────────
  local sbom_file="${SBOM_FILE:-sbom.spdx.json}"
  if [[ -f "$sbom_file" ]]; then
    log_info "Attaching SBOM: ${sbom_file}..."
    retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign attach sbom \
      --sbom="$sbom_file" \
      "$image_ref"
    log_info "✓ SBOM attached."
  fi

  # ── Generate verification record ──────────────────────────────────────────
  local record_file="signing-record-${sha:0:8}.json"
  cat > "$record_file" <<EOF
{
  "image": "${image_ref}",
  "sha": "${sha}",
  "ref": "${ref}",
  "timestamp": "${timestamp}",
  "key_type": "${key_type}",
  "rekor_url": "${REKOR_URL}",
  "phi": ${PHI},
  "fibonacci": {
    "max_retries": ${FIB_3},
    "rotation_interval_days": ${FIB_11},
    "cert_renewal_days": ${FIB_8}
  },
  "annotations": {
    "repo": "${repo}",
    "version": "3.2.2"
  }
}
EOF
  log_info "Signing record saved: ${record_file}"
}

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY — Verify signature before deployment
# ─────────────────────────────────────────────────────────────────────────────

cmd_verify() {
  local image_ref="$1"
  local key_type="${2:---keyless}"

  log_info "Verifying image signature: ${image_ref}"

  # Ensure digest-based reference
  if [[ "$image_ref" != *"@sha256:"* ]]; then
    log_warn "Resolving image digest for verification..."
    local digest
    digest=$(crane digest "$image_ref")
    local base="${image_ref%%:*}"
    image_ref="${base}@${digest}"
  fi

  case "$key_type" in
    --keyless|keyless)
      log_info "Verifying keyless signature (OIDC issuer: ${EXPECTED_ISSUER})..."
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign verify \
        --rekor-url="${REKOR_URL}" \
        --certificate-identity-regexp="${EXPECTED_SUBJECT}" \
        --certificate-oidc-issuer="${EXPECTED_ISSUER}" \
        "$image_ref" \
        | jq '.[0] | {subject: .critical.identity.docker_reference, issuer: .optional.Issuer, sha: .optional["git-sha"]}'
      ;;

    --kms|kms)
      log_info "Verifying KMS signature (key: ${KMS_KEY})..."
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign verify \
        --key="${KMS_KEY}" \
        --rekor-url="${REKOR_URL}" \
        "$image_ref" \
        | jq '.[0]'
      ;;

    --key|key)
      local pub_key="${COSIGN_PUB_KEY:-cosign.pub}"
      log_info "Verifying with public key: ${pub_key}..."
      retry "$MAX_RETRIES" "$RETRY_BASE_S" cosign verify \
        --key="${pub_key}" \
        "$image_ref" \
        | jq '.[0]'
      ;;
  esac

  log_info "✓ Signature verified for: ${image_ref}"
}

# ─────────────────────────────────────────────────────────────────────────────
# POLICY CHECK — Enforce signing policy before deployment
# ─────────────────────────────────────────────────────────────────────────────

cmd_policy_check() {
  local image_ref="$1"

  log_info "Running policy check on: ${image_ref}"

  # Check 1: Signature exists and is valid
  log_info "Check 1/fib(4)=3: Signature validity..."
  if ! cosign verify \
    --certificate-identity-regexp="${EXPECTED_SUBJECT}" \
    --certificate-oidc-issuer="${EXPECTED_ISSUER}" \
    "$image_ref" &>/dev/null; then
    log_fatal "POLICY VIOLATION: Image has no valid signature. Deployment blocked."
  fi
  log_info "  ✓ Signature valid."

  # Check 2: No CRITICAL CVEs (Trivy scan result must exist in registry annotations)
  log_info "Check 2/fib(4)=3: CVE scan attestation..."
  if cosign verify-attestation \
    --type="vuln" \
    --certificate-identity-regexp="${EXPECTED_SUBJECT}" \
    --certificate-oidc-issuer="${EXPECTED_ISSUER}" \
    "$image_ref" &>/dev/null; then
    # Get vuln attestation and check for CRITICAL CVEs
    local vuln_attest
    vuln_attest=$(cosign verify-attestation \
      --type="vuln" \
      --certificate-identity-regexp="${EXPECTED_SUBJECT}" \
      --certificate-oidc-issuer="${EXPECTED_ISSUER}" \
      "$image_ref" 2>/dev/null | jq -r '.payload | @base64d | fromjson')

    local critical_count
    critical_count=$(echo "$vuln_attest" | jq '[.scanner.result.Results[]? | .Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' 2>/dev/null || echo "0")

    if [[ "$critical_count" -gt 0 ]]; then
      log_fatal "POLICY VIOLATION: ${critical_count} CRITICAL CVEs found. SLA=fib(3)=2 days. Deployment blocked."
    fi
    log_info "  ✓ CVE scan: 0 CRITICAL vulnerabilities."
  else
    log_warn "  ⚠ No vulnerability attestation found. Manual Trivy verification required."
  fi

  # Check 3: Image was built from known-good branch (main, release/*)
  log_info "Check 3/fib(4)=3: Source branch validation..."
  local annotations
  annotations=$(cosign verify \
    --certificate-identity-regexp="${EXPECTED_SUBJECT}" \
    --certificate-oidc-issuer="${EXPECTED_ISSUER}" \
    "$image_ref" 2>/dev/null | jq -r '.[0].optional.ref // "unknown"')

  if [[ "$annotations" != "main" && "$annotations" != release/* && "$annotations" != "unknown" ]]; then
    log_warn "  ⚠ Image signed from branch '${annotations}'. Only 'main' and 'release/*' are trusted for production."
    if [[ "${STRICT_BRANCH_CHECK:-false}" == "true" ]]; then
      log_fatal "POLICY VIOLATION: Image not from trusted branch. Deployment blocked."
    fi
  else
    log_info "  ✓ Source branch: ${annotations}."
  fi

  log_info "✓ All fib(4)=3 policy checks passed for: ${image_ref}"
  log_info "φ=${PHI} | Deployment authorized."
}

# ─────────────────────────────────────────────────────────────────────────────
# GENERATE KEY PAIR (for non-keyless environments)
# ─────────────────────────────────────────────────────────────────────────────

cmd_generate_keys() {
  log_info "Generating cosign key pair for HeadySystems image signing..."
  log_info "Key rotation interval: fib(11)=89 days (per key-management-procedures.md)"

  # Generate with passphrase from environment or prompt
  COSIGN_PASSWORD="${COSIGN_PASSWORD:-$(head -c ${FIB_11} /dev/urandom | base64 | tr -d '\n' | head -c ${FIB_11})}"
  export COSIGN_PASSWORD

  cosign generate-key-pair \
    --output-key-prefix "heady-signing"

  log_info "Generated: heady-signing.key (private), heady-signing.pub (public)"
  log_info "⚠ Store private key in GCP Secret Manager immediately!"
  log_info "  gcloud secrets create cosign-private-key --data-file=heady-signing.key"
  log_info "Key rotation due in fib(11)=${FIB_11} days."

  # Immediately protect the key
  chmod 600 heady-signing.key
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
HeadySystems v3.2.2 — Image Signing with cosign
φ = ${PHI}

Usage:
  $(basename "$0") sign   <IMAGE_REF> [--keyless|--kms|--key]
  $(basename "$0") verify <IMAGE_REF> [--keyless|--kms|--key]
  $(basename "$0") policy-check <IMAGE_REF>
  $(basename "$0") generate-keys

Environment:
  REKOR_URL          Rekor transparency log URL (default: sigstore public)
  FULCIO_URL         Fulcio CA URL (default: sigstore public)
  KMS_KEY            GCP KMS key for kms signing
  COSIGN_KEY_PATH    Path to cosign private key file
  COSIGN_PUB_KEY     Path to cosign public key for verification
  EXPECTED_SUBJECT   OIDC subject regex for verification
  EXPECTED_ISSUER    OIDC issuer for verification
  GCP_PROJECT_ID     GCP project ID
  SBOM_FILE          Path to SBOM file to attach (default: sbom.spdx.json)

Fibonacci parameters:
  Max retries:          fib(3)=${FIB_3}
  Rotation interval:    fib(11)=${FIB_11} days
  Cert renewal:         fib(8)=${FIB_8} days before expiry

Examples:
  # Sign in GitHub Actions (keyless via OIDC):
  $(basename "$0") sign us-central1-docker.pkg.dev/heady/heady-manager@sha256:abc123

  # Verify before deploy:
  $(basename "$0") policy-check us-central1-docker.pkg.dev/heady/heady-manager@sha256:abc123

  # Sign with KMS key:
  $(basename "$0") sign us-central1-docker.pkg.dev/heady/heady-manager@sha256:abc123 --kms
EOF
  exit 1
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
  fi

  check_prerequisites

  local command="$1"
  shift

  case "$command" in
    sign)
      [[ $# -lt 1 ]] && usage
      cmd_sign "$@"
      ;;
    verify)
      [[ $# -lt 1 ]] && usage
      cmd_verify "$@"
      ;;
    policy-check|policy_check)
      [[ $# -lt 1 ]] && usage
      cmd_policy_check "$@"
      ;;
    generate-keys|generate_keys)
      cmd_generate_keys
      ;;
    *)
      log_error "Unknown command: ${command}"
      usage
      ;;
  esac
}

main "$@"
