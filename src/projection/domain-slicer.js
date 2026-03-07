/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Domain Slicer — Per-Domain File Extraction ═══
 *
 * Extracts a clean, standalone file set for each Heady domain
 * from the monorepo. Output is a flat { filePath: content } map
 * that can be pushed directly to a GitHub repository.
 *
 * Each sliced domain gets:
 *   - index.js (standalone Express server for that single domain)
 *   - package.json (domain-specific deps)
 *   - README.md (branded, with badges)
 *   - Dockerfile (production container)
 *   - .github/workflows/deploy.yml (auto-deploy on push)
 *   - site-config.json (extracted from site-registry.json)
 *   - src/site-renderer.js (the rendering engine)
 *   - LICENSE
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').child('domain-slicer');

const ROOT = path.join(__dirname, '..', '..');
const SITE_REGISTRY = require('../sites/site-registry.json');

// ── Domain → Repo Mapping ──────────────────────────────────────
const REPO_MAP = {
    'headyme.com': 'HeadyMe/headyme-core',
    'headysystems.com': 'HeadyMe/headysystems-core',
    'headyconnection.org': 'HeadyMe/headyconnection-core',
    'headymcp.com': 'HeadyMe/headymcp-core',
    'headyos.com': 'HeadyMe/headyos-core',
    'headyapi.com': 'HeadyMe/headyapi-core',
    'headybuddy.org': 'HeadyMe/headybuddy-core',
    'headybot.com': 'HeadyMe/headybot-core',
    'headyio.com': 'HeadyMe/headyio-core',
};

// ── File Generators ────────────────────────────────────────────

function generatePackageJson(domain, siteConfig) {
    return JSON.stringify({
        name: `@heady/${siteConfig.name.toLowerCase()}-core`,
        version: '1.0.0',
        description: siteConfig.description || `Heady™ ${siteConfig.name} — ${siteConfig.tagline}`,
        main: 'index.js',
        scripts: {
            start: 'node index.js',
            dev: 'node index.js',
            test: 'echo "Tests coming soon" && exit 0',
        },
        engines: { node: '>=20.0.0' },
        dependencies: {
            express: '^4.21.0',
        },
        author: 'Heady Systems LLC <eric@headysystems.com>',
        license: 'SEE LICENSE IN LICENSE',
        repository: {
            type: 'git',
            url: `git+https://github.com/${REPO_MAP[domain]}.git`,
        },
        homepage: `https://${domain}`,
    }, null, 2);
}

function generateReadme(domain, siteConfig) {
    const repoName = REPO_MAP[domain].split('/')[1];
    return `# ${siteConfig.icon || '🐝'} ${siteConfig.name}

> **${siteConfig.tagline}**

${siteConfig.description}

[![Deploy](https://img.shields.io/badge/deploy-Cloud%20Run-blue?logo=google-cloud)](https://${domain})
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)
[![Projected](https://img.shields.io/badge/projected-Heady%20Latent%20OS-purple)](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)

## Quick Start

\`\`\`bash
git clone https://github.com/${REPO_MAP[domain]}.git
cd ${repoName}
npm install
npm start
\`\`\`

Visit \`http://localhost:3000\` to see ${siteConfig.name} running locally.

## Features

${(siteConfig.features || []).map(f => `- ${f.icon} **${f.title}** — ${f.desc}`).join('\n')}

## Architecture

This repository is **autonomously projected** from the [Heady Latent OS](https://github.com/HeadyMe/Heady-pre-production-9f2f0642) — the continuous AI reasoning engine that powers the entire Heady ecosystem.

\`\`\`
pgvector (Brain) → Eradication Protocol → Domain Slicer → GitHub Push → Live at ${domain}
\`\`\`

## Stats

${(siteConfig.stats || []).map(s => `| ${s.label} | ${s.value} |`).join('\n')}

---

**© 2026 Heady Systems LLC.** All Rights Reserved.

Built with Sacred Geometry · Powered by the Heady Latent OS
`;
}

function generateIndexJs(domain, siteConfig) {
    return `/*
 * © 2026 Heady Systems LLC.
 * ${siteConfig.name} — Standalone Server
 * Projected from the Heady Latent OS
 */

const express = require('../core/heady-server');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Load site config
const siteConfig = require('./site-config.json');

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: '${siteConfig.name}',
        domain: '${domain}',
        projected: true,
        ts: new Date().toISOString(),
    });
});

// Site renderer
const { renderSite } = require('./src/site-renderer');

app.get('/', (req, res) => {
    const html = renderSite(siteConfig, '${domain}');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// Start server
app.listen(PORT, () => {
    console.log(\`🐝 ${siteConfig.name} running at http://localhost:\${PORT}\`);
    console.log(\`   Domain: ${domain}\`);
    console.log(\`   Projected from Heady Latent OS\`);
});
`;
}

function generateDockerfile(siteConfig) {
    return `FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
RUN groupadd -r heady && useradd -r -g heady heady
RUN chown -R heady:heady /app
USER heady
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \\
    CMD node -e "const h=require('http');h.get('http://localhost:8080/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
EXPOSE 8080
CMD ["node", "index.js"]
`;
}

function generateDeployYml(domain, siteConfig) {
    return `name: Deploy ${siteConfig.name}

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm test

      - name: Deploy to Cloud Run
        if: \${{ secrets.GCP_PROJECT_ID != '' }}
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${siteConfig.name.toLowerCase()}
          region: us-central1
          source: .
          project_id: \${{ secrets.GCP_PROJECT_ID }}

      - name: Smoke Test
        run: |
          sleep 10
          curl -sf https://${domain}/health || echo "Smoke test pending — domain not yet configured"
`;
}

function generateLicense() {
    return `PROPRIETARY LICENSE

© 2026 Heady Systems LLC. All Rights Reserved.

This software and associated documentation files (the "Software") are the
proprietary property of Heady Systems LLC. You are granted a limited,
non-exclusive, non-transferable license to use the Software for evaluation
and development purposes only.

RESTRICTIONS:
- You may not use this Software in production without a commercial license.
- You may not redistribute, sublicense, or sell the Software.
- You may not remove or alter any proprietary notices.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

For commercial licensing: eric@headysystems.com
`;
}

function generateSiteRenderer() {
    // Read the actual site-renderer.js from the monorepo
    const rendererPath = path.join(ROOT, 'src', 'sites', 'site-renderer.js');
    try {
        return fs.readFileSync(rendererPath, 'utf8');
    } catch {
        return `// Site renderer not found — using minimal renderer
function renderSite(config, domain) {
    return '<html><body><h1>' + config.name + '</h1><p>' + config.description + '</p></body></html>';
}
module.exports = { renderSite };
`;
    }
}

// ── Main Slicer Function ───────────────────────────────────────

function slice(domain) {
    const siteConfig = SITE_REGISTRY.preconfigured[domain];
    if (!siteConfig) {
        throw new Error(`Domain ${domain} not found in site-registry.json`);
    }

    // Enrich config with domain
    const enrichedConfig = { ...siteConfig, domain };

    const files = {
        'package.json': generatePackageJson(domain, siteConfig),
        'README.md': generateReadme(domain, siteConfig),
        'index.js': generateIndexJs(domain, siteConfig),
        'Dockerfile': generateDockerfile(siteConfig),
        '.github/workflows/deploy.yml': generateDeployYml(domain, siteConfig),
        'LICENSE': generateLicense(),
        'site-config.json': JSON.stringify(enrichedConfig, null, 2),
        'src/site-renderer.js': generateSiteRenderer(),
    };

    logger.info(`Sliced ${domain}: ${Object.keys(files).length} files`);
    return files;
}

function sliceAll() {
    const results = {};
    for (const domain of Object.keys(REPO_MAP)) {
        try {
            results[domain] = {
                repo: REPO_MAP[domain],
                files: slice(domain),
                fileCount: Object.keys(slice(domain)).length,
            };
        } catch (err) {
            results[domain] = { repo: REPO_MAP[domain], error: err.message };
        }
    }
    return results;
}

module.exports = {
    slice,
    sliceAll,
    REPO_MAP,
};
