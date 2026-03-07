#!/bin/bash
# =============================================================================
# Heady™ Immediate Secret Rotation Script
# Priority: CRITICAL — Run Now
# =============================================================================

set -euo pipefail

echo "=========================================="
echo "  Heady™ Secret Rotation — IMMEDIATE"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROTATION_LOG="rotation-$(date +%Y%m%d-%H%M%S).log"

log() { echo -e "${GREEN}[✅]${NC} $1" | tee -a "$ROTATION_LOG"; }
warn() { echo -e "${YELLOW}[⚠️]${NC} $1" | tee -a "$ROTATION_LOG"; }
fail() { echo -e "${RED}[❌]${NC} $1" | tee -a "$ROTATION_LOG"; }

# --- 1. JWT Signing Keys ---
echo ""
echo "--- Step 1: JWT Signing Keys ---"
if command -v openssl &>/dev/null; then
  mkdir -p .secrets/jwt
  openssl genrsa -out .secrets/jwt/private.pem 4096 2>/dev/null
  openssl rsa -in .secrets/jwt/private.pem -pubout -out .secrets/jwt/public.pem 2>/dev/null
  log "JWT keys generated in .secrets/jwt/"
else
  fail "openssl not found — install it and re-run"
fi

# --- 2. Generate New Database Password ---
echo ""
echo "--- Step 2: Database Credentials ---"
NEW_DB_PASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
echo "NEW_DATABASE_PASSWORD=$NEW_DB_PASS" >> .secrets/rotation-values.env
log "New DB password generated (apply via ALTER ROLE)"
warn "Run: ALTER ROLE heady_user WITH PASSWORD '${NEW_DB_PASS}';"

# --- 3. Generate New Redis AUTH ---
echo ""
echo "--- Step 3: Redis AUTH ---"
NEW_REDIS_PASS=$(openssl rand -base64 24 | tr -d '=/+' | head -c 24)
echo "NEW_REDIS_PASSWORD=$NEW_REDIS_PASS" >> .secrets/rotation-values.env
log "New Redis password generated"
warn "Run: redis-cli CONFIG SET requirepass '${NEW_REDIS_PASS}'"

# --- 4. Generate New API Signing Secret ---
echo ""
echo "--- Step 4: API Signing Secret ---"
NEW_API_SECRET=$(openssl rand -hex 32)
echo "NEW_API_SECRET=$NEW_API_SECRET" >> .secrets/rotation-values.env
log "New API signing secret generated"

# --- 5. Scan for Hardcoded Secrets ---
echo ""
echo "--- Step 5: Scanning for Hardcoded Secrets ---"
SCAN_TARGETS=("src/" "configs/" "scripts/" "packages/" "apps/")
PATTERNS=("password" "secret" "api_key" "apikey" "token" "private_key" "BEGIN RSA" "BEGIN PRIVATE")

FOUND=0
for dir in "${SCAN_TARGETS[@]}"; do
  if [ -d "$dir" ]; then
    for pattern in "${PATTERNS[@]}"; do
      MATCHES=$(grep -rli "$pattern" "$dir" 2>/dev/null | grep -v node_modules | grep -v '.test.' | grep -v '__mocks__' || true)
      if [ -n "$MATCHES" ]; then
        FOUND=$((FOUND + 1))
        warn "Pattern '$pattern' found in: $MATCHES"
      fi
    done
  fi
done

if [ "$FOUND" -eq 0 ]; then
  log "No hardcoded secrets detected in source"
else
  fail "$FOUND potential secret patterns found — review rotation-log"
fi

# --- 6. Verify .gitignore ---
echo ""
echo "--- Step 6: Verify .gitignore ---"
GITIGNORE_ENTRIES=(".env" ".env.*" "*.pem" "*.key" "*.p12" ".secrets/")
for entry in "${GITIGNORE_ENTRIES[@]}"; do
  if grep -qF "$entry" .gitignore 2>/dev/null; then
    log ".gitignore contains: $entry"
  else
    warn "MISSING from .gitignore: $entry"
    echo "$entry" >> .gitignore
    log "Added $entry to .gitignore"
  fi
done

# --- Summary ---
echo ""
echo "=========================================="
echo "  Rotation Summary"
echo "=========================================="
echo "  New credentials in: .secrets/rotation-values.env"
echo "  JWT keys in: .secrets/jwt/"
echo "  Log: $ROTATION_LOG"
echo ""
echo "  NEXT STEPS:"
echo "  1. Apply new DB password via ALTER ROLE"
echo "  2. Apply new Redis password via CONFIG SET"
echo "  3. Update GCP Secret Manager with new values"
echo "  4. Update Cloudflare environment variables"
echo "  5. Redeploy all services"
echo "  6. Verify health endpoints respond 200"
echo "  7. Delete .secrets/ after deployment"
echo "=========================================="
