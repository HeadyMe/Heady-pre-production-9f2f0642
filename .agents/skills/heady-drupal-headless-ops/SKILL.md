---
name: heady-drupal-headless-ops
description: Set up, validate, and operate a headless Drupal deployment with container networking, JSON:API enablement, custom module activation, and endpoint verification. Use when the user mentions Drupal 11, headless CMS, JSON:API, custom module deployment, or containerized CMS setup.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Drupal Headless Ops

## When to Use This Skill

Use this skill when the user asks for:

- Drupal 11 setup automation
- headless CMS deployment
- JSON:API enablement
- custom module rollout in containers
- verification of CMS health and API endpoints

## Core Pattern

The source pattern is a shell-driven container setup that creates a shared Docker network, writes environment-specific Drupal settings, deploys custom modules, performs site install, enables JSON:API plus custom modules, clears cache, and verifies API endpoints ([setup-heady-drupal.sh](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/configs/drupal/setup-heady-drupal.sh)).

## Instructions

1. Validate the runtime first.
   - Drupal container exists
   - database container exists
   - network assumptions are explicit
   - secrets are not hardcoded in the final production approach

2. Build the network bridge.
   - Ensure Drupal and database are on a shared network.
   - Resolve the database host in a repeatable way.

3. Render settings from variables, not static secrets.
   - database host
   - database name
   - user
   - password
   - salts and trusted hosts

4. Deploy custom modules predictably.
   - copy or mount them into the custom module directory
   - verify module presence before enablement

5. Install Drupal non-interactively.
   - supply DB connection
   - set site name and admin account
   - capture logs for failure analysis

6. Enable the headless surface.
   - JSON:API
   - serialization and related dependencies
   - custom Heady modules

7. Clear caches and verify endpoints.
   - CMS login
   - JSON:API
   - custom config endpoint
   - health endpoint

8. Harden before production.
   - remove hardcoded passwords from scripts
   - move secrets to a secret store
   - restrict trusted hosts
   - define backup and rollback steps for module changes

## Output Pattern

Provide:

- Runtime assumptions
- Setup sequence
- Variables and secret inputs
- Verification checklist
- Production hardening notes

## Example Prompts

- Automate a Drupal 11 headless install with JSON:API
- Debug our containerized Drupal setup script
- Turn this local Drupal bootstrap into a production-safe operator runbook
