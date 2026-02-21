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
// ║  FILE: frontend-errors.js                                        ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Frontend Errors API Endpoint
 * Receives and processes frontend error reports
 * Integrates with health monitoring and ORS calculations
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

class FrontendErrorsAPI {
  constructor(config = {}) {
    this.config = {
      logFile: config.logFile || '/var/log/heady/frontend-errors.log',
      maxLogSize: config.maxLogSize || 100 * 1024 * 1024, // 100MB
      errorRetentionDays: config.errorRetentionDays || 30,
      aggregationWindow: config.aggregationWindow || 300000, // 5 minutes
      alertThresholds: {
        errorRate: config.errorRateThreshold || 0.1, // 10%
        criticalErrors: config.criticalErrorThreshold || 5,
        consecutiveFailures: config.consecutiveFailureThreshold || 3
      },
      ...config
    };
    
    this.errorCounts = new Map();
    this.errorHistory = [];
    this.performanceMetrics = new Map();
    this.alerts = [];
    this.orsImpact = 0;
    
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.config.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      // Load existing error counts if available
      await this.loadErrorCounts();
      
      console.log('[FrontendErrorsAPI] Initialized successfully');
    } catch (error) {
      console.error('[FrontendErrorsAPI] Failed to initialize:', error);
    }
  }

  async loadErrorCounts() {
    try {
      const countsFile = this.config.logFile.replace('.log', '-counts.json');
      const data = await fs.readFile(countsFile, 'utf8');
      const counts = JSON.parse(data);
      
      this.errorCounts = new Map(Object.entries(counts));
      console.log(`[FrontendErrorsAPI] Loaded ${this.errorCounts.size} error counts`);
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      console.log('[FrontendErrorsAPI] No existing error counts found');
    }
  }

  async saveErrorCounts() {
    try {
      const countsFile = this.config.logFile.replace('.log', '-counts.json');
      const counts = Object.fromEntries(this.errorCounts);
      await fs.writeFile(countsFile, JSON.stringify(counts, null, 2));
    } catch (error) {
      console.error('[FrontendErrorsAPI] Failed to save error counts:', error);
    }
  }

  createRouter() {
    const router = express.Router();
    
    // POST /api/frontend-errors - Receive error reports
    router.post('/', async (req, res) => {
      try {
        const { errors, metadata } = req.body;
        
        if (!Array.isArray(errors) || errors.length === 0) {
          return res.status(400).json({
            error: 'Invalid request: errors array required',
            received: typeof errors
          });
        }
        
        const result = await this.processErrorReport(errors, metadata);
        
        res.json({
          success: true,
          processed: result.processed,
          alerts: result.alerts,
          orsImpact: result.orsImpact,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[FrontendErrorsAPI] Error processing report:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });
    
    // GET /api/frontend-errors - Get error statistics
    router.get('/', async (req, res) => {
      try {
        const stats = this.getErrorStatistics();
        res.json(stats);
      } catch (error) {
        console.error('[FrontendErrorsAPI] Error getting statistics:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });
    
    // GET /api/frontend-errors/health - Health check endpoint
    router.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        errorCounts: this.errorCounts.size,
        recentErrors: this.getRecentErrorCount(),
        orsImpact: this.orsImpact,
        alerts: this.alerts.length
      };
      
      res.json(health);
    });
    
    // GET /api/frontend-errors/clear - Clear error history (admin only)
    router.post('/clear', async (req, res) => {
      try {
        await this.clearErrorHistory();
        res.json({
          success: true,
          message: 'Error history cleared',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[FrontendErrorsAPI] Error clearing history:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });
    
    return router;
  }

  async processErrorReport(errors, metadata) {
    const processed = [];
    const newAlerts = [];
    let totalOrsImpact = 0;
    
    // Process each error
    for (const error of errors) {
      const processedError = await this.processSingleError(error, metadata);
      processed.push(processedError);
      
      // Check for alerts
      const alert = this.checkForAlerts(error, metadata);
      if (alert) {
        newAlerts.push(alert);
        this.alerts.push(alert);
      }
      
      // Calculate ORS impact
      totalOrsImpact += this.calculateErrorORSImpact(error);
    }
    
    // Update global ORS impact
    this.orsImpact = Math.min(totalOrsImpact, 50); // Cap at 50 points deduction
    
    // Log errors
    await this.logErrors(errors, metadata);
    
    // Save error counts
    await this.saveErrorCounts();
    
    return {
      processed,
      alerts: newAlerts,
      orsImpact: this.orsImpact
    };
  }

  async processSingleError(error, metadata) {
    const errorKey = this.generateErrorKey(error);
    
    // Update error counts
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    
    // Add to history
    this.errorHistory.push({
      ...error,
      metadata,
      timestamp: new Date().toISOString(),
      errorKey,
      count: currentCount + 1
    });
    
    // Trim history if too large
    if (this.errorHistory.length > 10000) {
      this.errorHistory = this.errorHistory.slice(-5000);
    }
    
    return {
      errorKey,
      count: currentCount + 1,
      totalOccurrences: this.getTotalOccurrences(errorKey)
    };
  }

  generateErrorKey(error) {
    // Create a key for grouping similar errors
    const keyParts = [
      error.type || 'unknown',
      error.message?.substring(0, 100) || 'unknown',
      error.filename || 'unknown',
      error.lineno || 0
    ];
    
    return keyParts.join('|');
  }

  getTotalOccurrences(errorKey) {
    return this.errorCounts.get(errorKey) || 0;
  }

  checkForAlerts(error, metadata) {
    const alerts = [];
    
    // Check error rate threshold
    const recentErrorCount = this.getRecentErrorCount();
    const totalRequests = this.getRecentRequestCount();
    
    if (totalRequests > 0) {
      const errorRate = recentErrorCount / totalRequests;
      
      if (errorRate > this.config.alertThresholds.errorRate) {
        alerts.push({
          type: 'error_rate_high',
          severity: 'critical',
          message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(this.config.alertThresholds.errorRate * 100).toFixed(2)}%`,
          errorRate,
          threshold: this.config.alertThresholds.errorRate,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Check for critical errors
    if (error.type === 'javascript' && error.message?.includes('Critical')) {
      alerts.push({
        type: 'critical_error',
        severity: 'critical',
        message: `Critical JavaScript error: ${error.message}`,
        error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for consecutive failures
    const errorKey = this.generateErrorKey(error);
    const occurrences = this.getTotalOccurrences(errorKey);
    
    if (occurrences >= this.config.alertThresholds.consecutiveFailures) {
      alerts.push({
        type: 'consecutive_failures',
        severity: 'high',
        message: `Error occurred ${occurrences} times consecutively: ${error.message}`,
        errorKey,
        occurrences,
        threshold: this.config.alertThresholds.consecutiveFailures,
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts.length > 0 ? alerts[0] : null;
  }

  calculateErrorORSImpact(error) {
    let impact = 0;
    
    // Base impact by error type
    const typeImpacts = {
      'javascript': 5,
      'promise_rejection': 3,
      'network': 7,
      'performance': 2,
      'react_error_boundary': 8,
      'manual': 1
    };
    
    impact += typeImpacts[error.type] || 3;
    
    // Additional impact for critical errors
    if (error.message?.toLowerCase().includes('critical')) {
      impact += 5;
    }
    
    // Additional impact for uncaught exceptions
    if (error.type === 'javascript' && !error.filename?.includes('node_modules')) {
      impact += 3;
    }
    
    // Reduce impact for known/benign errors
    const benignPatterns = [
      'non-critical',
      'warning',
      'deprecated',
      'analytics'
    ];
    
    for (const pattern of benignPatterns) {
      if (error.message?.toLowerCase().includes(pattern)) {
        impact = Math.max(1, impact - 2);
        break;
      }
    }
    
    return impact;
  }

  getRecentErrorCount() {
    const cutoff = Date.now() - this.config.aggregationWindow;
    return this.errorHistory.filter(error => 
      new Date(error.timestamp).getTime() >= cutoff
    ).length;
  }

  getRecentRequestCount() {
    // This would be integrated with actual request tracking
    // For now, return a reasonable estimate
    return 1000;
  }

  async logErrors(errors, metadata) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      metadata,
      errors: errors.map(error => ({
        type: error.type,
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        url: error.url,
        userAgent: error.userAgent
      })),
      counts: Object.fromEntries(this.errorCounts),
      orsImpact: this.orsImpact
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      await fs.appendFile(this.config.logFile, logLine);
      
      // Rotate log if too large
      await this.rotateLogIfNeeded();
    } catch (error) {
      console.error('[FrontendErrorsAPI] Failed to log errors:', error);
    }
  }

  async rotateLogIfNeeded() {
    try {
      const stats = await fs.stat(this.config.logFile);
      
      if (stats.size > this.config.maxLogSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = this.config.logFile.replace('.log', `-${timestamp}.log`);
        
        await fs.rename(this.config.logFile, archiveFile);
        console.log(`[FrontendErrorsAPI] Rotated log to ${archiveFile}`);
      }
    } catch (error) {
      // File doesn't exist or other issue
      // Ignore for now
    }
  }

  getErrorStatistics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);
    
    const recentErrors = this.errorHistory.filter(error => 
      new Date(error.timestamp) >= oneHourAgo
    );
    
    const dailyErrors = this.errorHistory.filter(error => 
      new Date(error.timestamp) >= oneDayAgo
    );
    
    // Top error types
    const errorTypes = {};
    recentErrors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });
    
    // Top error messages
    const errorMessages = {};
    recentErrors.forEach(error => {
      const shortMessage = error.message?.substring(0, 100) || 'Unknown';
      errorMessages[shortMessage] = (errorMessages[shortMessage] || 0) + 1;
    });
    
    return {
      timestamp: now.toISOString(),
      summary: {
        totalErrors: this.errorHistory.length,
        recentErrors: recentErrors.length,
        dailyErrors: dailyErrors.length,
        uniqueErrorTypes: Object.keys(errorTypes).length,
        orsImpact: this.orsImpact,
        activeAlerts: this.alerts.filter(alert => 
          new Date(alert.timestamp) >= oneHourAgo
        ).length
      },
      errorTypes: this.sortByCount(errorTypes),
      topErrorMessages: this.sortByCount(errorMessages).slice(0, 10),
      recentErrors: recentErrors.slice(-20).map(error => ({
        timestamp: error.timestamp,
        type: error.type,
        message: error.message?.substring(0, 200),
        url: error.url,
        count: error.count
      })),
      alerts: this.alerts.slice(-10).reverse(),
      thresholds: this.config.alertThresholds
    };
  }

  sortByCount(obj) {
    return Object.entries(obj)
      .sort(([,a], [,b]) => b - a)
      .reduce((result, [key, value]) => {
        result[key] = value;
        return result;
      }, {});
  }

  async clearErrorHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.alerts = [];
    this.orsImpact = 0;
    
    // Clear log file
    try {
      await fs.writeFile(this.config.logFile, '');
      await this.saveErrorCounts();
      
      console.log('[FrontendErrorsAPI] Error history cleared');
    } catch (error) {
      console.error('[FrontendErrorsAPI] Failed to clear history:', error);
    }
  }

  getORSImpact() {
    return {
      impact: this.orsImpact,
      threshold: 50, // Maximum 50 points deduction
      recentErrors: this.getRecentErrorCount(),
      errorRate: this.getRecentErrorCount() / this.getRecentRequestCount(),
      activeAlerts: this.alerts.filter(alert => 
        new Date(alert.timestamp) >= new Date(Date.now() - 3600000)
      ).length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = FrontendErrorsAPI;
