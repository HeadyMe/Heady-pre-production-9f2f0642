/*
 * HeadyWeb Portal — Express Server
 * Serves the central portal + proxies to micro-frontends
 */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve portal static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));

// Serve micro-frontend source files
app.use('/remotes', express.static(path.join(__dirname, '..', '..', 'remotes')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        service: 'HeadyWeb',
        status: 'healthy',
        version: '3.2.0',
        uptime: process.uptime(),
        apps: 11,
        microFrontends: 7,
        timestamp: new Date().toISOString()
    });
});

// Domain resolver (for shell compatibility)
app.get('/api/domains/current', (req, res) => {
    const host = req.hostname || 'headyweb.com';
    res.json({
        hostname: host,
        uiId: 'landing',
        category: 'portal',
        title: 'HeadyWeb Central Portal'
    });
});

// MFE manifest
app.get('/api/mfe/manifest', (req, res) => {
    res.json({
        shell: 'HeadyWeb',
        version: '3.2.0',
        microFrontends: [
            { id: 'antigravity', scope: 'antigravity', status: 'active', route: '/app/antigravity' },
            { id: 'landing', scope: 'headyLanding', status: 'active', route: '/' },
            { id: 'heady-ide', scope: 'headyIDE', status: 'active', route: '/app/ide' },
            { id: 'swarm-dashboard', scope: 'swarmDashboard', status: 'active', route: '/app/swarm' },
            { id: 'governance-panel', scope: 'governancePanel', status: 'active', route: '/app/governance' },
            { id: 'projection-monitor', scope: 'projectionMonitor', status: 'active', route: '/app/projections' },
            { id: 'vector-explorer', scope: 'vectorExplorer', status: 'active', route: '/app/vectors' },
        ]
    });
});

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🐝 HeadyWeb Portal running on http://localhost:${PORT}`);
    console.log(`   11 Apps · 7 Micro-Frontends · Sacred Geometry v3`);
});
