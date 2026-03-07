#!/usr/bin/env bash
# =============================================================================
# © 2024-2026 HeadySystems Inc. All Rights Reserved.
# PROPRIETARY AND CONFIDENTIAL.
#
# Heady™ AI Platform v3.1.0 — Bootstrap Script
# Usage: chmod +x heady-init.sh && ./heady-init.sh
# =============================================================================

set -euo pipefail

# ─── Colors & Output ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

HEADY_VERSION="3.1.0"
REQUIRED_NODE_MAJOR=20
REQUIRED_NPM_MAJOR=10

_log()   { echo -e "${BLUE}[heady-init]${RESET} $*"; }
_ok()    { echo -e "${GREEN}[  OK  ]${RESET} $*"; }
_warn()  { echo -e "${YELLOW}[ WARN ]${RESET} $*"; }
_error() { echo -e "${RED}[ FAIL ]${RESET} $*"; }
_head()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }
_step()  { echo -e "  ${BOLD}→${RESET} $*"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗"
echo "  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝"
echo "  ███████║█████╗  ███████║██║  ██║ ╚████╔╝ "
echo "  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝  "
echo "  ██║  ██║███████╗██║  ██║██████╔╝   ██║   "
echo "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝   "
echo -e "${RESET}"
echo -e "  ${BOLD}Heady™ AI Platform v${HEADY_VERSION}${RESET}  —  Bootstrap Init"
echo -e "  ${YELLOW}Never average. Always ready.${RESET}"
echo ""

# ─── Step 1: Check Node.js Version ───────────────────────────────────────────
_head "Step 1/6: Checking Node.js version"

if ! command -v node &>/dev/null; then
  _error "Node.js not found. Install Node.js ${REQUIRED_NODE_MAJOR}+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION_FULL="$(node --version)"
NODE_MAJOR="$(node --version | sed 's/v//' | cut -d. -f1)"

if [[ "${NODE_MAJOR}" -lt "${REQUIRED_NODE_MAJOR}" ]]; then
  _error "Node.js ${NODE_VERSION_FULL} detected. Heady requires Node.js ${REQUIRED_NODE_MAJOR}+."
  _error "Please upgrade: https://nodejs.org or use nvm: nvm install ${REQUIRED_NODE_MAJOR}"
  exit 1
fi

_ok "Node.js ${NODE_VERSION_FULL} ✓"

# Check npm version
if command -v npm &>/dev/null; then
  NPM_VERSION_FULL="$(npm --version)"
  NPM_MAJOR="$(npm --version | cut -d. -f1)"
  if [[ "${NPM_MAJOR}" -lt "${REQUIRED_NPM_MAJOR}" ]]; then
    _warn "npm v${NPM_VERSION_FULL} detected (recommended: ${REQUIRED_NPM_MAJOR}+). Consider: npm install -g npm@latest"
  else
    _ok "npm v${NPM_VERSION_FULL} ✓"
  fi
fi

# ─── Step 2: npm install ──────────────────────────────────────────────────────
_head "Step 2/6: Installing dependencies"

if [[ ! -f "package.json" ]]; then
  _error "package.json not found. Run this script from the heady-rebuild root directory."
  exit 1
fi

if [[ -d "node_modules" ]]; then
  _step "node_modules exists — running npm install to sync"
else
  _step "Running npm install..."
fi

npm install 2>&1 | tail -5
_ok "Dependencies installed ✓"

# ─── Step 3: Copy .env.example → .env ────────────────────────────────────────
_head "Step 3/6: Environment configuration"

if [[ -f ".env" ]]; then
  _ok ".env already exists — skipping (not overwriting)"
else
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    _ok ".env created from .env.example ✓"
    _warn "IMPORTANT: Edit .env and set required values:"
    _warn "  OPENAI_API_KEY, HEADY_SECRET_KEY, JWT_SECRET, API_KEY_SALT, POSTGRES_PASSWORD"
  else
    _warn ".env.example not found — creating minimal .env template"
    cat > .env << 'ENVEOF'
# Heady™ AI Platform v3.1.0 — Environment Configuration
# © 2024-2026 HeadySystems Inc. All Rights Reserved.
# DO NOT COMMIT THIS FILE TO VERSION CONTROL.

# ── Core ──────────────────────────────────────────────────
NODE_ENV=development
PORT=3301
LOG_LEVEL=info
LOG_FORMAT=pretty

# ── AI / LLM ──────────────────────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=
DEFAULT_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMS=1536

# ── Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://heady:headypass@localhost:5432/headydb
POSTGRES_USER=heady
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=headydb
DB_POOL_MIN=2
DB_POOL_MAX=10

# ── Redis ──────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_MAX_MEMORY=256mb

# ── Security ───────────────────────────────────────────────
HEADY_SECRET_KEY=CHANGE_ME_32_CHAR_MIN
JWT_SECRET=CHANGE_ME_32_CHAR_MIN
API_KEY_SALT=CHANGE_ME_16_CHAR_MIN

# ── Conductor ─────────────────────────────────────────────
CONDUCTOR_TIMEOUT=30000
CONDUCTOR_MAX_RETRIES=3
PIPELINE_FULL_AUTO=false

# ── Budget ─────────────────────────────────────────────────
BUDGET_DAILY_USD=100
BUDGET_WARN_PCT=80

# ── Cloudflare ─────────────────────────────────────────────
CF_TUNNEL_ID=
CF_TUNNEL_TOKEN=
CF_ACCOUNT_ID=

# ── Monitoring ─────────────────────────────────────────────
SENTRY_DSN=
ALERT_WEBHOOK_URL=
ENVEOF
    _ok "Minimal .env created ✓"
    _warn "Edit .env and set all required values before starting"
  fi
fi

# ─── Step 4: Create data/ directory ──────────────────────────────────────────
_head "Step 4/6: Creating runtime directories"

DIRS=(
  "data"
  "data/memory"
  "data/embeddings"
  "data/patterns"
  "data/story"
  "logs"
  "tmp"
)

for dir in "${DIRS[@]}"; do
  if [[ ! -d "${dir}" ]]; then
    mkdir -p "${dir}"
    _ok "Created ${dir}/ ✓"
  else
    _step "${dir}/ already exists"
  fi
done

# Protect sensitive directories
chmod 700 data/ logs/ 2>/dev/null || true

# ─── Step 5: Initialize Vector Memory Store ──────────────────────────────────
_head "Step 5/6: Initializing vector memory store"

MEMORY_INIT_FILE="data/memory/.initialized"

if [[ -f "${MEMORY_INIT_FILE}" ]]; then
  _ok "Vector memory store already initialized ($(cat ${MEMORY_INIT_FILE}))"
else
  _step "Initializing vector memory store..."

  # Create memory index manifest
  cat > data/memory/manifest.json << MEMEOF
{
  "_meta": {
    "initialized": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "${HEADY_VERSION}",
    "dimensions": 1536,
    "backend": "pgvector",
    "status": "pending_db_connection"
  },
  "namespaces": {
    "default": { "entries": 0, "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" },
    "pipeline_results": { "entries": 0, "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" },
    "corrections": { "entries": 0, "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" },
    "patterns": { "entries": 0, "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" }
  }
}
MEMEOF

  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${MEMORY_INIT_FILE}"
  _ok "Vector memory store initialized ✓"
  _step "Full pgvector initialization happens at first DB connection"
fi

# Create story log directory with initial state
if [[ ! -f "data/story/story.jsonl" ]]; then
  echo '{"event":"system_init","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","context":{"version":"'${HEADY_VERSION}'","actor":"heady-init.sh"},"narrative":"[Event] system_init: Heady AI Platform v'${HEADY_VERSION}' initialized."}' \
    > data/story/story.jsonl
  _ok "Story log initialized ✓"
fi

# ─── Step 6: Run Health Check ─────────────────────────────────────────────────
_head "Step 6/6: Health check"

# Check if a server is already running
HEALTH_URL="http://localhost:${PORT:-3301}/health/live"

if command -v curl &>/dev/null; then
  _step "Checking for running Heady Manager at ${HEALTH_URL}..."
  if curl -fsS --max-time 3 "${HEALTH_URL}" &>/dev/null; then
    HEALTH_RESPONSE="$(curl -fsS --max-time 3 "${HEALTH_URL}" 2>/dev/null || echo '{}')"
    _ok "Heady Manager is running and healthy ✓"
    _step "Response: ${HEALTH_RESPONSE}"
  else
    _step "Heady Manager is not running (expected for fresh init)"
    _ok "Health check skipped — start the server with: npm start"
  fi
else
  _warn "curl not found — skipping live health check"
fi

# Validate critical config files
_step "Validating config files..."
CONFIG_OK=true

for config_file in \
  "configs/heady-registry.json" \
  "configs/hcfullpipeline.json"; do
  if [[ -f "${config_file}" ]]; then
    if node -e "JSON.parse(require('fs').readFileSync('${config_file}','utf8'))" 2>/dev/null; then
      _ok "${config_file} is valid JSON ✓"
    else
      _error "${config_file} is invalid JSON"
      CONFIG_OK=false
    fi
  else
    _warn "${config_file} not found"
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Heady™ AI Platform v${HEADY_VERSION} — Init Complete${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo ""
echo -e "  1. Edit ${CYAN}.env${RESET} with your API keys and secrets"
echo -e "  2. Start the platform:"
echo -e "     ${CYAN}npm start${RESET}                    # Heady Manager"
echo -e "     ${CYAN}npm run start:mcp${RESET}            # MCP stdio server"
echo -e "     ${CYAN}docker compose up -d${RESET}         # Full stack with Docker"
echo ""
echo -e "  3. Connect MCP to Claude Desktop or Cursor (see README.md)"
echo -e "  4. Set up Cloudflare Tunnel (see README.md → Cloudflare section)"
echo ""
echo -e "  ${YELLOW}Never average. Always ready.${RESET}"
echo ""
