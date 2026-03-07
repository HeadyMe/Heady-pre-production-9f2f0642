# Heady™ Public Pilot Phase — Non-Profit Partner Program

> Priority: IMMEDIATE | Prerequisite: Security hardening + test coverage
> Goal: Validate MCP orchestration in real-world grant-writing scenarios

---

## 1. Pilot Objectives

| Objective | Success Metric |
|-----------|---------------|
| Validate MCP orchestration under real workloads | Zero critical failures over pilot duration |
| Prove grant-writing scenario end-to-end | 3+ grants drafted via HeadyMCP pipeline |
| Measure agent handoff latency | p95 < 5s for multi-agent task completion |
| Validate Sacred Geometry decision quality | >85% user approval rate on AI decisions |
| Stress-test circuit breakers + self-healing | Recovery from injected failures in <30s |
| Gather partner feedback for product-market fit | NPS > 40 from pilot partners |

---

## 2. Partner Selection Criteria

Target: 3-5 non-profit organizations via HeadyConnection

| Criteria | Requirement |
|----------|-------------|
| Organization type | 501(c)(3) non-profit |
| Use case | Grant writing, reporting, or program management |
| Tech readiness | Can use web-based tools, Chrome/Edge browser |
| Data sensitivity | No PII in pilot data; synthetic data option |
| Engagement | Dedicated point-of-contact, weekly feedback |

---

## 3. Pilot Infrastructure

### 3.1 Isolated Pilot Environment

```
┌─────────────────────────────────────────────┐
│  PILOT ENVIRONMENT (isolated from prod)     │
│                                              │
│  Cloudflare subdomain: pilot.headyme.com     │
│  Cloud Run service: heady-pilot              │
│  Database: heady_pilot (separate schema)     │
│  Redis namespace: pilot:*                    │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  HeadyConductor (pilot instance)     │   │
│  │  - Same code as production           │   │
│  │  - Separate config + secrets         │   │
│  │  - Enhanced logging (debug level)    │   │
│  │  - Telemetry → pilot dashboard       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  MCP Tools (grant-writing subset)    │   │
│  │  - heady_research                    │   │
│  │  - heady_analyze                     │   │
│  │  - heady_memory                      │   │
│  │  - heady_coder (template generation) │   │
│  │  - heady_deploy (doc export)         │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Pilot Dashboard                     │   │
│  │  - Real-time MCP tool usage          │   │
│  │  - Agent handoff latency             │   │
│  │  - Sacred Geometry decision log      │   │
│  │  - Error rate + circuit breaker      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 3.2 Cloud Run Service Config

File: `deploy/pilot/cloud-run-pilot.yaml`
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: heady-pilot
  annotations:
    run.googleapis.com/description: "Heady Pilot Environment"
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: '1'
        autoscaling.knative.dev/maxScale: '3'
        run.googleapis.com/cpu-throttling: 'false'
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: gcr.io/PROJECT_ID/heady-manager:pilot
          ports:
            - containerPort: 3848
          env:
            - name: NODE_ENV
              value: pilot
            - name: HEADY_ENVIRONMENT
              value: pilot
            - name: LOG_LEVEL
              value: debug
            - name: PILOT_MODE
              value: 'true'
            - name: ENABLE_TELEMETRY
              value: 'true'
          resources:
            limits:
              cpu: '2'
              memory: 2Gi
          startupProbe:
            httpGet:
              path: /health/startup
              port: 3848
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3848
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3848
            periodSeconds: 10
```

---

## 4. Grant-Writing Pilot Workflow

### 4.1 MCP Orchestration Flow

```
Partner Request: "Draft a grant proposal for youth STEM education"
    │
    ▼
HeadyConductor → Task Decomposition
    ├── Research Task → heady_research (find grant opportunities)
    ├── Analysis Task → heady_analyze (org fit assessment)
    ├── Memory Task → heady_memory (recall past grants)
    │
    ▼
Swarm Consensus → Merge findings
    │
    ▼
HeadyConductor → Generation Task
    ├── heady_coder (generate proposal template)
    ├── heady_analyze (compliance check)
    ├── HeadyCheck (two-key validation)
    │
    ▼
Output: Draft grant proposal (DOCX/PDF)
    ├── Tracked in pilot dashboard
    ├── Partner reviews + feedback
    └── Metrics logged for assessment
```

### 4.2 Pilot MCP Tool Subset

File: `configs/pilot-mcp-tools.json`
```json
{
  "pilot_tools": [
    {
      "name": "heady_research",
      "description": "Research grant opportunities and funding sources",
      "enabled": true,
      "rate_limit": 21
    },
    {
      "name": "heady_analyze",
      "description": "Analyze organization fit, compliance requirements",
      "enabled": true,
      "rate_limit": 34
    },
    {
      "name": "heady_memory",
      "description": "Recall past interactions, grants, and preferences",
      "enabled": true,
      "rate_limit": 55
    },
    {
      "name": "heady_coder",
      "description": "Generate proposal templates and documents",
      "enabled": true,
      "rate_limit": 13
    },
    {
      "name": "heady_deploy",
      "description": "Export completed documents",
      "enabled": true,
      "rate_limit": 8
    }
  ],
  "disabled_tools": [
    "heady_battle",
    "heady_auto_flow",
    "heady_deep_scan",
    "heady_risks"
  ]
}
```

---

## 5. Success Criteria & Metrics

### 5.1 Go / No-Go Gate

| Metric | Go Threshold | No-Go |
|--------|-------------|-------|
| Uptime | >99.5% | <98% |
| Error rate | <2% | >5% |
| Agent handoff p95 | <5s | >15s |
| Circuit breaker trips | <3/day | >10/day |
| Partner satisfaction | >7/10 | <5/10 |
| Grants completed | ≥3 | 0 |

### 5.2 Telemetry Collection

```javascript
// Pilot telemetry events
const PILOT_EVENTS = {
  TASK_STARTED: 'pilot.task.started',
  TASK_COMPLETED: 'pilot.task.completed',
  TASK_FAILED: 'pilot.task.failed',
  AGENT_HANDOFF: 'pilot.agent.handoff',
  MCP_TOOL_CALLED: 'pilot.mcp.tool_called',
  CIRCUIT_BREAKER_TRIP: 'pilot.circuit.trip',
  DECISION_MADE: 'pilot.decision.made',
  PARTNER_FEEDBACK: 'pilot.feedback.submitted',
};
```

---

## 6. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Setup | Start Now | Pilot env deployed, partners onboarded |
| Active Pilot | 4 weeks | Daily monitoring, weekly partner calls |
| Assessment | 1 week | Metrics report, go/no-go decision |
| Report | 3 days | Public pilot report for investors/board |

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Partner data leakage | Separate database, no PII, synthetic data option |
| Service downtime | Circuit breakers, auto-heal, manual fallback |
| Negative feedback | Weekly check-ins, rapid iteration cycle |
| Scope creep | Strict MCP tool subset, no feature additions during pilot |
| Cost overrun | Cloud Run max-scale=3, rate limits on all tools |
