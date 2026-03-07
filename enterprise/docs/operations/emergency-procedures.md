# Emergency Operations Procedures

**HeadySystems v3.2.2**  
**φ-revision:** 1.618  
**Classification:** INTERNAL — SRE/On-Call  
**Last Updated:** 2026-03-07  

---

## Emergency Severity Levels (CSL)

| CSL Level | Score | Description | Response Time |
|-----------|-------|-------------|---------------|
| CRITICAL | 0.854–1.0 | Total outage, data loss, security breach | Immediate |
| HIGH | 0.618–0.854 | Degraded service, partial outage | fib(5)=5 minutes |
| MODERATE | 0.382–0.618 | Performance degradation, non-critical errors | fib(7)=13 minutes |
| LOW | 0.236–0.382 | Minor issues, single-user impact | fib(9)=34 minutes |

---

## Emergency Contact Chain

1. On-call engineer (PagerDuty rotation)
2. Eric Headington (eric@headyconnection.org)
3. Platform Engineering team Slack: #heady-incidents

---

## Procedure 1: Service Outage

### Symptoms
- HTTP 5xx error rate > 61.8% (CSL HIGH = 1/φ)
- All health checks returning non-200
- User reports: "HeadyOS is down"

### Immediate Response (0–5 minutes)

```bash
# 1. Check service status
for service in heady-gateway heady-brain heady-mcp; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    $(gcloud run services describe $service --region=us-central1 --format='value(status.url)')/healthz)
  echo "$service: HTTP $STATUS"
done

# 2. Check recent deployments
gcloud run revisions list \
  --service=heady-gateway \
  --region=us-central1 \
  --limit=5 \
  --project=heady-production

# 3. Check error logs (last 5 minutes)
gcloud logging read \
  'resource.type="cloud_run_revision" AND severity>=ERROR' \
  --freshness=5m \
  --limit=50 \
  --project=heady-production | jq '.[].jsonPayload.msg'
```

### Diagnosis and Resolution

**If caused by a bad deploy:**
```bash
# Immediate rollback
PREV_REVISION=$(gcloud run revisions list \
  --service=heady-gateway \
  --region=us-central1 \
  --limit=2 \
  --format='value(name)' | tail -1)

gcloud run services update-traffic heady-gateway \
  --region=us-central1 \
  --to-revisions="$PREV_REVISION=100" \
  --project=heady-production

echo "✓ Rolled back to $PREV_REVISION"
```

**If caused by database connection exhaustion:**
```bash
# Check connection count
psql $DATABASE_URL -c "SELECT COUNT(*), state FROM pg_stat_activity GROUP BY state;"

# Restart PgBouncer pods
kubectl rollout restart deployment/pgbouncer -n heady-production

# Increase connection pool size temporarily
kubectl patch configmap pgbouncer-config -n heady-production \
  --patch '{"data":{"pool_size":"144"}}'  # fib(12)=144
```

**If caused by Redis failure:**
```bash
# Check Redis health
redis-cli -h $REDIS_HOST PING

# Failover to replica
gcloud redis instances failover heady-redis-primary \
  --region=us-central1 \
  --project=heady-production

echo "✓ Redis failover initiated"
```

**If multi-region outage — activate geo-failover:**
```bash
# Cloudflare: disable failing region's pool
curl -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/load_balancers/$LB_ID/pools/us-central1-pool" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"enabled": false}'

echo "✓ US-CENTRAL1 pool disabled — traffic routing to EU"
```

---

## Procedure 2: Data Corruption

### Symptoms
- Agent memory returning incorrect results
- User reports: "wrong data displayed"
- Integrity check failures in logs

### Immediate Response

```bash
# 1. Identify affected tables/records
psql $DATABASE_URL << 'EOF'
-- Check recent writes (last 21 minutes)
SELECT table_name, count(*), max(updated_at)
FROM information_schema.tables t
CROSS JOIN LATERAL (
  SELECT COUNT(*) FROM agents WHERE updated_at > NOW() - INTERVAL '21 minutes'
) x(count)
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY max(updated_at) DESC;
EOF

# 2. Enable read-only mode to prevent further writes
curl -X POST https://api.headyme.com/internal/maintenance/read-only \
  -H "X-Internal-Token: $INTERNAL_TOKEN"

echo "⚠ READ-ONLY MODE ACTIVATED — investigating corruption"
```

### Point-in-Time Recovery

```bash
# Identify last known good timestamp
# Use Cloud SQL PITR to restore to that point

RESTORE_TIME="2026-03-07T14:00:00Z"  # Adjust to last known good time

gcloud sql instances clone heady-primary heady-recovery \
  --point-in-time=$RESTORE_TIME \
  --project=heady-production

# Verify data integrity in recovery instance
psql "postgresql://heady:PASSWORD@/heady?host=/cloudsql/heady-production:us-central1:heady-recovery" \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM agents;"

echo "✓ Recovery instance available — verify before promoting"
```

### Recovery Promotion

Only after verification:
```bash
# Update connection string to point to recovery instance
gcloud secrets versions add heady-database-url \
  --data-file=<(echo -n "postgresql://heady:PASSWORD@/heady?host=/cloudsql/heady-production:us-central1:heady-recovery") \
  --project=heady-production

# Rolling restart all services to pick up new connection
for service in heady-brain heady-conductor heady-gateway; do
  gcloud run services update-traffic $service --to-latest \
    --region=us-central1 --project=heady-production
  sleep 8  # fib(6)=8s between restarts
done

echo "✓ Services pointed to recovery database"
```

---

## Procedure 3: Security Breach

### Symptoms
- Unauthorized API access detected
- Unusual agent invocation patterns
- Leaked credentials in logs/code
- Sentry security alert

### Immediate Response (0–2 minutes)

```bash
# 1. CRITICAL: Rotate all secrets immediately
./ops/scripts/rotate-all-secrets.sh

# 2. Revoke compromised API keys
psql $DATABASE_URL -c \
  "UPDATE api_keys SET revoked = true, revoked_at = now() WHERE id = '$COMPROMISED_KEY_ID';"

# 3. Enable emergency rate limiting
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -d '{"filter":{"expression":"(http.request.uri.path contains \"/api/\")"},"action":"js_challenge","priority":1}'

echo "⚠ SECURITY LOCKDOWN ACTIVE"
```

### Secret Rotation

```bash
# Rotate JWT secret (invalidates ALL sessions)
NEW_JWT=$(openssl rand -base64 89)
echo -n "$NEW_JWT" | gcloud secrets versions add heady-jwt-secret \
  --data-file=- --project=heady-production

# Rotate database password
NEW_DB_PASS=$(openssl rand -base64 55)  # fib(10)=55 chars
gcloud sql users set-password heady \
  --instance=heady-primary \
  --password="$NEW_DB_PASS" \
  --project=heady-production

# Update database URL secret
echo -n "postgresql://heady:$NEW_DB_PASS@/heady?host=/cloudsql/..." | \
  gcloud secrets versions add heady-database-url --data-file=- --project=heady-production

echo "✓ Secrets rotated"
```

### Audit Trail

```bash
# Pull security audit log
gcloud logging read \
  'logName="projects/heady-production/logs/cloudaudit.googleapis.com%2Factivity"' \
  --freshness=1h \
  --format=json \
  --project=heady-production | jq '.[] | {time:.timestamp, actor:.protoPayload.authenticationInfo.principalEmail, method:.protoPayload.methodName}'

# Pull heady-security audit log
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="heady-security" AND jsonPayload.event="auth"' \
  --freshness=24h \
  --project=heady-production
```

---

## Procedure 4: DDoS Attack

### Symptoms
- Error rate spike with consistent source patterns
- Cloudflare alerting: `DDoS attack detected`
- Request volume > φ³ × normal baseline

### Immediate Response

```bash
# 1. Enable Cloudflare Under Attack Mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/settings/security_level" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -d '{"value":"under_attack"}'

echo "⚠ UNDER ATTACK MODE ENABLED"

# 2. Block attacking IP ranges
ATTACK_IPS=(
  "1.2.3.0/24"
  "5.6.7.0/24"
)
for ip in "${ATTACK_IPS[@]}"; do
  curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/firewall/access_rules/rules" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -d "{\"mode\":\"block\",\"configuration\":{\"target\":\"ip_range\",\"value\":\"$ip\"}}"
  echo "Blocked: $ip"
done

# 3. Rate limit all unauthenticated traffic to fib(5)=5 req/10s
# (Already configured in cloudflare-config.js — verify it's active)
curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rate_limits" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result[].enabled'
```

### Scale Up Defenses

```bash
# Scale gateway to maximum capacity
gcloud run services update heady-gateway \
  --region=us-central1 \
  --min-instances=8 \
  --max-instances=34 \
  --project=heady-production

# Enable Cloud Armor WAF rule
gcloud compute security-policies rules create 1000 \
  --security-policy=heady-waf \
  --expression='evaluatePreconfiguredExpr("xss-stable")' \
  --action=deny-403

echo "✓ DDoS defenses active"
```

---

## Procedure 5: Credential Compromise

### Symptoms
- PagerDuty: leaked secret detected in logs
- GitHub: secret scanning alert
- Unexpected GCP resource creation

### Immediate Rotation Checklist

```bash
# Run full credential rotation
cat << 'ROTATE_SCRIPT'
#!/usr/bin/env bash
# Full credential rotation — run this for ANY credential compromise

SECRETS=(
  "heady-jwt-secret"
  "heady-database-url"
  "heady-openai-api-key"
  "heady-anthropic-api-key"
  "heady-stripe-secret-key"
  "heady-cloudflare-api-token"
)

for secret in "${SECRETS[@]}"; do
  echo "⚠ Rotating: $secret"
  # NOTE: Each requires manual new value — do NOT automate API key generation
  echo "  → Go to the provider dashboard and generate new key"
  echo "  → Then run: echo -n 'NEW_VALUE' | gcloud secrets versions add $secret --data-file=- --project=heady-production"
done

echo "After all secrets rotated:"
echo "  1. Restart all Cloud Run services"
echo "  2. Invalidate all user sessions (rotate JWT secret)"
echo "  3. Audit access logs for unauthorized access"
ROTATE_SCRIPT

# Rotate GCP service account key
gcloud iam service-accounts keys create /tmp/new-sa-key.json \
  --iam-account=heady-platform@heady-production.iam.gserviceaccount.com

# Update GitHub secret
gh secret set GCP_SA_KEY < <(base64 /tmp/new-sa-key.json)
rm /tmp/new-sa-key.json

# Revoke old key
OLD_KEY_ID="<old-key-id>"
gcloud iam service-accounts keys delete $OLD_KEY_ID \
  --iam-account=heady-platform@heady-production.iam.gserviceaccount.com \
  --project=heady-production
```

---

## Post-Incident Procedures

### Incident Report Template

After every CRITICAL or HIGH incident, file a post-mortem within fib(8)=21 days:

```markdown
## Incident Report: INC-{YYYYMMDD}-{SEQ}

**Date:** {date}  
**Severity:** {CSL level}  
**Duration:** {minutes}  
**Services affected:** {list}  
**Users affected:** {count}  

### Timeline
- HH:MM — First alert triggered
- HH:MM — On-call engineer paged
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Full recovery confirmed

### Root Cause

{Description}

### Impact

{Quantified user/revenue impact}

### Resolution

{What was done}

### Action Items

| Item | Owner | Due Date |
|------|-------|----------|
| {action} | {name} | {fib(7)=13 days} |

### φ Health Score Post-Incident: {CSL score}
```
