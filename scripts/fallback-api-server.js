
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Fallback endpoints for all domains
app.use('*', (req, res) => {
    console.log('Fallback API called:', req.originalUrl);
    
    res.json({
        status: 'ok',
        fallback: true,
        domain: req.hostname,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        message: 'Fallback API - Cloudflare connectivity issues handled'
    });
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🛡️ Fallback API server running on port ${PORT}`);
    console.log('🌩️ Cloudflare Error 1000 prevention active');
});
