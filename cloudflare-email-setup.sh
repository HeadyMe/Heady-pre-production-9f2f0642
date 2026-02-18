#!/bin/bash
# Cloudflare Email Forwarding Setup Script
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

# Check current nameservers
check_nameservers() {
    log "🔍 Checking current nameservers for $DOMAIN..."
    
    local nameservers=$(nslookup -type=NS "$DOMAIN" 2>/dev/null | grep -A1 "Name Server" | tail -n +2 | awk '{print $4}' | tr '\n' ' ')
    
    echo "Current nameservers: $nameservers"
    
    if echo "$nameservers" | grep -qi "cloudflare"; then
        success "✅ Domain already uses Cloudflare nameservers"
        return 0
    else
        warn "⚠️ Domain not using Cloudflare nameservers"
        return 1
    fi
}

# Generate nameserver change instructions
generate_nameserver_instructions() {
    cat > change-nameservers-to-cloudflare.txt << EOF
Cloudflare Nameserver Change Instructions
========================================

Current Domain: $DOMAIN
Target: Cloudflare Nameservers

Step 1: Get Cloudflare Nameservers
----------------------------------
1. Login to Cloudflare Dashboard: https://dash.cloudflare.com
2. Add site: $DOMAIN
3. Cloudflare will assign nameservers like:
   - dina.ns.cloudflare.com
   - josh.ns.cloudflare.com
4. Note your assigned nameservers

Step 2: Update Nameservers at Registrar
-------------------------------------
Find your domain registrar (where you bought headyconnection.org):

Common registrars:
- Namecheap: https://www.namecheap.com
- GoDaddy: https://www.godaddy.com
- Google Domains: https://domains.google.com
- Network Solutions: https://www.networksolutions.com

Login to your registrar and:
1. Go to DNS management
2. Select "Custom nameservers" or "Nameservers"
3. Replace current nameservers with Cloudflare's nameservers
4. Save changes

Step 3: Wait for Propagation
---------------------------
Nameserver changes take 24-48 hours to propagate worldwide.
You can check progress with: dig NS $DOMAIN

Step 4: Verify Cloudflare Setup
-------------------------------
1. Return to Cloudflare Dashboard
2. Wait for site to show "Active"
3. DNS should show green checkmarks

Step 5: Set Up Email Routing
---------------------------
1. In Cloudflare Dashboard, go to "Email" → "Email Routing"
2. Click "Enable Email Routing"
3. Create forwarding rule:
   - Address: $SOURCE_EMAIL
   - Forward to: $DEST_EMAIL

Important Notes:
---------------
- During propagation, email may be interrupted
- Plan the change during low-traffic period
- Backup important emails before making changes
- Update any services that use headyconnection.org email

Troubleshooting:
---------------
- If nameservers don't update, contact registrar support
- Check for domain locks at registrar
- Verify WHOIS information is correct
- Use Cloudflare's DNS checker tool

Cloudflare Support:
- Help Center: https://support.cloudflare.com
- Community: https://community.cloudflare.com
EOF

    success "📝 Nameserver change instructions saved to change-nameservers-to-cloudflare.txt"
}

# Generate Cloudflare email routing setup
generate_email_routing_instructions() {
    cat > cloudflare-email-routing-setup.txt << EOF
Cloudflare Email Routing Setup
=============================

Domain: $DOMAIN
Forwarding: $SOURCE_EMAIL → $DEST_EMAIL

Prerequisites:
-------------
- Domain uses Cloudflare nameservers
- DNS propagation complete (24-48 hours after nameserver change)

Step 1: Enable Email Routing
---------------------------
1. Login to Cloudflare Dashboard: https://dash.cloudflare.com
2. Select domain: $DOMAIN
3. In left sidebar, go to "Email" → "Email Routing"
4. Click "Enable Email Routing"
5. Wait for activation (usually immediate)

Step 2: Create Forwarding Rule
-----------------------------
1. Click "Create address" or "Add address"
2. Fill in details:
   - Address: $SOURCE_EMAIL
   - Forward to email addresses: $DEST_EMAIL
3. Click "Create address"
4. Verify rule appears in active addresses

Step 3: Verify MX Records
------------------------
Email Routing automatically sets these MX records:
Type: MX
Name: @
Priority: 10
Content: mx1.cloudflare.net

Type: MX
Name: @
Priority: 20
Content: mx2.cloudflare.net

Check these in DNS section of Cloudflare Dashboard.

Step 4: Test Email Forwarding
-----------------------------
1. Send test email to: $SOURCE_EMAIL
2. Check inbox: $DEST_EMAIL
3. Verify email headers show forwarding
4. Check spam folder if not received

Step 5: Additional Configuration (Optional)
-----------------------------------------
A. Catch-all forwarding:
   - Address: @headyconnection.com
   - Forward to: $DEST_EMAIL

B. Multiple destinations:
   - Address: $SOURCE_EMAIL
   - Forward to: $DEST_EMAIL, backup@example.com

C. Email routing rules:
   - Create rules based on sender, subject, etc.
   - Route to different addresses based on conditions

Step 6: Security Settings (Recommended)
---------------------------------------
1. Go to "Email" → "Email Routing" → "Security"
2. Enable:
   - DMARC policy (recommended: p=none to start)
   - SPF record (Cloudflare automatically sets)
   - DKIM signing (if using Cloudflare Email Security)

Expected Email Headers:
----------------------
When forwarding works, emails will show:
Delivered-To: $DEST_EMAIL
X-Forwarded-For: $SOURCE_EMAIL
Return-Path: $SOURCE_EMAIL
Received: from mail.cloudflare.net

Troubleshooting:
---------------
- Email not forwarding: Check MX records, wait 24-48 hours
- Emails going to spam: Check SPF/DKIM/DMARC settings
- Delay in delivery: Normal Cloudflare processing time
- Bounce messages: Check destination email validity

Advanced Features:
-----------------
- Email routing rules based on content
- Time-based routing
- Load balancing between destinations
- Email analytics and reporting

Cloudflare Email Routing Benefits:
--------------------------------
- Free service (included with Cloudflare)
- Reliable delivery infrastructure
- Easy web-based management
- Automatic DNS configuration
- Integration with existing Cloudflare services
- No additional software required

Limitations:
-----------
- Only works with Cloudflare nameservers
- Cannot send emails (forwarding only)
- Some advanced features require paid plan
- Limited to 100 forwarding rules per domain
EOF

    success "📝 Email routing setup instructions saved to cloudflare-email-routing-setup.txt"
}

# Generate migration checklist
generate_migration_checklist() {
    cat > email-migration-checklist.txt << EOF
Email Migration Checklist: ProtonMail → Cloudflare
==================================================

Pre-Migration Preparation:
-------------------------
□ Backup important emails from ProtonMail
□ Export contacts from ProtonMail
□ Note any auto-filters or rules in ProtonMail
□ Inform contacts of potential email disruption
□ Choose migration window (low-traffic period)

Day 1: Nameserver Change
------------------------
□ Login to domain registrar
□ Update nameservers to Cloudflare
□ Save confirmation of changes
□ Start 24-48 hour propagation timer

Day 1-2: Propagation Period
---------------------------
□ Monitor nameserver propagation: dig NS $DOMAIN
□ Check email continuity (may be interrupted)
□ Prepare for temporary email disruption
□ Keep ProtonMail accessible during transition

Day 2-3: Cloudflare Setup
-------------------------
□ Verify domain active in Cloudflare Dashboard
□ Enable Email Routing in Cloudflare
□ Create forwarding rule: $SOURCE_EMAIL → $DEST_EMAIL
□ Test email forwarding
□ Verify MX records are correct

Day 3: Verification
------------------
□ Send test emails to $SOURCE_EMAIL
□ Check delivery to $DEST_EMAIL
□ Verify email headers show forwarding
□ Check spam folder
□ Test from multiple senders

Day 3-7: Monitoring
------------------
□ Monitor email delivery for 3-5 days
□ Check for any missed emails
□ Update any services using old email
□ Inform contacts migration complete

Post-Migration:
--------------
□ Keep ProtonMail account for 30 days (backup)
□ Update email signatures
□ Update website contact information
□ Document new email setup
□ Train staff on new system (if applicable)

Rollback Plan:
-------------
If issues occur, can revert to ProtonMail:
1. Change nameservers back to original
2. Wait 24-48 hours for propagation
3. Verify ProtonMail working again
4. Investigate Cloudflare issues

Critical Contacts to Inform:
---------------------------
□ Important clients/partners
□ Service providers (billing, etc.)
□ Website contact forms
□ Automated services using email
□ Personal contacts

Timeline Estimate:
-----------------
- Nameserver change: 15 minutes
- DNS propagation: 24-48 hours
- Cloudflare setup: 30 minutes
- Testing period: 3-5 days
- Total migration: 3-7 days

Risk Assessment:
---------------
- Low risk: Cloudflare is reliable
- Temporary disruption: 24-48 hours possible
- Backup plan: Can revert to ProtonMail
- Mitigation: Plan during low-traffic period
EOF

    success "📝 Migration checklist saved to email-migration-checklist.txt"
}

# Generate verification script
generate_verification_script() {
    cat > verify-cloudflare-email.sh << 'EOF'
#!/bin/bash
# Cloudflare Email Forwarding Verification

DOMAIN="headyconnection.org"
SOURCE_EMAIL="e@headyconnection.com"
DEST_EMAIL="eric@headyconnection.org"

echo "📧 Cloudflare Email Forwarding Verification"
echo "=========================================="

echo "🔍 Checking nameservers..."
nslookup -type=NS $DOMAIN

echo ""
echo "📧 Checking MX records..."
dig +short MX $DOMAIN

echo ""
echo "🌐 Checking Cloudflare Email Routing status..."
echo "Visit: https://dash.cloudflare.com"
echo "Go to: Email → Email Routing"
echo "Verify: $SOURCE_EMAIL → $DEST_EMAIL"

echo ""
echo "📧 Test forwarding:"
echo "1. Send email to: $SOURCE_EMAIL"
echo "2. Check inbox: $DEST_EMAIL"
echo "3. Expected headers:"
echo "   - Delivered-To: $DEST_EMAIL"
echo "   - X-Forwarded-For: $SOURCE_EMAIL"
echo "   - Received: from mail.cloudflare.net"

echo ""
echo "🚨 Troubleshooting:"
echo "- If no delivery: Wait 24-48 hours for DNS propagation"
echo "- If in spam: Check SPF/DKIM/DMARC settings"
echo "- If delayed: Normal Cloudflare processing time"
echo "- If bounce: Check destination email validity"

echo ""
echo "📊 Cloudflare Status:"
echo "Check: https://www.cloudflarestatus.com"
EOF

    chmod +x verify-cloudflare-email.sh
    success "📝 Verification script created: verify-cloudflare-email.sh"
}

# Main execution
main() {
    log "🌐 Setting up Cloudflare Email Forwarding"
    log "=========================================="
    log "Domain: $DOMAIN"
    log "Forward: $SOURCE_EMAIL → $DEST_EMAIL"
    
    echo ""
    
    # Check current nameservers
    if check_nameservers; then
        echo ""
        success "✅ Domain already uses Cloudflare nameservers"
        info "🔧 Proceed directly to Email Routing setup"
        generate_email_routing_instructions
        echo ""
        info "📝 Next steps:"
        echo "   1. Login to Cloudflare Dashboard"
        echo "   2. Enable Email Routing"
        echo "   3. Create forwarding rule"
        echo "   4. Test with: ./verify-cloudflare-email.sh"
        
    else
        echo ""
        warn "⚠️ Domain needs nameserver change to Cloudflare"
        info "🔧 This will temporarily interrupt email service"
        echo ""
        generate_nameserver_instructions
        generate_migration_checklist
        echo ""
        info "📝 Migration process:"
        echo "   1. Change nameservers to Cloudflare (15 minutes)"
        echo "   2. Wait 24-48 hours for DNS propagation"
        echo "   3. Set up Email Routing in Cloudflare"
        echo "   4. Test forwarding"
        echo ""
        warn "⚠️ Plan migration during low-traffic period"
        warn "⚠️ Email may be interrupted for 24-48 hours"
    fi
    
    # Always generate verification script
    echo ""
    generate_verification_script
    
    echo ""
    success "🎉 Cloudflare Email Forwarding setup guide generated!"
    echo ""
    echo "📋 Files created:"
    echo "   📄 cloudflare-email-routing-setup.txt"
    echo "   📄 change-nameservers-to-cloudflare.txt"
    echo "   📄 email-migration-checklist.txt"
    echo "   🔧 verify-cloudflare-email.sh"
    echo ""
    echo "🌐 Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "📞 Cloudflare Support: https://support.cloudflare.com"
}

# Run main function
main "$@"
