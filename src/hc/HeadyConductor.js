/*
 * HeadyConductor: Intelligent Dynamic Resource Allocation & Parallel Execution
 * Optimizes task distribution, resource management, and async orchestration
 */

const { Worker } = require('worker_threads');
const headyCluster = require('cluster');
const headyOs = require('os');

class HeadyConductor {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.resourcePool = {
      cpu: headyOs.cpus().length,
      memory: headyOs.totalmem(),
      availableWorkers: headyOs.cpus().length
    };
    this.performanceMetrics = {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      resourceUtilization: 0,
      parallelEfficiency: 0
    };
    this.allocationStrategy = 'dynamic'; // dynamic, round-robin, priority-based
    this.isRunning = false;
    this.taskPriorities = new Map();
  }

  // Initialize conductor with optimal worker pool
  async initialize() {
    console.log('🎼 HeadyConductor: Initializing intelligent resource allocation...');
    
    // Create optimal worker pool based on CPU cores
    const headyNumWorkers = Math.max(2, Math.floor(this.resourcePool.cpu / 2));
    
    for (let headyI = 0; headyI < headyNumWorkers; headyI++) {
      await this.createWorker(headyI);
    }
    
    this.isRunning = true;
    this.startResourceMonitoring();
    this.startTaskScheduler();
    
    console.log(`🎼 HeadyConductor: Initialized with ${headyNumWorkers} parallel workers`);
    return this.getStatus();
  }

  // Start conductor (alias for initialize)
  async start() {
    return await this.initialize();
  }

  // Create individual worker thread
  async createWorker(workerId) {
    return new Promise((resolve, reject) => {
      const headyWorker = new Worker(`
        const { parentPort } = require('worker_threads');
        
        parentPort.on('message', async (task) => {
          try {
            // Simple task execution
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            parentPort.postMessage({ 
              success: true, 
              taskId: task.id, 
              result: { status: 'completed', data: task.data },
              workerId: ${workerId}
            });
          } catch (error) {
            parentPort.postMessage({ 
              success: false, 
              taskId: task.id, 
              error: error.message,
              workerId: ${workerId}
            });
          }
        });
      `);
        
        async function headyExecuteTask(task) {
          switch (task.type) {
            case 'socratic_analysis':
              return await performSocraticAnalysis(task.data);
            case 'headysoul_escalation':
              return await performHeadySoulEscalation(task.data);
            case 'decision_processing':
              return await performDecisionProcessing(task.data);
            case 'resource_intensive':
              return await performResourceIntensiveTask(task.data);
            default:
              return await performGenericTask(task.data);
          }
        }
        
        // Mock task execution functions
        async function headyPerformSocraticAnalysis(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
          return { 
            questions: ['What is the primary objective?', 'What are the potential impacts?'],
            insights: ['Analysis complete'],
            processingTime: Date.now()
          };
        }
        
        async function headyPerformHeadySoulEscalation(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
          return { 
            escalationId: 'esc_' + Date.now(),
            status: 'escalated',
            notified: true
          };
        }
        
        async function headyPerformDecisionProcessing(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
          return { 
            decision: 'processed',
            confidence: Math.random(),
            reasoning: 'Decision processed successfully'
          };
        }
        
        async function headyPerformResourceIntensiveTask(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
          return { 
            result: 'Resource intensive task completed',
            resourcesUsed: 'high'
          };
        }
        
        async function headyPerformGenericTask(data) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 300));
          return { 
            result: 'Generic task completed',
            timestamp: Date.now()
          };
        }
      `, { eval: true });

      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', (error) => {
        console.error(`🎼 Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`🎼 Worker ${workerId} stopped with exit code ${code}`);
          this.restartWorker(workerId);
        }
      });

      this.workers.set(workerId, {
        worker,
        busy: false,
        taskCount: 0,
        lastUsed: Date.now()
      });

      resolve();
    });
  }

  // Intelligent task submission with priority queuing
  async submitTask(task, priority = 'normal') {
    const headyTaskWithMetadata = {
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      priority: this.mapPriority(priority),
      submittedAt: Date.now(),
      estimatedResources: this.estimateTaskResources(task)
    };

    this.taskQueue.push(taskWithMetadata);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    console.log(`🎼 Task queued: ${taskWithMetadata.id} (priority: ${priority})`);
    return taskWithMetadata.id;
  }

  // Dynamic task allocation based on resource availability
  async allocateTask(task) {
    const headyAvailableWorker = this.findBestWorker(task);
    
    if (!availableWorker) {
      // No available workers, apply backpressure
      console.log('🎼 No workers available, applying backpressure');
      return false;
    }

    const headyWorkerInfo = this.workers.get(availableWorker);
    workerInfo.busy = true;
    workerInfo.taskCount++;
    workerInfo.lastUsed = Date.now();
    
    this.activeTasks.set(task.id, {
      workerId: availableWorker,
      startTime: Date.now(),
      task: task
    });

    workerInfo.worker.postMessage(task);
    return true;
  }

  // Find optimal worker for task based on resource requirements
  findBestWorker(task) {
    let headyBestWorker = null;
    let headyBestScore = -1;

    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        const headyScore = this.calculateWorkerScore(workerId, task);
        if (score > bestScore) {
          bestScore = score;
          bestWorker = workerId;
        }
      }
    }

    return bestWorker;
  }

  // Calculate worker suitability score
  calculateWorkerScore(workerId, task) {
    const headyWorkerInfo = this.workers.get(workerId);
    
    // Factors: recent usage, task completion rate, load balancing
    const headyTimeSinceLastUse = Date.now() - workerInfo.lastUsed;
    const headyRecencyScore = Math.min(timeSinceLastUse / 10000, 1); // Favor less recently used
    const headyLoadScore = 1 - (workerInfo.taskCount / Math.max(...Array.from(this.workers.values()).map(w => w.taskCount)));
    
    return recencyScore * 0.6 + loadScore * 0.4;
  }

  // Handle worker completion
  handleWorkerMessage(workerId, message) {
    const headyWorkerInfo = this.workers.get(workerId);
    
    if (message.success) {
      const headyTaskInfo = this.activeTasks.get(message.taskId);
      if (taskInfo) {
        const headyExecutionTime = Date.now() - taskInfo.startTime;
        this.updatePerformanceMetrics(executionTime, true);
        
        console.log(`🎼 Task completed: ${message.taskId} by worker ${workerId} in ${executionTime}ms`);
        this.activeTasks.delete(message.taskId);
      }
    } else {
      console.error(`🎼 Task failed: ${message.taskId} - ${message.error}`);
      this.updatePerformanceMetrics(0, false);
    }

    workerInfo.busy = false;
    this.processNextTask();
  }

  // Process next task in queue
  async processNextTask() {
    if (this.taskQueue.length > 0) {
      const headyNextTask = this.taskQueue.shift();
      const headyAllocated = await this.allocateTask(nextTask);
      
      if (!allocated) {
        // Put task back in queue if allocation failed
        this.taskQueue.unshift(nextTask);
      }
    }
  }

  // Continuous task scheduler
  startTaskScheduler() {
    setInterval(() => {
      while (this.taskQueue.length > 0 && this.hasAvailableWorker()) {
        this.processNextTask();
      }
    }, 10); // Check every 10ms for optimal responsiveness
  }

  // Resource monitoring
  startResourceMonitoring() {
    setInterval(() => {
      this.updateResourceUtilization();
      this.optimizeWorkerPool();
    }, 1000); // Monitor every second
  }

  // Update resource utilization metrics
  updateResourceUtilization() {
    const headyBusyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const headyTotalWorkers = this.workers.size;
    
    this.performanceMetrics.resourceUtilization = (busyWorkers / totalWorkers) * 100;
    this.performanceMetrics.parallelEfficiency = this.calculateParallelEfficiency();
  }

  // Calculate parallel execution efficiency
  calculateParallelEfficiency() {
    if (this.activeTasks.size === 0) return 100;
    
    const headyAvgTaskTime = this.performanceMetrics.averageExecutionTime || 1000;
    const headyTheoreticalMinTime = avgTaskTime / Math.min(this.activeTasks.size, this.workers.size);
    const headyActualAvgTime = Array.from(this.activeTasks.values())
      .reduce((sum, task) => sum + (Date.now() - task.startTime), 0) / this.activeTasks.size;
    
    return Math.min(100, (theoreticalMinTime / actualAvgTime) * 100);
  }

  // Dynamic worker pool optimization
  optimizeWorkerPool() {
    const headyUtilization = this.performanceMetrics.resourceUtilization;
    const headyQueueLength = this.taskQueue.length;
    
    // Scale up if high utilization and queued tasks
    if (utilization > 80 && queueLength > 3 && this.workers.size < this.resourcePool.cpu) {
      console.log('🎼 Scaling up worker pool');
      this.createWorker(this.workers.size);
    }
    
    // Scale down if low utilization
    if (utilization < 20 && this.workers.size > 2) {
      console.log('🎼 Scaling down worker pool');
      this.removeLeastUsedWorker();
    }
  }

  // Restart failed worker
  async restartWorker(workerId) {
    console.log(`🎼 Restarting worker ${workerId}...`);
    await this.createWorker(workerId);
  }

  // Remove least used worker
  removeLeastUsedWorker() {
    let headyLeastUsedWorker = null;
    let headyLeastUsedTime = Date.now();
    
    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy && workerInfo.lastUsed < leastUsedTime) {
        leastUsedTime = workerInfo.lastUsed;
        leastUsedWorker = workerId;
      }
    }
    
    if (leastUsedWorker !== null) {
      this.workers.get(leastUsedWorker).worker.terminate();
      this.workers.delete(leastUsedWorker);
      console.log(`🎼 Removed worker ${leastUsedWorker}`);
    }
  }

  // Check if any workers are available
  hasAvailableWorker() {
    return Array.from(this.workers.values()).some(w => !w.busy);
  }

  // Update performance metrics
  updatePerformanceMetrics(executionTime, success) {
    if (success) {
      this.performanceMetrics.tasksCompleted++;
      
      // Update average execution time
      const headyCurrentAvg = this.performanceMetrics.averageExecutionTime;
      const headyCompleted = this.performanceMetrics.tasksCompleted;
      this.performanceMetrics.averageExecutionTime = 
        (currentAvg * (completed - 1) + executionTime) / completed;
    }
  }

  // Estimate task resource requirements
  estimateTaskResources(task) {
    const headyResourceMap = {
      'socratic_analysis': { cpu: 2, memory: 'medium', time: 1000 },
      'headysoul_escalation': { cpu: 1, memory: 'low', time: 500 },
      'decision_processing': { cpu: 3, memory: 'high', time: 800 },
      'resource_intensive': { cpu: 4, memory: 'high', time: 2000 }
    };
    
    return resourceMap[task.type] || { cpu: 1, memory: 'low', time: 300 };
  }

  // Map priority string to numeric value
  mapPriority(priority) {
    const headyPriorityMap = {
      'low': 1,
      'normal': 5,
      'high': 10,
      'critical': 20,
      'urgent': 50
    };
    
    return priorityMap[priority] || 5;
  }

  // Get comprehensive status
  getStatus() {
    return {
      isRunning: this.isRunning,
      workers: {
        total: this.workers.size,
        busy: Array.from(this.workers.values()).filter(w => w.busy).length,
        available: Array.from(this.workers.values()).filter(w => !w.busy).length
      },
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: this.performanceMetrics.tasksCompleted
      },
      performance: {
        ...this.performanceMetrics,
        resourceUtilization: this.performanceMetrics.resourceUtilization.toFixed(2) + '%',
        parallelEfficiency: this.performanceMetrics.parallelEfficiency.toFixed(2) + '%'
      },
      resources: this.resourcePool
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🎼 HeadyConductor: Shutting down gracefully...');
    this.isRunning = false;
    
    // Wait for active tasks to complete
    while (this.activeTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Terminate all workers
    for (const [workerId, workerInfo] of this.workers) {
      workerInfo.worker.terminate();
    }
    
    this.workers.clear();
    console.log('🎼 HeadyConductor: Shutdown complete');
  }
}

module.exports = { HeadyConductor };
