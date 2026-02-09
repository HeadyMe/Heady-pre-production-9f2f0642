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
// ║  FILE: src/self-awareness.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const { validateBranding } = require('./validate-branding');
const { fixBrandingViolations } = require('./migrate-localhost-to-domains');

function startBrandingMonitor() {
  setInterval(() => {
    try {
      const violations = validateBranding();
      if (violations.length > 0) {
        console.warn(`Found ${violations.length} branding violations`);
        if (process.env.AUTO_FIX_BRANDING === 'true') {
          fixBrandingViolations();
          console.log('Fixed branding violations');
        }
      }
    } catch (error) {
      console.error('Branding monitor error:', error);
    }
  }, 60 * 60 * 1000); // Hourly
}

module.exports = { startBrandingMonitor };
