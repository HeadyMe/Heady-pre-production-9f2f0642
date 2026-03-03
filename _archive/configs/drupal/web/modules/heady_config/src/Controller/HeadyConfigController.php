<?php

namespace Drupal\heady_config\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Heady system configuration controller.
 *
 * Exposes AI model registry, routing rules, and health check
 * for the HeadyConductor intelligence layer.
 */
class HeadyConfigController extends ControllerBase {

  /**
   * Returns the full Heady system configuration.
   */
  public function getConfig(): JsonResponse {
    $config = [
      'version' => '2.0.0',
      'architecture' => 'HeadyConductor — Distributed Dynamic Resource Allocation',
      'php' => phpversion(),
      'drupal' => \Drupal::VERSION,
      'ai_models' => [
        [
          'name' => 'Ollama-Primary',
          'endpoint' => 'http://heady-ollama-local:11434',
          'model' => 'phi3:mini',
          'type' => 'general',
          'priority' => 1,
        ],
        [
          'name' => 'Ollama-AI',
          'endpoint' => 'http://heady-ollama-ai:11434',
          'model' => 'phi3:mini',
          'type' => 'general',
          'priority' => 2,
        ],
        [
          'name' => 'Llama-Service',
          'endpoint' => 'http://heady-llama-service:11434',
          'model' => 'llama3.2',
          'type' => 'general',
          'priority' => 3,
        ],
        [
          'name' => 'Code-Service',
          'endpoint' => 'http://heady-code-service:11434',
          'model' => 'codellama',
          'type' => 'code',
          'priority' => 1,
        ],
        [
          'name' => 'Vision-Service',
          'endpoint' => 'http://heady-vision-service:11434',
          'model' => 'llava',
          'type' => 'vision',
          'priority' => 1,
        ],
        [
          'name' => 'Embedding-Service',
          'endpoint' => 'http://heady-embedding-service:11434',
          'model' => 'nomic-embed-text',
          'type' => 'embedding',
          'priority' => 1,
        ],
      ],
      'routing_rules' => [
        'code_keywords' => ['code', 'function', 'debug', 'error', 'programming', 'script', 'css', 'html', 'api', 'deploy'],
        'vision_keywords' => ['image', 'picture', 'photo', 'look at', 'see'],
        'analysis_keywords' => ['analyze', 'summarize', 'extract', 'data', 'metrics', 'report'],
        'strategy' => 'intent_routing_with_round_robin_fallback',
      ],
      'services' => [
        'manager' => 'http://heady-manager-local:3301',
        'hcfp' => 'http://localhost:8080',
        'ai_gateway' => 'http://heady-ai-gateway:80',
        'python_worker' => 'http://heady-python-worker-local:5000',
        'vector_db' => 'http://heady-qdrant-local:6333',
        'redis' => 'http://heady-redis-local:6379',
      ],
      'sites' => [
        'headysystems' => ['domain' => 'headysystems.com', 'geometry' => 'Metatron\'s Cube'],
        'headyme' => ['domain' => 'headyme.com', 'geometry' => 'Flower of Life'],
        'headyconnection' => ['domain' => 'headyconnection.com', 'geometry' => 'Sri Yantra'],
        'headyio' => ['domain' => 'headyio.com', 'geometry' => 'Torus'],
        'headybuddy' => ['domain' => 'headybuddy.org', 'geometry' => 'Seed of Life'],
        'headymcp' => ['domain' => 'headymcp.com', 'geometry' => 'Vesica Piscis'],
      ],
    ];

    return new JsonResponse($config, 200, [
      'Access-Control-Allow-Origin' => '*',
      'Cache-Control' => 'public, max-age=300',
    ]);
  }

  /**
   * Returns a health check for all Heady services.
   */
  public function getHealth(): JsonResponse {
    $health = [
      'status' => 'operational',
      'timestamp' => date('c'),
      'drupal' => [
        'status' => 'up',
        'version' => \Drupal::VERSION,
        'php' => phpversion(),
      ],
      'modules' => [
        'jsonapi' => \Drupal::moduleHandler()->moduleExists('jsonapi'),
        'rest' => \Drupal::moduleHandler()->moduleExists('rest'),
        'heady_sites' => \Drupal::moduleHandler()->moduleExists('heady_sites'),
        'heady_content' => \Drupal::moduleHandler()->moduleExists('heady_content'),
        'heady_config' => TRUE,
      ],
    ];

    return new JsonResponse($health, 200, [
      'Access-Control-Allow-Origin' => '*',
    ]);
  }

}
