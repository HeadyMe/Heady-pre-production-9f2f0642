/**
 * @fileoverview VSA Codebook Manager for Heady
 * @description Manages collections of named hypervectors (semantic concepts)
 * @version 1.0.0
 */

const { Hypervector } = require('./hypervector');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * VSACodebook manages a collection of named hypervectors representing concepts
 */
class VSACodebook {
  /**
   * Create a new codebook
   * @param {number} [dimensionality=4096] - Hypervector dimensionality
   */
  constructor(dimensionality = 4096) {
    this.dimensionality = dimensionality;
    this.concepts = new Map(); // concept name -> Hypervector
    this.metadata = new Map(); // concept name -> metadata object
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add a new concept to the codebook
   * @param {string} name - Concept name (e.g., "SEMANTIC_LOGIC", "HEADY_GATE")
   * @param {Hypervector} [vector] - Pre-existing vector or generate new random one
   * @param {Object} [metadata] - Additional metadata
   * @returns {Hypervector} The added hypervector
   */
  add(name, vector = null, metadata = {}) {
    if (this.concepts.has(name)) {
      logger.warn(`Concept '${name}' already exists in codebook. Overwriting.`);
    }

    const hv = vector || Hypervector.random(this.dimensionality);

    if (hv.dimensionality !== this.dimensionality) {
      throw new Error(`Vector dimensionality (${hv.dimensionality}) must match codebook (${this.dimensionality})`);
    }

    this.concepts.set(name, hv);
    this.metadata.set(name, {
      ...metadata,
      addedAt: new Date().toISOString(),
      type: metadata.type || 'atomic'
    });

    logger.debug(`Added concept '${name}' to codebook`);
    return hv;
  }

  /**
   * Get a concept by name
   * @param {string} name
   * @returns {Hypervector|null}
   */
  get(name) {
    return this.concepts.get(name) || null;
  }

  /**
   * Check if concept exists
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.concepts.has(name);
  }

  /**
   * Remove a concept
   * @param {string} name
   * @returns {boolean} True if removed, false if not found
   */
  remove(name) {
    const removed = this.concepts.delete(name);
    if (removed) {
      this.metadata.delete(name);
      logger.debug(`Removed concept '${name}' from codebook`);
    }
    return removed;
  }

  /**
   * Create a composite concept using binding
   * Example: bind("HEADY_SEMANTIC", ["HEADY", "SEMANTIC"])
   * @param {string} name - New concept name
   * @param {Array<string>} conceptNames - Concepts to bind
   * @param {Object} [metadata] - Metadata for composite
   * @returns {Hypervector}
   */
  bind(name, conceptNames, metadata = {}) {
    if (conceptNames.length < 2) {
      throw new Error('Binding requires at least 2 concepts');
    }

    const vectors = conceptNames.map(n => {
      const v = this.get(n);
      if (!v) throw new Error(`Concept '${n}' not found in codebook`);
      return v;
    });

    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = result.bind(vectors[i]);
    }

    this.add(name, result, {
      ...metadata,
      type: 'composite_bound',
      constituents: conceptNames
    });

    return result;
  }

  /**
   * Create a bundle (superposition) of concepts
   * Example: bundle("ANIMALS", ["CAT", "DOG", "BIRD"])
   * @param {string} name - New concept name
   * @param {Array<string>} conceptNames - Concepts to bundle
   * @param {Object} [metadata] - Metadata for bundle
   * @returns {Hypervector}
   */
  bundle(name, conceptNames, metadata = {}) {
    if (conceptNames.length < 2) {
      throw new Error('Bundling requires at least 2 concepts');
    }

    const vectors = conceptNames.map(n => {
      const v = this.get(n);
      if (!v) throw new Error(`Concept '${n}' not found in codebook`);
      return v;
    });

    const result = vectors[0].bundle(vectors.slice(1));

    this.add(name, result, {
      ...metadata,
      type: 'composite_bundled',
      constituents: conceptNames
    });

    return result;
  }

  /**
   * Create a sequence representation using permutation
   * Example: sequence("ABC_SEQ", ["A", "B", "C"]) creates ordered A->B->C
   * @param {string} name - New concept name
   * @param {Array<string>} conceptNames - Ordered concepts
   * @param {Object} [metadata] - Metadata
   * @returns {Hypervector}
   */
  sequence(name, conceptNames, metadata = {}) {
    if (conceptNames.length < 1) {
      throw new Error('Sequence requires at least 1 concept');
    }

    const vectors = conceptNames.map(n => {
      const v = this.get(n);
      if (!v) throw new Error(`Concept '${n}' not found in codebook`);
      return v;
    });

    // Bundle permuted versions: X₀ + P(X₁) + P²(X₂) + ...
    const permuted = vectors.map((v, i) => v.permute(i));
    const result = permuted[0].bundle(permuted.slice(1));

    this.add(name, result, {
      ...metadata,
      type: 'sequence',
      constituents: conceptNames,
      order: 'forward'
    });

    return result;
  }

  /**
   * Query the codebook with a hypervector (resonator operation)
   * Finds most similar concept
   * @param {Hypervector} query
   * @param {number} [threshold=0.5] - Minimum similarity
   * @param {number} [topK=1] - Return top K matches
   * @returns {Array<{name: string, similarity: number, metadata: Object}>}
   */
  query(query, threshold = 0.5, topK = 1) {
    const results = [];

    for (const [name, vector] of this.concepts) {
      const similarity = query.similarity(vector);
      if (similarity >= threshold) {
        results.push({
          name,
          similarity,
          metadata: this.metadata.get(name)
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Get all concept names
   * @returns {Array<string>}
   */
  listConcepts() {
    return Array.from(this.concepts.keys());
  }

  /**
   * Get codebook statistics
   * @returns {Object}
   */
  stats() {
    const types = {};
    for (const meta of this.metadata.values()) {
      types[meta.type] = (types[meta.type] || 0) + 1;
    }

    return {
      totalConcepts: this.concepts.size,
      dimensionality: this.dimensionality,
      conceptTypes: types,
      createdAt: this.createdAt,
      memoryUsage: `~${(this.concepts.size * this.dimensionality * 4 / 1024 / 1024).toFixed(2)} MB`
    };
  }

  /**
   * Save codebook to JSON file
   * @param {string} filepath
   */
  async save(filepath) {
    const data = {
      dimensionality: this.dimensionality,
      createdAt: this.createdAt,
      concepts: {}
    };

    for (const [name, vector] of this.concepts) {
      data.concepts[name] = {
        values: Array.from(vector.values),
        metadata: this.metadata.get(name)
      };
    }

    await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.info(`Saved codebook to ${filepath}`);
  }

  /**
   * Load codebook from JSON file
   * @param {string} filepath
   * @returns {VSACodebook}
   */
  static async load(filepath) {
    const data = JSON.parse(await fs.promises.readFile(filepath, 'utf8'));

    const codebook = new VSACodebook(data.dimensionality);
    codebook.createdAt = data.createdAt;

    for (const [name, conceptData] of Object.entries(data.concepts)) {
      const vector = new Hypervector(conceptData.values, data.dimensionality);
      codebook.add(name, vector, conceptData.metadata);
    }

    logger.info(`Loaded codebook from ${filepath} with ${codebook.concepts.size} concepts`);
    return codebook;
  }

  /**
   * Create a default Heady codebook with semantic concepts
   * @param {number} [dimensionality=4096]
   * @returns {VSACodebook}
   */
  static createHeadyCodebook(dimensionality = 4096) {
    const codebook = new VSACodebook(dimensionality);

    // Atomic semantic concepts
    const atomics = [
      'RESONANCE', 'SUPERPOSITION', 'ORTHOGONAL', 'SOFT',
      'PHI', 'GOLDEN', 'SEMANTIC', 'LOGIC',
      'GATE', 'INPUT', 'OUTPUT', 'STATE',
      'TRUE', 'FALSE', 'CONTINUOUS', 'DISCRETE',
      'HEADY', 'AGENT', 'ORCHESTRATOR', 'CONDUCTOR'
    ];

    for (const concept of atomics) {
      codebook.add(concept, null, { type: 'atomic', domain: 'heady_core' });
    }

    // Composite concepts (gates)
    codebook.bind('RESONANCE_GATE', ['RESONANCE', 'GATE'], { domain: 'csl_gates' });
    codebook.bind('SUPERPOSITION_GATE', ['SUPERPOSITION', 'GATE'], { domain: 'csl_gates' });
    codebook.bind('ORTHOGONAL_GATE', ['ORTHOGONAL', 'GATE'], { domain: 'csl_gates' });
    codebook.bind('SOFT_GATE', ['SOFT', 'GATE'], { domain: 'csl_gates' });

    // Phi-scale concepts
    codebook.bind('PHI_SCALE', ['PHI', 'GOLDEN'], { domain: 'phi_scales' });
    codebook.bind('PHI_RANGE', ['PHI', 'CONTINUOUS'], { domain: 'phi_scales' });

    // Bundle gate types
    codebook.bundle('ALL_GATES', ['RESONANCE_GATE', 'SUPERPOSITION_GATE', 'ORTHOGONAL_GATE', 'SOFT_GATE'], 
                   { domain: 'csl_gates' });

    logger.info(`Created Heady codebook with ${codebook.concepts.size} concepts`);
    return codebook;
  }

  /**
   * Export codebook to .csl script format
   * @returns {string} CSL script content
   */
  toCSLScript() {
    let script = `# Heady CSL Codebook
# Generated: ${new Date().toISOString()}
# Dimensionality: ${this.dimensionality}
# Total Concepts: ${this.concepts.size}

`;

    for (const [name, vector] of this.concepts) {
      const meta = this.metadata.get(name);
      script += `@concept ${name}\n`;
      script += `  type: ${meta.type}\n`;
      script += `  phi_value: ${vector.toPhiScale().toFixed(4)}\n`;
      script += `  truth_value: ${vector.toTruthValue().toFixed(4)}\n`;

      if (meta.constituents) {
        script += `  constituents: [${meta.constituents.join(', ')}]\n`;
      }

      script += `\n`;
    }

    return script;
  }
}

module.exports = { VSACodebook };
