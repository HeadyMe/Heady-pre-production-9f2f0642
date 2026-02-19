<?php
/**
 * @file
 * Drupal 11 settings for HeadySystems
 */

// Database configuration
$databases['default']['default'] = [
  'database' => getenv('DB_NAME') ?: 'headysystems',
  'username' => getenv('DB_USER') ?: 'postgres',
  'password' => getenv('DB_PASS') ?: '',
  'prefix' => '',
  'host' => getenv('DB_HOST') ?: 'postgres',
  'port' => getenv('DB_PORT') ?: '5432',
  'namespace' => 'Drupal\\Core\\Database\\Driver\\pgsql',
  'driver' => 'pgsql',
];

// Configuration directories
$settings['config_sync_directory'] = '../config/sync';

// Trusted host patterns
$settings['trusted_host_patterns'] = [
  '^cms\.headysystems\.onrender\.com$',
  '^app\.headysystems\.onrender\.com$',
  '^api\.headysystems\.onrender\.com$',
];

// Reverse proxy configuration
$settings['reverse_proxy_addresses'] = [
  $_SERVER['REMOTE_ADDR'],
];

// JSON:API configuration
$settings['jsonapi_hypermedia_application_type'] = true;

// CORS configuration
if (getenv('APP_ENV') === 'development') {
  $settings['cors.config'] = [
    'enabled' => true,
    'allowed_headers' => ['*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    'allowed_origins' => ['*'],
    'exposed_headers' => false,
    'max_age' => 0,
    'supports_credentials' => false,
  ];
}