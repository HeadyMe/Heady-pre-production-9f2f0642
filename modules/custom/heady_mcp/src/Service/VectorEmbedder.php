<?php

namespace Drupal\heady_mcp\Service;

use GuzzleHttp\ClientInterface;
use Drupal\Core\Database\Connection;
use Drupal\Core\Config\ConfigFactoryInterface;

/**
 * Vector Embedding Service for Heady MCP Engine
 * Supports local Ollama and remote OpenAI embeddings
 */
class VectorEmbedder {

  protected $httpClient;
  protected $database;
  protected $configFactory;
  protected $embedEndpoint;
  protected $embedModel;
  protected $embedApiKey;

  public function __construct(
    ClientInterface $httpClient,
    Connection $database,
    ConfigFactoryInterface $configFactory
  ) {
    $this->httpClient = $httpClient;
    $this->database = $database;
    $this->configFactory = $configFactory;
    
    // Configuration
    $this->embedEndpoint = getenv('EMBED_API_URL') ?: 'http://ollama.heady.local:11434/api/embeddings';
    $this->embedModel = getenv('EMBED_MODEL') ?: 'nomic-embed-text';
    $this->embedApiKey = getenv('EMBED_API_KEY') ?: '';
  }

  /**
   * Generate embedding vector for any text
   */
  public function embed(string $text): array {
    try {
      $payload = [
        'model' => $this->embedModel,
        'input' => $text,
      ];

      $headers = [
        'Content-Type' => 'application/json',
      ];

      // Add API key for external services
      if ($this->embedApiKey && strpos($this->embedEndpoint, 'api.openai.com') !== false) {
        $headers['Authorization'] = 'Bearer ' . $this->embedApiKey;
      }

      $response = $this->httpClient->post($this->embedEndpoint, [
        'json' => $payload,
        'headers' => $headers,
        'timeout' => 30,
      ]);

      $data = json_decode($response->getBody(), TRUE);
      
      // Handle different API formats
      if (isset($data['embedding'])) {
        return $data['embedding'];
      } elseif (isset($data['data'][0]['embedding'])) {
        return $data['data'][0]['embedding'];
      }
      
      throw new \Exception('Unexpected embedding response format');
      
    } catch (\Exception $e) {
      \Drupal::logger('heady_mcp')->error('Embedding generation failed: @message', [
        '@message' => $e->getMessage(),
      ]);
      throw $e;
    }
  }

  /**
   * Store a node's embedding vector
   */
  public function indexNode(int $nid, string $bundle, string $text): void {
    try {
      // Ensure vector table exists
      $this->ensureVectorTable();
      
      $vector = $this->embed($text);
      $vectorStr = '[' . implode(',', $vector) . ']';

      // Use merge for upsert
      $this->database->merge('heady_embeddings')
        ->key(['entity_type' => 'node', 'entity_id' => $nid])
        ->fields([
          'bundle' => $bundle,
          'embedding' => $vectorStr,
          'created_at' => date('Y-m-d H:i:s'),
        ])
        ->execute();
      
      \Drupal::logger('heady_mcp')->notice('Indexed node @nid for vector search', ['@nid' => $nid]);
      
    } catch (\Exception $e) {
      \Drupal::logger('heady_mcp')->error('Failed to index node @nid: @message', [
        '@nid' => $nid,
        '@message' => $e->getMessage(),
      ]);
      throw $e;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  public function semanticSearch(string $query, int $limit = 10, string $bundle = NULL): array {
    try {
      $this->ensureVectorTable();
      
      $queryVec = '[' . implode(',', $this->embed($query)) . ']';

      $sql = "SELECT entity_id, 1 - (embedding <=> :query_vec::vector) AS similarity
              FROM heady_embeddings
              WHERE entity_type = 'node'";
      
      $args = [':query_vec' => $queryVec];
      
      if ($bundle) {
        $sql .= " AND bundle = :bundle";
        $args[':bundle'] = $bundle;
      }
      
      $sql .= " ORDER BY embedding <=> :query_vec::vector
                LIMIT :limit";
      
      $args[':limit'] = $limit;

      return $this->database->query($sql, $args)->fetchAll();
      
    } catch (\Exception $e) {
      \Drupal::logger('heady_mcp')->error('Semantic search failed: @message', [
        '@message' => $e->getMessage(),
      ]);
      throw $e;
    }
  }

  /**
   * Ensure vector table and indexes exist
   */
  protected function ensureVectorTable(): void {
    try {
      // Check if pgvector extension exists
      $result = $this->database->query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")->fetchField();
      if (!$result) {
        throw new \Exception('pgvector extension not installed. Run: CREATE EXTENSION vector;');
      }
      
      // Create table if not exists
      $this->database->schema()->createTable('heady_embeddings', [
        'fields' => [
          'id' => ['type' => 'serial', 'not null' => TRUE],
          'entity_type' => ['type' => 'varchar', 'length' => 64, 'not null' => TRUE],
          'entity_id' => ['type' => 'int', 'not null' => TRUE],
          'bundle' => ['type' => 'varchar', 'length' => 64],
          'embedding' => ['type' => 'text', 'not null' => TRUE], // Store as text, cast to vector
          'created_at' => ['type' => 'varchar', 'length' => 19, 'not null' => TRUE],
        ],
        'primary key' => ['id'],
        'unique keys' => [
          'entity_unique' => ['entity_type', 'entity_id'],
        ],
      ]);
      
      // Create HNSW index for fast similarity search
      try {
        $this->database->query("CREATE INDEX IF NOT EXISTS heady_embeddings_hnsw_idx
                                ON heady_embeddings
                                USING hnsw (embedding vector_cosine_ops)
                                WITH (m = 16, ef_construction = 64)")->execute();
      } catch (\Exception $e) {
        \Drupal::logger('heady_mcp')->warning('Failed to create HNSW index: @message', [
          '@message' => $e->getMessage(),
        ]);
      }
      
    } catch (\Exception $e) {
      \Drupal::logger('heady_mcp')->error('Vector table setup failed: @message', [
        '@message' => $e->getMessage(),
      ]);
      throw $e;
    }
  }

  /**
   * Get vector statistics
   */
  public function getStats(): array {
    try {
      $this->ensureVectorTable();
      
      $count = $this->database->query("SELECT COUNT(*) FROM heady_embeddings")->fetchField();
      
      $bundles = $this->database->query("SELECT bundle, COUNT(*) as count 
                                         FROM heady_embeddings 
                                         GROUP BY bundle")->fetchAllKeyed();
      
      return [
        'total_embeddings' => (int) $count,
        'bundles' => $bundles,
        'embed_model' => $this->embedModel,
        'embed_endpoint' => $this->embedEndpoint,
      ];
      
    } catch (\Exception $e) {
      return [
        'total_embeddings' => 0,
        'bundles' => [],
        'error' => $e->getMessage(),
      ];
    }
  }
}
