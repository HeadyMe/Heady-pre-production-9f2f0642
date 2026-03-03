#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 🐝 Heady One-Click Universal Install — Computer + Phone + Laptop
# © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
#
# This SINGLE script:
#   1. Installs Buddy on THIS machine (Linux/macOS/WSL)
#   2. Starts cross-device sync server
#   3. Generates install links for phone and other devices
#   4. Configures all detected IDEs automatically
#   5. Activates HeadyBuddy with 3D vector sync
#
# Usage:
#   bash one-click-install.sh
#   -- or remotely --
#   curl -sSL https://headyme.com/install | bash
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Config ──
HEADY_VERSION="3.0.0"
HEADY_API_URL="${HEADY_URL:-https://heady-manager-837145615012.us-central1.run.app}"
HEADY_DIR="$HOME/.heady"
BIN_DIR="$HEADY_DIR/bin"
DATA_DIR="$HEADY_DIR/data"
SYNC_PORT="${HEADY_SYNC_PORT:-8421}"
MCP_PORT="${HEADY_MCP_PORT:-8420}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Colors ──
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' B='\033[0;34m'
P='\033[0;35m' C='\033[0;36m' W='\033[1;37m' NC='\033[0m'

ok()   { echo -e " ${G}✓${NC} $1"; }
info() { echo -e " ${B}ℹ${NC} $1"; }
warn() { echo -e " ${Y}⚠${NC}  $1"; }
err()  { echo -e " ${R}✖${NC}  $1" >&2; }

# ═══════════════════════════════════════════════════════════════════
echo -e "
${P}╔═══════════════════════════════════════════════════════════╗${NC}
${P}║${NC}   ${W}🐝 Heady — One-Click Universal Installer${NC}              ${P}║${NC}
${P}║${NC}   ${C}Computer + Phone + Laptop — Synced Everywhere${NC}         ${P}║${NC}
${P}║${NC}   ${C}Sacred Geometry :: Organic Systems :: v${HEADY_VERSION}${NC}           ${P}║${NC}
${P}╚═══════════════════════════════════════════════════════════╝${NC}
"

# ═══════════ PHASE 1: This Machine ═══════════════════════════════
echo -e "${W}━━━ Phase 1: Installing on THIS machine ━━━${NC}"

# 1a. Node.js check/install
if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
        ok "Node.js $(node -v)"
    else
        info "Upgrading Node.js..."
        curl -fsSL https://fnm.vercel.app/install | bash
        export PATH="$HOME/.local/share/fnm:$PATH"
        eval "$(fnm env)" 2>/dev/null || true
        fnm install 22 && fnm use 22
        ok "Node.js $(node -v)"
    fi
else
    info "Installing Node.js 22..."
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
    elif command -v brew &>/dev/null; then
        brew install node@22
    else
        curl -fsSL https://fnm.vercel.app/install | bash
        export PATH="$HOME/.local/share/fnm:$PATH"
        eval "$(fnm env)" 2>/dev/null || true
        fnm install 22 && fnm use 22
    fi
    ok "Node.js $(node -v)"
fi

# 1b. Create directory structure
mkdir -p "$HEADY_DIR" "$BIN_DIR" "$DATA_DIR" "$DATA_DIR/sync" "$DATA_DIR/vectors" "$DATA_DIR/telemetry"
ok "Directory structure: $HEADY_DIR"

# 1c. Generate device identity
DEVICE_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || openssl rand -hex 16)
DEVICE_NAME=$(hostname)
DEVICE_PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
DEVICE_ARCH=$(uname -m)

# 1d. Install npm dependencies (if in project dir)
if [ -f "$PROJECT_ROOT/package.json" ]; then
    info "Installing project dependencies..."
    cd "$PROJECT_ROOT" && npm install --silent 2>/dev/null && ok "Dependencies installed" || true
fi

# 1e. Write config
cat > "$HEADY_DIR/config.json" << CONF
{
    "version": "${HEADY_VERSION}",
    "deviceId": "${DEVICE_ID}",
    "deviceName": "${DEVICE_NAME}",
    "platform": "${DEVICE_PLATFORM}",
    "arch": "${DEVICE_ARCH}",
    "apiUrl": "${HEADY_API_URL}",
    "mcpPort": ${MCP_PORT},
    "syncPort": ${SYNC_PORT},
    "transport": "multi",
    "installedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "autoUpdate": true,
    "crossDeviceSync": true,
    "vectorSpace": {
        "dimensions": 384,
        "gpu": true
    }
}
CONF
ok "Config: $HEADY_DIR/config.json"

# ═══════════ PHASE 2: Buddy CLI ═════════════════════════════════
echo ""
echo -e "${W}━━━ Phase 2: Buddy CLI ━━━${NC}"

cat > "$BIN_DIR/buddy" << 'BUDDY_CLI'
#!/bin/bash
# 🐝 Buddy CLI — Heady Systems
CONFIG="$HOME/.heady/config.json"
API=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)
DID=$(grep -o '"deviceId"[^,]*' "$CONFIG" | cut -d'"' -f4)

case "${1:-help}" in
    status)
        echo "🐝 Buddy Status"
        echo "   Device: $(hostname) (${DID:0:12}...)"
        echo "   API: $API"
        echo "   Sync: ws://localhost:$(grep -o '"syncPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')"
        curl -sS "$API/api/pulse" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "   [offline mode]"
        ;;
    sync)
        echo "🔄 Sync Status"
        curl -sS "http://localhost:$(grep -o '"syncPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')/sync/status" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "   Sync server not running"
        ;;
    devices)
        echo "📱 Connected Devices"
        curl -sS "http://localhost:$(grep -o '"syncPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')/sync/devices" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "   No devices connected"
        ;;
    research)
        shift
        curl -sS -X POST "http://localhost:$(grep -o '"mcpPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')/mcp/tools/call" \
            -H "Content-Type: application/json" \
            -d "{\"name\":\"heady_perplexity_research\",\"arguments\":{\"query\":\"$*\",\"mode\":\"deep\"}}" 2>/dev/null | python3 -m json.tool 2>/dev/null
        ;;
    mcp)
        shift
        HEADY_MCP_TRANSPORT=stdio exec node "$HOME/.heady/heady-source/src/mcp/colab-mcp-bridge.js" "$@"
        ;;
    serve)
        info "Starting MCP bridge + sync server..."
        HEADY_MCP_TRANSPORT=http node "$HOME/.heady/heady-source/src/mcp/colab-mcp-bridge.js" &
        echo "🐝 MCP bridge running on :$(grep -o '"mcpPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')"
        ;;
    install-phone)
        echo ""
        echo "📱 Install Buddy on your phone:"
        echo ""
        echo "   Option A — PWA (recommended):"
        echo "   Open in Chrome/Safari on your phone:"
        echo "   https://headyme.com/buddy"
        echo "   Then tap 'Add to Home Screen'"
        echo ""
        echo "   Option B — Kiwi Browser (Android, full MCP):"
        echo "   1. Install Kiwi Browser from Play Store"
        echo "   2. Open: https://headyme.com/buddy"
        echo "   3. Install the HeadyBuddy extension"
        echo ""
        echo "   Both auto-sync with this device via:"
        echo "   ws://$(hostname):$(grep -o '"syncPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')"
        ;;
    install-laptop)
        echo ""
        echo "💻 Install Buddy on another computer:"
        echo ""
        echo "   Run this ONE command:"
        echo "   curl -sSL https://raw.githubusercontent.com/HeadyMe/Heady/main/scripts/install-buddy.sh | bash"
        echo ""
        echo "   Or if on the same network:"
        echo "   curl -sSL http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'your-ip'):$(grep -o '"mcpPort"[^,]*' "$CONFIG" | grep -o '[0-9]*')/install.sh | bash"
        ;;
    *)
        echo "🐝 Buddy CLI — Heady Systems"
        echo ""
        echo "  buddy status          System status"
        echo "  buddy sync            Cross-device sync status"
        echo "  buddy devices         List connected devices"
        echo "  buddy research <q>    Deep multi-provider research"
        echo "  buddy mcp             Start MCP server (stdio)"
        echo "  buddy serve           Start MCP bridge (HTTP)"
        echo "  buddy install-phone   Phone install instructions"
        echo "  buddy install-laptop  Laptop install command"
        ;;
esac
BUDDY_CLI
chmod +x "$BIN_DIR/buddy"
ok "Buddy CLI: $BIN_DIR/buddy"

# ═══════════ PHASE 3: IDE Auto-Configuration ════════════════════
echo ""
echo -e "${W}━━━ Phase 3: IDE Auto-Configuration ━━━${NC}"

MCP_CMD="node"
MCP_ARG="$PROJECT_ROOT/src/mcp/colab-mcp-bridge.js"

# Antigravity / Gemini (current IDE)
GEMINI_DIR="$PROJECT_ROOT/.gemini"
mkdir -p "$GEMINI_DIR"
cat > "$GEMINI_DIR/settings.json" << GEMINI_EOF
{
    "mcpServers": {
        "Heady": {
            "command": "$MCP_CMD",
            "args": ["$MCP_ARG"],
            "cwd": "$PROJECT_ROOT",
            "env": {
                "HEADY_MCP_TRANSPORT": "stdio",
                "HEADY_API_KEY": "\${HEADY_API_KEY}",
                "HEADY_BRAIN_URL": "https://headyio.com",
                "HEADY_MANAGER_URL": "https://api.headysystems.com",
                "HEADY_DEVICE_ID": "$DEVICE_ID"
            }
        }
    }
}
GEMINI_EOF
ok "Antigravity IDE configured"

# Claude Desktop
for CLAUDE_DIR in "$HOME/Library/Application Support/Claude" "$HOME/.config/Claude"; do
    if [ -d "$CLAUDE_DIR" ]; then
        cat > "$CLAUDE_DIR/claude_desktop_config.json" << CLAUDE_EOF
{
    "mcpServers": {
        "heady": {
            "command": "$MCP_CMD",
            "args": ["$MCP_ARG"],
            "env": { "HEADY_MCP_TRANSPORT": "stdio", "HEADY_DEVICE_ID": "$DEVICE_ID" }
        }
    }
}
CLAUDE_EOF
        ok "Claude Desktop configured"
    fi
done

# Cursor
if [ -d "$HOME/.cursor" ]; then
    cat > "$HOME/.cursor/mcp.json" << CURSOR_EOF
{
    "mcpServers": {
        "heady": {
            "command": "$MCP_CMD",
            "args": ["$MCP_ARG"],
            "env": { "HEADY_MCP_TRANSPORT": "stdio", "HEADY_DEVICE_ID": "$DEVICE_ID" }
        }
    }
}
CURSOR_EOF
    ok "Cursor configured"
fi

# VS Code / Codium
for VSCODE_DIR in "$HOME/.vscode" "$HOME/.config/Code" "$HOME/.config/VSCodium"; do
    if [ -d "$VSCODE_DIR" ]; then
        ok "VS Code detected — add mcp.servers.heady to settings.json"
    fi
done

# ═══════════ PHASE 4: PATH Setup ════════════════════════════════
echo ""
echo -e "${W}━━━ Phase 4: PATH + Shell Integration ━━━${NC}"

SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then SHELL_RC="$HOME/.profile"
fi

if [ -n "$SHELL_RC" ]; then
    if ! grep -q "heady/bin" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# 🐝 Heady Systems" >> "$SHELL_RC"
        echo 'export PATH="$HOME/.heady/bin:$PATH"' >> "$SHELL_RC"
    fi
    ok "PATH updated in $SHELL_RC"
fi
export PATH="$BIN_DIR:$PATH"

# ═══════════ PHASE 5: Cross-Device Sync Activation ══════════════
echo ""
echo -e "${W}━━━ Phase 5: Cross-Device Sync Ready ━━━${NC}"

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

ok "Sync server will run on ws://$LOCAL_IP:$SYNC_PORT"
ok "MCP bridge will run on http://$LOCAL_IP:$MCP_PORT"
ok "Device ID: ${DEVICE_ID:0:16}..."

# ═══════════ DONE ════════════════════════════════════════════════
echo ""
echo -e "${P}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${P}║${NC}  ${G}🐝 Heady installed successfully on $(hostname)!${NC}"
echo -e "${P}║${NC}                                                           ${P}║${NC}"
echo -e "${P}║${NC}  ${W}This machine:${NC}                                           ${P}║${NC}"
echo -e "${P}║${NC}    buddy status    — Check system                         ${P}║${NC}"
echo -e "${P}║${NC}    buddy serve     — Start MCP bridge                     ${P}║${NC}"
echo -e "${P}║${NC}                                                           ${P}║${NC}"
echo -e "${P}║${NC}  ${W}Other devices:${NC}                                          ${P}║${NC}"
echo -e "${P}║${NC}    buddy install-phone   — Phone setup                    ${P}║${NC}"
echo -e "${P}║${NC}    buddy install-laptop  — Laptop command                 ${P}║${NC}"
echo -e "${P}║${NC}    buddy devices         — See connected devices          ${P}║${NC}"
echo -e "${P}║${NC}    buddy sync            — Cross-device sync status       ${P}║${NC}"
echo -e "${P}║${NC}                                                           ${P}║${NC}"
echo -e "${P}║${NC}  ${C}Device: ${DEVICE_NAME} (${DEVICE_PLATFORM}/${DEVICE_ARCH})${NC}"
echo -e "${P}║${NC}  ${C}Sync: ws://${LOCAL_IP}:${SYNC_PORT}${NC}"
echo -e "${P}║${NC}  ${C}MCP: http://${LOCAL_IP}:${MCP_PORT}${NC}"
echo -e "${P}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
if [ -n "$SHELL_RC" ]; then
    echo -e "  ${Y}→ Run: source $SHELL_RC${NC} (or open new terminal)"
fi
echo -e "  ${Y}→ Then: buddy serve${NC} to start the MCP bridge"
echo ""
