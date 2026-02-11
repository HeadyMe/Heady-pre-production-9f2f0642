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
// ║  FILE: src/services/gemini-service.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const axios = require('axios');
const config = require('../configs/gemini.yaml');

class GeminiService {
  constructor() {
    this.apiBase = 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = process.env.GEMINI_API_KEY || config.apiKey;
  }

  async getCompletion(context, options = {}) {
    const response = await axios.post(
      `${this.apiBase}/models/${options.model || config.defaultModel}:generateContent`,
      {
        contents: [{
          parts: [{
            text: context
          }]
        }]
      },
      {
        params: { key: this.apiKey },
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    return response.data.candidates[0].content.parts[0].text;
  }
}

module.exports = new GeminiService();
