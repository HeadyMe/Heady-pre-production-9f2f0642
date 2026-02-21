# 🧠 HC-AI-Router System

**Advanced AI Routing with HCFP Integration & Continuous Optimization**

## 📋 Overview

The HC-AI-Router is a sophisticated AI routing system that intelligently distributes AI requests across multiple providers while integrating seamlessly with Heady Continuous Full Pipeline (HCFP) and ORS (Optimized Routing System). It provides intelligent provider selection, load balancing, failover, caching, and continuous self-optimization.

## 🚀 Key Features

### 🎯 Intelligent Routing
- **Multiple Strategies**: Quality-first, speed-first, cost-first, balanced, and adaptive ML-based routing
- **Dynamic Provider Selection**: Real-time provider health monitoring and performance-based selection
- **Smart Failover**: Graceful degradation with automatic fallback to alternative providers
- **Load Balancing**: Weighted, round-robin, least-connections, and response-time based balancing

### 🔄 HCFP Integration
- **Workflow Orchestration**: Integration with Heady promoter for complex AI workflows
- **Auto-Scaling**: Dynamic provider scaling based on load and performance metrics
- **Real-time Monitoring**: Dashboard integration with live metrics and alerts
- **Continuous Optimization**: ML-driven routing improvements and feedback loops

### 📊 Performance & Optimization
- **Caching**: Intelligent response caching with TTL and LRU/LFU strategies
- **Profiling**: Detailed performance metrics and provider analytics
- **Self-Critique**: Automated system analysis with improvement recommendations
- **Rate Limiting**: Intelligent rate limiting across all providers

### 🌐 ORS Integration
- **Hybrid Routing**: Combines HC routing with ORS for optimal performance
- **Metrics Sync**: Bidirectional metrics sharing between systems
- **Fallback Support**: Graceful fallback between HC and ORS systems

## 📁 Architecture

```
src/ai-router/
├── types/
│   └── hc-ai-router.types.ts     # TypeScript interfaces and types
├── hc-ai-router-simple.ts        # Core router implementation
├── hcfp-integration.ts           # HCFP integration layer
├── ai-node-updater.ts            # AI node migration system
├── example-usage.ts              # Usage examples and benchmarks
└── README.md                     # This documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js >= 20.0.0
- TypeScript >= 5.0.0
- Heady Systems environment

### Installation
```bash
# Navigate to the AI router directory
cd src/ai-router

# Install dependencies (if needed)
npm install

# Compile TypeScript
npm run build
```

## 🔧 Configuration

### Basic Configuration
```typescript
import { HCAIRouterConfig } from './types/hc-ai-router.types';

const config: HCAIRouterConfig = {
  providers: [
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      type: 'claude',
      capabilities: [
        {
          type: 'code-generation',
          supported: true,
          quality: 0.95,
          speed: 0.8,
          cost: 0.7
        }
      ],
      health: {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 1200,
        errorRate: 0.02,
        uptime: 0.98,
        consecutiveFailures: 0
      },
      performance: {
        avgResponseTime: 1200,
        successRate: 0.98,
        qualityScore: 0.92,
        costEfficiency: 0.7,
        throughput: 45,
        lastUpdated: new Date()
      },
      config: {
        endpoint: 'https://api.anthropic.com',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 30000
      },
      priority: 1,
      enabled: true
    }
  ],
  routing: {
    defaultStrategy: 'balanced',
    loadBalancing: 'weighted',
    failover: 'graceful',
    optimization: 'continuous'
  },
  caching: {
    enabled: true,
    ttl: 300,
    maxSize: 100,
    strategy: 'lru'
  },
  monitoring: {
    enabled: true,
    metricsRetention: 7,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.1,
      costPerRequest: 0.1,
      qualityScore: 0.7,
      throughput: 10
    }
  },
  optimization: {
    enabled: true,
    frequency: 5,
    learningRate: 0.1,
    explorationRate: 0.2
  }
};
```

### HCFP Integration Configuration
```typescript
const hcfpConfig = {
  hcfp: {
    enabled: true,
    autoMode: true,
    workflowId: 'ai-routing-workflow',
    pipelineId: 'ai-processing-pipeline',
    orchestration: {
      workflowEngine: 'heady-promoter',
      taskQueue: 'internal',
      priorityQueue: true
    },
    monitoring: {
      realTime: true,
      alerts: true,
      dashboard: true,
      metricsRetention: 7
    },
    optimization: {
      continuous: true,
      mlEnabled: true,
      feedbackLoop: true,
      learningRate: 0.1,
      explorationRate: 0.2
    },
    scaling: {
      autoScaling: true,
      minProviders: 2,
      maxProviders: 10,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    }
  },
  ors: {
    enabled: true,
    endpoint: 'https://api.ors.heady.systems',
    routing: {
      preferORS: false,
      fallbackToHC: true,
      weightORS: 0.3,
      hybridMode: true
    },
    monitoring: {
      shareMetrics: true,
      receiveFeedback: true,
      syncInterval: 5
    }
  }
};
```

## 📖 Usage Examples

### Basic Usage
```typescript
import HCFPAIRouter from './hcfp-integration';

// Initialize router
const router = new HCFPAIRouter(config);

// Add event listener
router.addEventListener((event) => {
  console.log(`Event: ${event.type} - ${event.severity}`);
});

// Create AI request
const request: AIRequest = {
  id: 'req-001',
  type: {
    category: 'generation',
    subcategory: 'code-generation',
    complexity: 'moderate',
    expectedOutput: 'code'
  },
  priority: 'normal',
  content: 'Create a TypeScript function for email validation',
  context: {
    language: 'typescript',
    requirements: ['regex', 'type-safety']
  },
  metadata: {
    source: 'user-request',
    tags: ['typescript', 'validation']
  },
  requirements: {
    capabilities: ['code-generation'],
    minQuality: 0.8,
    maxLatency: 5000,
    allowFailover: true,
    cacheable: true
  },
  timestamp: new Date()
};

// Route request
const response = await router.routeWithHCFP(request);
console.log('Response:', response.content);
```

### Updating Existing AI Nodes
```typescript
import AINodeUpdater from './ai-node-updater';

// Initialize updater
const updater = new AINodeUpdater(config);

// Update all AI nodes to use HC-AI-Router
await updater.updateAllNodes();

// Get migration status
const status = updater.getMigrationStatus();
console.log('Migration Status:', status);
```

## 🎯 Routing Strategies

### Quality-First
Prioritizes the highest quality responses, ideal for critical tasks where accuracy is paramount.

### Speed-First
Optimizes for fastest response times, perfect for real-time applications.

### Cost-First
Minimizes costs by selecting the most economical providers, suitable for bulk operations.

### Balanced
Provides a balanced approach considering quality, speed, and cost equally.

### Adaptive (ML-Based)
Uses machine learning to select the optimal provider based on historical performance and context.

## 📊 Monitoring & Analytics

### Router Statistics
```typescript
const stats = router.getStats();
console.log('Total Requests:', stats.totalRequests);
console.log('Success Rate:', (stats.successfulRequests / stats.totalRequests) * 100);
console.log('Average Response Time:', stats.avgResponseTime);
console.log('Total Cost:', stats.totalCost);
```

### Provider Health
```typescript
const health = router.getProviderHealth();
for (const [providerId, health] of Object.entries(health)) {
  console.log(`${providerId}: ${health.status} (${health.responseTime}ms)`);
}
```

### Profiling Metrics
```typescript
const metrics = router.getProfilingMetrics();
console.log('Performance Metrics:', metrics);
```

### HCFP Status
```typescript
const hcfpStatus = router.getHCFPStatus();
console.log('HCFP Status:', hcfpStatus);
```

## 🔧 Advanced Features

### Continuous Optimization
The router continuously learns from request patterns and optimizes routing decisions:

- **Performance Tracking**: Monitors provider performance over time
- **Pattern Recognition**: Identifies optimal providers for specific request types
- **Dynamic Adjustment**: Automatically adjusts routing weights based on performance
- **Feedback Loop**: Incorporates user feedback and satisfaction metrics

### Self-Critique System
Automated analysis and improvement recommendations:

```typescript
// Generate self-critique report
const report = await router.generateSelfCritiqueReport();
console.log('Findings:', report.findings);
console.log('Recommendations:', report.recommendations);
```

### Auto-Scaling
Dynamic provider scaling based on load:

```typescript
// Scaling is automatic when enabled
const scalingConfig = {
  autoScaling: true,
  minProviders: 2,
  maxProviders: 10,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.3
};
```

## 🚨 Error Handling & Failover

### Graceful Degradation
- Automatic failover to alternative providers
- Circuit breaker pattern for failing providers
- Exponential backoff for retry logic
- Health monitoring with automatic recovery

### Error Classification
- **Transient**: Temporary failures that can be retried
- **Non-Recoverable**: Permanent failures requiring intervention
- **Infrastructure**: System-level issues affecting multiple providers

## 📈 Performance Optimization

### Caching Strategies
- **LRU**: Least Recently Used
- **LFU**: Least Frequently Used  
- **TTL**: Time To Live based eviction
- **Size-based**: Maximum cache size limits

### Rate Limiting
- Per-provider rate limiting
- Token bucket algorithm
- Automatic quota management
- Graceful handling of limits

### Load Balancing
- Weighted distribution based on performance
- Response time aware routing
- Connection-based balancing
- Adaptive weight adjustment

## 🔍 Troubleshooting

### Common Issues

#### Provider Not Responding
```typescript
// Check provider health
const health = router.getProviderHealth();
console.log('Provider Health:', health);

// Verify provider configuration
const providers = router.getProviders();
console.log('Providers:', providers);
```

#### High Latency
```typescript
// Check routing strategy
const config = router.getConfig();
console.log('Current Strategy:', config.routing.defaultStrategy);

// Analyze performance metrics
const metrics = router.getProfilingMetrics();
const avgLatency = metrics.reduce((sum, m) => sum + m.metrics.responseTime, 0) / metrics.length;
console.log('Average Latency:', avgLatency);
```

#### Poor Quality Responses
```typescript
// Check quality scores
const stats = router.getStats();
console.log('Quality Metrics:', stats.qualityScores);

// Review self-critique findings
const report = await router.generateSelfCritiqueReport();
console.log('Quality Issues:', report.findings.filter(f => f.type === 'quality'));
```

## 🧪 Testing & Benchmarks

### Performance Benchmark
```typescript
import { runPerformanceBenchmark } from './example-usage';

// Run comprehensive benchmark
await runPerformanceBenchmark();
```

### Unit Testing
```typescript
// Test routing decisions
const decision = await router.makeRoutingDecision(testRequest);
console.log('Selected Provider:', decision.selectedProvider);
console.log('Confidence:', decision.confidence);
```

## 📚 API Reference

### Core Classes

#### HCFPAIRouter
Main router class with HCFP integration

**Methods:**
- `routeWithHCFP(request: AIRequest): Promise<AIResponse>`
- `getStats(): RouterStats`
- `getProviderHealth(): Record<string, ProviderHealth>`
- `getProfilingMetrics(): HCProfileMetrics[]`
- `getHCFPStatus(): any`
- `updateConfig(config: Partial<HCAIRouterConfig>): void`
- `shutdown(): void`

#### AINodeUpdater
Updates existing AI nodes to use HC-AI-Router

**Methods:**
- `updateAllNodes(): Promise<void>`
- `getMigrationStatus(): any`
- `getUpdatedNode(nodeId: string): any`
- `getAllUpdatedNodes(): Map<string, any>`

### Key Interfaces

#### AIRequest
```typescript
interface AIRequest {
  id: string;
  type: AIRequestType;
  priority: 'low' | 'normal' | 'high' | 'critical';
  content: string;
  context?: Record<string, any>;
  metadata: RequestMetadata;
  requirements: RequestRequirements;
  timestamp: Date;
  routing?: RoutingPreferences;
}
```

#### AIResponse
```typescript
interface AIResponse {
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
```

## 🚀 Deployment

### Production Deployment
1. Configure providers with production endpoints
2. Enable monitoring and alerting
3. Set up auto-scaling parameters
4. Configure caching for optimal performance
5. Enable continuous optimization

### Environment Variables
```bash
# Router Configuration
HC_AI_ROUTER_CACHE_ENABLED=true
HC_AI_ROUTER_CACHE_TTL=300
HC_AI_ROUTER_OPTIMIZATION_ENABLED=true

# HCFP Integration
HCFP_ENABLED=true
HCFP_AUTO_MODE=true
HCFP_WORKFLOW_ID=ai-routing-workflow

# ORS Integration
ORS_ENABLED=true
ORS_ENDPOINT=https://api.ors.heady.systems
ORS_API_KEY=your-api-key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## 📄 License

This project is part of Heady Systems and follows the MIT License.

## 🔗 Related Systems

- **Heady promoter**: Workflow orchestration
- **ORS**: Optimized Routing System
- **HCFP**: Heady Continuous Full Pipeline
- **HeadySoul**: AI decision engine
- **HCBrain**: Neural processing system

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Contact the Heady Systems team

---

**Built with 🧠 by Heady Systems - Sacred Geometry AI Platform**
