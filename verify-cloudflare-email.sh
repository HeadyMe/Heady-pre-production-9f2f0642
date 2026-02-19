#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: verify-cloudflare-email.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

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
