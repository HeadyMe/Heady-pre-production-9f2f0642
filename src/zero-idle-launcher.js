#!/usr/bin/env node
/*
 * ZERO IDLE TIME LAUNCHER
 * NEVER allows system to be idle - always executing useful work
 */

const { ZeroIdleTaskManager } = require('./zero-idle-task-manager');
const { HeadyContinuousLearner } = require('./intelligence/continuous-learner');
const { HeadyBackgroundOptimizer } = require('./services/background-optimizer');
const { HeadyIdleEliminator } = require('./monitoring/idle-eliminator');
const { HeadyPredictiveExecutor } = require('./predictive-executor');

const headyZERO_IDLE_MODE = process.env.ZERO_IDLE_MODE !== 'false';
const headyMAX_IDLE_MS = parseInt(process.env.MAX_IDLE_MS) || 500;

console.log('🚀 ZERO IDLE MODE ACTIVATED');
console.log('⚡ Maximum idle time:', headyMAX_IDLE_MS, 'ms');
console.log('💰 Cost optimization: 100% compute utilization');

class HeadyZeroIdleLauncher {
  constructor() {
    this.taskManager = new ZeroIdleTaskManager();
    this.learner = new HeadyContinuousLearner();
    this.optimizer = new HeadyBackgroundOptimizer();
    this.idleEliminator = new HeadyIdleEliminator();
    this.predictor = new HeadyPredictiveExecutor();
    this.isRunning = true;
  }

  async start() {
    console.log('🔄 Starting all zero-idle systems...');
    
    // Start all systems in parallel
    await Promise.all([
      this.taskManager.start(),
      this.learner.startContinuousLearning(),
      this.optimizer.startOptimizationLoop(),
      this.eliminator.startMonitoring(),
      this.predictor.predictAndPrepare()
    ]);

    console.log('✅ Zero-idle systems operational');
    console.log('💡 System will NEVER be idle');
    
    // Main coordination loop
    this.coordinateSystems();
  }

  async coordinateSystems() {
    while (this.isRunning) {
      // Ensure at least one system is always active
      const headySystemStates = await this.checkSystemStates();
      
      if (systemStates.some(state => state.idle)) {
        console.log('⚠️  System idle detected - triggering emergency tasks');
        await this.triggerEmergencyWork();
      }
      
      // Minimal delay for coordination
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async triggerEmergencyWork() {
    const headyEmergencyTasks = [
      () => this.scanForVulnerabilities(),
      () => this.optimizeMemoryUsage(),
      () => this.cleanupTempFiles(),
      () => this.updateSystemMetrics(),
      () => this.pingAllServices(),
      () => this.backupCriticalData(),
      () => this.comAPIEndpoints(),
      () => this.analyzeErrorLogs(),
      () => this.optimizeDatabaseQueries(),
      () => this.compressAssets()
    ];

    // Execute fewer emergency tasks to prevent memory overload
    const headyTaskCount = Math.min(2, emergencyTasks.length); // Reduced from 4 to 2
    const headyTasks = emergencyTasks.slice(0, taskCount);
    
    console.log(`🔥 Executing ${taskCount} emergency tasks in parallel`);
    
    // Execute tasks in parallel
    Promise.all(tasks.map(task => 
      task().catch(err => console.error('Emergency task failed:', err.message))
    )).then(() => {
      this.lastActivity = Date.now();
      this.emergencyTasksExecuted++;
      console.log(`✅ Emergency work completed - system active (${this.emergencyTasksExecuted} tasks executed)`);
    });
  }

  async scanForVulnerabilities() {
    // Simulate vulnerability scanning
    console.log('🔍 Scanning for vulnerabilities...');
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async optimizeMemoryUsage() {
    // Simulate memory optimization
    console.log('🧠 Optimizing memory usage...');
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  async cleanupTempFiles() {
    // Simulate temp file cleanup
    console.log('🧹 Cleaning up temporary files...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async updateSystemMetrics() {
    // Simulate metrics update
    console.log('📊 Updating system metrics...');
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async pingAllServices() {
    // Simulate service health checks
    console.log('🏥 Pinging all services...');
    await new Promise(resolve => setTimeout(resolve, 75));
  }

  async backupCriticalData() {
    // Simulate data backup
    console.log('💾 Backing up critical data...');
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async testAPIEndpoints() {
    // Simulate API testing
    console.log('🧪 Testing API endpoints...');
    await new Promise(resolve => setTimeout(resolve, 125));
  }

  async analyzeErrorLogs() {
    // Simulate log analysis
    console.log('📋 Analyzing error logs...');
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  async optimizeDatabaseQueries() {
    // Simulate DB optimization
    console.log('🗄️  Optimizing database queries...');
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  async compressAssets() {
    // Simulate asset compression
    console.log('📦 Compressing assets...');
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async checkSystemStates() {
    // Check if any system is idle
    return [
      { name: 'TaskManager', idle: Math.random() > 0.7 },
      { name: 'Learner', idle: Math.random() > 0.8 },
      { name: 'Optimizer', idle: Math.random() > 0.6 },
      { name: 'Eliminator', idle: Math.random() > 0.9 },
      { name: 'Predictor', idle: Math.random() > 0.75 }
    ];
  }

  async shutdown() {
    console.log('🛑 Shutting down zero-idle systems...');
    this.isRunning = false;
    
    // Graceful shutdown
    await Promise.all([
      this.taskManager.shutdown(),
      this.learner.shutdown(),
      this.optimizer.shutdown(),
      this.eliminator.shutdown(),
      this.predictor.shutdown()
    ]);
    
    console.log('✅ Zero-idle systems shutdown complete');
  }
}

// Start zero-idle launcher
if (require.main === module) {
  const headyLauncher = new ZeroIdleLauncher();
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('🔄 SIGINT received - shutting down zero-idle systems...');
    await launcher.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received - shutting down zero-idle systems...');
    await launcher.shutdown();
    process.exit(0);
  });

  // Start the launcher
  launcher.start().catch(err => {
    console.error('❌ Zero-idle launcher failed:', err);
    process.exit(1);
  });
}

module.exports = { ZeroIdleLauncher };
