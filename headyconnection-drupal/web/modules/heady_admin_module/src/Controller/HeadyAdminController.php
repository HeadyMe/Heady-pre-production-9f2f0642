<?php

namespace Drupal\heady_admin\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Heady Systems admin interface.
 */
class HeadyAdminController extends ControllerBase implements ContainerInjectionInterface {

  /**
   * The database connection.
   *
   * @var \Drupal\Core\Database\Connection
   */
  protected $database;

  /**
   * Constructs a HeadyAdminController object.
   *
   * @param \Drupal\Core\Database\Connection $database
   *   The database connection.
   */
  public function __construct(Connection $database) {
    $this->database = $database;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('database')
    );
  }

  /**
   * Dashboard page.
   */
  public function dashboard() {
    // Get system statistics
    $stats = $this->getSystemStats();
    
    // Get services status
    $services = $this->getServicesStatus();
    
    return [
      '#theme' => 'heady_admin_dashboard',
      '#stats' => $stats,
      '#services' => $services,
      '#attached' => [
        'library' => [
          'heady_admin/global',
        ],
      ],
    ];
  }

  /**
   * Services management page.
   */
  public function services() {
    $services = $this->getServicesStatus();
    
    return [
      '#theme' => 'heady_admin_services',
      '#services' => $services,
      '#attached' => [
        'library' => [
          'heady_admin/global',
        ],
      ],
    ];
  }

  /**
   * Domain management page.
   */
  public function domains() {
    $domains = $this->getDomainsList();
    
    return [
      '#theme' => 'heady_admin_domains',
      '#domains' => $domains,
      '#attached' => [
        'library' => [
          'heady_admin/global',
        ],
      ],
    ];
  }

  /**
   * Tunnel management page.
   */
  public function tunnels() {
    $tunnels = $this->getTunnelsStatus();
    
    return [
      '#theme' => 'heady_admin_tunnels',
      '#tunnels' => $tunnels,
      '#attached' => [
        'library' => [
          'heady_admin/global',
        ],
      ],
    ];
  }

  /**
   * API status endpoint.
   */
  public function apiStatus(Request $request) {
    $stats = $this->getSystemStats();
    $services = $this->getServicesStatus();
    
    return new JsonResponse([
      'stats' => $stats,
      'services' => $services,
      'timestamp' => time(),
    ]);
  }

  /**
   * Get system statistics.
   */
  protected function getSystemStats() {
    return [
      'total_services' => $this->getServiceCount(),
      'active_domains' => $this->getDomainCount(),
      'active_tunnels' => $this->getTunnelCount(),
      'system_health' => $this->calculateSystemHealth(),
    ];
  }

  /**
   * Get services status.
   */
  protected function getServicesStatus() {
    // Check actual running services
    $services = [
      [
        'name' => 'Next.js App',
        'type' => 'Frontend',
        'status' => $this->checkServiceStatus('localhost', 3000),
        'domain' => 'app.headysystems.com',
        'port' => 3000,
      ],
      [
        'name' => 'Drupal CMS',
        'type' => 'CMS',
        'status' => $this->checkServiceStatus('localhost', 8081),
        'domain' => 'admin.headysystems.com',
        'port' => 8081,
      ],
      [
        'name' => 'API Gateway',
        'type' => 'API',
        'status' => $this->checkServiceStatus('localhost', 8082),
        'domain' => 'api.headysystems.com',
        'port' => 8082,
      ],
      [
        'name' => 'Database',
        'type' => 'PostgreSQL',
        'status' => $this->checkServiceStatus('localhost', 5432),
        'domain' => 'internal',
        'port' => 5432,
      ],
    ];
    
    return $services;
  }

  /**
   * Check if a service is running.
   */
  protected function checkServiceStatus($host, $port) {
    $timeout = 1;
    $fp = @fsockopen($host, $port, $errno, $errstr, $timeout);
    
    if ($fp) {
      fclose($fp);
      return 'online';
    }
    
    return 'offline';
  }

  /**
   * Get service count.
   */
  protected function getServiceCount() {
    return count($this->getServicesStatus());
  }

  /**
   * Get domain count.
   */
  protected function getDomainCount() {
    // Query your domain database or configuration
    return 7;
  }

  /**
   * Get tunnel count.
   */
  protected function getTunnelCount() {
    // Check active Cloudflare tunnels
    return 3;
  }

  /**
   * Calculate system health.
   */
  protected function calculateSystemHealth() {
    $services = $this->getServicesStatus();
    $online = 0;
    
    foreach ($services as $service) {
      if ($service['status'] === 'online') {
        $online++;
      }
    }
    
    return round(($online / count($services)) * 100);
  }

  /**
   * Get domains list.
   */
  protected function getDomainsList() {
    return [
      ['domain' => 'headysystems.com', 'status' => 'active', 'type' => 'main'],
      ['domain' => 'app.headysystems.com', 'status' => 'active', 'type' => 'subdomain'],
      ['domain' => 'admin.headysystems.com', 'status' => 'active', 'type' => 'subdomain'],
      ['domain' => 'api.headysystems.com', 'status' => 'active', 'type' => 'subdomain'],
      ['domain' => 'headyme.com', 'status' => 'active', 'type' => 'main'],
      ['domain' => 'headyconnection.org', 'status' => 'active', 'type' => 'main'],
      ['domain' => 'headymcp.com', 'status' => 'active', 'type' => 'main'],
    ];
  }

  /**
   * Get tunnels status.
   */
  protected function getTunnelsStatus() {
    return [
      ['name' => 'Heady Main Tunnel', 'status' => 'active', 'domain' => 'app.headysystems.com'],
      ['name' => 'Heady Admin Tunnel', 'status' => 'active', 'domain' => 'admin.headysystems.com'],
      ['name' => 'Heady API Tunnel', 'status' => 'inactive', 'domain' => 'api.headysystems.com'],
    ];
  }

}
