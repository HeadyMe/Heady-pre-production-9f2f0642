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
# ║  FILE: deploy.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

#!/bin/bash

# HeadySystems Drupal 11 Hybrid Deployment

echo "🚀 Deploying HeadySystems Drupal 11 Hybrid..."

# 1. Deploy Drupal CMS
echo "📋 Deploying Drupal CMS..."
cd drupal
composer install --no-dev --optimize-autoloader
drush cache:rebuild
drush config:import
drush cr

# 2. Build frontend
echo "⚛️ Building React frontend..."
cd ../frontend
npm ci
npm run build

# 3. Deploy API services
echo "🔌 Deploying API services..."
cd ../api
npm ci
npm run build

# 4. Update DNS/Cloudflare
echo "🌐 Updating DNS configuration..."
# Add Cloudflare API calls here

# 5. Health checks
echo "🏥 Running health checks..."
curl -f https://cms.headysystems.onrender.com/health || exit 1
curl -f https://api.headysystems.onrender.com/health || exit 1
curl -f https://app.headysystems.onrender.com || exit 1

echo "✅ Deployment complete!"
echo "📊 Monitoring: https://monitoring.headysystems.onrender.com"
