/**
 * 🧠 Claude Code Integration - Advanced AI Development Assistant
 * Integrates Claude Code capabilities with Heady ecosystem
 */

class ClaudeCodeIntegration {
  constructor() {
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    this.sessionContext = new Map();
    this.codeCache = new Map();
    this.activeProjects = new Set();
  }

  /**
   * Initialize Claude Code integration
   */
  async initialize() {
    console.log('🧠 Initializing Claude Code Integration...');
    
    // Validate API keys
    if (!this.claudeApiKey) {
      throw new Error('Claude API key not found in environment variables');
    }
    
    if (!this.perplexityApiKey) {
      throw new Error('Perplexity API key not found in environment variables');
    }

    // Initialize Claude Code session
    await this.initializeClaudeSession();
    
    // Initialize Perplexity for research
    await this.initializePerplexity();
    
    console.log('✅ Claude Code Integration initialized');
    return {
      claude: 'connected',
      perplexity: 'connected',
      capabilities: [
        'code_generation',
        'code_review',
        'debugging',
        'architecture_design',
        'documentation',
        'research',
        'optimization'
      ]
    };
  }

  /**
   * Initialize Claude Code session
   */
  async initializeClaudeSession() {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: 'Initialize Claude Code integration for Heady ecosystem. Confirm you are ready for advanced development tasks.'
          }]
        })
      });

      const data = await response.json();
      if (data.content && data.content[0]) {
        console.log('✅ Claude Code session initialized');
        return true;
      }
    } catch (error) {
      console.error('❌ Claude initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize Perplexity for research
   */
  async initializePerplexity() {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.perplexityApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: 'Initialize Perplexity integration for Heady research capabilities.'
          }],
          max_tokens: 100
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        console.log('✅ Perplexity integration initialized');
        return true;
      }
    } catch (error) {
      console.error('❌ Perplexity initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Generate code with Claude
   */
  async generateCode(prompt, language = 'javascript', context = {}) {
    const cacheKey = `code_${language}_${prompt.substring(0, 50)}`;
    
    if (this.codeCache.has(cacheKey)) {
      return this.codeCache.get(cacheKey);
    }

    try {
      const enhancedPrompt = this.buildCodePrompt(prompt, language, context);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: enhancedPrompt
          }]
        })
      });

      const data = await response.json();
      const generatedCode = data.content[0].text;
      
      // Cache the result
      this.codeCache.set(cacheKey, generatedCode);
      
      return {
        code: generatedCode,
        language,
        confidence: 0.95,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code generation failed:', error.message);
      return null;
    }
  }

  /**
   * Review code with Claude
   */
  async reviewCode(code, language = 'javascript') {
    try {
      const reviewPrompt = `
Review this ${language} code for:
1. Code quality and best practices
2. Security vulnerabilities
3. Performance optimization opportunities
4. Maintainability and readability
5. Potential bugs or edge cases

Code to review:
\`\`\`${language}
${code}
\`\`\`

Provide detailed feedback with specific line references and improvement suggestions.
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: reviewPrompt
          }]
        })
      });

      const data = await response.json();
      const review = data.content[0].text;
      
      return {
        review,
        score: this.calculateCodeQualityScore(review),
        suggestions: this.extractSuggestions(review),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code review failed:', error.message);
      return null;
    }
  }

  /**
   * Debug code with Claude
   */
  async debugCode(code, error, language = 'javascript') {
    try {
      const debugPrompt = `
Debug this ${language} code that's producing the following error:

Error: ${error}

Code:
\`\`\`${language}
${code}
\`\`\`

Please:
1. Identify the root cause of the error
2. Explain what's happening step by step
3. Provide the corrected code
4. Suggest preventive measures for similar issues
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: debugPrompt
          }]
        })
      });

      const data = await response.json();
      const debugInfo = data.content[0].text;
      
      return {
        debugInfo,
        correctedCode: this.extractCorrectedCode(debugInfo),
        rootCause: this.extractRootCause(debugInfo),
        prevention: this.extractPrevention(debugInfo),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code debugging failed:', error.message);
      return null;
    }
  }

  /**
   * Research with Perplexity
   */
  async research(query, context = {}) {
    try {
      const researchPrompt = this.buildResearchPrompt(query, context);
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.perplexityApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: researchPrompt
          }],
          max_tokens: 2000,
          temperature: 0.1
        })
      });

      const data = await response.json();
      const research = data.choices[0].message.content;
      
      return {
        research,
        sources: this.extractSources(research),
        confidence: 0.85,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Research failed:', error.message);
      return null;
    }
  }

  /**
   * Optimize code with Claude
   */
  async optimizeCode(code, language = 'javascript', optimizationGoals = []) {
    try {
      const optimizationPrompt = `
Optimize this ${language} code for the following goals:
${optimizationGoals.map(goal => `- ${goal}`).join('\n')}

Original code:
\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Optimized code with explanations
2. Performance improvements achieved
3. Any trade-offs made
4. Benchmarking suggestions
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: optimizationPrompt
          }]
        })
      });

      const data = await response.json();
      const optimization = data.content[0].text;
      
      return {
        optimizedCode: this.extractOptimizedCode(optimization),
        improvements: this.extractImprovements(optimization),
        tradeoffs: this.extractTradeoffs(optimization),
        benchmarks: this.extractBenchmarks(optimization),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code optimization failed:', error.message);
      return null;
    }
  }

  /**
   * Generate documentation with Claude
   */
  async generateDocumentation(code, language = 'javascript', docType = 'api') {
    try {
      const docPrompt = `
Generate comprehensive ${docType} documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Please include:
1. Overview and purpose
2. Function/method descriptions
3. Parameters and return values
4. Usage examples
5. Error handling
6. Dependencies
7. Performance considerations
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: docPrompt
          }]
        })
      });

      const data = await response.json();
      const documentation = data.content[0].text;
      
      return {
        documentation,
        format: 'markdown',
        completeness: this.assessDocumentationCompleteness(documentation),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Documentation generation failed:', error.message);
      return null;
    }
  }

  /**
   * Build enhanced code prompt
   */
  buildCodePrompt(prompt, language, context) {
    let enhancedPrompt = `Generate ${language} code for: ${prompt}\n\n`;
    
    if (context.framework) {
      enhancedPrompt += `Framework: ${context.framework}\n`;
    }
    
    if (context.style) {
      enhancedPrompt += `Code style: ${context.style}\n`;
    }
    
    if (context.dependencies) {
      enhancedPrompt += `Dependencies: ${context.dependencies.join(', ')}\n`;
    }
    
    enhancedPrompt += `\nRequirements:\n`;
    enhancedPrompt += `- Follow best practices and modern ${language} conventions\n`;
    enhancedPrompt += `- Include error handling and validation\n`;
    enhancedPrompt += `- Add comprehensive comments\n`;
    enhancedPrompt += `- Ensure code is production-ready\n`;
    
    return enhancedPrompt;
  }

  /**
   * Build research prompt
   */
  buildResearchPrompt(query, context) {
    let researchPrompt = `Research: ${query}\n\n`;
    
    if (context.domain) {
      researchPrompt += `Domain: ${context.domain}\n`;
    }
    
    if (context.timeframe) {
      researchPrompt += `Timeframe: ${context.timeframe}\n`;
    }
    
    if (context.depth) {
      researchPrompt += `Depth: ${context.depth}\n`;
    }
    
    researchPrompt += `\nPlease provide:\n`;
    researchPrompt += `- Current state of the art\n`;
    researchPrompt += `- Key concepts and terminology\n`;
    researchPrompt += `- Best practices and standards\n`;
    researchPrompt += `- Recent developments and trends\n`;
    researchPrompt += `- Relevant tools and technologies\n`;
    
    return researchPrompt;
  }

  /**
   * Calculate code quality score
   */
  calculateCodeQualityScore(review) {
    const positiveIndicators = ['excellent', 'good', 'well-structured', 'clean', 'efficient'];
    const negativeIndicators = ['poor', 'bad', 'inefficient', 'bug', 'error', 'issue'];
    
    let score = 0.5; // Base score
    
    positiveIndicators.forEach(indicator => {
      if (review.toLowerCase().includes(indicator)) {
        score += 0.1;
      }
    });
    
    negativeIndicators.forEach(indicator => {
      if (review.toLowerCase().includes(indicator)) {
        score -= 0.1;
      }
    });
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Extract suggestions from review
   */
  extractSuggestions(review) {
    const suggestions = [];
    const lines = review.split('\n');
    
    lines.forEach(line => {
      if (line.includes('suggest') || line.includes('recommend') || line.includes('improve')) {
        suggestions.push(line.trim());
      }
    });
    
    return suggestions;
  }

  /**
   * Extract corrected code from debug info
   */
  extractCorrectedCode(debugInfo) {
    const codeMatch = debugInfo.match(/```[\w]*\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : null;
  }

  /**
   * Extract root cause from debug info
   */
  extractRootCause(debugInfo) {
    const lines = debugInfo.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('root cause') || line.toLowerCase().includes('the issue is')) {
        return line.trim();
      }
    }
    return 'Root cause not clearly identified';
  }

  /**
   * Extract prevention measures from debug info
   */
  extractPrevention(debugInfo) {
    const prevention = [];
    const lines = debugInfo.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('prevent') || line.toLowerCase().includes('avoid')) {
        prevention.push(line.trim());
      }
    });
    
    return prevention;
  }

  /**
   * Extract sources from research
   */
  extractSources(research) {
    const sources = [];
    const lines = research.split('\n');
    
    lines.forEach(line => {
      if (line.includes('Source:') || line.includes('Reference:')) {
        sources.push(line.trim());
      }
    });
    
    return sources;
  }

  /**
   * Extract optimized code
   */
  extractOptimizedCode(optimization) {
    const codeMatch = optimization.match(/```[\w]*\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : null;
  }

  /**
   * Extract improvements
   */
  extractImprovements(optimization) {
    const improvements = [];
    const lines = optimization.split('\n');
    
    lines.forEach(line => {
      if (line.includes('improved') || line.includes('optimized') || line.includes('faster')) {
        improvements.push(line.trim());
      }
    });
    
    return improvements;
  }

  /**
   * Extract tradeoffs
   */
  extractTradeoffs(optimization) {
    const tradeoffs = [];
    const lines = optimization.split('\n');
    
    lines.forEach(line => {
      if (line.includes('tradeoff') || line.includes('compromise') || line.includes('balance')) {
        tradeoffs.push(line.trim());
      }
    });
    
    return tradeoffs;
  }

  /**
   * Extract benchmarks
   */
  extractBenchmarks(optimization) {
    const benchmarks = [];
    const lines = optimization.split('\n');
    
    lines.forEach(line => {
      if (line.includes('benchmark') || line.includes('performance') || line.includes('speed')) {
        benchmarks.push(line.trim());
      }
    });
    
    return benchmarks;
  }

  /**
   * Assess documentation completeness
   */
  assessDocumentationCompleteness(documentation) {
    const sections = ['overview', 'parameters', 'examples', 'error handling'];
    let completeness = 0;
    
    sections.forEach(section => {
      if (documentation.toLowerCase().includes(section)) {
        completeness += 0.25;
      }
    });
    
    return Math.min(1, completeness);
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      claude: {
        connected: !!this.claudeApiKey,
        model: 'claude-3-sonnet-20240229',
        capabilities: ['code_generation', 'review', 'debugging', 'optimization', 'documentation']
      },
      perplexity: {
        connected: !!this.perplexityApiKey,
        model: 'llama-3.1-sonar-small-128k-online',
        capabilities: ['research', 'knowledge_base', 'real_time_info']
      },
      cache: {
        size: this.codeCache.size,
        sessions: this.sessionContext.size,
        activeProjects: this.activeProjects.size
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { ClaudeCodeIntegration };
