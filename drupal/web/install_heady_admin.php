<?php
/**
 * Heady Systems Admin Installation Script
 * Run this script to install the theme and module
 */

// Drupal bootstrap
use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;

// Bootstrap Drupal
$autoloader = require_once 'autoload.php';
$request = Request::createFromGlobals();
DrupalKernel::createFromRequest($request, $autoloader, 'prod')->boot();

// Install theme
try {
    \Drupal::service('theme_installer')->install(['heady_admin_theme']);
    \Drupal::config('system.theme')->set('admin', 'heady_admin_theme')->save();
    echo "✅ Heady Admin Theme installed successfully!\n";
} catch (Exception $e) {
    echo "❌ Theme installation failed: " . $e->getMessage() . "\n";
}

// Install module
try {
    \Drupal::service('module_installer')->install(['heady_admin']);
    echo "✅ Heady Admin Module installed successfully!\n";
} catch (Exception $e) {
    echo "❌ Module installation failed: " . $e->getMessage() . "\n";
}

// Clear caches
try {
    drupal_flush_all_caches();
    echo "✅ Caches cleared successfully!\n";
} catch (Exception $e) {
    echo "❌ Cache clearing failed: " . $e->getMessage() . "\n";
}

echo "\n🎉 Installation complete!\n";
echo "📱 Visit: /admin/dashboard\n";
echo "🔧 Visit: /admin/config/system/heady_admin\n";
?>
