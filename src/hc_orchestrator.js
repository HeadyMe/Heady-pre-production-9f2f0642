// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/hc_orchestrator.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Copyright (c) 2026 HeadySystems Inc. (C-Corp)
 * PROPRIETARY & CONFIDENTIAL.
 * Patent Pending: Infrastructure & Orchestration Cluster
 * Implements: Distributed State Mutex, Golden Ratio UI
 */

/**
 * HeadyOrchestrator - Execution Engine
 * 
 * Executes workflow plans with parallel processing, manages state, and enforces constraints.
 * Provides telemetry and metrics for optimization.
 */

class HeadyOrchestrator {
  constructor() {
    this.activeWorkflows = new Map();
    this.agentPool = new Map();
    this.toolRegistry = new Map();
    this.metrics = new Map();
    this.telemetryBuffer = [];
    this.retryStrategies = new Map();
    
    this.initializeAgentPool();
    this.initializeToolRegistry();
    this.initializeRetryStrategies();
    this.startMetricsCollection();
  }

  /**
   * Initialize agent pool with available agents
   */
  initializeAgentPool() {
    // Research agents
    this.agentPool.set('profile-extractor', {
      endpoint: '/api/agents/profile-extractor',
      maxConcurrent: 5,
      averageLatency: 2000,
      successRate: 0.95,
      modelTier: 'medium'
    });

    this.agentPool.set('needs-analyzer', {
      endpoint: '/api/agents/needs-analyzer',
      maxConcurrent: 3,
      averageLatency: 3000,
      successRate: 0.92,
      modelTier: 'medium'
    });

    this.agentPool.set('resource-searcher', {
      endpoint: '/api/agents/resource-searcher',
      maxConcurrent: 10,
      averageLatency: 1500,
      successRate: 0.98,
      modelTier: 'small'
    });

    this.agentPool.set('match-evaluator', {
      endpoint: '/api/agents/match-evaluator',
      maxConcurrent: 4,
      averageLatency: 2500,
      successRate: 0.94,
      modelTier: 'medium'
    });

    this.agentPool.set('response-writer', {
      endpoint: '/api/agents/response-writer',
      maxConcurrent: 2,
      averageLatency: 4000,
      successRate: 0.96,
      modelTier: 'large'
    });

    // Grant-specific agents
    this.agentPool.set('grant-profile-extractor', {
      endpoint: '/api/agents/grant-profile-extractor',
      maxConcurrent: 3,
      averageLatency: 3000,
      successRate: 0.93,
      modelTier: 'medium'
    });

    this.agentPool.set('grant-searcher', {
      endpoint: '/api/agents/grant-searcher',
      maxConcurrent: 8,
      averageLatency: 2000,
      successRate: 0.97,
      modelTier: 'small'
    });

    this.agentPool.set('grant-scorer', {
      endpoint: '/api/agents/grant-scorer',
      maxConcurrent: 5,
      averageLatency: 2500,
      successRate: 0.95,
      modelTier: 'medium'
    });

    this.agentPool.set('grant-prioritizer', {
      endpoint: '/api/agents/grant-prioritizer',
      maxConcurrent: 2,
      averageLatency: 2000,
      successRate: 0.96,
      modelTier: 'medium'
    });

    this.agentPool.set('application-preparer', {
      endpoint: '/api/agents/application-preparer',
      maxConcurrent: 1,
      averageLatency: 6000,
      successRate: 0.94,
      modelTier: 'large'
    });

    // General purpose agents
    this.agentPool.set('request-analyzer', {
      endpoint: '/api/agents/request-analyzer',
      maxConcurrent: 6,
      averageLatency: 1000,
      successRate: 0.98,
      modelTier: 'small'
    });

    this.agentPool.set('knowledge-searcher', {
      endpoint: '/api/agents/knowledge-searcher',
      maxConcurrent: 8,
      averageLatency: 1500,
      successRate: 0.97,
      modelTier: 'small'
    });

    this.agentPool.set('recommendation-synthesizer', {
      endpoint: '/api/agents/recommendation-synthesizer',
      maxConcurrent: 3,
      averageLatency: 3000,
      successRate: 0.95,
      modelTier: 'medium'
    });

    // Impact evaluation agents
    this.agentPool.set('impact-evaluator', {
      endpoint: '/api/agents/impact-evaluator',
      maxConcurrent: 2,
      averageLatency: 3500,
      successRate: 0.91,
      modelTier: 'medium'
    });

    this.agentPool.set('equity-checker', {
      endpoint: '/api/agents/equity-checker',
      maxConcurrent: 2,
      averageLatency: 3000,
      successRate: 0.89,
      modelTier: 'medium'
    });
  }

  /**
   * Initialize available tools
   */
  initializeToolRegistry() {
    this.toolRegistry.set('database', {
      endpoint: '/api/tools/database',
      timeout: 5000,
      batchSize: 10,
      costPerCall: 0.001
    });

    this.toolRegistry.set('search', {
      endpoint: '/api/tools/search',
      timeout: 8000,
      batchSize: 5,
      costPerCall: 0.002
    });

    this.toolRegistry.set('vector-store', {
      endpoint: '/api/tools/vector-store',
      timeout: 3000,
      batchSize: 20,
      costPerCall: 0.001
    });

    this.toolRegistry.set('api-client', {
      endpoint: '/api/tools/api-client',
      timeout: 10000,
      batchSize: 1,
      costPerCall: 0.005
    });

    this.toolRegistry.set('cache', {
      endpoint: '/api/tools/cache',
      timeout: 1000,
      batchSize: 50,
      costPerCall: 0.0001
    });
  }

  /**
   * Initialize retry strategies for different failure types
   */
  initializeRetryStrategies() {
    this.retryStrategies.set('network_timeout', {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 10000
    });

    this.retryStrategies.set('rate_limit', {
      maxRetries: 2,
      backoffStrategy: 'linear',
      baseDelay: 5000,
      maxDelay: 15000
    });

    this.retryStrategies.set('model_overload', {
      maxRetries: 2,
      backoffStrategy: 'exponential',
      baseDelay: 2000,
      maxDelay: 8000
    });

    this.retryStrategies.set('tool_failure', {
      maxRetries: 1,
      backoffStrategy: 'fixed',
      baseDelay: 1000,
      maxDelay: 1000
    });
  }

  /**
   * Execute workflow specification
   */
  async executeWorkflow(workflowSpec, runEnvelope) {
    const runId = workflowSpec.runId;
    
    // Initialize workflow state
    const workflowState = {
      runId,
      status: 'running',
      startTime: Date.now(),
      tasks: new Map(),
      results: new Map(),
      metrics: {
        totalTasks: workflowSpec.tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        tokensUsed: 0,
        costIncurred: 0,
        averageLatency: 0
      },
      constraints: runEnvelope.constraints,
      resourceProfile: runEnvelope.resourceProfile
    };

    this.activeWorkflows.set(runId, workflowState);

    try {
      // Execute tasks according to dependencies and parallelism
      const results = await this.executeTaskSequence(workflowSpec.tasks, workflowState);
      
      // Update final state
      workflowState.status = 'completed';
      workflowState.endTime = Date.now();
      workflowState.results = results;
      
      // Calculate final metrics
      this.calculateFinalMetrics(workflowState);
      
      // Generate telemetry report
      const telemetryReport = this.generateTelemetryReport(workflowState, runEnvelope);
      
      // Send telemetry to CloudConductor
      await this.sendTelemetry(telemetryReport);
      
      return {
        success: true,
        results,
        metrics: workflowState.metrics,
        telemetryReport
      };

    } catch (error) {
      workflowState.status = 'failed';
      workflowState.endTime = Date.now();
      workflowState.error = error.message;
      
      // Generate error telemetry
      const telemetryReport = this.generateTelemetryReport(workflowState, runEnvelope);
      await this.sendTelemetry(telemetryReport);
      
      throw error;
    } finally {
      // Cleanup workflow state after delay
      setTimeout(() => {
        this.activeWorkflows.delete(runId);
      }, 300000); // Keep for 5 minutes for debugging
    }
  }

  /**
   * Execute sequence of tasks with parallel processing
   */
  async executeTaskSequence(tasks, workflowState) {
    const results = new Map();
    const taskQueue = [...tasks];
    const completedTasks = new Set();
    const runningTasks = new Map();

    while (taskQueue.length > 0 || runningTasks.size > 0) {
      // Find tasks that can run (dependencies satisfied)
      const readyTasks = taskQueue.filter(task => {
        if (task.inputs) {
          return task.inputs.every(input => results.has(input));
        }
        return true;
      });

      // Group ready tasks by parallelism capability
      const parallelTasks = readyTasks.filter(task => task.parallel);
      const sequentialTasks = readyTasks.filter(task => !task.parallel);

      // Execute parallel tasks
      if (parallelTasks.length > 0) {
        const parallelPromises = parallelTasks.map(task => 
          this.executeTask(task, workflowState, results)
        );
        
        const parallelResults = await Promise.allSettled(parallelPromises);
        
        // Process results
        parallelResults.forEach((result, index) => {
          const task = parallelTasks[index];
          if (result.status === 'fulfilled') {
            results.set(task.id, result.value);
            completedTasks.add(task.id);
            workflowState.metrics.completedTasks++;
          } else {
            workflowState.metrics.failedTasks++;
            throw new Error(`Task ${task.id} failed: ${result.reason.message}`);
          }
        });

        // Remove completed tasks from queue
        taskQueue.splice(taskQueue.indexOf(parallelTasks[0]), parallelTasks.length);
      }

      // Execute sequential tasks one by one
      for (const task of sequentialTasks) {
        try {
          const result = await this.executeTask(task, workflowState, results);
          results.set(task.id, result);
          completedTasks.add(task.id);
          workflowState.metrics.completedTasks++;
        } catch (error) {
          workflowState.metrics.failedTasks++;
          throw new Error(`Task ${task.id} failed: ${error.message}`);
        }
        
        // Remove from queue
        const index = taskQueue.indexOf(task);
        if (index > -1) {
          taskQueue.splice(index, 1);
        }
      }

      // Check constraints
      await this.checkConstraints(workflowState);
      
      // Small delay to prevent tight loops
      if (taskQueue.length > 0 && runningTasks.size === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return Object.fromEntries(results);
  }

  /**
   * Execute individual task with retry logic
   */
  async executeTask(task, workflowState, availableResults) {
    const taskStartTime = Date.now();
    const agentConfig = this.agentPool.get(task.agent);
    
    if (!agentConfig) {
      throw new Error(`Unknown agent: ${task.agent}`);
    }

    // Check agent capacity
    await this.checkAgentCapacity(task.agent);

    // Prepare task inputs
    const inputs = this.prepareTaskInputs(task, availableResults);
    
    // Execute with retry logic
    let lastError;
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const result = await this.callAgent(task, inputs, agentConfig, workflowState);
        
        // Update metrics
        const taskDuration = Date.now() - taskStartTime;
        this.updateTaskMetrics(task.agent, taskDuration, true, result.tokensUsed || 0);
        
        // Validate acceptance criteria
        if (!this.validateAcceptanceCriteria(task, result)) {
          throw new Error(`Task ${task.id} did not meet acceptance criteria`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < 3) {
          const retryDelay = this.calculateRetryDelay(error, attempt);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if agent has capacity for new task
   */
  async checkAgentCapacity(agentId) {
    const agentConfig = this.agentPool.get(agentId);
    const currentUsage = this.getAgentUsage(agentId);
    
    if (currentUsage >= agentConfig.maxConcurrent) {
      // Wait for capacity
      await new Promise(resolve => {
        const checkCapacity = () => {
          if (this.getAgentUsage(agentId) < agentConfig.maxConcurrent) {
            resolve();
          } else {
            setTimeout(checkCapacity, 500);
          }
        };
        checkCapacity();
      });
    }
  }

  /**
   * Get current agent usage
   */
  getAgentUsage(agentId) {
    let usage = 0;
    for (const workflow of this.activeWorkflows.values()) {
      if (workflow.status === 'running') {
        // Count running tasks for this agent
        usage += Array.from(workflow.tasks.values())
          .filter(task => task.agent === agentId && task.status === 'running')
          .length;
      }
    }
    return usage;
  }

  /**
   * Prepare task inputs from available results
   */
  prepareTaskInputs(task, availableResults) {
    const inputs = {};
    
    if (task.inputs) {
      task.inputs.forEach(inputName => {
        if (availableResults.has(inputName)) {
          inputs[inputName] = availableResults.get(inputName);
        }
      });
    }
    
    return inputs;
  }

  /**
   * Call agent with proper error handling
   */
  async callAgent(task, inputs, agentConfig, workflowState) {
    const payload = {
      task: task.id,
      agent: task.agent,
      inputs,
      constraints: {
        maxTokens: task.maxTokens || agentConfig.maxTokens || 4000,
        timeout: task.timeout || 30000,
        temperature: task.temperature || 0.5
      },
      context: {
        runId: workflowState.runId,
        workflowType: workflowState.workflowType,
        impactTier: workflowState.impactTier
      }
    };

    // In real implementation, this would make HTTP call to agent endpoint
    // For now, simulate agent call
    const result = await this.simulateAgentCall(payload, agentConfig);
    
    // Update workflow metrics
    if (result.tokensUsed) {
      workflowState.metrics.tokensUsed += result.tokensUsed;
    }
    
    if (result.cost) {
      workflowState.metrics.costIncurred += result.cost;
    }
    
    return result;
  }

  /**
   * Simulate agent call (replace with actual HTTP call)
   */
  async simulateAgentCall(payload, agentConfig) {
    // Simulate network latency
    await new Promise(resolve => 
      setTimeout(resolve, agentConfig.averageLatency + (Math.random() - 0.5) * 1000)
    );
    
    // Simulate success/failure
    if (Math.random() > agentConfig.successRate) {
      throw new Error('Agent call failed');
    }
    
    // Simulate response
    return {
      success: true,
      data: {
        [payload.task]: `Result for ${payload.task} from ${payload.agent}`,
        timestamp: Date.now()
      },
      tokensUsed: Math.floor(Math.random() * 1000) + 500,
      cost: agentConfig.modelTier === 'large' ? 0.05 : 
            agentConfig.modelTier === 'medium' ? 0.02 : 0.005,
      latency: agentConfig.averageLatency
    };
  }

  /**
   * Validate task acceptance criteria
   */
  validateAcceptanceCriteria(task, result) {
    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
      return true;
    }
    
    // Simple validation - in real implementation would be more sophisticated
    const resultString = JSON.stringify(result).toLowerCase();
    
    return task.acceptanceCriteria.every(criterion => 
      resultString.includes(criterion.toLowerCase())
    );
  }

  /**
   * Calculate retry delay based on error and attempt
   */
  calculateRetryDelay(error, attempt) {
    const errorType = this.classifyError(error);
    const strategy = this.retryStrategies.get(errorType);
    
    if (!strategy) {
      return 1000; // Default 1 second
    }
    
    let delay;
    switch (strategy.backoffStrategy) {
      case 'exponential':
        delay = strategy.baseDelay * Math.pow(2, attempt);
        break;
      case 'linear':
        delay = strategy.baseDelay * (attempt + 1);
        break;
      case 'fixed':
      default:
        delay = strategy.baseDelay;
        break;
    }
    
    return Math.min(delay, strategy.maxDelay);
  }

  /**
   * Classify error type for retry strategy
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return 'network_timeout';
    } else if (message.includes('rate limit')) {
      return 'rate_limit';
    } else if (message.includes('overload') || message.includes('capacity')) {
      return 'model_overload';
    } else {
      return 'tool_failure';
    }
  }

  /**
   * Check workflow constraints
   */
  async checkConstraints(workflowState) {
    const { constraints, metrics } = workflowState;
    
    // Check token limit
    if (constraints.maxTokens && metrics.tokensUsed > constraints.maxTokens) {
      throw new Error(`Token limit exceeded: ${metrics.tokensUsed} > ${constraints.maxTokens}`);
    }
    
    // Check cost limit
    if (constraints.maxCost && metrics.costIncurred > constraints.maxCost) {
      throw new Error(`Cost limit exceeded: ${metrics.costIncurred} > ${constraints.maxCost}`);
    }
    
    // Check latency (soft constraint - log warning)
    if (constraints.targetLatency) {
      const currentLatency = Date.now() - workflowState.startTime;
      if (currentLatency > constraints.targetLatency) {
        console.warn(`Latency target exceeded: ${currentLatency}ms > ${constraints.targetLatency}ms`);
      }
    }
  }

  /**
   * Update task metrics
   */
  updateTaskMetrics(agentId, duration, success, tokensUsed) {
    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, {
        totalCalls: 0,
        successfulCalls: 0,
        totalLatency: 0,
        totalTokens: 0,
        averageLatency: 0,
        successRate: 0
      });
    }
    
    const metrics = this.metrics.get(agentId);
    metrics.totalCalls++;
    metrics.totalLatency += duration;
    metrics.totalTokens += tokensUsed;
    
    if (success) {
      metrics.successfulCalls++;
    }
    
    metrics.averageLatency = metrics.totalLatency / metrics.totalCalls;
    metrics.successRate = metrics.successfulCalls / metrics.totalCalls;
  }

  /**
   * Calculate final workflow metrics
   */
  calculateFinalMetrics(workflowState) {
    const duration = workflowState.endTime - workflowState.startTime;
    workflowState.metrics.totalDuration = duration;
    workflowState.metrics.averageLatency = duration / workflowState.metrics.totalTasks;
    workflowState.metrics.successRate = workflowState.metrics.completedTasks / workflowState.metrics.totalTasks;
  }

  /**
   * Generate telemetry report
   */
  generateTelemetryReport(workflowState, runEnvelope) {
    return {
      runId: workflowState.runId,
      tenant: runEnvelope.tenant,
      workflowType: runEnvelope.workflowType,
      impactTier: runEnvelope.impactTier,
      status: workflowState.status,
      startTime: workflowState.startTime,
      endTime: workflowState.endTime,
      metrics: {
        ...workflowState.metrics,
        taskBreakdown: this.getTaskBreakdown(workflowState)
      },
      outcomes: {
        success: workflowState.status === 'completed',
        error: workflowState.error,
        humanInterventions: workflowState.humanInterventions || 0
      },
      resourceUsage: {
        modelTiers: this.getModelTierUsage(workflowState),
        tools: this.getToolUsage(workflowState)
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get task breakdown for telemetry
   */
  getTaskBreakdown(workflowState) {
    const breakdown = {};
    
    for (const [taskId, task] of workflowState.tasks) {
      const agent = task.agent;
      if (!breakdown[agent]) {
        breakdown[agent] = {
          count: 0,
          totalLatency: 0,
          totalTokens: 0,
          successRate: 0
        };
      }
      
      breakdown[agent].count++;
      breakdown[agent].totalLatency += task.latency || 0;
      breakdown[agent].totalTokens += task.tokensUsed || 0;
    }
    
    return breakdown;
  }

  /**
   * Get model tier usage
   */
  getModelTierUsage(workflowState) {
    const usage = { small: 0, medium: 0, large: 0 };
    
    for (const task of workflowState.tasks.values()) {
      const agentConfig = this.agentPool.get(task.agent);
      if (agentConfig) {
        usage[agentConfig.modelTier]++;
      }
    }
    
    return usage;
  }

  /**
   * Get tool usage
   */
  getToolUsage(workflowState) {
    const usage = {};
    
    for (const task of workflowState.tasks.values()) {
      if (task.tools) {
        task.tools.forEach(tool => {
          usage[tool] = (usage[tool] || 0) + 1;
        });
      }
    }
    
    return usage;
  }

  /**
   * Send telemetry to CloudConductor
   */
  async sendTelemetry(telemetryReport) {
    // Add to buffer for batch processing
    this.telemetryBuffer.push(telemetryReport);
    
    // Process buffer if it's getting full
    if (this.telemetryBuffer.length >= 10) {
      await this.flushTelemetryBuffer();
    }
  }

  /**
   * Flush telemetry buffer
   */
  async flushTelemetryBuffer() {
    if (this.telemetryBuffer.length === 0) return;
    
    const reports = [...this.telemetryBuffer];
    this.telemetryBuffer = [];
    
    // In real implementation, would send to CloudConductor
    console.log(`Sending ${reports.length} telemetry reports to CloudConductor`);
    
    // Simulate sending
    reports.forEach(report => {
      console.log(`Telemetry for ${report.runId}: ${report.status}, ${report.metrics.totalDuration}ms`);
    });
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const systemMetrics = {
      timestamp: Date.now(),
      activeWorkflows: this.activeWorkflows.size,
      agentMetrics: Object.fromEntries(this.metrics),
      queueDepths: this.getQueueDepths(),
      resourceUtilization: this.getResourceUtilization()
    };
    
    console.log('System Metrics:', JSON.stringify(systemMetrics, null, 2));
  }

  /**
   * Get queue depths for agents
   */
  getQueueDepths() {
    const depths = {};
    
    for (const [agentId, config] of this.agentPool) {
      depths[agentId] = this.getAgentUsage(agentId);
    }
    
    return depths;
  }

  /**
   * Get resource utilization
   */
  getResourceUtilization() {
    const utilization = {
      agents: {},
      tools: {}
    };
    
    // Agent utilization
    for (const [agentId, config] of this.agentPool) {
      const usage = this.getAgentUsage(agentId);
      utilization.agents[agentId] = usage / config.maxConcurrent;
    }
    
    // Tool utilization would be calculated similarly
    // For now, return placeholder
    utilization.tools = {
      database: 0.3,
      search: 0.5,
      'vector-store': 0.2
    };
    
    return utilization;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(runId) {
    return this.activeWorkflows.get(runId);
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(runId) {
    const workflow = this.activeWorkflows.get(runId);
    if (workflow) {
      workflow.status = 'cancelled';
      workflow.endTime = Date.now();
      
      // Generate cancellation telemetry
      const telemetryReport = this.generateTelemetryReport(workflow, {
        tenant: workflow.tenant,
        workflowType: workflow.workflowType,
        impactTier: workflow.impactTier
      });
      
      await this.sendTelemetry(telemetryReport);
      
      return true;
    }
    return false;
  }

  /**
   * Get system health
   */
  getSystemHealth() {
    return {
      status: 'healthy',
      activeWorkflows: this.activeWorkflows.size,
      agentHealth: this.getAgentHealth(),
      recentErrors: this.getRecentErrors(),
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Get agent health status
   */
  getAgentHealth() {
    const health = {};
    
    for (const [agentId, config] of this.agentPool) {
      const metrics = this.metrics.get(agentId);
      const usage = this.getAgentUsage(agentId);
      
      health[agentId] = {
        status: usage < config.maxConcurrent ? 'healthy' : 'overloaded',
        successRate: metrics?.successRate || 0,
        averageLatency: metrics?.averageLatency || 0,
        currentLoad: usage,
        maxCapacity: config.maxConcurrent
      };
    }
    
    return health;
  }

  /**
   * Get recent errors
   */
  getRecentErrors() {
    // In real implementation, would track actual errors
    return [];
  }
}

module.exports = HeadyOrchestrator;
