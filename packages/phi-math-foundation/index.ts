/**
 * phi-math-foundation
 * Core mathematical foundation for Heady Systems
 * Based on golden ratio, Fibonacci sequences, and fractal patterns
 */

export const PHI = 1.618033988749895; // Golden ratio
export const PHI_INVERSE = 0.618033988749895;

export class PhiMathCore {
  static version = '1.0.0';

  /**
   * Calculate resilience score treating errors as learning events
   * Used by HeadyVinci and Auto-Success Engine
   */
  static calculateResilience(tasks: number, errors: number): number {
    if (tasks === 0) return 1.0;
    const learningFactor = 0.1; // 10% resilience gain per error
    const baseResilience = (tasks - errors) / tasks;
    const learningBonus = (errors / tasks) * learningFactor;
    return Math.min(1.0, baseResilience + learningBonus);
  }

  /**
   * Generate Fibonacci sequence up to n terms
   * Used for liquid architecture scaling intervals
   */
  static fibonacci(n: number): number[] {
    const fib = [1, 1];
    for (let i = 2; i < n; i++) {
      fib[i] = fib[i - 1] + fib[i - 2];
    }
    return fib;
  }

  /**
   * Calculate golden ratio spacing
   * Used for timing intervals in Auto-Success Engine
   */
  static goldenSpacing(base: number, count: number): number[] {
    const spacings: number[] = [];
    for (let i = 0; i < count; i++) {
      spacings.push(base * Math.pow(PHI, i));
    }
    return spacings;
  }

  /**
   * Fractal depth calculation
   * Used for hierarchical service organization
   */
  static fractalDepth(totalNodes: number): number {
    return Math.ceil(Math.log(totalNodes) / Math.log(PHI));
  }

  /**
   * Optimal resource allocation using phi ratio
   * Used by liquid architecture
   */
  static optimalAllocation(total: number): { primary: number; secondary: number } {
    const primary = Math.floor(total * PHI_INVERSE);
    const secondary = total - primary;
    return { primary, secondary };
  }

  /**
   * Monte Carlo confidence interval
   * Used by HeadySims for validation
   */
  static monteCarloConfidence(samples: number[], confidenceLevel: number = 0.95): {
    mean: number;
    lower: number;
    upper: number;
  } {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / n;

    const alpha = 1 - confidenceLevel;
    const lowerIdx = Math.floor(n * (alpha / 2));
    const upperIdx = Math.floor(n * (1 - alpha / 2));

    return {
      mean,
      lower: sorted[lowerIdx],
      upper: sorted[upperIdx]
    };
  }
}

export default PhiMathCore;
