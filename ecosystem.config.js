// Heady Liquid Production — PM2 Ecosystem
// Cloudflare Tunnel handles edge routing → these are the local services it expects
// 15 sites + HeadyManager + HCFP Swarm + Lens Feeder

const SERVE = '/usr/local/bin/serve';

// ─── Memory & Resource Limits ──────────────────────────────────────────
// Bossgame P6: Ryzen 9 6900HX (8C/16T), 32GB LPDDR5, 1TB NVMe
// Core services: 512M each (max ~1.5GB)
// Sites: 64M each (15 × 64M = 960MB max)
// Leaves ~29GB for OS, Ollama models, buffers, and headroom
const SITE_MEM = '64M';
const CORE_MEM = '256M';

module.exports = {
    apps: [
        // ═══ Core Services ═══════════════════════════════════════════
        {
            name: 'heady-manager',
            script: 'heady-manager.js',
            cwd: '/home/headyme/Heady',
            env: { PORT: 3301, NODE_ENV: 'production' },
            max_memory_restart: '512M',
            autorestart: true,
            exp_backoff_restart_delay: 1000,
            max_restarts: 20,
            min_uptime: '10s',
        },
        {
            name: 'hcfp-auto-success',
            script: 'scripts/hcfp-full-auto.js',
            args: '--full-auto',
            cwd: '/home/headyme/Heady',
            max_memory_restart: CORE_MEM,
            autorestart: true,
            exp_backoff_restart_delay: 5000,  // exponential backoff prevents crash storms
            max_restarts: 10,
            min_uptime: '30s',
        },
        {
            name: 'lens-feeder',
            script: 'scripts/lens-telemetry-feeder.js',
            cwd: '/home/headyme/Heady',
            max_memory_restart: '128M',
            autorestart: true,
            max_restarts: 5,
        },

        // ═══ Primary Domain Sites ════════════════════════════════════
        { name: 'site-headybuddy', script: SERVE, args: '-s dist -l 9000 --no-clipboard', cwd: '/home/headyme/sites/headybuddy', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headysystems', script: SERVE, args: '-s dist -l 9001 --no-clipboard', cwd: '/home/headyme/sites/headysystems', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headyconnection', script: SERVE, args: '-s dist -l 9002 --no-clipboard', cwd: '/home/headyme/sites/headyconnection', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headymcp', script: SERVE, args: '-s dist -l 9003 --no-clipboard', cwd: '/home/headyme/sites/headymcp', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headyio', script: SERVE, args: '-s dist -l 9004 --no-clipboard', cwd: '/home/headyme/sites/headyio', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headyme', script: SERVE, args: '-s dist -l 9005 --no-clipboard', cwd: '/home/headyme/sites/headyme', max_memory_restart: SITE_MEM, autorestart: true },

        // ═══ Secondary / Variant Sites ═══════════════════════════════
        { name: 'site-headybuddy-org', script: SERVE, args: '-s dist -l 9010 --no-clipboard', cwd: '/home/headyme/sites/headybuddy-org', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headyconnection-org', script: SERVE, args: '-s dist -l 9011 --no-clipboard', cwd: '/home/headyme/sites/headyconnection-org', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headymcp-com', script: SERVE, args: '-s dist -l 9012 --no-clipboard', cwd: '/home/headyme/sites/headymcp-com', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headyme-com', script: SERVE, args: '-s dist -l 9013 --no-clipboard', cwd: '/home/headyme/sites/headyme-com', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-headysystems-com', script: SERVE, args: '-s dist -l 9014 --no-clipboard', cwd: '/home/headyme/sites/headysystems-com', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-instant', script: SERVE, args: '-s dist -l 9015 --no-clipboard', cwd: '/home/headyme/sites/instant', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-1ime1', script: SERVE, args: '-s dist -l 9016 --no-clipboard', cwd: '/home/headyme/sites/1ime1', max_memory_restart: SITE_MEM, autorestart: true },

        // ═══ App Sites ═══════════════════════════════════════════════
        { name: 'site-headyweb', script: SERVE, args: '-s dist -l 3000 --no-clipboard', cwd: '/home/headyme/sites/headyweb', max_memory_restart: SITE_MEM, autorestart: true },
        { name: 'site-admin-ui', script: SERVE, args: '-s dist -l 5173 --no-clipboard', cwd: '/home/headyme/sites/admin-ui', max_memory_restart: SITE_MEM, autorestart: true },
    ]
};
