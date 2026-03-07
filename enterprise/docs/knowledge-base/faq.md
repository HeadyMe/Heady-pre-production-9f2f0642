# HeadySystems — Frequently Asked Questions

**Version:** 1.0.0  
**Last Updated:** 2026-03-07  

---

## What is HeadyOS?

HeadyOS is an AI agent operating system built for enterprise teams. It provides a platform for creating, orchestrating, and managing AI agents that can use tools, remember context, collaborate with each other, and complete complex multi-step tasks.

Think of HeadyOS as the operating system layer that sits between your team's workflows and AI models — handling authentication, memory, tool integration, security, and orchestration so your agents can focus on doing useful work.

HeadyOS runs at [headyos.com](https://headyos.com) and is accessible via API, SDK, and web dashboard.

---

## How do agents work?

An agent in HeadyOS is an autonomous AI unit with:

1. **Instructions** — A system prompt that defines the agent's role and capabilities
2. **Tools** — Access to MCP (Model Context Protocol) tools: web search, code execution, file operations, APIs
3. **Memory** — A vector memory store that persists knowledge across conversations and tasks
4. **CSL Score** — A Continuous Semantic Logic activation threshold that determines when the agent acts

When you give an agent a task, it:
1. Searches its memory for relevant prior context
2. Plans a sequence of tool calls to accomplish the goal
3. Executes the plan, using tools and recording results
4. Stores insights back into memory for future use
5. Returns a result with a confidence (CSL) score

Agents can also be orchestrated in hierarchies — a conductor agent can delegate subtasks to specialist agents.

---

## What is MCP?

MCP stands for **Model Context Protocol** — an open protocol created by Anthropic that defines a standard way for AI models to connect to external tools and data sources.

HeadySystems implements an MCP server (`heady-mcp`) that exposes:

| Tool | Description |
|------|-------------|
| `web_search` | Real-time web search |
| `code_execution` | Sandboxed code execution (Python, JavaScript) |
| `file_read` / `file_write` | Secure file operations |
| `database_query` | Parameterized SQL queries |
| `http_fetch` | Make HTTP requests to external APIs |
| `memory_store` | Store and retrieve vector memories |
| `agent_delegate` | Delegate tasks to other agents |

Your own tools can be registered as MCP servers and immediately become available to all your agents.

---

## How is my data secured?

HeadySystems uses a defense-in-depth security architecture:

**Authentication & Authorization**
- JWT tokens with capability bitmask (role-based access control)
- Multi-factor authentication required for all accounts
- Zero-trust service-to-service communication

**Data at Rest**
- PostgreSQL data encrypted with AES-256 (Google Cloud's default)
- Vector memory encrypted at rest (Cloud SQL encryption)
- Secrets stored in GCP Secret Manager, never in environment variables

**Data in Transit**
- TLS 1.3 on all external connections
- mTLS between internal services
- Perfect Forward Secrecy enabled

**Agent Sandboxing**
- Every agent runs in a zero-trust sandbox
- Code execution is sandboxed with resource limits
- Input validation against 8 threat categories
- Output scanning against 12 threat patterns

**Audit Logging**
- Every API call, tool use, and memory operation is logged
- Audit logs are SHA-256 chained (tamper-evident)
- Logs retained for fib(14)=377 days

**Compliance**
- SOC 2 Type II audit in progress
- GDPR and CCPA data handling
- Right to deletion supported (removes all user data including vector memories)

---

## What are CSL gates?

CSL stands for **Continuous Semantic Logic** — HeadySystems' framework for replacing boolean (true/false) logic with continuous values between 0.0 and 1.0.

Instead of "is this request authorized? Yes/No," HeadySystems scores every decision on a continuous scale. This enables graduated responses:

| CSL Score | Level | Meaning |
|-----------|-------|---------|
| 0.0–0.236 | DORMANT | Negligible, no action needed |
| 0.236–0.382 | LOW | Present but below threshold |
| 0.382–0.618 | MODERATE | Meaningful, attention warranted |
| 0.618–0.854 | HIGH | Strong signal, action warranted |
| 0.854–1.0 | CRITICAL | Maximum, immediate response |

**Practical examples:**
- A memory's relevance score of 0.73 (HIGH) means it will be included as context
- A security threat score of 0.91 (CRITICAL) means the request is blocked
- An agent's confidence of 0.52 (MODERATE) means the result is returned with a caveat

The thresholds 0.236, 0.382, 0.618, and 0.854 are derived from the golden ratio φ = 1.618.

---

## How does vector memory work?

Vector memory is a database of semantic embeddings — numerical representations of knowledge that capture meaning rather than exact text.

**How it works:**
1. When an agent processes information, it creates an embedding (a 1536-dimensional vector) using an embedding model
2. This vector is stored in pgvector (PostgreSQL extension for vector data)
3. When the agent needs to recall something, it creates a query embedding and finds the vectors most similar to it
4. "Similar" is measured by cosine similarity — vectors that represent related concepts cluster together

**Memory types:**
- `fact` — Objective information (company names, product specs)
- `experience` — Procedural knowledge (how to accomplish a task)
- `skill` — Learned capabilities
- `context` — Situational awareness

**Memory namespaces:**
- `global` — Available to all agents in your organization
- `agent:{id}` — Private to a specific agent
- `user:{id}` — Personal memory per user

**Privacy:**
Vector memory is organization-scoped. Your agents cannot access another organization's memories, and no memory is shared between organizations.

---

## What are the pricing tiers?

| Feature | Free | Pro ($55/mo) | Enterprise (contact us) |
|---------|------|--------------|------------------------|
| Agents | 2 | 13 | Unlimited |
| Tasks/month | 89 | 987 | Unlimited |
| MCP tools | Basic (5) | All (21+) | Custom |
| Memory (GB) | 0.5 | 5 | Custom |
| API rate limit | 34/min | 89/min | Custom |
| Team members | 1 | 8 | Unlimited |
| SLA | None | 99.9% | 99.99% |
| SSO / SAML | — | — | ✓ |
| Custom models | — | — | ✓ |

Prices and limits are Fibonacci-derived (fib(10)=55, fib(11)=89, fib(16)=987) to scale naturally with usage growth.

---

## How does billing work?

**Pro plan ($55/month)**
- Billed monthly or annually (13% discount = fib(7) percent)
- Per-seat pricing for teams: $21/month per additional seat (fib(8))
- Usage overages: $0.01 per task above your plan limit

**Enterprise plan**
- Annual contracts
- Custom pricing based on usage volume, team size, and SLA requirements
- Volume discounts apply at fib-scaled thresholds

**Trials**
- Free tier: permanent (no credit card required)
- Pro trial: fib(7)=13 days, no card required
- Enterprise trial: fib(8)=21 days with dedicated onboarding

---

## Can I export my data?

Yes. You can export all your data at any time:

1. **Dashboard:** Settings → Data → Export All Data
2. **API:** `POST /api/v1/export` (returns a signed download URL)

Export format: JSON (all agent configs, task history, memories) and CSV (billing history, usage metrics).

**Data deletion:** Under GDPR/CCPA, you can request full deletion of all data including vector memories. Processing time: fib(9)=34 days.

---

## What AI models does HeadyOS use?

HeadyOS is model-agnostic and routes to the best model for each task:

- **GPT-4o** — General reasoning, code, analysis
- **Claude 3.5 Sonnet** — Long-context tasks, document analysis
- **Gemini 1.5 Pro** — Multimodal, search-integrated tasks
- **Custom/local models** — Enterprise option for on-premises deployment

You can specify a preferred model per agent, or let the orchestrator select based on the task type and CSL confidence requirements.

---

## Is there a self-hosted / on-premises option?

Enterprise customers can deploy HeadySystems on their own infrastructure:
- Docker Compose configuration for local development
- Kubernetes manifests (`k8s/`) for production on-premises
- Helm chart (`helm/heady-systems/`) for simplified deployment
- All data stays within your network — no phone-home

Contact: enterprise@headyme.com
