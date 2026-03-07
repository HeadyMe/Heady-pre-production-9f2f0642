# Day 2 Operations Guide

**HeadySystems v3.2.2**  
**φ-revision:** 1.618  
**Audience:** SRE, on-call engineers  

---

## Overview

Day 2 operations cover the ongoing work after initial deployment: scaling, observability, maintenance, and performance tuning. All numeric thresholds use φ-derived CSL levels.

---

## Daily Operations Checklist

Run this checklist every morning:

```bash
# Quick health check
./ops/scripts/daily-health-check.sh

# Check error rates
gcloud monitoring read \
  'metric.type="run.googleapis.com/request/count"' \
  --filter='metric.labels.response_code_class="5xx"' \
  --freshness=24h \
  --project=heady-production

# Check CSL pressure levels
curl -s https://api.headyme.com/internal/metrics | jq '.pressure'
```

---

## Scaling Operations

### Manual Scale-Up

For planned events or anticipated traffic spikes:

```bash
SERVICE="heady-gateway"
REGION="us-central1"

# Increase minimum instances before peak traffic
gcloud run services update $SERVICE \
  --region=$REGION \
  --min-instances=8 \   # fib(6)=8 for elevated load
  --max-instances=34 \  # fib(9)=34 maximum
  --project=heady-production

echo "✓ Scale-up configured: $SERVICE"
```

### Review HPA Status

```bash
kubectl get hpa -n heady-production -o wide

# Check current replica counts vs. limits
for service in heady-brain heady-gateway heady-mcp; do
  echo "=== $service ==="
  kubectl describe hpa ${service}-hpa -n heady-production | grep -E "(Replicas|Metrics)"
done
```

### Queue Pressure

If queue depth exceeds fib(10)=55 (CRITICAL CSL):

```bash
# Check Redis queue depth
redis-cli -h $REDIS_HOST LLEN heady:task:queue:high
redis-cli -h $REDIS_HOST LLEN heady:task:queue:normal

# If critical: temporarily scale up orchestration workers
gcloud run services update heady-orchestration \
  --region=$REGION \
  --min-instances=5 \
  --project=heady-production
```

---

## Log Management

### Structured Log Query (Cloud Logging)

```bash
# Last 100 errors from heady-brain
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="heady-brain" AND severity>=ERROR' \
  --limit=100 \
  --format=json \
  --project=heady-production | jq '.[] | {time:.timestamp, message:.jsonPayload.msg, error:.jsonPayload.error}'

# CSL CRITICAL events (score ≥ 0.854)
gcloud logging read \
  'jsonPayload.cslLevel="CRITICAL" AND resource.type="cloud_run_revision"' \
  --freshness=1h \
  --project=heady-production
```

### Log Retention

Log retention is configured at fib(14)=377 days for production logs, fib(7)=13 days for debug logs:

```bash
# Verify retention config
gcloud logging buckets describe _Default \
  --location=global \
  --project=heady-production | grep retentionDays

# Update if needed
gcloud logging buckets update _Default \
  --location=global \
  --retention-days=377 \
  --project=heady-production
```

---

## Backup Verification

### Verify Database Backups

```bash
# List recent Cloud SQL backups
gcloud sql backups list \
  --instance=heady-primary \
  --limit=8 \
  --project=heady-production

# Verify latest backup is < fib(9)=34 hours old
BACKUP_TIME=$(gcloud sql backups describe BACKUP_ID \
  --instance=heady-primary \
  --format='value(endTime)' \
  --project=heady-production)

echo "Latest backup: $BACKUP_TIME"
```

### Test Restore (Weekly)

```bash
# Create a test Cloud SQL instance from latest backup
gcloud sql instances clone heady-primary heady-restore-test \
  --project=heady-production

# Verify data integrity
psql "postgresql://heady:PASSWORD@/heady?host=/cloudsql/..." \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM agents;"

# Delete test instance
gcloud sql instances delete heady-restore-test --project=heady-production

echo "✓ Backup restore test complete"
```

---

## Security Patching

### Dependency Vulnerability Scan

```bash
# Run npm audit across all packages
pnpm audit --audit-level=moderate

# Check for known CVEs in container images
gcloud artifacts docker images list \
  gcr.io/heady-production \
  --include-tags \
  --project=heady-production

# Container scanning results
gcloud container images list-tags gcr.io/heady-production/heady-brain \
  --filter="tags:latest" \
  --format=json | jq '.[].vulnerabilities'
```

### Security Patching SLA

| Severity | Max time to patch |
|----------|------------------|
| Critical (CVSS ≥ 9.0) | fib(5)=5 days |
| High (CVSS 7.0–8.9) | fib(7)=13 days |
| Medium (CVSS 4.0–6.9) | fib(9)=34 days |
| Low (CVSS < 4.0) | fib(11)=89 days |

### OS Patching

Cloud Run handles OS patching automatically on container restarts. Trigger a rolling restart to apply latest patches:

```bash
for service in heady-brain heady-gateway heady-mcp heady-security; do
  gcloud run services update-traffic $service \
    --to-latest \
    --region=us-central1 \
    --project=heady-production
  echo "✓ Rolling restart triggered: $service"
  sleep 8  # fib(6)=8s between restarts to avoid thundering herd
done
```

---

## Dependency Updates

### Monthly Update Cadence

```bash
# Check outdated dependencies
pnpm outdated --recursive

# Update all minor/patch versions
pnpm update --recursive --latest

# Run full test suite
pnpm test

# Review changelogs for any breaking changes
pnpm dlx changelogen
```

### Node.js Runtime Updates

Cloud Run uses the container's Node.js version. Update by:
1. Changing `FROM node:20-alpine` in Dockerfile(s)
2. Testing in staging
3. Deploying via blue-green deploy

---

## Performance Tuning

### Identify Slow Endpoints

```bash
# P99 latency by endpoint (last 24h)
gcloud monitoring read \
  'metric.type="run.googleapis.com/request/latencies"' \
  --aggregation.alignmentPeriod=3600s \
  --aggregation.crossSeriesReducer=REDUCE_PERCENTILE_99 \
  --freshness=24h \
  --project=heady-production | jq '.timeSeries[].metricKind'
```

### Memory Optimization

If heap usage crosses CSL HIGH (0.618):

```bash
# Capture heap snapshot manually
curl -X POST https://api.headyme.com/internal/debug/heap-snapshot \
  -H "X-Internal-Token: $INTERNAL_TOKEN"

# Download snapshot
gsutil cp gs://heady-debug/heap-$(date +%Y%m%d).heapsnapshot .
# Open in Chrome DevTools → Memory tab
```

### Event Loop Lag

If event loop lag exceeds fib(8)=21ms (CRITICAL threshold):

```bash
# Check current event loop metrics
curl -s https://api.headyme.com/internal/metrics | \
  jq '.eventLoop | {p99: .p99Ms, max: .maxMs, alertThreshold: 21}'

# If consistently > 21ms: check for blocking I/O
# Common causes: synchronous Redis operations, large JSON serialization, unoptimized DB queries
```

---

## Infrastructure Cost Review

### Monthly Cost Audit

```bash
# Export Cloud billing to BigQuery and query
bq query --use_legacy_sql=false '
  SELECT service.description, SUM(cost) as total_cost
  FROM `heady-production.billing.gcp_billing_export_v1_*`
  WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 13
'

# Target: Cloud Run costs < 61.8% of total infrastructure spend (1/φ)
```

---

## On-Call Runbooks Quick Reference

| Alert | Runbook |
|-------|---------|
| `HeadyHighErrorRate` | Increase min-instances, check DB connections, review recent deploys |
| `HeadyHighLatency` | Check event loop lag, query slow query log |
| `HeadyQueueBackpressure` | Scale orchestration workers, check dead letter queue |
| `HeadyHighMemory` | Trigger heap snapshot, restart if > 85.4% (CSL CRITICAL) |
| `HeadyCDNPurgeFailure` | Manual CF purge via dashboard, check API token expiry |

Full runbooks: `docs/operations/emergency-procedures.md`
