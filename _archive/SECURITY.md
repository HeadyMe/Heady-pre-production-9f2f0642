# Security Policy

## Supported Versions

The Heady Project actively supports security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| v1.x.x  | :white_check_mark: |
| v0.x.x  | :x:                |

## Reporting a Vulnerability

Security is a core tenant of the Heady ecosystem. If you discover a vulnerability, **do not open a public issue.**

Please email the security team at `security@headysystems.com` with a detailed report. We aim to respond within 24 hours.

### Bug Bounty

We are committed to fair compensation for responsible disclosure. Vulnerabilities affecting the core AI orchestration layer (e.g., prompt injection leading to arbitrary execution, bypass of human-on-the-loop controls) are prioritized.

### Threat Models

- P1: Arbitrary remote code/workflow execution via Heady Conductor.
- P1: Exposure of API keys, telemetry endpoints, or Redis datastore credentials.
- P2: Exfiltration of context boundary or memory graph (`headybuddy.org` context leakage).
- P3: Denial of Service, causing failure loops in AI agents.
