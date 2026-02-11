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
// ║  FILE: src/services/file-scanner.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs').promises;
const path = require('path');
const socratic = require('./socratic-protocol');
const { imagination } = require('../hc_imagination');
const { patternEngine } = require('../hc_pattern_engine');

class FileScanner {
  constructor() {
    this.scanHistory = new Map();
    this.ignoredDirs = new Set(['node_modules', '.git', '.heady_cache']);
    this.useFullServices = process.env.HEADY_FULL_SERVICES !== 'false';
    this.userModel = process.env.HEADY_USER_MODEL || 'claude-2.1';
  }

  async scanProject(rootPath) {
    const results = [];
    const files = await this._getCodeFiles(rootPath);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const analysis = await socratic.analyzeFile(file, content);
        
        if (analysis.improvements.length > 0) {
          await fs.writeFile(file, analysis.finalContent);
          if (this.useFullServices) {
            await this._recordPatterns(file, analysis);
          }
          results.push(analysis);
        }
      } catch (err) {
        console.error(`Error scanning ${file}:`, err);
      }
    }
    
    return results;
  }

  async _getCodeFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!this.ignoredDirs.has(entry.name)) {
          files.push(...await this._getCodeFiles(fullPath));
        }
      } else if (this._isCodeFile(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  _isCodeFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.js', '.py', '.ts', '.json', '.yaml', '.md'].includes(ext);
  }

  async _recordPatterns(file, analysis) {
    for (const imp of analysis.improvements) {
      await patternEngine.observe('code_improvement', {
        file,
        question: imp.question,
        changes: imp.changes
      });
      
      await imagination.recordPrimitive({
        type: 'code_improvement',
        source: 'socratic_scanner',
        content: imp.changes
      });
    }
  }
}

module.exports = new FileScanner();
