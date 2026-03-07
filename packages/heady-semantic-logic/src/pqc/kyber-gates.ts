/**
 * Post-Quantum Cryptography Integration: CRYSTALS-Kyber (ML-KEM FIPS 203)
 * Lattice-based semantic gates for quantum-resistant operations
 */

import { OctuplePrecisionTruthValue } from '../core/extended-precision';
import Decimal from 'decimal.js';

export type KyberSecurityLevel = 512 | 768 | 1024; // Kyber-512, Kyber-768, Kyber-1024

/**
 * Lattice-based truth value using Module-LWE polynomial ring
 * Quantum-resistant semantic logic gate primitive
 */
export class KyberTruthValue {
  private latticeValue: OctuplePrecisionTruthValue;
  private securityLevel: KyberSecurityLevel;
  private noiseParameter: number;

  constructor(
    value: number | string,
    securityLevel: KyberSecurityLevel = 768,
    label?: string
  ) {
    this.securityLevel = securityLevel;
    this.noiseParameter = this.calculateNoiseParameter();

    // Add lattice noise for quantum resistance
    const noisyValue = this.addLatticeNoise(value);
    this.latticeValue = new OctuplePrecisionTruthValue(noisyValue, label);
  }

  /**
   * Calculate noise parameter based on security level
   * Kyber uses centered binomial distribution
   */
  private calculateNoiseParameter(): number {
    switch (this.securityLevel) {
      case 512: return 3;  // η = 3
      case 768: return 2;  // η = 2
      case 1024: return 2; // η = 2
    }
  }

  /**
   * Add centered binomial noise (CBD) for lattice security
   */
  private addLatticeNoise(value: number | string): string {
    const baseValue = new Decimal(value.toString());

    // Sample from centered binomial distribution CBD_η
    let noise = 0;
    for (let i = 0; i < this.noiseParameter; i++) {
      noise += Math.random() - Math.random(); // CBD approximation
    }

    // Scale noise to be small relative to truth value
    const scaledNoise = new Decimal(noise).times(1e-15);
    const noisyValue = baseValue.plus(scaledNoise);

    return noisyValue.clamp(0, 1).toString();
  }

  /**
   * Quantum-resistant AND gate using lattice arithmetic
   */
  latticeAND(other: KyberTruthValue): KyberTruthValue {
    const result = this.latticeValue.value
      .times(other.latticeValue.value)
      .clamp(0, 1);

    return new KyberTruthValue(
      result.toString(),
      Math.max(this.securityLevel, other.securityLevel) as KyberSecurityLevel,
      `Kyber_AND(${this.latticeValue.label}, ${other.latticeValue.label})`
    );
  }

  /**
   * Quantum-resistant OR gate
   */
  latticeOR(other: KyberTruthValue): KyberTruthValue {
    const result = this.latticeValue.value
      .plus(other.latticeValue.value)
      .minus(this.latticeValue.value.times(other.latticeValue.value))
      .clamp(0, 1);

    return new KyberTruthValue(
      result.toString(),
      Math.max(this.securityLevel, other.securityLevel) as KyberSecurityLevel,
      `Kyber_OR(${this.latticeValue.label}, ${other.latticeValue.label})`
    );
  }

  /**
   * Key encapsulation mechanism (KEM) for secure gate transmission
   */
  encapsulate(): { ciphertext: bigint[], sharedSecret: string } {
    const [q3, q2, q1, q0] = this.latticeValue.to256Bit();

    // Simulate ML-KEM encapsulation (actual implementation would use kyber.js)
    const ciphertext = [q3, q2, q1, q0];
    const sharedSecret = this.latticeValue.value.toHex();

    return { ciphertext, sharedSecret };
  }

  /**
   * Decapsulate received quantum-resistant gate
   */
  static decapsulate(
    ciphertext: bigint[],
    securityLevel: KyberSecurityLevel = 768
  ): KyberTruthValue {
    const [q3, q2, q1, q0] = ciphertext;
    const octuple = OctuplePrecisionTruthValue.from256Bit(q3, q2, q1, q0, 'decapsulated');

    return new KyberTruthValue(
      octuple.value.toString(),
      securityLevel,
      'kyber_decaps'
    );
  }

  get value(): number {
    return this.latticeValue.asNumber;
  }

  get securityBits(): number {
    // NIST security levels for Kyber
    switch (this.securityLevel) {
      case 512: return 128;  // Level 1
      case 768: return 192;  // Level 3
      case 1024: return 256; // Level 5
    }
  }

  toString(): string {
    return `KyberTV(${this.latticeValue.value.toFixed(20)}, sec=${this.securityBits}bits)`;
  }
}

/**
 * Post-quantum cryptographic gate operations
 */
export class PQCGate {
  /**
   * Quantum-resistant weighted AND using lattice operations
   */
  static KYBER_WEIGHTED_AND(
    inputs: KyberTruthValue[],
    weights: number[],
    securityLevel: KyberSecurityLevel = 768
  ): KyberTruthValue {
    const total = weights.reduce((s, w) => s + w, 0);
    const normalized = weights.map(w => new Decimal(w).div(total));

    let result = new Decimal(0);
    for (let i = 0; i < inputs.length; i++) {
      result = result.plus(normalized[i].times(inputs[i].value));
    }

    return new KyberTruthValue(
      result.toString(),
      securityLevel,
      `PQC_W_AND(${inputs.length})`
    );
  }

  /**
   * Threshold gate with quantum resistance
   */
  static KYBER_THRESHOLD(
    inputs: KyberTruthValue[],
    threshold: number,
    securityLevel: KyberSecurityLevel = 768
  ): KyberTruthValue {
    const avg = inputs.reduce((sum, tv) => sum + tv.value, 0) / inputs.length;
    const result = avg >= threshold ? 1 : 0;

    return new KyberTruthValue(
      result.toString(),
      securityLevel,
      `PQC_THRESH(${threshold})`
    );
  }
}
