const { AutoSuccessEngine } = require('../src/hc_auto_success');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'production-go-live.log');
const NOW = new Date().toISOString();

// ═══════════════════════════════════════════════════════════════
// HEADY FULL-THROTTLE AUTO-FLOW SUCCESS MODE PIPELINE
// ═══════════════════════════════════════════════════════════════
// After production go-live, this pipeline runs CONTINUOUSLY.
// It processes optimizations, fidelity improvements, and
// system health checks in perpetual cycles.
// ═══════════════════════════════════════════════════════════════

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 HEADY FULL-THROTTLE AUTO-FLOW SUCCESS MODE              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  Mode: CONTINUOUS (no exit)                                  ║
║  Started: ${NOW}                                             ║
║  Pipeline: HCFP Auto-Success Engine                          ║
║  Batch Size: 50 | Interval: 100ms                            ║
╚══════════════════════════════════════════════════════════════╝
`);

// Log production go-live timestamp
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const goLiveEntry = [
    `═══════════════════════════════════════════════════`,
    `PRODUCTION GO-LIVE: ${NOW}`,
    `Initiated by: HeadyMe (e@headyconnection.org)`,
    `Mode: Full-Throttle Auto-Flow Success`,
    `Status: ALL SYSTEMS LIVE`,
    `═══════════════════════════════════════════════════`,
    ''
].join('\n');

fs.appendFileSync(LOG_FILE, goLiveEntry);
console.log(`📋 Production go-live logged to: ${LOG_FILE}`);

// Start the continuous auto-flow engine
const engine = new AutoSuccessEngine({
    interval: 100,    // 100ms hyper-speed cycles
    batchSize: 50     // Process 50 improvements per batch
});

engine.start();
console.log('🐝 HeadySwarm ready — HeadyBees standing by for task dispatch.');
console.log('♾️  Pipeline running continuously. Press Ctrl+C to stop.\n');

// Keep alive — no timeout, no exit
// The engine runs in perpetual cycles
process.on('SIGINT', () => {
    console.log('\n🛑 Pipeline stopped by operator.');
    engine.stop();
    fs.appendFileSync(LOG_FILE, `PIPELINE STOPPED: ${new Date().toISOString()}\n`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Pipeline terminated.');
    engine.stop();
    fs.appendFileSync(LOG_FILE, `PIPELINE TERMINATED: ${new Date().toISOString()}\n`);
    process.exit(0);
});
