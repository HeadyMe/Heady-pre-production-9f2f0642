
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

// ─── Port Configuration (env var driven, zero hardcoded localhost) ────
const SERVICE_PORTS = {
    headymcp_api: process.env.HEADYMCP_API_PORT || 5300,
    headymcp_web: process.env.HEADYMCP_WEB_PORT || 5000,
    headybuddy_api: process.env.HEADYBUDDY_API_PORT || 7300,
    headybuddy_web: process.env.HEADYBUDDY_WEB_PORT || 7000,
    headyio_api: process.env.HEADYIO_API_PORT || 6300,
    headyio_web: process.env.HEADYIO_WEB_PORT || 6000,
    headyconnection_api: process.env.HEADYCONNECTION_API_PORT || 9300,
    headyconnection_web: process.env.HEADYCONNECTION_WEB_PORT || 9000,
    headyme_admin: process.env.HEADYME_ADMIN_PORT || 4001,
    headyme_api: process.env.HEADYME_API_PORT || 4300,
    headyme_web: process.env.HEADYME_WEB_PORT || 4000,
    headysystems_manager: process.env.HEADYSYSTEMS_MANAGER_PORT || 3300,
    headysystems_admin: process.env.HEADYSYSTEMS_ADMIN_PORT || 3001,
    headysystems_api: process.env.HEADYSYSTEMS_API_PORT || 3300,
    headysystems_registry: process.env.HEADYSYSTEMS_REGISTRY_PORT || 3302,
    headysystems_hcfp: process.env.HEADYSYSTEMS_HCFP_PORT || 3303,
    headysystems_soul: process.env.HEADYSYSTEMS_SOUL_PORT || 3304,
    headysystems_battle: process.env.HEADYSYSTEMS_BATTLE_PORT || 3305,
    headysystems_orchestrator: process.env.HEADYSYSTEMS_ORCHESTRATOR_PORT || 3306,
    headysystems_web: process.env.HEADYSYSTEMS_WEB_PORT || 3000,
    headybot_hooks: process.env.HEADYBOT_HOOKS_PORT || 8300,
    headybot_web: process.env.HEADYBOT_WEB_PORT || 8000,
};

// All local services route internally via 127.0.0.1
const LOCAL_HOST = process.env.PROXY_TARGET_HOST || '127.0.0.1';

function target(port) {
    return `http://${LOCAL_HOST}:${port}`;
}

const server = http.createServer((req, res) => {
    const host = req.headers.host || '';
    const url = req.url;

    console.log(`🔄 Proxy request: ${host}${url}`);

    // Route requests to appropriate internal services by domain
    if (host.includes('headymcp.com')) {
        if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headymcp_api) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headymcp_web) });
        }
    } else if (host.includes('headybuddy.org')) {
        if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headybuddy_api) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headybuddy_web) });
        }
    } else if (host.includes('headyio.com')) {
        if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyio_api) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyio_web) });
        }
    } else if (host.includes('headyconnection.org')) {
        if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyconnection_api) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyconnection_web) });
        }
    } else if (host.includes('headyme.com')) {
        if (host.includes('admin.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyme_admin) });
        } else if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyme_api) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headyme_web) });
        }
    } else if (host.includes('headysystems.com')) {
        if (host.includes('manager.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_manager) });
        } else if (host.includes('admin.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_admin) });
        } else if (host.includes('api.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_api) });
        } else if (host.includes('registry.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_registry) });
        } else if (host.includes('hcfp.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_hcfp) });
        } else if (host.includes('soul.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_soul) });
        } else if (host.includes('battle.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_battle) });
        } else if (host.includes('orchestrator.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_orchestrator) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_web) });
        }
    } else if (host.includes('headybot.com')) {
        if (host.includes('hooks.')) {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headybot_hooks) });
        } else {
            proxy.web(req, res, { target: target(SERVICE_PORTS.headybot_web) });
        }
    } else {
        // Default to main HeadySystems portal
        proxy.web(req, res, { target: target(SERVICE_PORTS.headysystems_web) });
    }
});

proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Bad Gateway',
            message: err.message,
            timestamp: new Date().toISOString()
        }));
    }
});

const PORT = process.env.PROXY_PORT || 80;
server.listen(PORT, () => {
    console.log(`🌐 Domain proxy server running on port ${PORT}`);
    console.log('🏠 External domains route to internal services (env-var configurable)');
    console.log('📋 Routing:');
    console.log(`   headysystems.com     → ${LOCAL_HOST}:${SERVICE_PORTS.headysystems_web}`);
    console.log(`   api.headysystems.com → ${LOCAL_HOST}:${SERVICE_PORTS.headysystems_api}`);
    console.log(`   headyme.com          → ${LOCAL_HOST}:${SERVICE_PORTS.headyme_web}`);
    console.log(`   api.headyme.com      → ${LOCAL_HOST}:${SERVICE_PORTS.headyme_api}`);
    console.log(`   headymcp.com         → ${LOCAL_HOST}:${SERVICE_PORTS.headymcp_web}`);
    console.log(`   headyio.com          → ${LOCAL_HOST}:${SERVICE_PORTS.headyio_web}`);
    console.log(`   headybuddy.org       → ${LOCAL_HOST}:${SERVICE_PORTS.headybuddy_web}`);
    console.log(`   headybot.com         → ${LOCAL_HOST}:${SERVICE_PORTS.headybot_web}`);
    console.log(`   headyconnection.org  → ${LOCAL_HOST}:${SERVICE_PORTS.headyconnection_web}`);
});
