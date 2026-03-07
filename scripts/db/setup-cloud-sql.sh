#!/usr/bin/env bash
# ============================================================================
# Heady Liquid Architecture v3.1 — Cloud SQL Setup Script
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
# ============================================================================
#
# Provisions and configures a Cloud SQL PostgreSQL instance with pgvector
# for the Heady platform on Google Cloud Platform.
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - Sufficient GCP permissions (Cloud SQL Admin, IAM Admin)
#   - jq installed for JSON parsing
#
# Usage:
#   ./scripts/setup-cloud-sql.sh [environment]
#
# Environments: dev, staging, production (default: dev)
#
# What this script does:
#   1. Creates the Cloud SQL PostgreSQL instance with pgvector
#   2. Creates the database and application users
#   3. Configures database flags for performance
#   4. Sets up Cloud SQL Auth Proxy service account
#   5. Runs all migrations in order
#   6. Seeds the 17-swarm taxonomy
#   7. Outputs connection strings
# ============================================================================

set -euo pipefail

# ————————————————————————————————————————————————————————————————————————————
# Configuration
# ————————————————————————————————————————————————————————————————————————————

ENVIRONMENT="${1:-dev}"
PROJECT_ID="${GCP_PROJECT_ID:-heady-liquid-architecture}"
REGION="${GCP_REGION:-us-central1}"
INSTANCE_NAME="heady-postgres-${ENVIRONMENT}"
DATABASE_NAME="heady_${ENVIRONMENT}"

# Instance tier based on environment
case "$ENVIRONMENT" in
  dev)
    TIER="db-f1-micro"
    DISK_SIZE="10"
    DISK_TYPE="PD_HDD"
    AVAILABILITY="ZONAL"
    HA_ENABLED="false"
    ;;
  staging)
    TIER="db-custom-2-4096"
    DISK_SIZE="50"
    DISK_TYPE="PD_SSD"
    AVAILABILITY="ZONAL"
    HA_ENABLED="false"
    ;;
  production)
    TIER="db-custom-4-16384"
    DISK_SIZE="100"
    DISK_TYPE="PD_SSD"
    AVAILABILITY="REGIONAL"
    HA_ENABLED="true"
    ;;
  *)
    echo "ERROR: Unknown environment '$ENVIRONMENT'. Use: dev, staging, production"
    exit 1
    ;;
esac

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

# ————————————————————————————————————————————————————————————————————————————
# Pre-flight Checks
# ————————————————————————————————————————————————————————————————————————————

echo "=============================================="
echo " Heady Cloud SQL Setup — ${ENVIRONMENT}"
echo "=============================================="
echo ""

info "Checking prerequisites..."

command -v gcloud >/dev/null 2>&1 || error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
command -v jq >/dev/null 2>&1 || error "jq not found. Install: apt-get install jq"
command -v psql >/dev/null 2>&1 || warn "psql not found. Migrations will need to be run manually."

# Verify gcloud auth
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACCOUNT" ]; then
  error "No active gcloud account. Run: gcloud auth login"
fi
log "Authenticated as: $ACCOUNT"

# Set project
gcloud config set project "$PROJECT_ID" 2>/dev/null
log "Project: $PROJECT_ID"
log "Region: $REGION"
log "Environment: $ENVIRONMENT"
echo ""

# ————————————————————————————————————————————————————————————————————————————
# Step 1: Enable Required APIs
# ————————————————————————————————————————————————————————————————————————————

info "Enabling required GCP APIs..."

gcloud services enable \
  sqladmin.googleapis.com \
  sql-component.googleapis.com \
  servicenetworking.googleapis.com \
  --quiet

log "APIs enabled"

# ————————————————————————————————————————————————————————————————————————————
# Step 2: Create Cloud SQL Instance
# ————————————————————————————————————————————————————————————————————————————

info "Checking if Cloud SQL instance '$INSTANCE_NAME' exists..."

INSTANCE_EXISTS=$(gcloud sql instances list --filter="name=$INSTANCE_NAME" --format="value(name)" 2>/dev/null || true)

if [ -n "$INSTANCE_EXISTS" ]; then
  warn "Instance '$INSTANCE_NAME' already exists. Skipping creation."
else
  info "Creating Cloud SQL instance '$INSTANCE_NAME'..."
  info "  Tier: $TIER | Disk: ${DISK_SIZE}GB $DISK_TYPE | HA: $HA_ENABLED"

  gcloud sql instances create "$INSTANCE_NAME" \
    --database-version=POSTGRES_16 \
    --tier="$TIER" \
    --region="$REGION" \
    --storage-size="${DISK_SIZE}GB" \
    --storage-type="$DISK_TYPE" \
    --storage-auto-increase \
    --availability-type="$AVAILABILITY" \
    --backup \
    --backup-start-time="03:00" \
    --enable-point-in-time-recovery \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=4 \
    --database-flags="\
max_connections=200,\
shared_buffers=256MB,\
effective_cache_size=768MB,\
work_mem=16MB,\
maintenance_work_mem=128MB,\
random_page_cost=1.1,\
effective_io_concurrency=200,\
max_wal_size=1GB,\
wal_buffers=16MB,\
default_statistics_target=100,\
log_min_duration_statement=1000,\
idle_in_transaction_session_timeout=60000,\
lock_timeout=10000,\
statement_timeout=120000,\
cloudsql.enable_pgvector=on,\
cloudsql.enable_pg_cron=on" \
    --insights-config-query-insights-enabled \
    --insights-config-query-string-length=4096 \
    --insights-config-record-application-tags \
    --quiet

  log "Cloud SQL instance created: $INSTANCE_NAME"
fi

# ————————————————————————————————————————————————————————————————————————————
# Step 3: Generate Secure Passwords
# ————————————————————————————————————————————————————————————————————————————

info "Generating secure passwords..."

ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
APP_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
READONLY_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
MONITOR_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Store in Secret Manager (if available)
if gcloud services list --filter="secretmanager.googleapis.com" --format="value(config.name)" 2>/dev/null | grep -q "secretmanager"; then
  info "Storing passwords in Secret Manager..."

  for secret_name in "heady-db-admin-password" "heady-db-app-password" "heady-db-readonly-password" "heady-db-monitor-password"; do
    gcloud secrets create "$secret_name" --replication-policy="automatic" 2>/dev/null || true
  done

  echo -n "$ADMIN_PASSWORD" | gcloud secrets versions add "heady-db-admin-password" --data-file=-
  echo -n "$APP_PASSWORD" | gcloud secrets versions add "heady-db-app-password" --data-file=-
  echo -n "$READONLY_PASSWORD" | gcloud secrets versions add "heady-db-readonly-password" --data-file=-
  echo -n "$MONITOR_PASSWORD" | gcloud secrets versions add "heady-db-monitor-password" --data-file=-

  log "Passwords stored in Secret Manager"
else
  warn "Secret Manager not enabled. Passwords will be printed below."
fi

# ————————————————————————————————————————————————————————————————————————————
# Step 4: Set postgres Password & Create Database
# ————————————————————————————————————————————————————————————————————————————

info "Setting postgres user password..."
gcloud sql users set-password postgres \
  --instance="$INSTANCE_NAME" \
  --password="$ADMIN_PASSWORD" \
  --quiet

info "Creating database '$DATABASE_NAME'..."
gcloud sql databases create "$DATABASE_NAME" \
  --instance="$INSTANCE_NAME" \
  --charset=UTF8 \
  --collation=en_US.UTF8 \
  --quiet 2>/dev/null || warn "Database '$DATABASE_NAME' may already exist."

log "Database ready"

# ————————————————————————————————————————————————————————————————————————————
# Step 5: Create Application Users
# ————————————————————————————————————————————————————————————————————————————

info "Creating application users..."

# Get instance connection name
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(connectionName)")

# Create users via gcloud
gcloud sql users create heady_admin \
  --instance="$INSTANCE_NAME" \
  --password="$ADMIN_PASSWORD" \
  --quiet 2>/dev/null || warn "User heady_admin may already exist"

gcloud sql users create heady_app \
  --instance="$INSTANCE_NAME" \
  --password="$APP_PASSWORD" \
  --quiet 2>/dev/null || warn "User heady_app may already exist"

gcloud sql users create heady_readonly \
  --instance="$INSTANCE_NAME" \
  --password="$READONLY_PASSWORD" \
  --quiet 2>/dev/null || warn "User heady_readonly may already exist"

gcloud sql users create heady_monitor \
  --instance="$INSTANCE_NAME" \
  --password="$MONITOR_PASSWORD" \
  --quiet 2>/dev/null || warn "User heady_monitor may already exist"

log "Users created"

# ————————————————————————————————————————————————————————————————————————————
# Step 6: Create Cloud SQL Auth Proxy Service Account
# ————————————————————————————————————————————————————————————————————————————

info "Setting up Cloud SQL Auth Proxy service account..."

SA_NAME="heady-cloudsql-proxy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Heady Cloud SQL Auth Proxy" \
  --quiet 2>/dev/null || warn "Service account may already exist"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --quiet 2>/dev/null

log "Service account ready: $SA_EMAIL"

# ————————————————————————————————————————————————————————————————————————————
# Step 7: Run Migrations
# ————————————————————————————————————————————————————————————————————————————

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/../migrations"

if command -v psql >/dev/null 2>&1; then
  info "Starting Cloud SQL Auth Proxy for migration..."

  # Check if proxy is already running
  if ! pgrep -f "cloud-sql-proxy" >/dev/null 2>&1; then
    if command -v cloud-sql-proxy >/dev/null 2>&1; then
      cloud-sql-proxy "$CONNECTION_NAME" --port=5433 &
      PROXY_PID=$!
      sleep 3
      info "Proxy started (PID: $PROXY_PID)"
    else
      warn "cloud-sql-proxy not found. Install: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
      warn "Skipping migrations. Run manually with:"
      warn "  cloud-sql-proxy $CONNECTION_NAME --port=5433 &"
      warn "  for f in migrations/0*.sql; do psql -h 127.0.0.1 -p 5433 -U postgres -d $DATABASE_NAME -f \$f; done"
      PROXY_PID=""
    fi
  else
    warn "Cloud SQL proxy already running"
    PROXY_PID=""
  fi

  if [ -n "${PROXY_PID:-}" ] || pgrep -f "cloud-sql-proxy" >/dev/null 2>&1; then
    info "Running migrations..."

    export PGPASSWORD="$ADMIN_PASSWORD"
    DB_HOST="127.0.0.1"
    DB_PORT="5433"

    for migration_file in "$MIGRATIONS_DIR"/0*.sql; do
      filename=$(basename "$migration_file")
      info "  Running: $filename"
      psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DATABASE_NAME" \
        -f "$migration_file" \
        --set ON_ERROR_STOP=on \
        -q
      log "  $filename ✓"
    done

    # Run seed data
    SEED_FILE="${SCRIPT_DIR}/../seed/seed-swarm-taxonomy.sql"
    if [ -f "$SEED_FILE" ]; then
      info "  Running: seed-swarm-taxonomy.sql"
      psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DATABASE_NAME" \
        -f "$SEED_FILE" \
        --set ON_ERROR_STOP=on \
        -q
      log "  Seed data applied ✓"
    fi

    # Configure RBAC for application users
    info "Configuring user permissions..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DATABASE_NAME" -q <<EOSQL
-- Grant schema usage
GRANT USAGE ON SCHEMA heady_core TO heady_app;
GRANT USAGE ON SCHEMA heady_swarm TO heady_app;
GRANT USAGE ON SCHEMA heady_audit TO heady_app;
GRANT USAGE ON SCHEMA heady_pipeline TO heady_app;
GRANT USAGE ON SCHEMA heady_identity TO heady_app;

-- heady_app: full CRUD on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA heady_core TO heady_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA heady_swarm TO heady_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA heady_audit TO heady_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA heady_pipeline TO heady_app;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_identity TO heady_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_core TO heady_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_swarm TO heady_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_audit TO heady_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA heady_identity TO heady_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA heady_core TO heady_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA heady_swarm TO heady_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA heady_pipeline TO heady_app;

-- heady_readonly: SELECT only
GRANT USAGE ON SCHEMA heady_core, heady_swarm, heady_audit, heady_pipeline, heady_identity TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_core TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_swarm TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_audit TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_pipeline TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_identity TO heady_readonly;

-- heady_monitor: pg_stat access for observability
GRANT USAGE ON SCHEMA heady_core, heady_swarm TO heady_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_core TO heady_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA heady_swarm TO heady_monitor;
GRANT pg_read_all_stats TO heady_monitor;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_swarm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_audit GRANT SELECT, INSERT ON TABLES TO heady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_pipeline GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heady_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_core GRANT SELECT ON TABLES TO heady_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA heady_swarm GRANT SELECT ON TABLES TO heady_readonly;
EOSQL

    log "Permissions configured"
    unset PGPASSWORD

    # Kill proxy if we started it
    if [ -n "${PROXY_PID:-}" ]; then
      kill "$PROXY_PID" 2>/dev/null || true
      info "Cloud SQL proxy stopped"
    fi
  fi
else
  warn "psql not available — skipping migrations"
fi

# ————————————————————————————————————————————————————————————————————————————
# Step 8: Output Summary
# ————————————————————————————————————————————————————————————————————————————

echo ""
echo "=============================================="
echo " Heady Cloud SQL Setup — Complete"
echo "=============================================="
echo ""
log "Instance:    $INSTANCE_NAME"
log "Database:    $DATABASE_NAME"
log "Connection:  $CONNECTION_NAME"
log "Region:      $REGION"
log "Tier:        $TIER"
echo ""
info "Connection strings:"
echo "  Proxy:   postgresql://heady_app:***@127.0.0.1:5433/${DATABASE_NAME}"
echo "  Direct:  postgresql://heady_app:***@<INSTANCE_IP>:5432/${DATABASE_NAME}?sslmode=require"
echo ""
info "Start the Cloud SQL Auth Proxy:"
echo "  cloud-sql-proxy ${CONNECTION_NAME} --port=5433 --credentials-file=path/to/key.json"
echo ""

if [ "${ENVIRONMENT}" != "production" ]; then
  warn "Passwords (save these — they won't be shown again):"
  echo "  heady_admin:    $ADMIN_PASSWORD"
  echo "  heady_app:      $APP_PASSWORD"
  echo "  heady_readonly: $READONLY_PASSWORD"
  echo "  heady_monitor:  $MONITOR_PASSWORD"
fi

echo ""
log "Setup complete for environment: $ENVIRONMENT"
