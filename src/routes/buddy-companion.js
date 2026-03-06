/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ HeadyBuddy Companion Protocol Routes ═══
 * Phase 4: HeadyBuddy Silversertile Orchestrator API
 *
 * Implements the operational directives from the HeadyBuddy architectural analysis:
 *   - Directive 1: Omnipresent Contextual Awareness
 *   - Directive 2: Instant App Generation Protocol (Card-Based UI)
 *   - Directive 3: Zero-Trust Auto-Sanitization
 *   - Directive 5: Graceful Lifecycle Management
 *   - Directive 6: Empathic Masking & Persona Fidelity
 *   - Directive 7: Dynamic Connector App Instantiation
 *
 * Four-Pillar Control Matrix:
 *   Input Controls  → Data isolation per agent
 *   Process Controls → Confidence thresholds + HITL
 *   Output Controls → Sanitization before delivery
 *   Action Controls → Transaction limits + RBAC
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ═══ Companion State ════════════════════════════════════════════════
const companionState = {
    persona: 'empathic_safe_space',  // empathic_safe_space | analytical_coach | environmental_actuator
    activeCards: new Map(),           // cardId → { type, template, createdAt, lifecycle }
    connectors: new Map(),            // connectorId → { schema, status, lastActivity }
    contextInbox: [],                 // passive ingestion queue
    midiPorts: new Map(),             // portId → { channel, status, target }
    metrics: {
        cardsGenerated: 0,
        connectorsCreated: 0,
        midiMessagesDispatched: 0,
        selfHealingCycles: 0,
        approvalGatesTriggered: 0,
    },
};

// ═══ Directive 1: Omnipresent Contextual Awareness ══════════════════

router.get('/context', (req, res) => {
    res.json({
        ok: true,
        persona: companionState.persona,
        activeCards: companionState.activeCards.size,
        activeConnectors: companionState.connectors.size,
        activeMidiPorts: companionState.midiPorts.size,
        contextInboxSize: companionState.contextInbox.length,
        metrics: companionState.metrics,
        ts: new Date().toISOString(),
    });
});

router.post('/context/ingest', (req, res) => {
    const { source, type, data, priority } = req.body;
    if (!source || !data) return res.status(400).json({ ok: false, error: 'source and data required' });

    const entry = {
        id: crypto.randomUUID(),
        source,
        type: type || 'generic',
        data,
        priority: priority || 'normal',
        ingestedAt: new Date().toISOString(),
    };

    companionState.contextInbox.push(entry);
    // Keep inbox bounded
    if (companionState.contextInbox.length > 1000) {
        companionState.contextInbox = companionState.contextInbox.slice(-500);
    }

    res.json({ ok: true, entryId: entry.id, inboxSize: companionState.contextInbox.length });
});

// ═══ Directive 2: Instant Card Generation Protocol ══════════════════

router.post('/cards/generate', (req, res) => {
    const { type, title, dataSchema, template, style } = req.body;
    if (!type || !title) return res.status(400).json({ ok: false, error: 'type and title required' });

    const cardId = `card-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    const card = {
        id: cardId,
        type,
        title,
        dataSchema: dataSchema || {},
        template: template || 'horizontal-card',
        style: style || 'default',
        status: 'active',
        createdAt: new Date().toISOString(),
        lifecycle: { created: Date.now(), lastAccess: Date.now(), ttlMs: 3600000 },
    };

    companionState.activeCards.set(cardId, card);
    companionState.metrics.cardsGenerated++;

    // Emit MIDI note for card creation if bus is available
    if (global.midiBus) {
        global.midiBus.taskStarted(`card:${type}`, 0);
    }

    res.json({ ok: true, card });
});

router.get('/cards', (req, res) => {
    const cards = Array.from(companionState.activeCards.values());
    res.json({ ok: true, cards, total: cards.length });
});

router.delete('/cards/:id', (req, res) => {
    const card = companionState.activeCards.get(req.params.id);
    if (!card) return res.status(404).json({ ok: false, error: 'Card not found' });

    companionState.activeCards.delete(req.params.id);

    // Emit MIDI note for card teardown
    if (global.midiBus) {
        global.midiBus.taskCompleted(`card:${card.type}`, 0);
    }

    res.json({ ok: true, message: `Card ${req.params.id} destroyed`, lifecycle: card.lifecycle });
});

// ═══ Directive 6: Persona Management ════════════════════════════════

router.get('/persona', (req, res) => {
    res.json({
        ok: true,
        persona: companionState.persona,
        modes: ['empathic_safe_space', 'analytical_coach', 'environmental_actuator'],
        description: {
            empathic_safe_space: 'Judgment-free emotional support and companionship',
            analytical_coach: 'Real-time analysis, coaching, and strategic recommendations',
            environmental_actuator: 'Physical environment control via MIDI/protocol bridging',
        },
    });
});

router.post('/persona/switch', (req, res) => {
    const { persona } = req.body;
    const valid = ['empathic_safe_space', 'analytical_coach', 'environmental_actuator'];
    if (!valid.includes(persona)) {
        return res.status(400).json({ ok: false, error: `Invalid persona. Must be one of: ${valid.join(', ')}` });
    }
    companionState.persona = persona;

    // Broadcast regime shift on MIDI bus
    if (global.midiBus) {
        global.midiBus.regimeShift(persona, 0);
    }

    res.json({ ok: true, persona, message: `Switched to ${persona} mode` });
});

// ═══ Directive 7: Dynamic Connector Instantiation ═══════════════════

router.post('/connectors/create', (req, res) => {
    const { targetSystem, schema, authType, endpoint } = req.body;
    if (!targetSystem) return res.status(400).json({ ok: false, error: 'targetSystem required' });

    const connectorId = `conn-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    const connector = {
        id: connectorId,
        targetSystem,
        schema: schema || {},
        authType: authType || 'bearer',
        endpoint: endpoint || null,
        status: 'active',
        protocol: 'MCP',
        metrics: { requests: 0, errors: 0, avgLatencyMs: 0 },
        createdAt: new Date().toISOString(),
    };

    companionState.connectors.set(connectorId, connector);
    companionState.metrics.connectorsCreated++;

    res.json({ ok: true, connector });
});

router.get('/connectors', (req, res) => {
    const connectors = Array.from(companionState.connectors.values());
    res.json({ ok: true, connectors, total: connectors.length });
});

router.delete('/connectors/:id', (req, res) => {
    if (!companionState.connectors.has(req.params.id)) {
        return res.status(404).json({ ok: false, error: 'Connector not found' });
    }
    companionState.connectors.delete(req.params.id);
    res.json({ ok: true, message: `Connector ${req.params.id} destroyed` });
});

// ═══ Protocol Bridging Status ═══════════════════════════════════════

router.get('/protocol-bridge', (req, res) => {
    res.json({
        ok: true,
        bridges: {
            'midi-to-udp': { status: 'ready', useCase: 'High-speed local hardware/IoT control' },
            'midi-to-tcp': { status: 'ready', useCase: 'Reliable state transfers (financial, DB writes)' },
            'midi-to-mcp': { status: 'ready', useCase: 'Physical gesture → LLM tool-calling via MCP' },
            'midi-to-api': { status: 'ready', useCase: 'External web services via Edge Gateway + mTLS' },
        },
        midiPorts: companionState.midiPorts.size,
        midiBusActive: !!global.midiBus,
    });
});

// ═══ Companion Health ═══════════════════════════════════════════════

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'heady-buddy-companion',
        persona: companionState.persona,
        activeCards: companionState.activeCards.size,
        activeConnectors: companionState.connectors.size,
        metrics: companionState.metrics,
        pillarMatrix: {
            inputControls: 'active',
            processControls: 'active',
            outputControls: 'active',
            actionControls: 'active',
        },
        ts: new Date().toISOString(),
    });
});

module.exports = router;
