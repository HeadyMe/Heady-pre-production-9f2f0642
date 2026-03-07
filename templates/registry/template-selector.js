'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readYamlLike(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const scenarios = [];
  let current = null;
  for (const line of lines) {
    if (/^\s*- id: /.test(line)) {
      if (current) scenarios.push(current);
      current = { id: line.split(':').slice(1).join(':').trim() };
      continue;
    }
    if (!current) continue;
    const m = line.match(/^\s+([a-z_]+):\s*(.+)$/);
    if (!m) continue;
    let [, key, value] = m;
    value = value.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      current[key] = value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean);
    } else {
      current[key] = value;
    }
  }
  if (current) scenarios.push(current);
  return { scenarios };
}

function tokenize(text = '') {
  return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function buildSelector({ catalogPath, scenarioMatrixPath } = {}) {
  const base = path.resolve(__dirname, '..', '..');
  const catalog = readJson(catalogPath || path.join(base, 'registry', 'heady-template-catalog.json'));
  const matrix = readYamlLike(scenarioMatrixPath || path.join(base, 'registry', 'scenario-matrix.yaml'));

  function scoreScenario(input, scenario) {
    const tokens = new Set(tokenize(input));
    const keywords = new Set(Array.isArray(scenario.keywords) ? scenario.keywords.map(v => String(v).toLowerCase()) : []);
    let score = 0;
    for (const token of tokens) {
      if (keywords.has(token)) score += 1;
      for (const kw of keywords) {
        if (token.includes(kw) || kw.includes(token)) score += 0.25;
      }
    }
    return Number(score.toFixed(3));
  }

  function recommend(input = '') {
    const ranked = matrix.scenarios
      .map(s => ({ scenario: s, score: scoreScenario(input, s) }))
      .sort((a, b) => b.score - a.score);
    const selected = ranked[0] && ranked[0].score > 0 ? ranked[0].scenario : null;
    const beeIds = selected ? selected.preferred_bee_templates || [] : [catalog.beeTemplates[0]?.id].filter(Boolean);
    const swarmIds = selected ? selected.preferred_swarm_templates || [] : [catalog.swarmTemplates[0]?.id].filter(Boolean);

    return {
      ok: true,
      input,
      selectedScenario: selected ? selected.id : null,
      beeTemplates: catalog.beeTemplates.filter(t => beeIds.includes(t.id)),
      swarmTemplates: catalog.swarmTemplates.filter(t => swarmIds.includes(t.id)),
      ranking: ranked.map(r => ({ scenario: r.scenario.id, score: r.score }))
    };
  }

  return { catalog, matrix, recommend };
}

module.exports = { buildSelector };
