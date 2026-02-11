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
// ║  FILE: src/services/socratic-protocol.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { claude } = require('../hc_claude');
const path = require('path');

class SocraticProtocol {
  constructor() {
    this.maxDepth = 5;
    this.questionTemplates = [
      "How could {file} be improved?",
      "What patterns in {file} could be optimized?",
      "What technical debt exists in {file}?",
      "How could {file} better follow Heady architecture?"
    ];
  }

  async analyzeFile(filePath, content) {
    let improvements = [];
    let currentContent = content;
    
    for (let depth = 0; depth < this.maxDepth; depth++) {
      const question = this._generateQuestion(filePath, depth);
      const response = await this._askClaude(question, currentContent);
      
      if (!response || response === currentContent) break;
      
      improvements.push({
        depth,
        question,
        changes: response
      });
      
      currentContent = response;
    }
    
    return {
      file: path.basename(filePath),
      improvements,
      finalContent: currentContent
    };
  }

  _generateQuestion(filePath, depth) {
    const template = this.questionTemplates[depth % this.questionTemplates.length];
    return template.replace('{file}', path.basename(filePath));
  }

  async _askClaude(question, context) {
    const prompt = `Heady Socratic Analysis (Question ${question}):\n\n${context}`;
    return await claude.getCompletion('socratic-analysis', { prompt });
  }
}

module.exports = new SocraticProtocol();
