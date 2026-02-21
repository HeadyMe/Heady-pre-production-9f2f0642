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
// ║  FILE: health-checks.js                              ║
// ║  UPDATED: 20260219-162200                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Comprehensive Health Check System
 * Monitors all production domains and APIs automatically
 */

const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

class HealthCheckSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.checkInterval = options.interval || 30000; // 30 seconds
    this.timeout = options.timeout || 5000; // 5 seconds
    this.history = new Map();
    this.alerts = [];
    this.isRunning = false;
    this.checkTimer = null;
    
    // Production domains only - NO localhost
    this.endpoints = {
      // HeadyMe.com
      'headyme.com': {
        url: 'https://headyme.com',
        expectedStatus: 200,
        expectedContent: ['Heady', 'heady'],
        critical: true,
        category: 'frontend'
      },
      'api.headyme.com': {
        url: 'https://api.headyme.com/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'api'
      },
      'admin.headyme.com': {
        url: 'https://admin.headyme.com',
        expectedStatus: 200,
        expectedContent: ['Admin', 'Dashboard'],
        critical: true,
        category: 'admin'
      },
      
      // HeadySystems.com
      'app.headysystems.com': {
        url: 'https://app.headysystems.com',
        expectedStatus: 200,
        expectedContent: ['HeadySystems', 'Systems'],
        critical: true,
        category: 'frontend'
      },
      'api.headysystems.com': {
        url: 'https://api.headysystems.com/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'api'
      },
      
      // HeadyConnection.org
      'app.headyconnection.org': {
        url: 'https://app.headyconnection.org',
        expectedStatus: 200,
        expectedContent: ['HeadyConnection', 'Connection'],
        critical: true,
        category: 'frontend'
      },
      'api.headyconnection.org': {
        url: 'https://api.headyconnection.org/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'api'
      },
      
      // HeadyBuddy.org
      'headybuddy.org': {
        url: 'https://headybuddy.org/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'assistant'
      },
      
      // HeadyMCP.com
      'headymcp.com': {
        url: 'https://headymcp.com/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'developer'
      },
      
      // HeadyIO.com (AI Brain)
      'headyio.com': {
        url: 'https://headyio.com/api/brain/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'ai-brain'
      },
      
      // Key Infrastructure Subdomains
      'manager.headysystems.com': {
        url: 'https://manager.headysystems.com/api/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'infrastructure'
      },
      'registry.headysystems.com': {
        url: 'https://registry.headysystems.com/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: true,
        category: 'infrastructure'
      },
      'soul.headysystems.com': {
        url: 'https://soul.headysystems.com/health',
        expectedStatus: 200,
        expectedContent: ['ok', 'healthy'],
        critical: false,
        category: 'ai-core'
      }
    };
  }

  async checkEndpoint(domain, config) {
    const startTime = Date.now();
    const result = {
      domain,
      url: config.url,
      timestamp: new Date().toISOString(),
      status: 'unknown',
      responseTime: 0,
      healthy: false,
      error: null,
      contentMatch: false,
      statusCode: null
    };

    try {
      const protocol = config.url.startsWith('https') ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const req = protocol.request(config.url, {
          method: 'GET',
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Heady-Health-Check/1.0'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ res, data }));
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });

      const { res, data } = response;
      result.responseTime = Date.now() - startTime;
      result.statusCode = res.statusCode;
      result.status = res.statusCode === config.expectedStatus ? 'ok' : 'error';

      // Check content
      if (config.expectedContent && config.expectedContent.length > 0) {
        result.contentMatch = config.expectedContent.some(content => 
          data.toLowerCase().includes(content.toLowerCase())
        );
      } else {
        result.contentMatch = true;
      }

      result.healthy = result.status === 'ok' && result.contentMatch;

    } catch (error) {
      result.responseTime = Date.now() - startTime;
      result.status = 'error';
      result.error = error.message;
      result.healthy = false;
    }

    return result;
  }

  async runAllChecks() {
    const results = {};
    const promises = Object.entries(this.endpoints).map(async ([domain, config]) => {
      const result = await this.checkEndpoint(domain, config);
      results[domain] = result;
      
      // Store in history
      if (!this.history.has(domain)) {
        this.history.set(domain, []);
      }
      const domainHistory = this.history.get(domain);
      domainHistory.unshift(result);
      
      // Keep only last 100 results
      if (domainHistory.length > 100) {
        domainHistory.pop();
      }
      
      // Emit events for real-time monitoring
      this.emit('checkResult', result);
      
      // Check for alerts
      this.checkForAlerts(result);
    });

    await Promise.all(promises);
    
    // Calculate overall system health
    const overallHealth = this.calculateOverallHealth(results);
    this.emit('overallHealth', overallHealth);
    
    return {
      timestamp: new Date().toISOString(),
      results,
      overall: overallHealth,
      alerts: this.alerts
    };
  }

  checkForAlerts(result) {
    const domain = result.domain;
    const history = this.history.get(domain) || [];
    
    // Check for consecutive failures
    if (!result.healthy) {
      const consecutiveFailures = history.filter(r => !r.healthy).length;
      
      if (consecutiveFailures === 1) {
        this.createAlert('warning', `${domain} first failure detected`, result);
      } else if (consecutiveFailures === 3) {
        this.createAlert('critical', `${domain} 3 consecutive failures`, result);
      } else if (consecutiveFailures >= 5) {
        this.createAlert('emergency', `${domain} ${consecutiveFailures} consecutive failures`, result);
      }
    } else {
      // Clear alerts if service recovers
      this.clearAlertsForDomain(domain);
    }
    
    // Check for slow response times
    if (result.responseTime > 3000) {
      this.createAlert('warning', `${domain} slow response time: ${result.responseTime}ms`, result);
    }
  }

  createAlert(level, message, result) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      domain: result.domain,
      timestamp: new Date().toISOString(),
      result: {
        status: result.status,
        responseTime: result.responseTime,
        error: result.error
      }
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
  }

  clearAlertsForDomain(domain) {
    this.alerts = this.alerts.filter(alert => alert.domain !== domain);
  }

  calculateOverallHealth(results) {
    const domains = Object.keys(results);
    const healthyDomains = domains.filter(domain => results[domain].healthy);
    const criticalDomains = domains.filter(domain => 
      this.endpoints[domain].critical && !results[domain].healthy
    );
    
    const healthScore = domains.length > 0 ? (healthyDomains.length / domains.length) * 100 : 0;
    
    let status = 'healthy';
    if (criticalDomains.length > 0) {
      status = 'critical';
    } else if (healthScore < 80) {
      status = 'degraded';
    } else if (healthScore < 100) {
      status = 'warning';
    }
    
    return {
      status,
      score: Math.round(healthScore),
      totalDomains: domains.length,
      healthyDomains: healthyDomains.length,
      criticalDomains: criticalDomains.length,
      timestamp: new Date().toISOString()
    };
  }

  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    console.log('🏥 Health Check System started - monitoring all production domains');
    
    // Run initial check
    this.runAllChecks();
    
    // Set up recurring checks
    this.checkTimer = setInterval(() => {
      this.runAllChecks();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    console.log('🏥 Health Check System stopped');
  }

  getHistory(domain, limit = 50) {
    const history = this.history.get(domain) || [];
    return history.slice(0, limit);
  }

  getAlerts(level = null) {
    if (level) {
      return this.alerts.filter(alert => alert.level === level);
    }
    return this.alerts;
  }

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      monitoredDomains: Object.keys(this.endpoints),
      totalAlerts: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.level === 'critical').length,
      lastCheck: this.lastCheck
    };
  }

  // Express.js middleware integration
  middleware() {
    return (req, res, next) => {
      req.healthCheck = this;
      next();
    };
  }

  // API routes for Express
  getRoutes() {
    const router = require('express').Router();
    
    router.get('/health', async (req, res) => {
      try {
        const results = await this.runAllChecks();
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    router.get('/status', (req, res) => {
      res.json(this.getSystemStatus());
    });
    
    router.get('/history/:domain', (req, res) => {
      const { domain } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      res.json(this.getHistory(domain, limit));
    });
    
    router.get('/alerts', (req, res) => {
      const { level } = req.query;
      res.json(this.getAlerts(level));
    });
    
    router.post('/start', (req, res) => {
      this.start();
      res.json({ message: 'Health checks started' });
    });
    
    router.post('/stop', (req, res) => {
      this.stop();
      res.json({ message: 'Health checks stopped' });
    });
    
    return router;
  }
}

// Singleton instance
let healthCheckInstance = null;

function getHealthCheckSystem(options = {}) {
  if (!healthCheckInstance) {
    healthCheckInstance = new HealthCheckSystem(options);
  }
  return healthCheckInstance;
}

module.exports = {
  HealthCheckSystem,
  getHealthCheckSystem
};
