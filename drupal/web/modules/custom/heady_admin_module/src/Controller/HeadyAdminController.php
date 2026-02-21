<?php

namespace Drupal\heady_admin_module\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Heady Admin functionality.
 */
class HeadyAdminController extends ControllerBase {

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
    return [
      '#theme' => 'heady_admin_dashboard',
      '#attached' => [
        'library' => ['heady_admin_module/heady-admin-dashboard'],
      ],
    ];
  }

  /**
   * Domain management page.
   */
  public function domains() {
    $query = $this->database->select('heady_domains', 'hd')
      ->extend('Drupal\Core\Database\Query\PagerSelectExtender');
    $query->fields('hd');
    $results = $query->limit(50)->execute()->fetchAll();

    return [
      '#theme' => 'heady_domain_management',
      '#domains' => $results,
      '#attached' => [
        'library' => ['heady_admin_module/heady-domain-management'],
      ],
    ];
  }

  /**
   * Domain builder page.
   */
  public function domainBuilder() {
    return [
      '#theme' => 'heady_domain_builder',
      '#attached' => [
        'library' => ['heady_admin_module/heady-domain-builder'],
      ],
    ];
  }

  /**
   * Task management page.
   */
  public function tasks() {
    $query = $this->database->select('heady_tasks', 'ht')
      ->extend('Drupal\Core\Database\Query\PagerSelectExtender');
    $query->fields('ht');
    $query->condition('ht.completed', 0);
    $query->orderBy('ht.created', 'DESC');
    $results = $query->limit(50)->execute()->fetchAll();

    return [
      '#theme' => 'heady_task_management',
      '#tasks' => $results,
      '#attached' => [
        'library' => ['heady_admin_module/heady-task-management'],
      ],
    ];
  }

  /**
   * System monitor page.
   */
  public function systemMonitor() {
    $system_info = [
      'php_version' => PHP_VERSION,
      'drupal_version' => \Drupal::VERSION,
      'database' => $this->database->version(),
      'memory_usage' => memory_get_usage(TRUE),
      'memory_limit' => ini_get('memory_limit'),
    ];

    return [
      '#theme' => 'heady_system_monitor',
      '#system_info' => $system_info,
      '#attached' => [
        'library' => ['heady_admin_module/heady-system-monitor'],
      ],
    ];
  }

}
