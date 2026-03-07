#!/usr/bin/env bash
# ============================================================================
# Heady Liquid Architecture v3.1 — Migration Runner
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
# ============================================================================
#
# Runs all SQL migrations in order against a target database.
#
# Usage:
#   ./scripts/run-migrations.sh                           # uses DATABASE_URL env var
#   ./scripts/run-migrations.sh --url postgresql://...    # explicit URL
#   ./scripts/run-migrations.sh --local                   # Docker Compose local dev
#   ./scripts/run-migrations.sh --seed                    # include seed data
#   ./scripts/run-migrations.sh --dry-run                 # print what would run
#
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_DIR/migrations"
SEED_DIR="$PROJECT_DIR/seed"

# Defaults
DB_URL="${DATABASE_URL:-}"
RUN_SEED=false
DRY_RUN=false
LOCAL_DEV=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      DB_URL="$2"
      shift 2
      ;;
    --local)
      DB_URL="postgresql://heady:heady_dev@localhost:5432/heady_dev"
      LOCAL_DEV=true
      shift
      ;;
    --seed)
      RUN_SEED=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--url URL] [--local] [--seed] [--dry-run]"
      exit 1
      ;;
  esac
done

if [ -z "$DB_URL" ]; then
  echo "ERROR: No database URL. Set DATABASE_URL or use --url/--local"
  exit 1
fi

echo "=============================================="
echo " Heady Migration Runner"
echo "=============================================="
echo ""
echo "  Database: ${DB_URL%%@*}@***"
echo "  Seed:     $RUN_SEED"
echo "  Dry Run:  $DRY_RUN"
echo ""

# Collect migration files in order
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name '0*.sql' | sort)
SEED_FILES=$(find "$SEED_DIR" -name '*.sql' | sort)

echo "Migrations to run:"
for f in $MIGRATION_FILES; do
  echo "  $(basename "$f")"
done

if [ "$RUN_SEED" = true ]; then
  echo ""
  echo "Seed files to run:"
  for f in $SEED_FILES; do
    echo "  $(basename "$f")"
  done
fi

echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would execute the above files. Exiting."
  exit 0
fi

# Wait for database if local
if [ "$LOCAL_DEV" = true ]; then
  echo "Waiting for database to be ready..."
  for i in $(seq 1 30); do
    if psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
      echo "  Database ready."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "ERROR: Database not ready after 30 attempts"
      exit 1
    fi
    sleep 1
  done
fi

# Run migrations
FAILED=0
for migration_file in $MIGRATION_FILES; do
  filename=$(basename "$migration_file")
  echo -n "  Running $filename... "

  if psql "$DB_URL" \
    -f "$migration_file" \
    --set ON_ERROR_STOP=on \
    -q 2>/tmp/heady-migration-error.log; then
    echo "✓"
  else
    echo "✗"
    echo "  ERROR: $(cat /tmp/heady-migration-error.log)"
    FAILED=1
    break
  fi
done

# Run seed data
if [ "$RUN_SEED" = true ] && [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "Running seed data..."
  for seed_file in $SEED_FILES; do
    filename=$(basename "$seed_file")
    echo -n "  Running $filename... "

    if psql "$DB_URL" \
      -f "$seed_file" \
      --set ON_ERROR_STOP=on \
      -q 2>/tmp/heady-seed-error.log; then
      echo "✓"
    else
      echo "✗"
      echo "  ERROR: $(cat /tmp/heady-seed-error.log)"
      FAILED=1
      break
    fi
  done
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=============================================="
  echo " All migrations completed successfully"
  echo "=============================================="
else
  echo "=============================================="
  echo " Migration FAILED — check errors above"
  echo "=============================================="
  exit 1
fi
