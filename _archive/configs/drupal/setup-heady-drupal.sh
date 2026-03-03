#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Heady Drupal 11 Headless CMS — Setup Script
# 
# USAGE:  bash /home/headyme/config/drupal/setup-heady-drupal.sh
# 
# This script:
#   1. Creates a shared network between Drupal + DB containers
#   2. Installs the Drupal site with correct DB connection
#   3. Enables JSON:API + all custom Heady modules
#   4. Verifies the JSON:API endpoint
# ═══════════════════════════════════════════════════════════════════
set -e

DRUPAL_CONTAINER="drupal_drupal_2"
DB_CONTAINER="drupal_db_1"
DB_USER="heady"
DB_PASS="HeadySecure2026!@#"
DB_NAME="heady_admin"

echo "🔧 Heady Drupal 11 CMS Setup"
echo "═══════════════════════════════"

# ── Step 1: Network Bridge ──────────────────────────────────
echo ""
echo "1️⃣  Creating shared network..."
docker network create heady-drupal-bridge 2>/dev/null || true
docker network connect heady-drupal-bridge "$DRUPAL_CONTAINER" 2>/dev/null || echo "   Already connected"
docker network connect heady-drupal-bridge "$DB_CONTAINER" 2>/dev/null || echo "   Already connected"

# Get DB IP on the bridge network
DB_IP=$(docker inspect "$DB_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{if eq $k "heady-drupal-bridge"}}{{$v.IPAddress}}{{end}}{{end}}' 2>/dev/null)

# Fallback: try host.containers.internal
if [ -z "$DB_IP" ] || [ "$DB_IP" = "<no value>" ]; then
  DB_IP="host.containers.internal"
  # drupal_db_1 doesn't expose port to host, so also try the bridge IP
  DB_IP=$(docker inspect "$DB_CONTAINER" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null | awk '{print $NF}')
fi

echo "   DB IP: $DB_IP"

# ── Step 2: Write correct settings.php ──────────────────────
echo ""
echo "2️⃣  Writing settings.php..."
cat > /tmp/drupal_settings.php << 'SETTINGS'
<?php
$databases['default']['default'] = [
  'database' => 'heady_admin',
  'username' => 'heady',
  'password' => 'HeadySecure2026!@#',
  'host' => 'DB_HOST_PLACEHOLDER',
  'port' => '5432',
  'driver' => 'pgsql',
  'prefix' => '',
];
$settings['hash_salt'] = 'heady_sacred_geometry_salt_2026';
$settings['update_free_access'] = FALSE;
$settings['trusted_host_patterns'] = ['^.*$'];
SETTINGS

# Replace placeholder with actual DB IP
sed -i "s/DB_HOST_PLACEHOLDER/$DB_IP/" /tmp/drupal_settings.php
docker cp /tmp/drupal_settings.php "$DRUPAL_CONTAINER:/opt/drupal/web/sites/default/settings.php"
echo "   ✓ settings.php deployed (DB host: $DB_IP)"

# ── Step 3: Deploy modules ─────────────────────────────────
echo ""
echo "3️⃣  Deploying custom modules..."
docker exec "$DRUPAL_CONTAINER" mkdir -p /opt/drupal/web/modules/custom 2>/dev/null || true
for module in heady_sites heady_content heady_config heady_tasks; do
  SRC="/home/headyme/config/drupal/web/modules/$module"
  if [ -d "$SRC" ]; then
    docker cp "$SRC" "$DRUPAL_CONTAINER:/opt/drupal/web/modules/custom/"
    echo "   ✓ $module"
  fi
done

# ── Step 4: Install Drupal ─────────────────────────────────
echo ""
echo "4️⃣  Installing Drupal (this takes 1-2 minutes)..."
ENCODED_PASS=$(echo "$DB_PASS" | sed 's/!/%21/g; s/@/%40/g; s/#/%23/g')
docker exec -w /opt/drupal "$DRUPAL_CONTAINER" php vendor/drush/drush/drush.php site:install standard \
  --db-url="pgsql://${DB_USER}:${ENCODED_PASS}@${DB_IP}:5432/${DB_NAME}" \
  --site-name="Heady Systems CMS" \
  --account-name=admin \
  --account-pass=HeadyAdmin2026 \
  --yes 2>&1

# ── Step 5: Enable modules ─────────────────────────────────
echo ""
echo "5️⃣  Enabling modules..."
docker exec -w /opt/drupal "$DRUPAL_CONTAINER" php vendor/drush/drush/drush.php en \
  jsonapi rest serialization basic_auth taxonomy link -y 2>&1

for module in heady_sites heady_content heady_config; do
  echo "   Enabling $module..."
  docker exec -w /opt/drupal "$DRUPAL_CONTAINER" php vendor/drush/drush/drush.php en "$module" -y 2>&1 || echo "   ⚠ $module failed"
done

# ── Step 6: Clear cache ────────────────────────────────────
echo ""
echo "6️⃣  Clearing cache..."
docker exec -w /opt/drupal "$DRUPAL_CONTAINER" php vendor/drush/drush/drush.php cr 2>&1

# ── Step 7: Verify ─────────────────────────────────────────
echo ""
echo "7️⃣  Verifying endpoints..."
echo "   JSON:API:     $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:8083/jsonapi 2>/dev/null)"
echo "   Heady Config: $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:8083/api/heady/config 2>/dev/null)"
echo "   Heady Health: $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:8083/api/heady/health 2>/dev/null)"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Heady Drupal 11 CMS Setup Complete!"
echo ""
echo "   Admin:      http://localhost:8083/user/login"
echo "               (admin / HeadyAdmin2026)"
echo "   JSON:API:   http://localhost:8083/jsonapi"
echo "   Config:     http://localhost:8083/api/heady/config"
echo "   Health:     http://localhost:8083/api/heady/health"
echo "═══════════════════════════════════════════════════"
