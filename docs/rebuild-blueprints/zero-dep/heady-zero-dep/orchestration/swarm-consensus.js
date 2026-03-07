/**
 * @file swarm-consensus.js
 * @description Raft-like Distributed Consensus for the 3-node Heady Colab cluster.
 *
 * Implements a simplified Raft consensus algorithm adapted for the 3-node
 * BRAIN / CONDUCTOR / SENTINEL cluster topology:
 * - Leader election with randomized PHI-scaled timeouts
 * - Log replication: committed entries replicate to all followers
 * - Membership changes: add/remove nodes without downtime
 * - Split-brain protection: quorum required (⌈N/2⌉ + 1 = 2 of 3 nodes)
 *
 * Wire protocol: JSON messages exchanged via the EventBus (no TCP required
 * for single-machine dev; use EventBridgeServer for multi-node).
 *
 * Sacred Geometry: PHI-scaled election timeouts, Fibonacci heartbeat intervals.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Orchestration/SwarmConsensus
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * Generate a PHI-scaled random election timeout.
 * Range: [base * PHI, base * PHI²] milliseconds.
 * For base=150ms: [~243ms, ~393ms]
 * @param {number} [base=150]
 * @returns {number} ms
 */
function electionTimeout(base = 150) {
  return Math.floor(base * PHI + Math.random() * base * (PHI * PHI - PHI));
}

/**
 * PHI-scaled exponential backoff
 * @param {number} n - attempt index
 * @param {number} [base=1000]
 * @returns {number} ms
 */
function phiBackoff(n, base = 1000) {
  return Math.min(Math.floor(Math.pow(PHI, n) * base), 55000);
}

// ─── Node States (Raft) ───────────────────────────────────────────────────────

/**
 * Raft node states
 * @enum {string}
 */
export const RaftState = Object.freeze({
  FOLLOWER:   'FOLLOWER',
  CANDIDATE:  'CANDIDATE',
  LEADER:     'LEADER',
  OFFLINE:    'OFFLINE',   // extension: graceful shutdown
});

// ─── Log Entry ────────────────────────────────────────────────────────────────

/**
 * @typedef {object} LogEntry
 * @property {number} index - 1-based log index
 * @property {number} term - Raft term
 * @property {*} command - state machine command
 * @property {string} [clientId] - originating client
 * @property {number} ts - entry creation timestamp
 */

/**
 * Create a log entry
 * @param {number} index
 * @param {number} term
 * @param {*} command
 * @param {string} [clientId]
 * @returns {LogEntry}
 */
function createEntry(index, term, command, clientId) {
  return { index, term, command, clientId, ts: Date.now() };
}

// ─── Raft Log ─────────────────────────────────────────────────────────────────

/**
 * Persistent (in-memory) Raft log with snapshots.
 */
export class RaftLog {
  constructor() {
    /** @type {LogEntry[]} */
    this._entries = [];
    this._commitIndex = 0;
    this._lastApplied = 0;
    this._snapshotIndex = 0;
    this._snapshotTerm  = 0;
  }

  /** @returns {number} last log index */
  get lastIndex() {
    return this._snapshotIndex + this._entries.length;
  }

  /** @returns {number} last log term */
  get lastTerm() {
    if (this._entries.length > 0) return this._entries[this._entries.length - 1].term;
    return this._snapshotTerm;
  }

  /** @returns {number} */
  get commitIndex() { return this._commitIndex; }

  /** @returns {number} */
  get lastApplied() { return this._lastApplied; }

  /**
   * Append entries to the log
   * @param {LogEntry[]} entries
   */
  append(entries) {
    this._entries.push(...entries);
  }

  /**
   * Get a log entry by absolute index
   * @param {number} index - 1-based absolute log index
   * @returns {LogEntry|undefined}
   */
  getEntry(index) {
    if (index <= this._snapshotIndex) return undefined;
    return this._entries[index - this._snapshotIndex - 1];
  }

  /**
   * Get entries from startIndex to endIndex (inclusive)
   * @param {number} start - inclusive
   * @param {number} [end] - inclusive, defaults to last
   * @returns {LogEntry[]}
   */
  getRange(start, end) {
    const lo = Math.max(0, start - this._snapshotIndex - 1);
    const hi = end !== undefined ? end - this._snapshotIndex : this._entries.length;
    return this._entries.slice(lo, hi);
  }

  /**
   * Delete entries from index onwards (for log correction)
   * @param {number} fromIndex
   */
  truncateFrom(fromIndex) {
    if (fromIndex <= this._snapshotIndex) return;
    this._entries = this._entries.slice(0, fromIndex - this._snapshotIndex - 1);
  }

  /**
   * Advance commit index
   * @param {number} index
   */
  commitTo(index) {
    if (index > this._commitIndex) {
      this._commitIndex = Math.min(index, this.lastIndex);
    }
  }

  /**
   * Advance lastApplied after state machine applies entry
   */
  markApplied() {
    if (this._lastApplied < this._commitIndex) {
      this._lastApplied++;
    }
  }

  /**
   * Take a snapshot at the current lastApplied position.
   * Compacts entries up to the snapshot point.
   * @param {number} snapshotTerm - term of the last entry in snapshot
   */
  snapshot(snapshotTerm) {
    const cutoff = this._lastApplied - this._snapshotIndex;
    if (cutoff > 0) {
      this._entries = this._entries.slice(cutoff);
      this._snapshotIndex = this._lastApplied;
      this._snapshotTerm  = snapshotTerm;
    }
  }

  /** Clear the entire log */
  clear() {
    this._entries = [];
    this._commitIndex = 0;
    this._lastApplied = 0;
    this._snapshotIndex = 0;
    this._snapshotTerm  = 0;
  }
}

// ─── Peer Transport ───────────────────────────────────────────────────────────

/**
 * @typedef {object} RaftMessage
 * @property {'RequestVote'|'RequestVoteReply'|'AppendEntries'|'AppendEntriesReply'|'InstallSnapshot'} type
 * @property {string} from - sender nodeId
 * @property {string} to - target nodeId
 * @property {number} term - sender's current term
 * @property {*} payload - message-type-specific data
 */

// ─── SwarmConsensus (Raft Node) ───────────────────────────────────────────────

/**
 * Raft consensus node for the Heady 3-node cluster.
 *
 * Use with an EventBus or direct message injection for unit tests.
 * For multi-machine Colab: forward messages over EventBridgeServer WebSocket mesh.
 *
 * @extends EventEmitter
 *
 * @example
 * const node = new SwarmConsensus('brain', ['conductor', 'sentinel']);
 * node.onSend((msg) => eventBus.publish(`raft.${msg.to}`, msg));
 * eventBus.subscribe('raft.brain', (ev) => node.receive(ev.data));
 * node.start();
 * await node.propose({ type: 'config.update', value: { maxBees: 34 } });
 */
export class SwarmConsensus extends EventEmitter {
  /**
   * @param {string} nodeId - this node's ID
   * @param {string[]} peers - other node IDs in the cluster
   * @param {object} [options]
   * @param {number} [options.electionBase=150] - base election timeout ms (PHI-scaled)
   * @param {number} [options.heartbeatMs=FIBONACCI[4]*10] - leader heartbeat ms (50ms)
   * @param {Function} [options.applyFn] - (command) => void, called on commit
   * @param {number} [options.maxLogEntries=FIBONACCI[11]] - compact after this many entries (144)
   */
  constructor(nodeId, peers, options = {}) {
    super();
    this._nodeId        = nodeId;
    this._peers         = [...peers];
    this._electionBase  = options.electionBase ?? 150;
    this._heartbeatMs   = options.heartbeatMs ?? FIBONACCI[4] * 10; // 50ms
    this._applyFn       = options.applyFn ?? null;
    this._maxLogEntries = options.maxLogEntries ?? FIBONACCI[11]; // 144

    // ── Persistent State (in-memory; production: persist to WAL) ──────────
    this._currentTerm  = 0;
    this._votedFor     = null; // nodeId we voted for in currentTerm
    /** @type {RaftLog} */
    this._log          = new RaftLog();

    // ── Volatile State ────────────────────────────────────────────────────
    this._state        = RaftState.FOLLOWER;
    this._leaderId     = null;
    this._votes        = new Set(); // votes received in current election

    // ── Leader volatile state ─────────────────────────────────────────────
    /** @type {Map<string, number>} peerId → nextIndex */
    this._nextIndex    = new Map();
    /** @type {Map<string, number>} peerId → matchIndex */
    this._matchIndex   = new Map();

    // Pending client proposals: index → { resolve, reject }
    /** @type {Map<number, { resolve: Function, reject: Function }>} */
    this._pendingProposals = new Map();

    // Timer handles
    this._electionTimer   = null;
    this._heartbeatTimer  = null;

    // Message send function (set by caller)
    /** @type {Function|null} (msg: RaftMessage) => void */
    this._sendFn = null;

    this._started = false;
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  /**
   * Register the send function for outbound messages.
   * @param {function(RaftMessage): void} fn
   */
  onSend(fn) { this._sendFn = fn; }

  /**
   * Deliver a Raft message to this node (called by transport layer)
   * @param {RaftMessage} msg
   */
  receive(msg) {
    if (!this._started) return;

    // If we see a higher term, revert to follower
    if (msg.term > this._currentTerm) {
      this._becomeFollower(msg.term);
    }

    switch (msg.type) {
      case 'RequestVote':        return this._handleRequestVote(msg);
      case 'RequestVoteReply':   return this._handleRequestVoteReply(msg);
      case 'AppendEntries':      return this._handleAppendEntries(msg);
      case 'AppendEntriesReply': return this._handleAppendEntriesReply(msg);
      case 'InstallSnapshot':    return this._handleInstallSnapshot(msg);
    }
  }

  /** @private */
  _send(to, type, payload) {
    if (!this._sendFn) return;
    /** @type {RaftMessage} */
    const msg = { type, from: this._nodeId, to, term: this._currentTerm, payload };
    try { this._sendFn(msg); } catch (_) {}
  }

  // ─── Election ─────────────────────────────────────────────────────────────

  /**
   * Become follower at the given term
   * @private
   * @param {number} term
   */
  _becomeFollower(term) {
    this._state      = RaftState.FOLLOWER;
    this._currentTerm = term;
    this._votedFor   = null;
    this._leaderId   = null;
    this._clearHeartbeat();
    this._resetElectionTimer();
    this.emit('state.change', { state: RaftState.FOLLOWER, term });
  }

  /**
   * Transition to CANDIDATE and start election
   * @private
   */
  _startElection() {
    this._state = RaftState.CANDIDATE;
    this._currentTerm++;
    this._votedFor = this._nodeId;
    this._votes = new Set([this._nodeId]); // vote for self
    this._resetElectionTimer();

    this.emit('election.started', { term: this._currentTerm, nodeId: this._nodeId });

    // Send RequestVote to all peers
    for (const peer of this._peers) {
      this._send(peer, 'RequestVote', {
        candidateId:  this._nodeId,
        lastLogIndex: this._log.lastIndex,
        lastLogTerm:  this._log.lastTerm,
      });
    }
  }

  /** @private */
  _handleRequestVote(msg) {
    const { candidateId, lastLogIndex, lastLogTerm } = msg.payload;
    let granted = false;

    if (msg.term < this._currentTerm) {
      // Stale term — reject
    } else if (
      (this._votedFor === null || this._votedFor === candidateId) &&
      this._isLogUpToDate(lastLogIndex, lastLogTerm)
    ) {
      granted = true;
      this._votedFor = candidateId;
      this._resetElectionTimer(); // extend timeout on vote
    }

    this._send(msg.from, 'RequestVoteReply', { voteGranted: granted });
  }

  /** @private */
  _handleRequestVoteReply(msg) {
    if (this._state !== RaftState.CANDIDATE) return;
    if (msg.payload.voteGranted) {
      this._votes.add(msg.from);
    }
    const quorum = Math.floor((this._peers.length + 1) / 2) + 1; // majority
    if (this._votes.size >= quorum) {
      this._becomeLeader();
    }
  }

  /**
   * Check if candidate's log is at least as up-to-date as ours
   * @private
   */
  _isLogUpToDate(lastIndex, lastTerm) {
    if (lastTerm !== this._log.lastTerm) return lastTerm > this._log.lastTerm;
    return lastIndex >= this._log.lastIndex;
  }

  /**
   * Transition to LEADER
   * @private
   */
  _becomeLeader() {
    this._state    = RaftState.LEADER;
    this._leaderId = this._nodeId;
    this._clearElectionTimer();

    // Initialize follower tracking
    for (const peer of this._peers) {
      this._nextIndex.set(peer, this._log.lastIndex + 1);
      this._matchIndex.set(peer, 0);
    }

    this.emit('leader.elected', { leaderId: this._nodeId, term: this._currentTerm });
    this.emit('state.change', { state: RaftState.LEADER, term: this._currentTerm });

    // Start sending heartbeats
    this._startHeartbeat();
    // Send initial empty AppendEntries to assert leadership
    this._broadcastAppendEntries();
  }

  // ─── Log Replication ──────────────────────────────────────────────────────

  /**
   * Broadcast AppendEntries (heartbeat or with new entries) to all peers
   * @private
   */
  _broadcastAppendEntries() {
    for (const peer of this._peers) {
      this._sendAppendEntries(peer);
    }
  }

  /** @private */
  _sendAppendEntries(peerId) {
    const nextIdx  = this._nextIndex.get(peerId) ?? 1;
    const prevIdx  = nextIdx - 1;
    const prevEntry = prevIdx > 0 ? this._log.getEntry(prevIdx) : null;
    const entries  = this._log.getRange(nextIdx);

    this._send(peerId, 'AppendEntries', {
      leaderId:      this._nodeId,
      prevLogIndex:  prevIdx,
      prevLogTerm:   prevEntry?.term ?? 0,
      entries,
      leaderCommit:  this._log.commitIndex,
    });
  }

  /** @private */
  _handleAppendEntries(msg) {
    const { leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = msg.payload;

    if (msg.term < this._currentTerm) {
      this._send(msg.from, 'AppendEntriesReply', { success: false, matchIndex: 0 });
      return;
    }

    // Valid leader — reset election timer
    this._state    = RaftState.FOLLOWER;
    this._leaderId = leaderId;
    this._resetElectionTimer();

    // Consistency check
    if (prevLogIndex > 0) {
      const prevEntry = this._log.getEntry(prevLogIndex);
      if (!prevEntry || prevEntry.term !== prevLogTerm) {
        this._send(msg.from, 'AppendEntriesReply', { success: false, matchIndex: this._log.lastIndex });
        return;
      }
    }

    // Apply entries
    if (entries && entries.length > 0) {
      // Truncate conflicting entries
      const firstNew = entries[0];
      const existing = firstNew ? this._log.getEntry(firstNew.index) : null;
      if (existing && existing.term !== firstNew.term) {
        this._log.truncateFrom(firstNew.index);
      }
      // Append new entries (skip already-present ones)
      const toAppend = entries.filter((e) => e.index > this._log.lastIndex);
      if (toAppend.length > 0) this._log.append(toAppend);
    }

    // Update commitIndex
    if (leaderCommit > this._log.commitIndex) {
      this._log.commitTo(Math.min(leaderCommit, this._log.lastIndex));
      this._applyCommitted();
    }

    this._send(msg.from, 'AppendEntriesReply', { success: true, matchIndex: this._log.lastIndex });

    // Auto-compact if log grows too large
    if (this._log.lastIndex - this._log._snapshotIndex > this._maxLogEntries) {
      this._log.snapshot(this._currentTerm);
    }
  }

  /** @private */
  _handleAppendEntriesReply(msg) {
    if (this._state !== RaftState.LEADER) return;
    const { success, matchIndex } = msg.payload;

    if (success) {
      this._matchIndex.set(msg.from, matchIndex);
      this._nextIndex.set(msg.from, matchIndex + 1);
      this._advanceCommitIndex();
    } else {
      // Decrement nextIndex and retry (back-off by 1)
      const ni = this._nextIndex.get(msg.from) ?? 1;
      this._nextIndex.set(msg.from, Math.max(1, ni - 1));
      this._sendAppendEntries(msg.from); // immediate retry
    }
  }

  /**
   * Advance leader's commitIndex if a majority has replicated the entry.
   * Prevents split-brain: only commit entries from the current term.
   * @private
   */
  _advanceCommitIndex() {
    const n = this._log.lastIndex;
    const quorum = Math.floor((this._peers.length + 1) / 2) + 1;

    for (let idx = n; idx > this._log.commitIndex; idx--) {
      const entry = this._log.getEntry(idx);
      if (!entry || entry.term !== this._currentTerm) continue;

      // Count replications (self + peers with matchIndex >= idx)
      let replicatedOn = 1; // leader itself
      for (const mi of this._matchIndex.values()) {
        if (mi >= idx) replicatedOn++;
      }

      if (replicatedOn >= quorum) {
        this._log.commitTo(idx);
        this._applyCommitted();
        break;
      }
    }
  }

  /** @private */
  _applyCommitted() {
    while (this._log.lastApplied < this._log.commitIndex) {
      this._log.markApplied();
      const entry = this._log.getEntry(this._log.lastApplied);
      if (entry) {
        try { this._applyFn?.(entry.command); } catch (_) {}
        this.emit('entry.applied', { entry });

        // Resolve pending client proposals
        const pending = this._pendingProposals.get(entry.index);
        if (pending) {
          this._pendingProposals.delete(entry.index);
          pending.resolve(entry);
        }
      }
    }
  }

  // ─── Snapshot Install ─────────────────────────────────────────────────────

  /** @private */
  _handleInstallSnapshot(msg) {
    const { lastIncludedIndex, lastIncludedTerm, data } = msg.payload;
    if (msg.term < this._currentTerm) return;

    // Accept snapshot if it's newer
    if (lastIncludedIndex > this._log._snapshotIndex) {
      this._log.clear();
      this._log._snapshotIndex = lastIncludedIndex;
      this._log._snapshotTerm  = lastIncludedTerm;
      this._log._commitIndex   = lastIncludedIndex;
      this._log._lastApplied   = lastIncludedIndex;
      this.emit('snapshot.installed', { lastIncludedIndex, lastIncludedTerm, data });
    }
    this._send(msg.from, 'AppendEntriesReply', { success: true, matchIndex: lastIncludedIndex });
  }

  // ─── Client API ───────────────────────────────────────────────────────────

  /**
   * Propose a command to the state machine.
   * Must be called on the leader node; rejects with LeaderRedirect if not leader.
   *
   * @param {*} command - command to apply
   * @param {string} [clientId]
   * @returns {Promise<LogEntry>} resolves when the entry is committed and applied
   */
  propose(command, clientId) {
    return new Promise((resolve, reject) => {
      if (this._state !== RaftState.LEADER) {
        return reject(Object.assign(
          new Error(`Not leader; current leader: ${this._leaderId}`),
          { code: 'NOT_LEADER', leaderId: this._leaderId }
        ));
      }

      const index = this._log.lastIndex + 1;
      const entry = createEntry(index, this._currentTerm, command, clientId);
      this._log.append([entry]);
      this._pendingProposals.set(index, { resolve, reject });
      this._broadcastAppendEntries();

      // Proposal timeout: FIBONACCI[8]*1000 = 34s
      setTimeout(() => {
        if (this._pendingProposals.has(index)) {
          this._pendingProposals.delete(index);
          reject(new Error(`Proposal at index ${index} timed out`));
        }
      }, FIBONACCI[8] * 1000);
    });
  }

  // ─── Membership Changes ───────────────────────────────────────────────────

  /**
   * Add a new peer to the cluster (joint consensus — simplified single-phase).
   * @param {string} peerId
   * @returns {Promise<void>}
   */
  async addPeer(peerId) {
    if (this._peers.includes(peerId)) return;
    await this.propose({ type: 'membership.add', nodeId: peerId });
    this._peers.push(peerId);
    if (this._state === RaftState.LEADER) {
      this._nextIndex.set(peerId, this._log.lastIndex + 1);
      this._matchIndex.set(peerId, 0);
    }
    this.emit('membership.changed', { type: 'add', nodeId: peerId, peers: [...this._peers] });
  }

  /**
   * Remove a peer from the cluster.
   * @param {string} peerId
   * @returns {Promise<void>}
   */
  async removePeer(peerId) {
    if (!this._peers.includes(peerId)) return;
    await this.propose({ type: 'membership.remove', nodeId: peerId });
    this._peers = this._peers.filter((p) => p !== peerId);
    this._nextIndex.delete(peerId);
    this._matchIndex.delete(peerId);
    this.emit('membership.changed', { type: 'remove', nodeId: peerId, peers: [...this._peers] });
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  /** @private */
  _resetElectionTimer() {
    this._clearElectionTimer();
    const timeout = electionTimeout(this._electionBase);
    this._electionTimer = setTimeout(() => {
      if (this._state !== RaftState.LEADER) {
        this.emit('election.timeout', { nodeId: this._nodeId, term: this._currentTerm });
        this._startElection();
      }
    }, timeout);
  }

  /** @private */
  _clearElectionTimer() {
    if (this._electionTimer) {
      clearTimeout(this._electionTimer);
      this._electionTimer = null;
    }
  }

  /** @private */
  _startHeartbeat() {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._state === RaftState.LEADER) {
        this._broadcastAppendEntries();
      } else {
        this._clearHeartbeat();
      }
    }, this._heartbeatMs);
    if (this._heartbeatTimer.unref) this._heartbeatTimer.unref();
  }

  /** @private */
  _clearHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start the consensus node.
   * Begins as FOLLOWER and starts the election timer.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._state = RaftState.FOLLOWER;
    this._resetElectionTimer();
    this.emit('node.started', { nodeId: this._nodeId, peers: this._peers });
  }

  /**
   * Gracefully shut down this consensus node.
   * Steps down as leader if applicable.
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    this._state = RaftState.OFFLINE;
    this._clearElectionTimer();
    this._clearHeartbeat();

    // Reject all pending proposals
    for (const [idx, pending] of this._pendingProposals) {
      pending.reject(new Error('Consensus node shut down'));
    }
    this._pendingProposals.clear();
    this.emit('node.stopped', { nodeId: this._nodeId });
  }

  // ─── Split-Brain Protection ───────────────────────────────────────────────

  /**
   * Check if the cluster is in a healthy quorum state.
   * Returns false if a split-brain condition is suspected.
   * @returns {boolean}
   */
  isHealthyQuorum() {
    if (this._state !== RaftState.LEADER) return this._leaderId !== null;
    // Leader: check that we have recent contact with a majority
    const now = Date.now();
    const quorum = Math.floor((this._peers.length + 1) / 2) + 1;
    // In a real impl, we'd track last-contact timestamps; here we use matchIndex > 0
    const activePeers = [...this._matchIndex.values()].filter((m) => m > 0).length;
    return activePeers + 1 >= quorum; // +1 for self
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} consensus node status */
  get status() {
    return {
      nodeId:      this._nodeId,
      state:       this._state,
      currentTerm: this._currentTerm,
      votedFor:    this._votedFor,
      leaderId:    this._leaderId,
      peers:       [...this._peers],
      log: {
        lastIndex:    this._log.lastIndex,
        lastTerm:     this._log.lastTerm,
        commitIndex:  this._log.commitIndex,
        lastApplied:  this._log.lastApplied,
        snapshotIndex:this._log._snapshotIndex,
      },
      pendingProposals: this._pendingProposals.size,
      healthyQuorum:    this.isHealthyQuorum(),
      phi:         PHI,
    };
  }
}

// ─── Multi-Node Cluster Factory ───────────────────────────────────────────────

/**
 * Create a local in-process 3-node Raft cluster (for testing or single-machine Colab).
 * All nodes communicate via direct function calls (no network overhead).
 *
 * @param {object} [options]
 * @param {Function} [options.applyFn] - state machine apply function
 * @returns {{ brain: SwarmConsensus, conductor: SwarmConsensus, sentinel: SwarmConsensus }}
 */
export function createLocalCluster(options = {}) {
  const nodeIds = ['brain', 'conductor', 'sentinel'];
  const nodes = {};

  for (const id of nodeIds) {
    const peers = nodeIds.filter((n) => n !== id);
    nodes[id] = new SwarmConsensus(id, peers, {
      applyFn: options.applyFn,
    });
  }

  // Wire direct message passing between nodes
  for (const id of nodeIds) {
    nodes[id].onSend((msg) => {
      const target = nodes[msg.to];
      if (target) {
        setImmediate(() => target.receive(msg));
      }
    });
  }

  return nodes;
}

/**
 * Start all nodes in a local cluster
 * @param {object} cluster - { brain, conductor, sentinel }
 */
export function startLocalCluster(cluster) {
  for (const node of Object.values(cluster)) {
    node.start();
  }
}

/**
 * Shut down all nodes in a local cluster
 * @param {object} cluster
 */
export async function shutdownLocalCluster(cluster) {
  for (const node of Object.values(cluster)) {
    await node.shutdown();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, phiBackoff, electionTimeout };

export default {
  SwarmConsensus,
  RaftLog,
  RaftState,
  createLocalCluster,
  startLocalCluster,
  shutdownLocalCluster,
  PHI,
  FIBONACCI,
  phiBackoff,
  electionTimeout,
};
