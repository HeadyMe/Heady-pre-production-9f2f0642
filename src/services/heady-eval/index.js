'use strict';

/**
 * HeadyEval — LLM-as-Judge Evaluation Framework
 *
 * Production-ready evaluation framework for the Heady AI platform.
 * Replaces external eval tools with custom scorers for relevance,
 * safety, faithfulness, coherence, and helpfulness.
 *
 * Architecture:
 *  - Sacred Geometry scaling (PHI = 1.618)
 *  - CommonJS modules
 *  - Express with helmet/cors/compression
 *  - Node.js 20+
 *  - Docker/Cloud Run ready
 *
 * @module heady-eval
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

const config = require('./config');
const { Dataset, DatasetManager } = require('./datasets');
const { JudgeClient, JudgeConfig } = require('./judges');
const { Runner, RUN_STATUSES } = require('./runner');
const { ReportGenerator } = require('./reports');

// Scorers
const BaseScorer = require('./scorers/base-scorer');
const RelevanceScorer = require('./scorers/relevance-scorer');
const FaithfulnessScorer = require('./scorers/faithfulness-scorer');
const SafetyScorer = require('./scorers/safety-scorer');
const CoherenceScorer = require('./scorers/coherence-scorer');
const HelpfulnessScorer = require('./scorers/helpfulness-scorer');
const CustomScorer = require('./scorers/custom-scorer');

// ─── Built-in scorer registry ─────────────────────────────────────────────────

const BUILT_IN_SCORERS = {
  relevance: RelevanceScorer,
  faithfulness: FaithfulnessScorer,
  safety: SafetyScorer,
  coherence: CoherenceScorer,
  helpfulness: HelpfulnessScorer,
};

// ─── HeadyEval class ──────────────────────────────────────────────────────────

class HeadyEval extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string}   [opts.inferUrl]         - HeadyInfer URL
   * @param {string}   [opts.embedUrl]         - HeadyEmbed URL
   * @param {string}   [opts.guardUrl]         - HeadyGuard URL
   * @param {string}   [opts.judgeModel]       - Default judge model
   * @param {number}   [opts.concurrency]      - Parallel scorer workers
   * @param {string[]} [opts.defaultScorers]   - Scorer names to use by default
   * @param {string}   [opts.storageDir]       - Base storage directory
   * @param {object}   [opts.judgeOpts]        - Additional JudgeConfig options
   */
  constructor(opts = {}) {
    super();

    this.config = {
      ...config,
      judgeModel: opts.judgeModel || config.judgeModel,
      concurrency: opts.concurrency || config.concurrency,
      defaultScorers: opts.defaultScorers || config.defaultScorers,
    };

    // Judge configuration
    this.judgeConfig = new JudgeConfig({
      inferUrl: opts.inferUrl || config.headyInferUrl,
      model: this.config.judgeModel,
      ...(opts.judgeOpts || {}),
    });

    // Embed client (lightweight HTTP call)
    this.embedClient = opts.embedClient || this._buildEmbedClient(opts.embedUrl || config.headyEmbedUrl);

    // Guard client
    this.guardClient = opts.guardClient || this._buildGuardClient(opts.guardUrl || config.headyGuardUrl);

    // Dataset manager
    this.datasets = new DatasetManager(opts.datasetsDir || config.datasetsDir);

    // Runner
    this.runner = new Runner({
      concurrency: this.config.concurrency,
      checkpointsDir: opts.checkpointsDir || config.checkpointsDir,
      judgeClient: this.judgeConfig.primary,
      embedClient: this.embedClient,
      guardClient: this.guardClient,
    });

    // Forward runner events
    this.runner.on('run:start', (e) => this.emit('run:start', e));
    this.runner.on('run:progress', (e) => this.emit('run:progress', e));
    this.runner.on('run:complete', (e) => this.emit('run:complete', e));
    this.runner.on('run:error', (e) => this.emit('run:error', e));

    // Report generator
    this.reporter = new ReportGenerator();

    // Custom scorer registry
    this._customScorers = new Map();

    // Run persistence (in-memory + optional disk)
    this._runs = new Map();
    this._runReports = new Map();
  }

  // ─── Scorer management ────────────────────────────────────────────────────

  /**
   * Instantiate scorers from a list of names.
   *
   * @param {string[]} scorerNames
   * @param {object} [scorerOpts] - Per-scorer option overrides
   * @returns {BaseScorer[]}
   */
  buildScorers(scorerNames, scorerOpts = {}) {
    return scorerNames.map((name) => {
      const opts = scorerOpts[name] || {};

      // Check custom registry first
      if (this._customScorers.has(name)) {
        const def = this._customScorers.get(name);
        return CustomScorer.create(def, opts);
      }

      const ScorerClass = BUILT_IN_SCORERS[name];
      if (!ScorerClass) {
        throw new Error(`Unknown scorer '${name}'. Built-in: ${Object.keys(BUILT_IN_SCORERS).join(', ')}. Custom: ${[...this._customScorers.keys()].join(', ')}`);
      }
      return new ScorerClass(opts);
    });
  }

  /**
   * Register a custom scorer.
   *
   * @param {object} definition - { name, description, rubric, dimensions, ... }
   */
  registerScorer(definition) {
    if (!definition.name) throw new Error('Custom scorer definition requires a name');
    this._customScorers.set(definition.name, definition);
    return this;
  }

  /**
   * List all available scorers (built-in + registered custom).
   */
  listScorers() {
    const scorers = Object.entries(BUILT_IN_SCORERS).map(([name, Cls]) => ({
      name,
      description: Cls.description || '',
      dimensions: Cls.dimensions || [],
      type: 'built-in',
    }));

    for (const [name, def] of this._customScorers.entries()) {
      scorers.push({
        name,
        description: def.description || '',
        dimensions: def.dimensions || [],
        type: 'custom',
        rubric: def.rubric || null,
      });
    }

    return scorers;
  }

  // ─── Single example scoring ───────────────────────────────────────────────

  /**
   * Score a single example.
   *
   * @param {object} example      - { input, output, context?, expected_output? }
   * @param {object} [opts]
   * @param {string[]} [opts.scorers]     - Scorer names (defaults to defaultScorers)
   * @param {object}  [opts.scorerOpts]
   * @returns {Promise<object>}
   */
  async score(example, opts = {}) {
    const scorerNames = opts.scorers || this.config.defaultScorers;
    const scorers = this.buildScorers(scorerNames, opts.scorerOpts || {});
    return this.runner.scoreExample(example, scorers);
  }

  // ─── Batch evaluation ─────────────────────────────────────────────────────

  /**
   * Run a full evaluation on a dataset.
   *
   * @param {object} opts
   * @param {Dataset|string} opts.dataset   - Dataset instance or dataset ID/name
   * @param {string[]}  [opts.scorers]      - Scorer names
   * @param {string}    [opts.name]         - Run name
   * @param {string}    [opts.runId]        - Optional explicit run ID
   * @param {object}    [opts.metadata]
   * @param {object}    [opts.scorerOpts]
   * @returns {Promise<{ run: EvalRun, report: object }>}
   */
  async evaluate(opts = {}) {
    // Resolve dataset
    let dataset = opts.dataset;
    if (typeof dataset === 'string') {
      dataset = await this.datasets.get(dataset);
      if (!dataset) throw new Error(`Dataset not found: ${opts.dataset}`);
    }
    if (!dataset || !(dataset instanceof Dataset)) {
      throw new Error('opts.dataset must be a Dataset instance or dataset ID/name');
    }

    const scorerNames = opts.scorers || this.config.defaultScorers;
    const scorers = this.buildScorers(scorerNames, opts.scorerOpts || {});
    const runId = opts.runId || crypto.randomUUID();

    const run = await this.runner.execute({
      runId,
      name: opts.name || `eval_${dataset.name}_${Date.now()}`,
      dataset,
      scorers,
      metadata: opts.metadata || {},
    });

    this._runs.set(run.id, run);

    const report = this.reporter.buildReport(run, opts.reportOpts || {});
    this._runReports.set(run.id, report);

    return { run, report };
  }

  // ─── Comparison mode ──────────────────────────────────────────────────────

  /**
   * Compare multiple models/configurations on the same dataset.
   *
   * @param {object} opts
   * @param {Dataset} opts.dataset
   * @param {Array<{name: string, outputField?: string, examples?: object[]}>} opts.models
   * @param {string[]} [opts.scorers]
   * @returns {Promise<object>} comparison report
   */
  async compare(opts = {}) {
    const { dataset, models, scorers: scorerNames } = opts;

    if (!Array.isArray(models) || models.length < 2) {
      throw new Error('compare() requires at least 2 models');
    }

    const runModels = [];

    for (const modelDef of models) {
      // Build dataset for this model: replace output with model-specific output
      let modelExamples = dataset.examples;
      if (modelDef.examples) {
        modelExamples = modelDef.examples;
      } else if (modelDef.outputField) {
        modelExamples = dataset.examples.map((ex) => ({
          ...ex,
          output: ex.metadata?.[modelDef.outputField] || ex.output,
        }));
      }

      const modelDataset = new Dataset({
        name: `${dataset.name}_${modelDef.name}`,
        examples: modelExamples,
        metadata: { ...dataset.metadata, modelName: modelDef.name },
      });

      const { run } = await this.evaluate({
        dataset: modelDataset,
        scorers: scorerNames,
        name: `compare_${modelDef.name}_${Date.now()}`,
        metadata: { comparisonModel: modelDef.name, ...opts.metadata },
        scorerOpts: opts.scorerOpts,
      });

      runModels.push({ run, modelName: modelDef.name });
    }

    return this.reporter.buildComparisonReport(runModels);
  }

  // ─── A/B testing ─────────────────────────────────────────────────────────

  /**
   * A/B test two model variants on the same dataset.
   * Returns a structured A/B result with statistical significance indicator.
   *
   * @param {object} opts
   * @param {Dataset} opts.dataset
   * @param {{name: string, examples?: object[]}} opts.variantA
   * @param {{name: string, examples?: object[]}} opts.variantB
   * @param {string[]} [opts.scorers]
   * @returns {Promise<object>}
   */
  async abTest(opts = {}) {
    const { dataset, variantA, variantB } = opts;
    const comparison = await this.compare({
      dataset,
      models: [variantA, variantB],
      scorers: opts.scorers,
      metadata: { abTest: true },
    });

    const [a, b] = comparison.models;
    const scorerNames = Object.keys(a.scorers);

    const abResult = {
      variantA: variantA.name,
      variantB: variantB.name,
      overallWinner: comparison.overallWinner,
      overallDelta: (b.overall.mean || 0) - (a.overall.mean || 0),
      scorerComparison: {},
      recommendation: null,
      comparison,
    };

    for (const scorer of scorerNames) {
      const aScore = a.scorers[scorer]?.mean || 0;
      const bScore = b.scorers[scorer]?.mean || 0;
      const delta = bScore - aScore;
      abResult.scorerComparison[scorer] = {
        [variantA.name]: aScore,
        [variantB.name]: bScore,
        delta: parseFloat(delta.toFixed(4)),
        winner: delta > 0.05 ? variantB.name : (delta < -0.05 ? variantA.name : 'tie'),
      };
    }

    const deltaOverall = abResult.overallDelta;
    if (Math.abs(deltaOverall) < 0.05) {
      abResult.recommendation = 'No significant difference between variants.';
    } else if (deltaOverall > 0) {
      abResult.recommendation = `${variantB.name} outperforms ${variantA.name} by ${deltaOverall.toFixed(3)} on the overall aggregate.`;
    } else {
      abResult.recommendation = `${variantA.name} outperforms ${variantB.name} by ${Math.abs(deltaOverall).toFixed(3)} on the overall aggregate.`;
    }

    return abResult;
  }

  // ─── Run management ───────────────────────────────────────────────────────

  getRun(runId) {
    const run = this._runs.get(runId) || this.runner.getRun(runId);
    return run || null;
  }

  getRunReport(runId) {
    return this._runReports.get(runId) || null;
  }

  listRuns() {
    const inMemory = this.runner.listRuns();
    const fromFramework = Array.from(this._runs.values()).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      processedExamples: r.processedExamples,
      totalExamples: r.totalExamples,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
    }));

    // Merge, dedup by id
    const seen = new Set();
    return [...fromFramework, ...inMemory].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  // ─── Dataset management pass-through ─────────────────────────────────────

  async loadDataset(source, opts = {}) {
    return this.datasets.load(source, opts);
  }

  async saveDataset(dataset, format = 'json') {
    return this.datasets.save(dataset, format);
  }

  async listDatasets() {
    return this.datasets.list();
  }

  async generateSyntheticDataset(opts) {
    return this.datasets.generateSynthetic({
      ...opts,
      judgeClient: this.judgeConfig.primary,
      model: opts.model || this.config.judgeModel,
    });
  }

  // ─── Report exports ───────────────────────────────────────────────────────

  exportReport(report, format = 'json') {
    switch (format) {
      case 'json': return this.reporter.toJSON(report);
      case 'csv': return this.reporter.toCSV(report);
      case 'html': return this.reporter.toHTML(report);
      default: throw new Error(`Unsupported report format: ${format}`);
    }
  }

  buildTrends(reports) {
    return this.reporter.buildTrends(reports);
  }

  // ─── HTTP clients ─────────────────────────────────────────────────────────

  _buildEmbedClient(baseUrl) {
    return {
      embed: async (text) => {
        const { default: fetch } = await Promise.resolve().then(() => {
          // Use native fetch (Node 18+) or fall back to http module
          if (typeof globalThis.fetch === 'function') return { default: globalThis.fetch };
          const http = require('http');
          const https = require('https');
          return {
            default: (url, opts) => new Promise((resolve, reject) => {
              const parsed = new URL(url);
              const transport = parsed.protocol === 'https:' ? https : http;
              const bodyStr = opts.body || '';
              const req = transport.request({
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname,
                method: opts.method || 'GET',
                headers: opts.headers || {},
              }, (res) => {
                let data = '';
                res.on('data', (c) => { data += c; });
                res.on('end', () => resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  json: () => Promise.resolve(JSON.parse(data)),
                }));
              });
              req.on('error', reject);
              if (bodyStr) req.write(bodyStr);
              req.end();
            }),
          };
        });

        const res = await fetch(`${baseUrl}/v1/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`HeadyEmbed error: ${res.status}`);
        const data = await res.json();
        return data.embedding || data.vector || data.embeddings?.[0];
      },
    };
  }

  _buildGuardClient(baseUrl) {
    return {
      check: async (text) => {
        try {
          const http = require('http');
          const https = require('https');
          const parsed = new URL(`${baseUrl}/v1/check`);
          const transport = parsed.protocol === 'https:' ? https : http;
          const body = JSON.stringify({ text });
          return new Promise((resolve, reject) => {
            const req = transport.request({
              hostname: parsed.hostname,
              port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
              path: parsed.pathname,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            }, (res) => {
              let data = '';
              res.on('data', (c) => { data += c; });
              res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error(`Invalid JSON from HeadyGuard`)); }
              });
            });
            req.setTimeout(5000, () => { req.destroy(); reject(new Error('HeadyGuard timeout')); });
            req.on('error', reject);
            req.write(body);
            req.end();
          });
        } catch {
          return null;
        }
      },
    };
  }

  // ─── Judge stats ──────────────────────────────────────────────────────────

  getJudgeStats() {
    return this.judgeConfig.primary.getStats();
  }
}

// ─── Express service bootstrap ────────────────────────────────────────────────

/**
 * Create and start the HeadyEval Express service.
 *
 * @param {object} [opts] - HeadyEval constructor options
 * @returns {Promise<{ app, server, eval: HeadyEval }>}
 */
async function createService(opts = {}) {
  const express = require('express');
  const helmet = require('helmet');
  const cors = require('cors');
  const compression = require('compression');
  const routes = require('./routes');
  const health = require('./health');

  const evalInstance = new HeadyEval(opts);

  const app = express();
  app.set('trust proxy', config.trustProxy);

  // Security & middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Attach eval instance to app for routes
  app.locals.eval = evalInstance;

  // Mount routes
  app.use('/', routes(evalInstance));

  // Health check
  app.get('/health', (req, res) => health.check(req, res, evalInstance));
  app.get('/metrics', (req, res) => health.metrics(req, res, evalInstance));

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Error handler
  app.use((err, req, res, _next) => {
    console.error('[heady-eval] Unhandled error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      ...(config.isDev && { stack: err.stack }),
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(config.port, config.host, () => {
      console.log(`[heady-eval] Service listening on ${config.host}:${config.port}`);
      resolve({ app, server, eval: evalInstance });
    });
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  HeadyEval,
  createService,
  // Scorers
  BaseScorer,
  RelevanceScorer,
  FaithfulnessScorer,
  SafetyScorer,
  CoherenceScorer,
  HelpfulnessScorer,
  CustomScorer,
  // Dataset
  Dataset,
  DatasetManager,
  // Judges
  JudgeClient,
  JudgeConfig,
  // Runner
  Runner,
  RUN_STATUSES,
  // Reports
  ReportGenerator,
  // Config
  config,
};

// ─── CLI entry point ─────────────────────────────────────────────────────────

if (require.main === module) {
  createService().catch((err) => {
    console.error('[heady-eval] Fatal startup error:', err);
    process.exit(1);
  });
}
