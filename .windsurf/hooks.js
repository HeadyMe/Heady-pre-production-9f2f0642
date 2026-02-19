
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
// ║  FILE: hooks.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * Windsurf IDE Hooks - Forces memory scan
 */

const { getHeadyMemory } = require('../src/heady-memory-wrapper');

module.exports = {
  beforeOperation: async (operation, context) => {
    console.log('[Windsurf Hook] FORCING memory scan before:', operation);
    const memory = getHeadyMemory();
    const scan = await memory.mandatoryScan({ operation, context });
    return scan;
  },
  
  afterOperation: async (operation, result) => {
    console.log('[Windsurf Hook] Ingesting to memory after:', operation);
    const memory = getHeadyMemory();
    await memory.store('windsurf_operation', {
      operation,
      result: typeof result === 'string' ? result.substring(0, 500) : result,
      timestamp: new Date().toISOString()
    }, ['windsurf', operation], 'windsurf');
  }
};
✅ SCANNED: 20260218-210803
