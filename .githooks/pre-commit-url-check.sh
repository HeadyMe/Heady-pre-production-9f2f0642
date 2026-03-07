#!/bin/bash
# ============================================================
# HEADY PRE-COMMIT HOOK — URL POLICY ENFORCEMENT
# ============================================================
# Install: cp scripts/pre-commit-url-check.sh .git/hooks/pre-commit
#          chmod +x .git/hooks/pre-commit
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[HEADY] Running URL policy check...${NC}"

VIOLATIONS=0

# Files being committed (staged)
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx|json|yaml|yml|md|php|twig|env)$')

if [ -z "$FILES" ]; then
  echo -e "${GREEN}[HEADY] No relevant files to check.${NC}"
  exit 0
fi

# Pattern 1: localhost references (excluding valid local-dev configs)
for file in $FILES; do
  if [[ "$file" == *"local-dev"* ]] || [[ "$file" == *".local"* ]] || [[ "$file" == *"heady-url-resolver"* ]]; then
    continue
  fi

  MATCHES=$(git diff --cached "$file" | grep -E '^\+' | grep -v '^\+\+\+' | grep -iE 'localhost|127\.0\.0\.1|0\.0\.0\.0')
  if [ -n "$MATCHES" ]; then
    echo -e "${RED}[VIOLATION] $file contains localhost/127.x references:${NC}"
    echo "$MATCHES"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Pattern 2: .onrender.com references
for file in $FILES; do
  if [[ "$file" == *"heady-url-resolver"* ]] || [[ "$file" == *"render.yaml"* ]]; then
    continue
  fi

  MATCHES=$(git diff --cached "$file" | grep -E '^\+' | grep -v '^\+\+\+' | grep -iE '\.onrender\.com')
  if [ -n "$MATCHES" ]; then
    echo -e "${RED}[VIOLATION] $file contains .onrender.com references:${NC}"
    echo "$MATCHES"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Pattern 3: Internal IPs
for file in $FILES; do
  if [[ "$file" == *"local-dev"* ]] || [[ "$file" == *"heady-url-resolver"* ]]; then
    continue
  fi

  MATCHES=$(git diff --cached "$file" | grep -E '^\+' | grep -v '^\+\+\+' | grep -E '(10|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]+\.[0-9]+')
  if [ -n "$MATCHES" ]; then
    echo -e "${RED}[VIOLATION] $file contains internal IP references:${NC}"
    echo "$MATCHES"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
  echo -e "${RED} BLOCKED: $VIOLATIONS URL policy violation(s) found${NC}"
  echo -e "${RED} Fix these before committing. See docs/URL_DOMAIN_STYLE_GUIDE.md${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════${NC}"
  exit 1
fi

echo -e "${GREEN}[HEADY] ✓ All URL patterns clean.${NC}"
exit 0
