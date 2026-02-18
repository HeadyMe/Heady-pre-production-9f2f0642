const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class EmblemErrorDetector {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🔍 Initializing Emblem Error Detector...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Enable console error capture
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.errors.push({
                    type: 'console_error',
                    message: msg.text(),
                    timestamp: new Date().toISOString()
                });
            } else if (msg.type() === 'warning') {
                this.warnings.push({
                    type: 'console_warning',
                    message: msg.text(),
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Enable page error capture
        this.page.on('pageerror', error => {
            this.errors.push({
                type: 'page_error',
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Enable request error capture
        this.page.on('requestfailed', request => {
            this.errors.push({
                type: 'request_failed',
                url: request.url(),
                failure: request.failure(),
                timestamp: new Date().toISOString()
            });
        });

        console.log('✅ Browser initialized successfully');
    }

    async checkPage(pagePath, url) {
        console.log(`\n🔍 Checking: ${pagePath}`);
        const pageErrors = [];
        const pageWarnings = [];
        
        try {
            // Navigate to the page
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Check for missing CSS files
            const cssCheck = await this.page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
                return links.map(link => ({
                    href: link.href,
                    loaded: link.sheet !== null,
                    error: link.sheet ? null : 'CSS file not loaded'
                }));
            });

            cssCheck.forEach(css => {
                if (!css.loaded) {
                    pageErrors.push({
                        type: 'css_missing',
                        file: css.href,
                        error: css.error
                    });
                }
            });

            // Check for missing JavaScript files
            const jsCheck = await this.page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                return scripts.map(script => ({
                    src: script.src,
                    loaded: script.readyState === 'loaded' || script.readyState === 'complete',
                    error: script.onerror ? 'Script load error' : null
                }));
            });

            jsCheck.forEach(js => {
                if (!js.loaded) {
                    pageErrors.push({
                        type: 'js_missing',
                        file: js.src,
                        error: js.error
                    });
                }
            });

            // Check for emblem-specific elements
            const emblemCheck = await this.page.evaluate(() => {
                const checks = {
                    emblemDesignSystem: !!document.querySelector('link[href*="emblem-design-system.css"]'),
                    emblemComponents: !!document.querySelector('link[href*="emblem-components.css"]'),
                    cornerElements: !!document.querySelector('.emblem-corner-bottom-left, .emblem-corner-bottom-right'),
                    floatingEmblems: !!document.querySelector('.emblem-corner-floats'),
                    emblemButtons: !!document.querySelector('.emblem-btn-primary, .emblem-btn-geometry, .emblem-btn-lotus'),
                    emblemIcons: !!document.querySelector('.emblem-icon-geometry, .emblem-icon-lotus')
                };
                return checks;
            });

            // Check emblem elements
            Object.entries(emblemCheck).forEach(([element, exists]) => {
                if (!exists) {
                    pageWarnings.push({
                        type: 'missing_emblem_element',
                        element: element,
                        message: `Emblem element "${element}" not found`
                    });
                }
            });

            // Check CSS variables
            const cssVarCheck = await this.page.evaluate(() => {
                const computedStyle = getComputedStyle(document.body);
                const vars = [
                    '--sacred-geometry-bg',
                    '--cosmic-gradient',
                    '--emblem-glass',
                    '--sacred-gold',
                    '--purple-glow',
                    '--blue-glow',
                    '--green-glow',
                    '--gold-glow'
                ];
                
                return vars.map(variable => ({
                    variable: variable,
                    value: computedStyle.getPropertyValue(variable),
                    defined: computedStyle.getPropertyValue(variable) !== ''
                }));
            });

            cssVarCheck.forEach(cssVar => {
                if (!cssVar.defined) {
                    pageErrors.push({
                        type: 'css_variable_missing',
                        variable: cssVar.variable,
                        message: `CSS variable "${cssVar.variable}" not defined`
                    });
                }
            });

            // Check for broken images
            const imageCheck = await this.page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images.map(img => ({
                    src: img.src,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    complete: img.complete,
                    error: img.naturalWidth === 0 ? 'Image failed to load' : null
                }));
            });

            imageCheck.forEach(img => {
                if (img.error) {
                    pageErrors.push({
                        type: 'image_broken',
                        src: img.src,
                        error: img.error
                    });
                }
            });

            // Check for responsive design issues
            const responsiveCheck = await this.page.evaluate(() => {
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const hasHorizontalScroll = document.body.scrollWidth > viewportWidth;
                const hasVerticalScroll = document.body.scrollHeight > viewportHeight;
                
                return {
                    viewportWidth,
                    viewportHeight,
                    hasHorizontalScroll,
                    hasVerticalScroll,
                    bodyWidth: document.body.scrollWidth,
                    bodyHeight: document.body.scrollHeight
                };
            });

            if (responsiveCheck.hasHorizontalScroll) {
                pageWarnings.push({
                    type: 'responsive_issue',
                    issue: 'horizontal_scroll',
                    message: `Page has horizontal scroll at ${responsiveCheck.viewportWidth}px width`
                });
            }

            // Check for JavaScript errors in emblem functions
            const jsFunctionCheck = await this.page.evaluate(() => {
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
                    exists: typeof window[func] === 'function',
                    error: typeof window[func] !== 'function' ? 'Function not defined' : null
                }));
            });

            jsFunctionCheck.forEach(func => {
                if (func.error) {
                    pageErrors.push({
                        type: 'js_function_missing',
                        function: func.function,
                        error: func.error
                    });
                }
            });

            console.log(`✅ Page check completed: ${pageErrors.length} errors, ${pageWarnings.length} warnings`);

        } catch (error) {
            pageErrors.push({
                type: 'navigation_error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            console.log(`❌ Navigation error: ${error.message}`);
        }

        return {
            page: pagePath,
            url: url,
            errors: pageErrors,
            warnings: pageWarnings
        };
    }

    async scanAllPages() {
        const pages = [
            { path: 'chat-fixed-enhanced.html', port: 8080 },
            { path: 'admin-ui.html', port: 8080 },
            { path: 'index.html', port: 8080 },
            { path: 'index-enhanced.html', port: 8080 },
            { path: 'chat-enhanced.html', port: 8080 },
            { path: 'admin-ui-enhanced.html', port: 8080 }
        ];

        const results = [];

        for (const page of pages) {
            const url = `http://localhost:${page.port}/${page.path}`;
            const result = await this.checkPage(page.path, url);
            results.push(result);
            
            // Add to global errors/warnings
            this.errors.push(...result.errors);
            this.warnings.push(...result.warnings);
        }

        return results;
    }

    async generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total_pages: results.length,
                total_errors: this.errors.length,
                total_warnings: this.warnings.length,
                pages_with_errors: results.filter(r => r.errors.length > 0).length,
                pages_with_warnings: results.filter(r => r.warnings.length > 0).length
            },
            pages: results,
            all_errors: this.errors,
            all_warnings: this.warnings,
            recommendations: this.generateRecommendations()
        };

        // Save detailed report
        const reportPath = path.join(__dirname, 'emblem-error-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Generate human-readable summary
        const summaryPath = path.join(__dirname, 'emblem-error-summary.txt');
        const summary = this.generateTextSummary(report);
        fs.writeFileSync(summaryPath, summary);

        console.log(`\n📊 Reports generated:`);
        console.log(`   Detailed: ${reportPath}`);
        console.log(`   Summary: ${summaryPath}`);

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.errors.some(e => e.type === 'css_missing')) {
            recommendations.push('🔧 Fix missing CSS files - ensure emblem-design-system.css and emblem-components.css are accessible');
        }
        
        if (this.errors.some(e => e.type === 'js_function_missing')) {
            recommendations.push('🔧 Implement missing JavaScript functions for emblem mode toggles');
        }
        
        if (this.errors.some(e => e.type === 'css_variable_missing')) {
            recommendations.push('🔧 Define missing CSS variables in emblem-design-system.css');
        }
        
        if (this.warnings.some(w => w.type === 'missing_emblem_element')) {
            recommendations.push('🎨 Add missing emblem elements for complete design system integration');
        }
        
        if (this.warnings.some(w => w.type === 'responsive_issue')) {
            recommendations.push('📱 Fix responsive design issues to prevent horizontal scrolling');
        }

        return recommendations;
    }

    generateTextSummary(report) {
        let summary = `EMBLEM DESIGN SYSTEM ERROR DETECTION REPORT\n`;
        summary += `Generated: ${new Date(report.timestamp).toLocaleString()}\n`;
        summary += `${'='.repeat(60)}\n\n`;

        summary += `SUMMARY:\n`;
        summary += `  Total Pages Checked: ${report.summary.total_pages}\n`;
        summary += `  Total Errors: ${report.summary.total_errors}\n`;
        summary += `  Total Warnings: ${report.summary.total_warnings}\n`;
        summary += `  Pages with Errors: ${report.summary.pages_with_errors}\n`;
        summary += `  Pages with Warnings: ${report.summary.pages_with_warnings}\n\n`;

        if (report.summary.total_errors > 0) {
            summary += `ERRORS BY TYPE:\n`;
            const errorTypes = {};
            report.all_errors.forEach(error => {
                errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
            });
            Object.entries(errorTypes).forEach(([type, count]) => {
                summary += `  ${type}: ${count}\n`;
            });
            summary += `\n`;
        }

        if (report.summary.total_warnings > 0) {
            summary += `WARNINGS BY TYPE:\n`;
            const warningTypes = {};
            report.all_warnings.forEach(warning => {
                warningTypes[warning.type] = (warningTypes[warning.type] || 0) + 1;
            });
            Object.entries(warningTypes).forEach(([type, count]) => {
                summary += `  ${type}: ${count}\n`;
            });
            summary += `\n`;
        }

        summary += `PAGE-BY-PAGE BREAKDOWN:\n`;
        report.pages.forEach(page => {
            summary += `\n${page.page}:\n`;
            summary += `  Errors: ${page.errors.length}\n`;
            summary += `  Warnings: ${page.warnings.length}\n`;
            
            if (page.errors.length > 0) {
                summary += `  Error Details:\n`;
                page.errors.forEach(error => {
                    summary += `    - ${error.type}: ${error.message || error.error}\n`;
                });
            }
            
            if (page.warnings.length > 0) {
                summary += `  Warning Details:\n`;
                page.warnings.forEach(warning => {
                    summary += `    - ${warning.type}: ${warning.message}\n`;
                });
            }
        });

        if (report.recommendations.length > 0) {
            summary += `\nRECOMMENDATIONS:\n`;
            report.recommendations.forEach(rec => {
                summary += `  ${rec}\n`;
            });
        }

        return summary;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }
}

// Main execution
async function runErrorDetection() {
    const detector = new EmblemErrorDetector();
    
    try {
        await detector.initialize();
        const results = await detector.scanAllPages();
        const report = await detector.generateReport(results);
        
        console.log(`\n🎯 Error Detection Complete!`);
        console.log(`   Total Errors: ${report.summary.total_errors}`);
        console.log(`   Total Warnings: ${report.summary.total_warnings}`);
        console.log(`   Check emblem-error-summary.txt for detailed report`);
        
        return report;
    } catch (error) {
        console.error('❌ Error detection failed:', error);
    } finally {
        await detector.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    runErrorDetection();
}

module.exports = EmblemErrorDetector;
