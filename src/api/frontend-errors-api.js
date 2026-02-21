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
// ║  FILE: frontend-errors-api.js                                ║
// ║  UPDATED: 20260219-220500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🚨 Frontend Errors API
 * 
 * REST API endpoint to receive frontend error reports and integrate
 * them with the HCFP Full Auto health monitoring system.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class FrontendErrorsAPI extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      storage_path: config.storage_path || path.join(__dirname, '../../data/frontend-errors'),
      max_errors_per_hour: config.max_errors_per_hour || 1000,
      retention_days: config.retention_days || 30,
      aggregation_interval_ms: config.aggregation_interval_ms || 60000, // 1 minute
      alert_thresholds: {
        javascript_errors_per_minute: config.alert_thresholds?.javascript_errors_per_minute || 10,
        dead_buttons_per_minute: config.alert_thresholds?.dead_buttons_per_minute || 5,
        network_errors_per_minute: config.alert_thresholds?.network_errors_per_minute || 15
      },
      ...config
    };
    
    // Error storage
    this.errorBuffer = [];
    this.errorAggregates = new Map();
    this.errorCounts = new Map();
    this.performanceMetrics = new Map();
    
    // Timers
    this.aggregationTimer = null;
    this.cleanupTimer = null;
    
    // Initialize storage
    this.initializeStorage();
    
    console.log('[FrontendErrorsAPI] Initialized');
  }

  /**
   * 📁 Initialize storage
   */
  initializeStorage() {
    if (!fs.existsSync(this.config.storage_path)) {
      fs.mkdirSync(this.config.storage_path, { recursive: true });
    }
    
    // Start aggregation timer
    this.startAggregation();
    
    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * 🚀 Create Express router
   */
  createRouter() {
    const router = express.Router();
    
    // POST /api/frontend-errors - Receive error reports
    router.post('/', this.handleErrorsPost.bind(this));
    
    // GET /api/frontend-errors/health - API health check
    router.get('/health', this.handleHealthCheck.bind(this));
    
    // GET /api/frontend-errors/stats - Get error statistics
    router.get('/stats', this.handleStats.bind(this));
    
    // GET /api/frontend-errors/recent - Get recent errors
    router.get('/recent', this.handleRecentErrors.bind(this));
    
    // GET /api/frontend-errors/aggregates - Get aggregated error data
    router.get('/aggregates', this.handleAggregates.bind(this));
    
    // POST /api/frontend-errors/test - Test endpoint
    router.post('/test', this.handleTest.bind(this));
    
    return router;
  }

  /**
   * 📨 Handle error reports POST
   */
  async handleErrorsPost(req, res) {
    try {
      const { errors, performance_metrics, page_info, timestamp } = req.body;
      
      if (!errors || !Array.isArray(errors)) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'errors array is required'
        });
      }
      
      // Rate limiting check
      const clientIP = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const hourKey = Math.floor(now / (60 * 60 * 1000));
      const rateLimitKey = `${clientIP}:${hourKey}`;
      
      const currentCount = this.errorCounts.get(rateLimitKey) || 0;
      if (currentCount + errors.length > this.config.max_errors_per_hour) {
        return res.status(429).json({
          error: 'rate_limited',
          message: 'Too many error reports'
        });
      }
      
      this.errorCounts.set(rateLimitKey, currentCount + errors.length);
      
      // Process each error
      const processedErrors = errors.map(error => this.processError(error, page_info, clientIP));
      
      // Add to buffer
      this.errorBuffer.push(...processedErrors);
      
      // Update performance metrics
      if (performance_metrics) {
        this.updatePerformanceMetrics(page_info?.url, performance_metrics);
      }
      
      // Check for alert conditions
      this.checkAlertConditions(processedErrors);
      
      // Store errors
      await this.storeErrors(processedErrors);
      
      // Emit event for HCFP integration
      this.emit('errors_received', {
        errors: processedErrors,
        performance_metrics,
        page_info,
        client_ip: clientIP,
        timestamp: new Date()
      });
      
      res.json({
        status: 'success',
        processed_errors: processedErrors.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Frontend errors API error:', error);
      res.status(500).json({
        error: 'internal_error',
        message: error.message
      });
    }
  }

  /**
   * 🔍 Process individual error
   */
  processError(error, pageInfo, clientIP) {
    const processedError = {
      id: this.generateErrorId(),
      ...error,
      page_info: pageInfo,
      client_ip: clientIP,
      received_at: new Date(),
      severity: this.calculateSeverity(error)
    };
    
    // Add categorization
    processedError.category = this.categorizeError(error);
    
    // Add enrichment
    processedError.enriched = {
      is_user_facing: this.isUserFacingError(error),
      impact_level: this.calculateImpactLevel(error),
      suggested_action: this.suggestAction(error)
    };
    
    return processedError;
  }

  /**
   * 📊 Calculate error severity
   */
  calculateSeverity(error) {
    const severityMap = {
      'javascript_error': 'high',
      'unhandled_rejection': 'high',
      'dead_button': 'critical',
      'dead_link': 'critical',
      'malformed_form': 'medium',
      'resource_error': 'medium',
      'network_error': 'medium',
      'http_error': 'low',
      'manual_report': 'medium'
    };
    
    return severityMap[error.type] || 'low';
  }

  /**
   * 📂 Categorize error
   */
  categorizeError(error) {
    const categoryMap = {
      'javascript_error': 'code_quality',
      'unhandled_rejection': 'code_quality',
      'dead_button': 'user_interface',
      'dead_link': 'user_interface',
      'malformed_form': 'user_interface',
      'resource_error': 'infrastructure',
      'network_error': 'infrastructure',
      'http_error': 'api_integration',
      'manual_report': 'user_reported'
    };
    
    return categoryMap[error.type] || 'other';
  }

  /**
   * 👥 Determine if error is user-facing
   */
  isUserFacingError(error) {
    const userFacingTypes = ['dead_button', 'dead_link', 'malformed_form'];
    return userFacingTypes.includes(error.type);
  }

  /**
   * 💥 Calculate impact level
   */
  calculateImpactLevel(error) {
    if (error.type === 'dead_button' || error.type === 'dead_link') {
      return 'high'; // Directly impacts user interaction
    }
    
    if (error.type === 'javascript_error' && error.message.includes('Uncaught')) {
      return 'high'; // Unhandled JS errors
    }
    
    if (error.type === 'network_error' || error.type === 'http_error') {
      return 'medium'; // May impact functionality
    }
    
    return 'low';
  }

  /**
   * 💡 Suggest action for error
   */
  suggestAction(error) {
    const actionMap = {
      'dead_button': 'Fix button click handler or add functionality',
      'dead_link': 'Update link href or add click handler',
      'malformed_form': 'Add form action and method attributes',
      'javascript_error': 'Fix JavaScript syntax or logic error',
      'network_error': 'Check network connectivity and API endpoints',
      'http_error': 'Fix API endpoint or handle error responses',
      'resource_error': 'Fix broken resource links or missing files'
    };
    
    return actionMap[error.type] || 'Investigate error details';
  }

  /**
   * 🆔 Generate error ID
   */
  generateErrorId() {
    return 'error_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 📈 Update performance metrics
   */
  updatePerformanceMetrics(pageUrl, metrics) {
    if (!pageUrl) return;
    
    if (!this.performanceMetrics.has(pageUrl)) {
      this.performanceMetrics.set(pageUrl, {
        page_load_times: [],
        dom_interactive_times: [],
        user_interaction_failures: 0,
        javascript_errors: 0,
        network_failures: 0,
        last_updated: new Date()
      });
    }
    
    const pageMetrics = this.performanceMetrics.get(pageUrl);
    
    if (metrics.page_load_time) {
      pageMetrics.page_load_times.push(metrics.page_load_time);
    }
    
    if (metrics.dom_interactive_time) {
      pageMetrics.dom_interactive_times.push(metrics.dom_interactive_time);
    }
    
    pageMetrics.user_interaction_failures += metrics.user_interaction_failures || 0;
    pageMetrics.javascript_errors += metrics.javascript_errors || 0;
    pageMetrics.network_failures += metrics.network_failures || 0;
    pageMetrics.last_updated = new Date();
    
    // Keep only recent metrics (last 100 values)
    if (pageMetrics.page_load_times.length > 100) {
      pageMetrics.page_load_times = pageMetrics.page_load_times.slice(-100);
    }
    if (pageMetrics.dom_interactive_times.length > 100) {
      pageMetrics.dom_interactive_times = pageMetrics.dom_interactive_times.slice(-100);
    }
  }

  /**
   * 🚨 Check alert conditions
   */
  checkAlertConditions(errors) {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);
    
    // Count errors by type in the last minute
    const errorCounts = {};
    errors.forEach(error => {
      errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
    });
    
    // Check thresholds
    for (const [errorType, count] of Object.entries(errorCounts)) {
      const threshold = this.config.alert_thresholds[`${errorType}_per_minute`];
      if (threshold && count > threshold) {
        this.emit('alert_triggered', {
          type: 'error_rate_exceeded',
          error_type: errorType,
          count: count,
          threshold: threshold,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * 💾 Store errors
   */
  async storeErrors(errors) {
    const today = new Date().toISOString().split('T')[0];
    const filePath = path.join(this.config.storage_path, `errors-${today}.json`);
    
    try {
      let existingErrors = [];
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        existingErrors = JSON.parse(content);
      }
      
      existingErrors.push(...errors);
      
      // Keep only recent errors (last 10000 per day)
      if (existingErrors.length > 10000) {
        existingErrors = existingErrors.slice(-10000);
      }
      
      fs.writeFileSync(filePath, JSON.stringify(existingErrors, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to store errors:', error);
    }
  }

  /**
   * 🏥 Handle health check
   */
  handleHealthCheck(req, res) {
    res.json({
      status: 'healthy',
      buffer_size: this.errorBuffer.length,
      aggregates_count: this.errorAggregates.size,
      uptime: process.uptime(),
      timestamp: new Date()
    });
  }

  /**
   * 📊 Handle stats request
   */
  handleStats(req, res) {
    const stats = {
      total_errors_buffered: this.errorBuffer.length,
      aggregates_count: this.errorAggregates.size,
      performance_metrics_count: this.performanceMetrics.size,
      recent_error_counts: this.getRecentErrorCounts(),
      top_error_types: this.getTopErrorTypes(),
      top_pages_with_errors: this.getTopPagesWithErrors(),
      timestamp: new Date()
    };
    
    res.json(stats);
  }

  /**
   * 📋 Handle recent errors request
   */
  handleRecentErrors(req, res) {
    const limit = parseInt(req.query.limit) || 50;
    const recentErrors = this.errorBuffer.slice(-limit);
    
    res.json({
      errors: recentErrors,
      total: this.errorBuffer.length,
      timestamp: new Date()
    });
  }

  /**
   * 📈 Handle aggregates request
   */
  handleAggregates(req, res) {
    const aggregates = Object.fromEntries(this.errorAggregates);
    
    res.json({
      aggregates,
      count: this.errorAggregates.size,
      timestamp: new Date()
    });
  }

  /**
   * 🧪 Handle test request
   */
  handleTest(req, res) {
    const testError = {
      type: 'test_error',
      message: 'This is a test error from frontend error collector',
      timestamp: Date.now(),
      url: 'https://headyme.com/test'
    };
    
    this.errorBuffer.push(this.processError(testError, {}, req.ip));
    
    res.json({
      status: 'test_error_added',
      buffer_size: this.errorBuffer.length,
      timestamp: new Date()
    });
  }

  /**
   * 📊 Get recent error counts
   */
  getRecentErrorCounts() {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    const recentErrors = this.errorBuffer.filter(error => 
      error.received_at.getTime() > hourAgo
    );
    
    const counts = {};
    recentErrors.forEach(error => {
      counts[error.type] = (counts[error.type] || 0) + 1;
    });
    
    return counts;
  }

  /**
   * 🏆 Get top error types
   */
  getTopErrorTypes() {
    const counts = {};
    this.errorBuffer.forEach(error => {
      counts[error.type] = (counts[error.type] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * 🌐 Get top pages with errors
   */
  getTopPagesWithErrors() {
    const counts = {};
    this.errorBuffer.forEach(error => {
      const url = error.page_info?.url || 'unknown';
      counts[url] = (counts[url] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));
  }

  /**
   * ⏰ Start aggregation timer
   */
  startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateErrors();
    }, this.config.aggregation_interval_ms);
  }

  /**
   * 📊 Aggregate errors
   */
  aggregateErrors() {
    if (this.errorBuffer.length === 0) return;
    
    const now = new Date();
    const minuteKey = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Aggregate errors by type and page
    const aggregates = {};
    this.errorBuffer.forEach(error => {
      const key = `${error.type}:${error.page_info?.url || 'unknown'}`;
      if (!aggregates[key]) {
        aggregates[key] = {
          type: error.type,
          page: error.page_info?.url || 'unknown',
          count: 0,
          severities: {},
          last_seen: error.received_at
        };
      }
      
      aggregates[key].count++;
      aggregates[key].severities[error.severity] = (aggregates[key].severities[error.severity] || 0) + 1;
      
      if (error.received_at > aggregates[key].last_seen) {
        aggregates[key].last_seen = error.received_at;
      }
    });
    
    // Store aggregates
    this.errorAggregates.set(minuteKey, aggregates);
    
    // Keep only recent aggregates (last 1440 minutes = 24 hours)
    if (this.errorAggregates.size > 1440) {
      const keysToDelete = Array.from(this.errorAggregates.keys()).slice(0, -1440);
      keysToDelete.forEach(key => this.errorAggregates.delete(key));
    }
    
    // Clear buffer
    this.errorBuffer = [];
    
    this.emit('errors_aggregated', {
      minute_key: minuteKey,
      aggregates,
      timestamp: now
    });
  }

  /**
   * 🧹 Start cleanup timer
   */
  startCleanup() {
    // Run cleanup every 24 hours
    const cleanupInterval = 24 * 60 * 60 * 1000;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, cleanupInterval);
  }

  /**
   * 🧹 Clean up old data
   */
  cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retention_days);
    
    try {
      const files = fs.readdirSync(this.config.storage_path);
      
      files.forEach(file => {
        if (file.startsWith('errors-') && file.endsWith('.json')) {
          const filePath = path.join(this.config.storage_path, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log(`🧹 Cleaned up old error file: ${file}`);
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * 🛑 Stop the API
   */
  stop() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    console.log('[FrontendErrorsAPI] Stopped');
  }
}

module.exports = FrontendErrorsAPI;
