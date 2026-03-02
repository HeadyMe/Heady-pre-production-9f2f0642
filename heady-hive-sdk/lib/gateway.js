/**
 * ═══ HeadyGateway — Liquid Unified LLM Router ═══
 *
 * Single liquidity point for ALL AI traffic in the Heady ecosystem.
 * Handles: provider routing, rate limiting, budget caps, response caching,
 * health tracking, race auditing, and automatic failover.
 *
 * Liquid constraint: redundant deployment across edge (CF Workers) +
 * cloud (GCloud/Vertex) + local (HeadyManager). Traffic flows to the
 * healthiest, cheapest, fastest available endpoint.
 *
 * Usage:
 *   const gateway = new HeadyGateway({ providers: [...], budget: { daily: 5 } });
 *   const result = await gateway.chat("Hello", { priority: "high" });
 */

class HeadyGateway {
    constructor(opts = {}) {
        // Provider registry — ordered by priority
        this.providers = [];
        this.budget = {
            daily: opts.budget?.daily || 10,        // $ per day
            monthly: opts.budget?.monthly || 100,    // $ per month
            spent: { daily: 0, monthly: 0 },
            resetAt: { daily: this._nextReset("daily"), monthly: this._nextReset("monthly") },
        };
        this.rateLimits = new Map();  // provider → { rpm, tpm, current }
        this.cache = new Map();       // hash → { response, ts, ttl }
        this.healthState = new Map(); // provider → { healthy, lastCheck, failures, avgLatency }
        this.auditLog = [];
        this.maxAuditEntries = 500;
        this.cacheMaxSize = 200;
        this.cacheTTL = opts.cacheTTL || 300000;  // 5 min default

        // Stats
        this.stats = {
            totalRequests: 0, cacheHits: 0, semanticCacheHits: 0, rateLimited: 0,
            budgetBlocked: 0, failures: 0, wins: {},
        };

        // Semantic cache — 3D vector memory bridge
        this._vectorMemory = opts.vectorMemory || null;
        this._semanticThreshold = opts.semanticThreshold || 0.85;

        // Register default providers if none given
        if (opts.providers?.length) {
            for (const p of opts.providers) this.registerProvider(p);
        }
    }

    // ─── Provider Registry ──────────────────────────────────────────

    /**
     * Register a provider with the gateway.
     * @param {Object} provider
     * @param {string} provider.name - Internal name (e.g., "claude", "gemini")
     * @param {string} provider.serviceGroup - Heady service group name (e.g., "heady-reasoning")
     * @param {Function} provider.chat - async (message, system, opts) => { response, model, usage }
     * @param {Function} [provider.embed] - async (text, opts) => { embedding, dimensions }
     * @param {Object} [provider.limits] - { rpm: 60, tpm: 100000 }
     * @param {Object} [provider.pricing] - { inputPer1M: 3.0, outputPer1M: 15.0 }
     * @param {number} [provider.priority] - Lower = higher priority (default 50)
     * @param {string[]} [provider.capabilities] - ["chat", "embed", "code", "vision", "thinking"]
     */
    registerProvider(provider) {
        const p = {
            name: provider.name,
            serviceGroup: provider.serviceGroup || `heady-${provider.name}`,
            chat: provider.chat,
            embed: provider.embed || null,
            limits: provider.limits || { rpm: 60, tpm: 100000 },
            pricing: provider.pricing || { inputPer1M: 1.0, outputPer1M: 3.0 },
            priority: provider.priority ?? 50,
            capabilities: provider.capabilities || ["chat"],
            enabled: provider.enabled !== false,
        };

        this.providers.push(p);
        this.providers.sort((a, b) => a.priority - b.priority);

        // Initialize health + rate state
        this.healthState.set(p.name, {
            healthy: true, lastCheck: Date.now(), consecutiveFailures: 0,
            avgLatency: 0, totalCalls: 0, totalErrors: 0,
        });
        this.rateLimits.set(p.name, {
            rpm: p.limits.rpm, tpm: p.limits.tpm,
            currentRPM: 0, currentTPM: 0,
            windowStart: Date.now(),
        });

        return this;
    }

    // ─── Core Chat — Liquid Routing ─────────────────────────────────

    /**
     * Send a chat request through the liquid gateway.
     * Routes to the best available provider based on health, budget, rate limits.
     *
     * @param {string} message
     * @param {Object} [opts]
     * @param {string} [opts.system] - System prompt
     * @param {string} [opts.priority] - "low" | "medium" | "high" | "critical"
     * @param {boolean} [opts.race] - Race all providers (default for high/critical)
     * @param {boolean} [opts.cache] - Use cache (default true for low/medium)
     * @param {number} [opts.temperature]
     * @param {number} [opts.maxTokens]
     * @returns {Object} { ok, response, engine, race, latency, cached, audit }
     */
    async chat(message, opts = {}) {
        this.stats.totalRequests++;
        const raceId = `gw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const priority = opts.priority || this._detectPriority(message);
        const startTs = Date.now();

        // Budget tracking (visibility only — never blocks)
        this._checkBudgetReset();

        // Cache check (skip for high/critical or explicit no-cache)
        if (opts.cache !== false && (priority === "low" || priority === "medium")) {
            const cached = this._checkCache(message, opts.system);
            if (cached) {
                this.stats.cacheHits++;
                return { ok: true, response: cached.response, engine: cached.engine, cached: true, latency: 0 };
            }
        }

        // Semantic cache — query 3D vector memory for proven answers
        if (opts.cache !== false && this._vectorMemory) {
            try {
                const semanticHit = await this._checkSemanticCache(message);
                if (semanticHit) {
                    this.stats.semanticCacheHits++;
                    return {
                        ok: true, response: semanticHit.response, engine: "semantic-cache",
                        cached: true, semantic: true,
                        similarity: semanticHit.similarity,
                        originalQuestion: semanticHit.originalQuestion,
                        provenBy: semanticHit.provenBy,
                        latency: Date.now() - startTs,
                    };
                }
            } catch { /* semantic cache miss or error — continue to race */ }
        }

        // Default: race all providers. Sequential only if explicitly requested.
        const shouldSequential = opts.sequential === true;
        const available = this._getAvailableProviders();

        if (available.length === 0) {
            return { ok: false, error: "no-providers-available", health: Object.fromEntries(this.healthState) };
        }

        let result;
        if (!shouldSequential && available.length > 1) {
            result = await this._raceProviders(available, message, opts, raceId);
        } else {
            result = await this._routeSequential(available, message, opts, raceId);
        }

        if (result.ok) {
            // Track cost (visibility only)
            const cost = this._estimateCost(result._provider, message, result.response);
            this.budget.spent.daily += cost;
            this.budget.spent.monthly += cost;

            // Cache response (exact hash)
            if (priority !== "critical") {
                this._setCache(message, opts.system, result);
            }

            // Store in semantic cache (3D vector memory) for future dedup
            if (this._vectorMemory) {
                this._storeSemanticCache(message, result).catch(() => { });
            }

            // Clean internal fields
            delete result._provider;
        }

        result.latency = Date.now() - startTs;
        result.race = { id: raceId, priority };
        return result;
    }

    // ─── Race All Providers ─────────────────────────────────────────
    // Returns the fastest response immediately, but ALL responses are
    // preserved in vector memory as determinism proof. If 5 providers
    // agree, that's high-confidence consensus — never throw this away.

    async _raceProviders(providers, message, opts, raceId) {
        let responded = false;
        let winner = null;
        const allResults = [];
        const allResponses = []; // ← NEW: preserve ALL full responses
        const audit = { raceId, ts: new Date().toISOString(), providers: providers.map(p => p.name), results: [] };

        const promises = providers.map(p => {
            const start = Date.now();
            return p.chat(message, opts.system, {
                temperature: opts.temperature, max_tokens: opts.maxTokens,
                history: opts.history,
            })
                .then(result => {
                    const latency = Date.now() - start;
                    this._recordSuccess(p.name, latency);
                    this._consumeRate(p.name);

                    const entry = {
                        source: p.name, engine: p.serviceGroup, status: "ok",
                        latency, responseLength: (result.response || "").length,
                        model: result.model,
                    };
                    allResults.push(entry);

                    // Preserve FULL response for determinism proof
                    allResponses.push({
                        provider: p.name,
                        engine: p.serviceGroup,
                        model: result.model,
                        response: result.response,
                        latency,
                        isWinner: false, // updated below if this is the winner
                    });

                    // Only accept non-empty responses as race winners
                    if (!responded && result.response && result.response.trim().length > 0) {
                        responded = true;
                        winner = { ...entry, response: result.response, _provider: p };
                        audit.winner = entry;
                        allResponses[allResponses.length - 1].isWinner = true;
                    } else {
                        // Late response — log it
                        entry.isLate = true;
                        entry.deltaMs = latency - (audit.winner?.latency || 0);
                        audit.lateResponses = audit.lateResponses || [];
                        audit.lateResponses.push(entry);

                        // Optimization signal: late but richer
                        if (entry.responseLength > (audit.winner?.responseLength || 0) * 1.5) {
                            audit.signals = audit.signals || [];
                            audit.signals.push({
                                type: "late-but-richer", source: p.name,
                                lengthRatio: Math.round(entry.responseLength / (audit.winner?.responseLength || 1) * 100),
                                recommendation: `${p.name} produced richer content (+${entry.responseLength - audit.winner.responseLength} chars). May be worth waiting.`,
                            });
                        }
                    }
                    return entry;
                })
                .catch(err => {
                    const latency = Date.now() - start;
                    this._recordFailure(p.name);
                    const entry = { source: p.name, status: "error", latency, error: err.message };
                    allResults.push(entry);
                    audit.errors = audit.errors || [];
                    audit.errors.push(entry);
                    return entry;
                });
        });

        // Wait for first success OR all to fail
        await new Promise(resolve => {
            let settled = 0;
            const total = promises.length;
            const checkDone = () => { if (++settled >= total || responded) resolve(); };

            for (const p of promises) p.then(checkDone).catch(checkDone);

            // Timeout safety
            setTimeout(() => resolve(), 30000);
        });

        // Continue capturing ALL responses in background — then persist for determinism
        Promise.allSettled(promises).then(() => {
            audit.results = allResults;
            audit.totalLatency = Date.now() - Date.parse(audit.ts);
            audit.allResponseCount = allResponses.length;
            this._appendAudit(audit);

            // ═══ DETERMINISM PROOF — Store ALL responses in vector memory ═══
            // Every provider response is evidence. Consensus = determinism.
            this._storeDeterminismEvidence(raceId, message, allResponses).catch(() => { });
        });

        if (winner) {
            this.stats.wins[winner.source] = (this.stats.wins[winner.source] || 0) + 1;
            return {
                ok: true, response: winner.response, engine: winner.engine,
                model: winner.model, _provider: winner._provider,
                _allResponses: allResponses, // expose for deep-research consumption
            };
        }

        return { ok: false, error: "all-providers-failed", audit };
    }

    /**
     * Store ALL race responses in vector memory as determinism evidence.
     * If 3+ providers agree, confidence is very high. Divergence is signal too.
     */
    async _storeDeterminismEvidence(raceId, question, allResponses) {
        if (!this._vectorMemory?.ingestMemory) return;
        const successResponses = allResponses.filter(r => r.response && r.response.length > 0);
        if (successResponses.length < 2) return; // need at least 2 for consensus

        const evidenceEntry = {
            content: question.substring(0, 2000),
            metadata: {
                type: "determinism_evidence",
                raceId,
                providerCount: successResponses.length,
                providers: successResponses.map(r => r.provider),
                responses: successResponses.map(r => ({
                    provider: r.provider,
                    model: r.model,
                    latency: r.latency,
                    isWinner: r.isWinner,
                    response: (r.response || "").substring(0, 3000),
                    responseLength: (r.response || "").length,
                })),
                timestamp: new Date().toISOString(),
                consensus: {
                    total: successResponses.length,
                    // Basic length-based agreement scoring — deeper NLP comparison in future
                    avgLength: Math.round(successResponses.reduce((s, r) => s + (r.response || "").length, 0) / successResponses.length),
                    lengthVariance: Math.round(this._variance(successResponses.map(r => (r.response || "").length))),
                },
            },
        };

        try {
            await this._vectorMemory.ingestMemory(evidenceEntry);
        } catch { /* best-effort persistence */ }
    }

    /** Calculate variance for consensus scoring */
    _variance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        return values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    }

    // ─── Sequential Routing (only when explicitly requested) ───────

    async _routeSequential(providers, message, opts, raceId) {
        for (const p of providers) {
            try {
                const start = Date.now();
                this._consumeRate(p.name);
                const result = await p.chat(message, opts.system, {
                    temperature: opts.temperature, max_tokens: opts.maxTokens,
                    history: opts.history,
                });
                const latency = Date.now() - start;
                this._recordSuccess(p.name, latency);
                this.stats.wins[p.name] = (this.stats.wins[p.name] || 0) + 1;

                return {
                    ok: true, response: result.response, engine: p.serviceGroup,
                    model: result.model, _provider: p,
                };
            } catch (err) {
                this._recordFailure(p.name);
                // Try next provider
            }
        }
        return { ok: false, error: "all-providers-failed" };
    }

    // ─── Provider Health Tracking ───────────────────────────────────

    _getAvailableProviders() {
        return this.providers.filter(p => {
            if (!p.enabled) return false;
            const health = this.healthState.get(p.name);
            // Circuit breaker: skip if 5+ consecutive failures in last 60s
            if (health && health.consecutiveFailures >= 5 &&
                (Date.now() - health.lastCheck) < 60000) return false;
            // Rate limit check
            const rate = this.rateLimits.get(p.name);
            if (rate && rate.currentRPM >= rate.rpm) return false;
            return true;
        });
    }

    _recordSuccess(name, latency) {
        const h = this.healthState.get(name);
        if (h) {
            h.healthy = true;
            h.consecutiveFailures = 0;
            h.lastCheck = Date.now();
            h.totalCalls++;
            h.avgLatency = Math.round((h.avgLatency * 0.8) + (latency * 0.2));
        }
    }

    _recordFailure(name) {
        const h = this.healthState.get(name);
        if (h) {
            h.consecutiveFailures++;
            h.totalErrors++;
            h.lastCheck = Date.now();
            if (h.consecutiveFailures >= 5) h.healthy = false;
        }
        this.stats.failures++;
    }

    // ─── Rate Limiting ──────────────────────────────────────────────

    _consumeRate(name) {
        const r = this.rateLimits.get(name);
        if (!r) return;
        // Reset window every 60s
        if (Date.now() - r.windowStart > 60000) {
            r.currentRPM = 0;
            r.currentTPM = 0;
            r.windowStart = Date.now();
        }
        r.currentRPM++;
    }

    // ─── Budget Management ──────────────────────────────────────────

    _checkBudgetReset() {
        const now = Date.now();
        if (now >= this.budget.resetAt.daily) {
            this.budget.spent.daily = 0;
            this.budget.resetAt.daily = this._nextReset("daily");
        }
        if (now >= this.budget.resetAt.monthly) {
            this.budget.spent.monthly = 0;
            this.budget.resetAt.monthly = this._nextReset("monthly");
        }
    }

    _nextReset(period) {
        const d = new Date();
        if (period === "daily") {
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
        } else {
            d.setMonth(d.getMonth() + 1, 1);
            d.setHours(0, 0, 0, 0);
        }
        return d.getTime();
    }

    _estimateCost(provider, input, output) {
        if (!provider?.pricing) return 0;
        const inputTokens = Math.ceil((input || "").length / 4);
        const outputTokens = Math.ceil((output || "").length / 4);
        return ((inputTokens / 1_000_000) * provider.pricing.inputPer1M) +
            ((outputTokens / 1_000_000) * provider.pricing.outputPer1M);
    }

    // ─── Response Cache ─────────────────────────────────────────────

    _cacheKey(message, system) {
        // Simple hash — good enough for dedup
        const str = `${system || ""}|${message || ""}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return `c${hash}`;
    }

    _checkCache(message, system) {
        const key = this._cacheKey(message, system);
        const entry = this.cache.get(key);
        if (entry && (Date.now() - entry.ts) < (entry.ttl || this.cacheTTL)) {
            return entry;
        }
        if (entry) this.cache.delete(key);
        return null;
    }

    _setCache(message, system, result) {
        if (this.cache.size >= this.cacheMaxSize) {
            // Evict oldest
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        const key = this._cacheKey(message, system);
        this.cache.set(key, {
            response: result.response, engine: result.engine,
            ts: Date.now(), ttl: this.cacheTTL,
        });
    }

    // ─── Priority Detection ─────────────────────────────────────────

    _detectPriority(message) {
        const m = (message || "").toLowerCase();
        const len = m.length;
        if (m.includes("architecture") || m.includes("security audit") ||
            m.includes("refactor") || m.includes("deploy") || len > 800) return "critical";
        if (m.includes("analyze") || m.includes("debug") || m.includes("optimize") ||
            m.includes("implement") || m.includes("review") || len > 300) return "high";
        if (len < 50 || m.includes("hello") || m.includes("status") ||
            m.includes("what is") || m.includes("who are")) return "low";
        return "medium";
    }

    // ─── Audit Log ──────────────────────────────────────────────────

    _appendAudit(entry) {
        this.auditLog.push(entry);
        if (this.auditLog.length > this.maxAuditEntries) {
            this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
        }
    }

    // ─── Semantic Deterministic Cache ─────────────────────────────────

    /**
     * Attach a vector memory instance for semantic caching.
     * @param {Object} vectorMem - must have queryMemory(query, topK, filter) and ingestMemory(entry)
     */
    setVectorMemory(vectorMem) {
        this._vectorMemory = vectorMem;
    }

    /**
     * Query 3D vector memory for a semantically similar past question.
     * If similarity > threshold AND the cached answer was proven by a race, return it.
     */
    async _checkSemanticCache(message) {
        if (!this._vectorMemory?.queryMemory) return null;

        const results = await this._vectorMemory.queryMemory(message, 1, { type: "gateway_proven" });
        if (results.length === 0) return null;

        const best = results[0];
        if (best.score >= this._semanticThreshold) {
            // Parse the stored answer from the content
            const stored = best.metadata || {};
            if (stored.response) {
                return {
                    response: stored.response,
                    similarity: +(best.score).toFixed(4),
                    originalQuestion: stored.originalQuestion || best.content?.substring(0, 200),
                    provenBy: stored.engine || "unknown",
                };
            }
        }
        return null;
    }

    /**
     * Store a race-proven answer in 3D vector memory for future semantic lookup.
     */
    async _storeSemanticCache(message, result) {
        if (!this._vectorMemory?.ingestMemory) return;

        await this._vectorMemory.ingestMemory({
            content: message.substring(0, 2000),
            metadata: {
                type: "gateway_proven",
                response: (result.response || "").substring(0, 3000),
                engine: result.engine,
                model: result.model,
                originalQuestion: message.substring(0, 500),
                provenAt: new Date().toISOString(),
                raceProviders: this.providers.filter(p => p.enabled !== false).map(p => p.name).length,
            },
        });
    }

    // ─── Public API ─────────────────────────────────────────────────

    /** Get gateway stats */
    getStats() {
        return {
            ...this.stats,
            providers: this.providers.map(p => ({
                name: p.name, serviceGroup: p.serviceGroup, enabled: p.enabled,
                priority: p.priority, capabilities: p.capabilities,
                health: this.healthState.get(p.name),
                rateUsage: this.rateLimits.get(p.name),
            })),
            budget: this.budget,
            cacheSize: this.cache.size,
            auditEntries: this.auditLog.length,
        };
    }

    /** Get recent audit entries */
    getAudit(limit = 20) {
        return this.auditLog.slice(-limit);
    }

    /** Get optimization recommendations based on audit data */
    getOptimizations() {
        const signals = [];
        const winRate = {};
        const avgLatency = {};

        for (const a of this.auditLog) {
            const w = a.winner?.source;
            if (w) {
                winRate[w] = (winRate[w] || 0) + 1;
                avgLatency[w] = avgLatency[w] ? [...avgLatency[w], a.winner.latency] : [a.winner.latency];
            }
        }

        // Find providers that never win
        for (const p of this.providers) {
            if (!winRate[p.name] && this.auditLog.length > 10) {
                signals.push({
                    type: "never-wins", provider: p.name,
                    recommendation: `${p.name} has never won a race. Consider lowering its priority or disabling it to save budget.`,
                });
            }
        }

        // Find providers with high latency
        for (const [name, latencies] of Object.entries(avgLatency)) {
            const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            if (avg > 10000) {
                signals.push({
                    type: "high-latency", provider: name, avgMs: Math.round(avg),
                    recommendation: `${name} avg ${Math.round(avg)}ms — very slow. Consider increasing timeout or lowering priority.`,
                });
            }
        }

        // Budget warning
        if (this.budget.spent.daily > this.budget.daily * 0.8) {
            signals.push({
                type: "budget-warning",
                recommendation: `${Math.round(this.budget.spent.daily / this.budget.daily * 100)}% of daily budget used. Reduce HCFP cycle frequency or switch to cheaper providers.`,
            });
        }

        return {
            signals, winRate, avgLatency: Object.fromEntries(
                Object.entries(avgLatency).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])
            )
        };
    }

    /** Embed text through the best available embedding provider */
    async embed(text, opts = {}) {
        const available = this.providers.filter(p => p.embed && p.enabled);
        for (const p of available) {
            try {
                const start = Date.now();
                const result = await p.embed(text, opts);
                this._recordSuccess(p.name, Date.now() - start);
                return { ok: true, ...result, engine: p.serviceGroup };
            } catch {
                this._recordFailure(p.name);
            }
        }
        return { ok: false, error: "no-embedding-provider-available" };
    }

    // ─── Intelligent Task Decomposition (Fan-Out / Fan-In) ──────────

    /**
     * Decompose a complex task into subtasks, fan out across ALL available
     * nodes in parallel, and intelligently merge results.
     *
     * Example: "Build a landing page" →
     *   Subtask 1 → Claude: "Design the hero section HTML/CSS"
     *   Subtask 2 → Gemini: "Write the features grid component"
     *   Subtask 3 → OpenAI: "Create the footer and CTA"
     *   Subtask 4 → HuggingFace: "Generate compelling copy for each section"
     *   ... all in parallel, merged into final output.
     *
     * @param {string} task - The complex task description
     * @param {Object} [opts]
     * @param {string} [opts.system] - System prompt for all subtasks
     * @param {number} [opts.maxSubtasks] - Max subtasks to create (default: available providers)
     * @param {string} [opts.mergeStrategy] - "concat" | "synthesize" | "best" (default: "synthesize")
     * @param {number} [opts.temperature]
     * @returns {Object} { ok, response, subtasks, merge, latency }
     */
    async decompose(task, opts = {}) {
        this.stats.totalRequests++;
        const decompId = `decomp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const startTs = Date.now();
        const available = this._getAvailableProviders();

        if (available.length === 0) {
            return { ok: false, error: "no-providers-available" };
        }

        const maxSubtasks = opts.maxSubtasks || Math.min(available.length, 9);
        const mergeStrategy = opts.mergeStrategy || "synthesize";

        // Step 1: Use the best provider to decompose the task
        const decomposer = available[0]; // Highest priority = best reasoning
        let subtaskDefs;
        try {
            const decompPrompt = [
                `You are a task decomposition engine. Split this complex task into ${maxSubtasks} independent subtasks.`,
                `Each subtask should be self-contained and parallelizable.`,
                `Return ONLY a JSON array of objects: [{ "id": 1, "task": "subtask description", "skill": "reasoning|code|creative|analysis" }]`,
                `No explanation, just the JSON array.`,
                ``,
                `TASK: ${task}`,
            ].join("\n");

            const decompResult = await decomposer.chat(decompPrompt, null, { temperature: 0.3, max_tokens: 1024 });
            subtaskDefs = this._parseSubtasks(decompResult.response, maxSubtasks, task);
        } catch {
            // Fallback: split by sentence or generate generic subtasks
            subtaskDefs = this._fallbackSplit(task, maxSubtasks);
        }

        // Step 2: Assign subtasks to providers (round-robin across all available)
        const assignments = subtaskDefs.map((st, i) => ({
            ...st,
            provider: available[i % available.length],
        }));

        // Step 3: Fan out — execute ALL subtasks in parallel across different providers
        const subtaskResults = await Promise.allSettled(
            assignments.map(async (a) => {
                const start = Date.now();
                try {
                    this._consumeRate(a.provider.name);
                    const result = await a.provider.chat(
                        `${opts.system ? opts.system + "\n\n" : ""}${a.task}`,
                        null,
                        { temperature: opts.temperature || 0.7, max_tokens: opts.maxTokens || 2048 },
                    );
                    const latency = Date.now() - start;
                    this._recordSuccess(a.provider.name, latency);
                    return {
                        id: a.id, task: a.task, skill: a.skill,
                        provider: a.provider.name, engine: a.provider.serviceGroup,
                        response: result.response, model: result.model,
                        latency, status: "ok",
                    };
                } catch (err) {
                    this._recordFailure(a.provider.name);
                    return {
                        id: a.id, task: a.task, provider: a.provider.name,
                        error: err.message, latency: Date.now() - start, status: "error",
                    };
                }
            })
        );

        const completed = subtaskResults
            .filter(r => r.status === "fulfilled" && r.value.status === "ok")
            .map(r => r.value);
        const failed = subtaskResults
            .filter(r => r.status === "rejected" || r.value?.status === "error")
            .map(r => r.value || { error: r.reason?.message });

        if (completed.length === 0) {
            return { ok: false, error: "all-subtasks-failed", failed };
        }

        // Step 4: Merge results
        let merged;
        if (mergeStrategy === "concat") {
            merged = completed.map(c => `## ${c.task}\n${c.response}`).join("\n\n---\n\n");
        } else if (mergeStrategy === "best") {
            // Pick the longest/richest response
            completed.sort((a, b) => (b.response || "").length - (a.response || "").length);
            merged = completed[0].response;
        } else {
            // "synthesize" — use a provider to merge all subtask outputs
            merged = await this._synthesizeMerge(task, completed, available);
        }

        // Track costs for all subtask calls
        for (const c of completed) {
            const p = this.providers.find(pr => pr.name === c.provider);
            if (p) {
                const cost = this._estimateCost(p, c.task, c.response);
                this.budget.spent.daily += cost;
                this.budget.spent.monthly += cost;
            }
        }

        const totalLatency = Date.now() - startTs;

        // Audit
        this._appendAudit({
            type: "decompose", decompId, ts: new Date().toISOString(),
            task: (task || "").substring(0, 200),
            subtasks: completed.length, failed: failed.length,
            providers: [...new Set(completed.map(c => c.provider))],
            totalLatency,
        });

        return {
            ok: true,
            response: merged,
            decomposition: {
                id: decompId,
                subtasks: completed.map(c => ({
                    id: c.id, task: c.task, provider: c.provider,
                    engine: c.engine, latency: c.latency,
                    responseLength: (c.response || "").length,
                })),
                failed: failed.length,
                totalSubtasks: subtaskDefs.length,
                mergeStrategy,
                providersUsed: [...new Set(completed.map(c => c.provider))],
            },
            latency: totalLatency,
        };
    }

    /** Parse AI-generated subtask JSON */
    _parseSubtasks(raw, max, originalTask) {
        try {
            // Extract JSON from response (may be wrapped in markdown code blocks)
            const jsonMatch = (raw || "").match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.slice(0, max).map((st, i) => ({
                        id: st.id || i + 1,
                        task: st.task || st.description || `Subtask ${i + 1}`,
                        skill: st.skill || "general",
                    }));
                }
            }
        } catch { /* fall through */ }
        return this._fallbackSplit(originalTask, max);
    }

    /** Fallback task splitting when AI decomposition fails */
    _fallbackSplit(task, max) {
        const parts = (task || "").split(/[.;]\s+/).filter(s => s.length > 10);
        if (parts.length >= 2) {
            return parts.slice(0, max).map((p, i) => ({
                id: i + 1, task: p.trim(), skill: "general",
            }));
        }
        // Can't split meaningfully — create aspect-based subtasks
        return [
            { id: 1, task: `Analyze and plan: ${task}`, skill: "analysis" },
            { id: 2, task: `Implement the core logic: ${task}`, skill: "code" },
            { id: 3, task: `Review, optimize, and document: ${task}`, skill: "reasoning" },
        ].slice(0, max);
    }

    /** Synthesize merged output from all subtask results */
    async _synthesizeMerge(originalTask, completed, providers) {
        const mergePrompt = [
            `You are merging outputs from ${completed.length} parallel AI agents that each handled a subtask of a larger task.`,
            `Synthesize them into ONE cohesive, high-quality response. Remove redundancy, keep the best parts.`,
            ``,
            `ORIGINAL TASK: ${originalTask}`,
            ``,
            ...completed.map(c => `--- SUBTASK: ${c.task} ---\n${(c.response || "").substring(0, 1500)}\n`),
            ``,
            `SYNTHESIZED RESPONSE:`,
        ].join("\n");

        // Use the fastest available provider for merge
        const merger = providers.find(p => p.enabled) || providers[0];
        try {
            const result = await merger.chat(mergePrompt, null, { temperature: 0.3, max_tokens: 4096 });
            return result.response;
        } catch {
            // Fallback: concat
            return completed.map(c => `## ${c.task}\n${c.response}`).join("\n\n---\n\n");
        }
    }
}

module.exports = HeadyGateway;

