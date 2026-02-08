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
// ║  FILE: src/hc_conductor.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyConductor - Brain / Planner
 * 
 * Interprets user goals, creates structured plans, and coordinates specialized agents.
 * Maintains long-term memory, ethics constraints, and success criteria.
 */

class HeadyConductor {
  constructor() {
    this.workflowTemplates = new Map();
    this.agentRegistry = new Map();
    this.memoryStore = new Map();
    this.decisionLog = [];
    this.impactConstraints = new Map();
    
    this.initializeWorkflowTemplates();
    this.initializeAgentRegistry();
    this.initializeImpactConstraints();
  }

  /**
   * Initialize workflow templates for common patterns
   */
  initializeWorkflowTemplates() {
    // Founder intake workflow
    this.workflowTemplates.set('founder-intake', {
      description: 'Intake founder and map to resources',
      tasks: [
        {
          id: 'extract-profile',
          type: 'research',
          agent: 'profile-extractor',
          parallel: false,
          inputs: ['user_input'],
          outputs: ['founder_profile'],
          acceptanceCriteria: ['complete_contact_info', 'business_stage_identified']
        },
        {
          id: 'analyze-needs',
          type: 'research',
          agent: 'needs-analyzer',
          parallel: false,
          inputs: ['founder_profile'],
          outputs: ['needs_assessment'],
          acceptanceCriteria: ['primary_needs_identified', 'urgency_level_set']
        },
        {
          id: 'search-resources',
          type: 'research',
          agent: 'resource-searcher',
          parallel: true,
          inputs: ['needs_assessment'],
          outputs: ['candidate_resources'],
          acceptanceCriteria: ['minimum_3_candidates', 'relevance_score_above_0.7']
        },
        {
          id: 'evaluate-match',
          type: 'evaluation',
          agent: 'match-evaluator',
          parallel: false,
          inputs: ['founder_profile', 'candidate_resources'],
          outputs: ['ranked_recommendations'],
          acceptanceCriteria: ['resources_ranked', 'fit_scores_calculated']
        },
        {
          id: 'generate-response',
          type: 'writing',
          agent: 'response-writer',
          parallel: false,
          inputs: ['ranked_recommendations'],
          outputs: ['final_recommendations'],
          acceptanceCriteria: ['personalized_content', 'actionable_next_steps']
        }
      ],
      successCriteria: [
        'founder_profile_complete',
        'needs_assessment_comprehensive',
        'minimum_3_relevant_resources',
        'personalized_recommendations',
        'clear_next_steps'
      ],
      humanInLoop: [
        {
          step: 'after-evaluate-match',
          purpose: 'review_resource_appropriateness',
          fallback: 'auto_approve_if_confidence_above_0.9'
        }
      ]
    });

    // Grant matching workflow
    this.workflowTemplates.set('grant-matching', {
      description: 'Match founders with suitable grants',
      tasks: [
        {
          id: 'extract-grant-profile',
          type: 'research',
          agent: 'grant-profile-extractor',
          parallel: false,
          inputs: ['founder_profile', 'grant_requirements'],
          outputs: ['grant_eligibility_profile'],
          acceptanceCriteria: ['eligibility_determined', 'requirements_mapped']
        },
        {
          id: 'search-grants',
          type: 'research',
          agent: 'grant-searcher',
          parallel: true,
          inputs: ['grant_eligibility_profile'],
          outputs: ['candidate_grants'],
          acceptanceCriteria: ['deadline_valid', 'eligibility_match_above_0.8']
        },
        {
          id: 'score-grants',
          type: 'evaluation',
          agent: 'grant-scorer',
          parallel: true,
          inputs: ['grant_eligibility_profile', 'candidate_grants'],
          outputs: ['grant_scores'],
          acceptanceCriteria: ['fit_score_calculated', 'success_probability_estimated']
        },
        {
          id: 'prioritize-grants',
          type: 'evaluation',
          agent: 'grant-prioritizer',
          parallel: false,
          inputs: ['grant_scores'],
          outputs: ['prioritized_grant_list'],
          acceptanceCriteria: ['grants_ranked', 'application_timeline_set']
        },
        {
          id: 'prepare-applications',
          type: 'writing',
          agent: 'application-preparer',
          parallel: false,
          inputs: ['prioritized_grant_list', 'founder_profile'],
          outputs: ['application_materials'],
          acceptanceCriteria: ['customized_proposals', 'supporting_documents_identified']
        }
      ],
      successCriteria: [
        'minimum_5_eligible_grants',
        'grants_prioritized_by_fit',
        'application_materials_ready',
        'timeline_established'
      ],
      humanInLoop: [
        {
          step: 'after-prioritize-grants',
          purpose: 'review_grant_prioritization',
          fallback: 'auto_proceed_if_top_3_above_0.85'
        }
      ]
    });

    // Resource recommendation workflow
    this.workflowTemplates.set('resource-recommendation', {
      description: 'Provide resource recommendations based on needs',
      tasks: [
        {
          id: 'analyze-request',
          type: 'research',
          agent: 'request-analyzer',
          parallel: false,
          inputs: ['user_request'],
          outputs: ['parsed_request'],
          acceptanceCriteria: ['intent_identified', 'context_extracted']
        },
        {
          id: 'search-knowledge-base',
          type: 'research',
          agent: 'knowledge-searcher',
          parallel: true,
          inputs: ['parsed_request'],
          outputs: ['knowledge_results'],
          acceptanceCriteria: ['relevant_resources_found', 'quality_score_above_0.6']
        },
        {
          id: 'synthesize-recommendations',
          type: 'writing',
          agent: 'recommendation-synthesizer',
          parallel: false,
          inputs: ['knowledge_results', 'parsed_request'],
          outputs: ['recommendations'],
          acceptanceCriteria: ['recommendations_structured', 'relevance_explained']
        }
      ],
      successCriteria: [
        'request_understood',
        'relevant_resources_identified',
        'clear_recommendations_provided'
      ]
    });
  }

  /**
   * Initialize available agents and their capabilities
   */
  initializeAgentRegistry() {
    this.agentRegistry.set('profile-extractor', {
      type: 'research',
      capabilities: ['information_extraction', 'profile_building', 'context_analysis'],
      modelTier: 'medium',
      maxTokens: 4000,
      temperature: 0.3
    });

    this.agentRegistry.set('needs-analyzer', {
      type: 'research',
      capabilities: ['needs_assessment', 'urgency_detection', 'gap_analysis'],
      modelTier: 'medium',
      maxTokens: 6000,
      temperature: 0.2
    });

    this.agentRegistry.set('resource-searcher', {
      type: 'research',
      capabilities: ['database_search', 'web_search', 'resource_matching'],
      modelTier: 'small',
      maxTokens: 2000,
      temperature: 0.1
    });

    this.agentRegistry.set('match-evaluator', {
      type: 'evaluation',
      capabilities: ['scoring', 'ranking', 'fit_assessment'],
      modelTier: 'medium',
      maxTokens: 4000,
      temperature: 0.1
    });

    this.agentRegistry.set('response-writer', {
      type: 'writing',
      capabilities: ['content_generation', 'personalization', 'action_planning'],
      modelTier: 'large',
      maxTokens: 8000,
      temperature: 0.7
    });

    this.agentRegistry.set('grant-profile-extractor', {
      type: 'research',
      capabilities: ['grant_analysis', 'eligibility_checking', 'requirement_mapping'],
      modelTier: 'medium',
      maxTokens: 6000,
      temperature: 0.2
    });

    this.agentRegistry.set('grant-searcher', {
      type: 'research',
      capabilities: ['grant_database_search', 'deadline_tracking', 'eligibility_filtering'],
      modelTier: 'small',
      maxTokens: 3000,
      temperature: 0.1
    });

    this.agentRegistry.set('grant-scorer', {
      type: 'evaluation',
      capabilities: ['grant_scoring', 'success_probability', 'fit_analysis'],
      modelTier: 'medium',
      maxTokens: 4000,
      temperature: 0.1
    });

    this.agentRegistry.set('grant-prioritizer', {
      type: 'evaluation',
      capabilities: ['prioritization', 'timeline_planning', 'strategic_ranking'],
      modelTier: 'medium',
      maxTokens: 4000,
      temperature: 0.2
    });

    this.agentRegistry.set('application-preparer', {
      type: 'writing',
      capabilities: ['proposal_writing', 'document_preparation', 'customization'],
      modelTier: 'large',
      maxTokens: 10000,
      temperature: 0.6
    });

    this.agentRegistry.set('request-analyzer', {
      type: 'research',
      capabilities: ['intent_detection', 'context_extraction', 'query_parsing'],
      modelTier: 'small',
      maxTokens: 2000,
      temperature: 0.1
    });

    this.agentRegistry.set('knowledge-searcher', {
      type: 'research',
      capabilities: ['knowledge_base_search', 'resource_discovery', 'content_filtering'],
      modelTier: 'small',
      maxTokens: 3000,
      temperature: 0.1
    });

    this.agentRegistry.set('recommendation-synthesizer', {
      type: 'writing',
      capabilities: ['synthesis', 'recommendation_generation', 'explanation_writing'],
      modelTier: 'medium',
      maxTokens: 6000,
      temperature: 0.5
    });
  }

  /**
   * Initialize impact constraints and ethical guidelines
   */
  initializeImpactConstraints() {
    this.impactConstraints.set('equity', {
      description: 'Ensure equitable access to resources',
      rules: [
        'prioritize_underrepresented_founders',
        'consider_geographic_diversity',
        'avoid_bias_in_recommendations',
        'provide_alternative_paths_for_disadvantaged'
      ],
      weight: 0.3
    });

    this.impactConstraints.set('sustainability', {
      description: 'Promote sustainable and ethical businesses',
      rules: [
        'prioritize_sustainable_business_models',
        'consider_environmental_impact',
        'favor_social_enterprise',
        'avoid_harmful_industries'
      ],
      weight: 0.2
    });

    this.impactConstraints.set('accessibility', {
      description: 'Ensure recommendations are accessible',
      rules: [
        'consider_financial_accessibility',
        'provide_free_alternatives',
        'account_for_technical_barriers',
        'include_local_resources'
      ],
      weight: 0.2
    });

    this.impactConstraints.set('transparency', {
      description: 'Maintain transparency in recommendations',
      rules: [
        'explain_recommendation_logic',
        'disclose_affiliations',
        'provide_alternative_viewpoints',
        'be_clear_about_limitations'
      ],
      weight: 0.3
    });
  }

  /**
   * Create workflow specification from run envelope
   */
  async createWorkflowSpec(runEnvelope) {
    const { goal, workflowType, constraints, resourceProfile, metadata } = runEnvelope;
    
    // Log decision start
    this.logDecision('workflow_planning_start', {
      runId: runEnvelope.runId,
      goal,
      workflowType,
      timestamp: Date.now()
    });

    try {
      // Get workflow template
      const template = this.workflowTemplates.get(workflowType);
      if (!template) {
        throw new Error(`Unknown workflow type: ${workflowType}`);
      }

      // Analyze goal complexity and adjust plan
      const complexityAnalysis = this.analyzeGoalComplexity(goal, metadata);
      
      // Apply impact constraints
      const impactAdjustedPlan = this.applyImpactConstraints(template, runEnvelope);
      
      // Create structured workflow spec
      const workflowSpec = {
        runId: runEnvelope.runId,
        workflowType,
        goal,
        description: template.description,
        tasks: this.adaptTasks(impactAdjustedPlan.tasks, complexityAnalysis, resourceProfile),
        successCriteria: template.successCriteria,
        humanInLoop: template.humanInLoop || [],
        impactConstraints: this.getActiveConstraints(runEnvelope),
        memoryContext: this.getMemoryContext(runEnvelope),
        estimatedDuration: this.estimateWorkflowDuration(impactAdjustedPlan.tasks, resourceProfile),
        created: Date.now()
      };

      // Store in memory
      this.memoryStore.set(`workflow_${runEnvelope.runId}`, {
        spec: workflowSpec,
        status: 'planned',
        createdAt: Date.now()
      });

      // Log decision completion
      this.logDecision('workflow_planning_complete', {
        runId: runEnvelope.runId,
        taskCount: workflowSpec.tasks.length,
        estimatedDuration: workflowSpec.estimatedDuration,
        timestamp: Date.now()
      });

      return workflowSpec;

    } catch (error) {
      this.logDecision('workflow_planning_error', {
        runId: runEnvelope.runId,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Analyze goal complexity for planning adjustments
   */
  analyzeGoalComplexity(goal, metadata) {
    const complexity = {
      base: 1.0,
      factors: []
    };

    // Length-based complexity
    if (goal.length > 1000) {
      complexity.base *= 1.2;
      complexity.factors.push('long_goal');
    }

    // Domain-specific complexity
    const complexDomains = ['biotech', 'ai', 'climate', 'fintech', 'healthcare'];
    if (complexDomains.some(domain => goal.toLowerCase().includes(domain))) {
      complexity.base *= 1.3;
      complexity.factors.push('complex_domain');
    }

    // Multi-objective complexity
    const objectives = goal.split(/and|,|\+/).filter(s => s.trim().length > 10);
    if (objectives.length > 3) {
      complexity.base *= 1.1 * Math.min(objectives.length / 3, 1.5);
      complexity.factors.push('multi_objective');
    }

    // Urgency complexity
    if (metadata.urgency === 'high') {
      complexity.base *= 1.15;
      complexity.factors.push('high_urgency');
    }

    return complexity;
  }

  /**
   * Apply impact constraints to workflow template
   */
  applyImpactConstraints(template, runEnvelope) {
    const adjustedTemplate = JSON.parse(JSON.stringify(template)); // Deep copy
    
    if (runEnvelope.impactTier === 'impact') {
      // Add impact-specific tasks
      const impactTasks = [
        {
          id: 'impact-assessment',
          type: 'evaluation',
          agent: 'impact-evaluator',
          parallel: false,
          inputs: ['founder_profile', 'candidate_resources'],
          outputs: ['impact_scores'],
          acceptanceCriteria: ['social_impact_scored', 'equity_considered']
        },
        {
          id: 'equity-check',
          type: 'evaluation',
          agent: 'equity-checker',
          parallel: false,
          inputs: ['impact_scores', 'ranked_recommendations'],
          outputs: ['equity_adjusted_recommendations'],
          acceptanceCriteria: ['equity_factors_applied', 'bias_detected_if_present']
        }
      ];

      // Insert impact tasks before final recommendations
      const finalTaskIndex = adjustedTemplate.tasks.findIndex(t => t.type === 'writing');
      if (finalTaskIndex > 0) {
        adjustedTemplate.tasks.splice(finalTaskIndex, 0, ...impactTasks);
      }

      // Add impact-specific success criteria
      adjustedTemplate.successCriteria.push(
        'social_impact_assessed',
        'equity_factors_considered',
        'bias_mitigation_applied'
      );
    }

    return adjustedTemplate;
  }

  /**
   * Adapt tasks based on complexity analysis and resource profile
   */
  adaptTasks(templateTasks, complexityAnalysis, resourceProfile) {
    return templateTasks.map(task => {
      const adaptedTask = { ...task };

      // Adjust token limits based on complexity
      const agentConfig = this.agentRegistry.get(task.agent);
      if (agentConfig) {
        adaptedTask.maxTokens = Math.min(
          agentConfig.maxTokens * complexityAnalysis.base,
          resourceProfile.maxTokens / templateTasks.length
        );
      }

      // Adjust parallelism based on resource constraints
      if (resourceProfile.priority > 2) { // Lower priority tiers
        adaptedTask.parallel = false; // Force sequential for reliability
      }

      // Add complexity factors to task metadata
      adaptedTask.complexityFactors = complexityAnalysis.factors;

      return adaptedTask;
    });
  }

  /**
   * Get active impact constraints for this run
   */
  getActiveConstraints(runEnvelope) {
    const constraints = [];
    
    if (runEnvelope.impactTier === 'impact') {
      constraints.push(...Array.from(this.impactConstraints.keys()));
    }

    // Add tenant-specific constraints if any
    if (runEnvelope.metadata.tenantConstraints) {
      constraints.push(...runEnvelope.metadata.tenantConstraints);
    }

    return constraints.map(name => ({
      name,
      ...this.impactConstraints.get(name)
    }));
  }

  /**
   * Get memory context for workflow
   */
  getMemoryContext(runEnvelope) {
    const tenantMemory = this.memoryStore.get(`tenant_${runEnvelope.tenant}`) || {};
    const workflowHistory = this.memoryStore.get(`history_${runEnvelope.tenant}`) || [];

    return {
      tenant: tenantMemory,
      recentWorkflows: workflowHistory.slice(-5), // Last 5 workflows
      preferences: tenantMemory.preferences || {},
      previousOutcomes: tenantMemory.outcomes || []
    };
  }

  /**
   * Estimate workflow duration based on tasks and resources
   */
  estimateWorkflowDuration(tasks, resourceProfile) {
    const baseTaskTime = 2000; // 2 seconds base time per task
    const parallelReduction = 0.6; // Parallel tasks are 60% of sequential time
    
    let totalDuration = 0;
    const parallelGroups = this.groupParallelTasks(tasks);
    
    parallelGroups.forEach(group => {
      if (group.length === 1) {
        totalDuration += baseTaskTime;
      } else {
        totalDuration += baseTaskTime * parallelReduction;
      }
    });

    // Adjust for resource profile priority
    const priorityMultiplier = 1.0 + (resourceProfile.priority * 0.2);
    totalDuration *= priorityMultiplier;

    return Math.round(totalDuration);
  }

  /**
   * Group tasks that can run in parallel
   */
  groupParallelTasks(tasks) {
    const groups = [];
    let currentGroup = [];
    let lastTaskWasParallel = false;

    tasks.forEach(task => {
      if (task.parallel && lastTaskWasParallel) {
        currentGroup.push(task);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [task];
      }
      lastTaskWasParallel = task.parallel;
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Evaluate workflow results and determine next steps
   */
  async evaluateResults(runId, results) {
    const workflowMemory = this.memoryStore.get(`workflow_${runId}`);
    if (!workflowMemory) {
      throw new Error(`No workflow found for run ${runId}`);
    }

    const { spec } = workflowMemory;
    
    // Check success criteria
    const successEvaluation = this.evaluateSuccessCriteria(spec.successCriteria, results);
    
    // Apply impact evaluation if applicable
    const impactEvaluation = this.evaluateImpact(spec.impactConstraints, results);
    
    // Determine if refinement is needed
    const needsRefinement = !successEvaluation.allPassed || 
                           (spec.impactConstraints.length > 0 && !impactEvaluation.acceptable);

    let nextAction = 'complete';
    let refinementPlan = null;

    if (needsRefinement) {
      nextAction = 'refine';
      refinementPlan = this.createRefinementPlan(successEvaluation, impactEvaluation, spec);
    }

    // Update memory with results
    workflowMemory.status = nextAction;
    workflowMemory.results = results;
    workflowMemory.evaluation = { success: successEvaluation, impact: impactEvaluation };
    this.memoryStore.set(`workflow_${runId}`, workflowMemory);

    // Log decision
    this.logDecision('workflow_evaluation', {
      runId,
      nextAction,
      successRate: successEvaluation.passRate,
      impactScore: impactEvaluation.score,
      timestamp: Date.now()
    });

    return {
      nextAction,
      refinementPlan,
      evaluation: {
        success: successEvaluation,
        impact: impactEvaluation
      }
    };
  }

  /**
   * Evaluate success criteria against results
   */
  evaluateSuccessCriteria(criteria, results) {
    const evaluation = {
      allPassed: true,
      passed: [],
      failed: [],
      passRate: 0
    };

    criteria.forEach(criterion => {
      const passed = this.checkCriterion(criterion, results);
      if (passed) {
        evaluation.passed.push(criterion);
      } else {
        evaluation.failed.push(criterion);
        evaluation.allPassed = false;
      }
    });

    evaluation.passRate = evaluation.passed.length / criteria.length;
    return evaluation;
  }

  /**
   * Check individual criterion against results
   */
  checkCriterion(criterion, results) {
    // Simplified criterion checking
    // In real implementation, would have more sophisticated evaluation
    const resultKeys = Object.keys(results).join(' ').toLowerCase();
    const criterionLower = criterion.toLowerCase();
    
    return resultKeys.includes(criterionLower) || 
           results[criterion] !== undefined ||
           (results.status && results.status.toLowerCase().includes(criterionLower));
  }

  /**
   * Evaluate impact constraints
   */
  evaluateImpact(constraints, results) {
    if (constraints.length === 0) {
      return { acceptable: true, score: 1.0, details: [] };
    }

    const evaluation = {
      acceptable: true,
      score: 0,
      details: []
    };

    constraints.forEach(constraint => {
      const score = this.evaluateConstraint(constraint, results);
      evaluation.details.push({
        name: constraint.name,
        score,
        weight: constraint.weight
      });
      evaluation.score += score * constraint.weight;
    });

    evaluation.acceptable = evaluation.score >= 0.7; // 70% threshold
    return evaluation;
  }

  /**
   * Evaluate individual impact constraint
   */
  evaluateConstraint(constraint, results) {
    // Simplified impact evaluation
    // In real implementation, would check specific constraint rules
    const hasImpactData = results.impact_scores || results.equity_factors;
    return hasImpactData ? 0.8 : 0.6;
  }

  /**
   * Create refinement plan when workflow needs improvement
   */
  createRefinementPlan(successEvaluation, impactEvaluation, spec) {
    const plan = {
      tasks: [],
      reason: []
    };

    // Add tasks for failed success criteria
    successEvaluation.failed.forEach(criterion => {
      plan.tasks.push({
        id: `fix-${criterion}`,
        type: 'research',
        agent: 'quality-improver',
        parallel: false,
        inputs: ['previous_results'],
        outputs: [`improved_${criterion}`],
        acceptanceCriteria: [criterion]
      });
      plan.reason.push(`Failed criterion: ${criterion}`);
    });

    // Add tasks for insufficient impact
    if (!impactEvaluation.acceptable) {
      plan.tasks.push({
        id: 'improve-impact',
        type: 'evaluation',
        agent: 'impact-improver',
        parallel: false,
        inputs: ['previous_results'],
        outputs: ['improved_impact_scores'],
        acceptanceCriteria: ['impact_score_above_0.7']
      });
      plan.reason.push('Impact score below threshold');
    }

    return plan;
  }

  /**
   * Log decision for audit and learning
   */
  logDecision(type, data) {
    this.decisionLog.push({
      type,
      data,
      timestamp: Date.now()
    });

    // Keep log size manageable
    if (this.decisionLog.length > 1000) {
      this.decisionLog = this.decisionLog.slice(-500);
    }
  }

  /**
   * Get decision log for analysis
   */
  getDecisionLog(limit = 100) {
    return this.decisionLog.slice(-limit);
  }

  /**
   * Update memory with new information
   */
  updateMemory(tenant, key, value) {
    const tenantMemory = this.memoryStore.get(`tenant_${tenant}`) || {};
    tenantMemory[key] = value;
    this.memoryStore.set(`tenant_${tenant}`, tenantMemory);
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(runId) {
    return this.memoryStore.get(`workflow_${runId}`);
  }
}

module.exports = HeadyConductor;
