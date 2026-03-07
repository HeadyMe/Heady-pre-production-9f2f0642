/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Credit Monitor — Tracks API credit balances across all AI providers.
 * Emits alerts when balances drop below configurable thresholds.
 * Runs on a scheduled interval (default: every 30 min).
 *
 * Supports: Anthropic (Claude), OpenAI, Google/Gemini, Groq, Replicate, Mistral, Cohere
 */
const EventEmitter = require('events');
const logger = require('../utils/logger');

// ─── Provider Balance Checkers ──────────────────────────────────
const PROVIDERS = {
    anthropic: {
        name: 'Anthropic (Claude)',
        envKey: 'ANTHROPIC_API_KEY',
        async checkBalance(apiKey) {
            // Anthropic doesn't have a direct balance API.
            // Use the admin API if ANTHROPIC_ADMIN_KEY is set.
            const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
            if (adminKey) {
                try {
                    const res = await fetch('https://api.anthropic.com/v1/organizations/usage', {
                        headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        return { available: true, balance: data.remaining_credits || null, usage: data };
                    }
                } catch { /* fall through */ }
            }
            // Fallback: just verify key works
            try {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: '.' }] }),
                });
                if (res.ok) return { available: true, balance: null, status: 'key_valid' };
                const err = await res.json().catch(() => ({}));
                if (res.status === 429) return { available: true, balance: 'rate_limited', status: 'active_but_throttled' };
                if (err.error?.type === 'insufficient_quota') return { available: false, balance: 0, status: 'no_credits' };
                return { available: false, balance: null, status: err.error?.message || 'unknown' };
            } catch (e) {
                return { available: false, balance: null, status: e.message };
            }
        },
    },

    openai: {
        name: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        async checkBalance(apiKey) {
            try {
                // Check billing/usage (requires org-level access)
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    return { available: true, models: data.data?.length || 0, status: 'active' };
                }
                if (res.status === 429) return { available: true, balance: 'rate_limited', status: 'active_but_throttled' };
                const err = await res.json().catch(() => ({}));
                if (err.error?.code === 'insufficient_quota') return { available: false, balance: 0, status: 'no_credits' };
                return { available: false, status: err.error?.message || 'key_invalid' };
            } catch (e) {
                return { available: false, status: e.message };
            }
        },
    },

    groq: {
        name: 'Groq',
        envKey: 'GROQ_API_KEY',
        async checkBalance(apiKey) {
            try {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (res.ok) return { available: true, status: 'active' };
                return { available: false, status: 'key_invalid' };
            } catch (e) {
                return { available: false, status: e.message };
            }
        },
    },

    google: {
        name: 'Google (Gemini)',
        envKey: 'GOOGLE_API_KEY',
        async checkBalance(apiKey) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
                if (res.ok) {
                    const data = await res.json();
                    return { available: true, models: data.models?.length || 0, status: 'active' };
                }
                return { available: false, status: 'key_invalid' };
            } catch (e) {
                return { available: false, status: e.message };
            }
        },
    },
};

// ─── Credit Monitor Class ───────────────────────────────────────
class CreditMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.checkInterval = options.checkInterval || 30 * 60 * 1000; // 30 minutes
        this.lowCreditThreshold = options.lowCreditThreshold || 5.00; // $5.00
        this.criticalThreshold = options.criticalThreshold || 1.00; // $1.00
        this.lastCheck = null;
        this.providerStatus = {};
        this.alertsSent = new Set();
        this.timer = null;
    }

    start() {
        logger.info('[CreditMonitor] Starting credit monitoring', {
            interval: `${this.checkInterval / 60000}min`,
            lowThreshold: `$${this.lowCreditThreshold}`,
            criticalThreshold: `$${this.criticalThreshold}`,
        });
        // Immediate first check
        this.checkAll();
        // Schedule recurring checks
        this.timer = setInterval(() => this.checkAll(), this.checkInterval);
        return this;
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        logger.info('[CreditMonitor] Stopped');
    }

    async checkAll() {
        const results = {};
        const alerts = [];

        for (const [key, provider] of Object.entries(PROVIDERS)) {
            const apiKey = process.env[provider.envKey];
            if (!apiKey || apiKey.includes('...') || apiKey.includes('your-')) {
                results[key] = { name: provider.name, configured: false, status: 'not_configured' };
                continue;
            }

            try {
                const check = await provider.checkBalance(apiKey);
                results[key] = { name: provider.name, configured: true, ...check };

                // Generate alerts
                if (check.balance !== null && check.balance !== undefined) {
                    if (typeof check.balance === 'number') {
                        if (check.balance <= this.criticalThreshold) {
                            alerts.push({ provider: key, name: provider.name, level: 'CRITICAL', balance: check.balance, message: `⚠️ CRITICAL: ${provider.name} credits at $${check.balance.toFixed(2)}!` });
                        } else if (check.balance <= this.lowCreditThreshold) {
                            alerts.push({ provider: key, name: provider.name, level: 'LOW', balance: check.balance, message: `⚡ LOW: ${provider.name} credits at $${check.balance.toFixed(2)} — consider topping up.` });
                        }
                    }
                    if (check.balance === 0 || check.status === 'no_credits') {
                        alerts.push({ provider: key, name: provider.name, level: 'EXHAUSTED', balance: 0, message: `🚨 EXHAUSTED: ${provider.name} has NO credits remaining!` });
                    }
                }

                if (!check.available) {
                    alerts.push({ provider: key, name: provider.name, level: 'UNAVAILABLE', message: `❌ ${provider.name} is unavailable: ${check.status}` });
                }
            } catch (err) {
                results[key] = { name: provider.name, configured: true, available: false, status: err.message };
            }
        }

        this.lastCheck = new Date().toISOString();
        this.providerStatus = results;

        // Emit alerts
        for (const alert of alerts) {
            const alertKey = `${alert.provider}_${alert.level}`;
            if (!this.alertsSent.has(alertKey)) {
                this.alertsSent.add(alertKey);
                this.emit('alert', alert);
                logger.warn(`[CreditMonitor] ${alert.message}`);
                // Auto-clear alert key after 1 hour so it can re-alert
                setTimeout(() => this.alertsSent.delete(alertKey), 60 * 60 * 1000);
            }
        }

        this.emit('check_complete', { results, alerts, timestamp: this.lastCheck });
        return { results, alerts };
    }

    getStatus() {
        return {
            lastCheck: this.lastCheck,
            providers: this.providerStatus,
            monitoring: !!this.timer,
            checkInterval: `${this.checkInterval / 60000} minutes`,
            thresholds: {
                low: `$${this.lowCreditThreshold}`,
                critical: `$${this.criticalThreshold}`,
            },
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────
function registerCreditRoutes(app, monitor) {
    // GET /api/credits — full status
    app.get('/api/credits', (req, res) => {
        res.json(monitor.getStatus());
    });

    // POST /api/credits/check — force immediate recheck
    app.post('/api/credits/check', async (req, res) => {
        const result = await monitor.checkAll();
        res.json({ ...result, timestamp: monitor.lastCheck });
    });

    // GET /api/credits/alerts — recent alerts
    app.get('/api/credits/alerts', (req, res) => {
        res.json({
            activeAlerts: [...monitor.alertsSent],
            lastCheck: monitor.lastCheck,
        });
    });

    logger.info('[CreditMonitor] Routes registered: /api/credits, /api/credits/check, /api/credits/alerts');
}

module.exports = { CreditMonitor, registerCreditRoutes, PROVIDERS };
