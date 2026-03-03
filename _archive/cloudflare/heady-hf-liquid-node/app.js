/**
 * © 2026 Heady Systems LLC.
 * ═══ Heady Liquid Node — Hugging Face Space Edition ═══
 * 
 * This is a dedicated Express Node deployed instantly to Hugging Face Spaces.
 * It acts as high-throughput Compute & Forwarding Endpoint that connects back
 * into the broader Heady "Liquid" architecture.
 * Port: 7860 (Hugging Face default)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 7860;

// Security & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger payloads like vector embeddings

// Heady Origin Authentication
// Only requests from authorized Heady layers or authorized tokens can invoke this node.
const AUTHORIZED_TOKEN = process.env.HEADY_API_KEY || 'hf_local_dev';

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];

    // Check against authorized token or if it's the HF token being forwarded
    if (token === AUTHORIZED_TOKEN || token === process.env.HF_TOKEN) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized Node Access' });
    }
}

// ─── Health / Heartbeat ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        service: 'heady-hf-liquid-node',
        version: '1.0.0',
        environment: 'huggingface-space',
        ts: new Date().toISOString()
    });
});

// ─── Liquid Compute Endpoint ─────────────────────────────────────────
/**
 * Generic POST endpoint for offloading arbitrary task logic
 * to Hugging Face infrastructure. e.g. large vector similarity computation.
 */
app.post('/api/compute/task', authenticate, async (req, res) => {
    const { taskType, payload } = req.body;

    console.log(`[liquid-node] Assigned Task: ${taskType}`);

    try {
        if (taskType === 'vector-distance') {
            // Placeholder: compute heavy cosine similarity
            res.json({ status: 'completed', result: { similarity: 0.99 }, node: 'hf-space' });
        } else if (taskType === 'optimization-pass') {
            // Placeholder: process heavy AST evaluation
            res.json({ status: 'completed', result: { diff: null }, node: 'hf-space' });
        } else {
            res.status(400).json({ error: `Unknown taskType: ${taskType}` });
        }
    } catch (err) {
        console.error(`[liquid-node] Task Execution Error: ${err.message}`);
        res.status(500).json({ error: err.message, node: 'hf-space' });
    }
});

// ─── Inference Forwarding (Proxy) ────────────────────────────────────
/**
 * Dedicated route to proxy HF Inference API requests internally within HF's network.
 * This skips external egress costs and minimizes latency when the Space talks to Inference endpoints.
 */
app.post('/api/inference/forward', authenticate, async (req, res) => {
    // Forward to HF Inference endpoints
    const { model, input, parameters } = req.body;
    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
        return res.status(500).json({ error: 'HF_TOKEN missing in Space Secrets' });
    }

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: input, parameters })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`[liquid-node] Inference failed:`, data);
            return res.status(response.status).json(data);
        }

        res.json({ result: data, node: 'hf-space' });
    } catch (err) {
        console.error(`[liquid-node] Inference internal error: ${err.message}`);
        res.status(500).json({ error: err.message, node: 'hf-space' });
    }
});

// Start the HF Liquid Node
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🐝 Heady Liquid Node (HF Space) listening on port ${PORT}`);
    console.log(`======================================================\n`);
});
