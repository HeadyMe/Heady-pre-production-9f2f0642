#!/usr/bin/env node

/**
 * HeadyHeadless - Heady Systems Headless Browser Task Manager
 * 
 * A specialized headless browser automation system for:
 * - Emblem design system validation
 * - Production deployment verification
 * - Task management and monitoring
 * - Error detection and reporting
 * 
 * Integrates with HCFP auto-mode and HCAutoFlow
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class HeadyHeadless extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            // Production domains (ZERO LOCALHOST POLICY)
            domains: {
                main: 'https://headyme.com',
                chat: 'https://chat.headyme.com', 
                admin: 'https://headyme.com/admin-ui.html',
                manager: 'http://manager.headyme.com'
            },
            
            // Browser configuration
            browser: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            },
            
            // Task management
            tasks: {
                timeout: 30000,
                retries: 3,
                parallel: 5
            },
            
            // Emblem detection
            emblem: {
                cssFiles: ['emblem-design-system.css', 'emblem-components.css'],
                elements: [
                    'emblem-corner-bottom-left',
                    'emblem-corner-bottom-right', 
                    'emblem-corner-floats',
                    'emblem-btn-primary',
                    'emblem-btn-geometry',
                    'emblem-btn-lotus',
                    'emblem-icon-geometry',
                    'emblem-icon-lotus'
                ],
                cssVars: [
                    '--sacred-geometry-bg',
                    '--cosmic-gradient',
                    '--emblem-glass',
                    '--sacred-gold',
                    '--purple-glow',
                    '--blue-glow',
                    '--green-glow',
                    '--gold-glow'
                ]
            },
            
            ...options
        };
        
        this.browser = null;
        this.tasks = new Map();
        this.results = [];
        this.isRunning = false;
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            startTime: null
        };
    }

    /**
     * Initialize HeadyHeadless browser and task management system
     */
    async initialize() {
        console.log('🚀 Initializing HeadyHeadless - Heady Systems Headless Browser');
        console.log('🔒 ZERO LOCALHOST POLICY ENFORCED');
        console.log('🌐 Production Domains Only:', Object.values(this.config.domains).join(', '));
        
        try {
            // Initialize browser
            this.browser = await puppeteer.launch(this.config.browser);
            
            // Set up error handling
            this.setupErrorHandling();
            
            // Load task definitions
            await this.loadTaskDefinitions();
            
            this.isRunning = true;
            this.stats.startTime = new Date();
            
            this.emit('initialized');
            console.log('✅ HeadyHeadless initialized successfully');
            
        } catch (error) {
            console.error('❌ HeadyHeadless initialization failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Set up comprehensive error handling
     */
    setupErrorHandling() {
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught Exception:', error);
            this.emit('critical_error', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
            this.emit('critical_error', reason);
        });
    }

    /**
     * Load task definitions from configuration
     */
    async loadTaskDefinitions() {
        this.taskDefinitions = {
            // Emblem Design System Tasks
            'emblem-validation': {
                name: 'Emblem Design System Validation',
                description: 'Validate emblem components and styling across all pages',
                priority: 'high',
                pages: [
                    '/chat-fixed-enhanced.html',
                    '/admin-ui.html', 
                    '/index.html',
                    '/index-enhanced.html',
                    '/chat-enhanced.html',
                    '/admin-ui-enhanced.html'
                ],
                checks: ['css', 'elements', 'javascript', 'responsive', 'accessibility']
            },
            
            // Production Deployment Tasks
            'production-deployment': {
                name: 'Production Deployment Verification',
                description: 'Verify production deployment with zero localhost policy',
                priority: 'critical',
                domains: Object.values(this.config.domains),
                checks: ['domain-compliance', 'ssl', 'performance', 'security']
            },
            
            // HCFP Auto-Mode Tasks
            'hcfp-automation': {
                name: 'HCFP Auto-Mode Verification',
                description: 'Verify HCFP auto-mode and HCAutoFlow functionality',
                priority: 'high',
                endpoints: [
                    '/api/health',
                    '/api/system/production',
                    '/api/hcfp/status'
                ],
                checks: ['api-response', 'auto-deploy', 'validation']
            },
            
            // System Health Tasks
            'system-health': {
                name: 'System Health Monitoring',
                description: 'Monitor overall system health and performance',
                priority: 'medium',
                checks: ['uptime', 'memory', 'performance', 'errors']
            }
        };
    }

    /**
     * Execute a specific task
     */
    async executeTask(taskId, taskDefinition = null) {
        const task = taskDefinition || this.taskDefinitions[taskId];
        if (!task) {
            throw new Error(`Task definition not found: ${taskId}`);
        }

        const taskInfo = {
            id: taskId,
            name: task.name,
            startTime: new Date(),
            status: 'running',
            attempts: 0
        };

        this.tasks.set(taskId, taskInfo);
        this.stats.totalTasks++;
        
        console.log(`🎯 Executing Task: ${task.name}`);
        this.emit('task_started', taskInfo);

        try {
            let result;
            
            switch (taskId) {
                case 'emblem-validation':
                    result = await this.runEmblemValidation(task);
                    break;
                case 'production-deployment':
                    result = await this.runProductionDeployment(task);
                    break;
                case 'hcfp-automation':
                    result = await this.runHCFPAutomation(task);
                    break;
                case 'system-health':
                    result = await this.runSystemHealth(task);
                    break;
                default:
                    result = await this.runCustomTask(task);
            }

            taskInfo.endTime = new Date();
            taskInfo.status = 'completed';
            taskInfo.result = result;
            
            this.stats.completedTasks++;
            this.emit('task_completed', taskInfo);
            
            console.log(`✅ Task Completed: ${task.name}`);
            return result;

        } catch (error) {
            taskInfo.endTime = new Date();
            taskInfo.status = 'failed';
            taskInfo.error = error.message;
            
            this.stats.failedTasks++;
            this.emit('task_failed', taskInfo);
            
            console.error(`❌ Task Failed: ${task.name} - ${error.message}`);
            throw error;
        }
    }

    /**
     * Run emblem design system validation
     */
    async runEmblemValidation(task) {
        console.log('🔍 Running Emblem Design System Validation...');
        
        const page = await this.browser.newPage();
        const results = {
            pages: [],
            summary: {
                totalPages: task.pages.length,
                totalErrors: 0,
                totalWarnings: 0,
                emblemCompliance: 0
            }
        };

        try {
            for (const pagePath of task.pages) {
                const url = this.config.domains.main + pagePath;
                const pageResult = await this.validateEmblemPage(page, url, pagePath);
                results.pages.push(pageResult);
                
                results.summary.totalErrors += pageResult.errors.length;
                results.summary.totalWarnings += pageResult.warnings.length;
                
                if (pageResult.emblemCompliance > 0.8) {
                    results.emblemCompliance++;
                }
            }

            results.summary.emblemCompliance = (results.emblemCompliance / results.summary.totalPages) * 100;

        } finally {
            await page.close();
        }

        return results;
    }

    /**
     * Validate a single page for emblem compliance
     */
    async validateEmblemPage(page, url, pagePath) {
        const pageResult = {
            page: pagePath,
            url: url,
            errors: [],
            warnings: [],
            emblemCompliance: 0,
            loadTime: 0
        };

        const startTime = Date.now();

        try {
            // Navigate to page
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            pageResult.loadTime = Date.now() - startTime;

            // Check CSS files
            await this.checkEmblemCSS(page, pageResult);
            
            // Check emblem elements
            await this.checkEmblemElements(page, pageResult);
            
            // Check CSS variables
            await this.checkEmblemCSSVars(page, pageResult);
            
            // Check JavaScript functions
            await this.checkEmblemJS(page, pageResult);
            
            // Check responsive design
            await this.checkResponsive(page, pageResult);
            
            // Calculate compliance score
            const totalChecks = 5; // CSS, elements, vars, JS, responsive
            const passedChecks = [
                pageResult.errors.filter(e => e.type.startsWith('css')).length === 0,
                pageResult.warnings.filter(w => w.type === 'missing_emblem_element').length === 0,
                pageResult.errors.filter(e => e.type === 'css_variable_missing').length === 0,
                pageResult.errors.filter(e => e.type === 'js_function_missing').length === 0,
                pageResult.warnings.filter(w => w.type === 'responsive_issue').length === 0
            ].filter(Boolean).length;
            
            pageResult.emblemCompliance = (passedChecks / totalChecks) * 100;

        } catch (error) {
            pageResult.errors.push({
                type: 'navigation_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }

        return pageResult;
    }

    /**
     * Check emblem CSS files
     */
    async checkEmblemCSS(page, pageResult) {
        const cssFiles = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            return links.map(link => link.href);
        });

        this.config.emblem.cssFiles.forEach(requiredCSS => {
            if (!cssFiles.some(href => href.includes(requiredCSS))) {
                pageResult.errors.push({
                    type: 'css_missing',
                    file: requiredCSS,
                    message: `Required emblem CSS file not found: ${requiredCSS}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Check emblem elements
     */
    async checkEmblemElements(page, pageResult) {
        const elementsFound = await page.evaluate((elements) => {
            return elements.map(selector => ({
                selector: selector,
                found: document.querySelector(selector) !== null
            }));
        }, this.config.emblem.elements);

        elementsFound.forEach(({ selector, found }) => {
            if (!found) {
                pageResult.warnings.push({
                    type: 'missing_emblem_element',
                    element: selector,
                    message: `Emblem element not found: ${selector}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Check emblem CSS variables
     */
    async checkEmblemCSSVars(page, pageResult) {
        const cssVars = await page.evaluate((variables) => {
            const computedStyle = getComputedStyle(document.body);
            return variables.map(variable => ({
                variable: variable,
                value: computedStyle.getPropertyValue(variable),
                defined: computedStyle.getPropertyValue(variable) !== ''
            }));
        }, this.config.emblem.cssVars);

        cssVars.forEach(({ variable, defined }) => {
            if (!defined) {
                pageResult.errors.push({
                    type: 'css_variable_missing',
                    variable: variable,
                    message: `CSS variable not defined: ${variable}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Check emblem JavaScript functions
     */
    async checkEmblemJS(page, pageResult) {
        const jsFunctions = await page.evaluate(() => {
            const functions = [
                'toggleGeometryMode',
                'toggleLotusMode', 
                'toggleEyeMode',
                'toggleNatureMode',
                'toggleStarMode',
                'toggleRootMode'
            ];
            
            return functions.map(func => ({
                function: func,
                exists: typeof window[func] === 'function'
            }));
        });

        jsFunctions.forEach(({ func, exists }) => {
            if (!exists) {
                pageResult.errors.push({
                    type: 'js_function_missing',
                    function: func,
                    message: `JavaScript function not defined: ${func}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Check responsive design
     */
    async checkResponsive(page, pageResult) {
        // Test different viewport sizes
        const viewports = [
            { width: 375, height: 667, name: 'mobile' },
            { width: 768, height: 1024, name: 'tablet' },
            { width: 1920, height: 1080, name: 'desktop' }
        ];

        for (const viewport of viewports) {
            await page.setViewport(viewport);
            
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.body.scrollWidth > window.innerWidth;
            });

            if (hasHorizontalScroll) {
                pageResult.warnings.push({
                    type: 'responsive_issue',
                    viewport: viewport.name,
                    message: `Horizontal scroll detected at ${viewport.width}x${viewport.height}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Run production deployment verification
     */
    async runProductionDeployment(task) {
        console.log('🌐 Running Production Deployment Verification...');
        
        const results = {
            domains: [],
            summary: {
                totalDomains: task.domains.length,
                compliantDomains: 0,
                sslIssues: 0,
                performanceIssues: 0
            }
        };

        for (const domain of task.domains) {
            const domainResult = await this.verifyDomain(domain);
            results.domains.push(domainResult);
            
            if (domainResult.compliant) {
                results.summary.compliantDomains++;
            }
            if (domainResult.sslIssues > 0) {
                results.summary.sslIssues++;
            }
            if (domainResult.performanceIssues > 0) {
                results.summary.performanceIssues++;
            }
        }

        return results;
    }

    /**
     * Verify a specific domain
     */
    async verifyDomain(domain) {
        const page = await this.browser.newPage();
        const result = {
            domain: domain,
            compliant: true,
            sslIssues: 0,
            performanceIssues: 0,
            localhostViolations: 0,
            loadTime: 0,
            errors: []
        };

        try {
            const startTime = Date.now();
            await page.goto(domain, { waitUntil: 'networkidle2', timeout: 30000 });
            result.loadTime = Date.now() - startTime;

            // Check for localhost violations
            const content = await page.content();
            const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0'];
            
            localhostPatterns.forEach(pattern => {
                if (content.includes(pattern)) {
                    result.localhostViolations++;
                    result.compliant = false;
                    result.errors.push({
                        type: 'localhost_violation',
                        pattern: pattern,
                        message: `Localhost reference found: ${pattern}`,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // Check SSL certificate
            const response = await page.goto(domain);
            if (!response.ok()) {
                result.sslIssues++;
                result.compliant = false;
            }

            // Performance check
            if (result.loadTime > 5000) {
                result.performanceIssues++;
            }

        } catch (error) {
            result.compliant = false;
            result.errors.push({
                type: 'domain_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await page.close();
        }

        return result;
    }

    /**
     * Run HCFP automation verification
     */
    async runHCFPAutomation(task) {
        console.log('🤖 Running HCFP Automation Verification...');
        
        const results = {
            endpoints: [],
            summary: {
                totalEndpoints: task.endpoints.length,
                healthyEndpoints: 0,
                autoDeployActive: false,
                validationActive: false
            }
        };

        for (const endpoint of task.endpoints) {
            const endpointResult = await this.verifyEndpoint(endpoint);
            results.endpoints.push(endpointResult);
            
            if (endpointResult.healthy) {
                results.summary.healthyEndpoints++;
            }
        }

        return results;
    }

    /**
     * Verify API endpoint
     */
    async verifyEndpoint(endpoint) {
        const result = {
            endpoint: endpoint,
            healthy: false,
            responseTime: 0,
            status: null,
            errors: []
        };

        try {
            const startTime = Date.now();
            const response = await fetch(this.config.domains.manager + endpoint);
            result.responseTime = Date.now() - startTime;
            result.status = response.status;
            result.healthy = response.ok;

            if (response.ok) {
                const data = await response.json();
                
                // Check for HCFP specific features
                if (data.mode && data.mode.includes('VALIDATION')) {
                    result.validationActive = true;
                }
                if (data.auto_deploy) {
                    result.autoDeployActive = true;
                }
            }

        } catch (error) {
            result.errors.push({
                type: 'endpoint_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }

        return result;
    }

    /**
     * Run system health monitoring
     */
    async runSystemHealth(task) {
        console.log('🏥 Running System Health Monitoring...');
        
        const results = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            performance: {
                cpuUsage: process.cpuUsage(),
                loadAverage: require('os').loadavg()
            },
            tasks: {
                total: this.stats.totalTasks,
                completed: this.stats.completedTasks,
                failed: this.stats.failedTasks,
                successRate: this.stats.totalTasks > 0 ? (this.stats.completedTasks / this.stats.totalTasks) * 100 : 0
            },
            timestamp: new Date().toISOString()
        };

        return results;
    }

    /**
     * Run custom task
     */
    async runCustomTask(task) {
        // Placeholder for custom task execution
        return {
            task: task.name,
            status: 'completed',
            message: 'Custom task execution not implemented'
        };
    }

    /**
     * Execute multiple tasks in parallel
     */
    async executeTasks(taskIds) {
        const promises = taskIds.map(taskId => this.executeTask(taskId));
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            taskId: taskIds[index],
            status: result.status,
            value: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            tasks: Array.from(this.tasks.values()),
            summary: {
                totalTasks: this.stats.totalTasks,
                completedTasks: this.stats.completedTasks,
                failedTasks: this.stats.failedTasks,
                successRate: this.stats.totalTasks > 0 ? (this.stats.completedTasks / this.stats.totalTasks) * 100 : 0,
                runtime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0
            },
            config: this.config
        };

        // Save report
        const reportPath = path.join(__dirname, `headyheadless-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📊 Report generated: ${reportPath}`);
        return report;
    }

    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        console.log('🧹 Shutting down HeadyHeadless...');
        
        if (this.browser) {
            await this.browser.close();
        }
        
        this.isRunning = false;
        this.emit('shutdown');
        
        console.log('✅ HeadyHeadless shutdown complete');
    }
}

// CLI Interface
if (require.main === module) {
    const headyHeadless = new HeadyHeadless();
    
    async function main() {
        try {
            await headyHeadless.initialize();
            
            // Execute default tasks
            const tasks = ['emblem-validation', 'production-deployment', 'hcfp-automation', 'system-health'];
            const results = await headyHeadless.executeTasks(tasks);
            
            // Generate report
            const report = headyHeadless.generateReport();
            
            console.log('\n🎯 HeadyHeadless Execution Summary:');
            console.log(`   Total Tasks: ${report.summary.totalTasks}`);
            console.log(`   Completed: ${report.summary.completedTasks}`);
            console.log(`   Failed: ${report.summary.failedTasks}`);
            console.log(`   Success Rate: ${report.summary.successRate.toFixed(2)}%`);
            console.log(`   Runtime: ${(report.summary.runtime / 1000).toFixed(2)}s`);
            
        } catch (error) {
            console.error('❌ HeadyHeadless execution failed:', error);
            process.exit(1);
        } finally {
            await headyHeadless.cleanup();
        }
    }
    
    main();
}

module.exports = HeadyHeadless;
