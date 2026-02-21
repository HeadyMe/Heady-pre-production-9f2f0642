<?php
/**
 * HeadyBuddy API Endpoint
 * Handles cross-device sync and task management
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Simple API response
$response = [
  'status' => 'success',
  'message' => 'HeadyBuddy API is active',
  'version' => '1.0.0',
  'endpoints' => [
    '/sync/tasks' => 'Task synchronization',
    '/browser/start' => 'Start headless browser',
    '/browser/stop' => 'Stop headless browser',
    '/system/status' => 'System status'
  ],
  'timestamp' => date('Y-m-d H:i:s')
];

echo json_encode($response, JSON_PRETTY_PRINT);
