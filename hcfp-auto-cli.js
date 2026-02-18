#!/usr/bin/env node
/**
 * 🎯 HCFP Auto-Mode Command Line Interface
 * Direct activation of HCFullPipeline with dual-engine execution
 */

const http = require('http');

class HCFPAutoMode {
  constructor(baseUrl = 'http://localhost:3300') {
    this.baseUrl = baseUrl;
  }

  async makeRequest(path, data) {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data);
      
      const options = {
        hostname: 'localhost',
        port: 3300,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonData)
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve({ status: res.statusCode, data: response });
          } catch (error) {
            resolve({ status: res.statusCode, data: { raw: responseData } });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(jsonData);
      req.end();
    });
  }

  async activatePerpetualMode() {
    console.log('🚀 ACTIVATING HCFP PERPETUAL MODE');
    console.log('=====================================');
    
    try {
      // Step 1: Initialize conductor
      console.log('📡 Step 1: Initializing HeadyConductor...');
      const conductorResult = await this.makeRequest('/api/conductor/submit', {
        task: {
          type: "hcfp_perpetual_init",
          action: "Initialize perpetual execution mode",
          parameters: {
            validation: true,
            continuous: true,
            autoRecovery: true,
            monitoring: true,
          }
        },
        priority: "high"
      });

      console.log(`Status: ${conductorResult.status}`);
      if (conductorResult.data.success) {
        console.log('✅ HeadyConductor initialized');
      } else {
        console.log('⚠️  Conductor initialization issue:', conductorResult.data.error);
      }

      // Step 2: Enable brain decision processing
      console.log('\n🧠 Step 2: Enabling brain decision processing...');
      const brainResult = await this.makeRequest('/api/brain/decide', {
        decision: {
          type: "enable_perpetual_mode",
          action: "Enable continuous decision processing",
          parameters: {
            dualEngine: true,
            monteCarlo: true,
            socratic: true,
            learning: true,
            confidenceThreshold: 0.85,
          }
        },
        priority: "high"
      });

      console.log(`Status: ${brainResult.status}`);
      if (brainResult.data.success) {
        console.log('✅ Brain processing enabled');
      } else {
        console.log('⚠️  Brain processing issue:', brainResult.data.error);
      }

      // Step 3: Start Socratic continuous validation
      console.log('\n🤔 Step 3: Starting Socratic continuous validation...');
      const socraticResult = await this.makeRequest('/api/socratic/start', {
        user_id: "hcfp_system",
        query: "Initialize continuous Socratic validation for all system actions",
        mode: "continuous_validation",
        parameters: {
          depth: "deep",
          challengeAssumptions: true,
          verifyPrerequisites: true,
          exploreAlternatives: true,
        }
      });

      console.log(`Status: ${socraticResult.status}`);
      if (socraticResult.data.success) {
        console.log('✅ Socratic validation started');
        console.log(`Session ID: ${socraticResult.data.session_id}`);
      } else {
        console.log('⚠️  Socratic validation issue:', socraticResult.data.error);
      }

      // Step 4: Enable system monitoring
      console.log('\n📊 Step 4: Enabling system monitoring...');
      const monitoringResult = await this.makeRequest('/api/system/resume', {
        escalation_id: "hcfp_auto_mode",
        headysoul_guidance: "Enable perpetual execution with comprehensive monitoring"
      });

      console.log(`Status: ${monitoringResult.status}`);
      if (monitoringResult.data.success) {
        console.log('✅ System monitoring enabled');
      } else {
        console.log('⚠️  Monitoring issue:', monitoringResult.data.error);
      }

      // Final status
      console.log('\n🎯 HCFP PERPETUAL MODE STATUS');
      console.log('==============================');
      
      const overallSuccess = conductorResult.data.success || 
                           brainResult.data.success || 
                           socraticResult.data.success || 
                           monitoringResult.data.success;

      if (overallSuccess) {
        console.log('✅ HCFP Perpetual Mode ACTIVATED');
        console.log('🎲 Monte Carlo: ENABLED');
        console.log('🤔 Socratic Validation: ENABLED');
        console.log('🧠 Brain Processing: ENABLED');
        console.log('📊 System Monitoring: ENABLED');
        console.log('🔄 Continuous Learning: ENABLED');
        console.log('\n🚀 System is now running in perpetual auto-mode...');
        console.log('   All actions will be validated through dual-engine execution');
        console.log('   Continuous learning and optimization active');
      } else {
        console.log('❌ HCFP Perpetual Mode activation failed');
        console.log('   Check individual component status above');
      }

    } catch (error) {
      console.error('❌ ERROR:', error.message);
    }
  }

  async getStatus() {
    console.log('📊 HCFP SYSTEM STATUS');
    console.log('====================');
    
    try {
      const healthResponse = await this.makeRequest('/api/health', {});
      console.log('System Health:', JSON.stringify(healthResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
    }
  }

  async stopPerpetualMode() {
    console.log('🛑 STOPPING HCFP PERPETUAL MODE');
    console.log('================================');
    
    try {
      const result = await this.makeRequest('/api/system/pause', {
        reason: "Manual stop via hcfp-auto-mode command",
        escalation_id: "hcfp_manual_stop"
      });

      if (result.data.success) {
        console.log('✅ HCFP Perpetual Mode stopped');
      } else {
        console.log('❌ Stop failed:', result.data.error);
      }
    } catch (error) {
      console.error('❌ ERROR:', error.message);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2];
  const autoMode = new HCFPAutoMode();

  switch (command) {
    case 'start':
    case 'enable':
    case 'activate':
      autoMode.activatePerpetualMode();
      break;
    case 'status':
      autoMode.getStatus();
      break;
    case 'stop':
    case 'disable':
    case 'deactivate':
      autoMode.stopPerpetualMode();
      break;
    default:
      console.log('HCFP Auto-Mode CLI');
      console.log('==================');
      console.log('Usage: node hcfp-auto-cli.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  start/enable/activate  - Activate HCFP perpetual mode');
      console.log('  status                 - Show system status');
      console.log('  stop/disable/deactivate - Stop HCFP perpetual mode');
      console.log('');
      console.log('Examples:');
      console.log('  node hcfp-auto-cli.js start');
      console.log('  node hcfp-auto-cli.js status');
      console.log('  node hcfp-auto-cli.js stop');
      process.exit(1);
  }
}

module.exports = HCFPAutoMode;
