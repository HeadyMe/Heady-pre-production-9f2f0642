#!/bin/bash
set -e

echo "[*] Building TypeScript SDK..."
cd packages/heady-semantic-logic
pnpm install
pnpm build
cd ../..

echo "[*] Python SDK ready (no build needed)"
echo "[+] Build complete"
