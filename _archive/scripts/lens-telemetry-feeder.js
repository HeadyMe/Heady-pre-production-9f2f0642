#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyLens Telemetry Feeder
 * Continuously collects system metrics and pushes to HeadyLens /api/lens/observe
 * Runs as a PM2 process alongside the rest of the ecosystem.
 */

const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const LENS_URL = 'https://localhost:3301/api/lens/observe';
const INTERVAL_MS = 15000; // every 15 seconds

function post(data) {
    return new Promise((resolve) => {
        const body = JSON.stringify(data);
        const req = https.request(LENS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
            timeout: 3000,
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}

async function collectAndPush() {
    const now = new Date().toISOString();

    // ─── System metrics ───
    const loadAvg = os.loadavg();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsedPct = ((1 - freeMem / totalMem) * 100).toFixed(1);
    const cpuCount = os.cpus().length;

    await post({ source: 'system', metric: 'cpu-load-1m', value: loadAvg[0], previous: null, context: `${cpuCount} cores` });
    await post({ source: 'system', metric: 'cpu-load-5m', value: loadAvg[1], previous: null, context: `${cpuCount} cores` });
    await post({ source: 'system', metric: 'memory-used-pct', value: parseFloat(memUsedPct), previous: null, context: `${(totalMem / 1073741824).toFixed(1)}GB total` });
    await post({ source: 'system', metric: 'memory-free-mb', value: Math.round(freeMem / 1048576), previous: null });

    // ─── PM2 process metrics ───
    try {
        const pm2Data = JSON.parse(execSync('pm2 jlist 2>/dev/null', { timeout: 5000 }).toString());
        let totalPm2Mem = 0;
        let onlineCount = 0;
        for (const p of pm2Data) {
            const mem = Math.round(p.monit.memory / 1048576);
            totalPm2Mem += mem;
            if (p.pm2_env.status === 'online') onlineCount++;
            await post({
                source: `pm2:${p.name}`,
                metric: 'state-change',
                value: p.pm2_env.status === 'online' ? 1 : 0,
                previous: null,
                context: `mem:${mem}MB cpu:${p.monit.cpu}% restarts:${p.pm2_env.restart_time}`,
            });
        }
        await post({ source: 'pm2:cluster', metric: 'total-memory-mb', value: totalPm2Mem, previous: null, context: `${onlineCount}/${pm2Data.length} online` });
        await post({ source: 'pm2:cluster', metric: 'online-count', value: onlineCount, previous: pm2Data.length, context: `${onlineCount}/${pm2Data.length}` });
    } catch { /* pm2 not available */ }

    // ─── Cloudflared tunnel status ───
    try {
        const tunnelPid = execSync("pgrep -f 'cloudflared.*run' 2>/dev/null", { timeout: 3000 }).toString().trim();
        await post({ source: 'cloudflared', metric: 'state-change', value: tunnelPid ? 1 : 0, previous: null, context: `pid:${tunnelPid}` });
    } catch {
        await post({ source: 'cloudflared', metric: 'state-change', value: 0, previous: null, context: 'not running' });
    }

    // ─── Port health checks ───
    const ports = { 'heady-manager': 3301, 'headybuddy': 9000, 'headysystems': 9001, 'headyconnection': 9002, 'headymcp': 9003, 'headyio': 9004, 'headyme': 9005, 'headyweb': 3000, 'admin-ui': 5173 };
    for (const [name, port] of Object.entries(ports)) {
        const alive = await new Promise(resolve => {
            const req = http.get(`http://localhost:${port}/`, { timeout: 2000 }, (res) => resolve(res.statusCode));
            req.on('error', () => resolve(0));
            req.on('timeout', () => { req.destroy(); resolve(0); });
        });
        await post({ source: `port:${name}`, metric: 'http-status', value: alive, previous: 200, context: `port:${port}` });
    }

    // ─── Disk usage ───
    try {
        const dfLine = execSync("df -h / | tail -1", { timeout: 3000 }).toString().trim();
        const parts = dfLine.split(/\s+/);
        const usedPct = parseInt(parts[4]);
        await post({ source: 'disk', metric: 'usage-pct', value: usedPct, previous: null, context: `${parts[2]} used of ${parts[1]}` });
    } catch { }

    console.log(`[HeadyLens Feed] ${now} — metrics pushed`);
}

// Initial push + interval
console.log('🔭 HeadyLens Telemetry Feeder started (every 15s)');
collectAndPush();
setInterval(collectAndPush, INTERVAL_MS);
