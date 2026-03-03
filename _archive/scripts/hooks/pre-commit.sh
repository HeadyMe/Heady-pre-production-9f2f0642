# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# Heady Pre-Commit Hook — Security & Hygiene Gate
# Install: cp scripts/hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🛡️  Heady Pre-Commit Security Gate${NC}"

ERRORS=0

# ── 1. Check for secrets ─────────────────────────────────────────────
echo -n "  Scanning for secrets... "
SECRETS_PATTERN='(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY|password\s*=\s*['\''"][^'\''"]{8,}|api[_-]?key\s*[:=]\s*['\''"][a-zA-Z0-9]{20,})'
STAGED=$(git diff --cached --name-only --diff-filter=ACM)
for file in $STAGED; do
  if [[ "$file" == *.js || "$file" == *.json || "$file" == *.yaml || "$file" == *.yml || "$file" == *.env* || "$file" == *.md ]]; then
    if grep -qEi "$SECRETS_PATTERN" "$file" 2>/dev/null; then
      echo -e "${RED}FAIL${NC}"
      echo -e "  ${RED}⚠ Potential secret found in: $file${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done
if [ $ERRORS -eq 0 ]; then echo -e "${GREEN}OK${NC}"; fi

# ── 2. Block operational files ───────────────────────────────────────
echo -n "  Checking for blocked file types... "
BLOCKED=0
for file in $STAGED; do
  case "$file" in
    *.pid|*.bak|*.log|*.jsonl)
      echo -e "${RED}FAIL${NC}"
      echo -e "  ${RED}⚠ Blocked file type: $file${NC}"
      BLOCKED=$((BLOCKED + 1))
      ;;
  esac
done
if [ $BLOCKED -eq 0 ]; then echo -e "${GREEN}OK${NC}"; fi
ERRORS=$((ERRORS + BLOCKED))

# ── 3. Check for localhost references in production code ─────────────
echo -n "  Scanning for localhost in code... "
LOCALHOST_HITS=0
for file in $STAGED; do
  # Skip config files, tests, and docs
  case "$file" in
    *.test.*|*.spec.*|*test/*|*docs/*|*README*|ecosystem.config.js|*.cloudflared/*) continue ;;
  esac
  if grep -qn 'localhost' "$file" 2>/dev/null; then
    # Allow localhost in comments and string comparisons only
    if grep -n 'localhost' "$file" | grep -vq '//\|#\|<!--\|\.env\|process\.env\|127\.0\.0\.1'; then
      echo -e "${YELLOW}WARN${NC}"
      echo -e "  ${YELLOW}⚠ localhost reference in: $file (verify it's intentional)${NC}"
      LOCALHOST_HITS=$((LOCALHOST_HITS + 1))
    fi
  fi
done
if [ $LOCALHOST_HITS -eq 0 ]; then echo -e "${GREEN}OK${NC}"; fi

# ── 4. Check file sizes ─────────────────────────────────────────────
echo -n "  Checking file sizes... "
BIG=0
for file in $STAGED; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 500000 ]; then
      echo -e "${YELLOW}WARN${NC}"
      echo -e "  ${YELLOW}⚠ Large file (${SIZE}B): $file${NC}"
      BIG=$((BIG + 1))
    fi
  fi
done
if [ $BIG -eq 0 ]; then echo -e "${GREEN}OK${NC}"; fi

# ── Result ───────────────────────────────────────────────────────────
if [ $ERRORS -gt 0 ]; then
  echo -e "\n${RED}✗ Pre-commit blocked: $ERRORS error(s) found${NC}"
  echo -e "  Fix the issues above or use ${YELLOW}git commit --no-verify${NC} to bypass."
  exit 1
fi

echo -e "${GREEN}✓ All checks passed${NC}"
exit 0
