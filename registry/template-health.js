'use strict';

function validateCatalog(catalog) {
  const issues = [];
  const beeIds = new Set();
  const swarmIds = new Set();

  for (const bee of catalog.beeTemplates || []) {
    if (beeIds.has(bee.id)) issues.push({ severity: 'error', code: 'duplicate-bee-id', detail: bee.id });
    beeIds.add(bee.id);
    if (!bee.projection || !bee.observability || !bee.autonomousOptimization) {
      issues.push({ severity: 'error', code: 'incomplete-bee-contract', detail: bee.id });
    }
  }

  for (const swarm of catalog.swarmTemplates || []) {
    if (swarmIds.has(swarm.id)) issues.push({ severity: 'error', code: 'duplicate-swarm-id', detail: swarm.id });
    swarmIds.add(swarm.id);
    for (const ref of swarm.includedBeeTemplates || []) {
      if (!beeIds.has(ref)) issues.push({ severity: 'error', code: 'missing-bee-reference', detail: `${swarm.id} -> ${ref}` });
    }
  }

  return {
    ok: !issues.some(i => i.severity === 'error'),
    beeCount: beeIds.size,
    swarmCount: swarmIds.size,
    issues
  };
}

module.exports = { validateCatalog };
