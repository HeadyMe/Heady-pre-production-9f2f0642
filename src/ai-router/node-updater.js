// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██║  ██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: node-updater.js                              ║
// ║  UPDATED: 20260219-220000                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🤖 AI Node Updater - Intelligent Routing Integration
 * Updates all AI nodes to use centralized hc-ai-router
 */

const fs = require('fs');
const path = require('path');

class AINodeUpdater {
  constructor() {
    this.nodesPath = '/home/headyme/CascadeProjects/Heady/src/nodes';
    this.aiRouterPath = '/home/headyme/CascadeProjects/Heady/packages/hc-ai-router';
    this.updatedNodes = [];
    this.errors = [];
  }

  /**
   * 🚀 Update all AI nodes to use centralized routing
   */
  async updateAllNodes() {
    console.log('🔄 Starting AI Node Routing Integration...\n');

    try {
      // Step 1: Discover AI nodes
      const nodes = await this.discoverNodes();
      console.log(`📊 Found ${nodes.length} AI nodes to update\n`);

      // Step 2: Update each node
      for (const node of nodes) {
        await this.updateNode(node);
      }

      // Step 3: Generate integration report
      await this.generateReport();

      console.log('\n✅ AI Node Routing Integration Complete!');
      console.log(`📈 Updated: ${this.updatedNodes.length} nodes`);
      console.log(`❌ Errors: ${this.errors.length} nodes`);

    } catch (error) {
      console.error('❌ Node update failed:', error);
    }
  }

  /**
   * 🔍 Discover AI nodes in the codebase
   */
  async discoverNodes() {
    const nodes = [];

    try {
      const files = fs.readdirSync(this.nodesPath);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const filePath = path.join(this.nodesPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check if file contains AI node patterns
          if (this.isAINode(content, file)) {
            const nodeId = this.extractNodeId(content, file);
            nodes.push({
              id: nodeId,
              file: file,
              path: filePath,
              content: content,
              capabilities: this.extractCapabilities(content)
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to discover nodes:', error);
    }

    return nodes;
  }

  /**
   * 🎯 Check if file is an AI node
   */
  isAINode(content, filename) {
    const aiPatterns = [
      /class\s+\w+Node/i,
      /anthropic|openai|claude|gpt|gemini/i,
      /api.*key|api.*call/i,
      /llm|ai.*model/i,
      /promoter|brain|jules|pythia|muse|socrates/i
    ];

    return aiPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 🏷️ Extract node ID from content
   */
  extractNodeId(content, filename) {
    const nameMatch = content.match(/class\s+(\w+)Node/i);
    if (nameMatch) return nameMatch[1].toUpperCase();
    
    const idMatch = content.match(/nodeId\s*:\s*['"]([^'"]+)['"]/i);
    if (idMatch) return idMatch[1];
    
    return path.basename(filename, '.js').toUpperCase();
  }

  /**
   * 🔧 Extract node capabilities
   */
  extractCapabilities(content) {
    const capabilities = [];
    
    if (content.includes('code') || content.includes('generate')) {
      capabilities.push('code_generation');
    }
    if (content.includes('reason') || content.includes('analysis')) {
      capabilities.push('deep_reasoning');
    }
    if (content.includes('embed') || content.includes('vector')) {
      capabilities.push('embeddings');
    }
    if (content.includes('image') || content.includes('vision')) {
      capabilities.push('multimodal');
    }
    if (content.includes('error') || content.includes('debug')) {
      capabilities.push('error_analysis');
    }
    
    return capabilities.length > 0 ? capabilities : ['general_chat'];
  }

  /**
   * 🔄 Update individual node
   */
  async updateNode(node) {
    console.log(`🔄 Updating node: ${node.id}`);

    try {
      // Step 1: Add AI router import
      let updatedContent = this.addRouterImport(node.content);
      
      // Step 2: Replace direct API calls with router calls
      updatedContent = this.replaceDirectCalls(updatedContent, node);
      
      // Step 3: Add routing context
      updatedContent = this.addRoutingContext(updatedContent, node);
      
      // Step 4: Save updated file
      this.saveUpdatedNode(node.path, updatedContent);
      
      this.updatedNodes.push(node.id);
      console.log(`   ✅ ${node.id} updated successfully`);

    } catch (error) {
      this.errors.push({ node: node.id, error: error.message });
      console.log(`   ❌ ${node.id} update failed: ${error.message}`);
    }
  }

  /**
   * 📦 Add AI router import
   */
  addRouterImport(content) {
    const routerImport = `const { getAiRouter, routeTask } = require('../packages/hc-ai-router');`;
    
    // Add after existing imports
    const lines = content.split('\n');
    const lastImportIndex = lines.findIndex(line => 
      line.startsWith('const ') && line.includes('require')
    );
    
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, routerImport);
    } else {
      lines.unshift(routerImport);
    }
    
    return lines.join('\n');
  }

  /**
   * 🔄 Replace direct API calls with router calls
   */
  replaceDirectCalls(content, node) {
    // Replace OpenAI calls
    content = content.replace(
      /openai\..*\.create\(([^)]+)\)/g,
      'await routeTask("code_generation", "' + node.id.toLowerCase() + '", $1)'
    );
    
    // Replace Anthropic calls
    content = content.replace(
      /anthropic\..*\.create\(([^)]+)\)/g,
      'await routeTask("deep_reasoning", "' + node.id.toLowerCase() + '", $1)'
    );
    
    // Replace Google calls
    content = content.replace(
      /google\..*\.generateContent\(([^)]+)\)/g,
      'await routeTask("multimodal", "' + node.id.toLowerCase() + '", $1)'
    );
    
    return content;
  }

  /**
   * 🎯 Add routing context
   */
  addRoutingContext(content, node) {
    const contextMethod = `
  /**
   * 🧠 Get routing context for AI tasks
   */
  getRoutingContext(taskKind, options = {}) {
    return {
      kind: taskKind,
      nodeId: '${node.id}',
      ors: this.getORS() || 85,
      estTokens: options.tokens || 1000,
      latencySensitivity: options.latency || 'medium',
      importance: options.importance || 'user_facing',
      traceId: this.generateTraceId(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 📊 Get current ORS (Operational Readiness Score)
   */
  getORS() {
    // This would integrate with your ORS monitoring system
    return 85; // Default for now
  }

  /**
   * 🏷️ Generate trace ID for routing
   */
  generateTraceId() {
    return \`trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}\`;
  }
`;

    // Add before the last closing brace
    const lastBraceIndex = content.lastIndexOf('}');
    if (lastBraceIndex >= 0) {
      return content.slice(0, lastBraceIndex) + contextMethod + '\n' + content.slice(lastBraceIndex);
    }
    
    return content + contextMethod;
  }

  /**
   * 💾 Save updated node
   */
  saveUpdatedNode(filePath, content) {
    // Create backup
    const backupPath = filePath + '.backup.' + Date.now();
    fs.copyFileSync(filePath, backupPath);
    
    // Save updated content
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 📊 Generate integration report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalNodes: this.updatedNodes.length + this.errors.length,
        updatedNodes: this.updatedNodes.length,
        errors: this.errors.length
      },
      updatedNodes: this.updatedNodes,
      errors: this.errors,
      recommendations: this.generateRecommendations()
    };

    const reportPath = '/home/headyme/ai-node-integration-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Integration report saved to: ${reportPath}`);
  }

  /**
   * 💡 Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.errors.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix node integration errors',
        description: `${this.errors.length} nodes failed to update. Review error logs and manually fix.`,
        nodes: this.errors.map(e => e.node)
      });
    }

    if (this.updatedNodes.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Test updated nodes',
        description: 'Verify that all updated nodes work correctly with the new routing system.',
        nodes: this.updatedNodes
      });
    }

    recommendations.push({
      priority: 'low',
      action: 'Monitor routing performance',
      description: 'Set up monitoring to track routing decisions and optimize provider selection.'
    });

    return recommendations;
  }
}

// Execute if run directly
if (require.main === module) {
  const updater = new AINodeUpdater();
  updater.updateAllNodes().catch(console.error);
}

module.exports = AINodeUpdater;
