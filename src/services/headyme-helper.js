/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── HeadyMe Helper — Customer Support Agent ────────────────────
 *
 * AI support agent trained on audit logs and documentation.
 * Provides instant technical support to developers & users.
 *
 * Capabilities:
 *   - Answers questions using indexed documentation
 *   - Searches audit logs for known issues
 *   - Suggests fixes based on error patterns
 *   - Escalates to human support when confidence is low
 *   - Learns from resolved tickets (feedback loop)
 *
 * Dependencies: vector-memory (for knowledge base), logger
 * ──────────────────────────────────────────────────────────────────
 */

const vectorMemory = require('../vector-memory');
const logger = require('../utils/logger');

const CONFIDENCE_THRESHOLD = 0.6;
const MAX_CONTEXT_RESULTS = 5;

class HeadyMeHelper {
    constructor() {
        this.conversations = new Map(); // sessionId → message[]
        this.ticketCount = 0;
        this.resolvedCount = 0;
        this.escalatedCount = 0;
    }

    // ── Core Query ──────────────────────────────────────────────
    /**
     * Ask the helper a question. Returns answer + sources.
     */
    async ask(question, sessionId = null) {
        if (!sessionId) sessionId = `session-${Date.now().toString(36)}`;

        // Initialize conversation history
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }
        const history = this.conversations.get(sessionId);
        history.push({ role: 'user', content: question, timestamp: Date.now() });

        this.ticketCount++;

        // Search knowledge base
        const results = await vectorMemory.queryMemory(question, MAX_CONTEXT_RESULTS);
        const context = (results || [])
            .filter(r => r.similarity > 0.3)
            .map(r => ({
                content: r.content,
                source: r.metadata?.source || r.metadata?.memoryType || 'knowledge-base',
                similarity: Math.round(r.similarity * 100) / 100,
            }));

        // Determine confidence based on top result similarity
        const topSimilarity = context.length > 0 ? context[0].similarity : 0;
        const confidence = topSimilarity;

        let answer;
        if (confidence >= CONFIDENCE_THRESHOLD) {
            answer = {
                sessionId,
                response: this._synthesizeAnswer(question, context),
                confidence,
                sources: context.map(c => ({ source: c.source, relevance: c.similarity })),
                escalated: false,
            };
            this.resolvedCount++;
        } else {
            answer = {
                sessionId,
                response: `I'm not confident enough to answer this question (confidence: ${(confidence * 100).toFixed(0)}%). Let me escalate this to the team.`,
                confidence,
                sources: context.map(c => ({ source: c.source, relevance: c.similarity })),
                escalated: true,
                ticket: `TICKET-${this.ticketCount}`,
            };
            this.escalatedCount++;

            if (global.eventBus) {
                global.eventBus.emit('support:escalated', {
                    sessionId,
                    question,
                    ticket: answer.ticket,
                    confidence,
                });
            }
        }

        history.push({ role: 'assistant', ...answer, timestamp: Date.now() });
        return answer;
    }

    _synthesizeAnswer(question, context) {
        // Build answer from context chunks
        if (context.length === 0) return 'No relevant information found in the knowledge base.';

        const topContext = context[0].content;
        const additionalContext = context.slice(1).map(c => c.content).join('\n\n');

        return `Based on the knowledge base:\n\n${topContext}${additionalContext ? `\n\n---\nAdditional context:\n${additionalContext}` : ''}`;
    }

    // ── Feedback Loop ───────────────────────────────────────────
    async submitFeedback(sessionId, helpful, correction = null) {
        const history = this.conversations.get(sessionId);
        if (!history) return { error: 'Session not found' };

        const feedback = {
            sessionId,
            helpful,
            correction,
            timestamp: Date.now(),
        };

        // If correction provided, embed it as new knowledge
        if (correction) {
            const lastQuestion = history.filter(m => m.role === 'user').pop();
            await vectorMemory.ingestMemory({
                content: `${lastQuestion?.content || 'user question'}\n\nAnswer: ${correction}`,
                metadata: {
                    type: 'support-correction',
                    source: 'user-feedback',
                    sessionId,
                    memoryType: 'episodic',
                    createdAt: Date.now(),
                },
            });
            logger.info(`[HeadyMeHelper] Correction embedded from session: ${sessionId}`);
        }

        return { feedback: 'recorded', improved: !!correction };
    }

    // ── Knowledge Ingestion ─────────────────────────────────────
    async ingestDocumentation(docPath, content) {
        await vectorMemory.ingestMemory({
            content,
            metadata: {
                type: 'documentation',
                source: docPath,
                memoryType: 'semantic',
                createdAt: Date.now(),
            },
        });
        logger.info(`[HeadyMeHelper] Documentation ingested: ${docPath}`);
    }

    // ── Health ──────────────────────────────────────────────────
    getHealth() {
        return {
            totalTickets: this.ticketCount,
            resolved: this.resolvedCount,
            escalated: this.escalatedCount,
            resolutionRate: this.ticketCount > 0 ? Math.round((this.resolvedCount / this.ticketCount) * 100) : 0,
            activeSessions: this.conversations.size,
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const helper = new HeadyMeHelper();

// ── REST Endpoints ────────────────────────────────────────────
function registerHelperRoutes(app) {
    app.post('/api/support/ask', async (req, res) => {
        try {
            const answer = await helper.ask(req.body.question, req.body.sessionId);
            res.json({ ok: true, ...answer });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/support/feedback', async (req, res) => {
        const result = await helper.submitFeedback(req.body.sessionId, req.body.helpful, req.body.correction);
        res.json({ ok: true, ...result });
    });

    app.post('/api/support/ingest', async (req, res) => {
        await helper.ingestDocumentation(req.body.path, req.body.content);
        res.json({ ok: true });
    });

    app.get('/api/support/health', (req, res) => {
        res.json({ ok: true, ...helper.getHealth() });
    });
}

module.exports = { HeadyMeHelper, helper, registerHelperRoutes };
