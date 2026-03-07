/**
 * @fileoverview VSA-CSL Integration Bridge for Heady
 * @description Bridges Vector Symbolic Architectures with Continuous Semantic Logic
 * @version 1.0.0
 */

const { Hypervector } = require('./hypervector');
const { VSACodebook } = require('./codebook');
const { logger } = require('../utils/logger');

/**
 * Continuous Semantic Logic gates using VSA representations
 * Replaces traditional if/else with continuous vector operations
 */
class VSASemanticGates {
  /**
   * Create VSA semantic gates system
   * @param {VSACodebook} codebook - Codebook with semantic concepts
   */
  constructor(codebook) {
    this.codebook = codebook;
    this.gateCache = new Map(); // Cache computed gates for performance
  }

  /**
   * RESONANCE GATE: Measures semantic alignment between concepts
   * Returns continuous value [0, 1] representing how well concepts resonate
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Resonance strength [0, 1]
   */
  resonance_gate(concept_a, concept_b) {
    const hv_a = typeof concept_a === 'string' ? this.codebook.get(concept_a) : concept_a;
    const hv_b = typeof concept_b === 'string' ? this.codebook.get(concept_b) : concept_b;

    if (!hv_a || !hv_b) {
      throw new Error('Concepts not found in codebook');
    }

    // Resonance = normalized similarity
    return hv_a.similarity(hv_b);
  }

  /**
   * SUPERPOSITION GATE: Combines multiple concepts into unified representation
   * Returns bundled hypervector representing semantic union
   * @param {Array<string|Hypervector>} concepts
   * @returns {Hypervector}
   */
  superposition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Superposition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    return vectors[0].bundle(vectors.slice(1));
  }

  /**
   * ORTHOGONAL GATE: Measures semantic independence/distinctness
   * Returns how orthogonal (different) two concepts are [0, 1]
   * High value = concepts are semantically independent
   * @param {string|Hypervector} concept_a
   * @param {string|Hypervector} concept_b
   * @returns {number} Orthogonality [0, 1]
   */
  orthogonal_gate(concept_a, concept_b) {
    const resonance = this.resonance_gate(concept_a, concept_b);

    // Orthogonality is inverse of resonance
    return 1 - resonance;
  }

  /**
   * SOFT GATE: Fuzzy threshold with smooth transition
   * Implements continuous logic gate with adjustable steepness
   * @param {number} value - Input value [0, 1]
   * @param {number} [threshold=0.618] - Activation threshold (default: φ - 1)
   * @param {number} [steepness=10] - Transition steepness
   * @returns {number} Output [0, 1]
   */
  soft_gate(value, threshold = 0.618, steepness = 10) {
    // Sigmoid-based soft threshold
    return 1 / (1 + Math.exp(-steepness * (value - threshold)));
  }

  /**
   * COMPOSITION GATE: Creates compositional semantic structure
   * Binds concepts in specified order to preserve structure
   * @param {Array<string|Hypervector>} concepts - Ordered concepts
   * @returns {Hypervector}
   */
  composition_gate(...concepts) {
    if (concepts.length === 0) {
      throw new Error('Composition requires at least 1 concept');
    }

    const vectors = concepts.map(c => 
      typeof c === 'string' ? this.codebook.get(c) : c
    );

    if (vectors.some(v => !v)) {
      throw new Error('Some concepts not found in codebook');
    }

    // Sequential binding maintains order
    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = result.bind(vectors[i]);
    }

    return result;
  }

  /**
   * QUERY GATE: Semantic pattern matching against codebook
   * Returns best matching concepts above threshold
   * @param {Hypervector} query - Query vector
   * @param {number} [threshold=0.5] - Match threshold
   * @param {number} [topK=3] - Number of results
   * @returns {Array<{name: string, similarity: number}>}
   */
  query_gate(query, threshold = 0.5, topK = 3) {
    return this.codebook.query(query, threshold, topK);
  }

  /**
   * PHI DECISION GATE: Makes decision using phi-scale continuous logic
   * Replaces traditional if/else with continuous semantic decision
   * @param {Hypervector} state - Current state vector
   * @param {Array<{condition: string, action: Function}>} rules
   * @returns {*} Result of triggered action
   */
  phi_decision_gate(state, rules) {
    const PHI = (1 + Math.sqrt(5)) / 2;
    let bestMatch = null;
    let bestScore = 0;

    for (const rule of rules) {
      const conditionVector = this.codebook.get(rule.condition);
      if (!conditionVector) continue;

      const score = state.similarity(conditionVector);
      const phiScore = score * PHI; // Amplify using golden ratio

      if (phiScore > bestScore) {
        bestScore = phiScore;
        bestMatch = rule;
      }
    }

    if (bestMatch && bestScore > 0.618) { // φ - 1 threshold
      return bestMatch.action(bestScore);
    }

    return null;
  }

  /**
   * CONTINUOUS AND gate: Fuzzy conjunction using T-norm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Conjunction result [0, 1]
   */
  continuous_and(a, b) {
    // Product T-norm (smooth and differentiable)
    return a * b;
  }

  /**
   * CONTINUOUS OR gate: Fuzzy disjunction using T-conorm
   * @param {number} a - Value [0, 1]
   * @param {number} b - Value [0, 1]
   * @returns {number} Disjunction result [0, 1]
   */
  continuous_or(a, b) {
    // Probabilistic sum T-conorm
    return a + b - a * b;
  }

  /**
   * CONTINUOUS NOT gate: Fuzzy negation
   * @param {number} a - Value [0, 1]
   * @returns {number} Negation result [0, 1]
   */
  continuous_not(a) {
    return 1 - a;
  }

  /**
   * CONTINUOUS IMPLIES gate: Fuzzy implication
   * @param {number} a - Antecedent [0, 1]
   * @param {number} b - Consequent [0, 1]
   * @returns {number} Implication result [0, 1]
   */
  continuous_implies(a, b) {
    // Gödel implication: if a ≤ b then 1 else b
    return a <= b ? 1 : b;
  }

  /**
   * Clear gate cache (for memory management)
   */
  clearCache() {
    this.gateCache.clear();
    logger.debug('Cleared VSA gate cache');
  }
}

/**
 * CSL Script Interpreter for VSA-based semantic logic
 */
class CSLInterpreter {
  /**
   * Create CSL interpreter
   * @param {VSASemanticGates} gates - VSA semantic gates system
   */
  constructor(gates) {
    this.gates = gates;
    this.variables = new Map(); // Runtime variables
    this.stack = []; // Execution stack
  }

  /**
   * Execute CSL script
   * @param {string} script - CSL script content
   * @returns {*} Script result
   */
  execute(script) {
    const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    for (const line of lines) {
      this.executeLine(line);
    }

    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * Execute single CSL line
   * @param {string} line
   */
  executeLine(line) {
    // Variable assignment: @var_name = expression
    if (line.startsWith('@')) {
      const [varName, ...exprParts] = line.substring(1).split('=');
      const expression = exprParts.join('=').trim();
      const value = this.evaluateExpression(expression);
      this.variables.set(varName.trim(), value);
      return;
    }

    // Gate invocation: resonance_gate(A, B)
    if (line.includes('(')) {
      const result = this.evaluateExpression(line);
      this.stack.push(result);
      return;
    }

    // Concept push: CONCEPT_NAME
    if (line.match(/^[A-Z_]+$/)) {
      const concept = this.gates.codebook.get(line);
      if (concept) {
        this.stack.push(concept);
      }
    }
  }

  /**
   * Evaluate expression
   * @param {string} expr
   * @returns {*}
   */
  evaluateExpression(expr) {
    expr = expr.trim();

    // Variable reference
    if (expr.startsWith('$')) {
      return this.variables.get(expr.substring(1));
    }

    // Numeric literal
    if (!isNaN(expr)) {
      return parseFloat(expr);
    }

    // Gate invocation
    const gateMatch = expr.match(/^([a-z_]+)\((.*)\)$/);
    if (gateMatch) {
      const [, gateName, argsStr] = gateMatch;
      const args = argsStr.split(',').map(a => this.evaluateExpression(a.trim()));

      if (typeof this.gates[gateName] === 'function') {
        return this.gates[gateName](...args);
      }
    }

    // Concept reference
    return this.gates.codebook.get(expr);
  }

  /**
   * Get variable value
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return this.variables.get(name);
  }

  /**
   * Clear interpreter state
   */
  reset() {
    this.variables.clear();
    this.stack = [];
  }
}

module.exports = {
  VSASemanticGates,
  CSLInterpreter
};
