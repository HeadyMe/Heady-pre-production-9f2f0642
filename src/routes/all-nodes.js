/**
 * ═══════════════════════════════════════════════════════════════
 * 🔗 ALL-NODES API ROUTES - Complete AI Collaboration
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const AllNodeOrchestrator = require('../orchestration/all-node-orchestrator');

const orchestrator = new AllNodeOrchestrator();

// Initialize all nodes
router.post('/initialize', async (req, res) => {
  try {
    await orchestrator.initialize();
    res.json({
      success: true,
      message: 'All nodes initialized successfully',
      status: orchestrator.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main processing endpoint with all nodes
router.post('/process', async (req, res) => {
  const { request, options } = req.body;
  
  if (!request) {
    return res.status(400).json({
      error: 'Request is required',
    });
  }
  
  try {
    const response = await orchestrator.processWithAllNodes(request, options || {});
    res.json(response);
  } catch (error) {
    console.error('[ALL-NODES API] Processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get orchestrator status
router.get('/status', (req, res) => {
  try {
    res.json(orchestrator.getStatus());
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get collaboration metrics
router.get('/metrics', (req, res) => {
  try {
    res.json(orchestrator.collaborationMetrics);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get execution history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    res.json({
      history: orchestrator.executionHistory.slice(-limit),
      total: orchestrator.executionHistory.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute with specific node subset
router.post('/execute-nodes', async (req, res) => {
  const { request, nodes, options } = req.body;
  
  if (!request) {
    return res.status(400).json({
      error: 'Request is required',
    });
  }
  
  try {
    // Custom execution with specified nodes
    const result = await orchestrator.processWithAllNodes(request, {
      ...options,
      preferredNodes: nodes,
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get node-specific status
router.get('/node/:nodeName/status', async (req, res) => {
  const { nodeName } = req.params;
  
  try {
    const node = orchestrator.nodes[nodeName];
    if (!node) {
      return res.status(404).json({
        error: `Node ${nodeName} not found`,
      });
    }
    
    const status = node.getStatus ? node.getStatus() : { 
      name: nodeName, 
      active: !!node 
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute specific node
router.post('/node/:nodeName/execute', async (req, res) => {
  const { nodeName } = req.params;
  const { intent, context } = req.body;
  
  try {
    const result = await orchestrator.executeNode(nodeName, 'execute', [intent, context]);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available nodes
router.get('/nodes', (req, res) => {
  try {
    const nodes = Object.keys(orchestrator.nodes).map(name => ({
      name: name,
      active: !!orchestrator.nodes[name],
      status: orchestrator.nodes[name]?.getStatus ? 
        orchestrator.nodes[name].getStatus() : 
        { active: !!orchestrator.nodes[name] }
    }));
    
    res.json({
      nodes: nodes,
      total: nodes.length,
      active: nodes.filter(n => n.active).length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
