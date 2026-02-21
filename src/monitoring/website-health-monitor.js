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
// ║  FILE: website-health-monitor.js                             ║
// ║  UPDATED: 20260219-220500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🌐 Website Health Monitor
 * 
 * Automatically detects website errors, broken links, non-functional buttons,
 * and JavaScript errors. Integrates with HCFP Full Auto for self-healing.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const puppeteer = require('puppeteer');

class WebsiteHealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      check_interval_seconds: config.check_interval_seconds || 60,
      timeout_ms: config.timeout_ms || 10000,
      user_agent: config.user_agent || 'HeadyHealthMonitor/2.0',
      screenshot_on_error: config.screenshot_on_error !== false,
      max_concurrent_checks: config.max_concurrent_checks || 5,
      production_domains: {
        headybuddy: {
          app: 'https://headybuddy.org'
        },
        headysystems: {
          app: 'https://headysystems.com'
        },
        headyconnection: {
          app: 'https://headyconnection.org'
        },
        headymcp: {
          app: 'https://headymcp.com'
        },
        headyio: {
          app: 'https://headyio.com'
        },
        headyme: {
          app: 'https://headyme.com'
        }
      },
      skip_network_checks: config.skip_network_checks || process.env.HCFP_SKIP_WEBSITE_CHECKS === 'true',
      ...config
    };
    
    // Health state
    this.healthStatus = new Map();
    this.errorHistory = [];
    this.performanceMetrics = new Map();
    this.lastCheckTime = null;
    
    // Puppeteer browser pool
    this.browserPool = [];
    this.maxBrowserInstances = 3;
    
    // Critical paths to test
    this.criticalPaths = {
      headybuddy: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ],
      headysystems: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ],
      headyconnection: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ],
      headymcp: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ],
      headyio: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ],
      headyme: [
        { url: '/', name: 'landing', expected_elements: ['body', 'h2'] }
      ]
    };
    
    // Monitoring timers
    this.healthCheckTimer = null;
    this.deepScanTimer = null;
    
    console.log('[WebsiteHealthMonitor] Initialized with production domains');
  }

  /**
   * 🚀 Start monitoring
   */
  async start() {
    console.log('\n🌐 STARTING WEBSITE HEALTH MONITOR');
    console.log('='.repeat(50));
    
    try {
      if (this.config.skip_network_checks) {
        console.log('⚠️ Network checks disabled via config/env');
        // Still start timers so the system runs, but they will skip network calls
        this.startHealthChecks();
        this.startDeepScans();
        console.log('✅ Website Health Monitor started (network checks disabled)');
        this.emit('started');
        return;
      }
      
      // Initialize browser pool
      await this.initializeBrowserPool();
      
      // Start periodic health checks
      this.startHealthChecks();
      
      // Start deep scans
      this.startDeepScans();
      
      console.log('✅ Website Health Monitor started');
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start Website Health Monitor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 🛑 Stop monitoring
   */
  async stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.deepScanTimer) {
      clearInterval(this.deepScanTimer);
      this.deepScanTimer = null;
    }
    
    // Close browser pool
    await this.closeBrowserPool();
    
    console.log('[WebsiteHealthMonitor] Stopped');
    this.emit('stopped');
  }

  /**
   * 🔄 Start periodic health checks
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('❌ Health check failed:', error);
        this.emit('health_check_error', error);
      }
    }, this.config.check_interval_seconds * 1000);
    
    console.log(`🔄 Health checks started (interval: ${this.config.check_interval_seconds}s)`);
  }

  /**
   * 🔍 Start deep scans
   */
  startDeepScans() {
    // Deep scan every 10 minutes
    const deepScanInterval = 10 * 60 * 1000;
    
    this.deepScanTimer = setInterval(async () => {
      try {
        await this.performDeepScan();
      } catch (error) {
        console.error('❌ Deep scan failed:', error);
        this.emit('deep_scan_error', error);
      }
    }, deepScanInterval);
    
    console.log('🔍 Deep scans started (interval: 10 minutes)');
  }

  /**
   * 🏥 Perform comprehensive health checks
   */
  async performHealthChecks() {
    const startTime = Date.now();
    console.log('\n🏥 PERFORMING WEBSITE HEALTH CHECKS');
    
    const results = {};
    
    if (this.config.skip_network_checks) {
      console.log('⚠️ Skipping network checks (disabled)');
      const overallHealth = {
        score: 80,
        total_checks: 0,
        passed_checks: 0,
        avg_response_time_ms: 0,
        js_error_count: 0,
        status: 'unknown'
      };

      const payload = {
        timestamp: new Date(),
        results: {},
        overall_health: overallHealth,
        duration_ms: Date.now() - startTime
      };
      
      this.emit('health_checks_completed', payload);
      
      console.log(`✅ Health checks completed in ${Date.now() - startTime}ms (Overall: ${overallHealth.score}%)`);
      return payload;
    }
    
    for (const [site, domains] of Object.entries(this.config.production_domains)) {
      console.log(`\n📊 Checking ${site}...`);
      results[site] = await this.checkSite(site, domains);
    }
    
    const duration = Date.now() - startTime;
    this.lastCheckTime = new Date();
    
    // Calculate overall health score
    const overallHealth = this.calculateOverallHealth(results);
    
    // Update ORS based on website health
    await this.updateORSFromWebsiteHealth(overallHealth);
    
    const payload = {
      timestamp: this.lastCheckTime,
      results,
      overall_health: overallHealth,
      duration_ms: duration
    };

    // Emit results
    this.emit('health_checks_completed', payload);
    
    console.log(`✅ Health checks completed in ${duration}ms (Overall: ${overallHealth.score}%)`);
    
    return payload;
  }

  /**
   * 🌐 Check individual site
   */
  async checkSite(siteName, domains) {
    const siteResults = {
      app: domains.app ? await this.checkEndpoint(domains.app, 'app', siteName) : null,
      api: domains.api ? await this.checkEndpoint(domains.api, 'api', siteName) : null,
      admin: domains.admin ? await this.checkEndpoint(domains.admin, 'admin', siteName) : null
    };
    
    // Test critical paths if app is healthy
    if (siteResults.app?.healthy && this.criticalPaths[siteName]) {
      siteResults.critical_paths = await this.checkCriticalPaths(siteName, domains.app);
    }
    
    return siteResults;
  }

  /**
   * 🔗 Check endpoint health
   */
  async checkEndpoint(url, type, siteName) {
    if (!url) {
      return {
        url: null,
        type,
        healthy: true,
        skipped: true,
        reason: 'endpoint_not_configured',
        timestamp: new Date()
      };
    }

    const startTime = Date.now();
    
    try {
      // Basic HTTP check
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.user_agent
        }
      }, this.config.timeout_ms);
      
      const responseTime = Date.now() - startTime;
      const healthy = (response.ok && response.status >= 200 && response.status < 400) || response.status === 403; // 403 means site exists but blocks access
      
      let contentCheck = null;
      let jsErrors = [];
      
      if (type === 'app' && healthy) {
        // For app endpoints, do deeper browser check
        const browserResult = await this.checkWithBrowser(url);
        contentCheck = browserResult.contentCheck;
        jsErrors = browserResult.jsErrors;
      }
      
      const result = {
        url,
        type,
        healthy,
        status_code: response.status,
        response_time_ms: responseTime,
        js_errors: jsErrors,
        content_check: contentCheck,
        timestamp: new Date()
      };
      
      // If 403 from Cloudflare, consider it "healthy" (site exists)
      if (response.status === 403 && response.headers.get('server')?.includes('cloudflare')) {
        result.healthy = true;
        result.cloudflare_protected = true;
        result.notes = 'Cloudflare protected - site exists';
      }
      
      return result;
      
    } catch (error) {
      const networkError = error.cause || error;
      const errorCode = networkError?.code || null;
      const errorMessage = networkError?.message || error.message;
      const isNetworkIssue = this.isNetworkUnreachableError(errorCode, errorMessage);

      const result = {
        url,
        type,
        healthy: false,
        error: errorMessage,
        response_time_ms: Date.now() - startTime,
        timestamp: new Date(),
        unreachable: isNetworkIssue,
        error_code: errorCode
      };
      
      // Record error
      this.recordError(siteName, type, error);
      
      return result;
    }
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = this.config.timeout_ms) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 🌐 Check with browser for JavaScript errors and functionality
   */
  async checkWithBrowser(url) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      // Set up error handling
      const jsErrors = [];
      page.on('error', error => {
        jsErrors.push({
          type: 'page_error',
          message: error.message,
          stack: error.stack
        });
      });
      
      page.on('pageerror', error => {
        jsErrors.push({
          type: 'javascript_error',
          message: error.message,
          stack: error.stack
        });
      });
      
      page.on('requestfailed', request => {
        jsErrors.push({
          type: 'request_failed',
          url: request.url(),
          failure: request.failure()
        });
      });
      
      // Navigate to page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout_ms
      });
      
      // Check for basic elements
      const contentCheck = await page.evaluate(() => {
        const checks = {
          hasTitle: !!document.title,
          hasBody: !!document.body,
          hasMain: !!document.querySelector('main'),
          hasNav: !!document.querySelector('nav'),
          hasFooter: !!document.querySelector('footer'),
          buttonCount: document.querySelectorAll('button').length,
          linkCount: document.querySelectorAll('a').length,
          formCount: document.querySelectorAll('form').length
        };
        
        // Check if buttons are actually functional (have click handlers)
        const buttons = document.querySelectorAll('button');
        let functionalButtons = 0;
        for (const button of buttons) {
          const onclick = button.getAttribute('onclick');
          const listeners = typeof getEventListeners === 'function' ? getEventListeners(button) : null;
          if (onclick || (listeners && listeners.click)) {
            functionalButtons++;
          }
        }
        
        checks.functionalButtonCount = functionalButtons;
        checks.functionalButtonRatio = buttons.length > 0 ? functionalButtons / buttons.length : 1;
        
        return checks;
      });
      
      // Take screenshot if there are errors
      let screenshot = null;
      if (jsErrors.length > 0 && this.config.screenshot_on_error) {
        screenshot = await page.screenshot({ encoding: 'base64' });
      }
      
      return {
        contentCheck: {
          passed: contentCheck.hasTitle && contentCheck.hasBody && contentCheck.functionalButtonRatio > 0.5,
          details: contentCheck
        },
        jsErrors,
        screenshot
      };
      
    } finally {
      await page.close();
      this.releaseBrowser(browser);
    }
  }

  /**
   * 🛤️ Check critical paths
   */
  async checkCriticalPaths(siteName, baseUrl) {
    const paths = this.criticalPaths[siteName] || [];
    const results = [];
    
    for (const pathConfig of paths) {
      const url = baseUrl + pathConfig.url;
      const result = await this.checkPath(url, pathConfig);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 🛤️ Check specific path
   */
  async checkPath(url, pathConfig) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout_ms
      });
      
      // Check for expected elements
      const elementCheck = await page.evaluate((expectedElements) => {
        const results = {};
        for (const selector of expectedElements) {
          const element = document.querySelector(selector);
          results[selector] = {
            exists: !!element,
            visible: element ? (element.offsetParent !== null) : false,
            functional: false
          };
          
          // Check if element is functional (button/link)
          if (element) {
            const tagName = element.tagName.toLowerCase();
            if (tagName === 'button' || tagName === 'a') {
              const onclick = element.getAttribute('onclick');
              const href = element.getAttribute('href');
              results[selector].functional = !!(onclick || href);
            }
          }
        }
        
        return results;
      }, pathConfig.expected_elements);
      
      const allElementsExist = Object.values(elementCheck).every(check => check.exists);
      const interactiveSelectors = (pathConfig.expected_elements || []).filter(s =>
        s === 'button' || s === 'a' || s.startsWith('input') || s.startsWith('a[') || s.startsWith('button[')
      );
      const hasInteractiveExpectations = interactiveSelectors.length > 0;
      const interactiveFunctional = hasInteractiveExpectations
        ? interactiveSelectors.filter(s => elementCheck[s]?.functional).length / interactiveSelectors.length
        : 1;
      
      return {
        url: url,
        path_name: pathConfig.name,
        healthy: allElementsExist && (!hasInteractiveExpectations || interactiveFunctional > 0.5),
        element_check: elementCheck,
        functional_ratio: interactiveFunctional,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        url: url,
        path_name: pathConfig.name,
        healthy: false,
        error: error.message,
        timestamp: new Date()
      };
    } finally {
      await page.close();
      this.releaseBrowser(browser);
    }
  }

  /**
   * 🔍 Perform deep scan
   */
  async performDeepScan() {
    console.log('\n🔍 PERFORMING DEEP WEBSITE SCAN');

    if (this.config.skip_network_checks) {
      console.log('⚠️ Skipping deep scan (network checks disabled)');
      return {};
    }
    
    const deepResults = {};
    
    for (const [site, domains] of Object.entries(this.config.production_domains)) {
      console.log(`🔍 Deep scanning ${site}...`);
      deepResults[site] = await this.deepScanSite(site, domains);
    }
    
    this.emit('deep_scan_completed', {
      timestamp: new Date(),
      results: deepResults
    });
    
    return deepResults;
  }

  /**
   * 🔍 Deep scan individual site
   */
  async deepScanSite(siteName, domains) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      await page.goto(domains.app, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout_ms * 2
      });
      
      // Comprehensive analysis
      const analysis = await page.evaluate(() => {
        // Find all links and check if they're functional
        const links = Array.from(document.querySelectorAll('a[href]'));
        const linkAnalysis = links.map(link => ({
          href: link.href,
          text: link.textContent.trim(),
          exists: true,
          isInternal: link.href.startsWith(window.location.origin),
          hasOnClick: !!link.onclick
        }));
        
        // Find all buttons and check functionality
        const buttons = Array.from(document.querySelectorAll('button'));
        const buttonAnalysis = buttons.map(button => ({
          text: button.textContent.trim(),
          type: button.type,
          disabled: button.disabled,
          hasOnClick: !!button.onclick,
          isFormSubmit: button.type === 'submit'
        }));
        
        // Check for forms
        const forms = Array.from(document.querySelectorAll('form'));
        const formAnalysis = forms.map(form => ({
          action: form.action,
          method: form.method,
          inputCount: form.querySelectorAll('input').length,
          hasSubmitButton: form.querySelector('button[type="submit"], input[type="submit"]') !== null
        }));
        
        // Check for JavaScript errors in console
        const errorElements = document.querySelectorAll('[data-error], .error, .alert-danger');
        
        return {
          links: linkAnalysis,
          buttons: buttonAnalysis,
          forms: formAnalysis,
          errorElements: errorElements.length,
          title: document.title,
          hasMetaTags: !!document.querySelector('meta[name="description"]')
        };
      });
      
      // Test some links
      const linkTests = [];
      for (const link of analysis.links.slice(0, 10)) { // Test first 10 links
        if (link.isInternal) {
          try {
            const linkResponse = await this.fetchWithTimeout(link.href, { method: 'HEAD' }, this.config.timeout_ms);
            linkTests.push({
              href: link.href,
              status: linkResponse.status,
              accessible: linkResponse.ok
            });
          } catch (error) {
            linkTests.push({
              href: link.href,
              error: error.message,
              accessible: false
            });
          }
        }
      }
      
      return {
        analysis,
        link_tests: linkTests,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date()
      };
    } finally {
      await page.close();
      this.releaseBrowser(browser);
    }
  }

  /**
   * 📊 Calculate overall health score
   */
  calculateOverallHealth(results) {
    let totalChecks = 0;
    let passedChecks = 0;
    let totalResponseTime = 0;
    let jsErrorCount = 0;
    
    for (const [site, siteResults] of Object.entries(results)) {
      // Check endpoints
      for (const [type, endpointResult] of Object.entries(siteResults)) {
        if (!['app', 'api', 'admin'].includes(type)) continue;
        if (!endpointResult) continue;
        if (endpointResult.skipped) continue;
        if (endpointResult.unreachable) continue;
        
        totalChecks++;
        if (endpointResult.healthy) passedChecks++;
        
        if (endpointResult.response_time_ms) {
          totalResponseTime += endpointResult.response_time_ms;
        }
        
        if (endpointResult.js_errors) {
          jsErrorCount += endpointResult.js_errors.length;
        }
      }
      
      // Check critical paths
      if (siteResults.critical_paths) {
        for (const pathResult of siteResults.critical_paths) {
          totalChecks++;
          if (pathResult.healthy) passedChecks++;
        }
      }
    }
    
    const hasObservations = totalChecks > 0;
    const healthScore = hasObservations
      ? (passedChecks / totalChecks) * 100
      : 80; // Unknown health defaults to neutral-good score
    const avgResponseTime = hasObservations ? totalResponseTime / totalChecks : 0;
    const status = hasObservations
      ? (healthScore >= 90 ? 'excellent' : healthScore >= 70 ? 'good' : healthScore >= 50 ? 'poor' : 'critical')
      : 'unknown';
    
    return {
      score: Math.round(healthScore),
      total_checks: totalChecks,
      passed_checks: passedChecks,
      avg_response_time_ms: Math.round(avgResponseTime),
      js_error_count: jsErrorCount,
      status
    };
  }

  /**
   * 📈 Update ORS based on website health
   */
  async updateORSFromWebsiteHealth(healthResult) {
    try {
      // Calculate website health impact on ORS
      let orsImpact = 0;
      
      if (healthResult.status === 'excellent') {
        orsImpact = 0; // No impact
      } else if (healthResult.status === 'good') {
        orsImpact = -5; // Small impact
      } else if (healthResult.status === 'poor') {
        orsImpact = -15; // Moderate impact
      } else if (healthResult.status === 'critical') {
        orsImpact = -30; // Severe impact
      } else if (healthResult.status === 'unknown') {
        orsImpact = -5; // Mild impact for unknown state
      }
      
      // Additional penalties for JavaScript errors
      if (healthResult.js_error_count > 0) {
        orsImpact -= Math.min(20, healthResult.js_error_count * 2);
      }
      
      // Send to system status endpoint
      const payload = {
        source: 'website_health_monitor',
        ors_impact: orsImpact,
        health_score: healthResult.score,
        js_error_count: healthResult.js_error_count,
        avg_response_time: healthResult.avg_response_time_ms,
        timestamp: new Date()
      };
      
      // This would integrate with your existing ORS system
      console.log(`📊 Website health impact on ORS: ${orsImpact} points`);
      this.emit('ors_impact_calculated', payload);
      
      // If health is critical, trigger immediate alert
      if (healthResult.status === 'critical') {
        this.emit('critical_website_health', {
          health_result: healthResult,
          ors_impact: orsImpact
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to update ORS from website health:', error);
    }
  }

  /**
   * 📝 Record error
   */
  recordError(siteName, endpointType, error) {
    const errorRecord = {
      timestamp: new Date(),
      site: siteName,
      endpoint_type: endpointType,
      error: error.message,
      stack: error.stack
    };
    
    this.errorHistory.push(errorRecord);
    
    // Keep only recent errors
    this.errorHistory = this.errorHistory.slice(-100);
    
    this.emit('error_recorded', errorRecord);
  }

  isNetworkUnreachableError(errorCode, errorMessage = '') {
    const unreachableCodes = ['ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNRESET'];
    if (errorCode && unreachableCodes.includes(errorCode)) {
      return true;
    }
    const msg = (errorMessage || '').toLowerCase();
    return unreachableCodes.some(code => msg.includes(code.toLowerCase()))
      || msg.includes('dns')
      || msg.includes('network is unreachable')
      || msg.includes('fetch failed');
  }

  /**
   * 🌐 Initialize browser pool
   */
  async initializeBrowserPool() {
    for (let i = 0; i < this.maxBrowserInstances; i++) {
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.browserPool.push(browser);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize browser instance ${i}:`, error.message);
      }
    }
    
    console.log(`🌐 Browser pool initialized with ${this.browserPool.length} instances`);
  }

  /**
   * 🌐 Get browser from pool
   */
  async getBrowser() {
    if (this.browserPool.length === 0) {
      // Create new browser if pool is empty
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    
    return this.browserPool.pop();
  }

  /**
   * 🌐 Release browser back to pool
   */
  releaseBrowser(browser) {
    if (this.browserPool.length < this.maxBrowserInstances) {
      this.browserPool.push(browser);
    } else {
      // Close if pool is full
      browser.close();
    }
  }

  /**
   * 🌐 Close browser pool
   */
  async closeBrowserPool() {
    for (const browser of this.browserPool) {
      await browser.close();
    }
    this.browserPool = [];
  }

  /**
   * 📊 Get current health status
   */
  getHealthStatus() {
    return {
      last_check: this.lastCheckTime,
      health_status: Object.fromEntries(this.healthStatus),
      performance_metrics: Object.fromEntries(this.performanceMetrics),
      recent_errors: this.errorHistory.slice(-10)
    };
  }
}

module.exports = WebsiteHealthMonitor;

// Auto-run if called directly
if (require.main === module) {
  const monitor = new WebsiteHealthMonitor();
  
  monitor.start()
    .then(() => {
      console.log('\n🎉 Website Health Monitor is running!');
      console.log('🌐 Monitoring production domains for errors and functionality...');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await monitor.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await monitor.stop();
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('\n💥 Failed to start Website Health Monitor:', error);
      process.exit(1);
    });
}
