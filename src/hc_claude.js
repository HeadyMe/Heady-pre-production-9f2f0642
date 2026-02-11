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
// ║  FILE: src/hc_claude.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Claude Service (hc_claude.js)
 * 
 * Integration with Claude AI as a Heady service.
 * Handles conversation management, caching, and API integration.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  // Storage paths
  conversationsPath: './.heady_cache/claude/conversations.json',
  cachePath: './.heady_cache/claude/cache.json',
  
  // API settings
  apiBaseUrl: 'https://api.anthropic.com',
  apiVersion: '2023-06-01',
  maxTokens: 4096,
  
  // Conversation settings
  maxConversationLength: 20,
  conversationTimeoutMinutes: 60,
  
  // Caching
  cacheTtlMinutes: 1440, // 24 hours
};

// ============================================================================
// CLAUDE SERVICE CLASS
// ============================================================================

class ClaudeService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conversations = new Map();
    this.cache = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    // Ensure cache directory exists
    const cacheDir = path.dirname(this.config.conversationsPath);
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }
    
    // Load persisted state
    await this.loadConversations();
    await this.loadCache();
    
    this.initialized = true;
    console.log(`[Claude] Initialized with ${this.conversations.size} conversations`);
  }

  async loadConversations() {
    try {
      const data = await fs.readFile(this.config.conversationsPath, 'utf8');
      const conversations = JSON.parse(data);
      for (const c of conversations) {
        this.conversations.set(c.id, c);
      }
    } catch (e) {
      // No existing conversations
    }
  }

  async saveConversations() {
    const data = JSON.stringify(Array.from(this.conversations.values()), null, 2);
    await fs.writeFile(this.config.conversationsPath, data);
  }

  async loadCache() {
    try {
      const data = await fs.readFile(this.config.cachePath, 'utf8');
      const cache = JSON.parse(data);
      for (const c of cache) {
        this.cache.set(c.key, c);
      }
    } catch (e) {
      // No existing cache
    }
  }

  async saveCache() {
    const data = JSON.stringify(Array.from(this.cache.values()), null, 2);
    await fs.writeFile(this.config.cachePath, data);
  }

  // =========================================================================
  // CORE API METHODS
  // =========================================================================

  async createConversation() {
    const id = `conv_${crypto.randomUUID()}`;
    const conversation = {
      id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.conversations.set(id, conversation);
    await this.saveConversations();
    return conversation;
  }

  async addMessage(conversationId, role, content) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    const message = {
      id: `msg_${crypto.randomUUID()}`,
      role,
      content,
      timestamp: new Date(),
    };
    
    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    
    // Trim conversation if too long
    if (conversation.messages.length > this.config.maxConversationLength) {
      conversation.messages = conversation.messages.slice(-this.config.maxConversationLength);
    }
    
    await this.saveConversations();
    return message;
  }

  async getCompletion(conversationId, options = {}) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    // Check cache first
    const cacheKey = this.getCacheKey(conversation.messages, options);
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.response;
    }
    
    // Call Claude API (placeholder - would use actual API)
    const response = {
      completion: "This is a placeholder Claude response. Actual implementation would call the API.",
      stopReason: "max_tokens",
    };
    
    // Cache the response
    this.cache.set(cacheKey, {
      key: cacheKey,
      response,
      timestamp: new Date(),
    });
    await this.saveCache();
    
    return response;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  getCacheKey(messages, options) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({ messages, options }));
    return hash.digest('hex');
  }

  isCacheExpired(cacheEntry) {
    const ageMs = new Date() - new Date(cacheEntry.timestamp);
    return ageMs > this.config.cacheTtlMinutes * 60 * 1000;
  }

  getStats() {
    return {
      conversations: this.conversations.size,
      cacheHits: Array.from(this.cache.values()).filter(c => !this.isCacheExpired(c)).length,
      cacheSize: this.cache.size,
    };
  }
}

module.exports = new ClaudeService();
