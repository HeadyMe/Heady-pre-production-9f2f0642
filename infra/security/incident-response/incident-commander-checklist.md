# HeadySystems — Incident Commander Checklist

**Use:** Print or display this checklist at the start of every incident.  
**Version:** 3.2.2  
**Times:** All φ-scaled (P1=5min, P2=8min, P3=13min, P4=21min initial response)

---

## 🟥 PHASE 1: DETECTION & INITIAL RESPONSE

**Target: Complete within P-level response time after alert/report**

### Immediate (within fib(5)=5 minutes of notification)

- [ ] **Acknowledge** the PagerDuty/Slack alert — clear it or silence it
- [ ] **Assess urgency** — is this P1/P2/P3/P4? (Use criteria in incident-response-plan.md §2)
- [ ] **Assign yourself as IC** — announce in #incident-response: `IC: @[your handle]`
- [ ] **Open the war room:**
  - [ ] Create/activate #incident-war-room-[INC-NNNNN] Slack channel
  - [ ] Start Zoom bridge: [default incident bridge link]
  - [ ] Invite TL, Security Analyst, Communications Lead
- [ ] **Create incident ticket:** `INC-YYYY-NNNNN` in tracking system
- [ ] **Start timeline doc** — record UTC timestamps for all actions
- [ ] **For P1/P2:** Page Technical Lead immediately via PagerDuty

---

## 🟠 PHASE 2: SCOPE & SEVERITY CONFIRMATION

**Target: Within 2× P-level response time**

### Determine Impact Scope

- [ ] Which of the 21 microservices are affected?
  - heady-brain / heady-conductor / heady-mcp / heady-web / heady-guard?
  - heady-vector / heady-hive / heady-chain / heady-health?
  - Other: _______________
- [ ] Which of the 9 domains are down/degraded?
  - headyme.com / headyos.com / headyconnection.com/org?
  - heady.exchange / heady.investments / headysystems.com / headyai.com?
- [ ] Is user data potentially exposed? → If YES: notify Legal immediately
- [ ] Is the attack **ongoing** (active threat actor) or **past** (already happened)?
- [ ] Any signs of lateral movement or persistence mechanisms?

### Confirm Severity

- [ ] P1: Complete outage OR active breach OR data exfiltration → PAGE ERIC NOW
- [ ] P2: Significant degradation OR exploited vulnerability → Page Eric within 8 min
- [ ] P3: Suspected breach OR major service degradation → Notify Eric via Slack
- [ ] P4: Minor anomaly OR low-severity vulnerability → Ticket + daily summary

### Evidence Preservation (DO BEFORE RESTARTING ANYTHING)

- [ ] **DO NOT restart** affected pods/services yet
- [ ] Capture pod logs: `kubectl logs -n [ns] [pod] --previous > /tmp/forensics-[pod].log`
- [ ] Snapshot Prometheus metrics (screenshot key dashboards NOW)
- [ ] Export relevant OTel traces from Jaeger/Tempo for the incident window
- [ ] Archive to forensic GCS bucket: `gs://heady-forensics-[YYYY]-[INC-ID]/`
- [ ] Record all active API tokens and sessions for affected services

---

## 🟡 PHASE 3: CONTAINMENT

**Target: P1 = fib(7)=13 min, P2 = fib(8)=21 min, P3 = fib(9)=34 min from detection**

### Immediate Containment Actions (choose applicable)

- [ ] **Intrusion/RCE:**
  - [ ] Kill compromised pod: `kubectl delete pod [pod] -n [ns] --force`
  - [ ] Apply blocking NetworkPolicy to isolate service
  - [ ] Revoke all API keys associated with compromised service
- [ ] **Data exfiltration:**
  - [ ] Revoke ALL active API keys: `[key-management script]`
  - [ ] Rotate JWT secret (triggers all session invalidation): `[rotation script]`
  - [ ] Apply egress NetworkPolicy: `security/network/egress-filtering.yaml`
- [ ] **Credential compromise:**
  - [ ] Revoke specific credential immediately
  - [ ] Audit all recent actions by compromised credential (last fib(9)=34 hours)
  - [ ] Rotate within fib(3)=2 hours
- [ ] **MCP tool injection:**
  - [ ] Disable heady-mcp: `kubectl scale deployment/heady-mcp --replicas=0 -n [ns]`
  - [ ] Review audit chain for injected tool calls: `heady_audit_chain_broken_total`
- [ ] **Prompt injection:**
  - [ ] Block affected user session(s)
  - [ ] Disable affected agent(s): `[hive agent-kill command]`
  - [ ] Audit last fib(7)=13 agent responses from affected sessions
- [ ] **DDoS:**
  - [ ] Activate Cloudflare "Under Attack Mode" for affected domain(s)
  - [ ] Apply rate limit: 1 req/s per IP via WAF (see `security/network/waf-rules.yaml`)
  - [ ] Verify rate limiter in heady-guard is active

### Communication — First Status Update

- [ ] Post to #incident-response:
  ```
  🔴 INC-[ID]: [TITLE]
  Severity: P[1/2/3/4]
  Status: INVESTIGATING
  Containment: [Initiated/Not yet]
  Next update: [TIME UTC]
  ```
- [ ] Update status.headysystems.com (if user-visible impact):
  - [ ] Use template from `observability/statuspage/incident-templates.md`
  - [ ] Status: INVESTIGATING

---

## 🔵 PHASE 4: INVESTIGATION & ROOT CAUSE

### Technical Investigation

- [ ] Pull Prometheus metrics for incident window (Grafana: system-overview dashboard)
- [ ] Check audit chain integrity: `heady_audit_chain_broken_total`
- [ ] Review OTel traces for the incident-correlated request IDs
- [ ] Check rate limiter logs for unusual patterns
- [ ] Review input validation failure logs (`heady_input_validation_failures_total`)
- [ ] Examine vector space phi_drift for poisoning indicators
- [ ] CSL gate distribution — any sudden shift to CRITICAL?

### Root Cause Identification Checklist

- [ ] Entry point identified? (Which endpoint/service/user?)
- [ ] Exploitation technique confirmed? (SQLi/XSS/SSRF/injection/etc.)
- [ ] Affected data scope confirmed? (What data, how many records?)
- [ ] Attacker persistence mechanisms identified? (Backdoors, new accounts, cron jobs?)
- [ ] Full attack timeline reconstructed?

### Update Status

- [ ] Update status page: IDENTIFIED (if root cause found)
- [ ] Post timeline update to #incident-response every fib(7)=13 minutes (P1) / fib(8)=21 min (P2)

---

## 🟢 PHASE 5: ERADICATION

**Target: P1 = fib(10)=55 min, P2 = fib(11)=89 min from detection**

- [ ] Root cause patched / mitigated?
- [ ] Credential rotation complete (ALL affected credentials):
  - [ ] API keys rotated
  - [ ] JWT secrets rotated (causes session invalidation — planned?)
  - [ ] TLS certificates re-issued if compromised
  - [ ] Database credentials rotated
  - [ ] PQC keys re-keyed if compromise suspected
- [ ] Malware/implants removed (container images rebuilt from scratch)?
- [ ] All attacker-created accounts/backdoors removed?
- [ ] Dependency chain validated (no supply chain compromise)?
- [ ] Container images re-scanned with Trivy (0 CRITICAL CVEs)?
- [ ] Code change merged + CI passing?

---

## 🔵 PHASE 6: RECOVERY

**Target: P1 = fib(11)=89 min, P2 = fib(12)=144 min from detection**

- [ ] Patched version deployed to **staging** first
- [ ] Automated test suite: all passing?
- [ ] Manual smoke test: all 9 domains accessible?
- [ ] Synthetic monitor: all green for fib(7)=13 consecutive minutes on staging?
- [ ] Canary deploy to production: fib(3)=2% traffic
  - [ ] Monitor for fib(5)=5 minutes — error rate < 1%?
- [ ] Increase to fib(7)=13% traffic
  - [ ] Monitor fib(5)=5 minutes
- [ ] Increase to fib(10)=55% traffic
  - [ ] Monitor fib(5)=5 minutes
- [ ] Full traffic restored
- [ ] All containment measures removed (NetworkPolicies, rate limits, disabled endpoints)?
- [ ] Enhanced monitoring activated for fib(9)=34 days?
- [ ] Status page updated: RESOLVED?
- [ ] Customer notifications sent (if required)?
- [ ] Regulatory notification decision made (if data breach)?

---

## 📋 PHASE 7: POST-INCIDENT

**PIR timing: P1=8h, P2=21h, P3/P4=34h from resolution**

### Before Closing Incident

- [ ] Complete incident timeline documented with all UTC timestamps
- [ ] Evidence archived to forensic GCS bucket
- [ ] All team members' actions logged
- [ ] Regulatory notification requirement determination documented
- [ ] Customer impact assessment completed
- [ ] PIR meeting scheduled

### PIR Checklist

- [ ] What happened? (5-minute narrative)
- [ ] When did each phase complete? (vs. targets from incident-response-plan.md)
- [ ] What detection source found it?
- [ ] How long was the detection gap? (How long were we exposed before detection?)
- [ ] What slowed containment?
- [ ] What went well?
- [ ] What should change?
- [ ] Action items: each has an owner and due date (use Fibonacci SLAs)
- [ ] Is a new/updated Prometheus alert rule needed?
- [ ] Is a new chaos scenario needed to test this class of failure?

### IC Sign-Off

- [ ] PIR document drafted and reviewed
- [ ] Incident ticket closed with resolution summary
- [ ] Action items tracked to completion
- [ ] Announce closure in #incident-response: `✅ INC-[ID] CLOSED — PIR complete`

---

## ⚡ QUICK REFERENCE: KEY COMMANDS

```bash
# Check circuit breaker states
kubectl exec -n [ns] deploy/heady-brain -- curl -s localhost:8080/internal/health | jq .circuitBreakers

# View recent errors across all pods
kubectl logs -n [ns] -l app=heady-brain --since=1h | grep '"level":"ERROR"' | tail -50

# Check Redis pool exhaustion
kubectl exec -n [ns] deploy/heady-brain -- redis-cli INFO clients

# Scale down compromised service (containment)
kubectl scale deployment/heady-[service] --replicas=0 -n [ns]

# Scale back up (recovery)
kubectl scale deployment/heady-[service] --replicas=2 -n [ns]  # fib(3)=2 min replicas

# Trigger JWT secret rotation (all sessions invalidated)
kubectl create secret generic jwt-secret --from-literal=secret=$(openssl rand -hex 89) \  # fib(11)=89 bytes
  -n [ns] --dry-run=client -o yaml | kubectl apply -f -

# Check audit chain integrity
kubectl exec -n [ns] deploy/heady-chain -- curl -s localhost:8080/audit/verify | jq .integrityOk

# Apply emergency egress block
kubectl apply -f security/network/egress-filtering.yaml -n [ns]
```

---

*IC Checklist v3.2.2 | Fibonacci-scaled timers | See incident-response-plan.md for full procedures*
