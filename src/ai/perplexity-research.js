/**
 * 🔍 Perplexity Research Integration - Advanced Knowledge & Research
 * Integrates Perplexity AI for real-time research and knowledge discovery
 */

class PerplexityResearch {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.researchCache = new Map();
    this.knowledgeBase = new Map();
    this.activeQueries = new Set();
    this.researchHistory = [];
  }

  /**
   * Initialize Perplexity research integration
   */
  async initialize() {
    console.log('🔍 Initializing Perplexity Research Integration...');
    
    if (!this.apiKey) {
      throw new Error('Perplexity API key not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to Perplexity API');
    }

    console.log('✅ Perplexity Research Integration initialized');
    return {
      status: 'connected',
      model: 'llama-3.1-sonar-small-128k-online',
      capabilities: [
        'real_time_research',
        'knowledge_discovery',
        'fact_checking',
        'trend_analysis',
        'technical_documentation',
        'market_research'
      ]
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: 'Test connection - respond with "connected"'
          }],
          max_tokens: 10
        })
      });

      const data = await response.json();
      return data.choices && data.choices[0];
    } catch (error) {
      console.error('❌ Perplexity connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Perform comprehensive research
   */
  async research(query, options = {}) {
    const queryId = this.generateQueryId(query);
    this.activeQueries.add(queryId);

    try {
      const researchPrompt = this.buildResearchPrompt(query, options);
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options.model || 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: researchPrompt
          }],
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.1,
          top_p: options.topP || 0.9
        })
      });

      const data = await response.json();
      const research = data.choices[0].message.content;
      
      const result = {
        queryId,
        query,
        research,
        sources: this.extractSources(research),
        confidence: this.calculateConfidence(research),
        timestamp: Date.now(),
        options
      };

      // Cache the result
      this.researchCache.set(queryId, result);
      this.researchHistory.push(result);
      
      // Keep only last 100 research results
      if (this.researchHistory.length > 100) {
        this.researchHistory = this.researchHistory.slice(-100);
      }

      return result;
    } catch (error) {
      console.error('❌ Research failed:', error.message);
      return null;
    } finally {
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Real-time fact checking
   */
  async factCheck(statement, context = {}) {
    try {
      const factCheckPrompt = `
Fact check this statement: "${statement}"

Context: ${context.domain || 'general'}
Timeframe: ${context.timeframe || 'current'}

Please provide:
1. Factual accuracy assessment (true/false/partially true)
2. Supporting evidence and sources
3. Any relevant counterarguments
4. Confidence level in the assessment
      `;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: factCheckPrompt
          }],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      const data = await response.json();
      const factCheck = data.choices[0].message.content;
      
      return {
        statement,
        accuracy: this.extractAccuracy(factCheck),
        evidence: this.extractEvidence(factCheck),
        counterarguments: this.extractCounterarguments(factCheck),
        confidence: this.extractConfidence(factCheck),
        sources: this.extractSources(factCheck),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Fact checking failed:', error.message);
      return null;
    }
  }

  /**
   * Trend analysis
   */
  async analyzeTrends(topic, timeframe = '6months', domain = 'technology') {
    try {
      const trendPrompt = `
Analyze current trends for: ${topic}

Domain: ${domain}
Timeframe: ${timeframe}

Please provide:
1. Current trending patterns
2. Emerging technologies or approaches
3. Market adoption rates
4. Key players and innovations
5. Future predictions
6. Potential opportunities and challenges
      `;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: trendPrompt
          }],
          max_tokens: 2000,
          temperature: 0.2
        })
      });

      const data = await response.json();
      const analysis = data.choices[0].message.content;
      
      return {
        topic,
        domain,
        timeframe,
        trends: this.extractTrends(analysis),
        innovations: this.extractInnovations(analysis),
        predictions: this.extractPredictions(analysis),
        opportunities: this.extractOpportunities(analysis),
        challenges: this.extractChallenges(analysis),
        sources: this.extractSources(analysis),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Trend analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Technical documentation research
   */
  async researchDocumentation(technology, aspect = 'overview') {
    try {
      const docPrompt = `
Research technical documentation for: ${technology}

Aspect: ${aspect}

Please provide:
1. Comprehensive overview
2. Key features and capabilities
3. API documentation structure
4. Best practices and patterns
5. Common use cases and examples
6. Integration guidelines
7. Troubleshooting common issues
      `;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: docPrompt
          }],
          max_tokens: 3000,
          temperature: 0.1
        })
      });

      const data = await response.json();
      const documentation = data.choices[0].message.content;
      
      return {
        technology,
        aspect,
        documentation,
        features: this.extractFeatures(documentation),
        apiStructure: this.extractApiStructure(documentation),
        bestPractices: this.extractBestPractices(documentation),
        examples: this.extractExamples(documentation),
        integration: this.extractIntegration(documentation),
        troubleshooting: this.extractTroubleshooting(documentation),
        sources: this.extractSources(documentation),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Documentation research failed:', error.message);
      return null;
    }
  }

  /**
   * Market research
   */
  async marketResearch(industry, segment = 'overall') {
    try {
      const marketPrompt = `
Conduct market research for: ${industry}

Segment: ${segment}

Please provide:
1. Market size and growth rate
2. Key market players and their market share
3. Emerging trends and opportunities
4. Customer segments and needs
5. Competitive landscape
6. Regulatory environment
7. Investment and funding trends
8. Future outlook (3-5 years)
      `;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: marketPrompt
          }],
          max_tokens: 2500,
          temperature: 0.2
        })
      });

      const data = await response.json();
      const research = data.choices[0].message.content;
      
      return {
        industry,
        segment,
        marketSize: this.extractMarketSize(research),
        growthRate: this.extractGrowthRate(research),
        keyPlayers: this.extractKeyPlayers(research),
        trends: this.extractMarketTrends(research),
        customerSegments: this.extractCustomerSegments(research),
        competition: this.extractCompetition(research),
        regulations: this.extractRegulations(research),
        investment: this.extractInvestment(research),
        outlook: this.extractOutlook(research),
        sources: this.extractSources(research),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Market research failed:', error.message);
      return null;
    }
  }

  /**
   * Build research prompt
   */
  buildResearchPrompt(query, options) {
    let prompt = `Research query: ${query}\n\n`;
    
    if (options.domain) {
      prompt += `Domain: ${options.domain}\n`;
    }
    
    if (options.timeframe) {
      prompt += `Timeframe: ${options.timeframe}\n`;
    }
    
    if (options.depth) {
      prompt += `Depth: ${options.depth}\n`;
    }
    
    if (options.audience) {
      prompt += `Audience: ${options.audience}\n`;
    }
    
    prompt += `\nResearch requirements:\n`;
    prompt += `- Provide current, accurate information\n`;
    prompt += `- Include credible sources and references\n`;
    prompt += `- Cover key aspects and implications\n`;
    prompt += `- Present findings clearly and concisely\n`;
    prompt += `- Include relevant context and background\n`;
    
    if (options.specificFocus) {
      prompt += `- Focus specifically on: ${options.specificFocus}\n`;
    }
    
    return prompt;
  }

  /**
   * Generate unique query ID
   */
  generateQueryId(query) {
    return `query_${Date.now()}_${query.substring(0, 20).replace(/\s+/g, '_')}`;
  }

  /**
   * Extract sources from research text
   */
  extractSources(text) {
    const sources = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('Source:') || line.includes('Reference:') || line.includes('According to:')) {
        sources.push(line.trim());
      }
    });
    
    return sources;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(text) {
    const confidenceIndicators = ['according to', 'research shows', 'studies indicate', 'data suggests'];
    const uncertaintyIndicators = ['might', 'could', 'possibly', 'unclear', 'unknown'];
    
    let confidence = 0.7; // Base confidence
    
    confidenceIndicators.forEach(indicator => {
      if (text.toLowerCase().includes(indicator)) {
        confidence += 0.1;
      }
    });
    
    uncertaintyIndicators.forEach(indicator => {
      if (text.toLowerCase().includes(indicator)) {
        confidence -= 0.1;
      }
    });
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract accuracy from fact check
   */
  extractAccuracy(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('accuracy') || line.toLowerCase().includes('assessment')) {
        return line.trim();
      }
    }
    return 'Accuracy not clearly stated';
  }

  /**
   * Extract evidence from fact check
   */
  extractEvidence(text) {
    const evidence = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('evidence') || line.includes('supporting') || line.includes('according to')) {
        evidence.push(line.trim());
      }
    });
    
    return evidence;
  }

  /**
   * Extract counterarguments
   */
  extractCounterarguments(text) {
    const counterarguments = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('counterargument') || line.includes('however') || line.includes('on the other hand')) {
        counterarguments.push(line.trim());
      }
    });
    
    return counterarguments;
  }

  /**
   * Extract confidence from fact check
   */
  extractConfidence(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('confidence')) {
        return line.trim();
      }
    }
    return 'Confidence not specified';
  }

  /**
   * Extract trends from analysis
   */
  extractTrends(text) {
    const trends = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('trend') || line.includes('pattern') || line.includes('emerging')) {
        trends.push(line.trim());
      }
    });
    
    return trends;
  }

  /**
   * Extract innovations
   */
  extractInnovations(text) {
    const innovations = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('innovation') || line.includes('breakthrough') || line.includes('new technology')) {
        innovations.push(line.trim());
      }
    });
    
    return innovations;
  }

  /**
   * Extract predictions
   */
  extractPredictions(text) {
    const predictions = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('predict') || line.includes('forecast') || line.includes('expected')) {
        predictions.push(line.trim());
      }
    });
    
    return predictions;
  }

  /**
   * Extract opportunities
   */
  extractOpportunities(text) {
    const opportunities = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('opportunity') || line.includes('potential') || line.includes('growth')) {
        opportunities.push(line.trim());
      }
    });
    
    return opportunities;
  }

  /**
   * Extract challenges
   */
  extractChallenges(text) {
    const challenges = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('challenge') || line.includes('obstacle') || line.includes('risk')) {
        challenges.push(line.trim());
      }
    });
    
    return challenges;
  }

  /**
   * Extract features from documentation
   */
  extractFeatures(text) {
    const features = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('feature') || line.includes('capability') || line.includes('functionality')) {
        features.push(line.trim());
      }
    });
    
    return features;
  }

  /**
   * Extract API structure
   */
  extractApiStructure(text) {
    const apiStructure = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('API') || line.includes('endpoint') || line.includes('method')) {
        apiStructure.push(line.trim());
      }
    });
    
    return apiStructure;
  }

  /**
   * Extract best practices
   */
  extractBestPractices(text) {
    const bestPractices = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('best practice') || line.includes('recommended') || line.includes('should')) {
        bestPractices.push(line.trim());
      }
    });
    
    return bestPractices;
  }

  /**
   * Extract examples
   */
  extractExamples(text) {
    const examples = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('example') || line.includes('sample') || line.includes('demonstration')) {
        examples.push(line.trim());
      }
    });
    
    return examples;
  }

  /**
   * Extract integration guidelines
   */
  extractIntegration(text) {
    const integration = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('integration') || line.includes('connect') || line.includes('implement')) {
        integration.push(line.trim());
      }
    });
    
    return integration;
  }

  /**
   * Extract troubleshooting
   */
  extractTroubleshooting(text) {
    const troubleshooting = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('troubleshoot') || line.includes('issue') || line.includes('problem') || line.includes('error')) {
        troubleshooting.push(line.trim());
      }
    });
    
    return troubleshooting;
  }

  /**
   * Extract market size
   */
  extractMarketSize(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('market size') || line.includes('market value') || line.includes('revenue')) {
        return line.trim();
      }
    }
    return 'Market size not specified';
  }

  /**
   * Extract growth rate
   */
  extractGrowthRate(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('growth rate') || line.includes('CAGR') || line.includes('annual growth')) {
        return line.trim();
      }
    }
    return 'Growth rate not specified';
  }

  /**
   * Extract key players
   */
  extractKeyPlayers(text) {
    const keyPlayers = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('key player') || line.includes('market leader') || line.includes('competitor')) {
        keyPlayers.push(line.trim());
      }
    });
    
    return keyPlayers;
  }

  /**
   * Extract market trends
   */
  extractMarketTrends(text) {
    const trends = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('trend') || line.includes('shift') || line.includes('emerging')) {
        trends.push(line.trim());
      }
    });
    
    return trends;
  }

  /**
   * Extract customer segments
   */
  extractCustomerSegments(text) {
    const segments = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('customer segment') || line.includes('target audience') || line.includes('user base')) {
        segments.push(line.trim());
      }
    });
    
    return segments;
  }

  /**
   * Extract competition
   */
  extractCompetition(text) {
    const competition = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('competition') || line.includes('competitor') || line.includes('market share')) {
        competition.push(line.trim());
      }
    });
    
    return competition;
  }

  /**
   * Extract regulations
   */
  extractRegulations(text) {
    const regulations = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('regulation') || line.includes('compliance') || line.includes('legal')) {
        regulations.push(line.trim());
      }
    });
    
    return regulations;
  }

  /**
   * Extract investment
   */
  extractInvestment(text) {
    const investment = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('investment') || line.includes('funding') || line.includes('venture capital')) {
        investment.push(line.trim());
      }
    });
    
    return investment;
  }

  /**
   * Extract outlook
   */
  extractOutlook(text) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('outlook') || line.includes('forecast') || line.includes('future')) {
        return line.trim();
      }
    }
    return 'Outlook not specified';
  }

  /**
   * Get research status
   */
  getStatus() {
    return {
      connected: !!this.apiKey,
      model: 'llama-3.1-sonar-small-128k-online',
      cache: {
        size: this.researchCache.size,
        knowledgeBase: this.knowledgeBase.size
      },
      active: {
        queries: this.activeQueries.size,
        history: this.researchHistory.length
      },
      capabilities: [
        'research',
        'fact_checking',
        'trend_analysis',
        'documentation',
        'market_research'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { PerplexityResearch };
