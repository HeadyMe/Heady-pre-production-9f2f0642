'use strict';

/**
 * VectorFederation — Federates vector memory across multiple HeadyStack instances.
 * Enables multi-node vector search, replication, and consistency guarantees.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const SYNC_STRATEGIES = {
  PUSH: 'push',     // Push changes to peers
  PULL: 'pull',     // Pull changes from peers
  GOSSIP: 'gossip', // Random peer gossip
};

const NODE_STATUS = {
  ACTIVE: 'active',
  SYNCING: 'syncing',
  DEGRADED: 'degraded',
  OFFLINE: 'offline',
};

class VectorFederation extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.nodeId = opts.nodeId || 'node_' + crypto.randomBytes(8).toString('hex');
    this._peers = new Map();              // nodeId → PeerRecord
    this._localMemory = opts.vectorMemory || null;
    this._syncStrategy = opts.syncStrategy || SYNC_STRATEGIES.PUSH;
    this._syncIntervalMs = opts.syncIntervalMs || 30000;
    this._vectorLog = [];                 // replication log
    this._maxLogSize = opts.maxLogSize || 10000;
    this._stats = { syncs: 0, pushes: 0, pulls: 0, errors: 0, vectors: 0 };
    this._syncTimers = new Map();
  }

  // ─── Peer management ───────────────────────────────────────────────────────

  addPeer(peerId, opts = {}) {
    const peer = {
      id: peerId,
      url: opts.url || null,
      status: NODE_STATUS.ACTIVE,
      addedAt: new Date().toISOString(),
      lastSync: null,
      failCount: 0,
      vectorCount: 0,
    };
    this._peers.set(peerId, peer);
    this.emit('peer-added', { peerId });
    if (this._syncStrategy === SYNC_STRATEGIES.PUSH) {
      this._startPeerSync(peerId);
    }
    return peer;
  }

  removePeer(peerId) {
    const existed = this._peers.delete(peerId);
    this._stopPeerSync(peerId);
    if (existed) this.emit('peer-removed', { peerId });
    return existed;
  }

  listPeers() {
    return Array.from(this._peers.values());
  }

  getPeer(peerId) {
    return this._peers.get(peerId) || null;
  }

  // ─── Replication ───────────────────────────────────────────────────────────

  /**
   * Log a vector write for replication.
   */
  logWrite(id, vector, text, meta = {}) {
    const entry = {
      id,
      vector,
      text,
      meta,
      nodeId: this.nodeId,
      logIndex: this._vectorLog.length,
      ts: new Date().toISOString(),
    };
    this._vectorLog.push(entry);
    if (this._vectorLog.length > this._maxLogSize) this._vectorLog.shift();
    this._stats.vectors++;

    if (this._syncStrategy === SYNC_STRATEGIES.PUSH) {
      this._pushToPeers(entry);
    }
    return entry.logIndex;
  }

  async _pushToPeers(entry) {
    for (const peer of this._peers.values()) {
      if (peer.status === NODE_STATUS.OFFLINE) continue;
      try {
        await this._pushToPeer(peer, entry);
        this._stats.pushes++;
      } catch (err) {
        peer.failCount++;
        if (peer.failCount > 3) peer.status = NODE_STATUS.DEGRADED;
        this.emit('sync-error', { peerId: peer.id, error: err.message });
        this._stats.errors++;
      }
    }
  }

  async _pushToPeer(peer, entry) {
    if (!peer.url) {
      // In-process federation (for testing or single-machine multi-instance)
      this.emit('push', { peerId: peer.id, entry });
      return;
    }

    const axios = require('axios');
    await axios.post(`${peer.url}/api/vector-federation/receive`, {
      sourceNode: this.nodeId,
      entry,
    }, { timeout: 5000 });
    peer.lastSync = new Date().toISOString();
    peer.failCount = 0;
    peer.status = NODE_STATUS.ACTIVE;
  }

  /**
   * Pull vectors from a peer since a given log index.
   */
  async pullFromPeer(peerId, sinceIndex = 0) {
    const peer = this._peers.get(peerId);
    if (!peer) throw new Error(`Peer not found: ${peerId}`);
    if (!peer.url) throw new Error(`Peer ${peerId} has no URL configured`);

    const axios = require('axios');
    const resp = await axios.get(`${peer.url}/api/vector-federation/log`, {
      params: { sinceIndex, requestingNode: this.nodeId },
      timeout: 10000,
    });

    const entries = resp.data?.entries || [];
    for (const entry of entries) {
      if (this._localMemory && typeof this._localMemory.store === 'function') {
        await this._localMemory.store(entry.id, entry.vector, entry.text, { ...entry.meta, fromNode: entry.nodeId });
      }
    }

    this._stats.pulls++;
    peer.lastSync = new Date().toISOString();
    return { pulled: entries.length, peerId };
  }

  /**
   * Receive a vector entry from another node.
   */
  async receiveFromPeer(sourceNodeId, entry) {
    if (!entry || !entry.id) throw new Error('Invalid entry');
    if (this._localMemory && typeof this._localMemory.store === 'function') {
      await this._localMemory.store(entry.id, entry.vector, entry.text, { ...entry.meta, fromNode: sourceNodeId });
    }
    this._stats.syncs++;
    this.emit('received', { sourceNodeId, id: entry.id });
  }

  // ─── Peer sync loops ───────────────────────────────────────────────────────

  _startPeerSync(peerId) {
    if (this._syncTimers.has(peerId)) return;
    const timer = setInterval(async () => {
      if (this._syncStrategy === SYNC_STRATEGIES.PULL) {
        try { await this.pullFromPeer(peerId); } catch {}
      }
    }, this._syncIntervalMs);
    if (timer.unref) timer.unref();
    this._syncTimers.set(peerId, timer);
  }

  _stopPeerSync(peerId) {
    const timer = this._syncTimers.get(peerId);
    if (timer) { clearInterval(timer); this._syncTimers.delete(peerId); }
  }

  // ─── Federated search ──────────────────────────────────────────────────────

  /**
   * Run a federated search across all peers and local memory.
   */
  async federatedSearch(query, opts = {}) {
    const topK = opts.topK || 5;
    const results = [];

    // Local search
    if (this._localMemory && typeof this._localMemory.search === 'function') {
      try {
        const local = await this._localMemory.search(query, { topK });
        results.push(...(local || []).map(r => ({ ...r, node: this.nodeId, source: 'local' })));
      } catch {}
    }

    // Peer search
    for (const peer of this._peers.values()) {
      if (peer.status === NODE_STATUS.OFFLINE || !peer.url) continue;
      try {
        const axios = require('axios');
        const resp = await axios.post(`${peer.url}/api/vector/search`, { query, topK }, { timeout: 5000 });
        const peerResults = resp.data?.results || [];
        results.push(...peerResults.map(r => ({ ...r, node: peer.id, source: 'peer' })));
      } catch { /* peer unavailable */ }
    }

    // Deduplicate by ID, keeping highest score
    const dedupMap = new Map();
    for (const r of results) {
      const existing = dedupMap.get(r.id);
      if (!existing || (r.score || 0) > (existing.score || 0)) dedupMap.set(r.id, r);
    }

    return Array.from(dedupMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, topK);
  }

  getStats() {
    return {
      ...this._stats,
      nodeId: this.nodeId,
      peerCount: this._peers.size,
      logSize: this._vectorLog.length,
      syncStrategy: this._syncStrategy,
    };
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app) {
    /** GET /api/vector-federation/info */
    app.get('/api/vector-federation/info', (req, res) => {
      res.json({ ok: true, nodeId: this.nodeId, peers: this.listPeers(), stats: this.getStats() });
    });

    /** GET /api/vector-federation/peers */
    app.get('/api/vector-federation/peers', (req, res) => {
      res.json({ ok: true, peers: this.listPeers() });
    });

    /** POST /api/vector-federation/peers — add a peer */
    app.post('/api/vector-federation/peers', (req, res) => {
      const { peerId, url } = req.body || {};
      if (!peerId) return res.status(400).json({ ok: false, error: 'peerId required' });
      const peer = this.addPeer(peerId, { url });
      res.status(201).json({ ok: true, peer });
    });

    /** DELETE /api/vector-federation/peers/:peerId */
    app.delete('/api/vector-federation/peers/:peerId', (req, res) => {
      const removed = this.removePeer(req.params.peerId);
      res.json({ ok: removed, peerId: req.params.peerId });
    });

    /** POST /api/vector-federation/receive — receive from a peer node */
    app.post('/api/vector-federation/receive', async (req, res) => {
      try {
        const { sourceNode, entry } = req.body || {};
        await this.receiveFromPeer(sourceNode, entry);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/vector-federation/log — serve replication log */
    app.get('/api/vector-federation/log', (req, res) => {
      const sinceIndex = parseInt(req.query.sinceIndex) || 0;
      const entries = this._vectorLog.filter(e => e.logIndex >= sinceIndex);
      res.json({ ok: true, entries, nodeId: this.nodeId });
    });

    /** POST /api/vector-federation/search — federated search */
    app.post('/api/vector-federation/search', async (req, res) => {
      try {
        const { query, topK } = req.body || {};
        if (!query) return res.status(400).json({ ok: false, error: 'query required' });
        const results = await this.federatedSearch(query, { topK });
        res.json({ ok: true, results });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/vector-federation/peers/:peerId/pull — manual pull from peer */
    app.post('/api/vector-federation/peers/:peerId/pull', async (req, res) => {
      try {
        const { sinceIndex } = req.body || {};
        const result = await this.pullFromPeer(req.params.peerId, sinceIndex);
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    return app;
  }
}

let _instance = null;
function getVectorFederation(opts) {
  if (!_instance) _instance = new VectorFederation(opts);
  return _instance;
}

module.exports = { VectorFederation, getVectorFederation, SYNC_STRATEGIES, NODE_STATUS };
