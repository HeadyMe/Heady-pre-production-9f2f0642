/**
 * ═══════════════════════════════════════════════════════════════
 * 🔗 ALL-NODE ORCHESTRATOR - Complete AI Collaboration
 * ═══════════════════════════════════════════════════════════════
 * Coordinates all 20+ AI nodes for comprehensive processing
 * Socratic questioning → Multi-LLM consensus → All-node execution
 */

class AllNodeOrchestrator {
  constructor() {
    this.nodes = {};
    this.executionHistory = [];
    this.collaborationMetrics = {
      totalExecutions: 0,
      nodeUsage: {},
      averageCollaborationScore: 0,
    };
  }

  async initialize() {
    console.log('[AllNodeOrchestrator] Initializing all AI nodes...');
    
    // Load all available nodes
    await this.loadAllNodes();
    
    // Initialize each node
    for (const [name, node] of Object.entries(this.nodes)) {
      if (node.initialize) {
        await node.initialize();
        console.log(`[AllNodeOrchestrator] Initialized ${name}`);
      }
    }
    
    console.log(`[AllNodeOrchestrator] Ready with ${Object.keys(this.nodes).length} nodes`);
  }

  /**
   * Load all available AI nodes
   */
  async loadAllNodes() {
    const nodeModules = [
      // Core orchestration nodes
      { name: 'SOCRATES', path: '../nodes/socrates' },
      { name: 'CONDUCTOR', path: '../nodes/conductor' },
      { name: 'PYTHIA', path: '../nodes/pythia' },
      
      // Specialized AI nodes
      { name: 'JULES', path: '../nodes/jules' },
      { name: 'MURPHY', path: '../nodes/murphy' },
      { name: 'SASHA', path: '../nodes/sasha' },
      { name: 'MUSE', path: '../nodes/muse' },
      { name: 'ATLAS', path: '../nodes/atlas' },
      { name: 'OBSERVER', path: '../nodes/observer' },
      { name: 'BUILDER', path: '../nodes/builder' },
      { name: 'SENTINEL', path: '../nodes/sentinel' },
      { name: 'SCOUT', path: '../nodes/scout' },
      { name: 'CIPHER', path: '../nodes/cipher' },
      { name: 'SOPHIA', path: '../nodes/sophia' },
      { name: 'JANITOR', path: '../nodes/janitor' },
      { name: 'BRIDGE', path: '../nodes/bridge' },
      { name: 'NOVA', path: '../nodes/nova' },
      { name: 'OCULUS', path: '../nodes/oculus' },
      { name: 'LENS', path: '../nodes/lens' },
      { name: 'MEMORY', path: '../nodes/memory' },
      { name: 'BRAIN', path: '../nodes/brain' },
    ];

    for (const nodeConfig of nodeModules) {
      try {
        const NodeClass = require(nodeConfig.path);
        this.nodes[nodeConfig.name] = new NodeClass();
      } catch (error) {
        console.warn(`[AllNodeOrchestrator] Failed to load ${nodeConfig.name}:`, error.message);
      }
    }
  }

  /**
   * Main processing pipeline with all nodes
   */
  async processWithAllNodes(userRequest, options = {}) {
    const startTime = Date.now();
    this.collaborationMetrics.totalExecutions++;
    
    console.log(`[AllNodeOrchestrator] Processing: "${userRequest.substring(0, 100)}..."`);
    
    try {
      // Phase 1: SOCRATES questions the request
      const socraticAnalysis = await this.executeNode('SOCRATES', 'processRequest', [
        userRequest, 
        options.context || {}
      ]);

      // If clarification needed, return questions to user
      if (socraticAnalysis.type === 'clarification_needed') {
        return {
          stage: 'clarification',
          socraticAnalysis: socraticAnalysis,
          nextAction: 'awaiting_user_response',
        };
      }

      // Phase 2: CONDUCTOR routes to multi-LLM consensus
      const llmConsensus = await this.executeNode('CONDUCTOR', 'orchestrate', [
        socraticAnalysis.intent.intent || userRequest,
        {
          strategy: options.llmStrategy || 'consensus',
          providers: options.providers || ['auto'],
          temperature: 0.7,
          maxTokens: 2000,
        }
      ]);

      // Phase 3: Invoke all relevant nodes in parallel
      const nodeInvocations = await this.invokeRelevantNodes(
        socraticAnalysis.intent,
        llmConsensus,
        options
      );

      // Phase 4: OBSERVER monitors execution
      await this.executeNode('OBSERVER', 'logExecution', [{
        request: userRequest,
        socraticAnalysis: socraticAnalysis,
        llmConsensus: llmConsensus,
        nodeResults: nodeInvocations,
        timestamp: new Date().toISOString(),
      }]);

      // Phase 5: ATLAS documents the workflow
      await this.executeNode('ATLAS', 'documentWorkflow', [{
        title: `Workflow: ${userRequest.substring(0, 50)}`,
        steps: this.extractSteps(nodeInvocations),
        outcome: nodeInvocations.summary,
        participants: nodeInvocations.invoked,
        executionTime: Date.now() - startTime,
      }]);

      // Phase 6: Synthesize final response
      const synthesis = await this.synthesizeResults({
        originalRequest: userRequest,
        socraticAnalysis: socraticAnalysis,
        llmConsensus: llmConsensus,
        nodeResults: nodeInvocations,
      });

      // Update metrics
      this.updateCollaborationMetrics(nodeInvocations.invoked);

      return {
        stage: 'complete',
        original_request: userRequest,
        socratic_analysis: socraticAnalysis,
        llm_consensus: llmConsensus,
        node_results: nodeInvocations,
        synthesis: synthesis,
        execution_time: Date.now() - startTime,
        follow_up_questions: this.generateFollowUp(nodeInvocations),
        collaboration_score: this.calculateCollaborationScore(nodeInvocations),
      };

    } catch (error) {
      console.error('[AllNodeOrchestrator] Processing failed:', error.message);
      
      // Log error with OBSERVER
      await this.executeNode('OBSERVER', 'logError', [{
        error: error.message,
        request: userRequest,
        timestamp: new Date().toISOString(),
      }]);

      return {
        stage: 'error',
        error: error.message,
        original_request: userRequest,
        recovery_suggestions: this.generateRecoverySuggestions(error),
      };
    }
  }

  /**
   * Execute a specific node with error handling
   */
  async executeNode(nodeName, method, args = []) {
    const node = this.nodes[nodeName];
    if (!node) {
      console.warn(`[AllNodeOrchestrator] Node ${nodeName} not available`);
      return { error: `Node ${nodeName} not available` };
    }

    try {
      const startTime = Date.now();
      const result = await node[method](...args);
      const executionTime = Date.now() - startTime;
      
      // Update node usage metrics
      this.collaborationMetrics.nodeUsage[nodeName] = 
        (this.collaborationMetrics.nodeUsage[nodeName] || 0) + 1;
      
      console.log(`[AllNodeOrchestrator] ${nodeName}.${method} completed in ${executionTime}ms`);
      
      return {
        node: nodeName,
        method: method,
        result: result,
        executionTime: executionTime,
        success: true,
      };
    } catch (error) {
      console.error(`[AllNodeOrchestrator] ${nodeName}.${method} failed:`, error.message);
      return {
        node: nodeName,
        method: method,
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Determine and invoke relevant nodes
   */
  async invokeRelevantNodes(intent, llmConsensus, options = {}) {
    const nodesToInvoke = this.determineNodes(intent);
    
    console.log(`[AllNodeOrchestrator] Invoking ${nodesToInvoke.length} nodes: ${nodesToInvoke.join(', ')}`);
    
    // Execute nodes in parallel where possible
    const nodePromises = nodesToInvoke.map(async (nodeName) => {
      return this.executeNode(nodeName, 'execute', [intent, llmConsensus]);
    });

    const results = await Promise.all(nodePromises);
    
    // Filter successful executions
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    return {
      invoked: nodesToInvoke,
      results: successfulResults,
      failed: failedResults,
      summary: this.synthesizeNodeResults(successfulResults),
      success_rate: (successfulResults.length / results.length) * 100,
    };
  }

  /**
   * Determine which nodes should handle this request
   */
  determineNodes(intent) {
    const category = this.classifyIntent(intent);
    const userPreferences = intent.userPreferences || {};
    
    const nodeMap = {
      'code': ['JULES', 'MURPHY', 'BUILDER', 'ATLAS', 'PYTHIA'],
      'deploy': ['BUILDER', 'OBSERVER', 'BRIDGE', 'SENTINEL', 'CONDUCTOR'],
      'documentation': ['ATLAS', 'MUSE', 'PYTHIA', 'SASHA'],
      'security': ['MURPHY', 'SENTINEL', 'CIPHER', 'OBSERVER'],
      'research': ['SCOUT', 'SASHA', 'PYTHIA', 'LENS'],
      'optimize': ['JULES', 'OBSERVER', 'LENS', 'MEMORY'],
      'monitor': ['OBSERVER', 'LENS', 'SENTINEL', 'MEMORY'],
      'build': ['BUILDER', 'JULES', 'CONDUCTOR', 'ATLAS'],
      'test': ['MURPHY', 'SENTINEL', 'OBSERVER', 'JULES'],
      'design': ['MUSE', 'SASHA', 'ATLAS', 'OCULUS'],
      'analyze': ['PYTHIA', 'LENS', 'SASHA', 'MEMORY'],
      'creative': ['MUSE', 'SASHA', 'PYTHIA', 'NOVA'],
      'cleanup': ['JANITOR', 'MEMORY', 'OBSERVER'],
      'integrate': ['BRIDGE', 'BUILDER', 'CONDUCTOR'],
      'learn': ['SOPHIA', 'MEMORY', 'PYTHIA', 'BRAIN'],
    };

    // Get base nodes for category
    let baseNodes = nodeMap[category] || ['CONDUCTOR', 'PYTHIA', 'OBSERVER'];
    
    // Always include core orchestration nodes
    const coreNodes = ['SOCRATES', 'CONDUCTOR', 'PYTHIA', 'OBSERVER'];
    baseNodes = [...new Set([...coreNodes, ...baseNodes])];
    
    // Filter to available nodes
    const availableNodes = baseNodes.filter(name => this.nodes[name]);
    
    // Add user-preferred nodes if available
    if (userPreferences.preferredNodes) {
      userPreferences.preferredNodes.forEach(nodeName => {
        if (this.nodes[nodeName] && !availableNodes.includes(nodeName)) {
          availableNodes.push(nodeName);
        }
      });
    }
    
    return availableNodes;
  }

  /**
   * Classify intent for node routing
   */
  classifyIntent(intent) {
    const text = (intent.intent || '').toLowerCase();
    
    const keywords = {
      'code': ['code', 'function', 'implement', 'debug', 'refactor', 'programming'],
      'deploy': ['deploy', 'deploying', 'deployment', 'production', 'staging'],
      'documentation': ['document', 'docs', 'readme', 'explain', 'manual', 'write'],
      'security': ['security', 'secure', 'vulnerability', 'auth', 'encrypt', 'protect'],
      'research': ['research', 'investigate', 'find', 'search', 'explore', 'discover'],
      'optimize': ['optimize', 'performance', 'speed', 'efficiency', 'improve', 'fast'],
      'monitor': ['monitor', 'check', 'status', 'health', 'metrics', 'observe'],
      'build': ['build', 'compile', 'create', 'make', 'construct', 'assemble'],
      'test': ['test', 'testing', 'validate', 'verify', 'check', 'quality'],
      'design': ['design', 'architecture', 'structure', 'layout', 'ui', 'interface'],
      'analyze': ['analyze', 'analysis', 'review', 'examine', 'study', 'understand'],
      'creative': ['creative', 'brainstorm', 'imagine', 'innovate', 'design', 'artistic'],
      'cleanup': ['cleanup', 'clean', 'organize', 'remove', 'delete', 'archive'],
      'integrate': ['integrate', 'connect', 'bridge', 'link', 'combine', 'merge'],
      'learn': ['learn', 'study', 'understand', 'master', 'improve', 'adapt'],
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Synthesize results from all nodes
   */
  synthesizeNodeResults(results) {
    if (results.length === 0) {
      return 'No nodes executed successfully';
    }
    
    if (results.length === 1) {
      return `Executed ${results[0].node}: ${this.summarizeNodeResult(results[0].result)}`;
    }
    
    const summary = results.map(r => 
      `${r.node}: ${this.summarizeNodeResult(r.result)}`
    ).join('; ');
    
    return `Executed ${results.length} nodes successfully: ${summary}`;
  }

  /**
   * Summarize individual node result
   */
  summarizeNodeResult(result) {
    if (typeof result === 'string') {
      return result.substring(0, 100);
    }
    
    if (result && result.action) {
      return result.action;
    }
    
    if (result && result.text) {
      return result.text.substring(0, 100);
    }
    
    return 'Completed';
  }

  /**
   * Extract workflow steps from node results
   */
  extractSteps(nodeInvocations) {
    return nodeInvocations.results.map((r, idx) => ({
      step: idx + 1,
      node: r.node,
      action: r.result.action || 'Processed',
      executionTime: r.executionTime,
      success: r.success,
    }));
  }

  /**
   * Generate follow-up questions
   */
  generateFollowUp(nodeInvocations) {
    const questions = [
      'Does this comprehensive analysis address your original request?',
      'Would you like any of the specialized nodes to explore their findings further?',
      'Should we adjust our approach based on any of the insights provided?',
      'Do you want to dive deeper into any specific node\'s contribution?',
      'What aspects would you like to question or challenge further?',
    ];

    // Add node-specific follow-ups
    if (nodeInvocations.results.some(r => r.node === 'JULES')) {
      questions.push('Would you like JULES to optimize the code suggestions further?');
    }
    
    if (nodeInvocations.results.some(r => r.node === 'MURPHY')) {
      questions.push('Should MURPHY provide more detailed security analysis?');
    }
    
    if (nodeInvocations.results.some(r => r.node === 'ATLAS')) {
      questions.push('Would you like ATLAS to create additional documentation?');
    }

    return questions;
  }

  /**
   * Synthesize final comprehensive response
   */
  async synthesizeResults(components) {
    const synthesisPrompt = `
You are synthesizing results from a comprehensive AI analysis across multiple specialized nodes.

Original Request: "${components.originalRequest}"

Socratic Analysis: ${JSON.stringify(components.socraticAnalysis, null, 2)}

LLM Consensus: ${JSON.stringify(components.llmConsensus, null, 2)}

Node Results: ${components.nodeResults.summary}

Create a comprehensive synthesis that:
1. Addresses the original request directly
2. Incorporates insights from Socratic questioning
3. Integrates the multi-LLM consensus
4. Summarizes key contributions from each specialized node
5. Provides actionable next steps
6. Identifies any remaining questions or considerations

Be thorough but concise. Focus on practical value.
`;

    try {
      const pythia = this.nodes.PYTHIA;
      if (pythia) {
        const synthesis = await pythia.generateText(synthesisPrompt, {
          model: 'llama3.2:8b',
          maxTokens: 2000,
          temperature: 0.5,
        });
        
        return {
          text: synthesis.text,
          approach: 'multi_node_synthesis',
          confidence: 'high',
          contributors: components.nodeResults.invoked,
        };
      }
    } catch (error) {
      console.warn('[AllNodeOrchestrator] Synthesis failed:', error.message);
    }

    // Fallback synthesis
    return {
      text: `Analysis complete across ${components.nodeResults.invoked.length} specialized AI nodes. Key insights: ${components.nodeResults.summary}`,
      approach: 'fallback_synthesis',
      confidence: 'medium',
      contributors: components.nodeResults.invoked,
    };
  }

  /**
   * Calculate collaboration score
   */
  calculateCollaborationScore(nodeInvocations) {
    const successRate = nodeInvocations.success_rate || 0;
    const nodeCount = nodeInvocations.invoked.length;
    const maxNodes = 20; // Total available nodes
    
    // Score based on success rate and node participation
    const participationScore = (nodeCount / maxNodes) * 100;
    const qualityScore = successRate;
    
    return Math.round((participationScore + qualityScore) / 2);
  }

  /**
   * Update collaboration metrics
   */
  updateCollaborationMetrics(invokedNodes) {
    // Update node usage
    invokedNodes.forEach(nodeName => {
      this.collaborationMetrics.nodeUsage[nodeName] = 
        (this.collaborationMetrics.nodeUsage[nodeName] || 0) + 1;
    });
    
    // Calculate average collaboration score
    const totalExecutions = this.collaborationMetrics.totalExecutions;
    const currentAvg = this.collaborationMetrics.averageCollaborationScore;
    const newScore = (invokedNodes.length / 20) * 100; // Percentage of nodes used
    
    this.collaborationMetrics.averageCollaborationScore = 
      ((currentAvg * (totalExecutions - 1)) + newScore) / totalExecutions;
  }

  /**
   * Generate recovery suggestions for errors
   */
  generateRecoverySuggestions(error) {
    const suggestions = [
      'Try rephrasing your request with more specific details',
      'Consider breaking down complex requests into smaller parts',
      'Check if any required context or parameters are missing',
      'Try using a different approach or strategy',
    ];
    
    if (error.message.includes('SOCRATES')) {
      suggestions.push('The questioning system encountered an issue - try a simpler request first');
    }
    
    if (error.message.includes('CONDUCTOR')) {
      suggestions.push('Multi-LLM orchestration failed - try with specific providers');
    }
    
    return suggestions;
  }

  /**
   * Get comprehensive orchestrator status
   */
  getStatus() {
    return {
      name: 'AllNodeOrchestrator',
      totalNodes: Object.keys(this.nodes).length,
      activeNodes: Object.keys(this.nodes).filter(name => this.nodes[name]).length,
      collaborationMetrics: this.collaborationMetrics,
      recentExecutions: this.executionHistory.slice(-5),
      nodeStatus: Object.fromEntries(
        Object.entries(this.nodes).map(([name, node]) => [
          name,
          node.getStatus ? node.getStatus() : { active: !!node }
        ])
      ),
    };
  }

  /**
   * Execute with full orchestration context
   */
  async execute(intent, context = {}) {
    console.log(`[AllNodeOrchestrator] Full orchestration execution`);
    
    const result = await this.processWithAllNodes(
      intent.intent || intent,
      {
        context: context,
        llmStrategy: context.strategy || 'consensus',
        providers: context.providers || ['auto'],
      }
    );
    
    // Store in execution history
    this.executionHistory.push({
      timestamp: new Date().toISOString(),
      intent: intent,
      result: result,
    });
    
    // Keep history manageable
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
    
    return {
      node: 'AllNodeOrchestrator',
      action: 'full_node_collaboration',
      result: result,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = AllNodeOrchestrator;
