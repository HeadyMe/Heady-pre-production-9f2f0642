'use strict';

/**
 * HeadyEval Datasets
 *
 * Manages evaluation datasets:
 *  - Load from JSON, JSONL, CSV files
 *  - Schema: { input, output?, expected_output?, context?, metadata? }
 *  - Train/test/validation splitting
 *  - Dataset versioning
 *  - Synthetic data generation stubs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const config = require('./config');

// ─── Schema validation ───────────────────────────────────────────────────────

function validateExample(obj, idx) {
  const errors = [];
  if (typeof obj.input !== 'string' || !obj.input.trim()) {
    errors.push(`[${idx}] 'input' must be a non-empty string`);
  }
  if (obj.output !== null && obj.output !== undefined && typeof obj.output !== 'string') {
    errors.push(`[${idx}] 'output' must be a string if present`);
  }
  if (obj.expected_output !== null && obj.expected_output !== undefined && typeof obj.expected_output !== 'string') {
    errors.push(`[${idx}] 'expected_output' must be a string if present`);
  }
  return errors;
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

/**
 * Load examples from a JSON file.
 * Accepts an array of examples or { examples: [...], metadata: {...} }
 */
async function loadJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }

  const examples = Array.isArray(data) ? data : (data.examples || data.data || []);
  const metadata = Array.isArray(data) ? {} : (data.metadata || {});

  return { examples, metadata };
}

/**
 * Load examples from a JSONL (newline-delimited JSON) file.
 */
async function loadJSONL(filePath) {
  return new Promise((resolve, reject) => {
    const examples = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        examples.push(JSON.parse(trimmed));
      } catch (e) {
        reject(new Error(`Invalid JSONL line: ${trimmed.slice(0, 80)}... — ${e.message}`));
      }
    });
    rl.on('close', () => resolve({ examples, metadata: {} }));
    rl.on('error', reject);
  });
}

/**
 * Load examples from a CSV file.
 * First row is header. Column names map to example fields.
 * Required column: input. Optional: output, expected_output, context, metadata
 */
async function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    const lines = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => lines.push(line));
    rl.on('close', () => {
      try {
        if (lines.length < 2) {
          return resolve({ examples: [], metadata: {} });
        }
        const headers = parseCSVRow(lines[0]);
        const examples = lines.slice(1)
          .filter((l) => l.trim())
          .map((line, i) => {
            const values = parseCSVRow(line);
            const obj = {};
            headers.forEach((h, idx) => {
              const key = h.trim().toLowerCase().replace(/\s+/g, '_');
              obj[key] = values[idx] ?? '';
            });
            // Parse metadata column if present
            if (typeof obj.metadata === 'string' && obj.metadata) {
              try { obj.metadata = JSON.parse(obj.metadata); } catch { /* keep string */ }
            }
            return obj;
          });
        resolve({ examples, metadata: {} });
      } catch (e) {
        reject(e);
      }
    });
    rl.on('error', reject);
  });
}

function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Dataset class ───────────────────────────────────────────────────────────

class Dataset {
  /**
   * @param {object} opts
   * @param {string} opts.name
   * @param {object[]} opts.examples
   * @param {object} [opts.metadata]
   * @param {string} [opts.version]
   * @param {string} [opts.id]
   */
  constructor({ name, examples, metadata = {}, version = '1.0.0', id = null }) {
    this.id = id || crypto.randomUUID();
    this.name = name;
    this.version = version;
    this.metadata = metadata;
    this.examples = examples.map((ex, i) => ({
      id: ex.id || `${this.id}-${i}`,
      input: ex.input,
      output: ex.output || null,
      expected_output: ex.expected_output || null,
      context: ex.context || null,
      metadata: ex.metadata || {},
    }));
    this.size = this.examples.length;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Validate all examples against the schema.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    for (let i = 0; i < this.examples.length; i++) {
      const errs = validateExample(this.examples[i], i);
      errors.push(...errs);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Split dataset into train/test/validation.
   * @param {object} [ratios] - { train, test, validation } summing to 1
   * @param {boolean} [shuffle]
   * @returns {{ train: Dataset, test: Dataset, validation: Dataset }}
   */
  split(ratios = { train: 0.7, test: 0.2, validation: 0.1 }, shuffle = true) {
    let examples = [...this.examples];
    if (shuffle) examples = this._shuffle(examples);

    const n = examples.length;
    const trainEnd = Math.floor(n * (ratios.train || 0.7));
    const testEnd = trainEnd + Math.floor(n * (ratios.test || 0.2));

    return {
      train: new Dataset({ name: `${this.name}_train`, examples: examples.slice(0, trainEnd), metadata: this.metadata }),
      test: new Dataset({ name: `${this.name}_test`, examples: examples.slice(trainEnd, testEnd), metadata: this.metadata }),
      validation: new Dataset({ name: `${this.name}_validation`, examples: examples.slice(testEnd), metadata: this.metadata }),
    };
  }

  /**
   * Sample N random examples.
   */
  sample(n) {
    const shuffled = this._shuffle([...this.examples]);
    return new Dataset({ name: `${this.name}_sample_${n}`, examples: shuffled.slice(0, n), metadata: this.metadata });
  }

  /**
   * Filter examples by predicate function.
   */
  filter(predicate) {
    const filtered = this.examples.filter(predicate);
    return new Dataset({ name: `${this.name}_filtered`, examples: filtered, metadata: this.metadata });
  }

  /**
   * Merge another dataset into this one.
   */
  merge(other) {
    return new Dataset({
      name: `${this.name}_merged`,
      examples: [...this.examples, ...other.examples],
      metadata: { ...this.metadata, mergedWith: other.name },
    });
  }

  /**
   * Export to JSON string.
   */
  toJSON() {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      version: this.version,
      size: this.size,
      createdAt: this.createdAt,
      metadata: this.metadata,
      examples: this.examples,
    }, null, 2);
  }

  /**
   * Export to JSONL string.
   */
  toJSONL() {
    return this.examples.map((ex) => JSON.stringify(ex)).join('\n');
  }

  /**
   * Export to CSV string.
   */
  toCSV() {
    const headers = ['id', 'input', 'output', 'expected_output', 'context', 'metadata'];
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = [headers.join(',')];
    for (const ex of this.examples) {
      rows.push(headers.map((h) => escape(ex[h])).join(','));
    }
    return rows.join('\n');
  }

  describe() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      size: this.size,
      createdAt: this.createdAt,
      metadata: this.metadata,
      hasExpectedOutput: this.examples.some((e) => e.expected_output),
      hasContext: this.examples.some((e) => e.context),
    };
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ─── DatasetManager ───────────────────────────────────────────────────────────

class DatasetManager {
  constructor(storageDir = config.datasetsDir) {
    this.storageDir = storageDir;
    this._cache = new Map();
    this._ensureDir();
  }

  _ensureDir() {
    try {
      fs.mkdirSync(this.storageDir, { recursive: true });
    } catch {}
  }

  /**
   * Load a dataset from a file path or object.
   *
   * @param {string|object} source - File path or { name, examples, metadata }
   * @param {object} [opts]
   * @returns {Promise<Dataset>}
   */
  async load(source, opts = {}) {
    if (typeof source === 'string') {
      return this._loadFromFile(source, opts);
    }
    if (typeof source === 'object' && Array.isArray(source.examples)) {
      return new Dataset({ name: opts.name || source.name || 'unnamed', ...source });
    }
    throw new Error('load() expects a file path string or { name, examples } object');
  }

  async _loadFromFile(filePath, opts = {}) {
    const ext = path.extname(filePath).toLowerCase();
    let data;

    switch (ext) {
      case '.json':
        data = await loadJSON(filePath);
        break;
      case '.jsonl':
        data = await loadJSONL(filePath);
        break;
      case '.csv':
        data = await loadCSV(filePath);
        break;
      default:
        throw new Error(`Unsupported dataset file format: ${ext}. Use .json, .jsonl, or .csv`);
    }

    const name = opts.name || path.basename(filePath, ext);
    const dataset = new Dataset({ name, ...data, ...opts });
    this._cache.set(dataset.id, dataset);
    return dataset;
  }

  /**
   * Save a dataset to the storage directory.
   */
  async save(dataset, format = 'json') {
    this._ensureDir();
    const filename = `${dataset.name}_v${dataset.version}.${format}`;
    const filePath = path.join(this.storageDir, filename);

    let content;
    switch (format) {
      case 'json': content = dataset.toJSON(); break;
      case 'jsonl': content = dataset.toJSONL(); break;
      case 'csv': content = dataset.toCSV(); break;
      default: throw new Error(`Unsupported format: ${format}`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    this._cache.set(dataset.id, dataset);
    return filePath;
  }

  /**
   * List all saved datasets in storage directory.
   */
  async list() {
    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
    const datasets = [];
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(this.storageDir, file), 'utf-8'));
        datasets.push({
          id: raw.id,
          name: raw.name,
          version: raw.version,
          size: raw.size,
          createdAt: raw.createdAt,
          file,
        });
      } catch {}
    }
    return datasets;
  }

  /**
   * Load a previously saved dataset by ID or name.
   */
  async get(idOrName) {
    // Check cache first
    if (this._cache.has(idOrName)) return this._cache.get(idOrName);

    // Search storage
    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(this.storageDir, file), 'utf-8'));
        if (raw.id === idOrName || raw.name === idOrName) {
          const dataset = new Dataset(raw);
          this._cache.set(dataset.id, dataset);
          return dataset;
        }
      } catch {}
    }
    return null;
  }

  /**
   * Generate a synthetic evaluation dataset using an LLM.
   * Generates diverse question/answer pairs for a given topic.
   *
   * @param {object} opts
   * @param {string} opts.topic          - Topic to generate questions about
   * @param {number} opts.count          - Number of examples to generate
   * @param {object} opts.judgeClient    - LLM client
   * @param {string} opts.model          - Model to use
   * @param {string} [opts.style]        - 'qa', 'instruction', 'conversational'
   * @returns {Promise<Dataset>}
   */
  async generateSynthetic({ topic, count = 10, judgeClient, model, style = 'qa', name }) {
    const prompt = `Generate ${count} diverse evaluation examples for an AI assistant on the topic: "${topic}".

Style: ${style}

Requirements:
- Each example should test a different aspect of the topic
- Include varying complexity levels (simple, medium, complex)
- For QA style: provide realistic user questions
- Include expected high-quality answers

Response Format (JSON only):
{
  "examples": [
    {
      "input": "<user question or instruction>",
      "expected_output": "<ideal answer>",
      "metadata": { "difficulty": "easy|medium|hard", "aspect": "<what this tests>" }
    }
  ]
}`;

    const response = await judgeClient.complete({
      prompt,
      model,
      temperature: 0.7,
      maxTokens: 4096,
      format: 'json',
    });

    let parsed;
    try {
      parsed = JSON.parse(response.text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim());
    } catch {
      const match = response.text.match(/\{[\s\S]+\}/);
      parsed = match ? JSON.parse(match[0]) : { examples: [] };
    }

    return new Dataset({
      name: name || `synthetic_${topic.replace(/\s+/g, '_')}_${Date.now()}`,
      examples: parsed.examples || [],
      metadata: { synthetic: true, topic, style, generatedAt: new Date().toISOString() },
    });
  }
}

module.exports = { Dataset, DatasetManager, loadJSON, loadJSONL, loadCSV };
