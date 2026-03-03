/**
 * Core API Router — Heady Manager
 * Provides foundational API endpoints used by multiple services.
 */
const express = require('express');
const router = express.Router();
const { getLiquidUnifiedRuntime } = require('../src/services/liquid-unified-runtime');

const liquidRuntime = getLiquidUnifiedRuntime();

// Core health routing — delegates to main health handler
router.get('/core/health', (req, res) => {
    res.json({
        ok: true,
        service: 'heady-core-api',
        version: '2.0.0',
        ts: new Date().toISOString(),
    });
});

// Module health endpoint to satisfy architecture governance
router.get('/liquid-runtime/health', (req, res) => {
    res.json(liquidRuntime.health());
});

router.get('/core/unified-runtime', (req, res) => {
    res.json({
        ok: true,
        runtime: liquidRuntime.runtimeStatus(),
    });
});

router.get('/core/unified-projection', (req, res) => {
    res.json(liquidRuntime.getUnifiedProjectionSnapshot());
});

router.get('/heady-conductor/health', (req, res) => {
    res.json(liquidRuntime.getCapabilityHealth('heady-conductor'));
});

router.get('/headycloud-conductor/health', (req, res) => {
    res.json(liquidRuntime.getCapabilityHealth('headycloud-conductor'));
});

router.get('/headyswarm/health', (req, res) => {
    res.json({
        ...liquidRuntime.getCapabilityHealth('headyswarm'),
        realtimeTransport: ['websocket', 'rtp-midi'],
    });
});

router.get('/headybees/health', (req, res) => {
    res.json(liquidRuntime.getCapabilityHealth('headybees'));
});

router.get('/ableton-live/health', (req, res) => {
    res.json({
        ok: true,
        module: 'ableton-live-bridge',
        status: 'ready',
        transport: 'rtp-midi',
        orchestrationController: 'headyswarm',
    });
});

router.post('/core/template-injection', (req, res) => {
    const { workspaceVectorId, templateName, target } = req.body || {};

    if (!workspaceVectorId || !templateName || !target) {
        return res.status(400).json({
            ok: false,
            error: 'workspaceVectorId, templateName, and target are required',
        });
    }

    return res.json(liquidRuntime.injectTemplateFrom3DWorkspace({
        workspaceVectorId,
        templateName,
        target,
    }));
});

router.post('/core/dynamic-experience', (req, res) => {
    res.json(liquidRuntime.buildDynamicExperience(req.body || {}));
});

router.post('/core/reconcile-projection', (req, res) => {
    const apply = Boolean(req.body?.apply);
    res.json(liquidRuntime.reconcileRepositoryProjection({ apply }));
});

module.exports = router;
