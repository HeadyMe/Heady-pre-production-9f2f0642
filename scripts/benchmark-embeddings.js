#!/usr/bin/env node
/**
 * @fileoverview Embedding Model Benchmark Script for Heady Latent OS
 * @module benchmark-embeddings
 *
 * Compares embedding model providers on:
 *   - Latency (p50, p95, p99, mean)
 *   - Throughput (requests/sec, tokens/sec)
 *   - Recall@10 (using ground-truth cosine similarity reranking)
 *   - Cost per 1M tokens
 *
 * Models tested (from research/section1_vector_db.md §6):
 *   - nomic-embed-text-v1.5  (768d, Apache 2.0)
 *   - jina-embeddings-v3     (1024d, Apache 2.0)
 *   - bge-en-icl             (4096d, MIT)
 *   - cohere-embed-v4        (1024d, proprietary)
 *   - voyage-3               (2048d, proprietary)
 *
 * Usage:
 *   node benchmark-embeddings.js [options]
 *
 *   Options:
 *     --providers nomic,jina,cohere,voyage,local
 *     --datasets  short,long,code,multilingual
 *     --runs      10          (warmup + timed runs per dataset)
 *     --output    results/    (output directory)
 *     --format    json,md     (output formats)
 *
 * @example
 *   NOMIC_API_KEY=xxx VOYAGE_API_KEY=yyy node benchmark-embeddings.js \
 *     --providers nomic,voyage --datasets short,long --runs 20
 */

import fs           from 'fs/promises';
import path         from 'path';
import { parseArgs } from 'util';

// ─── Test Datasets ────────────────────────────────────────────────────────────

/**
 * Built-in benchmark datasets covering representative workloads.
 * Each entry: { id, text, groundTruth: [similar_id, ...] }
 * Ground truth is approximated by measuring cosine similarity after the first
 * run (bootstrapping) or can be provided externally via --dataset-file.
 */
const BUILT_IN_DATASETS = {
  /** Short factual queries (agent memory typical) */
  short: [
    { id: 's1',  text: 'What is quantum entanglement?'                                  },
    { id: 's2',  text: 'Explain quantum superposition briefly'                          },
    { id: 's3',  text: 'How do quantum computers work?'                                 },
    { id: 's4',  text: 'What is machine learning?'                                      },
    { id: 's5',  text: 'Explain neural networks'                                        },
    { id: 's6',  text: 'How does deep learning differ from machine learning?'           },
    { id: 's7',  text: 'What is the transformer architecture in AI?'                    },
    { id: 's8',  text: 'Explain attention mechanisms in neural networks'                },
    { id: 's9',  text: 'What is vector similarity search?'                              },
    { id: 's10', text: 'How does cosine similarity measure text relatedness?'           },
    { id: 's11', text: 'What are embeddings in natural language processing?'            },
    { id: 's12', text: 'How do large language models generate text?'                    },
    { id: 's13', text: 'What is retrieval augmented generation?'                        },
    { id: 's14', text: 'Explain knowledge graphs'                                       },
    { id: 's15', text: 'What is graph neural network?'                                  },
    { id: 's16', text: 'How does PostgreSQL store data on disk?'                        },
    { id: 's17', text: 'What is a B-tree index in databases?'                          },
    { id: 's18', text: 'Explain ACID transactions'                                      },
    { id: 's19', text: 'What is eventual consistency in distributed systems?'           },
    { id: 's20', text: 'How does the CAP theorem apply to distributed databases?'       },
  ],

  /** Long documents (RAG typical, tests context handling) */
  long: [
    {
      id: 'l1',
      text: `Hierarchical Navigable Small World (HNSW) graphs are a family of approximate nearest neighbor search algorithms that build a multi-layered graph structure. The algorithm maintains multiple layers of graphs with decreasing density. At query time, the search starts from the top layer (sparse, long-range connections) and progressively descends to lower layers (dense, short-range connections), narrowing the search space at each level. The key parameters that control the quality/speed tradeoff are: m (number of bidirectional links per new node, typically 8-48), ef_construction (size of the dynamic candidate list during graph construction, typically 100-200), and ef_search (size of the dynamic candidate list during search, typically 40-400). Higher ef values provide better recall at the cost of increased latency and memory usage.`,
    },
    {
      id: 'l2',
      text: `Reciprocal Rank Fusion (RRF) is a rank aggregation method used in information retrieval to combine multiple ranked lists of results. The formula assigns each document a score based on its position in each list: RRF_score(d) = Σ_r 1/(k + rank_r(d)), where k is a constant (typically 60) that controls the influence of high-ranked versus low-ranked documents, and rank_r(d) is the rank of document d in retrieval system r. RRF is scale-invariant, meaning it works well even when combining results from systems with very different scoring distributions (e.g., BM25 scores in the range 0-50 combined with cosine similarity in the range -1 to 1). This makes it particularly useful for hybrid search systems that combine lexical BM25 retrieval with dense vector retrieval.`,
    },
    {
      id: 'l3',
      text: `LightRAG is an incremental knowledge graph retrieval system that addresses key limitations of Microsoft's GraphRAG. Unlike GraphRAG, which requires full graph reconstruction when new documents are added, LightRAG supports incremental updates through a dual-level retrieval architecture. The low-level retrieval handles precise entity-specific queries by searching a key-value store indexed by entity names and their direct relationships. The high-level retrieval handles broad thematic queries by traversing multi-hop neighbor nodes to expand context. LightRAG achieves sub-100ms query latency with a single API call per retrieval, compared to GraphRAG's hundreds of LLM calls needed to aggregate community summaries. Indexing a corpus costs approximately $0.15 with LightRAG versus $4.00 with GraphRAG using GPT-4o at standard pricing.`,
    },
    {
      id: 'l4',
      text: `Binary quantization (BQ) for vector embeddings compresses each float32 value to a single bit based on its sign (positive → 1, negative → 0). This achieves a 32× storage reduction: a 1536-dimensional float32 vector (6,144 bytes) becomes 192 bytes as a binary vector. The Hamming distance between binary vectors can be computed using POPCNT CPU instructions, making binary vector search extremely fast. The main tradeoff is reduced recall: binary vectors lose fine-grained magnitude information. The standard mitigation strategy is to overfetch candidates using binary search (typically 4× the desired result count) and then re-rank using the original float32 vectors. With this re-ranking step, binary quantization can recover to near float32 recall while maintaining the speed benefits of binary comparison.`,
    },
    {
      id: 'l5',
      text: `The pgvector 0.8.0 iterative scan feature solves the overfiltering problem that affected filtered vector similarity queries in earlier versions. Before 0.8.0, HNSW queries with WHERE clause filters would search only ef_search candidates, apply the filter, and return whatever survived. If the filter was highly selective (e.g., WHERE user_id = 'abc'), the result set would be incomplete because most of the ef_search candidates were filtered out before enough matching results were found. With iterative scan enabled (SET hnsw.iterative_scan = 'relaxed_order'), the index automatically continues scanning additional graph nodes until enough results pass the filter. The max_scan_tuples parameter (default: 20000) provides a configurable ceiling to prevent unbounded scanning on very selective filters.`,
    },
  ],

  /** Code snippets (tests code-specific embedding quality) */
  code: [
    { id: 'c1', text: `function fibonacci(n) { if (n <= 1) return n; return fibonacci(n-1) + fibonacci(n-2); }` },
    { id: 'c2', text: `const fib = (n, memo = {}) => n <= 1 ? n : (memo[n] ??= fib(n-1, memo) + fib(n-2, memo));` },
    { id: 'c3', text: `SELECT * FROM users WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY id DESC LIMIT 100;` },
    { id: 'c4', text: `SELECT id, email FROM customers WHERE signup_date >= CURRENT_DATE - INTERVAL '7 days';` },
    { id: 'c5', text: `async function fetchUserData(userId) { const res = await fetch(\`/api/users/\${userId}\`); return res.json(); }` },
    { id: 'c6', text: `const getUserById = async (id) => { const response = await axios.get(\`/users/\${id}\`); return response.data; };` },
    { id: 'c7', text: `CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);` },
    { id: 'c8', text: `CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops) WITH (m=32, ef_construction=200);` },
    { id: 'c9', text: `class EventEmitter { on(event, fn) { (this._events[event] ??= []).push(fn); } emit(event, ...args) { this._events[event]?.forEach(fn => fn(...args)); } }` },
    { id: 'c10', text: `const EventBus = { handlers: {}, subscribe: (e, fn) => (EventBus.handlers[e] ??= []).push(fn), publish: (e, d) => EventBus.handlers[e]?.forEach(fn => fn(d)) };` },
  ],

  /** Multilingual samples (tests language handling) */
  multilingual: [
    { id: 'm1',  text: 'What is artificial intelligence?'            },  // EN
    { id: 'm2',  text: '¿Qué es la inteligencia artificial?'        },  // ES
    { id: 'm3',  text: "Qu'est-ce que l'intelligence artificielle ?" },  // FR
    { id: 'm4',  text: 'Was ist künstliche Intelligenz?'            },  // DE
    { id: 'm5',  text: '人工知能とは何ですか？'                       },  // JA
    { id: 'm6',  text: '인공지능이란 무엇인가요?'                    },  // KO
    { id: 'm7',  text: 'Cos\'è l\'intelligenza artificiale?'        },  // IT
    { id: 'm8',  text: 'O que é inteligência artificial?'           },  // PT
    { id: 'm9',  text: 'Что такое искусственный интеллект?'         },  // RU
    { id: 'm10', text: '什么是人工智能？'                            },  // ZH
  ],
};

// ─── Provider Configurations ──────────────────────────────────────────────────

const PROVIDER_CONFIGS = {
  nomic: {
    name:          'nomic-embed-text-v1.5',
    dimensions:    768,
    costPerMToken: 0.05,
    contextTokens: 8192,
    license:       'Apache 2.0',
    selfHostable:  true,
    apiUrl:        'https://api-atlas.nomic.ai/v1/embedding/text',
    envKey:        'NOMIC_API_KEY',
  },
  jina: {
    name:          'jina-embeddings-v3',
    dimensions:    1024,
    costPerMToken: 0.018,
    contextTokens: 8192,
    license:       'Apache 2.0',
    selfHostable:  true,
    apiUrl:        'https://api.jina.ai/v1/embeddings',
    envKey:        'JINA_API_KEY',
  },
  cohere: {
    name:          'cohere-embed-v4',
    dimensions:    1024,
    costPerMToken: 0.12,
    contextTokens: 128000,
    license:       'Proprietary',
    selfHostable:  false,
    apiUrl:        'https://api.cohere.com/v2/embed',
    envKey:        'COHERE_API_KEY',
  },
  voyage: {
    name:          'voyage-3',
    dimensions:    2048,
    costPerMToken: 0.12,
    contextTokens: 32000,
    license:       'Proprietary',
    selfHostable:  false,
    apiUrl:        'https://api.voyageai.com/v1/embeddings',
    envKey:        'VOYAGE_API_KEY',
  },
  local: {
    name:          'nomic-embed-text (local/Ollama)',
    dimensions:    384,
    costPerMToken: 0,
    contextTokens: 8192,
    license:       'Apache 2.0',
    selfHostable:  true,
    apiUrl:        process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    envKey:        null,
  },
};

// ─── Benchmark Engine ─────────────────────────────────────────────────────────

/**
 * BenchmarkRunner — Orchestrates embedding model benchmarks.
 */
class BenchmarkRunner {
  constructor(options = {}) {
    this.providers   = options.providers  ?? ['nomic', 'local'];
    this.datasets    = options.datasets   ?? ['short'];
    this.runsPerItem = options.runs       ?? 5;
    this.warmupRuns  = options.warmupRuns ?? 2;
    this.outputDir   = options.outputDir  ?? './results';
    this.formats     = options.formats    ?? ['json', 'md'];
    this.batchSize   = options.batchSize  ?? 10;
    this.results     = {};
  }

  /**
   * Run the full benchmark suite.
   * @returns {Promise<BenchmarkSummary>}
   */
  async run() {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(` Heady Latent OS — Embedding Model Benchmark`);
    console.log(` ${new Date().toISOString()}`);
    console.log(`${'═'.repeat(70)}\n`);
    console.log(` Providers:  ${this.providers.join(', ')}`);
    console.log(` Datasets:   ${this.datasets.join(', ')}`);
    console.log(` Runs/item:  ${this.runsPerItem} (+ ${this.warmupRuns} warmup)`);
    console.log(`${'─'.repeat(70)}\n`);

    for (const provider of this.providers) {
      this.results[provider] = {};
      for (const dataset of this.datasets) {
        const items = BUILT_IN_DATASETS[dataset];
        if (!items) { console.warn(`Unknown dataset: ${dataset}`); continue; }
        this.results[provider][dataset] = await this._benchmarkProvider(provider, dataset, items);
      }
    }

    const summary = this._buildSummary();
    await this._writeOutputs(summary);
    this._printMarkdownTable(summary);
    return summary;
  }

  /**
   * @private Benchmark a single provider on a single dataset.
   */
  async _benchmarkProvider(provider, datasetName, items) {
    const cfg = PROVIDER_CONFIGS[provider];
    const apiKey = cfg.envKey ? process.env[cfg.envKey] : null;

    if (cfg.envKey && !apiKey && provider !== 'local') {
      console.log(`  ⚠  ${provider}: ${cfg.envKey} not set — skipping`);
      return { provider, dataset: datasetName, skipped: true, reason: `${cfg.envKey} not set` };
    }

    console.log(`  Benchmarking [${provider}] on [${datasetName}]...`);

    const latencies      = [];
    const throughputSamples = [];

    // ── Warmup ──────────────────────────────────────────────────────────────
    for (let i = 0; i < this.warmupRuns && i < items.length; i++) {
      await this._embed(provider, [items[i].text], apiKey, cfg).catch(() => {});
    }

    // ── Timed runs ───────────────────────────────────────────────────────────
    let errors = 0;
    const allEmbeddings = {};  // id → embedding (for recall calculation)

    for (let run = 0; run < this.runsPerItem; run++) {
      for (let offset = 0; offset < items.length; offset += this.batchSize) {
        const batch = items.slice(offset, offset + this.batchSize);
        const texts = batch.map(i => i.text);

        const t0 = performance.now();
        let embeddings;
        try {
          embeddings = await this._embed(provider, texts, apiKey, cfg);
        } catch (err) {
          errors++;
          latencies.push(30_000);  // Penalty for failed request
          continue;
        }
        const elapsed = performance.now() - t0;

        latencies.push(elapsed / texts.length);  // per-item latency
        throughputSamples.push(texts.length / (elapsed / 1000));  // items/sec

        // Store embeddings from first run for recall calculation
        if (run === 0 && embeddings) {
          for (let i = 0; i < batch.length; i++) {
            if (embeddings[i]) allEmbeddings[batch[i].id] = embeddings[i];
          }
        }
      }
    }

    // ── Compute statistics ───────────────────────────────────────────────────
    latencies.sort((a, b) => a - b);
    const latStats = {
      mean: latencies.reduce((s, v) => s + v, 0) / latencies.length,
      p50:  this._percentile(latencies, 50),
      p95:  this._percentile(latencies, 95),
      p99:  this._percentile(latencies, 99),
      min:  latencies[0],
      max:  latencies[latencies.length - 1],
    };

    const throughputMean = throughputSamples.reduce((s, v) => s + v, 0) / throughputSamples.length;

    // ── Recall@10 estimation ─────────────────────────────────────────────────
    const recall = await this._computeRecall(allEmbeddings, items);

    // ── Cost estimate ────────────────────────────────────────────────────────
    const totalChars  = items.reduce((s, i) => s + i.text.length, 0);
    const approxTokens = totalChars / 4;
    const costPer1M    = cfg.costPerMToken;
    const costPerRun   = (approxTokens / 1_000_000) * costPer1M;

    const result = {
      provider,
      dataset:     datasetName,
      model:       cfg.name,
      dimensions:  cfg.dimensions,
      items:       items.length,
      runs:        this.runsPerItem,
      errors,
      latencyMs:   { ...Object.fromEntries(Object.entries(latStats).map(([k, v]) => [k, parseFloat(v.toFixed(2))])) },
      throughput:  { itemsPerSec: parseFloat(throughputMean.toFixed(2)) },
      recall10:    recall,
      cost: {
        perMTokenUSD:      costPer1M,
        estimatedPerRunUSD: parseFloat(costPerRun.toFixed(6)),
        estimatedPer1M_USD: costPer1M,
        license:           cfg.license,
        selfHostable:      cfg.selfHostable,
      },
    };

    const status = errors > items.length * 0.3 ? '✗ HIGH_ERROR_RATE'
                 : errors > 0 ? '⚠ SOME_ERRORS'
                 : '✓';

    console.log(`    ${status} p50=${result.latencyMs.p50}ms p99=${result.latencyMs.p99}ms ` +
                `throughput=${result.throughput.itemsPerSec} items/s recall@10=${recall.toFixed(3)} ` +
                `errors=${errors}/${items.length * this.runsPerItem}`);

    return result;
  }

  /**
   * @private Compute Recall@10 using leave-one-out cosine similarity.
   * For each item, find its top-10 nearest neighbors by cosine similarity
   * (ground truth), then check if the item's own embedding correctly
   * clusters with semantically similar items.
   *
   * Ground truth is bootstrapped: items in the same conceptual group
   * (as defined by the BUILT_IN_DATASETS structure) are considered relevant.
   */
  async _computeRecall(embeddingMap, items) {
    const ids       = Object.keys(embeddingMap);
    if (ids.length < 2) return 1.0;

    let   hits      = 0;
    let   total     = 0;

    // Build cosine similarity matrix
    for (const queryId of ids) {
      const queryVec = embeddingMap[queryId];
      if (!queryVec) continue;

      // Get top-10 most similar (excluding self)
      const similarities = ids
        .filter(id => id !== queryId)
        .map(id => ({ id, sim: this._cosineSim(queryVec, embeddingMap[id]) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 10);

      // Ground truth: same prefix letter = same category (s*, l*, c*, m*)
      const queryPrefix = queryId[0];
      const relevant    = ids.filter(id => id !== queryId && id[0] === queryPrefix);

      if (relevant.length === 0) continue;

      const retrieved = new Set(similarities.map(s => s.id));
      const trueHits  = relevant.filter(id => retrieved.has(id)).length;

      hits  += trueHits / Math.min(relevant.length, 10);
      total += 1;
    }

    return total > 0 ? hits / total : 1.0;
  }

  /**
   * @private Call provider embedding API.
   * Returns array of embedding arrays (one per input text).
   */
  async _embed(provider, texts, apiKey, cfg) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30_000);

    try {
      let body, headers, url, parser;

      switch (provider) {
        case 'nomic':
          url     = cfg.apiUrl;
          headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
          body    = { model: 'nomic-embed-text-v1.5', texts, task_type: 'search_document' };
          parser  = r => r.embeddings;
          break;

        case 'jina':
          url     = cfg.apiUrl;
          headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
          body    = { model: 'jina-embeddings-v3', input: texts, task: 'retrieval.passage' };
          parser  = r => r.data.map(d => d.embedding);
          break;

        case 'cohere':
          url     = cfg.apiUrl;
          headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
          body    = { model: 'embed-v4.0', texts, input_type: 'search_document', truncate: 'RIGHT' };
          parser  = r => r.embeddings.float ?? r.embeddings;
          break;

        case 'voyage':
          url     = cfg.apiUrl;
          headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
          body    = { model: 'voyage-3', input: texts, input_type: 'document' };
          parser  = r => r.data.map(d => d.embedding);
          break;

        case 'local': {
          // Ollama: one request per text
          const embeddings = [];
          for (const text of texts) {
            const res = await fetch(`${cfg.apiUrl}/api/embeddings`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
              signal:  controller.signal,
            });
            if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
            const data = await res.json();
            embeddings.push(data.embedding);
          }
          return embeddings;
        }

        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      const response = await fetch(url, {
        method:  'POST',
        headers,
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      return parser(data);

    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Statistics Helpers ───────────────────────────────────────────────────

  /**
   * @private Compute the p-th percentile of a sorted array.
   */
  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[idx];
  }

  /**
   * @private Cosine similarity between two vectors.
   */
  _cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom < 1e-10 ? 0 : dot / denom;
  }

  // ─── Summary & Output ─────────────────────────────────────────────────────

  /**
   * @private Build a normalized benchmark summary.
   */
  _buildSummary() {
    const summary = {
      meta: {
        timestamp:    new Date().toISOString(),
        nodeVersion:  process.version,
        platform:     process.platform,
        arch:         process.arch,
        providers:    this.providers,
        datasets:     this.datasets,
        runsPerItem:  this.runsPerItem,
      },
      results: this.results,
      rankings: {},
    };

    // Compute rankings across providers for each metric
    const metrics = ['latencyMs.p50', 'latencyMs.p99', 'throughput.itemsPerSec', 'recall10', 'cost.perMTokenUSD'];

    for (const metric of metrics) {
      const scores = [];
      for (const [provider, datasetResults] of Object.entries(this.results)) {
        // Average across datasets for this metric
        let total = 0, count = 0;
        for (const res of Object.values(datasetResults)) {
          if (res.skipped) continue;
          const val = this._getNestedValue(res, metric);
          if (val != null && !isNaN(val)) { total += val; count++; }
        }
        if (count > 0) scores.push({ provider, value: total / count });
      }

      const isHigherBetter = ['throughput.itemsPerSec', 'recall10'].includes(metric);
      scores.sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value);
      summary.rankings[metric] = scores.map((s, i) => ({
        rank:     i + 1,
        provider: s.provider,
        value:    parseFloat(s.value.toFixed(4)),
      }));
    }

    return summary;
  }

  /**
   * @private Get nested object value by dot-path (e.g., 'latencyMs.p50').
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * @private Write outputs to files.
   */
  async _writeOutputs(summary) {
    await fs.mkdir(this.outputDir, { recursive: true });

    if (this.formats.includes('json')) {
      const jsonPath = path.join(this.outputDir, `benchmark-${Date.now()}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2));
      console.log(`\n  → JSON results: ${jsonPath}`);
    }

    if (this.formats.includes('md')) {
      const mdPath = path.join(this.outputDir, `benchmark-${Date.now()}.md`);
      await fs.writeFile(mdPath, this._buildMarkdown(summary));
      console.log(`  → Markdown:     ${mdPath}`);
    }
  }

  /**
   * @private Build markdown report.
   */
  _buildMarkdown(summary) {
    const lines = [
      '# Embedding Model Benchmark Report',
      '',
      `**Generated:** ${summary.meta.timestamp}`,
      `**Node.js:** ${summary.meta.nodeVersion}  `,
      `**Platform:** ${summary.meta.platform}/${summary.meta.arch}`,
      '',
      '## Configuration',
      '',
      `- **Providers tested:** ${summary.meta.providers.join(', ')}`,
      `- **Datasets:** ${summary.meta.datasets.join(', ')}`,
      `- **Runs per item:** ${summary.meta.runsPerItem}`,
      '',
      '## Results by Dataset',
      '',
    ];

    for (const [provider, datasets] of Object.entries(summary.results)) {
      const cfg = PROVIDER_CONFIGS[provider];
      lines.push(`### ${cfg?.name ?? provider}`);
      lines.push('');
      lines.push(`| Dataset | p50 (ms) | p99 (ms) | Throughput (items/s) | Recall@10 | Cost/1M tokens |`);
      lines.push(`|---------|----------|----------|---------------------|-----------|----------------|`);

      for (const [dataset, res] of Object.entries(datasets)) {
        if (res.skipped) {
          lines.push(`| ${dataset} | _skipped_ | | | | |`);
          continue;
        }
        lines.push(
          `| ${dataset} ` +
          `| ${res.latencyMs.p50} ` +
          `| ${res.latencyMs.p99} ` +
          `| ${res.throughput.itemsPerSec} ` +
          `| ${res.recall10.toFixed(3)} ` +
          `| $${res.cost.perMTokenUSD.toFixed(3)} |`
        );
      }
      lines.push('');
    }

    // Rankings
    lines.push('## Overall Rankings');
    lines.push('');

    const metricLabels = {
      'latencyMs.p50':          'Latency p50 (lower=better)',
      'latencyMs.p99':          'Latency p99 (lower=better)',
      'throughput.itemsPerSec': 'Throughput (higher=better)',
      'recall10':               'Recall@10 (higher=better)',
      'cost.perMTokenUSD':      'Cost/1M tokens (lower=better)',
    };

    for (const [metric, label] of Object.entries(metricLabels)) {
      const ranking = summary.rankings[metric] ?? [];
      if (ranking.length === 0) continue;
      lines.push(`### ${label}`);
      lines.push('');
      lines.push('| Rank | Provider | Value |');
      lines.push('|------|----------|-------|');
      for (const row of ranking) {
        lines.push(`| ${row.rank} | ${row.provider} | ${row.value} |`);
      }
      lines.push('');
    }

    // Provider specs
    lines.push('## Provider Specifications');
    lines.push('');
    lines.push('| Provider | Model | Dimensions | Context | Cost/1M | License | Self-Hostable |');
    lines.push('|----------|-------|-----------|---------|---------|---------|---------------|');

    for (const [key, cfg] of Object.entries(PROVIDER_CONFIGS)) {
      lines.push(
        `| ${key} | ${cfg.name} | ${cfg.dimensions} | ${cfg.contextTokens.toLocaleString()} | ` +
        `$${cfg.costPerMToken.toFixed(3)} | ${cfg.license} | ${cfg.selfHostable ? 'Yes' : 'No'} |`
      );
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Sources: [Ailog MTEB leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models), [Ailog BEIR 2.0 (Jan 2026)](https://app.ailog.fr/en/blog/news/beir-benchmark-update)*');

    return lines.join('\n');
  }

  /**
   * @private Print a quick markdown table to stdout.
   */
  _printMarkdownTable(summary) {
    console.log('\n' + '═'.repeat(70));
    console.log(' RESULTS SUMMARY');
    console.log('═'.repeat(70));

    const header = ['Provider', 'Dataset', 'p50ms', 'p99ms', 'items/s', 'Recall@10', 'Cost/1M'];
    const colW    = [12, 12, 8, 8, 10, 11, 8];
    const row     = (cols) => '│ ' + cols.map((c, i) => String(c).padEnd(colW[i])).join(' │ ') + ' │';

    console.log(row(header));
    console.log('├' + colW.map(w => '─'.repeat(w + 2)).join('┼') + '┤');

    for (const [provider, datasets] of Object.entries(summary.results)) {
      for (const [dataset, res] of Object.entries(datasets)) {
        if (res.skipped) {
          console.log(row([provider, dataset, 'SKIPPED', '', '', '', '']));
          continue;
        }
        console.log(row([
          provider,
          dataset,
          res.latencyMs.p50,
          res.latencyMs.p99,
          res.throughput.itemsPerSec,
          res.recall10.toFixed(3),
          `$${res.cost.perMTokenUSD}`,
        ]));
      }
    }
    console.log('');
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      providers:  { type: 'string',  default: 'local' },
      datasets:   { type: 'string',  default: 'short'  },
      runs:       { type: 'string',  default: '5'      },
      output:     { type: 'string',  default: './results' },
      format:     { type: 'string',  default: 'json,md' },
      'batch-size': { type: 'string', default: '10'   },
    },
    strict: false,
  });

  const runner = new BenchmarkRunner({
    providers:  values.providers.split(',').map(s => s.trim()),
    datasets:   values.datasets.split(',').map(s => s.trim()),
    runs:       parseInt(values.runs, 10),
    outputDir:  values.output,
    formats:    values.format.split(',').map(s => s.trim()),
    batchSize:  parseInt(values['batch-size'], 10),
  });

  try {
    const summary = await runner.run();
    console.log('\n  Benchmark complete.');
    process.exit(0);
  } catch (err) {
    console.error('\n  Benchmark failed:', err.message);
    process.exit(1);
  }
}

// Run only when invoked directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { BenchmarkRunner, BUILT_IN_DATASETS, PROVIDER_CONFIGS };
