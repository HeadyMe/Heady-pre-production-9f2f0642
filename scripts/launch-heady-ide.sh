#!/bin/bash

# Source local environment so Node/NPM commands are mapped successfully
source "$HOME/.bashrc" 2>/dev/null
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start backend if not currently running
if ! pgrep -f "node heady-manager.js" > /dev/null; then
  cd /home/headyme/Heady
  nohup node heady-manager.js > ~/.heady-manager.log 2>&1 &
fi

# Start frontend if not currently running
if ! pgrep -f "vite" > /dev/null; then
  cd /home/headyme/Heady/heady-ide-ui
  nohup npm run dev -- --host > ~/.heady-ide.log 2>&1 &
fi

# Wait for Vite dev server to bind the port
sleep 3

# Launch default browser (HeadyWeb)
if [ -f "/home/headyme/HeadyApps/bin/heady-web.sh" ]; then
  /home/headyme/HeadyApps/bin/heady-web.sh "http://localhost:5173" &
else
  # Fallback if heady-web is uninstalled
  xdg-open "http://localhost:5173" &
fi
