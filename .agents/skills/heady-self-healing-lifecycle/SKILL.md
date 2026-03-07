---
name: heady-self-healing-lifecycle
description: Use when the user wants a lifecycle for detecting failures, quarantining bad components, attesting system state, respawning services, and preventing repeated breakdowns across agent, cloud, or tool-based systems. Helpful for reliability engineering, fault isolation, orchestration recovery, and self-healing service design.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Self-Healing Lifecycle

## When to Use This Skill

Use this skill when the user asks for:

- self-healing architecture
- quarantine and respawn patterns
- failure isolation for agents or services
- recovery automation design
- reliability playbooks for orchestration systems

## Instructions

1. Define the units that can fail:
   - service
   - worker
   - agent
   - tool connector
   - provider route
2. For each unit, define the lifecycle states:
   - healthy
   - suspect
   - quarantined
   - recovering
   - restored
3. Specify the signals that move a component between states.
4. Require attestation before restoration when trust or integrity matters.
5. Keep quarantine reversible and logged.
6. Define when to:
   - retry
   - respawn
   - roll back
   - escalate to human review
7. Add prevention measures for recurring incidents:
   - circuit breakers
   - cooldowns
   - drift checks
   - canary validation
8. End with:
   - Lifecycle Map
   - Recovery Rules
   - Prevention Controls

## Output Pattern

- Failure Units
- State Machine
- Transition Signals
- Recovery Actions
- Hardening Plan

## Example Prompts

- Give my agent platform a quarantine-and-recovery lifecycle
- Design self-healing behavior for failing services and tools
- Turn this reliability problem into a recoverable state machine

## Provenance

This skill is grounded in the public HeadySystems language describing "Self-Healing: Attestation, quarantine, respawn" on [headysystems.com](https://headysystems.com/) and related public reliability themes across the Heady ecosystem.
