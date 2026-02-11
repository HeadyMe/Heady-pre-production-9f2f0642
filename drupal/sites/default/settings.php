<?php

$databases['default']['default'] = [
  'database' => getenv('DRUPAL_DATABASE_NAME'),
  'username' => getenv('DRUPAL_DATABASE_USER'),
  'password' => getenv('DRUPAL_DATABASE_PASSWORD'),
  'host' => getenv('DRUPAL_DATABASE_HOST'),
  'port' => '3306',
  'driver' => 'mysql',
];
