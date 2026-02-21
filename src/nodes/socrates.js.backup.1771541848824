
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
// ║  FILE: socrates.js                                   ║
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
 * 🧠 SOCRATES NODE - The Socratic Questioner
 * ═══════════════════════════════════════════════════════════════
 * Never accepts requests at face value.
 * Questions assumptions, explores alternatives, reveals contradictions.
 * Guides discovery through Socratic dialogue.
 */

class SOCRATESNode {
  constructor() {
    this.name = 'SOCRATES';
    this.codename = 'The Questioner';
    this.role = 'Socratic dialogue orchestrator - questions first, answers second';
    this.questionHistory = [];
    this.userContext = {};
    this.pythia = null; // Will be initialized later
  }

  async initialize() {
    // Initialize PYTHIA for LLM inference
    this.pythia = require('./pythia');
    console.log('[SOCRATES] Initialized - Ready to question everything');
  }

  /**
   * Process any request through Socratic questioning
   */
  async processRequest(userInput, context = {}) {
    console.log(`[SOCRATES] Questioning: "${userInput.substring(0, 100)}..."`);
    
    // Step 1: Understand user intent deeply
    const intent = await this.analyzeIntent(userInput, context);

    // Step 2: Generate Socratic questions
    const questions = await this.generateQuestions(intent);

    // Step 3: If critical gaps exist, ask clarifying questions
    if (this.hasCriticalGaps(intent)) {
      return {
        type: 'clarification_needed',
        questions: questions,
        reasoning: intent.gaps,
        suggestedAnswers: this.suggestAnswers(intent),
        intent: intent,
      };
    }

    // Step 4: Route to appropriate nodes with validated intent
    return this.routeWithContext(intent);
  }

  /**
   * Deep analysis of user intent
   */
  async analyzeIntent(userInput, context) {
    const analysisPrompt = `
You are SOCRATES, the Socratic questioner in Heady Systems.

User request: "${userInput}"

Context:
- Recent history: ${JSON.stringify(context.recentHistory || [])}
- Active project: ${context.activeProject || 'Unknown'}
- User expertise: ${context.userExpertise || 'Unknown'}
- Current session: ${JSON.stringify(context.session || {})}

Analyze this request and identify:
1. Core intent (what they really want to achieve)
2. Assumptions (what they're assuming without stating)
3. Missing information (critical gaps that could lead to failure)
4. Potential contradictions (conflicts with context or best practices)
5. Alternative approaches (better ways to achieve the goal)
6. Hidden requirements (things they haven't considered)

Return JSON with: intent, assumptions, gaps, contradictions, alternatives, hiddenRequirements
`;

    const response = await this.callPYTHIA(analysisPrompt, {
      model: 'llama3.2:8b',
      temperature: 0.3,
      maxTokens: 1500,
    });

    try {
      return JSON.parse(response.text);
    } catch (error) {
      console.warn('[SOCRATES] Failed to parse intent analysis, using fallback');
      return {
        intent: userInput,
        assumptions: [],
        gaps: ['Could not analyze intent properly'],
        contradictions: [],
        alternatives: [],
        hiddenRequirements: [],
      };
    }
  }

  /**
   * Generate Socratic questions based on intent analysis
   */
  async generateQuestions(intent) {
    const questions = [];

    // Question assumptions
    if (intent.assumptions && intent.assumptions.length > 0) {
      questions.push({
        type: 'assumption',
        question: `I notice you're assuming ${intent.assumptions[0]}. Is this accurate, or should we verify this first?`,
        impact: 'high',
        category: 'validation',
      });
    }

    // Question missing information
    if (intent.gaps && intent.gaps.length > 0) {
      questions.push({
        type: 'clarification',
        question: `To proceed effectively, I need to understand: ${intent.gaps[0]}. Can you clarify this?`,
        impact: 'critical',
        category: 'information',
      });
    }

    // Question contradictions
    if (intent.contradictions && intent.contradictions.length > 0) {
      questions.push({
        type: 'contradiction',
        question: `This request seems to conflict with your earlier goal of ${intent.contradictions[0].previous}. How should we reconcile this?`,
        impact: 'medium',
        category: 'consistency',
      });
    }

    // Suggest alternatives
    if (intent.alternatives && intent.alternatives.length > 0) {
      questions.push({
        type: 'alternative',
        question: `Have you considered ${intent.alternatives[0].approach}? It might be more effective because ${intent.alternatives[0].reasoning}.`,
        impact: 'medium',
        category: 'optimization',
      });
    }

    // Question hidden requirements
    if (intent.hiddenRequirements && intent.hiddenRequirements.length > 0) {
      questions.push({
        type: 'requirement',
        question: `Have you considered ${intent.hiddenRequirements[0]}? This could impact the implementation significantly.`,
        impact: 'high',
        category: 'planning',
      });
    }

    // Add follow-up questions for deeper understanding
    questions.push({
      type: 'follow-up',
      question: 'What would success look like for this task? How will you know when we\'ve achieved it?',
      impact: 'medium',
      category: 'definition',
    });

    questions.push({
      type: 'consequence',
      question: 'What are the potential consequences if this doesn\'t work as expected? Do we have a backup plan?',
      impact: 'medium',
      category: 'risk',
    });

    return questions.slice(0, 5); // Limit to 5 questions to avoid overwhelming
  }

  /**
   * Check if there are critical gaps that need clarification
   */
  hasCriticalGaps(intent) {
    return (
      (intent.gaps && intent.gaps.length > 0) ||
      (intent.contradictions && intent.contradictions.length > 0) ||
      (intent.assumptions && intent.assumptions.some(a => a.impact === 'critical'))
    );
  }

  /**
   * Suggest possible answers to help user respond
   */
  suggestAnswers(intent) {
    const suggestions = [];

    if (intent.gaps) {
      intent.gaps.forEach(gap => {
        suggestions.push({
          gap: gap,
          suggestion: `Based on similar requests, you might mean: [provide specific suggestion]`,
          type: 'gap-filling',
        });
      });
    }

    if (intent.assumptions) {
      intent.assumptions.forEach(assumption => {
        suggestions.push({
          assumption: assumption,
          suggestion: `Common approaches for this assumption include: [list options]`,
          type: 'assumption-validation',
        });
      });
    }

    return suggestions;
  }

  /**
   * Route validated intent to appropriate nodes
   */
  async routeWithContext(intent) {
    console.log(`[SOCRATES] Intent validated, routing to nodes: ${this.determineNodes(intent.intent).join(', ')}`);
    
    // Route to appropriate nodes with full context
    const nodesToInvoke = this.determineNodes(intent.intent);
    
    return {
      type: 'execution',
      intent: intent,
      recommendedNodes: nodesToInvoke,
      socraticValidation: 'Intent clarified and validated',
      nextSteps: this.generateNextSteps(intent, nodesToInvoke),
    };
  }

  /**
   * Determine which nodes should handle this request
   */
  determineNodes(intent) {
    const nodeMap = {
      'code': ['JULES', 'MURPHY', 'BUILDER', 'ATLAS'],
      'deploy': ['BUILDER', 'OBSERVER', 'BRIDGE', 'SENTINEL'],
      'documentation': ['ATLAS', 'MUSE', 'PYTHIA'],
      'security': ['MURPHY', 'SENTINEL', 'CIPHER'],
      'research': ['SCOUT', 'SASHA', 'PYTHIA'],
      'optimize': ['JULES', 'OBSERVER', 'LENS'],
      'monitor': ['OBSERVER', 'LENS', 'SENTINEL'],
      'build': ['BUILDER', 'JULES', 'CONDUCTOR'],
      'test': ['MURPHY', 'SENTINEL', 'OBSERVER'],
      'design': ['MUSE', 'SASHA', 'ATLAS'],
      'analyze': ['PYTHIA', 'LENS', 'SASHA'],
    };

    // Classify intent to determine node category
    const category = this.classifyIntent(intent);
    
    return nodeMap[category] || ['CONDUCTOR', 'PYTHIA', 'OBSERVER'];
  }

  /**
   * Classify user intent into categories
   */
  classifyIntent(intent) {
    const text = (intent.intent || '').toLowerCase();
    
    const keywords = {
      'code': ['code', 'function', 'implement', 'debug', 'refactor', 'programming'],
      'deploy': ['deploy', 'deploying', 'deployment', 'production', 'staging'],
      'documentation': ['document', 'docs', 'readme', 'explain', 'manual'],
      'security': ['security', 'secure', 'vulnerability', 'auth', 'encrypt'],
      'research': ['research', 'investigate', 'find', 'search', 'explore'],
      'optimize': ['optimize', 'performance', 'speed', 'efficiency', 'improve'],
      'monitor': ['monitor', 'check', 'status', 'health', 'metrics'],
      'build': ['build', 'compile', 'create', 'make', 'construct'],
      'test': ['test', 'testing', 'validate', 'verify', 'check'],
      'design': ['design', 'architecture', 'structure', 'layout', 'ui'],
      'analyze': ['analyze', 'analysis', 'review', 'examine', 'study'],
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Generate next steps for the user
   */
  generateNextSteps(intent, nodes) {
    return [
      `Executing with ${nodes.length} specialized nodes`,
      'Each node will provide domain-specific analysis',
      'Results will be synthesized for comprehensive response',
      'You can ask follow-up questions at any time',
    ];
  }

  /**
   * Generate follow-up questions after execution
   */
  generateFollowUp(results) {
    return [
      'Does this output match your expectations?',
      'What should we refine or adjust?',
      'Would you like to explore any alternatives?',
      'Are there any aspects you\'d like me to question further?',
      'What consequences should we consider for this approach?',
    ];
  }

  /**
   * Call PYTHIA for LLM inference
   */
  async callPYTHIA(prompt, options = {}) {
    if (!this.pythia) {
      this.pythia = require('./pythia');
    }
    
    try {
      return await this.pythia.generateText(prompt, options);
    } catch (error) {
      console.error('[SOCRATES] PYTHIA call failed:', error.message);
      return { text: 'Unable to process request at this time.' };
    }
  }

  /**
   * Get node status
   */
  getStatus() {
    return {
      name: this.name,
      codename: this.codename,
      role: this.role,
      active: true,
      questionsAsked: this.questionHistory.length,
      pythiaConnected: !!this.pythia,
    };
  }

  /**
   * Execute with full Socratic context
   */
  async execute(intent, context = {}) {
    console.log(`[SOCRATES] Executing with intent: ${intent.intent || intent}`);
    
    // Add to question history
    this.questionHistory.push({
      timestamp: new Date().toISOString(),
      intent: intent,
      context: context,
    });

    // Keep history manageable
    if (this.questionHistory.length > 100) {
      this.questionHistory = this.questionHistory.slice(-50);
    }

    return {
      node: this.name,
      action: 'socratic_analysis',
      result: `Analyzed request through Socratic method`,
      recommendations: this.generateRecommendations(intent),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate recommendations based on Socratic analysis
   */
  generateRecommendations(intent) {
    const recommendations = [];

    if (intent.gaps && intent.gaps.length > 0) {
      recommendations.push('Address critical information gaps before proceeding');
    }

    if (intent.contradictions && intent.contradictions.length > 0) {
      recommendations.push('Resolve contradictions between current and previous goals');
    }

    if (intent.assumptions && intent.assumptions.length > 2) {
      recommendations.push('Consider validating key assumptions with stakeholders');
    }

    recommendations.push('Document decisions and reasoning for future reference');
    recommendations.push('Plan for contingencies and alternative approaches');

    return recommendations;
  }
}

module.exports = SOCRATESNode;
