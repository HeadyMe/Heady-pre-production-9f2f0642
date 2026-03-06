/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * SDK Quickstart Module — Platform Phase 2 Assessment Item
 *
 * One-command SDK initialization for developers.
 * Consumes developer-platform-blueprint.yaml for dynamic bootstrap.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BLUEPRINT_PATH = path.resolve(__dirname, '..', 'configs', 'resources', 'developer-platform-blueprint.yaml');
const ONBOARDING_PATH = path.resolve(__dirname, '..', 'configs', 'resources', 'developer-platform-onboarding.yaml');

class HeadySDK {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.HEADY_API_KEY || null;
        this.baseUrl = options.baseUrl || 'https://manager.headysystems.com';
        this.edgeUrl = options.edgeUrl || 'https://heady.headyme.com';
        this.initialized = false;
        this.sessionId = crypto.randomUUID();
        this.blueprint = null;
    }

    /**
     * Initialize the SDK — reads blueprint config and validates auth.
     * This is the single canonical SDK initialization path.
     */
    async init() {
        // Load blueprint config
        if (fs.existsSync(BLUEPRINT_PATH)) {
            this.blueprint = fs.readFileSync(BLUEPRINT_PATH, 'utf8');
        }

        // Validate API key
        if (!this.apiKey) {
            return {
                success: false,
                error: 'HEADY_API_KEY not set. Get your key at https://headyme.com/developer',
                stage: 'auth',
                remediation: 'export HEADY_API_KEY=hdy_...',
            };
        }

        // Health check
        try {
            const res = await fetch(`${this.baseUrl}/health`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            }).catch(() => null);

            this.initialized = true;

            return {
                success: true,
                sessionId: this.sessionId,
                manager: res?.ok ? 'connected' : 'offline',
                stage: 'ready',
                endpoints: {
                    projection: `${this.baseUrl}/api/unified-autonomy/system-projection`,
                    blueprint: `${this.baseUrl}/api/unified-autonomy/platform-blueprint`,
                    health: `${this.baseUrl}/health`,
                    edge: `${this.edgeUrl}/health`,
                },
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                stage: 'connection',
                remediation: `Check network connectivity to ${this.baseUrl}`,
            };
        }
    }

    /**
     * Get current system projection state.
     */
    async getProjection() {
        if (!this.initialized) throw new Error('SDK not initialized. Call sdk.init() first.');
        try {
            const res = await fetch(`${this.baseUrl}/api/unified-autonomy/system-projection`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });
            return await res.json();
        } catch (err) {
            return { error: err.message, stage: 'projection', remediation: 'Manager may be offline' };
        }
    }

    /**
     * Trigger CloudBurst sync to edge.
     */
    async syncToEdge(data = {}) {
        if (!this.initialized) throw new Error('SDK not initialized. Call sdk.init() first.');
        try {
            const res = await fetch(`${this.edgeUrl}/api/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: this.sessionId, ...data }),
            });
            return await res.json();
        } catch (err) {
            return { error: err.message, stage: 'edge_sync', remediation: 'Edge may be offline' };
        }
    }

    /**
     * Get SDK health status.
     */
    getHealth() {
        return {
            initialized: this.initialized,
            sessionId: this.sessionId,
            apiKey: this.apiKey ? `${this.apiKey.slice(0, 8)}...` : null,
            baseUrl: this.baseUrl,
            edgeUrl: this.edgeUrl,
            hasBlueprintConfig: !!this.blueprint,
        };
    }
}

/**
 * CLI quickstart entry point.
 * Usage: npx heady-sdk init
 */
async function cliQuickstart() {
    console.log('🐝 Heady SDK Quickstart');
    console.log('═'.repeat(50));

    const sdk = new HeadySDK();
    const result = await sdk.init();

    if (result.success) {
        console.log('✅ SDK initialized successfully');
        console.log(`   Session: ${result.sessionId}`);
        console.log(`   Manager: ${result.manager}`);
        console.log('');
        console.log('   Endpoints:');
        for (const [name, url] of Object.entries(result.endpoints)) {
            console.log(`     ${name}: ${url}`);
        }
    } else {
        console.error(`❌ Initialization failed at stage: ${result.stage}`);
        console.error(`   Error: ${result.error}`);
        console.error(`   Fix: ${result.remediation}`);
    }

    return result;
}

module.exports = { HeadySDK, cliQuickstart };

// Run CLI if executed directly
if (require.main === module) {
    cliQuickstart();
}
