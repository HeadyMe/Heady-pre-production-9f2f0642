<?php

namespace Drupal\heady_health\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\Cache\CacheBackendInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for health check endpoints.
 */
class HealthController extends ControllerBase {

  /**
   * The database connection.
   *
   * @var \Drupal\Core\Database\Connection
   */
  protected $database;

  /**
   * The cache backend.
   *
   * @var \Drupal\Core\Cache\CacheBackendInterface
   */
  protected $cache;

  /**
   * Constructs a HealthController object.
   *
   * @param \Drupal\Core\Database\Connection $database
   *   The database connection.
   * @param \Drupal\Core\Cache\CacheBackendInterface $cache
   *   The cache backend.
   */
  public function __construct(Connection $database, CacheBackendInterface $cache) {
    $this->database = $database;
    $this->cache = $cache;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('database'),
      $container->get('cache.default')
    );
  }

  /**
   * Health check endpoint.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Health status response.
   */
  public function check() {
    $health = [
      'ok' => TRUE,
      'service' => 'heady-drupal-cms',
      'timestamp' => time(),
      'version' => \Drupal::VERSION,
      'environment' => \Drupal::config('system.site')->get('name'),
    ];

    // Check database connection
    try {
      $this->database->query('SELECT 1')->fetchField();
      $health['database'] = 'connected';
    }
    catch (\Exception $e) {
      $health['database'] = 'error';
      $health['ok'] = FALSE;
    }

    // Check cache backend
    try {
      $this->cache->set('health_test', 'test', 60);
      $cache_test = $this->cache->get('health_test');
      $health['cache'] = $cache_test === 'test' ? 'working' : 'error';
      if ($health['cache'] === 'error') {
        $health['ok'] = FALSE;
      }
    }
    catch (\Exception $e) {
      $health['cache'] = 'error';
      $health['ok'] = FALSE;
    }

    // Check JSON:API
    try {
      $jsonapi_status = \Drupal::service('jsonapi.resource_type_repository')->getAll();
      $health['jsonapi'] = 'active';
    }
    catch (\Exception $e) {
      $health['jsonapi'] = 'error';
      $health['ok'] = FALSE;
    }

    // Check Next.js integration
    try {
      $next_config = \Drupal::config('next.settings');
      $health['nextjs'] = $next_config->get('sites') ? 'configured' : 'not_configured';
    }
    catch (\Exception $e) {
      $health['nextjs'] = 'error';
    }

    $status = $health['ok'] ? 200 : 503;
    return new JsonResponse($health, $status);
  }

  /**
   * Detailed health check with system metrics.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Detailed health status.
   */
  public function detailed() {
    $health = $this->check()->getData(TRUE);
    
    // Add system metrics
    $health['metrics'] = [
      'memory_usage' => memory_get_usage(TRUE),
      'memory_peak' => memory_get_peak_usage(TRUE),
      'uptime' => time() - \Drupal::state()->get('install_time', time()),
      'active_modules' => count(\Drupal::service('extension.list.module')->getList()),
      'active_themes' => count(\Drupal::service('extension.list.theme')->getList()),
    ];

    // Database metrics
    try {
      $health['metrics']['database'] = [
        'tables' => $this->database->schema()->findTables(),
        'connections' => $this->database->query("SHOW STATUS LIKE 'Threads_connected'")->fetchField(),
      ];
    }
    catch (\Exception $e) {
      $health['metrics']['database'] = ['error' => $e->getMessage()];
    }

    return new JsonResponse($health);
  }

}
