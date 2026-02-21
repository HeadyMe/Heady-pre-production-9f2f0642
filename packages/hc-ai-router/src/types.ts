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
// ║  FILE: types.ts                                    ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * AI Router Types for Heady Systems
 * Central interface for intelligent, self-aware resource allocation
 */

export type TaskKind =
  | 'general_chat'
  | 'deep_reasoning'
  | 'code_generation'
  | 'long_context_analysis'
  | 'embeddings'
  | 'multimodal'
  | 'system_optimization'
  | 'error_analysis';

export type ProviderType = 'remote' | 'local';
export type QualityTier = 'medium' | 'high' | 'very_high';
export type CostTier = 'low' | 'medium' | 'high';
export type LatencySensitivity = 'low' | 'medium' | 'high';
export type TaskImportance = 'user_facing' | 'background' | 'speculative';
export type OrsMode = 'aggressive' | 'normal' | 'maintenance' | 'recovery';

export interface AiTaskContext {
  kind: TaskKind;
  nodeId: string;                  // e.g. "JULES", "PYTHIA", "BRAIN"
  ors: number;                     // Operational Readiness Score (0–100)
  estTokens: number;               // estimated token usage
  latencySensitivity: LatencySensitivity;
  importance: TaskImportance;
  traceId: string;                 // for end-to-end tracing
  timestamp: string;               // ISO timestamp
  determinismSeed?: number;        // for reproducible routing
}

export interface ProviderConfig {
  providerId: string;              // e.g. "claude_code_enterprise"
  type: ProviderType;
  quality: QualityTier;
  costTier: CostTier;
  maxConcurrency: number;
  maxTokens: number;
  endpoint: string;
  model: string;
  temperatureRange: [number, number];
  specialties: TaskKind[];
  currentUsage?: number;
  errorRate?: number;
  avgLatency?: number;
}

export interface ProviderChoice {
  providerId: string;              // e.g. "claude_code_enterprise"
  model: string;                   // specific model name
  temperature: number;
  maxTokens: number;
  routedTo: ProviderType;
  reason: string;                  // explanation for logs/self-awareness
  confidence: number;              // 0-1 confidence in this choice
  estimatedCost?: number;          // estimated cost in credits/tokens
  estimatedLatency?: number;       // estimated latency in ms
  orsMode: OrsMode;                // ORS mode at time of routing
  traceId: string;
}

export interface AiRoutingResult<TOutput = any> {
  choice: ProviderChoice;
  output: TOutput;
  actualLatency: number;
  actualCost?: number;
  success: boolean;
  error?: string;
  metrics: {
    tokensUsed: number;
    processingTime: number;
    qualityScore?: number;
  };
}

export interface RoutingMetrics {
  totalRoutings: number;
  successRate: number;
  avgLatency: number;
  avgCost: number;
  orsDistribution: Record<OrsMode, number>;
  providerUsage: Record<string, number>;
  errorRates: Record<string, number>;
  lastUpdated: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  ors: number;
  activeProviders: number;
  failedProviders: string[];
  systemLoad: {
    cpu: number;
    memory: number;
    network: number;
  };
  alerts: string[];
}

export interface RoutingConfig {
  defaults: {
    maxCloudUsagePercent: number;
    maxLocalCpuPercent: number;
    maxLatencyMsSoft: number;
    maxLatencyMsHard: number;
    orsThresholds: {
      aggressive: number;
      normal: number;
      maintenance: number;
      recovery: number;
    };
    determinismSeed: number;
    configHashRequired: boolean;
    traceAllDecisions: boolean;
  };
  providers: Record<string, ProviderConfig>;
  tasks: Record<TaskKind, {
    description: string;
    preferredProviders: string[];
    fallbackProviders: string[];
    maxTokens: number;
    latencySensitivity: LatencySensitivity;
    importance: TaskImportance;
    qualityThreshold: number;
  }>;
  orsRoutingRules: Record<OrsMode, {
    allowExperimentalModels: boolean;
    increaseConcurrencyLimits: number;
    preferHighQualityOverCost: boolean;
    enableMonteCarloOptimization: boolean;
    optimizationDisabled?: boolean;
    emergencyOnly?: boolean;
    useLocalOnly?: boolean;
    allNonCriticalTasksBlocked?: boolean;
  }>;
  nodeRouting: Record<string, {
    primaryTask: TaskKind;
    fallbackTask: TaskKind;
    maxConcurrentTasks: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface AiRouter {
  // Core routing method
  chooseProvider(ctx: AiTaskContext): Promise<ProviderChoice>;
  
  // Execute task with routing
  runTask<TOutput = any>(
    ctx: AiTaskContext,
    prompt: string | object
  ): Promise<AiRoutingResult<TOutput>>;
  
  // Health and monitoring
  getHealth(): Promise<HealthStatus>;
  getMetrics(): RoutingMetrics;
  
  // Configuration management
  updateConfig(config: Partial<RoutingConfig>): Promise<void>;
  reloadConfig(): Promise<void>;
  
  // Self-awareness and learning
  analyzePerformance(): Promise<{
    insights: string[];
    recommendations: string[];
    configUpdates: Partial<RoutingConfig>;
  }>;
  
  // Determinism and reproducibility
  setDeterminismSeed(seed: number): void;
  getRoutingHistory(traceId?: string): Promise<AiRoutingResult[]>;
}

export interface NodeCapabilities {
  nodeId: string;
  capabilities: TaskKind[];
  maxConcurrentTasks: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resourceRequirements: {
    cpu: number;
    memory: number;
    network: number;
  };
  costSensitivity: 'low' | 'medium' | 'high';
  qualityRequirements: QualityTier;
}

export interface SystemTelemetry {
  ors: number;
  systemLoad: {
    cpu: number;
    memory: number;
    network: number;
  };
  providerStatus: Record<string, {
    available: boolean;
    latency: number;
    errorRate: number;
    usageQuota: number;
  }>;
  nodeStatus: Record<string, {
    active: boolean;
    currentTasks: number;
    avgResponseTime: number;
  }>;
  timestamp: string;
}

// Error types
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: AiTaskContext
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

export class ProviderUnavailableError extends RoutingError {
  constructor(providerId: string, context?: AiTaskContext) {
    super(`Provider ${providerId} is unavailable`, 'PROVIDER_UNAVAILABLE', context);
    this.name = 'ProviderUnavailableError';
  }
}

export class OrsTooLowError extends RoutingError {
  constructor(ors: number, context?: AiTaskContext) {
    super(`ORS too low for task: ${ors}`, 'ORS_TOO_LOW', context);
    this.name = 'OrsTooLowError';
  }
}

export class ResourceExhaustedError extends RoutingError {
  constructor(resource: string, context?: AiTaskContext) {
    super(`Resource exhausted: ${resource}`, 'RESOURCE_EXHAUSTED', context);
    this.name = 'ResourceExhaustedError';
  }
}
