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
// ║  FILE: hcfp-full-auto-engine.js                              ║
// ║  UPDATED: 20260219-220000                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🚀 HCFP Full Auto Engine
 * 
 * Continuous beneficial tasks execution with intelligent, self-aware,
 * deterministic orchestration and dynamic resource allocation
 * 
 * This is the core engine that makes hcfp --full-auto mean:
 * "Always be doing something useful, within guardrails, until there is a serious, measurable reason to pause"
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');

class HCFPFullAutoEngine extends EventEmitter {
  constructor(configPath = null) {
    super();
    
    this.configPath = configPath || path.join(__dirname, '../../configs/hcfullpipeline.yaml');
    this.aiRouterPath = path.join(__dirname, '../../configs/ai-routing.yaml');
    this.nodeRegistryPath = path.join(__dirname, '../../configs/node-routing-registry.json');
    
    // Core state
    this.isRunning = false;
    this.currentORS = 70;
    this.stopReasons = [];
    this.activeTasks = new Map();
    this.taskHistory = [];
    this.performanceMetrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgTaskDuration: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        cloud: 0
      }
    };
    
    // AI Router integration
    this.aiRouter = null;
    this.routingDecisions = [];
    
    // Self-awareness
    this.selfModel = {
      bottlenecks: [],
      patterns: [],
      learnedStrategies: [],
      adaptationHistory: []
    };
    
    // Timers
    this.mainLoopTimer = null;
    this.healthCheckTimer = null;
    this.optimizationTimer = null;
    this.selfCritiqueTimer = null;
    
    console.log('[HCFP-Engine] Full Auto Engine initialized');
  }

  /**
   * 🚀 Start the full auto engine
   */
  async start() {
    if (this.isRunning) {
      console.log('[HCFP-Engine] Already running');
      return;
    }
    
    console.log('\n🚀 STARTING HCFP FULL AUTO ENGINE');
    console.log('='.repeat(60));
    
    try {
      // Load configurations
      await this.loadConfigurations();
      
      // Initialize AI router
      await this.initializeAIRouter();
      
      // Initialize self-awareness
      await this.initializeSelfAwareness();
      
      // Start main loop
      this.startMainLoop();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start optimization
      this.startOptimization();
      
      // Start self-critique
      this.startSelfCritique();
      
      this.isRunning = true;
      this.emit('started');
      
      console.log('✅ HCFP Full Auto Engine started successfully');
      console.log('🎯 Continuous beneficial tasks execution begun');
      
    } catch (error) {
      console.error('❌ Failed to start engine:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 🛑 Stop the full auto engine
   */
  async stop(reason = 'Manual stop') {
    if (!this.isRunning) {
      console.log('[HCFP-Engine] Already stopped');
      return;
    }
    
    console.log(`\n🛑 STOPPING HCFP FULL AUTO ENGINE`);
    console.log(`Reason: ${reason}`);
    
    // Clear all timers
    if (this.mainLoopTimer) clearInterval(this.mainLoopTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.optimizationTimer) clearInterval(this.optimizationTimer);
    if (this.selfCritiqueTimer) clearInterval(this.selfCritiqueTimer);
    
    // Wait for active tasks to complete (with timeout)
    const taskTimeout = setTimeout(() => {
      console.log('⚠️ Force stopping remaining tasks');
      this.activeTasks.clear();
    }, 30000);
    
    while (this.activeTasks.size > 0) {
      console.log(`⏳ Waiting for ${this.activeTasks.size} active tasks to complete...`);
      await this.sleep(1000);
    }
    clearTimeout(taskTimeout);
    
    this.isRunning = false;
    this.stopReasons.push({ timestamp: new Date(), reason });
    
    this.emit('stopped', { reason });
    console.log('✅ HCFP Full Auto Engine stopped');
  }

  /**
   * 📊 Load all configurations
   */
  async loadConfigurations() {
    try {
      // Load main pipeline config
      const pipelineConfig = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.load(pipelineConfig);
      
      // Load AI router config
      const aiRouterConfig = fs.readFileSync(this.aiRouterPath, 'utf8');
      this.aiRouterConfig = yaml.load(aiRouterConfig);
      
      // Load node registry
      if (fs.existsSync(this.nodeRegistryPath)) {
        const nodeRegistry = fs.readFileSync(this.nodeRegistryPath, 'utf8');
        this.nodeRegistry = JSON.parse(nodeRegistry);
      } else {
        this.nodeRegistry = { nodes: [] };
      }
      
      console.log('✅ Configurations loaded successfully');
      
    } catch (error) {
      console.error('❌ Failed to load configurations:', error);
      throw error;
    }
  }

  /**
   * 🤖 Initialize AI Router
   */
  async initializeAIRouter() {
    try {
      // Import AI router (simplified for this example)
      const HCAIRouterSimple = require('../ai-router/hc-ai-router-simple');
      
      this.aiRouter = new HCAIRouterSimple({
        configPath: this.aiRouterPath,
        nodeId: 'hcfp-engine',
        primaryTask: 'system_optimization',
        fallbackTask: 'error_analysis',
        maxConcurrentTasks: 8,
        priority: 'critical'
      });
      
      await this.aiRouter.initialize();
      console.log('✅ AI Router initialized');
      
    } catch (error) {
      console.warn('⚠️ Could not initialize AI Router:', error.message);
      // Continue without AI router
    }
  }

  /**
   * 🧠 Initialize self-awareness
   */
  async initializeSelfAwareness() {
    this.selfModel = {
      bottlenecks: [],
      patterns: [],
      learnedStrategies: [],
      adaptationHistory: [],
      capabilities: {
        max_concurrent_tasks: this.config?.profiles?.full_auto?.stages?.execute?.parallelism?.normal || 8,
        preferred_providers: this.aiRouterConfig?.providers ? Object.keys(this.aiRouterConfig.providers) : [],
        production_domains: this.config?.production_domains || {}
      },
      current_state: {
        ors: this.currentORS,
        active_nodes: this.nodeRegistry.nodes?.length || 0,
        resource_utilization: { ...this.performanceMetrics.resourceUtilization }
      }
    };
    
    console.log('✅ Self-awareness initialized');
  }

  /**
   * 🔄 Start main execution loop
   */
  startMainLoop() {
    const loopInterval = this.config?.profiles?.full_auto?.loop_interval_seconds || 60;
    
    this.mainLoopTimer = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.executeMainLoop();
      } catch (error) {
        console.error('❌ Main loop error:', error);
        this.emit('loop_error', error);
      }
    }, loopInterval * 1000);
    
    console.log(`🔄 Main loop started (interval: ${loopInterval}s)`);
  }

  /**
   * 🔧 Execute main loop iteration
   */
  async executeMainLoop() {
    const loopId = this.generateTraceId();
    console.log(`\n🔄 Main Loop ${loopId}`);
    
    try {
      // Check stop conditions
      const stopCondition = await this.checkStopConditions();
      if (stopCondition) {
        console.log(`🛑 Stop condition met: ${stopCondition.reason}`);
        await this.stop(stopCondition.reason);
        return;
      }
      
      // Update ORS
      await this.updateORS();
      
      // Determine operational mode based on ORS
      const mode = this.determineMode();
      console.log(`📊 ORS: ${this.currentORS}, Mode: ${mode}`);
      
      // Schedule beneficial tasks
      await this.scheduleBeneficialTasks(mode);
      
      // Update performance metrics
      this.updatePerformanceMetrics();
      
      // Emit loop completion
      this.emit('loop_completed', { loopId, ors: this.currentORS, mode });
      
    } catch (error) {
      console.error(`❌ Loop ${loopId} failed:`, error);
      this.emit('loop_failed', { loopId, error });
    }
  }

  /**
   * 🛑 Check stop conditions
   */
  async checkStopConditions() {
    const stopConditions = this.config?.profiles?.full_auto?.stop_conditions || [];
    
    for (const condition of stopConditions) {
      const shouldStop = await this.evaluateStopCondition(condition);
      if (shouldStop) {
        return {
          condition: condition.name,
          reason: condition.reason || `Stop condition: ${condition.name}`
        };
      }
    }
    
    return null;
  }

  /**
   * 📏 Evaluate individual stop condition
   */
  async evaluateStopCondition(condition) {
    const utilization = this.performanceMetrics?.resourceUtilization || {
      cpu: 0,
      memory: 0,
      cloud: 0
    };
    
    switch (condition.name) {
      case 'low_ors_recovery':
        return this.currentORS < 50;
        
      case 'repeated_critical_errors':
        // Check for repeated critical errors in task history
        const recentErrors = this.taskHistory
          .filter(task => task.status === 'failed' && task.critical)
          .filter(task => Date.now() - task.timestamp < 600000); // Last 10 minutes
        return recentErrors.length >= 3;
        
      case 'policy_violation':
        // Check for localhost/.onrender usage
        return await this.checkPolicyViolations();
        
      case 'local_resource_stress':
        return utilization.cpu > 85 || utilization.memory > 85;
        
      case 'cloud_quota_stress':
        return utilization.cloud > 90;
        
      case 'ai_router_degraded':
        return this.aiRouter && await this.aiRouter.getHealthScore() < 0.7;
        
      default:
        console.warn(`⚠️ Unknown stop condition: ${condition.name}`);
        return false;
    }
  }

  /**
   * 📊 Update Operational Readiness Score
   */
  async updateORS() {
    try {
      // Try to get ORS from system
      const response = await fetch('https://api.headysystems.com/api/system-status');
      if (response.ok) {
        const data = await response.json();
        this.currentORS = data.ors || this.currentORS;
      }
    } catch (error) {
      // Calculate ORS locally if remote endpoint unavailable
      this.currentORS = this.calculateLocalORS();
    }
  }

  /**
   * 🧮 Calculate local ORS
   */
  calculateLocalORS() {
    let score = 70; // Base score
    
    // Factor in resource utilization
    const utilization = this.performanceMetrics.resourceUtilization;
    if (utilization.cpu > 85) score -= 20;
    if (utilization.memory > 85) score -= 20;
    if (utilization.cloud > 90) score -= 15;
    
    // Factor in task success rate
    const successRate = this.performanceMetrics.totalTasks > 0 
      ? this.performanceMetrics.successfulTasks / this.performanceMetrics.totalTasks 
      : 1;
    score *= successRate;
    
    // Factor in AI router health
    if (this.aiRouter) {
      const routerHealth = this.aiRouter.getHealthScore();
      score *= routerHealth;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 🎯 Determine operational mode
   */
  determineMode() {
    const thresholds = this.config?.profiles?.full_auto?.ors_thresholds || {};
    
    if (this.currentORS >= thresholds.aggressive_build_min || 85) return 'aggressive';
    if (this.currentORS >= thresholds.normal_min || 70) return 'normal';
    if (this.currentORS >= thresholds.maintenance_min || 50) return 'maintenance';
    return 'recovery';
  }

  /**
   * 📋 Schedule beneficial tasks
   */
  async scheduleBeneficialTasks(mode) {
    const backgroundTasks = this.config?.profiles?.full_auto?.background_tasks?.always_on || [];
    const maxConcurrent = this.getMaxConcurrentTasks(mode);
    
    console.log(`📋 Scheduling tasks (mode: ${mode}, max concurrent: ${maxConcurrent})`);
    
    for (const taskConfig of backgroundTasks) {
      if (this.activeTasks.size >= maxConcurrent) {
        console.log(`⏸️ Max concurrent tasks reached, skipping ${taskConfig.name}`);
        break;
      }
      
      // Check if task should run now
      if (await this.shouldRunTask(taskConfig)) {
        await this.executeTask(taskConfig, mode);
      }
    }
  }

  /**
   * 🔍 Check if task should run
   */
  async shouldRunTask(taskConfig) {
    // Check if task is already running
    if (this.activeTasks.has(taskConfig.name)) {
      return false;
    }
    
    // Check interval (simplified - in real implementation would track last run time)
    return true; // For now, run all tasks
  }

  /**
   * ⚡ Execute task
   */
  async executeTask(taskConfig, mode) {
    const taskId = this.generateTraceId();
    const startTime = Date.now();
    
    console.log(`⚡ Executing task: ${taskConfig.name} (${taskId})`);
    
    // Add to active tasks
    this.activeTasks.set(taskConfig.name, {
      id: taskId,
      config: taskConfig,
      startTime,
      mode
    });
    
    try {
      // Route through AI router if available
      let result;
      if (this.aiRouter && taskConfig.ai_router_task) {
        result = await this.aiRouter.routeRequest(
          taskConfig.ai_router_task,
          this.generateTaskPrompt(taskConfig, mode),
          {
            importance: 'background',
            traceId: taskId
          }
        );
      } else {
        // Fallback execution
        result = await this.executeTaskDirectly(taskConfig, mode);
      }
      
      const duration = Date.now() - startTime;
      
      // Update metrics
      this.performanceMetrics.totalTasks++;
      this.performanceMetrics.successfulTasks++;
      this.updateAvgDuration(duration);
      
      // Add to history
      this.taskHistory.push({
        id: taskId,
        name: taskConfig.name,
        status: 'success',
        startTime,
        duration,
        result,
        mode
      });
      
      console.log(`✅ Task completed: ${taskConfig.name} (${duration}ms)`);
      this.emit('task_completed', { taskId, task: taskConfig, result, duration });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update metrics
      this.performanceMetrics.totalTasks++;
      this.performanceMetrics.failedTasks++;
      
      // Add to history
      this.taskHistory.push({
        id: taskId,
        name: taskConfig.name,
        status: 'failed',
        startTime,
        duration,
        error: error.message,
        critical: taskConfig.type === 'health_check',
        mode
      });
      
      console.error(`❌ Task failed: ${taskConfig.name} - ${error.message}`);
      this.emit('task_failed', { taskId, task: taskConfig, error });
      
    } finally {
      // Remove from active tasks
      this.activeTasks.delete(taskConfig.name);
    }
  }

  /**
   * 🎯 Generate task prompt for AI router
   */
  generateTaskPrompt(taskConfig, mode) {
    const prompts = {
      system_health_monitor: `Analyze the current system health status. ORS: ${this.currentORS}, Mode: ${mode}. Provide health assessment and recommendations.`,
      performance_profiler: `Profile system performance. Current metrics: ${JSON.stringify(this.performanceMetrics)}. Identify bottlenecks and optimization opportunities.`,
      error_pattern_detector: `Analyze recent task history for error patterns. History: ${JSON.stringify(this.taskHistory.slice(-10))}. Identify recurring issues and suggest solutions.`,
      config_drift_checker: `Check for configuration drift. Compare current state with expected configuration and report any discrepancies.`,
      resource_usage_tracker: `Track and analyze resource usage patterns. Current utilization: ${JSON.stringify(this.performanceMetrics.resourceUtilization)}. Suggest optimizations.`
    };
    
    return prompts[taskConfig.name] || `Execute ${taskConfig.name} task in ${mode} mode.`;
  }

  /**
   * 🔧 Execute task directly (fallback)
   */
  async executeTaskDirectly(taskConfig, mode) {
    // Simplified direct execution
    switch (taskConfig.type) {
      case 'health_check':
        return await this.performHealthCheck();
      case 'optimization':
        return await this.performOptimization();
      case 'analysis':
        return await this.performAnalysis();
      case 'validation':
        return await this.performValidation();
      case 'monitoring':
        return await this.performMonitoring();
      default:
        return { status: 'completed', message: `Task ${taskConfig.name} executed` };
    }
  }

  /**
   * 🏥 Perform health check
   */
  async performHealthCheck() {
    const checks = [];
    
    // Check AI router
    if (this.aiRouter) {
      const routerHealth = this.aiRouter.getHealthScore();
      checks.push({ component: 'ai_router', status: routerHealth > 0.7 ? 'healthy' : 'degraded', score: routerHealth });
    }
    
    // Check resource utilization
    const utilization = this.performanceMetrics.resourceUtilization;
    checks.push({ 
      component: 'resources', 
      status: utilization.cpu < 85 && utilization.memory < 85 ? 'healthy' : 'degraded',
      utilization 
    });
    
    // Check active tasks
    checks.push({ component: 'tasks', status: this.activeTasks.size < 10 ? 'healthy' : 'degraded', active: this.activeTasks.size });
    
    return { checks, overall: checks.every(c => c.status === 'healthy') ? 'healthy' : 'degraded' };
  }

  /**
   * ⚡ Get max concurrent tasks for mode
   */
  getMaxConcurrentTasks(mode) {
    const parallelism = this.config?.profiles?.full_auto?.stages?.execute?.parallelism || {};
    
    switch (mode) {
      case 'aggressive': return parallelism.aggressive || 16;
      case 'normal': return parallelism.normal || 8;
      case 'maintenance': return parallelism.maintenance || 2;
      case 'recovery': return 1;
      default: return 8;
    }
  }

  /**
   * 🏥 Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, 30000); // Every 30 seconds
    
    console.log('🏥 Health monitoring started');
  }

  /**
   * 🚀 Start optimization
   */
  startOptimization() {
    this.optimizationTimer = setInterval(async () => {
      if (!this.isRunning || this.currentORS < 70) return;
      
      try {
        await this.performOptimization();
      } catch (error) {
        console.error('❌ Optimization failed:', error);
      }
    }, 300000); // Every 5 minutes
    
    console.log('🚀 Optimization started');
  }

  /**
   * 🧠 Start self-critique
   */
  startSelfCritique() {
    const critiqueInterval = this.config?.self_critique?.critique_interval_hours || 6;
    
    this.selfCritiqueTimer = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.performSelfCritique();
      } catch (error) {
        console.error('❌ Self-critique failed:', error);
      }
    }, critiqueInterval * 60 * 60 * 1000); // Convert hours to milliseconds
    
    console.log(`🧠 Self-critique started (interval: ${critiqueInterval}h)`);
  }

  /**
   * 📈 Update performance metrics
   */
  updatePerformanceMetrics() {
    // Update resource utilization (simplified)
    this.performanceMetrics.resourceUtilization = {
      cpu: Math.random() * 100, // In real implementation, would get actual metrics
      memory: Math.random() * 100,
      cloud: Math.random() * 100
    };
  }

  /**
   * 📥 Record external performance/health data
   */
  recordPerformance(entry = {}) {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
    const enrichedEntry = {
      ...entry,
      timestamp,
      source: entry.source || 'external'
    };

    // Maintain bounded history to avoid unbounded growth
    if (!this.performanceMetrics.externalRecords) {
      this.performanceMetrics.externalRecords = [];
    }
    this.performanceMetrics.externalRecords.push(enrichedEntry);
    if (this.performanceMetrics.externalRecords.length > 200) {
      this.performanceMetrics.externalRecords.shift();
    }

    // Update resource utilization/ORS hints when health scores provided
    if (typeof entry.health_score === 'number') {
      const previousORS = this.currentORS;
      this.currentORS = Math.max(0, Math.min(100, entry.health_score));
      this.emit('ors_updated', {
        ors: this.currentORS,
        previous_ors: previousORS,
        source: enrichedEntry.source
      });
    }
  }

  /**
   * ⏱️ Update average duration
   */
  updateAvgDuration(newDuration) {
    const total = this.performanceMetrics.totalTasks;
    const current = this.performanceMetrics.avgTaskDuration;
    this.performanceMetrics.avgTaskDuration = ((current * (total - 1)) + newDuration) / total;
  }

  /**
   * 🎭 Perform optimization
   */
  async performOptimization() {
    console.log('🚀 Performing system optimization...');
    
    // Analyze performance patterns
    const patterns = this.analyzePerformancePatterns();
    
    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(patterns);
    
    // Apply safe optimizations automatically
    for (const suggestion of suggestions) {
      if (suggestion.safe) {
        await this.applyOptimization(suggestion);
      }
    }
    
    return { patterns, suggestions };
  }

  /**
   * 📊 Analyze performance patterns
   */
  analyzePerformancePatterns() {
    const recentTasks = this.taskHistory.slice(-50);
    
    return {
      avgDuration: recentTasks.reduce((sum, task) => sum + (task.duration || 0), 0) / recentTasks.length,
      failureRate: recentTasks.filter(t => t.status === 'failed').length / recentTasks.length,
      busiestHour: this.getBusiestHour(recentTasks),
      commonErrors: this.getCommonErrors(recentTasks)
    };
  }

  /**
   * 💡 Generate optimization suggestions
   */
  generateOptimizationSuggestions(patterns) {
    const suggestions = [];
    
    if (patterns.failureRate > 0.1) {
      suggestions.push({
        type: 'reduce_concurrency',
        reason: 'High failure rate detected',
        safe: true,
        impact: 'Reduce concurrent tasks by 25%'
      });
    }
    
    if (patterns.avgDuration > 5000) {
      suggestions.push({
        type: 'increase_timeouts',
        reason: 'Tasks taking too long',
        safe: true,
        impact: 'Increase task timeouts by 50%'
      });
    }
    
    return suggestions;
  }

  /**
   * 🔧 Apply optimization
   */
  async applyOptimization(suggestion) {
    console.log(`🔧 Applying optimization: ${suggestion.type} - ${suggestion.reason}`);
    
    // In real implementation, would actually apply the optimization
    this.selfModel.adaptationHistory.push({
      timestamp: new Date(),
      optimization: suggestion,
      status: 'applied'
    });
  }

  /**
   * 🧠 Perform self-critique
   */
  async performSelfCritique() {
    console.log('🧠 Performing self-critique...');
    
    const critique = {
      performance: this.critiquePerformance(),
      decisions: this.critiqueDecisions(),
      adaptations: this.critiqueAdaptations(),
      recommendations: this.generateRecommendations()
    };
    
    // Update self-model
    this.selfModel.patterns.push({
      timestamp: new Date(),
      critique,
      ors: this.currentORS
    });
    
    return critique;
  }

  /**
   * 📊 Critique performance
   */
  critiquePerformance() {
    const metrics = this.performanceMetrics;
    const successRate = metrics.totalTasks > 0 ? metrics.successfulTasks / metrics.totalTasks : 1;
    
    return {
      success_rate: successRate,
      avg_duration: metrics.avgTaskDuration,
      resource_efficiency: this.calculateResourceEfficiency(),
      overall_score: this.calculateOverallScore()
    };
  }

  /**
   * 🎯 Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.currentORS < 70) {
      recommendations.push({
        priority: 'high',
        type: 'improve_health',
        description: 'Focus on improving system health to increase ORS'
      });
    }
    
    if (this.performanceMetrics.failedTasks > this.performanceMetrics.successfulTasks * 0.1) {
      recommendations.push({
        priority: 'medium',
        type: 'reduce_failures',
        description: 'Investigate and reduce task failure rate'
      });
    }
    
    return recommendations;
  }

  /**
   * 🆔 Generate trace ID
   */
  generateTraceId() {
    return `hcfp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 😴 Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder methods for full implementation
  async checkPolicyViolations() { return false; }
  getBusiestHour(tasks) { return 14; }
  getCommonErrors(tasks) { return []; }
  calculateResourceEfficiency() { return 0.8; }
  calculateOverallScore() { return 0.85; }
  critiqueDecisions() { return {}; }
  critiqueAdaptations() { return {}; }
  async performAnalysis() { return { status: 'completed' }; }
  async performValidation() { return { status: 'completed' }; }
  async performMonitoring() { return { status: 'completed' }; }
}

module.exports = HCFPFullAutoEngine;

// Auto-run if called directly
if (require.main === module) {
  const engine = new HCFPFullAutoEngine();
  
  engine.start()
    .then(() => {
      console.log('\n🎉 HCFP Full Auto Engine is running!');
      console.log('Press Ctrl+C to stop');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await engine.stop('SIGINT received');
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await engine.stop('SIGTERM received');
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('\n💥 Failed to start engine:', error);
      process.exit(1);
    });
}
