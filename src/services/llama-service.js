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
// ║  FILE: src/services/llama-service.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const axios = require('axios');
const config = require('../configs/llama.yaml');

class LlamaService {
  constructor() {
    this.apiBase = config.apiEndpoint || 'https://api.llama.ai/v1';
    this.apiKey = process.env.LLAMA_API_KEY || config.apiKey;
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

module.exports = new LlamaService();
