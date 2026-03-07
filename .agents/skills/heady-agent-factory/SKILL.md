---
name: heady-agent-factory
description: Use when the user wants to decompose a large objective into specialized sub-agents, temporary workers, or domain-focused task units with clear responsibilities, handoffs, and monitoring. Helpful for multi-agent orchestration, workload partitioning, runtime worker creation, and agent responsibility mapping.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Agent Factory

## When to Use This Skill

Use this skill when the user asks for:

- breaking a large task into specialist agents
- designing worker roles for a swarm or multi-agent system
- mapping responsibilities across AI services
- creating ephemeral task-specific agents
- defining agent handoffs and outputs

## Instructions

1. Rewrite the user request as a parent objective.
2. Split the objective into agent-sized workstreams.
3. For each proposed agent, define:
   - name
   - mission
   - inputs
   - outputs
   - dependencies
   - success criteria
4. Keep agents narrow. Prefer 3 to 7 clear roles rather than one oversized generalist.
5. Define the coordination layer:
   - who plans
   - who executes
   - who validates
   - who synthesizes
6. If runtime creation is requested, specify which roles are temporary and what triggers their creation.
7. Add resilience rules:
   - fallback owner if an agent fails
   - retry limits
   - escalation path
   - logging requirements
8. End with:
   - Agent Map
   - Handoff Contract
   - Recommended Execution Order

## Output Pattern

- Parent Objective
- Agent Roles
- Coordination Model
- Failure Handling
- Execution Sequence

## Example Prompts

- Turn this project into a swarm of specialist agents
- Design temporary workers for research, implementation, and validation
- Map the responsibilities for a multi-agent build pipeline

## Provenance

This skill is grounded in the public HeadyMe repository descriptions for [heady-pre-production-9f2f0642](https://github.com/HeadyMe/heady-pre-production-9f2f0642), which references a "bee-factory" and "HeadyBees" agent decomposition model, and in the broader HeadyMe profile at [github.com/HeadyMe](https://github.com/HeadyMe).
