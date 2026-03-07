#!/usr/bin/env node
'use strict';

/**
 * create-heady-agent CLI
 * Scaffolds a new HeadyBee agent module for the Heady ecosystem
 * 
 * Usage:
 *   create-heady-agent my-bee
 *   create-heady-agent my-bee --template monitor --language typescript
 *   create-heady-agent (interactive)
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const PHI = 1.6180339887;
const VERSION = '1.0.0';

const TEMPLATES = {
  basic: { desc: 'Minimal HeadyBee with lifecycle hooks', complexity: 'low' },
  monitor: { desc: 'Health monitoring bee with PHI-scaled intervals', complexity: 'medium' },
  processor: { desc: 'Data processing bee with pipeline integration', complexity: 'medium' },
  connector: { desc: 'External service connector with circuit breaker', complexity: 'high' },
  creative: { desc: 'Content generation bee with LLM routing', complexity: 'high' },
  security: { desc: 'Security scanning bee with governance hooks', complexity: 'high' },
};

const program = new Command();

program
  .name('create-heady-agent')
  .version(VERSION)
  .description('Scaffold a new HeadyBee agent for the Heady™ ecosystem')
  .argument('[name]', 'Agent name (e.g., my-custom-bee)')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-l, --language <lang>', 'Language (javascript|typescript)', 'javascript')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip npm install')
  .action(async (name, options) => {
    try {
      const config = name
        ? { name, template: options.template, language: options.language }
        : await interactivePrompt();

      await scaffold(config, options);
    } catch (err) {
      console.error(chalk.red(`\n❌ Error: ${err.message}\n`));
      process.exit(1);
    }
  });

async function interactivePrompt() {
  console.log(chalk.yellow(`\n🐝 create-heady-agent v${VERSION}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input) => /^[a-z][a-z0-9-]*$/.test(input) || 'Use lowercase letters, numbers, and hyphens',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: Object.entries(TEMPLATES).map(([key, val]) => ({
        name: `${key} — ${val.desc}`,
        value: key,
      })),
    },
    {
      type: 'list',
      name: 'language',
      message: 'Language:',
      choices: ['javascript', 'typescript'],
    },
  ]);

  return answers;
}

async function scaffold(config, options) {
  const { name, template, language } = config;
  const targetDir = path.resolve(process.cwd(), name);

  console.log(chalk.yellow(`\n🐝 Scaffolding HeadyBee: ${name}`));
  console.log(chalk.gray(`   Template: ${template}`));
  console.log(chalk.gray(`   Language: ${language}`));
  console.log(chalk.gray(`   Directory: ${targetDir}\n`));

  // Create directory
  await fs.ensureDir(targetDir);
  await fs.ensureDir(path.join(targetDir, 'src'));
  await fs.ensureDir(path.join(targetDir, 'tests'));
  await fs.ensureDir(path.join(targetDir, 'configs'));
  await fs.ensureDir(path.join(targetDir, 'docs'));
  await fs.ensureDir(path.join(targetDir, '.github', 'workflows'));

  // Generate files
  await generatePackageJson(targetDir, name, template);
  await generateBee(targetDir, name, template, language);
  await generateConfig(targetDir, name, template);
  await generateTests(targetDir, name, template);
  await generateCI(targetDir, name);
  await generateReadme(targetDir, name, template);
  await generateGitignore(targetDir);

  // Git init
  if (options.git !== false) {
    const { execSync } = require('child_process');
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    console.log(chalk.green('  ✅ Git initialized'));
  }

  // npm install
  if (options.install !== false) {
    const { execSync } = require('child_process');
    console.log(chalk.gray('  📦 Installing dependencies...'));
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
  }

  console.log(chalk.green(`\n✅ HeadyBee "${name}" created successfully!`));
  console.log(chalk.gray(`\nNext steps:`));
  console.log(chalk.white(`  cd ${name}`));
  console.log(chalk.white(`  npm test`));
  console.log(chalk.white(`  npm start`));
  console.log(chalk.gray(`\nDocs: https://headyio.com/docs/create-agent\n`));
}

async function generatePackageJson(dir, name, template) {
  const pkg = {
    name: `@heady/${name}`,
    version: '0.1.0',
    description: `HeadyBee agent: ${name}`,
    main: 'src/index.js',
    scripts: {
      start: 'node src/index.js',
      test: 'jest --coverage',
      'test:watch': 'jest --watch',
      lint: 'eslint src/ tests/',
      dev: 'node --watch src/index.js',
    },
    keywords: ['heady', 'headybee', 'agent', 'mcp', template],
    author: '',
    license: 'MIT',
    dependencies: {
      express: '^4.21.0',
    },
    devDependencies: {
      jest: '^29.0.0',
      eslint: '^9.0.0',
    },
    heady: {
      type: 'bee',
      template,
      version: '3.1',
      phi: PHI,
      capabilities: [],
      rings: 'outer',
    },
  };

  if (template === 'connector') {
    pkg.dependencies['ioredis'] = '^5.0.0';
  }
  if (template === 'creative') {
    pkg.dependencies['@anthropic-ai/sdk'] = '^0.74.0';
  }

  await fs.writeJson(path.join(dir, 'package.json'), pkg, { spaces: 2 });
  console.log(chalk.green('  ✅ package.json'));
}

async function generateBee(dir, name, template, language) {
  const ext = language === 'typescript' ? 'ts' : 'js';
  const className = name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Bee';

  const templates = {
    basic: `'use strict';

const PHI = 1.6180339887;

class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      intervalMs: Math.round(PHI * 5000), // ~8,090ms
      maxRetries: 5, // Fibonacci
      ...config,
    };
    this.metrics = { tasksCompleted: 0, errors: 0, uptime: 0 };
  }

  async initialize() {
    this.status = 'initializing';
    console.log(\`[${className}] Initializing...\`);
    // Setup logic here
    this.status = 'ready';
    console.log(\`[${className}] Ready (interval: \${this.config.intervalMs}ms)\`);
  }

  async execute(task) {
    this.status = 'busy';
    const start = Date.now();
    try {
      const result = await this.process(task);
      this.metrics.tasksCompleted++;
      return { success: true, result, durationMs: Date.now() - start };
    } catch (err) {
      this.metrics.errors++;
      return { success: false, error: err.message, durationMs: Date.now() - start };
    } finally {
      this.status = 'ready';
    }
  }

  async process(task) {
    // Override this method with your bee's logic
    throw new Error('process() must be implemented');
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'shutting_down';
    console.log(\`[${className}] Shutting down...\`);
    // Cleanup logic here
    this.status = 'stopped';
  }
}

module.exports = { ${className} };
`,
    monitor: `'use strict';

const PHI = 1.6180339887;
const { EventEmitter } = require('events');

class ${className} extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      checkIntervalMs: Math.round(PHI * PHI * 3000), // ~7,854ms (PHI-scaled)
      alertThreshold: 0.75,  // CSL coherence threshold
      historySize: 89,       // Fibonacci buffer
      ...config,
    };
    this.history = [];
    this._timer = null;
  }

  async initialize() {
    this.status = 'monitoring';
    this._timer = setInterval(() => this._check(), this.config.checkIntervalMs);
    console.log(\`[${className}] Monitoring started (every \${this.config.checkIntervalMs}ms)\`);
  }

  async _check() {
    try {
      const metrics = await this.collect();
      this.history.push({ timestamp: Date.now(), ...metrics });
      if (this.history.length > this.config.historySize) this.history.shift();

      if (metrics.score < this.config.alertThreshold) {
        this.emit('alert', { bee: this.name, metrics, threshold: this.config.alertThreshold });
      }

      this.emit('check', metrics);
    } catch (err) {
      this.emit('error', { bee: this.name, error: err.message });
    }
  }

  async collect() {
    // Override: return { score: 0-1, ...customMetrics }
    return { score: 1.0 };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      checksCompleted: this.history.length,
      lastCheck: this.history[this.history.length - 1] || null,
      phi: PHI,
    };
  }

  async shutdown() {
    if (this._timer) clearInterval(this._timer);
    this.status = 'stopped';
  }
}

module.exports = { ${className} };
`,
  };

  const code = templates[template] || templates.basic;
  await fs.writeFile(path.join(dir, 'src', `bee.${ext}`), code);
  console.log(chalk.green(`  ✅ src/bee.${ext}`));

  // Index file
  const indexCode = `'use strict';

const express = require('express');
const { ${className} } = require('./bee');

const app = express();
const bee = new ${className}();
const PORT = process.env.PORT || 3900;

app.get('/health', (req, res) => res.json(bee.health()));

async function main() {
  await bee.initialize();
  app.listen(PORT, () => {
    console.log(\`[${className}] Listening on port \${PORT}\`);
  });
}

main().catch(console.error);

process.on('SIGTERM', async () => {
  await bee.shutdown();
  process.exit(0);
});
`;
  await fs.writeFile(path.join(dir, 'src', `index.${ext}`), indexCode);
  console.log(chalk.green(`  ✅ src/index.${ext}`));
}

async function generateConfig(dir, name, template) {
  const config = {
    bee: {
      name,
      template,
      version: '0.1.0',
    },
    phi: PHI,
    timing: {
      interval_ms: Math.round(PHI * 5000),
      timeout_ms: Math.round(PHI * PHI * PHI * 1000),
      backoff_base_ms: 500,
    },
    registration: {
      conductor_url: '${HEADY_CONDUCTOR_URL:-http://localhost:3848}',
      capabilities: [],
      ring: 'outer',
    },
  };

  const yaml = Object.entries(config)
    .map(([k, v]) => `${k}:\n${JSON.stringify(v, null, 2).split('\n').map(l => '  ' + l).join('\n')}`)
    .join('\n\n');

  await fs.writeFile(path.join(dir, 'configs', 'bee-config.yaml'), `# ${name} HeadyBee Configuration\n# PHI = ${PHI}\n\n${yaml}`);
  console.log(chalk.green('  ✅ configs/bee-config.yaml'));
}

async function generateTests(dir, name, template) {
  const className = name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Bee';

  const testCode = `'use strict';

const { ${className} } = require('../src/bee');

describe('${className}', () => {
  let bee;

  beforeEach(() => {
    bee = new ${className}();
  });

  afterEach(async () => {
    await bee.shutdown();
  });

  test('should initialize correctly', async () => {
    await bee.initialize();
    expect(bee.status).toBe('ready');
  });

  test('should report health', () => {
    const health = bee.health();
    expect(health.name).toBe('${name}');
    expect(health.phi).toBeCloseTo(1.618, 2);
  });

  test('should track metrics', async () => {
    await bee.initialize();
    expect(bee.metrics.tasksCompleted).toBe(0);
    expect(bee.metrics.errors).toBe(0);
  });

  test('should shutdown gracefully', async () => {
    await bee.initialize();
    await bee.shutdown();
    expect(bee.status).toBe('stopped');
  });

  test('config uses PHI-scaled intervals', () => {
    const PHI = 1.6180339887;
    expect(bee.config.intervalMs).toBeCloseTo(PHI * 5000, -1);
  });
});
`;

  await fs.writeFile(path.join(dir, 'tests', 'bee.test.js'), testCode);
  console.log(chalk.green('  ✅ tests/bee.test.js'));
}

async function generateCI(dir, name) {
  const ci = `name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Coverage gate (80%)
        run: |
          COVERAGE=$(node -e "const c=require('./coverage/coverage-summary.json'); console.log(c.total.lines.pct)")
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then exit 1; fi
`;
  await fs.writeFile(path.join(dir, '.github', 'workflows', 'ci.yml'), ci);
  console.log(chalk.green('  ✅ .github/workflows/ci.yml'));
}

async function generateReadme(dir, name, template) {
  const readme = `# @heady/${name}

A HeadyBee agent for the [Heady™ ecosystem](https://headyme.com).

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev    # Watch mode
npm test       # Run tests
npm run lint   # Lint code
\`\`\`

## Configuration

Edit \`configs/bee-config.yaml\` to customize PHI-scaled timing and registration.

## Template: ${template}

${TEMPLATES[template]?.desc || 'Basic HeadyBee template'}

## License

MIT
`;
  await fs.writeFile(path.join(dir, 'README.md'), readme);
  console.log(chalk.green('  ✅ README.md'));
}

async function generateGitignore(dir) {
  await fs.writeFile(path.join(dir, '.gitignore'), `node_modules/\ncoverage/\n.env\n.env.*\ndist/\n*.log\n`);
  console.log(chalk.green('  ✅ .gitignore'));
}

program.parse();
