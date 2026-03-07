"""
VectorSpaceEngine - Core 3D vector space operations for Heady.
All system state is represented as 384-dimensional embeddings projected into 3D space.
Uses Sacred Geometry principles (PHI=1.618, Fibonacci) for spatial operations.
"""
import math
import hashlib
import json
import struct
import os
from typing import List, Dict, Tuple, Optional, Any
from collections import defaultdict

PHI = (1 + math.sqrt(5)) / 2  # Golden Ratio ≈ 1.618
FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
EMBEDDING_DIM = 384
COHERENCE_THRESHOLD = 0.75


class Vector384:
    """A 384-dimensional vector with 3D projection capability."""
    
    __slots__ = ['data', '_norm', '_3d']
    
    def __init__(self, data: List[float]):
        if len(data) != EMBEDDING_DIM:
            raise ValueError(f"Expected {EMBEDDING_DIM} dimensions, got {len(data)}")
        self.data = data
        self._norm = None
        self._3d = None
    
    @classmethod
    def from_text(cls, text: str, seed: int = 42) -> 'Vector384':
        """Generate a deterministic 384D embedding from text using hash-based projection."""
        h = hashlib.sha384(text.encode()).digest()
        values = []
        for i in range(EMBEDDING_DIM):
            byte_idx = i % len(h)
            val = (h[byte_idx] + i * 17) % 256
            values.append((val / 128.0) - 1.0)
        # Normalize to unit vector
        norm = math.sqrt(sum(v * v for v in values))
        if norm > 0:
            values = [v / norm for v in values]
        return cls(values)
    
    @classmethod
    def random(cls, seed: Optional[int] = None) -> 'Vector384':
        """Generate a random unit vector."""
        import random
        if seed is not None:
            random.seed(seed)
        values = [random.gauss(0, 1) for _ in range(EMBEDDING_DIM)]
        norm = math.sqrt(sum(v * v for v in values))
        return cls([v / norm for v in values])
    
    @classmethod
    def zero(cls) -> 'Vector384':
        return cls([0.0] * EMBEDDING_DIM)
    
    @property
    def norm(self) -> float:
        if self._norm is None:
            self._norm = math.sqrt(sum(v * v for v in self.data))
        return self._norm
    
    @property
    def projection_3d(self) -> Tuple[float, float, float]:
        """Project 384D vector to 3D using PCA-like dimension reduction via Fibonacci selection."""
        if self._3d is None:
            # Select dimensions using Fibonacci indices for Sacred Geometry alignment
            x_dims = [self.data[i % EMBEDDING_DIM] for i in FIBONACCI[:6]]
            y_dims = [self.data[(i + 64) % EMBEDDING_DIM] for i in FIBONACCI[:6]]
            z_dims = [self.data[(i + 128) % EMBEDDING_DIM] for i in FIBONACCI[:6]]
            x = sum(x_dims) / len(x_dims)
            y = sum(y_dims) / len(y_dims)
            z = sum(z_dims) / len(z_dims)
            self._3d = (x, y, z)
        return self._3d
    
    def cosine_similarity(self, other: 'Vector384') -> float:
        """Compute cosine similarity between two vectors."""
        dot = sum(a * b for a, b in zip(self.data, other.data))
        if self.norm == 0 or other.norm == 0:
            return 0.0
        return dot / (self.norm * other.norm)
    
    def euclidean_distance(self, other: 'Vector384') -> float:
        """Compute Euclidean distance."""
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(self.data, other.data)))
    
    def __add__(self, other: 'Vector384') -> 'Vector384':
        return Vector384([a + b for a, b in zip(self.data, other.data)])
    
    def __sub__(self, other: 'Vector384') -> 'Vector384':
        return Vector384([a - b for a, b in zip(self.data, other.data)])
    
    def scale(self, factor: float) -> 'Vector384':
        return Vector384([v * factor for v in self.data])
    
    def normalize(self) -> 'Vector384':
        if self.norm == 0:
            return Vector384.zero()
        return self.scale(1.0 / self.norm)
    
    def to_bytes(self) -> bytes:
        return struct.pack(f'{EMBEDDING_DIM}f', *self.data)
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'Vector384':
        values = list(struct.unpack(f'{EMBEDDING_DIM}f', data))
        return cls(values)
    
    def to_dict(self) -> dict:
        return {'data': self.data, '3d': self.projection_3d}


class VectorSpaceEngine:
    """
    Core engine for 3D vector space operations.
    Manages the spatial representation of all Heady system components.
    """
    
    def __init__(self, persist_dir: Optional[str] = None):
        self.vectors: Dict[str, Vector384] = {}
        self.metadata: Dict[str, dict] = {}
        self.relationships: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
        self.persist_dir = persist_dir
        self._coherence_history: List[float] = []
        
        if persist_dir and os.path.exists(persist_dir):
            self._load()
    
    def register(self, entity_id: str, vector: Vector384, meta: Optional[dict] = None):
        """Register an entity in the vector space."""
        self.vectors[entity_id] = vector
        self.metadata[entity_id] = meta or {}
        if self.persist_dir:
            self._save_entity(entity_id)
    
    def register_from_text(self, entity_id: str, text: str, meta: Optional[dict] = None):
        """Register an entity from text (auto-generates embedding)."""
        vector = Vector384.from_text(text)
        self.register(entity_id, vector, meta)
    
    def get(self, entity_id: str) -> Optional[Vector384]:
        return self.vectors.get(entity_id)
    
    def nearest_neighbors(self, query: Vector384, k: int = 10, 
                          filter_fn: Optional[callable] = None) -> List[Tuple[str, float]]:
        """Find k nearest neighbors by cosine similarity."""
        scores = []
        for eid, vec in self.vectors.items():
            if filter_fn and not filter_fn(eid, self.metadata.get(eid, {})):
                continue
            sim = query.cosine_similarity(vec)
            scores.append((eid, sim))
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:k]
    
    def search_3d_region(self, center: Tuple[float, float, float], 
                         radius: float) -> List[Tuple[str, float]]:
        """Search for entities within a 3D spherical region."""
        results = []
        cx, cy, cz = center
        for eid, vec in self.vectors.items():
            x, y, z = vec.projection_3d
            dist = math.sqrt((x - cx)**2 + (y - cy)**2 + (z - cz)**2)
            if dist <= radius:
                results.append((eid, dist))
        results.sort(key=lambda x: x[1])
        return results
    
    def add_relationship(self, from_id: str, to_id: str, 
                         rel_type: str, weight: float = 1.0):
        """Add a weighted relationship between entities."""
        self.relationships[from_id].append((to_id, rel_type, weight))
    
    def traverse(self, start_id: str, max_hops: int = 3, 
                 min_weight: float = 0.5) -> Dict[str, float]:
        """Multi-hop traversal with relevance decay (PHI-scaled)."""
        visited = {start_id: 1.0}
        frontier = [(start_id, 1.0, 0)]
        
        while frontier:
            current, score, depth = frontier.pop(0)
            if depth >= max_hops:
                continue
            
            for target, rel_type, weight in self.relationships.get(current, []):
                # PHI-scaled decay per hop
                new_score = score * weight / (PHI ** (depth + 1))
                if new_score < min_weight:
                    continue
                if target not in visited or visited[target] < new_score:
                    visited[target] = new_score
                    frontier.append((target, new_score, depth + 1))
        
        return visited
    
    def compute_coherence(self) -> float:
        """Compute overall system coherence as average pairwise cosine similarity."""
        if len(self.vectors) < 2:
            return 1.0
        
        ids = list(self.vectors.keys())
        total_sim = 0.0
        count = 0
        
        # Sample for large systems (Fibonacci-based sampling)
        max_pairs = FIBONACCI[12]  # 233 pairs max
        import random
        pairs = [(i, j) for i in range(len(ids)) for j in range(i+1, len(ids))]
        if len(pairs) > max_pairs:
            random.shuffle(pairs)
            pairs = pairs[:max_pairs]
        
        for i, j in pairs:
            sim = self.vectors[ids[i]].cosine_similarity(self.vectors[ids[j]])
            total_sim += sim
            count += 1
        
        coherence = total_sim / count if count > 0 else 1.0
        self._coherence_history.append(coherence)
        return coherence
    
    def detect_drift(self, entity_id: str, new_vector: Vector384) -> Tuple[bool, float]:
        """Detect if an entity has drifted beyond the coherence threshold."""
        old = self.vectors.get(entity_id)
        if old is None:
            return False, 1.0
        
        similarity = old.cosine_similarity(new_vector)
        drifted = similarity < COHERENCE_THRESHOLD
        return drifted, similarity
    
    def get_spatial_map(self) -> Dict[str, dict]:
        """Export the entire vector space as a 3D spatial map (for visualization)."""
        spatial = {}
        for eid, vec in self.vectors.items():
            x, y, z = vec.projection_3d
            spatial[eid] = {
                'x': x, 'y': y, 'z': z,
                'meta': self.metadata.get(eid, {}),
                'relationships': [
                    {'target': t, 'type': r, 'weight': w}
                    for t, r, w in self.relationships.get(eid, [])
                ]
            }
        return spatial
    
    def phi_spiral_layout(self, n: int) -> List[Tuple[float, float, float]]:
        """Generate n points on a PHI spiral in 3D (for placing new nodes)."""
        golden_angle = 2 * math.pi / (PHI * PHI)  # ≈ 137.5°
        points = []
        for i in range(n):
            t = i / max(n - 1, 1)
            theta = golden_angle * i
            phi_angle = math.acos(1 - 2 * t)
            r = 1.0 + (i / n) * PHI  # Expanding spiral
            x = r * math.sin(phi_angle) * math.cos(theta)
            y = r * math.sin(phi_angle) * math.sin(theta)
            z = r * math.cos(phi_angle)
            points.append((x, y, z))
        return points
    
    def octant_partition(self) -> Dict[int, List[str]]:
        """Partition entities into 8 octants for parallel search."""
        octants: Dict[int, List[str]] = defaultdict(list)
        for eid, vec in self.vectors.items():
            x, y, z = vec.projection_3d
            idx = (4 if x >= 0 else 0) + (2 if y >= 0 else 0) + (1 if z >= 0 else 0)
            octants[idx].append(eid)
        return dict(octants)
    
    def _save_entity(self, entity_id: str):
        if not self.persist_dir:
            return
        os.makedirs(self.persist_dir, exist_ok=True)
        path = os.path.join(self.persist_dir, f"{hashlib.md5(entity_id.encode()).hexdigest()}.bin")
        with open(path, 'wb') as f:
            vec_bytes = self.vectors[entity_id].to_bytes()
            meta_bytes = json.dumps({
                'id': entity_id,
                'meta': self.metadata.get(entity_id, {}),
                'rels': self.relationships.get(entity_id, [])
            }).encode()
            f.write(struct.pack('I', len(meta_bytes)))
            f.write(meta_bytes)
            f.write(vec_bytes)
    
    def _load(self):
        if not self.persist_dir or not os.path.exists(self.persist_dir):
            return
        for fname in os.listdir(self.persist_dir):
            if not fname.endswith('.bin'):
                continue
            path = os.path.join(self.persist_dir, fname)
            with open(path, 'rb') as f:
                meta_len = struct.unpack('I', f.read(4))[0]
                meta_bytes = f.read(meta_len)
                vec_bytes = f.read()
                info = json.loads(meta_bytes.decode())
                vec = Vector384.from_bytes(vec_bytes)
                self.vectors[info['id']] = vec
                self.metadata[info['id']] = info.get('meta', {})
                for rel in info.get('rels', []):
                    self.relationships[info['id']].append(tuple(rel))
    
    def save_all(self):
        """Persist entire vector space to disk."""
        for eid in self.vectors:
            self._save_entity(eid)
    
    def stats(self) -> dict:
        return {
            'total_entities': len(self.vectors),
            'total_relationships': sum(len(v) for v in self.relationships.values()),
            'coherence': self.compute_coherence() if len(self.vectors) >= 2 else 1.0,
            'octant_distribution': {k: len(v) for k, v in self.octant_partition().items()},
            'coherence_trend': self._coherence_history[-10:] if self._coherence_history else []
        }
