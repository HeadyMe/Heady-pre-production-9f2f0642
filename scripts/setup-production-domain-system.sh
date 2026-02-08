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
# ║  FILE: scripts/setup-production-domain-system.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# Heady Systems Production Domain Setup Script
# One-command setup for production-ready domain infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Heady Systems Production Domain Setup${NC}"
echo "=========================================="

# Configuration
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONF_D="/etc/nginx/conf.d"
LETSENCRYPT_LIVE="/etc/letsencrypt/live"

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_warning "This script requires sudo privileges"
    echo "Please run: sudo $0"
    exit 1
fi

echo ""
print_info "Step 1: Installing required packages..."

# Update package list
apt update

# Install required packages
apt install -y nginx python3-certbot python3-certbot-nginx ufw

print_status 0 "Package installation completed"

echo ""
print_info "Step 2: Setting up Nginx configuration..."

# Backup original nginx.conf
if [ -f /etc/nginx/nginx.conf ]; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    print_info "Backed up original nginx.conf"
fi

# Copy our nginx configuration
cp configs/nginx/nginx.conf /etc/nginx/nginx.conf
print_status 0 "Nginx main configuration updated"

# Create conf.d directory if it doesn't exist
mkdir -p $NGINX_CONF_D

# Copy security headers and proxy params
cp configs/nginx/security-headers.conf $NGINX_CONF_D/
cp configs/nginx/proxy-params.conf $NGINX_CONF_D/
cp configs/nginx/upstreams.conf $NGINX_CONF_D/

print_status 0 "Nginx includes configured"

echo ""
print_info "Step 3: Setting up site configurations..."

# Create sites-available directory
mkdir -p $NGINX_SITES_AVAILABLE

# Copy site configurations
cp configs/nginx/sites-available/heady-systems.com $NGINX_SITES_AVAILABLE/
cp configs/nginx/sites-available/api.headysystems.com $NGINX_SITES_AVAILABLE/

# Create local dev config (optional)
if [ "$1" = "--include-local" ]; then
    cp configs/nginx/sites-available/local-dev.conf $NGINX_SITES_AVAILABLE/
    print_info "Included local development configuration"
fi

print_status 0 "Site configurations copied"

echo ""
print_info "Step 4: Setting up SSL with Let's Encrypt..."

# List of domains to get certificates for
DOMAINS=(
    "headysystems.com"
    "www.headysystems.com"
    "api.headysystems.com"
    "app.headysystems.com"
    "admin.headysystems.com"
    "headyconnection.org"
    "www.headyconnection.org"
    "api.headyconnection.org"
    "headybuddy.org"
    "www.headybuddy.org"
)

# Get SSL certificates for each domain
for domain in "${DOMAINS[@]}"; do
    print_info "Getting SSL certificate for $domain..."
    
    # Create temporary nginx config for certbot
    cat > /etc/nginx/sites-temp/$domain << EOF
server {
    listen 80;
    server_name $domain;
    root /var/www/html;
}
EOF
    
    # Enable temporary site
    ln -sf /etc/nginx/sites-temp/$domain $NGINX_SITES_ENABLED/$domain
    
    # Reload nginx
    nginx -t && systemctl reload nginx
    
    # Get certificate
    certbot --nginx -d $domain --non-interactive --agree-tos --email admin@headysystems.com
    
    # Remove temporary config
    rm -f /etc/nginx/sites-temp/$domain $NGINX_SITES_ENABLED/$domain
done

print_status 0 "SSL certificates obtained"

echo ""
print_info "Step 5: Enabling production sites..."

# Enable production sites
ln -sf $NGINX_SITES_AVAILABLE/heady-systems.com $NGINX_SITES_ENABLED/
ln -sf $NGINX_SITES_AVAILABLE/api.headysystems.com $NGINX_SITES_ENABLED/

# Remove default site
rm -f $NGINX_SITES_ENABLED/default

# Test and reload nginx
nginx -t
systemctl reload nginx

print_status 0 "Production sites enabled"

echo ""
print_info "Step 6: Setting up firewall..."

# Configure UFW
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

print_status 0 "Firewall configured"

echo ""
print_info "Step 7: Creating web directories..."

# Create web directories
mkdir -p /var/www/headysystems.com/public
mkdir -p /var/www/api.headysystems.com
mkdir -p /var/www/headyconnection.org/public
mkdir -p /var/www/api.headyconnection.org
mkdir -p /var/www/headybuddy.org/public

# Set proper permissions
chown -R www-data:www-data /var/www/
chmod -R 755 /var/www/

print_status 0 "Web directories created"

echo ""
print_info "Step 8: Setting up log rotation..."

# Create log rotation config
cat > /etc/logrotate.d/heady-systems << EOF
/var/log/nginx/headysystems.com-*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}

/var/log/nginx/headyconnection.org-*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}

/var/log/nginx/headybuddy.org-*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF

print_status 0 "Log rotation configured"

echo ""
print_info "Step 9: Setting up monitoring..."

# Create health check endpoints
mkdir -p /var/www/html/health

cat > /var/www/html/health/index.php << EOF
<?php
header('Content-Type: application/json');
echo json_encode([
    'status' => 'healthy',
    'timestamp' => date('c'),
    'service' => 'Heady Systems Load Balancer'
]);
?>
EOF

# Create nginx status page
cat > /etc/nginx/conf.d/status.conf << EOF
server {
    listen 127.0.0.1:8080;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

print_status 0 "Monitoring endpoints configured"

echo ""
print_info "Step 10: Setting up automatic renewal..."

# Add certbot auto-renewal
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

print_status 0 "Auto-renewal configured"

echo ""
print_info "Step 11: Final configuration test..."

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx

# Check nginx status
systemctl status nginx --no-pager

print_status 0 "Final configuration test passed"

echo ""
echo -e "${GREEN}🎉 Production domain setup completed successfully!${NC}"
echo ""
echo "📋 Summary of what was configured:"
echo "  ✅ Nginx with security headers and proxy settings"
echo "  ✅ SSL certificates for all Heady domains"
echo "  ✅ Production site configurations"
echo "  ✅ Firewall with proper ports open"
echo "  ✅ Web directories with correct permissions"
echo "  ✅ Log rotation for all sites"
echo "  ✅ Health check endpoints"
echo "  ✅ SSL certificate auto-renewal"
echo ""
echo "🌐 Active sites:"
echo "  - https://headysystems.com"
echo "  - https://api.headysystems.com"
echo "  - https://headyconnection.org"
echo "  - https://headybuddy.org"
echo ""
echo "🔧 Next steps:"
echo "  1. Deploy your applications to the configured directories"
echo "  2. Set up your backend services on the specified ports"
echo "  3. Configure your DNS to point to this server"
echo "  4. Test all endpoints and SSL certificates"
echo ""
echo "📁 Important file locations:"
echo "  - Nginx config: /etc/nginx/nginx.conf"
echo "  - Site configs: $NGINX_SITES_AVAILABLE/"
echo "  - SSL certs: $LETSENCRYPT_LIVE/"
echo "  - Web roots: /var/www/"
echo "  - Logs: /var/log/nginx/"
echo ""
echo "🔍 To verify setup:"
echo "  curl https://headysystems.com/health"
echo "  curl https://api.headysystems.com/health"
echo ""
if [ "$1" = "--include-local" ]; then
    echo "🏠 Local development:"
    echo "  Add entries from configs/local-development/hosts-file to /etc/hosts"
    echo "  Enable local site: sudo ln -s $NGINX_SITES_AVAILABLE/local-dev.conf $NGINX_SITES_ENABLED/"
    echo "  Test locally: curl http://app.heady.local"
fi
