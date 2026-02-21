<?php

namespace Drupal\heady_mcp\Service;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Database\Connection;
use GuzzleHttp\ClientInterface;
use Drupal\heady_mcp\Service\VectorEmbedder;
use Drupal\heady_mcp\Service\PriorityExecutor;

/**
 * Heady MCP Tool Manager - Priority execution with vector integration
 */
class McpToolManager {

  protected $entityTypeManager;
  protected $database;
  protected $httpClient;
  protected $vectorEmbedder;
  protected $priorityExecutor;

  public function __construct(
    EntityTypeManagerInterface $entityTypeManager,
    Connection $database,
    ClientInterface $httpClient,
    VectorEmbedder $vectorEmbedder = null,
    PriorityExecutor $priorityExecutor = null
  ) {
    $this->entityTypeManager = $entityTypeManager;
    $this->database = $database;
    $this->httpClient = $httpClient;
    $this->vectorEmbedder = $vectorEmbedder;
    $this->priorityExecutor = $priorityExecutor;
  }

  /**
   * Returns all available MCP tools with priority execution support
   */
  public function getTools(): array {
    return [
      [
        'name' => 'create_note',
        'description' => 'Creates a new note/page in Drupal with vector indexing',
        'inputSchema' => [
          'type' => 'object',
          'properties' => [
            'title' => ['type' => 'string', 'description' => 'Title of the note'],
            'body' => ['type' => 'string', 'description' => 'Body content'],
            'priority' => ['type' => 'integer', 'description' => 'Priority level (0=background, 10=human-input)'],
          ],
          'required' => ['title'],
        ],
      ],
      [
        'name' => 'get_latest_content',
        'description' => 'Fetches the latest nodes from Drupal',
        'inputSchema' => [
          'type' => 'object',
          'properties' => [
            'type' => ['type' => 'string', 'description' => 'Content type (page, article, etc.)'],
            'limit' => ['type' => 'integer', 'description' => 'Number of items to return'],
            'priority' => ['type' => 'integer', 'description' => 'Priority level'],
          ],
        ],
      ],
      [
        'name' => 'semantic_search',
        'description' => 'Finds Drupal nodes by meaning using vector similarity',
        'inputSchema' => [
          'type' => 'object',
          'properties' => [
            'query' => ['type' => 'string', 'description' => 'Natural language query'],
            'bundle' => ['type' => 'string', 'description' => 'Filter by content type'],
            'limit' => ['type' => 'integer', 'description' => 'Max results (default 10)'],
            'priority' => ['type' => 'integer', 'description' => 'Priority level'],
          ],
          'required' => ['query'],
        ],
      ],
      [
        'name' => 'index_node',
        'description' => 'Generate and store vector embedding for a Drupal node',
        'inputSchema' => [
          'type' => 'object',
          'properties' => [
            'nid' => ['type' => 'integer', 'description' => 'Node ID to embed'],
            'priority' => ['type' => 'integer', 'description' => 'Priority level'],
          ],
          'required' => ['nid'],
        ],
      ],
      [
        'name' => 'validate_urls',
        'description' => 'Validates that all URLs in content use production domains only',
        'inputSchema' => [
          'type' => 'object',
          'properties' => [
            'content' => ['type' => 'string', 'description' => 'Content to validate'],
            'priority' => ['type' => 'integer', 'description' => 'Priority level'],
          ],
          'required' => ['content'],
        ],
      ],
    ];
  }

  /**
   * Executes a tool with priority support
   */
  public function executeTool(string $toolName, array $args): array {
    $priority = $args['priority'] ?? 0;
    
    // Priority execution - human input (10+) executes immediately
    if ($priority >= 10 && $this->priorityExecutor) {
      return $this->priorityExecutor->executeImmediate($toolName, $args, 'human_input');
    }
    
    // Standard execution
    switch ($toolName) {
      case 'create_note':
        return $this->toolCreateNote($args);
      case 'get_latest_content':
        return $this->toolGetLatest($args);
      case 'semantic_search':
        return $this->toolSemanticSearch($args);
      case 'index_node':
        return $this->toolIndexNode($args);
      case 'validate_urls':
        return $this->toolValidateUrls($args);
      default:
        throw new \Exception("Tool {$toolName} not found.");
    }
  }

  /**
   * Create note with automatic vector indexing
   */
  private function toolCreateNote(array $args): array {
    $node = $this->entityTypeManager->getStorage('node')->create([
      'type' => 'page',
      'title' => $args['title'],
      'body' => [
        'value' => $args['body'] ?? '',
        'format' => 'basic_html',
      ],
      'status' => 1,
    ]);
    $node->save();

    // Auto-index for vector search
    if ($this->vectorEmbedder) {
      $text = $args['title'] . ' ' . ($args['body'] ?? '');
      $this->vectorEmbedder->indexNode($node->id(), 'page', $text);
    }

    return [
      'status' => 'success',
      'id' => $node->id(),
      'title' => $node->getTitle(),
      'message' => 'Note created and indexed.',
    ];
  }

  /**
   * Get latest content
   */
  private function toolGetLatest(array $args): array {
    $type = $args['type'] ?? 'page';
    $limit = $args['limit'] ?? 5;

    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('status', 1)
      ->condition('type', $type)
      ->sort('created', 'DESC')
      ->range(0, $limit)
      ->accessCheck(TRUE);

    $nids = $query->execute();
    $nodes = $this->entityTypeManager->getStorage('node')->loadMultiple($nids);

    $result = [];
    foreach ($nodes as $node) {
      $result[] = [
        'id' => $node->id(),
        'title' => $node->getTitle(),
        'type' => $node->bundle(),
        'created' => $node->getCreatedTime(),
        'url' => $node->toUrl('canonical', ['absolute' => TRUE])->toString(),
      ];
    }
    return $result;
  }

  /**
   * Semantic search using vectors
   */
  private function toolSemanticSearch(array $args): array {
    if (!$this->vectorEmbedder) {
      throw new \Exception('Vector embedding service not available');
    }

    $query = $args['query'];
    $bundle = $args['bundle'] ?? null;
    $limit = $args['limit'] ?? 10;

    $results = $this->vectorEmbedder->semanticSearch($query, $limit, $bundle);
    
    // Load full node data
    $nids = array_column($results, 'entity_id');
    $nodes = $this->entityTypeManager->getStorage('node')->loadMultiple($nids);
    
    $output = [];
    foreach ($results as $result) {
      if (isset($nodes[$result->entity_id])) {
        $node = $nodes[$result->entity_id];
        $output[] = [
          'id' => $node->id(),
          'title' => $node->getTitle(),
          'type' => $node->bundle(),
          'similarity' => $result->similarity,
          'url' => $node->toUrl('canonical', ['absolute' => TRUE])->toString(),
        ];
      }
    }
    
    return $output;
  }

  /**
   * Index a node for vector search
   */
  private function toolIndexNode(array $args): array {
    if (!$this->vectorEmbedder) {
      throw new \Exception('Vector embedding service not available');
    }

    $nid = $args['nid'];
    $node = $this->entityTypeManager->getStorage('node')->load($nid);
    
    if (!$node) {
      throw new \Exception("Node {$nid} not found");
    }

    // Extract text content
    $text = $node->getTitle();
    if ($node->hasField('body') && !$node->get('body')->isEmpty()) {
      $text .= ' ' . $node->get('body')->value;
    }

    $this->vectorEmbedder->indexNode($nid, $node->bundle(), $text);
    
    return [
      'status' => 'success',
      'id' => $nid,
      'message' => 'Node indexed for vector search',
    ];
  }

  /**
   * Validate URLs - prevent localhost/.onrender.com pollution
   */
  private function toolValidateUrls(array $args): array {
    $content = $args['content'];
    
    // Banned URL patterns
    $blocked = [
      'localhost',
      '127.0.0.',
      '0.0.0.0',
      '.onrender.com',
      '10.',
      '192.168.',
      '172.',
    ];
    
    $found = [];
    foreach ($blocked as $pattern) {
      if (strpos($content, $pattern) !== false) {
        $found[] = $pattern;
      }
    }
    
    if (!empty($found)) {
      return [
        'status' => 'error',
        'message' => 'Blocked URL patterns found: ' . implode(', ', $found),
        'blocked_patterns' => $found,
        'suggestion' => 'Replace with production domains: https://api.headysystems.com, https://app.headysystems.com',
      ];
    }
    
    return [
      'status' => 'success',
      'message' => 'All URLs are valid - using production domains only',
    ];
  }
}
