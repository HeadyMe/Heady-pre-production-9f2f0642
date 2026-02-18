#!/usr/bin/env node
/**
 * 🧠 EXECUTION MEMORY: Stores and learns from all dual-engine executions
 * Provides historical data for strategy improvement
 */

class ExecutionMemory {
  constructor() {
    this.executions = [];
    this.patterns = new Map();
    this.maxHistory = 1000; // Keep last 1000 executions
  }

  async record(execution) {
    const record = {
      id: this.generateId(),
      timestamp: execution.timestamp,
      action: execution.action,
      socraticAnalysis: execution.socraticAnalysis,
      monteCarloStrategy: execution.monteCarloStrategy,
      result: execution.result,
      success: execution.result.success,
      duration: execution.result.duration,
      confidence: execution.monteCarloStrategy.confidence,
      socraticScore: execution.socraticAnalysis.validityScore,
    };

    // Add to history
    this.executions.unshift(record);
    
    // Maintain history size
    if (this.executions.length > this.maxHistory) {
      this.executions = this.executions.slice(0, this.maxHistory);
    }

    // Update patterns
    this.updatePatterns(record);

    console.log(`📝 Execution recorded: ${record.id} - Success: ${record.success}`);
  }

  async getSimilar(action, limit = 5) {
    const actionType = action.type;
    const actionDesc = action.description || '';

    // Find similar past executions
    const similar = this.executions
      .filter(exec => exec.action.type === actionType)
      .filter(exec => {
        // Simple similarity check - could be enhanced with embeddings
        const descSimilarity = this.calculateSimilarity(actionDesc, exec.action.description || '');
        return descSimilarity > 0.5;
      })
      .slice(0, limit);

    return similar.map(exec => ({
      action: exec.action,
      strategy: exec.monteCarloStrategy.bestStrategy,
      success: exec.success,
      confidence: exec.confidence,
      duration: exec.duration,
      learnings: this.extractLearnings(exec),
    }));
  }

  async getBestStrategies(actionType, limit = 3) {
    const executions = this.executions
      .filter(exec => exec.action.type === actionType && exec.success)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);

    return executions.map(exec => exec.monteCarloStrategy.bestStrategy);
  }

  async getFailurePatterns(actionType) {
    const failures = this.executions
      .filter(exec => exec.action.type === actionType && !exec.success);

    const patterns = failures.reduce((acc, failure) => {
      // Group by failure type
      const failureType = failure.result.error || 'unknown';
      if (!acc[failureType]) {
        acc[failureType] = {
          count: 0,
          examples: [],
          commonStrategies: new Map(),
        };
      }
      
      acc[failureType].count++;
      acc[failureType].examples.push(failure);
      
      // Track strategies that failed
      const strategyName = failure.monteCarloStrategy.bestStrategy.name;
      acc[failureType].commonStrategies.set(
        strategyName,
        (acc[failureType].commonStrategies.get(strategyName) || 0) + 1
      );
      
      return acc;
    }, {});

    return Object.entries(patterns).map(([type, data]) => ({
      failureType: type,
      frequency: data.count,
      examples: data.examples.slice(0, 3), // Top 3 examples
      problematicStrategies: Array.from(data.commonStrategies.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    }));
  }

  async getSuccessMetrics(actionType) {
    const executions = this.executions.filter(exec => exec.action.type === actionType);
    
    if (executions.length === 0) return null;

    const successCount = executions.filter(exec => exec.success).length;
    const avgConfidence = executions.reduce((sum, exec) => sum + exec.confidence, 0) / executions.length;
    const avgSocraticScore = executions.reduce((sum, exec) => sum + exec.socraticScore, 0) / executions.length;
    const avgDuration = executions.reduce((sum, exec) => sum + exec.duration, 0) / executions.length;

    return {
      totalExecutions: executions.length,
      successRate: successCount / executions.length,
      averageConfidence: avgConfidence,
      averageSocraticScore: avgSocraticScore,
      averageDuration: avgDuration,
      trend: this.calculateTrend(executions),
    };
  }

  updatePatterns(record) {
    const actionType = record.action.type;
    
    if (!this.patterns.has(actionType)) {
      this.patterns.set(actionType, {
        totalExecutions: 0,
        successCount: 0,
        totalConfidence: 0,
        totalDuration: 0,
        strategies: new Map(),
        commonFailures: new Map(),
      });
    }

    const pattern = this.patterns.get(actionType);
    
    pattern.totalExecutions++;
    if (record.success) pattern.successCount++;
    pattern.totalConfidence += record.confidence;
    pattern.totalDuration += record.duration;

    // Track strategy performance
    const strategyName = record.monteCarloStrategy.bestStrategy.name;
    if (!pattern.strategies.has(strategyName)) {
      pattern.strategies.set(strategyName, { used: 0, succeeded: 0 });
    }
    const strategyData = pattern.strategies.get(strategyName);
    strategyData.used++;
    if (record.success) strategyData.succeeded++;

    // Track failures
    if (!record.success) {
      const failureType = record.result.error || 'unknown';
      pattern.commonFailures.set(
        failureType,
        (pattern.commonFailures.get(failureType) || 0) + 1
      );
    }
  }

  calculateSimilarity(text1, text2) {
    // Simple similarity calculation - could be enhanced with embeddings
    const words1 = text1.toLowerCase().split(' ');
    const words2 = text2.toLowerCase().split(' ');
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  calculateTrend(executions) {
    if (executions.length < 10) return 'insufficient_data';

    const recent = executions.slice(0, 5);
    const older = executions.slice(-5);

    const recentSuccessRate = recent.filter(exec => exec.success).length / recent.length;
    const olderSuccessRate = older.filter(exec => exec.success).length / older.length;

    if (recentSuccessRate > olderSuccessRate + 0.1) return 'improving';
    if (recentSuccessRate < olderSuccessRate - 0.1) return 'declining';
    return 'stable';
  }

  extractLearnings(execution) {
    const learnings = [];

    if (execution.success) {
      learnings.push({
        type: 'success_pattern',
        description: `Strategy "${execution.monteCarloStrategy.bestStrategy.name}" worked well`,
        confidence: execution.confidence,
        socraticScore: execution.socraticScore,
      });
    } else {
      learnings.push({
        type: 'failure_pattern',
        description: execution.result.error,
        strategy: execution.monteCarloStrategy.bestStrategy.name,
        prevention: 'Consider alternative strategies or prerequisites',
      });
    }

    return learnings;
  }

  generateId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics methods
  async getOverallMetrics() {
    const totalExecutions = this.executions.length;
    const successCount = this.executions.filter(exec => exec.success).length;
    
    return {
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? successCount / totalExecutions : 0,
      averageConfidence: totalExecutions > 0 
        ? this.executions.reduce((sum, exec) => sum + exec.confidence, 0) / totalExecutions 
        : 0,
      averageSocraticScore: totalExecutions > 0
        ? this.executions.reduce((sum, exec) => sum + exec.socraticScore, 0) / totalExecutions
        : 0,
      patternCount: this.patterns.size,
      mostCommonActionType: this.getMostCommonActionType(),
    };
  }

  getMostCommonActionType() {
    const counts = {};
    this.executions.forEach(exec => {
      counts[exec.action.type] = (counts[exec.action.type] || 0) + 1;
    });
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  }
}

module.exports = ExecutionMemory;
