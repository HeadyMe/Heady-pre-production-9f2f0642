'use strict';

const fs = require('fs');
const path = require('path');

function generateProjectionManifest({
  name,
  domain,
  repo,
  purpose,
  includedSurfaces = [],
  excludedSurfaces = [],
  contracts = 'configs/projection/projection-contracts.enhanced.yaml'
}) {
  return {
    name,
    domain,
    version: '1.0.0',
    generatedFrom: { repo, commit: 'REPLACE_WITH_COMMIT_SHA' },
    purpose,
    includedSurfaces,
    excludedSurfaces,
    contractPath: contracts,
    generatedAt: new Date().toISOString()
  };
}

function writeProjectionManifest(targetFile, options) {
  const manifest = generateProjectionManifest(options);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(manifest, null, 2));
  return manifest;
}

module.exports = { generateProjectionManifest, writeProjectionManifest };
