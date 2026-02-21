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
// ║  FILE: example-usage.ts                                      ║
// ║  UPDATED: 20260219-215300                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260219-215300
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * 🚀 HC-AI-Router Example Usage
 * Demonstrates how to use the HC-AI-Router system with HCFP integration
 */

import HCFPAIRouter from './hcfp-integration';
import AINodeUpdater from './ai-node-updater';
import {
  AIProvider,
  AIRequest,
  HCAIRouterConfig,
  RoutingStrategy,
  AICapability
} from './types/hc-ai-router.types';

/**
 * 📊 Create example configuration
 */
function createExampleConfig(): any {
  const providers: AIProvider[] = [
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
        },
        {
          type: 'code-review',
          supported: true,
          quality: 0.92,
          speed: 0.85,
          cost: 0.7
        },
        {
          type: 'debugging',
          supported: true,
          quality: 0.90,
          speed: 0.75,
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
      rateLimit: {
        requestsPerMinute: 100,
        tokensPerMinute: 40000,
        currentUsage: {
          requests: 0,
          tokens: 0,
          resetTime: new Date(Date.now() + 60000)
        }
      },
      cost: {
        inputTokenCost: 0.003,
        outputTokenCost: 0.015,
        currency: 'USD'
      },
      priority: 1,
      enabled: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      type: 'openai',
      capabilities: [
        {
          type: 'text-generation',
          supported: true,
          quality: 0.93,
          speed: 0.9,
          cost: 0.8
        },
        {
          type: 'code-generation',
          supported: true,
          quality: 0.88,
          speed: 0.85,
          cost: 0.8
        },
        {
          type: 'analysis',
          supported: true,
          quality: 0.91,
          speed: 0.88,
          cost: 0.8
        }
      ],
      health: {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 800,
        errorRate: 0.01,
        uptime: 0.99,
        consecutiveFailures: 0
      },
      performance: {
        avgResponseTime: 800,
        successRate: 0.99,
        qualityScore: 0.90,
        costEfficiency: 0.8,
        throughput: 60,
        lastUpdated: new Date()
      },
      config: {
        endpoint: 'https://api.openai.com',
        model: 'gpt-4-turbo-preview',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 25000
      },
      rateLimit: {
        requestsPerMinute: 200,
        tokensPerMinute: 60000,
        currentUsage: {
          requests: 0,
          tokens: 0,
          resetTime: new Date(Date.now() + 60000)
        }
      },
      cost: {
        inputTokenCost: 0.01,
        outputTokenCost: 0.03,
        currency: 'USD'
      },
      priority: 2,
      enabled: true
    },
    {
      id: 'perplexity-sonar',
      name: 'Perplexity Sonar',
      type: 'perplexity',
      capabilities: [
        {
          type: 'research',
          supported: true,
          quality: 0.94,
          speed: 0.7,
          cost: 0.6
        },
        {
          type: 'fact-check',
          supported: true,
          quality: 0.96,
          speed: 0.65,
          cost: 0.6
        }
      ],
      health: {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 2000,
        errorRate: 0.03,
        uptime: 0.97,
        consecutiveFailures: 0
      },
      performance: {
        avgResponseTime: 2000,
        successRate: 0.97,
        qualityScore: 0.95,
        costEfficiency: 0.6,
        throughput: 30,
        lastUpdated: new Date()
      },
      config: {
        endpoint: 'https://api.perplexity.ai',
        model: 'sonar-medium-online',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 45000
      },
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 25000,
        currentUsage: {
          requests: 0,
          tokens: 0,
          resetTime: new Date(Date.now() + 60000)
        }
      },
      cost: {
        inputTokenCost: 0.001,
        outputTokenCost: 0.002,
        currency: 'USD'
      },
      priority: 3,
      enabled: true
    }
  ];

  return {
    providers,
    routing: {
      defaultStrategy: 'balanced' as RoutingStrategy,
      loadBalancing: 'weighted' as const,
      failover: 'graceful' as const,
      optimization: 'continuous' as const
    },
    caching: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxSize: 100, // 100MB
      strategy: 'lru' as const
    },
    monitoring: {
      enabled: true,
      metricsRetention: 7, // 7 days
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
      frequency: 5, // 5 minutes
      learningRate: 0.1,
      explorationRate: 0.2
    },
    hcfp: {
      enabled: true,
      autoMode: true,
      workflowId: 'ai-routing-workflow',
      pipelineId: 'ai-processing-pipeline',
      orchestration: {
        workflowEngine: 'heady-conductor' as const,
        taskQueue: 'internal' as const,
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
}

/**
 * 🚀 Example usage function
 */
async function demonstrateHC AIRouter(): Promise<void> {
  console.log('🚀 HC-AI-Router Example Usage');
  console.log('================================\n');

  // Create configuration
  const config = createExampleConfig();

  // Initialize router
  console.log('🔧 Initializing HC-AI-Router...');
  const router = new HCFPAIRouter(config);

  // Add event listener
  router.addEventListener((event) => {
    console.log(`📡 Event: ${event.type} - ${event.severity}`);
    if (event.type === 'provider_selected') {
      console.log(`   Selected: ${event.data.decision.selectedProvider}`);
      console.log(`   Confidence: ${event.data.decision.confidence.toFixed(3)}`);
    }
  });

  // Example 1: Code generation request
  console.log('\n📝 Example 1: Code Generation');
  console.log('--------------------------------');
  
  const codeRequest: AIRequest = {
    id: 'code-gen-001',
    type: {
      category: 'generation',
      subcategory: 'code-generation',
      complexity: 'moderate',
      expectedOutput: 'code'
    },
    priority: 'normal',
    content: 'Create a TypeScript function that validates email addresses using regex',
    context: {
      language: 'typescript',
      requirements: ['regex validation', 'type safety', 'error handling']
    },
    metadata: {
      source: 'example-usage',
      tags: ['typescript', 'validation', 'regex'],
      correlationId: 'demo-001'
    },
    requirements: {
      capabilities: ['code-generation'],
      minQuality: 0.8,
      maxLatency: 5000,
      preferredProviders: ['claude-3-sonnet'],
      allowFailover: true,
      cacheable: true
    },
    timestamp: new Date(),
    routing: {
      strategy: 'quality-first',
      loadBalancing: 'weighted',
      failover: 'graceful',
      optimization: 'continuous'
    }
  };

  try {
    const codeResponse = await router.routeWithHCFP(codeRequest);
    console.log('✅ Code Generation Success:');
    console.log(`   Provider: ${codeResponse.provider}`);
    console.log(`   Response Time: ${codeResponse.performance.totalTime}ms`);
    console.log(`   Quality Score: ${codeResponse.quality.automatedScore.toFixed(3)}`);
    console.log(`   Cost: $${codeResponse.metadata.cost.toFixed(4)}`);
    console.log(`   Content Preview: ${codeResponse.content.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Code Generation Failed:', error);
  }

  // Example 2: Research request
  console.log('\n🔍 Example 2: Research Query');
  console.log('-------------------------------');

  const researchRequest: AIRequest = {
    id: 'research-001',
    type: {
      category: 'research',
      subcategory: 'research',
      complexity: 'complex',
      expectedOutput: 'structured'
    },
    priority: 'high',
    content: 'What are the latest developments in quantum computing for AI applications?',
    context: {
      domain: 'quantum-computing',
      application: 'ai',
      timeframe: '2024'
    },
    metadata: {
      source: 'example-usage',
      tags: ['quantum', 'computing', 'ai', 'research'],
      correlationId: 'demo-002'
    },
    requirements: {
      capabilities: ['research'],
      minQuality: 0.9,
      maxLatency: 10000,
      preferredProviders: ['perplexity-sonar'],
      allowFailover: true,
      cacheable: true
    },
    timestamp: new Date(),
    routing: {
      strategy: 'quality-first',
      loadBalancing: 'weighted',
      failover: 'graceful',
      optimization: 'continuous'
    }
  };

  try {
    const researchResponse = await router.routeWithHCFP(researchRequest);
    console.log('✅ Research Success:');
    console.log(`   Provider: ${researchResponse.provider}`);
    console.log(`   Response Time: ${researchResponse.performance.totalTime}ms`);
    console.log(`   Quality Score: ${researchResponse.quality.automatedScore.toFixed(3)}`);
    console.log(`   Cost: $${researchResponse.metadata.cost.toFixed(4)}`);
    console.log(`   Content Preview: ${researchResponse.content.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Research Failed:', error);
  }

  // Example 3: Code review request
  console.log('\n🔍 Example 3: Code Review');
  console.log('---------------------------');

  const codeReviewRequest: AIRequest = {
    id: 'review-001',
    type: {
      category: 'review',
      subcategory: 'code-review',
      complexity: 'moderate',
      expectedOutput: 'structured'
    },
    priority: 'normal',
    content: `function calculateTotal(items: Item[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`,
    context: {
      language: 'typescript',
      focus: ['performance', 'best-practices', 'security']
    },
    metadata: {
      source: 'example-usage',
      tags: ['typescript', 'review', 'optimization'],
      correlationId: 'demo-003'
    },
    requirements: {
      capabilities: ['code-review'],
      minQuality: 0.85,
      maxLatency: 3000,
      preferredProviders: ['claude-3-sonnet'],
      allowFailover: true,
      cacheable: false
    },
    timestamp: new Date(),
    routing: {
      strategy: 'balanced',
      loadBalancing: 'weighted',
      failover: 'graceful',
      optimization: 'continuous'
    }
  };

  try {
    const reviewResponse = await router.routeWithHCFP(codeReviewRequest);
    console.log('✅ Code Review Success:');
    console.log(`   Provider: ${reviewResponse.provider}`);
    console.log(`   Response Time: ${reviewResponse.performance.totalTime}ms`);
    console.log(`   Quality Score: ${reviewResponse.quality.automatedScore.toFixed(3)}`);
    console.log(`   Cost: $${reviewResponse.metadata.cost.toFixed(4)}`);
    console.log(`   Content Preview: ${reviewResponse.content.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Code Review Failed:', error);
  }

  // Wait a bit for optimization
  console.log('\n⏳ Waiting for optimization...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Show router statistics
  console.log('\n📊 Router Statistics');
  console.log('====================');
  const stats = router.getStats();
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`);
  console.log(`Average Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
  console.log(`Total Cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

  // Show provider usage
  console.log('\n📈 Provider Usage');
  console.log('==================');
  const usage = router.getProviderUsage();
  for (const [providerId, usageRate] of Object.entries(usage)) {
    console.log(`${providerId}: ${(usageRate * 100).toFixed(1)}%`);
  }

  // Show HCFP status
  console.log('\n🚀 HCFP Status');
  console.log('===============');
  const hcfpStatus = router.getHCFPStatus();
  console.log(`HCFP Enabled: ${hcfpStatus.hcfp.enabled}`);
  console.log(`Auto Mode: ${hcfpStatus.hcfp.autoMode}`);
  console.log(`ORS Enabled: ${hcfpStatus.ors.enabled}`);
  console.log(`Continuous Optimization: ${hcfpStatus.optimization.continuous}`);
  console.log(`ML Enabled: ${hcfpStatus.optimization.mlEnabled}`);
  console.log(`Feedback Buffer Size: ${hcfpStatus.optimization.feedbackBufferSize}`);

  // Demonstrate AI node updater
  console.log('\n🔄 AI Node Updater Demo');
  console.log('========================');
  
  try {
    const nodeUpdater = new AINodeUpdater(config);
    console.log('🔧 Updating AI nodes to use HC-AI-Router...');
    
    // This would update all existing AI nodes
    // await nodeUpdater.updateAllNodes();
    
    console.log('✅ AI Node Updater initialized');
    console.log('   (Full migration would run in production)');
    
  } catch (error) {
    console.error('❌ AI Node Updater failed:', error);
  }

  // Shutdown router
  console.log('\n🛑 Shutting down router...');
  router.shutdown();
  console.log('✅ Demo completed');
}

/**
 * 🎯 Run performance benchmark
 */
async function runPerformanceBenchmark(): Promise<void> {
  console.log('\n⚡ Performance Benchmark');
  console.log('========================');

  const config = createExampleConfig();
  const router = new HCFPAIRouter(config);

  const requests = [
    {
      name: 'Simple Code Generation',
      request: {
        id: 'bench-001',
        type: {
          category: 'generation' as const,
          subcategory: 'code-generation',
          complexity: 'simple',
          expectedOutput: 'code'
        },
        priority: 'normal' as const,
        content: 'Write a hello world function in Python',
        metadata: {
          source: 'benchmark',
          tags: ['python', 'simple']
        },
        requirements: {
          capabilities: ['code-generation'],
          minQuality: 0.7,
          maxLatency: 2000,
          allowFailover: true,
          cacheable: true
        },
        timestamp: new Date()
      }
    },
    {
      name: 'Complex Research',
      request: {
        id: 'bench-002',
        type: {
          category: 'research' as const,
          subcategory: 'research',
          complexity: 'complex',
          expectedOutput: 'structured'
        },
        priority: 'normal' as const,
        content: 'Analyze the impact of AI on climate change research',
        metadata: {
          source: 'benchmark',
          tags: ['research', 'complex']
        },
        requirements: {
          capabilities: ['research'],
          minQuality: 0.9,
          maxLatency: 15000,
          allowFailover: true,
          cacheable: true
        },
        timestamp: new Date()
      }
    },
    {
      name: 'Code Review',
      request: {
        id: 'bench-003',
        type: {
          category: 'review' as const,
          subcategory: 'code-review',
          complexity: 'moderate',
          expectedOutput: 'structured'
        },
        priority: 'normal' as const,
        content: 'Review this function for security vulnerabilities',
        metadata: {
          source: 'benchmark',
          tags: ['security', 'review']
        },
        requirements: {
          capabilities: ['code-review'],
          minQuality: 0.85,
          maxLatency: 5000,
          allowFailover: true,
          cacheable: false
        },
        timestamp: new Date()
      }
    }
  ];

  const results = [];

  for (const test of requests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    
    const startTime = Date.now();
    try {
      const response = await router.routeWithHCFP(test.request);
      const endTime = Date.now();
      
      const result = {
        name: test.name,
        success: true,
        responseTime: endTime - startTime,
        provider: response.provider,
        quality: response.quality.automatedScore,
        cost: response.metadata.cost
      };
      
      results.push(result);
      
      console.log(`   ✅ Success - ${result.responseTime}ms`);
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Quality: ${result.quality.toFixed(3)}`);
      console.log(`   Cost: $${result.cost.toFixed(4)}`);
      
    } catch (error) {
      const endTime = Date.now();
      
      results.push({
        name: test.name,
        success: false,
        responseTime: endTime - startTime,
        error: error.message
      });
      
      console.log(`   ❌ Failed - ${endTime - startTime}ms`);
      console.log(`   Error: ${error.message}`);
    }
  }

  // Summary
  console.log('\n📊 Benchmark Summary');
  console.log('====================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
  
  if (successful.length > 0) {
    const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
    const avgQuality = successful.reduce((sum, r) => sum + r.quality, 0) / successful.length;
    const totalCost = successful.reduce((sum, r) => sum + r.cost, 0);
    
    console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`Average Quality: ${avgQuality.toFixed(3)}`);
    console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  }

  router.shutdown();
}

// Export functions for use
export {
  demonstrateHC AIRouter,
  runPerformanceBenchmark,
  createExampleConfig
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateHC AIRouter().catch(console.error);
}
