#!/bin/bash
# ============================================================
# HEADY PRE-COMMIT URL CHECK
# ============================================================
# Blocks any git commit that introduces banned URL patterns
# Install: cp scripts/pre-commit-url-check.sh .git/hooks/pre-commit
# ============================================================

echo "🔥 HEADY URL CHECK: Scanning for banned patterns..."

# Banned patterns (same as resolver)
BANNED_PATTERNS=(
    "localhost"
    "127.0.0.1"
    "0.0.0.0"
    "10\."
    "192\.168\."
    "172\.\(1[6-9]\|2[0-9]\|3[01]\)\."
    ".onrender.com"
)

# Files that are allowed to contain these patterns
EXEMPT_FILES=(
    "lib/heady-url-resolver"
    "scripts/pre-commit-url-check"
    "render.yaml"
    ".env.local"
    ".env.development"
    "docker-compose.*\.yml"
)

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

VIOLATIONS=0

for file in $STAGED_FILES; do
    # Skip if file is exempt
    EXEMPT=false
    for exempt in "${EXEMPT_FILES[@]}"; do
        if [[ "$file" =~ $exempt ]]; then
            EXEMPT=true
            break
        fi
    done
    
    if [ "$EXEMPT" = true ]; then
        echo "✅ Skipping exempt file: $file"
        continue
    fi
    
    # Check for banned patterns
    if [ -f "$file" ]; then
        for pattern in "${BANNED_PATTERNS[@]}"; do
            if grep -qE "$pattern" "$file"; then
                echo "🚨 BANNED URL PATTERN DETECTED in $file: $pattern"
                echo "   Use lib/heady-url-resolver.js to fix this automatically"
                VIOLATIONS=$((VIOLATIONS + 1))
                
                # Show the offending lines
                grep -nE "$pattern" "$file" | head -5
            fi
        done
    fi
done

if [ $VIOLATIONS -gt 0 ]; then
    echo ""
    echo "🚨 COMMIT BLOCKED: $VIOLATIONS files contain banned URL patterns"
    echo "   Run: node lib/heady-url-resolver-nuclear.js fix"
    echo "   Or manually replace with production domains"
    exit 1
else
    echo "✅ No banned URL patterns detected"
    exit 0
fi
