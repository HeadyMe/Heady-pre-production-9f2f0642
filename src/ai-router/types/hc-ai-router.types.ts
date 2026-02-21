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
// ║  FILE: hc-ai-router.types.ts                                ║
// ║  UPDATED: 20260219-215300                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260219-215300
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * 🧠 HC-AI-Router TypeScript Interfaces
 * Advanced AI routing system with intelligent provider selection,
 * load balancing, failover, and continuous optimization
 */

export interface AIProvider {
  id: string;
  name: string;
  type: 'claude' | 'openai' | 'perplexity' | 'jules' | 'huggingface' | 'goose' | 'yandex' | 'github-copilot' | 'colab';
  capabilities: AICapability[];
  health: ProviderHealth;
  performance: ProviderPerformance;
  config: ProviderConfig;
  rateLimit?: RateLimit;
  cost?: CostModel;
  priority: number;
  enabled: boolean;
}

export interface AICapability {
  type: 'text-generation' | 'code-generation' | 'code-review' | 'debugging' | 'research' | 'fact-check' | 'translation' | 'summarization';
  supported: boolean;
  quality: number; // 0-1 quality score
  speed: number; // 0-1 speed score
  cost: number; // 0-1 cost efficiency (1 = cheapest)
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance';
  lastCheck: Date;
  responseTime: number; // ms
  errorRate: number; // 0-1
  uptime: number; // 0-1
  consecutiveFailures: number;
}

export interface ProviderPerformance {
  avgResponseTime: number; // ms
  successRate: number; // 0-1
  qualityScore: number; // 0-1
  costEfficiency: number; // 0-1
  throughput: number; // requests/minute
  lastUpdated: Date;
}

export interface ProviderConfig {
  endpoint: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  currentUsage: {
    requests: number;
    tokens: number;
    resetTime: Date;
  };
}

export interface CostModel {
  inputTokenCost: number; // cost per 1K tokens
  outputTokenCost: number; // cost per 1K tokens
  requestCost?: number; // cost per request
  currency: string;
}

export interface AIRequest {
  id: string;
  type: AIRequestType;
  priority: 'low' | 'normal' | 'high' | 'critical';
  content: string;
  context?: Record<string, any>;
  metadata: RequestMetadata;
  requirements: RequestRequirements;
  timestamp: Date;
  timeout?: number;
  routing?: RoutingPreferences;
}

export interface AIRequestType {
  category: 'generation' | 'analysis' | 'review' | 'debug' | 'research' | 'translation';
  subcategory: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  expectedOutput: 'text' | 'code' | 'json' | 'structured' | 'binary';
}

export interface RequestMetadata {
  userId?: string;
  sessionId?: string;
  source: 'hcfp' | 'ors' | 'web-ui' | 'api' | 'automation';
  tags: string[];
  correlationId?: string;
  traceId?: string;
}

export interface RequestRequirements {
  capabilities: string[];
  minQuality: number; // 0-1
  maxLatency: number; // ms
  maxCost?: number; // maximum cost in currency
  preferredProviders?: string[];
  excludedProviders?: string[];
  allowFailover: boolean;
  cacheable: boolean;
}

export interface RoutingPreferences {
  strategy: RoutingStrategy;
  loadBalancing: LoadBalancingStrategy;
  failover: FailoverStrategy;
  optimization: OptimizationStrategy;
}

export type RoutingStrategy = 'quality-first' | 'speed-first' | 'cost-first' | 'balanced' | 'adaptive' | 'custom';

export type LoadBalancingStrategy = 'round-robin' | 'weighted' | 'least-connections' | 'response-time' | 'adaptive';

export type FailoverStrategy = 'immediate' | 'graceful' | 'circuit-breaker' | 'exponential-backoff' | 'smart-retry';

export type OptimizationStrategy = 'continuous' | 'periodic' | 'event-driven' | 'ml-based' | 'rule-based';

export interface AIResponse {
  id: string;
  requestId: string;
  provider: string;
  content: string;
  metadata: ResponseMetadata;
  performance: ResponsePerformance;
  quality: QualityMetrics;
  timestamp: Date;
  cached: boolean;
}

export interface ResponseMetadata {
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  processingTime: number; // ms
  cost: number;
  confidence?: number;
  reasoning?: string;
  sources?: string[];
}

export interface ResponsePerformance {
  totalTime: number; // ms
  networkTime: number; // ms
  processingTime: number; // ms
  queueTime: number; // ms
  retryCount: number;
}

export interface QualityMetrics {
  relevance: number; // 0-1
  accuracy: number; // 0-1
  completeness: number; // 0-1
  coherence: number; // 0-1
  userSatisfaction?: number; // 0-1
  automatedScore: number; // 0-1
}

export interface RoutingDecision {
  requestId: string;
  selectedProvider: string;
  reasoning: DecisionReasoning;
  alternatives: ProviderAlternative[];
  confidence: number; // 0-1
  timestamp: Date;
}

export interface DecisionReasoning {
  primary: string;
  factors: DecisionFactor[];
  weights: Record<string, number>;
  scores: Record<string, number>;
}

export interface DecisionFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ProviderAlternative {
  provider: string;
  score: number;
  reason: string;
  probability: number; // probability of success
}

export interface HCProfileMetrics {
  providerId: string;
  timestamp: Date;
  metrics: {
    responseTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
    costPerRequest: number;
    qualityScore: number;
    userSatisfaction: number;
  };
  context: {
    requestType: string;
    complexity: string;
    userSegment: string;
    timeOfDay: number;
    loadLevel: number;
  };
}

export interface SelfCritiqueReport {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  overall: {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    totalCost: number;
    userSatisfaction: number;
  };
  findings: CritiqueFinding[];
  recommendations: Recommendation[];
  actions: ActionItem[];
  nextReview: Date;
}

export interface CritiqueFinding {
  type: 'performance' | 'cost' | 'quality' | 'reliability' | 'user-experience';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  impact: string;
  metrics: Record<string, number>;
}

export interface Recommendation {
  id: string;
  category: 'routing' | 'configuration' | 'optimization' | 'infrastructure';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  rationale: string;
  expectedImpact: {
    performance?: number;
    cost?: number;
    quality?: number;
    reliability?: number;
  };
  implementation: {
    complexity: 'simple' | 'moderate' | 'complex';
    effort: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
    estimatedTime: string;
  };
}

export interface ActionItem {
  id: string;
  type: 'automatic' | 'manual' | 'scheduled';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  description: string;
  assignee?: string;
  dueDate?: Date;
  dependencies: string[];
}

export interface HCFPIntegration {
  enabled: boolean;
  autoMode: boolean;
  orchestration: {
    workflowId?: string;
    taskId?: string;
    pipelineId?: string;
  };
  monitoring: {
    realTime: boolean;
    alerts: boolean;
    dashboard: boolean;
  };
  optimization: {
    continuous: boolean;
    mlEnabled: boolean;
    feedbackLoop: boolean;
  };
}

export interface ORSIntegration {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  routing: {
    preferORS: boolean;
    fallbackToHC: boolean;
    weightORS: number; // 0-1
  };
  monitoring: {
    shareMetrics: boolean;
    receiveFeedback: boolean;
  };
}

export interface HCAIRouterConfig {
  providers: AIProvider[];
  routing: {
    defaultStrategy: RoutingStrategy;
    loadBalancing: LoadBalancingStrategy;
    failover: FailoverStrategy;
    optimization: OptimizationStrategy;
  };
  caching: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number; // MB
    strategy: 'lru' | 'lfu' | 'ttl';
  };
  monitoring: {
    enabled: boolean;
    metricsRetention: number; // days
    alertThresholds: AlertThresholds;
  };
  optimization: {
    enabled: boolean;
    frequency: number; // minutes
    learningRate: number; // 0-1
    explorationRate: number; // 0-1
  };
  hcfp: HCFPIntegration;
  ors: ORSIntegration;
}

export interface AlertThresholds {
  responseTime: number; // ms
  errorRate: number; // 0-1
  costPerRequest: number;
  qualityScore: number; // 0-1
  throughput: number; // requests/minute
}

export interface RouterEvent {
  id: string;
  type: RouterEventType;
  timestamp: Date;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
}

export type RouterEventType = 
  | 'request_received'
  | 'provider_selected'
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'provider_health_changed'
  | 'routing_optimized'
  | 'cache_hit'
  | 'cache_miss'
  | 'rate_limit_exceeded'
  | 'cost_threshold_exceeded'
  | 'quality_threshold_exceeded'
  | 'failover_triggered';

export interface RouterStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  totalCost: number;
  cacheHitRate: number;
  providerUsage: Record<string, number>;
  errorRate: number;
  uptime: number;
  lastReset: Date;
}

// Export all interfaces for easy importing
