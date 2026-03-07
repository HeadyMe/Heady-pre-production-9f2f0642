/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: 17-Swarm Decentralized Orchestration

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── The 17 Canonical Swarms ──────────────────────────────────────────────────

const SWARM_NAMES = [
  'Deploy',
  'Battle',
  'Research',
  'Security',
  'Memory',
  'Creative',
  'Trading',
  'Health',
  'Governance',
  'Documentation',
  'Testing',
  'Migration',
  'Monitoring',
  'Cleanup',
  'Onboarding',
  'Analytics',
  'Emergency',
];

// Priority levels: higher = more urgent
const PRIORITY = {
  EMERGENCY:  100,
  CRITICAL:    80,
  HIGH:        60,
  NORMAL:      40,
  LOW:         20,
  BACKGROUND:  10,
};

// Default priorities per swarm
const SWARM_PRIORITIES = {
  Emergency:     PRIORITY.EMERGENCY,
  Security:      PRIORITY.CRITICAL,
  Health:        PRIORITY.CRITICAL,
  Deploy:        PRIORITY.HIGH,
  Migration:     PRIORITY.HIGH,
  Monitoring:    PRIORITY.HIGH,
  Governance:    PRIORITY.NORMAL,
  Testing:       PRIORITY.NORMAL,
  Battle:        PRIORITY.NORMAL,
  Research:      PRIORITY.NORMAL,
  Memory:        PRIORITY.NORMAL,
  Trading:       PRIORITY.NORMAL,
  Creative:      PRIORITY.LOW,
  Documentation: PRIORITY.LOW,
  Analytics:     PRIORITY.LOW,
  Cleanup:       PRIORITY.BACKGROUND,
  Onboarding:    PRIORITY.BACKGROUND,
};

const SWARM_STATUS = {
  IDLE:       'idle',
  ACTIVE:     'active',
  PAUSED:     'paused',
  ERROR:      'error',
  OVERLOADED: 'overloaded',
};

const MESSAGE_TYPE = {
  TASK:        'task',
  RESULT:      'result',
  BROADCAST:   'broadcast',
  CONSENSUS:   'consensus',
  HEARTBEAT:   'heartbeat',
  ESCALATION:  'escalation',
  SYNC:        'sync',
};

// ─── SwarmTask ────────────────────────────────────────────────────────────────

class SwarmTask {
  constructor(opts = {}) {
    this.id         = opts.id       || crypto.randomUUID();
    this.type       = opts.type     || 'generic';
    this.payload    = opts.payload  || {};
    this.priority   = opts.priority || PRIORITY.NORMAL;
    this.targetSwarm = opts.targetSwarm || null;
    this.sourceSwarm = opts.sourceSwarm || null;
    this.createdAt  = Date.now();
    this.deadline   = opts.deadline || null;
    this.ttlMs      = opts.ttlMs    || 60000;
    this.metadata   = opts.metadata || {};
    this.status     = 'pending';
    this.result     = null;
    this.error      = null;
    this.startedAt  = null;
    this.completedAt = null;
  }

  isExpired() {
    return this.ttlMs && Date.now() - this.createdAt > this.ttlMs;
  }

  complete(result) {
    this.status      = 'completed';
    this.result      = result;
    this.completedAt = Date.now();
    return this;
  }

  fail(error) {
    this.status   = 'failed';
    this.error    = error instanceof Error ? error.message : String(error);
    this.completedAt = Date.now();
    return this;
  }

  getDuration() {
    if (!this.completedAt || !this.startedAt) return null;
    return this.completedAt - this.startedAt;
  }
}

// ─── SwarmMessage ─────────────────────────────────────────────────────────────

class SwarmMessage {
  constructor(opts = {}) {
    this.id       = opts.id   || crypto.randomUUID();
    this.type     = opts.type || MESSAGE_TYPE.BROADCAST;
    this.from     = opts.from;
    this.to       = opts.to   || null; // null = broadcast
    this.payload  = opts.payload || {};
    this.ts       = Date.now();
    this.priority = opts.priority || PRIORITY.NORMAL;
  }
}

// ─── SwarmBus (inter-swarm communication) ────────────────────────────────────

class SwarmBus {
  constructor() {
    this._queues    = new Map();  // swarmName → Message[]
    this._listeners = new Map();  // swarmName → fn[]
    this._history   = [];
    this._maxHistory = 10000;
  }

  register(swarmName) {
    if (!this._queues.has(swarmName))    this._queues.set(swarmName, []);
    if (!this._listeners.has(swarmName)) this._listeners.set(swarmName, []);
    return this;
  }

  /**
   * Send a message to a specific swarm or broadcast to all.
   */
  send(message) {
    const msg = message instanceof SwarmMessage ? message : new SwarmMessage(message);
    this._history.push(msg);
    if (this._history.length > this._maxHistory) this._history.shift();

    if (msg.to) {
      // Direct
      const q = this._queues.get(msg.to);
      if (q) q.push(msg);
      const listeners = this._listeners.get(msg.to) || [];
      for (const fn of listeners) fn(msg);
    } else {
      // Broadcast to all except sender
      for (const [name, q] of this._queues.entries()) {
        if (name !== msg.from) {
          q.push(msg);
          const listeners = this._listeners.get(name) || [];
          for (const fn of listeners) fn(msg);
        }
      }
    }
    return this;
  }

  /**
   * Drain messages for a swarm.
   */
  drain(swarmName) {
    const q = this._queues.get(swarmName) || [];
    this._queues.set(swarmName, []);
    return q;
  }

  /**
   * Register a listener for a swarm.
   */
  subscribe(swarmName, fn) {
    if (!this._listeners.has(swarmName)) this._listeners.set(swarmName, []);
    this._listeners.get(swarmName).push(fn);
    return () => this.unsubscribe(swarmName, fn);
  }

  unsubscribe(swarmName, fn) {
    const listeners = this._listeners.get(swarmName);
    if (listeners) this._listeners.set(swarmName, listeners.filter(l => l !== fn));
    return this;
  }

  getHistory(filter = {}) {
    return this._history.filter(m => {
      if (filter.from && m.from !== filter.from) return false;
      if (filter.to   && m.to   !== filter.to)   return false;
      if (filter.type && m.type !== filter.type)  return false;
      if (filter.since && m.ts < filter.since)   return false;
      return true;
    });
  }

  getQueueDepth(swarmName) { return (this._queues.get(swarmName) || []).length; }
}

// ─── Swarm ────────────────────────────────────────────────────────────────────

class Swarm {
  constructor(name, opts = {}) {
    this.name       = name;
    this.id         = opts.id       || crypto.randomUUID();
    this.priority   = opts.priority || SWARM_PRIORITIES[name] || PRIORITY.NORMAL;
    this.status     = SWARM_STATUS.IDLE;
    this._bus       = null;
    this._handlers  = {};   // task type → async fn
    this._queue     = [];   // pending SwarmTasks
    this._active    = [];   // in-flight SwarmTasks
    this._completed = [];
    this._maxConcurrency = opts.maxConcurrency || 5;
    this._maxQueue       = opts.maxQueue       || 100;
    this._stats          = { received: 0, completed: 0, failed: 0, escalated: 0 };
    this._heartbeatMs    = opts.heartbeatMs || Math.round(5000 * (1 + (this.priority / 200)));
    this._heartbeatTimer = null;
    this._capabilities   = opts.capabilities || [name.toLowerCase()];
    this._callbacks      = { task: [], complete: [], error: [] };
  }

  connectBus(bus) {
    this._bus = bus;
    bus.register(this.name);
    bus.subscribe(this.name, msg => this._onMessage(msg));
    return this;
  }

  /**
   * Register a handler for a task type.
   */
  on(taskType, fn) {
    this._handlers[taskType] = fn;
    return this;
  }

  /**
   * Submit a task to this swarm.
   */
  submit(task) {
    const t = task instanceof SwarmTask ? task : new SwarmTask({ ...task, targetSwarm: this.name });
    if (this._queue.length >= this._maxQueue) {
      // Evict lowest priority task if new one is higher
      this._queue.sort((a, b) => a.priority - b.priority);
      if (this._queue[0].priority < t.priority) {
        const evicted = this._queue.shift();
        evicted.fail(new Error('Queue overflow - evicted'));
      } else {
        t.fail(new Error('Swarm queue full'));
        return t;
      }
    }
    this._stats.received++;
    this._queue.push(t);
    this._queue.sort((a, b) => b.priority - a.priority); // highest priority first
    this._drain();
    return t;
  }

  async _drain() {
    while (this._queue.length > 0 && this._active.length < this._maxConcurrency) {
      const task = this._queue.shift();
      if (task.isExpired()) { task.fail(new Error('Task TTL expired')); continue; }

      this._active.push(task);
      task.startedAt = Date.now();
      task.status    = 'running';
      this.status    = SWARM_STATUS.ACTIVE;
      this._emit('task', task);

      this._executeTask(task).then(result => {
        task.complete(result);
        this._stats.completed++;
        this._emit('complete', task);
        this._finishTask(task);
      }).catch(err => {
        task.fail(err);
        this._stats.failed++;
        this._emit('error', task);
        this._finishTask(task);

        // Escalate to Emergency swarm if critical
        if (this._bus && task.priority >= PRIORITY.HIGH) {
          this._stats.escalated++;
          this._bus.send({
            type:    MESSAGE_TYPE.ESCALATION,
            from:    this.name,
            to:      'Emergency',
            payload: { taskId: task.id, error: task.error, priority: task.priority },
            priority: PRIORITY.CRITICAL,
          });
        }
      });
    }

    if (this._active.length === 0 && this._queue.length === 0) {
      this.status = SWARM_STATUS.IDLE;
    }
  }

  async _executeTask(task) {
    const handler = this._handlers[task.type] || this._handlers['*'];
    if (!handler) {
      throw new Error(`No handler registered for task type '${task.type}' in swarm '${this.name}'`);
    }
    return handler(task, this);
  }

  _finishTask(task) {
    this._active = this._active.filter(t => t.id !== task.id);
    this._completed.push(task);
    if (this._completed.length > 1000) this._completed.shift();

    // Reply if there's a target bus recipient
    if (this._bus && task.sourceSwarm) {
      this._bus.send({
        type:    MESSAGE_TYPE.RESULT,
        from:    this.name,
        to:      task.sourceSwarm,
        payload: { taskId: task.id, status: task.status, result: task.result, error: task.error },
        priority: task.priority,
      });
    }
    this._drain();
  }

  _onMessage(msg) {
    switch (msg.type) {
      case MESSAGE_TYPE.TASK:
        this.submit(new SwarmTask({
          ...msg.payload,
          sourceSwarm: msg.from,
          targetSwarm: this.name,
        }));
        break;
      case MESSAGE_TYPE.HEARTBEAT:
        // Record heartbeat from peer (no reply to avoid feedback loops)
        break;
      case MESSAGE_TYPE.BROADCAST:
        // Optionally handle broadcasts
        break;
    }
  }

  startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      if (this._bus) {
        this._bus.send({
          type:    MESSAGE_TYPE.HEARTBEAT,
          from:    this.name,
          payload: this.getStatus(),
          priority: PRIORITY.LOW,
        });
      }
    }, this._heartbeatMs);
    if (this._heartbeatTimer.unref) this._heartbeatTimer.unref();
    return this;
  }

  stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    return this;
  }

  pause()  { this.status = SWARM_STATUS.PAUSED;  return this; }
  resume() { this.status = SWARM_STATUS.IDLE; this._drain(); return this; }

  getStatus() {
    return {
      name:        this.name,
      id:          this.id,
      status:      this.status,
      priority:    this.priority,
      queue:       this._queue.length,
      active:      this._active.length,
      capabilities: this._capabilities,
      stats:       { ...this._stats },
    };
  }

  getCompletedTasks() { return this._completed.slice(); }
  getQueueDepth()     { return this._queue.length; }
  getActiveCount()    { return this._active.length; }

  _emit(event, data) {
    for (const fn of (this._callbacks[event] || [])) fn(data);
  }
  onChange(event, fn) { if (this._callbacks[event]) this._callbacks[event].push(fn); return this; }
}

// ─── ConsensusManager ────────────────────────────────────────────────────────

class ConsensusManager {
  /**
   * Aggregate decisions from multiple swarms using φ-weighted voting.
   */
  constructor(opts = {}) {
    this._quorum     = opts.quorum     || 0.5;  // fraction of swarms that must agree
    this._timeout    = opts.timeoutMs  || 10000;
    this._proposals  = new Map();  // proposalId → { votes, result }
  }

  /**
   * Create a consensus proposal.
   */
  propose(proposalId, data, participants) {
    this._proposals.set(proposalId, {
      data,
      participants: participants.slice(),
      votes: new Map(),
      createdAt: Date.now(),
      resolved: false,
    });
    return proposalId;
  }

  /**
   * Record a vote from a swarm.
   */
  vote(proposalId, swarmName, decision, weight = 1.0) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) return null;
    if (proposal.resolved) return proposal.result;  // return existing result on late votes
    proposal.votes.set(swarmName, { decision, weight });
    return this._tryResolve(proposalId);
  }

  _tryResolve(proposalId) {
    const proposal = this._proposals.get(proposalId);
    const total    = proposal.participants.length;
    const voted    = proposal.votes.size;

    if (voted < Math.ceil(total * this._quorum)) return null;

    // Tally with φ-weighted scores
    const tally = {};
    let totalWeight = 0;
    for (const [swarm, { decision, weight }] of proposal.votes) {
      // Weight by swarm priority
      const priorityWeight = (SWARM_PRIORITIES[swarm] || PRIORITY.NORMAL) / PRIORITY.EMERGENCY;
      const effectiveWeight = weight * priorityWeight * PHI;
      tally[decision] = (tally[decision] || 0) + effectiveWeight;
      totalWeight += effectiveWeight;
    }

    // Find winning decision
    let winner = null, maxScore = -1;
    for (const [dec, score] of Object.entries(tally)) {
      if (score > maxScore) { winner = dec; maxScore = score; }
    }

    const confidence = maxScore / totalWeight;
    proposal.resolved = true;
    proposal.result   = { decision: winner, confidence, tally, voted, total };
    return proposal.result;
  }

  getProposal(proposalId) { return this._proposals.get(proposalId) || null; }

  /**
   * Await consensus with timeout.
   */
  async waitForConsensus(proposalId) {
    return new Promise((resolve, reject) => {
      const start   = Date.now();
      const check   = setInterval(() => {
        const p = this._proposals.get(proposalId);
        if (!p) { clearInterval(check); reject(new Error('Proposal not found')); return; }
        if (p.resolved) { clearInterval(check); resolve(p.result); return; }
        if (Date.now() - start > this._timeout) {
          clearInterval(check);
          reject(new Error(`Consensus timeout for proposal '${proposalId}'`));
        }
      }, 50);
    });
  }
}

// ─── SwarmOrchestrator ────────────────────────────────────────────────────────

class SwarmOrchestrator {
  /**
   * Manages all 17 canonical swarms with inter-swarm comms,
   * priority-based scheduling, and consensus support.
   */
  constructor(opts = {}) {
    this._bus          = new SwarmBus();
    this._swarms       = new Map();
    this._consensus    = new ConsensusManager(opts.consensusOpts || {});
    this._schedulerMs  = opts.schedulerMs || Math.round(1000 / PHI);
    this._schedulerTimer = null;
    this._auditLog     = [];
    this._maxAudit     = opts.maxAuditEntries || 50000;
    this._initialized  = false;
    this._taskRouter   = opts.taskRouter || null;

    // Initialize all 17 swarms
    for (const name of SWARM_NAMES) {
      this._createSwarm(name, opts.swarmOpts?.[name] || {});
    }
  }

  _createSwarm(name, opts = {}) {
    const swarm = new Swarm(name, {
      priority: SWARM_PRIORITIES[name] || PRIORITY.NORMAL,
      ...opts,
    });
    swarm.connectBus(this._bus);
    this._swarms.set(name, swarm);

    // Default handlers per swarm type
    this._installDefaultHandlers(swarm);

    swarm.onChange('complete', task => this._audit('task_complete', { swarm: name, taskId: task.id, durationMs: task.getDuration() }));
    swarm.onChange('error',    task => this._audit('task_error',    { swarm: name, taskId: task.id, error: task.error }));

    return swarm;
  }

  _installDefaultHandlers(swarm) {
    // Each swarm handles its own type by default (passthrough with logging)
    swarm.on('*', async (task, s) => {
      // Default: noop passthrough
      return { processed: true, swarm: s.name, taskId: task.id };
    });

    // Specific default behaviors
    switch (swarm.name) {
      case 'Health':
        swarm.on('health_check', async (task) => ({
          ok: true, ts: Date.now(), metrics: { uptime: process.uptime(), memory: process.memoryUsage() }
        }));
        break;

      case 'Monitoring':
        swarm.on('get_status', async (task, s) => ({
          swarms: Array.from(this._swarms.values()).map(sw => sw.getStatus()),
          bus:    { queueDepths: SWARM_NAMES.reduce((acc, n) => { acc[n] = this._bus.getQueueDepth(n); return acc; }, {}) },
        }));
        break;

      case 'Cleanup':
        swarm.on('cleanup', async (task) => {
          // Trim completed task history across swarms
          let cleaned = 0;
          for (const sw of this._swarms.values()) {
            const before = sw._completed.length;
            sw._completed.splice(0, Math.floor(before / 2));
            cleaned += before - sw._completed.length;
          }
          return { cleaned };
        });
        break;

      case 'Emergency':
        swarm.on('*', async (task) => {
          this._audit('emergency', { taskId: task.id, priority: task.priority, payload: task.payload });
          // Broadcast emergency to all swarms
          this._bus.send({
            type:    MESSAGE_TYPE.BROADCAST,
            from:    'Emergency',
            payload: { emergency: true, taskId: task.id, payload: task.payload },
            priority: PRIORITY.EMERGENCY,
          });
          return { acknowledged: true, ts: Date.now() };
        });
        break;

      case 'Governance':
        swarm.on('consensus', async (task) => {
          const { proposalId, participants, data } = task.payload;
          this._consensus.propose(proposalId, data, participants || SWARM_NAMES);
          return { proposed: proposalId };
        });
        swarm.on('vote', async (task) => {
          const { proposalId, swarmName, decision, weight } = task.payload;
          const result = this._consensus.vote(proposalId, swarmName, decision, weight);
          return { proposalId, result };
        });
        break;

      case 'Analytics':
        swarm.on('get_metrics', async (task) => {
          const metrics = {};
          for (const [name, sw] of this._swarms.entries()) {
            metrics[name] = sw.getStatus().stats;
          }
          return { metrics, ts: Date.now(), totalTasks: this._getTotalTasks() };
        });
        break;
    }
  }

  /**
   * Start the orchestrator: activate all swarms and begin scheduling.
   */
  start() {
    for (const swarm of this._swarms.values()) {
      swarm.startHeartbeat();
    }
    this._schedulerTimer = setInterval(() => this._schedulerTick(), this._schedulerMs);
    if (this._schedulerTimer.unref) this._schedulerTimer.unref();
    this._initialized = true;
    this._audit('orchestrator_start', { swarms: SWARM_NAMES.length });
    return this;
  }

  /**
   * Stop the orchestrator.
   */
  stop() {
    if (this._schedulerTimer) { clearInterval(this._schedulerTimer); this._schedulerTimer = null; }
    for (const swarm of this._swarms.values()) swarm.stopHeartbeat();
    this._initialized = false;
    this._audit('orchestrator_stop', {});
    return this;
  }

  _schedulerTick() {
    // Priority-based: check overloaded swarms, rebalance tasks
    for (const [name, swarm] of this._swarms.entries()) {
      if (swarm.status === SWARM_STATUS.ERROR) swarm.status = SWARM_STATUS.IDLE;
      const qd = swarm.getQueueDepth();
      if (qd > 50) swarm.status = SWARM_STATUS.OVERLOADED;
    }
  }

  /**
   * Route a task to the appropriate swarm.
   */
  dispatch(taskOpts) {
    const task = taskOpts instanceof SwarmTask ? taskOpts : new SwarmTask(taskOpts);

    // Custom router if provided
    if (this._taskRouter) {
      const target = this._taskRouter(task, this._swarms);
      if (target) return target.submit(task);
    }

    // Auto-route to target swarm
    if (task.targetSwarm && this._swarms.has(task.targetSwarm)) {
      return this._swarms.get(task.targetSwarm).submit(task);
    }

    // Route by task type prefix matching swarm names
    for (const name of SWARM_NAMES) {
      if (task.type.toLowerCase().includes(name.toLowerCase())) {
        return this._swarms.get(name).submit(task);
      }
    }

    // Default: Memory swarm for generic tasks
    return this._swarms.get('Memory').submit(task);
  }

  /**
   * Broadcast to all swarms.
   */
  broadcast(payload, type = MESSAGE_TYPE.BROADCAST, priority = PRIORITY.NORMAL) {
    this._bus.send({ type, from: 'Orchestrator', payload, priority });
    return this;
  }

  /**
   * Run a cross-swarm consensus vote.
   */
  async runConsensus(proposal, participants = null, timeoutMs = 10000) {
    const proposalId  = crypto.randomUUID();
    const swarmList   = participants || SWARM_NAMES;
    this._consensus.propose(proposalId, proposal, swarmList);

    // Ask the Governance swarm to cast a vote on behalf of each participant
    const governance = this._swarms.get('Governance');
    for (const swarmName of swarmList) {
      const swarm = this._swarms.get(swarmName);
      if (!swarm || !governance) continue;
      governance.submit(new SwarmTask({
        type:        'vote',
        targetSwarm: 'Governance',
        sourceSwarm: swarmName,
        payload:     { proposalId, swarmName, decision: 'approve', weight: swarm.priority / PRIORITY.EMERGENCY },
        priority:    PRIORITY.HIGH,
      }));
    }

    return this._consensus.waitForConsensus(proposalId);
  }

  getSwarm(name)    { return this._swarms.get(name) || null; }
  getAllSwarms()     { return new Map(this._swarms); }
  listSwarmNames()  { return SWARM_NAMES.slice(); }

  getStatus() {
    return {
      initialized: this._initialized,
      swarms:      SWARM_NAMES.map(n => this._swarms.get(n).getStatus()),
      busHistory:  this._bus.getHistory({ since: Date.now() - 60000 }).length,
      totalTasks:  this._getTotalTasks(),
    };
  }

  _getTotalTasks() {
    let total = 0;
    for (const sw of this._swarms.values()) total += sw.getStatus().stats.received;
    return total;
  }

  getAuditLog(filter = {}) {
    return this._auditLog.filter(e => {
      if (filter.action && e.action !== filter.action) return false;
      if (filter.since && e.ts < filter.since) return false;
      return true;
    });
  }

  _audit(action, data) {
    this._auditLog.push({ action, data, ts: Date.now() });
    if (this._auditLog.length > this._maxAudit) this._auditLog.shift();
  }

  getBus()      { return this._bus; }
  getConsensus(){ return this._consensus; }

  /**
   * Register a custom handler on a specific swarm.
   */
  registerHandler(swarmName, taskType, fn) {
    const swarm = this._swarms.get(swarmName);
    if (!swarm) throw new Error(`Swarm '${swarmName}' not found`);
    swarm.on(taskType, fn);
    return this;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  SWARM_NAMES,
  PRIORITY,
  SWARM_PRIORITIES,
  SWARM_STATUS,
  MESSAGE_TYPE,
  SwarmTask,
  SwarmMessage,
  SwarmBus,
  Swarm,
  ConsensusManager,
  SwarmOrchestrator,
};
