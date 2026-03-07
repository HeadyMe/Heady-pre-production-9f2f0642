---
name: heady-agent-orchestration
description: Use when the user wants a latent OS to decompose work into specialized agents, define temporary workers, create a planner-executor-validator structure, or coordinate agent handoffs inside a dynamic liquid architecture. Helpful for multi-agent task design, runtime worker creation, swarm coordination, and responsibility mapping.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Agent Orchestration

## When to Use This Skill

Use this skill when the user asks for:

- multi-agent system design
- runtime worker creation
- task decomposition into specialist agents
- planner, executor, and validator roles
- swarm coordination or handoff design
- latent OS operating structure

## Instructions

1. Rewrite the user request as a parent objective.
2. Split the work into a small number of specialized agent tracks.
3. For each agent, define:
   - role name
   - mission
   - inputs
   - outputs
   - dependencies
   - success test
4. Prefer a control structure with explicit planning, execution, verification, and synthesis.
5. Mark which agents are persistent versus ephemeral.
6. Define handoff contracts so outputs are easy for downstream agents to consume.
7. Add resilience rules:
   - fallback owner
   - retry limit
   - escalation path
   - monitoring signals
8. If the user wants dynamic liquid architecture, specify when load should shift between agents, when agents should be spawned, and when they should be retired.
9. End with:
   - Agent Map
   - Handoff Rules
   - Runtime Orchestration Policy

## Output Pattern

- Parent Objective
- Agent Roles
- Control Plane
- Handoff Contracts
- Runtime Policy

## Example Prompts

- Turn this project into a clean latent OS swarm
- Design specialist agents for research, build, and validation
- Create a dynamic worker plan for this orchestration problem

## Provenance

This skill is based on public HeadyMe references to a "bee-factory" and "HeadyBees" agent decomposition model in [HeadyMe/heady-pre-production-9f2f0642](https://github.com/HeadyMe/heady-pre-production-9f2f0642) and the broader Heady public profile at [GitHub](https://github.com/HeadyMe).
