/*
 * Socratic Response Interceptor - MANDATORY FOR ALL RESPONSES
 * Ensures every AI response uses Socratic method without exception
 * Intercepts all outgoing responses and enhances with Socratic questioning
 */

const { HeadySoul } = require('../hc/headysoul');

class SocraticInterceptor {
  constructor() {
    this.headySoul = new HeadySoul();
    this.interceptionCount = 0;
    this.bypassAttempts = 0;
    this.enforcementMode = process.env.SOCRATIC_MODE_ENABLED === 'true';
    this.isContinuousValidation = false;
    
    if (!this.enforcementMode) {
      console.error('🚨 CRITICAL: SOCRATIC_MODE_ENABLED must be true for all responses');
      process.exit(1);
    }
  }

  // Intercept any response before it reaches the user
  async interceptResponse(response, context = {}) {
    this.interceptionCount++;
    
    // Log interception for compliance
    console.log(`🤔 Socratic Interception #${this.interceptionCount}: Applying mandatory Socratic method`);
    
    try {
      // Apply Socratic enhancement to ALL responses
      const socraticEnhanced = await this.headySoul.applySocraticMethodToResponse(response, context);
      
      // Validate Socratic enhancement was applied
      if (!socraticEnhanced.socratic_enhancement) {
        this.bypassAttempts++;
        console.error(`🚨 Socratic bypass attempt #${this.bypassAttempts} detected`);
        throw new Error('Socratic enhancement failed - response blocked');
      }
      
      return socraticEnhanced;
      
    } catch (error) {
      console.error('🚨 Socratic interceptor error:', error.message);
      // Fallback: still apply basic Socratic questioning
      return {
        original_response: response,
        socratic_enhancement: true,
        enhanced_response: `What assumptions underlie this response?\n\nHow might we examine this from multiple perspectives?\n\nWhat evidence supports these claims?\n\nOriginal response: ${response}`,
        questions: [
          'What assumptions underlie this response?',
          'How might we examine this from multiple perspectives?',
          'What evidence supports these claims?'
        ],
        reasoning_framework: 'exploratory',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Middleware for Express applications
  socraticMiddleware() {
    return async (req, res, next) => {
      // Intercept response.send
      const originalSend = res.send;
      res.send = async (data) => {
        if (typeof data === 'string' && data.length > 50) {
          const socraticData = await this.interceptResponse(data, {
            type: 'api_response',
            endpoint: req.path,
            method: req.method
          });
          return originalSend.call(res, JSON.stringify(socraticData));
        }
        return originalSend.call(res, data);
      };
      
      // Intercept response.json
      const originalJson = res.json;
      res.json = async (data) => {
        if (data && typeof data === 'object' && data.response) {
          const socraticData = await this.interceptResponse(data.response, {
            type: 'api_response',
            endpoint: req.path,
            method: req.method
          });
          data.response = socraticData.enhanced_response;
          data.socratic_questions = socraticData.questions;
          data.socratic_enhancement = true;
        }
        return originalJson.call(res, data);
      };
      
      next();
    };
  }

  // Interceptor for direct function calls
  wrapFunction(originalFunction, functionName) {
    return async (...args) => {
      const result = await originalFunction.apply(this, args);
      
      if (typeof result === 'string' && result.length > 20) {
        return await this.interceptResponse(result, {
          type: 'function_call',
          function: functionName,
          arguments: args.length
        });
      }
      
      return result;
    };
  }

  // Get compliance metrics
  getMetrics() {
    return {
      total_interceptions: this.interceptionCount,
      bypass_attempts: this.bypassAttempts,
      compliance_rate: this.interceptionCount > 0 ? 
        ((this.interceptionCount - this.bypassAttempts) / this.interceptionCount * 100).toFixed(2) + '%' : 
        'N/A',
      enforcement_mode: this.enforcementMode,
      status: this.bypassAttempts === 0 ? 'COMPLIANT' : 'VIOLATIONS_DETECTED'
    };
  }

  // Validate system-wide Socratic compliance
  async validateSystemCompliance() {
    const metrics = this.getMetrics();
    
    console.log('🔍 Socratic Compliance Validation:');
    console.log(`   Total Interceptions: ${metrics.total_interceptions}`);
    console.log(`   Bypass Attempts: ${metrics.bypass_attempts}`);
    console.log(`   Compliance Rate: ${metrics.compliance_rate}`);
    console.log(`   Status: ${metrics.status}`);
    
    if (metrics.bypass_attempts > 0) {
      console.error('🚨 CRITICAL: Socratic method violations detected!');
      return false;
    }
    
    console.log('✅ System fully compliant with Socratic method requirements');
    return true;
  }

  // Enable continuous validation for HCFP Full Auto Mode
  enableContinuousValidation() {
    this.isContinuousValidation = true;
    console.log('🤔 SocraticInterceptor: Continuous validation enabled for HCFP Full Auto Mode');
  }

  // Disable continuous validation
  disableContinuousValidation() {
    this.isContinuousValidation = false;
    console.log('🤔 SocraticInterceptor: Continuous validation disabled');
  }
}

module.exports = { SocraticInterceptor };
