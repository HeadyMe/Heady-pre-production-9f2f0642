/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * 🎛️ Heady Service Manager - 100% Uptime Continuous Service Orchestration
 * 
 * This service manages all Heady services, ensuring they run continuously
 * and coordinate properly. Default behavior: All services on, always monitoring.
 */

const EventEmitter = require('events');
const { getHeadySimsService } = require('./HeadySims-service');
const { getHeadyBattleService } = require('./HeadyBattle-service');
const { getArenaModeService } = require('./arena-mode-service');
const { getBranchAutomationService } = require('./branch-automation-service');
const { getErrorSentinel } = require('./error-sentinel-service');
const logger = require("../utils/logger");

class ServiceManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      auto_start: true,
      monitoring_interval: 5000, // 5 seconds
      health_check_interval: 10000, // 10 seconds
      recovery_enabled: true,
      graceful_shutdown: true,
      ...config
    };

    this.services = new Map();
    this.serviceStatus = new Map();
    this.healthMetrics = new Map();
    this.isRunning = false;

    this.initializeServices();
  }

  initializeServices() {
    // Register all services
    this.registerService('HeadySims', getHeadySimsService, {
      description: 'HeadySims optimization engine',
      critical: true,
      auto_restart: true
    });

    this.registerService('HeadyBattle', getHeadyBattleService, {
      description: 'HeadyBattle validation',
      critical: true,
      auto_restart: true
    });

    this.registerService('arena-mode', getArenaModeService, {
      description: 'Arena Mode competitive selection',
      critical: true,
      auto_restart: true
    });

    this.registerService('branch-automation', getBranchAutomationService, {
      description: 'Branch automation and synchronization',
      critical: true,
      auto_restart: true
    });

    this.registerService('error-sentinel', getErrorSentinel, {
      description: 'Universal 6-layer error detection and routing',
      critical: true,
      auto_restart: true
    });
  }

  registerService(name, factory, config = {}) {
    const serviceConfig = {
      factory,
      description: config.description || name,
      critical: config.critical || false,
      auto_restart: config.auto_restart !== false,
      restart_delay: config.restart_delay || 5000,
      max_restarts: config.max_restarts || 5,
      ...config
    };

    this.services.set(name, serviceConfig);
    this.serviceStatus.set(name, {
      state: 'stopped',
      uptime: 0,
      restarts: 0,
      last_restart: 0,
      health_score: 1.0
    });

    logger.logSystem(`📝 Service registered: ${name} - ${serviceConfig.description}`);
  }

  async start() {
    if (this.isRunning) {
      logger.logSystem('🎛️ Service Manager already running');
      return;
    }

    logger.logSystem('🚀 Starting Service Manager - 100% Continuous Mode');
    this.isRunning = true;
    this.startTime = Date.now();

    // Start all services
    await this.startAllServices();

    // Start monitoring loops
    this.monitoringLoop = setInterval(() => {
      this.monitorServices();
    }, this.config.monitoring_interval);

    this.healthCheckLoop = setInterval(() => {
      this.performHealthChecks();
    }, this.config.health_check_interval);

    // Start metrics collection
    this.metricsLoop = setInterval(() => {
      this.updateMetrics();
    }, 1000);

    this.emit('started');
    logger.logSystem('✅ Service Manager started successfully');
  }

  async stop() {
    if (!this.isRunning) {
      logger.logSystem('🎛️ Service Manager already stopped');
      return;
    }

    logger.logSystem('🛑 Stopping Service Manager');
    this.isRunning = false;

    clearInterval(this.monitoringLoop);
    clearInterval(this.healthCheckLoop);
    clearInterval(this.metricsLoop);

    // Stop all services gracefully
    await this.stopAllServices();

    this.emit('stopped');
    logger.logSystem('✅ Service Manager stopped');
  }

  async startAllServices() {
    logger.logSystem('🔄 Starting all services...');

    const startPromises = [];
    for (const [name, config] of this.services) {
      startPromises.push(this.startService(name));
    }

    await Promise.allSettled(startPromises);
    logger.logSystem('✅ All services start sequence completed');
  }

  async startService(name) {
    const serviceConfig = this.services.get(name);
    const status = this.serviceStatus.get(name);

    if (!serviceConfig) {
      throw new Error(`Unknown service: ${name}`);
    }

    if (status.state === 'running') {
      logger.logSystem(`⚠️  Service ${name} already running`);
      return;
    }

    logger.logSystem(`🚀 Starting service: ${name}`);

    try {
      // Create service instance
      const service = serviceConfig.factory();

      // Set up event listeners
      this.setupServiceListeners(name, service);

      // Start the service
      await service.start();

      // Update status
      status.state = 'running';
      status.uptime = Date.now();
      status.last_restart = 0;

      // Store service instance
      serviceConfig.instance = service;

      logger.logSystem(`✅ Service started: ${name}`);
      this.emit('service_started', { name, service });

    } catch (error) {
      logger.error(`❌ Failed to start service ${name}:`, error.message);

      status.state = 'failed';
      status.error = error.message;

      this.emit('service_failed', { name, error });

      // Attempt restart if enabled
      if (serviceConfig.auto_restart && serviceConfig.critical) {
        await this.scheduleRestart(name);
      }
    }
  }

  async stopService(name) {
    const serviceConfig = this.services.get(name);
    const status = this.serviceStatus.get(name);

    if (!serviceConfig || !serviceConfig.instance) {
      logger.logSystem(`⚠️  Service ${name} not running`);
      return;
    }

    logger.logSystem(`🛑 Stopping service: ${name}`);

    try {
      await serviceConfig.instance.stop();

      status.state = 'stopped';
      status.uptime = 0;

      delete serviceConfig.instance;

      logger.logSystem(`✅ Service stopped: ${name}`);
      this.emit('service_stopped', { name });

    } catch (error) {
      logger.error(`❌ Failed to stop service ${name}:`, error.message);

      status.state = 'error';
      status.error = error.message;

      this.emit('service_error', { name, error });
    }
  }

  async stopAllServices() {
    logger.logSystem('🛑 Stopping all services...');

    // Stop in reverse order (dependencies first)
    const serviceNames = Array.from(this.services.keys()).reverse();

    for (const name of serviceNames) {
      await this.stopService(name);
    }

    logger.logSystem('✅ All services stopped');
  }

  setupServiceListeners(name, service) {
    // Service started
    service.on('started', () => {
      logger.logSystem(`📢 Service event: ${name} started`);
    });

    // Service stopped
    service.on('stopped', () => {
      logger.logSystem(`📢 Service event: ${name} stopped`);

      const status = this.serviceStatus.get(name);
      if (status.state === 'running') {
        status.state = 'stopped';
        this.emit('service_stopped', { name });
      }
    });

    // Service errors
    service.on('error', (error) => {
      logger.error(`📢 Service error: ${name} - ${error.message}`);

      const status = this.serviceStatus.get(name);
      status.state = 'error';
      status.error = error.message;

      this.emit('service_error', { name, error });

      // Attempt restart if enabled
      const serviceConfig = this.services.get(name);
      if (serviceConfig.auto_restart && serviceConfig.critical) {
        this.scheduleRestart(name);
      }
    });

    // Service metrics
    service.on('metrics_updated', (metrics) => {
      this.healthMetrics.set(name, {
        ...metrics,
        timestamp: Date.now()
      });
    });
  }

  async scheduleRestart(name) {
    const serviceConfig = this.services.get(name);
    const status = this.serviceStatus.get(name);

    if (!serviceConfig.auto_restart || status.restarts >= serviceConfig.max_restarts) {
      logger.logSystem(`❌ Service ${name} exceeded max restarts, giving up`);
      return;
    }

    const delay = serviceConfig.restart_delay * Math.pow(2, status.restarts); // Exponential backoff

    logger.logSystem(`🔄 Scheduling restart for ${name} in ${delay}ms (restart #${status.restarts + 1})`);

    setTimeout(async () => {
      await this.restartService(name);
    }, delay);
  }

  async restartService(name) {
    const status = this.serviceStatus.get(name);

    logger.logSystem(`🔄 Restarting service: ${name}`);

    status.restarts++;
    status.last_restart = Date.now();

    // Stop if running
    if (status.state === 'running') {
      await this.stopService(name);
    }

    // Clear error state
    delete status.error;

    // Start again
    await this.startService(name);
  }

  monitorServices() {
    if (!this.isRunning) return;

    for (const [name, config] of this.services) {
      const status = this.serviceStatus.get(name);

      // Update uptime
      if (status.state === 'running' && status.uptime > 0) {
        status.uptime = Date.now() - status.uptime;
      }

      // Check for stale services
      if (status.state === 'running' && config.instance) {
        const metrics = this.healthMetrics.get(name);
        if (metrics && (Date.now() - metrics.timestamp) > 30000) { // 30 seconds
          logger.logSystem(`⚠️  Service ${name} appears stale (no recent metrics)`);

          if (config.critical && config.auto_restart) {
            this.scheduleRestart(name);
          }
        }
      }
    }
  }

  performHealthChecks() {
    if (!this.isRunning) return;

    for (const [name, config] of this.services) {
      const status = this.serviceStatus.get(name);

      if (status.state !== 'running') continue;

      try {
        // Get service status
        const serviceStatus = config.instance.getStatus ? config.instance.getStatus() : null;

        if (serviceStatus) {
          // Calculate health score
          let healthScore = 1.0;

          // Check for error conditions
          if (serviceStatus.error) {
            healthScore -= 0.5;
          }

          // Check for performance issues
          if (serviceStatus.averageLatency && serviceStatus.averageLatency > 5000) {
            healthScore -= 0.2;
          }

          // Check for queue buildup
          if (serviceStatus.queueSize && serviceStatus.queueSize > 100) {
            healthScore -= 0.1;
          }

          status.health_score = Math.max(0, healthScore);

          // Alert on low health
          if (healthScore < 0.7) {
            logger.logSystem(`⚠️  Service ${name} health degraded: ${(healthScore * 100).toFixed(1)}%`);
            this.emit('service_health_degraded', { name, healthScore, serviceStatus });
          }
        }

      } catch (error) {
        logger.error(`❌ Health check failed for ${name}:`, error.message);
        status.health_score = 0.0;

        if (config.critical && config.auto_restart) {
          this.scheduleRestart(name);
        }
      }
    }
  }

  updateMetrics() {
    if (!this.isRunning) return;

    const metrics = {
      uptime: Date.now() - this.startTime,
      services: {},
      total_services: this.services.size,
      running_services: 0,
      failed_services: 0,
      average_health: 0.0
    };

    let totalHealth = 0;
    let healthCount = 0;

    for (const [name, status] of this.serviceStatus) {
      metrics.services[name] = {
        state: status.state,
        uptime: status.uptime,
        restarts: status.restarts,
        health_score: status.health_score
      };

      if (status.state === 'running') {
        metrics.running_services++;
        totalHealth += status.health_score;
        healthCount++;
      } else if (status.state === 'failed' || status.state === 'error') {
        metrics.failed_services++;
      }
    }

    if (healthCount > 0) {
      metrics.average_health = totalHealth / healthCount;
    }

    this.emit('metrics_updated', metrics);
  }

  getStatus() {
    const status = {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      services: {},
      summary: {
        total: this.services.size,
        running: 0,
        stopped: 0,
        failed: 0
      }
    };

    for (const [name, serviceStatus] of this.serviceStatus) {
      status.services[name] = { ...serviceStatus };

      if (serviceStatus.state === 'running') {
        status.summary.running++;
      } else if (serviceStatus.state === 'stopped') {
        status.summary.stopped++;
      } else {
        status.summary.failed++;
      }
    }

    return status;
  }

  getServiceStatus(name) {
    const serviceConfig = this.services.get(name);
    const status = this.serviceStatus.get(name);

    if (!serviceConfig || !status) {
      return null;
    }

    let detailedStatus = { ...status };

    if (serviceConfig.instance && serviceConfig.instance.getStatus) {
      detailedStatus = {
        ...detailedStatus,
        ...serviceConfig.instance.getStatus()
      };
    }

    return detailedStatus;
  }

  getHealthReport() {
    const report = {
      timestamp: Date.now(),
      overall_health: 0.0,
      services: {},
      recommendations: []
    };

    let totalHealth = 0;
    let serviceCount = 0;

    for (const [name, status] of this.serviceStatus) {
      const health = status.health_score || 0.0;

      report.services[name] = {
        state: status.state,
        health_score: health,
        uptime: status.uptime,
        restarts: status.restarts,
        last_restart: status.last_restart
      };

      if (status.state === 'running') {
        totalHealth += health;
        serviceCount++;
      }

      // Generate recommendations
      if (health < 0.7) {
        report.recommendations.push(`Service ${name} health degraded - investigate performance`);
      }

      if (status.restarts > 3) {
        report.recommendations.push(`Service ${name} restarting frequently - review configuration`);
      }
    }

    if (serviceCount > 0) {
      report.overall_health = totalHealth / serviceCount;
    }

    return report;
  }

  async restartAllServices() {
    logger.logSystem('🔄 Restarting all services...');

    await this.stopAllServices();
    await this.sleep(2000); // Brief pause
    await this.startAllServices();

    logger.logSystem('✅ All services restarted');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let serviceManager = null;

function getServiceManager(config = {}) {
  if (!serviceManager) {
    serviceManager = new ServiceManager(config);
  }
  return serviceManager;
}

// Auto-start if this is the main module
if (require.main === module) {
  const manager = getServiceManager();

  manager.start().then(() => {
    logger.logSystem('🎛️ Service Manager started - All services running continuously');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.logSystem('\n🛑 Shutting down Service Manager...');
      await manager.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.logSystem('\n🛑 Shutting down Service Manager...');
      await manager.stop();
      process.exit(0);
    });

    // Status reporting
    setInterval(() => {
      const status = manager.getStatus();
      logger.logSystem(`📊 Service Status: ${status.summary.running}/${status.summary.total} running`);
    }, 30000);

  }).catch(err => {
    logger.error('❌ Failed to start Service Manager:', err);
    process.exit(1);
  });
}

module.exports = { ServiceManager, getServiceManager };
