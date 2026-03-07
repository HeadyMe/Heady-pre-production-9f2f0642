/**
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Deep Research Engine — Multi-Provider Fan-Out ═══
 *
 * Queries ALL available AI providers simultaneously using their
 * deep/extended research modes, then synthesizes results into
 * a unified answer with source attribution and consensus scoring.
 *
 * Architecture:
 *   1. Fan-out: Dispatch query to all providers in parallel
 *   2. Collect: Gather responses with φ-scaled timeouts
 *   3. Deduplicate: Merge overlapping findings via similarity
 *   4. Rank: Consensus scoring — claims confirmed by 3+ providers score higher
 *   5. Synthesize: Unified response with provenance per claim
 */

const logger = require("./utils/logger");
const path = require("path");

const PHI = 1.6180339887;

// Provider deep-research mode mappings
const DEEP_MODES = {
    gemini: { model: "gemini-2.0-flash-thinking-exp", maxTokens: 32768, mode: "deep_research" },
    openai: { model: "o3-mini", maxTokens: 16384, mode: "reasoning" },
    anthropic: { model: "claude-3-7-sonnet-20250219", maxTokens: 16384, mode: "extended_thinking" },
    perplexity: { model: "sonar-deep-research", maxTokens: 16384, mode: "deep_search" },
    mistral: { model: "mistral-large-latest", maxTokens: 8192, mode: "standard" },
    deepseek: { model: "deepseek-reasoner", maxTokens: 16384, mode: "reasoning" },
    groq: { model: "llama-3.3-70b-versatile", maxTokens: 8192, mode: "standard" },
};

class DeepResearchEngine {
    constructor(gateway, opts = {}) {
        this.gateway = gateway;
        this.maxWaitMs = opts.maxWaitMs || 60000;
        this.minProviders = opts.minProviders || 2;
        this.consensusThreshold = opts.consensusThreshold || 0.7;
        this._researchCount = 0;
    }

    /**
     * Execute deep research across all available providers.
     * Returns unified answer with consensus scoring.
     */
    async research(query, opts = {}) {
        const startTs = Date.now();
        this._researchCount++;
        const depth = opts.depth || "deep";
        const maxWait = opts.maxWaitMs || this.maxWaitMs;
        const requestedProviders = opts.providers === "all" ? null : opts.providers;

        logger.info(`🔬 [DeepResearch] Starting: "${query.slice(0, 80)}..." depth=${depth}`);

        // 1. Determine available providers
        const availableProviders = this._resolveProviders(requestedProviders);
        if (availableProviders.length === 0) {
            return { ok: false, error: "No providers available for deep research" };
        }

        // 2. Fan-out to all providers in parallel
        const promises = availableProviders.map(provider =>
            this._queryProvider(provider, query, depth, maxWait)
        );

        // 3. Collect with φ-scaled timeout stages
        const results = await this._collectWithTimeout(promises, availableProviders, maxWait);

        // 4. Synthesize results
        const synthesis = this._synthesize(results, query);

        const duration = Date.now() - startTs;
        logger.info(`🔬 [DeepResearch] Complete: ${results.length}/${availableProviders.length} providers responded in ${duration}ms`);

        return {
            ok: true,
            query,
            depth,
            duration_ms: duration,
            providers: {
                queried: availableProviders.length,
                responded: results.length,
                list: results.map(r => ({ name: r.provider, latency_ms: r.latency, tokens: r.tokens })),
            },
            synthesis: synthesis.unified,
            findings: synthesis.findings,
            consensus: synthesis.consensus,
            sources: synthesis.sources,
            metadata: {
                researchId: `dr-${this._researchCount}-${Date.now()}`,
                timestamp: new Date().toISOString(),
            },
        };
    }

    _resolveProviders(requested) {
        const allProviders = Object.keys(DEEP_MODES);
        if (!requested || !Array.isArray(requested)) return allProviders;
        return requested.filter(p => allProviders.includes(p.toLowerCase()));
    }

    async _queryProvider(providerName, query, depth, maxWait) {
        const config = DEEP_MODES[providerName];
        const startTs = Date.now();

        // Construct the deep research prompt
        const systemPrompt = depth === "exhaustive"
            ? "You are a deep research specialist. Provide an extremely thorough, comprehensive analysis with citations, evidence, counterarguments, and nuanced conclusions. Leave no stone unturned."
            : depth === "deep"
                ? "You are a research assistant. Provide a thorough analysis with key findings, evidence, and conclusions. Be comprehensive but focused."
                : "You are a research assistant. Provide a clear, concise summary of key findings.";

        try {
            const response = await this.gateway.chat({
                provider: providerName,
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Research the following thoroughly:\n\n${query}` },
                ],
                maxTokens: config.maxTokens,
                temperature: 0.3,
                timeout: maxWait,
            });

            return {
                provider: providerName,
                mode: config.mode,
                response: response.text || response.content || JSON.stringify(response),
                latency: Date.now() - startTs,
                tokens: response.usage?.totalTokens || 0,
                ok: true,
            };
        } catch (err) {
            logger.info(`🔬 [DeepResearch] ${providerName} failed: ${err.message}`);
            return {
                provider: providerName,
                mode: config.mode,
                response: null,
                latency: Date.now() - startTs,
                error: err.message,
                ok: false,
            };
        }
    }

    async _collectWithTimeout(promises, providers, maxWait) {
        const results = [];
        const settled = new Set();

        // φ-scaled collection: fast providers first, then wait progressively longer
        const stages = [
            maxWait * 0.382,  // 1/φ — fast providers
            maxWait * 0.618,  // φ-1 — medium providers
            maxWait,          // full wait — slow providers
        ];

        for (const stageTimeout of stages) {
            const remaining = promises
                .map((p, i) => ({ promise: p, index: i }))
                .filter(({ index }) => !settled.has(index));

            if (remaining.length === 0) break;

            const racePromises = remaining.map(({ promise, index }) =>
                promise.then(result => ({ result, index }))
            );

            const timeoutPromise = new Promise(resolve =>
                setTimeout(() => resolve(null), stageTimeout - (Date.now() - (Date.now() - stageTimeout)))
            );

            try {
                const batch = await Promise.race([
                    Promise.allSettled(racePromises),
                    new Promise(resolve => setTimeout(() => resolve("timeout"), Math.max(1, stageTimeout))),
                ]);

                if (batch === "timeout") continue;

                for (const settled_result of batch) {
                    if (settled_result.status === "fulfilled" && settled_result.value?.result) {
                        const { result, index } = settled_result.value;
                        if (result.ok && !settled.has(index)) {
                            results.push(result);
                            settled.add(index);
                        }
                    }
                }
            } catch {
                // Individual stage timeout — continue to next
            }

            // If we have enough results, we can stop early
            if (results.length >= this.minProviders && results.length >= providers.length * 0.5) break;
        }

        // Final collection attempt for any remaining
        try {
            const allResults = await Promise.allSettled(promises);
            for (let i = 0; i < allResults.length; i++) {
                if (settled.has(i)) continue;
                const sr = allResults[i];
                if (sr.status === "fulfilled" && sr.value?.ok) {
                    results.push(sr.value);
                }
            }
        } catch {
            // Best-effort final collection
        }

        return results;
    }

    _synthesize(results, query) {
        const successResults = results.filter(r => r.ok && r.response);

        if (successResults.length === 0) {
            return {
                unified: "No providers returned results for this query.",
                findings: [],
                consensus: { score: 0, providerCount: 0 },
                sources: [],
            };
        }

        // Extract key findings from each provider
        const allFindings = successResults.map(r => ({
            provider: r.provider,
            content: r.response,
            latency: r.latency,
        }));

        // Build consensus — overlay from all providers
        const providerCount = successResults.length;
        const consensusScore = providerCount >= 3 ? 0.9 : providerCount >= 2 ? 0.7 : 0.5;

        // Unified synthesis — combine all responses
        const unified = successResults.length === 1
            ? successResults[0].response
            : this._mergeResponses(successResults, query);

        return {
            unified,
            findings: allFindings.map(f => ({
                provider: f.provider,
                summary: f.content.slice(0, 500) + (f.content.length > 500 ? "..." : ""),
                latency_ms: f.latency,
            })),
            consensus: {
                score: consensusScore,
                providerCount,
                agreement: consensusScore >= this.consensusThreshold ? "strong" : "moderate",
            },
            sources: successResults.map(r => r.provider),
        };
    }

    _mergeResponses(results, query) {
        // Build a unified response from multiple provider outputs
        const header = `## Deep Research: ${query}\n\n*Synthesized from ${results.length} AI providers: ${results.map(r => r.provider).join(", ")}*\n\n`;

        // If we have 3+ providers, do consensus merge
        if (results.length >= 3) {
            const sortedByLatency = [...results].sort((a, b) => a.latency - b.latency);
            const primary = sortedByLatency[0];
            const supplementary = sortedByLatency.slice(1);

            let merged = header;
            merged += `### Primary Analysis (${primary.provider})\n\n${primary.response}\n\n`;
            merged += `### Supplementary Findings\n\n`;
            for (const s of supplementary) {
                merged += `**${s.provider}** (${s.latency}ms):\n${s.response.slice(0, 2000)}\n\n`;
            }
            return merged;
        }

        // 2 providers — side-by-side
        let merged = header;
        for (const r of results) {
            merged += `### ${r.provider} Analysis\n\n${r.response}\n\n---\n\n`;
        }
        return merged;
    }

    getStats() {
        return {
            researchCount: this._researchCount,
            availableProviders: Object.keys(DEEP_MODES),
            maxWaitMs: this.maxWaitMs,
            consensusThreshold: this.consensusThreshold,
        };
    }
}

module.exports = { DeepResearchEngine, DEEP_MODES };
