#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * HeadyServices MAX BLASTER
 * Executes 100 heavy tasks concurrently across all 5 Heady Models to 100% max out the system.
 */

const http = require('http');

const models = [
    'heady-battle-v1',
    'heady-flash',
    'heady-reason',
    'heady-buddy',
    'heady-edge'
];

const taskTemplates = [
    "Analyze the optimal architecture for a quantum-resistant federated routing mesh.",
    "Refactor a 10,000 line monolithic React application into micro-frontends.",
    "Generate a complete Python script to perform Monte Carlo simulation on options pricing.",
    "Write a semantic search engine using DuckDB and vector embeddings from scratch.",
    "Explain the theoretical limits of Transformer context windows and chunking strategies.",
    "Design an Arena Mode orchestration system where 20 AI nodes compete.",
    "Write a detailed security audit checklist for a Node.js API handling PII.",
    "Create a comprehensive markdown guide for mastering vim.",
    "Write a fully functional Tetris game in a single HTML file using vanilla JS.",
    "Review the implications of cross-origin isolation on SharedArrayBuffer."
];

// Generate 100 tasks
const tasks = Array.from({ length: 100 }, (_, i) => ({
    id: `TASK-${(i + 1).toString().padStart(3, '0')}`,
    model: models[i % models.length],
    prompt: taskTemplates[i % taskTemplates.length] + ` (Variation ${i})`
}));

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║ 🚀 HEADY SERVICES — 100% MAX LOAD INITIATION SEQUENCE ║');
console.log('╚════════════════════════════════════════════════════════╝\n');
console.log(`Target: http://localhost:3301/api/v1/chat/completions`);
console.log(`Models: ${models.join(', ')}`);
console.log(`Payload: ${tasks.length} concurrent deep-reasoning tasks.\n`);

let completed = 0;
let errors = 0;
const start = Date.now();

function blastTask(task) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            model: task.model,
            messages: [{ role: 'user', content: task.prompt }]
        });

        const req = http.request({
            hostname: 'localhost',
            port: 3301,
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': 'Bearer sk-heady-pro-max'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                completed++;
                const status = res.statusCode === 200 ? '✅' : '❌';
                if (res.statusCode !== 200) errors++;
                process.stdout.write(`${status} [${task.id}] ${task.model.padEnd(16)} | Status: ${res.statusCode}\n`);
                resolve();
            });
        });

        req.on('error', (err) => {
            errors++;
            completed++;
            process.stdout.write(`❌ [${task.id}] ${task.model.padEnd(16)} | Error: ${err.message}\n`);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

async function executeMaxLoad() {
    console.log('🔥 IGNITING ALL NODES...\n');

    // Blast all 100 requests concurrently
    await Promise.all(tasks.map(task => blastTask(task)));

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log('\n======================================================');
    console.log(`🏁 BLAST COMPLETE in ${duration}s`);
    console.log(`📊 SUCCESS: ${completed - errors} / ${tasks.length}`);
    console.log(`⚠️  ERRORS:  ${errors}`);
    console.log('======================================================\n');
}

executeMaxLoad();
