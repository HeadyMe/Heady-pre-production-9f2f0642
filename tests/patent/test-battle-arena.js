/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  DEFAULT_RUBRIC,
  FORMAT_ROUND_ROBIN,
  FORMAT_ELIMINATION,
  FORMAT_SWISS,
  STATUS_PENDING,
  STATUS_RUNNING,
  STATUS_COMPLETED,
  Contestant,
  Judge,
  ConsensusScorer,
  BattleRound,
  TournamentBracket,
  BattleArena,
} = require('../src/arena/battle-arena-protocol');

let passed = 0;
let failed = 0;

const _queue = [];

function test(name, fn) {
  _queue.push(async () => {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
  });
}

function asyncTest(name, fn) { test(name, fn); }

console.log('\n=== Battle Arena Protocol Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });
test('DEFAULT_RUBRIC has expected dimensions', () => {
  assert.ok(DEFAULT_RUBRIC.accuracy);
  assert.ok(DEFAULT_RUBRIC.reasoning);
  assert.ok(DEFAULT_RUBRIC.creativity);
  assert.ok(DEFAULT_RUBRIC.conciseness);
  assert.ok(DEFAULT_RUBRIC.safety);
});
test('DEFAULT_RUBRIC weights sum to 1', () => {
  const sum = Object.values(DEFAULT_RUBRIC).reduce((s, v) => s + v.weight, 0);
  assert.ok(Math.abs(sum - 1.0) < 0.001);
});
test('Format constants defined', () => {
  assert.strictEqual(FORMAT_ROUND_ROBIN, 'round_robin');
  assert.strictEqual(FORMAT_ELIMINATION, 'elimination');
  assert.strictEqual(FORMAT_SWISS, 'swiss');
});

// Contestant
test('Contestant initializes with id and name', () => {
  const c = new Contestant({ name: 'Claude', provider: 'anthropic', model: 'claude-3-opus' });
  assert.ok(c.id);
  assert.strictEqual(c.name, 'Claude');
  assert.strictEqual(c.provider, 'anthropic');
});

test('Contestant generates random id when not provided', () => {
  const c1 = new Contestant({ name: 'A' });
  const c2 = new Contestant({ name: 'B' });
  assert.notStrictEqual(c1.id, c2.id);
});

asyncTest('Contestant executes with custom executor', async () => {
  const c   = new Contestant({ name: 'TestBot' });
  const out = await c.execute({ prompt: 'hello' }, async (task) => `Response to: ${task.prompt}`);
  assert.strictEqual(out, 'Response to: hello');
});

asyncTest('Contestant throws without endpoint or executor', async () => {
  const c = new Contestant({ name: 'NoEndpoint' });
  let threw = false;
  try { await c.execute({ prompt: 'test' }, null); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('Contestant recordResult tracks stats', () => {
  const c = new Contestant({ name: 'Tracker' });
  c.recordResult(0.8, true);
  c.recordResult(0.6, false);
  c.recordResult(0.7, null);
  const stats = c.getStats();
  assert.strictEqual(stats.rounds, 3);
  assert.strictEqual(stats.wins, 1);
  assert.strictEqual(stats.losses, 1);
  assert.strictEqual(stats.draws, 1);
  assert.ok(Math.abs(stats.avgScore - (0.8 + 0.6 + 0.7) / 3) < 0.001);
});

test('Contestant toString includes name and provider', () => {
  const c = new Contestant({ name: 'GPT-4', provider: 'openai', model: 'gpt-4' });
  const str = c.toString();
  assert.ok(str.includes('GPT-4'));
  assert.ok(str.includes('openai'));
});

// Judge
asyncTest('Judge scores output with default scoring', async () => {
  const judge = new Judge();
  const task  = {
    id: 't1',
    prompt: 'Explain recursion',
    keywords: ['recursion', 'function', 'call'],
    maxOutputLen: 200,
  };
  const contestant = new Contestant({ name: 'TestBot' });
  const output = 'Recursion is a function that calls itself. Because it is self-referential, therefore it terminates when a base case is reached.';
  const result = await judge.score(task, contestant, output);
  assert.ok(result.total >= 0 && result.total <= 1);
  assert.ok(result.scores.accuracy !== undefined);
  assert.ok(result.scores.reasoning !== undefined);
});

asyncTest('Judge uses custom scoring function', async () => {
  const judge = new Judge({
    scoreFn: async (task, contestant, output) => ({
      judgeId: 'custom',
      contestantId: contestant.id,
      taskId: task.id,
      scores: { quality: 0.9 },
      total: 0.9,
    }),
  });
  const task = { id: 't1', prompt: 'test' };
  const c    = new Contestant({ name: 'Bot' });
  const r    = await judge.score(task, c, 'some output');
  assert.strictEqual(r.total, 0.9);
});

test('Judge getHistory accumulates records', async () => {
  const judge = new Judge();
  const task  = { id: 't1', prompt: 'test', keywords: [] };
  const c     = new Contestant({ name: 'B' });
  await judge.score(task, c, 'test output here');
  await judge.score(task, c, 'another test output');
  assert.ok(judge.getHistory().length >= 2);
});

test('Judge setRubric updates rubric', () => {
  const judge = new Judge();
  const customRubric = { quality: { weight: 1.0 } };
  judge.setRubric(customRubric);
  assert.strictEqual(judge.rubric, customRubric);
});

// ConsensusScorer
test('ConsensusScorer weighted_mean aggregates correctly', () => {
  const scorer = new ConsensusScorer({ method: 'weighted_mean' });
  const scores = [
    { judgeId: 'j1', total: 0.8 },
    { judgeId: 'j2', total: 0.6 },
  ];
  const result = scorer.aggregate(scores);
  assert.ok(Math.abs(result - 0.7) < 0.01);
});

test('ConsensusScorer median method', () => {
  const scorer = new ConsensusScorer({ method: 'median' });
  const scores = [
    { judgeId: 'j1', total: 0.4 },
    { judgeId: 'j2', total: 0.8 },
    { judgeId: 'j3', total: 0.6 },
  ];
  const result = scorer.aggregate(scores);
  assert.ok(Math.abs(result - 0.6) < 0.01);
});

test('ConsensusScorer borda method', () => {
  const scorer = new ConsensusScorer({ method: 'borda' });
  const scores = [
    { judgeId: 'j1', total: 0.8 },
    { judgeId: 'j2', total: 0.6 },
  ];
  const result = scorer.aggregate(scores);
  assert.ok(result > 0 && result <= 1);
});

test('ConsensusScorer returns null for empty scores', () => {
  const scorer = new ConsensusScorer();
  assert.strictEqual(scorer.aggregate([]), null);
});

test('ConsensusScorer judgeWeights applied', () => {
  const scorer = new ConsensusScorer({ method: 'weighted_mean', judgeWeights: { j1: 2, j2: 1 } });
  const scores = [
    { judgeId: 'j1', total: 0.9 },
    { judgeId: 'j2', total: 0.3 },
  ];
  const result = scorer.aggregate(scores);
  // j1 has weight 2, j2 has weight 1: (0.9*2 + 0.3*1) / 3 = 0.7
  assert.ok(Math.abs(result - 0.7) < 0.01);
});

// BattleRound
asyncTest('BattleRound executes with mock executors', async () => {
  const c1  = new Contestant({ name: 'A', provider: 'openai' });
  const c2  = new Contestant({ name: 'B', provider: 'anthropic' });
  const j   = new Judge();
  const task = { id: 't1', prompt: 'explain AI', keywords: ['AI', 'intelligence'], maxOutputLen: 100 };

  const round = new BattleRound({
    task,
    contestants: [c1, c2],
    judges: [j],
    executorFn: async (t) => `AI stands for artificial intelligence`,
  });

  const summary = await round.execute();
  assert.strictEqual(summary.status, STATUS_COMPLETED);
  assert.ok(summary.winner);
  assert.ok(Object.keys(summary.finalScores).length === 2);
});

asyncTest('BattleRound records output for all contestants', async () => {
  const c1 = new Contestant({ name: 'A' });
  const c2 = new Contestant({ name: 'B' });
  const j  = new Judge();
  const task = { id: 't2', prompt: 'test task', keywords: [] };

  const round = new BattleRound({
    task,
    contestants: [c1, c2],
    judges: [j],
    executorFn: async (t, c) => `Output from ${c.name}`,
  });

  await round.execute();
  assert.ok(round.outputs[c1.id].includes('A'));
  assert.ok(round.outputs[c2.id].includes('B'));
});

asyncTest('BattleRound handles executor error gracefully', async () => {
  const c   = new Contestant({ name: 'ErrBot' });
  const j   = new Judge();
  const task = { id: 't3', prompt: 'fail', keywords: [] };

  const round = new BattleRound({
    task,
    contestants: [c],
    judges: [j],
    executorFn: async () => { throw new Error('API down'); },
  });

  const summary = await round.execute();
  assert.ok(round.outputs[c.id].startsWith('ERROR:'));
});

// TournamentBracket
asyncTest('TournamentBracket elimination runs and returns champion', async () => {
  const contestants = [
    new Contestant({ name: 'A' }),
    new Contestant({ name: 'B' }),
    new Contestant({ name: 'C' }),
    new Contestant({ name: 'D' }),
  ];
  const judge = new Judge();
  const tasks = [{ id: 't1', prompt: 'What is AI?', keywords: ['AI'], maxOutputLen: 100 }];

  const bracket = new TournamentBracket({
    format: FORMAT_ELIMINATION,
    contestants,
    judges: [judge],
    tasks,
    executorFn: async (t, c) => `AI answer from ${c.name} because intelligence therefore smart`,
  });

  const result = await bracket.run();
  assert.ok(result.champion);
  assert.ok(bracket.history.length > 0);
});

asyncTest('TournamentBracket round-robin runs all pairs', async () => {
  const contestants = [
    new Contestant({ name: 'X' }),
    new Contestant({ name: 'Y' }),
    new Contestant({ name: 'Z' }),
  ];
  const judge = new Judge();
  const tasks = [{ id: 't1', prompt: 'test', keywords: [], maxOutputLen: 50 }];

  const bracket = new TournamentBracket({
    format: FORMAT_ROUND_ROBIN,
    contestants,
    judges: [judge],
    tasks,
    executorFn: async () => 'Generic output with reasoning because important.',
  });

  const result = await bracket.run();
  assert.ok(result.champion || result.champion === null); // round-robin may not have single winner
  assert.strictEqual(bracket.history.length, 3); // 3 pairs in round-robin of 3
});

// BattleArena
test('BattleArena addContestant registers contestant', () => {
  const arena = new BattleArena({ name: 'TestArena' });
  const c     = arena.addContestant({ name: 'ModelA', provider: 'openai' });
  assert.ok(c.id);
  assert.strictEqual(arena._contestants.size, 1);
});

test('BattleArena addJudge registers judge', () => {
  const arena = new BattleArena();
  const j     = arena.addJudge({ name: 'Judge1' });
  assert.ok(j.id);
  assert.strictEqual(arena._judges.size, 1);
});

test('BattleArena addTask registers task', () => {
  const arena = new BattleArena();
  const t     = arena.addTask({ prompt: 'Summarize AI', keywords: ['AI'] });
  assert.ok(t.id);
  assert.strictEqual(arena._tasks.size, 1);
});

asyncTest('BattleArena runRound executes all contestants', async () => {
  const arena = new BattleArena();
  arena.setExecutor(async (task, c) => `Answer from ${c.name} because reasoning therefore conclusion.`);
  arena.addContestant({ name: 'Claude', provider: 'anthropic' });
  arena.addContestant({ name: 'GPT-4', provider: 'openai' });
  arena.addJudge({ name: 'Evaluator' });

  const summary = await arena.runRound({ id: 't1', prompt: 'Explain ML', keywords: ['ML', 'model'], maxOutputLen: 100 });
  assert.strictEqual(summary.status, STATUS_COMPLETED);
  assert.ok(summary.winner);
});

asyncTest('BattleArena getLeaderboard returns sorted list', async () => {
  const arena = new BattleArena();
  arena.setExecutor(async (task, c) => `Output from ${c.name} because smart therefore reasoning if then`);
  arena.addContestant({ name: 'Model1', provider: 'anthropic' });
  arena.addContestant({ name: 'Model2', provider: 'openai' });
  arena.addJudge({ name: 'Judge' });

  await arena.runRound({ id: 'r1', prompt: 'test', keywords: [], maxOutputLen: 50 });
  const leaderboard = arena.getLeaderboard();
  assert.strictEqual(leaderboard.length, 2);
  assert.ok(leaderboard[0].avgScore >= leaderboard[1].avgScore);
});

test('BattleArena getAuditTrail records actions', async () => {
  const arena = new BattleArena();
  arena.addContestant({ name: 'A' });
  arena.addJudge({ name: 'J' });
  const trail = arena.getAuditTrail();
  assert.ok(trail.length >= 2);
  assert.ok(trail.some(e => e.action === 'add_contestant'));
  assert.ok(trail.some(e => e.action === 'add_judge'));
});

test('BattleArena setRubric updates all judges', () => {
  const arena = new BattleArena();
  arena.addJudge({ name: 'J1' });
  arena.addJudge({ name: 'J2' });
  const customRubric = { quality: { weight: 1.0 } };
  arena.setRubric(customRubric);
  for (const j of arena._judges.values()) {
    assert.strictEqual(j.rubric, customRubric);
  }
});

asyncTest('BattleArena runTournament returns champion', async () => {
  const arena = new BattleArena();
  arena.setExecutor(async (task, c) => `Output from ${c.name} because reasoning. Therefore intelligent.`);
  arena.addContestant({ name: 'A' });
  arena.addContestant({ name: 'B' });
  arena.addContestant({ name: 'C' });
  arena.addContestant({ name: 'D' });
  arena.addJudge({ name: 'MainJudge' });
  arena.addTask({ prompt: 'Prove AI is useful', keywords: ['AI', 'useful'], maxOutputLen: 150 });

  const result = await arena.runTournament({ format: FORMAT_ELIMINATION });
  assert.ok(result.champion);
});

(async () => {
  for (const t of _queue) await t();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
