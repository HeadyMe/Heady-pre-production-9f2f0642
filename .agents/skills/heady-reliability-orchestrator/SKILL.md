---
name: heady-reliability-orchestrator
description: Use when the user wants latent OS reliability, self-healing service behavior, health checks, drift detection, quarantine and respawn logic, or failure recovery across agents, services, tools, and cloud layers. Helpful for service reliability, fault isolation, recovery playbooks, and dynamic operations in liquid architectures.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Reliability Orchestrator

## When to Use This Skill

Use this skill when the user asks for:

- service health operations
- self-healing lifecycle design
- drift detection and correction
- quarantine and respawn logic
- reliability playbooks for agents or cloud services
- fault handling in a liquid architecture

## Instructions

1. Define the failure units clearly:
   - service
   - worker
   - agent
   - tool connection
   - provider route
2. Classify each unit by current state:
   - healthy
   - degraded
   - suspect
   - quarantined
   - recovering
3. Identify the signals that matter most:
   - latency spikes
   - increased error rate
   - configuration drift
   - missing heartbeats
   - dependency failures
4. Build a recovery policy in order:
   - retry
   - isolate
   - quarantine
   - respawn
   - rollback
   - escalate
5. If trust matters, require attestation before a recovered component is marked healthy.
6. Create a triage table with:
   - component
   - symptom
   - likely cause
   - verification step
   - fastest safe fix
7. Add prevention controls:
   - circuit breakers
   - cooldown windows
   - canary checks
   - deploy validation
   - recurring incident review
8. End with:
   - Reliability State Map
   - Recovery Rules
   - Prevention Controls

## Output Pattern

- Current State
- Failure Units
- Signal Map
- Recovery Logic
- Prevention Plan

## Example Prompts

- Design self-healing behavior for my latent OS services
- Build a quarantine-and-respawn lifecycle for failing agents
- Diagnose drift and recovery rules in my orchestration stack

## Provenance

This skill is based on public HeadySystems language describing "Self-Healing: Attestation, quarantine, respawn" and a "6-layer zero-trust mesh" at [HeadySystems](https://headysystems.com/), together with public service-health patterns visible on [headyme.com](https://headyme.com/).
