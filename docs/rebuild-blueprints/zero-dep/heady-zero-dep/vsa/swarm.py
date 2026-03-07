"""
SwarmCoordinator - Coordinates multiple VSA engines across the 3-node Colab cluster.
Implements liquid dynamics where vector space regions flow between nodes based on demand.
"""
import math
import time
import json
import threading
import urllib.request
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict
from .engine import VectorSpaceEngine, Vector384, PHI, FIBONACCI, COHERENCE_THRESHOLD


class NodeHealth:
    """Health status of a cluster node."""
    def __init__(self, node_id: str, url: str):
        self.node_id = node_id
        self.url = url
        self.healthy = True
        self.last_heartbeat = time.time()
        self.latency_ms = 0.0
        self.load = 0.0
        self.gpu_utilization = 0.0
        self.memory_used_mb = 0.0
        self.entity_count = 0
        self.role = 'unknown'
    
    @property
    def score(self) -> float:
        """PHI-weighted health score (0-1)."""
        if not self.healthy:
            return 0.0
        age = time.time() - self.last_heartbeat
        freshness = math.exp(-age / (PHI ** 8))  # ~47s half-life
        load_score = 1.0 - min(self.load, 1.0)
        latency_score = 1.0 / (1.0 + self.latency_ms / 1000.0)
        return (freshness * 0.3 + load_score * 0.4 + latency_score * 0.3)


class LiquidRegion:
    """A region of vector space that can flow between nodes."""
    def __init__(self, octant_id: int, entity_ids: List[str]):
        self.octant_id = octant_id
        self.entity_ids = entity_ids
        self.owner_node: Optional[str] = None
        self.access_count = 0
        self.last_accessed = time.time()
    
    @property
    def heat(self) -> float:
        """How 'hot' this region is (determines placement priority)."""
        age = time.time() - self.last_accessed
        recency = math.exp(-age / (PHI ** 10))
        frequency = math.log(1 + self.access_count) / math.log(PHI)
        return recency * 0.6 + min(frequency / 10, 1.0) * 0.4
    
    def touch(self):
        self.access_count += 1
        self.last_accessed = time.time()


class SwarmCoordinator:
    """
    Coordinates vector space operations across the 3-node Colab cluster.
    Implements liquid dynamics where hot regions migrate to the fastest nodes.
    
    Architecture:
    - BRAIN (Node 1): Primary vector store, embeddings
    - CONDUCTOR (Node 2): Task routing, pipeline coordination
    - SENTINEL (Node 3): Security monitoring, backup store
    
    Liquid Flow Rules:
    - Hot regions (high access) → BRAIN node (fastest GPU)
    - Warm regions → CONDUCTOR node 
    - Cold regions → SENTINEL node (cheapest storage)
    """
    
    def __init__(self, local_engine: VectorSpaceEngine, local_node_id: str = 'brain'):
        self.engine = local_engine
        self.local_node_id = local_node_id
        self.nodes: Dict[str, NodeHealth] = {}
        self.regions: Dict[int, LiquidRegion] = {}
        self._running = False
        self._health_thread = None
        self._rebalance_thread = None
        
        # Fibonacci-based pool allocation
        self.pool_allocation = {
            'hot': FIBONACCI[8] / 100,    # 34%
            'warm': FIBONACCI[7] / 100,   # 21%
            'cold': FIBONACCI[6] / 100,   # 13%
            'reserve': FIBONACCI[5] / 100, # 8%
            'governance': FIBONACCI[4] / 100  # 5%
        }
    
    def register_node(self, node_id: str, url: str, role: str = 'worker'):
        """Register a cluster node."""
        health = NodeHealth(node_id, url)
        health.role = role
        self.nodes[node_id] = health
    
    def _probe_node(self, node: NodeHealth):
        """Check health of a remote node."""
        try:
            start = time.time()
            req = urllib.request.Request(
                f"{node.url}/health",
                headers={'Accept': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                node.latency_ms = (time.time() - start) * 1000
                node.healthy = data.get('status') == 'ok'
                node.entity_count = data.get('entities', 0)
                node.load = data.get('load', 0.0)
                node.gpu_utilization = data.get('gpu_util', 0.0)
                node.memory_used_mb = data.get('memory_mb', 0.0)
                node.last_heartbeat = time.time()
        except Exception:
            node.healthy = False
    
    def _health_loop(self):
        """Background health check loop with PHI-scaled interval."""
        interval = PHI ** 4  # ≈ 6.85s
        while self._running:
            for node in self.nodes.values():
                if node.node_id != self.local_node_id:
                    self._probe_node(node)
            time.sleep(interval)
    
    def _compute_regions(self):
        """Partition the vector space into 8 octant regions."""
        partitions = self.engine.octant_partition()
        for octant_id, entity_ids in partitions.items():
            if octant_id not in self.regions:
                self.regions[octant_id] = LiquidRegion(octant_id, entity_ids)
            else:
                self.regions[octant_id].entity_ids = entity_ids
    
    def _rebalance_loop(self):
        """Liquid rebalancing: move hot regions to fastest nodes."""
        interval = PHI ** 7  # ≈ 29.03s
        while self._running:
            time.sleep(interval)
            self._rebalance()
    
    def _rebalance(self):
        """Rebalance regions across nodes based on heat and node health."""
        self._compute_regions()
        
        if not self.regions or len(self.nodes) < 2:
            return
        
        # Sort regions by heat (hottest first)
        sorted_regions = sorted(
            self.regions.values(),
            key=lambda r: r.heat,
            reverse=True
        )
        
        # Sort nodes by health score (healthiest first)
        sorted_nodes = sorted(
            self.nodes.values(),
            key=lambda n: n.score,
            reverse=True
        )
        
        # Assign: hottest regions → healthiest nodes
        node_assignments: Dict[str, List[int]] = defaultdict(list)
        for i, region in enumerate(sorted_regions):
            target_node = sorted_nodes[i % len(sorted_nodes)]
            old_owner = region.owner_node
            region.owner_node = target_node.node_id
            node_assignments[target_node.node_id].append(region.octant_id)
            
            if old_owner and old_owner != target_node.node_id:
                self._migrate_region(region, old_owner, target_node.node_id)
    
    def _migrate_region(self, region: LiquidRegion, from_node: str, to_node: str):
        """Migrate a vector space region between nodes (liquid flow)."""
        target = self.nodes.get(to_node)
        if not target or not target.healthy:
            return
        
        # Build migration payload
        vectors_data = []
        for eid in region.entity_ids:
            vec = self.engine.get(eid)
            if vec:
                vectors_data.append({
                    'id': eid,
                    'data': vec.data[:20],  # Truncated for network efficiency
                    'meta': self.engine.metadata.get(eid, {})
                })
        
        if not vectors_data:
            return
        
        # Send to target node
        payload = json.dumps({
            'jsonrpc': '2.0',
            'method': 'vsa_migrate',
            'params': {
                'octant': region.octant_id,
                'vectors': vectors_data,
                'from_node': from_node
            },
            'id': 1
        }).encode()
        
        try:
            req = urllib.request.Request(
                f"{target.url}/rpc",
                data=payload,
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req, timeout=30)
        except Exception:
            pass  # Migration failure is non-critical
    
    def federated_search(self, query_text: str, k: int = 10) -> List[Dict[str, Any]]:
        """Search across all nodes in the cluster."""
        query = Vector384.from_text(query_text)
        
        # Local search
        local_results = self.engine.nearest_neighbors(query, k)
        all_results = [
            {'id': eid, 'similarity': sim, 'node': self.local_node_id}
            for eid, sim in local_results
        ]
        
        # Remote searches
        for node in self.nodes.values():
            if node.node_id == self.local_node_id or not node.healthy:
                continue
            
            try:
                payload = json.dumps({
                    'jsonrpc': '2.0',
                    'method': 'search',
                    'params': {'text': query_text, 'k': k},
                    'id': 1
                }).encode()
                
                req = urllib.request.Request(
                    f"{node.url}/rpc",
                    data=payload,
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())
                    if 'result' in data and 'results' in data['result']:
                        for r in data['result']['results']:
                            r['node'] = node.node_id
                            all_results.append(r)
            except Exception:
                continue
        
        # Merge and deduplicate
        seen = set()
        unique = []
        for r in sorted(all_results, key=lambda x: x.get('similarity', 0), reverse=True):
            if r['id'] not in seen:
                seen.add(r['id'])
                unique.append(r)
        
        return unique[:k]
    
    def get_cluster_status(self) -> dict:
        """Get full cluster status."""
        return {
            'local_node': self.local_node_id,
            'nodes': {
                nid: {
                    'healthy': n.healthy,
                    'score': n.score,
                    'latency_ms': n.latency_ms,
                    'load': n.load,
                    'role': n.role,
                    'entities': n.entity_count
                }
                for nid, n in self.nodes.items()
            },
            'regions': {
                str(rid): {
                    'entities': len(r.entity_ids),
                    'owner': r.owner_node,
                    'heat': r.heat
                }
                for rid, r in self.regions.items()
            },
            'pool_allocation': self.pool_allocation
        }
    
    def start(self):
        """Start background health checking and rebalancing."""
        self._running = True
        self._health_thread = threading.Thread(target=self._health_loop, daemon=True)
        self._rebalance_thread = threading.Thread(target=self._rebalance_loop, daemon=True)
        self._health_thread.start()
        self._rebalance_thread.start()
    
    def stop(self):
        self._running = False
        if self._health_thread:
            self._health_thread.join(timeout=5)
        if self._rebalance_thread:
            self._rebalance_thread.join(timeout=5)
