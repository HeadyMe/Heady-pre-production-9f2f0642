#!/bin/bash
# Heady All — Launch entire Heady platform
echo "=========================================="
echo "  HEADY SYSTEMS — Full Platform Launch"
echo "=========================================="
echo ""

BIN_DIR="$(dirname "$0")"

echo "[1/7] Starting Heady Manager (API backend)..."
bash "$BIN_DIR/heady-manager.sh" &
sleep 2

echo "[2/7] Starting HeadyWeb..."
bash "$BIN_DIR/heady-web.sh" &
sleep 1

echo "[3/7] Starting HeadyBuddy (AI Assistant)..."
bash "$BIN_DIR/heady-buddy.sh" &
sleep 1

echo "[4/7] Starting HeadyAI-IDE (code-server)..."
bash "$BIN_DIR/heady-ai-ide.sh" &
sleep 1

echo "[5/7] Starting Heady Admin..."
bash "$BIN_DIR/heady-admin.sh" &
sleep 1

echo "[6/7] Starting HeadyIO..."
bash "$BIN_DIR/heady-io.sh" &
sleep 1

echo "[7/7] Starting HeadyConnection..."
bash "$BIN_DIR/heady-connection.sh" &
sleep 3

echo ""
echo "=========================================="
echo "  All Heady Apps Running!"
echo "=========================================="
echo ""
echo "  Heady Manager    → https://manager.headysystems.com"
echo "  HeadyWeb          → https://headyme.com"
echo "  HeadyBuddy        → https://headybuddy.org"
echo "  HeadyAI-IDE       → https://ide.headysystems.com"
echo "  Heady Admin       → https://admin.headysystems.com"
echo "  HeadyIO           → https://headyio.com"
echo "  HeadyConnection   → https://headyconnection.org"
echo ""
