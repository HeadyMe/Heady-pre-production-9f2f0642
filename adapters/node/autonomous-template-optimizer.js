'use strict';

const fs = require('fs');
const path = require('path');

function scoreBee(template, policy) {
  const w = policy.weights;
  return Number((
    (template.priority * w.priority) +
    ((template.skills || []).length * w.skills) +
    ((template.workflows || []).length * w.workflows) +
    ((template.nodes || []).length * w.nodes) +
    ((template.headyswarmTasks || []).length * w.swarmTasks)
  ).toFixed(4));
}

function optimize({ root = path.resolve(__dirname, '..', '..') } = {}) {
  const catalogPath = path.join(root, 'registry', 'heady-template-catalog.json');
  const policyPath = path.join(root, 'configs', 'autonomy', 'heady-template-optimization-policy.yaml');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const rawPolicy = fs.readFileSync(policyPath, 'utf8');
  const weights = {};
  for (const line of rawPolicy.split(/\r?\n/)) {
    const m = line.match(/^\s+([a-zA-Z_]+):\s+([0-9.]+)$/);
    if (m) weights[m[1]] = Number(m[2]);
  }
  const policy = { weights };
  const ranked = (catalog.beeTemplates || [])
    .map(t => ({ id: t.id, score: scoreBee(t, policy) }))
    .sort((a, b) => b.score - a.score);
  return {
    generatedAt: new Date().toISOString(),
    policy,
    ranked,
    recommendedDefaultBee: ranked[0]?.id || null
  };
}

module.exports = { optimize };
