/**
 * HeadyWeb — VectorFederation
 *
 * Federates vector memory across HeadyStack instances.
 * Supports peer management, replication (push / pull / gossip),
 * federated semantic search, and Express route integration.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module vector-federation
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const FEDERATION_VERSION = '2.1.0';
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_REPLICATION_FACTOR = 2;
const DEFAULT_GOSSIP_INTERVAL_MS = 30_000;
const DEFAULT_DENSITY_GATE = 0.92;
const DEFAULT_SEARCH_K = 10;

// ── Types / JSDoc ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} VectorEntry
 * @property {string}   id          - Unique vector ID
 * @property {number[]} embedding   - Dense embedding (DEFAULT_DIMENSIONS floats)
 * @property {string}   [text]      - Original text (optional)
 * @property {object}   [metadata]  - Arbitrary metadata
 * @property {number}   timestamp   - Unix ms timestamp
 */

/**
 * @typedef {object} PeerNode
 * @property {string}  id          - Peer node ID
 * @property {string}  endpoint    - HTTP base URL
 * @property {boolean} active      - Whether peer is reachable
 * @property {number}  lastSeen    - Unix ms timestamp
 * @property {number}  vectorCount - Reported count from last ping
 */

// ── VectorFederation Class ────────────────────────────────────────────────────

/**
 * VectorFederation — federated in-memory vector store with peer replication.
 *
 * @example
 * const fed = new VectorFederation({ nodeId: 'node-alpha', dimensions: 384 });
 * fed.addPeer({ id: 'node-beta', endpoint: 'https://beta.headyme.com' });
 * await fed.upsert({ id: 'v1', embedding: [...], text: 'hello world' });
 * const results = await fed.search(queryEmbedding, 5);
 */
class VectorFederation {
  /**
   * @param {object} options
   * @param {string} [options.nodeId]              - This node's unique ID
   * @param {number} [options.dimensions]          - Embedding dimensionality
   * @param {number} [options.replicationFactor]   - How many peers to replicate to
   * @param {number} [options.gossipIntervalMs]    - Gossip sync interval
   * @param {number} [options.densityGate]         - Minimum cosine similarity threshold
   */
  constructor({
    nodeId = `node-${Math.random().toString(36).slice(2, 10)}`,
    dimensions = DEFAULT_DIMENSIONS,
    replicationFactor = DEFAULT_REPLICATION_FACTOR,
    gossipIntervalMs = DEFAULT_GOSSIP_INTERVAL_MS,
    densityGate = DEFAULT_DENSITY_GATE,
  } = {}) {
    this.nodeId = nodeId;
    this.dimensions = dimensions;
    this.replicationFactor = replicationFactor;
    this.gossipIntervalMs = gossipIntervalMs;
    this.densityGate = densityGate;
    this.version = FEDERATION_VERSION;

    /** @type {Map<string, VectorEntry>} */
    this._store = new Map();

    /** @type {Map<string, PeerNode>} */
    this._peers = new Map();

    /** @type {Array<{action: string, id: string, timestamp: number, peer?: string}>} */
    this._replicationLog = [];

    this._gossipTimer = null;
  }

  // ── Store Operations ────────────────────────────────────────────────────────

  /**
   * Insert or update a vector entry.
   *
   * @param {VectorEntry} entry
   * @throws {TypeError} If entry.embedding length doesn't match dimensions
   */
  async upsert(entry) {
    if (!entry?.id) throw new TypeError('upsert: entry.id is required');
    if (!Array.isArray(entry.embedding) || entry.embedding.length !== this.dimensions) {
      throw new TypeError(
        `upsert: entry.embedding must be an array of ${this.dimensions} numbers ` +
        `(got ${Array.isArray(entry.embedding) ? entry.embedding.length : typeof entry.embedding})`
      );
    }

    const record = {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    };

    this._store.set(entry.id, record);
    this._logReplication('upsert', entry.id);

    // Replicate to peers asynchronously (fire-and-forget)
    this._replicateToPeers('push', record).catch((err) => {
      console.warn(`[VectorFederation] Push replication failed for ${entry.id}:`, err.message);
    });

    return record;
  }

  /**
   * Get a vector entry by ID.
   *
   * @param {string} id
   * @returns {VectorEntry|null}
   */
  get(id) {
    return this._store.get(id) || null;
  }

  /**
   * Delete a vector entry.
   *
   * @param {string} id
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const existed = this._store.has(id);
    this._store.delete(id);
    if (existed) this._logReplication('delete', id);
    return existed;
  }

  /**
   * Return the number of stored vectors.
   * @returns {number}
   */
  get size() {
    return this._store.size;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  /**
   * Perform approximate nearest-neighbor search using cosine similarity.
   * Applies the density gate as a minimum similarity threshold.
   *
   * @param {number[]} queryEmbedding  - Query vector (must match this.dimensions)
   * @param {number}   [k=10]          - Number of results
   * @param {boolean}  [federated=false] - Also query peer nodes
   * @returns {Promise<Array<{id: string, score: number, entry: VectorEntry}>>}
   */
  async search(queryEmbedding, k = DEFAULT_SEARCH_K, federated = false) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimensions) {
      throw new TypeError(`search: queryEmbedding must be an array of ${this.dimensions} numbers`);
    }

    const localResults = this._localSearch(queryEmbedding, k);

    if (!federated || this._peers.size === 0) {
      return localResults;
    }

    // ── Federated search: query active peers ──────────────────────────────
    const peerResults = await this._federatedSearch(queryEmbedding, k);

    // Merge, deduplicate, re-rank by score
    const merged = new Map();
    for (const result of [...localResults, ...peerResults]) {
      const existing = merged.get(result.id);
      if (!existing || result.score > existing.score) {
        merged.set(result.id, result);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * @private
   * @param {number[]} queryEmbedding
   * @param {number} k
   * @returns {Array<{id: string, score: number, entry: VectorEntry}>}
   */
  _localSearch(queryEmbedding, k) {
    const results = [];
    const qNorm = this._norm(queryEmbedding);

    for (const [id, entry] of this._store) {
      const score = this._cosine(queryEmbedding, entry.embedding, qNorm);
      if (score >= this.densityGate) {
        results.push({ id, score, entry });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, k);
  }

  // ── Peer Management ─────────────────────────────────────────────────────────

  /**
   * Register a peer node.
   *
   * @param {{ id: string, endpoint: string }} peer
   */
  addPeer(peer) {
    if (!peer?.id || !peer?.endpoint) {
      throw new TypeError('addPeer: peer.id and peer.endpoint are required');
    }
    this._peers.set(peer.id, {
      id: peer.id,
      endpoint: peer.endpoint.replace(/\/$/, ''),
      active: true,
      lastSeen: Date.now(),
      vectorCount: 0,
    });
  }

  /**
   * Remove a peer node.
   * @param {string} peerId
   */
  removePeer(peerId) {
    this._peers.delete(peerId);
  }

  /**
   * Get all registered peers.
   * @returns {PeerNode[]}
   */
  getPeers() {
    return Array.from(this._peers.values());
  }

  // ── Replication ─────────────────────────────────────────────────────────────

  /**
   * Pull all vectors from a peer node.
   * @param {string} peerId
   * @returns {Promise<number>} Number of vectors received
   */
  async pullFromPeer(peerId) {
    const peer = this._peers.get(peerId);
    if (!peer) throw new Error(`Unknown peer: ${peerId}`);

    try {
      const res = await fetch(`${peer.endpoint}/api/vectors/export`, {
        headers: { 'X-Heady-Node': this.nodeId },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const entries = data?.vectors || [];
      let count = 0;

      for (const entry of entries) {
        if (
          entry?.id &&
          Array.isArray(entry.embedding) &&
          entry.embedding.length === this.dimensions
        ) {
          this._store.set(entry.id, entry);
          count++;
        }
      }

      peer.lastSeen = Date.now();
      peer.vectorCount = entries.length;
      peer.active = true;

      this._logReplication('pull', `${count} vectors`, peerId);
      return count;

    } catch (err) {
      peer.active = false;
      throw new Error(`Pull from peer ${peerId} failed: ${err.message}`);
    }
  }

  /**
   * Start the gossip sync loop (pushes incremental updates to random peers).
   */
  startGossip() {
    if (this._gossipTimer) return;
    this._gossipTimer = setInterval(() => {
      this._gossipCycle().catch((err) => {
        console.warn('[VectorFederation] Gossip cycle error:', err.message);
      });
    }, this.gossipIntervalMs);
  }

  /**
   * Stop the gossip sync loop.
   */
  stopGossip() {
    if (this._gossipTimer) {
      clearInterval(this._gossipTimer);
      this._gossipTimer = null;
    }
  }

  // ── Express Routes ──────────────────────────────────────────────────────────

  /**
   * Register this federation's REST API routes on an Express app.
   *
   * Endpoints:
   *  POST /api/vectors/upsert       — Add/update a vector
   *  GET  /api/vectors/export       — Export all vectors
   *  POST /api/vectors/search       — Semantic search
   *  GET  /api/vectors/peers        — List peers
   *  POST /api/vectors/peers        — Add a peer
   *  DELETE /api/vectors/peers/:id  — Remove a peer
   *  GET  /api/vectors/stats        — Federation stats
   *
   * @param {import('express').Application} app
   * @param {string} [prefix='/api/vectors']
   */
  registerRoutes(app, prefix = '/api/vectors') {
    app.post(`${prefix}/upsert`, async (req, res) => {
      try {
        const entry = await this.upsert(req.body);
        res.json({ ok: true, id: entry.id });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    app.get(`${prefix}/export`, (_req, res) => {
      res.json({
        nodeId: this.nodeId,
        vectors: Array.from(this._store.values()),
        count: this._store.size,
        timestamp: Date.now(),
      });
    });

    app.post(`${prefix}/search`, async (req, res) => {
      try {
        const { embedding, k = DEFAULT_SEARCH_K, federated = false } = req.body;
        const results = await this.search(embedding, k, federated);
        res.json({ ok: true, results, count: results.length });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    app.get(`${prefix}/peers`, (_req, res) => {
      res.json({ peers: this.getPeers() });
    });

    app.post(`${prefix}/peers`, (req, res) => {
      try {
        this.addPeer(req.body);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    app.delete(`${prefix}/peers/:id`, (req, res) => {
      this.removePeer(req.params.id);
      res.json({ ok: true });
    });

    app.get(`${prefix}/stats`, (_req, res) => {
      res.json(this.getStats());
    });
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  /**
   * Return a summary of federation state.
   * @returns {object}
   */
  getStats() {
    const activePeers = Array.from(this._peers.values()).filter((p) => p.active).length;
    return {
      nodeId: this.nodeId,
      version: this.version,
      vectorCount: this._store.size,
      dimensions: this.dimensions,
      densityGate: this.densityGate,
      replicationFactor: this.replicationFactor,
      totalPeers: this._peers.size,
      activePeers,
      gossipActive: this._gossipTimer !== null,
      replicationLogSize: this._replicationLog.length,
    };
  }

  /**
   * Get the replication log.
   * @param {number} [limit=100]
   * @returns {Array<object>}
   */
  getReplicationLog(limit = 100) {
    return this._replicationLog.slice(-limit);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * @private
   * @param {number[]} a
   * @param {number[]} b
   * @param {number} [aNorm]
   * @returns {number}
   */
  _cosine(a, b, aNorm) {
    let dot = 0;
    let normA = aNorm || 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      if (!aNorm) normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (!aNorm) normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  /**
   * @private
   * @param {number[]} v
   * @returns {number}
   */
  _norm(v) {
    let sum = 0;
    for (const x of v) sum += x * x;
    return Math.sqrt(sum);
  }

  /**
   * @private
   */
  _logReplication(action, id, peer = null) {
    this._replicationLog.push({
      action,
      id,
      timestamp: Date.now(),
      ...(peer ? { peer } : {}),
    });
    // Cap log at 1000 entries
    if (this._replicationLog.length > 1000) {
      this._replicationLog.shift();
    }
  }

  /**
   * @private
   */
  async _replicateToPeers(mode, entry) {
    const activePeers = Array.from(this._peers.values()).filter((p) => p.active);
    if (activePeers.length === 0) return;

    // Pick up to replicationFactor random peers
    const targets = activePeers
      .sort(() => Math.random() - 0.5)
      .slice(0, this.replicationFactor);

    await Promise.allSettled(
      targets.map(async (peer) => {
        const res = await fetch(`${peer.endpoint}/api/vectors/upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Heady-Node': this.nodeId,
          },
          body: JSON.stringify(entry),
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) {
          this._logReplication('push-ok', entry.id, peer.id);
          peer.lastSeen = Date.now();
          peer.active = true;
        }
      })
    );
  }

  /**
   * @private
   */
  async _gossipCycle() {
    const activePeers = Array.from(this._peers.values()).filter((p) => p.active);
    if (activePeers.length === 0) return;

    const target = activePeers[Math.floor(Math.random() * activePeers.length)];
    try {
      await this.pullFromPeer(target.id);
      this._logReplication('gossip-pull', `from ${target.id}`);
    } catch (err) {
      console.warn(`[VectorFederation] Gossip pull failed from ${target.id}:`, err.message);
    }
  }

  /**
   * @private
   */
  async _federatedSearch(queryEmbedding, k) {
    const activePeers = Array.from(this._peers.values()).filter((p) => p.active);
    const allResults = [];

    const peerSearches = activePeers.map(async (peer) => {
      try {
        const res = await fetch(`${peer.endpoint}/api/vectors/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Heady-Node': this.nodeId,
          },
          body: JSON.stringify({ embedding: queryEmbedding, k, federated: false }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.results)) {
          allResults.push(...data.results);
        }
      } catch (err) {
        peer.active = false;
      }
    });

    await Promise.allSettled(peerSearches);
    return allResults;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { VectorFederation, FEDERATION_VERSION };
