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
// ║  FILE: node-ai-router-integration.js                           ║
// ║  UPDATED: 20260219-220000                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🤖 Node AI Router Integration
 * 
 * Updates all AI nodes to use hc-ai-router instead of direct provider calls
 * Provides intelligent, self-aware, deterministic resource allocation
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class NodeAIRouterIntegration {
  constructor() {
    this.aiRouterConfigPath = path.join(__dirname, '../../configs/ai-routing.yaml');
    this.hcPipelineConfigPath = path.join(__dirname, '../../configs/hcfullpipeline.yaml');
    this.nodesPath = path.join(__dirname, '../nodes');
    this.integrationComplete = false;
  }

  /**
   * 🚀 Main integration method
   */
  async integrateAllNodes() {
    console.log('\n🤖 NODE AI ROUTER INTEGRATION');
    console.log('='.repeat(60));
    
    try {
      // Load configurations
      const aiRouterConfig = await this.loadConfig(this.aiRouterConfigPath);
      const pipelineConfig = await this.loadConfig(this.hcPipelineConfigPath);
      
      // Get all AI nodes
      const nodes = await this.discoverNodes();
      console.log(`\n📋 Discovered ${nodes.length} AI nodes for integration`);
      
      // Update each node
      for (const node of nodes) {
        await this.updateNode(node, aiRouterConfig, pipelineConfig);
      }
      
      // Create node registry with routing awareness
      await this.createRoutingRegistry(nodes, aiRouterConfig);
      
      // Update node health checks to include AI router
      await this.updateHealthChecks();
      
      this.integrationComplete = true;
      console.log('\n✅ Node AI Router Integration Complete');
      console.log('🎯 All nodes now use intelligent routing');
      
    } catch (error) {
      console.error('\n❌ Integration failed:', error.message);
      throw error;
    }
  }

  /**
   * 📁 Discover all AI nodes in the system
   */
  async discoverNodes() {
    const nodes = [];
    
    // Known nodes from configuration
    const knownNodes = [
      'promoter', 'brain', 'jules', 'pythia', 'socrates', 
      'muse', 'bridge', 'sentinel', 'nova', 'observer',
      'janitor', 'sophia', 'cipher', 'atlas', 'murphy',
      'sasha', 'scout', 'oculus', 'builder', 'lens', 'memory'
    ];
    
    for (const nodeName of knownNodes) {
      const nodePath = path.join(this.nodesPath, `${nodeName}.js`);
      if (fs.existsSync(nodePath)) {
        nodes.push({
          name: nodeName,
          path: nodePath,
          config: this.getNodeConfig(nodeName)
        });
      }
    }
    
    return nodes;
  }

  /**
   * 📝 Get node-specific configuration
   */
  getNodeConfig(nodeName) {
    const nodeConfigs = {
      promoter: {
        primary_task: 'deep_reasoning',
        fallback_task: 'system_optimization',
        max_concurrent_tasks: 4,
        priority: 'critical'
      },
      brain: {
        primary_task: 'deep_reasoning',
        fallback_task: 'error_analysis',
        max_concurrent_tasks: 2,
        priority: 'critical'
      },
      jules: {
        primary_task: 'code_generation',
        fallback_task: 'general_chat',
        max_concurrent_tasks: 6,
        priority: 'high'
      },
      pythia: {
        primary_task: 'code_generation',
        fallback_task: 'embeddings',
        max_concurrent_tasks: 4,
        priority: 'medium'
      },
      muse: {
        primary_task: 'multimodal',
        fallback_task: 'general_chat',
        max_concurrent_tasks: 2,
        priority: 'medium'
      },
      socrates: {
        primary_task: 'deep_reasoning',
        fallback_task: 'general_chat',
        max_concurrent_tasks: 3,
        priority: 'high'
      }
    };
    
    return nodeConfigs[nodeName] || {
      primary_task: 'general_chat',
      fallback_task: 'embeddings',
      max_concurrent_tasks: 2,
      priority: 'medium'
    };
  }

  /**
   * 🔄 Update individual node to use AI router
   */
  async updateNode(node, aiRouterConfig, pipelineConfig) {
    console.log(`\n🔄 Updating node: ${node.name}`);
    
    try {
      // Read current node file
      const nodeContent = fs.readFileSync(node.path, 'utf8');
      
      // Check if already integrated
      if (nodeContent.includes('hc-ai-router') || nodeContent.includes('HCAIRouter')) {
        console.log(`  ✅ ${node.name} already integrated`);
        return;
      }
      
      // Create AI router wrapper for node
      const routerWrapper = this.createRouterWrapper(node, aiRouterConfig);
      
      // Update node content
      const updatedContent = this.updateNodeContent(nodeContent, routerWrapper, node);
      
      // Write updated node
      fs.writeFileSync(node.path, updatedContent);
      console.log(`  ✅ ${node.name} updated with AI router integration`);
      
    } catch (error) {
      console.error(`  ❌ Failed to update ${node.name}:`, error.message);
      throw error;
    }
  }

  /**
   * 🎯 Create AI router wrapper for node
   */
  createRouterWrapper(node, aiRouterConfig) {
    return `
// ════════════════════════════════════════════════════════════════════
// 🤖 AI ROUTER INTEGRATION FOR ${node.name.toUpperCase()}
// ════════════════════════════════════════════════════════════════════

const HCAIRouter = require('../ai-router/hc-ai-router-simple');

class ${node.name.charAt(0).toUpperCase() + node.name.slice(1)}AIRouter {
  constructor() {
    this.router = new HCAIRouter({
      configPath: '../configs/ai-routing.yaml',
      nodeId: '${node.name}',
      primaryTask: '${node.config.primary_task}',
      fallbackTask: '${node.config.fallback_task}',
      maxConcurrentTasks: ${node.config.max_concurrent_tasks},
      priority: '${node.config.priority}'
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.router.initialize();
    this.initialized = true;
    console.log('[${node.name}] AI Router initialized');
  }

  async routeRequest(taskType, prompt, options = {}) {
    await this.initialize();
    
    const context = {
      kind: taskType,
      nodeId: '${node.name}',
      ors: await this.getORS(),
      estTokens: options.estimatedTokens || 1000,
      latencySensitivity: options.latencySensitivity || 'medium',
      importance: options.importance || 'background',
      traceId: options.traceId || this.generateTraceId()
    };

    try {
      const result = await this.router.runTask(context, prompt);
      return result;
    } catch (error) {
      console.error('[${node.name}] AI routing failed:', error);
      throw error;
    }
  }

  async getORS() {
    // Get Operational Readiness Score from system
    try {
      const response = await fetch('https://api.headysystems.com/api/system-status');
      const data = await response.json();
      return data.ors || 70;
    } catch (error) {
      console.warn('[${node.name}] Could not fetch ORS, using default');
      return 70;
    }
  }

  generateTraceId() {
    return \`${node.name}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  // Provider-specific methods for backward compatibility
  async callOpenAI(prompt, options = {}) {
    return this.routeRequest('general_chat', prompt, { ...options, providerPreference: 'openai' });
  }

  async callClaude(prompt, options = {}) {
    return this.routeRequest('code_generation', prompt, { ...options, providerPreference: 'claude' });
  }

  async callGemini(prompt, options = {}) {
    return this.routeRequest('multimodal', prompt, { ...options, providerPreference: 'gemini' });
  }
}

// Global AI router instance for ${node.name}
global.${node.name}AIRouter = new ${node.name.charAt(0).toUpperCase() + node.name.slice(1)}AIRouter();

// Helper function for easy access
async function routeAI(taskType, prompt, options = {}) {
  return await global.${node.name}AIRouter.routeRequest(taskType, prompt, options);
}
`;
  }

  /**
   * ✏️ Update node content with AI router integration
   */
  updateNodeContent(content, routerWrapper, node) {
    // Add router wrapper at the beginning
    const updatedContent = routerWrapper + '\n\n' + content;
    
    // Replace direct provider calls with router calls
    const replacements = [
      {
        pattern: /new OpenAI\(\)/g,
        replacement: 'global.' + node.name + 'AIRouter'
      },
      {
        pattern: /new Anthropic\(\)/g,
        replacement: 'global.' + node.name + 'AIRouter'
      },
      {
        pattern: /new GoogleGenerativeAI\(\)/g,
        replacement: 'global.' + node.name + 'AIRouter'
      },
      {
        pattern: /\.chat\.completions\.create/g,
        replacement: '.callOpenAI'
      },
      {
        pattern: /\.messages\.create/g,
        replacement: '.callClaude'
      },
      {
        pattern: /\.generateContent/g,
        replacement: '.callGemini'
      }
    ];
    
    let finalContent = updatedContent;
    for (const replacement of replacements) {
      finalContent = finalContent.replace(replacement.pattern, replacement.replacement);
    }
    
    return finalContent;
  }

  /**
   * 📋 Create routing registry
   */
  async createRoutingRegistry(nodes, aiRouterConfig) {
    const registry = {
      version: '2.0.0',
      updated: new Date().toISOString(),
      nodes: nodes.map(node => ({
        name: node.name,
        ...node.config,
        ai_router_enabled: true,
        production_domains_only: true,
        deterministic_routing: true
      })),
      routing_config: aiRouterConfig,
      integration_status: 'complete'
    };
    
    const registryPath = path.join(__dirname, '../../configs/node-routing-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log('\n📋 Node routing registry created');
  }

  /**
   * 🏥 Update health checks
   */
  async updateHealthChecks() {
    const healthCheckScript = `
// ╔══════════════════════════════════════════════════════════════════╗
// ║  🏥 AI ROUTER HEALTH CHECKS                                      ║
// ╚══════════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');

async function checkAIRouterHealth() {
  const results = [];
  
  try {
    // Check AI router configuration
    const configPath = path.join(__dirname, '../configs/ai-routing.yaml');
    if (fs.existsSync(configPath)) {
      results.push({ status: 'healthy', component: 'ai-router-config', message: 'Configuration found' });
    } else {
      results.push({ status: 'unhealthy', component: 'ai-router-config', message: 'Configuration missing' });
    }
    
    // Check node integration
    const nodesPath = path.join(__dirname, '../src/nodes');
    const nodeFiles = fs.readdirSync(nodesPath).filter(f => f.endsWith('.js'));
    
    let integratedNodes = 0;
    for (const nodeFile of nodeFiles) {
      const content = fs.readFileSync(path.join(nodesPath, nodeFile), 'utf8');
      if (content.includes('AIRouter')) {
        integratedNodes++;
      }
    }
    
    const integrationRate = (integratedNodes / nodeFiles.length) * 100;
    results.push({ 
      status: integrationRate > 80 ? 'healthy' : 'degraded', 
      component: 'node-integration', 
      message: \`\${integratedNodes}/\${nodeFiles.length} nodes integrated (\${integrationRate.toFixed(1)}%)\` 
    });
    
    // Check ORS endpoint
    try {
      const response = await fetch('https://api.headysystems.com/api/system-status');
      if (response.ok) {
        const data = await response.json();
        results.push({ 
          status: data.ors > 50 ? 'healthy' : 'degraded', 
          component: 'ors', 
          message: \`ORS: \${data.ors}\` 
        });
      } else {
        results.push({ status: 'unhealthy', component: 'ors', message: 'ORS endpoint unreachable' });
      }
    } catch (error) {
      results.push({ status: 'degraded', component: 'ors', message: 'ORS check failed' });
    }
    
    return results;
    
  } catch (error) {
    return [{ status: 'unhealthy', component: 'ai-router-health', message: error.message }];
  }
}

module.exports = { checkAIRouterHealth };
`;
    
    const healthCheckPath = path.join(__dirname, '../scripts/health/ai-router-health.js');
    const healthDir = path.dirname(healthCheckPath);
    
    if (!fs.existsSync(healthDir)) {
      fs.mkdirSync(healthDir, { recursive: true });
    }
    
    fs.writeFileSync(healthCheckPath, healthCheckScript);
    console.log('\n🏥 AI router health checks updated');
  }

  /**
   * 📄 Load configuration file
   */
  async loadConfig(configPath) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      console.warn(`Could not load config ${configPath}:`, error.message);
      return {};
    }
  }
}

// Export for use
module.exports = NodeAIRouterIntegration;

// Auto-run if called directly
if (require.main === module) {
  const integration = new NodeAIRouterIntegration();
  integration.integrateAllNodes()
    .then(() => {
      console.log('\n🎉 Integration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Integration failed:', error);
      process.exit(1);
    });
}
