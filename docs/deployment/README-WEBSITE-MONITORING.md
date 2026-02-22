# 🌐 Website Health Monitoring & Auto-Healing System

## Overview

This comprehensive website health monitoring system automatically detects website errors, broken functionality, and performance issues - then integrates with your HCFP Full Auto system for self-healing. No more manual testing required!

## 🚨 Problem Solved

**Before**: You had to manually test HeadyMe.com and other sites to discover broken buttons, JavaScript errors, and non-functional links.

**After**: The system automatically:
- Detects all website errors in real-time
- Identifies broken buttons and dead links
- Monitors JavaScript errors and network failures
- Calculates impact on Operational Readiness Score (ORS)
- Triggers auto-healing through HCFP Full Auto

## 🏗️ Architecture Components

### 1. **Website Health Monitor** (`/src/monitoring/website-health-monitor.js`)
- **Purpose**: Automated browser-based testing of production websites
- **Features**: 
  - Real browser testing with Puppeteer
  - Critical path validation (landing → login → dashboard → admin)
  - JavaScript error detection
  - Button/link functionality testing
  - Screenshot capture on errors
  - Performance metrics collection

### 2. **Frontend Error Collector** (`/src/monitoring/frontend-error-collector.js`)
- **Purpose**: JavaScript module for frontend applications
- **Features**:
  - Global error handlers for JS errors and unhandled promises
  - Dead button and link detection
  - Form validation monitoring
  - Network failure tracking
  - Performance metrics collection
  - Automatic error reporting to backend

### 3. **Frontend Errors API** (`/src/api/frontend-errors-api.js`)
- **Purpose**: REST API to receive and process frontend error reports
- **Features**:
  - Error aggregation and analysis
  - Rate limiting and storage
  - Alert threshold monitoring
  - Performance metrics tracking
  - Integration with HCFP system

### 4. **Website Health Integration** (`/src/integration/website-health-integration.js`)
- **Purpose**: Orchestrates all components and integrates with HCFP
- **Features**:
  - Coordinates monitoring and error collection
  - Calculates ORS impact
  - Triggers auto-healing tasks
  - Manages alerts and notifications
  - Provides unified status interface

## 🚀 Quick Start

### 1. Add Frontend Error Collector to Your Websites

Add this script to your HTML pages (before closing `</body>` tag):

```html
<script src="https://api.headyme.com/frontend-error-collector.js"></script>
<script>
  // Configure error collection
  window.HeadyErrorConfig = {
    api_endpoint: '/api/frontend-errors',
    debug_mode: false, // Set to true for development
    include_screenshots: true
  };
</script>
```

### 2. Start the Monitoring System

```bash
cd /home/headyme/CascadeProjects/Heady

# Start HCFP Full Auto with website monitoring
node src/orchestration/hcfp-full-auto-engine.js

# Or start monitoring directly
node src/monitoring/website-health-monitor.js
```

### 3. Add API Routes to Your Manager

```javascript
// In heady-manager.js or main server file
const WebsiteHealthIntegration = require('./src/integration/website-health-integration');

const healthIntegration = new WebsiteHealthIntegration();

// Add frontend errors API routes
app.use('/api/frontend-errors', healthIntegration.getFrontendErrorsRouter());

// Start integration with HCFP
await healthIntegration.start(hcfpEngine, aiRouter);
```

## 📊 What Gets Monitored

### Website Health Checks
- **HTTP Status**: All endpoints return proper status codes
- **Content Validation**: Expected elements are present and functional
- **Button Functionality**: Buttons have click handlers and respond to clicks
- **Link Navigation**: Links navigate properly or have functional handlers
- **Form Validation**: Forms have proper action and method attributes
- **JavaScript Errors**: No unhandled JS errors or promise rejections
- **Network Failures**: All resources load successfully
- **Performance**: Page load times and response times within thresholds

### Frontend Error Collection
- **JavaScript Errors**: Syntax errors, runtime errors, unhandled exceptions
- **Dead Buttons**: Buttons without click handlers or functionality
- **Dead Links**: Links that don't navigate or trigger actions
- **Form Issues**: Forms missing action/method or submit handlers
- **Resource Errors**: Failed image, script, or stylesheet loads
- **Network Errors**: Failed API calls or XHR requests
- **Performance Issues**: Slow page loads, DOM processing delays

## 🚨 Alert System

### Alert Types
1. **Critical Website Health**: Overall health score < 50%
2. **High Error Rate**: JavaScript errors > 10 per minute
3. **Dead UI Elements**: Dead buttons/links > 5 per minute
4. **Performance Degradation**: Response times > 5 seconds
5. **ORS Impact**: Website issues causing ORS drop > 15 points

### Alert Actions
- **Immediate Notification**: Real-time alerts to HCFP system
- **Auto-Healing Trigger**: Automatic creation of healing tasks
- **ORS Impact Calculation**: Update Operational Readiness Score
- **Emergency Response**: Critical alerts trigger emergency procedures
- **Human Escalation**: Unresolved issues escalate to human operators

## 🏥 Auto-Healing System

### Healing Task Types
1. **Website Healing**: DNS, SSL, API endpoints, service restart
2. **UI Healing**: Dead element fixes, event handler repairs
3. **Provider Healing**: AI provider switching, routing adjustments
4. **Emergency Healing**: Immediate rollback, service restart, escalation

### Healing Process
1. **Detection**: System detects issue through monitoring
2. **Analysis**: AI analyzes issue and determines root cause
3. **Task Creation**: Healing task created and queued in HCFP
4. **Execution**: Task executed through appropriate nodes
5. **Validation**: Fix validated through health checks
6. **Recovery**: System returns to healthy state

## 📈 Integration with HCFP Full Auto

### ORS Impact Calculation
```javascript
// Website health impact on ORS
if (health.status === 'critical') {
  orsImpact = -30; // Severe impact
} else if (health.status === 'poor') {
  orsImpact = -15; // Moderate impact
} else if (js_error_count > 10) {
  orsImpact = -20; // High JS error rate
} else if (dead_button_rate > 0.3) {
  orsImpact = -25; // Many dead buttons
}
```

### HCFP Integration Points
- **Health Check Stage**: Website monitoring results feed into HCFP health checks
- **Decision Making**: ORS impact influences HCFP operational mode
- **Task Execution**: Healing tasks executed through HCFP node orchestration
- **Self-Critique**: Website health data used in self-critique analysis
- **Performance Metrics**: Website metrics included in HCFP performance tracking

## 🔧 Configuration

### Website Monitor Configuration
```javascript
const monitor = new WebsiteHealthMonitor({
  check_interval_seconds: 60,        // Check every minute
  timeout_ms: 10000,                 // 10 second timeout
  screenshot_on_error: true,         // Capture screenshots on errors
  max_concurrent_checks: 5,          // Parallel checks
  production_domains: {
    headyme: {
      app: 'https://headyme.com',
      api: 'https://api.headyme.com',
      admin: 'https://admin.headyme.com'
    },
    // ... other domains
  }
});
```

### Frontend Error Configuration
```javascript
window.HeadyErrorConfig = {
  api_endpoint: '/api/frontend-errors',
  batch_size: 10,                    // Send errors in batches
  flush_interval_ms: 5000,           // Flush every 5 seconds
  max_errors_per_minute: 100,        // Rate limiting
  debug_mode: false,                 // Production mode
  include_screenshots: true          // Include screenshots on critical errors
};
```

### Integration Configuration
```javascript
const integration = new WebsiteHealthIntegration({
  enable_website_monitoring: true,
  enable_frontend_error_collection: true,
  ors_impact_weights: {
    critical_website_health: -30,
    poor_website_health: -15,
    high_js_error_rate: -20,
    high_dead_button_rate: -25
  },
  auto_healing_enabled: true,
  alert_thresholds: {
    overall_health_score: 50,
    js_errors_per_minute: 10,
    dead_buttons_per_minute: 5
  }
});
```

## 📊 Monitoring Dashboard

### Key Metrics
- **Overall Health Score**: 0-100% across all sites
- **JavaScript Error Rate**: Errors per minute
- **Dead Element Rate**: Percentage of non-functional buttons/links
- **Response Times**: Average page load and API response times
- **ORS Impact**: Current impact on Operational Readiness Score

### Status Endpoints
- `GET /api/website-health/status` - Overall system status
- `GET /api/frontend-errors/stats` - Error statistics
- `GET /api/frontend-errors/recent` - Recent errors
- `GET /api/frontend-errors/aggregates` - Aggregated error data

## 🛠️ Troubleshooting

### Common Issues
1. **Browser Pool Exhaustion**: Increase `maxBrowserInstances` in monitor
2. **Rate Limiting**: Adjust `max_errors_per_hour` in API
3. **Memory Usage**: Reduce `check_interval_seconds` or `batch_size`
4. **False Positives**: Tune alert thresholds and error categorization

### Debug Mode
Enable debug mode for detailed logging:
```javascript
// Frontend
window.HeadyErrorConfig.debug_mode = true;

// Backend
const monitor = new WebsiteHealthMonitor({ debug_mode: true });
```

## 🎯 Best Practices

### Production Deployment
1. **Enable All Monitoring**: Both website and frontend error collection
2. **Set Appropriate Thresholds**: Tune alerts for your traffic levels
3. **Monitor ORS Impact**: Watch for ORS degradation
4. **Regular Health Checks**: Schedule comprehensive site scans
5. **Alert Integration**: Connect alerts to your notification system

### Performance Optimization
1. **Batch Error Reports**: Reduce API call frequency
2. **Browser Pool Management**: Reuse browser instances
3. **Rate Limiting**: Prevent error floods
4. **Data Retention**: Clean up old error data
5. **Caching**: Cache health check results

### Error Analysis
1. **Categorize Errors**: Group similar errors for analysis
2. **Track Trends**: Monitor error patterns over time
3. **User Impact**: Focus on user-facing errors first
4. **Root Cause Analysis**: Use AI to identify underlying issues
5. **Prevention**: Fix common error patterns in code

## 📚 API Reference

### Website Health Monitor
```javascript
const monitor = new WebsiteHealthMonitor(config);
await monitor.start();
await monitor.performHealthChecks();
await monitor.performDeepScan();
monitor.getHealthStatus();
await monitor.stop();
```

### Frontend Error Collector
```javascript
// Automatic initialization
window.HeadyErrorCollector.getMetrics();

// Manual error reporting
window.reportError(error, context);

// Manual performance reporting
window.reportPerformance('page_load_time', 2500);
```

### Integration API
```javascript
const integration = new WebsiteHealthIntegration(config);
await integration.start(hcfpEngine, aiRouter);
integration.getStatus();
integration.getFrontendErrorCollectorScript();
integration.getFrontendErrorsRouter();
await integration.stop();
```

## 🎉 Benefits

### Immediate Benefits
- **Zero Manual Testing**: System automatically detects all website issues
- **Real-time Detection**: Errors caught within seconds of occurrence
- **Comprehensive Coverage**: All user interactions monitored
- **Automatic Healing**: Issues fixed without human intervention
- **ORS Integration**: Website health directly impacts system readiness

### Long-term Benefits
- **Improved Reliability**: Proactive issue detection and resolution
- **Better User Experience**: Fewer broken interactions
- **Reduced Support Load**: Issues fixed before users report them
- **Data-driven Decisions**: Detailed analytics for optimization
- **Self-healing System**: Continuous improvement and adaptation

---

## 🎯 Summary

The Website Health Monitoring system transforms your manual testing process into an automated, intelligent monitoring solution that:

1. **Detects** all website errors automatically
2. **Analyzes** impact on system health and user experience
3. **Reports** issues through integrated alerting
4. **Heals** problems through HCFP Full Auto orchestration
5. **Learns** from patterns to prevent future issues

**Result**: Your websites become self-aware, self-healing, and continuously monitored without any manual effort required!

---

*Heady Systems - Sacred Geometry AI Platform*  
*Version 2.0.0 - Website Health Monitoring*  
*Last Updated: 2025-02-19*
