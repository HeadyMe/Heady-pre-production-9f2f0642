
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
// ║  FILE: brain.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/*
 * HCBrain: Enhanced Meta-Controller with HeadySoul Integration
 * Integrates HeadyBattle and HeadySoul communication chain
 */

const { HeadySoul, CRITICAL_THRESHOLDS } = require('./headysoul');

let getAiRouter;
try {
  const aiRouterModule = require('../ai-router/hc-ai-router-simple');
  if (typeof aiRouterModule === 'function') {
    getAiRouter = () => new aiRouterModule();
  } else if (aiRouterModule && typeof aiRouterModule.getAiRouter === 'function') {
    getAiRouter = aiRouterModule.getAiRouter;
  }
} catch (err) {
  const HCAIRouterSimple = require('../ai-router/hc-ai-router-simple');
  getAiRouter = () => new HCAIRouterSimple();
}

if (typeof getAiRouter !== 'function') {
  const HCAIRouterSimple = require('../ai-router/hc-ai-router-simple');
  getAiRouter = () => new HCAIRouterSimple();
}

class HCBrain {
  constructor() {
    this.headySoul = new HeadySoul();
    this.aiRouter = getAiRouter();
    this.decisionHistory = new Map();
    this.communicationMetrics = {
      channel_to_promoter: 120,
      promoter_to_brain: 80,
      brain_to_headysoul: 450,
      headysoul_to_approval: 86400000 // 24 hours
    };
    this.performanceMetrics = {
      decisions_processed: 0,
      escalations_to_headysoul: 0,
      HeadyBattle_sessions: 0,
      average_decision_time: 0
    };
    this.isContinuousProcessing = false;
  }

  // Enhanced decision processing with AI Router integration
  async processDecision(decision) {
    const headyStartTime = Date.now();
    this.performanceMetrics.decisions_processed++;
    
    try {
      // Step 1: Apply HeadyBattle questioning to complex decisions
      if (this.requiresHeadyBattleAnalysis(decision)) {
        const HeadyBattleAnalysis = await this.applyHeadyBattleMethod(decision);
        decision.HeadyBattle_insights = HeadyBattleAnalysis;
        this.performanceMetrics.HeadyBattle_sessions++;
      }

      // Step 2: Use AI Router for intelligent processing
      const aiContext = {
        kind: 'deep_reasoning',
        nodeId: 'brain',
        ors: await this.getCurrentOrs(),
        estTokens: 2000,
        latencySensitivity: 'low',
        importance: 'user_facing',
        traceId: `brain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      };

      // Step 3: Check if escalation to HeadySoul is needed
      if (await this.headySoul.shouldEscalateToHuman(decision)) {
        const headyEscalationId = await this.headySoul.notifyHeadySoul(decision);
        this.performanceMetrics.escalations_to_headysoul++;
        
        // Return escalation status
        return {
          status: 'ESCALATED_TO_HEADYSOUL',
          escalation_id: headyEscalationId,
          message: 'Decision escalated to HeadySoul for human guidance',
          HeadyBattle_questions: decision.HeadyBattle_insights?.questions || []
        };
      }

      // Step 4: Process decision with AI Router
      const headyResult = await this.aiRouter.runTask(
        aiContext,
        {
          type: 'decision_processing',
          decision: decision,
          HeadyBattle_insights: decision.HeadyBattle_insights
        }
      );
      
      // Step 5: Log decision for learning
      this.logDecision(decision, headyResult, Date.now() - headyStartTime);
      
      return {
        status: 'EXECUTED',
        result: headyResult.output,
        processing_time: Date.now() - headyStartTime,
        HeadyBattle_insights: decision.HeadyBattle_insights,
        ai_routing: headyResult.choice
      };
      
    } catch (error) {
      console.error('HCBrain decision processing error:', error);
      
      // Escalate errors to HeadySoul
      const headyErrorEscalation = {
        type: 'SYSTEM_ERROR',
        title: `Decision processing failed: ${error.message}`,
        severity: 'HIGH',
        error: error,
        original_decision: decision
      };
      
      await this.headySoul.notifyHeadySoul(headyErrorEscalation);
      
      return {
        status: 'ERROR_ESCALATED',
        error: error.message,
        escalation_id: headyErrorEscalation.id
      };
    }
  }

  // Get current ORS from system
  async getCurrentOrs() {
    try {
      // In a real implementation, this would query the actual ORS system
      const health = await this.getSystemHealth();
      return health.ors || 85; // Default to 85 if not available
    } catch (error) {
      console.warn('Could not fetch ORS, using default:', error);
      return 85;
    }
  }

  // Determine if decision requires HeadyBattle analysis
  requiresHeadyBattleAnalysis(decision) {
    const headyBattleTriggers = [
      decision.cost_impact > 0.2, // High cost impact
      decision.uncertainty_score > 0.7, // High uncertainty
      decision.ethical_flag === true, // Ethical considerations
      decision.stakeholder_count > 5, // Many stakeholders
      decision.long_term_impact === true // Long-term consequences
    ];
    
    return headyBattleTriggers.some(trigger => trigger);
  }

  // Apply HeadyBattle to decision
  async applyHeadyBattleMethod(decision) {
    const headyStartTime = Date.now();
    
    try {
      // Generate HeadyBattle questions directly
      const headyQuestions = this.generateHeadyBattleQuestions(decision);
      
      // Store session ID for tracking
      decision.HeadyBattle_session_id = `HeadyBattle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        session_id: decision.HeadyBattle_session_id,
        questions: headyQuestions,
        mode: 'exploratory',
        depth: 1,
        processing_time: Date.now() - headyStartTime
      };
      
    } catch (error) {
      console.error('HeadyBattle analysis error:', error);
      return null;
    }
  }

  // Generate HeadyBattle questions directly
  generateHeadyBattleQuestions(decision) {
    const headyQuestions = [];
    
    if (decision.ethical_flag) {
      questions.push("Who might be affected by this decision?");
      questions.push("What ethical principle should guide our choice?");
    }
    
    if (decision.cost_impact > 0.2) {
      questions.push("What assumption are we making about the ROI of this action?");
      questions.push("How might we achieve the same outcome with 50% of the cost?");
    }
    
    if (decision.uncertainty_score > 0.7) {
      questions.push("What's the most important assumption we're making?");
      questions.push("How could we reduce uncertainty before proceeding?");
    }
    
    if (questions.length === 0) {
      questions.push("What outcome are we ultimately trying to achieve?");
      questions.push("How might we view this situation from a different perspective?");
    }
    
    return questions;
  }

  // Map decision type to HeadyBattle mode
  mapDecisionToHeadyBattleMode(decision) {
    if (decision.ethical_flag) return 'ethical';
    if (decision.technical_complexity > 0.8) return 'technical';
    if (decision.creative_flag) return 'creative';
    if (decision.critical_flag) return 'critical';
    return 'exploratory';
  }

  // Execute decision autonomously
  async executeDecision(decision) {
    // Implementation would depend on decision type
    switch (decision.type) {
      case 'resource_allocation':
        return this.executeResourceAllocation(decision);
      case 'system_change':
        return this.executeSystemChange(decision);
      case 'integration_request':
        return this.executeIntegration(decision);
      default:
        return this.executeGenericDecision(decision);
    }
  }

  executeResourceAllocation(decision) {
    return {
      allocated_resources: decision.requested_resources,
      cost: decision.estimated_cost,
      efficiency_score: 0.85
    };
  }

  executeSystemChange(decision) {
    return {
      change_applied: true,
      rollback_available: true,
      impact_assessment: 'minimal'
    };
  }

  executeIntegration(decision) {
    return {
      integration_status: 'initiated',
      service: decision.service_name,
      estimated_completion: '2 hours'
    };
  }

  executeGenericDecision(decision) {
    return {
      executed: true,
      outcome: 'success',
      metrics: { performance: 0.9 }
    };
  }

  // Log decision for learning and optimization
  logDecision(decision, result, processingTime) {
    const headyLogEntry = {
      timestamp: new Date().toISOString(),
      decision: decision,
      result: result,
      processing_time: processingTime,
      HeadyBattle_insights: decision.HeadyBattle_insights,
      communication_latency: this.communicationMetrics
    };
    
    this.decisionHistory.set(`decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, headyLogEntry);
    
    // Update performance metrics
    this.updatePerformanceMetrics(processingTime);
  }

  updatePerformanceMetrics(processingTime) {
    // Update average decision time
    const headyTotalDecisions = this.performanceMetrics.decisions_processed;
    const headyCurrentAvg = this.performanceMetrics.average_decision_time;
    this.performanceMetrics.average_decision_time =
      headyTotalDecisions > 0 ? (headyCurrentAvg * (headyTotalDecisions - 1) + processingTime) / headyTotalDecisions : processingTime;
  }

  // Process HeadySoul response
  async processHeadySoulResponse(escalationId, response) {
    try {
      const headyResolution = await this.headySoul.processHeadySoulResponse(escalationId, response);
      
      // Resume pipeline if approved
      if (headyResolution.status === 'APPROVED') {
        await this.resumePipeline(escalationId, headyResolution);
      }
      
      return headyResolution;
    } catch (error) {
      console.error('Error processing HeadySoul response:', error);
      throw error;
    }
  }

  // Resume pipeline after HeadySoul approval
  async resumePipeline(escalationId, resolution) {
    const headyResumeCommand = {
      action: 'resume_pipeline',
      escalation_id: escalationId,
      headysoul_guidance: resolution.headysoul_guidance,
      timestamp: new Date().toISOString()
    };
    
    // Send to pipeline manager
    const headyResponse = await fetch('https://api.headyme.com/system/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(headyResumeCommand)
    });
    
    if (!headyResponse.ok) {
      throw new Error(`Failed to resume pipeline: ${headyResponse.statusText}`);
    }
    
    return await headyResponse.json();
  }

  // Get system health metrics with AI Router integration
  async getSystemHealth() {
    const headyHealth = {
      brain_status: 'OPTIMAL',
      decisions_processed: this.performanceMetrics.decisions_processed,
      escalations_to_headysoul: this.performanceMetrics.escalations_to_headysoul,
      HeadyBattle_sessions: this.performanceMetrics.HeadyBattle_sessions,
      average_decision_time: this.performanceMetrics.average_decision_time,
      communication_chain_latency: this.communicationMetrics,
      headysoul_health: await this.headySoul.getCommunicationHealth(),
      ai_router_health: await this.aiRouter.getHealth(),
      ai_router_metrics: this.aiRouter.getMetrics(),
      ors: await this.getCurrentOrs()
    };
    
    return headyHealth;
  }

  // Generate weekly report for HeadySoul
  async generateWeeklyReport() {
    const headyWeekStart = new Date();
    headyWeekStart.setDate(headyWeekStart.getDate() - 7);
    
    const headyWeeklyDecisions = Array.from(this.decisionHistory.values())
      .filter(d => new Date(d.timestamp) >= headyWeekStart);
    
    const headyReport = {
      period: {
        start: headyWeekStart.toISOString(),
        end: new Date().toISOString()
      },
      decision_metrics: {
        total_decisions: headyWeeklyDecisions.length,
        autonomous_decisions: headyWeeklyDecisions.filter(d => !d.result.escalation_id).length,
        escalated_decisions: headyWeeklyDecisions.filter(d => d.result.escalation_id).length,
        HeadyBattle_enhanced_decisions: headyWeeklyDecisions.filter(d => d.HeadyBattle_insights).length
      },
      performance_metrics: this.performanceMetrics,
      communication_health: await this.headySoul.getCommunicationHealth(),
      insights_gained: this.extractWeeklyInsights(headyWeeklyDecisions),
      questions_for_headysoul: await this.headySoul.generateWeeklyDigest()
    };
    
    return headyReport;
  }

  extractWeeklyInsights(decisions) {
    const headyInsights = [];
    
    // Extract patterns from decisions
    const headyEscalatedDecisions = decisions.filter(d => d.result?.escalation_id);
    if (headyEscalatedDecisions.length > 3) {
      headyInsights.push(`High escalation rate this week: ${headyEscalatedDecisions.length} decisions required HeadySoul guidance`);
    }
    
    const headyBattleDecisions = decisions.filter(d => d.HeadyBattle_insights);
    if (headyBattleDecisions.length > 0) {
      headyInsights.push(`HeadyBattle applied to ${headyBattleDecisions.length} decisions, enhancing decision quality`);
    }
    
    const headyAvgProcessingTime = decisions.length > 0 ? decisions.reduce((sum, d) => sum + d.processing_time, 0) / decisions.length : 0;
    if (headyAvgProcessingTime > 5000) { // 5 seconds
      headyInsights.push(`Decision processing time elevated: ${headyAvgProcessingTime}ms average - consider optimization`);
    }
    
    return headyInsights;
  }

  // Tune system parameters based on learning
  async tuneSystem(params) {
    const headyTuningResult = {
      previous_settings: { ...this.communicationMetrics },
      new_settings: params,
      tuning_reason: params.reason || 'System optimization',
      timestamp: new Date().toISOString()
    };
    
    // Apply new settings
    if (params.communication_latency) {
      this.communicationMetrics = { ...this.communicationMetrics, ...params.communication_latency };
    }
    
    if (params.HeadyBattle_thresholds) {
      // Update HeadyBattle thresholds
      CRITICAL_THRESHOLDS.ors_score = params.HeadyBattle_thresholds.ors_score || CRITICAL_THRESHOLDS.ors_score;
      CRITICAL_THRESHOLDS.cost_budget_remaining = params.HeadyBattle_thresholds.cost_budget_remaining || CRITICAL_THRESHOLDS.cost_budget_remaining;
    }
    
    // Log tuning for learning
    this.decisionHistory.set(`tuning_${Date.now()}`, headyTuningResult);
    
    return headyTuningResult;
  }

  // Enable continuous processing for HCFP Full Auto Mode
  enableContinuousProcessing() {
    this.isContinuousProcessing = true;
    console.log('🧠 HCBrain: Continuous processing enabled for HCFP Full Auto Mode');
  }

  // Disable continuous processing
  disableContinuousProcessing() {
    this.isContinuousProcessing = false;
    console.log('🧠 HCBrain: Continuous processing disabled');
  }
}

module.exports = { HCBrain };
