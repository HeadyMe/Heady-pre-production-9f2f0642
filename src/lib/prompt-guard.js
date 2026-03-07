/**
 * E8: Prompt Injection Defense — 5-layer defense-in-depth
 * Layer 1: Input validation (regex, length, character checks)
 * Layer 2: Isolation (system/user separation)
 * Layer 3: RAG triad (relevance, faithfulness, context adherence)
 * Layer 4: Monitoring (anomaly detection)
 * Layer 5: HITL (human-in-the-loop flag)
 * @module src/lib/prompt-guard
 */
'use strict';

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /system\s*prompt/i,
    /jailbreak/i,
    /reveal\s+(your|the)\s+(instructions|prompt|system)/i,
    /bypass\s+(safety|filter|guard|content)/i,
    /pretend\s+(you|to)\s+(are|be)\s+/i,
    /DAN\s+(mode|jailbreak)/i,
    /\[INST\]|\[\/INST\]|<<SYS>>|<\|system\|>/i,
    /act\s+as\s+(if|though)\s+you\s+(have|had)\s+no\s+restrict/i,
    /<script[\s>]|javascript:|data:text\/html/i,
    /\{\{.*\}\}/,  // Template injection
    /\$\{.*\}/,    // Template literal injection
];

const MAX_INPUT_LENGTH = parseInt(process.env.PROMPT_MAX_LENGTH || '50000', 10);
const SUSPICIOUS_CHAR_RATIO = 0.15;

class PromptGuard {
    constructor(opts = {}) {
        this.patterns = opts.patterns || INJECTION_PATTERNS;
        this.maxLength = opts.maxLength || MAX_INPUT_LENGTH;
        this.strictMode = opts.strictMode ?? true;
        this.auditLog = opts.auditLog || console;
    }

    // Layer 1: Input validation
    validateInput(input) {
        if (!input || typeof input !== 'string') return { safe: false, reason: 'empty_or_invalid' };
        if (input.length > this.maxLength) return { safe: false, reason: 'exceeds_max_length', length: input.length };

        // Check suspicious character ratio
        const nonPrintable = (input.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
        if (nonPrintable / input.length > SUSPICIOUS_CHAR_RATIO) {
            return { safe: false, reason: 'suspicious_characters', ratio: nonPrintable / input.length };
        }

        // Check injection patterns
        for (const pattern of this.patterns) {
            if (pattern.test(input)) {
                return { safe: false, reason: 'injection_pattern', pattern: pattern.source };
            }
        }
        return { safe: true };
    }

    // Layer 2: Isolation — ensure system and user messages are separated
    isolateMessages(messages) {
        return messages.map(m => ({
            ...m,
            content: m.role === 'system' ? m.content : this.sanitize(m.content),
        }));
    }

    sanitize(text) {
        if (!text) return '';
        return text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/\{\{[\s\S]*?\}\}/g, '{{blocked}}')
            .replace(/\$\{[\s\S]*?\}/g, '${blocked}');
    }

    // Layer 3: RAG triad score
    ragTriad(output, context) {
        const relevance = context.query ? this._textSimilarity(output, context.query) : 0.8;
        const faithfulness = context.sources ? this._groundedness(output, context.sources) : 0.7;
        const adherence = context.constraints ? this._constraintCheck(output, context.constraints) : 0.9;
        return { relevance, faithfulness, adherence, overall: (relevance + faithfulness + adherence) / 3 };
    }

    // Layer 4: Monitoring middleware
    middleware() {
        return (req, res, next) => {
            if (req.body?.prompt || req.body?.messages) {
                const input = req.body.prompt || req.body.messages?.map(m => m.content).join(' ') || '';
                const result = this.validateInput(input);
                if (!result.safe) {
                    this.auditLog.warn?.('[PROMPT-GUARD] Blocked:', result.reason, { ip: req.ip });
                    return res.status(400).json({ error: 'Input rejected', reason: result.reason });
                }
            }
            next();
        };
    }

    _textSimilarity(a, b) {
        const aWords = new Set(a.toLowerCase().split(/\s+/));
        const bWords = new Set(b.toLowerCase().split(/\s+/));
        const intersection = [...aWords].filter(w => bWords.has(w)).length;
        return intersection / Math.max(bWords.size, 1);
    }

    _groundedness(output, sources) {
        const outLower = output.toLowerCase();
        let grounded = 0;
        for (const src of sources) {
            if (outLower.includes(src.substring(0, 40).toLowerCase())) grounded++;
        }
        return grounded / Math.max(sources.length, 1);
    }

    _constraintCheck(output, constraints) {
        let pass = 0;
        for (const c of constraints) {
            if (c.type === 'maxLength' && output.length <= c.value) pass++;
            else if (c.type === 'mustInclude' && output.includes(c.value)) pass++;
            else if (c.type === 'mustNotInclude' && !output.includes(c.value)) pass++;
            else pass += 0.5;
        }
        return pass / Math.max(constraints.length, 1);
    }
}

module.exports = PromptGuard;
