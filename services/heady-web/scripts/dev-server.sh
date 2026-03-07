#!/usr/bin/env bash
# HeadyWeb — Development Server
# Starts webpack-dev-server for the shell on port 3000.
# Remotes should be served separately (e.g. from dist/remotes/ via a static server).
#
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  HeadyWeb — Dev Server                    ║"
echo "║  http://localhost:3000                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$ROOT_DIR"

# Ensure remotes are pre-built (serve static)
if [ ! -d "dist/remotes" ]; then
  echo "  No dist/remotes found. Running remote builds first..."
  bash scripts/build-all-remotes.sh
fi

echo "  Starting webpack-dev-server..."
echo ""

npx webpack serve \
  --config webpack.config.js \
  --env host \
  --mode development \
  --open
