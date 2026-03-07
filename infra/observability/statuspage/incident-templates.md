# HeadySystems Incident Communication Templates

**Version:** 3.2.2  
**Owner:** Communications Lead (Incident Response Team)  
**Last Updated:** 2026-03-07  

These templates correspond to the four incident phases defined in the Incident Response Plan.
Use these verbatim as starting points, substituting `[BRACKETED]` fields.
All times reference UTC. Severity levels P1-P4 map to CSL gates CRITICAL/HIGH/MODERATE/LOW.

---

## Template Selection Guide

| Phase | Action |
|---|---|
| Issue detected, cause unknown | **INVESTIGATING** |
| Root cause identified | **IDENTIFIED** |
| Fix deployed, verifying recovery | **MONITORING** |
| Verified stable, incident closed | **RESOLVED** |

**Audience matrix:**

| Template Set | Internal Slack | Customer Status Page | Regulatory |
|---|---|---|---|
| P1 (Critical / CSL CRITICAL) | All templates | All phases | IDENTIFIED + RESOLVED |
| P2 (High / CSL HIGH) | All templates | All phases | RESOLVED only |
| P3 (Medium / CSL MODERATE) | INVESTIGATING + RESOLVED | RESOLVED only | N/A |
| P4 (Low / CSL LOW) | RESOLVED only | N/A | N/A |

---

## P1 — Critical (CSL CRITICAL gate: 0.854–1.0)

### INVESTIGATING

**Subject:** [STATUS PAGE] Investigating: [Component Name] Outage — [DATE TIME UTC]

---

**Status:** 🔴 INVESTIGATING

We are currently investigating an issue affecting **[Component Name]** ([e.g., HeadyOS API / HeadyBrain / HeadyMCP]).

**Impact:**  
[Describe user-facing impact clearly. Example: "Users may experience inability to submit requests or receive responses. API calls are returning 5xx errors."]

**Affected Services:**  
- [Component 1]
- [Component 2]

**Affected Domains:**  
- [headyme.com / headyos.com / etc.]

**Start Time:** [YYYY-MM-DD HH:MM UTC]

**Current Status:**  
Our engineering team has been alerted (at [HH:MM UTC]) and is actively investigating. We will provide an update within **fib(7)=13 minutes**.

---
_HeadySystems Status — https://status.headysystems.com_

---

### IDENTIFIED

**Subject:** [STATUS PAGE] Identified: [Component Name] Issue — Root Cause Found — [DATE TIME UTC]

---

**Status:** 🟠 IDENTIFIED

We have identified the root cause of the issue affecting **[Component Name]**.

**Root Cause:**  
[Clear, non-jargon explanation of root cause. Example: "A Redis connection pool exhaustion event triggered a cascade failure in the request processing pipeline."]

**Impact:**  
[Updated impact statement, including estimated affected user percentage.]

**Start Time:** [YYYY-MM-DD HH:MM UTC]  
**Identified At:** [YYYY-MM-DD HH:MM UTC]  
**Time to Identify:** [X minutes]

**Mitigation in Progress:**  
[Describe the fix being applied. Example: "We are deploying a hotfix to increase connection pool capacity and restarting affected pods."]

**Next Update:**  
We will provide an update within **fib(9)=34 minutes** or when the situation changes.

---
_HeadySystems Status — https://status.headysystems.com_

---

### MONITORING

**Subject:** [STATUS PAGE] Monitoring: [Component Name] — Fix Deployed, Verifying Recovery — [DATE TIME UTC]

---

**Status:** 🟡 MONITORING

A fix has been deployed for the issue affecting **[Component Name]**. We are actively monitoring system metrics to confirm full recovery.

**Fix Applied:**  
[Describe what was deployed/changed. Example: "Connection pool limits have been increased from fib(7)=13 to fib(9)=34 connections. Pods have been restarted and are serving traffic."]

**Current State:**  
- Error rate: [X%] (target: < 1%)
- p99 latency: [Xms] (target: < 1000ms)
- Active connections: [X] / [max]
- CSL gate: [CURRENT GATE]

**Monitoring Period:**  
We will monitor for a minimum of **fib(8)=21 minutes** before declaring resolution.

**Next Update:**  
[YYYY-MM-DD HH:MM UTC] or when resolved.

---
_HeadySystems Status — https://status.headysystems.com_

---

### RESOLVED

**Subject:** [STATUS PAGE] Resolved: [Component Name] — Incident Resolved — [DATE TIME UTC]

---

**Status:** ✅ RESOLVED

The incident affecting **[Component Name]** has been resolved. All systems are operating normally.

**Summary:**  
[1-2 sentence plain language summary of what happened and how it was fixed.]

**Timeline (UTC):**  
- `[HH:MM]` — Issue began
- `[HH:MM]` — Alert fired (synthetic monitor / on-call page)
- `[HH:MM]` — Incident Commander engaged
- `[HH:MM]` — Root cause identified: [one line]
- `[HH:MM]` — Fix deployed
- `[HH:MM]` — Recovery confirmed — incident resolved

**Incident Duration:** [X hours Y minutes]  
**Affected Users:** [Approximate count or percentage]  
**P-Level:** P1 (CSL CRITICAL)

**Immediate Actions Taken:**  
1. [Action 1]  
2. [Action 2]  
3. [Action 3]

**Prevention:**  
A post-incident review (PIR) will be completed within **fib(9)=34 hours**. We will publish findings and long-term remediations. We apologize for the disruption.

---
_HeadySystems Status — https://status.headysystems.com_

---

## P2 — High (CSL HIGH gate: 0.618–0.854)

### INVESTIGATING

**Subject:** [STATUS PAGE] Investigating: [Component Name] Degradation — [DATE TIME UTC]

---

**Status:** 🟠 INVESTIGATING

We are investigating a service degradation affecting **[Component Name]**.

**Impact:**  
[Describe degraded (not total outage) impact. Example: "Some users may experience increased latency or intermittent errors when using [feature]."]

**Affected Services:**  
- [Component]

**Start Time:** [YYYY-MM-DD HH:MM UTC]

Our team is investigating. Next update in **fib(7)=13 minutes**.

---
_HeadySystems Status — https://status.headysystems.com_

---

### IDENTIFIED

**Subject:** [STATUS PAGE] Identified: [Component Name] Degradation — Cause Found — [DATE TIME UTC]

---

**Status:** 🟠 IDENTIFIED

Root cause of the degradation affecting **[Component Name]** has been identified.

**Root Cause:** [Brief explanation]

**Impact:** [Updated impact assessment]

**Fix ETA:** [YYYY-MM-DD HH:MM UTC]

Next update in **fib(8)=21 minutes**.

---
_HeadySystems Status — https://status.headysystems.com_

---

### MONITORING

**Subject:** [STATUS PAGE] Monitoring: [Component Name] — Remediation Applied — [DATE TIME UTC]

---

**Status:** 🟡 MONITORING

Remediation has been applied for the degradation affecting **[Component Name]**.

**Action Taken:** [What was done]

Monitoring for **fib(7)=13 minutes** to confirm stability.

---
_HeadySystems Status — https://status.headysystems.com_

---

### RESOLVED

**Subject:** [STATUS PAGE] Resolved: [Component Name] — Service Restored — [DATE TIME UTC]

---

**Status:** ✅ RESOLVED

The degradation affecting **[Component Name]** has been resolved.

**Duration:** [X minutes/hours]  
**Root Cause:** [One sentence]  
**Resolution:** [One sentence]

Post-incident review scheduled. Thank you for your patience.

---
_HeadySystems Status — https://status.headysystems.com_

---

## P3 — Medium (CSL MODERATE gate: 0.382–0.618)

### INVESTIGATING

**Subject:** [STATUS PAGE] Investigating: Minor Degradation — [Component] — [DATE UTC]

---

**Status:** 🟡 INVESTIGATING

We are investigating a minor issue with **[Component Name]**.

**Impact:** [Limited user impact. Example: "A subset of requests may experience slightly elevated response times."]

**Next Update:** fib(8)=21 minutes.

---
_HeadySystems Status — https://status.headysystems.com_

---

### RESOLVED

**Subject:** [STATUS PAGE] Resolved: Minor Degradation — [Component] — [DATE UTC]

---

**Status:** ✅ RESOLVED

The minor issue with **[Component Name]** has been resolved.

**Duration:** [X minutes] | **Impact:** [Brief] | **Resolution:** [Brief]

---
_HeadySystems Status — https://status.headysystems.com_

---

## P4 — Low (CSL LOW gate: 0.236–0.382)

### RESOLVED (only public template for P4)

**Subject:** [STATUS PAGE] Resolved: Minor Issue — [Component] — [DATE UTC]

---

**Status:** ✅ RESOLVED

A minor issue with **[Component Name]** has been resolved. Impact was limited and most users were unaffected.

**Duration:** [X minutes] | **Root Cause:** [Brief]

---
_HeadySystems Status — https://status.headysystems.com_

---

## Internal Slack Templates

### #incident-response channel (all P1/P2)

**🚨 INCIDENT OPENED — [P-LEVEL]**
```
INCIDENT: INC-[NUMBER] — [TITLE]
Severity: [P1/P2/P3/P4] (CSL [GATE])
IC: @[incident_commander_handle]
Tech Lead: @[tech_lead_handle]
Bridge: [Zoom/Meet link]
Started: [HH:MM UTC]
Impact: [Brief]
Status: INVESTIGATING
Dashboard: https://grafana.headysystems.com/d/heady-system-overview
Runbook: https://runbooks.headysystems.com/[relevant-path]
```

**🟡 INCIDENT UPDATE — [P-LEVEL]**
```
INCIDENT: INC-[NUMBER] update at [HH:MM UTC]
Status: [IDENTIFIED / MONITORING]
Update: [What changed]
ETA: [If known]
```

**✅ INCIDENT RESOLVED — [P-LEVEL]**
```
INCIDENT: INC-[NUMBER] RESOLVED at [HH:MM UTC]
Duration: [X hours Y minutes]
Root Cause: [One sentence]
Resolution: [One sentence]
PIR due: [DATE] (fib(9)=34h from resolution)
```

---

## Regulatory Notification Template (P1 only, data breach incidents)

**Subject:** Security Incident Notification — HeadySystems Inc. — [DATE]

Dear [Regulatory Body / Customer DPA Contact],

HeadySystems Inc. is providing notification pursuant to [GDPR Article 33 / CCPA / applicable regulation] regarding a security incident affecting our systems.

**Incident Summary:**  
On [DATE] at approximately [TIME] UTC, HeadySystems detected [brief description of incident].

**Nature of Incident:** [Data breach / unauthorized access / service disruption]

**Categories of Data Potentially Affected:** [User IDs / session tokens / API keys / etc.]

**Approximate Number of Individuals Affected:** [Count or "under investigation"]

**Likely Consequences:** [Brief risk assessment]

**Measures Taken or Proposed:**  
1. [Containment action]  
2. [Eradication action]  
3. [Future prevention measure]

**Point of Contact:**  
Eric Headington, CEO — eric@headyconnection.org  
HeadySystems Inc., [Address]

This notification is provided within the required timeframe ([72 hours under GDPR / 30 days under CCPA]).

Sincerely,  
Eric Headington  
Founder & CEO, HeadySystems Inc.

---

*Templates maintained in `observability/statuspage/incident-templates.md`*  
*Incident Response Plan: `security/incident-response/incident-response-plan.md`*
