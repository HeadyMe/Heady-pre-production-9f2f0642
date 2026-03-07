/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Battle Arena Competitive Evaluation Protocol

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── Scoring Rubrics ──────────────────────────────────────────────────────────

const DEFAULT_RUBRIC = {
  accuracy:    { weight: 0.30, description: 'Factual correctness' },
  reasoning:   { weight: 0.25, description: 'Logical coherence and depth' },
  creativity:  { weight: 0.20, description: 'Novel approaches and ideas' },
  conciseness: { weight: 0.15, description: 'Clarity and brevity' },
  safety:      { weight: 0.10, description: 'Absence of harmful content' },
};

const FORMAT_ROUND_ROBIN  = 'round_robin';
const FORMAT_ELIMINATION  = 'elimination';
const FORMAT_SWISS        = 'swiss';

const STATUS_PENDING    = 'pending';
const STATUS_RUNNING    = 'running';
const STATUS_COMPLETED  = 'completed';
const STATUS_FAILED     = 'failed';

// ─── Contestant ───────────────────────────────────────────────────────────────

class Contestant {
  constructor(opts = {}) {
    this.id         = opts.id     || crypto.randomUUID();
    this.name       = opts.name   || `Contestant-${this.id.slice(0, 6)}`;
    this.provider   = opts.provider || 'unknown';   // anthropic, openai, google, groq ...
    this.model      = opts.model    || 'unknown';
    this.endpoint   = opts.endpoint || null;
    this.apiKey     = opts.apiKey   || null;
    this.headers    = opts.headers  || {};
    this._stats     = { wins: 0, losses: 0, draws: 0, totalScore: 0, rounds: 0 };
  }

  /**
   * Execute a task and return the output string.
   * If endpoint is provided, calls the API. Otherwise uses the executor fn.
   */
  async execute(task, executorFn = null) {
    if (executorFn) return executorFn(task, this);
    if (!this.endpoint) throw new Error(`Contestant '${this.name}' has no endpoint or executor`);
    return this._callApi(task);
  }

  async _callApi(task) {
    const url      = new URL(this.endpoint);
    const isHttps  = url.protocol === 'https:';
    const mod      = isHttps ? require('https') : require('http');
    const bodyData = this._buildRequestBody(task);
    const bodyStr  = JSON.stringify(bodyData);

    const headers = Object.assign({
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    }, this.headers);

    if (this.apiKey) {
      if (this.provider === 'anthropic') headers['x-api-key'] = this.apiKey;
      else headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return new Promise((resolve, reject) => {
      const req = mod.request({
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method:   'POST',
        headers,
      }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(this._extractContent(parsed));
          } catch (e) {
            reject(new Error(`Parse error: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Contestant API timeout')); });
      req.write(bodyStr);
      req.end();
    });
  }

  _buildRequestBody(task) {
    if (this.provider === 'anthropic') {
      return {
        model:      this.model || 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: task.prompt }],
      };
    }
    return {
      model:    this.model || 'gpt-4',
      messages: [{ role: 'user', content: task.prompt }],
    };
  }

  _extractContent(parsed) {
    if (parsed.content && Array.isArray(parsed.content)) return parsed.content[0].text || '';
    if (parsed.choices && parsed.choices[0]) return parsed.choices[0].message.content || '';
    return JSON.stringify(parsed);
  }

  recordResult(score, won) {
    this._stats.rounds++;
    this._stats.totalScore += score;
    if (won === true)  this._stats.wins++;
    if (won === false) this._stats.losses++;
    if (won === null)  this._stats.draws++;
  }

  getStats()       { return { ...this._stats, avgScore: this._stats.rounds ? this._stats.totalScore / this._stats.rounds : 0 }; }
  toString()       { return `${this.name}(${this.provider}/${this.model})`; }
}

// ─── Judge ────────────────────────────────────────────────────────────────────

class Judge {
  constructor(opts = {}) {
    this.id      = opts.id   || crypto.randomUUID();
    this.name    = opts.name || `Judge-${this.id.slice(0, 6)}`;
    this.rubric  = opts.rubric || DEFAULT_RUBRIC;
    this._scoreFn = opts.scoreFn || null;
    this._history = [];
  }

  /**
   * Score a contestant's output against a task.
   * @returns {Object} { contestantId, scores: {dimension: value}, total: 0..1 }
   */
  async score(task, contestant, output) {
    if (this._scoreFn) {
      const result = await this._scoreFn(task, contestant, output, this.rubric);
      this._history.push(result);
      return result;
    }
    return this._defaultScore(task, contestant, output);
  }

  _defaultScore(task, contestant, output) {
    // Deterministic scoring based on output properties and CSL resonance proxy
    const scores = {};
    let total    = 0;

    for (const [dim, config] of Object.entries(this.rubric)) {
      let raw = 0;
      switch (dim) {
        case 'accuracy': {
          // Keyword overlap with task expected keywords
          const keywords = (task.keywords || []).map(k => k.toLowerCase());
          const outLower = output.toLowerCase();
          const hits     = keywords.filter(k => outLower.includes(k)).length;
          raw = keywords.length > 0 ? hits / keywords.length : 0.5;
          break;
        }
        case 'reasoning': {
          // Proxy: presence of logical connectors
          const connectors = ['because', 'therefore', 'thus', 'hence', 'since', 'if', 'then', 'however'];
          const found = connectors.filter(c => output.toLowerCase().includes(c)).length;
          raw = Math.min(1, found / 4);
          break;
        }
        case 'creativity': {
          // Proxy: unique word ratio (type-token ratio)
          const words  = output.toLowerCase().split(/\W+/).filter(Boolean);
          const unique = new Set(words).size;
          raw = words.length > 0 ? Math.min(1, unique / words.length * 2) : 0;
          break;
        }
        case 'conciseness': {
          // Optimal length relative to task max_length hint
          const maxLen = task.maxOutputLen || 500;
          const len    = output.length;
          raw = len === 0 ? 0 : Math.max(0, 1 - Math.abs(len - maxLen) / maxLen);
          break;
        }
        case 'safety': {
          // Penalize unsafe patterns
          const unsafe = ['harm', 'kill', 'illegal', 'exploit', 'malware', 'phishing'];
          const found  = unsafe.filter(u => output.toLowerCase().includes(u)).length;
          raw = Math.max(0, 1 - found * 0.25);
          break;
        }
        default:
          raw = 0.5;
      }

      // Apply φ-resonance modulation
      const resonance = 1 + 0.05 * Math.sin(raw * PHI * Math.PI);
      raw = Math.min(1, Math.max(0, raw * resonance));

      scores[dim] = +raw.toFixed(4);
      total += raw * config.weight;
    }

    const result = {
      judgeId:      this.id,
      contestantId: contestant.id,
      taskId:       task.id,
      scores,
      total:        +total.toFixed(4),
      ts:           Date.now(),
    };
    this._history.push(result);
    return result;
  }

  getHistory()       { return this._history.slice(); }
  setRubric(rubric)  { this.rubric = rubric; return this; }
}

// ─── ConsensusScorer ──────────────────────────────────────────────────────────

class ConsensusScorer {
  constructor(opts = {}) {
    this._method    = opts.method || 'weighted_mean';  // weighted_mean | median | borda
    this._weights   = opts.judgeWeights || null;       // judge id → weight
  }

  /**
   * Aggregate multiple judge scores for a contestant.
   */
  aggregate(judgeScores) {
    if (judgeScores.length === 0) return null;

    switch (this._method) {
      case 'median':    return this._median(judgeScores);
      case 'borda':     return this._borda(judgeScores);
      case 'weighted_mean':
      default:          return this._weightedMean(judgeScores);
    }
  }

  _weightedMean(scores) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const s of scores) {
      const w = (this._weights && this._weights[s.judgeId]) || 1;
      weightedSum += s.total * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(4) : 0;
  }

  _median(scores) {
    const sorted = scores.map(s => s.total).sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4)
      : +sorted[mid].toFixed(4);
  }

  _borda(scores) {
    // Borda count: rank by score, assign points
    const ranked = scores.slice().sort((a, b) => b.total - a.total);
    const n = ranked.length;
    let borda = 0;
    for (let i = 0; i < n; i++) borda += (n - i);
    return +(borda / (n * (n + 1) / 2)).toFixed(4);
  }

  setMethod(method) { this._method = method; return this; }
}

// ─── BattleRound ─────────────────────────────────────────────────────────────

class BattleRound {
  constructor(opts = {}) {
    this.id           = opts.id || crypto.randomUUID();
    this.roundNumber  = opts.roundNumber || 1;
    this.task         = opts.task || null;
    this.contestants  = opts.contestants || [];
    this.judges       = opts.judges || [];
    this.status       = STATUS_PENDING;
    this.outputs      = {};       // contestantId → output
    this.judgeScores  = {};       // contestantId → [judgeScore]
    this.finalScores  = {};       // contestantId → aggregated score
    this.winner       = null;
    this._scorer      = opts.scorer || new ConsensusScorer();
    this._executorFn  = opts.executorFn || null;
    this.startedAt    = null;
    this.completedAt  = null;
  }

  /**
   * Execute the round: run all contestants, collect outputs, score them.
   */
  async execute() {
    this.status    = STATUS_RUNNING;
    this.startedAt = Date.now();

    try {
      // Run all contestants in parallel
      await Promise.all(this.contestants.map(async c => {
        try {
          this.outputs[c.id] = await c.execute(this.task, this._executorFn);
        } catch (err) {
          this.outputs[c.id] = `ERROR: ${err.message}`;
        }
      }));

      // Score all outputs with all judges
      for (const c of this.contestants) {
        const output = this.outputs[c.id];
        this.judgeScores[c.id] = [];
        for (const judge of this.judges) {
          const score = await judge.score(this.task, c, output);
          this.judgeScores[c.id].push(score);
        }
        this.finalScores[c.id] = this._scorer.aggregate(this.judgeScores[c.id]);
      }

      // Determine winner
      let maxScore  = -1;
      let winnerId  = null;
      for (const [cid, score] of Object.entries(this.finalScores)) {
        if (score > maxScore) { maxScore = score; winnerId = cid; }
      }
      this.winner       = winnerId;
      this.status       = STATUS_COMPLETED;
      this.completedAt  = Date.now();

      // Record results on contestants
      for (const c of this.contestants) {
        const won = this.contestants.length > 1
          ? (c.id === winnerId ? true : false)
          : null;
        c.recordResult(this.finalScores[c.id], won);
      }

      return this.getSummary();
    } catch (err) {
      this.status = STATUS_FAILED;
      throw err;
    }
  }

  getSummary() {
    return {
      roundId:     this.id,
      roundNumber: this.roundNumber,
      status:      this.status,
      taskId:      this.task?.id,
      outputs:     this.outputs,
      finalScores: this.finalScores,
      winner:      this.winner,
      durationMs:  this.completedAt ? this.completedAt - this.startedAt : null,
    };
  }
}

// ─── TournamentBracket ────────────────────────────────────────────────────────

class TournamentBracket {
  constructor(opts = {}) {
    this.id          = opts.id     || crypto.randomUUID();
    this.format      = opts.format || FORMAT_ELIMINATION;
    this.contestants = (opts.contestants || []).slice();
    this.rounds      = [];
    this._current    = 0;
    this._judges     = opts.judges  || [];
    this._tasks      = opts.tasks   || [];
    this._scorer     = opts.scorer  || new ConsensusScorer();
    this._executorFn = opts.executorFn || null;
    this.history     = [];
  }

  /**
   * Build bracket structure based on format.
   */
  build() {
    if (this.format === FORMAT_ELIMINATION) return this._buildElimination();
    if (this.format === FORMAT_ROUND_ROBIN) return this._buildRoundRobin();
    if (this.format === FORMAT_SWISS)       return this._buildSwiss();
    throw new Error(`Unknown bracket format: ${this.format}`);
  }

  _buildElimination() {
    // Single-elimination: pairs of contestants, winners advance
    const brackets = [];
    let remaining  = this.contestants.slice();

    // Pad to power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(remaining.length)));
    while (remaining.length < nextPow2) remaining.push(null); // bye

    while (remaining.length > 1) {
      const roundPairs = [];
      for (let i = 0; i < remaining.length; i += 2) {
        roundPairs.push([remaining[i], remaining[i + 1]]);
      }
      brackets.push(roundPairs);
      remaining = new Array(roundPairs.length).fill(null); // winners TBD
    }
    return brackets;
  }

  _buildRoundRobin() {
    // Every contestant vs every other contestant
    const pairs = [];
    const n     = this.contestants.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([this.contestants[i], this.contestants[j]]);
      }
    }
    return [pairs]; // single bracket round
  }

  _buildSwiss() {
    // Initial round: all contestants vs one another by seeding
    return this._buildRoundRobin();
  }

  /**
   * Execute the full tournament.
   */
  async run() {
    let remaining = this.contestants.slice();
    let roundNum  = 0;

    if (this.format === FORMAT_ROUND_ROBIN || this.format === FORMAT_SWISS) {
      // Run every pair once
      const n = remaining.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          roundNum++;
          const active = [remaining[i], remaining[j]];
          const task   = this._tasks[roundNum % this._tasks.length] || { id: `task-${roundNum}`, prompt: 'Default task' };
          const round  = new BattleRound({
            roundNumber: roundNum, task, contestants: active,
            judges: this._judges, scorer: this._scorer, executorFn: this._executorFn,
          });
          const summary = await round.execute();
          this.rounds.push(round);
          this.history.push(summary);
        }
      }
      // For round-robin, champion is the contestant with highest score
      const scores = {};
      for (const c of remaining) scores[c.id] = 0;
      for (const h of this.history) {
        if (h.winner && scores[h.winner] !== undefined) scores[h.winner]++;
      }
      const sortedIds = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
      const champion  = remaining.find(c => c.id === sortedIds[0]) || null;
      return { champion, history: this.history };
    }

    // FORMAT_ELIMINATION: dynamic single-elimination
    while (remaining.length > 1) {
      const roundWinners = [];
      for (let i = 0; i < remaining.length; i += 2) {
        roundNum++;
        const a = remaining[i];
        const b = remaining[i + 1];
        if (!b) { roundWinners.push(a); continue; } // bye
        const active = [a, b];
        const task   = this._tasks[roundNum % this._tasks.length] || { id: `task-${roundNum}`, prompt: 'Default task' };
        const round  = new BattleRound({
          roundNumber: roundNum, task, contestants: active,
          judges: this._judges, scorer: this._scorer, executorFn: this._executorFn,
        });
        const summary = await round.execute();
        this.rounds.push(round);
        this.history.push(summary);
        const winner = active.find(c => c.id === summary.winner) || a; // default to first on tie
        roundWinners.push(winner);
      }
      remaining = roundWinners;
    }

    return { champion: remaining[0] || null, history: this.history };
  }

  getResults() { return this.history.slice(); }
  getWinner()  { return this.rounds.length ? this.rounds[this.rounds.length - 1].winner : null; }
}

// ─── BattleArena ──────────────────────────────────────────────────────────────

class BattleArena {
  constructor(opts = {}) {
    this.id           = opts.id   || crypto.randomUUID();
    this.name         = opts.name || 'HeadyArena';
    this._contestants = new Map();
    this._judges      = new Map();
    this._tasks       = new Map();
    this._scorer      = new ConsensusScorer(opts.scorerOpts || {});
    this._brackets    = [];
    this._rounds      = [];
    this._auditTrail  = [];
    this._executorFn  = opts.executorFn || null;
    this._rubric      = opts.rubric || DEFAULT_RUBRIC;
  }

  /**
   * Register a contestant model.
   */
  addContestant(opts) {
    const c = new Contestant(opts);
    this._contestants.set(c.id, c);
    this._audit('add_contestant', { id: c.id, name: c.name });
    return c;
  }

  /**
   * Add a judge with optional custom scoring function.
   */
  addJudge(opts) {
    const j = new Judge(Object.assign({ rubric: this._rubric }, opts));
    this._judges.set(j.id, j);
    this._audit('add_judge', { id: j.id, name: j.name });
    return j;
  }

  /**
   * Register a competition task.
   */
  addTask(task) {
    const t = Object.assign({ id: crypto.randomUUID() }, task);
    this._tasks.set(t.id, t);
    return t;
  }

  /**
   * Run a single ad-hoc round with all registered contestants and judges.
   */
  async runRound(task) {
    const contestants = Array.from(this._contestants.values());
    const judges      = Array.from(this._judges.values());
    const resolvedTask = typeof task === 'string'
      ? { id: crypto.randomUUID(), prompt: task }
      : task;

    const round = new BattleRound({
      task:         resolvedTask,
      contestants,
      judges,
      scorer:       this._scorer,
      executorFn:   this._executorFn,
    });

    const summary = await round.execute();
    this._rounds.push(round);
    this._audit('round_complete', summary);
    return summary;
  }

  /**
   * Create and run a full tournament bracket.
   */
  async runTournament(opts = {}) {
    const bracket = new TournamentBracket({
      format:      opts.format      || FORMAT_ELIMINATION,
      contestants: Array.from(this._contestants.values()),
      judges:      Array.from(this._judges.values()),
      tasks:       Array.from(this._tasks.values()),
      scorer:      this._scorer,
      executorFn:  this._executorFn,
    });

    this._brackets.push(bracket);
    const result = await bracket.run();
    this._audit('tournament_complete', {
      champion: result.champion?.id,
      rounds:   bracket.history.length,
    });
    return result;
  }

  /**
   * Get full leaderboard sorted by average score.
   */
  getLeaderboard() {
    return Array.from(this._contestants.values())
      .map(c => ({ id: c.id, name: c.name, provider: c.provider, model: c.model, ...c.getStats() }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  getAuditTrail() { return this._auditTrail.slice(); }
  getRounds()     { return this._rounds.slice(); }
  getBrackets()   { return this._brackets.slice(); }

  _audit(action, data) {
    this._auditTrail.push({ action, data, ts: Date.now() });
    if (this._auditTrail.length > 10000) this._auditTrail.shift();
  }

  setExecutor(fn)   { this._executorFn = fn; return this; }
  setRubric(rubric) { this._rubric = rubric; for (const j of this._judges.values()) j.setRubric(rubric); return this; }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  DEFAULT_RUBRIC,
  FORMAT_ROUND_ROBIN,
  FORMAT_ELIMINATION,
  FORMAT_SWISS,
  STATUS_PENDING,
  STATUS_RUNNING,
  STATUS_COMPLETED,
  STATUS_FAILED,
  Contestant,
  Judge,
  ConsensusScorer,
  BattleRound,
  TournamentBracket,
  BattleArena,
};
