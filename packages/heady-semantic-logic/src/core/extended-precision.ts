/**
 * Extended Precision Support: 256-bit Octuple and 4096-bit Arbitrary
 * With dynamic nibble assignment for adaptive bit-depth operations
 */

import Decimal from 'decimal.js';
import { HighPrecisionTruthValue, PrecisionConfig } from './precision-adapter';

export type ExtendedPrecisionMode = 'octuple256' | 'arbitrary1024' | 'arbitrary4096';

/**
 * 256-bit Octuple Precision (IEEE 754-inspired)
 * Format: 1 sign + 19-bit exponent + 236-bit mantissa ≈ 71 decimal digits
 */
export class OctuplePrecisionTruthValue extends HighPrecisionTruthValue {
  constructor(value: number | string | Decimal, label?: string) {
    super(value, label, { mode: 'arbitrary', significantDigits: 71 });
  }

  /**
   * Convert to 256-bit representation as [q3, q2, q1, q0] (4x64-bit quadwords)
   */
  to256Bit(): [bigint, bigint, bigint, bigint] {
    const scaled = this.value.times(new Decimal(2).pow(236));
    const hex = scaled.toHex().replace('0x', '').padStart(64, '0');

    return [
      BigInt('0x' + hex.slice(0, 16)),   // bits 255-192 (q3)
      BigInt('0x' + hex.slice(16, 32)),  // bits 191-128 (q2)
      BigInt('0x' + hex.slice(32, 48)),  // bits 127-64  (q1)
      BigInt('0x' + hex.slice(48, 64))   // bits 63-0    (q0)
    ];
  }

  static from256Bit(q3: bigint, q2: bigint, q1: bigint, q0: bigint, label?: string): OctuplePrecisionTruthValue {
    const hex = [q3, q2, q1, q0]
      .map(q => q.toString(16).padStart(16, '0'))
      .join('');
    const value = new Decimal('0x' + hex).div(new Decimal(2).pow(236));
    return new OctuplePrecisionTruthValue(value, label);
  }

  toString(): string {
    return `Octuple256(${this.value.toFixed(71)}${this.label ? ` "${this.label}"` : ''})`;
  }
}

/**
 * 4096-bit Arbitrary Precision for RSA/Cryptographic Operations
 * Precision: ~1,233 decimal digits
 */
export class Arbitrary4096TruthValue extends HighPrecisionTruthValue {
  constructor(value: number | string | Decimal, label?: string) {
    super(value, label, { mode: 'arbitrary', significantDigits: 1233 });
  }

  /**
   * Convert to 4096-bit representation as array of 64x64-bit quadwords
   */
  to4096Bit(): bigint[] {
    const scaled = this.value.times(new Decimal(2).pow(4096));
    const hex = scaled.toHex().replace('0x', '').padStart(1024, '0'); // 4096 bits = 1024 hex chars

    const quadwords: bigint[] = [];
    for (let i = 0; i < 64; i++) {
      const chunk = hex.slice(i * 16, (i + 1) * 16);
      quadwords.push(BigInt('0x' + chunk));
    }
    return quadwords;
  }

  static from4096Bit(quadwords: bigint[], label?: string): Arbitrary4096TruthValue {
    const hex = quadwords.map(q => q.toString(16).padStart(16, '0')).join('');
    const value = new Decimal('0x' + hex).div(new Decimal(2).pow(4096));
    return new Arbitrary4096TruthValue(value, label);
  }

  toString(): string {
    const preview = this.value.toFixed(50);
    return `Arbitrary4096(${preview}...${this.label ? ` "${this.label}"` : ''}, 1233sig)`;
  }
}

/**
 * Factory for creating extended precision truth values
 */
export function createExtendedPrecisionTV(
  value: number | string,
  mode: ExtendedPrecisionMode,
  label?: string
): HighPrecisionTruthValue {
  switch (mode) {
    case 'octuple256':
      return new OctuplePrecisionTruthValue(value, label);
    case 'arbitrary4096':
      return new Arbitrary4096TruthValue(value, label);
    case 'arbitrary1024':
      return new HighPrecisionTruthValue(value, label, { 
        mode: 'arbitrary', 
        significantDigits: 308 // 1024 bits ≈ 308 decimal digits
      });
    default:
      throw new Error(`Unknown extended precision mode: ${mode}`);
  }
}
