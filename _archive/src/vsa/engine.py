"""
src/vsa/engine.py — VSA State Machine Engine
Replaces conditional JS branching with tensor-native operations.
Logic primitives: Bind (⊗), Bundle (⊕), Similarity (⊙), Permute (ρ)

© 2026 Heady Systems LLC. Proprietary and Confidential.
"""
import time
import json
import os

try:
    import torch
    import torchhd
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


# ═══ Configuration ═══
DEFAULT_DIMS = 10000      # Quasi-orthogonal at 10K dimensions
DEFAULT_VSA = 'MAP'       # Multiply-Add-Permute model
DEFAULT_DEVICE = 'cuda' if HAS_TORCH and torch.cuda.is_available() else 'cpu'


class VSACodebook:
    """Associative item memory — maps concept names to hypervectors.

    The codebook is the fundamental data structure of the VSA engine.
    It stores atomic concept hypervectors and provides nearest-neighbor
    retrieval via cosine similarity in the hyperdimensional space.
    """

    def __init__(self, dims=DEFAULT_DIMS, vsa=DEFAULT_VSA, device=DEFAULT_DEVICE):
        if not HAS_TORCH:
            raise RuntimeError("PyTorch and torchhd are required. pip install torch torchhd")

        self.dims = dims
        self.vsa = vsa
        self.device = device
        self.items = {}       # name → hypervector
        self.labels = []      # ordered labels for batch ops
        self._bank = None     # cached stacked tensor

    def add(self, name):
        """Register a new concept with a random hypervector."""
        if name not in self.items:
            hv = torchhd.random(1, self.dims, vsa=self.vsa, device=self.device).squeeze(0)
            self.items[name] = hv
            self.labels.append(name)
            self._bank = None  # invalidate cache
        return self.items[name]

    def get(self, name):
        """Get or create a concept's hypervector."""
        return self.items.get(name, self.add(name))

    def lookup(self, query_hv, top_k=5):
        """Nearest-neighbor retrieval via cosine similarity."""
        if not self.items:
            return []
        if self._bank is None:
            self._bank = torch.stack(list(self.items.values()))
        sims = torchhd.cosine_similarity(query_hv.unsqueeze(0), self._bank).squeeze(0)
        k = min(top_k, len(self.labels))
        topk = torch.topk(sims, k)
        return [(self.labels[i], sims[i].item()) for i in topk.indices]

    def bulk_add(self, names):
        """Batch-register multiple concepts efficiently."""
        new_names = [n for n in names if n not in self.items]
        if new_names:
            hvs = torchhd.random(len(new_names), self.dims, vsa=self.vsa, device=self.device)
            for i, name in enumerate(new_names):
                self.items[name] = hvs[i]
                self.labels.append(name)
            self._bank = None
        return len(new_names)

    def __len__(self):
        return len(self.items)

    def __contains__(self, name):
        return name in self.items


class VSAStateMachine:
    """Operating system logic via VSA — no if/else, pure tensor math.

    State transitions are computed by binding role-value pairs into
    unified state vectors, then performing similarity lookups against
    the codebook to determine the nearest known state.

    This replaces the traditional state machine pattern:
        if state == 'idle' and action == 'chat': state = 'processing'

    With tensor math:
        new_state = bundle(bind(agent, A), bind(action, B), bind(target, C))
        → similarity lookup → nearest codebook entry
    """

    # System role names
    ROLES = ['agent', 'action', 'target', 'context', 'priority',
             'status', 'result', 'timestamp', 'confidence']

    # System states
    STATES = ['idle', 'processing', 'awaiting', 'executing',
              'completed', 'failed', 'learning', 'optimizing',
              'monitoring', 'healing', 'routing', 'guarding']

    # Action vocabulary
    ACTIONS = ['chat', 'embed', 'search', 'deploy', 'monitor',
               'heal', 'optimize', 'learn', 'route', 'store',
               'retrieve', 'analyze', 'synthesize', 'guard',
               'delegate', 'escalate', 'rollback', 'snapshot']

    # Agent identities
    AGENTS = ['conductor', 'buddy', 'brain', 'watchdog',
              'optimizer', 'security', 'vector_ops', 'pipeline',
              'orchestrator', 'researcher', 'governor']

    def __init__(self, dims=DEFAULT_DIMS, vsa=DEFAULT_VSA, device=DEFAULT_DEVICE):
        self.codebook = VSACodebook(dims, vsa, device)
        self.history = []
        self.state_hv = None
        self.dims = dims

        # Register roles
        self.roles = {}
        for role in self.ROLES:
            self.roles[role] = self.codebook.add(f'ROLE_{role}')

        # Register system concepts
        self.codebook.bulk_add([f'STATE_{s}' for s in self.STATES])
        self.codebook.bulk_add([f'ACTION_{a}' for a in self.ACTIONS])
        self.codebook.bulk_add([f'AGENT_{a}' for a in self.AGENTS])

        # Initial state
        self.state_hv = self.codebook.get('STATE_idle')

    def bind(self, role_name, value_name):
        """Bind a role to a value: role ⊗ value → new dissimilar vector."""
        role_hv = self.roles.get(role_name, self.codebook.get(role_name))
        value_hv = self.codebook.get(value_name)
        return torchhd.bind(role_hv, value_hv)

    def bundle(self, *vectors):
        """Superpose vectors: v1 ⊕ v2 ⊕ ... → unified vector similar to all inputs."""
        result = vectors[0]
        for v in vectors[1:]:
            result = torchhd.bundle(result, v)
        return result

    def transition(self, agent, action, target, context=None):
        """Execute a state transition via VSA tensor math.

        Returns nearest codebook matches and timing metrics.
        """
        t0 = time.perf_counter_ns()

        bound_agent = self.bind('agent', agent)
        bound_action = self.bind('action', action)
        bound_target = self.bind('target', target)

        parts = [bound_agent, bound_action, bound_target]
        if context:
            parts.append(self.bind('context', context))

        # Bundle into unified state
        new_state = self.bundle(*parts)

        # Temporal permutation (encode sequence order)
        step = len(self.history)
        new_state = torchhd.permute(new_state, shifts=step % self.dims)

        elapsed_ns = time.perf_counter_ns() - t0

        # Record
        self.history.append({
            'step': step,
            'agent': agent,
            'action': action,
            'target': target,
            'context': context,
            'time': time.time(),
            'latency_us': elapsed_ns / 1000,
        })

        # Similarity lookup
        matches = self.codebook.lookup(new_state, top_k=5)
        self.state_hv = new_state

        return {
            'step': step,
            'nearest_concepts': matches,
            'state_norm': float(torch.norm(new_state)),
            'latency_us': elapsed_ns / 1000,
        }

    def query(self, concept_name, top_k=5):
        """Instantaneous context retrieval — nearest-neighbor in vector space."""
        q = self.codebook.get(concept_name)
        return self.codebook.lookup(q, top_k=top_k)

    def unbind(self, state_hv, role_name):
        """Reverse a binding to retrieve the filler from a role-filler pair.

        Because MAP binding is its own inverse: unbind(bind(r, v), r) ≈ v
        """
        role_hv = self.roles.get(role_name, self.codebook.get(role_name))
        filler_hv = torchhd.bind(state_hv, role_hv)  # self-inverse
        return self.codebook.lookup(filler_hv, top_k=3)

    def get_status(self):
        """Return current system status."""
        return {
            'codebook_size': len(self.codebook),
            'history_length': len(self.history),
            'dimensions': self.dims,
            'device': str(self.codebook.device),
            'model': self.codebook.vsa,
            'states': len(self.STATES),
            'actions': len(self.ACTIONS),
            'agents': len(self.AGENTS),
        }

    def save(self, path):
        """Persist state machine history to disk (not vectors — they're regenerated)."""
        with open(path, 'w') as f:
            json.dump({
                'status': self.get_status(),
                'history': self.history,
            }, f, indent=2)

    @classmethod
    def from_config(cls, config=None):
        """Factory method for creating a VSA state machine from config."""
        config = config or {}
        return cls(
            dims=config.get('dims', DEFAULT_DIMS),
            vsa=config.get('vsa', DEFAULT_VSA),
            device=config.get('device', DEFAULT_DEVICE),
        )
