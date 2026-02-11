<?php
$databases['default']['default'] = array (
  'database' => getenv('DRUPAL_DATABASE_NAME'),
  'username' => getenv('DRUPAL_DATABASE_USER'),
  'password' => getenv('DRUPAL_DATABASE_PASSWORD'),
  'host' => getenv('DRUPAL_DATABASE_HOST'),
  'port' => getenv('DRUPAL_DATABASE_PORT'),
  'driver' => 'pgsql',
);
