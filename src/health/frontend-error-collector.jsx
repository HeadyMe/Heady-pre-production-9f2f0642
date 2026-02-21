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
// ║  FILE: frontend-error-collector.js                               ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Frontend Error Collector
 * Global error boundary and error reporting for frontend applications
 * Integrates with health monitoring and ORS calculations
 */

class FrontendErrorCollector {
  constructor(config = {}) {
    this.config = {
      endpoint: config.endpoint || '/api/frontend-errors',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      includeStackTrace: config.includeStackTrace !== false,
      collectPerformanceMetrics: config.collectPerformanceMetrics !== false,
      ...config
    };
    
    this.errorQueue = [];
    this.performanceMetrics = new Map();
    this.errorCounts = new Map();
    this.isCollecting = false;
    this.flushTimer = null;
    this.retryCount = 0;
    
    // Error rate thresholds
    this.thresholds = {
      warning: config.warningRate || 0.05,      // 5%
      critical: config.criticalRate || 0.1,    // 10%
      blockDeploy: config.blockDeployRate || 0.15 // 15%
    };
    
    this.initializeErrorHandlers();
    this.initializePerformanceMonitoring();
  }

  initializeErrorHandlers() {
    // Global error handler for uncaught JavaScript errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.collectError({
          type: 'javascript',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      });

      // Global handler for unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.collectError({
          type: 'promise_rejection',
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          promise: true
        });
      });
    }
  }

  initializePerformanceMonitoring() {
    if (!this.config.collectPerformanceMetrics || typeof window === 'undefined') {
      return;
    }

    // Collect performance metrics
    if ('performance' in window) {
      // Monitor page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.collectPerformanceMetrics();
        }, 0);
      });

      // Monitor Core Web Vitals
      this.observeWebVitals();
    }
  }

  observeWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('lcp', entry.startTime);
          } else if (entry.entryType === 'first-input') {
            this.recordMetric('fid', entry.processingStart - entry.startTime);
          } else if (entry.entryType === 'layout-shift') {
            if (!entry.hadRecentInput) {
              this.recordMetric('cls', entry.value);
            }
          }
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    }
  }

  recordMetric(name, value) {
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, []);
    }
    
    const metrics = this.performanceMetrics.get(name);
    metrics.push({
      value,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    });
    
    // Keep only last 100 entries per metric
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  collectPerformanceMetrics() {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return;

    const metrics = {
      type: 'performance',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: {
        // Page load timing
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: 0,
        firstContentfulPaint: 0,
        // Network timing
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        // Core Web Vitals
        lcp: this.getAverageMetric('lcp'),
        fid: this.getAverageMetric('fid'),
        cls: this.getAverageMetric('cls')
      }
    };

    // Get paint timing
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      if (entry.name === 'first-paint') {
        metrics.metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        metrics.metrics.firstContentfulPaint = entry.startTime;
      }
    });

    // Add to error queue for reporting
    this.errorQueue.push(metrics);
  }

  getAverageMetric(metricName) {
    const metrics = this.performanceMetrics.get(metricName);
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  collectError(errorData) {
    // Sanitize error data
    const sanitizedError = this.sanitizeError(errorData);
    
    // Add to queue
    this.errorQueue.push(sanitizedError);
    
    // Update error counts
    const errorKey = this.getErrorKey(sanitizedError);
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Check error rate thresholds
    this.checkErrorRateThresholds();
    
    // Flush if queue is full
    if (this.errorQueue.length >= this.config.batchSize) {
      this.flushErrors();
    }
    
    // Log to console for debugging
    console.error('[FrontendErrorCollector]', sanitizedError);
  }

  sanitizeError(error) {
    const sanitized = {
      type: error.type || 'unknown',
      message: error.message || 'Unknown error',
      timestamp: error.timestamp || new Date().toISOString(),
      url: error.url || 'unknown',
      userAgent: error.userAgent || 'unknown'
    };

    // Add optional fields if available
    if (error.filename) sanitized.filename = error.filename;
    if (error.lineno) sanitized.lineno = error.lineno;
    if (error.colno) sanitized.colno = error.colno;
    if (this.config.includeStackTrace && error.stack) {
      // Sanitize stack trace to remove sensitive information
      sanitized.stack = this.sanitizeStackTrace(error.stack);
    }
    if (error.promise) sanitized.promise = true;

    return sanitized;
  }

  sanitizeStackTrace(stack) {
    if (!stack) return null;
    
    // Remove potential sensitive information from stack trace
    return stack
      .split('\n')
      .map(line => line.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'))
      .map(line => line.replace(/\b(?:password|token|key|secret)\s*[:=]\s*[^\s,}]+/gi, '[REDACTED]'))
      .join('\n');
  }

  getErrorKey(error) {
    // Create a key for grouping similar errors
    const keyParts = [
      error.type,
      error.message.substring(0, 100), // First 100 chars of message
      error.filename || 'unknown',
      error.lineno || 0
    ];
    
    return keyParts.join('|');
  }

  checkErrorRateThresholds() {
    const totalErrors = this.errorQueue.length;
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes
    
    if (recentErrors.length === 0) return;
    
    // Calculate error rates for different windows
    const rates = {
      short: this.calculateErrorRate(recentErrors, 60000),    // 1 minute
      medium: this.calculateErrorRate(recentErrors, 300000),  // 5 minutes
      long: this.calculateErrorRate(recentErrors, 3600000)    // 1 hour
    };
    
    // Check thresholds and emit events
    if (rates.short >= this.thresholds.blockDeploy) {
      this.emit('errorRateCritical', { rate: rates.short, window: '1min', errors: recentErrors });
    } else if (rates.medium >= this.thresholds.critical) {
      this.emit('errorRateHigh', { rate: rates.medium, window: '5min', errors: recentErrors });
    } else if (rates.long >= this.thresholds.warning) {
      this.emit('errorRateWarning', { rate: rates.long, window: '1hour', errors: recentErrors });
    }
  }

  calculateErrorRate(errors, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const windowErrors = errors.filter(error => 
      new Date(error.timestamp).getTime() >= windowStart
    );
    
    return windowErrors.length;
  }

  getRecentErrors(timeWindowMs = 300000) {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.errorQueue.filter(error => new Date(error.timestamp) >= cutoff);
  }

  startCollection() {
    if (this.isCollecting) {
      console.log('[FrontendErrorCollector] Already collecting errors');
      return;
    }
    
    console.log('[FrontendErrorCollector] Starting error collection...');
    this.isCollecting = true;
    
    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flushErrors().catch(error => {
        console.error('[FrontendErrorCollector] Error in periodic flush:', error);
      });
    }, this.config.flushInterval);
  }

  stopCollection() {
    if (!this.isCollecting) {
      return;
    }
    
    console.log('[FrontendErrorCollector] Stopping error collection...');
    this.isCollecting = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush remaining errors
    this.flushErrors();
  }

  async flushErrors() {
    if (this.errorQueue.length === 0) {
      return;
    }
    
    const errorsToSend = this.errorQueue.splice(0, this.config.batchSize);
    
    try {
      await this.sendErrors(errorsToSend);
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      console.error('[FrontendErrorCollector] Failed to send errors:', error);
      
      // Put errors back in queue for retry
      this.errorQueue.unshift(...errorsToSend);
      
      // Increment retry count
      this.retryCount++;
      
      // If we haven't exceeded max retries, try again
      if (this.retryCount < this.config.maxRetries) {
        setTimeout(() => this.flushErrors(), 5000 * this.retryCount); // Exponential backoff
      } else {
        console.error('[FrontendErrorCollector] Max retries exceeded, dropping errors');
        this.retryCount = 0;
      }
    }
  }

  async sendErrors(errors) {
    if (typeof window === 'undefined') {
      // Node.js environment - use HTTP module
      return this.sendErrorsNode(errors);
    } else {
      // Browser environment - use fetch
      return this.sendErrorsBrowser(errors);
    }
  }

  async sendErrorsBrowser(errors) {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        errors,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorCounts: Object.fromEntries(this.errorCounts),
          performanceMetrics: this.getAggregatedMetrics()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async sendErrorsNode(errors) {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(this.config.endpoint);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        errors,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: 'Node.js FrontendErrorCollector',
          url: 'server-side',
          errorCounts: Object.fromEntries(this.errorCounts),
          performanceMetrics: this.getAggregatedMetrics()
        }
      });
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = protocol.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      
      req.write(postData);
      req.end();
    });
  }

  getAggregatedMetrics() {
    const aggregated = {};
    
    for (const [metricName, values] of this.performanceMetrics) {
      if (values.length === 0) continue;
      
      const numericValues = values.map(v => v.value);
      aggregated[metricName] = {
        count: values.length,
        average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        latest: values[values.length - 1].value
      };
    }
    
    return aggregated;
  }

  getStatus() {
    return {
      isCollecting: this.isCollecting,
      queueSize: this.errorQueue.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      performanceMetrics: this.getAggregatedMetrics(),
      thresholds: this.thresholds,
      config: {
        endpoint: this.config.endpoint,
        batchSize: this.config.batchSize,
        flushInterval: this.config.flushInterval
      },
      timestamp: new Date().toISOString()
    };
  }

  // Event emitter methods
  emit(event, data) {
    // Simple event emission - in a real implementation, use EventEmitter
    console.log(`[FrontendErrorCollector] Event: ${event}`, data);
    
    // Call global error handlers if available
    if (typeof window !== 'undefined' && window.headyErrorHandlers) {
      const handler = window.headyErrorHandlers[event];
      if (typeof handler === 'function') {
        handler(data);
      }
    }
  }

  // Manual error reporting
  reportError(message, additionalData = {}) {
    this.collectError({
      type: 'manual',
      message,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      ...additionalData
    });
  }

  // Clear error history
  clearHistory() {
    this.errorQueue = [];
    this.errorCounts.clear();
    this.performanceMetrics.clear();
    console.log('[FrontendErrorCollector] Error history cleared');
  }
}

// React Error Boundary Component (for React applications)
if (typeof React !== 'undefined') {
  class FrontendErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
      this.setState({ error, errorInfo });
      
      // Report to error collector
      if (window.headyErrorCollector) {
        window.headyErrorCollector.collectError({
          type: 'react_error_boundary',
          message: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      }
    }

    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: '20px', border: '1px solid #ff6b6b', borderRadius: '4px', backgroundColor: '#ffe0e0' }}>
            <h2>Something went wrong</h2>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </details>
          </div>
        );
      }

      return this.props.children;
    }
  }

  // Make available globally
  if (typeof window !== 'undefined') {
    window.FrontendErrorBoundary = FrontendErrorBoundary;
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FrontendErrorCollector;
} else if (typeof window !== 'undefined') {
  window.FrontendErrorCollector = FrontendErrorCollector;
}
