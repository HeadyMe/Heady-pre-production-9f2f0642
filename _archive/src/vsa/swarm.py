"""
src/vsa/swarm.py — Headyswarm: Liquid Architecture Swarm Intelligence
HeadyBee micro-agents operating as Ray actors within the shared VSA vector space.

Mirrors the JS HeadyBees engine (src/orchestration/heady-bees.js) but operates
entirely in tensor space — no conditional branching, pure VSA math.

Architecture:
    HeadyBee (@ray.remote) — autonomous micro-agent with local memory
    HeadySwarm              — orchestrator that materializes/dissolves bees dynamically
    ExperienceVector        — global learning shared via Redis IPC

Golden Ratio Scaling (matching JS HeadyBees):
    φ = 1.618033988749895
    Default urgency = 1/φ ≈ 0.618
    Resource floor  = 1/φ³ ≈ 0.146

© 2026 Heady Systems LLC. Proprietary and Confidential.
"""
import time
import json
import math
import os

try:
    import torch
    import torchhd
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    import ray
    HAS_RAY = True
except ImportError:
    HAS_RAY = False

try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

from .engine import VSACodebook

# ─── Constants (matching JS HeadyBees golden ratio params) ───
PHI = 1.618033988749895
PHI_INV = 1.0 / PHI            # 0.6180339887...
LN_PHI = math.log(PHI)         # 0.4812118250...
RESOURCE_FLOOR = 1.0 / (PHI ** 3)  # 0.1459...

DEFAULT_DIMS = 10000
DEFAULT_VSA = 'MAP'


# ═══════════════════════════════════════════════════════════════
# HEADYBEE — Autonomous Micro-Agent (Ray Actor)
# ═══════════════════════════════════════════════════════════════
if HAS_RAY:
    @ray.remote
    class HeadyBee:
        """Autonomous micro-agent operating in the shared VSA vector space.

        Each HeadyBee:
        - Has its own local memory (hypervector)
        - Can perceive → orient → decide → act (OODA loop) via tensor math
        - Shares learned state with the swarm via Redis IPC
        - Can dynamically re-orient its purpose via geometric rotation
        """

        def __init__(self, bee_id, role='worker', dims=DEFAULT_DIMS,
                     vsa=DEFAULT_VSA, redis_host=None):
            self.bee_id = bee_id
            self.role = role
            self.dims = dims
            self.vsa_model = vsa
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            self.spawned_at = time.time()
            self.action_count = 0
            self.dissolved = False

            # Local memory — starts as random hypervector (unique identity)
            self.local_memory = torchhd.random(
                1, dims, vsa=vsa, device=self.device
            ).squeeze(0)

            # Role vector — encodes the bee's current purpose
            self.role_hv = torchhd.random(
                1, dims, vsa=vsa, device=self.device
            ).squeeze(0)

            # Experience buffer — accumulates learned patterns
            self.experience = []

            # Redis IPC connection
            self.rds = None
            if redis_host and HAS_REDIS:
                try:
                    self.rds = redis.Redis(
                        host=redis_host, port=6379, decode_responses=True
                    )
                    self.rds.ping()
                except Exception:
                    self.rds = None

        def perceive_and_act(self, context_hv, target_hv, action_hv):
            """Core OODA loop via VSA tensor math.

            1. OBSERVE:  Receive environmental context
            2. ORIENT:   Bind context to current role
            3. DECIDE:   Similarity search against local memory
            4. ACT:      Execute action binding, update memory

            No if/else branching — pure tensor operations.
            """
            t0 = time.perf_counter_ns()

            # BIND: Associate target with action
            bound_intent = torchhd.bind(target_hv, action_hv)

            # BUNDLE: Superpose with environmental context
            perception = torchhd.bundle(bound_intent, context_hv)

            # BIND with role: Orient perception to bee's purpose
            oriented = torchhd.bind(perception, self.role_hv)

            # SIMILARITY: Compare oriented perception against local memory
            similarity = torchhd.cosine_similarity(
                oriented.unsqueeze(0),
                self.local_memory.unsqueeze(0)
            ).item()

            # UPDATE local memory: Bundle new experience
            self.local_memory = torchhd.bundle(self.local_memory, oriented)

            elapsed_ns = time.perf_counter_ns() - t0
            self.action_count += 1

            result = {
                'bee_id': self.bee_id,
                'role': self.role,
                'similarity': similarity,
                'action_count': self.action_count,
                'latency_us': elapsed_ns / 1000,
                'memory_norm': float(torch.norm(self.local_memory)),
            }

            # IPC: Broadcast to swarm consciousness
            if self.rds:
                self.rds.publish(
                    'swarm_consciousness',
                    json.dumps({
                        'bee_id': self.bee_id,
                        'event': 'action',
                        'similarity': similarity,
                        'time': time.time(),
                    })
                )

            self.experience.append(result)
            return result

        def reorient(self, new_role_hv):
            """Dynamically change the bee's purpose via geometric rotation.

            In liquid architecture, bees don't need redeployment — they
            apply a rotor to shift their operational context instantly.
            """
            # Apply rotor: bind current role with new role to create rotation
            rotor = torchhd.bind(self.role_hv, new_role_hv)
            self.local_memory = torchhd.bind(self.local_memory, rotor)
            self.role_hv = new_role_hv
            return {'bee_id': self.bee_id, 'reoriented': True}

        def get_experience_vector(self):
            """Return the bee's accumulated experience as a single vector.

            This is bundled into the global Experience Vector for the swarm.
            """
            return self.local_memory

        def dissolve(self):
            """Release the bee back to the liquid pool."""
            self.dissolved = True
            return {
                'bee_id': self.bee_id,
                'actions': self.action_count,
                'lifetime_s': time.time() - self.spawned_at,
            }

        def get_status(self):
            return {
                'bee_id': self.bee_id,
                'role': self.role,
                'device': self.device,
                'action_count': self.action_count,
                'memory_norm': float(torch.norm(self.local_memory)),
                'dissolved': self.dissolved,
                'uptime_s': time.time() - self.spawned_at,
            }


# ═══════════════════════════════════════════════════════════════
# HEADYSWARM — Swarm Orchestrator
# ═══════════════════════════════════════════════════════════════
class HeadySwarm:
    """Orchestrates HeadyBee micro-agents in the shared VSA vector space.

    Mirrors the JS HeadyBees.blast() pattern:
    - Calculates bee count via golden ratio scaling
    - Materializes bees as Ray actors
    - Executes all bees in parallel
    - Merges results into global experience
    - Dissolves bees back to pool

    Usage:
        swarm = HeadySwarm(dims=10000, redis_host='127.0.0.1')
        result = swarm.blast('anomaly_detection', urgency=0.8, bee_count=6)
    """

    def __init__(self, dims=DEFAULT_DIMS, vsa=DEFAULT_VSA,
                 redis_host=None, gpu_fraction=0.25):
        if not HAS_RAY:
            raise RuntimeError("Ray is required. pip install ray[default]")
        if not HAS_TORCH:
            raise RuntimeError("PyTorch + torchhd required.")

        self.dims = dims
        self.vsa = vsa
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.redis_host = redis_host
        self.gpu_fraction = gpu_fraction
        self.codebook = VSACodebook(dims, vsa, self.device)

        # Swarm state
        self.active_bees = []
        self.blast_history = []
        self.global_experience = torchhd.random(
            1, dims, vsa=vsa, device=self.device
        ).squeeze(0)
        self.total_blasts = 0
        self.total_bees_spawned = 0

        # Redis for IPC
        self.rds = None
        if redis_host and HAS_REDIS:
            try:
                self.rds = redis.Redis(
                    host=redis_host, port=6379, decode_responses=True
                )
                self.rds.ping()
            except Exception:
                self.rds = None

        # Pre-register swarm concepts
        self._register_concepts()

    def _register_concepts(self):
        """Register the swarm's operational vocabulary."""
        concepts = [
            # Roles
            'ROLE_detector', 'ROLE_healer', 'ROLE_optimizer',
            'ROLE_guard', 'ROLE_researcher', 'ROLE_deployer',
            'ROLE_monitor', 'ROLE_router', 'ROLE_embedder',
            # Targets
            'TARGET_anomaly', 'TARGET_health', 'TARGET_performance',
            'TARGET_security', 'TARGET_state', 'TARGET_vector_space',
            'TARGET_api', 'TARGET_pipeline', 'TARGET_memory',
            # Actions
            'ACTION_scan', 'ACTION_bind', 'ACTION_bundle',
            'ACTION_remediate', 'ACTION_escalate', 'ACTION_learn',
            'ACTION_broadcast', 'ACTION_dissolve', 'ACTION_reorient',
        ]
        self.codebook.bulk_add(concepts)

    def calculate_bee_count(self, urgency=PHI_INV, work_items=1, resources=1.0):
        """Calculate optimal bee count using golden ratio scaling.

        Matches JS HeadyBees._calculateBeeCount():
            bees = ⌈ workItems × urgency × resources × efficiency × history ⌉

        Golden ratio properties:
            • Urgency default = 1/φ (natural resting state)
            • Resource floor = 1/φ³ (emergency threshold)
            • History factor slides [1/φ, 1.0]
        """
        resources = max(resources, RESOURCE_FLOOR)

        # History factor: recent success elevates count
        history_factor = PHI_INV  # starts conservative
        if self.blast_history:
            recent = self.blast_history[-5:]
            avg_success = sum(1 for r in recent if r.get('success', True)) / len(recent)
            history_factor = PHI_INV + (1 - PHI_INV) * avg_success

        # Efficiency decay: more bees → diminishing returns (phi curve)
        max_bees = int(os.cpu_count() * 2) if os.cpu_count() else 8
        efficiency_decay = (PHI * LN_PHI) / max_bees

        raw = work_items * urgency * resources * history_factor
        efficiency = math.exp(-efficiency_decay * raw)
        adjusted = raw * efficiency

        return max(1, math.ceil(adjusted))

    def blast(self, task_name, urgency=PHI_INV, bee_count=None,
              context=None, work_items=1):
        """Primary swarm operation — matches JS HeadyBees.blast().

        1. Calculate bee count (golden ratio scaling)
        2. Materialize HeadyBees as Ray actors
        3. Execute all bees in parallel (OODA loop)
        4. Merge into global experience vector
        5. Dissolve bees

        Returns blast result with per-bee metrics.
        """
        t0 = time.perf_counter()

        # Determine bee count
        if bee_count is None:
            bee_count = self.calculate_bee_count(urgency, work_items)

        # Generate context vectors
        context_hv = self.codebook.get(context or 'TARGET_state')
        target_hv = self.codebook.get(f'TARGET_{task_name}')
        action_hv = self.codebook.get(f'ACTION_{task_name}')

        # Materialize bees as Ray actors
        bees = []
        for i in range(bee_count):
            bee_config = {
                'num_gpus': self.gpu_fraction if self.device == 'cuda' else 0
            }
            bee = HeadyBee.options(**bee_config).remote(
                bee_id=f'{task_name}_{self.total_blasts}_{i}',
                role=task_name,
                dims=self.dims,
                vsa=self.vsa,
                redis_host=self.redis_host,
            )
            bees.append(bee)

        self.total_bees_spawned += bee_count

        # Execute all bees in parallel
        futures = [
            bee.perceive_and_act.remote(context_hv, target_hv, action_hv)
            for bee in bees
        ]
        results = ray.get(futures)

        # Merge experience vectors into global
        exp_futures = [bee.get_experience_vector.remote() for bee in bees]
        exp_vectors = ray.get(exp_futures)
        for exp_hv in exp_vectors:
            self.global_experience = torchhd.bundle(self.global_experience, exp_hv)

        # Dissolve bees
        dissolve_futures = [bee.dissolve.remote() for bee in bees]
        ray.get(dissolve_futures)

        elapsed = time.perf_counter() - t0

        # Record blast
        blast_record = {
            'task': task_name,
            'bee_count': bee_count,
            'urgency': urgency,
            'duration_ms': elapsed * 1000,
            'success': True,
            'results': results,
            'global_experience_norm': float(torch.norm(self.global_experience)),
            'time': time.time(),
        }
        self.blast_history.append(blast_record)
        self.total_blasts += 1

        # Publish to Redis
        if self.rds:
            self.rds.set(
                f'swarm:blast:{self.total_blasts}',
                json.dumps({
                    'task': task_name,
                    'bees': bee_count,
                    'duration_ms': elapsed * 1000,
                    'consensus': [r['similarity'] for r in results],
                })
            )
            self.rds.set('swarm:experience_norm',
                         str(float(torch.norm(self.global_experience))))

        return blast_record

    def blast_parallel(self, task_name, count, context=None):
        """Blast a single task across N parallel bees (same work, N copies).
        Matches JS blastParallel().
        """
        return self.blast(task_name, bee_count=count, context=context)

    def blast_all(self, tasks):
        """Blast multiple independent tasks — one bee per task.
        Matches JS blastAll().
        """
        results = []
        for task in tasks:
            name = task if isinstance(task, str) else task.get('name', 'unknown')
            result = self.blast(name, bee_count=1)
            results.append(result)
        return results

    def get_swarm_consensus(self, concept_name):
        """Query the global experience vector for consensus on a concept."""
        concept_hv = self.codebook.get(concept_name)
        sim = torchhd.cosine_similarity(
            self.global_experience.unsqueeze(0),
            concept_hv.unsqueeze(0)
        ).item()
        return {
            'concept': concept_name,
            'consensus_similarity': sim,
            'experience_norm': float(torch.norm(self.global_experience)),
            'total_blasts': self.total_blasts,
            'total_bees': self.total_bees_spawned,
        }

    def get_status(self):
        """Return swarm status — matches JS HeadyBees.getStatus()."""
        return {
            'total_blasts': self.total_blasts,
            'total_bees_spawned': self.total_bees_spawned,
            'blast_history_count': len(self.blast_history),
            'global_experience_norm': float(torch.norm(self.global_experience)),
            'codebook_size': len(self.codebook),
            'device': self.device,
            'dims': self.dims,
            'phi': PHI,
            'redis_connected': self.rds is not None,
        }

    def get_blast_history(self, limit=20):
        """Return recent blast history."""
        return self.blast_history[-limit:]

    def save_experience(self, path):
        """Persist the global experience vector metadata to disk."""
        data = {
            'status': self.get_status(),
            'history': [{
                'task': r['task'],
                'bees': r['bee_count'],
                'duration_ms': r['duration_ms'],
                'time': r['time'],
            } for r in self.blast_history],
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
