#!/bin/bash
# HeadyAI-IDE — AI-Native Development Environment (code-server)
PORT=8443
LOG="/home/headyme/Heady/logs/heady-ai-ide.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date)] Starting HeadyAI-IDE (code-server) on port $PORT..." | tee "$LOG"

# Check code-server is installed
if ! command -v code-server &>/dev/null; then
  echo "Installing code-server..." | tee -a "$LOG"
  curl -fsSL https://code-server.dev/install.sh | sh >> "$LOG" 2>&1
fi

# Launch code-server pointed at Heady workspace
code-server --bind-addr 0.0.0.0:$PORT /home/headyme/Heady >> "$LOG" 2>&1 &
PID=$!
echo $PID > /tmp/heady-ai-ide.pid
sleep 2
xdg-open "https://ide.headysystems.com" 2>/dev/null
echo "[$(date)] HeadyAI-IDE running (PID=$PID) → https://ide.headysystems.com"

