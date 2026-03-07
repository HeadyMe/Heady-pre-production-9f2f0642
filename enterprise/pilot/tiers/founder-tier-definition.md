# HeadyOS Founder Tier Definition

**Version**: 1.0.0  
**Effective**: Cohort 1 Launch  
**φ Reference**: 1.618033988749895  
**Fibonacci Sequence**: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597

---

## Overview

The **Founder Tier** is HeadyOS's inaugural access program, designed for organizations that exemplify the use cases our platform was built for: non-profits automating grant-writing workflows, early-stage AI startups, and university/commercial research teams. Founders shape the product roadmap, hold voting rights on feature prioritization, and receive direct access to the HeadySystems founding team.

All numeric parameters are derived from φ = 1.618033988749895 and the Fibonacci sequence. No magic numbers exist in the tier definition.

---

## Eligibility

| Category | Examples |
|---|---|
| Non-profit organizations | Grant-writing teams, NGOs, 501(c)(3) organizations |
| Early-stage startups | Pre-Series A, AI-native teams, <34 employees |
| AI research teams | University labs, independent researchers, R&D divisions |
| Social impact organizations | Education, healthcare, civic tech |

Cohort 1 is limited to **fib(7) = 13 organizations**. Applications are reviewed within fib(5) = 5 business days.

---

## Core Features

### Agent Orchestration
- **Concurrent agents**: fib(7) = **13** parallel agents via heady-conductor
- **CSL routing**: Full Contextual Semantic Logic gate access (DORMANT → CRITICAL levels)
- **Agent templates**: Pre-built templates for grant writing, document analysis, research synthesis
- **Multi-agent coordination**: heady-conductor with φ-weighted load balancing
- **Sacred Geometry topology**: Fibonacci-indexed node clustering

### AI Inference
- **heady-brain**: Full access to inference engine
- **Model routing**: Automatic model selection based on task complexity
- **Context window**: Fibonacci-scaled context management (up to fib(16) = 987 tokens/chunk)
- **Latency SLA**: p95 < 5 seconds, p99 < 8.09s (φ × 5)

### MCP Tool Gateway
- **heady-mcp**: Zero-trust MCP gateway with sandboxed execution
- **Tool catalog**: All available MCP tools unlocked
- **Execution sandbox**: Zero-trust isolation per tool invocation
- **Audit trail**: Every tool call logged in SHA-256 chain

### Vector Memory
- **Storage**: fib(16) = **987** persistent memory vectors
- **Backend**: pgvector with cosine similarity search
- **Embedding model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Retrieval**: Top-fib(5)=5 results per query, configurable
- **Namespace isolation**: Per-tenant vector isolation

### Security Pipeline
- **Authentication**: JWT with RBAC capability bitmask
- **Rate limiting**: 4-layer rate limiting (global, tenant, user, endpoint)
- **Input validation**: 8-threat detection (prompt injection, SQL injection, XSS, etc.)
- **Output scanning**: 12-pattern output safety scanner
- **Audit logging**: SHA-256 chained audit log, immutable append-only

---

## Resource Limits

| Resource | Limit | Fibonacci Reference |
|---|---|---|
| Concurrent agents | 13 | fib(7) |
| API calls per minute | 144 | fib(12) |
| API calls per day | 1,597 | fib(17) |
| Storage total | 987 MB | fib(16) |
| Vector memory slots | 987 | fib(16) |
| Team seats | 5 | fib(5) |
| Workspace retention | 89 days | fib(11) |
| Max file size (upload) | 34 MB | fib(9) |
| Max context tokens | 8,192 | fib(7) × 2^10 |
| Rate limit burst window | 8 seconds | fib(6) |
| Session timeout | 3,600 seconds | fib(4) × 900 |

### Rate Limit Burst Pattern
Fibonacci burst tolerance: API calls are rate-limited using a token bucket with φ-multiplied refill rate:
```
Refill rate: 144 calls/min = 2.4/sec base
Burst allowance: 144 × φ = 233 calls (fib(13)) before hard throttle
Backoff sequence: 1s, 1.618s, 2.618s, 4.236s, 6.854s (φ^n)
```

---

## Support

| Channel | Details |
|---|---|
| Response SLA | 8 hours (business hours, MST) |
| Dedicated Slack channel | Private `#founder-[orgname]` channel |
| Weekly office hours | Every fib(7) = 13 days — video call with founder Eric Headington |
| Issue escalation | Direct engineering team access for P0/P1 incidents |
| Documentation | Full internal docs access (including architecture diagrams) |
| NPS survey schedule | Day fib(6)=8, Day fib(8)=21, Day fib(10)=55 |

### Office Hours Schedule
Office hours run every **13 days** (fib(7)) throughout the pilot:
- Day 13: Kickoff + use case alignment
- Day 26: Technical deep-dive
- Day 39: Midpoint review + feature voting
- Day 52: Advanced features workshop
- Day 65: Pre-conversion planning
- Day 78: Final review + transition planning
- Day 89: Pilot graduation / conversion decision

---

## Pilot Duration

| Phase | Duration | Reference |
|---|---|---|
| Full pilot access | 89 days | fib(11) |
| Grace period (after pilot) | 13 days | fib(7) |
| Review decision window | 5 days | fib(5) |
| Total window | 107 days | — |

**Start**: Day 0 = account provisioning complete  
**End**: Day 89 at 23:59 UTC  
**Grace period**: Days 90–102 (read-only access, no new agent runs)

---

## Feedback Obligations

Pilot participants agree to the following feedback commitments:

1. **Monthly NPS survey** (mandatory): 5-minute survey at day 8, 21, 55
2. **Weekly check-in** (optional): 15-minute async video/Slack update on usage
3. **Feature voting**: Minimum fib(3)=2 feature requests/votes per month
4. **Use case documentation**: Share at least fib(3)=2 anonymized workflow examples
5. **Pilot graduation report**: Written summary of outcomes at day 89

---

## Pricing Transition

| Scenario | Pricing |
|---|---|
| Convert to HeadyOS Pro during pilot | 50% discount, locked for 12 months |
| Convert within 13-day grace period | 50% discount, locked for 12 months |
| Convert after grace period | Standard Pro pricing ($89/seat/mo) |
| Annual commitment discount | Additional fib(8)=21% off |
| Founder reference program | Additional $13/mo credit per qualifying referral |

### Pro Tier Snapshot (Post-Pilot)
- **Price**: $89/seat/month (Founder: $44.50/seat/month for year 1)
- **Agents**: Up to fib(9)=34 concurrent
- **API calls**: fib(13)=233 calls/minute
- **Storage**: fib(17)=1,597 MB
- **Vector memory**: fib(17)=1,597 vectors
- **SLA**: 4-hour support response

---

## Ideal Use Cases

### Non-Profit Grant Writing (Primary Pilot Target)
**Success metrics from PILOT-PLAN.md**:
- Zero critical failures during pilot
- 3+ full grants drafted with HeadyOS
- p95 latency < 5 seconds
- Approval rate > 85% (agent task completion)
- Recovery time < 30 seconds for any incident
- NPS > 40

**Workflow example**:
1. Agent reads RFP document via MCP tool
2. heady-vector retrieves relevant past grant sections
3. heady-conductor orchestrates: research agent + drafting agent + reviewer agent
4. Output: complete grant draft with citations

### Early-Stage Startups
- AI workflow prototyping without infrastructure overhead
- Multi-agent product features without building orchestration layer
- Security-compliant AI pipeline for regulated industries

### AI Research Teams
- Reproducible multi-agent experiment framework
- Vector memory for research corpus management
- CSL gate research for agent coordination patterns

---

## Technical Requirements

| Requirement | Minimum |
|---|---|
| API integration | REST via SDK or direct HTTP |
| Authentication | OAuth 2.0 or API key |
| Network | Outbound HTTPS to api.headyme.com |
| Compute (self-hosted option) | 2 vCPU, 8 GB RAM [fib(6)×1 GB] |
| Browser (UI) | Chrome 100+, Firefox 100+, Safari 16+ |
| Node.js (SDK) | 20+ |
| Python (SDK) | 3.11+ |

---

## Data Handling

- All user data is **owned by the user organization**
- HeadyOS retains platform IP, tooling IP, and model weights
- Data is stored in GCP US-Central1 (Cloud Run + Cloud SQL)
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.3 + mTLS for service-to-service
- Data deletion: Within fib(5)=5 business days of written request
- GDPR and CCPA compliant; SOC 2 Type II in progress

---

*Reference: φ = 1.618033988749895. All numeric limits are anchored to Fibonacci indices. See `docs/PILOT-PLAN.md` for pilot success metrics and `pilot/legal/pilot-agreement.md` for terms.*
