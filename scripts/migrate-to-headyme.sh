#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🚀 MIGRATE TO HEADYME ORGANIZATION
# ═══════════════════════════════════════════════════════════════
# Automated migration of GitHub repositories and Render services

set -e

echo "🚀 Migrating Heady infrastructure to HeadyMe organization..."

# Step 1: Transfer GitHub repositories
echo "📦 Transferring repositories..."
gh repo edit HeadyConnection/headyconnection-web --transfer-owner HeadyMe
gh repo edit HeadyConnection/headyconnection-drupal --transfer-owner HeadyMe
gh repo edit HeadyConnection/Heady --transfer-owner HeadyMe

# Step 2: Update git remotes locally
echo "🔗 Updating git remotes..."
cd ../headyconnection-web
git remote set-url origin git@github.com:HeadyMe/headyconnection-web.git
git remote set-url heady-me git@github.com:HeadyMe/headyconnection-web.git

cd ../headyconnection-drupal
git remote set-url origin git@github.com:HeadyMe/headyconnection-drupal.git

cd ../Heady
git remote set-url heady-me git@github.com:HeadyMe/Heady.git

# Step 3: Update Render service repositories
echo "☁️  Updating Render service configurations..."
RENDER_API_KEY=$(heady-secrets get --key RENDER_API_KEY --environment production)

# Update Drupal CMS service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-drupal-cms)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com:HeadyMe/headyconnection-drupal",
    "branch": "main"
  }'

# Update Next.js frontend service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-nextjs-frontend)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com:HeadyMe/headyconnection-web",
    "branch": "main"
  }'

# Update Heady Manager service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-manager-headyconnection)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com:HeadyMe/Heady",
    "branch": "main"
  }'

# Step 4: Update configuration files
echo "⚙️  Updating configuration files..."

# Update render.yaml files
sed -i 's|HeadyConnection/headyconnection|HeadyMe/headyconnection|g' \
  ../headyconnection-drupal/render.yaml \
  ../headyconnection-web/render.yaml

# Update package.json repositories
sed -i 's|HeadyConnection/headyconnection|HeadyMe/headyconnection|g' \
  ../headyconnection-drupal/composer.json \
  ../headyconnection-web/package.json

# Step 5: Update domain configurations
echo "🌐 Updating domain configurations..."

# Update environment variables
curl -X POST "https://api.render.com/v1/services/$(render_service_id heady-drupal-cms)/env-vars" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"key": "DRUPAL_HASH_SALT", "sync": false},
    {"key": "CLOUDFLARE_API_TOKEN", "sync": false}
  ]'

curl -X POST "https://api.render.com/v1/services/$(render_service_id heady-nextjs-frontend)/env-vars" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"key": "DRUPAL_CLIENT_ID", "sync": false},
    {"key": "DRUPAL_CLIENT_SECRET", "sync": false},
    {"key": "DRUPAL_PREVIEW_SECRET", "sync": false}
  ]'

# Step 6: Trigger deployments
echo "🚀 Triggering deployments..."
curl -X POST "https://api.render.com/v1/services/$(render_service_id heady-drupal-cms)/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'

curl -X POST "https://api.render.com/v1/services/$(render_service_id heady-nextjs-frontend)/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'

curl -X POST "https://api.render.com/v1/services/render_service_id heady-manager-headyconnection)/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'

echo ""
echo "✅ Migration to HeadyMe complete!"
echo ""
echo "📊 Updated repositories:"
echo "   - HeadyMe/headyconnection-drupal"
echo "   - HeadyMe/headyconnection-web"
echo "   - HeadyMe/Heady"
echo ""
echo "🌐 Updated Render services:"
echo "   - heady-drupal-cms"
echo "   - heady-nextjs-frontend"
echo "   - heady-manager-headyconnection"
echo ""
echo "🚀 All services redeploying..."
