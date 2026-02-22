#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Heady File Governance — Pre-Commit Hook                        ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  Blocks commits that add files to root outside the allowlist.   ║
# ║  Install: cp scripts/hooks/check-file-placement.sh .git/hooks/pre-commit ║
# ║           chmod +x .git/hooks/pre-commit                        ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

# Root allowlist patterns (matches configs/file-governance.yaml)
ALLOWED_ROOT_PATTERNS=(
  "package.json"
  "package-lock.json"
  "pnpm-lock.yaml"
  "tsconfig.json"
  "eslint.config.*"
  "postcss.config.*"
  "next.config.*"
  "next-env.d.ts"
  "requirements.txt"
  "Dockerfile"
  "Dockerfile.*"
  "docker-compose*.yml"
  ".gitignore"
  ".gitattributes"
  "README.md"
  "README-WORKSPACE.md"
  "STANDING_DIRECTIVE.md"
  "CHANGELOG.md"
  "LICENSE"
  ".cursorrules"
  ".windsurfrules"
  "render.yaml"
  "heady-manager.js"
  "heady-registry.json"
  "index.html"
  ".env"
  ".env.*"
  "HeadyHeadless.js"
)

# Get files being added to root (not in subdirectories)
VIOLATIONS=()
SUGGESTIONS=()

while IFS= read -r file; do
  # Skip empty
  [ -z "$file" ] && continue

  # Only check root-level files (no slash = root level)
  if [[ "$file" != *"/"* ]]; then
    ALLOWED=false

    for pattern in "${ALLOWED_ROOT_PATTERNS[@]}"; do
      # Use bash pattern matching
      if [[ "$file" == $pattern ]]; then
        ALLOWED=true
        break
      fi
    done

    # Skip directories (., .git, etc)
    if [[ "$file" == "."* && ! "$file" == ".env"* && ! "$file" == ".git"* && ! "$file" == ".cursor"* && ! "$file" == ".windsurf"* ]]; then
      ALLOWED=true
    fi

    if [ "$ALLOWED" = false ]; then
      VIOLATIONS+=("$file")

      # Auto-suggest location
      case "$file" in
        *.md)
          if echo "$file" | grep -qiE "REPORT|FIX|STATUS|COMPLETE|ACHIEVED"; then
            SUGGESTIONS+=("  $file → docs/reports/")
          elif echo "$file" | grep -qiE "GUIDE|INSTRUCTIONS|STRATEGY|PROTOCOL|ARCHITECTURE"; then
            SUGGESTIONS+=("  $file → docs/guides/")
          elif echo "$file" | grep -qiE "DEPLOY|MIGRATION|SETUP|INSTALL"; then
            SUGGESTIONS+=("  $file → docs/deployment/")
          elif echo "$file" | grep -qiE "EMAIL|FORWARDING"; then
            SUGGESTIONS+=("  $file → docs/email/")
          else
            SUGGESTIONS+=("  $file → docs/")
          fi
          ;;
        *.log)
          SUGGESTIONS+=("  $file → backups/logs/")
          ;;
        *.bak|*.backup-*)
          SUGGESTIONS+=("  $file → backups/")
          ;;
        *.sh)
          SUGGESTIONS+=("  $file → scripts/")
          ;;
        *.yaml|*.yml)
          SUGGESTIONS+=("  $file → configs/")
          ;;
        *.js)
          SUGGESTIONS+=("  $file → src/ or scripts/")
          ;;
        *)
          SUGGESTIONS+=("  $file → (review placement)")
          ;;
      esac
    fi
  fi
done < <(git diff --cached --name-only --diff-filter=A)

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo ""
  echo "🚫 ═══════════════════════════════════════════════"
  echo "   HEADY FILE GOVERNANCE VIOLATION"
  echo "   ═══════════════════════════════════════════════"
  echo ""
  echo "   The following files cannot be added to the project root:"
  echo ""
  for v in "${VIOLATIONS[@]}"; do
    echo "     ❌ $v"
  done
  echo ""
  echo "   Suggested locations:"
  echo ""
  for s in "${SUGGESTIONS[@]}"; do
    echo "     $s"
  done
  echo ""
  echo "   Policy: configs/file-governance.yaml"
  echo "   Override: git commit --no-verify (NOT recommended)"
  echo ""
  echo "   ═══════════════════════════════════════════════"
  echo ""
  exit 1
fi

exit 0
