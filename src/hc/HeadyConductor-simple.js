/*
 * HeadyConductor: Simplified Intelligent Resource Allocation
 * Optimizes task distribution and resource management
 */

const { Worker } = require('worker_threads');
const os = require('os');

class HeadyConductor {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.resourcePool = {
      cpu: os.cpus().length,
      memory: os.totalmem(),
      availableWorkers: os.cpus().length
    };
    this.performanceMetrics = {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      resourceUtilization: 0,
      parallelEfficiency: 0
    };
    this.allocationStrategy = 'dynamic';
    this.isRunning = false;
    this.taskPriorities = new Map();
  }

  // Initialize conductor with optimal worker pool
  async initialize() {
    console.log('🎼 HeadyConductor: Initializing intelligent resource allocation...');
    
    // Create optimal worker pool based on CPU cores
    const numWorkers = Math.max(2, Math.floor(this.resourcePool.cpu / 2));
    
    for (let i = 0; i < numWorkers; i++) {
      await this.createWorker(i);
    }
    
    this.isRunning = true;
    this.startResourceMonitoring();
    this.startTaskScheduler();
    
    console.log(`🎼 HeadyConductor: Initialized with ${numWorkers} parallel workers`);
    return this.getStatus();
  }

  // Start conductor (alias for initialize)
  async start() {
    return await this.initialize();
  }

  // Create individual worker thread
  async createWorker(workerId) {
    return new Promise((resolve, reject) => {
      // Create a simple worker file
      const workerCode = `
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
`;
      
      const worker = new Worker(workerCode, { eval: true });
      
      worker.on('online', () => {
        console.log(`🎼 HeadyConductor: Worker ${workerId} online`);
        this.workers.set(workerId, worker);
        resolve(worker);
      });
      
      worker.on('error', (error) => {
        console.error(`🎼 HeadyConductor: Worker ${workerId} error:`, error);
        reject(error);
      });
      
      worker.on('message', (result) => {
        this.handleWorkerResult(workerId, result);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`🎼 HeadyConductor: Worker ${workerId} stopped with exit code ${code}`);
        }
        this.workers.delete(workerId);
      });
    });
  }

  // Handle worker result
  handleWorkerResult(workerId, result) {
    if (result.success) {
      this.performanceMetrics.tasksCompleted++;
      this.activeTasks.delete(result.taskId);
    } else {
      console.error(`🎼 HeadyConductor: Task ${result.taskId} failed:`, result.error);
    }
  }

  // Start resource monitoring
  startResourceMonitoring() {
    setInterval(() => {
      this.updateResourceMetrics();
    }, 5000);
  }

  // Start task scheduler
  startTaskScheduler() {
    setInterval(() => {
      this.processTaskQueue();
    }, 1000);
  }

  // Update resource metrics
  updateResourceMetrics() {
    const usedMemory = process.memoryUsage().heapUsed;
    const totalMemory = this.resourcePool.memory;
    this.resourcePool.availableWorkers = this.workers.size;
    
    this.performanceMetrics.resourceUtilization = (usedMemory / totalMemory) * 100;
    this.performanceMetrics.parallelEfficiency = 
      (this.workers.size / this.resourcePool.cpu) * 100;
  }

  // Process task queue
  processTaskQueue() {
    while (this.taskQueue.length > 0 && this.workers.size > 0) {
      const task = this.taskQueue.shift();
      this.assignTask(task);
    }
  }

  // Assign task to worker
  assignTask(task) {
    const availableWorkers = Array.from(this.workers.keys());
    if (availableWorkers.length === 0) return;
    
    const workerId = availableWorkers[Math.floor(Math.random() * availableWorkers.length)];
    const worker = this.workers.get(workerId);
    
    if (worker) {
      this.activeTasks.set(task.id, { task, workerId, startTime: Date.now() });
      worker.postMessage(task);
    }
  }

  // Add task to queue
  addTask(task) {
    const taskWithId = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...task,
      timestamp: Date.now()
    };
    
    this.taskQueue.push(taskWithId);
    return taskWithId.id;
  }

  // Get conductor status
  getStatus() {
    return {
      isRunning: this.isRunning,
      workers: {
        total: this.workers.size,
        busy: this.activeTasks.size,
        available: this.workers.size - this.activeTasks.size
      },
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: this.performanceMetrics.tasksCompleted
      },
      performance: this.performanceMetrics,
      resources: this.resourcePool
    };
  }

  // Stop conductor
  async stop() {
    console.log('🎼 HeadyConductor: Stopping all workers...');
    
    for (const [workerId, worker] of this.workers) {
      worker.terminate();
    }
    
    this.workers.clear();
    this.activeTasks.clear();
    this.isRunning = false;
    
    console.log('🎼 HeadyConductor: Stopped');
  }
}

module.exports = { HeadyConductor };
