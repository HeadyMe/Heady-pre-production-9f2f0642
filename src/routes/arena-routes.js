/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  BattleArena,
  Contestant,
  Judge,
  TournamentBracket,
  FORMAT_ROUND_ROBIN,
  FORMAT_ELIMINATION,
  FORMAT_SWISS,
} = require('../arena/battle-arena-protocol');

const PHI = 1.6180339887;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function serializeContestant(c) {
  return {
    id:       c.id,
    name:     c.name,
    provider: c.provider,
    model:    c.model,
    stats:    c.getStats(),
  };
}

function serializeArena(arena) {
  return {
    contestants: arena.getContestants().map(serializeContestant),
    judges:      arena.getJudges().map(j => ({ id: j.id, name: j.name })),
    tasks:       arena.getTasks(),
    leaderboard: arena.getLeaderboard(),
  };
}

// ─── Route Factory ────────────────────────────────────────────────────────────

function createArenaRoutes(opts = {}) {
  // Support multiple named arenas; default arena keyed by 'default'
  const arenas = opts.arenas || new Map();
  if (!arenas.has('default')) {
    arenas.set('default', opts.arena || new BattleArena(opts.arenaOpts || {}));
  }

  function getArena(id = 'default') {
    if (!arenas.has(id)) return null;
    return arenas.get(id);
  }

  const routes = [];

  /**
   * POST /arena
   * Create a new named arena.
   * Body: { id?: string, rubric?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/arena',
    handler: async (req, res) => {
      const { id = `arena-${Date.now()}`, rubric } = req.body || {};
      if (arenas.has(id)) return respond(res, 409, { error: `Arena '${id}' already exists` });
      const arena = new BattleArena({ rubric });
      arenas.set(id, arena);
      return respond(res, 201, { ok: true, id, phi: PHI, arena: serializeArena(arena) });
    },
  });

  /**
   * GET /arena/:id
   * Get the current state of an arena.
   */
  routes.push({
    method: 'GET',
    path:   '/arena/:id',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      return respond(res, 200, { ok: true, id, arena: serializeArena(arena) });
    },
  });

  /**
   * GET /arena
   * List all arena IDs.
   */
  routes.push({
    method: 'GET',
    path:   '/arena',
    handler: async (req, res) => {
      const ids = Array.from(arenas.keys());
      return respond(res, 200, { ok: true, arenas: ids, count: ids.length });
    },
  });

  /**
   * POST /arena/:id/contestants
   * Add a contestant to an arena.
   * Body: { name?: string, provider?: string, model?: string, endpoint?: string, apiKey?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/:id/contestants',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const { name, provider, model, endpoint, apiKey, headers } = req.body || {};
      const contestant = arena.addContestant({ name, provider, model, endpoint, apiKey, headers });
      return respond(res, 201, {
        ok:         true,
        contestant: serializeContestant(contestant),
        phi:        PHI,
      });
    },
  });

  /**
   * GET /arena/:id/contestants
   * List all contestants in an arena.
   */
  routes.push({
    method: 'GET',
    path:   '/arena/:id/contestants',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const contestants = arena.getContestants().map(serializeContestant);
      return respond(res, 200, { ok: true, contestants, count: contestants.length });
    },
  });

  /**
   * POST /arena/:id/judges
   * Add a judge to an arena.
   * Body: { name?: string, rubric?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/:id/judges',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const { name, rubric } = req.body || {};
      const judge = arena.addJudge({ name, rubric });
      return respond(res, 201, { ok: true, judge: { id: judge.id, name: judge.name } });
    },
  });

  /**
   * POST /arena/:id/tasks
   * Add a task to an arena.
   * Body: { prompt: string, keywords?: string[], description?: string, timeout?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/:id/tasks',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const { prompt, keywords, description, timeout } = req.body || {};
      if (!prompt) return respond(res, 400, { error: 'Missing prompt field' });
      const task = arena.addTask({ prompt, keywords, description, timeout });
      return respond(res, 201, { ok: true, task });
    },
  });

  /**
   * POST /arena/:id/round
   * Run a single round with the given task index.
   * Body: { taskIndex?: number, executors?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/:id/round',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const { taskIndex = 0 } = req.body || {};
      const tasks = arena.getTasks();
      if (!tasks.length) return respond(res, 422, { error: 'No tasks registered' });
      if (taskIndex >= tasks.length) return respond(res, 400, { error: `taskIndex ${taskIndex} out of range (${tasks.length} tasks)` });
      try {
        const summary = await arena.runRound(tasks[taskIndex]);
        return respond(res, 200, { ok: true, summary });
      } catch (err) {
        return respond(res, 500, { error: err.message });
      }
    },
  });

  /**
   * POST /arena/:id/tournament
   * Run a full tournament.
   * Body: { format?: string, rounds?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/:id/tournament',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const { format = FORMAT_ROUND_ROBIN, rounds } = req.body || {};
      try {
        const results = await arena.runTournament({ format, rounds });
        const leaderboard = arena.getLeaderboard();
        return respond(res, 200, { ok: true, format, results, leaderboard, phi: PHI });
      } catch (err) {
        return respond(res, 500, { error: err.message });
      }
    },
  });

  /**
   * GET /arena/:id/leaderboard
   * Get current leaderboard for an arena.
   */
  routes.push({
    method: 'GET',
    path:   '/arena/:id/leaderboard',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      const arena = getArena(id);
      if (!arena) return respond(res, 404, { error: `Arena '${id}' not found` });
      const leaderboard = arena.getLeaderboard();
      return respond(res, 200, { ok: true, leaderboard, count: leaderboard.length });
    },
  });

  /**
   * DELETE /arena/:id
   * Destroy an arena.
   */
  routes.push({
    method: 'DELETE',
    path:   '/arena/:id',
    handler: async (req, res) => {
      const { id = 'default' } = req.params || {};
      if (!arenas.has(id)) return respond(res, 404, { error: `Arena '${id}' not found` });
      arenas.delete(id);
      return respond(res, 200, { ok: true, deleted: id });
    },
  });

  /**
   * POST /arena/bracket
   * Build and run a standalone tournament bracket.
   * Body: { contestants: [{name, provider, model}], format?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/arena/bracket',
    handler: async (req, res) => {
      const { contestants: specs = [], format = FORMAT_ROUND_ROBIN } = req.body || {};
      if (!Array.isArray(specs) || specs.length < 2) {
        return respond(res, 400, { error: 'At least 2 contestants required' });
      }
      const contestants = specs.map(s => new Contestant(s));
      const bracket     = new TournamentBracket({ contestants, format });
      const built       = bracket.build();
      return respond(res, 200, { ok: true, format, rounds: built, phi: PHI });
    },
  });

  return routes;
}

function attachArenaRoutes(app, opts = {}) {
  const routes = createArenaRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createArenaRoutes, attachArenaRoutes };
