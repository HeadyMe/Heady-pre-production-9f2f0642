<?php

namespace Drupal\heady_admin\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Comprehensive controller for Heady Systems admin interface.
 *
 * Handles dashboard, services, HCFP, HeadyLens, customization,
 * access control, and settings — all with permission checks.
 */
class HeadyAdminController extends ControllerBase implements ContainerInjectionInterface
{

  protected $database;
  protected $managerUrl = 'https://manager.headysystems.com';

  public function __construct(Connection $database)
  {
    $this->database = $database;
  }

  public static function create(ContainerInterface $container)
  {
    return new static ($container->get('database'));
  }

  /**
   * Main dashboard — overview of entire ecosystem.
   */
  public function dashboard()
  {
    return [
      '#theme' => 'heady_admin_dashboard',
      '#stats' => $this->getSystemStats(),
      '#services' => $this->getServicesStatus(),
      '#ecosystem' => $this->getEcosystemServices(),
      '#current_user' => $this->currentUser()->getDisplayName(),
      '#user_roles' => $this->currentUser()->getRoles(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * Services management — start/stop/restart/configure.
   */
  public function services()
  {
    return [
      '#theme' => 'heady_admin_services',
      '#services' => $this->getServicesStatus(),
      '#ecosystem' => $this->getEcosystemServices(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * HCFP Policy Management.
   */
  public function hcfp()
  {
    return [
      '#theme' => 'heady_admin_hcfp',
      '#hcfp' => $this->getHcfpStatus(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * HeadyLens real-time monitoring.
   */
  public function headylens()
  {
    return [
      '#theme' => 'heady_admin_headylens',
      '#websocket_url' => 'wss://manager.headysystems.com:3301/realtime',
      '#api_url' => $this->managerUrl,
      '#attached' => ['library' => ['heady_admin/headylens']],
    ];
  }

  /**
   * System customization panel.
   */
  public function customize()
  {
    return [
      '#theme' => 'heady_admin_customize',
      '#current_theme' => $this->getThemeSettings(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * User access control.
   */
  public function accessControl()
  {
    return [
      '#theme' => 'heady_admin_access',
      '#users' => $this->getUsers(),
      '#roles' => $this->getRolesList(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * System settings.
   */
  public function settings()
  {
    return [
      '#theme' => 'heady_admin_settings',
      '#config' => $this->getSystemConfig(),
      '#attached' => ['library' => ['heady_admin/admin_dashboard']],
    ];
  }

  /**
   * API: System status endpoint.
   */
  public function apiStatus(Request $request)
  {
    return new JsonResponse([
      'stats' => $this->getSystemStats(),
      'services' => $this->getServicesStatus(),
      'ecosystem' => $this->getEcosystemServices(),
      'timestamp' => time(),
    ]);
  }

  /**
   * API: HCFP endpoint.
   */
  public function apiHcfp(Request $request)
  {
    return new JsonResponse($this->getHcfpStatus());
  }

  // ── Data Methods ──────────────────────────────────────

  protected function getSystemStats()
  {
    return [
      'total_services' => 6,
      'active_domains' => 6,
      'active_tunnels' => 3,
      'system_health' => $this->calculateSystemHealth(),
      'hcfp_mode' => 'PRODUCTION_DOMAINS_ONLY',
      'violations' => 0,
      'uptime_hours' => round((time() - strtotime('2026-02-20 13:00:00')) / 3600, 1),
    ];
  }

  protected function getEcosystemServices()
  {
    return [
      ['key' => 'headysystems', 'name' => 'HeadySystems', 'url' => 'https://headysystems.com', 'icon' => '🏗️', 'geometry' => "Metatron's Cube", 'color' => '#7c3aed'],
      ['key' => 'headyme', 'name' => 'HeadyMe', 'url' => 'https://headyme.com', 'icon' => '🧠', 'geometry' => 'Flower of Life', 'color' => '#d97706'],
      ['key' => 'headyconnection', 'name' => 'HeadyConnection', 'url' => 'https://headyconnection.org', 'icon' => '🔗', 'geometry' => 'Sri Yantra', 'color' => '#059669'],
      ['key' => 'headyio', 'name' => 'HeadyIO', 'url' => 'https://headyio.com', 'icon' => '⚡', 'geometry' => 'Torus', 'color' => '#2563eb'],
      ['key' => 'headybuddy', 'name' => 'HeadyBuddy', 'url' => 'https://headybuddy.org', 'icon' => '🤖', 'geometry' => 'Seed of Life', 'color' => '#10b981'],
      ['key' => 'headymcp', 'name' => 'HeadyMCP', 'url' => 'https://headymcp.com', 'icon' => '🔌', 'geometry' => 'Vesica Piscis', 'color' => '#6366f1'],
    ];
  }

  protected function getServicesStatus()
  {
    return [
      ['name' => 'Heady Manager', 'type' => 'Core', 'status' => 'online', 'domain' => 'manager.headysystems.com', 'port' => 3300],
      ['name' => 'Heady Brain', 'type' => 'AI', 'status' => 'online', 'domain' => 'manager.headysystems.com', 'port' => 3300],
      ['name' => 'HeadySoul', 'type' => 'Decision', 'status' => 'online', 'domain' => 'internal', 'port' => 0],
      ['name' => 'HeadyBattle Engine', 'type' => 'Security', 'status' => 'online', 'domain' => 'internal', 'port' => 0],
      ['name' => 'Realtime Monitor', 'type' => 'Monitoring', 'status' => 'online', 'domain' => 'manager.headysystems.com', 'port' => 3301],
      ['name' => 'Drupal CMS', 'type' => 'CMS', 'status' => $this->checkServiceStatus('localhost', 8081), 'domain' => 'admin.headysystems.com', 'port' => 8081],
    ];
  }

  protected function getHcfpStatus()
  {
    return [
      'mode' => 'PRODUCTION_DOMAINS_ONLY',
      'auto_success' => TRUE,
      'headybattle_mode' => 'enforced',
      'headybattle_sessions' => 0,
      'violations' => ['headysystems.com' => 0, 'internal_refs' => 0, 'non_custom_domains' => 0],
      'policies' => [
        ['name' => 'zero_headysystems.com', 'status' => 'enforced', 'type' => 'domain'],
        ['name' => 'production_domains_only', 'status' => 'enforced', 'type' => 'environment'],
        ['name' => 'headybattle_interceptor', 'status' => 'active', 'type' => 'security'],
      ],
      'communication_chain' => [
        'channel_to_promoter' => '120ms',
        'promoter_to_brain' => '80ms',
        'brain_to_headysoul' => '450ms',
        'headysoul_to_approval' => '24h max',
      ],
    ];
  }

  protected function getThemeSettings()
  {
    return [
      'primary_color' => '#10b981',
      'secondary_color' => '#7c3aed',
      'geometry_pattern' => 'cosmic_rainbow',
      'glass_opacity' => 0.95,
      'animation_speed' => 'normal',
      'buddy_enabled' => TRUE,
      'buddy_position' => 'bottom-right',
      'notifications_enabled' => TRUE,
    ];
  }

  protected function getUsers()
  {
    return [
      ['uid' => 1, 'name' => 'headyme', 'email' => 'admin@headysystems.com', 'roles' => ['administrator'], 'status' => 'active', 'last_login' => 'Now'],
    ];
  }

  protected function getRolesList()
  {
    return [
      ['id' => 'administrator', 'label' => 'Administrator', 'permissions' => 'all', 'users' => 1],
      ['id' => 'editor', 'label' => 'Content Editor', 'permissions' => 'view dashboard, manage services', 'users' => 0],
      ['id' => 'viewer', 'label' => 'Viewer', 'permissions' => 'view dashboard', 'users' => 0],
      ['id' => 'operator', 'label' => 'System Operator', 'permissions' => 'manage services, access headylens', 'users' => 0],
    ];
  }

  protected function getSystemConfig()
  {
    return [
      'manager_url' => $this->managerUrl,
      'websocket_port' => 3301,
      'colab_url' => '',
      'domains' => ['headysystems.com', 'headyme.com', 'headyconnection.org', 'headyio.com', 'headybuddy.org', 'headymcp.com'],
    ];
  }

  protected function checkServiceStatus($host, $port)
  {
    $fp = @fsockopen($host, $port, $errno, $errstr, 1);
    if ($fp) {
      fclose($fp);
      return 'online';
    }
    return 'offline';
  }

  protected function calculateSystemHealth()
  {
    $services = $this->getServicesStatus();
    $online = count(array_filter($services, fn($s) => $s['status'] === 'online'));
    return round(($online / count($services)) * 100);
  }
}