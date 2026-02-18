/**
 * ═══════════════════════════════════════════════════════════════
 * 🎼 CONDUCTOR API ROUTES - Multi-LLM Orchestration
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const CONDUCTORNode = require('../nodes/conductor');

const conductor = new CONDUCTORNode();

// Initialize CONDUCTOR
router.post('/initialize', async (req, res) => {
  try {
    await conductor.initialize();
    res.json({
      success: true,
      message: 'CONDUCTOR initialized successfully',
      status: conductor.getStatus(),
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
    const response = await conductor.orchestrate(task, options || {});
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
    const available = conductor.getAvailableProviders();
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
    const connections = await conductor.testProviderConnections();
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
    res.json(conductor.getStatus());
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
    res.json(conductor.performanceMetrics);
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
    const response = await conductor.orchestrate(task, {
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
    const response = await conductor.orchestrate(task, {
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
