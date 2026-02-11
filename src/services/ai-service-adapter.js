// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/services/ai-service-adapter.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { claude } = require('../hc_claude');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const mcPlanScheduler = require('./mc-plan-scheduler'); // Assuming mcPlanScheduler is in the same directory
const performanceTracker = require('./ai-performance-tracker');

class AIServiceAdapter {
  constructor() {
    this.services = {};
    this.activeService = null;
    this.serviceConfig = {};
  }

  async init() {
    const configFile = await fs.readFile('./configs/ai-services.yaml', 'utf8');
    this.serviceConfig = yaml.load(configFile);
    
    // Initialize enabled services
    for (const [serviceName, config] of Object.entries(this.serviceConfig.services)) {
      if (config.enabled) {
        this.services[serviceName] = this._createServiceHandler(serviceName);
      }
    }
    
    this.activeService = this.serviceConfig.defaultService;
    
    if (!this.services[this.activeService]) {
      throw new Error(`Default service ${this.activeService} not enabled`);
    }
  }

  _createServiceHandler(serviceName) {
    switch(serviceName) {
      case 'claude':
        return async (prompt, context) => {
          return await claude.getCompletion('multi-service-analysis', { 
            prompt,
            context,
            model: process.env.CLAUDE_MODEL || this.serviceConfig.services.claude.default_model
          });
        };
        
      // Placeholders for other services
      case 'codex':
        return async () => { throw new Error('Codex integration not implemented'); };
        
      case 'gemini':
        return async () => { throw new Error('Gemini integration not implemented'); };
        
      case 'llama':
        return async () => { throw new Error('Llama integration not implemented'); };
        
      case 'gpt4':
        return async () => { throw new Error('GPT-4 integration not implemented'); };
        
      case 'palm':
        return async () => { throw new Error('PaLM integration not implemented'); };
        
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  async analyze(prompt, context, options = {}) {
    const startTime = Date.now();
    const taskType = options.taskType || this._detectTaskType(context);
    
    const service = options.service || 
                   (options.auto ? await performanceTracker.getBestServiceForTask(taskType) : this.activeService);
    
    try {
      const result = await this.services[service](prompt, context, options);
      
      // Record performance
      await performanceTracker.recordServicePerformance(
        service,
        taskType,
        {
          latency: Date.now() - startTime,
          inputLength: context.length,
          success: true
        }
      );
      
      return result;
    } catch (err) {
      await performanceTracker.recordServicePerformance(
        service,
        taskType,
        {
          latency: Date.now() - startTime,
          inputLength: context.length,
          success: false,
          error: err.message
        }
      );
      throw err;
    }
  }

  _detectTaskType(context) {
    // Simple heuristic - could be enhanced
    if (context.includes('```')) return 'code_analysis';
    if (context.length > 1000) return 'long_context';
    return 'general';
  }
}

const adapter = new AIServiceAdapter();
module.exports = adapter;
