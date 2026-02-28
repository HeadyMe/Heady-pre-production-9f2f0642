#!/bin/bash
# © 2026 Heady Systems LLC.
# HCFP Auto-Commit & Push — Cron-safe wrapper
# Runs every 15 minutes via crontab with flock protection.
# Delegates commit logic to src/engines/auto-commit-engine.js

REPO="/home/headyme/Heady"
LOCK="/tmp/heady-auto-commit.flock"
LOG="$REPO/logs/auto-commit.log"

# flock — prevent overlapping cron instances
exec 200>"$LOCK"
flock -n 200 || {
    echo "[$(date)] Skipped: another auto-commit instance is running" >> "$LOG"
    exit 0
}

cd "$REPO" || exit 1

# Clean up stale .git/index.lock only if owning process is dead
if [ -f .git/index.lock ]; then
    LOCK_AGE=$(( $(date +%s) - $(stat -c %Y .git/index.lock 2>/dev/null || echo 0) ))
    if [ "$LOCK_AGE" -gt 300 ]; then
        echo "[$(date)] Removing stale .git/index.lock (age: ${LOCK_AGE}s)" >> "$LOG"
        rm -f .git/index.lock
    fi
fi

# Delegate to the Node.js auto-commit engine for smart commit messages
node -e "
  const { autoCommitEngine } = require('./src/engines/auto-commit-engine');
  autoCommitEngine.autoCommitAndPush({ context: 'cron:15min' })
    .then(r => {
      if (r.committed) {
        console.log('Committed: ' + r.commitHash + ' — ' + (r.message || ''));
        if (r.pushed) console.log('Pushed successfully');
        else if (r.error) console.error('Push failed: ' + r.error);
      } else if (r.clean) {
        console.log('Clean — nothing to commit');
      } else if (r.skipped) {
        console.log('Skipped: ' + r.reason);
      } else if (r.error) {
        console.error('Error: ' + r.error);
      }
      process.exit(r.error && !r.committed ? 1 : 0);
    })
    .catch(e => { console.error(e.message); process.exit(1); });
" >> "$LOG" 2>&1

exit 0
