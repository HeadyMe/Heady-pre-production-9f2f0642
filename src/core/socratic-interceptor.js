
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
// ║  FILE: HeadyBattle-interceptor.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/*
 * HeadyBattle Response Interceptor - MANDATORY FOR ALL RESPONSES
 * Ensures every AI response uses HeadyBattle without exception
 * Intercepts all outgoing responses and enhances with HeadyBattle questioning
 */

const { HeadySoul } = require('../hc/headysoul');

class HeadyBattleInterceptor {
  constructor() {
    this.headySoul = new HeadySoul();
    this.interceptionCount = 0;
    this.bypassAttempts = 0;
    this.enforcementMode = process.env.HEADYBATTLE_MODE_ENABLED === 'true';
    this.isContinuousValidation = false;
    
    // Set environment variable if not present - MANDATORY for all operations
    if (!this.enforcementMode) {
      console.log('🤔 Setting HEADYBATTLE_MODE_ENABLED=true for mandatory HeadyBattle compliance');
      process.env.HEADYBATTLE_MODE_ENABLED = 'true';
      this.enforcementMode = true;
    }
  }

  // Intercept any response before it reaches the user
  async interceptResponse(response, context = {}) {
    this.interceptionCount++;
    
    // Log interception for compliance
    console.log(`🤔 HeadyBattle Interception #${this.interceptionCount}: Applying mandatory HeadyBattle`);
    
    try {
      // Apply HeadyBattle enhancement to ALL responses
      const HeadyBattleEnhanced = await this.headySoul.applyHeadyBattleMethodToResponse(response, context);
      
      // Validate HeadyBattle enhancement was applied
      if (!HeadyBattleEnhanced.HeadyBattle_enhancement) {
        this.bypassAttempts++;
        console.error(`🚨 HeadyBattle bypass attempt #${this.bypassAttempts} detected`);
        throw new Error('HeadyBattle enhancement failed - response blocked');
      }
      
      return HeadyBattleEnhanced;
      
    } catch (error) {
      console.error('🚨 HeadyBattle interceptor error:', error.message);
      // Fallback: still apply basic HeadyBattle questioning
      return {
        original_response: response,
        HeadyBattle_enhancement: true,
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
  HeadyBattleMiddleware() {
    return async (req, res, next) => {
      // Intercept response.send
      const originalSend = res.send;
      res.send = async (data) => {
        const contentType = String(res.getHeader('content-type') || '').toLowerCase();
        const trimmed = typeof data === 'string' ? data.trim() : '';
        const looksLikeJson =
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'));

        if (typeof data === 'string' && data.length > 50 && !contentType.includes('application/json') && !looksLikeJson) {
          const HeadyBattleData = await this.interceptResponse(data, {
            type: 'api_response',
            endpoint: req.path,
            method: req.method
          });
          return originalSend.call(res, JSON.stringify(HeadyBattleData));
        }
        return originalSend.call(res, data);
      };
      
      // Intercept response.json
      const originalJson = res.json;
      res.json = async (data) => {
        if (data && typeof data === 'object' && data.response) {
          const HeadyBattleData = await this.interceptResponse(data.response, {
            type: 'api_response',
            endpoint: req.path,
            method: req.method
          });
          data.response = HeadyBattleData.enhanced_response;
          data.HeadyBattle_questions = HeadyBattleData.questions;
          data.HeadyBattle_enhancement = true;
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

  // Validate system-wide HeadyBattle compliance
  async validateSystemCompliance() {
    const metrics = this.getMetrics();
    
    console.log('🔍 HeadyBattle Compliance Validation:');
    console.log(`   Total Interceptions: ${metrics.total_interceptions}`);
    console.log(`   Bypass Attempts: ${metrics.bypass_attempts}`);
    console.log(`   Compliance Rate: ${metrics.compliance_rate}`);
    console.log(`   Status: ${metrics.status}`);
    
    if (metrics.bypass_attempts > 0) {
      console.error('🚨 CRITICAL: HeadyBattle violations detected!');
      return false;
    }
    
    console.log('✅ System fully compliant with HeadyBattle requirements');
    return true;
  }

  // Enable continuous validation for HCFP Full Auto Mode
  enableContinuousValidation() {
    this.isContinuousValidation = true;
    console.log('🤔 HeadyBattleInterceptor: Continuous validation enabled for HCFP Full Auto Mode');
  }

  // Disable continuous validation
  disableContinuousValidation() {
    this.isContinuousValidation = false;
    console.log('🤔 HeadyBattleInterceptor: Continuous validation disabled');
  }
}

module.exports = { HeadyBattleInterceptor };
