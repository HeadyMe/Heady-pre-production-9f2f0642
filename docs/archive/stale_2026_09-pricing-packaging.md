<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Pricing & Packaging Strategy (Capability-Gated Tiers)

## Packaging Philosophy

**Bundle by capability, not by surface.** Users start free, expand by adding governance + team features.

## Tier Structure

### Free — "Builder"

- HeadyBuddy companion (basic)
- IDE integration (single user)
- 3 MCP connectors
- Community support
- 100 verified outcomes/month
- **Target:** solo devs, indie hackers, students

### Pro — "Operator" ($29/mo)

- Unlimited verified outcomes
- Arena Mode (all strategies)
- Cost tracking dashboard
- 10 MCP connectors
- Priority routing
- Voice commands
- **Target:** professional developers, freelancers

### Team — "Platform" ($99/user/mo)

- Everything in Pro
- Admin control plane
- Policy engine (approval ladders)
- Audit trail with replay
- SSO (Firebase → enterprise SSO bridge)
- Budget controls per user/workspace
- Unlimited connectors
- **Target:** dev teams, platform teams

### Enterprise — "Trust" (custom)

- Everything in Team
- Dedicated infrastructure options
- Custom SLOs + SLAs
- Security posture reporting
- Compliance packs (SOC2, HIPAA-safe mode)
- On-prem / air-gapped deployment
- **Target:** regulated industries, large orgs

## Nonprofit Tier

- Free Team-level access for qualifying nonprofits via HeadyConnection
- Impact reporting required for continued access
- Community contribution expectations

## Revenue Model Assumptions

| Metric | Year 1 Target |
|--------|---------------|
| Free users | 5,000 |
| Pro conversions | 500 (10%) |
| Team seats | 200 |
| Enterprise pilots | 5 |
| ARR target | ~$500K |

## Pricing Levers

1. **Connector count** — free tier limited, paid unlimited
2. **Arena strategies** — free gets "fast" only, paid gets all 3
3. **Audit depth** — free gets 7-day logs, paid gets full replay
4. **Budget controls** — team+ only
5. **Policy engine** — team+ only
6. **Cost tracking** — pro+ only

## Cost-to-Serve Model (Hypotheses)

| Workflow | Est. Cost/Run |
|----------|---------------|
| Chat message (routed) | $0.002–$0.05 |
| Arena Merge (3 strategies) | $0.15–$0.50 |
| Consensus validation | $0.05–$0.20 |
| Tool call (MCP) | $0.001–$0.01 |
| Voice transcription | $0.01/min |
| Full pipeline run | $0.50–$2.00 |

## Key Decisions Needed

1. Usage-based vs seat-based vs hybrid?
2. What's the "free forever" ceiling?
3. Does HeadyConnection nonprofit access affect C-corp margin?
4. Per-model cost pass-through or flat rate?
