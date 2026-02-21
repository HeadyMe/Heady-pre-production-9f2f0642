<?php

namespace Drupal\heady_mcp\Service;

use Drupal\Core\Config\ConfigFactoryInterface;

/**
 * URL Validator Service - Prevents localhost/.onrender.com pollution
 */
class UrlValidator {

  protected $configFactory;
  protected $blockedPatterns;
  protected $allowedDomains;

  public function __construct(ConfigFactoryInterface $configFactory) {
    $this->configFactory = $configFactory;
    
    // Initialize blocked patterns
    $this->blockedPatterns = [
      'localhost',
      '127.0.0.',
      '0.0.0.0',
      '.onrender.com',
      '10.',
      '192.168.',
      '172.',
      '0.0.0.0',
      '[::1]', // IPv6 localhost
    ];
    
    // Allowed production domains
    $this->allowedDomains = [
      'headyme.com',
      'headysystems.com', 
      'headyconnection.org',
      'api.headyme.com',
      'api.headysystems.com',
      'api.headyconnection.org',
      'app.headyme.com',
      'app.headysystems.com',
      'app.headyconnection.org',
      'admin.headyme.com',
      'admin.headysystems.com',
      'admin.headyconnection.org',
      'cms.headyconnection.org',
    ];
  }

  /**
   * Validate content for blocked URL patterns
   */
  public function validate(string $content): array {
    $found = [];
    $replacements = [];
    
    foreach ($this->blockedPatterns as $pattern) {
      if (strpos($content, $pattern) !== false) {
        $found[] = $pattern;
        
        // Suggest replacement
        $replacements[$pattern] = $this->suggestReplacement($pattern, $content);
      }
    }
    
    if (!empty($found)) {
      return [
        'valid' => false,
        'blocked_patterns' => $found,
        'replacements' => $replacements,
        'message' => 'Blocked URL patterns found. Replace with production domains.',
      ];
    }
    
    return [
      'valid' => true,
      'message' => 'All URLs are valid - using production domains only',
    ];
  }

  /**
   * Suggest replacement for blocked pattern
   */
  protected function suggestReplacement(string $pattern, string $content): string {
    // Extract context to suggest appropriate replacement
    if (strpos($content, 'api') !== false) {
      return 'https://api.headysystems.com';
    } elseif (strpos($content, 'app') !== false) {
      return 'https://app.headysystems.com';
    } elseif (strpos($content, 'admin') !== false) {
      return 'https://admin.headysystems.com';
    } else {
      return 'https://headysystems.com';
    }
  }

  /**
   * Fix URLs in content
   */
  public function fixUrls(string $content): string {
    $fixed = $content;
    
    // Replace localhost patterns
    $fixed = preg_replace('/https?:\/\/localhost(:\d+)?/', 'https://api.headysystems.com', $fixed);
    $fixed = preg_replace('/https?:\/\/127\.0\.0\.\d+(:\d+)?/', 'https://api.headysystems.com', $fixed);
    $fixed = preg_replace('/https?:\/\/0\.0\.0\.0(:\d+)?/', 'https://api.headysystems.com', $fixed);
    
    // Replace .onrender.com patterns
    $fixed = preg_replace('/https?:\/\/([^.]+)\.onrender\.com/', 'https://api.headysystems.com', $fixed);
    
    // Replace private IP ranges
    $fixed = preg_replace('/https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?/', 'https://api.headysystems.com', $fixed);
    $fixed = preg_replace('/https?:\/\/192\.168\.\d+\.\d+(:\d+)?/', 'https://api.headysystems.com', $fixed);
    $fixed = preg_replace('/https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?/', 'https://api.headysystems.com', $fixed);
    
    return $fixed;
  }

  /**
   * Check if domain is allowed
   */
  public function isDomainAllowed(string $url): bool {
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host) {
      return false;
    }
    
    // Check if it's an allowed domain
    foreach ($this->allowedDomains as $allowed) {
      if ($host === $allowed || strpos($host, '.' . $allowed) !== false) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get all blocked patterns
   */
  public function getBlockedPatterns(): array {
    return $this->blockedPatterns;
  }

  /**
   * Get all allowed domains
   */
  public function getAllowedDomains(): array {
    return $this->allowedDomains;
  }
}
