"""
Heady VSA (Vector Space Architecture)
3D spatial vector operations for the Heady Alive Software system.
Zero external dependencies - pure Python + NumPy (available on Colab).
"""

from .engine import VectorSpaceEngine
from .memory import SpatialMemory
from .bridge import NodeJSBridge
from .swarm import SwarmCoordinator

__all__ = ['VectorSpaceEngine', 'SpatialMemory', 'NodeJSBridge', 'SwarmCoordinator']
__version__ = '1.0.0'
