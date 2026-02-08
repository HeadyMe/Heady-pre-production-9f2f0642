#!/bin/bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/validate-localhost.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# Heady Systems Localhost/Internal IP Validation Script
# Run locally to check for localhost references before committing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Heady Systems Localhost Validation${NC}"
echo "=================================="

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Track overall success
overall_success=0

echo ""
echo "📚 Checking documentation..."

# Check documentation files
if grep -r --include="*.md" --include="*.rst" --include="*.txt" \
  -E "(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.1[6-9]\.\d+\.\d+|172\.2[0-9]\.\d+\.\d+|172\.3[0-1]\.\d+\.\d+)" \
  docs/ README.md *.md 2>/dev/null; then
    print_status 1 "Documentation contains localhost/internal IP references"
    echo "Please use proper Heady domains as per the URL style guide"
    overall_success=1
else
    print_status 0 "Documentation validation passed"
fi

echo ""
echo "⚙️  Checking configuration files..."

# Check production configuration files
if grep -r --include="*.yaml" --include="*.yml" --include="*.json" --include="*.conf" \
  -E "(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.1[6-9]\.\d+\.\d+|172\.2[0-9]\.\d+\.\d+|172\.3[0-1]\.\d+\.\d+)" \
  configs/ --exclude="*local*" --exclude="*dev*" --exclude="hosts-file" 2>/dev/null; then
    print_status 1 "Production configs contain localhost/internal IP references"
    echo "Please use environment variables or proper domain references"
    overall_success=1
else
    print_status 0 "Configuration validation passed"
fi

echo ""
echo "💻 Checking code examples..."

# Check code files for localhost URLs
if grep -r --include="*.py" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" \
  -E "(http://localhost|http://127\.0\.0\.1)" \
  src/ --exclude-dir="test*" --exclude="*test*" --exclude="*local*" 2>/dev/null; then
    print_status 1 "Code contains localhost URLs in examples"
    echo "Please use proper Heady domains or environment variables"
    overall_success=1
else
    print_status 0 "Code validation passed"
fi

echo ""
echo "🔐 Checking OAuth callback URLs..."

# Check OAuth configurations
if grep -r --include="*.yaml" --include="*.yml" --include="*.json" --include="*.py" --include="*.js" \
  -E "(localhost|127\.0\.0\.1).*oauth.*callback" \
  . 2>/dev/null; then
    print_status 1 "OAuth callbacks contain localhost URLs"
    echo "Please use proper domains like https://app.headysystems.com/oauth/callback"
    overall_success=1
else
    print_status 0 "OAuth callback validation passed"
fi

echo ""
echo "🐳 Checking Docker and deployment files..."

# Check Docker files
if grep -r --include="Dockerfile*" --include="docker-compose*" \
  -E "(localhost|127\.0\.0\.1)" \
  . --exclude="*local*" --exclude="*dev*" 2>/dev/null; then
    print_status 1 "Docker/deployment files contain localhost references"
    echo "Please use service names or proper domains"
    overall_success=1
else
    print_status 0 "Docker/deployment validation passed"
fi

echo ""
echo "🔌 Checking for hardcoded localhost ports..."

# Check for localhost:port patterns
if grep -r -E "(localhost|127\.0\.0\.1):\d+" \
  --include="*.md" --include="*.py" --include="*.js" --include="*.yaml" --include="*.yml" \
  . --exclude-dir=".git" --exclude="*local*" --exclude="*dev*" 2>/dev/null; then
    print_status 1 "Found localhost with hardcoded ports"
    echo "Please use proper domains or environment variables"
    overall_success=1
else
    print_status 0 "Port validation passed"
fi

echo ""
echo "🌍 Checking environment variable examples..."

# Check .env.example files
if find . -name "*.env.example" -exec grep -l "localhost\|127\.0\.0\.1" {} \; 2>/dev/null; then
    print_status 1 ".env.example files contain localhost references"
    echo "Please use proper domains like:"
    echo "  API_BASE_URL=https://api.headysystems.com"
    echo "  WEB_APP_URL=https://app.headysystems.com"
    overall_success=1
else
    print_status 0 "Environment variable validation passed"
fi

echo ""
echo "🔗 Checking domain consistency..."

# Check for consistent domain usage
DOMAINS=("headysystems.com" "headyconnection.org" "headybuddy.org")

for domain in "${DOMAINS[@]}"; do
    # Look for inconsistent www usage
    if grep -r -i "www\.$domain" . --exclude-dir=".git" 2>/dev/null | grep -v "redirect.*www"; then
        print_warning "Found www.$domain usage (should redirect to $domain)"
    fi
    
    # Look for HTTP usage (should be HTTPS)
    if grep -r "http://$domain" . --exclude-dir=".git" --exclude="*local*" 2>/dev/null; then
        print_warning "Found http://$domain (should be https://$domain)"
    fi
done

echo ""
echo "📋 Summary:"
echo "-----------"

if [ $overall_success -eq 0 ]; then
    echo -e "${GREEN}🎉 All validations passed!${NC}"
    echo "Your code follows the Heady Systems URL and domain style guide."
    echo ""
    echo "✅ No localhost or internal IP references found"
    echo "✅ Configuration files are production-ready"
    echo "✅ Code examples use proper domains"
    echo "✅ OAuth callbacks are properly configured"
    echo "✅ Docker files use service names"
    echo "✅ Environment examples are correct"
    exit 0
else
    echo -e "${RED}❌ Validation failed!${NC}"
    echo ""
    echo "Please fix the issues above before committing or pushing."
    echo ""
    echo "📖 Refer to the URL style guide:"
    echo "   docs/URL_DOMAIN_STYLE_GUIDE.md"
    echo ""
    echo "🔧 Common fixes:"
    echo "   - Replace localhost:3000 → https://app.headysystems.com"
    echo "   - Replace localhost:8000 → https://api.headysystems.com"
    echo "   - Use environment variables for URLs"
    echo "   - Update OAuth callbacks to use proper domains"
    exit 1
fi
