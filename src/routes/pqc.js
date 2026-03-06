/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Post-Quantum Cryptography API Routes ═══
 * Phase 2: Activate PQC module — quantum-resistant key exchange, signing, API key generation.
 * Phase 5: Crypto-stamped audit trail for Proof-of-Inference.
 */

const express = require('express');
const router = express.Router();
const { headyPQC, PQC_CONFIG, getStatus } = require('../security/pqc');

// ─── PQC Health & Status ────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'heady-pqc',
        config: {
            kem: PQC_CONFIG.kem.algorithm,
            signature: PQC_CONFIG.signature.algorithm,
            hash: PQC_CONFIG.hash.algorithm,
            hybridMode: PQC_CONFIG.hybridMode,
        },
        status: getStatus(),
        ts: new Date().toISOString(),
    });
});

// ─── Generate Key Pair for a Service ────────────────────────────────
router.post('/keys/generate', (req, res) => {
    const { serviceId } = req.body;
    if (!serviceId) return res.status(400).json({ ok: false, error: 'serviceId is required' });
    try {
        const keyPair = headyPQC.generateHybridKeyPair(serviceId);
        res.json({
            ok: true,
            serviceId,
            algorithm: keyPair.algorithm,
            fingerprint: keyPair.fingerprint,
            created: keyPair.created,
            message: 'Hybrid PQC+classical key pair generated',
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── Sign a Message ─────────────────────────────────────────────────
router.post('/sign', (req, res) => {
    const { serviceId, message } = req.body;
    if (!serviceId || !message) return res.status(400).json({ ok: false, error: 'serviceId and message are required' });
    try {
        const sig = headyPQC.signMessage(serviceId, message);
        res.json({ ok: true, ...sig });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── Verify a Signature ────────────────────────────────────────────
router.post('/verify', (req, res) => {
    const { serviceId, message, signature, timestamp } = req.body;
    if (!serviceId || !message || !signature) {
        return res.status(400).json({ ok: false, error: 'serviceId, message, and signature are required' });
    }
    try {
        const result = headyPQC.verifySignature(serviceId, message, signature, timestamp);
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── Generate Quantum-Resistant API Key ─────────────────────────────
router.post('/api-key', (req, res) => {
    const { scope, expiresIn, rateLimit } = req.body;
    if (!scope) return res.status(400).json({ ok: false, error: 'scope is required' });
    try {
        const key = headyPQC.generateAPIKey(scope, { expiresIn, rateLimit });
        res.json({ ok: true, ...key });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── Key Encapsulation (Service-to-Service Exchange) ────────────────
router.post('/encapsulate', (req, res) => {
    const { recipientServiceId } = req.body;
    if (!recipientServiceId) return res.status(400).json({ ok: false, error: 'recipientServiceId is required' });
    try {
        const result = headyPQC.encapsulate(recipientServiceId);
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
