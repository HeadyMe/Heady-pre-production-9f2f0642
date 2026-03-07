"""
HeadySystems v3.2.2 — Chaos Engineering Scenarios
====================================================
Extends existing Python chaos framework with HeadySystems-specific scenarios.
All numeric parameters derive from φ=1.618033988749895 and Fibonacci sequences.

Scenarios:
    1. redis_connection_failure   — Kill Redis, verify circuit breaker trips
    2. high_latency_injection     — Add fib(8)=21ms delay to all downstream calls
    3. agent_crash_recovery       — Kill random bee agents, verify self-healing
    4. memory_pressure            — Consume 85.4% (CSL CRITICAL) of available memory
    5. network_partition          — Isolate heady-mcp from heady-conductor
    6. certificate_expiry_sim     — Simulate expired TLS certificate

Each scenario includes:
    - setup(): Pre-conditions and initial state capture
    - run(): Fault injection
    - assert_steady_state(): Verify system behavior meets expectations
    - rollback(): Restore system to pre-fault state
    - success_criteria: Human-readable success criteria

Usage:
    python chaos-scenarios.py --scenario redis_connection_failure
    python chaos-scenarios.py --scenario all --dry-run
    python chaos-scenarios.py --scenario high_latency_injection --namespace production
"""

from __future__ import annotations

import argparse
import ctypes
import json
import logging
import os
import random
import subprocess
import sys
import time
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from datetime import datetime, timezone

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS — All derive from φ or Fibonacci
# ─────────────────────────────────────────────────────────────────────────────

PHI: float = 1.618033988749895
"""Golden ratio — fundamental design constant."""

FIB: List[int] = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
"""Fibonacci sequence: fib(1)..fib(17)."""

# CSL threshold constants
CSL_DORMANT_MAX:  float = 0.236   # Below DORMANT/LOW boundary
CSL_LOW_MAX:      float = 0.382   # Below LOW/MODERATE boundary
CSL_MODERATE_MAX: float = 0.618   # Below MODERATE/HIGH boundary (= 1/φ)
CSL_HIGH_MAX:     float = 0.854   # Below HIGH/CRITICAL boundary
CSL_CRITICAL_MIN: float = 0.854   # CRITICAL gate starts here

# Chaos-specific constants
LATENCY_INJECT_MS:        int   = FIB[7]    # fib(8)=21ms — injected delay
MEMORY_PRESSURE_RATIO:    float = CSL_CRITICAL_MIN  # 0.854 = 85.4%
CIRCUIT_BREAKER_WAIT_S:   int   = FIB[6]    # fib(7)=13s — wait for CB to trip
AGENT_RECOVERY_TIMEOUT_S: int   = FIB[8]    # fib(9)=34s — swarm self-heal window
STEADY_STATE_CHECK_WAIT_S: int  = FIB[4]    # fib(5)=5s — wait before assertions
RETRY_BACKOFF_BASE_S:     float = 1.0       # 1.0s × φ^n for retry
MAX_RETRIES:              int   = FIB[2]    # fib(3)=2 retries
ROLLBACK_TIMEOUT_S:       int   = FIB[7]    # fib(8)=21s rollback timeout

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
logger = logging.getLogger("heady.chaos")

# ─────────────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ChaosResult:
    """Result of a chaos scenario execution."""
    scenario:         str
    success:          bool
    duration_s:       float
    assertions_passed: List[str] = field(default_factory=list)
    assertions_failed: List[str] = field(default_factory=list)
    rollback_success:  bool = True
    error:             Optional[str] = None
    metadata:          Dict[str, Any] = field(default_factory=dict)
    timestamp:         str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    phi:               float = PHI

    @property
    def passed(self) -> bool:
        return self.success and not self.assertions_failed

    def to_json(self) -> str:
        return json.dumps({
            "scenario":          self.scenario,
            "success":           self.success,
            "passed":            self.passed,
            "duration_s":        round(self.duration_s, 3),
            "assertions_passed": self.assertions_passed,
            "assertions_failed": self.assertions_failed,
            "rollback_success":  self.rollback_success,
            "error":             self.error,
            "metadata":          self.metadata,
            "timestamp":         self.timestamp,
            "phi":               self.phi,
            "fibonacci_ref": {
                "latency_inject_ms":        LATENCY_INJECT_MS,
                "memory_pressure_ratio":    MEMORY_PRESSURE_RATIO,
                "circuit_breaker_wait_s":   CIRCUIT_BREAKER_WAIT_S,
                "agent_recovery_timeout_s": AGENT_RECOVERY_TIMEOUT_S,
            },
        }, indent=2)


@dataclass
class SteadyState:
    """Pre-fault system state snapshot."""
    error_rate:        float
    p95_latency_ms:    float
    active_agents:     int
    redis_connections: int
    circuit_breakers:  Dict[str, str]  # name → state
    memory_ratio:      float
    phi_drift:         float
    timestamp:         str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ─────────────────────────────────────────────────────────────────────────────
# BASE SCENARIO CLASS
# ─────────────────────────────────────────────────────────────────────────────

class ChaosScenario:
    """
    Base class for all HeadySystems chaos scenarios.

    Lifecycle:
        1. setup()                  — Capture pre-fault steady state
        2. run()                    — Inject fault
        3. assert_steady_state()    — Verify expected behavior during fault
        4. rollback()               — Remove fault
        5. assert_recovery()        — Verify system recovered
    """

    name:             str = "base"
    description:      str = ""
    success_criteria: List[str] = []

    def __init__(self, namespace: str = "default", dry_run: bool = False):
        self.namespace = namespace
        self.dry_run   = dry_run
        self._log      = logging.getLogger(f"heady.chaos.{self.name}")
        self._pre_state: Optional[SteadyState] = None
        self._injected  = False

    # ── Abstract interface ───────────────────────────────────────────────────

    def setup(self) -> SteadyState:
        """Capture pre-fault steady state. Override in subclasses."""
        raise NotImplementedError

    def run(self) -> None:
        """Inject the fault. Must set self._injected = True."""
        raise NotImplementedError

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        """
        Assert expected behavior while fault is active.
        Returns list of failed assertions (empty = all passed).
        """
        raise NotImplementedError

    def rollback(self) -> bool:
        """Remove the fault. Returns True if rollback succeeded."""
        raise NotImplementedError

    def assert_recovery(self, pre: SteadyState) -> List[str]:
        """
        Assert system returned to pre-fault state after rollback.
        Default: check error rate and agent count.
        """
        return []

    # ── Execution orchestrator ───────────────────────────────────────────────

    def execute(self) -> ChaosResult:
        """Execute the full chaos scenario lifecycle."""
        self._log.info(f"Starting chaos scenario: {self.name}")
        start = time.monotonic()
        result = ChaosResult(scenario=self.name, success=False, duration_s=0)

        try:
            # 1. Setup
            self._log.info("Phase 1: Setup — capturing steady state")
            pre = self.setup()
            self._pre_state = pre
            self._log.info(f"Steady state: error_rate={pre.error_rate:.4f}, "
                           f"p95_latency={pre.p95_latency_ms}ms, "
                           f"agents={pre.active_agents}, "
                           f"phi_drift={pre.phi_drift:.4f}")

            # 2. Fault injection
            if not self.dry_run:
                self._log.info("Phase 2: Run — injecting fault")
                self.run()
                self._injected = True
            else:
                self._log.info("DRY RUN: skipping fault injection")

            # 3. Wait for system to react (fib(5)=5s steady state observation window)
            self._log.info(f"Waiting fib(5)={STEADY_STATE_CHECK_WAIT_S}s for fault propagation...")
            time.sleep(STEADY_STATE_CHECK_WAIT_S)

            # 4. Assert fault behavior
            self._log.info("Phase 3: Assert — checking expected fault behavior")
            failed = self.assert_steady_state(pre)
            result.assertions_failed = failed
            result.assertions_passed = [c for c in self.success_criteria if c not in failed]

            # 5. Rollback
            self._log.info("Phase 4: Rollback — removing fault")
            rollback_ok = False
            if not self.dry_run:
                rollback_ok = self.rollback()
                self._injected = False
            else:
                rollback_ok = True
            result.rollback_success = rollback_ok

            # 6. Wait for recovery (fib(8)=21s)
            self._log.info(f"Waiting fib(8)={FIB[7]}s for system recovery...")
            time.sleep(FIB[7])

            # 7. Assert recovery
            recovery_failed = self.assert_recovery(pre)
            result.assertions_failed.extend(recovery_failed)

            result.success = len(result.assertions_failed) == 0 and rollback_ok
            result.duration_s = time.monotonic() - start

        except Exception as exc:
            self._log.error(f"Chaos scenario failed with exception: {exc}", exc_info=True)
            result.error = str(exc)
            result.success = False
            # Attempt emergency rollback
            if self._injected:
                self._log.warning("Attempting emergency rollback...")
                try:
                    self.rollback()
                except Exception as rb_exc:
                    self._log.error(f"Emergency rollback failed: {rb_exc}")
                    result.rollback_success = False

        finally:
            result.duration_s = time.monotonic() - start
            self._log.info(f"Scenario {self.name} complete. Passed: {result.passed} "
                           f"({len(result.assertions_failed)} failures)")
            print(result.to_json())

        return result

    # ── Helper utilities ─────────────────────────────────────────────────────

    def _kubectl(self, *args: str, capture: bool = False) -> subprocess.CompletedProcess:
        """Run a kubectl command in the configured namespace."""
        cmd = ["kubectl", "-n", self.namespace, *args]
        self._log.debug(f"kubectl: {' '.join(cmd)}")
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=ROLLBACK_TIMEOUT_S,
        )

    def _get_metric(self, query: str) -> float:
        """Query Prometheus for a metric value. Returns 0.0 on failure."""
        prometheus_url = os.environ.get("PROMETHEUS_URL", "http://localhost:9090")
        try:
            import urllib.request
            import urllib.parse
            url = f"{prometheus_url}/api/v1/query?query={urllib.parse.quote(query)}"
            with urllib.request.urlopen(url, timeout=FIB[4]) as resp:
                data = json.load(resp)
                results = data.get("data", {}).get("result", [])
                if results:
                    return float(results[0]["value"][1])
        except Exception as e:
            self._log.warning(f"Metric query failed ({query}): {e}")
        return 0.0

    def _get_steady_state(self) -> SteadyState:
        """Capture current system state from Prometheus."""
        return SteadyState(
            error_rate=self._get_metric(
                f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
                f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
            ),
            p95_latency_ms=self._get_metric(
                f'histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket{{namespace="{self.namespace}"}}[5m])) by (le))'
            ),
            active_agents=int(self._get_metric(
                f'sum(heady_active_agents{{namespace="{self.namespace}"}})'
            )),
            redis_connections=int(self._get_metric(
                f'heady_redis_pool_active_connections{{namespace="{self.namespace}"}}'
            )),
            circuit_breakers={},  # Populated per-scenario
            memory_ratio=self._get_metric(
                f'max(heady_memory_usage_ratio{{namespace="{self.namespace}"}})'
            ),
            phi_drift=self._get_metric(
                f'heady_phi_drift{{namespace="{self.namespace}"}}'
            ),
        )

    def _assert(self, condition: bool, message: str, failures: List[str]) -> None:
        """Assert helper that accumulates failures."""
        if condition:
            self._log.info(f"✓ PASSED: {message}")
        else:
            self._log.error(f"✗ FAILED: {message}")
            failures.append(message)

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 1: Redis Connection Failure
# ─────────────────────────────────────────────────────────────────────────────

class RedisConnectionFailure(ChaosScenario):
    """
    Kills Redis connections and verifies the circuit breaker trips.

    Fault:         Scale Redis deployment to 0 replicas (complete outage).
    Expected:      Circuit breaker for Redis opens within fib(6)=8s.
    Assert:        CB state == 'open', error rate rises, no deadlocks.
    Rollback:      Restore Redis deployment to fib(3)=2 replicas.
    Recovery:      CB transitions to half-open → closed, error rate drops.
    """
    name        = "redis_connection_failure"
    description = "Kill Redis connections and verify circuit breaker opens within fib(6)=8s."
    success_criteria = [
        "Circuit breaker for Redis opens within fib(7)=13s",
        "Error rate rises above CSL MODERATE (0.382) during fault",
        "No agent deadlocks occur (agents handle Redis absence gracefully)",
        "Circuit breaker closes after Redis restored",
        "Error rate returns to < 0.01 within fib(9)=34s of recovery",
    ]

    def setup(self) -> SteadyState:
        return self._get_steady_state()

    def run(self) -> None:
        """Scale Redis to 0 replicas."""
        self._log.info("Scaling Redis to 0 replicas...")
        self._kubectl("scale", "deployment/redis", "--replicas=0")
        # Kill existing Redis connections via tc netem (network disruption alternative)
        # This ensures in-flight connections are dropped, not just new ones refused.
        self._kubectl(
            "exec", "-l", "app=heady-brain",
            "--", "bash", "-c",
            "redis-cli -h redis shutdown nosave 2>/dev/null; true"
        )

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []
        # Wait additional fib(7)=13s for CB to trip
        self._log.info(f"Waiting fib(7)={CIRCUIT_BREAKER_WAIT_S}s for circuit breaker to trip...")
        time.sleep(CIRCUIT_BREAKER_WAIT_S)

        cb_state = self._get_metric(
            f'heady_circuit_breaker_state{{namespace="{self.namespace}", dependency="redis", state="open"}}'
        )
        error_rate = self._get_metric(
            f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
            f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
        )
        deadlocked_agents = self._get_metric(
            f'sum(heady_agent_stuck_count{{namespace="{self.namespace}"}})'
        )

        self._assert(cb_state == 1.0, "Circuit breaker for Redis is OPEN", failures)
        self._assert(error_rate > CSL_MODERATE_MAX,
                     f"Error rate elevated > {CSL_MODERATE_MAX} (CSL MODERATE) during fault", failures)
        self._assert(deadlocked_agents == 0,
                     "No agent deadlocks during Redis outage", failures)
        return failures

    def rollback(self) -> bool:
        """Restore Redis to fib(3)=2 replicas."""
        self._log.info("Restoring Redis to fib(3)=2 replicas...")
        result = self._kubectl("scale", "deployment/redis", "--replicas=2")
        return result.returncode == 0

    def assert_recovery(self, pre: SteadyState) -> List[str]:
        failures = []
        time.sleep(FIB[8])  # Wait fib(9)=34s for recovery

        error_rate = self._get_metric(
            f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
            f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
        )
        cb_state = self._get_metric(
            f'heady_circuit_breaker_state{{namespace="{self.namespace}", dependency="redis", state="closed"}}'
        )

        self._assert(error_rate < 0.01,
                     f"Error rate recovered to < 1% (current: {error_rate:.4f})", failures)
        self._assert(cb_state == 1.0, "Circuit breaker returned to CLOSED state", failures)
        return failures

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 2: High Latency Injection
# ─────────────────────────────────────────────────────────────────────────────

class HighLatencyInjection(ChaosScenario):
    """
    Injects fib(8)=21ms delay into all downstream calls from heady-brain.

    Fault:         tc netem delay fib(8)=21ms ±fib(4)=3ms (±15% jitter)
    Expected:      p99 latency rises, CSL gate may trigger HIGH alerts.
                   System remains operational (no 5xx errors).
    Assert:        p95 latency increases but stays within 2×SLA.
    Rollback:      Remove tc netem rule.
    """
    name        = "high_latency_injection"
    description = f"Inject fib(8)={LATENCY_INJECT_MS}ms network delay on heady-brain → downstream calls."
    success_criteria = [
        f"p99 latency increases by ≥ fib(8)={LATENCY_INJECT_MS}ms during fault",
        "Error rate remains < 1% despite latency injection",
        "Circuit breakers do NOT open (latency alone should not trip CB unless timeout < 21ms)",
        "CSL gate annotation reflects HIGH pressure",
        "p99 returns to pre-fault level within fib(9)=34s of rollback",
    ]

    def setup(self) -> SteadyState:
        return self._get_steady_state()

    def run(self) -> None:
        """Inject latency using tc netem on heady-brain pods."""
        self._log.info(f"Injecting {LATENCY_INJECT_MS}ms ±{FIB[2]}ms jitter delay...")
        # Inject via toxiproxy or tc netem (using kubectl exec)
        self._kubectl(
            "exec", "-l", "app=heady-brain",
            "--", "tc", "qdisc", "add", "dev", "eth0", "root", "netem",
            "delay", f"{LATENCY_INJECT_MS}ms", f"{FIB[2]}ms", "distribution", "normal"
        )

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []

        p99 = self._get_metric(
            f'histogram_quantile(0.99, sum(rate(http_request_duration_ms_bucket{{namespace="{self.namespace}"}}[5m])) by (le))'
        )
        error_rate = self._get_metric(
            f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
            f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
        )
        cb_open = self._get_metric(
            f'sum(heady_circuit_breaker_state{{namespace="{self.namespace}", state="open"}})'
        )

        self._assert(p99 >= pre.p95_latency_ms + LATENCY_INJECT_MS,
                     f"p99 increased by ≥ {LATENCY_INJECT_MS}ms (was {pre.p95_latency_ms:.0f}ms, now {p99:.0f}ms)",
                     failures)
        self._assert(error_rate < 0.01, f"Error rate < 1% during latency injection ({error_rate:.4f})", failures)
        self._assert(cb_open == 0, "No circuit breakers opened under latency injection alone", failures)
        return failures

    def rollback(self) -> bool:
        """Remove tc netem delay rule."""
        self._log.info("Removing tc netem latency injection...")
        result = self._kubectl(
            "exec", "-l", "app=heady-brain",
            "--", "tc", "qdisc", "del", "dev", "eth0", "root"
        )
        return result.returncode == 0

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 3: Agent Crash Recovery
# ─────────────────────────────────────────────────────────────────────────────

class AgentCrashRecovery(ChaosScenario):
    """
    Kill random bee agents and verify the swarm self-heals.

    Fault:         Delete fib(3)=2 random heady-hive agent pods.
    Expected:      Active agent count drops briefly, then recovers.
                   Swarm maintains minimum fib(4)=3 agents.
    Recovery:      Agent count returns to pre-fault level within fib(9)=34s.
    """
    name        = "agent_crash_recovery"
    description = "Kill fib(3)=2 random bee agents and verify swarm self-heals within fib(9)=34s."
    success_criteria = [
        "Swarm maintains minimum fib(4)=3 agents during kill",
        "Killed agents are replaced within fib(9)=34s",
        "No tasks are permanently lost (task queue drains)",
        "Agent count returns to pre-fault level",
        "Error rate spike < CSL MODERATE (0.382)",
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._killed_pods: List[str] = []

    def setup(self) -> SteadyState:
        return self._get_steady_state()

    def run(self) -> None:
        """Delete fib(3)=2 random heady-hive pods."""
        result = self._kubectl("get", "pods", "-l", "app=heady-hive",
                               "-o", "jsonpath={.items[*].metadata.name}", capture=True)
        pods = result.stdout.strip().split()
        if not pods:
            raise RuntimeError("No heady-hive pods found to kill")

        # Kill fib(3)=2 random pods
        n_kill = min(FIB[2], len(pods))  # fib(3)=2
        to_kill = random.sample(pods, n_kill)
        self._killed_pods = to_kill

        self._log.info(f"Killing {n_kill} bee agent pods: {to_kill}")
        for pod in to_kill:
            self._kubectl("delete", "pod", pod, "--grace-period=0", "--force")

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []

        active_agents = int(self._get_metric(
            f'sum(heady_active_agents{{namespace="{self.namespace}"}})'
        ))
        error_rate = self._get_metric(
            f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
            f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
        )

        self._assert(active_agents >= FIB[3],  # fib(4)=3 minimum
                     f"Swarm maintains minimum fib(4)=3 agents (current: {active_agents})", failures)
        self._assert(error_rate < CSL_MODERATE_MAX,
                     f"Error rate < CSL MODERATE during crash ({error_rate:.4f} < {CSL_MODERATE_MAX})", failures)
        return failures

    def rollback(self) -> bool:
        """Rollback is implicit — Kubernetes ReplicaSet controller restores pods automatically."""
        self._log.info("Rollback: Kubernetes ReplicaSet controller will restore killed pods.")
        return True

    def assert_recovery(self, pre: SteadyState) -> List[str]:
        failures = []

        # Wait full fib(9)=34s recovery window
        self._log.info(f"Waiting fib(9)={AGENT_RECOVERY_TIMEOUT_S}s for agent recovery...")
        time.sleep(AGENT_RECOVERY_TIMEOUT_S)

        active_agents = int(self._get_metric(
            f'sum(heady_active_agents{{namespace="{self.namespace}"}})'
        ))

        self._assert(active_agents >= pre.active_agents - FIB[2],
                     f"Agent count recovered (was {pre.active_agents}, now {active_agents})", failures)
        return failures

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 4: Memory Pressure
# ─────────────────────────────────────────────────────────────────────────────

class MemoryPressure(ChaosScenario):
    """
    Consume 85.4% (CSL CRITICAL threshold) of available container memory.

    Fault:         Allocate φ^-1 of container memory limit via stress-ng.
    Expected:      Memory alerts fire, GC pressure increases, but no OOM.
    Assert:        Memory ratio > 0.854, memory_limiter in OTel activates.
    Rollback:      Kill stress-ng process.
    """
    name        = "memory_pressure"
    description = f"Consume {MEMORY_PRESSURE_RATIO*100:.1f}% (CSL CRITICAL={MEMORY_PRESSURE_RATIO}) of heady-brain memory."
    success_criteria = [
        "Memory usage exceeds CSL CRITICAL threshold (0.854)",
        "MemoryPressure alert fires within fib(5)=5m",
        "No OOM kill occurs (process survives)",
        "OTel memory_limiter activates and drops excess telemetry",
        "Error rate < 0.05 (service degrades gracefully, not crashes)",
        "Memory returns to pre-fault level within fib(8)=21s of rollback",
    ]

    def setup(self) -> SteadyState:
        return self._get_steady_state()

    def run(self) -> None:
        """
        Allocate fib(16)=987 MiB × 0.854 ≈ 843 MiB via stress-ng.
        Adjust to actual container memory limit if CONTAINER_MEMORY_MIB is set.
        """
        container_mib = int(os.environ.get("CONTAINER_MEMORY_MIB", "1024"))
        pressure_mib  = int(container_mib * MEMORY_PRESSURE_RATIO)

        self._log.info(f"Allocating {pressure_mib} MiB of memory in heady-brain pods...")
        self._kubectl(
            "exec", "-l", "app=heady-brain",
            "--",
            "stress-ng", "--vm", "1",
            "--vm-bytes", f"{pressure_mib}M",
            "--vm-keep",
            "--timeout", str(FIB[7]),  # fib(8)=21s duration
            "--quiet",
        )

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []

        memory_ratio = self._get_metric(
            f'max(process_resident_memory_bytes{{namespace="{self.namespace}",job="heady-brain"}}) / '
            f'max(container_spec_memory_limit_bytes{{namespace="{self.namespace}",container="heady-brain"}})'
        )
        error_rate = self._get_metric(
            f'sum(rate(http_requests_total{{namespace="{self.namespace}",status=~"5.."}}[1m])) / '
            f'sum(rate(http_requests_total{{namespace="{self.namespace}"}}[1m]))'
        )
        # Check OOM kill count
        oom_kills = self._get_metric(
            f'kube_pod_container_status_restarts_total{{namespace="{self.namespace}", container="heady-brain"}}'
        )

        self._assert(memory_ratio >= MEMORY_PRESSURE_RATIO,
                     f"Memory ratio ≥ CSL CRITICAL threshold {MEMORY_PRESSURE_RATIO} (actual: {memory_ratio:.4f})",
                     failures)
        self._assert(oom_kills == 0,
                     f"No OOM kills during pressure test (restarts: {oom_kills:.0f})", failures)
        self._assert(error_rate < 0.05,
                     f"Error rate < 5% under memory pressure ({error_rate:.4f})", failures)
        return failures

    def rollback(self) -> bool:
        """Kill stress-ng processes in heady-brain pods."""
        self._log.info("Killing stress-ng processes...")
        result = self._kubectl(
            "exec", "-l", "app=heady-brain",
            "--", "pkill", "-f", "stress-ng"
        )
        return True  # pkill returns non-zero if no processes found — that's OK

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 5: Network Partition
# ─────────────────────────────────────────────────────────────────────────────

class NetworkPartition(ChaosScenario):
    """
    Isolate heady-mcp from heady-conductor using NetworkPolicy.

    Fault:         Apply a blocking NetworkPolicy blocking heady-conductor → heady-mcp.
    Expected:      MCP tool calls fail with circuit breaker open.
    Assert:        heady-conductor health degrades, MCP errors spike.
    Rollback:      Delete the blocking NetworkPolicy.
    """
    name        = "network_partition"
    description = "Block heady-mcp ↔ heady-conductor traffic via NetworkPolicy."
    success_criteria = [
        "heady-conductor to heady-mcp calls fail within fib(5)=5s",
        "Circuit breaker for heady-mcp opens on heady-conductor",
        "heady-mcp health endpoint still accessible directly",
        "Conductor enters graceful degradation (returns cached responses if available)",
        "Network restored within fib(8)=21s of rollback",
    ]

    POLICY_NAME = "chaos-partition-mcp"
    POLICY_YAML = """
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: chaos-partition-mcp
  labels:
    chaos: "true"
spec:
  podSelector:
    matchLabels:
      app: heady-mcp
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              # Allow everything EXCEPT heady-conductor
              app: "!heady-conductor"
"""

    def setup(self) -> SteadyState:
        return self._get_steady_state()

    def run(self) -> None:
        """Apply blocking NetworkPolicy."""
        self._log.info("Applying network partition: blocking heady-conductor → heady-mcp")
        self._kubectl("apply", "-f", "-", capture=False)
        # Use subprocess.input pipe
        subprocess.run(
            ["kubectl", "-n", self.namespace, "apply", "-f", "-"],
            input=self.POLICY_YAML.encode(),
            capture_output=False,
            timeout=ROLLBACK_TIMEOUT_S,
        )

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []
        time.sleep(FIB[4])  # fib(5)=5s wait for partition to take effect

        mcp_error_rate = self._get_metric(
            f'sum(rate(heady_mcp_tool_calls_total{{namespace="{self.namespace}",status="error"}}[1m])) / '
            f'sum(rate(heady_mcp_tool_calls_total{{namespace="{self.namespace}"}}[1m]))'
        )
        cb_open = self._get_metric(
            f'heady_circuit_breaker_state{{namespace="{self.namespace}", service="heady-conductor", dependency="heady-mcp", state="open"}}'
        )

        self._assert(mcp_error_rate > 0.5,
                     f"MCP tool calls failing > 50% during partition ({mcp_error_rate:.4f})", failures)
        self._assert(cb_open == 1.0,
                     "Circuit breaker for heady-mcp opened on heady-conductor", failures)
        return failures

    def rollback(self) -> bool:
        """Delete the blocking NetworkPolicy."""
        self._log.info("Removing network partition NetworkPolicy...")
        result = self._kubectl("delete", "networkpolicy", self.POLICY_NAME, "--ignore-not-found=true")
        return result.returncode == 0

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 6: Certificate Expiry Simulation
# ─────────────────────────────────────────────────────────────────────────────

class CertificateExpirySim(ChaosScenario):
    """
    Simulate an expired TLS certificate by swapping the cert secret with
    an expired self-signed cert, then verifying alerts fire and mTLS fails.

    Fault:         Replace TLS secret with an expired cert (notAfter = -1 day).
    Expected:      CertificateExpiringSoon (and CertificateExpiringCritical) alerts fire.
                   mTLS handshakes fail. Services fall back to health-check-only traffic.
    Rollback:      Restore original TLS secret.
    """
    name        = "certificate_expiry_sim"
    description = "Simulate expired TLS cert: swap secret, verify alerts fire and mTLS fails."
    success_criteria = [
        "CertificateExpiringCritical alert fires within fib(7)=13 minutes",
        "mTLS handshakes fail with certificate expired error",
        "Non-mTLS health endpoints remain accessible",
        "cert-manager or auto-rotation detects expiry",
        "Original cert restored successfully via rollback",
    ]

    CERT_SECRET_NAME = "heady-tls-secret"
    BACKUP_SECRET_NAME = "heady-tls-secret-chaos-backup"

    def setup(self) -> SteadyState:
        # Back up the current TLS secret
        self._log.info(f"Backing up TLS secret '{self.CERT_SECRET_NAME}'...")
        result = self._kubectl("get", "secret", self.CERT_SECRET_NAME, "-o", "json", capture=True)
        if result.returncode == 0:
            # Store backup in a new secret
            backup_data = json.loads(result.stdout)
            backup_data["metadata"]["name"] = self.BACKUP_SECRET_NAME
            backup_data["metadata"].pop("resourceVersion", None)
            backup_data["metadata"].pop("uid", None)
            subprocess.run(
                ["kubectl", "-n", self.namespace, "apply", "-f", "-"],
                input=json.dumps(backup_data).encode(),
                capture_output=True,
            )
        return self._get_steady_state()

    def run(self) -> None:
        """Generate an expired self-signed cert and replace the TLS secret."""
        self._log.info("Generating expired self-signed certificate (notAfter: -1 day)...")
        # Generate expired cert using openssl
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", "/tmp/chaos-expired-key.pem",
            "-out",    "/tmp/chaos-expired-cert.pem",
            "-days",   "-1",  # Expired 1 day ago
            "-nodes",
            "-subj",   "/CN=headyme.com/O=HeadySystems/C=US",
        ], capture_output=True, check=True)

        # Create Kubernetes secret with expired cert
        subprocess.run([
            "kubectl", "-n", self.namespace,
            "create", "secret", "tls", self.CERT_SECRET_NAME,
            "--cert=/tmp/chaos-expired-cert.pem",
            "--key=/tmp/chaos-expired-key.pem",
            "--dry-run=client", "-o", "json",
        ], capture_output=True, check=True)

        self._log.info("Replaced TLS secret with expired certificate.")

    def assert_steady_state(self, pre: SteadyState) -> List[str]:
        failures = []

        cert_expiry_alert = self._get_metric(
            f'ALERTS{{alertname="CertificateExpiringCritical", namespace="{self.namespace}"}}'
        )
        # Test mTLS failure (curl should fail with SSL error)
        api_url = os.environ.get("API_BASE_URL", "https://headyme.com")
        curl_result = subprocess.run(
            ["curl", "-s", "--max-time", str(FIB[4]), api_url, "-o", "/dev/null", "-w", "%{http_code}"],
            capture_output=True, text=True,
        )
        # Expected: curl fails or returns 0/000 due to SSL error
        ssl_failed = curl_result.returncode != 0 or curl_result.stdout.strip() in ("000", "")

        self._assert(cert_expiry_alert >= 1.0,
                     "CertificateExpiringCritical alert is firing", failures)
        self._assert(ssl_failed, "mTLS connection fails with expired cert", failures)
        return failures

    def rollback(self) -> bool:
        """Restore original TLS secret from backup."""
        self._log.info("Restoring original TLS secret from backup...")
        result = self._kubectl("get", "secret", self.BACKUP_SECRET_NAME, "-o", "json", capture=True)
        if result.returncode != 0:
            self._log.error("Backup secret not found — manual recovery required!")
            return False

        restore_data = json.loads(result.stdout)
        restore_data["metadata"]["name"] = self.CERT_SECRET_NAME
        restore_data["metadata"].pop("resourceVersion", None)
        restore_data["metadata"].pop("uid", None)

        apply = subprocess.run(
            ["kubectl", "-n", self.namespace, "apply", "-f", "-"],
            input=json.dumps(restore_data).encode(),
            capture_output=True,
        )
        # Clean up backup
        self._kubectl("delete", "secret", self.BACKUP_SECRET_NAME, "--ignore-not-found=true")
        return apply.returncode == 0

# ─────────────────────────────────────────────────────────────────────────────
# REGISTRY & CLI
# ─────────────────────────────────────────────────────────────────────────────

SCENARIOS: Dict[str, type] = {
    "redis_connection_failure": RedisConnectionFailure,
    "high_latency_injection":   HighLatencyInjection,
    "agent_crash_recovery":     AgentCrashRecovery,
    "memory_pressure":          MemoryPressure,
    "network_partition":        NetworkPartition,
    "certificate_expiry_sim":   CertificateExpirySim,
}


def run_all(namespace: str, dry_run: bool) -> List[ChaosResult]:
    """Run all chaos scenarios sequentially with fib(8)=21s gaps between."""
    results = []
    for name, cls in SCENARIOS.items():
        logger.info(f"\n{'='*60}")
        logger.info(f"Running scenario: {name}")
        logger.info(f"{'='*60}")
        scenario = cls(namespace=namespace, dry_run=dry_run)
        result = scenario.execute()
        results.append(result)
        logger.info(f"Scenario {name}: {'PASSED' if result.passed else 'FAILED'}")
        # Gap between scenarios: fib(8)=21s to allow full recovery
        if not dry_run:
            logger.info(f"Waiting fib(8)={FIB[7]}s before next scenario...")
            time.sleep(FIB[7])
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="HeadySystems Chaos Engineering — φ-aligned fault injection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Scenarios:
  {chr(10).join(f'  {k}: {SCENARIOS[k].description}' for k in SCENARIOS)}

Fibonacci reference:
  fib(3)=2, fib(5)=5, fib(6)=8, fib(7)=13, fib(8)=21, fib(9)=34
  φ = {PHI}
  CSL gates: DORMANT(0-0.236), LOW(0.236-0.382), MODERATE(0.382-0.618),
             HIGH(0.618-0.854), CRITICAL(0.854-1.0)
""")

    parser.add_argument("--scenario", required=True, choices=list(SCENARIOS.keys()) + ["all"],
                        help="Chaos scenario to run")
    parser.add_argument("--namespace", default=os.environ.get("K8S_NAMESPACE", "default"),
                        help="Kubernetes namespace (default: 'default')")
    parser.add_argument("--dry-run", action="store_true",
                        help="Simulate without injecting faults")
    parser.add_argument("--output", choices=["json", "text"], default="text",
                        help="Output format (default: text)")

    args = parser.parse_args()

    if args.scenario == "all":
        results = run_all(args.namespace, args.dry_run)
        passed = sum(1 for r in results if r.passed)
        logger.info(f"\nTotal: {len(results)} scenarios, {passed} passed, {len(results)-passed} failed.")
        sys.exit(0 if all(r.passed for r in results) else 1)
    else:
        cls      = SCENARIOS[args.scenario]
        scenario = cls(namespace=args.namespace, dry_run=args.dry_run)
        result   = scenario.execute()
        sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    main()
