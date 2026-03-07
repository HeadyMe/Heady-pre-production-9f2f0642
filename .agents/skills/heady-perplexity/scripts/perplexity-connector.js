/**
 * Heady™ Perplexity Enterprise Max Custom Connector
 * 
 * Drop-in module for direct Perplexity API access from any Node.js service.
 * Supports all Sonar models, search/embed APIs, streaming, and citations.
 * 
 * Usage:
 *   const pplx = require('./perplexity-connector');
 *   const result = await pplx.search('query');
 *   const deep = await pplx.deepResearch('topic');
 *   const vectors = await pplx.embed(['text1', 'text2']);
 */

const API_KEY = process.env.PERPLEXITY_API_KEY;
const BASE_URL = 'https://api.perplexity.ai';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
};

/**
 * Chat Completions — core Sonar search endpoint
 * @param {string} query - The search query
 * @param {object} options - Model, recency, domains, temperature
 * @returns {Promise<object>} Response with answer, citations, related questions
 */
async function search(query, options = {}) {
    const body = {
        model: options.model || 'sonar-pro',
        messages: [
            { role: 'system', content: options.system || 'Be precise, cite all sources with URLs.' },
            { role: 'user', content: query },
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.2,
        return_citations: true,
        return_related_questions: options.relatedQuestions ?? true,
        return_images: options.images ?? false,
    };

    if (options.recency) body.search_recency_filter = options.recency;
    if (options.domains) body.search_domain_filter = options.domains;
    if (options.stream) body.stream = true;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Perplexity API ${response.status}: ${err}`);
    }

    return response.json();
}

/**
 * Deep Research — exhaustive expert-level research
 * @param {string} topic - Research topic
 * @param {object} options - Recency filter, domain filter
 * @returns {Promise<object>} Comprehensive research report with citations
 */
async function deepResearch(topic, options = {}) {
    return search(topic, {
        ...options,
        model: 'sonar-deep-research',
        system: options.system || 'Conduct exhaustive research. Provide a comprehensive report with all sources cited.',
        maxTokens: options.maxTokens || 8192,
    });
}

/**
 * Reasoning — Chain of Thought analysis
 * @param {string} problem - The problem to reason about
 * @param {object} options - Additional options
 * @returns {Promise<object>} Step-by-step reasoning with citations
 */
async function reason(problem, options = {}) {
    return search(problem, {
        ...options,
        model: 'sonar-reasoning-pro',
        system: options.system || 'Think step by step. Show your reasoning chain clearly.',
    });
}

/**
 * Embeddings — generate vector embeddings
 * @param {string|string[]} input - Text(s) to embed
 * @param {object} options - Model selection
 * @returns {Promise<object>} Embedding vectors
 */
async function embed(input, options = {}) {
    const body = {
        model: options.model || 'pplx-embed-v1',
        input: Array.isArray(input) ? input : [input],
    };

    const response = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Perplexity Embed API ${response.status}: ${err}`);
    }

    return response.json();
}

/**
 * Multi-turn conversation with Sonar
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {object} options - Model, recency, etc.
 * @returns {Promise<object>} Response
 */
async function chat(messages, options = {}) {
    const body = {
        model: options.model || 'sonar-pro',
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.2,
        return_citations: true,
    };

    if (options.recency) body.search_recency_filter = options.recency;
    if (options.domains) body.search_domain_filter = options.domains;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Perplexity API ${response.status}: ${err}`);
    }

    return response.json();
}

module.exports = {
    search,
    deepResearch,
    reason,
    embed,
    chat,
    // Convenience aliases
    sonar: (q, opts) => search(q, { ...opts, model: 'sonar' }),
    sonarPro: (q, opts) => search(q, { ...opts, model: 'sonar-pro' }),
    sonarReasoning: (q, opts) => search(q, { ...opts, model: 'sonar-reasoning-pro' }),
};
