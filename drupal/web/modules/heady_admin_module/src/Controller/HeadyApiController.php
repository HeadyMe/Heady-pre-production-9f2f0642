<?php

namespace Drupal\heady_admin_module\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * API Controller for Heady Admin functionality.
 */
class HeadyApiController extends ControllerBase {

  /**
   * The database connection.
   *
   * @var \Drupal\Core\Database\Connection
   */
  protected $database;

  /**
   * Constructs a HeadyApiController object.
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
   * Sync tasks via HeadyBuddy API.
   */
  public function syncTasks(Request $request) {
    $data = json_decode($request->getContent(), TRUE);
    
    if (!$data) {
      return new JsonResponse(['error' => 'Invalid JSON'], 400);
    }

    try {
      // Store tasks in database
      if (isset($data['tasks']) && is_array($data['tasks'])) {
        foreach ($data['tasks'] as $task) {
          $this->database->merge('heady_tasks')
            ->key(['id' => $task['id'] ?? NULL])
            ->fields([
              'title' => $task['title'] ?? '',
              'description' => $task['description'] ?? '',
              'completed' => $task['completed'] ?? 0,
              'created' => $task['created'] ?? date('Y-m-d H:i:s'),
              'updated' => date('Y-m-d H:i:s'),
            ])
            ->execute();
        }
      }

      return new JsonResponse([
        'status' => 'success',
        'message' => 'Tasks synced successfully',
        'timestamp' => date('Y-m-d H:i:s')
      ]);

    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => 'Database error: ' . $e->getMessage()
      ], 500);
    }
  }

  /**
   * Start headless browser.
   */
  public function startBrowser(Request $request) {
    try {
      // Here you would integrate with your headless browser service
      // For now, we'll simulate starting a browser
      
      $browser_url = 'http://localhost:9222'; // Chrome DevTools Protocol
      
      return new JsonResponse([
        'status' => 'success',
        'message' => 'Headless browser started',
        'url' => $browser_url,
        'session_id' => uniqid('browser_', TRUE)
      ]);

    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => 'Failed to start browser: ' . $e->getMessage()
      ], 500);
    }
  }

}
