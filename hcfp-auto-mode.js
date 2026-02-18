#!/usr/bin/env node
/**
 * 🚀 HCFullPipeline Auto-Mode Command
 * Triggers perpetual execution with dual-engine validation
 */

const http = require('http');

function triggerAutoMode() {
  console.log('🚀 HCFullPipeline Auto-Mode Trigger');
  console.log('=====================================');
  
  const data = JSON.stringify({
    request: {
      type: "hcfp_auto_mode",
      action: "Initialize HCFullPipeline perpetual execution",
      parameters: {
        validation: true,
        continuous: true,
        dualEngine: true,
        monteCarlo: true,
        socratic: true,
        learning: true,
      }
    },
    userConfig: {
      validation: true,
      continuous: true,
      autoDeploy: true,
      monitoring: true,
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3300,
    path: '/api/orchestrate/enhanced',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);
        console.log('RESPONSE:', JSON.stringify(response, null, 2));
        
        if (response.success) {
          console.log('✅ HCFullPipeline Auto-Mode activated successfully');
          console.log('🎯 Dual-Engine execution: ENABLED');
          console.log('🎲 Monte Carlo exploration: ENABLED');
          console.log('🤔 Socratic validation: ENABLED');
          console.log('🧠 Continuous learning: ENABLED');
        } else {
          console.log('❌ Auto-Mode activation failed');
          console.log('Error:', response.error);
        }
      } catch (error) {
        console.log('Raw Response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('ERROR:', error.message);
  });

  req.write(data);
  req.end();
}

// Alternative: Direct dual-engine trigger
function triggerDualEngine() {
  console.log('🎯 Direct Dual-Engine Trigger');
  console.log('==============================');
  
  const data = JSON.stringify({
    type: "system_control",
    action: "enable_dual_engine_auto_mode",
    description: "Enable universal dual-engine execution for all actions",
    parameters: {
      interceptAll: true,
      validateAll: true,
      learnAll: true,
      confidenceThreshold: 0.85,
      monteCarloIterations: 1000,
      socraticDepth: "deep",
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3300,
    path: '/api/brain/decide',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);
        console.log('RESPONSE:', JSON.stringify(response, null, 2));
        
        if (response.success) {
          console.log('✅ Dual-Engine Auto-Mode activated');
        } else {
          console.log('❌ Dual-Engine activation failed');
        }
      } catch (error) {
        console.log('Raw Response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('ERROR:', error.message);
  });

  req.write(data);
  req.end();
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'hcfp':
      triggerAutoMode();
      break;
    case 'dual':
      triggerDualEngine();
      break;
    default:
      console.log('Usage: node hcfp-auto-mode.js [hcfp|dual]');
      console.log('  hcfp - Trigger HCFullPipeline auto-mode');
      console.log('  dual - Trigger dual-engine auto-mode');
      process.exit(1);
  }
}

module.exports = { triggerAutoMode, triggerDualEngine };
