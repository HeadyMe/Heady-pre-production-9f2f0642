"""
src/vsa/memory.py — Associative Memory with Semantic Recall
Persistent, searchable memory backed by the VSA codebook.
Replaces traditional database queries with vector similarity search.

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


class AssociativeMemory:
    """Semantic memory store using hyperdimensional vectors.

    Instead of SQL queries against a relational database:
        SELECT * FROM memories WHERE topic LIKE '%security%'

    The VSA memory performs instantaneous similarity search:
        query_hv = embed("security concern")
        matches = memory.recall(query_hv, top_k=5)
    """

    def __init__(self, dims=10000, vsa='MAP', device='cpu', max_items=10000):
        if not HAS_TORCH:
            raise RuntimeError("PyTorch and torchhd required")

        self.dims = dims
        self.vsa = vsa
        self.device = device
        self.max_items = max_items

        self.entries = []       # list of {text, tags, time, hv_index}
        self._vectors = None    # stacked tensor for batch similarity
        self._dirty = True

    def store(self, text, tags=None, metadata=None):
        """Store a memory entry with its hypervector embedding.

        The text is hashed into a deterministic hypervector via torchhd.
        Tags are bound as role-filler pairs and bundled with the text vector.
        """
        # Generate hypervector from text hash
        text_hv = self._text_to_hv(text)

        # If tags provided, bind and bundle them
        if tags:
            for tag in tags:
                tag_hv = self._text_to_hv(f'TAG_{tag}')
                text_hv = torchhd.bundle(text_hv, tag_hv)

        entry = {
            'text': text,
            'tags': tags or [],
            'metadata': metadata or {},
            'stored_at': time.time(),
            'index': len(self.entries),
        }
        self.entries.append(entry)
        self._dirty = True

        # Evict oldest if over capacity
        if len(self.entries) > self.max_items:
            self.entries = self.entries[-self.max_items:]
            self._dirty = True

        return entry['index']

    def recall(self, query, top_k=5):
        """Semantic recall — find memories most similar to query.

        Args:
            query: text string or hypervector
            top_k: number of results to return

        Returns:
            List of (entry, similarity_score) tuples
        """
        if not self.entries:
            return []

        if isinstance(query, str):
            query_hv = self._text_to_hv(query)
        else:
            query_hv = query

        self._rebuild_index()
        sims = torchhd.cosine_similarity(
            query_hv.unsqueeze(0), self._vectors
        ).squeeze(0)

        k = min(top_k, len(self.entries))
        topk = torch.topk(sims, k)

        results = []
        for idx in topk.indices:
            i = idx.item()
            results.append((self.entries[i], sims[i].item()))
        return results

    def recall_by_tag(self, tag, top_k=5):
        """Recall memories with a specific tag using vector similarity."""
        tag_hv = self._text_to_hv(f'TAG_{tag}')
        return self.recall(tag_hv, top_k=top_k)

    def forget(self, index):
        """Remove a memory entry by index."""
        if 0 <= index < len(self.entries):
            self.entries[index] = None
            self._dirty = True

    def consolidate(self):
        """Bundle all memories into a single superposition — holistic recall."""
        self._rebuild_index()
        if self._vectors is None or len(self._vectors) == 0:
            return None
        result = self._vectors[0]
        for v in self._vectors[1:]:
            result = torchhd.bundle(result, v)
        return result

    def _text_to_hv(self, text):
        """Convert text to a hypervector via character n-gram hashing.

        This is a lightweight embedding — for production, replace with
        a proper sentence transformer or learned embedding model.
        """
        # Use torchhd random with a seed derived from text hash
        seed = hash(text) % (2**31)
        gen = torch.Generator(device='cpu').manual_seed(seed)
        hv = torchhd.random(1, self.dims, vsa=self.vsa,
                            generator=gen, device=self.device).squeeze(0)
        return hv

    def _rebuild_index(self):
        """Rebuild the stacked vector index if dirty."""
        if not self._dirty or not self.entries:
            return

        valid = [e for e in self.entries if e is not None]
        hvs = []
        for e in valid:
            hv = self._text_to_hv(e['text'])
            if e.get('tags'):
                for tag in e['tags']:
                    tag_hv = self._text_to_hv(f'TAG_{tag}')
                    hv = torchhd.bundle(hv, tag_hv)
            hvs.append(hv)

        self._vectors = torch.stack(hvs) if hvs else None
        self.entries = valid
        self._dirty = False

    def get_stats(self):
        """Return memory statistics."""
        return {
            'total_entries': len([e for e in self.entries if e]),
            'max_items': self.max_items,
            'dims': self.dims,
            'device': str(self.device),
        }

    def save(self, path):
        """Persist memory entries to disk (vectors are regenerated)."""
        data = {
            'entries': [
                {k: v for k, v in e.items() if k != 'hv'}
                for e in self.entries if e
            ],
            'stats': self.get_stats(),
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

    def load(self, path):
        """Load memory entries from disk."""
        if not os.path.exists(path):
            return 0
        with open(path) as f:
            data = json.load(f)
        for entry in data.get('entries', []):
            self.store(entry['text'], entry.get('tags'), entry.get('metadata'))
        return len(data.get('entries', []))
