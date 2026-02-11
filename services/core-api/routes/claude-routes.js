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
// ║  FILE: src/routes/claude-routes.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Claude API Routes (claude-routes.js)
 * 
 * REST API endpoints for the Claude service.
 * Provides: conversation management, completions, and caching.
 */

const { claude } = require('../hc_claude');
const express = require('express');
const router = express.Router();

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure claude service is initialized
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await claude.init();
    initialized = true;
  }
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * POST /api/claude/conversations
 * Create new conversation
 */
router.post('/conversations', async (req, res) => {
  await ensureInit();
  
  const conversation = await claude.createConversation();
  
  res.json({
    id: conversation.id,
    createdAt: conversation.createdAt,
    messageCount: conversation.messages.length
  });
});

/**
 * GET /api/claude/conversations/:id
 * Get conversation details
 */
router.get('/conversations/:id', async (req, res) => {
  await ensureInit();
  
  const conversation = claude.conversations.get(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
      timestamp: m.timestamp
    }))
  });
});

/**
 * POST /api/claude/conversations/:id/messages
 * Add message to conversation
 */
router.post('/conversations/:id/messages', async (req, res) => {
  await ensureInit();
  
  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: 'role and content are required' });
  }
  
  try {
    const message = await claude.addMessage(req.params.id, role, content);
    res.json({
      id: message.id,
      conversationId: req.params.id,
      role: message.role,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      timestamp: message.timestamp
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ============================================================================
// COMPLETIONS
// ============================================================================

/**
 * POST /api/claude/conversations/:id/completions
 * Get completion for conversation
 */
router.post('/conversations/:id/completions', async (req, res) => {
  await ensureInit();
  
  const { options = {} } = req.body;
  
  try {
    const completion = await claude.getCompletion(req.params.id, options);
    res.json({
      conversationId: req.params.id,
      completion: completion.completion,
      stopReason: completion.stopReason
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ============================================================================
// SYSTEM MANAGEMENT
// ============================================================================

/**
 * GET /api/claude/stats
 * Get service statistics
 */
router.get('/stats', async (req, res) => {
  await ensureInit();
  
  res.json(claude.getStats());
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
