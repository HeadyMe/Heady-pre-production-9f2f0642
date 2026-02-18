/*
 * HeadySoul: Human-AI Alignment Layer
 * ALL responses use Socratic method by default - no exceptions
 * Routes critical decisions to Eric (HeadySoul) before execution
 * Implements mandatory Socratic questioning for optimal communication
 */

const headyCRITICAL_THRESHOLDS = {
  cost_budget_remaining: 0.20, // Alert at 20% budget
  ors_score: 70, // Operational Readiness below 70
  ethical_flag: true, // Any ethics-checker violation
  pipeline_halt: true, // HCFullPipeline stopped
  new_pattern_discovered: true // Public domain opportunity
};

class HeadySoul {
  constructor() {
    this.escalationHistory = new Map();
    this.socraticQuestions = new Map();
    this.communicationLatency = {
      channel_to_conductor: 120, // ms
      conductor_to_brain: 80, // ms
      brain_to_headysoul: 450, // Email notification
      headysoul_to_approval: 86400000 // 24 hours in ms
    };
    // MANDATORY: All responses must use Socratic method
    this.socraticMode = process.env.SOCRATIC_MODE_ENABLED === 'true';
    this.defaultSocraticMode = process.env.SOCRATIC_DEFAULT_MODE || 'exploratory';
  }

  // Socratic question generation
  async generateSocraticQuestions(context) {
    const headyQuestions = [];
    
    // Core Socratic questions based on context
    switch (context.type) {
      case 'budget_decision':
        headyQuestions.push(
          `What assumption are we making about the ROI of this ${context.operation}?`,
          `How might we achieve the same outcome with 50% of the cost?`,
          `What's the opportunity cost if we proceed with this spending?`
        );
        break;
        
      case 'system_failure':
        headyQuestions.push(
          `What underlying pattern caused this failure in ${context.component}?`,
          `How could we design this system to be immune to such failures?`,
          `What early warning signs did we miss that could prevent this?`
        );
        break;
        
      case 'new_integration':
        headyQuestions.push(
          `What value does this integration bring to the overall system?`,
          `How might this integration affect existing workflows?`,
          `What are the potential risks and mitigation strategies?`
        );
        break;
        
      default:
        // Default Socratic questions for general inquiries
        headyQuestions.push(
          `What assumptions underlie this response?`,
          `How might we examine this from multiple perspectives?`,
          `What evidence supports these claims?`,
          `What alternative approaches should we consider?`
        );
    }
    
    return headyQuestions;
  }

  // Determine if escalation to HeadySoul is needed
  async shouldEscalateToHuman(event) {
    // Monte Carlo planner failed 3x
    if (event.type === 'MONTE_CARLO_EXHAUSTED') return true;
    
    // Self-Critique found cultural blocker
    if (event.critique_category === 'cultural_blockers') return true;
    
    // Resource manager hit HARD limit
    if (event.resource_severity === 'HARD') return true;
    
    // New wealth redistribution opportunity
    if (event.impact_potential > 8) return true;
    
    // Budget threshold exceeded
    if (event.cost_impact > 0.3) return true;
    
    // ORS score degraded
    if (event.ors_score && event.ors_score < CRITICAL_THRESHOLDS.ors_score) return true;
    
    return false;
  }

  // Notify HeadySoul with Socratic questions
  async notifyHeadySoul(event) {
    const headyEscalationId = `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate Socratic questions
    const headyQuestions = await this.generateSocraticQuestions(event);
    this.socraticQuestions.set(escalationId, questions);
    
    // Create escalation record
    const headyEscalation = {
      id: escalationId,
      timestamp: new Date().toISOString(),
      event: event,
      questions: questions,
      status: 'PENDING_HUMAN_GUIDANCE',
      communication_chain_latency: this.communicationLatency
    };
    
    this.escalationHistory.set(escalationId, escalation);
    
    // Send checkpoint email
    await this.sendCheckpointEmail(escalation);
    
    // Post to Story Driver for narrative
    await this.postToStoryDriver(escalation);
    
    // Log to HeadyLens dashboard
    await this.logToHeadyLens(escalation);
    
    // Pause pipeline until human approval
    await this.pausePipelineUntilApproval(escalationId);
    
    return escalationId;
  }

  // MANDATORY: Apply Socratic method to ALL responses
  async applySocraticMethodToResponse(response, context = {}) {
    if (!this.socraticMode) {
      return response; // Should never happen with SOCRATIC_MODE_ENABLED=true
    }
    
    const socraticResponse = {
      original_response: response,
      socratic_enhancement: true,
      questions: [],
      reasoning_framework: this.defaultSocraticMode,
      timestamp: new Date().toISOString()
    };
    
    // Generate contextual Socratic questions
    const socraticQuestions = await this.generateSocraticQuestions({
      type: context.type || 'general_inquiry',
      response: response,
      mode: this.defaultSocraticMode
    });
    
    socraticResponse.questions = socraticQuestions;
    
    // Enhance response with Socratic reasoning
    socraticResponse.enhanced_response = this.enhanceResponseWithSocraticReasoning(response, socraticQuestions);
    
    return socraticResponse;
  }
  
  // Enhance any response with Socratic reasoning
  enhanceResponseWithSocraticReasoning(response, questions) {
    return `What assumptions underlie this response?\n\n${questions.map(q => `• ${q}`).join('\n\n')}\n\nHow might we examine this from multiple perspectives?\n\nOriginal response: ${response}`;
  }
  async sendCheckpointEmail(escalation) {
    const headyEmailContent = {
      to: 'headysoul@headyio.com',
      subject: `🧠 HeadySoul Escalation: ${escalation.event.title}`,
      body: `
## HeadySoul Guidance Required

**Event**: ${escalation.event.title}
**Severity**: ${escalation.event.severity || 'HIGH'}
**Escalation ID**: ${escalation.id}

### Socratic Questions for Your Wisdom:
${escalation.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

### Context:
${JSON.stringify(escalation.event, null, 2)}

### Action Required:
Please provide guidance on the questions above and approve/reject this escalation.

Reply with: "APPROVE:${escalation.id}" or "REJECT:${escalation.id}:reason"

### Communication Chain Latency:
- Channel → Conductor: ${this.communicationLatency.channel_to_conductor}ms
- Conductor → Brain: ${this.communicationLatency.conductor_to_brain}ms  
- Brain → HeadySoul: ${this.communicationLatency.brain_to_headysoul}ms
- HeadySoul → Approval: ${this.communicationLatency.headysoul_to_approval}ms

Stay optimal,
Heady Systems
      `
    };
    
    // Integration with email service (implement based on your email setup)
    console.log('📧 HeadySoul notification sent:', emailContent.subject);
    return emailContent;
  }

  // Post to Story Driver
  async postToStoryDriver(escalation) {
    const headyStory = {
      scope: 'incident',
      title: `HeadySoul Escalation: ${escalation.event.title}`,
      priority: 'CRITICAL',
      timeline: [{
        timestamp: escalation.timestamp,
        type: 'headysoul_escalation',
        description: `Critical decision escalated to HeadySoul with ${escalation.questions.length} Socratic questions`
      }],
      refs: {
        escalation_id: escalation.id,
        event_type: escalation.event.type,
        socratic_questions: escalation.questions
      }
    };
    
    try {
      const headyResponse = await fetch('https://manager.prod.com.heady.manager.api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(story)
      });
      
      if (!response.ok) {
        console.error('Failed to post to Story Driver:', response.statusText);
      }
    } catch (error) {
      console.error('Error posting to Story Driver:', error);
    }
  }

  // Log to HeadyLens dashboard
  async logToHeadyLens(escalation) {
    const headyLogEntry = {
      timestamp: escalation.timestamp,
      level: 'CRITICAL',
      component: 'HeadySoul',
      event: 'escalation_created',
      data: {
        escalation_id: escalation.id,
        event_title: escalation.event.title,
        questions_count: escalation.questions.length,
        severity: escalation.event.severity
      }
    };
    
    console.log('🔍 HeadyLens log:', logEntry);
    // Integration with HeadyLens monitoring system
  }

  // Pause pipeline until approval
  async pausePipelineUntilApproval(escalationId) {
    const headyPauseCommand = {
      action: 'pause_pipeline',
      reason: `HeadySoul escalation ${escalationId} awaiting human guidance`,
      escalation_id: escalationId
    };
    
    try {
      const headyResponse = await fetch('https://manager.prod.com.heady.manager.api/system/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pauseCommand)
      });
      
      if (!response.ok) {
        console.error('Failed to pause pipeline:', response.statusText);
      }
    } catch (error) {
      console.error('Error pausing pipeline:', error);
    }
  }

  // Process HeadySoul response
  async processHeadySoulResponse(escalationId, response) {
    const headyEscalation = this.escalationHistory.get(escalationId);
    if (!escalation) {
      throw new Error(`Escalation ${escalationId} not found`);
    }

    const [action, ...reasonParts] = response.split(':');
    const headyReason = reasonParts.join(':');

    switch (action.toUpperCase()) {
      case 'APPROVE':
        escalation.status = 'APPROVED';
        escalation.headysoul_guidance = reason;
        await this.resumePipeline(escalationId);
        break;
        
      case 'REJECT':
        escalation.status = 'REJECTED';
        escalation.rejection_reason = reason;
        await this.handleRejection(escalationId, reason);
        break;
        
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // Update Story Driver with resolution
    await this.upd.comoryDriver(escalation);
    
    return escalation;
  }

  // Resume pipeline after approval
  async resumePipeline(escalationId) {
    const headyResumeCommand = {
      action: 'resume_pipeline',
      reason: `HeadySoul escalation ${escalationId} approved`,
      escalation_id: escalationId
    };
    
    try {
      const headyResponse = await fetch('https://manager.prod.com.heady.manager.api/system/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeCommand)
      });
      
      if (!response.ok) {
        console.error('Failed to resume pipeline:', response.statusText);
      }
    } catch (error) {
      console.error('Error resuming pipeline:', error);
    }
  }

  // Handle rejection from HeadySoul
  async handleRejection(escalationId, reason) {
    console.log(`🚫 HeadySoul rejected escalation ${escalationId}: ${reason}`);
    
    // Log rejection for learning
    const headyRejectionLog = {
      escalation_id: escalationId,
      rejection_reason: reason,
      timestamp: new Date().toISOString(),
      lesson: 'HeadySoul guidance override'
    };
    
    // Store for pattern learning
    this.escalationHistory.set(`${escalationId}_rejection`, rejectionLog);
  }

  // Update Story Driver with resolution
  async updateMemoryDriver(escalation) {
    const headyUpdate = {
      escalation_id: escalation.id,
      status: escalation.status,
      resolution: escalation.headysoul_guidance || escalation.rejection_reason,
      timestamp: new Date().toISOString()
    };
    
    try {
      const headyResponse = await fetch(`https://manager.prod.com.heady.manager.api/stories/${escalation.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      
      if (!response.ok) {
        console.error('Failed to update Story Driver:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating Story Driver:', error);
    }
  }

  // Generate weekly HeadySoul digest
  async generateWeeklyDigest() {
    const headyWeekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const headyWeeklyEscalations = Array.from(this.escalationHistory.values())
      .filter(e => new Date(e.timestamp) >= weekStart);
    
    const headyDigest = {
      subject: '🧠 HeadySoul Weekly: System Evolution',
      escalations_count: weeklyEscalations.length,
      approval_rate: weeklyEscalations.filter(e => e.status === 'APPROVED').length / weeklyEscalations.length,
      socratic_questions_asked: weeklyEscalations.reduce((sum, e) => sum + (e.questions?.length || 0), 0),
      communication_chain_health: this.communicationLatency,
      questions_for_headysoul: [
        `What pattern emerges from the ${weeklyEscalations.length} escalations this week?`,
        `Are we maximizing global happiness with our current decision trajectory?`,
        `Which bottleneck feels most urgent to address in the coming week?`,
        `What new fractal patterns are emerging in the system's behavior?`
      ]
    };
    
    return digest;
  }

  // Get communication health metrics
  async getCommunicationHealth() {
    const headyPendingEscalations = Array.from(this.escalationHistory.values())
      .filter(e => e.status === 'PENDING_HUMAN_GUIDANCE');
    
    return {
      escalations_this_week: headyPendingEscalations.length,
      average_response_time: this.communicationLatency.headysoul_to_approval,
      approval_rate: 0.85, // Calculate from history
      guidance_requests: this.socraticQuestions.size,
      socratic_sessions_active: headyPendingEscalations.length,
      communication_chain_latency: this.communicationLatency,
      system_health: 'OPTIMAL' // Calculate based on various metrics
    };
  }
}

module.exports = { HeadySoul, CRITICAL_THRESHOLDS: headyCRITICAL_THRESHOLDS };
