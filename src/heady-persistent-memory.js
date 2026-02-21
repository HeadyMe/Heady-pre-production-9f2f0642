
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: heady-persistent-memory.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * 🧠 HEADY PERSISTENT MEMORY - THE GAME CHANGER
 * ═══════════════════════════════════════════════════════════════
 * 
 * Memory is accessed:
 * 1. FIRST THING on every request (context loading)
 * 2. LAST THING before response (ingestion)
 * 3. During every node execution (continuous learning)
 * 4. In background (pattern analysis)
 */

const headyFs = require('fs').promises;
const headyPath = require('path');

class HeadyPersistentMemory {
  constructor(options = {}) {
    this.memoryPath = options.memoryPath || headyPath.join(__dirname, '..', '.heady-memory');
    this.contextPath = headyPath.join(this.memoryPath, 'context');
    this.headyPatternsPath = headyPath.join(this.memoryPath, 'headyPatterns');
    this.sessionsPath = headyPath.join(this.memoryPath, 'sessions');
    this.insightsPath = headyPath.join(this.memoryPath, 'insights');
    this.nodesPath = headyPath.join(this.memoryPath, 'nodes');
    
    // In-memory hot cache for ultra-fast access
    this.hotCache = new Map();
    this.accessLog = [];
    this.ingestQueue = [];
    
    // Performance tracking
    this.stats = {
      reads: 0,
      writes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      ingested: 0,
      headyPatternsAnalyzed: 0,
      insightsGenerated: 0
    };

    this._ensureDirectories();
  }

  async _ensureDirectories() {
    const headyDirs = [
      this.memoryPath,
      this.contextPath,
      this.headyPatternsPath,
      this.sessionsPath,
      this.insightsPath,
      this.nodesPath
    ];
    
    for (const headyDir of headyDirs) {
      try {
        await headyFs.mkdir(headyDir, { recursive: true });
      } catch (err) {}
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * REQUEST START: Load all relevant context IMMEDIATELY
   * This happens BEFORE any processing
   * ═══════════════════════════════════════════════════════════════
   */
  async loadContextForRequest(req) {
    const headyStartTime = Date.now();
    
    const headyContext = {
      userHistory: await this.getUserHistory(req.userId || 'anonymous'),
      recentPatterns: await this.getRecentPatterns(20),
      systemInsights: await this.getSystemInsights(),
      relevantMemories: await this.searchMemory(this._extractKeywords(req)),
      nodePreferences: await this.getNodePreferences(),
      nodePerformance: await this.getNodePerformance(),
      timestamp: new Date().toISOString(),
      loadTimeMs: 0
    };

    headyContext.loadTimeMs = Date.now() - headyStartTime;
    this.stats.reads++;
    
    console.log(`[HeadyMemory] Context loaded in ${headyContext.loadTimeMs}ms`);
    return headyContext;
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * RESPONSE END: Ingest valuable headyData BEFORE sending response
   * This captures outcomes, headyPatterns, insights
   * ═══════════════════════════════════════════════════════════════
   */
  async ingestFromResponse(req, res, context) {
    const headyIngestion = {
      id: `ingest-${Date.now()}`,
      timestamp: new Date().toISOString(),
      request: {
        path: req.path,
        method: req.method,
        userId: req.userId || 'anonymous',
        keywords: this._extractKeywords(req),
        headers: req.headers
      },
      response: {
        statusCode: res.statusCode,
        headers: res.getHeaders(),
        processingTimeMs: Date.now() - req.startTime,
        size: res.get('content-length') || 0
      },
      context,
      insights: this._extractInsights(req, res, context),
      performance: this._extractPerformanceMetrics(req, res, context)
    };

    // Queue for async processing (don't block response)
    this.ingestQueue.push(headyIngestion);
    this._processIngestionQueue();
    
    this.stats.ingested++;
    return headyIngestion;
  }

  /**
   * Get user's complete history
   */
  async getUserHistory(userId) {
    const headyCacheKey = `user:${userId}`;
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey);
    }

    const headyHistoryFile = headyPath.join(this.sessionsPath, `${userId}.json`);
    try {
      const headyData = await headyFs.readFile(headyHistoryFile, 'utf8');
      const headyHistory = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyHistory);
      this.stats.cacheMisses++;
      return headyHistory;
    } catch (err) {
      return { 
        userId, 
        sessions: [], 
        preferences: {},
        headyPatterns: [],
        createdAt: new Date().toISOString() 
      };
    }
  }

  /**
   * Get recent behavioral headyPatterns
   */
  async getRecentPatterns(limit = 20) {
    const headyCacheKey = 'headyPatterns:recent';
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey).slice(0, limit);
    }

    const headyPatternsFile = headyPath.join(this.headyPatternsPath, 'recent.json');
    try {
      const headyData = await headyFs.readFile(headyPatternsFile, 'utf8');
      const headyPatterns = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyPatterns);
      this.stats.cacheMisses++;
      return headyPatterns.slice(0, limit);
    } catch (err) {
      return [];
    }
  }

  /**
   * Get system-wide insights
   */
  async getSystemInsights() {
    const headyCacheKey = 'system:insights';
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey);
    }

    const headyInsightsFile = headyPath.join(this.insightsPath, 'system.json');
    try {
      const headyData = await headyFs.readFile(headyInsightsFile, 'utf8');
      const headyInsights = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyInsights);
      this.stats.cacheMisses++;
      return headyInsights;
    } catch (err) {
      return { 
        totalRequests: 0,
        avgResponseTime: 0,
        successRate: 0,
        commonPatterns: [],
        nodeEfficiency: {},
        userSatisfaction: 0,
        systemHealth: 'OPTIMAL'
      };
    }
  }

  /**
   * Search memory with keywords
   */
  async searchMemory(keywords) {
    if (!keywords || keywords.length === 0) return [];

    const headyMemories = [];
    const headyFiles = await headyFs.readdir(this.contextPath);
    
    for (const headyFile of headyFiles.slice(-100)) { // Last 100 memories
      try {
        const headyData = await headyFs.readFile(headyPath.join(this.contextPath, headyFile), 'utf8');
        const headyMemory = JSON.parse(headyData);
        
        // Keyword matching
        const headyMemoryText = JSON.stringify(headyMemory).toLowerCase();
        const headyMatches = keywords.filter(kw => headyMemoryText.includes(kw.toLowerCase()));
        
        if (headyMatches.length > 0) {
          headyMemories.push({ ...headyMemory, relevance: headyMatches.length / keywords.length });
        }
      } catch (err) {}
    }

    return headyMemories.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  /**
   * Get node execution preferences from history
   */
  async getNodePreferences() {
    const headyCacheKey = 'nodes:preferences';
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey);
    }

    const headyPrefsFile = headyPath.join(this.memoryPath, 'node-preferences.json');
    try {
      const headyData = await headyFs.readFile(headyPrefsFile, 'utf8');
      const headyPrefs = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyPrefs);
      this.stats.cacheMisses++;
      return headyPrefs;
    } catch (err) {
      return {
        BRAIN: { decisionSpeed: 'fast', confidence: 'high' },
        CONDUCTOR: { parallelism: 'max', efficiency: 'optimal' },
        SOPHIA: { learning: 'continuous', adaptation: 'rapid' },
        SENTINEL: { monitoring: 'active', alerting: 'intelligent' }
      };
    }
  }

  /**
   * Get node performance metrics
   */
  async getNodePerformance() {
    const headyCacheKey = 'nodes:performance';
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey);
    }

    const headyPerfFile = headyPath.join(this.nodesPath, 'performance.json');
    try {
      const headyData = await headyFs.readFile(headyPerfFile, 'utf8');
      const headyPerf = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyPerf);
      this.stats.cacheMisses++;
      return headyPerf;
    } catch (err) {
      return {
        avgExecutionTime: 150,
        successRate: 98.5,
        errorRate: 1.5,
        throughput: 1000
      };
    }
  }

  /**
   * Process ingestion queue asynchronously
   */
  async _processIngestionQueue() {
    if (this.ingestQueue.length === 0) return;

    const headyBatch = this.ingestQueue.splice(0, 50); // Process in batches
    
    for (const headyIngestion of headyBatch) {
      // Save to context
      const headyContextFile = headyPath.join(this.contextPath, `${headyIngestion.id}.json`);
      await headyFs.writeFile(headyContextFile, JSON.stringify(headyIngestion, null, 2), 'utf8');
      
      // Update headyPatterns
      await this._updatePatterns(headyIngestion);
      
      // Update insights
      await this._updateInsights(headyIngestion);
      
      // Update user history
      await this._updateUserHistory(headyIngestion);
      
      // Update node performance
      await this._updateNodePerformance(headyIngestion);
    }

    this.stats.writes += headyBatch.length;
  }

  async _updatePatterns(ingestion) {
    const headyPatternsFile = headyPath.join(this.headyPatternsPath, 'recent.json');
    let headyPatterns = [];
    
    try {
      const headyData = await headyFs.readFile(headyPatternsFile, 'utf8');
      headyPatterns = JSON.parse(headyData);
    } catch (err) {}

    headyPatterns.push({
      timestamp: ingestion.timestamp,
      path: ingestion.request.path,
      method: ingestion.request.method,
      statusCode: ingestion.response.statusCode,
      processingTimeMs: ingestion.response.processingTimeMs,
      keywords: ingestion.request.keywords,
      success: ingestion.response.statusCode < 400,
      userId: ingestion.request.userId
    });

    // Keep last 2000 headyPatterns
    if (headyPatterns.length > 2000) {
      headyPatterns = headyPatterns.slice(-2000);
    }

    await headyFs.writeFile(headyPatternsFile, JSON.stringify(headyPatterns, null, 2), 'utf8');
    this.stats.headyPatternsAnalyzed++;
  }

  async _updateInsights(ingestion) {
    const headyInsightsFile = headyPath.join(this.insightsPath, 'system.json');
    let headyInsights = { 
      totalRequests: 0, 
      avgResponseTime: 0, 
      successRate: 0,
      commonPatterns: [], 
      nodeEfficiency: {},
      userSatisfaction: 0,
      systemHealth: 'OPTIMAL'
    };
    
    try {
      const headyData = await headyFs.readFile(headyInsightsFile, 'utf8');
      headyInsights = JSON.parse(headyData);
    } catch (err) {}

    headyInsights.totalRequests++;
    headyInsights.avgResponseTime = 
      (headyInsights.avgResponseTime * (headyInsights.totalRequests - 1) + ingestion.response.processingTimeMs) 
      / headyInsights.totalRequests;

    // Update success rate
    const headySuccess = ingestion.response.statusCode < 400 ? 1 : 0;
    headyInsights.successRate = 
      ((headyInsights.successRate * (headyInsights.totalRequests - 1)) + headySuccess) / headyInsights.totalRequests;

    // Update system health
    if (headyInsights.successRate > 95 && headyInsights.avgResponseTime < 500) {
      headyInsights.systemHealth = 'OPTIMAL';
    } else if (headyInsights.successRate > 90 && headyInsights.avgResponseTime < 1000) {
      headyInsights.systemHealth = 'GOOD';
    } else {
      headyInsights.systemHealth = 'NEEDS_ATTENTION';
    }

    await headyFs.writeFile(headyInsightsFile, JSON.stringify(headyInsights, null, 2), 'utf8');
    this.stats.insightsGenerated++;
  }

  async _updateUserHistory(ingestion) {
    const headyUserId = ingestion.request.userId;
    const headyHistory = await this.getUserHistory(headyUserId);
    
    headyHistory.sessions = headyHistory.sessions || [];
    headyHistory.sessions.push({
      timestamp: ingestion.timestamp,
      path: ingestion.request.path,
      method: ingestion.request.method,
      success: ingestion.response.statusCode < 400,
      processingTimeMs: ingestion.response.processingTimeMs,
      insights: ingestion.insights
    });

    // Keep last 500 sessions per user
    if (headyHistory.sessions.length > 500) {
      headyHistory.sessions = headyHistory.sessions.slice(-500);
    }

    // Update user preferences
    headyHistory.preferences = this._updateUserPreferences(headyHistory, ingestion);

    const headyHistoryFile = headyPath.join(this.sessionsPath, `${headyUserId}.json`);
    await headyFs.writeFile(headyHistoryFile, JSON.stringify(headyHistory, null, 2), 'utf8');
    
    // Update hot cache
    this.hotCache.set(`user:${headyUserId}`, headyHistory);
  }

  async _updateNodePerformance(ingestion) {
    const headyPerfFile = headyPath.join(this.nodesPath, 'performance.json');
    let headyPerf = { avgExecutionTime: 150, successRate: 98.5, errorRate: 1.5, throughput: 1000 };
    
    try {
      const headyData = await headyFs.readFile(headyPerfFile, 'utf8');
      headyPerf = JSON.parse(headyData);
    } catch (err) {}

    // Update metrics
    headyPerf.avgExecutionTime = 
      (headyPerf.avgExecutionTime * 0.9) + (ingestion.response.processingTimeMs * 0.1);
    
    const headySuccess = ingestion.response.statusCode < 400 ? 1 : 0;
    headyPerf.successRate = (headyPerf.successRate * 0.95) + (headySuccess * 0.05);
    headyPerf.errorRate = 100 - headyPerf.successRate;

    await headyFs.writeFile(headyPerfFile, JSON.stringify(headyPerf, null, 2), 'utf8');
  }

  _updateUserPreferences(history, ingestion) {
    const headyPrefs = history.preferences || {};
    
    // Track preferred paths
    headyPrefs.preferredPaths = headyPrefs.preferredPaths || {};
    const headyReqPath = ingestion.request.path;
    headyPrefs.preferredPaths[headyReqPath] = (headyPrefs.preferredPaths[headyReqPath] || 0) + 1;
    
    // Track active hours
    const headyHour = new Date(ingestion.timestamp).getHours();
    headyPrefs.activeHours = headyPrefs.activeHours || {};
    headyPrefs.activeHours[headyHour] = (headyPrefs.activeHours[headyHour] || 0) + 1;
    
    return headyPrefs;
  }

  _extractKeywords(req) {
    const headyText = JSON.stringify(req.body || {}) + ' ' + 
                 JSON.stringify(req.query || {}) + ' ' + 
                 req.path + ' ' + 
                 (req.headers['user-agent'] || '');
    
    const headyWords = headyText.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    return [...new Set(headyWords)];
  }

  _extractInsights(req, res, context) {
    return {
      successful: res.statusCode < 400,
      fast: res.statusCode < 400 && (Date.now() - req.startTime) < 500,
      memoryUsed: context !== null,
      headyPatternsDetected: context?.recentPatterns?.length || 0,
      userReturning: context?.userHistory?.sessions?.length > 0,
      systemHealthy: context?.systemInsights?.systemHealth === 'OPTIMAL',
      nodeEfficient: context?.nodePerformance?.successRate > 95
    };
  }

  _extractPerformanceMetrics(req, res, context) {
    return {
      responseTime: Date.now() - req.startTime,
      contextLoadTime: context?.loadTimeMs || 0,
      cacheHitRate: this.stats.reads > 0 ? (this.stats.cacheHits / this.stats.reads) * 100 : 0,
      memoryEfficiency: context !== null ? 'high' : 'low',
      throughput: this.stats.reads / (process.uptime() || 1)
    };
  }

  /**
   * Node-specific memory access
   */
  async getNodeMemory(nodeId) {
    const headyCacheKey = `node:${nodeId}`;
    
    if (this.hotCache.has(headyCacheKey)) {
      this.stats.cacheHits++;
      return this.hotCache.get(headyCacheKey);
    }

    const headyNodeFile = headyPath.join(this.nodesPath, `${nodeId}.json`);
    try {
      const headyData = await headyFs.readFile(headyNodeFile, 'utf8');
      const headyNodeMemory = JSON.parse(headyData);
      this.hotCache.set(headyCacheKey, headyNodeMemory);
      this.stats.cacheMisses++;
      return headyNodeMemory;
    } catch (err) {
      return {
        nodeId,
        executions: 0,
        successRate: 100,
        avgTime: 0,
        preferences: {},
        headyPatterns: []
      };
    }
  }

  async updateNodeMemory(nodeId, execution) {
    const headyNodeMemory = await this.getNodeMemory(nodeId);
    
    headyNodeMemory.executions++;
    headyNodeMemory.successRate = 
      ((headyNodeMemory.successRate * (headyNodeMemory.executions - 1)) + (execution.success ? 100 : 0)) 
      / headyNodeMemory.executions;
    headyNodeMemory.avgTime = 
      ((headyNodeMemory.avgTime * (headyNodeMemory.executions - 1)) + execution.time) / headyNodeMemory.executions;
    
    // Store execution pattern
    headyNodeMemory.headyPatterns = headyNodeMemory.headyPatterns || [];
    headyNodeMemory.headyPatterns.push({
      timestamp: new Date().toISOString(),
      type: execution.type,
      success: execution.success,
      time: execution.time,
      context: execution.context
    });
    
    // Keep last 100 headyPatterns
    if (headyNodeMemory.headyPatterns.length > 100) {
      headyNodeMemory.headyPatterns = headyNodeMemory.headyPatterns.slice(-100);
    }

    const headyNodeFile = headyPath.join(this.nodesPath, `${nodeId}.json`);
    await headyFs.writeFile(headyNodeFile, JSON.stringify(headyNodeMemory, null, 2), 'utf8');
    
    // Update cache
    this.hotCache.set(`node:${nodeId}`, headyNodeMemory);
  }

  getStats() {
    return {
      ...this.stats,
      hotCacheSize: this.hotCache.size,
      queueLength: this.ingestQueue.length,
      cacheHitRate: this.stats.reads > 0 
        ? ((this.stats.cacheHits / this.stats.reads) * 100).toFixed(1) + '%'
        : '0%',
      memoryPath: this.memoryPath,
      uptime: process.uptime()
    };
  }

  /**
   * Background: Analyze headyPatterns and generate insights
   */
  startBackgroundAnalysis() {
    console.log('[HeadyMemory] Starting background analysis...');
    
    setInterval(async () => {
      await this._analyzePatterns();
      await this._optimizeCache();
      await this._generateInsights();
    }, 30000); // Every 30 seconds
  }

  async _analyzePatterns() {
    const headyPatterns = await this.getRecentPatterns(100);
    
    // Analyze common headyPatterns
    const headyPathCounts = {};
    const headyHourCounts = {};
    
    headyPatterns.forEach(pattern => {
      headyPathCounts[pattern.path] = (headyPathCounts[pattern.path] || 0) + 1;
      const headyHour = new Date(pattern.timestamp).getHours();
      headyHourCounts[headyHour] = (headyHourCounts[headyHour] || 0) + 1;
    });
    
    console.log(`[HeadyMemory] Analyzed ${headyPatterns.length} headyPatterns`);
  }

  async _optimizeCache() {
    // Remove old entries from hot cache
    if (this.hotCache.size > 1000) {
      const headyEntries = Array.from(this.hotCache.entries());
      this.hotCache.clear();
      // Keep most recent 500
      headyEntries.slice(-500).forEach(([k, v]) => this.hotCache.set(k, v));
      console.log(`[HeadyMemory] Optimized cache, kept 500 entries`);
    }
  }

  async _generateInsights() {
    const headyInsights = await this.getSystemInsights();
    
    // Generate new insights based on recent headyData
    if (headyInsights.totalRequests > 0 && headyInsights.totalRequests % 100 === 0) {
      console.log(`[HeadyMemory] Milestone: ${headyInsights.totalRequests} requests processed`);
    }
  }

  /**
   * Search across all memory types
   */
  async globalSearch(query) {
    const headyKeywords = this._extractKeywords({ path: query, body: { query } });
    
    const headyResults = {
      userHistory: [],
      headyPatterns: [],
      contexts: [],
      nodes: []
    };

    // Search user histories
    const headyUserFiles = await headyFs.readdir(this.sessionsPath);
    for (const headyFile of headyUserFiles.slice(-20)) {
      try {
        const headyData = await headyFs.readFile(headyPath.join(this.sessionsPath, headyFile), 'utf8');
        const headyHistory = JSON.parse(headyData);
        const headyHistoryText = JSON.stringify(headyHistory).toLowerCase();
        
        if (headyKeywords.some(kw => headyHistoryText.includes(kw.toLowerCase()))) {
          headyResults.userHistory.push(headyHistory);
        }
      } catch (err) {}
    }

    // Search headyPatterns
    const headyPatterns = await this.getRecentPatterns(100);
    headyResults.headyPatterns = headyPatterns.filter(p => 
      headyKeywords.some(kw => (p.path || '').toLowerCase().includes(kw.toLowerCase()))
    );

    // Search contexts
    const headyContextFiles = await headyFs.readdir(this.contextPath);
    for (const headyFile of headyContextFiles.slice(-50)) {
      try {
        const headyData = await headyFs.readFile(headyPath.join(this.contextPath, headyFile), 'utf8');
        const headyContext = JSON.parse(headyData);
        const headyContextText = JSON.stringify(headyContext).toLowerCase();
        
        if (headyKeywords.some(kw => headyContextText.includes(kw.toLowerCase()))) {
          headyResults.contexts.push(headyContext);
        }
      } catch (err) {}
    }

    return headyResults;
  }
}

module.exports = { HeadyPersistentMemory };
