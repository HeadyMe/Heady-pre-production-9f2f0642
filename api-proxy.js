const express = require('express');
const http = require('http');
const url = require('url');

const app = express();
const PORT = 8080;

// Proxy API requests to HeadyManager
app.use('/api/*', (req, res) => {
    const targetUrl = `http://manager.headyme.com:3300${req.originalUrl}`;
    const parsedUrl = url.parse(targetUrl);
    
    const options = {
        hostname: 'manager.headyme.com',
        port: 3300,
        path: parsedUrl.path,
        method: req.method,
        headers: {
            'Content-Type': 'application/json',
            ...req.headers
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Service unavailable' });
    });

    if (req.body) {
        proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
});

// Serve static files (including admin-ui.html)
app.use(express.static('.'));

// Start server
app.listen(PORT, manager.headyme.com.0', () => {
    console.log(`API Proxy server running on port ${PORT}`);
    console.log(`Admin UI: https://headyme.com`);
    console.log(`API endpoints: https://headyme.com/api/*`);
});
