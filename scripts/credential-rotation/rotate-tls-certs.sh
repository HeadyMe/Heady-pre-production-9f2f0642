#!/usr/bin/env bash
# rotate-tls-certs.sh — Heady Systems TLS Certificate Rotation
# Checks expiry, renews via Let's Encrypt (certbot) and Cloudflare origin certs,
# then reloads services without downtime.
# Usage: ./rotate-tls-certs.sh [--dry-run] [--force] [--domain <domain>]
# Version: 1.0.0

set -euo pipefail
IFS=$'\n\t'

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUDIT_LOG="${SCRIPT_DIR}/audit/tls-rotation-$(date +%Y%m%d).log"
OP_VAULT="heady-production"
ROTATION_ID="tlsrot-$(date +%Y%m%d%H%M%S)-$$"
SLACK_CHANNEL="#security-alerts"

# Days before expiry to trigger renewal
RENEW_DAYS_BEFORE=30

# Certbot configuration
CERTBOT_EMAIL="security@headyme.com"
CERTBOT_CERT_DIR="/etc/letsencrypt/live"
CERTBOT_WEBROOT="/var/www/certbot"

# Cloudflare API
CF_API="https://api.cloudflare.com/client/v4"

# Domains to manage (Let's Encrypt)
LETSENCRYPT_DOMAINS=(
  "headyme.com"
  "www.headyme.com"
  "api.headyme.com"
  "headymcp.com"
  "www.headymcp.com"
  "headysystems.com"
  "www.headysystems.com"
)

# Services to reload after cert renewal (systemd units)
SERVICES_TO_RELOAD=(
  "nginx"
  "heady-api"
  "heady-mcp"
)

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=false
FORCE_RENEW=false
TARGET_DOMAIN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true;             shift ;;
    --force)     FORCE_RENEW=true;         shift ;;
    --domain)    TARGET_DOMAIN="$2";       shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--force] [--domain <domain>]"
      exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${AUDIT_LOG}")"

log() {
  local level="$1"; shift
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "{\"ts\":\"${ts}\",\"rotation_id\":\"${ROTATION_ID}\",\"level\":\"${level}\",\"msg\":\"$*\"}" >> "${AUDIT_LOG}"
  echo "[${ts}] [${level}] $*" >&2
}
log_info()    { log "INFO"    "$@"; }
log_warn()    { log "WARN"    "$@"; }
log_error()   { log "ERROR"   "$@"; }
log_success() { log "SUCCESS" "$@"; }

# ─── Prereqs ──────────────────────────────────────────────────────────────────
check_prerequisites() {
  local missing=()
  for cmd in op curl jq openssl; do
    command -v "${cmd}" &>/dev/null || missing+=("${cmd}")
  done
  command -v certbot &>/dev/null || missing+=("certbot")
  [[ ${#missing[@]} -gt 0 ]] && { log_error "Missing tools: ${missing[*]}"; exit 1; }
  op account list &>/dev/null || { log_error "1Password CLI not authenticated"; exit 1; }
}

# ─── Certificate expiry check ─────────────────────────────────────────────────
days_until_expiry() {
  local cert_file="$1"
  if [[ ! -f "${cert_file}" ]]; then
    echo "-1"
    return
  fi
  local expiry_str; expiry_str="$(openssl x509 -noout -enddate -in "${cert_file}" 2>/dev/null | cut -d= -f2)"
  if [[ -z "${expiry_str}" ]]; then
    echo "-1"
    return
  fi
  local expiry_epoch; expiry_epoch="$(date -d "${expiry_str}" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "${expiry_str}" +%s 2>/dev/null || echo "0")"
  local now_epoch; now_epoch="$(date +%s)"
  echo $(( (expiry_epoch - now_epoch) / 86400 ))
}

check_cert_expiry() {
  local domain="$1"
  local cert_file="${CERTBOT_CERT_DIR}/${domain}/fullchain.pem"

  if [[ ! -f "${cert_file}" ]]; then
    # Try to get cert info from live endpoint
    local expiry_str
    expiry_str="$(echo | openssl s_client -servername "${domain}" \
      -connect "${domain}:443" 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")"

    if [[ -z "${expiry_str}" ]]; then
      log_warn "Cannot check cert for ${domain} — cert file not found and remote check failed"
      echo "0"
      return
    fi

    local expiry_epoch; expiry_epoch="$(date -d "${expiry_str}" +%s 2>/dev/null || echo "0")"
    local now_epoch; now_epoch="$(date +%s)"
    echo $(( (expiry_epoch - now_epoch) / 86400 ))
    return
  fi

  days_until_expiry "${cert_file}"
}

# ─── Validate certificate chain ───────────────────────────────────────────────
validate_cert_chain() {
  local cert_file="$1"
  local chain_file="$2"
  local domain="$3"

  log_info "Validating certificate chain for ${domain}..."

  # Verify the cert is valid and chain is intact
  if ! openssl verify -CAfile "${chain_file}" "${cert_file}" &>/dev/null; then
    log_error "Certificate chain validation FAILED for ${domain}"
    return 1
  fi

  # Verify CN/SAN matches domain
  local cn; cn="$(openssl x509 -noout -subject -in "${cert_file}" 2>/dev/null | grep -oP '(?<=CN=)[^ ,]+')"
  local san; san="$(openssl x509 -noout -text -in "${cert_file}" 2>/dev/null | grep -A1 'Subject Alternative Name' | tail -1)"

  if [[ "${cn}" != "${domain}" ]] && ! echo "${san}" | grep -q "${domain}"; then
    log_error "Certificate CN/SAN mismatch for ${domain} (CN=${cn})"
    return 1
  fi

  local expiry; expiry="$(openssl x509 -noout -enddate -in "${cert_file}" | cut -d= -f2)"
  log_success "Certificate chain valid for ${domain} (expires: ${expiry})"
}

# ─── Let's Encrypt renewal ────────────────────────────────────────────────────
renew_letsencrypt() {
  local domain="$1"
  log_info "Renewing Let's Encrypt certificate for: ${domain}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would run: certbot certonly --dry-run -d ${domain}"
    return 0
  fi

  local certbot_args=(
    certonly
    --non-interactive
    --agree-tos
    --email "${CERTBOT_EMAIL}"
    --webroot
    --webroot-path "${CERTBOT_WEBROOT}"
    -d "${domain}"
    --cert-name "${domain}"
  )

  [[ "${FORCE_RENEW}" == "true" ]] && certbot_args+=(--force-renewal)

  if certbot "${certbot_args[@]}" 2>&1 | tee -a "${AUDIT_LOG}"; then
    log_success "Let's Encrypt certificate renewed for ${domain}"

    # Validate the new cert chain
    local cert_file="${CERTBOT_CERT_DIR}/${domain}/cert.pem"
    local chain_file="${CERTBOT_CERT_DIR}/${domain}/chain.pem"
    validate_cert_chain "${cert_file}" "${chain_file}" "${domain}" || return 1

    return 0
  else
    log_error "certbot renewal FAILED for ${domain}"
    return 1
  fi
}

# ─── Cloudflare origin certificate ────────────────────────────────────────────
get_cloudflare_token() {
  op item get "Cloudflare API Token" --vault "${OP_VAULT}" --fields credential 2>/dev/null || \
    echo "${CLOUDFLARE_API_TOKEN:-}"
}

get_cloudflare_zone_id() {
  local domain="$1"
  local token="$2"

  # Get root domain (last two parts)
  local root_domain; root_domain="$(echo "${domain}" | rev | cut -d. -f1-2 | rev)"

  curl -sf \
    -H "Authorization: Bearer ${token}" \
    "${CF_API}/zones?name=${root_domain}" \
    | jq -r '.result[0].id'
}

renew_cloudflare_origin_cert() {
  local domain="$1"
  log_info "Renewing Cloudflare origin certificate for: ${domain}"

  local cf_token; cf_token="$(get_cloudflare_token)"
  if [[ -z "${cf_token}" ]]; then
    log_warn "Cloudflare token not available — skipping origin cert renewal for ${domain}"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would renew Cloudflare origin cert for ${domain}"
    return 0
  fi

  # Generate new private key and CSR
  local cert_dir="/etc/ssl/cloudflare/${domain}"
  mkdir -p "${cert_dir}"

  local key_file="${cert_dir}/origin.key"
  local csr_file="${cert_dir}/origin.csr"
  local cert_file="${cert_dir}/origin.pem"

  openssl genrsa -out "${key_file}" 2048 &>/dev/null
  openssl req -new -key "${key_file}" -out "${csr_file}" \
    -subj "/CN=${domain}/O=Heady Systems/C=US" \
    -addext "subjectAltName=DNS:${domain},DNS:*.${domain}" &>/dev/null

  local csr_content; csr_content="$(cat "${csr_file}")"

  # Request Cloudflare origin certificate
  local zone_id; zone_id="$(get_cloudflare_zone_id "${domain}" "${cf_token}")"

  if [[ -z "${zone_id}" || "${zone_id}" == "null" ]]; then
    log_error "Could not find Cloudflare zone for ${domain}"
    return 1
  fi

  # Issue origin cert via Cloudflare API
  local payload; payload="$(jq -n \
    --arg csr "${csr_content}" \
    --argjson hostnames "[\"${domain}\",\"*.${domain}\"]" \
    '{"csr":$csr,"hostnames":$hostnames,"requested_validity":5475,"request_type":"origin-rsa"}')"

  local response; response="$(curl -sf -X POST \
    -H "Authorization: Bearer ${cf_token}" \
    -H "Content-Type: application/json" \
    --data "${payload}" \
    "${CF_API}/certificates")"

  local success; success="$(echo "${response}" | jq -r '.success')"
  if [[ "${success}" != "true" ]]; then
    log_error "Cloudflare origin cert request failed: $(echo "${response}" | jq -r '.errors[0].message')"
    return 1
  fi

  local cert_content; cert_content="$(echo "${response}" | jq -r '.result.certificate')"
  local cert_id; cert_id="$(echo "${response}" | jq -r '.result.id')"
  echo "${cert_content}" > "${cert_file}"

  # Store in 1Password
  op item edit "Cloudflare Origin Cert ${domain}" --vault "${OP_VAULT}" \
    "certificate=${cert_content}" \
    "private_key=$(cat "${key_file}")" \
    "cert_id=${cert_id}" \
    "domain=${domain}" &>/dev/null 2>&1 || \
  op item create \
    --category "Secure Note" \
    --title "Cloudflare Origin Cert ${domain}" \
    --vault "${OP_VAULT}" \
    "certificate=${cert_content}" \
    "private_key=$(cat "${key_file}")" \
    "cert_id=${cert_id}" \
    "domain=${domain}" &>/dev/null

  chmod 600 "${key_file}"
  log_success "Cloudflare origin cert renewed for ${domain} (cert_id=${cert_id})"
}

# ─── Reload services ──────────────────────────────────────────────────────────
reload_services() {
  log_info "Reloading services after certificate renewal..."

  for svc in "${SERVICES_TO_RELOAD[@]}"; do
    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would reload service: ${svc}"
      continue
    fi

    if systemctl is-active --quiet "${svc}" 2>/dev/null; then
      # Use reload (graceful) not restart — avoids downtime
      systemctl reload "${svc}" 2>/dev/null || {
        log_warn "Reload failed for ${svc}, trying restart..."
        systemctl restart "${svc}" 2>/dev/null || log_error "Failed to restart ${svc}"
      }
      log_success "Service reloaded: ${svc}"
    else
      log_warn "Service not running (skipping reload): ${svc}"
    fi
  done

  # Also check for containerized services
  if command -v docker &>/dev/null; then
    local containers; containers="$(docker ps --filter "label=heady.reload-on-cert=true" --format "{{.Names}}" 2>/dev/null || echo "")"
    while IFS= read -r container; do
      [[ -z "${container}" ]] && continue
      if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY-RUN] Would send SIGHUP to container: ${container}"
      else
        docker kill --signal=SIGHUP "${container}" &>/dev/null || true
        log_success "Sent SIGHUP to container: ${container}"
      fi
    done <<< "${containers}"
  fi
}

# ─── Generate expiry report ───────────────────────────────────────────────────
generate_expiry_report() {
  log_info "=== Certificate Expiry Report ==="
  local report=()

  local domains_to_check=("${LETSENCRYPT_DOMAINS[@]}")
  [[ -n "${TARGET_DOMAIN}" ]] && domains_to_check=("${TARGET_DOMAIN}")

  for domain in "${domains_to_check[@]}"; do
    local days; days="$(check_cert_expiry "${domain}")"
    local status="OK"
    [[ "${days}" -lt "${RENEW_DAYS_BEFORE}" ]] && status="RENEWAL_NEEDED"
    [[ "${days}" -lt 0 ]] && status="MISSING_OR_EXPIRED"

    report+=("{\"domain\":\"${domain}\",\"days_until_expiry\":${days},\"status\":\"${status}\"}")
    log_info "  ${domain}: ${days} days (${status})"
  done

  local report_file="${SCRIPT_DIR}/audit/cert-expiry-$(date +%Y%m%d).json"
  printf '[%s]\n' "$(IFS=,; echo "${report[*]}")" > "${report_file}"
  log_info "Expiry report written to ${report_file}"
}

# ─── Slack notification ───────────────────────────────────────────────────────
send_slack() {
  local status="$1"
  local msg="$2"
  local color="${3:-good}"
  local webhook
  webhook="$(op item get "Slack Webhook Security" --vault "${OP_VAULT}" --fields credential 2>/dev/null || echo "${SLACK_WEBHOOK:-}")"
  [[ -z "${webhook}" ]] && return 0

  local payload; payload="$(jq -n \
    --arg ch "${SLACK_CHANNEL}" --arg st "${status}" --arg msg "${msg}" \
    --arg color "${color}" --arg rid "${ROTATION_ID}" \
    '{channel:$ch,username:"HeadyBot TLS Rotation",icon_emoji:":lock:",
      attachments:[{color:$color,title:("TLS Cert Rotation: "+$st),
        text:$msg,fields:[{title:"Rotation ID",value:$rid,short:true}]}]}')"

  [[ "${DRY_RUN}" == "true" ]] && { log_info "[DRY-RUN] Slack: ${msg}"; return 0; }
  curl -sf -X POST -H 'Content-type: application/json' --data "${payload}" "${webhook}" &>/dev/null || true
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log_info "TLS cert rotation starting (rotation_id=${ROTATION_ID}, dry_run=${DRY_RUN})"
  check_prerequisites
  generate_expiry_report

  local domains_to_renew=()
  local domains_to_check=("${LETSENCRYPT_DOMAINS[@]}")
  [[ -n "${TARGET_DOMAIN}" ]] && domains_to_check=("${TARGET_DOMAIN}")

  # Determine which domains need renewal
  for domain in "${domains_to_check[@]}"; do
    local days; days="$(check_cert_expiry "${domain}")"
    if [[ "${FORCE_RENEW}" == "true" ]] || [[ "${days}" -lt "${RENEW_DAYS_BEFORE}" ]]; then
      domains_to_renew+=("${domain}")
      log_info "Scheduling renewal for ${domain} (${days} days until expiry)"
    else
      log_info "Certificate OK for ${domain} (${days} days until expiry)"
    fi
  done

  if [[ ${#domains_to_renew[@]} -eq 0 ]]; then
    log_info "No certificates require renewal at this time"
    exit 0
  fi

  local failed=false
  local renewed=()

  for domain in "${domains_to_renew[@]}"; do
    if renew_letsencrypt "${domain}"; then
      renewed+=("${domain}")
      # Also renew Cloudflare origin cert for this domain
      renew_cloudflare_origin_cert "${domain}" || log_warn "Cloudflare origin cert renewal failed for ${domain}"
    else
      log_error "Let's Encrypt renewal failed for ${domain}"
      failed=true
    fi
  done

  if [[ ${#renewed[@]} -gt 0 ]]; then
    reload_services
  fi

  if [[ "${failed}" == "true" ]]; then
    log_error "TLS rotation completed with failures"
    send_slack "PARTIAL FAILURE" "Some certs failed renewal. Renewed: ${renewed[*]:-none}. Rotation ID: ${ROTATION_ID}" "warning"
    exit 1
  else
    log_success "TLS rotation complete — renewed ${#renewed[@]} certificates"
    [[ "${DRY_RUN}" == "false" && ${#renewed[@]} -gt 0 ]] && \
      send_slack "SUCCESS" "Renewed ${#renewed[@]} TLS certs: ${renewed[*]}. Rotation ID: ${ROTATION_ID}" "good"
  fi
}

main "$@"
