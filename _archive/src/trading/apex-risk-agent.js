/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Apex 3.0 Risk Agent — Hardcoded risk parameters for HeadyBuddy
 * autonomous trading on Apex Trader Funding platform.
 *
 * These rules are IMMUTABLE in production. Any modification requires
 * explicit owner approval through CodeGovernance gate.
 */

const EventEmitter = require('events');

// ═══ APEX 3.0 RISK PARAMETERS — IMMUTABLE ═══════════════════════════════════
const APEX_RULES = Object.freeze({
    // Account tiers
    accounts: {
        '25K': { balance: 25000, trailingDrawdown: 1500, initialMAE: 450, safetyNetBuffer: 100 },
        '50K': { balance: 50000, trailingDrawdown: 2500, initialMAE: 750, safetyNetBuffer: 100 },
        '75K': { balance: 75000, trailingDrawdown: 2750, initialMAE: 825, safetyNetBuffer: 100 },
        '100K': { balance: 100000, trailingDrawdown: 3000, initialMAE: 900, safetyNetBuffer: 100 },
        '150K': { balance: 150000, trailingDrawdown: 5000, initialMAE: 1500, safetyNetBuffer: 100 },
        '250K': { balance: 250000, trailingDrawdown: 6500, initialMAE: 1950, safetyNetBuffer: 100 },
        '300K': { balance: 300000, trailingDrawdown: 7500, initialMAE: 2250, safetyNetBuffer: 100 },
    },

    // Universal rules
    consistencyRule: 0.30,           // No single day > 30% of total profit
    maeRule: 0.30,                   // Max open negative P&L = 30% of day profit/trailing
    minTradingDaysBetweenPayouts: 8,
    minProfitableDays: 5,            // $100+ profit per profitable day
    minProfitPerDay: 100,            // Minimum to count as "profitable day"
    safetyNetPayouts: 3,             // First 3 payouts require safety net

    // Execution constraints
    maxPositionHoldOvernight: false,  // Flatten before session close
    tradingHoursUTC: { start: '23:00', end: '22:00' }, // CME Globex
    newsBlackoutMinutes: 5,          // No entries within 5m of major news
});

// ═══ TERNARY SIGNAL STATES ══════════════════════════════════════════════════
const SIGNAL = Object.freeze({
    REPEL: -1,  // Non-viable, skip
    HOLD: 0,  // Epistemic hold — gather more data
    ENGAGE: +1,  // Validated, execute
});

class ApexRiskAgent extends EventEmitter {
    constructor(accountTier = '50K') {
        super();
        this.tier = accountTier;
        this.rules = APEX_RULES.accounts[accountTier];
        if (!this.rules) throw new Error(`Unknown Apex account tier: ${accountTier}`);

        // Runtime state
        this.sessionState = {
            startOfDayBalance: this.rules.balance,
            highestEquity: this.rules.balance,
            currentEquity: this.rules.balance,
            openPnL: 0,
            dailyPnL: 0,
            tradingDays: 0,
            profitableDays: 0,
            totalProfit: 0,
            dailyProfits: [],
            signals: [],
            violations: [],
            lastCheckTs: null,
        };

        this.started = false;
        this.checkInterval = null;
    }

    // ─── CORE RISK CHECKS ───────────────────────────────────────────────
    /**
     * Check if current state violates any Apex 3.0 rules.
     * Returns { safe: boolean, violations: string[], signal: -1|0|+1 }
     */
    checkRisk(equity, openPnL) {
        const violations = [];
        const state = this.sessionState;

        state.currentEquity = equity;
        state.openPnL = openPnL;
        state.lastCheckTs = new Date().toISOString();

        // Update highest equity watermark
        if (equity > state.highestEquity) {
            state.highestEquity = equity;
        }

        // 1. Trailing Drawdown Check
        const drawdownFloor = state.highestEquity - this.rules.trailingDrawdown;
        if (equity <= drawdownFloor) {
            violations.push(`TRAILING_DRAWDOWN: Equity $${equity.toFixed(2)} <= floor $${drawdownFloor.toFixed(2)}`);
        }

        // 2. MAE Check (30% negative P&L rule)
        const maeLimit = Math.max(this.rules.initialMAE, state.dailyPnL * APEX_RULES.maeRule);
        if (openPnL < 0 && Math.abs(openPnL) > maeLimit) {
            violations.push(`MAE_EXCEEDED: Open P&L $${openPnL.toFixed(2)} exceeds limit $${(-maeLimit).toFixed(2)}`);
        }

        // 3. Consistency Rule Check
        if (state.totalProfit > 0 && state.dailyPnL > 0) {
            const consistencyMax = state.totalProfit * APEX_RULES.consistencyRule;
            if (state.dailyPnL > consistencyMax) {
                violations.push(`CONSISTENCY: Daily P&L $${state.dailyPnL.toFixed(2)} > 30% of total $${consistencyMax.toFixed(2)}`);
            }
        }

        // Determine ternary signal
        let signal;
        if (violations.length > 0) {
            signal = SIGNAL.REPEL;
            this.emit('risk:violation', { violations, equity, openPnL, ts: state.lastCheckTs });
        } else if (Math.abs(openPnL) > maeLimit * 0.8) {
            signal = SIGNAL.HOLD; // Getting close to limits — epistemic hold
            this.emit('risk:caution', { reason: 'Approaching MAE limit', equity, openPnL });
        } else {
            signal = SIGNAL.ENGAGE;
        }

        // Record signal
        state.signals.push({ signal, equity, openPnL, ts: state.lastCheckTs });
        if (state.signals.length > 1000) state.signals = state.signals.slice(-500);

        // Record violations
        if (violations.length > 0) {
            state.violations.push(...violations.map(v => ({ violation: v, ts: state.lastCheckTs })));
            if (state.violations.length > 500) state.violations = state.violations.slice(-250);
        }

        return { safe: violations.length === 0, violations, signal };
    }

    // ─── SAFETY NET ─────────────────────────────────────────────────────
    /**
     * Calculate safety net for payout requests.
     * $Safety_Net = Starting_Balance + Trailing_Threshold + 100
     */
    getSafetyNet() {
        return this.rules.balance + this.rules.trailingDrawdown + this.rules.safetyNetBuffer;
    }

    canRequestPayout(requestAmount) {
        const safetyNet = this.getSafetyNet();
        const balanceAfter = this.sessionState.currentEquity - requestAmount;
        const meetsMinDays = this.sessionState.tradingDays >= APEX_RULES.minTradingDaysBetweenPayouts;
        const meetsProfitDays = this.sessionState.profitableDays >= APEX_RULES.minProfitableDays;
        const aboveSafetyNet = balanceAfter >= safetyNet;

        return {
            allowed: meetsMinDays && meetsProfitDays && aboveSafetyNet,
            safetyNet,
            balanceAfter,
            tradingDays: this.sessionState.tradingDays,
            profitableDays: this.sessionState.profitableDays,
            reasons: [
                !meetsMinDays ? `Need ${APEX_RULES.minTradingDaysBetweenPayouts} trading days, have ${this.sessionState.tradingDays}` : null,
                !meetsProfitDays ? `Need ${APEX_RULES.minProfitableDays} profitable days, have ${this.sessionState.profitableDays}` : null,
                !aboveSafetyNet ? `Balance after ($${balanceAfter.toFixed(2)}) below safety net ($${safetyNet.toFixed(2)})` : null,
            ].filter(Boolean),
        };
    }

    // ─── SESSION MANAGEMENT ─────────────────────────────────────────────
    startSession(balance) {
        this.sessionState.startOfDayBalance = balance || this.rules.balance;
        this.sessionState.currentEquity = balance || this.rules.balance;
        this.sessionState.highestEquity = balance || this.rules.balance;
        this.sessionState.dailyPnL = 0;
        this.sessionState.openPnL = 0;
        this.started = true;
        this.emit('session:started', { tier: this.tier, balance: this.sessionState.startOfDayBalance });
    }

    endSession() {
        const dailyPnL = this.sessionState.currentEquity - this.sessionState.startOfDayBalance;
        this.sessionState.tradingDays++;
        this.sessionState.dailyProfits.push(dailyPnL);
        if (dailyPnL >= APEX_RULES.minProfitPerDay) {
            this.sessionState.profitableDays++;
        }
        this.sessionState.totalProfit += Math.max(0, dailyPnL);
        this.started = false;
        this.emit('session:ended', {
            tier: this.tier, dailyPnL, totalProfit: this.sessionState.totalProfit,
            tradingDays: this.sessionState.tradingDays, profitableDays: this.sessionState.profitableDays,
        });
    }

    // ─── STATUS ─────────────────────────────────────────────────────────
    getStatus() {
        const safetyNet = this.getSafetyNet();
        return {
            node: 'apex-risk-agent',
            tier: this.tier,
            rules: this.rules,
            universalRules: {
                consistencyRule: `${APEX_RULES.consistencyRule * 100}%`,
                maeRule: `${APEX_RULES.maeRule * 100}%`,
                minTradingDays: APEX_RULES.minTradingDaysBetweenPayouts,
                minProfitableDays: APEX_RULES.minProfitableDays,
            },
            session: {
                active: this.started,
                currentEquity: this.sessionState.currentEquity,
                highestEquity: this.sessionState.highestEquity,
                openPnL: this.sessionState.openPnL,
                dailyPnL: this.sessionState.dailyPnL,
                totalProfit: this.sessionState.totalProfit,
                tradingDays: this.sessionState.tradingDays,
                profitableDays: this.sessionState.profitableDays,
            },
            safetyNet,
            drawdownFloor: this.sessionState.highestEquity - this.rules.trailingDrawdown,
            recentSignals: this.sessionState.signals.slice(-10),
            recentViolations: this.sessionState.violations.slice(-10),
            ts: new Date().toISOString(),
        };
    }
}

// ─── ROUTE REGISTRATION ─────────────────────────────────────────────────────
function registerApexRoutes(app, agent) {
    const express = require('express');
    const router = express.Router();

    router.get('/status', (req, res) => {
        res.json({ ok: true, ...agent.getStatus() });
    });

    router.get('/rules', (req, res) => {
        res.json({ ok: true, rules: APEX_RULES, ts: new Date().toISOString() });
    });

    router.post('/check', (req, res) => {
        const { equity, openPnL } = req.body;
        if (equity === undefined || openPnL === undefined) {
            return res.status(400).json({ ok: false, error: 'equity and openPnL required' });
        }
        const result = agent.checkRisk(equity, openPnL);
        res.json({ ok: true, ...result, ts: new Date().toISOString() });
    });

    router.post('/payout-check', (req, res) => {
        const { amount } = req.body;
        if (!amount) return res.status(400).json({ ok: false, error: 'amount required' });
        const result = agent.canRequestPayout(amount);
        res.json({ ok: true, ...result, ts: new Date().toISOString() });
    });

    router.post('/session/start', (req, res) => {
        agent.startSession(req.body.balance);
        res.json({ ok: true, message: 'Session started', ...agent.getStatus() });
    });

    router.post('/session/end', (req, res) => {
        agent.endSession();
        res.json({ ok: true, message: 'Session ended', ...agent.getStatus() });
    });

    app.use('/api/apex', router);
}

module.exports = { ApexRiskAgent, registerApexRoutes, APEX_RULES, SIGNAL };
