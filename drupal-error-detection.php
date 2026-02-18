<?php

/**
 * @file
 * Drupal 11 Emblem Design System Error Detection
 * 
 * Custom browser automation using Drupal 11's testing framework
 * for comprehensive emblem design system validation.
 */

namespace Drupal\emblem_detection;

use Drupal\Core\Url;
use Drupal\Component\Utility\Html;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class EmblemErrorDetector {
    
    private $httpClient;
    private $errors = [];
    private $warnings = [];
    private $baseUrl = 'http://localhost:8080';
    
    public function __construct() {
        $this->httpClient = \Drupal::httpClient();
    }
    
    /**
     * Initialize the error detection system.
     */
    public function initialize() {
        \Drupal::logger('emblem_detection')->info('🔍 Initializing Drupal Emblem Error Detector...');
        
        // Set up error handling
        set_error_handler([$this, 'handlePhpErrors']);
        
        return $this;
    }
    
    /**
     * Check a single page for errors.
     */
    public function checkPage($pagePath) {
        $url = $this->baseUrl . '/' . $pagePath;
        $pageErrors = [];
        $pageWarnings = [];
        
        try {
            \Drupal::logger('emblem_detection')->info("🔍 Checking: {$pagePath}");
            
            // Fetch page content
            $response = $this->httpClient->get($url, [
                'timeout' => 30,
                'connect_timeout' => 10
            ]);
            
            $html = $response->getBody()->getContents();
            $dom = new \DOMDocument();
            
            // Suppress warnings for malformed HTML
            libxml_use_internal_errors(true);
            $dom->loadHTML($html);
            libxml_clear_errors();
            
            $xpath = new \DOMXPath($dom);
            
            // Check for missing CSS files
            $this->checkCssFiles($xpath, $pageErrors, $pageWarnings);
            
            // Check for missing JavaScript files
            $this->checkJsFiles($xpath, $pageErrors, $pageWarnings);
            
            // Check for emblem-specific elements
            $this->checkEmblemElements($xpath, $pageErrors, $pageWarnings);
            
            // Check for broken images
            $this->checkImages($xpath, $pageErrors, $pageWarnings);
            
            // Check for CSS variables
            $this->checkCssVariables($dom, $pageErrors, $pageWarnings);
            
            // Check for JavaScript functions
            $this->checkJsFunctions($dom, $pageErrors, $pageWarnings);
            
            // Check responsive design
            $this->checkResponsiveDesign($dom, $pageErrors, $pageWarnings);
            
            // Validate HTML structure
            $this->validateHtmlStructure($dom, $pageErrors, $pageWarnings);
            
            \Drupal::logger('emblem_detection')->info("✅ Page check completed: " . count($pageErrors) . " errors, " . count($pageWarnings) . " warnings");
            
        } catch (RequestException $e) {
            $pageErrors[] = [
                'type' => 'request_error',
                'url' => $url,
                'error' => $e->getMessage(),
                'timestamp' => date('c')
            ];
            \Drupal::logger('emblem_detection')->error("❌ Request error: {$e->getMessage()}");
        } catch (\Exception $e) {
            $pageErrors[] = [
                'type' => 'general_error',
                'error' => $e->getMessage(),
                'timestamp' => date('c')
            ];
            \Drupal::logger('emblem_detection')->error("❌ General error: {$e->getMessage()}");
        }
        
        return [
            'page' => $pagePath,
            'url' => $url,
            'errors' => $pageErrors,
            'warnings' => $pageWarnings
        ];
    }
    
    /**
     * Check for missing CSS files.
     */
    private function checkCssFiles($xpath, &$errors, &$warnings) {
        $cssLinks = $xpath->query('//link[@rel="stylesheet"]');
        
        foreach ($cssLinks as $link) {
            $href = $link->getAttribute('href');
            
            // Check if it's an emblem CSS file
            if (strpos($href, 'emblem-') !== false) {
                try {
                    $cssUrl = $this->makeAbsoluteUrl($href);
                    $response = $this->httpClient->head($cssUrl);
                    
                    if ($response->getStatusCode() !== 200) {
                        $errors[] = [
                            'type' => 'css_missing',
                            'file' => $href,
                            'error' => "HTTP {$response->getStatusCode()}",
                            'timestamp' => date('c')
                        ];
                    }
                } catch (RequestException $e) {
                    $errors[] = [
                        'type' => 'css_missing',
                        'file' => $href,
                        'error' => $e->getMessage(),
                        'timestamp' => date('c')
                    ];
                }
            }
        }
    }
    
    /**
     * Check for missing JavaScript files.
     */
    private function checkJsFiles($xpath, &$errors, &$warnings) {
        $scripts = $xpath->query('//script[@src]');
        
        foreach ($scripts as $script) {
            $src = $script->getAttribute('src');
            
            try {
                $jsUrl = $this->makeAbsoluteUrl($src);
                $response = $this->httpClient->head($jsUrl);
                
                if ($response->getStatusCode() !== 200) {
                    $errors[] = [
                        'type' => 'js_missing',
                        'file' => $src,
                        'error' => "HTTP {$response->getStatusCode()}",
                        'timestamp' => date('c')
                    ];
                }
            } catch (RequestException $e) {
                $errors[] = [
                    'type' => 'js_missing',
                    'file' => $src,
                    'error' => $e->getMessage(),
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Check for emblem-specific elements.
     */
    private function checkEmblemElements($xpath, &$errors, &$warnings) {
        $emblemChecks = [
            'emblem_design_system' => '//link[contains(@href, "emblem-design-system.css")]',
            'emblem_components' => '//link[contains(@href, "emblem-components.css")]',
            'corner_elements' => '//*[contains(@class, "emblem-corner-bottom-left") or contains(@class, "emblem-corner-bottom-right")]',
            'floating_emblems' => '//*[contains(@class, "emblem-corner-floats")]',
            'emblem_buttons' => '//*[contains(@class, "emblem-btn-primary") or contains(@class, "emblem-btn-geometry") or contains(@class, "emblem-btn-lotus")]',
            'emblem_icons' => '//*[contains(@class, "emblem-icon-geometry") or contains(@class, "emblem-icon-lotus")]'
        ];
        
        foreach ($emblemChecks as $element => $query) {
            $nodes = $xpath->query($query);
            if ($nodes->length === 0) {
                $warnings[] = [
                    'type' => 'missing_emblem_element',
                    'element' => $element,
                    'message' => "Emblem element '{$element}' not found",
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Check for broken images.
     */
    private function checkImages($xpath, &$errors, &$warnings) {
        $images = $xpath->query('//img[@src]');
        
        foreach ($images as $img) {
            $src = $img->getAttribute('src');
            
            try {
                $imgUrl = $this->makeAbsoluteUrl($src);
                $response = $this->httpClient->head($imgUrl);
                
                if ($response->getStatusCode() !== 200) {
                    $errors[] = [
                        'type' => 'image_broken',
                        'src' => $src,
                        'error' => "HTTP {$response->getStatusCode()}",
                        'timestamp' => date('c')
                    ];
                }
            } catch (RequestException $e) {
                $errors[] = [
                    'type' => 'image_broken',
                    'src' => $src,
                    'error' => $e->getMessage(),
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Check for CSS variables in inline styles.
     */
    private function checkCssVariables($dom, &$errors, &$warnings) {
        $styles = $dom->getElementsByTagName('style');
        
        $requiredVars = [
            '--sacred-geometry-bg',
            '--cosmic-gradient',
            '--emblem-glass',
            '--sacred-gold',
            '--purple-glow',
            '--blue-glow',
            '--green-glow',
            '--gold-glow'
        ];
        
        $foundVars = [];
        
        foreach ($styles as $style) {
            $cssContent = $style->textContent;
            
            foreach ($requiredVars as $var) {
                if (strpos($cssContent, $var) !== false) {
                    $foundVars[] = $var;
                }
            }
        }
        
        foreach ($requiredVars as $var) {
            if (!in_array($var, $foundVars)) {
                $errors[] = [
                    'type' => 'css_variable_missing',
                    'variable' => $var,
                    'message' => "CSS variable '{$var}' not defined",
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Check for JavaScript functions.
     */
    private function checkJsFunctions($dom, &$errors, &$warnings) {
        $scripts = $dom->getElementsByTagName('script');
        
        $requiredFunctions = [
            'toggleGeometryMode',
            'toggleLotusMode',
            'toggleEyeMode',
            'toggleNatureMode',
            'toggleStarMode',
            'toggleRootMode'
        ];
        
        $foundFunctions = [];
        
        foreach ($scripts as $script) {
            $jsContent = $script->textContent;
            
            foreach ($requiredFunctions as $func) {
                if (strpos($jsContent, 'function ' . $func) !== false || strpos($jsContent, $func . ' =') !== false) {
                    $foundFunctions[] = $func;
                }
            }
        }
        
        foreach ($requiredFunctions as $func) {
            if (!in_array($func, $foundFunctions)) {
                $errors[] = [
                    'type' => 'js_function_missing',
                    'function' => $func,
                    'message' => "JavaScript function '{$func}' not defined",
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Check for responsive design issues.
     */
    private function checkResponsiveDesign($dom, &$errors, &$warnings) {
        $metaViewport = $dom->getElementsByTagName('meta');
        $hasViewport = false;
        
        foreach ($metaViewport as $meta) {
            if ($meta->getAttribute('name') === 'viewport') {
                $hasViewport = true;
                break;
            }
        }
        
        if (!$hasViewport) {
            $warnings[] = [
                'type' => 'responsive_issue',
                'issue' => 'missing_viewport',
                'message' => 'Missing viewport meta tag for responsive design',
                'timestamp' => date('c')
            ];
        }
    }
    
    /**
     * Validate HTML structure.
     */
    private function validateHtmlStructure($dom, &$errors, &$warnings) {
        // Check for proper DOCTYPE
        if (!$dom->doctype) {
            $warnings[] = [
                'type' => 'html_structure',
                'issue' => 'missing_doctype',
                'message' => 'Missing DOCTYPE declaration',
                'timestamp' => date('c')
            ];
        }
        
        // Check for proper head elements
        $head = $dom->getElementsByTagName('head')->item(0);
        if ($head) {
            $title = $head->getElementsByTagName('title')->item(0);
            if (!$title || empty($title->textContent)) {
                $warnings[] = [
                    'type' => 'html_structure',
                    'issue' => 'missing_title',
                    'message' => 'Missing or empty title tag',
                    'timestamp' => date('c')
                ];
            }
        }
    }
    
    /**
     * Make relative URLs absolute.
     */
    private function makeAbsoluteUrl($url) {
        if (strpos($url, 'http') === 0) {
            return $url;
        }
        
        return $this->baseUrl . '/' . ltrim($url, '/');
    }
    
    /**
     * Scan all emblem pages.
     */
    public function scanAllPages() {
        $pages = [
            'chat-fixed-enhanced.html',
            'admin-ui.html',
            'index.html',
            'index-enhanced.html',
            'chat-enhanced.html',
            'admin-ui-enhanced.html'
        ];
        
        $results = [];
        
        foreach ($pages as $page) {
            $result = $this->checkPage($page);
            $results[] = $result;
            
            // Add to global errors/warnings
            $this->errors = array_merge($this->errors, $result['errors']);
            $this->warnings = array_merge($this->warnings, $result['warnings']);
        }
        
        return $results;
    }
    
    /**
     * Generate comprehensive report.
     */
    public function generateReport($results) {
        $report = [
            'timestamp' => date('c'),
            'summary' => [
                'total_pages' => count($results),
                'total_errors' => count($this->errors),
                'total_warnings' => count($this->warnings),
                'pages_with_errors' => count(array_filter($results, function($r) { return count($r['errors']) > 0; })),
                'pages_with_warnings' => count(array_filter($results, function($r) { return count($r['warnings']) > 0; }))
            ],
            'pages' => $results,
            'all_errors' => $this->errors,
            'all_warnings' => $this->warnings,
            'recommendations' => $this->generateRecommendations()
        ];
        
        // Save JSON report
        $reportPath = __DIR__ . '/emblem-error-report.json';
        file_put_contents($reportPath, json_encode($report, JSON_PRETTY_PRINT));
        
        // Generate text summary
        $summaryPath = __DIR__ . '/emblem-error-summary.txt';
        $summary = $this->generateTextSummary($report);
        file_put_contents($summaryPath, $summary);
        
        \Drupal::logger('emblem_detection')->info("📊 Reports generated: {$reportPath}, {$summaryPath}");
        
        return $report;
    }
    
    /**
     * Generate recommendations based on findings.
     */
    private function generateRecommendations() {
        $recommendations = [];
        
        if (!empty(array_filter($this->errors, function($e) { return $e['type'] === 'css_missing'; }))) {
            $recommendations[] = '🔧 Fix missing CSS files - ensure emblem-design-system.css and emblem-components.css are accessible';
        }
        
        if (!empty(array_filter($this->errors, function($e) { return $e['type'] === 'js_function_missing'; }))) {
            $recommendations[] = '🔧 Implement missing JavaScript functions for emblem mode toggles';
        }
        
        if (!empty(array_filter($this->errors, function($e) { return $e['type'] === 'css_variable_missing'; }))) {
            $recommendations[] = '🔧 Define missing CSS variables in emblem-design-system.css';
        }
        
        if (!empty(array_filter($this->warnings, function($w) { return $w['type'] === 'missing_emblem_element'; }))) {
            $recommendations[] = '🎨 Add missing emblem elements for complete design system integration';
        }
        
        if (!empty(array_filter($this->warnings, function($w) { return $w['type'] === 'responsive_issue'; }))) {
            $recommendations[] = '📱 Fix responsive design issues - add viewport meta tag and optimize for mobile';
        }
        
        return $recommendations;
    }
    
    /**
     * Generate human-readable text summary.
     */
    private function generateTextSummary($report) {
        $summary = "EMBLEM DESIGN SYSTEM ERROR DETECTION REPORT\n";
        $summary .= "Generated: " . date('Y-m-d H:i:s') . "\n";
        $summary .= str_repeat('=', 60) . "\n\n";
        
        $summary .= "SUMMARY:\n";
        $summary .= "  Total Pages Checked: {$report['summary']['total_pages']}\n";
        $summary .= "  Total Errors: {$report['summary']['total_errors']}\n";
        $summary .= "  Total Warnings: {$report['summary']['total_warnings']}\n";
        $summary .= "  Pages with Errors: {$report['summary']['pages_with_errors']}\n";
        $summary .= "  Pages with Warnings: {$report['summary']['pages_with_warnings']}\n\n";
        
        if ($report['summary']['total_errors'] > 0) {
            $summary .= "ERRORS BY TYPE:\n";
            $errorTypes = [];
            foreach ($report['all_errors'] as $error) {
                $errorTypes[$error['type']] = ($errorTypes[$error['type']] ?? 0) + 1;
            }
            foreach ($errorTypes as $type => $count) {
                $summary .= "  {$type}: {$count}\n";
            }
            $summary .= "\n";
        }
        
        if ($report['summary']['total_warnings'] > 0) {
            $summary .= "WARNINGS BY TYPE:\n";
            $warningTypes = [];
            foreach ($report['all_warnings'] as $warning) {
                $warningTypes[$warning['type']] = ($warningTypes[$warning['type']] ?? 0) + 1;
            }
            foreach ($warningTypes as $type => $count) {
                $summary .= "  {$type}: {$count}\n";
            }
            $summary .= "\n";
        }
        
        $summary .= "PAGE-BY-PAGE BREAKDOWN:\n";
        foreach ($report['pages'] as $page) {
            $summary .= "\n{$page['page']}:\n";
            $summary .= "  Errors: " . count($page['errors']) . "\n";
            $summary .= "  Warnings: " . count($page['warnings']) . "\n";
            
            if (!empty($page['errors'])) {
                $summary .= "  Error Details:\n";
                foreach ($page['errors'] as $error) {
                    $summary .= "    - {$error['type']}: " . ($error['message'] ?? $error['error']) . "\n";
                }
            }
            
            if (!empty($page['warnings'])) {
                $summary .= "  Warning Details:\n";
                foreach ($page['warnings'] as $warning) {
                    $summary .= "    - {$warning['type']}: {$warning['message']}\n";
                }
            }
        }
        
        if (!empty($report['recommendations'])) {
            $summary .= "\nRECOMMENDATIONS:\n";
            foreach ($report['recommendations'] as $rec) {
                $summary .= "  {$rec}\n";
            }
        }
        
        return $summary;
    }
    
    /**
     * PHP error handler.
     */
    public function handlePhpErrors($severity, $message, $file, $line) {
        $this->errors[] = [
            'type' => 'php_error',
            'severity' => $severity,
            'message' => $message,
            'file' => $file,
            'line' => $line,
            'timestamp' => date('c')
        ];
    }
}

// Drupal 11 hook for running the detection
function emblem_detection_run_scan() {
    $detector = new EmblemErrorDetector();
    $detector->initialize();
    $results = $detector->scanAllPages();
    $report = $detector->generateReport($results);
    
    \Drupal::logger('emblem_detection')->info('🎯 Error Detection Complete!');
    \Drupal::logger('emblem_detection')->info('Total Errors: ' . $report['summary']['total_errors']);
    \Drupal::logger('emblem_detection')->info('Total Warnings: ' . $report['summary']['total_warnings']);
    
    return $report;
}

// If running as standalone script
if (php_sapi_name() === 'cli') {
    // Bootstrap Drupal if available
    if (file_exists(__DIR__ . '/web/index.php')) {
        require_once __DIR__ . '/web/index.php';
    }
    
    emblem_detection_run_scan();
}
