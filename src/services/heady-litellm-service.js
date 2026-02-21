// ============================================================
// HEADY LITELLM INTEGRATION SERVICE
// ============================================================
// Unified routing to all AI models (paid + open-source)
// Handles Arena Mode parallel execution, fallbacks, cost tracking
// ============================================================

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class HeadyLiteLLMService extends EventEmitter {
  constructor(configPath = './configs/litellm-config.yaml') {
    super();
    this.configPath = configPath;
    this.config = null;
    this.baseUrl = process.env.LITELLM_URL || 'https://api.headysystems.com';
    this.healthStatus = 'unknown';
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0.0,
      modelUsage: {},
      arenaUsage: {}
    };
    
    this.loadConfig();
    this.startHealthCheck();
  }

  async loadConfig() {
    try {
      const yamlContent = await fs.readFile(this.configPath, 'utf8');
      // Simple YAML parsing (in production, use js-yaml)
      this.config = this.parseYaml(yamlContent);
      console.log('✅ LiteLLM config loaded');
    } catch (error) {
      console.error('❌ Failed to load LiteLLM config:', error.message);
      this.config = this.getDefaultConfig();
    }
  }

  parseYaml(yamlContent) {
    // Basic YAML parser - replace with js-yaml in production
    const config = {
      model_list: [],
      general_settings: { set_verbose: true, cache: true },
      router_settings: { model_group_alias: {}, fallbacks: [] },
      arena_mode: { parallel_execution: true, branch_strategies: {} }
    };
    
    // Parse model definitions
    const modelMatches = yamlContent.match(/- model_name: (.+)/g);
    if (modelMatches) {
      modelMatches.forEach(match => {
        const modelName = match.split(':')[1].trim();
        config.model_list.push({
          model_name: modelName,
          litellm_params: { model: modelName },
          model_info: { type: 'unknown', provider: 'unknown' }
        });
      });
    }
    
    return config;
  }

  getDefaultConfig() {
    return {
      model_list: [
        { model_name: 'heady-gpt4o', litellm_params: { model: 'openai/gpt-4o' } },
        { model_name: 'heady-claude-sonnet', litellm_params: { model: 'anthropic/claude-sonnet-4' } }
      ],
      general_settings: { set_verbose: true },
      arena_mode: { parallel_execution: true }
    };
  }

  async startHealthCheck() {
    setInterval(async () => {
      try {
        const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
        this.healthStatus = response.data.status === 'healthy' ? 'healthy' : 'unhealthy';
      } catch (error) {
        this.healthStatus = 'down';
      }
      
      this.emit('health-check', { status: this.healthStatus, metrics: this.metrics });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Unified chat completion request
   */
  async chatCompletion(params, options = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      // Determine model routing
      const model = this.selectModel(params.model, options);
      
      // Prepare request
      const request = {
        model: model,
        messages: params.messages,
        max_tokens: params.max_tokens || 2048,
        temperature: params.temperature || 0.7,
        ...params
      };

      // Add Arena Mode metadata if applicable
      if (options.arenaMode) {
        request.metadata = {
          arena_id: options.arenaId,
          branch: options.branch,
          strategy: options.strategy
        };
      }

      console.log(`🤖 LiteLLM Request: ${model} (${options.arenaMode ? 'ARENA' : 'STANDARD'})`);
      
      // Make request to LiteLLM
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, request, {
        timeout: options.timeout || 60000,
        headers: {
          'Content-Type': 'application/json',
          'X-Heady-Priority': options.priority || 'normal'
        }
      });

      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      
      // Update usage metrics
      this.updateMetrics(model, response.data.usage, duration, options);
      
      console.log(`✅ LiteLLM Response: ${model} (${duration}ms)`);
      
      return {
        success: true,
        data: response.data,
        model: model,
        duration,
        cost: this.calculateCost(model, response.data.usage)
      };
      
    } catch (error) {
      this.metrics.failedRequests++;
      
      console.error(`❌ LiteLLM Error: ${error.message}`);
      
      // Try fallback if available
      if (options.enableFallback !== false) {
        const fallbackModel = this.getFallbackModel(params.model);
        if (fallbackModel) {
          console.log(`🔄 Trying fallback: ${fallbackModel}`);
          return this.chatCompletion({ ...params, model: fallbackModel }, { ...options, enableFallback: false });
        }
      }
      
      throw error;
    }
  }

  /**
   * Model selection logic
   */
  selectModel(requestedModel, options = {}) {
    // Arena Mode branch-specific routing
    if (options.arenaMode && options.branch && this.config.arena_mode.branch_strategies) {
      const branchStrategy = this.config.arena_mode.branch_strategies[options.branch];
      if (branchStrategy) {
        return branchStrategy.primary;
      }
    }
    
    // Model group routing
    if (this.config.router_settings.model_group_alias) {
      for (const [groupName, models] of Object.entries(this.config.router_settings.model_group_alias)) {
        if (models.includes(requestedModel)) {
          // Load balance within group
          return models[Math.floor(Math.random() * models.length)];
        }
      }
    }
    
    // Default to requested model
    return requestedModel || 'heady-gpt4o';
  }

  /**
   * Get fallback model for failed requests
   */
  getFallbackModel(failedModel) {
    const fallback = this.config.router_settings.fallbacks?.find(f => f.model === failedModel);
    return fallback?.fallbacks?.[0] || null;
  }

  /**
   * Update usage metrics
   */
  updateMetrics(model, usage, duration, options) {
    // Model usage
    if (!this.metrics.modelUsage[model]) {
      this.metrics.modelUsage[model] = { requests: 0, tokens: 0, cost: 0.0 };
    }
    
    this.metrics.modelUsage[model].requests++;
    this.metrics.modelUsage[model].tokens += usage?.total_tokens || 0;
    this.metrics.modelUsage[model].cost += this.calculateCost(model, usage);
    
    // Arena usage tracking
    if (options.arenaMode && options.arenaId) {
      const arenaKey = `${options.arenaId}-${options.branch}`;
      if (!this.metrics.arenaUsage[arenaKey]) {
        this.metrics.arenaUsage[arenaKey] = { requests: 0, cost: 0.0 };
      }
      this.metrics.arenaUsage[arenaKey].requests++;
      this.metrics.arenaUsage[arenaKey].cost += this.calculateCost(model, usage);
    }
    
    this.metrics.totalCost += this.calculateCost(model, usage);
  }

  /**
   * Calculate request cost
   */
  calculateCost(model, usage) {
    const costs = {
      'heady-claude-sonnet': 0.015,
      'heady-claude-opus': 0.075,
      'heady-gpt4o': 0.005,
      'heady-o3': 0.015,
      'heady-perplexity-sonar': 0.005,
      'heady-kimi-dev': 0.0003,
      'heady-deepseek-coder': 0.0002
    };
    
    const costPerToken = costs[model] || 0.001;
    return (usage?.total_tokens || 0) * costPerToken;
  }

  /**
   * Arena Mode parallel execution
   */
  async arenaParallelExecution(task, branches = ['headysystems', 'headyconnection', 'headyme']) {
    console.log(`⚔️ ARENA PARALLEL EXECUTION: ${branches.length} branches`);
    
    const promises = branches.map(async (branch) => {
      try {
        const result = await this.chatCompletion(task, {
          arenaMode: true,
          arenaId: task.arenaId,
          branch: branch,
          strategy: this.config.arena_mode.branch_strategies[branch]?.reasoning
        });
        
        return { branch, success: true, result };
      } catch (error) {
        console.error(`❌ Arena branch ${branch} failed:`, error.message);
        return { branch, success: false, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(promises);
    return results.map(r => r.value || r.reason);
  }

  /**
   * Get service health and metrics
   */
  getHealth() {
    return {
      status: this.healthStatus,
      baseUrl: this.baseUrl,
      uptime: process.uptime(),
      metrics: this.metrics,
      config: {
        totalModels: this.config.model_list.length,
        arenaModeEnabled: this.config.arena_mode.parallel_execution,
        fallbacksEnabled: this.config.router_settings.fallbacks.length > 0
      }
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0.0,
      modelUsage: {},
      arenaUsage: {}
    };
  }
}

module.exports = HeadyLiteLLMService;
