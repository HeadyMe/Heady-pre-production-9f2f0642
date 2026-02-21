<?php
/**
 * @file
 * Heady Systems Control Module - Complete System Management
 */

namespace Drupal\heady_control\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Heady Systems complete control.
 */
class HeadyControlController extends ControllerBase implements ContainerInjectionInterface {

  /**
   * The database connection.
   */
  protected $database;

  /**
   * Constructs a HeadyControlController object.
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
   * Main dashboard with complete system control.
   */
  public function dashboard() {
    $services = $this->getServiceStatus();
    $domains = $this->getDomainStatus();
    $warp_stats = $this->getWARPStats();
    $buddy_devices = $this->getBuddyDevices();
    
    return [
      '#theme' => 'heady_control_dashboard',
      '#services' => $services,
      '#domains' => $domains,
      '#warp_stats' => $warp_stats,
      '#buddy_devices' => $buddy_devices,
      '#attached' => [
        'library' => [
          'heady_control/dashboard',
        ],
      ],
    ];
  }

  /**
   * Get comprehensive service status.
   */
  protected function getServiceStatus() {
    $services = [
      'HeadyManager' => [
        'url' => 'http://localhost:3300',
        'type' => 'Core Service',
        'description' => 'Main system orchestrator'
      ],
      'HeadyBuddy' => [
        'url' => 'http://localhost:3400',
        'type' => 'AI Companion',
        'description' => 'Cross-device sync service'
      ],
      'Pipeline' => [
        'url' => 'http://localhost:3500',
        'type' => 'Deployment',
        'description' => 'HCFullPipeline system'
      ],
      'API Gateway' => [
        'url' => 'http://localhost:3600',
        'type' => 'API',
        'description' => 'Central API endpoint'
      ],
      'Database' => [
        'url' => 'postgresql://localhost:5432',
        'type' => 'Database',
        'description' => 'PostgreSQL cluster'
      ],
      'Redis Cache' => [
        'url' => 'redis://localhost:6379',
        'type' => 'Cache',
        'description' => 'Redis caching layer'
      ],
      'Nginx Proxy' => [
        'url' => 'http://localhost:8082',
        'type' => 'Proxy',
        'description' => 'Reverse proxy server'
      ],
      'Drupal CMS' => [
        'url' => 'http://localhost:8081',
        'type' => 'CMS',
        'description' => 'Content management system'
      ]
    ];

    $status = [];
    foreach ($services as $name => $service) {
      $status[$name] = $this->checkServiceHealth($service);
    }
    
    return $status;
  }

  /**
   * Check individual service health.
   */
  protected function checkServiceHealth($service) {
    $result = [
      'name' => $service['description'],
      'type' => $service['type'],
      'url' => $service['url'],
      'online' => false,
      'response_time' => null,
      'last_check' => time(),
      'uptime' => 0,
      'memory_usage' => null,
      'cpu_usage' => null
    ];

    try {
      $start_time = microtime(true);
      
      if (strpos($service['url'], 'postgresql') !== false) {
        // Check PostgreSQL
        $connection = \Drupal::database();
        $result['online'] = $connection->ping();
        $result['response_time'] = round((microtime(true) - $start_time) * 1000, 2);
      } elseif (strpos($service['url'], 'redis') !== false) {
        // Check Redis
        if (class_exists('\Redis')) {
          $redis = new \Redis();
          $result['online'] = $redis->connect('localhost', 6379, 1);
          $result['response_time'] = round((microtime(true) - $start_time) * 1000, 2);
        }
      } else {
        // Check HTTP service
        $client = \Drupal::httpClient();
        $response = $client->get($service['url'], [
          'timeout' => 2,
          'connect_timeout' => 1
        ]);
        
        $result['online'] = $response->getStatusCode() === 200;
        $result['response_time'] = round((microtime(true) - $start_time) * 1000, 2);
        
        if ($result['online']) {
          $result['uptime'] = $this->getServiceUptime($service['url']);
        }
      }
    } catch (\Exception $e) {
      $result['error'] = $e->getMessage();
    }

    return $result;
  }

  /**
   * Get service uptime from database.
   */
  protected function getServiceUptime($service_url) {
    try {
      $query = $this->database->select('heady_service_metrics', 'hsm')
        ->fields('hsm', ['uptime_percentage'])
        ->condition('service_url', $service_url)
        ->orderBy('timestamp', 'DESC')
        ->range(0, 1);
      
      $result = $query->execute()->fetchField();
      return $result ?: 0;
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get domain status with comprehensive checks.
   */
  protected function getDomainStatus() {
    $domains = [
      'headybuddy.org' => ['type' => 'AI Companion', 'priority' => 'high'],
      'headysystems.com' => ['type' => 'Commercial', 'priority' => 'high'],
      'headyconnection.org' => ['type' => 'Nonprofit', 'priority' => 'medium'],
      'headymcp.com' => ['type' => 'MCP Server', 'priority' => 'medium'],
      'headyio.com' => ['type' => 'Developer', 'priority' => 'medium'],
      'headyme.com' => ['type' => 'Personal', 'priority' => 'low']
    ];

    $status = [];
    foreach ($domains as $domain => $info) {
      $status[$domain] = $this->checkDomainHealth($domain, $info);
    }
    
    return $status;
  }

  /**
   * Check domain health with SSL and performance metrics.
   */
  protected function checkDomainHealth($domain, $info) {
    $result = [
      'domain' => $domain,
      'type' => $info['type'],
      'priority' => $info['priority'],
      'online' => false,
      'ssl_valid' => false,
      'ssl_expires' => null,
      'response_time' => null,
      'page_load_time' => null,
      'last_check' => time(),
      'uptime_24h' => 0,
      'error_rate' => 0,
      'cdn_status' => 'unknown'
    ];

    try {
      $start_time = microtime(true);
      $client = \Drupal::httpClient();
      
      $response = $client->get("https://$domain", [
        'timeout' => 5,
        'connect_timeout' => 3,
        'allow_redirects' => true,
        'verify' => true
      ]);
      
      $result['online'] = $response->getStatusCode() === 200;
      $result['response_time'] = round((microtime(true) - $start_time) * 1000, 2);
      
      // Check SSL certificate
      if ($response->getHeader('SSL-Certificate-Info')) {
        $ssl_info = json_decode($response->getHeader('SSL-Certificate-Info')[0], true);
        $result['ssl_valid'] = $ssl_info['valid'] ?? false;
        $result['ssl_expires'] = $ssl_info['expires'] ?? null;
      }
      
      // Check CDN status
      $cf_ray = $response->getHeader('CF-RAY')[0] ?? null;
      $result['cdn_status'] = $cf_ray ? 'cloudflare' : 'none';
      
      // Get performance metrics from database
      $result['uptime_24h'] = $this->getDomainUptime($domain, 86400);
      $result['error_rate'] = $this->getDomainErrorRate($domain, 86400);
      
    } catch (\Exception $e) {
      $result['error'] = $e->getMessage();
    }

    return $result;
  }

  /**
   * Get domain uptime from metrics.
   */
  protected function getDomainUptime($domain, $period) {
    try {
      $query = $this->database->select('heady_domain_metrics', 'hdm')
        ->fields('hdm', ['uptime_percentage'])
        ->condition('domain', $domain)
        ->condition('timestamp', time() - $period, '>=')
        ->orderBy('timestamp', 'DESC')
        ->range(0, 1);
      
      $result = $query->execute()->fetchField();
      return $result ?: 0;
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get domain error rate.
   */
  protected function getDomainErrorRate($domain, $period) {
    try {
      $query = $this->database->select('heady_domain_metrics', 'hdm')
        ->fields('hdm', ['error_rate'])
        ->condition('domain', $domain)
        ->condition('timestamp', time() - $period, '>=')
        ->orderBy('timestamp', 'DESC')
        ->range(0, 1);
      
      $result = $query->execute()->fetchField();
      return $result ?: 0;
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get WARP network statistics.
   */
  protected function getWARPStats() {
    return [
      'enabled' => true,
      'connected_devices' => $this->getWARPDeviceCount(),
      'total_bandwidth' => $this->getWARPBandwidth(),
      'latency_reduction' => $this->getWARPLatencyImprovement(),
      'security_events' => $this->getWARPSecurityEvents(),
      'tunnel_status' => $this->checkWARPTunnelStatus()
    ];
  }

  /**
   * Get WARP device count.
   */
  protected function getWARPDeviceCount() {
    try {
      $query = $this->database->select('heady_warp_devices', 'hwd')
        ->condition('status', 'connected')
        ->condition('last_seen', time() - 300, '>=');
      
      return $query->countQuery()->execute()->fetchField();
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get WARP bandwidth usage.
   */
  protected function getWARPBandwidth() {
    try {
      $query = $this->database->select('heady_warp_metrics', 'hwm')
        ->fields('hwm', ['bandwidth_mbps'])
        ->condition('timestamp', time() - 3600, '>=')
        ->orderBy('timestamp', 'DESC')
        ->range(0, 1);
      
      $result = $query->execute()->fetchField();
      return $result ?: 0;
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get WARP latency improvement.
   */
  protected function getWARPLatencyImprovement() {
    try {
      $query = $this->database->select('heady_warp_metrics', 'hwm')
        ->fields('hwm', ['latency_improvement_percent'])
        ->condition('timestamp', time() - 3600, '>=')
        ->orderBy('timestamp', 'DESC')
        ->range(0, 1);
      
      $result = $query->execute()->fetchField();
      return $result ?: 0;
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Get WARP security events.
   */
  protected function getWARPSecurityEvents() {
    try {
      $query = $this->database->select('heady_warp_events', 'hwe')
        ->condition('event_type', 'security_threat')
        ->condition('timestamp', time() - 86400, '>=');
      
      return $query->countQuery()->execute()->fetchField();
    } catch (\Exception $e) {
      return 0;
    }
  }

  /**
   * Check WARP tunnel status.
   */
  protected function checkWARPTunnelStatus() {
    try {
      $client = \Drupal::httpClient();
      $response = $client->get('https://api-internal.headysystems.com/api/warp/status', [
        'timeout' => 2
      ]);
      
      return $response->getStatusCode() === 200 ? 'active' : 'inactive';
    } catch (\Exception $e) {
      return 'error';
    }
  }

  /**
   * Get HeadyBuddy connected devices.
   */
  protected function getBuddyDevices() {
    try {
      $query = $this->database->select('heady_buddy_devices', 'hbd')
        ->fields('hbd')
        ->condition('last_seen', time() - 3600, '>=')
        ->orderBy('last_seen', 'DESC')
        ->range(0, 50);
      
      $results = $query->execute()->fetchAll();
      
      $devices = [];
      foreach ($results as $device) {
        $devices[] = [
          'id' => $device->device_id,
          'name' => $device->device_name,
          'type' => $device->device_type,
          'platform' => $device->platform,
          'warp_enabled' => (bool) $device->warp_enabled,
          'last_seen' => $device->last_seen,
          'status' => $device->status,
          'capabilities' => json_decode($device->capabilities, true) ?: []
        ];
      }
      
      return $devices;
    } catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Trigger deployment for a domain.
   */
  public function triggerDeploy($domain) {
    try {
      // Log deployment trigger
      $this->database->insert('heady_deployment_log')
        ->fields([
          'domain' => $domain,
          'triggered_by' => \Drupal::currentUser()->id(),
          'triggered_at' => time(),
          'status' => 'triggered'
        ])
        ->execute();

      // Trigger GitHub deployment webhook
      $repos = [
        'headybuddy.org' => 'HeadySystems/headybuddy-web',
        'headysystems.com' => 'HeadySystems/headysystems-web',
        'headyconnection.org' => 'HeadySystems/headyconnection-web',
        'headymcp.com' => 'HeadySystems/headymcp-web',
        'headyio.com' => 'HeadySystems/headyio-web',
        'headyme.com' => 'HeadySystems/headyme-web'
      ];

      $repo = $repos[$domain] ?? null;
      if (!$repo) {
        return new JsonResponse(['error' => 'Unknown domain'], 400);
      }

      $github_token = \Drupal::config('heady_control.settings')->get('github_token');
      if (!$github_token) {
        return new JsonResponse(['error' => 'GitHub token not configured'], 500);
      }

      $client = \Drupal::httpClient();
      $response = $client->post("https://api.github.com/repos/$repo/dispatches", [
        'headers' => [
          'Authorization' => "Bearer $github_token",
          'Accept' => 'application/vnd.github.v3+json',
          'Content-Type' => 'application/json'
        ],
        'json' => [
          'event_type' => 'deploy',
          'client_payload' => [
            'domain' => $domain,
            'triggered_by' => 'drupal_admin',
            'timestamp' => time()
          ]
        ]
      ]);

      return new JsonResponse([
        'success' => true,
        'domain' => $domain,
        'message' => 'Deployment triggered successfully',
        'deployment_id' => json_decode($response->getBody(), true)['id'] ?? null
      ]);

    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Restart a service.
   */
  public function restartService($service_name) {
    try {
      // Log restart action
      $this->database->insert('heady_service_actions')
        ->fields([
          'service_name' => $service_name,
          'action' => 'restart',
          'triggered_by' => \Drupal::currentUser()->id(),
          'triggered_at' => time()
        ])
        ->execute();

      // Send restart command to service
      $services = [
        'HeadyManager' => 'http://localhost:3300',
        'HeadyBuddy' => 'http://localhost:3400',
        'Pipeline' => 'http://localhost:3500'
      ];

      $service_url = $services[$service_name] ?? null;
      if (!$service_url) {
        return new JsonResponse(['error' => 'Unknown service'], 400);
      }

      $client = \Drupal::httpClient();
      $response = $client->post("$service_url/api/restart", [
        'timeout' => 5
      ]);

      return new JsonResponse([
        'success' => true,
        'service' => $service_name,
        'message' => 'Restart command sent'
      ]);

    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Get system logs.
   */
  public function getSystemLogs() {
    try {
      $query = $this->database->select('heady_system_logs', 'hsl')
        ->fields('hsl')
        ->orderBy('timestamp', 'DESC')
        ->range(0, 100);
      
      $results = $query->execute()->fetchAll();
      
      $logs = [];
      foreach ($results as $log) {
        $logs[] = [
          'id' => $log->id,
          'level' => $log->level,
          'service' => $log->service,
          'message' => $log->message,
          'timestamp' => $log->timestamp,
          'context' => json_decode($log->context, true) ?: []
        ];
      }
      
      return new JsonResponse(['logs' => $logs]);

    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Force HeadyBuddy sync across all devices.
   */
  public function forceBuddySync() {
    try {
      // Trigger sync to all connected devices
      $devices = $this->getBuddyDevices();
      $sync_count = 0;

      foreach ($devices as $device) {
        if ($device['status'] === 'connected') {
          // Send sync command to device
          $this->sendBuddySyncCommand($device['id']);
          $sync_count++;
        }
      }

      // Log sync action
      $this->database->insert('heady_buddy_sync_log')
        ->fields([
          'triggered_by' => \Drupal::currentUser()->id(),
          'devices_synced' => $sync_count,
          'triggered_at' => time()
        ])
        ->execute();

      return new JsonResponse([
        'success' => true,
        'devices_synced' => $sync_count,
        'message' => "Sync triggered for $sync_count devices"
      ]);

    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Send sync command to specific device.
   */
  protected function sendBuddySyncCommand($device_id) {
    try {
      $client = \Drupal::httpClient();
      $response = $client->post('http://localhost:3400/api/sync/device', [
        'json' => ['device_id' => $device_id],
        'timeout' => 3
      ]);
      
      return $response->getStatusCode() === 200;
    } catch (\Exception $e) {
      return false;
    }
  }

}
