#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HeadyBuddy v3457890 — OnePlus Open (Android) Setup
# Cloud-connected thin client · Installs as PWA or via ADB
# © 2026 HeadySystems Inc. All rights reserved.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

VERSION="v3457890"
CLOUD_API="https://headyme.com/api"
ADB_PORT=3457

RED='\033[0;31m'; GREEN='\033[0;32m'; PURPLE='\033[0;35m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${PURPLE}${BOLD}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   🐝 HeadyBuddy $VERSION — OnePlus Open Setup       ║"
echo "║   Cloud-Connected · Foldable-Optimized PWA           ║"
echo "║   © 2026 HeadySystems Inc.                           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")/app"

# ─── Method 1: Local HTTP + Chrome PWA Install ───
echo -e "${CYAN}Method 1: PWA Install (recommended)${NC}"
echo "   This serves the app locally and opens Chrome for PWA install."
echo ""

if command -v python3 &>/dev/null; then
    echo "   Starting local server on port $ADB_PORT..."
    cd "$APP_DIR"
    python3 -m http.server $ADB_PORT &
    SERVER_PID=$!
    sleep 1

    echo -e "   ${GREEN}✅ Server running: http://localhost:$ADB_PORT${NC}"
    echo ""
    echo "   On your OnePlus Open:"
    echo "   1. Open Chrome → http://<this-computer-ip>:$ADB_PORT"
    echo "   2. Tap ⋮ menu → 'Install app' or 'Add to Home Screen'"
    echo "   3. HeadyBuddy will install as a standalone PWA"
    echo ""
    echo "   The PWA connects to cloud bees — zero local processing."
    echo "   Supports foldable mode (front screen + open layout)."
    echo ""
    echo -e "   Press ${BOLD}Enter${NC} to stop server, or ${BOLD}Ctrl+C${NC} to keep running."
    read -r
    kill $SERVER_PID 2>/dev/null
else
    echo "   Python3 not found. Use Method 2 (ADB) instead."
fi

echo ""

# ─── Method 2: ADB Sideload ───
echo -e "${CYAN}Method 2: ADB Direct Install${NC}"
echo ""

if command -v adb &>/dev/null; then
    echo "   ADB detected. Checking for connected devices..."
    DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l)

    if [ "$DEVICES" -gt 0 ]; then
        echo -e "   ${GREEN}✅ Device connected${NC}"
        echo ""

        # Push app files to device
        DEVICE_DIR="/sdcard/HeadyBuddy"
        echo "   Pushing app to $DEVICE_DIR..."
        adb shell mkdir -p "$DEVICE_DIR" 2>/dev/null || true
        adb push "$APP_DIR/" "$DEVICE_DIR/" 2>/dev/null && {
            echo -e "   ${GREEN}✅ App pushed to device${NC}"
        } || {
            echo -e "   ${RED}Push failed — check USB debugging${NC}"
        }

        # Write device config
        CONFIG=$(cat << CONFIGEOF
{
    "version": "$VERSION",
    "deviceType": "oneplus-open-android",
    "cloudApi": "$CLOUD_API",
    "opsMode": "cloud-orchestrated",
    "localResources": "thin-client",
    "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "fsAuth": {
        "scope": "pending",
        "authorized": false
    },
    "beeSwarm": {
        "connectionType": "websocket",
        "endpoint": "wss://headyme.com/swarm",
        "localCpu": 0
    },
    "foldable": {
        "frontScreen": true,
        "openLayout": true,
        "flexMode": true
    }
}
CONFIGEOF
)
        echo "$CONFIG" | adb shell "cat > $DEVICE_DIR/config/device.json" 2>/dev/null || {
            echo "   Config push via adb shell failed — writing locally"
            mkdir -p /tmp/heady-android-config
            echo "$CONFIG" > /tmp/heady-android-config/device.json
            adb push /tmp/heady-android-config/device.json "$DEVICE_DIR/config/" 2>/dev/null || true
        }

        # Open in Chrome
        echo "   Opening in Chrome on device..."
        adb shell am start -a android.intent.action.VIEW \
            -d "file://$DEVICE_DIR/index.html" \
            -n com.android.chrome/com.google.android.apps.chrome.Main 2>/dev/null || {
            echo "   Auto-open failed — manually open $DEVICE_DIR/index.html"
        }
    else
        echo "   No device connected. Enable USB Debugging on your OnePlus Open:"
        echo "   Settings → About Phone → Tap 'Build Number' 7 times"
        echo "   Settings → System → Developer Options → USB Debugging ON"
    fi
else
    echo "   ADB not found. Install Android Platform Tools:"
    echo "   Linux:   sudo apt install android-tools-adb"
    echo "   macOS:   brew install android-platform-tools"
    echo "   Windows: scoop install adb"
fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   HeadyBuddy $VERSION — Android Setup Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "   PWA URL:  http://localhost:$ADB_PORT (while server runs)"
echo "   Cloud:    All ops via cloud bees (0% device CPU)"
echo "   Foldable: Supports front screen + open layout modes"
echo ""
echo -e "   ${PURPLE}Your OnePlus Open = thin client · Cloud = brain${NC}"
echo ""
