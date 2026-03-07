"""
Heady Continuous Semantic Logic - Python SDK
Implements fuzzy logic gates for Python-based services (HeadyBrain, Orchestrator)
"""

import numpy as np
from typing import List, Dict, Any, Callable
import json

class SemanticTruthValue:
    """Continuous truth value in [0, 1]"""

    def __init__(self, value: float, label: str = None, confidence: float = 1.0):
        self.value = max(0.0, min(1.0, value))
        self.label = label
        self.confidence = max(0.0, min(1.0, confidence))

    def is_truthy(self, threshold: float = 0.5) -> bool:
        return self.value >= threshold

    def negate(self) -> 'SemanticTruthValue':
        return SemanticTruthValue(1.0 - self.value, f"NOT({self.label})", self.confidence)

    def __repr__(self):
        return f"STV({self.value:.4f}{f' {self.label}' if self.label else ''})"

class SemanticGate:
    """Fuzzy logic gate operations"""

    @staticmethod
    def AND(inputs: List[SemanticTruthValue], tnorm: str = 'zadeh') -> SemanticTruthValue:
        if not inputs:
            return SemanticTruthValue(1.0)

        if tnorm == 'zadeh':
            result = min(inp.value for inp in inputs)
        elif tnorm == 'product':
            result = np.prod([inp.value for inp in inputs])
        elif tnorm == 'lukasiewicz':
            result = max(0.0, sum(inp.value for inp in inputs) - len(inputs) + 1)
        else:
            result = min(inp.value for inp in inputs)

        return SemanticTruthValue(result, f"AND({len(inputs)})")

    @staticmethod
    def OR(inputs: List[SemanticTruthValue], tnorm: str = 'zadeh') -> SemanticTruthValue:
        if not inputs:
            return SemanticTruthValue(0.0)

        if tnorm == 'zadeh':
            result = max(inp.value for inp in inputs)
        elif tnorm == 'product':
            vals = [inp.value for inp in inputs]
            result = sum(vals) - np.prod(vals)
        elif tnorm == 'lukasiewicz':
            result = min(1.0, sum(inp.value for inp in inputs))
        else:
            result = max(inp.value for inp in inputs)

        return SemanticTruthValue(result, f"OR({len(inputs)})")

    @staticmethod
    def NOT(input: SemanticTruthValue) -> SemanticTruthValue:
        return input.negate()

    @staticmethod
    def WEIGHTED_AND(inputs: List[SemanticTruthValue], weights: List[float]) -> SemanticTruthValue:
        total_weight = sum(weights)
        normalized = [w / total_weight for w in weights]
        result = sum(normalized[i] * inputs[i].value for i in range(len(inputs)))
        return SemanticTruthValue(result, "W_AND")

# Membership functions
def triangular(left: float, center: float, right: float):
    def evaluate(x: float) -> float:
        if x <= left or x >= right:
            return 0.0
        if x <= center:
            return (x - left) / (center - left)
        return (right - x) / (right - center)
    return evaluate

def gaussian(mean: float, sigma: float):
    def evaluate(x: float) -> float:
        return np.exp(-0.5 * ((x - mean) / sigma) ** 2)
    return evaluate

def sigmoid(center: float, slope: float):
    def evaluate(x: float) -> float:
        return 1.0 / (1.0 + np.exp(-slope * (x - center)))
    return evaluate
