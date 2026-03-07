#!/usr/bin/env bash
# HeadyWeb — Build All Remotes
# Iterates through all 7 micro-frontend remotes and builds each with webpack.
# Output is placed in dist/remotes/<name>/
#
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

REMOTES=(
  "antigravity"
  "landing"
  "heady-ide"
  "swarm-dashboard"
  "governance-panel"
  "projection-monitor"
  "vector-explorer"
)

# Remote-to-scope mapping for webpack --env appName
declare -A SCOPE_MAP=(
  ["antigravity"]="antigravity"
  ["landing"]="headyLanding"
  ["heady-ide"]="headyIDE"
  ["swarm-dashboard"]="swarmDashboard"
  ["governance-panel"]="governancePanel"
  ["projection-monitor"]="projectionMonitor"
  ["vector-explorer"]="vectorExplorer"
)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  HeadyWeb — Building All Remotes          ║"
echo "║  © 2026 HeadySystems Inc.                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""

TOTAL=${#REMOTES[@]}
BUILT=0
FAILED=0
START_TIME=$(date +%s)

cd "$ROOT_DIR"

for remote in "${REMOTES[@]}"; do
  echo "──────────────────────────────────────────"
  echo "  Building remote: $remote"
  echo "  Scope: ${SCOPE_MAP[$remote]}"
  echo ""

  if npx webpack --config webpack.config.js \
    --env remote \
    --env "appName=$remote" \
    --mode production; then
    echo "  ✓ $remote built successfully"
    BUILT=$((BUILT + 1))
  else
    echo "  ✗ $remote build FAILED"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "══════════════════════════════════════════"
echo "  Build Summary"
echo "  ──────────────────────────────────────"
echo "  Total:  $TOTAL"
echo "  Built:  $BUILT"
echo "  Failed: $FAILED"
echo "  Time:   ${DURATION}s"
echo "══════════════════════════════════════════"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "ERROR: $FAILED remote(s) failed to build. See output above."
  exit 1
fi

echo "All remotes built successfully."
echo "Output: $ROOT_DIR/dist/remotes/"
