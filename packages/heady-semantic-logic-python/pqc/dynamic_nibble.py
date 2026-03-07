"""
Dynamic Nibble Assignment System for Python
Runtime bit-depth selection (4, 8, 16, 32, 64, 128, 256, 4096 bits)
"""

from typing import Dict, Union, List
from dataclasses import dataclass

@dataclass
class DynamicNibbleConfig:
    bit_depth: int
    name: str
    decimal_digits: int
    speed_factor: float
    memory_bytes: float

NIBBLE_PRESETS: Dict[str, DynamicNibbleConfig] = {
    'ultra_low_power': DynamicNibbleConfig(4, 'ULP_4bit', 1, 10.0, 0.5),
    'iot_edge': DynamicNibbleConfig(8, 'IoT_8bit', 2, 5.0, 1),
    'embedded': DynamicNibbleConfig(16, 'FP16', 3, 2.0, 2),
    'standard': DynamicNibbleConfig(64, 'FP64', 15, 1.0, 8),
    'high': DynamicNibbleConfig(128, 'Quad128', 34, 0.02, 16),
    'octuple': DynamicNibbleConfig(256, 'Octuple256', 71, 0.001, 32),
    'crypto_1024': DynamicNibbleConfig(1024, 'Crypto1K', 308, 0.0001, 128),
    'rsa_4096': DynamicNibbleConfig(4096, 'RSA4K', 1233, 0.00001, 512)
}

class DynamicNibbleManager:
    """Runtime bit-depth manager"""

    def __init__(self, config: Union[str, DynamicNibbleConfig] = 'standard'):
        if isinstance(config, str):
            self.active_config = NIBBLE_PRESETS[config]
        else:
            self.active_config = config
        self.conversion_cache = {}

    def get_config(self) -> DynamicNibbleConfig:
        return self.active_config

    def switch_bit_depth(self, new_config: Union[str, DynamicNibbleConfig]):
        """Change bit depth at runtime"""
        if isinstance(new_config, str):
            self.active_config = NIBBLE_PRESETS[new_config]
        else:
            self.active_config = new_config
        self.conversion_cache.clear()

    def encode(self, value: float) -> int:
        """Convert [0,1] float to active bit depth"""
        clamped = max(0.0, min(1.0, value))
        max_value = (1 << self.active_config.bit_depth) - 1
        return int(clamped * max_value)

    def decode(self, encoded: int) -> float:
        """Decode from active bit depth back to [0,1]"""
        max_value = (1 << self.active_config.bit_depth) - 1
        return encoded / max_value

    def transcode(self, value: int, from_bits: int, to_bits: int) -> int:
        """Convert between different bit depths"""
        from_max = (1 << from_bits) - 1
        to_max = (1 << to_bits) - 1
        normalized = value / from_max
        return int(normalized * to_max)

    @staticmethod
    def select_optimal_bit_depth(task: dict) -> str:
        """Adaptive bit-depth selection"""
        if task.get('realtime'): return 'standard'
        if task.get('iot'): return 'iot_edge'
        if task.get('cryptographic'): return 'rsa_4096'
        if task.get('financial'): return 'octuple'
        if task.get('iterations', 0) > 1e6: return 'octuple'

        accuracy = task.get('accuracy_required', 'medium')
        mapping = {
            'low': 'embedded',
            'medium': 'standard',
            'high': 'high',
            'extreme': 'rsa_4096'
        }
        return mapping.get(accuracy, 'standard')

class MultiResolutionGate:
    """Gates that operate on different bit depths"""

    def __init__(self, config: Union[str, DynamicNibbleConfig] = 'standard'):
        self.nibble_manager = DynamicNibbleManager(config)

    def AND(self, inputs: List[float]) -> float:
        """AND gate with dynamic bit depth"""
        encoded = [self.nibble_manager.encode(v) for v in inputs]
        min_encoded = min(encoded)
        return self.nibble_manager.decode(min_encoded)

    def OR(self, inputs: List[float]) -> float:
        """OR gate with dynamic bit depth"""
        encoded = [self.nibble_manager.encode(v) for v in inputs]
        max_encoded = max(encoded)
        return self.nibble_manager.decode(max_encoded)

    def set_resolution(self, config: Union[str, DynamicNibbleConfig]):
        """Switch resolution at runtime"""
        self.nibble_manager.switch_bit_depth(config)
