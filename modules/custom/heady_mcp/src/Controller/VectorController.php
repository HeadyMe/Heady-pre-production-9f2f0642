<?php

namespace Drupal\heady_mcp\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\heady_mcp\Service\VectorEmbedder;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Vector Search Controller
 */
class VectorController extends ControllerBase {

  protected $vectorEmbedder;

  public function __construct(VectorEmbedder $vectorEmbedder) {
    $this->vectorEmbedder = $vectorEmbedder;
  }

  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('heady_mcp.vector_embedder')
    );
  }

  /**
   * Semantic search endpoint
   */
  public function search(Request $request) {
    try {
      $data = json_decode($request->getContent(), TRUE);
      
      if (!isset($data['query'])) {
        return new JsonResponse([
          'error' => 'Query parameter is required',
        ], 400);
      }

      $query = $data['query'];
      $bundle = $data['bundle'] ?? null;
      $limit = $data['limit'] ?? 10;

      $results = $this->vectorEmbedder->semanticSearch($query, $limit, $bundle);
      
      // Load full node data
      $nids = array_column($results, 'entity_id');
      $nodes = $this->entityTypeManager()->getStorage('node')->loadMultiple($nids);
      
      $output = [];
      foreach ($results as $result) {
        if (isset($nodes[$result->entity_id])) {
          $node = $nodes[$result->entity_id];
          $output[] = [
            'id' => $node->id(),
            'title' => $node->getTitle(),
            'type' => $node->bundle(),
            'similarity' => round($result->similarity, 4),
            'url' => $node->toUrl('canonical', ['absolute' => TRUE])->toString(),
            'created' => $node->getCreatedTime(),
          ];
        }
      }

      return new JsonResponse([
        'query' => $query,
        'results' => $output,
        'total' => count($output),
      ]);
      
    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => $e->getMessage(),
      ], 500);
    }
  }

  /**
   * Index entity for vector search
   */
  public function indexEntity($entity_type, $entity_id) {
    try {
      if ($entity_type !== 'node') {
        return new JsonResponse([
          'error' => 'Only node entities are supported',
        ], 400);
      }

      $node = $this->entityTypeManager()->getStorage('node')->load($entity_id);
      
      if (!$node) {
        return new JsonResponse([
          'error' => "Entity {$entity_id} not found",
        ], 404);
      }

      // Extract text content
      $text = $node->getTitle();
      if ($node->hasField('body') && !$node->get('body')->isEmpty()) {
        $text .= ' ' . $node->get('body')->value;
      }

      $this->vectorEmbedder->indexNode($entity_id, $node->bundle(), $text);
      
      return new JsonResponse([
        'status' => 'success',
        'message' => 'Entity indexed for vector search',
        'entity_id' => $entity_id,
        'entity_type' => $entity_type,
        'bundle' => $node->bundle(),
      ]);
      
    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => $e->getMessage(),
      ], 500);
    }
  }
}
