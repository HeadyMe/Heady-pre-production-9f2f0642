<?php

namespace Drupal\heady_control\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use GuzzleHttp\ClientInterface;
use Drupal\Core\Config\ConfigFactoryInterface;

/**
 * Controller for Heady Dashboard.
 */
class HeadyDashboard extends ControllerBase implements ContainerInjectionInterface {

  protected $httpClient;
  protected $configFactory;

  public function __construct(ClientInterface $http_client, ConfigFactoryInterface $config_factory) {
    $this->httpClient = $http_client;
    $this->configFactory = $config_factory;
  }

  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('http_client'),
      $container->get('config.factory')
    );
  }

  /**
   * Main dashboard overview.
   */
  public function overview() {
    $services = $this->getServiceStatus();
    $domains = $this->getDomainStatus();
    $pipelines = $this->getPipelineStatus();
    
    return [
      '#theme' => 'heady_dashboard',
      '#services' => $services,
      '#domains' => $domains,
      '#pipelines' => $pipelines,
      '#attached' => [
        'library' => ['heady_control/dashboard'],
        'drupalSettings' => [
          'heady' => [
            'apiBase' => $this->configFactory->get('heady_control.settings')->get('api_base') ?: 'https://api.headysystems.com',
            'refreshInterval' => $this->configFactory->get('heady_control.settings')->get('refresh_interval') ?: 30000,
          ]
        ]
      ]
    ];
  }

  /**
   * Get service status from API.
   */
  private function getServiceStatus() {
    $api_base = $this->configFactory->get('heady_control.settings')->get('api_base') ?: 'https://api.headysystems.com';
    $services = [
      'HeadyManager' => "$api_base/api/health",
      'HeadyBuddy' => "$api_base/api/buddy/health",
      'Pipeline' => "$api_base/api/pipeline/status",
      'WARP' => "$api_base/api/warp/status"
    ];

    $status = [];
    foreach ($services as $name => $url) {
      try {
        $start_time = microtime(true);
        $response = $this->httpClient->get($url, [
          'timeout' => 5,
          'headers' => [
            'User-Agent' => 'HeadyControl/1.0'
          ]
        ]);
        $response_time = round((microtime(true) - $start_time) * 1000);
        
        $data = json_decode($response->getBody(), true);
        $status[$name] = [
          'online' => true,
          'response_time' => $response_time,
          'version' => $data['version'] ?? 'N/A',
          'status' => $data['status'] ?? 'running'
        ];
      } catch (\Exception $e) {
        $status[$name] = [
          'online' => false,
          'error' => $e->getMessage(),
          'response_time' => 'N/A'
        ];
      }
    }
    return $status;
  }

  /**
   * Get domain status.
   */
  private function getDomainStatus() {
    $domains = [
      'headybuddy.org',
      'headysystems.com',
      'headyconnection.org',
      'headymcp.com',
      'headyio.com',
      'headyme.com'
    ];

    $status = [];
    foreach ($domains as $domain) {
      try {
        $start_time = microtime(true);
        $response = $this->httpClient->get("https://$domain", [
          'timeout' => 5,
          'allow_redirects' => true,
          'headers' => [
            'User-Agent' => 'HeadyControl/1.0'
          ]
        ]);
        $response_time = round((microtime(true) - $start_time) * 1000);
        
        $status[$domain] = [
          'online' => $response->getStatusCode() === 200,
          'ssl' => true,
          'response_time' => $response_time,
          'status_code' => $response->getStatusCode()
        ];
      } catch (\Exception $e) {
        $status[$domain] = [
          'online' => false,
          'error' => $e->getMessage(),
          'response_time' => 'N/A'
        ];
      }
    }
    return $status;
  }

  /**
   * Get pipeline status.
   */
  private function getPipelineStatus() {
    try {
      $api_base = $this->configFactory->get('heady_control.settings')->get('api_base') ?: 'https://api.headysystems.com';
      $response = $this->httpClient->get("$api_base/api/pipeline/status", [
        'timeout' => 5,
        'headers' => [
          'User-Agent' => 'HeadyControl/1.0'
        ]
      ]);
      return json_decode($response->getBody(), true);
    } catch (\Exception $e) {
      return [
        'error' => $e->getMessage(),
        'status' => 'offline',
        'stages' => []
      ];
    }
  }

  /**
   * Trigger deployment for a domain.
   */
  public function triggerDeploy($domain, Request $request) {
    $github_token = $this->configFactory->get('heady_control.settings')->get('github_token');
    if (!$github_token) {
      return new JsonResponse(['error' => 'GitHub token not configured'], 500);
    }

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

    try {
      $client = $this->httpClient;
      $response = $client->post("https://api.github.com/repos/$repo/dispatches", [
        'headers' => [
          'Authorization' => "Bearer $github_token",
          'Accept' => 'application/vnd.github.v3+json',
          'User-Agent' => 'HeadyControl/1.0'
        ],
        'json' => [
          'event_type' => 'deploy',
          'client_payload' => [
            'domain' => $domain,
            'triggered_by' => 'drupal_admin',
            'timestamp' => time(),
            'source' => 'heady_control'
          ]
        ]
      ]);

      return new JsonResponse([
        'success' => true,
        'domain' => $domain,
        'message' => 'Deployment triggered successfully',
        'repo' => $repo
      ]);
    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Run full system sync.
   */
  public function runFullSync(Request $request) {
    try {
      $api_base = $this->configFactory->get('heady_control.settings')->get('api_base') ?: 'https://api.headysystems.com';
      
      // Trigger sync on multiple endpoints
      $endpoints = [
        '/api/sync/full',
        '/api/buddy/sync',
        '/api/pipeline/sync'
      ];

      $results = [];
      foreach ($endpoints as $endpoint) {
        try {
          $response = $this->httpClient->post("$api_base$endpoint", [
            'timeout' => 10,
            'headers' => [
              'User-Agent' => 'HeadyControl/1.0'
            ]
          ]);
          $results[$endpoint] = [
            'success' => true,
            'status' => $response->getStatusCode()
          ];
        } catch (\Exception $e) {
          $results[$endpoint] = [
            'success' => false,
            'error' => $e->getMessage()
          ];
        }
      }

      return new JsonResponse([
        'success' => true,
        'message' => 'Full sync initiated',
        'results' => $results
      ]);
    } catch (\Exception $e) {
      return new JsonResponse(['error' => $e->getMessage()], 500);
    }
  }

  /**
   * Get WARP status.
   */
  public function getWARPStatus() {
    try {
      $api_base = $this->configFactory->get('heady_control.settings')->get('api_base') ?: 'https://api.headysystems.com';
      $response = $this->httpClient->get("$api_base/api/warp/status", [
        'timeout' => 5,
        'headers' => [
          'User-Agent' => 'HeadyControl/1.0'
        ]
      ]);
      return new JsonResponse(json_decode($response->getBody(), true));
    } catch (\Exception $e) {
      return new JsonResponse([
        'enabled' => false,
        'error' => $e->getMessage(),
        'connections' => 0
      ]);
    }
  }

}
