// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██║  ██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: health-monitor.js                              ║
// ║  UPDATED: 20260219-220000                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Health Monitoring System for HCFP Full Auto Mode
 * Integrates with AI Router and ORS for intelligent system awareness
 */

let HCAiRouter;
try {
  try {
    ({ HCAiRouter } = require('../ai-router/hc-ai-router-simple'));
  } catch (err) {
    HCAiRouter = require('../ai-router/hc-ai-router-simple');
  }
} catch (err) {
  HCAiRouter = require('../ai-router/hc-ai-router-simple');
}
const winston = require('winston');

class HealthMonitor {
  constructor() {
    this.aiRouter = new HCAiRouter();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'health-monitor.log' })
      ]
    });
    
    this.healthChecks = new Map();
    this.orsHistory = [];
    this.alerts = [];
    this.lastHealthCheck = null;
  }

  async initialize() {
    await this.aiRouter.initialize();
    this.setupHealthChecks();
    this.logger.info('🏥 Health Monitor initialized with AI Router integration');
  }

  setupHealthChecks() {
    // AI Router Health
    this.healthChecks.set('ai_router', {
      interval: 60000, // 1 minute
      timeout: 5000,
      check: this.checkAiRouter.bind(this)
    });

    // System Resources
    this.healthChecks.set('system_resources', {
      interval: 30000, // 30 seconds
      timeout: 3000,
      check: this.checkSystemResources.bind(this)
    });

    // ORS Monitoring
    this.healthChecks.set('ors', {
      interval: 120000, // 2 minutes
      timeout: 2000,
      check: this.checkOrs.bind(this)
    });

    // Production Domain Health
    this.healthChecks.set('production_domains', {
      interval: 180000, // 3 minutes
      timeout: 10000,
      check: this.checkProductionDomains.bind(this)
    });
  }

  async checkAiRouter() {
    try {
      const health = await this.aiRouter.getHealth();
      const metrics = this.aiRouter.getMetrics();
      
      return {
        status: health.status,
        details: {
          ors: health.ors,
          activeProviders: health.activeProviders,
          failedProviders: health.failedProviders,
          systemLoad: health.systemLoad,
          alerts: health.alerts,
          metrics: {
            totalRoutings: metrics.totalRoutings,
            successRate: metrics.successRate,
            avgLatency: metrics.avgLatency,
            avgCost: metrics.avgCost
          }
        }
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message,
        details: { routerUnavailable: true }
      };
    }
  }

  async checkSystemResources() {
    const os = require('os');
    const process = require('process');
    
    const cpuUsage = os.loadavg()[0]; // 1-minute load average
    const memoryUsage = (1 - (os.freemem() / os.totalmem())) * 100;
    const processMemory = process.memoryUsage();
    
    return {
      status: cpuUsage > 85 || memoryUsage > 85 ? 'degraded' : 'healthy',
      details: {
        cpu: {
          usage: cpuUsage,
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          usage: memoryUsage,
          process: processMemory
        },
        uptime: os.uptime()
      }
    };
  }

  async checkOrs() {
    // Calculate current ORS based on system health
    const aiRouterHealth = await this.checkAiRouter();
    const systemHealth = await this.checkSystemResources();
    
    let ors = 100; // Start with perfect score
    
    // Deduct points for AI Router issues
    if (aiRouterHealth.status === 'critical') ors -= 40;
    else if (aiRouterHealth.status === 'degraded') ors -= 20;
    
    // Deduct points for system resource issues
    if (systemHealth.status === 'critical') ors -= 30;
    else if (systemHealth.status === 'degraded') ors -= 15;
    
    // Deduct points for failed providers
    if (aiRouterHealth.details?.failedProviders?.length > 0) {
      ors -= aiRouterHealth.details.failedProviders.length * 5;
    }
    
    // Keep ORS in 0-100 range
    ors = Math.max(0, Math.min(100, ors));
    
    // Store in history
    this.orsHistory.push({
      value: ors,
      timestamp: new Date().toISOString(),
      factors: {
        aiRouter: aiRouterHealth.status,
        systemResources: systemHealth.status,
        failedProviders: aiRouterHealth.details?.failedProviders?.length || 0
      }
    });
    
    // Keep only last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.orsHistory = this.orsHistory.filter(entry => new Date(entry.timestamp) > cutoff);
    
    return {
      status: ors >= 70 ? 'healthy' : ors >= 50 ? 'degraded' : 'critical',
      details: {
        currentOrs: ors,
        trend: this.calculateOrsTrend(),
        history: this.orsHistory.slice(-10), // Last 10 entries
        factors: {
          aiRouter: aiRouterHealth.status,
          systemResources: systemHealth.status
        }
      }
    };
  }

  async checkProductionDomains() {
    const domains = [
      'https://headybuddy.org',
      'https://headysystems.com',
      'https://headyconnection.org',
      'https://headymcp.com',
      'https://headyio.com',
      'https://headyme.com'
    ];
    
    const results = [];
    
    for (const domain of domains) {
      try {
        const startTime = Date.now();
        const response = await fetch(domain, { 
          method: 'HEAD',
          timeout: 5000 
        });
        const latency = Date.now() - startTime;
        
        results.push({
          domain,
          status: response.ok ? 'healthy' : 'unhealthy',
          statusCode: response.status,
          latency,
          reachable: true
        });
      } catch (error) {
        results.push({
          domain,
          status: 'critical',
          error: error.message,
          reachable: false
        });
      }
    }
    
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const overallStatus = healthyCount === domains.length ? 'healthy' : 
                         healthyCount > domains.length / 2 ? 'degraded' : 'critical';
    
    return {
      status: overallStatus,
      details: {
        domains: results,
        healthyCount,
        totalCount: domains.length,
        healthRatio: healthyCount / domains.length
      }
    };
  }

  calculateOrsTrend() {
    if (this.orsHistory.length < 2) return 'insufficient_data';
    
    const recent = this.orsHistory.slice(-5);
    const older = this.orsHistory.slice(-10, -5);
    
    if (older.length === 0) return 'insufficient_data';
    
    const recentAvg = recent.reduce((sum, entry) => sum + entry.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, entry) => sum + entry.value, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  async runHealthCheck(checkName) {
    const healthCheck = this.healthChecks.get(checkName);
    if (!healthCheck) {
      throw new Error(`Unknown health check: ${checkName}`);
    }
    
    try {
      const result = await Promise.race([
        healthCheck.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
        )
      ]);
      
      this.logger.info(`Health check ${checkName}: ${result.status}`, result.details);
      return result;
    } catch (error) {
      const result = {
        status: 'critical',
        error: error.message,
        details: { timeout: error.message.includes('timeout') }
      };
      
      this.logger.error(`Health check ${checkName} failed:`, error);
      return result;
    }
  }

  async runAllHealthChecks() {
    const results = {};
    
    for (const [name] of this.healthChecks) {
      results[name] = await this.runHealthCheck(name);
    }
    
    // Calculate overall system health
    const statuses = Object.values(results).map(r => r.status);
    const healthyCount = statuses.filter(s => s === 'healthy').length;
    const degradedCount = statuses.filter(s => s === 'degraded').length;
    const criticalCount = statuses.filter(s => s === 'critical').length;
    
    let overallStatus;
    if (criticalCount > 0) overallStatus = 'critical';
    else if (degradedCount > 0) overallStatus = 'degraded';
    else overallStatus = 'healthy';
    
    this.lastHealthCheck = {
      timestamp: new Date().toISOString(),
      overallStatus,
      results,
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        critical: criticalCount,
        total: statuses.length
      }
    };
    
    // Trigger alerts if needed
    this.checkForAlerts();
    
    return this.lastHealthCheck;
  }

  checkForAlerts() {
    if (!this.lastHealthCheck) return;
    
    const { overallStatus, results } = this.lastHealthCheck;
    
    // Critical alerts
    if (overallStatus === 'critical') {
      this.triggerAlert('critical', 'System health critical', this.lastHealthCheck);
    }
    
    // ORS alerts
    const orsResult = results.ors;
    if (orsResult?.details?.currentOrs < 50) {
      this.triggerAlert('critical', 'ORS below 50', orsResult);
    } else if (orsResult?.details?.currentOrs < 70) {
      this.triggerAlert('warning', 'ORS below 70', orsResult);
    }
    
    // AI Router alerts
    const aiRouterResult = results.ai_router;
    if (aiRouterResult?.status === 'critical') {
      this.triggerAlert('critical', 'AI Router critical', aiRouterResult);
    }
    
    // Production domain alerts
    const domainResult = results.production_domains;
    if (domainResult?.details?.healthRatio < 0.5) {
      this.triggerAlert('critical', 'More than 50% domains unhealthy', domainResult);
    }
  }

  triggerAlert(severity, message, details) {
    const alert = {
      id: Date.now().toString(),
      severity,
      message,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    this.logger.warn(`ALERT [${severity.toUpperCase()}]: ${message}`, alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  async startContinuousMonitoring() {
    this.logger.info('🔄 Starting continuous health monitoring');
    
    for (const [name, config] of this.healthChecks) {
      setInterval(async () => {
        await this.runHealthCheck(name);
      }, config.interval);
    }
    
    // Run comprehensive health check every 5 minutes
    setInterval(async () => {
      await this.runAllHealthChecks();
    }, 5 * 60 * 1000);
  }

  getHealthStatus() {
    return {
      lastCheck: this.lastHealthCheck,
      alerts: this.alerts.filter(a => !a.acknowledged),
      orsHistory: this.orsHistory.slice(-20),
      monitoringActive: true
    };
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.info(`Alert ${alertId} acknowledged`);
      return true;
    }
    return false;
  }
}

module.exports = { HealthMonitor };
