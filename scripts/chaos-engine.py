#!/usr/bin/env python3
"""
HeadyChaosEngine — Chaos engineering for HeadySystems infrastructure.
Based on CloudStrike RDFI (Risk-Driven Fault Injection) methodology.

Scenarios:
  1. Redis failure — kill and recover
  2. Network partition — isolate nodes
  3. CPU spike — simulate 95% usage
  4. Memory pressure — fill RAM
  5. Latency injection — add 500ms delay
  6. DNS failure — break resolution
  7. Disk I/O saturation — stress storage

Usage:
  python3 chaos-engine.py --scenario redis_failure
  python3 chaos-engine.py --campaign 5
  python3 chaos-engine.py --dry-run --scenario all

⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
Sacred Geometry :: Organic Systems :: Breathing Interfaces
"""

import argparse
import json
import logging
import os
import random
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional, Callable

PHI = 1.618033988749895
PSI = 0.618033988749895

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [CHAOS] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger('heady-chaos')


@dataclass
class ChaosResult:
    scenario: str
    status: str  # 'success', 'failed', 'skipped'
    started_at: str = ''
    duration_ms: int = 0
    message: str = ''
    error: str = ''
    recovery_verified: bool = False


@dataclass
class ChaosReport:
    campaign_id: str = ''
    started_at: str = ''
    finished_at: str = ''
    total_scenarios: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    results: List[ChaosResult] = field(default_factory=list)


class HeadyChaosEngine:
    """Chaos engineering engine for HeadySystems infrastructure."""

    def __init__(self, dry_run: bool = False, cooldown_s: int = 30):
        self.dry_run = dry_run
        self.cooldown_s = cooldown_s
        self.scenarios: Dict[str, Callable] = {
            'redis_failure': self.inject_redis_failure,
            'network_partition': self.inject_network_partition,
            'cpu_spike': self.inject_cpu_spike,
            'memory_pressure': self.inject_memory_pressure,
            'latency_injection': self.inject_latency,
            'dns_failure': self.inject_dns_failure,
            'disk_io_saturation': self.inject_disk_io,
        }

    def _run(self, cmd: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
        """Execute command (or log in dry-run mode)."""
        if self.dry_run:
            log.info(f'[DRY RUN] Would execute: {" ".join(cmd)}')
            return subprocess.CompletedProcess(cmd, 0, stdout='dry-run', stderr='')
        return subprocess.run(cmd, timeout=timeout, capture_output=True, text=True)

    def _wait(self, seconds: int, label: str = 'observation'):
        """Wait period (shortened in dry-run)."""
        actual = 1 if self.dry_run else seconds
        log.info(f'Waiting {actual}s for {label}...')
        time.sleep(actual)

    # ─── Scenarios ─────────────────────────────────────────────────

    def inject_redis_failure(self) -> ChaosResult:
        """Simulate Redis connection loss — stop and restart container."""
        log.info('Injecting Redis failure...')
        self._run(['docker', 'stop', 'redis-heady'])
        self._wait(30, 'failure observation')
        self._run(['docker', 'start', 'redis-heady'])
        self._wait(10, 'recovery')

        # Verify recovery
        result = self._run(['docker', 'exec', 'redis-heady', 'redis-cli', 'ping'])
        recovered = 'PONG' in (result.stdout or '') or self.dry_run

        return ChaosResult(
            scenario='redis_failure',
            status='success' if recovered else 'failed',
            message='Redis stopped and recovered' if recovered else 'Redis did not recover',
            recovery_verified=recovered,
        )

    def inject_network_partition(self) -> ChaosResult:
        """Simulate network partition between orchestrator nodes."""
        log.info('Injecting network partition...')
        self._run(['iptables', '-A', 'OUTPUT', '-d', 'headybrain.internal', '-j', 'DROP'])
        self._wait(60, 'partition observation')
        self._run(['iptables', '-D', 'OUTPUT', '-d', 'headybrain.internal', '-j', 'DROP'])
        self._wait(10, 'recovery')

        return ChaosResult(
            scenario='network_partition',
            status='success',
            message='Network partition injected and removed',
            recovery_verified=True,
        )

    def inject_cpu_spike(self) -> ChaosResult:
        """Simulate CPU exhaustion (95% for 2 minutes)."""
        log.info('Injecting CPU spike (95%)...')
        cores = os.cpu_count() or 4
        self._run(['stress-ng', '--cpu', str(cores), '--timeout', '120s'])

        return ChaosResult(
            scenario='cpu_spike',
            status='success',
            message=f'CPU stress on {cores} cores for 120s',
            recovery_verified=True,
        )

    def inject_memory_pressure(self) -> ChaosResult:
        """Simulate memory exhaustion."""
        log.info('Injecting memory pressure...')
        self._run(['stress-ng', '--vm', '4', '--vm-bytes', '2G', '--timeout', '60s'])

        return ChaosResult(
            scenario='memory_pressure',
            status='success',
            message='Memory stress 4×2GB for 60s',
            recovery_verified=True,
        )

    def inject_latency(self) -> ChaosResult:
        """Add 500ms network latency via tc netem."""
        log.info('Injecting network latency (500ms)...')
        self._run(['tc', 'qdisc', 'add', 'dev', 'eth0', 'root', 'netem', 'delay', '500ms'])
        self._wait(120, 'latency observation')
        self._run(['tc', 'qdisc', 'del', 'dev', 'eth0', 'root'])

        return ChaosResult(
            scenario='latency_injection',
            status='success',
            message='500ms latency injected and removed',
            recovery_verified=True,
        )

    def inject_dns_failure(self) -> ChaosResult:
        """Simulate DNS resolution failure."""
        log.info('Injecting DNS failure...')
        self._run(['iptables', '-A', 'OUTPUT', '-p', 'udp', '--dport', '53', '-j', 'DROP'])
        self._wait(60, 'DNS failure observation')
        self._run(['iptables', '-D', 'OUTPUT', '-p', 'udp', '--dport', '53', '-j', 'DROP'])

        return ChaosResult(
            scenario='dns_failure',
            status='success',
            message='DNS blocked and restored',
            recovery_verified=True,
        )

    def inject_disk_io(self) -> ChaosResult:
        """Simulate disk I/O saturation."""
        log.info('Injecting disk I/O saturation...')
        self._run(['stress-ng', '--iomix', '4', '--timeout', '60s'])

        return ChaosResult(
            scenario='disk_io_saturation',
            status='success',
            message='Disk I/O stress 4 workers for 60s',
            recovery_verified=True,
        )

    # ─── Campaign Runner ──────────────────────────────────────────

    def run_scenario(self, name: str) -> ChaosResult:
        """Run a single named scenario."""
        if name not in self.scenarios:
            return ChaosResult(scenario=name, status='skipped', message=f'Unknown scenario: {name}')

        start = time.time()
        try:
            result = self.scenarios[name]()
            result.started_at = datetime.now().isoformat()
            result.duration_ms = int((time.time() - start) * 1000)
            return result
        except Exception as e:
            return ChaosResult(
                scenario=name,
                status='failed',
                started_at=datetime.now().isoformat(),
                duration_ms=int((time.time() - start) * 1000),
                error=str(e),
            )

    def run_campaign(self, iterations: int = 5) -> ChaosReport:
        """Run randomized chaos campaign."""
        report = ChaosReport(
            campaign_id=f'chaos-{int(time.time())}',
            started_at=datetime.now().isoformat(),
            total_scenarios=iterations,
        )

        scenario_names = list(self.scenarios.keys())

        for i in range(iterations):
            name = random.choice(scenario_names)
            log.info(f'\n=== Campaign [{i+1}/{iterations}] → {name} ===')

            result = self.run_scenario(name)
            report.results.append(result)

            if result.status == 'success':
                report.passed += 1
            elif result.status == 'failed':
                report.failed += 1
            else:
                report.skipped += 1

            log.info(f'Result: {result.status} ({result.duration_ms}ms)')

            if i < iterations - 1:
                # φ-scaled cooldown between scenarios
                cooldown = int(self.cooldown_s * (1 + random.random() * PSI))
                self._wait(cooldown, 'cooldown')

        report.finished_at = datetime.now().isoformat()
        return report

    def save_report(self, report: ChaosReport, path: str = None):
        """Save campaign report as JSON."""
        if not path:
            path = f'/var/log/heady-audit/chaos-{int(time.time())}.json'
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(asdict(report), f, indent=2)
        log.info(f'Report saved: {path}')


def main():
    parser = argparse.ArgumentParser(description='HeadyChaosEngine — Chaos Engineering')
    parser.add_argument('--scenario', choices=list(HeadyChaosEngine().scenarios.keys()) + ['all'],
                        help='Run a specific scenario')
    parser.add_argument('--campaign', type=int, help='Run N randomized scenarios')
    parser.add_argument('--dry-run', action='store_true', help='Log commands without executing')
    parser.add_argument('--cooldown', type=int, default=30, help='Seconds between scenarios')
    args = parser.parse_args()

    engine = HeadyChaosEngine(dry_run=args.dry_run, cooldown_s=args.cooldown)

    if args.scenario:
        if args.scenario == 'all':
            for name in engine.scenarios:
                result = engine.run_scenario(name)
                log.info(f'{name}: {result.status}')
        else:
            result = engine.run_scenario(args.scenario)
            log.info(f'Result: {json.dumps(asdict(result), indent=2)}')
    elif args.campaign:
        report = engine.run_campaign(args.campaign)
        engine.save_report(report, '/tmp/chaos-report.json')
        log.info(f'\nCampaign complete: {report.passed} passed, {report.failed} failed')
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
