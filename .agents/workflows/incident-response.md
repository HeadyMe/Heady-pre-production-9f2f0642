---
description: Incident response — triage, diagnose, resolve, and postmortem any system incident
---

# 🚨 Incident Response Workflow

> Triggered when any service goes down or error rate exceeds 25%.

## Steps

1. **Triage** — Classify severity
   - **SEV1**: All domains down or data loss risk → immediate action
   - **SEV2**: Single domain down or 50%+ error rate → within 15 min
   - **SEV3**: Degraded performance or non-critical error → within 1 hour

2. **Diagnose**
   - Run `/health-check` workflow
   - Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision" --limit=50`
   - Check Cloudflare Worker logs: `npx wrangler tail heady-edge-proxy`
   - Check `self-awareness.js` telemetry ring buffer for recent errors

3. **Contain** — If spreading:
   - Enable circuit breakers for affected services
   - Fall back to edge-only serving (liquid architecture)
   - Redirect traffic via Cloudflare DNS rules

4. **Resolve**
   - Apply fix and commit with `fix:` prefix
   - Push to main → CI/CD deploys
   - Run `/deployment-verification` workflow

5. **Postmortem** — Within 24 hours:
   - Document timeline in `docs/sre/incidents/`
   - Identify root cause
   - Add missing automation to prevent recurrence (Pillar 10)
   - Update `concepts-index.yaml` if new pattern discovered
