/**
 * Continuous Semantic Logic Gates
 * Implements Zadeh (min/max), Product, and Łukasiewicz t-norms
 */

import { SemanticTruthValue } from './truth-value.js';

export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'IMPLY' | 'WEIGHTED_AND' | 'WEIGHTED_OR';
export type TNorm = 'zadeh' | 'product' | 'lukasiewicz';

export interface GateConfig {
  tnorm?: TNorm;
  weights?: number[];
}

function andGate(tnorm: TNorm, a: number, b: number): number {
  switch (tnorm) {
    case 'zadeh': return Math.min(a, b);
    case 'product': return a * b;
    case 'lukasiewicz': return Math.max(0, a + b - 1);
  }
}

function orGate(tnorm: TNorm, a: number, b: number): number {
  switch (tnorm) {
    case 'zadeh': return Math.max(a, b);
    case 'product': return a + b - a * b;
    case 'lukasiewicz': return Math.min(1, a + b);
  }
}

export function AND(inputs: SemanticTruthValue[], config: GateConfig = {}): SemanticTruthValue {
  const tnorm = config.tnorm ?? 'zadeh';
  if (inputs.length === 0) return new SemanticTruthValue(1.0);
  let result = inputs[0].value;
  for (let i = 1; i < inputs.length; i++) {
    result = andGate(tnorm, result, inputs[i].value);
  }
  return new SemanticTruthValue(result, `AND(${inputs.length})`);
}

export function OR(inputs: SemanticTruthValue[], config: GateConfig = {}): SemanticTruthValue {
  const tnorm = config.tnorm ?? 'zadeh';
  if (inputs.length === 0) return new SemanticTruthValue(0.0);
  let result = inputs[0].value;
  for (let i = 1; i < inputs.length; i++) {
    result = orGate(tnorm, result, inputs[i].value);
  }
  return new SemanticTruthValue(result, `OR(${inputs.length})`);
}

export function NOT(input: SemanticTruthValue): SemanticTruthValue {
  return new SemanticTruthValue(1 - input.value, `NOT`);
}

export function WEIGHTED_AND(inputs: SemanticTruthValue[], weights: number[]): SemanticTruthValue {
  const total = weights.reduce((s, w) => s + w, 0);
  const normalized = weights.map(w => w / total);
  const result = inputs.reduce((s, inp, i) => s + normalized[i] * inp.value, 0);
  return new SemanticTruthValue(result, `W_AND`);
}

export { SemanticTruthValue };
