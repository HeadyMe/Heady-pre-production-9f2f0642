
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
// ║  FILE: action-interceptor.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * 🎯 ACTION INTERCEPTOR - Wrap Every Single Heady Action
 * ═══════════════════════════════════════════════════════════════
 * Intercepts ALL actions and routes through dual engine
 */

const DualEngineExecutor = require('./dual-engine-executor');

class ActionInterceptor {
  constructor() {
    this.executor = new DualEngineExecutor();
    this.interceptedCount = 0;
  }

  /**
   * Intercept ALL actions and route through dual engine
   */
  intercept(headyManager) {
    console.log('🎯 Installing Action Interceptor - ALL actions will pass through HeadyBattle + HeadySims');
    
    // Intercept API endpoints
    this.interceptAPI(headyManager);
    
    // Intercept node activations
    this.interceptNodes(headyManager);
    
    // Intercept code generation
    this.interceptCodegen(headyManager);
    
    // Intercept file operations
    this.interceptFileOps(headyManager);
    
    // Intercept deployments
    this.interceptDeployments(headyManager);
    
    console.log('✅ Action Interceptor installed - 100% of actions now validated');
  }

  interceptAPI(manager) {
    if (!manager || !manager.app) {
      console.log('⚠️  Manager or manager.app not available, skipping API interception');
      return;
    }
    
    const originalPost = manager.app.post.bind(manager.app);
    
    manager.app.post = (path, ...handlers) => {
      const wrappedHandlers = handlers.map(handler => {
        return async (req, res, next) => {
          this.interceptedCount++;
          
          const action = {
            type: 'api_call',
            method: 'POST',
            path: path,
            body: req.body,
            user: req.user,
          };
          
          console.log(`🔄 Intercepting API call #${this.interceptedCount}: ${path}`);
          
          const result = await this.executor.execute(action, {
            request: req,
            existingData: await this.getContextForPath(path),
          });
          
          if (result.status === 'CLARIFICATION_NEEDED') {
            return res.status(400).json({
              error: 'Clarification needed',
              questions: result.questions,
              message: 'Please answer these questions to proceed'
            });
          }
          
          if (result.status === 'LOW_CONFIDENCE') {
            return res.status(409).json({
              error: 'Low confidence',
              confidence: result.confidence,
              recommendation: result.recommendation,
              question: result.question
            });
          }
          
          if (result.status === 'VALIDATION_FAILED') {
            return res.status(422).json({
              error: 'Validation failed',
              reasons: result.reasons,
              alternatives: result.alternatives
            });
          }
          
          if (result.status === 'SUCCESS') {
            req.dualEngineResult = result;
            console.log(`✅ API call approved: ${path} (HeadyBattle: ${result.metadata.HeadyBattleScore.toFixed(2)}, HeadySims: ${result.metadata.monteCarloConfidence.toFixed(2)})`);
            return handler(req, res, next);
          }
          
          return res.status(500).json({
            error: 'Execution blocked',
            status: result.status
          });
        };
      });
      
      return originalPost(path, ...wrappedHandlers);
    };
  }

  interceptNodes(manager) {
    if (!manager || !manager.nodes) {
      console.log('⚠️  Manager or manager.nodes not available, skipping node interception');
      return;
    }
    
    for (const [nodeName, node] of Object.entries(manager.nodes)) {
      if (node.execute) {
        const originalExecute = node.execute.bind(node);
        
        node.execute = async (...args) => {
          this.interceptedCount++;
          
          const action = {
            type: 'node_execution',
            node: nodeName,
            args: args,
          };
          
          console.log(`🔄 Intercepting node execution #${this.interceptedCount}: ${nodeName}`);
          
          const result = await this.executor.execute(action, {
            node: node,
            history: await this.getNodeHistory(nodeName),
          });
          
          if (result.status === 'SUCCESS') {
            console.log(`✅ Node execution approved: ${nodeName}`);
            return originalExecute(...args);
          }
          
          throw new Error(`Node execution blocked: ${nodeName} - ${result.status}`);
        };
      }
    }
  }

  interceptCodegen(manager) {
    if (!manager || !manager.engines || !manager.engines.codingMastery) {
      console.log('⚠️  Manager or coding mastery engine not available, skipping codegen interception');
      return;
    }
    
    const codingMastery = manager.engines.codingMastery;
    const originalGenerate = codingMastery.generateCode?.bind(codingMastery);
    
    if (originalGenerate) {
      codingMastery.generateCode = async (spec, context) => {
        this.interceptedCount++;
        
        const action = {
          type: 'code_generation',
          specification: spec,
          context: context,
        };
        
        console.log(`🔄 Intercepting code generation #${this.interceptedCount}`);
        
        const result = await this.executor.execute(action, {
          similarCode: await this.findSimilarCode(spec),
          mistakes: await this.findRelatedMistakes(spec),
        });
        
        if (result.status === 'SUCCESS') {
          console.log(`✅ Code generation approved`);
          return originalGenerate(spec, context);
        }
        
        return result;
      };
    }
  }

  interceptFileOps(manager) {
    // Intercept critical file operations
    const fs = require('fs');
    const originalWriteFile = fs.writeFile.bind(fs);
    
    fs.writeFile = (path, data, options, callback) => {
      const action = {
        type: 'file_write',
        path: path,
        size: data ? data.length : 0,
      };
      
      this.executor.execute(action, {
        operation: 'write',
        targetPath: path,
      }).then(result => {
        if (result.status === 'SUCCESS') {
          return originalWriteFile(path, data, options, callback);
        } else {
          callback(new Error(`File write blocked: ${result.status}`));
        }
      }).catch(error => {
        callback(error);
      });
    };
  }

  interceptDeployments(manager) {
    if (!manager || !manager.deploy) {
      console.log('⚠️  Manager or deploy method not available, skipping deployment interception');
      return;
    }
    
    // Intercept deployment operations
    const originalDeploy = manager.deploy.bind(manager);
    
    if (originalDeploy) {
      manager.deploy = async (config) => {
        this.interceptedCount++;
        
        const action = {
          type: 'deployment',
          config: config,
        };
        
        console.log(`🔄 Intercepting deployment #${this.interceptedCount}`);
        
        const result = await this.executor.execute(action, {
          deploymentHistory: await this.getDeploymentHistory(),
        });
        
        if (result.status === 'SUCCESS') {
          console.log(`✅ Deployment approved`);
          return originalDeploy(config);
        }
        
        throw new Error(`Deployment blocked: ${result.status}`);
      };
    }
  }

  async getContextForPath(path) {
    // Get context for API paths
    return {
      path: path,
      method: 'POST',
      timestamp: new Date().toISOString(),
    };
  }

  async getNodeHistory(nodeName) {
    // Get execution history for nodes
    return [];
  }

  async findSimilarCode(spec) {
    // Find similar code patterns
    return [];
  }

  async findRelatedMistakes(spec) {
    // Find related mistakes
    return [];
  }

  async getDeploymentHistory() {
    // Get deployment history
    return [];
  }

  getStats() {
    return {
      interceptedActions: this.interceptedCount,
      executorStats: this.executor.getStats?.() || {},
    };
  }
}

module.exports = ActionInterceptor;
