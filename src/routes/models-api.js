/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady Models Router — OpenAI-compatible model inference & fine-tuning API
 * Extracted from heady-manager.js monolith — Phase 2 Liquid Architecture.
 */

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const logger = require('../utils/logger');

try {
    const { listModels, getModelConfig, getFineTunePricing, isPremium, getArenaConfig } = require('../models/heady-models');

    // OpenAI-compatible: GET /api/v1/models
    router.get('/v1/models', (req, res) => {
        res.json({ object: 'list', data: listModels() });
    });

    // Heady-native: GET /api/models (same data, friendlier format)
    router.get('/models', (req, res) => {
        const models = listModels();
        res.json({
            models,
            default: 'heady-flash',
            premium: models.filter(m => m.tier === 'premium' || m.tier === 'pro').map(m => m.id),
            fine_tunable: ['heady-flash', 'heady-buddy', 'heady-battle-v1'],
            _links: {
                chat: '/api/v1/chat/completions',
                fine_tune: '/api/v1/fine-tune',
            },
        });
    });

    // OpenAI-compatible: POST /api/v1/chat/completions
    router.post('/v1/chat/completions', async (req, res) => {
        const { model = 'heady-flash', messages = [], temperature = 0.7, max_tokens, stream = false } = req.body;
        const config = getModelConfig(model);

        // Premium gating
        if (isPremium(model)) {
            const apiKey = req.headers['authorization']?.replace('Bearer ', '');
            if (!apiKey) {
                return res.status(401).json({
                    error: { message: `Model '${model}' requires authentication. Get an API key at https://headyio.com.`, type: 'authentication_error', code: 'api_key_required' },
                });
            }
        }

        const startTime = Date.now();
        const arena = getArenaConfig(model);

        try {
            const brainUrl = process.env.HEADY_BRAIN_URL || 'https://manager.headysystems.com';
            const lastMessage = messages[messages.length - 1]?.content || '';

            const brainRes = await fetch(`${brainUrl}/api/brain/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: lastMessage,
                    model: model,
                    arena_config: arena,
                    temperature,
                    max_tokens: max_tokens || config.max_output,
                }),
                signal: AbortSignal.timeout(arena.max_timeout_ms),
            });

            const data = await brainRes.json();
            const latency = Date.now() - startTime;
            const replyContent = data.reply || data.response || data.message || '';

            // Cognitive Telemetry: Proof-of-Inference audit stamp
            let audit_hash = null;
            try {
                const cogTel = require('../telemetry/cognitive-telemetry');
                const audit = cogTel.createAuditedAction(
                    cogTel.ACTION_TYPES.CHAT_COMPLETION,
                    { model, messages: messages.slice(-2), temperature },
                    { reply: replyContent.slice(0, 500), tokens: Math.ceil(replyContent.length / 4) },
                    { model, provider: 'heady-brain', latency_ms: latency, tokens_in: Math.ceil(lastMessage.length / 4), tokens_out: Math.ceil(replyContent.length / 4), arena_nodes: arena.nodes === 'all' ? 20 : arena.nodes?.length || 1, tier: config.tier, source_endpoint: '/api/v1/chat/completions' }
                );
                audit_hash = audit.sha256_hash;
            } catch { /* telemetry module not loaded */ }

            res.json({
                id: 'chatcmpl-heady-' + Date.now().toString(36),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: replyContent },
                    finish_reason: 'stop',
                }],
                usage: {
                    prompt_tokens: Math.ceil(lastMessage.length / 4),
                    completion_tokens: Math.ceil(replyContent.length / 4),
                    total_tokens: Math.ceil(lastMessage.length / 4) + Math.ceil(replyContent.length / 4),
                },
                heady: {
                    model_badge: config.badge,
                    arena_nodes: arena.nodes === 'all' ? 20 : arena.nodes?.length || 1,
                    latency_ms: latency,
                    tier: config.tier,
                    audit_hash,
                },
            });
        } catch (err) {
            res.status(502).json({
                error: { message: 'Model inference failed: ' + err.message, type: 'server_error', code: 'inference_error' },
            });
        }
    });

    // Fine-Tuning: POST /api/v1/fine-tune
    router.post('/v1/fine-tune', (req, res) => {
        const { model = 'heady-flash', training_data, name } = req.body;
        const pricing = getFineTunePricing(model);

        if (!pricing) {
            return res.status(400).json({
                error: { message: `Model '${model}' does not support fine-tuning. Available: heady-flash, heady-buddy, heady-battle-v1`, type: 'invalid_request' },
            });
        }

        const exampleCount = Array.isArray(training_data) ? training_data.length : 0;
        if (exampleCount < pricing.min_examples) {
            return res.status(400).json({
                error: { message: `Minimum ${pricing.min_examples} training examples required. Got ${exampleCount}.`, type: 'invalid_request' },
            });
        }

        const estimatedMinutes = Math.ceil((exampleCount / 1000) * pricing.estimated_time_per_1k);
        const estimatedHours = Math.ceil(estimatedMinutes / 60 * 10) / 10;
        const estimatedCost = (estimatedHours * pricing.training_per_hour).toFixed(2);

        res.json({
            id: 'ft-heady-' + Date.now().toString(36),
            object: 'fine_tuning.job',
            model: model,
            status: 'pending',
            name: name || `${model}-custom-${Date.now().toString(36)}`,
            training_examples: exampleCount,
            estimated_duration: {
                minutes: estimatedMinutes,
                hours: estimatedHours,
            },
            estimated_cost: {
                training: `$${estimatedCost}`,
                hosting_per_hour: `$${pricing.hosting_per_hour.toFixed(2)}/hr`,
                currency: 'USD',
            },
            pricing: {
                training_rate: `$${pricing.training_per_hour.toFixed(2)}/hr`,
                hosting_rate: `$${pricing.hosting_per_hour.toFixed(2)}/hr`,
            },
            _note: 'Fine-tuning job queued. Payment required before training begins.',
        });
    });

    // Fine-Tune Pricing: GET /api/v1/fine-tune/pricing
    router.get('/v1/fine-tune/pricing', (req, res) => {
        res.json({
            models: {
                'heady-flash': getFineTunePricing('heady-flash'),
                'heady-buddy': getFineTunePricing('heady-buddy'),
                'heady-battle-v1': getFineTunePricing('heady-battle-v1'),
            },
            _note: 'All prices in USD. Training billed per hour. Hosting billed per hour while model is active.',
        });
    });

    logger.logNodeActivity("CONDUCTOR", "  ∞ Heady Models: /api/models | /api/v1/chat/completions | /api/v1/fine-tune");
    logger.logNodeActivity("CONDUCTOR", "  ∞ Models: heady-battle-v1, heady-flash, heady-reason, heady-edge, heady-buddy");
} catch (err) {
    logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Models not loaded: ${err.message}`);
}

module.exports = router;
