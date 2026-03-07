/**
 * @headysystems/semantic-logic
 * 
 * Continuous Semantic Logic Gate Engine for HeadySystems.
 */

export { SemanticTruthValue, truthValue } from './core/truth-value.js';
export {
  SemanticGate, GateType,
  AND, OR, NOT, NAND, NOR, XOR, XNOR, IMPLY,
  WEIGHTED_AND, WEIGHTED_OR,
  createGate, evaluateGateChain,
} from './core/gates.js';
export {
  MembershipFunction, MembershipType,
  triangular, trapezoidal, gaussian, sigmoid, bell,
} from './core/membership.js';
export { SemanticVariable, LinguisticTerm } from './core/semantic-variable.js';
export { RuleEngine, SemanticRule, RuleResult } from './core/rule-engine.js';
export { Defuzzifier, DefuzzMethod } from './core/defuzzifier.js';
export { ASTScanner, ScanResult, LogicPattern } from './transform/ast-scanner.js';
export { SemanticTransformer, TransformConfig, TransformResult } from './transform/transformer.js';
