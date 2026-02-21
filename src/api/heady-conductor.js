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
// ║  FILE: heady-promoter.js                                       ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Headypromoter - Optimal System Orchestration Router
 * 
 * Responsibilities:
 * - Task routing with policy enforcement
 * - Registry consumption and system overview
 * - Integration with HCFullPipeline, MC, Brain, and Lens
 * - Real-time monitoring and decision optimization
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import Heady systems
const { loadConfig } = require('../core/resource-manager');
const headyLens = require('../monitoring/heady-lens');
const { decomposeAndExecute, startBattle } = require('./hcmontecarlo');

class Headypromoter {
  constructor(config = {}) {
    this.config = {
      registryPath: config.registryPath || '/home/headyme/CascadeProjects/Heady/heady-registry.json',
      pipelineConfigPath: config.pipelineConfigPath || '/home/headyme/CascadeProjects/Heady/configs/hcfullpipeline.yaml',
      battleConfigPath: config.battleConfigPath || '/home/headyme/CascadeProjects/Heady/configs/heady-battle.yaml',
      cacheRefreshInterval: config.cacheRefreshInterval || 60000, // 1 minute
      decisionTimeoutMs: config.decisionTimeoutMs || 5000,
      ...config
    };
    
    // State
    this.registry = null;
    this.pipelineConfig = null;
    this.battleConfig = null;
    this.registryVersion = null;
    this.pipelineVersion = null;
    this.battleVersion = null;
    
    // Metrics and tracking
    this.routingDecisions = new Map();
    this.activeWorkflows = new Map();
    this.performanceMetrics = {
      totalRoutings: 0,
      successfulRoutings: 0,
      failedRoutings: 0,
      averageDecisionTime: 0,
      lastRefresh: null
    };
    
    // Start cache refresh
    this.startCacheRefresh();
  }

  async initialize() {
    console.log('[Headypromoter] Initializing...');
    
    try {
      await this.refreshCache();
      console.log('[Headypromoter] Initialization complete');
      return true;
    } catch (error) {
      console.error('[Headypromoter] Initialization failed:', error);
      return false;
    }
  }

  async refreshCache() {
    try {
      // Load registry
      const registryData = await fs.readFile(this.config.registryPath, 'utf8');
      const newRegistry = JSON.parse(registryData);
      const registryHash = this.generateHash(registryData);
      
      if (registryHash !== this.registryVersion) {
        this.registry = newRegistry;
        this.registryVersion = registryHash;
        console.log('[Headypromoter] Registry updated');
      }
      
      // Load pipeline config
      const pipelineData = await fs.readFile(this.config.pipelineConfigPath, 'utf8');
      const pipelineHash = this.generateHash(pipelineData);
      
      if (pipelineHash !== this.pipelineVersion) {
        this.pipelineConfig = this.parseYaml(pipelineData);
        this.pipelineVersion = pipelineHash;
        console.log('[Headypromoter] Pipeline config updated');
      }
      
      // Load battle config
      const battleData = await fs.readFile(this.config.battleConfigPath, 'utf8');
      const battleHash = this.generateHash(battleData);
      
      if (battleHash !== this.battleVersion) {
        this.battleConfig = this.parseYaml(battleData);
        this.battleVersion = battleHash;
        console.log('[Headypromoter] Battle config updated');
      }
      
      this.performanceMetrics.lastRefresh = new Date().toISOString();
      
      // Emit metrics
      if (headyLens?.recordMetric) {
        headyLens.recordMetric('promoter.cache.refresh', 1);
      }
      
    } catch (error) {
      console.error('[Headypromoter] Failed to refresh cache:', error);
      throw error;
    }
  }

  startCacheRefresh() {
    setInterval(async () => {
      try {
        await this.refreshCache();
      } catch (error) {
        console.error('[Headypromoter] Cache refresh failed:', error);
      }
    }, this.config.cacheRefreshInterval);
  }

  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  parseYaml(yamlString) {
    // Simplified YAML parser - in production, use js-yaml
    const lines = yamlString.split('\n');
    const result = {};
    let currentSection = result;
    const sectionStack = [result];
    
    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      
      const trimmed = line.trim();
      if (trimmed.endsWith(':')) {
        const sectionName = trimmed.slice(0, -1);
        const newSection = {};
        currentSection[sectionName] = newSection;
        sectionStack.push(newSection);
        currentSection = newSection;
      } else if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        currentSection[key.trim()] = this.parseValue(value);
      }
    }
    
    return result;
  }

  parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
    if (!isNaN(Number(value))) return Number(value);
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map(v => v.trim().replace(/"/g, ''));
    }
    return value;
  }

  /**
   * Route an event/task to the appropriate workflow
   */
  async routeEvent(event, options = {}) {
    const startTime = Date.now();
    const traceId = this.generateTraceId();
    
    try {
      console.log(`[Headypromoter] Routing event ${event.id} with trace ${traceId}`);
      
      // Step 1: Classify the event/task
      const taskSpec = this.classifyEvent(event);
      
      // Step 2: Check governance policies
      const policyCheck = await this.checkGovernancePolicies(taskSpec);
      if (!policyCheck.allowed) {
        throw new Error(`Policy violation: ${policyCheck.reason}`);
      }
      
      // Step 3: Select workflow
      const workflowSelection = this.selectWorkflow(taskSpec);
      
      // Step 4: Execute workflow
      const result = await this.executeWorkflow(workflowSelection, taskSpec, options);
      
      // Step 5: Record decision and metrics
      const decisionTime = Date.now() - startTime;
      this.recordRoutingDecision(traceId, event, taskSpec, workflowSelection, result, decisionTime);
      
      // Emit metrics
      if (headyLens?.recordMetric) {
        headyLens.recordMetric('promoter.routing.duration', decisionTime);
        headyLens.recordMetric('promoter.routing.success', 1);
      }
      
      this.performanceMetrics.totalRoutings++;
      this.performanceMetrics.successfulRoutings++;
      
      return {
        traceId,
        taskSpec,
        workflowSelection,
        result,
        decisionTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const decisionTime = Date.now() - startTime;
      
      console.error(`[Headypromoter] Routing failed for event ${event.id}:`, error);
      
      // Record failure
      this.recordRoutingDecision(traceId, event, null, null, { error: error.message }, decisionTime);
      
      // Emit metrics
      if (headyLens?.recordMetric) {
        headyLens.recordMetric('promoter.routing.duration', decisionTime);
        headyLens.recordMetric('promoter.routing.failure', 1);
      }
      
      this.performanceMetrics.totalRoutings++;
      this.performanceMetrics.failedRoutings++;
      
      throw error;
    }
  }

  generateTraceId() {
    return `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  classifyEvent(event) {
    const taskSpec = {
      id: event.id || `task-${Date.now()}`,
      type: event.type || 'unknown',
      description: event.description || '',
      payload: event.payload || {},
      files: event.files || [],
      functions: event.functions || [],
      components: event.components || [],
      features: event.features || [],
      repo: event.repo || null,
      priority: event.priority || 'normal',
      complexity: event.complexity || 1.0,
      estimatedSubtasks: event.estimatedSubtasks || 0,
      risk: event.risk || 'low',
      timestamp: event.timestamp || new Date().toISOString()
    };
    
    // Estimate subtask count if not provided
    if (taskSpec.estimatedSubtasks === 0) {
      taskSpec.estimatedSubtasks = this.estimateSubtaskCount(taskSpec);
    }
    
    return taskSpec;
  }

  estimateSubtaskCount(taskSpec) {
    let count = 1;
    
    if (taskSpec.files && taskSpec.files.length > 0) {
      count += taskSpec.files.length * 2; // Estimate 2 subtasks per file
    }
    
    if (taskSpec.functions && taskSpec.functions.length > 0) {
      count += taskSpec.functions.length;
    }
    
    if (taskSpec.components && taskSpec.components.length > 0) {
      count += taskSpec.components.length * 3; // Estimate 3 subtasks per component
    }
    
    if (taskSpec.features && taskSpec.features.length > 0) {
      count += taskSpec.features.length * 5; // Estimate 5 subtasks per feature
    }
    
    return Math.min(count, 10000); // Cap at 10k for safety
  }

  async checkGovernancePolicies(taskSpec) {
    // This would integrate with HCBrain for policy checking
    // For now, implement basic safety checks
    
    // Check for forbidden patterns
    const forbiddenPatterns = ['localhost', '127.0.0.1', '.onrender.com'];
    const taskString = JSON.stringify(taskSpec).toLowerCase();
    
    for (const pattern of forbiddenPatterns) {
      if (taskString.includes(pattern)) {
        return {
          allowed: false,
          reason: `Contains forbidden pattern: ${pattern}`
        };
      }
    }
    
    // Check risk level
    if (taskSpec.risk === 'critical' && taskSpec.priority !== 'high') {
      return {
        allowed: false,
        reason: 'Critical risk tasks require high priority'
      };
    }
    
    // Check complexity vs resources
    if (taskSpec.estimatedSubtasks > 5000 && taskSpec.complexity < 5.0) {
      return {
        allowed: false,
        reason: 'High subtask count requires higher complexity rating'
      };
    }
    
    return { allowed: true };
  }

  selectWorkflow(taskSpec) {
    const workflows = this.registry?.workflows || [];
    
    // Check for battle-worthy tasks
    const isBattleWorthy = this.isBattleWorthy(taskSpec);
    
    if (isBattleWorthy) {
      return {
        workflowType: 'heady-battle',
        workflowId: 'heady-battle-mode',
        confidence: 0.9,
        reason: 'Large-scale task requiring multi-branch orchestration',
        config: this.battleConfig
      };
    }
    
    // Select standard workflow based on task characteristics
    let selectedWorkflow = null;
    let maxScore = 0;
    
    for (const workflow of workflows) {
      const score = this.calculateWorkflowScore(taskSpec, workflow);
      if (score > maxScore) {
        maxScore = score;
        selectedWorkflow = workflow;
      }
    }
    
    if (selectedWorkflow) {
      return {
        workflowType: 'standard',
        workflowId: selectedWorkflow.id,
        confidence: maxScore,
        reason: `Best match for task type: ${taskSpec.type}`,
        config: selectedWorkflow
      };
    }
    
    // Fallback to HCFullPipeline
    return {
      workflowType: 'pipeline',
      workflowId: 'hcfullpipeline',
      confidence: 0.5,
      reason: 'Default pipeline workflow',
      config: this.pipelineConfig
    };
  }

  isBattleWorthy(taskSpec) {
    const battleTriggers = this.battleConfig?.battle_triggers || {};
    
    // Check subtask count
    if (taskSpec.estimatedSubtasks >= (battleTriggers.min_subtasks_for_battle || 100)) {
      return true;
    }
    
    // Check file count
    if (taskSpec.files && taskSpec.files.length >= (battleTriggers.min_files_for_battle || 10)) {
      return true;
    }
    
    // Check complexity score
    if (taskSpec.complexity >= (battleTriggers.min_complexity_score || 7.5)) {
      return true;
    }
    
    // Check battle-worthy types
    const battleTypes = battleTriggers.battle_worthy_types || [];
    if (battleTypes.includes(taskSpec.type)) {
      return true;
    }
    
    return false;
  }

  calculateWorkflowScore(taskSpec, workflow) {
    let score = 0;
    
    // Score based on task type matching
    if (workflow.inputs && workflow.inputs.includes(taskSpec.type)) {
      score += 0.4;
    }
    
    // Score based on capabilities
    if (workflow.capabilities) {
      for (const capability of workflow.capabilities) {
        if (this.taskHasCapability(taskSpec, capability)) {
          score += 0.2;
        }
      }
    }
    
    // Score based on priority matching
    if (workflow.priority === taskSpec.priority) {
      score += 0.1;
    }
    
    // Score based on complexity matching
    if (workflow.complexity && Math.abs(workflow.complexity - taskSpec.complexity) < 1.0) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  taskHasCapability(taskSpec, capability) {
    const capabilityMap = {
      'file-processing': () => taskSpec.files && taskSpec.files.length > 0,
      'function-development': () => taskSpec.functions && taskSpec.functions.length > 0,
      'component-building': () => taskSpec.components && taskSpec.components.length > 0,
      'feature-implementation': () => taskSpec.features && taskSpec.features.length > 0,
      'ai-integration': () => taskSpec.type.includes('ai') || taskSpec.description.includes('AI'),
      'database-operations': () => taskSpec.description.toLowerCase().includes('database') || taskSpec.description.toLowerCase().includes('db'),
      'api-development': () => taskSpec.description.toLowerCase().includes('api') || taskSpec.type.includes('api')
    };
    
    const checker = capabilityMap[capability];
    return checker ? checker() : false;
  }

  async executeWorkflow(workflowSelection, taskSpec, options = {}) {
    switch (workflowSelection.workflowType) {
      case 'heady-battle':
        return await this.executeHeadyBattle(taskSpec, workflowSelection.config, options);
      
      case 'pipeline':
        return await this.executePipeline(taskSpec, workflowSelection.config, options);
      
      case 'standard':
        return await this.executeStandardWorkflow(taskSpec, workflowSelection.config, options);
      
      default:
        throw new Error(`Unknown workflow type: ${workflowSelection.workflowType}`);
    }
  }

  async executeHeadyBattle(taskSpec, battleConfig, options = {}) {
    console.log(`[Headypromoter] Executing HeadyBattle for task ${taskSpec.id}`);
    
    try {
      const battleResult = await startBattle(taskSpec, battleConfig, {
        baseBranch: options.baseBranch,
        maxWorkers: options.maxWorkers,
        batchSize: options.batchSize,
        workerFn: options.workerFn
      });
      
      // Track active battle
      this.activeWorkflows.set(battleResult.battleId, {
        type: 'heady-battle',
        taskSpec,
        battleResult,
        startTime: new Date().toISOString(),
        status: 'running'
      });
      
      return {
        workflowType: 'heady-battle',
        battleId: battleResult.battleId,
        status: 'initialized',
        devBranches: battleResult.devBranches,
        stagingBranches: battleResult.stagingBranches,
        subtaskCount: battleResult.subtaskCount,
        setupTimeMs: battleResult.setupTimeMs
      };
      
    } catch (error) {
      console.error(`[Headypromoter] HeadyBattle execution failed:`, error);
      throw error;
    }
  }

  async executePipeline(taskSpec, pipelineConfig, options = {}) {
    console.log(`[Headypromoter] Executing HCFullPipeline for task ${taskSpec.id}`);
    
    const pipelineId = `pipeline-${taskSpec.id}`;
    const stages = ['ingest', 'plan', 'execute', 'recover', 'finalize'];
    const startTime = Date.now();

    try {
      const stageResults = [];
      for (const stage of stages) {
        stageResults.push({ stage, status: 'queued', startedAt: null });
      }

      return {
        workflowType: 'pipeline',
        pipelineId,
        status: 'initialized',
        stages: stageResults,
        estimatedDuration: (taskSpec.estimatedSubtasks || 1) * 100,
        startedAt: new Date(startTime).toISOString(),
        taskId: taskSpec.id
      };
    } catch (error) {
      console.error(`[Headypromoter] Pipeline initialization failed:`, error);
      throw error;
    }
  }

  async executeStandardWorkflow(taskSpec, workflowConfig, options = {}) {
    console.log(`[Headypromoter] Executing standard workflow ${workflowConfig.id} for task ${taskSpec.id}`);
    
    // This would execute the selected standard workflow
    return {
      workflowType: 'standard',
      workflowId: workflowConfig.id,
      status: 'initialized',
      capabilities: workflowConfig.capabilities || [],
      estimatedDuration: taskSpec.estimatedSubtasks * 50 // Estimate 50ms per subtask
    };
  }

  recordRoutingDecision(traceId, event, taskSpec, workflowSelection, result, decisionTime) {
    const decision = {
      traceId,
      timestamp: new Date().toISOString(),
      event: {
        id: event.id,
        type: event.type
      },
      taskSpec: taskSpec ? {
        id: taskSpec.id,
        type: taskSpec.type,
        estimatedSubtasks: taskSpec.estimatedSubtasks,
        complexity: taskSpec.complexity
      } : null,
      workflowSelection: workflowSelection ? {
        workflowType: workflowSelection.workflowType,
        workflowId: workflowSelection.workflowId,
        confidence: workflowSelection.confidence,
        reason: workflowSelection.reason
      } : null,
      result: result.error ? { error: result.error } : {
        status: result.status,
        workflowType: result.workflowType
      },
      decisionTime,
      success: !result.error
    };
    
    this.routingDecisions.set(traceId, decision);
    
    // Keep only last 1000 decisions
    if (this.routingDecisions.size > 1000) {
      const oldestKey = this.routingDecisions.keys().next().value;
      this.routingDecisions.delete(oldestKey);
    }
    
    // Emit to HeadyLens
    if (headyLens?.recordEvent) {
      headyLens.recordEvent('promoter.routing_decision', decision);
    }
  }

  /**
   * Get system status and metrics
   */
  getSystemStatus() {
    return {
      promoter: {
        status: 'active',
        lastRefresh: this.performanceMetrics.lastRefresh,
        registryVersion: this.registryVersion,
        pipelineVersion: this.pipelineVersion,
        battleVersion: this.battleVersion
      },
      metrics: {
        ...this.performanceMetrics,
        successRate: this.performanceMetrics.totalRoutings > 0 ? 
          this.performanceMetrics.successfulRoutings / this.performanceMetrics.totalRoutings : 0,
        averageDecisionTime: this.performanceMetrics.averageDecisionTime
      },
      activeWorkflows: Array.from(this.activeWorkflows.entries()).map(([id, workflow]) => ({
        id,
        type: workflow.type,
        status: workflow.status,
        startTime: workflow.startTime,
        taskSpec: {
          id: workflow.taskSpec.id,
          type: workflow.taskSpec.type,
          estimatedSubtasks: workflow.taskSpec.estimatedSubtasks
        }
      })),
      registry: {
        components: this.registry?.components?.length || 0,
        workflows: this.registry?.workflows?.length || 0,
        aiNodes: this.registry?.aiNodes?.length || 0
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get routing history
   */
  getRoutingHistory(limit = 50) {
    const decisions = Array.from(this.routingDecisions.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return decisions;
  }

  /**
   * Get workflow details
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return null;
    }
    
    if (workflow.type === 'heady-battle' && workflow.battleResult.orchestrator) {
      return workflow.battleResult.orchestrator.getBattleStatus(workflow.taskSpec.id);
    }
    
    return {
      workflowId,
      type: workflow.type,
      status: workflow.status,
      startTime: workflow.startTime,
      taskSpec: workflow.taskSpec
    };
  }

  /**
   * Create Express router for API endpoints
   */
  createRouter() {
    const router = express.Router();
    
    // Route an event
    router.post('/route', async (req, res) => {
      try {
        const result = await this.routeEvent(req.body, req.body.options);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: 'routing_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Get system status
    router.get('/status', (req, res) => {
      res.json(this.getSystemStatus());
    });
    
    // Get routing history
    router.get('/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      res.json(this.getRoutingHistory(limit));
    });
    
    // Get workflow status
    router.get('/workflow/:id', (req, res) => {
      const status = this.getWorkflowStatus(req.params.id);
      if (!status) {
        return res.status(404).json({
          error: 'workflow_not_found',
          workflowId: req.params.id
        });
      }
      res.json(status);
    });
    
    // Refresh cache
    router.post('/refresh', async (req, res) => {
      try {
        await this.refreshCache();
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          versions: {
            registry: this.registryVersion,
            pipeline: this.pipelineVersion,
            battle: this.battleVersion
          }
        });
      } catch (error) {
        res.status(500).json({
          error: 'refresh_failed',
          message: error.message
        });
      }
    });
    
    return router;
  }
}

module.exports = Headypromoter;
