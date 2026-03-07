/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * Heady™ Scaffold CLI
 * Usage:
 *   node scripts/scaffold-cli.js --type package --name my-package
 *   node scripts/scaffold-cli.js --type app --name my-app
 */

const { mkdir, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');

// ── ANSI colour helpers ──────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gold:   '\x1b[33m',
};

const log  = (msg)       => console.log(`${c.blue}▶${c.reset}  ${msg}`);
const ok   = (msg)       => console.log(`${c.green}✔${c.reset}  ${msg}`);
const warn = (msg)       => console.log(`${c.yellow}⚠${c.reset}  ${msg}`);
const err  = (msg, exit) => { console.error(`${c.red}✖${c.reset}  ${msg}`); if (exit) process.exit(1); };

// ── Arg parsing ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const type = getArg('--type');
const name = getArg('--name');

// ── Validation ────────────────────────────────────────────────────────────────
if (!type || !name) {
  err('Usage: node scripts/scaffold-cli.js --type <package|app> --name <kebab-name>', true);
}

if (!['package', 'app'].includes(type)) {
  err(`Invalid type "${type}". Must be "package" or "app".`, true);
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  err(`Invalid name "${name}". Must be lowercase, start with a letter, and contain only letters, numbers, and hyphens.`, true);
}

// ── Path helpers ──────────────────────────────────────────────────────────────
const baseDir    = type === 'package' ? join(ROOT, 'packages', name) : join(ROOT, 'apps', name);
const scopedName = `@heady/${name}`;
const srcDir     = join(baseDir, 'src');

if (existsSync(baseDir)) {
  err(`Directory already exists: ${baseDir}`, true);
}

// ── Template generators ───────────────────────────────────────────────────────
function packageJson(isApp) {
  const base = {
    name: scopedName,
    version: '0.1.0',
    private: isApp,
    description: `Heady™ — ${name}`,
    main: './src/index.js',
    type: 'module',
    scripts: {
      build: 'tsc --build',
      dev:   isApp ? 'nodemon src/index.js' : 'tsc --watch',
      test:  'node --test src/**/*.test.js',
      lint:  'eslint src',
      clean: 'rm -rf dist',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.4.0',
    },
    engines: { node: '>=20.0.0' },
  };
  if (isApp) base.dependencies['express'] = '^4.19.0';
  return JSON.stringify(base, null, 2) + '\n';
}

function srcIndex(isApp) {
  const header = `/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */\n`;
  if (isApp) {
    return `${header}
/**
 * @module ${scopedName}
 * Entry point for the ${name} app.
 */

import express from 'express';

const PHI = 1.6180339887;
const PORT = Number(process.env.${name.toUpperCase().replace(/-/g, '_')}_PORT) || 3000;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '${name}', phi: PHI, ts: Date.now() });
});

app.listen(PORT, () => {
  console.log(\`[${name}] Listening on port \${PORT} (φ = \${PHI})\`);
});

export default app;
`;
  }
  return `${header}
/**
 * @module ${scopedName}
 * Public API for the ${name} package.
 */

const PHI = 1.6180339887;

export { PHI };

/**
 * Returns the phi-scaled value of n.
 * @param {number} n
 * @returns {number}
 */
export function phiScale(n) {
  return n * PHI;
}
`;
}

function tsconfigFor() {
  return JSON.stringify({
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n';
}

function dockerfile() {
  return `# © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json .
RUN npm install --frozen-lockfile

COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
`;
}

function readme(isApp) {
  return `# ${scopedName}

> Heady™ ${isApp ? 'App' : 'Package'}: ${name}

## Overview

Scaffolded via \`node scripts/scaffold-cli.js --type ${type} --name ${name}\`.

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Test

\`\`\`bash
npm run test
\`\`\`

---

*© 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.*
`;
}

// ── File map ──────────────────────────────────────────────────────────────────
const files = [
  { path: join(baseDir, 'package.json'),    content: packageJson(type === 'app') },
  { path: join(srcDir,  'index.js'),        content: srcIndex(type === 'app')    },
  { path: join(baseDir, 'tsconfig.json'),   content: tsconfigFor()               },
  { path: join(baseDir, 'README.md'),       content: readme(type === 'app')      },
];

if (type === 'app') {
  files.push({ path: join(baseDir, 'Dockerfile'), content: dockerfile() });
}

// ── Create files ──────────────────────────────────────────────────────────────
console.log('');
console.log(`${c.bold}${c.gold}  Heady™ Scaffold CLI${c.reset}`);
console.log(`${c.dim}  Creating ${type}: ${c.reset}${c.cyan}${scopedName}${c.reset}`);
console.log('');

await mkdir(srcDir, { recursive: true });

for (const file of files) {
  await writeFile(file.path, file.content, 'utf8');
  const rel = file.path.replace(ROOT + '/', '');
  ok(`Created ${c.cyan}${rel}${c.reset}`);
}

console.log('');
log(`Done! ${c.bold}${scopedName}${c.reset} scaffolded at ${c.dim}${baseDir}${c.reset}`);
console.log('');
log(`Next steps:`);
console.log(`   ${c.dim}cd ${type === 'package' ? 'packages' : 'apps'}/${name} && npm install${c.reset}`);
if (type === 'app') {
  console.log(`   ${c.dim}npm run dev${c.reset}`);
}
console.log('');
