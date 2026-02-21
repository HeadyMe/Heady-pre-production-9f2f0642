// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: website-health-integration.js                         ║
// ║  UPDATED: 20260219-220500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🔗 Website Health Integration
 * 
 * Integrates website health monitoring with HCFP Full Auto system,
 * ORS calculations, and self-healing mechanisms.
 */

const WebsiteHealthMonitor = require('../monitoring/website-health-monitor');
const FrontendErrorsAPI = require('../api/frontend-errors-api');
const { EventEmitter } = require('events');

class WebsiteHealthIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enable_website_monitoring: config.enable_website_monitoring !== false,
      enable_frontend_error_collection: config.enable_frontend_error_collection !== false,
      ors_impact_weights: {
        critical_website_health: config.ors_impact_weights?.critical_website_health || -30,
        poor_website_health: config.ors_impact_weights?.poor_website_health || -15,
        high_js_error_rate: config.ors_impact_weights?.high_js_error_rate || -20,
        high_dead_button_rate: config.ors_impact_weights?.high_dead_button_rate || -25
      },
      alert_thresholds: {
        overall_health_score: config.alert_thresholds?.overall_health_score || 50,
        js_errors_per_minute: config.alert_thresholds?.js_errors_per_minute || 10,
        dead_buttons_per_minute: config.alert_thresholds?.dead_buttons_per_minute || 5
      },
      auto_healing_enabled: config.auto_healing_enabled !== false,
      ...config
    };
    
    // Components
    this.websiteMonitor = null;
    this.frontendErrorsAPI = null;
    
    // State
    this.currentHealthStatus = null;
    this.orsImpact = 0;
    this.lastHealthCheck = null;
    this.alertHistory = [];
    
    // Integration with HCFP
    this.hcfpEngine = null;
    this.aiRouter = null;
    
    console.log('[WebsiteHealthIntegration] Initialized');
  }

  /**
   * 🚀 Start integration
   */
  async start(hcfpEngine = null, aiRouter = null) {
    console.log('\n🔗 STARTING WEBSITE HEALTH INTEGRATION');
    console.log('='.repeat(55));
    
    try {
      this.hcfpEngine = hcfpEngine;
      this.aiRouter = aiRouter;
      
      // Start website monitoring
      if (this.config.enable_website_monitoring) {
        await this.startWebsiteMonitoring();
      }
      
      // Start frontend error collection
      if (this.config.enable_frontend_error_collection) {
        await this.startFrontendErrorCollection();
      }
      
      // Set up integration events
      this.setupIntegrationEvents();
      
      console.log('✅ Website Health Integration started');
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start Website Health Integration:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 🛑 Stop integration
   */
  async stop() {
    if (this.websiteMonitor) {
      await this.websiteMonitor.stop();
      this.websiteMonitor = null;
    }
    
    if (this.frontendErrorsAPI) {
      this.frontendErrorsAPI.stop();
      this.frontendErrorsAPI = null;
    }
    
    console.log('[WebsiteHealthIntegration] Stopped');
    this.emit('stopped');
  }

  /**
   * 🌐 Start website monitoring
   */
  async startWebsiteMonitoring() {
    this.websiteMonitor = new WebsiteHealthMonitor({
      check_interval_seconds: 60,
      timeout_ms: 10000,
      screenshot_on_error: true
    });
    
    // Set up event handlers
    this.websiteMonitor.on('health_checks_completed', this.handleHealthChecksCompleted.bind(this));
    this.websiteMonitor.on('critical_website_health', this.handleCriticalWebsiteHealth.bind(this));
    this.websiteMonitor.on('ors_impact_calculated', this.handleORSImpactCalculated.bind(this));
    
    await this.websiteMonitor.start();
    console.log('🌐 Website monitoring started');
  }

  /**
   * 🚨 Start frontend error collection
   */
  async startFrontendErrorCollection() {
    this.frontendErrorsAPI = new FrontendErrorsAPI({
      max_errors_per_hour: 1000,
      retention_days: 30,
      alert_thresholds: this.config.alert_thresholds
    });
    
    // Set up event handlers
    this.frontendErrorsAPI.on('errors_received', this.handleErrorsReceived.bind(this));
    this.frontendErrorsAPI.on('alert_triggered', this.handleErrorAlert.bind(this));
    this.frontendErrorsAPI.on('errors_aggregated', this.handleErrorsAggregated.bind(this));
    
    console.log('🚨 Frontend error collection started');
  }

  /**
   * 🔗 Set up integration events
   */
  setupIntegrationEvents() {
    // Listen for ORS changes from HCFP
    if (this.hcfpEngine) {
      this.hcfpEngine.on('ors_updated', this.handleORSUpdated.bind(this));
    }
    
    // Listen for AI router events
    if (this.aiRouter) {
      this.aiRouter.on('provider_degraded', this.handleProviderDegraded.bind(this));
    }
  }

  /**
   * 🏥 Handle health checks completed
   */
  handleHealthChecksCompleted(data) {
    this.currentHealthStatus = data.results;
    this.lastHealthCheck = data.timestamp;
    
    console.log(`🏥 Website health check completed: ${data.overall_health.score}% (${data.overall_health.status})`);
    
    // Update HCFP with health status
    if (this.hcfpEngine) {
      this.hcfpEngine.recordPerformance({
        source: 'website_health_monitor',
        health_score: data.overall_health.score,
        total_checks: data.overall_health.total_checks,
        passed_checks: data.overall_health.passed_checks,
        avg_response_time: data.overall_health.avg_response_time_ms,
        js_error_count: data.overall_health.js_error_count,
        timestamp: data.timestamp
      });
    }
    
    this.emit('health_status_updated', {
      health_status: data.results,
      overall_health: data.overall_health,
      timestamp: data.timestamp
    });
  }

  /**
   * 🚨 Handle critical website health
   */
  async handleCriticalWebsiteHealth(data) {
    console.log('🚨 CRITICAL WEBSITE HEALTH DETECTED');
    console.log(`Health score: ${data.health_result.score}%`);
    console.log(`ORS impact: ${data.ors_impact} points`);
    
    // Record alert
    const alert = {
      type: 'critical_website_health',
      severity: 'critical',
      health_result: data.health_result,
      ors_impact: data.ors_impact,
      timestamp: new Date(),
      actions_taken: []
    };
    
    this.alertHistory.push(alert);
    
    // Trigger auto-healing if enabled
    if (this.config.auto_healing_enabled) {
      await this.triggerAutoHealing(alert);
    }
    
    // Notify HCFP engine
    if (this.hcfpEngine) {
      this.hcfpEngine.emit('critical_alert', alert);
    }
    
    this.emit('critical_alert', alert);
  }

  /**
   * 📊 Handle ORS impact calculated
   */
  handleORSImpactCalculated(data) {
    this.orsImpact = data.ors_impact;
    
    console.log(`📊 Website health ORS impact: ${data.ors_impact} points`);
    
    // Update HCFP engine with ORS impact
    if (this.hcfpEngine) {
      // This would integrate with HCFP's ORS calculation
      this.hcfpEngine.emit('ors_impact', {
        source: 'website_health',
        impact: data.ors_impact,
        health_score: data.health_score,
        js_error_count: data.js_error_count
      });
    }
    
    this.emit('ors_impact_updated', data);
  }

  /**
   * 🚨 Handle errors received from frontend
   */
  handleErrorsReceived(data) {
    console.log(`🚨 Received ${data.errors.length} frontend errors from ${data.page_info?.url || 'unknown'}`);
    
    // Analyze error patterns
    const analysis = this.analyzeErrorPatterns(data.errors);
    
    // Update HCFP with error data
    if (this.hcfpEngine) {
      this.hcfpEngine.recordPerformance({
        source: 'frontend_errors',
        error_count: data.errors.length,
        error_types: analysis.error_types,
        user_facing_errors: analysis.user_facing_errors,
        page_url: data.page_info?.url,
        timestamp: data.timestamp
      });
    }
    
    // Check for critical error patterns
    if (analysis.critical_patterns.length > 0) {
      this.handleCriticalErrorPatterns(analysis.critical_patterns, data);
    }
    
    this.emit('frontend_errors_received', {
      ...data,
      analysis
    });
  }

  /**
   * 🚨 Handle error alerts
   */
  handleErrorAlert(data) {
    console.log(`🚨 Frontend error alert: ${data.error_type} count (${data.count}) exceeds threshold (${data.threshold})`);
    
    const alert = {
      type: 'frontend_error_rate',
      severity: 'high',
      error_type: data.error_type,
      count: data.count,
      threshold: data.threshold,
      timestamp: new Date()
    };
    
    this.alertHistory.push(alert);
    
    // Trigger auto-healing for critical error types
    if (data.error_type === 'dead_button' || data.error_type === 'dead_link') {
      if (this.config.auto_healing_enabled) {
        this.triggerUIHealing(alert);
      }
    }
    
    this.emit('error_alert', alert);
  }

  /**
   * 📈 Handle errors aggregated
   */
  handleErrorsAggregated(data) {
    console.log(`📈 Aggregated ${Object.keys(data.aggregates).length} error types for minute ${data.minute_key}`);
    
    // Calculate trends and patterns
    const trends = this.calculateErrorTrends(data.aggregates);
    
    // Update HCFP with aggregated data
    if (this.hcfpEngine) {
      this.hcfpEngine.recordPerformance({
        source: 'frontend_errors_aggregated',
        aggregates: data.aggregates,
        trends: trends,
        timestamp: data.timestamp
      });
    }
    
    this.emit('errors_aggregated', {
      ...data,
      trends
    });
  }

  /**
   * 🔄 Handle ORS updated from HCFP
   */
  handleORSUpdated(data) {
    console.log(`🔄 ORS updated: ${data.ors} (previous: ${data.previous_ors})`);
    
    // If ORS dropped significantly due to website issues, trigger healing
    if (data.ors < 50 && this.orsImpact < -20) {
      this.triggerEmergencyHealing({
        type: 'ors_drop',
        current_ors: data.ors,
        previous_ors: data.previous_ors,
        website_impact: this.orsImpact
      });
    }
  }

  /**
   * 🔧 Handle provider degraded from AI router
   */
  handleProviderDegraded(data) {
    console.log(`🔧 AI provider degraded: ${data.provider} (${data.health_score})`);
    
    // Provider degradation might affect website functionality
    if (data.health_score < 0.7) {
      this.triggerProviderHealing(data);
    }
  }

  /**
   * 🔍 Analyze error patterns
   */
  analyzeErrorPatterns(errors) {
    const analysis = {
      error_types: {},
      severities: {},
      categories: {},
      user_facing_errors: 0,
      critical_patterns: []
    };
    
    errors.forEach(error => {
      // Count by type
      analysis.error_types[error.type] = (analysis.error_types[error.type] || 0) + 1;
      
      // Count by severity
      analysis.severities[error.severity] = (analysis.severities[error.severity] || 0) + 1;
      
      // Count by category
      analysis.categories[error.category] = (analysis.categories[error.category] || 0) + 1;
      
      // Count user-facing errors
      if (error.enriched?.is_user_facing) {
        analysis.user_facing_errors++;
      }
      
      // Identify critical patterns
      if (error.severity === 'critical' || error.type === 'dead_button' || error.type === 'dead_link') {
        analysis.critical_patterns.push(error);
      }
    });
    
    return analysis;
  }

  /**
   * 📈 Calculate error trends
   */
  calculateErrorTrends(aggregates) {
    const trends = {};
    
    for (const [key, aggregate] of Object.entries(aggregates)) {
      trends[key] = {
        count: aggregate.count,
        severity_distribution: aggregate.severities,
        trend: 'stable' // In real implementation, would compare with previous periods
      };
    }
    
    return trends;
  }

  /**
   * 🚨 Handle critical error patterns
   */
  async handleCriticalErrorPatterns(patterns, errorData) {
    console.log(`🚨 Critical error patterns detected: ${patterns.length} patterns`);
    
    for (const pattern of patterns) {
      if (pattern.type === 'dead_button' || pattern.type === 'dead_link') {
        // Create UI healing task
        await this.createUIHealingTask(pattern, errorData);
      }
    }
  }

  /**
   * 🏥 Trigger auto-healing
   */
  async triggerAutoHealing(alert) {
    console.log('🏥 Triggering auto-healing for critical website health');
    
    // Create healing tasks through HCFP
    if (this.hcfpEngine) {
      const healingTask = {
        id: `heal-website-${Date.now()}`,
        type: 'website_healing',
        priority: 'critical',
        alert: alert,
        actions: [
          'check_dns_configuration',
          'verify_ssl_certificates',
          'test_api_endpoints',
          'validate_frontend_build',
          'restart_services_if_needed'
        ]
      };
      
      // Submit to HCFP for execution
      this.hcfpEngine.emit('healing_task_created', healingTask);
      
      alert.actions_taken.push('hcfp_healing_task_created');
    }
  }

  /**
   * 🎨 Trigger UI healing
   */
  async triggerUIHealing(alert) {
    console.log(`🎨 Triggering UI healing for ${alert.error_type}`);
    
    // Create UI-specific healing task
    const uiHealingTask = {
      id: `heal-ui-${Date.now()}`,
      type: 'ui_healing',
      priority: 'high',
      alert: alert,
      actions: [
        'analyze_dead_elements',
        'fix_click_handlers',
        'update_event_listeners',
        'validate_form_actions'
      ]
    };
    
    if (this.hcfpEngine) {
      this.hcfpEngine.emit('ui_healing_task_created', uiHealingTask);
    }
    
    alert.actions_taken.push('ui_healing_task_created');
  }

  /**
   * 🚨 Trigger emergency healing
   */
  async triggerEmergencyHealing(data) {
    console.log('🚨 Triggering emergency healing for ORS drop');
    
    const emergencyTask = {
      id: `emergency-heal-${Date.now()}`,
      type: 'emergency_healing',
      priority: 'critical',
      data: data,
      actions: [
        'immediate_health_check',
        'service_restart',
        'rollback_if_needed',
        'escalate_to_human'
      ]
    };
    
    if (this.hcfpEngine) {
      this.hcfpEngine.emit('emergency_healing_task_created', emergencyTask);
    }
  }

  /**
   * 🔧 Trigger provider healing
   */
  async triggerProviderHealing(data) {
    console.log(`🔧 Triggering provider healing for ${data.provider}`);
    
    const providerTask = {
      id: `heal-provider-${Date.now()}`,
      type: 'provider_healing',
      priority: 'high',
      data: data,
      actions: [
        'switch_to_backup_provider',
        'adjust_routing_weights',
        'monitor_provider_health'
      ]
    };
    
    if (this.aiRouter) {
      this.aiRouter.emit('provider_healing_task_created', providerTask);
    }
  }

  /**
   * 🎨 Create UI healing task
   */
  async createUIHealingTask(pattern, errorData) {
    const task = {
      id: `ui-heal-${pattern.id || Date.now()}`,
      type: 'ui_element_healing',
      priority: 'high',
      pattern: pattern,
      page_info: errorData.page_info,
      suggested_fix: pattern.enriched?.suggested_action,
      actions: [
        'locate_element',
        'analyze_functionality',
        'implement_fix',
        'test_fix',
        'deploy_fix'
      ]
    };
    
    if (this.hcfpEngine) {
      this.hcfpEngine.emit('ui_healing_task_created', task);
    }
  }

  /**
   * 📊 Get current status
   */
  getStatus() {
    return {
      website_monitoring: this.websiteMonitor ? this.getWebsiteMonitorStatus() : null,
      frontend_errors: this.frontendErrorsAPI ? this.getFrontendErrorsStatus() : null,
      current_health_status: this.currentHealthStatus,
      ors_impact: this.orsImpact,
      last_health_check: this.lastHealthCheck,
      recent_alerts: this.alertHistory.slice(-10),
      integration_status: {
        hcfp_connected: !!this.hcfpEngine,
        ai_router_connected: !!this.aiRouter
      }
    };
  }

  /**
   * 🌐 Get website monitor status
   */
  getWebsiteMonitorStatus() {
    return this.websiteMonitor ? this.websiteMonitor.getHealthStatus() : null;
  }

  /**
   * 🚨 Get frontend errors status
   */
  getFrontendErrorsStatus() {
    if (!this.frontendErrorsAPI) return null;
    
    // This would call the API's stats endpoint
    return {
      buffer_size: this.frontendErrorsAPI.errorBuffer.length,
      aggregates_count: this.frontendErrorsAPI.errorAggregates.size,
      recent_error_counts: this.frontendErrorsAPI.getRecentErrorCounts()
    };
  }

  /**
   * 📋 Get frontend error collector script
   */
  getFrontendErrorCollectorScript() {
    const scriptPath = require.resolve('../monitoring/frontend-error-collector.js');
    return scriptPath;
  }

  /**
   * 🛠️ Get Express router for frontend errors API
   */
  getFrontendErrorsRouter() {
    return this.frontendErrorsAPI ? this.frontendErrorsAPI.createRouter() : null;
  }
}

module.exports = WebsiteHealthIntegration;
