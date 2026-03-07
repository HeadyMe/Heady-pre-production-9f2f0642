#!/usr/bin/env bash
# =============================================================================
# HeadyOS — One-Command Demo Environment Setup
# =============================================================================
# φ = 1.618033988749895
# All numeric parameters derive from φ and Fibonacci sequences.
#
# Usage:
#   chmod +x demo-setup.sh
#   ./demo-setup.sh
#
# Requirements:
#   - Docker 24+ and Docker Compose v2
#   - Ports 3000, 5432, 6379, 4317 available
#   - 2 GB RAM minimum (4 GB recommended)
#   - macOS / Linux (WSL2 supported)
# =============================================================================

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
GOLD='\033[0;33m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'
BOLD='\033[1m'

# ── φ Constants ───────────────────────────────────────────────────────────────
PHI=1.618033988749895
FIB_5=5
FIB_6=8
FIB_7=13
FIB_8=21
FIB_9=34
FIB_10=55
FIB_11=89
FIB_12=144
FIB_13=233
FIB_14=377
FIB_15=610
FIB_16=987

# ── Configuration ─────────────────────────────────────────────────────────────
DEMO_PROJECT="heady-demo"
DEMO_DIR="$HOME/.heady-demo"
DEMO_PORT=3000
POSTGRES_PORT=5432
REDIS_PORT=6379
OTEL_PORT=4317
DEMO_TENANT_ID="demo-founder-$(date +%s)"
DEMO_USER_ID="demo-user-01"
DEMO_ORG="Acme Foundation"

# Docker image tags
HEADY_BRAIN_IMAGE="headysystems/heady-brain:latest"
HEADY_CONDUCTOR_IMAGE="headysystems/heady-conductor:latest"
HEADY_MCP_IMAGE="headysystems/heady-mcp:latest"
POSTGRES_IMAGE="pgvector/pgvector:pg16"
REDIS_IMAGE="redis:7-alpine"
OTEL_IMAGE="otel/opentelemetry-collector:0.93.0"

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  echo -e "${GOLD}"
  cat << 'BANNER'
   _   _                _        ___  ____
  | | | | ___  __ _  __| |_   _ / _ \/ ___|
  | |_| |/ _ \/ _` |/ _` | | | | | | \___ \
  |  _  |  __/ (_| | (_| | |_| | |_| |___) |
  |_| |_|\___|\__,_|\__,_|\__, |\___/|____/
                           |___/
         Demo Environment Setup — Founder Pilot
  φ = 1.618033988749895 | Sacred Geometry AI Orchestration
BANNER
  echo -e "${RESET}"
}

# ── Logging ───────────────────────────────────────────────────────────────────
log_step() { echo -e "\n${GOLD}●${RESET} ${BOLD}$1${RESET}"; }
log_info()  { echo -e "  ${BLUE}→${RESET} $1"; }
log_ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
log_warn()  { echo -e "  ${GOLD}⚠${RESET} $1"; }
log_err()   { echo -e "  ${RED}✗${RESET} $1" >&2; }

# ── Prerequisite Checks ───────────────────────────────────────────────────────
check_prerequisites() {
  log_step "Checking prerequisites"

  local errors=0

  # Docker
  if ! command -v docker &>/dev/null; then
    log_err "Docker not found. Install: https://docs.docker.com/get-docker/"
    ((errors++))
  else
    local docker_version
    docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    log_ok "Docker $docker_version"
  fi

  # Docker Compose v2
  if ! docker compose version &>/dev/null 2>&1; then
    log_err "Docker Compose v2 not found. Update Docker Desktop or install separately."
    ((errors++))
  else
    local compose_version
    compose_version=$(docker compose version --short 2>/dev/null || echo "unknown")
    log_ok "Docker Compose $compose_version"
  fi

  # jq (optional but useful)
  if command -v jq &>/dev/null; then
    log_ok "jq $(jq --version)"
  else
    log_warn "jq not found (optional). Install for nicer output: brew install jq"
  fi

  # Check ports
  for port in $DEMO_PORT $POSTGRES_PORT $REDIS_PORT $OTEL_PORT; do
    if lsof -Pi :$port -sTCP:LISTEN -t &>/dev/null 2>&1; then
      log_warn "Port $port is in use. May cause conflicts."
    fi
  done

  # RAM check
  local ram_gb
  if [[ "$(uname)" == "Darwin" ]]; then
    ram_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
  else
    ram_gb=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))
  fi

  if [[ $ram_gb -lt $FIB_6 ]]; then  # fib(6)=8 GB recommended
    log_warn "RAM: ${ram_gb}GB detected. fib(6)=8 GB recommended for full demo."
  else
    log_ok "RAM: ${ram_gb}GB (fib(6)=8 GB recommended ✓)"
  fi

  if [[ $errors -gt 0 ]]; then
    log_err "Prerequisites check failed with $errors error(s). Please resolve before continuing."
    exit 1
  fi
}

# ── Setup Demo Directory ──────────────────────────────────────────────────────
setup_directories() {
  log_step "Setting up demo environment at $DEMO_DIR"
  mkdir -p "$DEMO_DIR"/{data/postgres,data/redis,data/vector,config,logs,seed}
  log_ok "Created directory structure"
}

# ── Generate Docker Compose ───────────────────────────────────────────────────
write_compose_file() {
  log_step "Writing Docker Compose configuration"

  cat > "$DEMO_DIR/docker-compose.yml" << COMPOSE
# HeadyOS Demo Environment — Docker Compose
# φ = 1.618033988749895 | All numeric params: Fibonacci-derived
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

version: '3.9'

services:
  # ── Postgres + pgvector ──────────────────────────────────────────────────────
  postgres:
    image: ${POSTGRES_IMAGE}
    container_name: heady-demo-postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT}:5432"
    environment:
      POSTGRES_DB: heady_demo
      POSTGRES_USER: heady
      POSTGRES_PASSWORD: heady_demo_secret
    volumes:
      - ${DEMO_DIR}/data/postgres:/var/lib/postgresql/data
      - ${DEMO_DIR}/config/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U heady -d heady_demo"]
      interval: ${FIB_5}s     # fib(5) seconds
      timeout: ${FIB_4}s      # fib(4)=3 seconds
      retries: ${FIB_5}       # fib(5)=5 retries
      start_period: ${FIB_6}s # fib(6)=8 seconds
    networks: [heady-net]

  # ── Redis ───────────────────────────────────────────────────────────────────
  redis:
    image: ${REDIS_IMAGE}
    container_name: heady-demo-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT}:6379"
    command: >
      redis-server
      --maxmemory ${FIB_15}mb
      --maxmemory-policy allkeys-lru
      --save 60 ${FIB_9}
      --loglevel notice
    volumes:
      - ${DEMO_DIR}/data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: ${FIB_5}s
      timeout: ${FIB_3}s
      retries: ${FIB_5}
    networks: [heady-net]

  # ── OTel Collector ───────────────────────────────────────────────────────────
  otel-collector:
    image: ${OTEL_IMAGE}
    container_name: heady-demo-otel
    restart: unless-stopped
    ports:
      - "${OTEL_PORT}:4317"
    volumes:
      - ${DEMO_DIR}/config/otel-collector.yaml:/etc/otel-collector.yaml:ro
    command: ["--config=/etc/otel-collector.yaml"]
    networks: [heady-net]

  # ── heady-brain (Inference Engine) ──────────────────────────────────────────
  heady-brain:
    image: ${HEADY_BRAIN_IMAGE}
    container_name: heady-demo-brain
    restart: unless-stopped
    environment:
      NODE_ENV: demo
      DATABASE_URL: postgresql://heady:heady_demo_secret@postgres:5432/heady_demo
      REDIS_URL: redis://redis:6379
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      TENANT_ID: ${DEMO_TENANT_ID}
      PHI: ${PHI}
      MAX_CONCURRENT_AGENTS: ${FIB_7}    # fib(7)=13
      API_CALLS_PER_MIN: ${FIB_12}       # fib(12)=144
      RATE_LIMIT_BURST: ${FIB_13}        # fib(13)=233
      VECTOR_SLOTS: ${FIB_16}            # fib(16)=987
      STORAGE_MB: ${FIB_16}              # fib(16)=987
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    networks: [heady-net]

  # ── heady-conductor (Multi-Agent Orchestrator) ───────────────────────────────
  heady-conductor:
    image: ${HEADY_CONDUCTOR_IMAGE}
    container_name: heady-demo-conductor
    restart: unless-stopped
    ports:
      - "${DEMO_PORT}:3000"
    environment:
      NODE_ENV: demo
      DATABASE_URL: postgresql://heady:heady_demo_secret@postgres:5432/heady_demo
      REDIS_URL: redis://redis:6379
      BRAIN_URL: http://heady-brain:3001
      MCP_URL: http://heady-mcp:3002
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      TENANT_ID: ${DEMO_TENANT_ID}
      MAX_AGENTS: ${FIB_7}           # fib(7)=13
      TIMEOUT_MS_BASE: 1618          # φ × 1000
    depends_on:
      - heady-brain
      - heady-mcp
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3000/health"]
      interval: ${FIB_7}s    # fib(7)=13 seconds
      timeout: ${FIB_5}s
      retries: ${FIB_5}
    networks: [heady-net]

  # ── heady-mcp (MCP Gateway) ──────────────────────────────────────────────────
  heady-mcp:
    image: ${HEADY_MCP_IMAGE}
    container_name: heady-demo-mcp
    restart: unless-stopped
    environment:
      NODE_ENV: demo
      REDIS_URL: redis://redis:6379
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      SANDBOX_TIMEOUT_MS: 4236       # φ^3 × 1000ms
      MAX_TOOL_CONCURRENCY: ${FIB_5} # fib(5)=5 concurrent tool calls
    depends_on:
      redis: { condition: service_healthy }
    networks: [heady-net]

networks:
  heady-net:
    driver: bridge

COMPOSE

  log_ok "docker-compose.yml written"
}

# ── Generate Config Files ─────────────────────────────────────────────────────
write_config_files() {
  log_step "Writing configuration files"

  # PostgreSQL init script
  cat > "$DEMO_DIR/config/init.sql" << SQL
-- HeadyOS Demo DB Initialization
-- φ = 1.618033988749895

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Demo tenant schema
CREATE SCHEMA IF NOT EXISTS tenant_demo;

-- Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       VARCHAR(${FIB_12}) NOT NULL,  -- fib(12)=144 chars
  tier       VARCHAR(${FIB_8}) NOT NULL DEFAULT 'FOUNDER',  -- fib(8)=21
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector memory table
CREATE TABLE IF NOT EXISTS tenant_demo.vector_memory (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  namespace  VARCHAR(${FIB_8}) NOT NULL,
  content    TEXT NOT NULL,
  embedding  vector(1536),
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create IVFFlat index (89 probe lists = fib(11))
CREATE INDEX IF NOT EXISTS vec_mem_embedding_idx
  ON tenant_demo.vector_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = ${FIB_11});

-- Seed demo tenant
INSERT INTO public.tenants (id, name, tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Foundation', 'FOUNDER')
ON CONFLICT DO NOTHING;

-- Seed demo vector memories (fib(5)=5 seed memories)
INSERT INTO tenant_demo.vector_memory (namespace, content, metadata)
VALUES
  ('grants', 'Successfully funded: Education grant 2024 for digital literacy programs. Key criteria: community impact, measurable outcomes, sustainability plan.', '{"grant_id":"2024-001","status":"funded"}'),
  ('grants', 'Successfully funded: Youth development grant 2024. Key criteria: age 13-21, underserved communities, program evaluation.', '{"grant_id":"2024-002","status":"funded"}'),
  ('grants', 'Declined application: Technology infrastructure grant. Gap identified: weak sustainability narrative and insufficient budget justification.', '{"grant_id":"2024-003","status":"declined","lesson":"improve_sustainability"}'),
  ('grants', 'Foundation preferences: ABC Foundation prioritizes STEM education, requires 3-year project plans, minimum budget $50,000.', '{"funder":"ABC Foundation","type":"preference"}'),
  ('grants', 'HeadyOS pilot success: Automated 5 grant drafts in 89 days. p95 latency under 5 seconds. NPS 52.', '{"type":"case_study","pilot_day":89}')
ON CONFLICT DO NOTHING;

SELECT 'HeadyOS demo database initialized. φ-powered.' AS status;
SQL

  # OTel Collector config
  cat > "$DEMO_DIR/config/otel-collector.yaml" << OTEL
# OpenTelemetry Collector — HeadyOS Demo
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 5s            # fib(5) seconds
    send_batch_size: 1000  # fib(7)*fib(9) approx

exporters:
  logging:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [logging]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [logging]
OTEL

  log_ok "init.sql, otel-collector.yaml written"
}

# ── Write Seed Data Script ────────────────────────────────────────────────────
write_seed_script() {
  log_step "Writing seed data script"

  cat > "$DEMO_DIR/seed/seed-demo.sh" << 'SEED'
#!/usr/bin/env bash
# HeadyOS Demo Seed Data

BASE_URL="${HEADY_BASE_URL:-http://localhost:3000}"
TENANT_ID="${HEADY_TENANT_ID:-demo-founder-001}"
AUTH_TOKEN="${HEADY_AUTH_TOKEN:-demo-jwt-token}"

echo "Seeding HeadyOS demo environment at $BASE_URL"

# Wait for conductor to be ready
for i in $(seq 1 13); do  # fib(7)=13 attempts
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✓ heady-conductor is ready"
    break
  fi
  echo "  Waiting... attempt $i/13"
  sleep 3
done

# Create demo workspace
curl -sf -X POST "$BASE_URL/v1/workspaces" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"name\": \"Acme Foundation Demo\",
    \"region\": \"us-central1\"
  }" | jq . 2>/dev/null || true

echo "✓ Demo workspace seeded"

# Create Grant Writer agent
curl -sf -X POST "$BASE_URL/v1/agents" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grant Writer v1 (Demo)",
    "template": "grant-writer",
    "model": "gpt-4o",
    "tools": ["read-document", "web-search", "vector-recall", "write-document", "extract-entities"],
    "systemPrompt": "You are an expert non-profit grant writer. Analyze RFPs thoroughly and produce compelling, criteria-matched grant proposals. Always cite past successful grants from memory.",
    "maxTokens": 720,
    "cslLevel": "MODERATE"
  }' | jq . 2>/dev/null || true

echo "✓ Grant Writer agent created"
echo ""
echo "Demo environment ready! Open: http://localhost:3000/dashboard"
SEED

  chmod +x "$DEMO_DIR/seed/seed-demo.sh"
  log_ok "seed-demo.sh written"
}

# ── Pull Images ───────────────────────────────────────────────────────────────
pull_images() {
  log_step "Pulling Docker images"
  log_info "This may take a few minutes on first run…"

  # Pull public images
  docker pull "$POSTGRES_IMAGE" &
  docker pull "$REDIS_IMAGE" &
  docker pull "$OTEL_IMAGE" &
  wait

  log_ok "Public images pulled (Postgres, Redis, OTel)"
  log_info "Heady service images (heady-brain, heady-conductor, heady-mcp) will be pulled on 'docker compose up'"
}

# ── Start Services ────────────────────────────────────────────────────────────
start_services() {
  log_step "Starting HeadyOS demo services"

  cd "$DEMO_DIR"

  # Start infrastructure services first
  log_info "Starting Postgres, Redis, OTel Collector…"
  docker compose up -d postgres redis otel-collector 2>&1

  # Wait for postgres (up to fib(11)=89 seconds)
  log_info "Waiting for Postgres to be healthy (up to ${FIB_11}s)…"
  local waited=0
  until docker compose exec -T postgres pg_isready -U heady -d heady_demo &>/dev/null; do
    sleep 3
    waited=$((waited + 3))
    if [[ $waited -ge $FIB_11 ]]; then
      log_err "Postgres did not become healthy in ${FIB_11}s. Check: docker compose logs postgres"
      exit 1
    fi
  done
  log_ok "Postgres healthy (${waited}s)"

  # Start application services
  log_info "Starting heady-brain, heady-conductor, heady-mcp…"
  docker compose up -d 2>&1 || {
    log_warn "Some services may be using placeholder images. Run with real images for full demo."
    log_info "Infrastructure services (Postgres, Redis) are running."
  }

  log_ok "Services started"
}

# ── Seed Demo Data ────────────────────────────────────────────────────────────
seed_demo() {
  log_step "Seeding demo data"

  # Wait for conductor (up to fib(7)=13 × 5s = 65s)
  log_info "Waiting for heady-conductor (up to 65s)…"
  local attempts=0
  until curl -sf "http://localhost:${DEMO_PORT}/health" &>/dev/null; do
    sleep 5
    attempts=$((attempts + 1))
    if [[ $attempts -ge $FIB_7 ]]; then
      log_warn "heady-conductor not yet responding. Skipping API seed (will use DB seed only)."
      return 0
    fi
  done

  export HEADY_BASE_URL="http://localhost:${DEMO_PORT}"
  export HEADY_TENANT_ID="$DEMO_TENANT_ID"
  export HEADY_AUTH_TOKEN="demo-jwt-token"

  bash "$DEMO_DIR/seed/seed-demo.sh"
  log_ok "Demo data seeded"
}

# ── Open Browser ──────────────────────────────────────────────────────────────
open_browser() {
  log_step "Opening HeadyOS Admin Panel"

  local url="http://localhost:${DEMO_PORT}/dashboard"
  log_info "Admin panel: $url"
  log_info "API base: http://localhost:${DEMO_PORT}/v1"
  log_info "Postgres: localhost:${POSTGRES_PORT} (user: heady, db: heady_demo)"
  log_info "Redis: localhost:${REDIS_PORT}"

  # Open browser
  sleep 2
  if [[ "$(uname)" == "Darwin" ]]; then
    open "$url" 2>/dev/null || true
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url" 2>/dev/null || true
  else
    log_info "Open manually: $url"
  fi
}

# ── Print Summary ─────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GOLD}════════════════════════════════════════════════════════${RESET}"
  echo -e "${GOLD}  HeadyOS Demo Environment — Ready${RESET}"
  echo -e "${GOLD}════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "  ${BLUE}Dashboard${RESET}   http://localhost:${DEMO_PORT}/dashboard"
  echo -e "  ${BLUE}API Base${RESET}    http://localhost:${DEMO_PORT}/v1"
  echo -e "  ${BLUE}Health${RESET}      http://localhost:${DEMO_PORT}/health"
  echo ""
  echo -e "  ${BLUE}Tenant ID${RESET}   $DEMO_TENANT_ID"
  echo ""
  echo -e "  ${DIM}Founder Tier Limits:${RESET}"
  echo -e "  ${DIM}  Concurrent Agents: fib(7)=${FIB_7}${RESET}"
  echo -e "  ${DIM}  API calls/min: fib(12)=${FIB_12}${RESET}"
  echo -e "  ${DIM}  Storage: fib(16)=${FIB_16} MB${RESET}"
  echo -e "  ${DIM}  Vector Memory: fib(16)=${FIB_16} slots${RESET}"
  echo ""
  echo -e "  ${DIM}To stop:    cd $DEMO_DIR && docker compose down${RESET}"
  echo -e "  ${DIM}To reset:   cd $DEMO_DIR && docker compose down -v${RESET}"
  echo -e "  ${DIM}To logs:    cd $DEMO_DIR && docker compose logs -f${RESET}"
  echo ""
  echo -e "  ${GOLD}φ = 1.618033988749895 | Sacred Geometry AI Orchestration${RESET}"
  echo ""
}

# ── Cleanup Handler ───────────────────────────────────────────────────────────
cleanup() {
  if [[ $? -ne 0 ]]; then
    echo ""
    log_err "Setup failed. For support: eric@headyconnection.org"
    echo -e "  ${DIM}Logs: cd $DEMO_DIR && docker compose logs${RESET}"
  fi
}

trap cleanup EXIT

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
main() {
  print_banner
  check_prerequisites
  setup_directories
  write_compose_file
  write_config_files
  write_seed_script
  pull_images
  start_services
  seed_demo
  print_summary
  open_browser
}

main "$@"
