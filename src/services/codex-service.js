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
// ║  FILE: src/services/codex-service.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const axios = require('axios');
const config = require('../configs/codex.yaml');

class CodexService {
  constructor() {
    this.apiBase = 'https://api.openai.com/v1';
    this.apiKey = process.env.CODEX_API_KEY || config.apiKey;
  }

  async getCompletion(context, options = {}) {
    const response = await axios.post(
      `${this.apiBase}/completions`,
      {
        model: options.model || config.defaultModel,
        prompt: context,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].text;
  }
}

module.exports = new CodexService();
