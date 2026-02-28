#!/bin/bash
# HeadyWeb
APP_DIR="/home/headyme/Heady/frontend"
PORT=4100
LOG="/home/headyme/Heady/logs/heady-web.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyWeb on port $PORT..." | tee "$LOG"
cd "$APP_DIR"
# Check if node_modules exists, otherwise install
if [ ! -d "node_modules" ]; then npm install >> "$LOG" 2>&1; fi
npx vite --port $PORT --host 0.0.0.0 >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-web.pid
sleep 2
xdg-open "https://headyme.com" 2>/dev/null
echo "[$(date)] HeadyWeb running (PID=$PID) → https://headyme.com"
