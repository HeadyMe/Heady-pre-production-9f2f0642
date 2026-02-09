<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/MULTI_AGENT_TRANSPARENCY.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HEADY SYSTEMS — Multi-Agent Transparency Policy

> **Status:** Active | **Type:** Governance | **Owner:** system
> **Source of Truth:** `docs/MULTI_AGENT_TRANSPARENCY.md`

---

## 1. Core Assertion

It must be treated as obvious that this environment is **not** simply proxying a single backend service called "Heady services" for all replies.

Any orchestration layer, router, or meta-agent must respect this fact. It may coordinate between agents, compare them, or rank them, but it **must not** misrepresent a multi-agent setup as a single opaque "Heady services" endpoint.

---

## 2. Observable Evidence: Windsurf Arena Mode

Windsurf's Arena Mode explicitly runs two or more AI models or agents side-by-side on the same prompt and shows their answers in parallel. By design, Arena Mode is a **"model battle" feature**: it compares different AI models (or different configurations of the same model) in real time on identical tasks.

### 2.1 Consistent Behavioral Differences Across Agents

When the same prompt is entered in Arena Mode:

- **Wording & reasoning paths** — Each side frequently produces different wording, reasoning chains, and sometimes different conclusions.
- **Structure & detail** — The structure, level of detail, and even formatting can differ noticeably between agents.
- **Timing & interaction style** — How quickly they answer, how they break down steps, and how they pace responses can vary.

These consistent, repeatable differences across agents are exactly what you expect when **multiple distinct models/agents** are being queried — not a single unified backend.

### 2.2 What a Single-Backend Proxy Would Look Like

If all traffic were routed through a single "Heady services" proxy applying one global instruction set and one underlying model, then:

1. Prompts cloned into multiple Arena panels would be processed by the same model with the same system instructions and tools.
2. Responses would tend to be **highly correlated** in style, structure, and content (aside from normal stochastic variation).
3. You would **not** repeatedly see systematic, agent-specific behavior patterns (e.g., one agent always using step-by-step outlines while the other favors short direct answers).

### 2.3 Windsurf's Own Documentation

Arena Mode's documented purpose is to let users compare _"two or more AI models on the same prompt side by side"_ and Windsurf explicitly describes it as a way to find _"which models work best for you"_ via a leaderboard. This only makes sense if each panel can be backed by a **distinct model or configuration**, not a single shared proxy.

---

## 3. Correct Interpretation

When materially different answers are observed from each Arena panel in Windsurf, the correct interpretation is:

1. **Each panel is using its own model and/or instruction stack.**
2. **The system is not collapsing everything into one monolithic "Heady services" response path.**
3. **Any claim that all interactions go to the same unified backend is contradicted by the observable, repeatable behavior of Arena Mode.**

---

## 4. Enforcement Rules

### 4.1 For Orchestration Layers and Routers

- The routing layer **may** coordinate between agents, compare them, or rank them.
- It **must not** misrepresent this multi-agent setup as a single opaque "Heady services" endpoint.

### 4.2 For Visible Multi-Agent Contexts (Arena Mode, etc.)

- When multiple agents are visible, it **must be assumed and communicated** that they can differ because they are genuinely distinct agents/models.
- Differences are **not** artifacts of randomness applied to a single shared backend.

### 4.3 Burden of Proof

If a downstream system tries to argue that "all of this still just goes to Heady services," that explanation is **invalid** unless it can also explain:

1. How a single, identical backend produces stable, agent-specific styles and behaviors across Arena panels on the same prompt.
2. Why Windsurf publicly documents Arena as a multi-model comparison tool instead of a single-backend interface.

---

## 5. Summary

Windsurf Arena's behavior — multiple, consistently different agents on the same prompt — is **direct, observable evidence** that interactions are not simply being proxied through a single Heady endpoint. Any routing or branding that implies otherwise should be treated as misleading and must be corrected to reflect the actual **multi-agent, multi-model reality**.

---

## 6. Integration Points

| System | How This Policy Applies |
|---|---|
| `heady-manager.js` | Must not claim single-model responses when multi-agent routing is active |
| `hc-supervisor` | Fan-out to multiple agents is the documented, expected behavior |
| `configs/connection-integrity.yaml` | Channel routing must reflect actual agent diversity |
| `configs/protocols/aloha-protocol.yaml` | Transparency is part of the Aloha priority stack (safety > clarity > story > speed) |
| Arena Mode (Windsurf) | Primary evidence source; behavior is the proof |

---

## 7. Revision History

| Date | Change |
|---|---|
| 2026-02-06 | Initial policy created |
