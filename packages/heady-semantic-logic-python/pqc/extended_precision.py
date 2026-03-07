"""
Extended Precision: 256-bit Octuple and 4096-bit Arbitrary for Python
"""

from decimal import Decimal, getcontext
from typing import List, Tuple
from high_precision import HighPrecisionTruthValue, PrecisionConfig

class OctuplePrecisionTruthValue(HighPrecisionTruthValue):
    """256-bit octuple precision (71 decimal digits)"""

    def __init__(self, value, label: str = None):
        config = PrecisionConfig(mode='arbitrary', significant_digits=71)
        super().__init__(value, label, config)

    def to_256bit(self) -> Tuple[int, int, int, int]:
        """Convert to 256-bit as (q3, q2, q1, q0) quadwords"""
        scaled = int(self.value * (Decimal(2) ** 236))

        q3 = (scaled >> 192) & 0xFFFFFFFFFFFFFFFF
        q2 = (scaled >> 128) & 0xFFFFFFFFFFFFFFFF
        q1 = (scaled >> 64) & 0xFFFFFFFFFFFFFFFF
        q0 = scaled & 0xFFFFFFFFFFFFFFFF

        return (q3, q2, q1, q0)

    @staticmethod
    def from_256bit(q3: int, q2: int, q1: int, q0: int, label: str = None):
        scaled = (q3 << 192) | (q2 << 128) | (q1 << 64) | q0
        value = Decimal(scaled) / (Decimal(2) ** 236)
        return OctuplePrecisionTruthValue(value, label)

class Arbitrary4096TruthValue(HighPrecisionTruthValue):
    """4096-bit arbitrary precision (1233 decimal digits)"""

    def __init__(self, value, label: str = None):
        config = PrecisionConfig(mode='arbitrary', significant_digits=1233)
        super().__init__(value, label, config)

    def to_4096bit(self) -> List[int]:
        """Convert to 4096-bit as list of 64 quadwords"""
        scaled = int(self.value * (Decimal(2) ** 4096))

        quadwords = []
        for i in range(64):
            shift = (63 - i) * 64
            quadword = (scaled >> shift) & 0xFFFFFFFFFFFFFFFF
            quadwords.append(quadword)

        return quadwords

    @staticmethod
    def from_4096bit(quadwords: List[int], label: str = None):
        scaled = 0
        for i, qw in enumerate(quadwords):
            shift = (63 - i) * 64
            scaled |= (qw << shift)

        value = Decimal(scaled) / (Decimal(2) ** 4096)
        return Arbitrary4096TruthValue(value, label)
