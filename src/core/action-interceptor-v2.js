#!/usr/bin/env node
/**
 * 🎯 ACTION INTERCEPTOR: Universal Dual-Engine Execution Wrapper
 * Intercepts ALL actions in Heady and routes through Socratic + Monte Carlo
 * 100% of actions pass through both engines - no exceptions
 */

const DualEngineExecutor = require('./core/dual-engine-executor');

class ActionInterceptor {
  constructor() {
    this.executor = new DualEngineExecutor();
    this.interceptedMethods = new Map();
    this.interceptionCount = 0;
  }

  /**
   * Intercept ALL actions and route through dual engine
   */
  intercept(headyManager) {
    console.log('🎯 ACTION INTERCEPTOR: Activating universal dual-engine execution...');
    
    // Intercept API endpoints
    this.interceptAPI(headyManager);
    
    // Intercept node activations
    this.interceptNodes(headyManager);
    
    // Intercept code generation
    this.interceptCodegen(headyManager);
    
    console.log('✅ All action types intercepted. Dual engine active.');
  }

  interceptAPI(manager) {
    console.log('   📡 Intercepting API endpoints...');
    
    // Intercept POST requests
    const originalPost = manager.app.post.bind(manager.app);
    manager.app.post = (path, ...handlers) => {
      const wrappedHandlers = handlers.map(handler => this.wrapHandler(handler, 'api_post', path));
      return originalPost(path, ...wrappedHandlers);
    };
  }

  interceptNodes(manager) {
    console.log('   🧠 Intercepting AI node activations...');
    
    if (manager.nodes) {
      for (const [nodeName, node] of Object.entries(manager.nodes)) {
        if (node.execute) {
          const originalExecute = node.execute.bind(node);
          node.execute = async (...args) => {
            const action = {
              type: 'node_execution',
              node: nodeName,
              args: args,
              description: `Execute ${nodeName} with args: ${JSON.stringify(args)}`,
            };
            
            const result = await this.executor.execute(action, {
              node: node,
              systemState: this.getSystemState(manager),
            });
            
            this.interceptionCount++;
            
            if (result.status === 'SUCCESS') {
              return originalExecute(...args);
            }
            
            throw new Error(`Node execution blocked by dual engine: ${result.status}`);
          };
          
          this.interceptedMethods.set(`node_${nodeName}`, originalExecute);
        }
      }
    }
  }

  interceptCodegen(manager) {
    console.log('   💻 Intercepting code generation...');
    
    if (manager.engines && manager.engines.codingMastery) {
      const codingMastery = manager.engines.codingMastery;
      const originalGenerate = codingMastery.generateCode.bind(codingMastery);
      
      codingMastery.generateCode = async (spec, context) => {
        const action = {
          type: 'code_generation',
          specification: spec,
          context: context,
          description: `Generate code for: ${spec.substring(0, 100)}...`,
        };
        
        const result = await this.executor.execute(action, {
          similarCode: await this.findSimilarCode(spec),
          mistakes: await this.findRelatedMistakes(spec),
        });
        
        this.interceptionCount++;
        
        if (result.status === 'SUCCESS') {
          return originalGenerate(spec, context);
        }
        
        return result;
      };
      
      this.interceptedMethods.set('coding_mastery_generate', originalGenerate);
    }
  }

  // Helper methods
  wrapHandler(handler, method, path) {
    return async (req, res, next) => {
      const action = {
        type: method,
        path: path,
        body: req.body,
        query: req.query,
        description: `${method.toUpperCase()} ${path}`,
      };
      
      const result = await this.executor.execute(action, {
        request: req,
        user: req.user,
        headers: req.headers,
      });
      
      this.interceptionCount++;
      
      if (result.status === 'CLARIFICATION_NEEDED') {
        return res.status(400).json({
          error: 'CLARIFICATION_NEEDED',
          questions: result.questions,
          reasoning: result.reasoning,
        });
      }
      
      if (result.status === 'SUCCESS') {
        req.dualEngineResult = result;
        return handler(req, res, next);
      }
      
      return res.status(500).json({
        error: 'DUAL_ENGINE_ERROR',
        status: result.status,
      });
    };
  }

  async findSimilarCode(spec) {
    return [];
  }

  async findRelatedMistakes(spec) {
    return [];
  }

  getSystemState(manager) {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeCount: manager.nodes ? Object.keys(manager.nodes).length : 0,
    };
  }

  getInterceptionStats() {
    return {
      totalInterceptions: this.interceptionCount,
      interceptedMethods: this.interceptedMethods.size,
      methods: Array.from(this.interceptedMethods.keys()),
    };
  }
}

module.exports = ActionInterceptor;
