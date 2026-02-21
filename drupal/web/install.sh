#!/bin/bash

# Heady Systems Admin Installation Script
echo "🚀 Installing Heady Systems Admin Interface..."

# Check if we're in the right directory
if [ ! -f "core/install.php" ]; then
    echo "❌ Error: Please run this script from the Drupal web root directory"
    exit 1
fi

# Set permissions
echo "📋 Setting permissions..."
chmod -R 755 themes/heady_admin_theme
chmod -R 755 modules/heady_admin_module

# Create database table if needed
echo "🗄️ Creating database tables..."
php -r "
require_once 'includes/bootstrap.inc';
drupal_bootstrap(DRUPAL_BOOTSTRAP_FULL);
try {
    db_query('CREATE TABLE IF NOT EXISTS {heady_admin_services} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_name VARCHAR(255) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        port INT NOT NULL,
        status VARCHAR(50) DEFAULT \"pending\",
        created INT NOT NULL
    )');
    echo '✅ Database table created\n';
} catch (Exception \$e) {
    echo '⚠️ Database table may already exist\n';
}
"

# Run the PHP installation script
echo "🔧 Installing theme and module..."
php install_heady_admin.php

# Final message
echo ""
echo "🎉 INSTALLATION COMPLETE!"
echo "📱 Admin Dashboard: http://your-site.com/admin/dashboard"
echo "🔧 Settings: http://your-site.com/admin/config/system/heady_admin"
echo "🚀 Services: http://your-site.com/admin/services"
echo ""
echo "✨ Your Heady Systems Admin Interface is ready!"
