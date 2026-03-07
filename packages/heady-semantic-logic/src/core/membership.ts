/**
 * Membership Functions for fuzzification
 */

export type MembershipType = 'triangular' | 'gaussian' | 'sigmoid' | 'bell';

export interface MembershipFunction {
  type: MembershipType;
  evaluate(x: number): number;
  label: string;
}

export function triangular(left: number, center: number, right: number, label = 'tri'): MembershipFunction {
  return {
    type: 'triangular',
    label,
    evaluate(x: number): number {
      if (x <= left || x >= right) return 0;
      if (x <= center) return (x - left) / (center - left);
      return (right - x) / (right - center);
    },
  };
}

export function gaussian(mean: number, sigma: number, label = 'gauss'): MembershipFunction {
  return {
    type: 'gaussian',
    label,
    evaluate(x: number): number {
      return Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
    },
  };
}

export function sigmoid(center: number, slope: number, label = 'sig'): MembershipFunction {
  return {
    type: 'sigmoid',
    label,
    evaluate(x: number): number {
      return 1 / (1 + Math.exp(-slope * (x - center)));
    },
  };
}

export function bell(center: number, width: number, slope: number, label = 'bell'): MembershipFunction {
  return {
    type: 'bell',
    label,
    evaluate(x: number): number {
      return 1 / (1 + Math.pow(Math.abs((x - center) / width), 2 * slope));
    },
  };
}
