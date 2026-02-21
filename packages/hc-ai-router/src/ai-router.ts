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
// ║  FILE: ai-router.ts                               ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * AI Router Implementation
 * Intelligent, self-aware resource allocation for Heady Systems
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  AiRouter,
  AiTaskContext,
  ProviderChoice,
  AiRoutingResult,
  RoutingMetrics,
  HealthStatus,
  RoutingConfig,
  NodeCapabilities,
  SystemTelemetry,
  TaskKind,
  OrsMode,
  ProviderType,
  ProviderConfig,
  RoutingError,
  ProviderUnavailableError,
  OrsTooLowError,
  ResourceExhaustedError
} from './types';

// Provider implementations
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class HCAiRouter implements AiRouter {
  private config!: RoutingConfig;
  private metrics: RoutingMetrics;
  private routingHistory: Map<string, AiRoutingResult[]> = new Map();
  private determinismSeed: number = 42;
  private configPath: string;
  private telemetry: SystemTelemetry;
  private nodeCapabilities: Map<string, NodeCapabilities> = new Map();
  private providerClients: Map<string, any> = new Map();
  private configVersion: string = '';
  private orsHistory: number[] = [];
  private performanceCache: Map<string, any> = new Map();

  constructor(configPath: string = '/home/headyme/CascadeProjects/Heady/configs/ai-routing.yaml') {
    this.configPath = configPath;
    this.metrics = {
      totalRoutings: 0,
      successRate: 0,
      avgLatency: 0,
      avgCost: 0,
      orsDistribution: { aggressive: 0, normal: 0, maintenance: 0, recovery: 0 },
      providerUsage: {},
      errorRates: {},
      lastUpdated: new Date().toISOString()
    };
    this.telemetry = {
      ors: 85,
      systemLoad: { cpu: 30, memory: 40, network: 20 },
      providerStatus: {},
      nodeStatus: {},
      timestamp: new Date().toISOString()
    };
  }

  async initialize(): Promise<void> {
    await this.loadConfig();
    await this.loadNodeCapabilities();
    console.log('🧠 HCAiRouter: Initialized with intelligent routing capabilities');
  }

  private async loadConfig(): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      // Parse YAML content - for now, use simplified JSON-like parsing
      // In production, use YAML parser library
      const yaml = require('yaml');
      this.config = yaml.parse(configContent) as RoutingConfig;
      console.log('✅ AI Router configuration loaded');
    } catch (error) {
      console.error('❌ Failed to load AI Router config:', error);
      throw new RoutingError('Configuration load failed', 'CONFIG_LOAD_ERROR');
    }
  }

  private async loadNodeCapabilities(): Promise<void> {
    // Load node capabilities from registry
    const nodes = [
      { nodeId: 'conductor', capabilities: ['deep_reasoning'], maxConcurrentTasks: 4, priority: 'high' },
      { nodeId: 'brain', capabilities: ['deep_reasoning', 'error_analysis'], maxConcurrentTasks: 2, priority: 'critical' },
      { nodeId: 'jules', capabilities: ['code_generation'], maxConcurrentTasks: 6, priority: 'high' },
      { nodeId: 'pythia', capabilities: ['code_generation', 'embeddings'], maxConcurrentTasks: 4, priority: 'medium' },
      { nodeId: 'socrates', capabilities: ['deep_reasoning'], maxConcurrentTasks: 3, priority: 'high' },
      { nodeId: 'muse', capabilities: ['multimodal'], maxConcurrentTasks: 2, priority: 'medium' }
    ];

    nodes.forEach(node => {
      this.nodeCapabilities.set(node.nodeId, {
        nodeId: node.nodeId,
        capabilities: node.capabilities as TaskKind[],
        maxConcurrentTasks: node.maxConcurrentTasks,
        priority: node.priority as any,
        resourceRequirements: { cpu: 20, memory: 30, network: 10 },
        costSensitivity: 'medium',
        qualityRequirements: 'high'
      });
    });

    console.log(`✅ Loaded ${nodes.length} node capabilities`);
  }

  async chooseProvider(ctx: AiTaskContext): Promise<ProviderChoice> {
    const startTime = Date.now();
    
    try {
      // Validate ORS constraints
      const orsMode = this.getOrsMode(ctx.ors);
      if (orsMode === 'recovery' && ctx.importance !== 'speculative') {
        throw new OrsTooLowError(ctx.ors, ctx);
      }

      // Get task configuration
      const taskConfig = this.config.tasks[ctx.kind];
      if (!taskConfig) {
        throw new RoutingError(`Unknown task kind: ${ctx.kind}`, 'UNKNOWN_TASK', ctx);
      }

      // Apply ORS-based routing rules
      const routingRules = this.config.orsRoutingRules[orsMode];
      
      // Select provider based on availability, cost, and quality
      const selectedProvider = await this.selectOptimalProvider(
        taskConfig,
        ctx,
        routingRules
      );

      const choice: ProviderChoice = {
        providerId: selectedProvider.providerId,
        model: selectedProvider.model,
        temperature: this.calculateTemperature(ctx, selectedProvider),
        maxTokens: Math.min(taskConfig.maxTokens, selectedProvider.maxTokens),
        routedTo: selectedProvider.type,
        reason: this.generateRoutingReason(selectedProvider, ctx, orsMode),
        confidence: this.calculateConfidence(selectedProvider, ctx),
        estimatedCost: this.estimateCost(selectedProvider, ctx.estTokens),
        estimatedLatency: selectedProvider.avgLatency || 1000,
        orsMode,
        traceId: ctx.traceId
      };

      // Log routing decision for determinism
      await this.logRoutingDecision(ctx, choice, Date.now() - startTime);
      
      return choice;

    } catch (error) {
      this.metrics.errorRates[ctx.kind] = (this.metrics.errorRates[ctx.kind] || 0) + 1;
      throw error;
    }
  }

  private getOrsMode(ors: number): OrsMode {
    if (ors >= this.config.defaults.orsThresholds.aggressive) return 'aggressive';
    if (ors >= this.config.defaults.orsThresholds.normal) return 'normal';
    if (ors >= this.config.defaults.orsThresholds.maintenance) return 'maintenance';
    return 'recovery';
  }

  private async selectOptimalProvider(
    taskConfig: any,
    ctx: AiTaskContext,
    routingRules: any
  ): Promise<ProviderConfig> {
    const candidates = [];

    // Check preferred providers first
    for (const providerId of taskConfig.preferredProviders) {
      const provider = this.config.providers[providerId];
      if (provider && await this.isProviderAvailable(provider, ctx)) {
        candidates.push({ provider, score: this.calculateProviderScore(provider, ctx, 1.0) });
      }
    }

    // If no preferred providers available, check fallbacks
    if (candidates.length === 0) {
      for (const providerId of taskConfig.fallbackProviders) {
        const provider = this.config.providers[providerId];
        if (provider && await this.isProviderAvailable(provider, ctx)) {
          candidates.push({ provider, score: this.calculateProviderScore(provider, ctx, 0.8) });
        }
      }
    }

    if (candidates.length === 0) {
      throw new ProviderUnavailableError('No available providers', ctx);
    }

    // Select best candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].provider;
  }

  private async isProviderAvailable(provider: ProviderConfig, ctx: AiTaskContext): Promise<boolean> {
    // Check ORS constraints
    const orsMode = this.getOrsMode(ctx.ors);
    const routingRules = this.config.orsRoutingRules[orsMode];

    if (routingRules.emergencyOnly && provider.type !== 'local') {
      return false;
    }

    if (routingRules.useLocalOnly && provider.type !== 'local') {
      return false;
    }

    // Check resource constraints
    if (provider.type === 'remote') {
      const cloudUsage = this.getCloudUsagePercent();
      if (cloudUsage > this.config.defaults.maxCloudUsagePercent) {
        return false;
      }
    }

    if (provider.type === 'local') {
      const localCpu = this.getLocalCpuPercent();
      if (localCpu > this.config.defaults.maxLocalCpuPercent) {
        return false;
      }
    }

    // Check provider-specific health
    const providerHealth = this.telemetry.providerStatus[provider.providerId];
    if (providerHealth && (!providerHealth.available || providerHealth.errorRate > 0.1)) {
      return false;
    }

    return true;
  }

  private calculateProviderScore(provider: ProviderConfig, ctx: AiTaskContext, baseScore: number): number {
    let score = baseScore;

    // Quality alignment
    const taskConfig = this.config.tasks[ctx.kind];
    if (taskConfig.qualityThreshold === 0.9 && provider.quality === 'very_high') {
      score += 0.2;
    } else if (taskConfig.qualityThreshold === 0.8 && provider.quality === 'high') {
      score += 0.1;
    }

    // Cost consideration
    if (ctx.importance === 'background' && provider.costTier === 'low') {
      score += 0.15;
    } else if (ctx.importance === 'user_facing' && provider.costTier === 'high') {
      score += 0.1;
    }

    // Latency sensitivity
    if (ctx.latencySensitivity === 'high' && provider.type === 'local') {
      score += 0.2;
    }

    // Current load
    if (provider.currentUsage && provider.currentUsage > provider.maxConcurrency * 0.8) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateTemperature(ctx: AiTaskContext, provider: ProviderConfig): number {
    const [min, max] = provider.temperatureRange;
    
    // Adjust temperature based on task type and ORS
    if (ctx.kind === 'code_generation') {
      return Math.min(max, Math.max(min, 0.1)); // Lower temp for code
    } else if (ctx.kind === 'deep_reasoning') {
      return Math.min(max, Math.max(min, 0.7)); // Higher temp for reasoning
    } else {
      return (min + max) / 2; // Default middle
    }
  }

  private generateRoutingReason(provider: ProviderConfig, ctx: AiTaskContext, orsMode: OrsMode): string {
    const reasons = [];
    
    if (provider.quality === 'very_high') {
      reasons.push('highest quality');
    }
    if (provider.type === 'local' && ctx.latencySensitivity === 'high') {
      reasons.push('low latency required');
    }
    if (orsMode === 'aggressive') {
      reasons.push('ORS allows premium resources');
    }
    if (provider.costTier === 'low' && ctx.importance === 'background') {
      reasons.push('cost-effective for background task');
    }

    return reasons.join(', ') || 'best available option';
  }

  private calculateConfidence(provider: ProviderConfig, ctx: AiTaskContext): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on provider health
    const health = this.telemetry.providerStatus[provider.providerId];
    if (health) {
      confidence *= (1 - health.errorRate);
      if (health.latency < 1000) confidence *= 1.1;
    }

    // Adjust based on task alignment
    if (provider.specialties.includes(ctx.kind)) {
      confidence *= 1.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private estimateCost(provider: ProviderConfig, tokens: number): number {
    const baseCost = provider.costTier === 'high' ? 0.01 : 
                    provider.costTier === 'medium' ? 0.005 : 0.001;
    return baseCost * (tokens / 1000);
  }

  private getCloudUsagePercent(): number {
    // Simulate cloud usage calculation
    return 65; // Placeholder
  }

  private getLocalCpuPercent(): number {
    // Simulate local CPU usage
    return this.telemetry.systemLoad.cpu;
  }

  private async logRoutingDecision(ctx: AiTaskContext, choice: ProviderChoice, processingTime: number): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context: ctx,
      choice,
      processingTime,
      determinismSeed: this.determinismSeed
    };

    // Store in history
    if (!this.routingHistory.has(ctx.traceId)) {
      this.routingHistory.set(ctx.traceId, []);
    }
    this.routingHistory.get(ctx.traceId)!.push(logEntry as any);

    // Update metrics
    this.metrics.totalRoutings++;
    this.metrics.providerUsage[choice.providerId] = 
      (this.metrics.providerUsage[choice.providerId] || 0) + 1;
    this.metrics.orsDistribution[choice.orsMode]++;
  }

  async runTask<TOutput = any>(
    ctx: AiTaskContext,
    prompt: string | object
  ): Promise<AiRoutingResult<TOutput>> {
    const startTime = Date.now();
    
    try {
      // Choose provider
      const choice = await this.chooseProvider(ctx);
      
      // Execute task (simplified - in real implementation would call actual AI APIs)
      const output = await this.executeWithProvider(choice, prompt, ctx) as TOutput;
      
      const actualLatency = Date.now() - startTime;
      
      const result: AiRoutingResult<TOutput> = {
        choice,
        output,
        actualLatency,
        actualCost: choice.estimatedCost,
        success: true,
        metrics: {
          tokensUsed: ctx.estTokens,
          processingTime: actualLatency,
          qualityScore: choice.confidence
        }
      };

      // Update metrics
      this.updateMetrics(result);
      
      return result;

    } catch (error) {
      const result: AiRoutingResult<TOutput> = {
        choice: {} as ProviderChoice,
        output: null as any,
        actualLatency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          tokensUsed: 0,
          processingTime: Date.now() - startTime
        }
      };

      this.updateMetrics(result);
      return result;
    }
  }

  private async executeWithProvider<TOutput>(
    choice: ProviderChoice,
    prompt: string | object,
    ctx: AiTaskContext
  ): Promise<TOutput> {
    // Simplified execution - in real implementation would call actual AI APIs
    console.log(`🤖 Executing ${ctx.kind} on ${choice.providerId} (${choice.model})`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
    
    // Mock response
    return {
      response: `Processed ${ctx.kind} task on ${choice.model}`,
      provider: choice.providerId,
      timestamp: new Date().toISOString()
    } as TOutput;
  }

  private updateMetrics(result: AiRoutingResult): void {
    if (result.success) {
      // Update success rate
      this.metrics.successRate = 
        (this.metrics.successRate * (this.metrics.totalRoutings - 1) + 1) / this.metrics.totalRoutings;
      
      // Update averages
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (this.metrics.totalRoutings - 1) + result.actualLatency) / this.metrics.totalRoutings;
      
      if (result.actualCost) {
        this.metrics.avgCost = 
          (this.metrics.avgCost * (this.metrics.totalRoutings - 1) + result.actualCost) / this.metrics.totalRoutings;
      }
    }
    
    this.metrics.lastUpdated = new Date().toISOString();
  }

  async getHealth(): Promise<HealthStatus> {
    const failedProviders = Object.entries(this.telemetry.providerStatus)
      .filter(([_, status]) => !status.available || status.errorRate > 0.1)
      .map(([id]) => id);

    const status = failedProviders.length === 0 ? 'healthy' :
                  failedProviders.length <= 2 ? 'degraded' : 'critical';

    return {
      status,
      ors: this.telemetry.ors,
      activeProviders: Object.keys(this.config.providers).length - failedProviders.length,
      failedProviders,
      systemLoad: this.telemetry.systemLoad,
      alerts: this.generateAlerts(status, failedProviders)
    };
  }

  private generateAlerts(status: string, failedProviders: string[]): string[] {
    const alerts = [];
    
    if (status === 'critical') {
      alerts.push('Critical: Multiple providers unavailable');
    }
    
    if (this.telemetry.ors < 50) {
      alerts.push('ORS below recovery threshold');
    }
    
    if (this.telemetry.systemLoad.cpu > 85) {
      alerts.push('High CPU usage detected');
    }
    
    return alerts;
  }

  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  async updateConfig(config: Partial<RoutingConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    console.log('🔄 AI Router configuration updated');
  }

  async reloadConfig(): Promise<void> {
    await this.loadConfig();
    console.log('🔄 AI Router configuration reloaded');
  }

  async analyzePerformance(): Promise<{
    insights: string[];
    recommendations: string[];
    configUpdates: Partial<RoutingConfig>;
  }> {
    const insights = [];
    const recommendations = [];
    const configUpdates: Partial<RoutingConfig> = {};

    // Analyze provider performance
    for (const [providerId, usage] of Object.entries(this.metrics.providerUsage)) {
      const errorRate = this.metrics.errorRates[providerId] || 0;
      if (errorRate > 0.1) {
        insights.push(`Provider ${providerId} has high error rate: ${(errorRate * 100).toFixed(1)}%`);
        recommendations.push(`Consider reducing ${providerId} priority or increasing failover tolerance`);
      }
    }

    // Analyze ORS distribution
    const totalOrs = Object.values(this.metrics.orsDistribution).reduce((a, b) => a + b, 0);
    if (totalOrs > 0) {
      const recoveryRatio = this.metrics.orsDistribution.recovery / totalOrs;
      if (recoveryRatio > 0.2) {
        insights.push('High recovery mode frequency indicates system stress');
        recommendations.push('Investigate root causes of low ORS');
      }
    }

    return { insights, recommendations, configUpdates };
  }

  setDeterminismSeed(seed: number): void {
    this.determinismSeed = seed;
    console.log(`🎲 Determinism seed set to ${seed}`);
  }

  async getRoutingHistory(traceId?: string): Promise<AiRoutingResult[]> {
    if (traceId) {
      return this.routingHistory.get(traceId) || [];
    }
    
    // Return all history flattened
    const allResults: AiRoutingResult[] = [];
    for (const history of this.routingHistory.values()) {
      allResults.push(...history);
    }
    return allResults;
  }
}
