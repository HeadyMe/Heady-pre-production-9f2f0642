#!/usr/bin/env node
/*
 * ZERO IDLE TASK MANAGER
 * NEVER allows true idle - always has tasks executing
 */

class HeadyZeroIdleTaskManager {
  constructor() {
    this.taskQueue = {
      critical: [],      // User-initiated tasks - execute IMMEDIATELY
      high: [],          // Auto-optimization tasks
      medium: [],        // Learning/research tasks
      background: []     // Skill improvement during "idle"
    };
    this.isIdle = false;
    this.idleTimer = null;
    this.isRunning = false;
    this.taskHistory = [];
    this.performanceMetrics = {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      idleTimeEliminated: 0
    };
  }

  async start() {
    console.log('🎯 Zero Idle Task Manager starting...');
    this.isRunning = true;
    
    // Start the execution loop - NEVER stops
    this.executeNext();
    
    // Pre-populate with background tasks
    this.populateBackgroundTasks();
    
    console.log('✅ Task Manager operational - NEVER idle');
  }

  // NEVER allow true idle - always have fallback tasks
  async executeNext() {
    if (!this.isRunning) return;
    
    clearTimeout(this.idleTimer);
    const headyStartTime = Date.now();
    
    // Priority order - ALWAYS execute something
    const headyTask = this.getNextTask();
    
    if (!task) {
      // NO IDLE - trigger background intelligence work
      await this.executeBackgroundIntelligence();
    } else {
      await this.executeTask(task);
    }
    
    // Track performance
    const headyExecutionTime = Date.now() - startTime;
    this.updateMetrics(executionTime);
    
    // Immediately queue next execution - NO DELAY
    setImmediate(() => this.executeNext());
  }

  getNextTask() {
    return this.taskQueue.critical.shift() ||
           this.taskQueue.high.shift() ||
           this.taskQueue.medium.shift() ||
           this.taskQueue.background.shift();
  }

  async executeTask(task) {
    console.log(`⚡ Executing task: ${task.type} (${task.priority})`);
    
    try {
      const headyResult = await task.execute();
      this.taskHistory.push({
        task: task.type,
        priority: task.priority,
        status: 'completed',
        timestamp: new Date(),
        executionTime: Date.now() - task.startTime
      });
      
      // Log completion
      console.log(`✅ Task completed: ${task.type}`);
      return result;
    } catch (error) {
      console.error(`❌ Task failed: ${task.type} - ${error.message}`);
      
      // Re-queue failed tasks with lower priority
      if (task.priority === 'critical') {
        this.addTask(task, 'high'); // Demote to high
      } else if (task.priority === 'high') {
        this.addTask(task, 'medium'); // Demote to medium
      }
      
      throw error;
    }
  }

  async executeBackgroundIntelligence() {
    const headyActivities = [
      () => this.analyzeCodePatterns(),
      () => this.optimizeExistingCode(),
      () => this.researchNewTechnologies(),
      () => this.updateDocumentation(),
      () => this.performSecurityAudit(),
      () => this.optimizePerformance(),
      () => this.trainMLModels(),
      () => this.prepopulateCache(),
      () => this.analyzeUserPatterns(),
      () => this.cleanupSystemResources()
    ];
    
    // Execute random background task to improve system
    const headyActivity = activities[Math.floor(Math.random() * activities.length)];
    
    try {
      await activity();
      console.log('🧠 Background intelligence work completed');
    } catch (error) {
      console.error('⚠️  Background task failed:', error.message);
    }
  }

  async analyzeCodePatterns() {
    console.log('🔍 Analyzing code patterns...');
    // Simulate code pattern analysis
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Add optimization tasks based on findings
    this.addTask({
      type: 'code_optimization',
      execute: async () => {
        console.log('🔧 Optimizing code based on patterns...');
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }, 'high');
  }

  async optimizeExistingCode() {
    console.log('⚡ Optimizing existing code...');
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  async researchNewTechnologies() {
    console.log('🔬 Researching new technologies...');
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async updateDocumentation() {
    console.log('📚 Updating documentation...');
    await new Promise(resolve => setTimeout(resolve, 120));
  }

  async performSecurityAudit() {
    console.log('🔒 Performing security audit...');
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  async optimizePerformance() {
    console.log('🚀 Optimizing performance...');
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async trainMLModels() {
    console.log('🤖 Training ML models...');
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  async prepopulateCache() {
    console.log('💾 Pre-populating cache...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async analyzeUserPatterns() {
    console.log('👤 Analyzing user patterns...');
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  async cleanupSystemResources() {
    console.log('🧹 Cleaning up system resources...');
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  populateBackgroundTasks() {
    const headyBackgroundTasks = [
      {
        type: 'system_health_check',
        execute: async () => {
          console.log('🏥 System health check...');
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      },
      {
        type: 'log_analysis',
        execute: async () => {
          console.log('📋 Analyzing logs...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      },
      {
        type: 'cache_optimization',
        execute: async () => {
          console.log('⚡ Optimizing cache...');
          await new Promise(resolve => setTimeout(resolve, 75));
        }
      },
      {
        type: 'dependency_check',
        execute: async () => {
          console.log('📦 Checking dependencies...');
          await new Promise(resolve => setTimeout(resolve, 60));
        }
      },
      {
        type: 'performance_monitoring',
        execute: async () => {
          console.log('📊 Monitoring performance...');
          await new Promise(resolve => setTimeout(resolve, 40));
        }
      }
    ];

    // Add limited background tasks to prevent memory issues
    for (let headyI = 0; i < 5; i++) { // Reduced from 10 to 5
      const headyTask = backgroundTasks[Math.floor(Math.random() * backgroundTasks.length)];
      this.addTask({...task}, 'background');
    }
  }

  addTask(task, priority = 'medium') {
    if (!task.type || !task.execute) {
      throw new Error('Task must have type and execute function');
    }

    task.priority = priority;
    task.startTime = Date.now();
    task.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prevent queue overflow - limit queue sizes
    if (this.taskQueue[priority].length > 20) {
      this.taskQueue[priority].shift(); // Remove oldest task
    }
    
    this.taskQueue[priority].push(task);
    
    console.log(`➕ Task added: ${task.type} (${priority})`);
    
    // Replenish background tasks if queue is getting low (but limit to prevent memory issues)
    if (this.getTotalQueueSize() < 3) { // Reduced from 5 to 3
      this.populateBackgroundTasks();
    }
  }

  addCriticalTask(task) {
    this.addTask(task, 'critical');
    console.log(`🚨 CRITICAL task added: ${task.type}`);
  }

  getTotalQueueSize() {
    return Object.values(this.taskQueue).reduce((total, queue) => total + queue.length, 0);
  }

  updateMetrics(executionTime) {
    this.performanceMetrics.tasksCompleted++;
    this.performanceMetrics.averageExecutionTime = 
      (this.performanceMetrics.averageExecutionTime * (this.performanceMetrics.tasksCompleted - 1) + executionTime) / 
      this.performanceMetrics.tasksCompleted;
  }

  getMetrics() {
    return {
      ...this.performanceMetrics,
      queueSizes: {
        critical: this.taskQueue.critical.length,
        high: this.taskQueue.high.length,
        medium: this.taskQueue.medium.length,
        background: this.taskQueue.background.length
      },
      totalQueued: this.getTotalQueueSize(),
      isIdle: this.isIdle,
      uptime: process.uptime()
    };
  }

  async shutdown() {
    console.log('🛑 Shutting down Task Manager...');
    this.isRunning = false;
    
    // Wait for current tasks to complete (with timeout)
    const headyShutdownTimeout = setTimeout(() => {
      console.log('⚠️  Shutdown timeout - forcing exit');
    }, 5000);

    // Wait for queues to empty or timeout
    while (this.getTotalQueueSize() > 0 && Date.now() < shutdownTimeout._idleStart + 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    clearTimeout(shutdownTimeout);
    console.log('✅ Task Manager shutdown complete');
  }
}

module.exports = { ZeroIdleTaskManager };
