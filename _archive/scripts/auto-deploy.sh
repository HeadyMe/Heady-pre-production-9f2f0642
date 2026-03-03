#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HEADY AUTO-DEPLOY — Zero-Touch Commit + Push + Deploy
# ═══════════════════════════════════════════════════════════════
# Watches for file changes in the Heady repo and auto-commits,
# auto-pushes to main. The deploy.yml GitHub Action handles the
# rest (Render deploy hook + Cloudflare Workers).
#
# No branches. No PRs. No manual deploys.
# Code changes → instantly live.
#
# Usage:
#   ./scripts/auto-deploy.sh          # Run in foreground
#   nohup ./scripts/auto-deploy.sh &  # Run as background daemon
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

REPO_DIR="${HEADY_REPO_DIR:-/home/headyme/Heady}"
DEBOUNCE_SECONDS="${HEADY_DEPLOY_DEBOUNCE:-30}"
LOG_FILE="${REPO_DIR}/data/logs/auto-deploy.log"
PID_FILE="${REPO_DIR}/data/auto-deploy.pid"

# Ensure log dir
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

# Write PID for watchdog
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"; log "Auto-deploy stopped."; exit 0' EXIT INT TERM

log "═══ Heady Auto-Deploy started (PID: $$) ═══"
log "  Repo: ${REPO_DIR}"
log "  Debounce: ${DEBOUNCE_SECONDS}s"
log "  Remote: $(cd "$REPO_DIR" && git remote get-url origin)"

cd "$REPO_DIR"

while true; do
  # Check for changes
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l)

  if [ "$CHANGES" -gt 0 ]; then
    log "Detected ${CHANGES} changes — debouncing ${DEBOUNCE_SECONDS}s..."
    sleep "$DEBOUNCE_SECONDS"

    # Re-check after debounce (more changes may have arrived)
    CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$CHANGES" -gt 0 ]; then
      # Generate commit message from changed files
      CHANGED_FILES=$(git status --porcelain | awk '{print $2}' | head -10 | tr '\n' ', ')
      COMMIT_MSG="auto: ${CHANGES} files — ${CHANGED_FILES%,}"

      log "Committing: ${COMMIT_MSG}"
      git add -A
      git commit -m "$COMMIT_MSG" --no-verify 2>&1 | tail -1 | tee -a "$LOG_FILE"

      log "Pushing to origin/main..."
      if git push origin main 2>&1 | tee -a "$LOG_FILE"; then
        log "✅ Push successful — deploy.yml will handle the rest."
      else
        log "⚠️ Push failed — will retry next cycle."
      fi
    fi
  fi

  # Sleep φ² seconds (~2.6s) between checks
  sleep 3
done
