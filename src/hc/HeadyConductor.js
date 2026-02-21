
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
// ║  FILE: Headypromoter.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/*
 * Headypromoter: Intelligent Dynamic Resource Allocation & Parallel Execution
 * Optimizes task distribution, resource management, and async orchestration
 */

// Import required modules
const { Worker } = require('worker_threads');
let getAiRouter;
try {
  ({ getAiRouter } = require('../ai-router/hc-ai-router-simple'));
} catch (err) {
  const HCAIRouterSimple = require('../ai-router/hc-ai-router-simple');
  getAiRouter = () => new HCAIRouterSimple();
}
const { decomposeAndExecute, startBattle, loadBattleConfig } = require('../hcmontecarlo');
const { getHealthCheckSystem } = require('../health-checks');
const headyCluster = require('cluster');
const headyOs = require('os');
const fs = require('fs');
const path = require('path');
const { HealthMonitor } = require('../monitoring/health-monitor');

class HeadyConductor {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    const headyCpuCount = Array.isArray(headyOs.cpus()) ? headyOs.cpus().length : 2;
    this.resourcePool = {
      cpu: headyCpuCount,
      memory: headyOs.totalmem(),
      allocatedCpu: 0,
      allocatedMemory: 0
    };
    this.isRunning = false;
    this.maxWorkers = headyCpuCount;
    this.performanceMetrics = {
      tasksCompleted: 0,
      averageLatency: 0,
      averageExecutionTime: 0,
      throughput: 0,
      routingDecisions: 0,
      policyEnforcements: 0,
      resourceUtilization: 0,
      parallelEfficiency: 0
    };
    this.lastScaleUpAt = 0;
    this.lastScaleDownAt = 0;
    
    // Initialize integrations
    this.aiRouter = null;
    this.healthCheck = null;
    try {
      this.healthMonitor = new HealthMonitor();
    } catch (error) {
      console.warn('🎼 Headypromoter: HealthMonitor unavailable, continuing without telemetry', error.message);
      this.healthMonitor = null;
    }
    this.battleConfig = null;
    
    // Load registry and pipeline configs
    this.registry = null;
    this.pipelineConfig = null;
    // HCBrain governance policy cache
    this.governancePolicies = new Map();
    
    // Routing decision tracking
    this.routingHistory = [];
    this.lastRoutingDecision = null;
  }

  // Initialize promoter with optimal worker pool and registry consumption
  async initialize() {
    console.log('🎼 Headypromoter: Initializing intelligent resource allocation...');
    
    // Load Registry and Pipeline configs as single sources of truth
    await this.loadRegistryAndPipeline();
    
    // Initialize HeadyLens integration
    if (this.healthMonitor && typeof this.healthMonitor.initialize === 'function') {
      await this.healthMonitor.initialize();
    } else {
      console.warn('🎼 Headypromoter: Skipping health monitor initialization');
    }
    
    // Load governance policies from HCBrain
    await this.loadGovernancePolicies();
    
    // Create optimal worker pool based on CPU cores
    const headyNumWorkers = Math.max(2, Math.floor(this.resourcePool.cpu / 2));
    
    for (let headyI = 0; headyI < headyNumWorkers; headyI++) {
      await this.createWorker(headyI);
    }
    
    this.isRunning = true;
    this.startResourceMonitoring();
    this.startTaskScheduler();
    this.startConfigSync();
    
    console.log(`🎼 Headypromoter: Initialized with ${headyNumWorkers} parallel workers`);
    console.log(`🎼 Headypromoter: Registry v${this.registryVersion}, Pipeline v${this.pipelineVersion}`);
    return this.getStatus();
  }

  // Load Registry and Pipeline configs as single sources of truth
  async loadRegistryAndPipeline() {
    try {
      const repoRoot = path.join(__dirname, '..', '..');
      const configuredRoot = process.env.HEADY_REGISTRY_ROOT;
      const fallbackRoot = '/home/headyme/Heady';

      const registryPath = this.resolveConfigPath([
        path.join(repoRoot, 'heady-registry.json'),
        configuredRoot && path.join(configuredRoot, 'heady-registry.json'),
        path.join(fallbackRoot, 'heady-registry.json')
      ], 'heady-registry.json');
      const registryData = fs.readFileSync(registryPath, 'utf8');
      this.registry = JSON.parse(registryData);
      this.registryVersion = this.registry.registryVersion;
      
      // Load Pipeline Config
      const pipelinePath = this.resolveConfigPath([
        path.join(repoRoot, 'configs/hcfullpipeline.yaml'),
        configuredRoot && path.join(configuredRoot, 'configs/hcfullpipeline.yaml'),
        path.join(fallbackRoot, 'configs/hcfullpipeline.yaml')
      ], 'configs/hcfullpipeline.yaml');
      const pipelineData = fs.readFileSync(pipelinePath, 'utf8');
      // Simple YAML parsing (basic version)
      this.pipelineConfig = this.parseBasicYaml(pipelineData);
      this.pipelineVersion = this.pipelineConfig.profiles?.full_auto?.version || '3.2.0';
      
      console.log('🎼 Headypromoter: Registry and Pipeline configs loaded successfully');
    } catch (error) {
      console.error('🎼 Headypromoter: Failed to load configs:', error);
      throw error;
    }
  }

  resolveConfigPath(candidatePaths, label) {
    for (const candidate of candidatePaths) {
      if (!candidate) continue;
      try {
        fs.accessSync(candidate, fs.constants.R_OK);
        return candidate;
      } catch (err) {
        continue;
      }
    }
    throw new Error(`Required config not found: ${label}`);
  }

  // Basic YAML parser for pipeline config
  parseBasicYaml(yamlString) {
    const config = {};
    const lines = yamlString.split('\n');
    let currentSection = null;
    let currentSubsection = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;
      
      if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
        // Top-level section
        currentSection = trimmed.slice(0, -1);
        config[currentSection] = {};
        currentSubsection = null;
      } else if (trimmed.includes(':') && currentSection) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        if (key && value) {
          if (currentSubsection) {
            config[currentSection][currentSubsection][key] = this.parseYamlValue(value);
          } else {
            config[currentSection][key] = this.parseYamlValue(value);
          }
        }
      } else if (trimmed.endsWith(':') && currentSection) {
        // Subsection
        currentSubsection = trimmed.slice(0, -1);
        config[currentSection][currentSubsection] = {};
      }
    }
    
    return config;
  }

  // Parse YAML value (basic types)
  parseYamlValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
    if (!isNaN(value)) return Number(value);
    return value;
  }

  // Load governance policies from HCBrain
  async loadGovernancePolicies() {
    try {
      // Mock governance policies - in real implementation would call HCBrain API
      this.governancePolicies.set('aloha_mode', {
        enabled: true,
        restrictions: ['no_heavy_optimization', 'require_human_approval'],
        max_parallel_tasks: 4
      });
      
      this.governancePolicies.set('de_optimization', {
        enabled: false,
        restrictions: ['prefer_simple_solutions', 'avoid_complex_patterns'],
        resource_limit: 0.7
      });
      
      this.governancePolicies.set('stability_first', {
        enabled: true,
        restrictions: ['require_health_checks', 'rollback_on_failure'],
        min_ors_threshold: 70
      });
      
      console.log('🎼 Headypromoter: Governance policies loaded');
    } catch (error) {
      console.error('🎼 Headypromoter: Failed to load governance policies:', error);
    }
  }

  // Start config synchronization loop
  startConfigSync() {
    setInterval(async () => {
      try {
        await this.loadRegistryAndPipeline();
        await this.loadGovernancePolicies();
      } catch (error) {
        console.error('🎼 Headypromoter: Config sync failed:', error);
      }
    }, 60000); // Sync every minute
  }

  // Route task based on registry, pipeline, and governance policies with enhanced battle detection
  async routeTask(task, options = {}) {
    const startTime = Date.now();
    this.performanceMetrics.routingDecisions++;
    
    try {
      // 1. Check governance policies first
      const governanceCheck = await this.checkGovernancePolicies(task);
      if (!governanceCheck.allowed) {
        this.performanceMetrics.policyEnforcements++;
        await this.emitRoutingEvent(task, 'blocked_by_policy', governanceCheck.reason);
        return { success: false, reason: governanceCheck.reason, blocked: true };
      }

      // 2. Check if task is battle-worthy
      const isBattleWorthy = this.isBattleWorthyTask(task);
      
      if (isBattleWorthy) {
        // Route to HeadyBattle mode
        const battleResult = await this.routeToBattleMode(task);
        await this.emitRoutingEvent(task, 'routed_to_battle', battleResult);
        return battleResult;
      }

      // 3. Determine workflow from registry
      const workflow = this.selectWorkflow(task);
      
      // 4. Apply pipeline routing rules
      const routingDecision = this.applyPipelineRouting(task, workflow);
      
      // 5. Emit routing event to HeadyLens
      await this.emitRoutingEvent(task, routingDecision.action, routingDecision);
      
      // 6. Execute routing decision
      const result = await this.executeRoutingDecision(task, routingDecision);
      
      // 7. Track routing history
      this.trackRoutingDecision(task, routingDecision, result, Date.now() - startTime);
      
      return result;
    } catch (error) {
      await this.emitRoutingEvent(task, 'routing_error', { error: error.message });
      throw error;
    }
  }

  // Check if task is suitable for HeadyBattle mode
  isBattleWorthyTask(task) {
    const battleTriggers = this.battleConfig?.battle_triggers || {};
    
    // Check subtask count
    if (task.estimatedSubtasks && task.estimatedSubtasks >= (battleTriggers.min_subtasks_for_battle || 100)) {
      return true;
    }
    
    // Check file count
    if (task.files && task.files.length >= (battleTriggers.min_files_for_battle || 10)) {
      return true;
    }
    
    // Check complexity score
    if (task.complexityScore && task.complexityScore >= (battleTriggers.min_complexity_score || 7.5)) {
      return true;
    }
    
    // Check battle-worthy task types
    const battleWorthyTypes = battleTriggers.battle_worthy_types || [];
    if (battleWorthyTypes.includes(task.type)) {
      return true;
    }
    
    return false;
  }

  // Route to HeadyBattle mode
  async routeToBattleMode(task) {
    try {
      console.log(`⚔️ Headypromoter: Routing task ${task.id} to HeadyBattle mode`);
      
      const battleResult = await startBattle(task, this.battleConfig, {
        baseBranch: task.baseBranch || 'main',
        maxDepth: task.maxDepth || 6
      });
      
      return {
        success: true,
        action: 'routed_to_battle',
        battleId: battleResult.battleId,
        subtaskCount: battleResult.subtaskCount,
        devBranches: battleResult.devBranches,
        stagingBranches: battleResult.stagingBranches,
        duration: battleResult.durationMs
      };
    } catch (error) {
      console.error('⚔️ Headypromoter: Failed to route to Battle mode:', error);
      return {
        success: false,
        action: 'battle_failed',
        error: error.message
      };
    }
  }

  // Check governance policies for task
  async checkGovernancePolicies(task) {
    for (const [policyName, policy] of this.governancePolicies) {
      if (policy.enabled) {
        // Check if task violates policy
        if (policyName === 'aloha_mode' && task.priority === 'heavy_optimization') {
          return { allowed: false, reason: 'Aloha mode: heavy optimization not allowed' };
        }
        if (policyName === 'stability_first' && task.risk === 'high') {
          return { allowed: false, reason: 'Stability first: high risk tasks blocked' };
        }
      }
    }
    return { allowed: true };
  }

  // Select workflow from registry based on task characteristics
  selectWorkflow(task) {
    if (!this.registry || !this.registry.workflows) {
      return { id: 'default', name: 'Default Routing' };
    }
    
    // Battle mode for large coding tasks
    if (task.type === 'coding' && task.estimatedSubtasks >= 1000) {
      const battleWorkflow = this.registry.workflows.find(w => w.id === 'heady-battle-mode');
      if (battleWorkflow) return battleWorkflow;
    }
    
    // Default task routing workflow
    const taskRouting = this.registry.workflows.find(w => w.id === 'task-routing');
    return taskRouting || { id: 'default', name: 'Default Routing' };
  }

  // Apply pipeline routing rules
  applyPipelineRouting(task, workflow) {
    if (!this.pipelineConfig || !this.pipelineConfig.profiles) {
      return { action: 'direct_execute', target: 'worker_pool' };
    }
    
    const profile = this.pipelineConfig.profiles.full_auto;
    
    // Check ORS thresholds
    if (task.ors && task.ors < 50) {
      return { action: 'route_to_recovery', target: 'recover_stage' };
    }
    
    // Route to MC for complex tasks
    if (task.complexity === 'high' || task.type === 'coding') {
      return { action: 'route_to_mc', target: 'mc-plan-scheduler', battleWorthy: task.estimatedSubtasks >= 1000 };
    }
    
    // Default routing
    return { action: 'direct_execute', target: 'worker_pool' };
  }

  // Execute routing decision
  async executeRoutingDecision(task, routingDecision) {
    switch (routingDecision.action) {
      case 'route_to_mc':
        // Route to HeadySims scheduler
        return await this.routeToHeadySims(task, routingDecision);
      case 'route_to_recovery':
        // Route to recovery stage
        return await this.routeToRecovery(task);
      case 'direct_execute':
        // Execute directly in worker pool
        return await this.executeDirectly(task);
      default:
        throw new Error(`Unknown routing action: ${routingDecision.action}`);
    }
  }

  // Route to HeadySims scheduler
  async routeToHeadySims(task, routingDecision) {
    const taskId = await this.submitTask({
      ...task,
      type: routingDecision.battleWorthy ? 'battle_mode' : 'mc_planning',
      target: 'mc-plan-scheduler'
    }, task.priority || 'normal');
    
    return { 
      success: true, 
      action: 'routed_to_mc', 
      taskId,
      battleWorthy: routingDecision.battleWorthy 
    };
  }

  // Route to recovery stage
  async routeToRecovery(task) {
    const taskId = await this.submitTask({
      ...task,
      type: 'recovery',
      target: 'recover_stage'
    }, 'critical');
    
    return { success: true, action: 'routed_to_recovery', taskId };
  }

  // Execute task directly in worker pool
  async executeDirectly(task) {
    const taskId = await this.submitTask(task, task.priority || 'normal');
    return { success: true, action: 'executed_directly', taskId };
  }

  // Emit routing event to HeadyLens
  async emitRoutingEvent(task, action, details) {
    try {
      const routingEvent = {
        timestamp: new Date().toISOString(),
        taskId: task.id,
        taskType: task.type,
        action,
        details,
        promoterVersion: '4.0.0',
        registryVersion: this.registryVersion,
        pipelineVersion: this.pipelineVersion,
        latencyMs: details.latencyMs || 0
      };
      
      // Send to HeadyLens (via health monitor)
      if (this.healthMonitor && this.healthMonitor.logger) {
        this.healthMonitor.logger.info('promoter routing event', routingEvent);
      }
      
      // Store in routing history
      this.routingHistory.push(routingEvent);
      if (this.routingHistory.length > 1000) {
        this.routingHistory = this.routingHistory.slice(-1000);
      }
      
      this.lastRoutingDecision = routingEvent;
    } catch (error) {
      console.error('🎼 Headypromoter: Failed to emit routing event:', error);
    }
  }

  // Track routing decision for analytics
  trackRoutingDecision(task, routingDecision, result, latency) {
    const tracking = {
      timestamp: new Date().toISOString(),
      taskId: task.id,
      taskType: task.type,
      routingDecision,
      result,
      latency,
      ors: task.ors || null
    };
    
    // Store for pattern analysis
    this.routingHistory.push(tracking);
  }

  // Get routing analytics
  getRoutingAnalytics() {
    const recent = this.routingHistory.slice(-100); // Last 100 decisions
    
    const analytics = {
      totalDecisions: this.routingHistory.length,
      recentDecisions: recent.length,
      averageLatency: recent.reduce((sum, r) => sum + (r.latency || 0), 0) / recent.length,
      actionDistribution: {},
      policyEnforcements: this.performanceMetrics.policyEnforcements,
      governancePolicyStatus: Array.from(this.governancePolicies.entries()).map(([name, policy]) => ({
        name,
        enabled: policy.enabled
      }))
    };
    
    // Calculate action distribution
    for (const decision of recent) {
      const action = decision.routingDecision?.action || 'unknown';
      analytics.actionDistribution[action] = (analytics.actionDistribution[action] || 0) + 1;
    }
    
    return analytics;
  }

  // Start promoter (alias for initialize)
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
        
        async function headyExecuteTask(task) {
          switch (task.type) {
            case 'HeadyBattle_analysis':
              return await headyPerformHeadyBattleAnalysis(task.data);
            case 'headysoul_escalation':
              return await headyPerformHeadySoulEscalation(task.data);
            case 'decision_processing':
              return await headyPerformDecisionProcessing(task.data);
            case 'resource_intensive':
              return await headyPerformResourceIntensiveTask(task.data);
            default:
              return await headyPerformGenericTask(task.data);
          }
        }
        
        // Mock task execution functions
        async function headyPerformHeadyBattleAnalysis(data) {
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

      headyWorker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      headyWorker.on('error', (error) => {
        console.error(`🎼 Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      });

      headyWorker.on('exit', (code) => {
        const workerInfo = this.workers.get(workerId);
        const isGraceful = workerInfo?.shuttingDown;

        if (isGraceful) {
          console.log(`🎼 Worker ${workerId} stopped gracefully`);
          this.workers.delete(workerId);
          return;
        }

        if (code !== 0) {
          console.error(`🎼 Worker ${workerId} stopped with exit code ${code}`);
          this.restartWorker(workerId);
        }
      });

      this.workers.set(workerId, {
        worker: headyWorker,
        busy: false,
        taskCount: 0,
        lastUsed: Date.now(),
        shuttingDown: false
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

    this.taskQueue.push(headyTaskWithMetadata);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    console.log(`🎼 Task queued: ${headyTaskWithMetadata.id} (priority: ${priority})`);
    return headyTaskWithMetadata.id;
  }

  // Dynamic task allocation based on resource availability
  async allocateTask(task) {
    const headyAvailableWorker = this.findBestWorker(task);
    
    if (!headyAvailableWorker) {
      // No available workers, apply backpressure
      console.log('🎼 No workers available, applying backpressure');
      return false;
    }

    const headyWorkerInfo = this.workers.get(headyAvailableWorker);
    headyWorkerInfo.busy = true;
    headyWorkerInfo.taskCount++;
    headyWorkerInfo.lastUsed = Date.now();
    
    this.activeTasks.set(task.id, {
      workerId: headyAvailableWorker,
      startTime: Date.now(),
      task: task
    });

    headyWorkerInfo.worker.postMessage(task);
    return true;
  }

  // Find optimal worker for task based on resource requirements
  findBestWorker(task) {
    let headyBestWorker = null;
    let headyBestScore = -1;

    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        const headyScore = this.calculateWorkerScore(workerId, task);
        if (headyScore > headyBestScore) {
          headyBestScore = headyScore;
          headyBestWorker = workerId;
        }
      }
    }

    return headyBestWorker;
  }

  // Calculate worker suitability score
  calculateWorkerScore(workerId, task) {
    const headyWorkerInfo = this.workers.get(workerId);
    
    // Factors: recent usage, task completion rate, load balancing
    const headyTimeSinceLastUse = Date.now() - headyWorkerInfo.lastUsed;
    const headyRecencyScore = Math.min(headyTimeSinceLastUse / 10000, 1); // Favor less recently used
    const maxTaskCount = Math.max(1, ...Array.from(this.workers.values()).map(w => w.taskCount || 0));
    const headyLoadScore = 1 - (headyWorkerInfo.taskCount / maxTaskCount);
    
    return headyRecencyScore * 0.6 + headyLoadScore * 0.4;
  }

  // Handle worker completion
  handleWorkerMessage(workerId, message) {
    const headyWorkerInfo = this.workers.get(workerId);
    
    if (message.success) {
      const headyTaskInfo = this.activeTasks.get(message.taskId);
      if (headyTaskInfo) {
        const headyExecutionTime = Date.now() - headyTaskInfo.startTime;
        this.updatePerformanceMetrics(headyExecutionTime, true);
        
        console.log(`🎼 Task completed: ${message.taskId} by worker ${workerId} in ${headyExecutionTime}ms`);
        this.activeTasks.delete(message.taskId);
      }
    } else {
      console.error(`🎼 Task failed: ${message.taskId} - ${message.error}`);
      this.updatePerformanceMetrics(0, false);
    }

    headyWorkerInfo.busy = false;
    this.processNextTask();
  }

  // Process next task in queue
  async processNextTask() {
    if (this.taskQueue.length > 0) {
      const headyNextTask = this.taskQueue.shift();
      const headyAllocated = await this.allocateTask(headyNextTask);
      
      if (!headyAllocated) {
        // Put task back in queue if allocation failed
        this.taskQueue.unshift(headyNextTask);
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
    }, 5000); // Monitor every 5 seconds to reduce churn
  }

  // Update resource utilization metrics
  updateResourceUtilization() {
    const busyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const totalWorkers = this.workers.size || 1;
    
    this.performanceMetrics.resourceUtilization = (busyWorkers / totalWorkers) * 100;
    this.performanceMetrics.parallelEfficiency = this.calculateParallelEfficiency();
  }

  // Calculate parallel execution efficiency
  calculateParallelEfficiency() {
    if (this.activeTasks.size === 0) return 100;
    
    const avgTaskTime = this.performanceMetrics.averageExecutionTime || 1000;
    const divisor = Math.max(1, Math.min(this.activeTasks.size, this.workers.size));
    const theoreticalMinTime = avgTaskTime / divisor;
    const actualAvgTime = Array.from(this.activeTasks.values())
      .reduce((sum, task) => sum + (Date.now() - task.startTime), 0) / this.activeTasks.size;
    
    if (actualAvgTime === 0) return 100;
    return Math.min(100, (theoreticalMinTime / actualAvgTime) * 100);
  }

  // Dynamic worker pool optimization
  optimizeWorkerPool() {
    const headyUtilization = this.performanceMetrics.resourceUtilization;
    const headyQueueLength = this.taskQueue.length;
    
    // Scale up if high utilization and queued tasks
    const now = Date.now();

    if (
      headyUtilization > 80 &&
      headyQueueLength > 3 &&
      this.workers.size < this.resourcePool.cpu &&
      now - this.lastScaleUpAt > 2000
    ) {
      console.log('🎼 Scaling up worker pool');
      this.createWorker(this.workers.size);
      this.lastScaleUpAt = now;
    }
    
    // Scale down if low utilization
    if (
      headyUtilization < 20 &&
      this.workers.size > 2 &&
      now - this.lastScaleDownAt > 2000
    ) {
      console.log('🎼 Scaling down worker pool');
      this.removeLeastUsedWorker();
      this.lastScaleDownAt = now;
    }
  }

  // Restart failed worker
  async restartWorker(workerId) {
    console.log(`🎼 Restarting worker ${workerId}...`);
    await this.createWorker(workerId);
  }

  // Remove least used worker
  removeLeastUsedWorker() {
    if (this.workers.size <= 2) {
      return;
    }

    let leastUsedWorker = null;
    let leastUsedTime = Date.now();
    
    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy && workerInfo.lastUsed < leastUsedTime) {
        leastUsedTime = workerInfo.lastUsed;
        leastUsedWorker = workerId;
      }
    }
    
    if (leastUsedWorker !== null) {
      const workerInfo = this.workers.get(leastUsedWorker);
      if (!workerInfo) return;

      workerInfo.shuttingDown = true;
      workerInfo.worker.terminate().then(() => {
        console.log(`🎼 Removed worker ${leastUsedWorker}`);
      }).catch(error => {
        console.error(`🎼 Failed to terminate worker ${leastUsedWorker}:`, error.message);
        this.workers.delete(leastUsedWorker);
      });
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
      
      const currentAvg = this.performanceMetrics.averageExecutionTime;
      const completed = this.performanceMetrics.tasksCompleted;
      this.performanceMetrics.averageExecutionTime = 
        ((currentAvg * (completed - 1)) + executionTime) / completed;
    }
  }

  // Estimate task resource requirements
  estimateTaskResources(task) {
    const resourceMap = {
      'HeadyBattle_analysis': { cpu: 2, memory: 'medium', time: 1000 },
      'headysoul_escalation': { cpu: 1, memory: 'low', time: 500 },
      'decision_processing': { cpu: 3, memory: 'high', time: 800 },
      'resource_intensive': { cpu: 4, memory: 'high', time: 2000 }
    };
    
    return resourceMap[task.type] || { cpu: 1, memory: 'low', time: 300 };
  }

  // Map priority string to numeric value
  mapPriority(priority) {
    const priorityMap = {
      'low': 1,
      'normal': 5,
      'high': 10,
      'critical': 20,
      'urgent': 50
    };
    
    return priorityMap[priority] || 5;
  }

  // Get comprehensive status including routing and governance
  getStatus() {
    const routingAnalytics = this.getRoutingAnalytics();
    
    return {
      isRunning: this.isRunning,
      version: '4.0.0',
      configVersions: {
        registry: this.registryVersion,
        pipeline: this.pipelineVersion
      },
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
        resourceUtilization: `${Number(this.performanceMetrics.resourceUtilization || 0).toFixed(2)}%`,
        parallelEfficiency: `${Number(this.performanceMetrics.parallelEfficiency || 0).toFixed(2)}%`
      },
      routing: {
        totalDecisions: routingAnalytics.totalDecisions,
        policyEnforcements: routingAnalytics.policyEnforcements,
        averageLatency: routingAnalytics.averageLatency?.toFixed(2) + 'ms' || 'N/A',
        actionDistribution: routingAnalytics.actionDistribution,
        lastDecision: this.lastRoutingDecision
      },
      governance: {
        activePolicies: routingAnalytics.governancePolicyStatus.filter(p => p.enabled).length,
        totalPolicies: routingAnalytics.governancePolicyStatus.length,
        policyStatus: routingAnalytics.governancePolicyStatus
      },
      connectivity: {
        registryLoaded: !!this.registry,
        pipelineLoaded: !!this.pipelineConfig,
        healthMonitorActive: !!this.healthMonitor,
        governanceLoaded: this.governancePolicies.size > 0
      },
      resources: this.resourcePool
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🎼 Headypromoter: Shutting down gracefully...');
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
    console.log('🎼 Headypromoter: Shutdown complete');
  }
}

module.exports = { HeadyConductor };
