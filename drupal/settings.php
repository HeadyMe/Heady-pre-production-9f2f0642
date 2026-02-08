<?php
$databases['default']['default'] = array (
  'database' => getenv('DRUPAL_DATABASE_NAME'),
  'username' => getenv('DRUPAL_DATABASE_USER'),
  'password' => getenv('DRUPAL_DATABASE_PASSWORD'),
  'host' => 'db.heady.internal',
  'port' => '3306',
  'driver' => 'mysql',
);
