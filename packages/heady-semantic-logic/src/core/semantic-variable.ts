import { MembershipFunction } from './membership.js';
import { SemanticTruthValue } from './truth-value.js';

export interface LinguisticTerm {
  name: string;
  membership: MembershipFunction;
}

export class SemanticVariable {
  readonly name: string;
  readonly terms: Map<string, LinguisticTerm>;
  readonly range: [number, number];

  constructor(name: string, range: [number, number]) {
    this.name = name;
    this.terms = new Map();
    this.range = range;
  }

  addTerm(name: string, membership: MembershipFunction): this {
    this.terms.set(name, { name, membership });
    return this;
  }

  fuzzify(crispValue: number): Map<string, SemanticTruthValue> {
    const result = new Map<string, SemanticTruthValue>();
    for (const [termName, term] of this.terms) {
      const degree = term.membership.evaluate(crispValue);
      result.set(termName, new SemanticTruthValue(degree, `${this.name}.${termName}`));
    }
    return result;
  }
}
