#!/bin/bash
# Auto-remove stale git locks older than 5 minutes
REPO="/home/headyme/Heady"
for lockfile in "$REPO/.git/index.lock" "$REPO/.git/HEAD.lock" "$REPO/.git/refs/heads/main.lock"; do
    if [ -f "$lockfile" ]; then
        AGE=$(( $(date +%s) - $(stat -c %Y "$lockfile" 2>/dev/null || echo 0) ))
        if [ "$AGE" -gt 300 ]; then
            rm -f "$lockfile"
            echo "[$(date)] Removed stale lock: $lockfile (age: ${AGE}s)"
        fi
    fi
done
