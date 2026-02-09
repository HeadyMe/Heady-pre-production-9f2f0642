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
// ║  FILE: scripts/validate-branding.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const axios = require('axios');
const config = require('../configs/branding-standards.yaml');

async function validateBranding() {
  const testResults = [];
  
  for (const [page, expected] of Object.entries(config.pages)) {
    try {
      const response = await axios.get(page);
      const html = response.data;
      
      // Check title
      if (expected.title && !html.includes(`<title>${expected.title}</title>`)) {
        testResults.push({ page, check: 'title', passed: false });
      }
      
      // Check logo
      if (expected.logoPath && !html.includes(`src="${expected.logoPath}"`)) {
        testResults.push({ page, check: 'logo', passed: false });
      }
      
      // Check CSS class
      if (expected.brandingClass && !html.includes(`class="${expected.brandingClass}"`)) {
        testResults.push({ page, check: 'branding-class', passed: false });
      }
      
      // If all checks passed, record success
      if (testResults.filter(r => r.page === page && !r.passed).length === 0) {
        testResults.push({ page, passed: true });
      }
    } catch (error) {
      testResults.push({ page, error: error.message });
    }
  }
  
  // Fail CI if any branding check fails
  const failures = testResults.filter(r => !r.passed);
  if (failures.length > 0) {
    console.error('Branding validation failures:', failures);
    process.exit(1);
  }
  
  console.log('All branding checks passed');
}

validateBranding();
