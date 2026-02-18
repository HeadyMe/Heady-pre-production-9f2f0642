// ═══════════════════════════════════════════════════════════════
// 🧠 HEADY ATTENTION TRACKER
// ═══════════════════════════════════════════════════════════════
// User-Object-Attention Level (UOAL) tracking for proactive resource management

import { EventEmitter } from 'events';

export interface UserInteraction {
  userId: string;
  component: string;
  interactionType: 'click' | 'focus' | 'request' | 'scroll' | 'hover';
  timestamp: Date;
  metadata?: {
    duration?: number;
    intensity?: number;
    context?: string;
  };
}

export interface AttentionPattern {
  userId: string;
  componentSequence: string[];
  attentionLevels: number[];
  timestamps: Date[];
  contextTransitions: ContextTransition[];
}

export interface ContextTransition {
  fromComponent: string;
  toComponent: string;
  transitionTime: number;
  frequency: number;
  confidence: number;
}

export interface AttentionPrediction {
  nextComponent: string;
  confidence: number;
  estimatedTime: number; // milliseconds until shift
  attentionLevel: number;
  suggestedPriority: number;
}

export interface AttentionMetrics {
  currentComponent: string;
  attentionLevel: number;
  focusDuration: number;
  interactionFrequency: number;
  contextSwitches: number;
  predictedNextComponent?: string;
  predictionConfidence: number;
}

export class AttentionTracker extends EventEmitter {
  private userPatterns: Map<string, AttentionPattern> = new Map();
  private currentAttention: Map<string, UserInteraction> = new Map();
  private interactionHistory: Map<string, UserInteraction[]> = new Map();
  private predictionModels: Map<string, PredictionModel> = new Map();
  
  private readonly PREDICTION_WINDOW = 300000; // 5 minutes
  private readonly HISTORY_LIMIT = 1000;
  private readonly MIN_PATTERN_LENGTH = 5;
  private readonly PREDICTION_CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    super();
    this.initializePredictionModels();
    this.startPatternAnalysis();
  }

  /**
   * Track user interaction for attention analysis
   */
  async trackInteraction(interaction: UserInteraction): Promise<void> {
    // Record interaction
    this.recordInteraction(interaction);
    
    // Update current attention state
    this.updateCurrentAttention(interaction);
    
    // Analyze pattern changes
    await this.analyzePattern(interaction.userId);
    
    // Generate prediction
    const prediction = await this.predictAttentionShift(interaction.userId);
    
    // Emit events for resource manager
    this.emit('attentionUpdate', {
      userId: interaction.userId,
      currentComponent: interaction.component,
      attentionLevel: this.calculateAttentionLevel(interaction),
      prediction
    });
    
    // Emit prediction if confidence is high
    if (prediction.confidence > this.PREDICTION_CONFIDENCE_THRESHOLD) {
      this.emit('attentionPrediction', {
        userId: interaction.userId,
        prediction
      });
    }
  }

  /**
   * Get current attention metrics for a user
   */
  getAttentionMetrics(userId: string): AttentionMetrics {
    const current = this.currentAttention.get(userId);
    const pattern = this.userPatterns.get(userId);
    const history = this.interactionHistory.get(userId) || [];
    
    if (!current) {
      return {
        currentComponent: 'none',
        attentionLevel: 0,
        focusDuration: 0,
        interactionFrequency: 0,
        contextSwitches: 0,
        predictionConfidence: 0
      };
    }

    const recentInteractions = history.filter(i => 
      Date.now() - i.timestamp.getTime() < 60000 // Last minute
    );

    const prediction = pattern ? this.predictNextComponent(pattern) : null;

    return {
      currentComponent: current.component,
      attentionLevel: this.calculateAttentionLevel(current),
      focusDuration: this.calculateFocusDuration(userId),
      interactionFrequency: recentInteractions.length,
      contextSwitches: this.countContextSwitches(userId),
      predictedNextComponent: prediction?.nextComponent,
      predictionConfidence: prediction?.confidence || 0
    };
  }

  /**
   * Predict attention shift for proactive resource allocation
   */
  async predictAttentionShift(userId: string): Promise<AttentionPrediction> {
    const pattern = this.userPatterns.get(userId);
    if (!pattern || pattern.componentSequence.length < this.MIN_PATTERN_LENGTH) {
      return {
        nextComponent: 'unknown',
        confidence: 0,
        estimatedTime: 0,
        attentionLevel: 0,
        suggestedPriority: 80
      };
    }

    const prediction = this.predictNextComponent(pattern);
    const model = this.predictionModels.get(userId);
    
    if (model && prediction) {
      // Use trained model for better prediction
      const modelPrediction = await model.predict(pattern);
      
      return {
        nextComponent: modelPrediction.nextComponent || prediction.nextComponent,
        confidence: Math.max(modelPrediction.confidence, prediction.confidence),
        estimatedTime: modelPrediction.estimatedTime || this.estimateTransitionTime(pattern),
        attentionLevel: this.predictAttentionLevel(prediction.nextComponent, pattern),
        suggestedPriority: this.calculateSuggestedPriority(prediction.nextComponent, modelPrediction.confidence)
      };
    }

    return {
      nextComponent: prediction.nextComponent,
      confidence: prediction.confidence,
      estimatedTime: this.estimateTransitionTime(pattern),
      attentionLevel: this.predictAttentionLevel(prediction.nextComponent, pattern),
      suggestedPriority: this.calculateSuggestedPriority(prediction.nextComponent, prediction.confidence)
    };
  }

  /**
   * Train prediction model for a user
   */
  async trainPredictionModel(userId: string): Promise<void> {
    const pattern = this.userPatterns.get(userId);
    if (!pattern || pattern.componentSequence.length < 20) {
      return; // Not enough data for training
    }

    const model = new PredictionModel();
    await model.train(pattern);
    this.predictionModels.set(userId, model);
    
    this.emit('modelTrained', { userId, accuracy: model.getAccuracy() });
  }

  /**
   * Record user interaction
   */
  private recordInteraction(interaction: UserInteraction): void {
    if (!this.interactionHistory.has(interaction.userId)) {
      this.interactionHistory.set(interaction.userId, []);
    }

    const history = this.interactionHistory.get(interaction.userId)!;
    history.push(interaction);

    // Limit history size
    if (history.length > this.HISTORY_LIMIT) {
      history.shift();
    }
  }

  /**
   * Update current attention state
   */
  private updateCurrentAttention(interaction: UserInteraction): void {
    this.currentAttention.set(interaction.userId, interaction);
  }

  /**
   * Analyze user attention patterns
   */
  private async analyzePattern(userId: string): Promise<void> {
    const history = this.interactionHistory.get(userId);
    if (!history || history.length < this.MIN_PATTERN_LENGTH) {
      return;
    }

    // Extract recent pattern
    const recentHistory = history.filter(i => 
      Date.now() - i.timestamp.getTime() < this.PREDICTION_WINDOW
    );

    const pattern: AttentionPattern = {
      userId,
      componentSequence: recentHistory.map(i => i.component),
      attentionLevels: recentHistory.map(i => this.calculateAttentionLevel(i)),
      timestamps: recentHistory.map(i => i.timestamp),
      contextTransitions: this.extractContextTransitions(recentHistory)
    };

    this.userPatterns.set(userId, pattern);

    // Trigger model training if enough data
    if (history.length >= 20 && history.length % 10 === 0) {
      await this.trainPredictionModel(userId);
    }
  }

  /**
   * Extract context transitions from interaction history
   */
  private extractContextTransitions(history: UserInteraction[]): ContextTransition[] {
    const transitions: ContextTransition[] = [];
    const transitionMap = new Map<string, ContextTransition>();

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      
      if (current.component !== next.component) {
        const key = `${current.component}->${next.component}`;
        
        if (!transitionMap.has(key)) {
          transitionMap.set(key, {
            fromComponent: current.component,
            toComponent: next.component,
            transitionTime: next.timestamp.getTime() - current.timestamp.getTime(),
            frequency: 1,
            confidence: 0
          });
        } else {
          const transition = transitionMap.get(key)!;
          transition.frequency++;
          transition.transitionTime = (transition.transitionTime + (next.timestamp.getTime() - current.timestamp.getTime())) / 2;
        }
      }
    }

    // Calculate confidence based on frequency and consistency
    for (const transition of transitionMap.values()) {
      transition.confidence = Math.min(transition.frequency / 10, 1.0);
      transitions.push(transition);
    }

    return transitions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Predict next component based on pattern
   */
  private predictNextComponent(pattern: AttentionPattern): { nextComponent: string; confidence: number } | null {
    if (pattern.componentSequence.length < 2) {
      return null;
    }

    const currentComponent = pattern.componentSequence[pattern.componentSequence.length - 1];
    const relevantTransitions = pattern.contextTransitions.filter(t => t.fromComponent === currentComponent);

    if (relevantTransitions.length === 0) {
      return null;
    }

    // Find most likely transition
    const bestTransition = relevantTransitions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      nextComponent: bestTransition.toComponent,
      confidence: bestTransition.confidence
    };
  }

  /**
   * Estimate time until next attention shift
   */
  private estimateTransitionTime(pattern: AttentionPattern): number {
    const currentComponent = pattern.componentSequence[pattern.componentSequence.length - 1];
    const relevantTransitions = pattern.contextTransitions.filter(t => t.fromComponent === currentComponent);

    if (relevantTransitions.length === 0) {
      return 30000; // Default 30 seconds
    }

    // Return average transition time
    const totalTime = relevantTransitions.reduce((sum, t) => sum + t.transitionTime, 0);
    return totalTime / relevantTransitions.length;
  }

  /**
   * Predict attention level for next component
   */
  private predictAttentionLevel(component: string, pattern: AttentionPattern): number {
    const componentHistory = pattern.componentSequence
      .map((c, i) => ({ component: c, level: pattern.attentionLevels[i] }))
      .filter(ch => ch.component === component);

    if (componentHistory.length === 0) {
      return 0.8; // Default attention level
    }

    // Return average attention level for this component
    const totalLevel = componentHistory.reduce((sum, ch) => sum + ch.level, 0);
    return totalLevel / componentHistory.length;
  }

  /**
   * Calculate suggested priority based on component and confidence
   */
  private calculateSuggestedPriority(component: string, confidence: number): number {
    const userFacingComponents = ['heady-buddy', 'heady-web', 'heady-conductor'];
    const learningComponents = ['heady-vinci', 'heady-soul'];
    
    let basePriority = 80; // Medium priority
    
    if (userFacingComponents.includes(component)) {
      basePriority = 125; // High priority for user-facing
    } else if (learningComponents.includes(component)) {
      basePriority = 65; // Medium-low for background learning
    }

    // Adjust based on prediction confidence
    return Math.min(150, basePriority + (confidence * 25));
  }

  /**
   * Calculate attention level for interaction
   */
  private calculateAttentionLevel(interaction: UserInteraction): number {
    let baseLevel = 0.5;

    switch (interaction.interactionType) {
      case 'click':
        baseLevel = 1.0;
        break;
      case 'request':
        baseLevel = 0.9;
        break;
      case 'focus':
        baseLevel = 0.8;
        break;
      case 'hover':
        baseLevel = 0.6;
        break;
      case 'scroll':
        baseLevel = 0.4;
        break;
    }

    // Adjust for duration and intensity if available
    if (interaction.metadata) {
      if (interaction.metadata.duration && interaction.metadata.duration > 5000) {
        baseLevel += 0.1; // Longer duration = higher attention
      }
      if (interaction.metadata.intensity) {
        baseLevel *= interaction.metadata.intensity;
      }
    }

    return Math.min(1.0, baseLevel);
  }

  /**
   * Calculate focus duration for current component
   */
  private calculateFocusDuration(userId: string): number {
    const current = this.currentAttention.get(userId);
    if (!current) return 0;

    return Date.now() - current.timestamp.getTime();
  }

  /**
   * Count context switches in recent history
   */
  private countContextSwitches(userId: string): number {
    const history = this.interactionHistory.get(userId) || [];
    const recentHistory = history.filter(i => 
      Date.now() - i.timestamp.getTime() < this.PREDICTION_WINDOW
    );

    let switches = 0;
    for (let i = 1; i < recentHistory.length; i++) {
      if (recentHistory[i].component !== recentHistory[i - 1].component) {
        switches++;
      }
    }

    return switches;
  }

  /**
   * Initialize prediction models
   */
  private initializePredictionModels(): void {
    // Models will be created on-demand for each user
  }

  /**
   * Start pattern analysis loop
   */
  private startPatternAnalysis(): void {
    setInterval(() => {
      // Analyze patterns for all active users
      for (const userId of this.currentAttention.keys()) {
        this.analyzePattern(userId);
      }
    }, 10000); // Analyze every 10 seconds
  }

  /**
   * Get attention statistics for system optimization
   */
  getAttentionStatistics(): {
    totalUsers: number;
    activeUsers: number;
    averageAttentionLevel: number;
    mostFocusedComponents: Array<{ component: string; attentionTime: number }>;
    predictionAccuracy: number;
  } {
    const totalUsers = this.userPatterns.size;
    const activeUsers = this.currentAttention.size;
    
    let totalAttention = 0;
    let attentionCount = 0;
    const componentAttention = new Map<string, number>();

    for (const pattern of this.userPatterns.values()) {
      for (let i = 0; i < pattern.attentionLevels.length; i++) {
        totalAttention += pattern.attentionLevels[i];
        attentionCount++;
        
        const component = pattern.componentSequence[i];
        const currentAttention = componentAttention.get(component) || 0;
        componentAttention.set(component, currentAttention + pattern.attentionLevels[i]);
      }
    }

    const averageAttentionLevel = attentionCount > 0 ? totalAttention / attentionCount : 0;
    
    const mostFocusedComponents = Array.from(componentAttention.entries())
      .map(([component, attention]) => ({ component, attentionTime: attention }))
      .sort((a, b) => b.attentionTime - a.attentionTime)
      .slice(0, 10);

    const predictionAccuracy = this.calculatePredictionAccuracy();

    return {
      totalUsers,
      activeUsers,
      averageAttentionLevel,
      mostFocusedComponents,
      predictionAccuracy
    };
  }

  /**
   * Calculate prediction accuracy across all models
   */
  private calculatePredictionAccuracy(): number {
    if (this.predictionModels.size === 0) return 0;

    let totalAccuracy = 0;
    for (const model of this.predictionModels.values()) {
      totalAccuracy += model.getAccuracy();
    }

    return totalAccuracy / this.predictionModels.size;
  }
}

/**
 * Simple prediction model for attention patterns
 */
class PredictionModel {
  private accuracy: number = 0;
  private transitionProbabilities: Map<string, Map<string, number>> = new Map();
  private transitionTimes: Map<string, number> = new Map();

  async train(pattern: AttentionPattern): Promise<void> {
    // Build transition probability matrix
    for (let i = 0; i < pattern.componentSequence.length - 1; i++) {
      const from = pattern.componentSequence[i];
      const to = pattern.componentSequence[i + 1];
      
      if (!this.transitionProbabilities.has(from)) {
        this.transitionProbabilities.set(from, new Map());
      }
      
      const fromMap = this.transitionProbabilities.get(from)!;
      const currentCount = fromMap.get(to) || 0;
      fromMap.set(to, currentCount + 1);
      
      // Record transition time
      const transitionKey = `${from}->${to}`;
      const transitionTime = pattern.timestamps[i + 1].getTime() - pattern.timestamps[i].getTime();
      const currentTime = this.transitionTimes.get(transitionKey) || 0;
      this.transitionTimes.set(transitionKey, (currentTime + transitionTime) / 2);
    }

    // Normalize probabilities
    for (const [from, toMap] of this.transitionProbabilities) {
      const total = Array.from(toMap.values()).reduce((sum, count) => sum + count, 0);
      for (const [to, count] of toMap) {
        toMap.set(to, count / total);
      }
    }

    // Calculate accuracy (simplified)
    this.accuracy = Math.min(0.95, 0.7 + (pattern.componentSequence.length / 100));
  }

  async predict(pattern: AttentionPattern): Promise<AttentionPrediction> {
    const currentComponent = pattern.componentSequence[pattern.componentSequence.length - 1];
    const transitions = this.transitionProbabilities.get(currentComponent);

    if (!transitions || transitions.size === 0) {
      return {
        nextComponent: 'unknown',
        confidence: 0,
        estimatedTime: 30000,
        attentionLevel: 0.8,
        suggestedPriority: 80
      };
    }

    // Find most likely next component
    let bestNext = '';
    let bestProbability = 0;
    
    for (const [next, probability] of transitions) {
      if (probability > bestProbability) {
        bestNext = next;
        bestProbability = probability;
      }
    }

    const transitionKey = `${currentComponent}->${bestNext}`;
    const estimatedTime = this.transitionTimes.get(transitionKey) || 30000;

    return {
      nextComponent: bestNext,
      confidence: bestProbability,
      estimatedTime,
      attentionLevel: 0.8,
      suggestedPriority: 80
    };
  }

  getAccuracy(): number {
    return this.accuracy;
  }
}
