#!/bin/bash
# HeadyIO — headyio.com Portal
# Port: 4500
APP_DIR="/home/headyme/CascadeProjects/headyio"
PORT=4500
LOG="/home/headyme/HeadyApps/logs/heady-io.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyIO on port $PORT..." | tee "$LOG"
cd "$APP_DIR"
npx vite preview --port $PORT --host 0.0.0.0 >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-io.pid
sleep 2
xdg-open "https://headyio.com" 2>/dev/null
echo "[$(date)] HeadyIO running (PID=$PID) → https://headyio.com"
