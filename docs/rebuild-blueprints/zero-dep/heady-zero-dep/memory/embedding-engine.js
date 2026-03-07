/**
 * @fileoverview Embedding Engine
 * Zero-dependency text embedding with optional external API support.
 *
 * Pipeline:
 *   1. TF-IDF + BM25 sparse vector
 *   2. Random projection to 384D (Johnson-Lindenstrauss lemma)
 *   3. L2 normalization → unit vector (compatible with cosine similarity)
 *
 * Optional upgrades:
 *   - OpenAI text-embedding-3-small (1536D, projected to 384D)
 *   - Cloudflare Workers AI (@cf/baai/bge-small-en-v1.5, native 384D)
 *
 * Caching:
 *   - LRU cache keyed by SHA-256 hash of input text
 *   - PHI-scaled cache capacity
 *
 * Node.js built-ins only: crypto, https, http
 */

import crypto from 'node:crypto';
import https  from 'node:https';
import http   from 'node:http';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI       = 1.6180339887498948482;
const DIM       = 384;

/** BM25 parameters */
const BM25_K1   = 1.5;
const BM25_B    = 0.75;

/** LRU embedding cache capacity */
const CACHE_CAPACITY = Math.round(1000 * PHI); // ~1618

// ─── Text preprocessing ───────────────────────────────────────────────────────

/**
 * Tokenise text into lowercase words, removing punctuation.
 * @param {string} text
 * @returns {string[]}
 */
function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Build unigram + bigram token bag.
 * @param {string[]} tokens
 * @returns {string[]}
 */
function ngrams(tokens) {
  const result = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(tokens[i] + '_' + tokens[i + 1]);
  }
  return result;
}

/**
 * Compute term frequency map for a token array.
 * @param {string[]} terms
 * @returns {Map<string, number>}
 */
function termFrequency(terms) {
  const tf = new Map();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

// ─── Stable Random Projection Matrix ─────────────────────────────────────────

/**
 * Generate a deterministic random projection matrix from a vocabulary.
 * Maps sparse vocabulary indices → dense 384D space.
 * Uses hash-based seeding so the same vocab always yields the same matrix.
 *
 * Each vocabulary term gets a 384D projection vector drawn from N(0,1).
 * We use a simple LCG seeded by the term's hash for determinism without
 * requiring a large pre-stored matrix.
 *
 * @param {string} term
 * @returns {Float32Array} 384D unit projection vector
 */
function getProjectionVector(term) {
  const hash = crypto.createHash('md5').update(term).digest();
  const seed = hash.readUInt32LE(0);

  // LCG parameters (Numerical Recipes)
  let state = seed >>> 0;
  const vec = new Float32Array(DIM);
  let norm  = 0;
  for (let i = 0; i < DIM; i++) {
    state = ((state * 1664525 + 1013904223) >>> 0);
    // Map to N(0,1) via Box-Muller using two consecutive LCG values
    const u1 = (state / 4294967296) + 1e-10;
    state = ((state * 1664525 + 1013904223) >>> 0);
    const u2 = (state / 4294967296);
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    vec[i] = z;
    norm  += z * z;
  }
  const invNorm = 1 / (Math.sqrt(norm) || 1);
  for (let i = 0; i < DIM; i++) vec[i] *= invNorm;
  return vec;
}

// ─── Corpus Statistics (for IDF) ─────────────────────────────────────────────

/**
 * Maintains document frequency counts for IDF computation.
 */
class CorpusStats {
  constructor() {
    /** @type {Map<string, number>} term → document count */
    this._df = new Map();
    this._docCount = 0;
    this._avgDocLen = 0;
    this._totalTokens = 0;
  }

  /**
   * Add a document to the corpus.
   * @param {string[]} terms
   */
  addDoc(terms) {
    const unique = new Set(terms);
    for (const t of unique) this._df.set(t, (this._df.get(t) ?? 0) + 1);
    this._docCount++;
    this._totalTokens += terms.length;
    this._avgDocLen = this._totalTokens / this._docCount;
  }

  /**
   * IDF score (BM25 variant): log((N - df + 0.5) / (df + 0.5) + 1)
   * @param {string} term
   * @returns {number}
   */
  idf(term) {
    const df = this._df.get(term) ?? 0;
    const N  = this._docCount || 1;
    return Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }

  get avgDocLen() { return this._avgDocLen || 1; }
  get docCount()  { return this._docCount; }
}

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class EmbeddingCache {
  constructor(capacity = CACHE_CAPACITY) {
    this._cap   = capacity;
    /** @type {Map<string, {vec: Float32Array, accessed: number}>} */
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    entry.accessed = Date.now();
    return entry.vec;
  }

  set(key, vec) {
    if (this._store.size >= this._cap) {
      // Evict oldest accessed
      let oldest = null, oldestTime = Infinity;
      for (const [k, v] of this._store) {
        if (v.accessed < oldestTime) { oldestTime = v.accessed; oldest = k; }
      }
      if (oldest) this._store.delete(oldest);
    }
    this._store.set(key, { vec, accessed: Date.now() });
  }

  /** @returns {number} cache hit ratio info */
  get size() { return this._store.size; }
}

// ─── External API helpers ─────────────────────────────────────────────────────

/**
 * Simple HTTPS POST helper (no external deps).
 * @param {string} urlStr
 * @param {object} body
 * @param {object} headers
 * @returns {Promise<object>} parsed JSON response
 */
function httpsPost(urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlStr);
    const payload = JSON.stringify(body);
    const lib     = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port    : url.port || (url.protocol === 'https:' ? 443 : 80),
      path    : url.pathname + url.search,
      method  : 'POST',
      headers : {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * L2-normalise a Float32Array in place.
 * @param {Float32Array} vec
 * @returns {Float32Array}
 */
function l2Normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  const inv = 1 / (Math.sqrt(norm) || 1);
  for (let i = 0; i < vec.length; i++) vec[i] *= inv;
  return vec;
}

/**
 * Project a high-dim dense vector to 384D via random projection.
 * @param {number[]} inputVec
 * @param {number}   inputDim
 * @returns {Float32Array}
 */
function projectToTarget(inputVec, inputDim) {
  if (inputDim === DIM) return l2Normalize(new Float32Array(inputVec));
  // Simple linear projection: sum contributions of each input dimension
  const out = new Float32Array(DIM);
  const scale = Math.sqrt(DIM / inputDim);
  // Create a hash-based rotation: project each input dim to target dims
  for (let i = 0; i < inputDim; i++) {
    if (inputVec[i] === 0) continue;
    const seed = ((i * 2654435761) >>> 0);
    // Each input dimension fans out to a deterministic subset of output dims
    let s = seed;
    for (let j = 0; j < Math.ceil(DIM / inputDim) + 1; j++) {
      s = ((s * 1664525 + 1013904223) >>> 0);
      const outIdx = s % DIM;
      out[outIdx] += inputVec[i] * scale;
    }
  }
  return l2Normalize(out);
}

// ─── EmbeddingEngine ──────────────────────────────────────────────────────────

/**
 * Multi-provider embedding engine with local TF-IDF/BM25 fallback.
 *
 * @example
 * const engine = new EmbeddingEngine();
 * const vec = await engine.embed('hello world');
 * const sim = engine.similarity(vec1, vec2);
 */
export class EmbeddingEngine {
  /**
   * @param {object} opts
   * @param {string}  [opts.provider='local'] - 'local'|'openai'|'cloudflare'
   * @param {string}  [opts.openaiKey]
   * @param {string}  [opts.cloudflareAccountId]
   * @param {string}  [opts.cloudflareToken]
   * @param {string}  [opts.openaiModel='text-embedding-3-small']
   * @param {number}  [opts.cacheCapacity]
   */
  constructor(opts = {}) {
    this.provider  = opts.provider  ?? 'local';
    this.dim       = DIM;

    // OpenAI
    this._openaiKey   = opts.openaiKey   ?? process.env.OPENAI_API_KEY;
    this._openaiModel = opts.openaiModel ?? 'text-embedding-3-small';

    // Cloudflare Workers AI
    this._cfAccount = opts.cloudflareAccountId ?? process.env.CF_ACCOUNT_ID;
    this._cfToken   = opts.cloudflareToken     ?? process.env.CF_API_TOKEN;
    this._cfModel   = '@cf/baai/bge-small-en-v1.5';

    this._corpus = new CorpusStats();
    this._cache  = new EmbeddingCache(opts.cacheCapacity ?? CACHE_CAPACITY);

    /** Documents added for corpus stats (for IDF) */
    this._docQueue = [];
  }

  // ─ Public API ──────────────────────────────────────────────────────────────

  /**
   * Embed a single text.
   * @param {string} text
   * @returns {Promise<Float32Array>} unit 384D vector
   */
  async embed(text) {
    const key = crypto.createHash('sha256').update(text).digest('hex');
    const cached = this._cache.get(key);
    if (cached) return cached;

    let vec;
    try {
      if (this.provider === 'openai' && this._openaiKey) {
        vec = await this._embedOpenAI(text);
      } else if (this.provider === 'cloudflare' && this._cfAccount && this._cfToken) {
        vec = await this._embedCloudflare(text);
      } else {
        vec = this._embedLocal(text);
      }
    } catch (err) {
      // Fallback to local on external API failure
      console.warn(`[EmbeddingEngine] ${this.provider} failed (${err.message}), falling back to local`);
      vec = this._embedLocal(text);
    }

    this._cache.set(key, vec);
    return vec;
  }

  /**
   * Embed multiple texts in batch.
   * @param {string[]} texts
   * @returns {Promise<Float32Array[]>}
   */
  async embedBatch(texts) {
    if (this.provider === 'openai' && this._openaiKey && texts.length > 1) {
      return this._batchOpenAI(texts);
    }
    return Promise.all(texts.map(t => this.embed(t)));
  }

  /**
   * Compute cosine similarity between two embeddings.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number} [-1, 1]
   */
  similarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot; // unit vectors → cosine sim == dot product
  }

  /**
   * Add documents to the corpus for better IDF estimation.
   * @param {string[]} docs
   */
  trainCorpus(docs) {
    for (const doc of docs) {
      const terms = ngrams(tokenise(doc));
      this._corpus.addDoc(terms);
    }
  }

  // ─ Local TF-IDF + BM25 ────────────────────────────────────────────────────

  /**
   * Local embedding using BM25-weighted random projection.
   * @param {string} text
   * @returns {Float32Array}
   */
  _embedLocal(text) {
    const rawTokens = tokenise(text);
    const terms     = ngrams(rawTokens);
    if (terms.length === 0) return new Float32Array(DIM); // zero vector for empty

    // Update corpus with this doc
    this._corpus.addDoc(terms);

    // BM25 term weights
    const tf      = termFrequency(terms);
    const docLen  = terms.length;
    const avgLen  = this._corpus.avgDocLen;
    const weights = new Map();

    for (const [term, count] of tf) {
      const idf     = this._corpus.idf(term);
      const tfNorm  = (count * (BM25_K1 + 1)) /
                      (count + BM25_K1 * (1 - BM25_B + BM25_B * docLen / avgLen));
      weights.set(term, idf * tfNorm);
    }

    // Sum weighted projection vectors
    const out = new Float32Array(DIM);
    for (const [term, weight] of weights) {
      const proj = getProjectionVector(term);
      for (let i = 0; i < DIM; i++) out[i] += proj[i] * weight;
    }

    return l2Normalize(out);
  }

  // ─ OpenAI ──────────────────────────────────────────────────────────────────

  async _embedOpenAI(text) {
    const body = { model: this._openaiModel, input: text, dimensions: 1536 };
    const res  = await httpsPost(
      'https://api.openai.com/v1/embeddings',
      body,
      { Authorization: `Bearer ${this._openaiKey}` }
    );
    const rawVec = res.data[0].embedding;
    // Project 1536D → 384D
    return projectToTarget(rawVec, rawVec.length);
  }

  async _batchOpenAI(texts) {
    const keys = texts.map(t => crypto.createHash('sha256').update(t).digest('hex'));
    const uncached = texts.filter((_, i) => !this._cache.get(keys[i]));

    if (uncached.length > 0) {
      const body = { model: this._openaiModel, input: uncached, dimensions: 1536 };
      const res  = await httpsPost(
        'https://api.openai.com/v1/embeddings',
        body,
        { Authorization: `Bearer ${this._openaiKey}` }
      ).catch(() => null);

      if (res?.data) {
        let j = 0;
        for (let i = 0; i < texts.length; i++) {
          if (!this._cache.get(keys[i])) {
            const vec = projectToTarget(res.data[j++].embedding, 1536);
            this._cache.set(keys[i], vec);
          }
        }
      }
    }

    return texts.map((t, i) => this._cache.get(keys[i]) ?? this._embedLocal(t));
  }

  // ─ Cloudflare Workers AI ──────────────────────────────────────────────────

  async _embedCloudflare(text) {
    const url  = `https://api.cloudflare.com/client/v4/accounts/${this._cfAccount}/ai/run/${this._cfModel}`;
    const res  = await httpsPost(
      url,
      { text: [text] },
      { Authorization: `Bearer ${this._cfToken}` }
    );
    const rawVec = res.result?.data?.[0];
    if (!rawVec) throw new Error('Empty Cloudflare response');
    // BGE-small-en-v1.5 returns 384D natively
    return l2Normalize(new Float32Array(rawVec));
  }

  // ─ Stats ───────────────────────────────────────────────────────────────────

  stats() {
    return {
      provider    : this.provider,
      dim         : this.dim,
      cacheSize   : this._cache.size,
      cacheCapacity: CACHE_CAPACITY,
      corpusDocs  : this._corpus.docCount,
    };
  }
}

export default EmbeddingEngine;
