<?php

namespace Drupal\heady_grant_lab\Controller;

use Drupal\Core\Controller\ControllerBase;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

/**
 * Controller for Grant Lab.
 */
class GrantLabController extends ControllerBase {

  /**
   * Fetches grants from Heady API.
   */
  public function getGrants() {
    $client = new Client();
    $url = 'https://api.heady-sys.cloud/api/grants';

    try {
      $response = $client->get($url, [
        'headers' => [
          'Authorization' => 'Bearer ' . $this->getAccessToken(),
        ],
      ]);

      $grants = json_decode($response->getBody(), TRUE);

      return [
        '#theme' => 'grant_list',
        '#grants' => $grants,
      ];
    }
    catch (RequestException $e) {
      // Handle exception.
      return [
        '#markup' => $this->t('Error fetching grants.'),
      ];
    }
  }

  /**
   * Gets access token for Heady API.
   */
  private function getAccessToken() {
    // Implement OAuth token retrieval.
    return '';
  }

}
