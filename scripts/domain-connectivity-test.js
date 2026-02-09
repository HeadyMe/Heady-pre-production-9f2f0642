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
// ║  FILE: scripts/domain-connectivity-test.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const axios = require('axios');
const config = require('../configs/service-domains.yaml');

async function testDomainConnectivity() {
  const testResults = [];
  
  // Test all defined domains
  for (const [service, domains] of Object.entries(config)) {
    for (const [env, url] of Object.entries(domains)) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        testResults.push({
          service,
          environment: env,
          url,
          status: response.status,
          success: response.status === 200
        });
      } catch (error) {
        testResults.push({
          service,
          environment: env,
          url,
          status: error.response?.status || 'Timeout',
          success: false
        });
      }
    }
  }
  
  // Fail CI if any domain fails
  const failures = testResults.filter(r => !r.success);
  if (failures.length > 0) {
    console.error('Domain connectivity failures:', failures);
    process.exit(1);
  }
  
  console.log('All domains connected successfully');
}

testDomainConnectivity();
