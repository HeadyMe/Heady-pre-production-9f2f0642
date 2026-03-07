"""
SpatialMemory - 3D spatial memory system that maps all Heady components
into continuous vector space with STM→LTM consolidation.
"""
import math
import time
import json
import os
import threading
from typing import List, Dict, Tuple, Optional, Any
from collections import OrderedDict
from .engine import Vector384, VectorSpaceEngine, PHI, FIBONACCI, COHERENCE_THRESHOLD


class MemoryEntry:
    """A single memory entry in the spatial memory system."""
    __slots__ = ['id', 'vector', 'content', 'importance', 'access_count',
                 'created_at', 'last_accessed', 'decay_rate', 'tags', 'source']
    
    def __init__(self, entry_id: str, vector: Vector384, content: Any,
                 importance: float = 0.5, tags: Optional[List[str]] = None,
                 source: str = 'unknown'):
        self.id = entry_id
        self.vector = vector
        self.content = content
        self.importance = max(0.0, min(1.0, importance))
        self.access_count = 0
        self.created_at = time.time()
        self.last_accessed = time.time()
        self.decay_rate = 1.0 / PHI  # ≈ 0.618
        self.tags = tags or []
        self.source = source
    
    def compute_score(self) -> float:
        """Compute current importance score with temporal decay."""
        age = time.time() - self.last_accessed
        recency = math.exp(-age * self.decay_rate / (PHI ** 10))  # PHI^10 ≈ 122.99s half-life
        frequency = math.log(1 + self.access_count) / math.log(PHI)
        return (self.importance * 0.4 + recency * 0.35 + min(frequency / 10, 1.0) * 0.25)
    
    def touch(self):
        self.access_count += 1
        self.last_accessed = time.time()
    
    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'content': self.content if isinstance(self.content, (str, int, float, bool, list, dict)) else str(self.content),
            'importance': self.importance,
            'score': self.compute_score(),
            'access_count': self.access_count,
            'created_at': self.created_at,
            'last_accessed': self.last_accessed,
            'tags': self.tags,
            'source': self.source,
            '3d': self.vector.projection_3d
        }


class ShortTermMemory:
    """Ring buffer for recent memories with automatic overflow to LTM."""
    
    def __init__(self, capacity: int = FIBONACCI[11]):  # 144 entries
        self.capacity = capacity
        self.buffer: OrderedDict[str, MemoryEntry] = OrderedDict()
        self.overflow_callback = None
    
    def add(self, entry: MemoryEntry):
        if entry.id in self.buffer:
            self.buffer.move_to_end(entry.id)
            self.buffer[entry.id] = entry
            return
        
        if len(self.buffer) >= self.capacity:
            oldest_id, oldest = self.buffer.popitem(last=False)
            if self.overflow_callback:
                self.overflow_callback(oldest)
        
        self.buffer[entry.id] = entry
    
    def get(self, entry_id: str) -> Optional[MemoryEntry]:
        entry = self.buffer.get(entry_id)
        if entry:
            entry.touch()
            self.buffer.move_to_end(entry_id)
        return entry
    
    def search(self, query: Vector384, k: int = 5) -> List[MemoryEntry]:
        scored = []
        for entry in self.buffer.values():
            sim = query.cosine_similarity(entry.vector)
            combined = sim * 0.6 + entry.compute_score() * 0.4
            scored.append((entry, combined))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [e for e, _ in scored[:k]]
    
    def all_entries(self) -> List[MemoryEntry]:
        return list(self.buffer.values())
    
    def __len__(self):
        return len(self.buffer)


class LongTermMemory:
    """Persistent memory store with importance-based retention."""
    
    def __init__(self, engine: VectorSpaceEngine, max_size: int = FIBONACCI[14]):  # 610
        self.engine = engine
        self.max_size = max_size
        self.entries: Dict[str, MemoryEntry] = {}
    
    def consolidate(self, entry: MemoryEntry):
        """Add or update a memory in LTM."""
        if entry.id in self.entries:
            existing = self.entries[entry.id]
            # Merge: boost importance for repeated consolidation
            entry.importance = min(1.0, existing.importance + 0.1 * PHI)
            entry.access_count = existing.access_count + entry.access_count
        
        self.entries[entry.id] = entry
        self.engine.register(f"ltm:{entry.id}", entry.vector, {
            'importance': entry.importance,
            'tags': entry.tags,
            'source': entry.source
        })
        
        if len(self.entries) > self.max_size:
            self._prune()
    
    def recall(self, query: Vector384, k: int = 10, 
               tags: Optional[List[str]] = None) -> List[MemoryEntry]:
        """Recall memories by semantic similarity with optional tag filter."""
        scored = []
        for entry in self.entries.values():
            if tags and not any(t in entry.tags for t in tags):
                continue
            sim = query.cosine_similarity(entry.vector)
            score = sim * 0.5 + entry.compute_score() * 0.5
            scored.append((entry, score))
            entry.touch()
        scored.sort(key=lambda x: x[1], reverse=True)
        return [e for e, _ in scored[:k]]
    
    def _prune(self):
        """Remove lowest-scoring memories using Fibonacci-based pruning."""
        prune_count = FIBONACCI[5]  # Remove 8 at a time
        scored = [(eid, e.compute_score()) for eid, e in self.entries.items()]
        scored.sort(key=lambda x: x[1])
        
        for eid, _ in scored[:prune_count]:
            del self.entries[eid]
    
    def __len__(self):
        return len(self.entries)


class DreamCycle:
    """Background process that strengthens important memory connections."""
    
    def __init__(self, ltm: LongTermMemory, engine: VectorSpaceEngine):
        self.ltm = ltm
        self.engine = engine
        self.running = False
        self._thread = None
        self.cycle_count = 0
        self.interval = PHI ** 12  # ≈ 321s between dream cycles
    
    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._dream_loop, daemon=True)
        self._thread.start()
    
    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=5)
    
    def _dream_loop(self):
        while self.running:
            time.sleep(self.interval)
            self._run_cycle()
    
    def _run_cycle(self):
        """Single dream cycle: strengthen high-importance connections."""
        self.cycle_count += 1
        entries = list(self.ltm.entries.values())
        if len(entries) < 2:
            return
        
        # Find top-scoring memories
        top = sorted(entries, key=lambda e: e.compute_score(), reverse=True)
        top = top[:FIBONACCI[8]]  # Top 34
        
        # Strengthen connections between semantically similar important memories
        for i, a in enumerate(top):
            for b in top[i+1:]:
                sim = a.vector.cosine_similarity(b.vector)
                if sim > COHERENCE_THRESHOLD:
                    self.engine.add_relationship(
                        f"ltm:{a.id}", f"ltm:{b.id}",
                        'dream_connection', sim
                    )
    
    def run_once(self):
        """Manually trigger a dream cycle."""
        self._run_cycle()


class SpatialMemory:
    """
    Complete spatial memory system integrating STM, LTM, and Dream cycles
    in the 3D vector space.
    """
    
    def __init__(self, persist_dir: Optional[str] = None):
        self.engine = VectorSpaceEngine(persist_dir)
        self.stm = ShortTermMemory()
        self.ltm = LongTermMemory(self.engine)
        self.dream = DreamCycle(self.ltm, self.engine)
        
        # Wire STM overflow to LTM consolidation
        self.stm.overflow_callback = self._on_stm_overflow
        
        self._consolidation_thread = None
        self._running = False
    
    def _on_stm_overflow(self, entry: MemoryEntry):
        """When STM overflows, consolidate worthy memories to LTM."""
        if entry.compute_score() > (1.0 / PHI):  # > 0.618 threshold
            self.ltm.consolidate(entry)
    
    def store(self, content: Any, text_for_embedding: str,
              importance: float = 0.5, tags: Optional[List[str]] = None,
              source: str = 'user', entry_id: Optional[str] = None) -> str:
        """Store a new memory."""
        import hashlib
        if entry_id is None:
            entry_id = hashlib.sha256(
                f"{text_for_embedding}{time.time()}".encode()
            ).hexdigest()[:16]
        
        vector = Vector384.from_text(text_for_embedding)
        entry = MemoryEntry(entry_id, vector, content, importance, tags, source)
        self.stm.add(entry)
        
        # High-importance memories go directly to LTM too
        if importance > 0.8:
            self.ltm.consolidate(entry)
        
        return entry_id
    
    def recall(self, query_text: str, k: int = 10,
               tags: Optional[List[str]] = None) -> List[dict]:
        """Recall memories by semantic similarity."""
        query = Vector384.from_text(query_text)
        
        # Search both STM and LTM
        stm_results = self.stm.search(query, k)
        ltm_results = self.ltm.recall(query, k, tags)
        
        # Merge and deduplicate
        seen = set()
        merged = []
        for entry in stm_results + ltm_results:
            if entry.id not in seen:
                seen.add(entry.id)
                merged.append(entry.to_dict())
        
        # Sort by combined score
        merged.sort(key=lambda x: x['score'], reverse=True)
        return merged[:k]
    
    def get_spatial_context(self, focus_text: str, radius: float = 0.5) -> dict:
        """Get all memories within a 3D spatial radius of a focus point."""
        focus = Vector384.from_text(focus_text)
        center = focus.projection_3d
        nearby = self.engine.search_3d_region(center, radius)
        
        return {
            'center': center,
            'radius': radius,
            'entities': [
                {'id': eid, 'distance': dist, 'meta': self.engine.metadata.get(eid, {})}
                for eid, dist in nearby
            ]
        }
    
    def start_background(self):
        """Start dream cycles and periodic consolidation."""
        self._running = True
        self.dream.start()
        self._consolidation_thread = threading.Thread(
            target=self._consolidation_loop, daemon=True
        )
        self._consolidation_thread.start()
    
    def _consolidation_loop(self):
        """Periodically consolidate high-scoring STM entries to LTM."""
        interval = PHI ** 8  # ≈ 46.98s
        while self._running:
            time.sleep(interval)
            for entry in self.stm.all_entries():
                if entry.compute_score() > (1.0 / PHI):
                    self.ltm.consolidate(entry)
    
    def stop(self):
        self._running = False
        self.dream.stop()
    
    def stats(self) -> dict:
        return {
            'stm_size': len(self.stm),
            'ltm_size': len(self.ltm),
            'vector_space': self.engine.stats(),
            'dream_cycles': self.dream.cycle_count
        }
    
    def export_3d_map(self) -> dict:
        """Export the full 3D spatial map for visualization."""
        return self.engine.get_spatial_map()
