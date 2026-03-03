#!/bin/bash
# Heady Admin UI — Drupal 11 Hybrid Administration Panel
# Server: 4400, Client: 4401
APP_DIR="/home/headyme/Heady/sites/headyos-react"
SERVER_PORT=4400
CLIENT_PORT=4401
LOG="/home/headyme/HeadyApps/logs/heady-admin.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting Heady Admin UI..." | tee "$LOG"
cd "$APP_DIR"

echo "Running optimized production build preview..." | tee -a "$LOG"
npx vite preview --port $CLIENT_PORT --host 0.0.0.0 >> "$LOG" 2>&1 &
echo $! > /tmp/heady-admin-client.pid
sleep 2
xdg-open "https://admin.headysystems.com" 2>/dev/null
echo "[$(date)] Heady Admin running — server :$SERVER_PORT, UI :$CLIENT_PORT"
