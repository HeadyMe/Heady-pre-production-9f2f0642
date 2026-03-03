# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# stop-heady.sh - Stop all Heady ecosystem services

echo "Stopping Heady Systems..."
pkill -f "python3 -m http.server" 2>/dev/null || true
pkill -f "admin-ui/server/index.js" 2>/dev/null || true
pkill -f "bin/hcfp auto-success" 2>/dev/null || true
fuser -k 9000/tcp 9001/tcp 9002/tcp 9003/tcp 9004/tcp 9005/tcp 8090/tcp 2>/dev/null || true
echo "All Heady services stopped."
