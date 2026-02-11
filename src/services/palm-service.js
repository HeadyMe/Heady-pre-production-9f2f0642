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
// ║  FILE: src/services/palm-service.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const axios = require('axios');
const config = require('../configs/palm.yaml');

class PaLMService {
  constructor() {
    this.apiBase = 'https://generativelanguage.googleapis.com/v1beta2';
    this.apiKey = process.env.PALM_API_KEY || config.apiKey;
  }

  async getCompletion(context, options = {}) {
    const response = await axios.post(
      `${this.apiBase}/models/${options.model || config.defaultModel}:generateText`,
      {
        prompt: { text: context },
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 2048
      },
      {
        params: { key: this.apiKey },
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    return response.data.candidates[0].output;
  }
}

module.exports = new PaLMService();
