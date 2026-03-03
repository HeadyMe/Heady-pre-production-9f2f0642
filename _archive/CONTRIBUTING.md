# Contributing to the Heady Project

Welcome to the Heady Project – the foundation for hyperautomated orchestration! We are thrilled to have you contribute.

This document outlines our process to help potential contributors understand how to interface with Heady subsystems.

## Pre-requisites

1. Node.js environment (latest stable) for core execution scripts
2. Docker / Helm installed for validating local container clusters.
3. Access configured to `heady_cache` for local execution testing of the AI models.

## Architectural Changes

All PRs must include:

- A `docs/` module modification if extending a feature.
- Explicit verification via the `.github/workflows/heady-ci.yml` matrix.
- `Arena Merge` / `HeadyBattle` consensus output proving effectiveness over the prior baseline execution.

### Security First

- Do not commit your credentials to any `.env` files. Ensure you have no tokens left unattended. Use `./bin/scrub_config` before opening your PR.
- Do not force push to MAIN.

## Submitting Pull Requests

- Format your PR titles as: `feat(conductor): Add LLM telemetry`
- All PRs are run against CodeQL SAST scanning.
