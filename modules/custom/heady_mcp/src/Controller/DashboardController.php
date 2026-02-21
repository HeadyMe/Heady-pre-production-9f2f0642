<?php

namespace Drupal\heady_mcp\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\heady_mcp\Service\VectorEmbedder;

/**
 * Heady Engine Dashboard Controller
 */
class DashboardController extends ControllerBase {

  protected $vectorEmbedder;

  public function __construct(VectorEmbedder $vectorEmbedder = null) {
    $this->vectorEmbedder = $vectorEmbedder;
  }

  /**
   * Dashboard content
   */
  public function content() {
    // System status checks
    $jsonapi_status = \Drupal::moduleHandler()->moduleExists('jsonapi') ? 'Active' : 'Inactive';
    $mcp_status = \Drupal::moduleHandler()->moduleExists('mcp') ? 'Active' : 'Inactive';
    
    // Count nodes
    $node_count = \Drupal::entityQuery('node')->accessCheck(FALSE)->count()->execute();
    
    // Vector status
    $vector_status = 'Not initialized';
    $vector_count = 0;
    $embed_model = 'nomic-embed-text (local)';
    $embed_endpoint = 'http://ollama.heady.local:11434';
    
    if ($this->vectorEmbedder) {
      $stats = $this->vectorEmbedder->getStats();
      $vector_status = $stats['total_embeddings'] > 0 ? 'Active' : 'Ready';
      $vector_count = $stats['total_embeddings'];
      $embed_model = $stats['embed_model'] ?? $embed_model;
      $embed_endpoint = $stats['embed_endpoint'] ?? $embed_endpoint;
    }
    
    // Check for pgvector
    try {
      $vector_ext = \Drupal::database()->query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")->fetchField();
      $vector_ext_status = $vector_ext ? 'Installed' : 'Not Installed';
    } catch (\Exception $e) {
      $vector_ext_status = 'Error: ' . $e->getMessage();
    }
    
    // Priority execution stats
    $priority_count = 0;
    try {
      $priority_count = \Drupal::database()->query("SELECT COUNT(*) FROM heady_priority_log WHERE priority >= 10")->fetchField();
    } catch (\Exception $e) {
      // Table doesn't exist yet
    }
    
    return [
      '#theme' => 'heady_dashboard',
      '#jsonapi_status' => $jsonapi_status,
      '#mcp_status' => $mcp_status,
      '#node_count' => $node_count,
      '#vector_status' => $vector_status,
      '#vector_count' => $vector_count,
      '#vector_ext_status' => $vector_ext_status,
      '#embed_model' => $embed_model,
      '#embed_endpoint' => $embed_endpoint,
      '#priority_count' => $priority_count,
      '#api_endpoint' => \Drupal::request()->getSchemeAndHttpHost() . '/jsonapi',
      '#mcp_endpoint' => \Drupal::request()->getSchemeAndHttpHost() . '/mcp/v1',
      '#vector_endpoint' => \Drupal::request()->getSchemeAndHttpHost() . '/api/vector/search',
      '#timestamp' => date('Y-m-d H:i:s'),
    ];
  }
}
