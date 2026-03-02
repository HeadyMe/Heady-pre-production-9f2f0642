"""
src/vsa/__init__.py — Heady VSA (Vector Symbolic Architecture) Engine
The latent operating system core — tensor-native logic replacing conditional branching.
"""
from .engine import VSAStateMachine, VSACodebook
from .memory import AssociativeMemory

__all__ = ['VSAStateMachine', 'VSACodebook', 'AssociativeMemory']
