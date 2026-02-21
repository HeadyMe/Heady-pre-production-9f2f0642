const WORKER_POOL = ['heady-worker-1', 'heady-worker-2', 'heady-worker-3', 'heady-worker-4'];
const PRIORITY_MAP = { critical: 0, high: 1, normal: 2, low: 3, background: 4 };

class Headypromoter {
  constructor(options = {}) {
    this.isRunning = false;
    this.startedAt = null;
    this.routedTasks = 0;
    this.failedTasks = 0;
    this.workerIndex = 0;
    this.maxWorkers = options.maxWorkers || WORKER_POOL.length;
    this.workerLoad = new Map(WORKER_POOL.map(w => [w, 0]));
    this.taskQueue = [];
    this.workers = { total: 0, active: 0, idle: 0 };
    this.tasks = { active: 0, completed: 0, failed: 0, queued: 0 };
    this.latencies = [];
  }

  async start() {
    this.isRunning = true;
    this.startedAt = new Date().toISOString();
    this.workers.total = this.maxWorkers;
    this.workers.idle = this.maxWorkers;
    this.workers.active = 0;
    return { status: 'started', startedAt: this.startedAt, workers: this.workers.total };
  }

  async stop() {
    this.isRunning = false;
    this.workers.total = 0;
    this.workers.active = 0;
    this.workers.idle = 0;
    return { status: 'stopped', completedTasks: this.tasks.completed };
  }

  selectWorker(strategy = 'round_robin') {
    if (strategy === 'least_loaded') {
      let minLoad = Infinity;
      let selected = WORKER_POOL[0];
      for (const [worker, load] of this.workerLoad) {
        if (load < minLoad) { minLoad = load; selected = worker; }
      }
      return selected;
    }
    const worker = WORKER_POOL[this.workerIndex % this.maxWorkers];
    this.workerIndex = (this.workerIndex + 1) % this.maxWorkers;
    return worker;
  }

  async routeTask(task, options = {}) {
    const startTime = Date.now();
    const taskId = task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const priority = PRIORITY_MAP[task?.priority] ?? PRIORITY_MAP.normal;
    const strategy = options.strategy || (priority === 0 ? 'least_loaded' : 'round_robin');

    this.routedTasks += 1;
    this.tasks.active += 1;

    try {
      const assignedWorker = this.selectWorker(strategy);
      const currentLoad = this.workerLoad.get(assignedWorker) || 0;
      this.workerLoad.set(assignedWorker, currentLoad + 1);
      this.workers.active = Math.min(this.workers.active + 1, this.workers.total);
      this.workers.idle = Math.max(this.workers.total - this.workers.active, 0);

      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      if (this.latencies.length > 500) this.latencies.shift();

      const result = {
        routed: true,
        taskId,
        strategy,
        assignedWorker,
        priority: task?.priority || 'normal',
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      };

      this.workerLoad.set(assignedWorker, Math.max((this.workerLoad.get(assignedWorker) || 1) - 1, 0));
      this.tasks.active -= 1;
      this.tasks.completed += 1;
      this.workers.active = Math.max(this.workers.active - 1, 0);
      this.workers.idle = this.workers.total - this.workers.active;

      return result;
    } catch (error) {
      this.tasks.active -= 1;
      this.tasks.failed += 1;
      this.failedTasks += 1;
      throw error;
    }
  }

  getAverageLatency() {
    if (this.latencies.length === 0) return 0;
    return Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      workers: this.workers,
      tasks: this.tasks,
      routedTasks: this.routedTasks,
      failedTasks: this.failedTasks,
      avgLatency_ms: this.getAverageLatency(),
      workerLoad: Object.fromEntries(this.workerLoad),
    };
  }

  getRoutingAnalytics() {
    return {
      totalRouted: this.routedTasks,
      activeTasks: this.tasks.active,
      completedTasks: this.tasks.completed,
      uptimeSeconds: this.startedAt
        ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000)
        : 0,
    };
  }
}

module.exports = { Headypromoter };
