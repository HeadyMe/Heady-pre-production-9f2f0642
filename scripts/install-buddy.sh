#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 🐝 Buddy Universal Installer — Heady Systems
# Works on: macOS, Linux, WSL, Raspberry Pi
#
# Usage:
#   curl -sSL https://buddy.heady.dev/install | bash
#   -- or --
#   bash <(curl -sSL https://raw.githubusercontent.com/HeadyMe/Heady/main/scripts/install-buddy.sh)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

HEADY_VERSION="2.0.0"
HEADY_URL="${HEADY_URL:-https://heady-manager-837145615012.us-central1.run.app}"
CONFIG_DIR="$HOME/.heady"
BIN_DIR="$HOME/.heady/bin"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() { echo -e "${GREEN}🐝${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err() { echo -e "${RED}✖${NC}  $1" >&2; }

echo -e "
${PURPLE}═══════════════════════════════════════════════════════${NC}
${PURPLE}    🐝 Buddy Installer — Heady Systems v${HEADY_VERSION}${NC}
${PURPLE}    Sacred Geometry :: Organic Systems${NC}
${PURPLE}═══════════════════════════════════════════════════════${NC}
"

# ── 1. Check / Install Node.js ──
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        log "Node.js v${NODE_VERSION} detected ✓"
    else
        warn "Node.js v${NODE_VERSION} is too old (need 18+). Installing..."
        curl -fsSL https://fnm.vercel.app/install | bash
        export PATH="$HOME/.local/share/fnm:$PATH"
        eval "$(fnm env)"
        fnm install 22
        fnm use 22
        log "Node.js $(node -v) installed ✓"
    fi
else
    log "Installing Node.js 22..."
    if command -v brew &>/dev/null; then
        brew install node@22
    elif command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo dnf install -y nodejs
    else
        curl -fsSL https://fnm.vercel.app/install | bash
        export PATH="$HOME/.local/share/fnm:$PATH"
        eval "$(fnm env)"
        fnm install 22
        fnm use 22
    fi
    log "Node.js $(node -v) installed ✓"
fi

# ── 2. Create config directory ──
mkdir -p "$CONFIG_DIR" "$BIN_DIR"

# ── 3. Install heady-mcp-server ──
log "Installing heady-mcp-server..."
npm install -g heady-mcp-server 2>/dev/null || {
    warn "Global npm install failed, falling back to local..."
    cd "$CONFIG_DIR"
    npm init -y 2>/dev/null || true
    npm install heady-mcp-server 2>/dev/null || {
        warn "npm registry not yet published — cloning from source..."
        if command -v git &>/dev/null; then
            git clone --depth 1 https://github.com/HeadyMe/Heady.git "$CONFIG_DIR/heady-source" 2>/dev/null || true
            if [ -d "$CONFIG_DIR/heady-source/packages/heady-mcp-server" ]; then
                cp "$CONFIG_DIR/heady-source/packages/heady-mcp-server"/*.js "$CONFIG_DIR/"
                log "Installed from source ✓"
            fi
        fi
    }
}

# ── 4. Generate config ──
DEVICE_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || openssl rand -hex 16)
DEVICE_NAME=$(hostname)

cat > "$CONFIG_DIR/config.json" << EOF
{
    "version": "${HEADY_VERSION}",
    "deviceId": "${DEVICE_ID}",
    "deviceName": "${DEVICE_NAME}",
    "apiUrl": "${HEADY_URL}",
    "mcpPort": 3302,
    "transport": "stdio",
    "installedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "autoUpdate": true
}
EOF
log "Config written to $CONFIG_DIR/config.json ✓"

# ── 5. Create buddy CLI wrapper ──
cat > "$BIN_DIR/buddy" << 'BUDDY_CLI'
#!/bin/bash
CONFIG_DIR="$HOME/.heady"
CONFIG="$CONFIG_DIR/config.json"

case "${1:-help}" in
    status)
        URL=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)
        echo "🐝 Buddy Status"
        echo "   Device: $(hostname) ($(grep -o '"deviceId"[^,]*' "$CONFIG" | cut -d'"' -f4 | head -c 12)...)"
        echo "   API: $URL"
        curl -sS "$URL/api/buddy/status" 2>/dev/null | head -c 500
        echo
        ;;
    health)
        URL=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)
        curl -sS "$URL/api/pulse" 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -sS "$URL/api/pulse"
        ;;
    research)
        shift
        URL=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)
        curl -sS -X POST "$URL/api/buddy/deep-research" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$*\",\"depth\":\"deep\",\"providers\":\"all\"}" 2>/dev/null
        echo
        ;;
    mcp)
        HEADY_URL=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4) \
        HEADY_DEVICE_ID=$(grep -o '"deviceId"[^,]*' "$CONFIG" | cut -d'"' -f4) \
        exec node "$(which heady-mcp 2>/dev/null || echo "$CONFIG_DIR/server.js")" "$@"
        ;;
    serve)
        HEADY_URL=$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4) \
        HEADY_TRANSPORT=streamable-http \
        HEADY_DEVICE_ID=$(grep -o '"deviceId"[^,]*' "$CONFIG" | cut -d'"' -f4) \
        exec node "$(which heady-mcp 2>/dev/null || echo "$CONFIG_DIR/server.js")" "$@"
        ;;
    configure)
        shift
        case "${1:-}" in
            claude-desktop)
                CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
                [ -d "$HOME/.config/Claude" ] && CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
                mkdir -p "$CLAUDE_CONFIG_DIR"
                CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
                MCP_CMD=$(which heady-mcp 2>/dev/null || echo "node")
                MCP_ARG=$(which heady-mcp 2>/dev/null || echo "$CONFIG_DIR/server.js")
                if [ -f "$CLAUDE_CONFIG" ]; then
                    cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG.bak"
                fi
                cat > "$CLAUDE_CONFIG" << CLAUDE_EOF
{
    "mcpServers": {
        "heady": {
            "command": "$MCP_CMD",
            "args": ["$MCP_ARG"],
            "env": {
                "HEADY_URL": "$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)"
            }
        }
    }
}
CLAUDE_EOF
                echo "🐝 Claude Desktop configured ✓ (restart Claude Desktop to activate)"
                ;;
            cursor)
                CURSOR_DIR="$HOME/.cursor"
                mkdir -p "$CURSOR_DIR"
                MCP_CMD=$(which heady-mcp 2>/dev/null || echo "node")
                MCP_ARG=$(which heady-mcp 2>/dev/null || echo "$CONFIG_DIR/server.js")
                cat > "$CURSOR_DIR/mcp.json" << CURSOR_EOF
{
    "mcpServers": {
        "heady": {
            "command": "$MCP_CMD",
            "args": ["$MCP_ARG"],
            "env": {
                "HEADY_URL": "$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)"
            }
        }
    }
}
CURSOR_EOF
                echo "🐝 Cursor configured ✓ (restart Cursor to activate)"
                ;;
            vscode)
                VSCODE_DIR="$HOME/.vscode"
                mkdir -p "$VSCODE_DIR"
                echo "🐝 VS Code: Add to settings.json manually:"
                echo "   \"mcp.servers\": { \"heady\": { \"command\": \"heady-mcp\", \"env\": { \"HEADY_URL\": \"$(grep -o '"apiUrl"[^,]*' "$CONFIG" | cut -d'"' -f4)\" } } }"
                ;;
            all)
                "$0" configure claude-desktop 2>/dev/null || true
                "$0" configure cursor 2>/dev/null || true
                "$0" configure vscode 2>/dev/null || true
                ;;
            *)
                echo "Usage: buddy configure [claude-desktop|cursor|vscode|all]"
                ;;
        esac
        ;;
    *)
        echo "🐝 Buddy CLI — Heady Systems"
        echo ""
        echo "Commands:"
        echo "  buddy status          System status"
        echo "  buddy health          Health check"
        echo "  buddy research <q>    Deep multi-provider research"
        echo "  buddy mcp             Start MCP server (stdio)"
        echo "  buddy serve           Start MCP server (Streamable HTTP)"
        echo "  buddy configure <ide> Auto-configure IDE (claude-desktop|cursor|vscode|all)"
        ;;
esac
BUDDY_CLI
chmod +x "$BIN_DIR/buddy"
log "Buddy CLI installed ✓"

# ── 6. Add to PATH ──
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then SHELL_RC="$HOME/.profile"
fi

if [ -n "$SHELL_RC" ]; then
    if ! grep -q "heady/bin" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Heady Buddy" >> "$SHELL_RC"
        echo 'export PATH="$HOME/.heady/bin:$PATH"' >> "$SHELL_RC"
        log "Added to PATH in $SHELL_RC ✓"
    fi
fi
export PATH="$BIN_DIR:$PATH"

# ── 7. Auto-detect and configure IDEs ──
log "Detecting AI clients..."

# Claude Desktop
CLAUDE_DETECTED=false
if [ -d "$HOME/Library/Application Support/Claude" ] || [ -d "$HOME/.config/Claude" ]; then
    CLAUDE_DETECTED=true
    log "  → Claude Desktop detected — run: buddy configure claude-desktop"
fi

# Cursor
if [ -d "$HOME/.cursor" ]; then
    log "  → Cursor detected — run: buddy configure cursor"
fi

# VS Code
if command -v code &>/dev/null; then
    log "  → VS Code detected — run: buddy configure vscode"
fi

if [ "$CLAUDE_DETECTED" = false ]; then
    log "  No AI clients detected (install Claude Desktop or Cursor first)"
fi

# ── Done ──
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🐝 Buddy installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Quick start:"
echo "    buddy status                  Check system"
echo "    buddy configure all           Wire into all AI clients"
echo "    buddy research 'your query'   Deep multi-provider research"
echo "    buddy serve                   Start cross-device server"
echo ""
echo "  Config: $CONFIG_DIR/config.json"
echo "  Device: $DEVICE_NAME ($DEVICE_ID)"
echo ""
if [ -n "$SHELL_RC" ]; then
    echo -e "  ${YELLOW}Run: source $SHELL_RC${NC} (or open a new terminal)"
fi
