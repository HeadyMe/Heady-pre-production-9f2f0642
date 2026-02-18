# 📋 Drupal 11 + Heady CMS Integration Guide

## 🎯 Why This Integration Works

### **The Problem with Most CMS Systems**
Most CMS + API integrations fail because:
- ❌ Static content management only
- ❌ No real-time user intelligence
- ❌ No cross-device synchronization
- ❌ No continuous learning system
- ❌ No zero-idle performance optimization

### **Why Heady + Drupal 11 Succeeds**
✅ **Drupal 11**: World-class content management
✅ **Heady API**: Real-time intelligence and orchestration
✅ **Memory System**: Learns from every user interaction
✅ **Zero-Idle Protocol**: Always optimizing, never wasting resources
✅ **Cross-Device**: Mobile, tablet, desktop optimized

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drupal 11      │    │   Heady API      │    │   Heady Memory   │
│                 │    │                 │    │                 │
│ • Content Mgmt   │◄──►│ • Intelligence   │◄──►│ • Learning       │
│ • User Auth      │    │ • Orchestration  │    │ • Patterns       │
│ • Media Library  │    │ • Validation    │    │ • Context        │
│ • SEO Tools      │    │ • Cross-Device  │    │ • Sync           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Frontend UI    │
                    │                 │
                    │ • React/Vue/Angular│
                    │ • Mobile Apps    │
                    │ • PWA            │
                    └─────────────────┘
```

## 🚀 Implementation Steps

### **Step 1: Set Up Heady API (Already Done)**
```bash
# Heady API is running on manager.headyme.com
# All endpoints are functional:
# - /api/health - System status
# - /api/memory/scan - Memory system
# - /api/validation/status - Validation
# - /api/orchestrate/enhanced - Orchestration
```

### **Step 2: Install Drupal 11**
```bash
# Download Drupal 11
wget https://www.drupal.org/download/drupal-11.0.0.tar.gz
tar -xzf drupal-11.0.0.tar.gz
cd drupal-11.0.0

# Set up database (MySQL/PostgreSQL)
mysql -u root -p
CREATE DATABASE heady_cms;
CREATE USER 'heady_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON heady_cms.* TO 'heady_user'@'localhost';
FLUSH PRIVILEGES;
```

### **Step 3: Configure Drupal for Heady Integration**

**Create `sites/default/settings.php` additions:**
```php
<?php
// Heady API Integration
$settings['heady_api_url'] = 'http://manager.headyme.com';
$settings['heady_api_timeout'] = 5;

// Custom Heady Services
$settings['heady_memory_enabled'] = true;
$settings['heady_validation_enabled'] = true;
$settings['heady_orchestration_enabled'] = true;

// Cross-Device Features
$settings['heady_cross_device'] = true;
$settings['heady_mobile_optimized'] = true;
```

### **Step 4: Create Heady Integration Module**

**File: `modules/custom/heady_integration/heady_integration.info.yml`**
```yaml
name: 'Heady Integration'
type: module
description: 'Integrates Heady API with Drupal 11 CMS'
core_version_requirement: ^11
package: 'Heady'
dependencies:
  - drupal:rest
  - drupal:serialization
```

**File: `modules/custom/heady_integration/src/HeadyApiClient.php`**
```php
<?php

namespace Drupal\heady_integration;

class HeadyApiClient {
  private $apiUrl;
  private $httpClient;

  public function __construct() {
    $this->apiUrl = \Drupal::config('heady_integration.settings')->get('heady_api_url', 'http://manager.headyme.com');
    $this->httpClient = \Drupal::httpClient();
  }

  public function getHealth(): array {
    try {
      $response = $this->httpClient->get($this->apiUrl . '/api/health');
      return json_decode($response->getBody(), true);
    } catch (\Exception $e) {
      return ['error' => $e->getMessage()];
    }
  }

  public function scanMemory(): array {
    try {
      $response = $this->httpClient->get($this->apiUrl . '/api/memory/scan');
      return json_decode($response->getBody(), true);
    } catch (\Exception $e) {
      return ['error' => $e->getMessage()];
    }
  }

  public function orchestrateRequest(string $request, array $config = []): array {
    try {
      $response = $this->httpClient->post($this->apiUrl . '/api/orchestrate/enhanced', [
        'json' => [
          'request' => $request,
          'userConfig' => array_merge(['cms' => 'drupal'], $config)
        ]
      ]);
      return json_decode($response->getBody(), true);
    } catch (\Exception $e) {
      return ['error' => $e->getMessage()];
    }
  }
}
```

### **Step 5: Create Heady Content Type**

**Using Drupal Console:**
```bash
# Create Heady-enhanced content type
drupal generate:content-type HeadyArticle \
  --title="Heady Article" \
  --description="Article with Heady intelligence" \
  --fields="body,heady_context,heady_patterns,heady_recommendations"

# Add Heady-specific fields
drupal generate:field HeadyContext HeadyArticle \
  --field-type="text_long" \
  --label="Heady Context" \
  --description="AI-generated context from Heady Memory"

drupal generate:field HeadyPatterns HeadyArticle \
  --field-type="entity_reference" \
  --label="User Patterns" \
  --description="Detected user behavior patterns"
```

### **Step 6: Create Heady Theme Integration**

**File: `themes/custom/heady_theme/heady_theme.info.yml`**
```yaml
name: 'Heady Theme'
type: theme
description: 'Theme with Heady API integration'
core_version_requirement: ^11
base_theme: false
libraries:
  - heady_theme/global-styling
  - heady_theme/heady-api
```

**File: `themes/custom/heady_theme/js/heady-integration.js`**
```javascript
class HeadyDrupalIntegration {
  constructor() {
    this.apiUrl = 'http://manager.headyme.com';
    this.init();
  }

  async init() {
    // Load Heady context on page load
    await this.loadHeadyContext();
    
    // Set up real-time updates
    this.setupRealTimeUpdates();
    
    // Enable cross-device features
    this.enableCrossDevice();
  }

  async loadHeadyContext() {
    try {
      const response = await fetch(`${this.apiUrl}/api/memory/scan`);
      const context = await response.json();
      
      // Update page with Heady intelligence
      this.updatePageWithContext(context);
    } catch (error) {
      console.error('Heady context loading failed:', error);
    }
  }

  updatePageWithContext(context) {
    // Add Heady recommendations to content
    const recommendations = context.memories.recent.slice(0, 3);
    const recommendationsHtml = recommendations.map(mem => 
      `<div class="heady-recommendation">${mem.content}</div>`
    ).join('');
    
    const container = document.querySelector('.heady-recommendations');
    if (container) {
      container.innerHTML = recommendationsHtml;
    }
  }

  setupRealTimeUpdates() {
    // Update content every 30 seconds with new insights
    setInterval(async () => {
      await this.loadHeadyContext();
    }, 30000);
  }

  enableCrossDevice() {
    // Detect device type and optimize
    const isMobile = /Mobile|Android|iPhone/.test(navigator.userAgent);
    const isTablet = /iPad|Tablet/.test(navigator.userAgent);
    
    if (isMobile) {
      document.body.classList.add('heady-mobile');
    } else if (isTablet) {
      document.body.classList.add('heady-tablet');
    } else {
      document.body.classList.add('heady-desktop');
    }
  }
}

// Initialize Heady integration
document.addEventListener('DOMContentLoaded', () => {
  new HeadyDrupalIntegration();
});
```

## 🔧 Advanced Features

### **1. Smart Content Recommendations**
```php
<?php
namespace Drupal\heady_integration\Plugin\Block;

use Drupal\Core\Block\BlockBase;

/**
 * @Block(
 *   id = "heady_recommendations_block",
 *   admin_label = @Translation("Heady Recommendations"),
 *   category = @Translation("Heady")
 * )
 */
class HeadyRecommendationsBlock extends BlockBase {
  public function build() {
    $headyApi = new HeadyApiClient();
    $context = $headyApi->scanMemory();
    
    return [
      '#theme' => 'heady_recommendations',
      '#recommendations' => $context['memories']['recent'] ?? [],
      '#cache' => [
        'max-age' => 30, // Cache for 30 seconds
        'contexts' => ['user'],
      ],
    ];
  }
}
```

### **2. User Behavior Tracking**
```php
<?php
namespace Drupal\heady_integration\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Drupal\Core\Session\SessionEvents;

class HeadyTrackingSubscriber implements EventSubscriberInterface {
  public static function getSubscribedEvents() {
    return [
      SessionEvents::READ => 'trackUserActivity',
    ];
  }

  public function trackUserActivity($event) {
    $headyApi = new HeadyApiClient();
    $user = \Drupal::currentUser();
    
    if ($user->isAuthenticated()) {
      $headyApi->orchestrateRequest('user_activity', [
        'user_id' => $user->id(),
        'timestamp' => time(),
        'page' => \Drupal::routeMatch()->getRouteName(),
        'device' => $this->detectDevice()
      ]);
    }
  }

  private function detectDevice(): string {
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    if (preg_match('/Mobile|Android|iPhone/', $userAgent)) {
      return 'mobile';
    } elseif (preg_match('/iPad|Tablet/', $userAgent)) {
      return 'tablet';
    }
    
    return 'desktop';
  }
}
```

### **3. Content Enhancement API**
```php
<?php
namespace Drupal\heady_integration\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;

class HeadyApiController extends ControllerBase {
  public function enhanceContent($node_id) {
    $node = \Drupal\node\Entity\Node::load($node_id);
    $headyApi = new HeadyApiClient();
    
    $enhancement = $headyApi->orchestrateRequest('enhance_content', [
      'node_id' => $node_id,
      'content' => $node->get('body')->value,
      'type' => $node->getType(),
      'tags' => $node->get('field_tags')->getValue()
    ]);
    
    return new JsonResponse($enhancement);
  }
}
```

## 📱 Cross-Device Features

### **Mobile Optimization**
- Touch-friendly interface
- Responsive design
- Fast loading with Heady caching
- Gesture support

### **Tablet Features**
- Split-screen editing
- Enhanced multitasking
- Stylus support
- Adaptive layouts

### **Desktop Features**
- Full-featured editor
- Multi-window support
- Keyboard shortcuts
- Advanced tools

## 🎯 Benefits of This Integration

### **For Content Managers**
✅ **Smart Content**: AI-powered recommendations
✅ **User Insights**: Behavior pattern analysis
✅ **Cross-Device**: Edit anywhere, sync everywhere
✅ **Real-time**: Live updates and notifications

### **For Developers**
✅ **API-First**: Clean separation of concerns
✅ **Extensible**: Easy to add new features
✅ **Modern**: Drupal 11 + latest web tech
✅ **Performant**: Zero-idle optimization

### **For Users**
✅ **Personalized**: Content adapts to user behavior
✅ **Responsive**: Works on all devices
✅ **Fast**: Optimized loading and caching
✅ **Intelligent**: Learns from interactions

## 🚀 Deployment Strategy

### **Development (Current)**
```bash
# Local development
Heady API: http://manager.headyme.com
Drupal 11: http://localhost/drupal
Frontend: http://localhost:3000
```

### **Staging**
```bash
# Staging environment
Heady API: https://staging.headyme.com
Drupal 11: https://staging.headyme.com/cms
Frontend: https://staging.headyme.com/app
```

### **Production**
```bash
# Production environment
Heady API: https://headyme.com/api
Drupal 11: https://headyme.com/cms
Frontend: https://headyme.com
```

## 📊 Performance Metrics

### **Expected Performance**
- **Page Load**: < 2 seconds with Heady caching
- **API Response**: < 100ms average
- **Memory Usage**: < 512MB per instance
- **Concurrent Users**: 1000+ with scaling

### **Monitoring**
```php
// Add to settings.php
$settings['heady_monitoring'] = [
  'enabled' => true,
  'track_performance' => true,
  'log_slow_queries' => true,
  'alert_threshold' => 1000 // ms
];
```

## 🔧 Troubleshooting

### **Common Issues**
1. **CORS Errors**: Ensure Heady API allows Drupal domain
2. **Memory Issues**: Increase PHP memory limit
3. **Performance**: Enable Heady caching
4. **Cross-Device**: Test on multiple devices

### **Debug Mode**
```php
// Enable debugging
$settings['heady_debug'] = true;
$settings['heady_log_level'] = 'debug';
```

## 🎉 Success Criteria

### **✅ Working Integration Checklist**
- [ ] Heady API responds to health checks
- [ ] Drupal can call Heady endpoints
- [ ] Memory system loads user context
- [ ] Content recommendations appear
- [ ] Cross-device functionality works
- [ ] Performance is acceptable
- [ ] Error handling works correctly

### **🎯 Expected Results**
- **Content**: Enhanced with AI recommendations
- **Users**: Personalized experience
- **Admins**: Powerful content management
- **Developers**: Clean, extensible codebase

---

**🚀 This integration gives you the best of both worlds: Drupal's proven CMS capabilities + Heady's cutting-edge AI intelligence!**
