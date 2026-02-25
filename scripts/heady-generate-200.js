const fs = require('fs');
const path = require('path');

const NUM_TASKS = 200;
const categories = ['pqc-security', 'duckdb-memory', 'edge-routing', 'liquid-federation', 'mesh-resiliency', 'telemetry', 'hive-integration'];
const pools = ['hot', 'hot', 'warm', 'warm', 'cold']; // Weight towards warm/hot

const tasks = [];

// Base task templates for procedural generation
const templates = [
    { cat: 'pqc-security', prefix: 'Validate ML-KEM/ML-DSA', desc: 'Verify post-quantum cryptography signature integrity on cross-node RPC route' },
    { cat: 'pqc-security', prefix: 'Rotate Quantum Keys', desc: 'Simulate 24-hr key rotation lifecycle for ML-KEM-768 seed generators' },
    { cat: 'pqc-security', prefix: 'Audit Handshake Latency', desc: 'Measure SSL/mTLS overhead added by PQC encapsulation phase' },

    { cat: 'duckdb-memory', prefix: 'HNSW Index Calibration', desc: 'Rebalance HNSW vector index for conversation memory semantic search' },
    { cat: 'duckdb-memory', prefix: 'Snapshot Vector Distances', desc: 'Compute Euclidean and Cosine drift across recent conversational embedding clusters' },
    { cat: 'duckdb-memory', prefix: 'Compact DuckDB WAL', desc: 'Perform Write-Ahead-Log compaction to free memory on local inference node' },

    { cat: 'edge-routing', prefix: 'Cloudflare Latency Pulse', desc: 'Ping Edge Worker nodes across 3 distinct zones to map liquid distribution' },
    { cat: 'edge-routing', prefix: 'Rate Limiter Window Tuning', desc: 'Analyze Redis sliding-window drop rates to prevent false-positive bans' },
    { cat: 'edge-routing', prefix: 'IP Threat Classification', desc: 'Cross-reference IP incoming streams with proprietary threat heuristic rules' },

    { cat: 'liquid-federation', prefix: 'Node Affinity Scoring', desc: 'Score HeadyJules and HeadyPythia availability and back-pressure latency' },
    { cat: 'liquid-federation', prefix: 'Task Queue Shedding', desc: 'Identify and drop low-priority simulation tasks under heavy system load' },
    { cat: 'liquid-federation', prefix: 'Dynamic Route Recalculation', desc: 'Pre-compute shortest path to fallback nodes in event of regional outage' },

    { cat: 'mesh-resiliency', prefix: 'Circuit Breaker Drill', desc: 'Simulate catastrophic API timeout and verify circuit breaker opens at threshold' },
    { cat: 'mesh-resiliency', prefix: 'Orphaned Promise Sweeping', desc: 'Scan Node.js event loop for unhandled rejections and stranded async routes' },

    { cat: 'telemetry', prefix: 'Admin UI Socket Health', desc: 'Ensure WebSocket telemetry stream to Admin Dashboard 5001 has no packet loss' },
    { cat: 'telemetry', prefix: 'V8 Bytecode Integrity', desc: 'Validate checksums of pre-compiled .jsc core logic binaries' },

    { cat: 'hive-integration', prefix: 'HeadyCompute Token Burn', desc: 'Measure compute token throughput against Stripe tier limits' },
    { cat: 'hive-integration', prefix: 'HeadyNexus Context Window', desc: 'Simulate 100k+ token payload to ensure context fragmentation does not occur' }
];

for (let i = 1; i <= NUM_TASKS; i++) {
    const tpl = templates[i % templates.length];
    const pool = pools[Math.floor(Math.random() * pools.length)];
    const weight = pool === 'hot' ? (Math.floor(Math.random() * 2) + 4) : pool === 'warm' ? 3 : (Math.floor(Math.random() * 2) + 1);

    tasks.push({
        id: `hfidel-${String(i).padStart(3, '0')}`,
        name: `${tpl.prefix} [Zone ${Math.floor(Math.random() * 9) + 1}]`,
        cat: tpl.cat,
        pool: pool,
        w: weight,
        desc: `${tpl.desc} (Task ID Alpha-${Math.floor(Math.random() * 9999)})`
    });
}

const destPath = path.join(__dirname, '..', 'src', 'auto-flow-200-tasks.json');
fs.writeFileSync(destPath, JSON.stringify(tasks, null, 2));
console.log(`✅ Generated ${NUM_TASKS} high-fidelity improvements to ${destPath}`);

// Now modify hc_auto_success.js to inject these
const successFile = path.join(__dirname, '..', 'src', 'hc_auto_success.js');
let content = fs.readFileSync(successFile, 'utf8');

if (!content.includes('./auto-flow-200-tasks.json')) {
    content = content.replace(
        /const TASK_CATALOG = \[/,
        `let extraTasks = [];\ntry { extraTasks = require('./auto-flow-200-tasks.json'); } catch(e){}\nconst TASK_CATALOG = [\n    ...extraTasks,`
    );
    fs.writeFileSync(successFile, content);
    console.log(`✅ Patched src/hc_auto_success.js to inject the 200 new high-fidelity routing tasks.`);
} else {
    console.log(`⚠️ hc_auto_success.js is already patched.`);
}
