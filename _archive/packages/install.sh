#!/bin/bash
# ═══ Heady AI — One-Line Installer ═══
# curl -fsSL https://headyme.com/install.sh | bash

set -e

HEADY_DIR="$HOME/.heady"
BIN_DIR="$HOME/.local/bin"
GREEN='\033[0;32m' PURPLE='\033[0;35m' NC='\033[0m' BOLD='\033[1m'

echo -e "${PURPLE}"
echo "  ═══════════════════════════════════════"
echo "   🐝 Heady AI — Intelligence Layer"
echo "   One-Line Installer"
echo "  ═══════════════════════════════════════"
echo -e "${NC}"

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js 18+ required. Install from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found v$NODE_VER)"
  exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Create dirs
mkdir -p "$HEADY_DIR" "$BIN_DIR"

# Install Heady CLI
echo "📦 Installing Heady CLI..."
npm install -g heady-hive-sdk 2>/dev/null || npm install -g heady-hive-sdk

# Install MCP Server
echo "📦 Installing Heady MCP Server..."
npm install -g heady-mcp-server 2>/dev/null || npm install -g heady-mcp-server

# Configure Claude Desktop MCP (if installed)
CLAUDE_CONFIG="$HOME/.config/claude/claude_desktop_config.json"
if [ -d "$HOME/.config/claude" ]; then
  echo "🔌 Configuring Claude Desktop MCP..."
  if [ -f "$CLAUDE_CONFIG" ]; then
    # Merge into existing config
    node -e "
      const fs = require('fs');
      const cfg = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
      cfg.mcpServers = cfg.mcpServers || {};
      cfg.mcpServers.heady = {
        command: 'npx', args: ['-y', 'heady-mcp-server'],
        env: { HEADY_URL: 'http://127.0.0.1:3301' }
      };
      fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(cfg, null, 2));
    "
  else
    cat > "$CLAUDE_CONFIG" <<'EOF'
{
  "mcpServers": {
    "heady": {
      "command": "npx",
      "args": ["-y", "heady-mcp-server"],
      "env": { "HEADY_URL": "http://127.0.0.1:3301" }
    }
  }
}
EOF
  fi
  echo -e "${GREEN}✓${NC} Claude Desktop MCP configured"
fi

# Configure Cursor MCP (if installed)
CURSOR_CONFIG="$HOME/.cursor/mcp.json"
if [ -d "$HOME/.cursor" ]; then
  echo "🔌 Configuring Cursor MCP..."
  mkdir -p "$HOME/.cursor"
  cat > "$CURSOR_CONFIG" <<'EOF'
{
  "mcpServers": {
    "heady": {
      "command": "npx",
      "args": ["-y", "heady-mcp-server"],
      "env": { "HEADY_URL": "http://127.0.0.1:3301" }
    }
  }
}
EOF
  echo -e "${GREEN}✓${NC} Cursor MCP configured"
fi

echo ""
echo -e "${PURPLE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Heady AI installed successfully!${NC}"
echo ""
echo "  Run:   heady brain \"hello world\""
echo "  MCP:   npx heady-mcp-server"
echo "  Web:   https://headyme.com"
echo "  Hub:   https://headymcp.com"
echo -e "${PURPLE}═══════════════════════════════════════${NC}"
