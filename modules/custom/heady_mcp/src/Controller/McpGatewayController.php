<?php

namespace Drupal\heady_mcp\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\heady_mcp\Service\McpToolManager;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\heady_mcp\Service\UrlValidator;

/**
 * MCP Gateway Controller - Handles JSON-RPC requests from AI agents
 */
class McpGatewayController extends ControllerBase {

  protected $mcpToolManager;
  protected $urlValidator;

  public function __construct(
    McpToolManager $mcpToolManager,
    UrlValidator $urlValidator
  ) {
    $this->mcpToolManager = $mcpToolManager;
    $this->urlValidator = $urlValidator;
  }

  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('heady_mcp.tool_manager'),
      $container->get('heady_mcp.url_validator')
    );
  }

  /**
   * Handles JSON-RPC requests from an MCP client
   */
  public function handle(Request $request) {
    $content = json_decode($request->getContent(), TRUE);

    // Basic JSON-RPC validation
    if (!isset($content['method'])) {
      return new JsonResponse([
        'jsonrpc' => '2.0',
        'error' => ['code' => -32600, 'message' => 'Invalid Request'],
        'id' => $content['id'] ?? null,
      ], 400);
    }

    // Log incoming request
    \Drupal::logger('heady_mcp')->notice('MCP Request: @method from @ip', [
      '@method' => $content['method'],
      '@ip' => $request->getClientIp(),
    ]);

    try {
      switch ($content['method']) {
        case 'tools/list':
          return $this->toolsList($content);
        
        case 'tools/call':
          return $this->toolsCall($content);
        
        default:
          return new JsonResponse([
            'jsonrpc' => '2.0',
            'error' => ['code' => -32601, 'message' => 'Method not found'],
            'id' => $content['id'] ?? null,
          ], 404);
      }
    } catch (\Exception $e) {
      \Drupal::logger('heady_mcp')->error('MCP Error: @message', [
        '@message' => $e->getMessage(),
      ]);
      
      return new JsonResponse([
        'jsonrpc' => '2.0',
        'error' => ['code' => -32603, 'message' => $e->getMessage()],
        'id' => $content['id'] ?? null,
      ], 500);
    }
  }

  /**
   * List available tools
   */
  protected function toolsList(array $content): JsonResponse {
    $tools = $this->mcpToolManager->getTools();
    
    return new JsonResponse([
      'jsonrpc' => '2.0',
      'result' => [
        'tools' => $tools,
        'server_info' => [
          'name' => 'Heady MCP Engine',
          'version' => '1.0.0',
          'description' => 'Drupal 11 MCP server with vector search and priority execution',
        ],
      ],
      'id' => $content['id'] ?? null,
    ]);
  }

  /**
   * Execute a tool
   */
  protected function toolsCall(array $content): JsonResponse {
    $params = $content['params'] ?? [];
    
    if (!isset($params['name'])) {
      return new JsonResponse([
        'jsonrpc' => '2.0',
        'error' => ['code' => -32602, 'message' => 'Tool name required'],
        'id' => $content['id'] ?? null,
      ], 400);
    }

    // Validate URLs in arguments if present
    if (isset($params['arguments']['content'])) {
      $validation = $this->urlValidator->validate($params['arguments']['content']);
      if (!$validation['valid']) {
        return new JsonResponse([
          'jsonrpc' => '2.0',
          'error' => [
            'code' => -32001, 
            'message' => 'URL validation failed',
            'data' => $validation
          ],
          'id' => $content['id'] ?? null,
        ], 400);
      }
    }

    $result = $this->mcpToolManager->executeTool(
      $params['name'], 
      $params['arguments'] ?? []
    );

    return new JsonResponse([
      'jsonrpc' => '2.0',
      'result' => [
        'content' => [
          [
            'type' => 'text',
            'text' => json_encode($result, JSON_PRETTY_PRINT)
          ]
        ],
        'isError' => isset($result['status']) && $result['status'] === 'error',
      ],
      'id' => $content['id'] ?? null,
    ]);
  }
}
