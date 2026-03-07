/**
 * @fileoverview HeadyOS Pilot — Welcome Email Sequence
 * @module pilot/onboarding/welcome-emails
 *
 * 5-email sequence over 14 days (fib(7)=13 + 1 day 0).
 * Delivery schedule: Day 0, 1, 3, 5 (fib(5)), 13 (fib(7)).
 * All timing constants derive from φ = 1.618033988749895.
 */

'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** Fibonacci-indexed delivery schedule (days from activation) */
const EMAIL_SCHEDULE = [
  { index: 0, dayOffset: 0,       key: 'welcome' },
  { index: 1, dayOffset: 1,       key: 'first-agent' },
  { index: 2, dayOffset: FIB[3],  key: 'mcp-tools' },       // day 3 = fib(4)
  { index: 3, dayOffset: FIB[4],  key: 'advanced-features' }, // day 5 = fib(5)
  { index: 4, dayOffset: FIB[6],  key: 'week-2-checkin' },   // day 13 = fib(7)
];

/* ── Email Template Factory ─────────────────────────────────── */

/**
 * Day 0 — Welcome + Getting Started
 * @param {Object} ctx
 * @param {string} ctx.firstName
 * @param {string} ctx.orgName
 * @param {string} ctx.workspaceUrl
 * @param {string} ctx.activationDate
 * @param {string} ctx.expiresAt
 */
const welcomeEmail = (ctx) => ({
  subject: `Welcome to the HeadyOS Founder's Pilot, ${ctx.firstName} 🌀`,
  preheader: `Your 89-day Founder's Pilot is now active. Here's how to get started.`,
  html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to HeadyOS Founder's Pilot</title>
  <style>
    body { margin: 0; padding: 0; background: #080b10; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0d1117; }
    .header { background: linear-gradient(135deg, #131924, #1a2233); padding: 40px 40px 32px; border-bottom: 1px solid rgba(201,168,76,0.2); text-align: center; }
    .logo-mark { font-size: 32px; margin-bottom: 8px; }
    .header h1 { color: #c9a84c; font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    .header p { color: #8b9cc8; font-size: 14px; margin: 0; }
    .body { padding: 40px; }
    .greeting { font-size: 18px; color: #f0f4ff; font-weight: 600; margin-bottom: 16px; }
    p { color: #8b9cc8; font-size: 15px; line-height: 1.764; margin: 0 0 16px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #c9a84c, #8a6f30); color: #0d0e0a; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; text-decoration: none; margin: 16px 0 24px; }
    .specs-box { background: #1a2233; border: 1px solid rgba(99,148,255,0.12); border-radius: 8px; padding: 24px; margin: 24px 0; }
    .specs-box h3 { color: #6394ff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 16px; font-weight: 600; }
    .spec-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .spec-label { color: #4a5a7a; font-size: 13px; }
    .spec-value { color: #c9a84c; font-size: 13px; font-weight: 600; }
    .steps-list { list-style: none; padding: 0; margin: 0; }
    .steps-list li { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; padding: 16px; background: #131924; border: 1px solid rgba(99,148,255,0.08); border-radius: 8px; }
    .step-num { width: 24px; height: 24px; background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #c9a84c; flex-shrink: 0; }
    .step-body h4 { color: #f0f4ff; font-size: 14px; margin: 0 0 4px; }
    .step-body p { color: #4a5a7a; font-size: 13px; margin: 0; }
    .footer { padding: 24px 40px; border-top: 1px solid rgba(99,148,255,0.06); text-align: center; }
    .footer p { font-size: 12px; color: #2a3450; margin: 0; }
    .footer a { color: #3d7bd4; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-mark">◈</div>
      <h1>Welcome to the Founder's Pilot</h1>
      <p>HeadyOS — Sacred Geometry AI Orchestration</p>
    </div>

    <div class="body">
      <p class="greeting">Hello ${ctx.firstName},</p>
      <p>Your <strong style="color: #f0f4ff;">89-day Founder's Pilot</strong> for ${ctx.orgName} is now active. You're among the first fib(7)=13 organizations to access HeadyOS's φ-driven multi-agent orchestration platform.</p>

      <a href="${ctx.workspaceUrl}" class="cta-btn">→ Open Your Workspace</a>

      <div class="specs-box">
        <h3>Your Founder Tier Resources</h3>
        <div class="spec-row"><span class="spec-label">Concurrent agents</span><span class="spec-value">13 [fib(7)]</span></div>
        <div class="spec-row"><span class="spec-label">API calls / min</span><span class="spec-value">144 [fib(12)]</span></div>
        <div class="spec-row"><span class="spec-label">Vector memory</span><span class="spec-value">987 slots [fib(16)]</span></div>
        <div class="spec-row"><span class="spec-label">Storage</span><span class="spec-value">987 MB [fib(16)]</span></div>
        <div class="spec-row"><span class="spec-label">Team seats</span><span class="spec-value">5 [fib(5)]</span></div>
        <div class="spec-row"><span class="spec-label">Pilot expires</span><span class="spec-value">${ctx.expiresAt}</span></div>
      </div>

      <p>Here's what to do in your first 3 days:</p>
      <ul class="steps-list">
        <li>
          <div class="step-num">1</div>
          <div class="step-body">
            <h4>Open your workspace</h4>
            <p>Log in and explore the dashboard. Your workspace is pre-configured with Founder Tier resources.</p>
          </div>
        </li>
        <li>
          <div class="step-num">2</div>
          <div class="step-body">
            <h4>Create your first agent</h4>
            <p>We've pre-loaded the Grant Writer template. Customize it for your use case in under 5 minutes.</p>
          </div>
        </li>
        <li>
          <div class="step-num">3</div>
          <div class="step-body">
            <h4>Run your first task</h4>
            <p>Paste an RFP or document, run the agent, and see HeadyOS in action.</p>
          </div>
        </li>
        <li>
          <div class="step-num">4</div>
          <div class="step-body">
            <h4>Join the Founder Slack</h4>
            <p>You'll receive a separate invite to your dedicated #founder-${ctx.orgName?.toLowerCase().replace(/\s+/g, '-')} channel within 1 business hour.</p>
          </div>
        </li>
      </ul>

      <p>Your first office hours session is on <strong style="color: #c9a84c;">Day 13</strong> (fib(7)). A calendar invite is on its way.</p>

      <p>Questions? Reply directly to this email or reach Eric at <a href="mailto:eric@headyconnection.org" style="color: #3d7bd4;">eric@headyconnection.org</a>.</p>

      <p style="margin-top: 24px;">Welcome to the future of AI orchestration,<br/><strong style="color: #f0f4ff;">Eric Headington</strong><br/>Founder & CEO, HeadySystems Inc.</p>
    </div>

    <div class="footer">
      <p>HeadySystems Inc. | <a href="https://headyme.com">headyme.com</a> | Protected by 51+ USPTO provisional patents</p>
      <p style="margin-top: 8px;"><a href="https://www.perplexity.ai/computer">Created with Perplexity Computer</a></p>
    </div>
  </div>
</body>
</html>`,
  text: `Welcome to HeadyOS Founder's Pilot, ${ctx.firstName}!\n\nYour 89-day pilot for ${ctx.orgName} is active.\nWorkspace: ${ctx.workspaceUrl}\nExpires: ${ctx.expiresAt}\n\nResources: 13 agents | 144 API calls/min | 987 MB storage | 987 vectors | 5 seats\n\nNext steps:\n1. Open your workspace\n2. Create your first agent\n3. Run your first task\n4. Join Founder Slack\n\nOffice hours: Day 13.\nQuestions: eric@headyconnection.org\n\nEric Headington, Founder & CEO, HeadySystems Inc.`,
});

/**
 * Day 1 — "Create Your First Agent" tutorial
 */
const firstAgentEmail = (ctx) => ({
  subject: `Day 1: Create your first HeadyOS agent (5-minute tutorial)`,
  preheader: `Step-by-step: launch your first AI agent and run a task today.`,
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
body { background:#080b10; font-family:'Helvetica Neue',Arial,sans-serif; margin:0; }
.w { max-width:600px; margin:0 auto; background:#0d1117; }
.h { background:#1a2233; padding:32px 40px; border-bottom:1px solid rgba(201,168,76,0.15); }
.h h2 { color:#c9a84c; font-size:20px; margin:0 0 8px; }
.h p { color:#8b9cc8; font-size:13px; margin:0; }
.b { padding:40px; }
p { color:#8b9cc8; font-size:15px; line-height:1.764; margin:0 0 16px; }
.step { background:#131924; border:1px solid rgba(99,148,255,0.08); border-radius:8px; padding:20px; margin-bottom:12px; }
.step h4 { color:#f0f4ff; font-size:14px; margin:0 0 8px; }
.step p { margin:0; font-size:13px; }
.code { background:#0a0d14; border:1px solid rgba(99,148,255,0.15); border-radius:5px; padding:12px 16px; font-family:monospace; font-size:12px; color:#4ecba0; margin:8px 0; }
.cta { display:inline-block; background:linear-gradient(135deg,#c9a84c,#8a6f30); color:#0d0e0a; font-size:15px; font-weight:700; padding:14px 32px; border-radius:8px; text-decoration:none; margin:16px 0; }
.f { padding:24px 40px; border-top:1px solid rgba(99,148,255,0.06); text-align:center; }
.f p { font-size:12px; color:#2a3450; margin:0; }
.f a { color:#3d7bd4; }
</style></head>
<body>
<div class="w">
  <div class="h"><h2>Day 1: Create Your First Agent</h2><p>HeadyOS Founder's Pilot — Tutorial Series</p></div>
  <div class="b">
    <p>Hi ${ctx.firstName}, today's goal is simple: get your first agent running and see it complete a real task.</p>
    <div class="step"><h4>Step 1 — Open Agent Builder</h4><p>In your workspace, click <strong>Agents → New Agent</strong>. Select the <strong>Grant Writer</strong> template (or any template).</p></div>
    <div class="step"><h4>Step 2 — Configure the agent</h4><p>Give it a name and review the pre-loaded system prompt. The Grant Writer is already configured with MCP tools: <code style="color:#4ecba0;">read-document</code>, <code style="color:#4ecba0;">vector-recall</code>, <code style="color:#4ecba0;">write-document</code>.</p></div>
    <div class="step"><h4>Step 3 — Run your first task</h4><p>Paste any grant RFP or document text into the task input. Click <strong>Run</strong>. Your agent will invoke heady-conductor and process the task through the CSL pipeline.</p>
      <div class="code">POST /v1/agents/{agentId}/run\n{\n  "input": "Analyze this RFP and draft a response...",\n  "maxTokens": 720,\n  "cslLevel": "MODERATE"\n}</div>
    </div>
    <div class="step"><h4>Step 4 — Review the output</h4><p>Check the audit trail for each step. Your SHA-256 chain captures every tool call. Review the draft and iterate.</p></div>
    <a href="${ctx.workspaceUrl}/agents" class="cta">→ Open Agent Builder</a>
    <p>Having trouble? Reply to this email or message in your Founder Slack channel.</p>
    <p>Tomorrow: nothing from us. Day 3, we'll show you the MCP tool catalog.</p>
  </div>
  <div class="f"><p>HeadySystems Inc. | <a href="https://headyme.com">headyme.com</a> | <a href="https://www.perplexity.ai/computer">Created with Perplexity Computer</a></p></div>
</div>
</body></html>`,
  text: `Day 1: Create Your First HeadyOS Agent\n\nHi ${ctx.firstName},\n\n1. Open Agent Builder → New Agent → Grant Writer template\n2. Review system prompt and MCP tools\n3. Paste an RFP, click Run\n4. Review output and audit trail\n\nAgent run API:\nPOST /v1/agents/{agentId}/run\n{ "input": "...", "maxTokens": 720, "cslLevel": "MODERATE" }\n\nWorkspace: ${ctx.workspaceUrl}/agents`,
});

/**
 * Day 3 — "Explore MCP Tools" + use case examples
 */
const mcpToolsEmail = (ctx) => ({
  subject: `Day 3: Explore the MCP Tool Catalog — 8 tools unlocked for your pilot`,
  preheader: `Connect web search, vector memory, document tools, and more via the zero-trust MCP gateway.`,
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
body{background:#080b10;font-family:'Helvetica Neue',Arial,sans-serif;margin:0}
.w{max-width:600px;margin:0 auto;background:#0d1117}
.h{background:#1a2233;padding:32px 40px;border-bottom:1px solid rgba(46,168,126,0.2)}
.h h2{color:#4ecba0;font-size:20px;margin:0 0 8px}
.h p{color:#8b9cc8;font-size:13px;margin:0}
.b{padding:40px}
p{color:#8b9cc8;font-size:15px;line-height:1.764;margin:0 0 16px}
.tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}
.tool{background:#131924;border:1px solid rgba(99,148,255,0.08);border-radius:8px;padding:16px}
.tool h4{color:#f0f4ff;font-size:13px;margin:0 0 4px}
.tool p{color:#4a5a7a;font-size:12px;margin:0}
.tool .tag{display:inline-block;background:rgba(46,168,126,0.1);border:1px solid rgba(46,168,126,0.2);border-radius:99px;font-size:10px;color:#4ecba0;padding:2px 8px;margin-top:6px}
.case{background:#1a2233;border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:20px;margin-bottom:12px}
.case h4{color:#c9a84c;font-size:14px;margin:0 0 8px}
.case p{font-size:13px;margin:0}
.cta{display:inline-block;background:linear-gradient(135deg,#2ea87e,#1e7358);color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;margin:16px 0}
.f{padding:24px 40px;border-top:1px solid rgba(99,148,255,0.06);text-align:center}
.f p{font-size:12px;color:#2a3450;margin:0}
.f a{color:#3d7bd4}
</style></head>
<body>
<div class="w">
  <div class="h"><h2>Day 3: Explore MCP Tools</h2><p>HeadyOS Founder's Pilot — Tutorial Series</p></div>
  <div class="b">
    <p>Hi ${ctx.firstName}, the heady-mcp gateway gives your agents access to external tools in a zero-trust sandbox. Every tool call is logged in the SHA-256 audit chain.</p>
    <p><strong style="color:#f0f4ff;">Tools available in your Founder Tier:</strong></p>
    <div class="tool-grid">
      <div class="tool"><h4>web-search</h4><p>Real-time web search for grant research, fact-checking, and source discovery.</p><span class="tag">READ</span></div>
      <div class="tool"><h4>read-document</h4><p>Parse PDFs, Word docs, and text files. Supports up to 34 MB uploads.</p><span class="tag">READ</span></div>
      <div class="tool"><h4>write-document</h4><p>Generate formatted documents: grant proposals, reports, summaries.</p><span class="tag">WRITE</span></div>
      <div class="tool"><h4>vector-recall</h4><p>Query your 987-slot vector memory for similar past content.</p><span class="tag">MEMORY</span></div>
      <div class="tool"><h4>vector-store</h4><p>Store new content in vector memory for future retrieval.</p><span class="tag">MEMORY</span></div>
      <div class="tool"><h4>summarize</h4><p>Extract key points, action items, and summaries from long documents.</p><span class="tag">ANALYZE</span></div>
      <div class="tool"><h4>extract-entities</h4><p>Pull out people, organizations, dates, dollar amounts from documents.</p><span class="tag">ANALYZE</span></div>
      <div class="tool"><h4>send-webhook</h4><p>Trigger external webhooks upon task completion for workflow automation.</p><span class="tag">INTEGRATE</span></div>
    </div>
    <p><strong style="color:#f0f4ff;">Use case example — Grant Writing Pipeline:</strong></p>
    <div class="case"><h4>Step 1: Ingest RFP</h4><p>Agent uses <code>read-document</code> to parse the funding RFP. <code>extract-entities</code> pulls eligibility criteria, deadlines, and dollar amounts.</p></div>
    <div class="case"><h4>Step 2: Research</h4><p>Agent uses <code>web-search</code> + <code>vector-recall</code> to find relevant data points and past successful grants in memory.</p></div>
    <div class="case"><h4>Step 3: Draft</h4><p>Agent uses <code>write-document</code> to produce a formatted grant proposal. <code>vector-store</code> saves the draft to memory for future reference.</p></div>
    <a href="${ctx.workspaceUrl}/mcp-tools" class="cta">→ Explore MCP Tool Catalog</a>
    <p>Day 5, we'll cover advanced features: vector memory management and the conductor multi-agent pattern.</p>
  </div>
  <div class="f"><p>HeadySystems Inc. | <a href="https://headyme.com">headyme.com</a> | <a href="https://www.perplexity.ai/computer">Created with Perplexity Computer</a></p></div>
</div>
</body></html>`,
  text: `Day 3: Explore MCP Tools\n\nHi ${ctx.firstName},\n\nTools unlocked: web-search, read-document, write-document, vector-recall, vector-store, summarize, extract-entities, send-webhook\n\nGrant writing pipeline:\n1. read-document → parse RFP\n2. extract-entities → pull criteria\n3. web-search + vector-recall → research\n4. write-document → draft proposal\n\nExplore: ${ctx.workspaceUrl}/mcp-tools`,
});

/**
 * Day 5 (fib(5)) — "Advanced Features": vector memory, conductor
 */
const advancedFeaturesEmail = (ctx) => ({
  subject: `Day 5: Advanced Features — Vector Memory & Multi-Agent Conductor`,
  preheader: `Learn how to use persistent vector memory and coordinate multiple agents with heady-conductor.`,
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
body{background:#080b10;font-family:'Helvetica Neue',Arial,sans-serif;margin:0}
.w{max-width:600px;margin:0 auto;background:#0d1117}
.h{background:linear-gradient(135deg,#131924,#1a2233);padding:32px 40px;border-bottom:1px solid rgba(61,123,212,0.2)}
.h h2{color:#6394ff;font-size:20px;margin:0 0 8px}
.h p{color:#8b9cc8;font-size:13px;margin:0}
.b{padding:40px}
p{color:#8b9cc8;font-size:15px;line-height:1.764;margin:0 0 16px}
.feature-box{background:#131924;border:1px solid rgba(61,123,212,0.12);border-radius:8px;padding:24px;margin-bottom:16px}
.feature-box h3{color:#6394ff;font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.feature-box p{font-size:13px;margin:0 0 12px}
.code{background:#0a0d14;border:1px solid rgba(99,148,255,0.15);border-radius:5px;padding:10px 14px;font-family:monospace;font-size:11px;color:#4ecba0;margin:8px 0}
.tip{background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:16px;margin:16px 0}
.tip p{font-size:13px;color:#c9a84c;margin:0}
.cta{display:inline-block;background:linear-gradient(135deg,#3d7bd4,#2a5499);color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;margin:16px 0}
.f{padding:24px 40px;border-top:1px solid rgba(99,148,255,0.06);text-align:center}
.f p{font-size:12px;color:#2a3450;margin:0}
.f a{color:#3d7bd4}
</style></head>
<body>
<div class="w">
  <div class="h"><h2>Day 5: Advanced Features</h2><p>HeadyOS Founder's Pilot — Tutorial Series</p></div>
  <div class="b">
    <p>Hi ${ctx.firstName}, today we cover two of HeadyOS's most powerful differentiators: <strong style="color:#f0f4ff;">persistent vector memory</strong> and <strong style="color:#f0f4ff;">multi-agent coordination</strong> via heady-conductor.</p>

    <div class="feature-box">
      <h3>⟁ Vector Memory (987 slots)</h3>
      <p>Your workspace includes fib(16)=987 persistent vector memory slots backed by pgvector. Store embeddings of documents, grants, research, and agent outputs. Retrieve them in future tasks with cosine similarity search.</p>
      <div class="code">// Store a memory\nPOST /v1/memory\n{ "content": "Grant RFP #2024-001 requirements...", "namespace": "grants", "metadata": { "rfp_id": "2024-001" } }\n\n// Recall memories\nPOST /v1/memory/search\n{ "query": "education grant eligibility", "topK": 5, "namespace": "grants" }</div>
      <p>φ tip: Store fib(5)=5 memories per completed task. After fib(11)=89 days, you'll have a rich institutional memory base to carry into the Pro tier.</p>
    </div>

    <div class="feature-box">
      <h3>◈ Multi-Agent Conductor</h3>
      <p>heady-conductor lets you orchestrate up to fib(7)=13 agents simultaneously. Use the Pipeline pattern for sequential tasks, or Fan-Out for parallel research.</p>
      <div class="code">// Grant writing pipeline\nPOST /v1/conductor/pipeline\n{\n  "stages": [\n    { "agent": "doc-analyzer", "input": "rfp_text" },\n    { "agent": "researcher",   "input": "prev.criteria" },\n    { "agent": "grant-writer", "input": "prev.research" },\n    { "agent": "reviewer",    "input": "prev.draft" }\n  ],\n  "maxAgents": 13\n}</div>
    </div>

    <div class="tip"><p>💡 <strong>Founder tip:</strong> The CSL (Contextual Semantic Logic) gate automatically adjusts agent behavior based on context complexity. CSL level MODERATE is recommended for grant writing — it enables deep reasoning without exceeding latency targets.</p></div>

    <a href="${ctx.workspaceUrl}/docs/advanced" class="cta">→ Advanced Features Docs</a>
    <p>Day 13 is your first office hours with Eric. Bring your questions, use cases, and feature requests.</p>
  </div>
  <div class="f"><p>HeadySystems Inc. | <a href="https://headyme.com">headyme.com</a> | <a href="https://www.perplexity.ai/computer">Created with Perplexity Computer</a></p></div>
</div>
</body></html>`,
  text: `Day 5: Advanced Features\n\nVector Memory: 987 slots, pgvector, cosine similarity\nMulti-Agent Conductor: up to 13 parallel agents\n\nVector API:\nPOST /v1/memory — store\nPOST /v1/memory/search — recall\n\nConductor pipeline:\nPOST /v1/conductor/pipeline\n{ stages: [{ agent, input }...] }\n\nDocs: ${ctx.workspaceUrl}/docs/advanced\nDay 13: Office hours with Eric`,
});

/**
 * Day 13 (fib(7)) — "Week 2 Check-in": NPS survey, feedback form, office hours
 */
const week2CheckinEmail = (ctx) => ({
  subject: `Day 13: How's your pilot going? NPS survey + office hours invite`,
  preheader: `Quick check-in: share feedback, complete NPS, and join office hours today.`,
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
body{background:#080b10;font-family:'Helvetica Neue',Arial,sans-serif;margin:0}
.w{max-width:600px;margin:0 auto;background:#0d1117}
.h{background:linear-gradient(135deg,#1a2233,#212d42);padding:32px 40px;border-bottom:1px solid rgba(201,168,76,0.2)}
.h h2{color:#f0f4ff;font-size:20px;margin:0 0 8px}
.h p{color:#8b9cc8;font-size:13px;margin:0}
.b{padding:40px}
p{color:#8b9cc8;font-size:15px;line-height:1.764;margin:0 0 16px}
.progress-bar-wrap{background:#131924;border:1px solid rgba(99,148,255,0.08);border-radius:8px;padding:20px;margin-bottom:20px}
.progress-bar-wrap h4{color:#f0f4ff;font-size:13px;margin:0 0 12px}
.progress-bar{background:#1a2233;border-radius:99px;height:8px;overflow:hidden;margin-bottom:8px}
.progress-fill{height:100%;background:linear-gradient(90deg,#c9a84c,#e4c068);border-radius:99px;width:14.6%}
.progress-label{font-size:12px;color:#4a5a7a}
.nps-box{background:#131924;border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:24px;margin-bottom:16px;text-align:center}
.nps-box h3{color:#c9a84c;font-size:15px;margin:0 0 8px}
.nps-box p{font-size:13px;margin:0 0 16px}
.nps-btn{display:inline-block;background:linear-gradient(135deg,#c9a84c,#8a6f30);color:#0d0e0a;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none}
.oh-box{background:#131924;border:1px solid rgba(61,123,212,0.15);border-radius:8px;padding:24px;margin-bottom:16px}
.oh-box h3{color:#6394ff;font-size:15px;margin:0 0 8px}
.oh-box p{font-size:13px;margin:0 0 12px}
.oh-btn{display:inline-block;background:linear-gradient(135deg,#3d7bd4,#2a5499);color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none}
.f{padding:24px 40px;border-top:1px solid rgba(99,148,255,0.06);text-align:center}
.f p{font-size:12px;color:#2a3450;margin:0}
.f a{color:#3d7bd4}
</style></head>
<body>
<div class="w">
  <div class="h"><h2>Day 13 Check-In</h2><p>HeadyOS Founder's Pilot — Week 2</p></div>
  <div class="b">
    <p>Hi ${ctx.firstName}, you're 13 days in (fib(7)). You have 76 days remaining in your Founder's Pilot. Today is your first office hours — and we'd love to hear how it's going.</p>

    <div class="progress-bar-wrap">
      <h4>Pilot Progress</h4>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <p class="progress-label">Day 13 of 89 (14.6%) — 76 days remaining</p>
    </div>

    <div class="nps-box">
      <h3>📊 Quick NPS Survey (2 min)</h3>
      <p>How likely are you to recommend HeadyOS to a colleague? (Required per your pilot agreement — takes 2 minutes.)</p>
      <a href="${ctx.npsUrl || ctx.workspaceUrl + '/nps?day=13'}" class="nps-btn">Complete NPS Survey</a>
    </div>

    <div class="oh-box">
      <h3>📅 Office Hours — Today</h3>
      <p>Join Eric and the HeadyOS team for your first Founder's office hours. Bring use cases, blockers, and feature requests. This session shapes our roadmap.</p>
      <p><strong style="color:#f0f4ff;">Agenda:</strong> Your use case review (10 min) → Technical Q&A (15 min) → Feature voting (10 min) → Roadmap preview (10 min)</p>
      <a href="${ctx.officeHoursUrl || 'https://cal.com/headysystems/office-hours'}" class="oh-btn">→ Join Office Hours</a>
    </div>

    <p>Upcoming milestones:</p>
    <ul style="color:#8b9cc8;font-size:14px;padding-left:20px;line-height:2;">
      <li>Day 21 — NPS #2 + Mid-pilot feature voting</li>
      <li>Day 26 — Technical deep-dive office hours</li>
      <li>Day 55 — NPS #3 + Pre-conversion discussion</li>
      <li>Day 89 — Pilot graduation</li>
    </ul>

    <p>As always, reach me directly at <a href="mailto:eric@headyconnection.org" style="color:#3d7bd4;">eric@headyconnection.org</a> or in your Founder Slack channel.</p>
  </div>
  <div class="f"><p>HeadySystems Inc. | <a href="https://headyme.com">headyme.com</a> | <a href="https://www.perplexity.ai/computer">Created with Perplexity Computer</a></p></div>
</div>
</body></html>`,
  text: `Day 13 Check-In\n\nHi ${ctx.firstName},\n13 days in (fib(7)). 76 days remaining.\n\n1. Complete NPS survey: ${ctx.npsUrl || ctx.workspaceUrl + '/nps?day=13'}\n2. Join office hours today: ${ctx.officeHoursUrl || 'https://cal.com/headysystems/office-hours'}\n\nUpcoming: Day 21 NPS | Day 26 tech deep-dive | Day 55 NPS | Day 89 graduation\n\nEric — eric@headyconnection.org`,
});

/* ── Email Sequence Manager ─────────────────────────────────── */

/**
 * Get all email templates for a user context.
 * @param {Object} ctx - User context: firstName, orgName, workspaceUrl, etc.
 * @returns {Array} Ordered email sequence with schedule.
 */
const getEmailSequence = (ctx) => [
  { ...EMAIL_SCHEDULE[0], ...welcomeEmail(ctx) },
  { ...EMAIL_SCHEDULE[1], ...firstAgentEmail(ctx) },
  { ...EMAIL_SCHEDULE[2], ...mcpToolsEmail(ctx) },
  { ...EMAIL_SCHEDULE[3], ...advancedFeaturesEmail(ctx) },
  { ...EMAIL_SCHEDULE[4], ...week2CheckinEmail(ctx) },
];

/**
 * Calculate scheduled send times from activation date.
 * @param {string} activationDate - ISO date string
 * @returns {Array} Sequence with scheduled send times
 */
const scheduleEmailSequence = (ctx, activationDate) => {
  const activation = new Date(activationDate);
  return getEmailSequence(ctx).map(email => ({
    ...email,
    scheduledFor: new Date(
      activation.getTime() + email.dayOffset * 24 * 60 * 60 * 1000
    ).toISOString(),
  }));
};

/* ── Export ──────────────────────────────────────────────────── */
module.exports = {
  getEmailSequence,
  scheduleEmailSequence,
  EMAIL_SCHEDULE,
  welcomeEmail,
  firstAgentEmail,
  mcpToolsEmail,
  advancedFeaturesEmail,
  week2CheckinEmail,
  PHI,
  FIB,
};
