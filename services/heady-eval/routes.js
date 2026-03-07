'use strict';

/**
 * HeadyEval Express Router
 *
 * Endpoints:
 *  POST   /eval/run             - Start evaluation run
 *  GET    /eval/run/:id         - Get run status and results
 *  GET    /eval/runs            - List all runs
 *  POST   /eval/score           - Score a single example
 *  POST   /eval/compare         - Compare models on same dataset
 *  POST   /eval/ab-test         - A/B test two model variants
 *  POST   /eval/datasets        - Upload/create dataset
 *  GET    /eval/datasets        - List datasets
 *  GET    /eval/datasets/:id    - Get dataset info
 *  GET    /eval/reports/:runId  - Get evaluation report
 *  GET    /eval/reports/:runId/html - Get HTML report
 *  GET    /eval/reports/:runId/csv  - Download CSV report
 *  GET    /eval/scorers         - List available scorers
 *  POST   /eval/scorers         - Register custom scorer
 *  GET    /metrics              - Service metrics
 *  GET    /health               - Health check
 */

const { Router } = require('express');
const { Dataset } = require('./datasets');
const config = require('./config');

// ─── Input validation helpers ─────────────────────────────────────────────────

function validateExample(body, res) {
  if (!body.input || typeof body.input !== 'string') {
    res.status(400).json({ error: 'body.input must be a non-empty string' });
    return false;
  }
  if (!body.output || typeof body.output !== 'string') {
    res.status(400).json({ error: 'body.output must be a non-empty string' });
    return false;
  }
  return true;
}

function extractScorers(body) {
  if (Array.isArray(body.scorers)) return body.scorers;
  if (typeof body.scorers === 'string') return body.scorers.split(',').map((s) => s.trim());
  return null;
}

// ─── Router factory ───────────────────────────────────────────────────────────

module.exports = function createRouter(evalInstance) {
  const router = Router();

  // ─── POST /eval/run ─────────────────────────────────────────────────────

  router.post('/eval/run', async (req, res) => {
    try {
      const {
        name,
        runId,
        datasetId,
        examples,
        datasetName,
        metadata,
        reportOpts,
      } = req.body;

      const scorerNames = extractScorers(req.body);

      let dataset;
      if (datasetId) {
        dataset = await evalInstance.datasets.get(datasetId);
        if (!dataset) return res.status(404).json({ error: `Dataset not found: ${datasetId}` });
      } else if (Array.isArray(examples) && examples.length > 0) {
        dataset = new Dataset({
          name: datasetName || `inline_${Date.now()}`,
          examples,
        });
        const validation = dataset.validate();
        if (!validation.valid) {
          return res.status(400).json({ error: 'Dataset validation failed', details: validation.errors });
        }
      } else {
        return res.status(400).json({ error: 'Provide either datasetId or examples array' });
      }

      // Return run ID immediately, execute in background
      const inferredRunId = runId || require('crypto').randomUUID();

      res.status(202).json({
        runId: inferredRunId,
        status: 'accepted',
        message: 'Evaluation run started',
        totalExamples: dataset.size,
        scorers: scorerNames || config.defaultScorers,
      });

      // Execute asynchronously (do not await in handler)
      evalInstance.evaluate({
        dataset,
        scorers: scorerNames || undefined,
        name: name || `run_${dataset.name}`,
        runId: inferredRunId,
        metadata: metadata || {},
        reportOpts: reportOpts || {},
      }).catch((err) => {
        console.error(`[heady-eval] Run ${inferredRunId} failed:`, err.message);
      });

    } catch (err) {
      console.error('[heady-eval] POST /eval/run error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /eval/run/:id ──────────────────────────────────────────────────

  router.get('/eval/run/:id', (req, res) => {
    const run = evalInstance.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: `Run not found: ${req.params.id}` });

    const detail = req.query.detail === 'true';
    if (detail) {
      return res.json(run.toJSON ? run.toJSON() : run);
    }

    res.json({
      id: run.id,
      name: run.name,
      status: run.status,
      totalExamples: run.totalExamples,
      processedExamples: run.processedExamples,
      failedExamples: run.failedExamples,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      errorMessage: run.errorMessage,
      costEstimate: run.costEstimate,
      scorerNames: run.scorerNames,
    });
  });

  // ─── GET /eval/runs ─────────────────────────────────────────────────────

  router.get('/eval/runs', (req, res) => {
    const runs = evalInstance.listRuns();
    const { status, limit = 50, offset = 0 } = req.query;
    let filtered = runs;
    if (status) filtered = runs.filter((r) => r.status === status);
    res.json({
      runs: filtered.slice(Number(offset), Number(offset) + Number(limit)),
      total: filtered.length,
    });
  });

  // ─── POST /eval/score ───────────────────────────────────────────────────

  router.post('/eval/score', async (req, res) => {
    try {
      if (!validateExample(req.body, res)) return;
      const scorerNames = extractScorers(req.body) || undefined;

      const example = {
        input: req.body.input,
        output: req.body.output,
        context: req.body.context || null,
        expected_output: req.body.expected_output || null,
        metadata: req.body.metadata || {},
        id: require('crypto').randomUUID(),
      };

      const result = await evalInstance.score(example, { scorers: scorerNames });
      res.json(result);
    } catch (err) {
      console.error('[heady-eval] POST /eval/score error:', err);
      res.status(err.message.includes('Unknown scorer') ? 400 : 500).json({ error: err.message });
    }
  });

  // ─── POST /eval/compare ─────────────────────────────────────────────────

  router.post('/eval/compare', async (req, res) => {
    try {
      const { models, examples, datasetId, metadata } = req.body;
      const scorerNames = extractScorers(req.body) || undefined;

      if (!Array.isArray(models) || models.length < 2) {
        return res.status(400).json({ error: 'Provide at least 2 models in the models array' });
      }

      let dataset;
      if (datasetId) {
        dataset = await evalInstance.datasets.get(datasetId);
        if (!dataset) return res.status(404).json({ error: `Dataset not found: ${datasetId}` });
      } else if (Array.isArray(examples)) {
        dataset = new Dataset({ name: `compare_inline_${Date.now()}`, examples });
      } else {
        return res.status(400).json({ error: 'Provide either datasetId or examples array' });
      }

      const comparison = await evalInstance.compare({
        dataset,
        models,
        scorers: scorerNames,
        metadata: metadata || {},
      });

      res.json(comparison);
    } catch (err) {
      console.error('[heady-eval] POST /eval/compare error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /eval/ab-test ─────────────────────────────────────────────────

  router.post('/eval/ab-test', async (req, res) => {
    try {
      const { variantA, variantB, examples, datasetId, metadata } = req.body;
      const scorerNames = extractScorers(req.body) || undefined;

      if (!variantA || !variantB) {
        return res.status(400).json({ error: 'Provide variantA and variantB objects with { name, examples? }' });
      }

      let dataset;
      if (datasetId) {
        dataset = await evalInstance.datasets.get(datasetId);
        if (!dataset) return res.status(404).json({ error: `Dataset not found: ${datasetId}` });
      } else if (Array.isArray(examples)) {
        dataset = new Dataset({ name: `ab_inline_${Date.now()}`, examples });
      } else {
        return res.status(400).json({ error: 'Provide either datasetId or examples array' });
      }

      const result = await evalInstance.abTest({
        dataset,
        variantA,
        variantB,
        scorers: scorerNames,
        metadata: metadata || {},
      });

      res.json(result);
    } catch (err) {
      console.error('[heady-eval] POST /eval/ab-test error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /eval/datasets ────────────────────────────────────────────────

  router.post('/eval/datasets', async (req, res) => {
    try {
      const { name, examples, metadata, version, generateSynthetic } = req.body;

      if (generateSynthetic) {
        const { topic, count, style } = generateSynthetic;
        if (!topic) return res.status(400).json({ error: 'generateSynthetic.topic is required' });

        const dataset = await evalInstance.generateSyntheticDataset({
          topic,
          count: count || 10,
          style: style || 'qa',
          name: name || `synthetic_${topic.replace(/\s+/g, '_')}`,
        });
        await evalInstance.saveDataset(dataset);
        return res.status(201).json(dataset.describe());
      }

      if (!Array.isArray(examples) || examples.length === 0) {
        return res.status(400).json({ error: 'Provide examples array or generateSynthetic options' });
      }
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const dataset = new Dataset({ name, examples, metadata: metadata || {}, version: version || '1.0.0' });
      const validation = dataset.validate();
      if (!validation.valid) {
        return res.status(400).json({ error: 'Dataset validation failed', details: validation.errors });
      }

      await evalInstance.saveDataset(dataset);
      res.status(201).json(dataset.describe());
    } catch (err) {
      console.error('[heady-eval] POST /eval/datasets error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /eval/datasets ─────────────────────────────────────────────────

  router.get('/eval/datasets', async (req, res) => {
    try {
      const datasets = await evalInstance.listDatasets();
      res.json({ datasets, total: datasets.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /eval/datasets/:id ─────────────────────────────────────────────

  router.get('/eval/datasets/:id', async (req, res) => {
    try {
      const dataset = await evalInstance.datasets.get(req.params.id);
      if (!dataset) return res.status(404).json({ error: `Dataset not found: ${req.params.id}` });

      const detail = req.query.detail === 'true';
      if (detail) {
        return res.json(JSON.parse(dataset.toJSON()));
      }
      res.json(dataset.describe());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /eval/reports/:runId ───────────────────────────────────────────

  router.get('/eval/reports/:runId', (req, res) => {
    const report = evalInstance.getRunReport(req.params.runId);
    if (!report) {
      // Try to build from run if available
      const run = evalInstance.getRun(req.params.runId);
      if (!run) return res.status(404).json({ error: `Run not found: ${req.params.runId}` });
      if (run.status !== 'completed') {
        return res.status(202).json({ error: `Run is ${run.status}`, runId: run.id, status: run.status });
      }
      const built = evalInstance.reporter.buildReport(run);
      return res.json(built);
    }
    res.json(report);
  });

  // ─── GET /eval/reports/:runId/html ─────────────────────────────────────

  router.get('/eval/reports/:runId/html', (req, res) => {
    const report = evalInstance.getRunReport(req.params.runId);
    if (!report) return res.status(404).json({ error: `Report not found: ${req.params.runId}` });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(evalInstance.reporter.toHTML(report));
  });

  // ─── GET /eval/reports/:runId/csv ──────────────────────────────────────

  router.get('/eval/reports/:runId/csv', (req, res) => {
    const report = evalInstance.getRunReport(req.params.runId);
    if (!report) return res.status(404).json({ error: `Report not found: ${req.params.runId}` });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="heady-eval-${req.params.runId}.csv"`);
    res.send(evalInstance.reporter.toCSV(report));
  });

  // ─── GET /eval/scorers ──────────────────────────────────────────────────

  router.get('/eval/scorers', (req, res) => {
    res.json({ scorers: evalInstance.listScorers() });
  });

  // ─── POST /eval/scorers ─────────────────────────────────────────────────

  router.post('/eval/scorers', (req, res) => {
    try {
      const { name, description, dimensions, rubric, judgePrompt, passThreshold } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      if (!rubric && !judgePrompt) {
        return res.status(400).json({ error: 'Either rubric or judgePrompt is required' });
      }

      evalInstance.registerScorer({ name, description, dimensions, rubric, judgePrompt, passThreshold });
      res.status(201).json({ message: `Custom scorer '${name}' registered`, name });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── GET /eval/trends ───────────────────────────────────────────────────

  router.get('/eval/trends', (req, res) => {
    const { runIds } = req.query;
    if (!runIds) return res.status(400).json({ error: 'runIds query param required (comma-separated)' });

    const ids = String(runIds).split(',').map((s) => s.trim());
    const reports = ids
      .map((id) => evalInstance.getRunReport(id))
      .filter(Boolean);

    if (reports.length === 0) {
      return res.status(404).json({ error: 'No reports found for provided run IDs' });
    }

    res.json(evalInstance.buildTrends(reports));
  });

  // ─── Judge calibration check ─────────────────────────────────────────────

  router.post('/eval/calibrate', async (req, res) => {
    try {
      const { scorerName, examples: calibrationExamples } = req.body;
      if (!scorerName) return res.status(400).json({ error: 'scorerName is required' });
      if (!Array.isArray(calibrationExamples)) {
        return res.status(400).json({ error: 'examples array is required' });
      }

      const [scorer] = evalInstance.buildScorers([scorerName]);
      for (const ex of calibrationExamples) {
        if (ex.goldScores) {
          evalInstance.judgeConfig.addCalibrationExample(ex, ex.goldScores);
        }
      }

      const result = await evalInstance.judgeConfig.calibrator.calibrate(
        evalInstance.judgeConfig.primary,
        scorer
      );

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
