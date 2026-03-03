#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HeadySystems Tunnel Watchdog
# Checks if the CF Tunnel is responding. Restarts container if dead.
# Install: crontab -e → */5 * * * * /opt/heady-stack/tunnel-watchdog.sh >> /var/log/tunnel-watchdog.log 2>&1
# ═══════════════════════════════════════════════════════════════

URL="https://api.headysystems.com/health"
CONTAINER="heady-tunnel"
LOG_PREFIX="[HeadyWatchdog]"

if curl --max-time 10 --output /dev/null --silent --head --fail "$URL"; then
  echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') ✅ Tunnel ALIVE"
else
  echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') ⚠️  Tunnel DOWN — restarting $CONTAINER"
  docker restart "$CONTAINER"
  sleep 5
  if curl --max-time 10 --output /dev/null --silent --head --fail "$URL"; then
    echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') ✅ Tunnel recovered after restart"
  else
    echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') ❌ Tunnel STILL DOWN after restart — manual intervention needed"
  fi
fi
