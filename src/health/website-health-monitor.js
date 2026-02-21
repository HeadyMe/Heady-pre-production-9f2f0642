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
// ║  FILE: website-health-monitor.js                                 ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Website Health Monitor
 * Real-time monitoring of critical website endpoints with ORS integration
 */

const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

class WebsiteHealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      timeout: config.timeout || 10000, // 10 seconds
      failureThreshold: config.failureThreshold || 3,
      recoveryThreshold: config.recoveryThreshold || 2,
      ...config
    };
    
    this.endpoints = new Map();
    this.healthHistory = new Map();
    this.orsImpact = new Map();
    this.isRunning = false;
    this.checkTimer = null;
    
    // Initialize with critical endpoints
    this.initializeCriticalEndpoints();
  }

  initializeCriticalEndpoints() {
    // HeadyMe endpoints
    this.addEndpoint('headyme_public', {
      url: 'https://headyme.com/health',
      name: 'HeadyMe Public',
      expectedStatus: 200,
      contentCheck: 'ok',
      critical: true,
      orsImpact: 'high'
    });
    
    this.addEndpoint('headyme_api', {
      url: 'https://api.headyme.com/health',
      name: 'HeadyMe API',
      expectedStatus: 200,
      contentCheck: 'healthy',
      critical: true,
      orsImpact: 'high'
    });
    
    this.addEndpoint('headyme_admin', {
      url: 'https://admin.headyme.com/health',
      name: 'HeadyMe Admin',
      expectedStatus: 200,
      contentCheck: 'admin_ok',
      critical: true,
      orsImpact: 'high'
    });
    
    // HeadySystems endpoints
    this.addEndpoint('headysystems_app', {
      url: 'https://app.headysystems.com/health',
      name: 'HeadySystems App',
      expectedStatus: 200,
      contentCheck: 'systems_ok',
      critical: true,
      orsImpact: 'medium'
    });
    
    this.addEndpoint('headysystems_api', {
      url: 'https://api.headysystems.com/health',
      name: 'HeadySystems API',
      expectedStatus: 200,
      contentCheck: 'api_healthy',
      critical: true,
      orsImpact: 'medium'
    });
    
    // HeadyConnection endpoints
    this.addEndpoint('headyconnection_app', {
      url: 'https://app.headyconnection.org/health',
      name: 'HeadyConnection App',
      expectedStatus: 200,
      contentCheck: 'connection_ok',
      critical: true,
      orsImpact: 'medium'
    });
    
    this.addEndpoint('headyconnection_api', {
      url: 'https://api.headyconnection.org/health',
      name: 'HeadyConnection API',
      expectedStatus: 200,
      contentCheck: 'connection_api_healthy',
      critical: true,
      orsImpact: 'medium'
    });
  }

  addEndpoint(id, config) {
    this.endpoints.set(id, {
      id,
      url: config.url,
      name: config.name,
      expectedStatus: config.expectedStatus || 200,
      contentCheck: config.contentCheck,
      critical: config.critical || false,
      orsImpact: config.orsImpact || 'low',
      timeout: config.timeout || this.config.timeout,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      status: 'unknown',
      lastCheck: null,
      lastSuccess: null,
      lastFailure: null,
      avgResponseTime: 0,
      totalChecks: 0,
      successfulChecks: 0
    });
    
    // Initialize health history
    if (!this.healthHistory.has(id)) {
      this.healthHistory.set(id, []);
    }
    
    // Initialize ORS impact tracking
    if (!this.orsImpact.has(id)) {
      this.orsImpact.set(id, {
        impact: config.orsImpact,
        lastFailure: null,
        failureCount: 0,
        orsDeduction: 0
      });
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('[WebsiteHealthMonitor] Already running');
      return;
    }
    
    console.log('[WebsiteHealthMonitor] Starting website health monitoring...');
    this.isRunning = true;
    
    // Run initial check
    await this.checkAllEndpoints();
    
    // Start periodic checks
    this.checkTimer = setInterval(() => {
      this.checkAllEndpoints().catch(error => {
        console.error('[WebsiteHealthMonitor] Error in periodic check:', error);
      });
    }, this.config.checkInterval);
    
    console.log(`[WebsiteHealthMonitor] Started with ${this.endpoints.size} endpoints, checking every ${this.config.checkInterval/1000}s`);
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('[WebsiteHealthMonitor] Stopping website health monitoring...');
    this.isRunning = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    console.log('[WebsiteHealthMonitor] Stopped');
  }

  async checkAllEndpoints() {
    const checkPromises = Array.from(this.endpoints.keys()).map(id => 
      this.checkEndpoint(id).catch(error => {
        console.error(`[WebsiteHealthMonitor] Error checking ${id}:`, error);
      })
    );
    
    await Promise.allSettled(checkPromises);
    
    // Calculate overall health and emit status
    const overallHealth = this.calculateOverallHealth();
    this.emit('healthUpdate', overallHealth);
    
    // Update ORS if needed
    const orsImpact = this.calculateORSImpact();
    if (orsImpact.hasChanges) {
      this.emit('orsUpdate', orsImpact);
    }
  }

  async checkEndpoint(endpointId) {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointId} not found`);
    }
    
    const startTime = Date.now();
    endpoint.lastCheck = new Date().toISOString();
    endpoint.totalChecks++;
    
    try {
      const result = await this.makeHttpRequest(endpoint.url, endpoint.timeout);
      const responseTime = Date.now() - startTime;
      
      // Update response time average
      endpoint.avgResponseTime = 
        (endpoint.avgResponseTime * (endpoint.totalChecks - 1) + responseTime) / endpoint.totalChecks;
      
      // Check response
      const isHealthy = this.validateResponse(result, endpoint);
      
      if (isHealthy) {
        this.handleSuccess(endpoint, responseTime, result);
      } else {
        this.handleFailure(endpoint, responseTime, result);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleFailure(endpoint, responseTime, { error: error.message });
    }
    
    // Record in history
    this.recordHealthCheck(endpointId, endpoint);
    
    return endpoint;
  }

  async makeHttpRequest(url, timeout) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.get(url, { timeout }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            url
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
      
      req.setTimeout(timeout);
    });
  }

  validateResponse(response, endpoint) {
    // Check status code
    if (response.statusCode !== endpoint.expectedStatus) {
      return false;
    }
    
    // Check content if specified
    if (endpoint.contentCheck && response.body) {
      return response.body.includes(endpoint.contentCheck);
    }
    
    return true;
  }

  handleSuccess(endpoint, responseTime, response) {
    endpoint.consecutiveFailures = 0;
    endpoint.consecutiveSuccesses++;
    endpoint.status = 'healthy';
    endpoint.lastSuccess = new Date().toISOString();
    
    console.log(`[WebsiteHealthMonitor] ✅ ${endpoint.name}: ${response.statusCode} (${responseTime}ms)`);
    
    // Reset ORS impact on recovery
    const impact = this.orsImpact.get(endpoint.id);
    if (impact.failureCount > 0) {
      impact.failureCount = 0;
      impact.orsDeduction = 0;
      console.log(`[WebsiteHealthMonitor] 📈 ORS impact reset for ${endpoint.name}`);
    }
    
    this.emit('endpointHealthy', endpoint);
  }

  handleFailure(endpoint, responseTime, response) {
    endpoint.consecutiveFailures++;
    endpoint.consecutiveSuccesses = 0;
    endpoint.status = 'unhealthy';
    endpoint.lastFailure = new Date().toISOString();
    
    console.log(`[WebsiteHealthMonitor] ❌ ${endpoint.name}: ${response.statusCode || 'ERROR'} (${responseTime}ms) - ${response.error || 'Content check failed'}`);
    
    // Update ORS impact
    const impact = this.orsImpact.get(endpoint.id);
    impact.failureCount++;
    impact.lastFailure = new Date().toISOString();
    
    // Calculate ORS deduction based on criticality and failure count
    if (endpoint.critical) {
      impact.orsDeduction = Math.min(impact.failureCount * 10, 30); // Max 30 points deduction
    } else {
      impact.orsDeduction = Math.min(impact.failureCount * 5, 15); // Max 15 points deduction
    }
    
    this.emit('endpointUnhealthy', endpoint);
    
    // Alert on critical failures
    if (endpoint.critical && endpoint.consecutiveFailures >= this.config.failureThreshold) {
      this.emit('criticalFailure', endpoint);
    }
  }

  recordHealthCheck(endpointId, endpoint) {
    const history = this.healthHistory.get(endpointId);
    if (!history) return;
    
    history.push({
      timestamp: endpoint.lastCheck,
      status: endpoint.status,
      responseTime: endpoint.avgResponseTime,
      statusCode: endpoint.lastSuccess ? '200' : 'ERROR',
      consecutiveFailures: endpoint.consecutiveFailures,
      consecutiveSuccesses: endpoint.consecutiveSuccesses
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  calculateOverallHealth() {
    const endpoints = Array.from(this.endpoints.values());
    const totalEndpoints = endpoints.length;
    const healthyEndpoints = endpoints.filter(ep => ep.status === 'healthy').length;
    const criticalEndpoints = endpoints.filter(ep => ep.critical);
    const healthyCritical = criticalEndpoints.filter(ep => ep.status === 'healthy').length;
    
    const overallHealth = {
      status: healthyEndpoints === totalEndpoints ? 'healthy' : 
              healthyCritical === criticalEndpoints.length ? 'degraded' : 'critical',
      totalEndpoints,
      healthyEndpoints,
      criticalEndpoints: criticalEndpoints.length,
      healthyCritical,
      timestamp: new Date().toISOString(),
      details: endpoints.map(ep => ({
        id: ep.id,
        name: ep.name,
        status: ep.status,
        critical: ep.critical,
        consecutiveFailures: ep.consecutiveFailures,
        avgResponseTime: ep.avgResponseTime,
        lastCheck: ep.lastCheck
      }))
    };
    
    return overallHealth;
  }

  calculateORSImpact() {
    let totalDeduction = 0;
    let hasChanges = false;
    
    for (const [endpointId, impact] of this.orsImpact) {
      if (impact.orsDeduction > 0) {
        totalDeduction += impact.orsDeduction;
        hasChanges = true;
      }
    }
    
    return {
      hasChanges,
      totalDeduction,
      recommendedORS: Math.max(0, 100 - totalDeduction),
      impacts: Array.from(this.orsImpact.entries()).map(([id, impact]) => ({
        endpointId: id,
        impact: impact.impact,
        failureCount: impact.failureCount,
        orsDeduction: impact.orsDeduction,
        lastFailure: impact.lastFailure
      })),
      timestamp: new Date().toISOString()
    };
  }

  getHealthStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.config.checkInterval,
      overallHealth: this.calculateOverallHealth(),
      orsImpact: this.calculateORSImpact(),
      endpoints: Array.from(this.endpoints.values()).map(ep => ({
        id: ep.id,
        name: ep.name,
        url: ep.url,
        status: ep.status,
        critical: ep.critical,
        consecutiveFailures: ep.consecutiveFailures,
        avgResponseTime: ep.avgResponseTime,
        totalChecks: ep.totalChecks,
        successRate: ep.totalChecks > 0 ? (ep.successfulChecks / ep.totalChecks) : 0,
        lastCheck: ep.lastCheck,
        lastSuccess: ep.lastSuccess,
        lastFailure: ep.lastFailure
      })),
      timestamp: new Date().toISOString()
    };
  }

  getEndpointHistory(endpointId, limit = 50) {
    const history = this.healthHistory.get(endpointId) || [];
    return history.slice(-limit);
  }

  // Manual check method for testing
  async manualCheck(endpointId) {
    return await this.checkEndpoint(endpointId);
  }

  // Add custom endpoint
  addCustomEndpoint(id, url, options = {}) {
    this.addEndpoint(id, {
      url,
      name: options.name || id,
      expectedStatus: options.expectedStatus || 200,
      contentCheck: options.contentCheck,
      critical: options.critical || false,
      orsImpact: options.orsImpact || 'low',
      timeout: options.timeout
    });
    
    console.log(`[WebsiteHealthMonitor] Added custom endpoint: ${id} -> ${url}`);
  }

  // Remove endpoint
  removeEndpoint(endpointId) {
    const removed = this.endpoints.delete(endpointId);
    if (removed) {
      this.healthHistory.delete(endpointId);
      this.orsImpact.delete(endpointId);
      console.log(`[WebsiteHealthMonitor] Removed endpoint: ${endpointId}`);
    }
    return removed;
  }
}

module.exports = WebsiteHealthMonitor;
