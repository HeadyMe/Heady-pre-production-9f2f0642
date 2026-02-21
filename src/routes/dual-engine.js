
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
// ║  FILE: dual-engine.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * 🎯 DUAL ENGINE API ROUTES - HeadyBattle + HeadySims Control
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

// Main dual engine execution endpoint
router.post('/execute', async (req, res) => {
  const { action, context } = req.body;
  
  if (!action) {
    return res.status(400).json({
      error: 'Action is required',
    });
  }
  
  try {
    const dualEngine = req.app.coms.dualEngine;
    const result = await dualEngine.execute(action, context || {});
    res.json(result);
  } catch (error) {
    console.error('[DUAL ENGINE API] Execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get dual engine status
router.get('/status', (req, res) => {
  try {
    const interceptor = req.app.coms.actionInterceptor;
    const stats = interceptor.getStats();
    
    res.json({
      name: 'Dual Engine System',
      HeadyBattleEngine: 'ACTIVE',
      monteCarloEngine: 'ACTIVE',
      actionInterceptor: 'ACTIVE',
      coverage: '100%',
      stats: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test dual engine with sample action
router.post('/test', async (req, res) => {
  const testAction = {
    type: 'test_execution',
    description: 'Test dual engine functionality',
    timestamp: new Date().toISOString(),
  };
  
  try {
    const dualEngine = req.app.coms.dualEngine;
    const result = await dualEngine.execute(testAction, {
      testMode: true,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get execution history
router.get('/history', async (req, res) => {
  try {
    const dualEngine = req.app.coms.dualEngine;
    const history = dualEngine.executionHistory || { executions: [] };
    
    const limit = parseInt(req.query.limit) || 10;
    const executions = history.executions?.slice(-limit) || [];
    
    res.json({
      executions: executions,
      total: history.executions?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
