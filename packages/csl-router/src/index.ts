import { clamp01, labelForCslScore, phiWeights, type CslBand } from '@heady-ai/phi-math';

export interface CslFactor {
  name: string;
  value: number;
  weight?: number;
}

export interface CslContribution {
  name: string;
  normalizedValue: number;
  appliedWeight: number;
}

export interface GateEvaluation {
  score: number;
  accepted: boolean;
  band: CslBand;
  contributions: CslContribution[];
}

export interface ScoredCandidate<T> {
  candidate: T;
  evaluation: GateEvaluation;
}

export function weightedGeometricScore(factors: CslFactor[]): GateEvaluation {
  if (factors.length === 0) {
    return { score: 0, accepted: false, band: 'DORMANT', contributions: [] };
  }

  const inferredWeights = phiWeights(factors.length);
  const resolved = factors.map((factor, index) => ({
    name: factor.name,
    normalizedValue: clamp01(factor.value),
    appliedWeight: factor.weight ?? inferredWeights[index],
  }));

  const totalWeight = resolved.reduce((sum, factor) => sum + factor.appliedWeight, 0) || 1;
  const score = Math.exp(
    resolved.reduce((sum, factor) => {
      const safeValue = Math.max(0.000001, factor.normalizedValue);
      return sum + Math.log(safeValue) * (factor.appliedWeight / totalWeight);
    }, 0),
  );

  const normalizedScore = clamp01(score);
  return {
    score: normalizedScore,
    accepted: normalizedScore >= 0.381966,
    band: labelForCslScore(normalizedScore),
    contributions: resolved,
  };
}

export function weightedAverageScore(factors: CslFactor[]): GateEvaluation {
  if (factors.length === 0) {
    return { score: 0, accepted: false, band: 'DORMANT', contributions: [] };
  }
  const inferredWeights = phiWeights(factors.length);
  const contributions = factors.map((factor, index) => ({
    name: factor.name,
    normalizedValue: clamp01(factor.value),
    appliedWeight: factor.weight ?? inferredWeights[index],
  }));
  const totalWeight = contributions.reduce((sum, factor) => sum + factor.appliedWeight, 0) || 1;
  const score = clamp01(
    contributions.reduce((sum, factor) => sum + factor.normalizedValue * factor.appliedWeight, 0) / totalWeight,
  );
  return {
    score,
    accepted: score >= 0.381966,
    band: labelForCslScore(score),
    contributions,
  };
}

export function rankCandidates<T>(
  candidates: Array<{ candidate: T; factors: CslFactor[] }>,
  mode: 'average' | 'geometric' = 'geometric',
): ScoredCandidate<T>[] {
  const scorer = mode === 'average' ? weightedAverageScore : weightedGeometricScore;
  return candidates
    .map((entry) => ({ candidate: entry.candidate, evaluation: scorer(entry.factors) }))
    .sort((left, right) => right.evaluation.score - left.evaluation.score);
}

export function selectBestCandidate<T>(
  candidates: Array<{ candidate: T; factors: CslFactor[] }>,
  mode: 'average' | 'geometric' = 'geometric',
): ScoredCandidate<T> | undefined {
  return rankCandidates(candidates, mode)[0];
}
