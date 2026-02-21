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
// ║  FILE: frontend-error-collector.js                           ║
// ║  UPDATED: 20260219-220500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🚨 Frontend Error Collector
 * 
 * JavaScript module to be included in frontend applications that
 * automatically collects and reports errors, broken functionality,
 * and user interaction issues to the backend monitoring system.
 */

(function(window, document) {
  'use strict';

  class FrontendErrorCollector {
    constructor(config = {}) {
      this.config = {
        api_endpoint: config.api_endpoint || '/api/frontend-errors',
        batch_size: config.batch_size || 10,
        flush_interval_ms: config.flush_interval_ms || 5000,
        max_errors_per_minute: config.max_errors_per_minute || 100,
        include_user_agent: config.include_user_agent !== false,
        include_screenshots: config.include_screenshots || false,
        debug_mode: config.debug_mode || false,
        ...config
      };

      // Error storage
      this.errorQueue = [];
      this.errorCounts = new Map();
      this.lastFlushTime = Date.now();
      this.isOnline = navigator.onLine;

      // Performance metrics
      this.performanceMetrics = {
        page_load_time: 0,
        dom_interactive_time: 0,
        resource_load_times: new Map(),
        user_interaction_failures: 0,
        javascript_errors: 0,
        network_failures: 0
      };

      // Initialize
      this.initialize();
    }

    /**
     * 🚀 Initialize error collection
     */
    initialize() {
      // Set up global error handlers
      this.setupErrorHandlers();
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring();
      
      // Set up user interaction monitoring
      this.setupInteractionMonitoring();
      
      // Set up network monitoring
      this.setupNetworkMonitoring();
      
      // Start periodic flush
      this.startPeriodicFlush();
      
      // Set up visibility change detection
      this.setupVisibilityMonitoring();
      
      console.log('[FrontendErrorCollector] Initialized');
    }

    /**
     * 🚨 Set up global error handlers
     */
    setupErrorHandlers() {
      // JavaScript errors
      window.addEventListener('error', (event) => {
        this.recordError({
          type: 'javascript_error',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error ? event.error.stack : null,
          timestamp: Date.now()
        });
      });

      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.recordError({
          type: 'unhandled_rejection',
          message: event.reason ? event.reason.toString() : 'Unknown promise rejection',
          stack: event.reason && event.reason.stack ? event.reason.stack : null,
          timestamp: Date.now()
        });
      });

      // Resource loading errors
      window.addEventListener('error', (event) => {
        if (event.target !== window) {
          this.recordError({
            type: 'resource_error',
            element: event.target.tagName.toLowerCase(),
            source: event.target.src || event.target.href,
            timestamp: Date.now()
          });
        }
      }, true);
    }

    /**
     * 📊 Set up performance monitoring
     */
    setupPerformanceMonitoring() {
      // Page load performance
      window.addEventListener('load', () => {
        if (window.performance && window.performance.timing) {
          const timing = window.performance.timing;
          this.performanceMetrics.page_load_time = timing.loadEventEnd - timing.navigationStart;
          this.performanceMetrics.dom_interactive_time = timing.domInteractive - timing.navigationStart;
        }
      });

      // Resource timing
      if (window.performance && window.performance.getEntriesByType) {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              this.performanceMetrics.resource_load_times.set(entry.name, entry.duration);
            }
          });
        });
        observer.observe({ entryTypes: ['resource'] });
      }
    }

    /**
     * 👆 Set up user interaction monitoring
     */
    setupInteractionMonitoring() {
      // Monitor button clicks
      document.addEventListener('click', (event) => {
        const target = event.target;
        
        if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'a') {
          const interactionId = this.generateInteractionId();
          
          // Check if element has click handler
          const hasHandler = target.onclick || target.getAttribute('onclick') || 
                            target.addEventListener || target.onclick !== null;
          
          if (!hasHandler) {
            this.recordError({
              type: 'dead_button',
              element: target.tagName.toLowerCase(),
              text: target.textContent.trim().substring(0, 50),
              selector: this.getSelector(target),
              timestamp: Date.now(),
              interaction_id: interactionId
            });
          }

          // Monitor for successful navigation/action
          setTimeout(() => {
            if (target.tagName.toLowerCase() === 'a' && target.href) {
              // Check if navigation occurred (simplified)
              if (window.location.href !== target.href && !target.target) {
                // Link didn't navigate as expected
                this.recordError({
                  type: 'dead_link',
                  href: target.href,
                  text: target.textContent.trim().substring(0, 50),
                  selector: this.getSelector(target),
                  timestamp: Date.now(),
                  interaction_id: interactionId
                });
              }
            }
          }, 1000);
        }
      }, true);

      // Monitor form submissions
      document.addEventListener('submit', (event) => {
        const form = event.target;
        const interactionId = this.generateInteractionId();
        
        // Check if form has action and method
        if (!form.action || !form.method) {
          this.recordError({
            type: 'malformed_form',
            action: form.action,
            method: form.method,
            selector: this.getSelector(form),
            timestamp: Date.now(),
            interaction_id: interactionId
          });
        }
      }, true);
    }

    /**
     * 🌐 Set up network monitoring
     */
    setupNetworkMonitoring() {
      // Monitor fetch/XHR failures
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          
          // Check for error responses
          if (!response.ok) {
            this.recordError({
              type: 'http_error',
              url: args[0],
              status: response.status,
              status_text: response.statusText,
              timestamp: Date.now()
            });
          }
          
          return response;
        } catch (error) {
          this.recordError({
            type: 'network_error',
            url: args[0],
            error: error.message,
            timestamp: Date.now()
          });
          throw error;
        }
      };

      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushErrorQueue(); // Try to flush queued errors when back online
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }

    /**
     * 👁️ Set up visibility monitoring
     */
    setupVisibilityMonitoring() {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Page hidden, flush errors
          this.flushErrorQueue();
        }
      });
    }

    /**
     * 📝 Record an error
     */
    recordError(error) {
      // Rate limiting
      const now = Date.now();
      const minuteKey = Math.floor(now / 60000);
      const currentCount = this.errorCounts.get(minuteKey) || 0;
      
      if (currentCount >= this.config.max_errors_per_minute) {
        return; // Rate limited
      }
      
      this.errorCounts.set(minuteKey, currentCount + 1);

      // Add context to error
      const enrichedError = {
        ...error,
        url: window.location.href,
        user_agent: this.config.include_user_agent ? navigator.userAgent : undefined,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        online: this.isOnline,
        session_id: this.getSessionId()
      };

      // Add screenshot if enabled and it's a critical error
      if (this.config.include_screenshots && this.isCriticalError(error)) {
        enrichedError.screenshot = this.takeScreenshot();
      }

      this.errorQueue.push(enrichedError);
      
      // Update metrics
      if (error.type === 'javascript_error') {
        this.performanceMetrics.javascript_errors++;
      } else if (error.type.includes('network') || error.type.includes('http')) {
        this.performanceMetrics.network_failures++;
      } else if (error.type.includes('dead') || error.type.includes('malformed')) {
        this.performanceMetrics.user_interaction_failures++;
      }

      // Flush if queue is full
      if (this.errorQueue.length >= this.config.batch_size) {
        this.flushErrorQueue();
      }

      // Debug logging
      if (this.config.debug_mode) {
        console.warn('[FrontendErrorCollector] Error recorded:', enrichedError);
      }
    }

    /**
     * 🚨 Determine if error is critical
     */
    isCriticalError(error) {
      const criticalTypes = [
        'javascript_error',
        'unhandled_rejection',
        'dead_button',
        'dead_link'
      ];
      
      return criticalTypes.includes(error.type);
    }

    /**
     * 📸 Take screenshot (base64)
     */
    takeScreenshot() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px monospace';
        ctx.fillText(`Screenshot at ${new Date().toISOString()}`, 10, 20);
        ctx.fillText(`URL: ${window.location.href}`, 10, 40);
        ctx.fillText(`Viewport: ${canvas.width}x${canvas.height}`, 10, 60);
        return canvas.toDataURL('image/png');
      } catch (error) {
        return null;
      }
    }

    /**
     * 🔄 Start periodic flush
     */
    startPeriodicFlush() {
      setInterval(() => {
        this.flushErrorQueue();
      }, this.config.flush_interval_ms);
    }

    /**
     * 📤 Flush error queue to backend
     */
    async flushErrorQueue() {
      if (this.errorQueue.length === 0 || !this.isOnline) {
        return;
      }

      const errorsToSend = this.errorQueue.splice(0, this.config.batch_size);
      
      try {
        const payload = {
          errors: errorsToSend,
          performance_metrics: this.performanceMetrics,
          page_info: {
            url: window.location.href,
            title: document.title,
            referrer: document.referrer
          },
          timestamp: Date.now()
        };

        const response = await fetch(this.config.api_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (this.config.debug_mode) {
          console.log(`[FrontendErrorCollector] Flushed ${errorsToSend.length} errors`);
        }

      } catch (error) {
        // Put errors back in queue if send failed
        this.errorQueue.unshift(...errorsToSend);
        
        if (this.config.debug_mode) {
          console.error('[FrontendErrorCollector] Failed to flush errors:', error);
        }
      }
    }

    /**
     * 🎯 Get CSS selector for element
     */
    getSelector(element) {
      if (element.id) {
        return `#${element.id}`;
      }
      
      const path = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        
        if (element.className) {
          selector += '.' + element.className.split(' ').join('.');
        }
        
        path.unshift(selector);
        element = element.parentNode;
      }
      
      return path.join(' > ');
    }

    /**
     * 🆔 Generate interaction ID
     */
    generateInteractionId() {
      return 'interaction_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 🆔 Get session ID
     */
    getSessionId() {
      if (!this.sessionId) {
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      return this.sessionId;
    }

    /**
     * 📊 Get current metrics
     */
    getMetrics() {
      return {
        performance_metrics: this.performanceMetrics,
        queue_length: this.errorQueue.length,
        error_counts: Object.fromEntries(this.errorCounts),
        is_online: this.isOnline
      };
    }
  }

  // Auto-initialize with configuration from window or defaults
  const config = window.HeadyErrorConfig || {};
  window.HeadyErrorCollector = new FrontendErrorCollector(config);

  // Expose global function for manual error reporting
  window.reportError = function(error, context = {}) {
    window.HeadyErrorCollector.recordError({
      type: 'manual_report',
      message: error.message || error,
      stack: error.stack,
      ...context,
      timestamp: Date.now()
    });
  };

  // Expose global function for manual performance reporting
  window.reportPerformance = function(metric, value) {
    if (window.HeadyErrorCollector.performanceMetrics) {
      window.HeadyErrorCollector.performanceMetrics[metric] = value;
    }
  };

})(window, document);
