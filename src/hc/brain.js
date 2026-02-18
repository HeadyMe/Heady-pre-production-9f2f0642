/*
 * HCBrain: Enhanced Meta-Controller with HeadySoul Integration
 * Integrates Socratic method and HeadySoul communication chain
 */

const { HeadySoul, CRITICAL_THRESHOLDS } = require('./headysoul');

class HCBrain {
  constructor() {
    this.headySoul = new HeadySoul();
    this.decisionHistory = new Map();
    this.communicationMetrics = {
      channel_to_conductor: 120,
      conductor_to_brain: 80,
      brain_to_headysoul: 450,
      headysoul_to_approval: 86400000 // 24 hours
    };
    this.performanceMetrics = {
      decisions_processed: 0,
      escalations_to_headysoul: 0,
      socratic_sessions: 0,
      average_decision_time: 0
    };
    this.isContinuousProcessing = false;
  }

  // Enhanced decision processing with HeadySoul integration
  async processDecision(decision) {
    const headyStartTime = Date.now();
    this.performanceMetrics.decisions_processed++;
    
    try {
      // Step 1: Apply Socratic questioning to complex decisions
      if (this.requiresSocraticAnalysis(decision)) {
        const socraticAnalysis = await this.applySocraticMethod(decision);
        decision.socratic_insights = socraticAnalysis;
        this.performanceMetrics.socratic_sessions++;
      }

      // Step 2: Check if escalation to HeadySoul is needed
      if (await this.headySoul.shouldEscalateToHuman(decision)) {
        const headyEscalationId = await this.headySoul.notifyHeadySoul(decision);
        this.performanceMetrics.escalations_to_headysoul++;
        
        // Return escalation status
        return {
          status: 'ESCALATED_TO_HEADYSOUL',
          escalation_id: headyEscalationId,
          message: 'Decision escalated to HeadySoul for human guidance',
          socratic_questions: decision.socratic_insights?.questions || []
        };
      }

      // Step 3: Process decision autonomously
      const headyResult = await this.executeDecision(decision);
      
      // Step 4: Log decision for learning
      this.logDecision(decision, headyResult, Date.now() - headyStartTime);
      
      return {
        status: 'EXECUTED',
        result: headyResult,
        processing_time: Date.now() - headyStartTime,
        socratic_insights: decision.socratic_insights
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

  // Determine if decision requires Socratic analysis
  requiresSocraticAnalysis(decision) {
    const headySocraticTriggers = [
      decision.cost_impact > 0.2, // High cost impact
      decision.uncertainty_score > 0.7, // High uncertainty
      decision.ethical_flag === true, // Ethical considerations
      decision.stakeholder_count > 5, // Many stakeholders
      decision.long_term_impact === true // Long-term consequences
    ];
    
    return headySocraticTriggers.some(trigger => trigger);
  }

  // Apply Socratic method to decision
  async applySocraticMethod(decision) {
    const headyStartTime = Date.now();
    
    try {
      // Generate Socratic questions directly
      const headyQuestions = this.generateSocraticQuestions(decision);
      
      // Store session ID for tracking
      decision.socratic_session_id = `socratic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        session_id: decision.socratic_session_id,
        questions: questions,
        mode: 'exploratory',
        depth: 1,
        processing_time: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Socratic analysis error:', error);
      return null;
    }
  }

  // Generate Socratic questions directly
  generateSocraticQuestions(decision) {
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

  // Map decision type to Socratic mode
  mapDecisionToSocraticMode(decision) {
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
      socratic_insights: decision.socratic_insights,
      communication_latency: this.communicationMetrics
    };
    
    this.decisionHistory.set(`decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, logEntry);
    
    // Update performance metrics
    this.updatePerformanceMetrics(processingTime);
  }

  updatePerformanceMetrics(processingTime) {
    // Update average decision time
    const headyTotalDecisions = this.performanceMetrics.decisions_processed;
    const headyCurrentAvg = this.performanceMetrics.average_decision_time;
    this.performanceMetrics.average_decision_time = 
      (currentAvg * (totalDecisions - 1) + processingTime) / totalDecisions;
  }

  // Process HeadySoul response
  async processHeadySoulResponse(escalationId, response) {
    try {
      const headyResolution = await this.headySoul.processHeadySoulResponse(escalationId, response);
      
      // Resume pipeline if approved
      if (resolution.status === 'APPROVED') {
        await this.resumePipeline(escalationId, resolution);
      }
      
      return resolution;
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
    const headyResponse = await fetch('https://manager.prod.com.heady.manager.api/system/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resumeCommand)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to resume pipeline: ${response.statusText}`);
    }
    
    return await response.json();
  }

  // Get system health metrics
  async getSystemHealth() {
    const headyHealth = {
      brain_status: 'OPTIMAL',
      decisions_processed: this.performanceMetrics.decisions_processed,
      escalations_to_headysoul: this.performanceMetrics.escalations_to_headysoul,
      socratic_sessions: this.performanceMetrics.socratic_sessions,
      average_decision_time: this.performanceMetrics.average_decision_time,
      communication_chain_latency: this.communicationMetrics,
      headysoul_health: await this.headySoul.getCommunicationHealth()
    };
    
    return headyHealth;
  }

  // Generate weekly report for HeadySoul
  async generateWeeklyReport() {
    const headyWeekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const headyWeeklyDecisions = Array.from(this.decisionHistory.values())
      .filter(d => new Date(d.timestamp) >= weekStart);
    
    const headyReport = {
      period: {
        start: weekStart.toISOString(),
        end: new Date().toISOString()
      },
      decision_metrics: {
        total_decisions: weeklyDecisions.length,
        autonomous_decisions: weeklyDecisions.filter(d => !d.result.escalation_id).length,
        escalated_decisions: weeklyDecisions.filter(d => d.result.escalation_id).length,
        socratic_enhanced_decisions: weeklyDecisions.filter(d => d.socratic_insights).length
      },
      performance_metrics: this.performanceMetrics,
      communication_health: await this.headySoul.getCommunicationHealth(),
      insights_gained: this.extractWeeklyInsights(weeklyDecisions),
      questions_for_headysoul: await this.headySoul.generateWeeklyDigest()
    };
    
    return report;
  }

  extractWeeklyInsights(decisions) {
    const headyInsights = [];
    
    // Extract patterns from decisions
    const headyEscalatedDecisions = decisions.filter(d => d.result.escalation_id);
    if (escalatedDecisions.length > 3) {
      insights.push(`High escalation rate this week: ${escalatedDecisions.length} decisions required HeadySoul guidance`);
    }
    
    const headySocraticDecisions = decisions.filter(d => d.socratic_insights);
    if (socraticDecisions.length > 0) {
      insights.push(`Socratic method applied to ${socraticDecisions.length} decisions, enhancing decision quality`);
    }
    
    const headyAvgProcessingTime = decisions.reduce((sum, d) => sum + d.processing_time, 0) / decisions.length;
    if (avgProcessingTime > 5000) { // 5 seconds
      insights.push(`Decision processing time elevated: ${avgProcessingTime}ms average - consider optimization`);
    }
    
    return insights;
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
    
    if (params.socratic_thresholds) {
      // Update Socratic thresholds
      CRITICAL_THRESHOLDS.ors_score = params.socratic_thresholds.ors_score || CRITICAL_THRESHOLDS.ors_score;
      CRITICAL_THRESHOLDS.cost_budget_remaining = params.socratic_thresholds.cost_budget_remaining || CRITICAL_THRESHOLDS.cost_budget_remaining;
    }
    
    // Log tuning for learning
    this.decisionHistory.set(`tuning_${Date.now()}`, tuningResult);
    
    return tuningResult;
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
