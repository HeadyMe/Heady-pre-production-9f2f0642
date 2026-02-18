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
