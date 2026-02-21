
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
// ║  FILE: promoter.js                                   ║
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
 * 🎼 CONDUCTOR API ROUTES - Multi-LLM Orchestration
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const CONDUCTORNode = require('../nodes/promoter');

const promoter = new CONDUCTORNode();

// Initialize CONDUCTOR
router.post('/initialize', async (req, res) => {
  try {
    await promoter.initialize();
    res.json({
      success: true,
      message: 'CONDUCTOR initialized successfully',
      status: promoter.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main orchestration endpoint
router.post('/orchestrate', async (req, res) => {
  const { task, options } = req.body;
  
  if (!task) {
    return res.status(400).json({
      error: 'Task is required',
    });
  }
  
  try {
    const response = await promoter.orchestrate(task, options || {});
    res.json(response);
  } catch (error) {
    console.error('[CONDUCTOR API] Orchestration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available providers
router.get('/providers', (req, res) => {
  try {
    const available = promoter.getAvailableProviders();
    res.json({
      providers: available,
      total: available.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test provider connections
router.get('/test-connections', async (req, res) => {
  try {
    const connections = await promoter.testProviderConnections();
    res.json({
      connections: connections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get CONDUCTOR status
router.get('/status', (req, res) => {
  try {
    res.json(promoter.getStatus());
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get performance metrics
router.get('/metrics', (req, res) => {
  try {
    res.json(promoter.performanceMetrics);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Compare providers for a task
router.post('/compare', async (req, res) => {
  const { task, providers } = req.body;
  
  try {
    const response = await promoter.orchestrate(task, {
      strategy: 'parallel',
      providers: providers || ['auto'],
      temperature: 0.7,
      maxTokens: 1000,
    });
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Build consensus across providers
router.post('/consensus', async (req, res) => {
  const { task, providers } = req.body;
  
  try {
    const response = await promoter.orchestrate(task, {
      strategy: 'consensus',
      providers: providers || ['claude', 'gemini', 'ollama'],
      temperature: 0.5,
      maxTokens: 2000,
    });
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
