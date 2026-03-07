# HeadySystems v3.2.2 — Security Incident Response Plan

**Version:** 3.2.2  
**Owner:** Eric Headington, CEO (eric@headyconnection.org)  
**Last Reviewed:** 2026-03-07  
**Classification:** CONFIDENTIAL — Incident Response Team Only  
**Testing:** This plan is exercised quarterly via tabletop exercises.  

All time values derive from φ=1.618033988749895 and Fibonacci sequences.

---

## 1. Purpose and Scope

This plan governs HeadySystems' response to security incidents affecting any component of HeadySystems v3.2.2: 9 public domains, 21 microservices, user data, infrastructure, and third-party integrations. It defines roles, phases, communication procedures, and escalation timers.

---

## 2. Incident Severity Classification

| Level | Name | CSL Gate | Description | Response Time |
|---|---|---|---|---|
| **P1** | Critical | CRITICAL (0.854-1.0) | Active breach, data exfiltration, complete service outage, RCE | φ^0 × 5 = **5 minutes** |
| **P2** | High | HIGH (0.618-0.854) | Significant vulnerability exploited, partial breach, major degradation | φ^1 × 5 ≈ **8 minutes** |
| **P3** | Medium | MODERATE (0.382-0.618) | Attempted but unconfirmed breach, service degradation, vulnerability discovered | φ^2 × 5 ≈ **13 minutes** |
| **P4** | Low | LOW (0.236-0.382) | Minor policy violation, low-severity vulnerability, anomaly requiring review | φ^3 × 5 ≈ **21 minutes** |

**Response time** = time from detection to Incident Commander engaged.  
**φ-scaling:** P1=5min, P2=8min (5×φ), P3=13min (8×φ), P4=21min (13×φ) — each tier scales by φ.

---

## 3. Roles and Responsibilities

| Role | Responsibilities | Default Assignee |
|---|---|---|
| **Incident Commander (IC)** | Overall coordination, decisions, communication sign-off, escalation authority | Eric Headington (P1/P2); On-call Engineer (P3/P4) |
| **Technical Lead (TL)** | Root cause analysis, containment implementation, system recovery | Lead Platform Engineer |
| **Communications Lead (CL)** | Status page updates, customer communication, press/media | Eric Headington |
| **Legal/Compliance** | Regulatory notification requirements, preservation obligations | External counsel |
| **Security Analyst** | Forensics, evidence preservation, threat hunting | Security team |

**On-call rotation:** Managed via PagerDuty. P1/P2 incidents always page both IC and TL.

---

## 4. Detection Sources

| Source | Detection Lag | Action Required |
|---|---|---|
| Prometheus alerts (alert-rules.yaml) | Real-time | Auto-page IC |
| Synthetic monitor (synthetic-monitor.js) | fib(5)=5 minutes | Auto-create incident ticket |
| Sentry error tracking | Real-time | Email + Slack |
| Audit chain integrity failure | Real-time | CRITICAL auto-page |
| External report (bug bounty/customer) | Variable | Triage within fib(6)=8h |
| GitHub Secret Scanning | Push-time | Immediate revocation |
| SIEM correlation rules | < 1 minute | Auto-ticket + alert |

---

## 5. Incident Response Phases

### Phase 1: Preparation

**Ongoing activities (not incident-specific):**

- Maintain up-to-date contact list for IC, TL, Legal, Communications
- Test incident response playbooks quarterly via tabletop
- Ensure Prometheus alerts cover all CSL CRITICAL/HIGH thresholds
- Rotate incident response credentials every fib(10)=55 days
- Maintain forensic tooling (memory forensics, log aggregation) on standby
- Train all engineers on first-responder procedures
- Keep `heady-enterprise/security/incident-response/` playbooks current

**Pre-incident checklist:**
- [ ] PagerDuty escalation policies configured and tested
- [ ] Incident response Slack channels pre-created (#incident-response, #incident-war-room)
- [ ] Status page (status.headysystems.com) update access verified
- [ ] Communication templates loaded (see `observability/statuspage/incident-templates.md`)
- [ ] Forensic evidence bucket (isolated GCS bucket) provisioned
- [ ] Legal counsel contact verified and available

---

### Phase 2: Detection & Analysis

**Trigger:** Alert fires, external report received, or anomaly detected.

**Steps (target: within P-level response time):**

1. **Acknowledge alert** — On-call engineer acknowledges PagerDuty within fib(5)=5 minutes.
2. **Initial triage (fib(6)=8 minutes):**
   - Determine if genuine incident or false positive
   - Assign initial P-level severity
   - Page IC and TL if P1/P2
3. **Open incident** — Create ticket: `INC-YYYY-NNNNN`
4. **Open war room** — #incident-war-room Slack channel + Zoom bridge
5. **IC engaged** — IC confirms severity and activates appropriate response tier
6. **Evidence preservation** — Immediately snapshot affected system logs, memory, disk
   - **Do not restart** affected pods/services until evidence is captured
   - Archive to isolated forensic GCS bucket
7. **Scope determination:**
   - Which services affected? (check all 21 microservices)
   - Which domains impacted? (check all 9 domains)
   - Any user data potentially exposed?
   - Is attack ongoing?
8. **Timeline construction** — Begin recording all events with UTC timestamps

**Analysis tools:**
- Grafana dashboards (system-overview, mcp-throughput)
- Prometheus metrics + alert state
- OTel distributed traces (Jaeger/Tempo)
- Structured logs (Loki / GCP Logging)
- Audit chain verification (`heady_audit_chain_broken_total`)

---

### Phase 3: Containment

**Target:** Limit blast radius while preserving evidence.

**Short-term containment (P1: within fib(7)=13 minutes of detection):**

| Threat Type | Containment Action |
|---|---|
| Active intrusion / RCE | Kill compromised pod(s); activate network isolation via NetworkPolicy |
| Data exfiltration | Revoke all API keys; rotate JWT secrets; isolate egress |
| Compromised credentials | Revoke credential immediately; rotate within fib(3)=2 hours |
| MCP tool injection | Disable MCP gateway; revert to direct tool calls |
| Prompt injection chain | Block affected user session; audit agent output history |
| Vector poisoning | Isolate vector namespace; snapshot for forensics |
| DDoS | Activate Cloudflare under-attack mode; rate limit to 1 req/s |
| Supply chain compromise | Pin all dependency versions; roll back to last-known-good build |

**Long-term containment (P1: within fib(9)=34 minutes):**

- Deploy network egress filtering (restrict to known-good destinations)
- Enable enhanced audit logging (all requests captured)
- Activate WAF in "block all non-allowlisted" mode
- Disable non-essential API endpoints
- Require re-authentication for all active sessions

---

### Phase 4: Eradication

**Target:** Remove threat actor access and root cause.

1. **Root cause identification:** Confirm the exact entry point, exploitation chain, and affected data.
2. **Threat actor eviction:**
   - Rotate ALL credentials (API keys, JWT secrets, TLS certs, database passwords, service account keys)
   - Revoke all active sessions
   - Re-key PQC keys if compromise suspected
   - Audit all active SSH sessions and API tokens
3. **Malware/implant removal:** Scan all container images; rebuild from scratch if any compromise suspected.
4. **Vulnerability patching:** Apply fix per `vulnerability-management.md` CRITICAL SLA (fib(3)=2 business days).
5. **Image rebuild:** Build fresh container images from clean source; verify SHA256 digests.
6. **Dependency audit:** Full `pnpm audit` after any supply chain incident.

---

### Phase 5: Recovery

**Target:** Restore service with confidence that threat is eliminated.

**Recovery sequence:**

1. **Staging validation first:**
   - Deploy patched/clean version to staging
   - Run full automated test suite
   - Manual smoke test of all 9 domains and critical API paths
   - Synthetic monitor must show all-green for fib(7)=13 consecutive minutes
2. **Phased production restoration:**
   - Restore with fib(3)=2% traffic initially (canary)
   - Monitor for fib(5)=5 minutes (error rate, latency, CSL gates)
   - Increase to fib(7)=13% → fib(10)=55% → 100% (φ-ratio ramp)
3. **Enhanced monitoring for fib(9)=34 days post-incident:**
   - Increase Prometheus scrape frequency to 5s
   - Enable DEBUG logging on affected services
   - Manual daily review of security metrics
4. **Credential rotation verification:**
   - Verify old credentials are revoked and non-functional
   - Confirm new credentials are in use in all services
5. **Communication:** Update status page to RESOLVED; send customer notifications.

---

### Phase 6: Post-Incident Activities

**PIR (Post-Incident Review) timing:**

- **P1:** Within fib(6)=8 hours of resolution
- **P2:** Within fib(8)=21 hours of resolution
- **P3/P4:** Within fib(9)=34 hours of resolution (fib-φ scaling applies)

**PIR agenda:**
1. Incident timeline review (5 minutes: what happened, when)
2. Root cause analysis (5 whys or fishbone)
3. Detection effectiveness (how quickly was it detected?)
4. Response effectiveness (what slowed us down?)
5. Impact assessment (users affected, data exposed, SLO impact)
6. Action items (concrete, owned, time-boxed)
7. Process improvements

**Documentation requirements:**
- Complete incident timeline with UTC timestamps
- Evidence inventory
- Actions taken log
- PIR report (template: `incident-report-YYYY-MM-DD-INC-NNNNN.md`)
- Regulatory notification record (if applicable)

---

## 6. Communication Templates

See `observability/statuspage/incident-templates.md` for full templates.

### 6.1 Internal Communication

**Immediately on P1/P2 detection:**
```
🚨 INCIDENT OPENED: INC-[ID]
Severity: [P-LEVEL] (CSL [GATE])
IC: @[handle]
Status: INVESTIGATING
Impact: [Brief]
War Room: [Zoom link]
```

### 6.2 Customer Communication (P1/P2 only)

Via status.headysystems.com. Phases: INVESTIGATING → IDENTIFIED → MONITORING → RESOLVED.  
Minimum update cadence: every fib(7)=13 minutes for P1, fib(8)=21 minutes for P2.

### 6.3 Regulatory Notifications

| Regulation | Trigger | Notification Window |
|---|---|---|
| GDPR Art. 33 | Personal data breach | 72 hours from discovery |
| GDPR Art. 34 | High-risk breach (notify individuals) | "Without undue delay" |
| CCPA | Personal data breach | 30 days |
| SOC 2 | Any security incident | Per customer contract |

**Regulatory contact:** Legal counsel. IC decision within fib(7)=13 hours of incident to determine if notification required.

---

## 7. Escalation Timers (φ-scaled)

| Phase | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| IC engaged | fib(5)=5 min | fib(6)=8 min | fib(7)=13 min | fib(8)=21 min |
| Severity confirmed | fib(6)=8 min | fib(7)=13 min | fib(8)=21 min | fib(9)=34 min |
| Containment activated | fib(7)=13 min | fib(8)=21 min | fib(9)=34 min | fib(10)=55 min |
| Root cause identified | fib(9)=34 min | fib(10)=55 min | fib(11)=89 min | — |
| Eradication complete | fib(10)=55 min | fib(11)=89 min | fib(12)=144 min | — |
| Recovery complete | fib(11)=89 min | fib(12)=144 min | fib(13)=233 min | — |
| PIR complete | fib(6)=8 hours | fib(8)=21 hours | fib(9)=34 hours | fib(9)=34 hours |

---

## 8. Plan Maintenance

- **Review cadence:** Quarterly (every fib(9)=34 weeks)
- **Update trigger:** After any P1/P2 incident; after major architecture changes
- **Tabletop exercises:** Quarterly; scenarios rotate through all 6 chaos scenarios from `chaos/chaos-scenarios.py`
- **Owner:** Eric Headington with Security Lead

---

*See also: `security/incident-response/incident-commander-checklist.md`, `observability/statuspage/incident-templates.md`, `docs/threat-model.md`*
