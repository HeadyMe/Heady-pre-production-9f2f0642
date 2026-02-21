"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HCAiRouter = void 0;
/**
 * AI Router Implementation
 * Intelligent, self-aware resource allocation for Heady Systems
 */
const fs = __importStar(require("fs/promises"));
const types_1 = require("./types");
class HCAiRouter {
    config;
    metrics;
    routingHistory = new Map();
    determinismSeed = 42;
    configPath;
    telemetry;
    nodeCapabilities = new Map();
    providerClients = new Map();
    configVersion = '';
    orsHistory = [];
    performanceCache = new Map();
    constructor(configPath = '/home/headyme/CascadeProjects/Heady/configs/ai-routing.yaml') {
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
    async initialize() {
        await this.loadConfig();
        await this.loadNodeCapabilities();
        console.log('🧠 HCAiRouter: Initialized with intelligent routing capabilities');
    }
    async loadConfig() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf-8');
            // Parse YAML content - for now, use simplified JSON-like parsing
            // In production, use YAML parser library
            const yaml = require('yaml');
            this.config = yaml.parse(configContent);
            console.log('✅ AI Router configuration loaded');
        }
        catch (error) {
            console.error('❌ Failed to load AI Router config:', error);
            throw new types_1.RoutingError('Configuration load failed', 'CONFIG_LOAD_ERROR');
        }
    }
    async loadNodeCapabilities() {
        // Load node capabilities from registry
        const nodes = [
            { nodeId: 'promoter', capabilities: ['deep_reasoning'], maxConcurrentTasks: 4, priority: 'high' },
            { nodeId: 'brain', capabilities: ['deep_reasoning', 'error_analysis'], maxConcurrentTasks: 2, priority: 'critical' },
            { nodeId: 'jules', capabilities: ['code_generation'], maxConcurrentTasks: 6, priority: 'high' },
            { nodeId: 'pythia', capabilities: ['code_generation', 'embeddings'], maxConcurrentTasks: 4, priority: 'medium' },
            { nodeId: 'socrates', capabilities: ['deep_reasoning'], maxConcurrentTasks: 3, priority: 'high' },
            { nodeId: 'muse', capabilities: ['multimodal'], maxConcurrentTasks: 2, priority: 'medium' }
        ];
        nodes.forEach(node => {
            this.nodeCapabilities.set(node.nodeId, {
                nodeId: node.nodeId,
                capabilities: node.capabilities,
                maxConcurrentTasks: node.maxConcurrentTasks,
                priority: node.priority,
                resourceRequirements: { cpu: 20, memory: 30, network: 10 },
                costSensitivity: 'medium',
                qualityRequirements: 'high'
            });
        });
        console.log(`✅ Loaded ${nodes.length} node capabilities`);
    }
    async chooseProvider(ctx) {
        const startTime = Date.now();
        try {
            // Validate ORS constraints
            const orsMode = this.getOrsMode(ctx.ors);
            if (orsMode === 'recovery' && ctx.importance !== 'speculative') {
                throw new types_1.OrsTooLowError(ctx.ors, ctx);
            }
            // Get task configuration
            const taskConfig = this.config.tasks[ctx.kind];
            if (!taskConfig) {
                throw new types_1.RoutingError(`Unknown task kind: ${ctx.kind}`, 'UNKNOWN_TASK', ctx);
            }
            // Apply ORS-based routing rules
            const routingRules = this.config.orsRoutingRules[orsMode];
            // Select provider based on availability, cost, and quality
            const selectedProvider = await this.selectOptimalProvider(taskConfig, ctx, routingRules);
            const choice = {
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
        }
        catch (error) {
            this.metrics.errorRates[ctx.kind] = (this.metrics.errorRates[ctx.kind] || 0) + 1;
            throw error;
        }
    }
    getOrsMode(ors) {
        if (ors >= this.config.defaults.orsThresholds.aggressive)
            return 'aggressive';
        if (ors >= this.config.defaults.orsThresholds.normal)
            return 'normal';
        if (ors >= this.config.defaults.orsThresholds.maintenance)
            return 'maintenance';
        return 'recovery';
    }
    async selectOptimalProvider(taskConfig, ctx, routingRules) {
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
            throw new types_1.ProviderUnavailableError('No available providers', ctx);
        }
        // Select best candidate
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].provider;
    }
    async isProviderAvailable(provider, ctx) {
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
    calculateProviderScore(provider, ctx, baseScore) {
        let score = baseScore;
        // Quality alignment
        const taskConfig = this.config.tasks[ctx.kind];
        if (taskConfig.qualityThreshold === 0.9 && provider.quality === 'very_high') {
            score += 0.2;
        }
        else if (taskConfig.qualityThreshold === 0.8 && provider.quality === 'high') {
            score += 0.1;
        }
        // Cost consideration
        if (ctx.importance === 'background' && provider.costTier === 'low') {
            score += 0.15;
        }
        else if (ctx.importance === 'user_facing' && provider.costTier === 'high') {
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
    calculateTemperature(ctx, provider) {
        const [min, max] = provider.temperatureRange;
        // Adjust temperature based on task type and ORS
        if (ctx.kind === 'code_generation') {
            return Math.min(max, Math.max(min, 0.1)); // Lower temp for code
        }
        else if (ctx.kind === 'deep_reasoning') {
            return Math.min(max, Math.max(min, 0.7)); // Higher temp for reasoning
        }
        else {
            return (min + max) / 2; // Default middle
        }
    }
    generateRoutingReason(provider, ctx, orsMode) {
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
    calculateConfidence(provider, ctx) {
        let confidence = 0.8; // Base confidence
        // Adjust based on provider health
        const health = this.telemetry.providerStatus[provider.providerId];
        if (health) {
            confidence *= (1 - health.errorRate);
            if (health.latency < 1000)
                confidence *= 1.1;
        }
        // Adjust based on task alignment
        if (provider.specialties.includes(ctx.kind)) {
            confidence *= 1.2;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    estimateCost(provider, tokens) {
        const baseCost = provider.costTier === 'high' ? 0.01 :
            provider.costTier === 'medium' ? 0.005 : 0.001;
        return baseCost * (tokens / 1000);
    }
    getCloudUsagePercent() {
        // Simulate cloud usage calculation
        return 65; // Placeholder
    }
    getLocalCpuPercent() {
        // Simulate local CPU usage
        return this.telemetry.systemLoad.cpu;
    }
    async logRoutingDecision(ctx, choice, processingTime) {
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
        this.routingHistory.get(ctx.traceId).push(logEntry);
        // Update metrics
        this.metrics.totalRoutings++;
        this.metrics.providerUsage[choice.providerId] =
            (this.metrics.providerUsage[choice.providerId] || 0) + 1;
        this.metrics.orsDistribution[choice.orsMode]++;
    }
    async runTask(ctx, prompt) {
        const startTime = Date.now();
        try {
            // Choose provider
            const choice = await this.chooseProvider(ctx);
            // Execute task (simplified - in real implementation would call actual AI APIs)
            const output = await this.executeWithProvider(choice, prompt, ctx);
            const actualLatency = Date.now() - startTime;
            const result = {
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
        }
        catch (error) {
            const result = {
                choice: {},
                output: null,
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
    async executeWithProvider(choice, prompt, ctx) {
        // Simplified execution - in real implementation would call actual AI APIs
        console.log(`🤖 Executing ${ctx.kind} on ${choice.providerId} (${choice.model})`);
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
        // Mock response
        return {
            response: `Processed ${ctx.kind} task on ${choice.model}`,
            provider: choice.providerId,
            timestamp: new Date().toISOString()
        };
    }
    updateMetrics(result) {
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
    async getHealth() {
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
    generateAlerts(status, failedProviders) {
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
    getMetrics() {
        return { ...this.metrics };
    }
    async updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('🔄 AI Router configuration updated');
    }
    async reloadConfig() {
        await this.loadConfig();
        console.log('🔄 AI Router configuration reloaded');
    }
    async analyzePerformance() {
        const insights = [];
        const recommendations = [];
        const configUpdates = {};
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
    setDeterminismSeed(seed) {
        this.determinismSeed = seed;
        console.log(`🎲 Determinism seed set to ${seed}`);
    }
    async getRoutingHistory(traceId) {
        if (traceId) {
            return this.routingHistory.get(traceId) || [];
        }
        // Return all history flattened
        const allResults = [];
        for (const history of this.routingHistory.values()) {
            allResults.push(...history);
        }
        return allResults;
    }
}
exports.HCAiRouter = HCAiRouter;
//# sourceMappingURL=ai-router.js.map