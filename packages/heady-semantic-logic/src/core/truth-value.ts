/**
 * Continuous Truth Value — fundamental unit of semantic logic.
 * Values live in [0, 1]: 0.0 = completely false, 1.0 = completely true
 */

export class SemanticTruthValue {
  private _value: number;
  private _label?: string;
  private _confidence: number;

  constructor(value: number, label?: string, confidence: number = 1.0) {
    this._value = Math.max(0, Math.min(1, value));
    this._label = label;
    this._confidence = Math.max(0, Math.min(1, confidence));
  }

  get value(): number { return this._value; }
  get label(): string | undefined { return this._label; }
  get confidence(): number { return this._confidence; }
  get effective(): number { return this._value * this._confidence; }

  isTruthy(threshold: number = 0.5): boolean {
    return this._value >= threshold;
  }

  negate(): SemanticTruthValue {
    return new SemanticTruthValue(1 - this._value, `NOT(${this._label ?? '?'})`, this._confidence);
  }

  and(other: SemanticTruthValue): SemanticTruthValue {
    return new SemanticTruthValue(
      Math.min(this._value, other._value),
      `AND(${this._label ?? '?'}, ${other._label ?? '?'})`,
      Math.min(this._confidence, other._confidence)
    );
  }

  or(other: SemanticTruthValue): SemanticTruthValue {
    return new SemanticTruthValue(
      Math.max(this._value, other._value),
      `OR(${this._label ?? '?'}, ${other._label ?? '?'})`,
      Math.min(this._confidence, other._confidence)
    );
  }

  toString(): string {
    return `STV(${this._value.toFixed(4)}${this._label ? ` "${this._label}"` : ''})`;
  }

  static clamp(v: number): number {
    return Math.max(0, Math.min(1, v));
  }
}

export function truthValue(v: number | boolean, label?: string): SemanticTruthValue {
  return typeof v === 'boolean'
    ? new SemanticTruthValue(v ? 1.0 : 0.0, label)
    : new SemanticTruthValue(v, label);
}
