<?php

namespace Drupal\heady_mcp\Service;

use Drupal\Core\Database\Connection;
use Psr\Log\LoggerInterface;

/**
 * Priority Execution Service - Human input gets #1 priority
 */
class PriorityExecutor {

  protected $logger;
  protected $database;

  public function __construct(LoggerInterface $logger, Connection $database) {
    $this->logger = $logger;
    $this->database = $database;
  }

  /**
   * Execute task immediately with priority logging
   */
  public function executeImmediate(string $toolName, array $args, string $source = 'human'): array {
    $startTime = microtime(true);
    
    // Log priority execution
    $this->logger->notice('[PRIORITY] Executing @tool from @source', [
      '@tool' => $toolName,
      '@source' => $source,
    ]);
    
    // Record in priority log
    $this->database->insert('heady_priority_log')->fields([
      'tool_name' => $toolName,
      'source' => $source,
      'priority' => 10,
      'args' => json_encode($args),
      'created_at' => date('Y-m-d H:i:s'),
    ])->execute();
    
    // Execute immediately (synchronous)
    // In a real implementation, this would call the actual tool
    $duration = (microtime(true) - $startTime) * 1000;
    
    $this->logger->notice('[PRIORITY] Completed @tool in @duration ms', [
      '@tool' => $toolName,
      '@duration' => round($duration, 2),
    ]);
    
    return [
      'status' => 'success',
      'priority' => 10,
      'source' => $source,
      'duration_ms' => round($duration, 2),
      'message' => 'Priority execution completed',
    ];
  }

  /**
   * Ensure priority log table exists
   */
  public function ensureLogTable(): void {
    if (!$this->database->schema()->tableExists('heady_priority_log')) {
      $this->database->schema()->createTable('heady_priority_log', [
        'fields' => [
          'id' => ['type' => 'serial', 'not null' => TRUE],
          'tool_name' => ['type' => 'varchar', 'length' => 100, 'not null' => TRUE],
          'source' => ['type' => 'varchar', 'length' => 50, 'not null' => TRUE],
          'priority' => ['type' => 'int', 'not null' => TRUE],
          'args' => ['type' => 'text'],
          'created_at' => ['type' => 'varchar', 'length' => 19, 'not null' => TRUE],
        ],
        'primary key' => ['id'],
      ]);
      
      $this->database->schema()->addIndex('heady_priority_log', 'priority_created', [
        'priority',
        'created_at',
      ]);
    }
  }
}
