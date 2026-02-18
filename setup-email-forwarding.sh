#!/bin/bash
# Email Forwarding Setup Script for HeadyConnection.org
# e@headyconnection.com → eric@headyconnection.org

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

# Configuration
DOMAIN="headyconnection.org"
SOURCE_EMAIL="e@headyconnection.com"
DEST_EMAIL="eric@headyconnection.org"

# Check DNS configuration
check_dns() {
    log "🔍 Checking DNS configuration for $DOMAIN..."
    
    # Check nameservers
    local nameservers=$(nslookup -type=NS "$DOMAIN" | grep -A1 "Name Server" | tail -n +2 | awk '{print $4}' | tr '\n' ' ')
    
    if echo "$nameservers" | grep -qi "cloudflare"; then
        success "✅ Domain uses Cloudflare nameservers"
        return 0
    else
        warn "⚠️ Domain nameservers: $nameservers"
        warn "⚠️ Not using Cloudflare - manual setup required"
        return 1
    fi
}

# Check MX records
check_mx_records() {
    log "📧 Checking MX records for $DOMAIN..."
    
    local mx_records=$(dig +short MX "$DOMAIN" 2>/dev/null || echo "")
    
    if echo "$mx_records" | grep -q "cloudflare"; then
        success "✅ MX records point to Cloudflare"
        echo "$mx_records"
        return 0
    else
        warn "⚠️ Current MX records:"
        if [ -n "$mx_records" ]; then
            echo "$mx_records"
        else
            echo "   No MX records found"
        fi
        return 1
    fi
}

# Test email forwarding
test_forwarding() {
    log "📧 Testing email forwarding..."
    
    info "🔄 To test forwarding:"
    echo "   1. Send an email to: $SOURCE_EMAIL"
    echo "   2. Check inbox: $DEST_EMAIL"
    echo "   3. Verify headers show forwarding"
    echo ""
    info "📧 Test email content:"
    echo "   Subject: Test Forwarding - $(date)"
    echo "   Body: This is a test of email forwarding setup"
    echo ""
    warn "⚠️ Check spam folder if email not received"
}

# Generate Cloudflare setup instructions
generate_cloudflare_instructions() {
    cat > cloudflare-email-setup.txt << EOF
Cloudflare Email Routing Setup Instructions
==========================================

Domain: $DOMAIN
Forward: $SOURCE_EMAIL → $DEST_EMAIL

Step 1: Enable Email Routing
---------------------------
1. Login to Cloudflare Dashboard: https://dash.cloudflare.com
2. Select domain: $DOMAIN
3. Go to "Email" → "Email Routing" in left sidebar
4. Click "Enable Email Routing"

Step 2: Create Forwarding Rule
-----------------------------
1. Click "Create address"
2. Address: $SOURCE_EMAIL
3. Forward to: $DEST_EMAIL
4. Click "Create"

Step 3: Verify MX Records
------------------------
Ensure these MX records exist:
Type: MX
Name: @
Priority: 10
Content: mx1.cloudflare.net

Type: MX
Name: @
Priority: 20
Content: mx2.cloudflare.net

Step 4: Test Forwarding
----------------------
1. Send email to: $SOURCE_EMAIL
2. Check inbox: $DEST_EMAIL
3. Verify delivery

Additional Configuration (Optional):
----------------------------------
- Catch-all forwarding: @headyconnection.org → eric@headyconnection.org
- Auto-responder: Set up vacation message
- Email filters: Organize incoming emails

Troubleshooting:
---------------
- Check spam folder
- Verify MX records propagation (24-48 hours)
- Ensure SPF/DKIM records are correct
- Contact Cloudflare support if issues persist

Cloudflare Support:
- Email: support@cloudflare.com
- Help Center: https://support.cloudflare.com
EOF

    success "📝 Cloudflare setup instructions saved to cloudflare-email-setup.txt"
}

# Generate alternative setup options
generate_alternative_options() {
    cat > alternative-email-setup.txt << EOF
Alternative Email Forwarding Options
===================================

Since $DOMAIN may not use Cloudflare nameservers, here are alternatives:

Option 1: Google Workspace/G Suite
---------------------------------
1. Add email alias in Google Admin Console
2. Navigate to Users → eric@headyconnection.org
3. Click "Add alias"
4. Alias email: e@headyconnection.org
5. Click "Add"

Option 2: cPanel/Hosting Provider
---------------------------------
1. Login to cPanel
2. Go to "Forwarders"
3. Add Forwarder:
   - Address to Forward: e
   - Domain: headyconnection.com
   - Forward to: eric@headyconnection.org
4. Click "Add Forwarder"

Option 3: Microsoft 365
----------------------
1. Login to Microsoft 365 Admin Center
2. Go to Users → Active users
3. Select eric@headyconnection.org
4. Click "Manage email aliases"
5. Add alias: e@headyconnection.org
6. Click "Save changes"

Option 4: Self-Hosted Postfix
-----------------------------
1. Install Postfix server
2. Configure virtual alias mapping:
   /etc/postfix/virtual:
   e@headyconnection.com    eric@headyconnection.org

3. Enable virtual mapping:
   postmap /etc/postfix/virtual
   postconf -e "virtual_alias_maps = hash:/etc/postfix/virtual"
   postconf -e "virtual_alias_domains = headyconnection.com"

4. Restart Postfix:
   systemctl restart postfix

Option 5: ProtonMail
------------------
1. Login to ProtonMail account
2. Go to Settings → Addresses and keys
3. Add address: e@headyconnection.org
4. Set as alias for eric@headyconnection.org

Recommendation:
--------------
If possible, migrate nameservers to Cloudflare for:
- Free email routing
- Better DNS management
- Enhanced security
- Integration with existing services
EOF

    success "📝 Alternative setup options saved to alternative-email-setup.txt"
}

# Generate verification script
generate_verification_script() {
    cat > verify-email-forwarding.sh << 'EOF'
#!/bin/bash
# Email Forwarding Verification Script

SOURCE_EMAIL="e@headyconnection.org"
DEST_EMAIL="eric@headyconnection.org"

echo "📧 Email Forwarding Verification"
echo "=============================="

echo "🔍 Checking MX records..."
dig +short MX headyconnection.org

echo ""
echo "📧 To verify forwarding:"
echo "1. Send test email to: $SOURCE_EMAIL"
echo "2. Check inbox: $DEST_EMAIL"
echo "3. Look for headers:"
echo "   X-Forwarded-For: $SOURCE_EMAIL"
echo "   Delivered-To: $DEST_EMAIL"

echo ""
echo "🚨 If email not received:"
echo "- Check spam folder"
echo "- Wait 24-48 hours for DNS propagation"
echo "- Verify MX records"
echo "- Contact email provider support"
EOF

    chmod +x verify-email-forwarding.sh
    success "📝 Verification script created: verify-email-forwarding.sh"
}

# Main execution
main() {
    log "📧 Setting up email forwarding: $SOURCE_EMAIL → $DEST_EMAIL"
    log "=========================================================="
    
    # Check DNS configuration
    if check_dns; then
        # Cloudflare setup
        generate_cloudflare_instructions
        
        echo ""
        success "🎯 Recommended: Cloudflare Email Routing"
        info "📝 Instructions saved to: cloudflare-email-setup.txt"
        info "🌐 Access Cloudflare Dashboard: https://dash.cloudflare.com"
        
    else
        # Alternative options
        generate_alternative_options
        
        echo ""
        warn "⚠️ Domain not using Cloudflare nameservers"
        info "📝 Alternative options saved to: alternative-email-setup.txt"
    fi
    
    # Check MX records
    echo ""
    check_mx_records
    
    # Generate verification script
    echo ""
    generate_verification_script
    
    # Test instructions
    echo ""
    test_forwarding
    
    echo ""
    success "🎉 Email forwarding setup guide generated!"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Follow setup instructions in generated files"
    echo "   2. Configure email forwarding in chosen provider"
    echo "   3. Test forwarding with ./verify-email-forwarding.sh"
    echo "   4. Monitor for delivery issues"
    echo ""
    echo "📞 Support:"
    echo "   Cloudflare: support@cloudflare.com"
    echo "   Google Workspace: https://support.google.com/a"
    echo "   Microsoft 365: https://support.microsoft.com/365"
}

# Run main function
main "$@"
