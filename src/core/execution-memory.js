/**
 * ═══════════════════════════════════════════════════════════════
 * 🧠 EXECUTION MEMORY - Learning from Every Action
 * ═══════════════════════════════════════════════════════════════
 * Stores and retrieves execution patterns for learning
 */

class ExecutionMemory {
  constructor() {
    this.executions = [];
    this.patterns = new Map();
    this.maxHistory = 1000;
  }

  async record(execution) {
    const record = {
      ...execution,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };
    
    this.executions.push(record);
    
    // Keep history manageable
    if (this.executions.length > this.maxHistory) {
      this.executions = this.executions.slice(-this.maxHistory / 2);
    }
    
    // Update patterns
    this.updatePatterns(record);
    
    console.log(`📝 Execution recorded: ${record.action.type}`);
  }

  async getSimilar(action) {
    const similar = this.executions
      .filter(exec => exec.action.type === action.type)
      .sort((a, b) => {
        const scoreA = this.calculateSimilarity(action, a.action);
        const scoreB = this.calculateSimilarity(action, b.action);
        return scoreB - scoreA;
      })
      .slice(0, 10);
    
    return similar;
  }

  async getSuccessfulExecutions(actionType, limit = 10) {
    return this.executions
      .filter(exec => 
        exec.action.type === actionType && 
        exec.result.success
      )
      .sort((a, b) => b.result.duration - a.result.duration)
      .slice(0, limit);
  }

  async getFailurePatterns(actionType) {
    const failures = this.executions
      .filter(exec => 
        exec.action.type === actionType && 
        !exec.result.success
      );
    
    // Analyze common failure patterns
    const patterns = {};
    
    failures.forEach(failure => {
      const errorType = failure.result.error || 'unknown';
      patterns[errorType] = (patterns[errorType] || 0) + 1;
    });
    
    return patterns;
  }

  updatePatterns(execution) {
    const key = `${execution.action.type}_${execution.result.success ? 'success' : 'failure'}`;
    
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        count: 0,
        avgDuration: 0,
        commonOutcomes: new Map(),
      });
    }
    
    const pattern = this.patterns.get(key);
    pattern.count++;
    
    // Update average duration
    pattern.avgDuration = (
      (pattern.avgDuration * (pattern.count - 1) + execution.result.duration) / 
      pattern.count
    );
    
    // Track common outcomes
    const outcome = JSON.stringify(execution.result);
    pattern.commonOutcomes.set(outcome, (pattern.commonOutcomes.get(outcome) || 0) + 1);
  }

  calculateSimilarity(action1, action2) {
    // Simple similarity calculation
    if (action1.type !== action2.type) return 0;
    
    let similarity = 0.5; // Base similarity for same type
    
    // Compare descriptions
    if (action1.description && action2.description) {
      const words1 = action1.description.toLowerCase().split(' ');
      const words2 = action2.description.toLowerCase().split(' ');
      const commonWords = words1.filter(word => words2.includes(word));
      similarity += (commonWords.length / Math.max(words1.length, words2.length)) * 0.3;
    }
    
    return Math.min(similarity, 1.0);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getStats() {
    const total = this.executions.length;
    const successful = this.executions.filter(e => e.result.success).length;
    const failureRate = ((total - successful) / total) * 100;
    
    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failureRate: failureRate,
      patternsLearned: this.patterns.size,
      averageExecutionTime: this.executions.reduce((sum, e) => sum + e.result.duration, 0) / total,
    };
  }
}

module.exports = ExecutionMemory;
