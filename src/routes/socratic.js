/**
 * ═══════════════════════════════════════════════════════════════
 * 🧠 SOCRATIC API ROUTES - Question Everything
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const SOCRATESNode = require('../nodes/socrates');

const socrates = new SOCRATESNode();

// Initialize SOCRATES
router.post('/initialize', async (req, res) => {
  try {
    await socrates.initialize();
    res.json({
      success: true,
      message: 'SOCRATES initialized successfully',
      status: socrates.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Main Socratic questioning endpoint
router.post('/question', async (req, res) => {
  const { request, context } = req.body;
  
  if (!request) {
    return res.status(400).json({
      error: 'Request is required',
    });
  }
  
  try {
    const response = await socrates.processRequest(request, context || {});
    res.json(response);
  } catch (error) {
    console.error('[SOCRATIC API] Question processing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get SOCRATES status
router.get('/status', (req, res) => {
  try {
    res.json(socrates.getStatus());
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get question history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    res.json({
      history: socrates.questionHistory.slice(-limit),
      total: socrates.questionHistory.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Clarify user response to Socratic questions
router.post('/clarify', async (req, res) => {
  const { originalRequest, questions, answers } = req.body;
  
  try {
    // Process user's answers to Socratic questions
    const clarifiedIntent = await socrates.processClarification(
      originalRequest,
      questions,
      answers
    );
    
    res.json({
      success: true,
      clarifiedIntent: clarifiedIntent,
      nextSteps: 'Proceeding with clarified intent',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
