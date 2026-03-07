const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const siteConfig = require('./site-config.json');
app.use(express.json({ limit: '1mb' }));
app.get('/health', (req, res) => res.json({ ok: true, service: 'HeadyMCP', domain: 'headymcp.com', projected: true, ts: new Date().toISOString() }));
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<html><head><title>${siteConfig.name}</title></head><body><h1>${siteConfig.name}</h1><p>${siteConfig.description}</p></body></html>`);
});
app.listen(PORT, () => console.log(`🐝 HeadyMCP running at http://localhost:${PORT}`));
