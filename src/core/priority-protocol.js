// ============================================================
// HEADY PRIORITY EXECUTION PROTOCOL
// ============================================================
// OWNER INPUT = PRIORITY #1 - MAKE IT HAPPEN PERFECTLY ASAP
// ============================================================

const PRIORITY = {
  OWNER_DIRECT:   100,  // Owner's direct input - ALWAYS highest
  CHECKPOINT:      80,  // HCFP checkpoint operations
  MCP_TOOL_CALL:   60,  // AI agent tool execution
  ARENA_MODE:      70,  // Arena Mode operations
  SCHEDULED:       40,  // Cron jobs, auto-sync
  BACKGROUND:      20,  // Analytics, cleanup
};

/**
 * Request classifier middleware
 * Determines priority and SLA based on request characteristics
 */
function priorityClassifier(req, res, next) {
  const ownerHeader = req.headers['x-heady-owner'];
  const ownerToken = process.env.HEADY_OWNER_TOKEN;

  // Owner's direct API calls get maximum priority
  if (ownerHeader && ownerToken && ownerHeader === ownerToken) {
    req.priority = PRIORITY.OWNER_DIRECT;
    req.deadline = Date.now() + 5000; // 5-second SLA
    req.skipRateLimit = true;
    req.skipQueue = true;
    console.log('🔥 OWNER PRIORITY DETECTED:', req.path);
  } 
  // Arena Mode operations
  else if (req.path.includes('/arena') || req.headers['x-arena-mode']) {
    req.priority = PRIORITY.ARENA_MODE;
    req.deadline = Date.now() + 15000; // 15-second SLA
    console.log('⚔️ ARENA MODE PRIORITY:', req.path);
  }
  // HCFP checkpoint operations
  else if (req.path.includes('/checkpoint')) {
    req.priority = PRIORITY.CHECKPOINT;
    req.deadline = Date.now() + 15000;
  } 
  // MCP tool calls
  else if (req.path.includes('/mcp/') || req.path.includes('/memory/')) {
    req.priority = PRIORITY.MCP_TOOL_CALL;
    req.deadline = Date.now() + 10000;
  } 
  // Scheduled operations
  else if (req.path.includes('/scheduled') || req.path.includes('/cron')) {
    req.priority = PRIORITY.SCHEDULED;
    req.deadline = Date.now() + 30000;
  } 
  // Default background
  else {
    req.priority = PRIORITY.BACKGROUND;
    req.deadline = Date.now() + 60000;
  }
  
  // Add priority to response headers for debugging
  res.setHeader('X-Heady-Priority', req.priority);
  res.setHeader('X-Heady-Deadline', req.deadline);
  
  next();
}

/**
 * Preempt lower-priority tasks when owner request arrives
 */
function preemptForOwner(req, res, next) {
  if (req.priority === PRIORITY.OWNER_DIRECT) {
    // Signal background workers to yield
    process.emit('heady:owner-priority', { 
      path: req.path, 
      deadline: req.deadline,
      timestamp: Date.now()
    });
    
    // Force garbage collection to free resources
    if (global.gc) {
      global.gc();
    }
    
    console.log('🔥 PREEMPTING: All background tasks yielding to owner request');
  }
  next();
}

/**
 * Priority queue for async operations
 */
class HeadyPriorityQueue {
  constructor() {
    this.queues = new Map();
    for (const [name, priority] of Object.entries(PRIORITY)) {
      this.queues.set(priority, []);
    }
    this.processing = false;
  }

  enqueue(task, priority) {
    const queue = this.queues.get(priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    
    queue.push({
      ...task,
      priority,
      added: Date.now(),
      deadline: task.deadline || (Date.now() + 60000)
    });
    
    // Sort by deadline
    queue.sort((a, b) => a.deadline - b.deadline);
    
    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    try {
      // Process priorities in descending order
      const priorities = Object.values(PRIORITY).sort((a, b) => b - a);
      
      for (const priority of priorities) {
        const queue = this.queues.get(priority);
        
        while (queue.length > 0) {
          const task = queue.shift();
          
          // Check if deadline passed
          if (Date.now() > task.deadline) {
            console.log(`⏰ TASK EXPIRED: ${task.id} (priority: ${priority})`);
            if (task.onExpire) {
              await task.onExpire(task);
            }
            continue;
          }
          
          try {
            console.log(`⚡ EXECUTING: ${task.id} (priority: ${priority})`);
            await task.execute();
            
            if (task.onSuccess) {
              await task.onSuccess(task);
            }
          } catch (error) {
            console.error(`❌ TASK FAILED: ${task.id}`, error);
            
            if (task.onError) {
              await task.onError(task, error);
            }
            
            // Owner tasks get retry on failure
            if (priority === PRIORITY.OWNER_DIRECT && task.retries < 3) {
              task.retries = (task.retries || 0) + 1;
              queue.unshift(task); // Put back at front
              console.log(`🔄 RETRYING OWNER TASK: ${task.id} (attempt ${task.retries})`);
            }
          }
          
          // Break for owner priority tasks to give them immediate attention
          if (priority === PRIORITY.OWNER_DIRECT) {
            break;
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  getStats() {
    const stats = {};
    for (const [name, priority] of Object.entries(PRIORITY)) {
      stats[name] = this.queues.get(priority).length;
    }
    return stats;
  }
}

// Global priority queue instance
const priorityQueue = new HeadyPriorityQueue();

/**
 * ORS integration with priority multiplier
 */
function calculatePriorityORS(metrics) {
  const base = computeBaseORS(metrics);
  
  // If owner has pending requests, boost all systems to max
  if (metrics.ownerRequestsPending > 0) {
    return Math.min(100, base * 1.5); // Force into "aggressive building" mode
  }
  
  return base;
}

/**
 * Express middleware for priority execution
 */
function priorityMiddleware() {
  return (req, res, next) => {
    // Add task to priority queue if it's async
    if (req.async) {
      priorityQueue.enqueue({
        id: `${req.method} ${req.path}`,
        execute: async () => {
          // Continue with request processing
          return new Promise((resolve, reject) => {
            const originalEnd = res.end;
            res.end = function(...args) {
              originalEnd.apply(this, args);
              resolve();
            };
            
            next();
          });
        },
        deadline: req.deadline,
        onSuccess: () => {
          console.log(`✅ COMPLETED: ${req.method} ${req.path}`);
        },
        onError: (task, error) => {
          console.error(`❌ FAILED: ${req.method} ${req.path}`, error);
        }
      }, req.priority);
    } else {
      next();
    }
  };
}

/**
 * Background task yield mechanism
 */
process.on('heady:owner-priority', (data) => {
  console.log('🔥 OWNER PRIORITY SIGNAL RECEIVED:', data);
  
  // Notify all background processes to yield
  process.emit('heady:yield', {
    reason: 'owner-priority',
    deadline: data.deadline
  });
});

module.exports = {
  PRIORITY,
  priorityClassifier,
  preemptForOwner,
  priorityQueue,
  priorityMiddleware,
  calculatePriorityORS
};
