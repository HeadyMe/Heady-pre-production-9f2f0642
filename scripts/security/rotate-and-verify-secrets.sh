#!/usr/bin/env bash
set -euo pipefail

# Heady secret rotation starter
# Replace checked-in secret artifacts with generated assets and reissued credentials.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "[1/6] Listing known key-bearing files"
cat <<'EOF'
configs/nginx/ssl/ca.key
configs/nginx/ssl/client.key
configs/nginx/ssl/client.pem
configs/nginx/ssl/server.key
configs/nginx/ssl/server.pem
_archive/configs/nginx/ssl/ca.key
_archive/configs/nginx/ssl/client.key
_archive/configs/nginx/ssl/client.pem
_archive/configs/nginx/ssl/server.key
_archive/configs/nginx/ssl/server.pem
EOF

echo "[2/6] Revoke and rotate all certificates or provider credentials that used these files"
echo "Manual action required: issue new certs, SMTP creds, API tokens, and any exposed DNS tokens"

echo "[3/6] Remove key material from working tree"
rm -f "$ROOT_DIR"/configs/nginx/ssl/*.key "$ROOT_DIR"/configs/nginx/ssl/*.pem || true
rm -f "$ROOT_DIR"/_archive/configs/nginx/ssl/*.key "$ROOT_DIR"/_archive/configs/nginx/ssl/*.pem || true

echo "[4/6] Replace with templates"
mkdir -p "$ROOT_DIR"/configs/nginx/ssl
cat > "$ROOT_DIR"/configs/nginx/ssl/README.md <<'EOF'
Do not commit real keys here.
Generate local or deployment-time certs through your secret manager or CI.
EOF

echo "[5/6] Verify no private keys remain"
if grep -R --line-number --binary-files=without-match "BEGIN PRIVATE KEY" "$ROOT_DIR"; then
  echo "Private key material still detected"
  exit 1
fi

echo "[6/6] Next recommended action"
echo "Rewrite Git history for exposed keys and invalidate any linked credentials."
