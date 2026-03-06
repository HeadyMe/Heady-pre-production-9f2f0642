/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyBuddy Trading Tasks — Auto-Success task definitions
 * for the Apex 3.0 autonomous trading system.
 *
 * These tasks are auto-assigned, auto-completing, and produce
 * comprehensive audit trail entries for every cycle.
 */

module.exports = [
    // ═══ APEX RISK MONITORING (15) ═══════════════════════════════════════════
    {
        id: "apx-001", name: "Verify trailing drawdown calculation",
        cat: "trading", pool: "hot", w: 5,
        desc: "Confirm trailing drawdown tracks highest intraday equity correctly"
    },
    {
        id: "apx-002", name: "Validate MAE 30% rule enforcement",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure max adverse excursion never exceeds 30% of day profit balance"
    },
    {
        id: "apx-003", name: "Check consistency rule compliance",
        cat: "trading", pool: "hot", w: 5,
        desc: "Verify no single day exceeds 30% of total profit"
    },
    {
        id: "apx-004", name: "Calculate safety net threshold",
        cat: "trading", pool: "warm", w: 4,
        desc: "Compute Safety_Net = Starting_Balance + Trailing_Threshold + 100"
    },
    {
        id: "apx-005", name: "Monitor payout eligibility",
        cat: "trading", pool: "warm", w: 3,
        desc: "Track trading days (≥8) and profitable days (≥5 at $100+) for payout"
    },
    {
        id: "apx-006", name: "Validate position flattening before close",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure all positions flatten before CME Globex session close"
    },
    {
        id: "apx-007", name: "Check news blackout enforcement",
        cat: "trading", pool: "warm", w: 4,
        desc: "Verify no entries within 5 minutes of major economic releases"
    },
    {
        id: "apx-008", name: "Monitor account tier parameters",
        cat: "trading", pool: "warm", w: 3,
        desc: "Validate current account tier rules match Apex 3.0 specifications"
    },
    {
        id: "apx-009", name: "Track risk agent signal distribution",
        cat: "trading", pool: "warm", w: 3,
        desc: "Monitor ternary signal balance: REPEL(-1), HOLD(0), ENGAGE(+1)"
    },
    {
        id: "apx-010", name: "Audit violation history",
        cat: "trading", pool: "warm", w: 4,
        desc: "Review and categorize all risk violations for pattern analysis"
    },
    {
        id: "apx-011", name: "Validate daily P&L tracking accuracy",
        cat: "trading", pool: "warm", w: 4,
        desc: "Cross-check daily P&L records against session start/end balances"
    },
    {
        id: "apx-012", name: "Monitor drawdown proximity alerts",
        cat: "trading", pool: "hot", w: 5,
        desc: "Trigger early warning when equity approaches 80% of drawdown threshold"
    },
    {
        id: "apx-013", name: "Verify session state persistence",
        cat: "trading", pool: "cold", w: 2,
        desc: "Ensure trading session state survives service restarts"
    },
    {
        id: "apx-014", name: "Check multi-account isolation",
        cat: "trading", pool: "warm", w: 3,
        desc: "Verify risk parameters are isolated per account instance"
    },
    {
        id: "apx-015", name: "Monitor execution latency budget",
        cat: "trading", pool: "hot", w: 5,
        desc: "Track total execution latency targeting 20ms via PTX hot path"
    },
    // ═══ TERNARY REASONER MODULE (10) ════════════════════════════════════════
    {
        id: "trm-001", name: "Validate ternary state transitions",
        cat: "trading", pool: "warm", w: 4,
        desc: "Verify {-1, 0, +1} transitions follow valid state machine rules"
    },
    {
        id: "trm-002", name: "Monitor epistemic hold duration",
        cat: "trading", pool: "warm", w: 3,
        desc: "Track average hold(0) state duration — optimize for decision speed"
    },
    {
        id: "trm-003", name: "Check sparse computation efficiency",
        cat: "trading", pool: "warm", w: 4,
        desc: "Measure -1 position skip rate for inference speedup validation"
    },
    {
        id: "trm-004", name: "Validate TRM weight integrity",
        cat: "trading", pool: "cold", w: 3,
        desc: "Verify 525KB quantized weight file integrity via SHA-256 hash"
    },
    {
        id: "trm-005", name: "Monitor query throughput",
        cat: "trading", pool: "hot", w: 5,
        desc: "Track queries/second targeting 5,882 QPS benchmark"
    },
    {
        id: "trm-006", name: "Check CLA v0 compression ratio",
        cat: "trading", pool: "warm", w: 3,
        desc: "Validate semantic dehydration achieving ≥70% compression"
    },
    {
        id: "trm-007", name: "Monitor Galaxy 3D RAM commit latency",
        cat: "trading", pool: "hot", w: 5,
        desc: "Ensure alpha signal vector commits complete within 5ms"
    },
    {
        id: "trm-008", name: "Validate k-NN search accuracy",
        cat: "trading", pool: "warm", w: 4,
        desc: "Test semantic similarity search returns relevant vectors under 100µs"
    },
    {
        id: "trm-009", name: "Check swarm signal consensus",
        cat: "trading", pool: "warm", w: 4,
        desc: "Monitor multi-agent validation rate for signal promotion to ENGAGE(+1)"
    },
    {
        id: "trm-010", name: "Audit A2UI widget generation",
        cat: "trading", pool: "cold", w: 2,
        desc: "Verify ephemeral trading UI widgets display ternary states correctly"
    },
];
