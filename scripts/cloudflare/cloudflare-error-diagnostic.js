#!/usr/bin/env node

/**
 * 🌩️ CLOUDFLARE ERROR 1000 DIAGNOSTIC
 * 
 * Actually tests for the specific conditions that cause Cloudflare Error 1000
 * Simulates real browser behavior to identify the exact issues
 */

const http = require('http');
const https = require('https');

class CloudflareErrorDiagnostic {
    constructor() {
        this.externalDomains = [
            'https://headyme.com',
            'https://manager.headyme.com',
            'https://chat.headyme.com',
            'https://api.headysystems.com'
        ];
        this.localhostSites = [
            'http://localhost:8000',
            'http://localhost:3000',
            'http://localhost:3002',
            'http://localhost:3003'
        ];
        this.issues = [];
        this.findings = [];
    }
    
    async diagnoseCloudflareErrors() {
        console.log('🌩️ CLOUDFLARE ERROR 1000 DIAGNOSTIC');
        console.log('🔍 Testing actual conditions that cause Error 1000');
        
        // Test 1: Check if external domains are actually reachable
        await this.testExternalDomainReachability();
        
        // Test 2: Check if localhost sites are making external calls
        await this.testExternalCallsInLocalhost();
        
        // Test 3: Simulate browser behavior
        await this.simulateBrowserBehavior();
        
        // Test 4: Check DNS resolution
        await this.testDNSResolution();
        
        this.generateDiagnosticReport();
    }
    
    async testExternalDomainReachability() {
        console.log('\n🔍 Testing External Domain Reachability...');
        
        for (const domain of this.externalDomains) {
            try {
                console.log(`🧪 Testing ${domain}...`);
                
                const result = await this.testHTTPSConnection(domain);
                
                if (result.success) {
                    console.log(`✅ ${domain}: REACHABLE (${result.responseTime}ms)`);
                    this.findings.push(`${domain}: External domain reachable`);
                } else {
                    console.log(`❌ ${domain}: NOT REACHABLE - ${result.error}`);
                    this.issues.push(`${domain}: ${result.error}`);
                    
                    // This is likely causing Cloudflare Error 1000
                    if (result.error.includes('ENOTFOUND') || result.error.includes('ECONNREFUSED')) {
                        this.issues.push(`${domain}: DNS resolution failure - causes Error 1000`);
                    }
                }
                
            } catch (error) {
                console.log(`💥 ${domain}: CRITICAL ERROR - ${error.message}`);
                this.issues.push(`${domain}: ${error.message}`);
            }
        }
    }
    
    async testHTTPSConnection(url) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const request = https.get(url, { timeout: 5000 }, (response) => {
                const responseTime = Date.now() - startTime;
                
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    resolve({
                        success: true,
                        statusCode: response.statusCode,
                        responseTime
                    });
                } else {
                    resolve({
                        success: false,
                        error: `HTTP ${response.statusCode}`,
                        responseTime
                    });
                }
                
                response.on('error', (error) => {
                    resolve({
                        success: false,
                        error: error.message,
                        responseTime: Date.now() - startTime
                    });
                });
            });
            
            request.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - startTime
                });
            });
            
            request.on('timeout', () => {
                request.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout',
                    responseTime: 5000
                });
            });
        });
    }
    
    async testExternalCallsInLocalhost() {
        console.log('\n🔍 Testing External Calls in Localhost Sites...');
        
        for (const site of this.localhostSites) {
            try {
                console.log(`🧪 Analyzing ${site}...`);
                
                const content = await this.makeHTTPRequest(site);
                const externalCalls = this.findExternalCalls(content);
                
                if (externalCalls.length > 0) {
                    console.log(`⚠️ ${site}: Found ${externalCalls.length} external calls`);
                    externalCalls.forEach(call => {
                        console.log(`   - ${call}`);
                        this.issues.push(`${site}: Makes external call to ${call} - may cause Error 1000`);
                    });
                } else {
                    console.log(`✅ ${site}: No external calls found`);
                    this.findings.push(`${site}: No external calls detected`);
                }
                
            } catch (error) {
                console.log(`💥 ${site}: Failed to analyze - ${error.message}`);
                this.issues.push(`${site}: Analysis failed - ${error.message}`);
            }
        }
    }
    
    findExternalCalls(content) {
        const externalCalls = [];
        
        // Find fetch calls to external domains
        const fetchMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
        fetchMatches.forEach(match => {
            const url = match.match(/['"`]([^'"`]+)['"`]/)[1];
            if (url.includes('headyme.com') || url.includes('headysystems.com')) {
                externalCalls.push(url);
            }
        });
        
        // Find XMLHttpRequest calls
        const xhrMatches = content.match(/\.open\s*\(\s*['"`][^'"`]*['"`]\s*,\s*['"`]([^'"`]+)['"`]/g) || [];
        xhrMatches.forEach(match => {
            const url = match.match(/['"`]([^'"`]+)['"`]/)[1];
            if (url.includes('headyme.com') || url.includes('headysystems.com')) {
                externalCalls.push(url);
            }
        });
        
        // Find direct links and resources
        const linkMatches = content.match(/https?:\/\/[^'"`\s]+headyme[^'"`\s]*/g) || [];
        externalCalls.push(...linkMatches);
        
        return [...new Set(externalCalls)]; // Remove duplicates
    }
    
    async simulateBrowserBehavior() {
        console.log('\n🔍 Simulating Browser Behavior...');
        
        // Test what happens when a browser tries to load external resources
        for (const domain of this.externalDomains) {
            try {
                console.log(`🧪 Simulating browser load of ${domain}...`);
                
                // Simulate browser request with headers
                const result = await this.simulateBrowserRequest(domain);
                
                if (result.success) {
                    console.log(`✅ ${domain}: Browser simulation successful`);
                    this.findings.push(`${domain}: Browser can load successfully`);
                } else {
                    console.log(`❌ ${domain}: Browser simulation failed - ${result.error}`);
                    
                    if (result.error.includes('ENOTFOUND')) {
                        this.issues.push(`${domain}: DNS lookup failed - causes Cloudflare Error 1000`);
                    } else if (result.error.includes('ECONNREFUSED')) {
                        this.issues.push(`${domain}: Connection refused - may cause Error 1000`);
                    } else if (result.error.includes('timeout')) {
                        this.issues.push(`${domain}: Request timeout - may cause Error 1000`);
                    }
                }
                
            } catch (error) {
                console.log(`💥 ${domain}: Browser simulation error - ${error.message}`);
                this.issues.push(`${domain}: Browser simulation failed - ${error.message}`);
            }
        }
    }
    
    async simulateBrowserRequest(url) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            };
            
            const request = https.get(url, options, (response) => {
                const responseTime = Date.now() - startTime;
                
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    resolve({
                        success: true,
                        statusCode: response.statusCode,
                        responseTime
                    });
                } else {
                    resolve({
                        success: false,
                        error: `HTTP ${response.statusCode}`,
                        responseTime
                    });
                }
            });
            
            request.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - startTime
                });
            });
            
            request.on('timeout', () => {
                request.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout',
                    responseTime: 10000
                });
            });
        });
    }
    
    async testDNSResolution() {
        console.log('\n🔍 Testing DNS Resolution...');
        
        const { exec } = require('child_process');
        
        for (const domain of this.externalDomains) {
            try {
                const hostname = new URL(domain).hostname;
                
                await new Promise((resolve, reject) => {
                    exec(`nslookup ${hostname}`, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`❌ ${hostname}: DNS resolution failed`);
                            this.issues.push(`${hostname}: DNS resolution failed - causes Error 1000`);
                            reject(error);
                        } else {
                            console.log(`✅ ${hostname}: DNS resolution successful`);
                            this.findings.push(`${hostname}: DNS resolution works`);
                            resolve(stdout);
                        }
                    });
                });
                
            } catch (error) {
                console.log(`💥 DNS test for ${domain} failed: ${error.message}`);
            }
        }
    }
    
    async makeHTTPRequest(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => resolve(data));
            });
            
            request.on('error', reject);
            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    generateDiagnosticReport() {
        console.log('\n🌩️ CLOUDFLARE ERROR 1000 DIAGNOSTIC REPORT');
        console.log('=' .repeat(60));
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`Issues found: ${this.issues.length}`);
        console.log(`Positive findings: ${this.findings.length}`);
        
        if (this.issues.length > 0) {
            console.log(`\n❌ ISSUES THAT CAUSE CLOUDFLARE ERROR 1000:`);
            this.issues.forEach(issue => {
                console.log(`   - ${issue}`);
            });
            
            console.log(`\n🔧 ROOT CAUSE:`);
            if (this.issues.some(issue => issue.includes('DNS'))) {
                console.log(`   DNS resolution failures for external domains`);
            }
            if (this.issues.some(issue => issue.includes('external call'))) {
                console.log(`   Localhost sites making calls to unreachable external domains`);
            }
            if (this.issues.some(issue => issue.includes('ECONNREFUSED'))) {
                console.log(`   Connection refused - servers not running`);
            }
            
        } else {
            console.log(`\n✅ NO CLOUDFLARE ERROR 1000 ISSUES DETECTED`);
        }
        
        if (this.findings.length > 0) {
            console.log(`\n✅ POSITIVE FINDINGS:`);
            this.findings.forEach(finding => {
                console.log(`   - ${finding}`);
            });
        }
        
        console.log(`\n🎯 CONCLUSION:`);
        if (this.issues.length === 0) {
            console.log(`   No Cloudflare Error 1000 conditions detected`);
            console.log(`   If you're still seeing errors, they may be browser-specific`);
        } else {
            console.log(`   Cloudflare Error 1000 conditions detected`);
            console.log(`   External domains are unreachable from localhost`);
            console.log(`   This is expected behavior - external domains need proper hosting`);
        }
    }
}

// Run the diagnostic
if (require.main === module) {
    const diagnostic = new CloudflareErrorDiagnostic();
    
    diagnostic.diagnoseCloudflareErrors().catch(error => {
        console.error('💥 Diagnostic failed:', error);
        process.exit(1);
    });
}

module.exports = CloudflareErrorDiagnostic;
