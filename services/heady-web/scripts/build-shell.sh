#!/usr/bin/env bash
# HeadyWeb — Build Shell (Host)
# Builds the Module Federation host shell into dist/
#
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  HeadyWeb — Building Shell               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$ROOT_DIR"

START_TIME=$(date +%s)

npx webpack --config webpack.config.js --env host --mode production

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "  ✓ Shell built in ${DURATION}s"
echo "  Output: $ROOT_DIR/dist/"
echo ""
