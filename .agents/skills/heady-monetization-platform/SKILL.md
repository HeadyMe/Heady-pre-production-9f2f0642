---
name: heady-monetization-platform
description: >
  Use when building monetization infrastructure for the Heady platform. Covers Stripe integration
  with subscription and usage-based billing, phi-scaled usage metering, CSL-gated feature gates,
  A/B testing with phi-weighted variants, Fibonacci-stepped gradual rollouts, SOC 2 Type II
  compliance checklist, and revenue modeling. Pricing follows sovereign AI platform patterns.
  Keywords: monetization, Stripe, billing, subscription, usage metering, feature gate, feature flag,
  A/B testing, SOC 2, compliance, pricing, revenue model, Heady pricing, SaaS billing.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Monetization Platform

## When to Use This Skill

Use this skill when you need to:

- Configure Stripe subscription + usage-based billing
- Track and meter API calls, vector ops, LLM tokens, storage, agent hours
- Gate features by plan tier with graceful degradation
- Run A/B experiments with phi-weighted variant distribution
- Plan gradual rollouts using Fibonacci percentages
- Prepare for SOC 2 Type II compliance
- Model first-year revenue projections

## Pricing Architecture

4 tiers:
- **Community** (free): Rate-limited, basic features
- **Developer** ($29/mo): Individual builder, generous limits
- **Team** ($99/seat/mo): Collaboration, priority support
- **Enterprise** (custom): SSO, SLA, air-gapped, custom limits

Annual discount: fib(8) = 21%
Trial period: fib(7) = 13 days

## Instructions

### 1. Usage Metering (phi-scaled alerts)

Track 5 metric types: API calls, vector ops, LLM tokens, agent hours, storage GB.

Alert thresholds (replacing arbitrary 80%/95%/100%):
| Level | Threshold | Action |
|-------|-----------|--------|
| Warning | ψ ≈ 0.618 (61.8%) | Notify user |
| Caution | 1-ψ² ≈ 0.764 (76.4%) | Dashboard alert |
| Critical | 1-ψ³ ≈ 0.854 (85.4%) | Email alert |
| Exceeded | 1-ψ⁴ ≈ 0.910 (91.0%) | Throttle/block |
| Hard max | 1.0 (100%) | Hard stop |

### 2. Feature Gates (CSL-gated)

```javascript
const gate = new FeatureGate(redisClient);
const allowed = await gate.check(userId, 'advanced_rag');
// Returns: { allowed, plan, degradation, quotaUsage }
```

Graceful degradation: when over quota, reduce capability instead of hard block.

### 3. A/B Testing (phi-weighted)

Default split: `phiFusionWeights(2)` → [0.618 control, 0.382 variant]
Slightly favors control for safety, phi-biased exploration for variant.

### 4. Fibonacci Gradual Rollout

Step sequence: 1% → 2% → 3% → 5% → 8% → 13% → 21% → 34% → 55% → 89% → 100%

Each step is a Fibonacci number — natural progression with increasing confidence.

### 5. SOC 2 Type II Checklist

Trust Service Criteria:
- CC1–CC9: Security controls
- Availability: uptime, disaster recovery
- Processing Integrity: data accuracy
- Confidentiality: encryption, access control
- Privacy: data handling, consent

Timeline: 6–12 months, cost $30K–$80K for Type II.

### 6. Revenue Model Benchmarks

Peer comparisons (2026):
- Cursor: $2B ARR, $20/$40 seat pricing
- Windsurf: $100M ARR, $15–$60 seat
- Supabase: $70M ARR, usage-based
- GitHub Copilot: 4.7M subscribers, $10–$39 seat

Target metrics: 17.8% free→trial conversion, 2–5% freemium→paid, 115%+ NRR.

## Evidence Paths

- `section7-monetization/configs/stripe-config.js`
- `section7-monetization/modules/usage-metering.js`
- `section7-monetization/modules/feature-gate.js`
- `section7-monetization/docs/soc2-compliance-checklist.md`
- `section7-monetization/docs/revenue-model.md`
- `section7-monetization/pages/pricing-page.html`
