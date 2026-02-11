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
// ║  FILE: src/hc_improvement_scheduler.js                                    ║
// ║  LAYER: core                                                             ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class ImprovementScheduler extends EventEmitter {
  constructor({
    interval = 900000, // 15 minutes
    pipeline,
    patternEngine,
    selfCritiqueEngine,
    mcPlanScheduler
  }) {
    super();
    this.interval = interval;
    this.pipeline = pipeline;
    this.patternEngine = patternEngine;
    this.selfCritiqueEngine = selfCritiqueEngine;
    this.mcPlanScheduler = mcPlanScheduler;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    
    // Initial run
    this.runCycle();
    
    // Set up interval
    this.timer = setInterval(() => {
      this.runCycle();
    }, this.interval);
    
    this.emit('started');
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.running = false;
    this.emit('stopped');
  }

  async runCycle() {
    if (!this.pipeline || !this.patternEngine || !this.selfCritiqueEngine) {
      this.emit('error', 'Dependencies not available');
      return;
    }
    
    try {
      this.emit('cycle_start');
      
      // 1. Check for improvement candidates from pattern engine
      const improvements = await this.getImprovementCandidates();
      
      // 2. Prioritize using Monte Carlo if available
      const prioritized = this.mcPlanScheduler 
        ? this.mcPlanScheduler.prioritizeImprovements(improvements)
        : improvements;
      
      // 3. Execute top improvements via pipeline
      for (const improvement of prioritized.slice(0, 3)) {
        await this.executeImprovement(improvement);
      }
      
      this.emit('cycle_complete', { improvements: prioritized.length });
    } catch (error) {
      this.emit('error', error);
    }
  }

  async getImprovementCandidates() {
    // Get patterns needing improvement
    const stagnantPatterns = this.patternEngine.getPatternsByState('stagnant');
    const degradingPatterns = this.patternEngine.getPatternsByState('degrading');
    
    // Get self-critique findings
    const critiques = this.selfCritiqueEngine.getRecentCritiques();
    
    // Combine into improvement candidates
    return [
      ...stagnantPatterns.map(p => ({
        type: 'pattern_stagnation',
        target: p.id,
        priority: p.severity === 'critical' ? 1 : 2,
        details: p
      })),
      ...degradingPatterns.map(p => ({
        type: 'pattern_degradation',
        target: p.id,
        priority: 1, // Always high priority
        details: p
      })),
      ...critiques.map(c => ({
        type: 'self_critique',
        target: c.context,
        priority: c.severity === 'high' ? 1 : 2,
        details: c
      }))
    ];
  }

  async executeImprovement(improvement) {
    // Execute via pipeline if available
    if (this.pipeline) {
      return this.pipeline.run({
        type: 'improvement_task',
        improvement,
        lane: 'improvement'
      });
    }
    
    // Fallback direct execution
    switch (improvement.type) {
      case 'pattern_stagnation':
      case 'pattern_degradation':
        return this.handlePatternImprovement(improvement);
      case 'self_critique':
        return this.handleCritiqueImprovement(improvement);
      default:
        throw new Error(`Unknown improvement type: ${improvement.type}`);
    }
  }

  async handlePatternImprovement(improvement) {
    // Implementation for pattern-based improvements
    // This would actually modify code/files based on the pattern
    this.emit('improvement_start', improvement);
    
    // TODO: Implement actual code modifications
    
    this.emit('improvement_complete', improvement);
    return { success: true };
  }

  async handleCritiqueImprovement(improvement) {
    // Implementation for critique-based improvements
    this.emit('improvement_start', improvement);
    
    // TODO: Implement actual fixes based on critique
    
    this.emit('improvement_complete', improvement);
    return { success: true };
  }
}

function registerImprovementRoutes(app, scheduler) {
  app.get('/api/improvement/status', (req, res) => {
    res.json({
      running: scheduler.running,
      interval: scheduler.interval,
      lastCycle: scheduler.lastCycleTs,
      ts: new Date().toISOString()
    });
  });
  
  app.post('/api/improvement/start', (req, res) => {
    scheduler.start();
    res.json({ success: true, running: scheduler.running });
  });
  
  app.post('/api/improvement/stop', (req, res) => {
    scheduler.stop();
    res.json({ success: true, running: scheduler.running });
  });
  
  app.post('/api/improvement/run-cycle', async (req, res) => {
    try {
      await scheduler.runCycle();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  ImprovementScheduler,
  registerImprovementRoutes
};
