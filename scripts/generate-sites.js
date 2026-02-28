/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Site Generator v3 — SACRED GEOMETRY EDITION
 * Produces visually-immense, breathing interfaces using cosmic starfields
 * and sacred geometric patterns as requested.
 */

const fs = require('fs');
const path = require('path');

const SITES_DIR = '/home/headyme/sites';

// ── Shared Content Elements ──────────────────────────────────────────

const HEADY_LOOP_STEPS = [
  { name: 'Ask', desc: 'Intent captured via voice, chat, or API.' },
  { name: 'Plan', desc: 'HeadyJules decomposes into DAG subtasks.' },
  { name: 'Route', desc: 'HeadyConductor selects optimal AI node via federated liquid routing.' },
  { name: 'Execute', desc: 'Concurrent execution across 20 AI nodes with PQC-signed handshakes.' },
  { name: 'Validate', desc: 'Arena Mode & HeadyBattle Socratic cross-validation.' },
  { name: 'Prove', desc: 'Cryptographic Proof View receipt — models, cost, latency, and scores.' },
];

// ── Site Definitions (February 2026 — Production Live) ──────────────
const sites = [
  {
    id: 'headyme', dir: 'headyme',
    title: 'HeadyMe — Your AI Command Center',
    tagline: 'One dashboard. Every device. Total intelligence.',
    description: 'HeadyMe is the unified command center for the Heady AI ecosystem — 20 nodes, 7 domains, and all your data converge into a single, private-by-default dashboard powered by the HCFP auto-success engine.',
    gradient: ['#7C3AED', '#2563EB'], accent: '#818cf8', icon: '🧠',
    geoType: 'Flower of Life',
    buyer: 'Individual prosumer / power user',
    workflow: '"Show me everything I worked on this week across all devices, and what\'s left to do"',
    integrations: ['Calendar', 'Email', 'GitHub', 'Notion', 'DuckDB Vector Memory'],
    features: [
      { icon: '🔄', title: 'Cross-Device Memory', desc: 'DuckDB vector memory syncs your context across every device, every session — no cloud required.' },
      { icon: '📋', title: 'HCFP Auto-Planning', desc: 'The auto-success engine generates and prioritizes your daily tasks from calendar, repos, and goals.' },
      { icon: '🏆', title: 'Arena Optimization', desc: '20 AI nodes compete in real-time to find the optimal approach to every task you throw at them.' },
      { icon: '🔐', title: 'PQC Private by Design', desc: 'Quantum-resistant SHA3-256 HMAC signatures. Your data stays on your hardware. Period.' },
    ],
    cta: 'Launch Your Dashboard', ctaHref: 'https://app.headyme.com', domain: 'headyme.com',
  },
  {
    id: 'headysystems', dir: 'headysystems',
    title: 'HeadySystems — The Architecture of Intelligence',
    tagline: 'Self-healing infrastructure. Zero human intervention.',
    description: 'HeadySystems is the operational backbone — HeadyConductor federated routing, HCFP auto-success remediation, 20-node orchestration, and real-time drift detection across 7 production domains.',
    gradient: ['#059669', '#0D9488'], accent: '#34D399', icon: '⚡',
    geoType: 'Metatrons Cube',
    buyer: 'Platform architect / DevOps lead',
    workflow: '"Show me all 20 nodes, their health, latency, and auto-fix any degraded services"',
    integrations: ['HeadyConductor', 'Cloudflare Tunnel', 'DuckDB', 'Redis Rate Limiter', 'GitHub Actions CI'],
    features: [
      { icon: '📊', title: '20-Node Observatory', desc: 'HeadyConductor routes across 20 AI nodes, 9 service groups, and 7 live domains — one pane of glass.' },
      { icon: '🔧', title: 'HCFP Auto-Success', desc: 'The full-auto pipeline detects issues, proposes Arena-validated fixes, and applies them autonomously.' },
      { icon: '🛡️', title: 'PQC Security Mesh', desc: 'SHA3-256 HMAC node handshakes, env validation on startup, and TruffleHog secret scanning in CI.' },
      { icon: '📈', title: 'Sacred Geometry Scaling', desc: 'Fibonacci-spaced auto-scaling with golden ratio resource allocation across the service mesh.' },
    ],
    cta: 'Open Operations Console', ctaHref: 'https://app.headysystems.com', domain: 'headysystems.com',
  },
  {
    id: 'headyconnection', dir: 'headyconnection',
    title: 'HeadyConnection — AI for Nonprofit Impact',
    tagline: 'Amplify your mission. Prove your impact.',
    description: 'HeadyConnection empowers nonprofits with AI-powered grant writing, impact measurement, and donor engagement — every output backed by a cryptographic Proof View audit trail.',
    gradient: ['#D97706', '#DC2626'], accent: '#FBBF24', icon: '🤝',
    geoType: 'Seed of Life',
    buyer: 'Nonprofit executive / program director',
    workflow: '"Generate a grant application for our new community program, cite our real data, and produce a Proof View receipt"',
    integrations: ['Donor CRM', 'Impact Tracking', 'Document Generation', 'Proof View Receipts'],
    features: [
      { icon: '📝', title: 'AI Grant Writing', desc: 'Generate grant applications backed by your organization\'s real data. Every claim is verifiable.' },
      { icon: '📊', title: 'Impact Analytics', desc: 'Auto-generate outcome reports with measurable KPIs that funders actually trust.' },
      { icon: '✅', title: 'Proof View Receipts', desc: 'Cryptographic audit trail for every AI output — which models ran, what data was used, and the confidence score.' },
      { icon: '👥', title: 'Volunteer Intelligence', desc: 'AI-driven skill and schedule matching connects the right volunteers to the right opportunities.' },
    ],
    cta: 'Start Amplifying Impact', ctaHref: 'https://app.headyconnection.org', domain: 'headyconnection.org',
  },
  {
    id: 'headymcp', dir: 'headymcp',
    title: 'HeadyMCP — The MCP Protocol Hub',
    tagline: 'Discover. Trust. Deploy.',
    description: 'The verified registry for Model Context Protocol connectors — security-scanned, quality-scored, and one-click deployable into any Heady-powered IDE or app.',
    gradient: ['#7C3AED', '#EC4899'], accent: '#C084FC', icon: '🔌',
    geoType: 'Metatrons Cube',
    buyer: 'Developer building AI integrations',
    workflow: '"Find a verified MCP connector for Stripe, check its security score, and install it in one click"',
    integrations: ['npm Registry', 'GitHub', 'HeadyBattle Security Scanner', 'Telemetry'],
    features: [
      { icon: '🔍', title: 'Connector Discovery', desc: 'Search hundreds of MCP connectors by category, quality score, and verified publisher.' },
      { icon: '✓', title: 'HeadyBattle Trust Score', desc: 'Every connector is Arena-validated, security-scanned, and rated before listing.' },
      { icon: '⚡', title: 'One-Click Deploy', desc: 'Install connectors to HeadyBuddy, VS Code, Chrome extensions, or apps instantly.' },
      { icon: '🏗️', title: 'Publish & Monetize', desc: 'Build, publish, and earn from your connectors with full governance pipeline support.' },
    ],
    cta: 'Browse Connectors', ctaHref: 'https://headymcp.com', domain: 'headymcp.com',
  },
  {
    id: 'headyio', dir: 'headyio',
    title: 'HeadyIO — Developer Intelligence Hub',
    tagline: 'Build with 20 AI nodes. Ship in minutes.',
    description: 'The developer portal for the Heady ecosystem — REST API docs, the Hive SDK, Arena Mode API, and everything you need to integrate 20 AI nodes into your stack.',
    gradient: ['#1E40AF', '#3B82F6'], accent: '#60A5FA', icon: '💻',
    geoType: 'Metatrons Cube',
    buyer: 'Developer / technical architect',
    workflow: '"Show me how to add federated AI routing to my app in 5 minutes using the Hive SDK"',
    integrations: ['Hive SDK (JS/Python/Go)', 'Arena Mode API', 'Edge Workers API', 'MCP Protocol'],
    features: [
      { icon: '📚', title: 'Live API Reference', desc: 'Complete REST docs with interactive playground — test every endpoint with your API key.' },
      { icon: '🧰', title: 'Hive SDK', desc: 'JavaScript, Python, and Go SDKs with built-in HeadyConductor routing and Proof View receipts.' },
      { icon: '🏎️', title: 'Arena Mode API', desc: 'Run multi-node AI competitions programmatically — HeadyBattle validates every response.' },
      { icon: '🔑', title: 'PQC-Signed Auth', desc: 'Quantum-resistant API keys with SHA3-256 HMAC signatures and Redis rate limiting.' },
    ],
    cta: 'Read the Docs', ctaHref: 'https://api.headyio.com', domain: 'headyio.com',
  },
  {
    id: 'headybuddy', dir: 'headybuddy',
    title: 'HeadyBuddy — Swarm Commander',
    tagline: 'Always learning. Always there. Always executing.',
    description: 'HeadyBuddy is your personal AI Swarm Commander — voice-activated, cross-device, and equipped with HeadyBees, a fleet of headless browser agents ready to execute workflows on your behalf.',
    gradient: ['#EC4899', '#8B5CF6'], accent: '#F472B6', icon: '🤖',
    geoType: 'Flower of Life',
    buyer: 'Knowledge worker / prosumer',
    workflow: '"Hey Buddy, swarm the HeadyBees to research competitors, scrape the latest pricing, and generate a report"',
    integrations: ['Email', 'Slack', 'DuckDB Vector Memory', 'Voice-to-Text Relay', 'HeadySwarm', 'HeadyBees'],
    features: [
      { icon: '🎤', title: 'Voice Activation', desc: 'Talk naturally on any device. HeadyBuddy transcribes, understands context, and acts.' },
      { icon: '🐝', title: 'Task Completion Swarm', desc: 'Delegate complex workflows to HeadySwarm, orchestrating headless browser HeadyBees to complete tasks autonomously.' },
      { icon: '🧠', title: 'DuckDB Vector Memory', desc: 'Persistent semantic memory that learns your preferences, style, and conversation history.' },
      { icon: '🛡️', title: 'Arena-Validated', desc: '20 AI nodes compete on every response. HeadyBattle picks the best, Proof View proves it.' },
    ],
    cta: 'Command Your Swarm', ctaHref: 'https://app.headybuddy.org', domain: 'headybuddy.org',
  }
];

// Combine standard and aliased versions
const allSites = [...sites];
sites.forEach(s => {
  if (s.id !== 'headyme') {
    const alias = { ...s, id: s.id + '-com', dir: s.dir + '-com' };
    if (s.id === 'headybuddy' || s.id === 'headyconnection') {
      alias.id = s.id + '-org'; alias.dir = s.dir + '-org';
    }
    allSites.push(alias);
  } else {
    allSites.push({ ...s, id: 'headyme-com', dir: 'headyme-com' });
  }
});
allSites.push({
  id: 'instant', dir: 'instant',
  title: '1ime1 — Instant Everything', tagline: 'One prompt. Zero friction. Live in seconds.',
  description: 'Instant access to the full Heady AI platform — generate, deploy, and iterate on websites, APIs, and creative assets in real-time with 20-node parallel execution.',
  gradient: ['#F59E0B', '#EF4444'], accent: '#FCD34D', icon: '⚡',
  geoType: 'Seed of Life',
  buyer: 'Speed-focused creator / founder', workflow: '"Build and deploy my idea in 60 seconds with AI-generated assets"',
  integrations: ['Heady Edge Workers', 'Arena Mode', 'Creative AI Pipeline'],
  features: [
    { icon: '🚀', title: 'Instant Deploy', desc: 'Ship websites, APIs, and AI workflows in seconds — HeadyConductor routes to the fastest node.' },
    { icon: '🎨', title: 'AI Creative Engine', desc: 'Generate images, copy, code, and designs with one prompt. 20 nodes compete for the best output.' },
    { icon: '⏱️', title: 'Real-Time Streaming', desc: 'Everything streams live. No page reloads. No waiting. WebSocket-first architecture.' },
    { icon: '🔮', title: 'Predictive Execution', desc: 'HCFP anticipates what you need and pre-fetches resources before you ask.' },
  ],
  cta: 'Try it Now', ctaHref: 'https://1ime1.com', domain: '1ime1.com'
});

// ── HTML Generator ───────────────────────────────────────────────────

function generateSite(site) {
  const [g1, g2] = site.gradient;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.title}</title>
  <meta name="description" content="${site.description}">
  <meta name="theme-color" content="${g1}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${site.icon}</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --g1: ${g1}; --g2: ${g2}; --accent: ${site.accent};
      --bg: #000000; --surface: rgba(15,15,20,0.18); --surface-2: rgba(25,25,35,0.4);
      --text: #e2e8f0; --text-muted: rgba(255,255,255,0.6); --border: rgba(255,255,255,0.06);
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      background: #000000; color: var(--text);
      line-height: 1.6; overflow-x: hidden; min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    #cosmic-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .site-wrap { position: relative; z-index: 10; display: flex; flex-direction: column; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    
    /* ── Header ── */
    header { padding: 24px 0; display: flex; justify-content: space-between; align-items: center; }
    .logo-wrap { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .logo-title { font-size: 1.4rem; font-weight: 700; color: var(--accent); letter-spacing: 1px; text-shadow: 0 0 10px rgba(129,140,248,0.4); }
    .logo-sub { font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.15em; text-transform: uppercase; }
    nav { display: flex; gap: 8px; background: rgba(20,20,25,0.12); padding: 6px; border-radius: 100px; backdrop-filter: blur(10px); border: 1px solid var(--border); }
    nav a { padding: 6px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: all 0.3s; }
    nav a:hover, nav a.active { background: var(--accent); color: #000; box-shadow: 0 0 15px var(--accent); }

    /* ── Hero ── */
    .hero { flex: 1; padding: 100px 0 60px; text-align: center; display: flex; flex-direction: column; align-items: center; }
    .status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 50px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); backdrop-filter: blur(10px); font-size: 0.7rem; color: #fff; margin-bottom: 2rem; letter-spacing: 1px; text-transform: uppercase; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 2s ease infinite; box-shadow: 0 0 10px var(--accent); }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.8); } }
    .hero h1 { font-size: clamp(3rem, 8vw, 5rem); font-weight: 800; color: var(--accent); margin-bottom: 1rem; letter-spacing: -0.03em; text-shadow: 0 0 30px rgba(129,140,248,0.3); }
    .hero-sub { font-size: 1.2rem; color: #fff; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; opacity: 0.9; }
    .sacred-badge { display: inline-block; padding: 6px 18px; border: 1px solid rgba(129,140,248,0.25); border-radius: 50px; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em; color: var(--accent); text-transform: uppercase; margin-bottom: 2rem; backdrop-filter: blur(8px); }
    .hero-mantra { font-size: 0.9rem; color: var(--text-muted); max-width: 600px; margin-bottom: 3rem; letter-spacing: 0.05em; }
    
    .btn { padding: 14px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; transition: all 0.3s; cursor: pointer; border: none; font-size: 1rem; }
    .btn-primary { background: var(--accent); color: #000; box-shadow: 0 0 20px var(--accent)44; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 30px var(--accent)66; }

    /* ── Playbook Metadata ── */
    .playbook { padding: 60px 0; border-top: 1px solid var(--border); }
    .p-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .p-card { background: var(--surface); padding: 32px; border-radius: 24px; backdrop-filter: blur(12px); border: 1px solid var(--border); }
    .p-card h3 { font-size: 0.7rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px; }
    .p-card p { font-size: 1rem; font-weight: 500; color: #fff; line-height: 1.5; }

    /* ── Features ── */
    .features { padding: 80px 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .f-card { background: var(--surface); padding: 40px; border-radius: 24px; backdrop-filter: blur(12px); border: 1px solid var(--border); transition: all 0.4s; position: relative; overflow: hidden; }
    .f-card:hover { transform: translateY(-5px); border-color: rgba(129,140,248,0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    .f-icon { font-size: 2rem; margin-bottom: 1.5rem; color: var(--accent); }
    .f-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; color: #fff; }
    .f-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.8; }

    /* ── Footer ── */
    footer { padding: 60px 0; text-align: center; color: var(--text-muted); font-size: 0.75rem; letter-spacing: 1px; }

    /* ── Chat Widget ── */
    .buddy-fab { position: fixed; bottom: 24px; right: 24px; z-index: 9999; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--g1), var(--g2)); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 30px var(--accent)33; transition: all 0.3s; }
    .buddy-fab:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(0,0,0,0.6), 0 0 40px var(--accent)55; }
    .buddy-panel { position: fixed; bottom: 90px; right: 24px; z-index: 9998; width: 380px; max-height: 520px; background: rgba(10,10,15,0.95); border: 1px solid var(--border); border-radius: 20px; backdrop-filter: blur(20px); display: none; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.8); }
    .buddy-panel.open { display: flex; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .buddy-header { padding: 16px 20px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); background: rgba(20,20,30,0.6); }
    .buddy-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 2s ease infinite; }
    .buddy-header span { font-size: 0.85rem; font-weight: 600; color: #fff; }
    .buddy-header .close-btn { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; }
    .buddy-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 280px; }
    .buddy-msg { max-width: 85%; padding: 10px 14px; border-radius: 16px; font-size: 0.82rem; line-height: 1.5; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .buddy-msg.bot { background: rgba(255,255,255,0.08); color: var(--text); align-self: flex-start; border-bottom-left-radius: 4px; }
    .buddy-msg.user { background: var(--accent); color: #000; align-self: flex-end; border-bottom-right-radius: 4px; font-weight: 500; }
    .buddy-input-wrap { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; background: rgba(15,15,25,0.6); }
    .buddy-input-wrap input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; color: #fff; font-size: 0.82rem; outline: none; }
    .buddy-input-wrap input:focus { border-color: var(--accent); }
    .buddy-input-wrap button { background: var(--accent); border: none; border-radius: 12px; padding: 10px 16px; color: #000; font-weight: 700; cursor: pointer; font-size: 0.82rem; transition: all 0.2s; }
    .buddy-input-wrap button:hover { transform: scale(1.05); }
    .buddy-typing { display: flex; gap: 4px; padding: 10px 14px; align-self: flex-start; }
    .buddy-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: typingDot 1.2s ease infinite; }
    .buddy-typing span:nth-child(2) { animation-delay: 0.2s; }
    .buddy-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingDot { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

    /* ── Auth Modal ── */
    .auth-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; }
    .auth-overlay.open { display: flex; animation: fadeIn 0.3s ease; }
    .auth-modal { background: rgba(15,15,25,0.95); border: 1px solid var(--border); border-radius: 24px; padding: 40px; width: 400px; max-width: 90vw; text-align: center; backdrop-filter: blur(20px); }
    .auth-modal h2 { font-size: 1.5rem; color: #fff; margin-bottom: 8px; }
    .auth-modal p { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px; }
    .auth-btn { width: 100%; padding: 14px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s; border: 1px solid var(--border); margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .auth-btn.google { background: #fff; color: #333; }
    .auth-btn.google:hover { background: #f0f0f0; transform: translateY(-1px); }
    .auth-btn.email { background: var(--accent); color: #000; border-color: var(--accent); }
    .auth-btn.email:hover { transform: translateY(-1px); box-shadow: 0 4px 15px var(--accent)44; }
    .auth-btn.skip { background: transparent; color: var(--text-muted); border-color: transparent; font-size: 0.8rem; }
    .auth-divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: var(--text-muted); font-size: 0.75rem; }
    .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .auth-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; }

    /* ── Nav Sign-In ── */
    .nav-auth { padding: 6px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 600; color: #000; background: var(--accent); text-decoration: none; cursor: pointer; border: none; transition: all 0.3s; }
    .nav-auth:hover { box-shadow: 0 0 15px var(--accent); transform: translateY(-1px); }
    .nav-user { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border-radius: 50px; background: rgba(255,255,255,0.08); border: 1px solid var(--border); }
    .nav-user img { width: 24px; height: 24px; border-radius: 50%; }
    .nav-user span { font-size: 0.7rem; color: var(--text); }

    /* ── Live Pulse ── */
    .live-pulse { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 50px; background: rgba(10,10,15,0.8); border: 1px solid var(--border); backdrop-filter: blur(10px); font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; }
    .live-pulse .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
    .live-pulse.offline .dot { background: #ef4444; }

    /* ── Toast Notifications ── */
    .toast { position: fixed; top: 60px; right: 24px; z-index: 10001; padding: 12px 20px; border-radius: 12px; background: rgba(15,15,25,0.95); border: 1px solid var(--accent); backdrop-filter: blur(10px); font-size: 0.8rem; color: #fff; transform: translateX(120%); transition: transform 0.4s ease; }
    .toast.show { transform: translateX(0); }

    /* ── Heady UX Paradigms ── */
    .ux-controls { display: flex; gap: 16px; justify-content: center; margin: 40px 0; flex-wrap: wrap; }
    .control-panel { background: rgba(15,15,25,0.6); border: 1px solid var(--border); padding: 16px 24px; border-radius: 16px; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(10px); }
    .control-panel h4 { font-size: 0.8rem; text-transform: uppercase; color: var(--accent); letter-spacing: 1px; }
    
    .dial-wrap { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: #fff; }
    .dial-wrap input[type=range] { appearance: none; width: 150px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; outline: none; }
    .dial-wrap input[type=range]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: 0 0 10px var(--accent); }
    
    .mode-toggle { display: flex; gap: 8px; }
    .mode-btn { padding: 6px 16px; border-radius: 50px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; transition: all 0.3s; }
    .mode-btn.active { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 600; box-shadow: 0 0 15px var(--accent); }
    
    body.mode-reflective { --g1: #9333EA; --g2: #D946EF; --accent: #C084FC; background: #0f0a1f; }
    body.mode-technical { --g1: #0891B2; --g2: #2563EB; --accent: #22D3EE; background: #061118; }
    body.mode-technical #cosmic-canvas { opacity: 0.3; }
    
    .task-feed { max-width: 800px; margin: 60px auto; background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 40px; backdrop-filter: blur(12px); }
    .task-feed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .task-feed-title { font-size: 1.2rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    .task-badge { padding: 4px 10px; border-radius: 50px; font-size: 0.65rem; background: rgba(245,158,11,0.2); color: #FCD34D; border: 1px solid #F59E0B; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
    
    .task-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 8px; }
    .task-item { background: rgba(0,0,0,0.4); border: 1px solid var(--border); padding: 16px; border-radius: 12px; transition: all 0.3s; display: flex; gap: 16px; align-items: flex-start; }
    .task-item:hover { border-color: var(--accent); transform: translateX(5px); }
    .task-index { font-family: monospace; color: var(--accent); font-weight: bold; font-size: 0.9rem; margin-top: 2px; }
    .task-content h5 { font-size: 0.95rem; color: #fff; margin-bottom: 4px; }
    .task-content p { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }

    @media (max-width: 768px) {
      .p-grid { grid-template-columns: 1fr; }
      nav { display: none; }
      .hero h1 { font-size: 2.8rem; }
      .buddy-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
      .auth-modal { padding: 24px; }
    }
  </style>
</head>
<body>
  <canvas id="cosmic-canvas"></canvas>
  <div class="site-wrap">
    <div class="container">
      <header>
        <a class="logo-wrap" href="#">
          <div class="logo-title">${site.title.split('—')[0].trim()}</div>
          <div class="logo-sub">${site.tagline.split('.')[0]}</div>
        </a>
        <nav>
          <a href="#" class="active">Ecosystem</a>
          <a href="https://headyio.com">Developers</a>
          <a href="https://headymcp.com">Marketplace</a>
          <a href="https://headyio.com/downloads.html" style="color: var(--accent); font-weight: 700;">Downloads</a>
          <button class="nav-auth" id="authBtn" onclick="window.headyAuth.showModal()">Sign In</button>
        </nav>
      </header>

      <section class="hero">
        <div class="status"><span class="status-dot"></span> Heady Ecosystem Online</div>
        <h1>${site.title.split('—')[0].trim()}</h1>
        <p class="hero-sub">${site.tagline.split('.')[0]}</p>
        <div class="sacred-badge">${site.geoType.toUpperCase()} · SACRED GEOMETRY v3</div>
        <p class="hero-mantra">${site.description}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
          <a href="${site.ctaHref}" class="btn btn-primary">${site.cta}</a>
          <button class="btn" style="background:rgba(255,255,255,0.08);color:var(--accent);border:1px solid var(--border);" onclick="window.headyBuddy.toggle()">💬 Chat with Buddy</button>
        </div>
      </section>

      <section class="playbook">
        <div class="p-grid">
          <div class="p-card"><h3>Target Buyer</h3><p>${site.buyer}</p></div>
          <div class="p-card" style="grid-column: span 2;"><h3>Killer Workflow</h3><p><i>${site.workflow}</i></p></div>
        </div>
      </section>

      <!-- Conditional Onboarding Flow for HeadyMe -->
      ${site.id === 'headyme' ? `
      <section class="onboarding-matrix" id="headyOnboarding" style="display:none; text-align:center; padding: 60px 40px; background: rgba(0,0,0,0.4); border: 1px solid var(--accent); border-radius: 30px; margin: 40px auto; max-width: 900px; backdrop-filter: blur(20px); box-shadow: 0 0 50px rgba(0,0,0,0.5);">
         <h2 style="font-size: 2.5rem; margin-bottom: 10px; font-weight: 300; tracking-wide;">Welcome to Heady. What are you building?</h2>
         <p style="color: var(--text-muted); margin-bottom: 40px; font-size: 1.1rem;">Select your focal points to instantly generate your personalized ecosystem and context switcher.</p>
         
         <div style="text-align: left; margin-bottom: 15px; font-size: 0.8rem; color: var(--accent); text-transform: uppercase; letter-spacing: 2px;">Core Apps</div>
         <div id="obChoicesApps" style="display:flex; flex-wrap:wrap; gap: 12px; margin-bottom: 30px;"></div>
         
         <div style="text-align: left; margin-bottom: 15px; font-size: 0.8rem; color: var(--accent); text-transform: uppercase; letter-spacing: 2px;">Verticals & Solutions</div>
         <div id="obChoicesVerts" style="display:flex; flex-wrap:wrap; gap: 12px; margin-bottom: 40px;"></div>
         
         <button class="btn" style="background:var(--accent);color:#000;font-weight:600;padding:16px 40px;font-size:1.1rem;box-shadow:0 0 20px var(--accent);" onclick="window.headyContext.saveOnboarding()">Generate My Command Center →</button>
      </section>
      
      <section class="features" id="headyDefaultFeatures">
        ${site.features.map(f => `
        <div class="f-card">
          <div class="f-icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>`).join('')}
      </section>
      ` : `
      <section class="features">
        ${site.features.map(f => `
        <div class="f-card">
          <div class="f-icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>`).join('')}
      </section>
      `}

      <!-- UX Controls -->
      <div class="ux-controls">
        <div class="control-panel">
          <h4>Speed vs. Quality Dial</h4>
          <div class="dial-wrap">
             <span>Speed ⚡</span>
             <input type="range" id="sqDial" min="1" max="100" value="50" onchange="window.headyUX.updateDial(this.value)">
             <span>Quality 🧠</span>
          </div>
        </div>
        <div class="control-panel">
          <h4>UI Operating Mode</h4>
          <div class="mode-toggle">
            <button class="mode-btn active" onclick="window.headyUX.setMode('default')">Standard</button>
            <button class="mode-btn" onclick="window.headyUX.setMode('reflective')">Reflective</button>
            <button class="mode-btn" onclick="window.headyUX.setMode('technical')">Technical</button>
          </div>
        </div>
      </div>

      <!-- 369 Task Feed -->
      <section class="task-feed" id="hcfp-tasks">
        <div class="task-feed-header">
           <div class="task-feed-title">
             🌌 Tesla 3-6-9 Orchestration Feed
           </div>
           <div class="task-badge">Auto-Success Live</div>
        </div>
        <div class="task-list" id="taskListContainer">
           <div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 0.85rem;">
              <div class="status-dot" style="display:inline-block; margin-bottom: 12px;"></div><br/>
              Connecting to Heady Master Matrix...
           </div>
        </div>
      </section>

      <footer>
        <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:16px;">
          <a href="https://headysystems.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadySystems</a>
          <a href="https://headyme.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyMe</a>
          <a href="https://headyio.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyIO</a>
          <a href="https://headyapi.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyAPI</a>
          <a href="https://headymcp.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyMCP</a>
          <a href="https://headyos.com" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyOS</a>
          <a href="https://headyconnection.org" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyConnection</a>
          <a href="https://headybuddy.org" style="color:var(--text-muted);text-decoration:none;font-size:0.7rem;">HeadyBuddy</a>
        </div>
        © ${new Date().getFullYear()} ${site.title.split('—')[0].trim()} — ∞ SACRED GEOMETRY ∞ — Powered by HCFP Auto-Success
      </footer>
    </div>
  </div>

  <script>
    (function(){
        const canvas = document.getElementById('cosmic-canvas');
        const ctx = canvas.getContext('2d');
        let width, height, cx, cy;
        let stars = [];
        let time = 0;
        const baseColor = '${site.accent}';
        const geoType = '${site.geoType}';
        
        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            cx = width / 2; cy = height / 2;
            stars = [];
            const numStars = (width * height) / 4000;
            for(let i=0; i<numStars; i++) {
                stars.push({ x: Math.random() * width, y: Math.random() * height, z: Math.random() * 2, size: Math.random() * 1.5, speed: Math.random() * 0.005 + 0.002, offset: Math.random() * Math.PI * 2 });
            }
        }
        function drawStars() {
            ctx.fillStyle = '#050508';
            ctx.fillRect(0, 0, width, height);
            stars.forEach(s => {
                s.y -= s.z * 0.2; s.x += s.z * 0.1;
                if(s.y < 0) s.y = height; if(s.x > width) s.x = 0;
                const blink = Math.sin(time * s.speed + s.offset) * 0.5 + 0.5;
                ctx.fillStyle = 'rgba(255,255,255,' + (blink * 0.6) + ')';
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            });
        }
        function proj(x, y, z, tiltX, tiltY) {
            const cz = Math.cos(tiltY), sz = Math.sin(tiltY);
            const cx2 = Math.cos(tiltX), sx = Math.sin(tiltX);
            const x2 = x * cz - z * sz;
            const z2 = x * sz + z * cz;
            const y2 = y * cx2 - z2 * sx;
            return { x: x2, y: y2 };
        }
        function drawGeometry() {
            const radius = Math.min(width, height) * 0.4;
            const tiltX = Math.sin(time * 0.01) * 0.2;
            const tiltY = Math.cos(time * 0.008) * 0.2;
            const breathe = Math.sin(time * 0.02) * 0.01 + 1;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(breathe, breathe);
            ctx.rotate(time * 0.0001);
            ctx.lineWidth = 0.4;
            function getColor(alpha) {
                return 'hsla(230, 70%, 70%, ' + alpha + ')';
            }
            if (geoType === 'Flower of Life') {
                for (let ring = 0; ring < 4; ring++) {
                    const n = ring === 0 ? 1 : ring * 6;
                    const d = ring * radius * 0.25;
                    for (let i = 0; i < n; i++) {
                        const a = (Math.PI * 2 / Math.max(n,1)) * i;
                        const p = proj(Math.cos(a)*d, Math.sin(a)*d, 0, tiltX, tiltY);
                        ctx.strokeStyle = getColor(0.4);
                        ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.25, 0, Math.PI * 2); ctx.stroke();
                    }
                }
            } else if (geoType === 'Metatrons Cube') {
                const nodes = [{x:0,y:0,z:0}];
                for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i; nodes.push({x:Math.cos(a)*radius*0.5,y:Math.sin(a)*radius*0.5,z:0}); }
                for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i+Math.PI/6; nodes.push({x:Math.cos(a)*radius*0.9,y:Math.sin(a)*radius*0.9,z:0}); }
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i+1; j < nodes.length; j++) {
                        const p1 = proj(nodes[i].x, nodes[i].y, nodes[i].z, tiltX, tiltY);
                        const p2 = proj(nodes[j].x, nodes[j].y, nodes[j].z, tiltX, tiltY);
                        ctx.strokeStyle = getColor(0.2);
                        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    }
                }
            } else if (geoType === 'Seed of Life') {
                for (let i = 0; i < 7; i++) {
                    const a = (Math.PI * 2 / 6) * i;
                    const d = i === 0 ? 0 : radius * 0.3;
                    const p = proj(Math.cos(a)*d, Math.sin(a)*d, 0, tiltX, tiltY);
                    ctx.strokeStyle = getColor(0.5);
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.35, 0, Math.PI * 2); ctx.stroke();
                }
            }
            ctx.restore();
        }
        function animate() { time++; drawStars(); drawGeometry(); requestAnimationFrame(animate); }
        window.addEventListener('resize', resize);
        resize(); animate();
    })();
  </script>

  <!-- Heady Context Switcher -->
  <style>
    .ctx-trigger { position: fixed; bottom: 20px; left: 20px; z-index: 10000; width: 44px; height: 44px; border-radius: 50%; background: rgba(15,15,25,0.9); border: 1px solid var(--border); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem; color: var(--accent); transition: all 0.3s; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .ctx-trigger:hover { transform: scale(1.1); box-shadow: 0 0 20px var(--accent); border-color: var(--accent); }
    .ctx-panel { position: fixed; bottom: 72px; left: 20px; z-index: 10000; width: 320px; max-height: 70vh; display: flex; flex-direction: column; background: rgba(10,10,18,0.96); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; backdrop-filter: blur(20px); padding: 8px; transform: translateY(10px) scale(0.95); opacity: 0; pointer-events: none; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .ctx-panel.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }
    .ctx-panel input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #fff; font-size: 0.8rem; outline: none; margin-bottom: 6px; flex-shrink: 0; }
    .ctx-panel input::placeholder { color: rgba(255,255,255,0.3); }
    .ctx-panel input:focus { border-color: var(--accent); }
    .ctx-panel-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }
    .ctx-panel-scroll::-webkit-scrollbar { width: 4px; }
    .ctx-panel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .ctx-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.3); padding: 8px 10px 4px; }
    .ctx-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-decoration: none; }
    .ctx-item:hover, .ctx-item.focused { background: rgba(255,255,255,0.06); }
    .ctx-item.active { background: rgba(var(--accent-rgb, 129,140,248), 0.15); border: 1px solid rgba(var(--accent-rgb, 129,140,248), 0.2); }
    .ctx-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; background: rgba(255,255,255,0.05); }
    .ctx-name { font-size: 0.8rem; font-weight: 500; color: #fff; }
    .ctx-desc { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: block; }
    .ctx-kbd { font-size: 0.55rem; color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; margin-left: auto; flex-shrink: 0; }
  </style>

  <button class="ctx-trigger" id="ctxTrigger" onclick="window.headyContext.toggle()" title="Switch Heady Context (Ctrl+K)">⌘</button>
  <div class="ctx-panel" id="ctxPanel">
    <input type="text" id="ctxSearch" placeholder="Search apps & verticals..." onkeyup="window.headyContext.handleKey(event)" oninput="window.headyContext.filter(this.value)" autocomplete="off" />
    <div class="ctx-panel-scroll">
      <div class="ctx-label" id="ctxLabelApps">Apps</div>
      <div id="ctxApps"></div>
      <div class="ctx-label" id="ctxLabelVerts">Verticals</div>
      <div id="ctxVerts"></div>
    </div>
  </div>

  <!-- Live System Pulse -->
  <div class="live-pulse" id="livePulse"><span class="dot"></span> <span id="pulseText">Connecting...</span></div>

  <!-- Auth Modal -->
  <div class="auth-overlay" id="authOverlay">
    <div class="auth-modal">
      <h2>Connect to ${site.title.split('—')[0].trim()}</h2>
      <p>Sign in to sync your preferences, chat history, and task context across all Heady interfaces.</p>
      <button class="auth-btn google" onclick="window.headyAuth.google()">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Connect with Google
      </button>
      <div class="auth-divider">or</div>
      <button class="auth-btn email" onclick="window.headyAuth.email()">✉️ Connect with Email</button>
      <button class="auth-btn skip" onclick="window.headyAuth.skip()">Explore as guest →</button>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <!-- HeadyBuddy Chat Widget -->
  <div class="buddy-panel" id="buddyPanel">
    <div class="buddy-header">
      <span class="dot"></span>
      <span>HeadyBuddy</span>
      <button class="close-btn" onclick="window.headyBuddy.toggle()">✕</button>
    </div>
    <div class="buddy-messages" id="buddyMessages">
      <div class="buddy-msg bot">Hey! 👋 HeadyBuddy here, your AI companion. Connected to 20 intelligence nodes. How can I help?</div>
    </div>
    <div class="buddy-input-wrap">
      <input type="text" id="buddyInput" placeholder="Ask anything..." onkeydown="if(event.key==='Enter')window.headyBuddy.send()" />
      <button onclick="window.headyBuddy.send()">Send</button>
    </div>
  </div>
  <button class="buddy-fab" onclick="window.headyBuddy.toggle()" title="Chat with HeadyBuddy">💬</button>

  <script>
  // ── Heady Context Switcher Logic ──────────────────────────────────
  window.headyContext = {
    open: false,
    items: [],
    savedContexts: null,
    selectedIndex: 0,
    apps: [
      { id: "admin", name: "Heady Admin", desc: "Operations console", icon: "⚙️", url: "https://admin.headysystems.com" },
      { id: "ide", name: "HeadyAI-IDE", desc: "AI-powered development", icon: "💻", url: "https://ide.headysystems.com" },
      { id: "buddy", name: "HeadyBuddy", desc: "AI Swarm Commander", icon: "🤖", url: "https://headybuddy.org" },
      { id: "manager", name: "Heady Manager", desc: "Backend API server", icon: "🧠", url: "https://manager.headysystems.com" },
      { id: "mcp", name: "HeadyMCP", desc: "Protocol hub", icon: "🔌", url: "https://headymcp.com" },
      { id: "io", name: "HeadyIO", desc: "Developer portal", icon: "📚", url: "https://headyio.com" },
      { id: "connection", name: "HeadyConnection", desc: "Nonprofit impact", icon: "🤝", url: "https://headyconnection.org" },
      { id: "instant", name: "1ime1", desc: "Instant Everything", icon: "⚡", url: "https://1ime1.com" },
      { id: "canvas", name: "HeadyVinci Canvas", desc: "Creative sandbox", icon: "🎨", url: "https://manager.headysystems.com/canvas" },
      { id: "systems", name: "HeadySystems", desc: "Architecture", icon: "🛡️", url: "https://headysystems.com" },
      { id: "me", name: "HeadyMe", desc: "Command Center", icon: "🎯", url: "https://headyme.com", core: true }
    ],
    verts: [
      { id: "v-trade", name: "Trading & Finance", desc: "Algorithmic trading", icon: "📈", url: "https://headysystems.com?v=trading" },
      { id: "v-creative", name: "Creative & Media", desc: "Multi-model generation", icon: "🎬", url: "https://manager.headysystems.com/canvas" },
      { id: "v-dev", name: "Developer Tools", desc: "IDE, MCP, Hive SDK", icon: "🛠️", url: "https://headyio.com" },
      { id: "v-impact", name: "Nonprofit & Impact", desc: "Grant writing", icon: "🌍", url: "https://headyconnection.org" },
      { id: "v-ops", name: "Enterprise Ops", desc: "Infrastructure", icon: "🏢", url: "https://admin.headysystems.com" },
      { id: "v-intel", name: "Research & Intel", desc: "Deep analysis", icon: "🔍", url: "https://headyme.com?v=intel" }
    ],

    init() {
      // 1. Load preferences
      try { const saved = localStorage.getItem('heady_contexts'); if (saved) this.savedContexts = JSON.parse(saved); } catch(e){}
      
      // 2. Headyme Onboarding check
      if (document.getElementById('headyOnboarding')) {
        const urlParams = new URLSearchParams(window.location.search);
        if (!this.savedContexts || urlParams.get('edit') === 'true') {
           this.renderOnboarding();
        }
      }

      this.render();
      document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          this.toggle();
        }
        if (e.key === "Escape" && this.open) {
          this.toggle();
        }
      });
      document.addEventListener("click", e => {
        if (this.open && !e.target.closest('#ctxPanel') && !e.target.closest('#ctxTrigger')) {
          this.toggle();
        }
      });
    },

    renderOnboarding() {
      const obApps = document.getElementById('obChoicesApps');
      const obVerts = document.getElementById('obChoicesVerts');
      if (!obApps || !obVerts) return;

      document.getElementById('headyOnboarding').style.display = 'block';
      const defFeatures = document.getElementById('headyDefaultFeatures');
      if (defFeatures) defFeatures.style.display = 'none';

      const renderChoice = (item, type) => {
        const isChecked = this.savedContexts ? this.savedContexts.includes(item.id) : (item.core || type === 'app');
        return \`<label style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:12px 20px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius:10px; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          <input type="checkbox" value="\${item.id}" class="ctx-ob-chk" \${isChecked ? 'checked' : ''} \${item.core ? 'disabled checked' : ''} />
          <span>\${item.icon} \${item.name}</span>
        </label>\`;
      };

      obApps.innerHTML = this.apps.map(a => renderChoice(a, 'app')).join('');
      obVerts.innerHTML = this.verts.map(v => renderChoice(v, 'vert')).join('');
    },

    saveOnboarding() {
      const checks = document.querySelectorAll('.ctx-ob-chk');
      const selected = Array.from(checks).filter(c => c.checked).map(c => c.value);
      localStorage.setItem('heady_contexts', JSON.stringify(selected));
      this.savedContexts = selected;
      window.headyToast("Ecosystem personalized successfully!");
      
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url);

      document.getElementById('headyOnboarding').style.display = 'none';
      const defFeatures = document.getElementById('headyDefaultFeatures');
      if (defFeatures) defFeatures.style.display = 'grid';

      this.render();
    },

    toggle() {
      this.open = !this.open;
      const panel = document.getElementById("ctxPanel");
      panel.classList.toggle("open", this.open);
      const search = document.getElementById("ctxSearch");
      if (this.open) {
        search.value = "";
        this.filter("");
        search.focus();
      }
    },

    render() {
      const currentHost = window.location.hostname;
      
      // Filter based on saved contexts (if any exist)
      const allowedApps = this.savedContexts ? this.apps.filter(a => this.savedContexts.includes(a.id) || a.core) : this.apps;
      const allowedVerts = this.savedContexts ? this.verts.filter(v => this.savedContexts.includes(v.id)) : this.verts;
      
      const renderItem = (item, idx) => {
        const isActive = currentHost === new URL(item.url).hostname;
        return \`<a href="\${item.url}" class="ctx-item \${isActive ? 'active' : ''}" data-idx="\${idx}" id="ctx-item-\${idx}">
          <div class="ctx-icon">\${item.icon}</div>
          <div>
            <div class="ctx-name">\${item.name}</div>
            <div class="ctx-desc">\${item.desc}</div>
          </div>
          \${isActive ? '<div class="ctx-kbd">LIVE</div>' : ''}
        </a>\`;
      };
      
      document.getElementById("ctxApps").innerHTML = allowedApps.map((a, i) => renderItem(a, i)).join("");
      document.getElementById("ctxVerts").innerHTML = allowedVerts.map((v, i) => renderItem(v, i + allowedApps.length)).join("");
      
      // Insert Edit button
      document.getElementById("ctxVerts").innerHTML += \`
        <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
          <a href="https://headyme.com?edit=true" class="ctx-item" style="color:var(--accent); justify-content:center;">
            <span style="font-size:1.1rem">⚙️</span> Adjust Available Contexts
          </a>
        </div>
      \`;

      this.items = [...allowedApps, ...allowedVerts];
      this.updateSelection();
    },

    filter(query) {
      query = query.toLowerCase();
      let shownApps = 0, shownVerts = 0;
      let visibleIdxs = [];
      
      this.items.forEach((item, idx) => {
        const el = document.getElementById(\`ctx-item-\${idx}\`);
        const show = item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query);
        el.style.display = show ? "flex" : "none";
        
        if (show) {
          visibleIdxs.push(idx);
          if (idx < this.apps.length) shownApps++;
          else shownVerts++;
        }
      });
      
      document.getElementById("ctxLabelApps").style.display = shownApps > 0 ? "block" : "none";
      document.getElementById("ctxLabelVerts").style.display = shownVerts > 0 ? "block" : "none";
      
      if (visibleIdxs.length > 0) {
        this.selectedIndex = visibleIdxs[0];
        this.updateSelection();
      }
    },

    handleKey(e) {
      const visibleItems = Array.from(document.querySelectorAll('.ctx-item')).filter(el => el.style.display !== 'none');
      if (visibleItems.length === 0) return;
      
      const currentEl = document.getElementById(\`ctx-item-\${this.selectedIndex}\`);
      let currentPos = visibleItems.indexOf(currentEl);
      if (currentPos === -1) currentPos = 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        currentPos = (currentPos + 1) % visibleItems.length;
        this.selectedIndex = parseInt(visibleItems[currentPos].dataset.idx);
        this.updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentPos = (currentPos - 1 + visibleItems.length) % visibleItems.length;
        this.selectedIndex = parseInt(visibleItems[currentPos].dataset.idx);
        this.updateSelection();
      } else if (e.key === "Enter") {
        window.location.href = this.items[this.selectedIndex].url;
      }
    },

    updateSelection() {
      document.querySelectorAll('.ctx-item').forEach(el => el.classList.remove('focused'));
      const el = document.getElementById(\`ctx-item-\${this.selectedIndex}\`);
      if (el) {
        el.classList.add('focused');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  };
  document.addEventListener('DOMContentLoaded', () => window.headyContext.init());

  // ── HeadyBuddy Chat Widget ────────────────────────────────────────
  window.headyBuddy = {
    open: false,
    panel: null,
    msgs: null,
    input: null,
    init() {
      this.panel = document.getElementById('buddyPanel');
      this.msgs = document.getElementById('buddyMessages');
      this.input = document.getElementById('buddyInput');
    },
    toggle() {
      this.open = !this.open;
      this.panel.classList.toggle('open', this.open);
      if (this.open) this.input.focus();
    },
    addMsg(text, type) {
      const div = document.createElement('div');
      div.className = 'buddy-msg ' + type;
      div.textContent = text;
      this.msgs.appendChild(div);
      this.msgs.scrollTop = this.msgs.scrollHeight;
    },
    showTyping() {
      const t = document.createElement('div');
      t.className = 'buddy-typing';
      t.id = 'typingIndicator';
      t.innerHTML = '<span></span><span></span><span></span>';
      this.msgs.appendChild(t);
      this.msgs.scrollTop = this.msgs.scrollHeight;
    },
    hideTyping() {
      const t = document.getElementById('typingIndicator');
      if (t) t.remove();
    },
    async send() {
      const msg = this.input.value.trim();
      if (!msg) return;
      this.input.value = '';
      this.addMsg(msg, 'user');
      this.showTyping();
      try {
        const res = await fetch('https://manager.headysystems.com/api/brain/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        });
        this.hideTyping();
        if (res.ok) {
          const data = await res.json();
          this.addMsg(data.reply || data.response || 'I heard you! Let me think...', 'bot');
        } else {
          this.addMsg('Having trouble connecting. Try again in a moment!', 'bot');
        }
      } catch {
        this.hideTyping();
        this.addMsg('Network is down. Be right back!', 'bot');
      }
    },
  };
  document.addEventListener('DOMContentLoaded', () => window.headyBuddy.init());

  // ── Heady Auth System — Personal Persistence Connection ─────────
  window.headyAuth = {
    user: null,
    token: null,
    MANAGER_URL: 'https://manager.headysystems.com',
    STORAGE_KEY: 'heady_session',

    init() {
      // Auto-restore session from localStorage (syncs across all Heady UIs on same browser)
      try {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const session = JSON.parse(saved);
          if (session.token && session.user && session.expiresAt > Date.now()) {
            this.token = session.token;
            this.user = session.user;
            this.updateUI();
            this.syncPreferences();
            return; // already connected
          }
        }
      } catch { /* clean slate */ }
    },

    showModal() {
      document.getElementById('authOverlay').classList.add('open');
    },
    hideModal() {
      document.getElementById('authOverlay').classList.remove('open');
    },

    async google() {
      this.hideModal();
      window.headyToast('🔐 Connecting to Heady via Google...');
      try {
        const popup = window.open(
          this.MANAGER_URL + '/api/auth/google?redirect=' + encodeURIComponent(window.location.href),
          'headyAuth', 'width=500,height=600,menubar=no,toolbar=no'
        );
        // Listen for postMessage from auth popup
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'heady_auth_success') {
            this.handleAuthSuccess(e.data);
            if (popup) popup.close();
          }
        }, { once: true });
      } catch (err) {
        window.headyToast('⚠️ Auth connection failed: ' + err.message);
      }
    },

    async email() {
      this.hideModal();
      const email = prompt('Enter your email to connect:');
      if (!email) return;
      window.headyToast('✉️ Connecting ' + email + ' to Heady...');
      try {
        const res = await fetch(this.MANAGER_URL + '/api/auth/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, site: window.location.hostname })
        });
        if (res.ok) {
          const data = await res.json();
          this.handleAuthSuccess({ token: data.token, user: { name: email.split('@')[0], email, photo: null } });
        } else {
          window.headyToast('Check your email for a magic link to complete connection.');
        }
      } catch {
        // Graceful degradation — create local session
        this.handleAuthSuccess({ 
          token: 'local_' + Date.now(), 
          user: { name: email.split('@')[0], email, photo: null },
          local: true
        });
      }
    },

    skip() {
      this.hideModal();
      this.user = { name: 'Guest', photo: null };
      this.updateUI();
      window.headyToast('Welcome, Guest! Connect anytime for personal persistence across all Heady apps.');
    },

    handleAuthSuccess(data) {
      this.token = data.token;
      this.user = data.user;
      // Persist session — syncs across all Heady domains via localStorage
      const session = {
        token: this.token,
        user: this.user,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        connectedAt: new Date().toISOString(),
        site: window.location.hostname,
        local: data.local || false
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
      this.updateUI();
      this.syncPreferences();
      window.headyToast('✅ Connected! Your session syncs across all Heady interfaces.');
    },

    updateUI() {
      const btn = document.getElementById('authBtn');
      if (!btn) return;
      if (this.user && this.user.name !== 'Guest') {
        btn.outerHTML = '<div class="nav-user" onclick="window.headyAuth.showProfile()" style="cursor:pointer">' +
          (this.user.photo ? '<img src="' + this.user.photo + '" alt=""/>' : '<span style="width:24px;height:24px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#000;font-weight:700">' + this.user.name[0].toUpperCase() + '</span>') +
          '<span>' + this.user.name + '</span></div>';
      }
      // Update buddy widget greeting if connected
      if (this.user && this.user.name !== 'Guest') {
        const msgs = document.getElementById('buddyMessages');
        if (msgs && msgs.children.length === 1) {
          msgs.children[0].textContent = 'Hey ' + this.user.name + '! 👋 Your session is synced. I can access your preferences, history, and context across all Heady apps.';
        }
      }
    },

    showProfile() {
      const connected = this.user ? '✅ Connected as ' + this.user.name : '❌ Not connected';
      const token = this.token ? (this.token.startsWith('local_') ? '🏠 Local session' : '☁️ Cloud synced') : 'None';
      window.headyToast(connected + ' | ' + token);
    },

    async syncPreferences() {
      if (!this.token || this.token.startsWith('local_')) return;
      try {
        const res = await fetch(this.MANAGER_URL + '/api/user/preferences', {
          headers: { 'Authorization': 'Bearer ' + this.token }
        });
        if (res.ok) {
          const prefs = await res.json();
          // Apply user's persisted preferences (theme mode, buddy history, etc.)
          if (prefs.mode === 'reflective') document.body.classList.add('mode-reflective');
          if (prefs.mode === 'technical') document.body.classList.add('mode-technical');
        }
      } catch { /* preferences sync is best-effort */ }
    },

    disconnect() {
      this.user = null;
      this.token = null;
      localStorage.removeItem(this.STORAGE_KEY);
      window.headyToast('Disconnected. Your data remains safe.');
      location.reload();
    }
  };

  // Auto-init auth on page load
  window.headyAuth.init();

  // ── Toast ──────────────────────────────────────────────────────────
  window.headyToast = function(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  };

  // ── Live Pulse ────────────────────────────────────────────────────
  (async function checkPulse() {
    const pulse = document.getElementById('livePulse');
    const text = document.getElementById('pulseText');
    try {
      const res = await fetch('https://manager.headysystems.com/api/health', { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        pulse.classList.remove('offline');
        text.textContent = 'System Live · ' + (data.uptime ? Math.floor(data.uptime / 60) + 'm uptime' : 'Online');
      } else {
        pulse.classList.add('offline');
        text.textContent = 'Connecting...';
      }
    } catch {
      pulse.classList.add('offline');
      text.textContent = 'Offline';
    }
    setTimeout(checkPulse, 30000);
  })();

  // ── Interactive Feature Cards ─────────────────────────────────────
  document.querySelectorAll('.f-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const title = card.querySelector('h3').textContent;
      window.headyBuddy.toggle();
      setTimeout(() => {
        window.headyBuddy.input.value = 'Tell me more about ' + title;
        window.headyBuddy.send();
      }, 400);
    });
  });

  // ── Heady UX Paradigms ──────────────────────────────────────────
  window.headyUX = {
    setMode(mode) {
      document.body.className = '';
      if (mode !== 'default') document.body.classList.add('mode-' + mode);
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.toLowerCase() === mode || (mode === 'default' && b.textContent === 'Standard'));
      });
      window.headyToast(mode.charAt(0).toUpperCase() + mode.slice(1) + ' layout activated. A2UI stream adjusted.');
    },
    updateDial(val) {
      const isSpeed = val < 50;
      window.headyToast(\`Pipeline routing updated: \${isSpeed ? 'Optimizing for ⚡ Latency (Local SLMs)' : 'Optimizing for 🧠 Quality (Multi-Node Swarm)'}\`);
    }
  };

  // ── Tesla 3-6-9 Live Task Feed ────────────────────────────────────
  (async function fetch369Tasks() {
     const container = document.getElementById('taskListContainer');
     if (!container) return;
     
     async function loadTasks() {
       try {
         // Try live auto-success task catalog first (shows real execution data)
         // Fetch from the live HC Pipeline Auto-Success engine
         const liveRes = await fetch('https://manager.headysystems.com/api/auto-success/tasks', { signal: AbortSignal.timeout(5000) }).catch(() => null);
         if (liveRes && liveRes.ok) {
           const data = await liveRes.json();
           tasks = data.tasks || [];
         }
         
         // Fallback to config file
         if (tasks.length === 0) {
           const cfgRes = await fetch('https://manager.headysystems.com/api/config/optimal-master-task-matrix.json', { signal: AbortSignal.timeout(5000) }).catch(() => null);
           if (cfgRes && cfgRes.ok) {
             const data = await cfgRes.json();
             tasks = data.tasks || (Array.isArray(data) ? data : []);
           }
         }
         
         if (tasks.length === 0) {
           tasks = [
             { id: '369-01', name: 'Cryptographic Purge & Credential Rotation', desc: 'Execute BFG Repo-Cleaner to scrub artifacts from Git history and enforce zero-trust credential rotation.', status: 'idle' },
             { id: '369-02', name: 'A2UI Form Elicitation (Declarative JSON)', desc: 'Replaces endless chat loops with native interactive logic without context window overflow.', status: 'idle' },
             { id: '369-03', name: 'Speed vs. Quality Dial Logic', desc: 'Allows users to dynamically route between rapid local-first models or full 20-node deep reasoning swarms.', status: 'idle' },
             { id: '369-04', name: 'Sacred Geometry Ternary Matrix', desc: 'Operate on balanced ternary logic {-1,0,+1} to reduce token usage by up to 54% and latency by 50%.', status: 'idle' }
           ];
         }
         
         // Update task count in header
         const countEl = document.getElementById('taskCount');
         if (countEl) countEl.textContent = tasks.length + ' tasks';
         
         // Render with live status
         container.innerHTML = tasks.slice(0, 50).map((t, i) => \`
           <div class="task-item" style="animation-delay: \${i * 40}ms">
              <div class="task-index">#\${String(i+1).padStart(3, '0')}</div>
              <div class="task-content">
                 <h5>\${t.name || t.id} <span style="font-size:0.65rem;padding:2px 8px;border-radius:50px;background:\${t.runs > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)'};color:\${t.runs > 0 ? '#22c55e' : '#888'};margin-left:8px">\${t.runs > 0 ? '✓ ' + t.runs + ' runs' : t.status || 'queued'}</span></h5>
                 <p>\${t.lastFinding || t.desc || 'Auto-Success verification pending.'}</p>
              </div>
           </div>
         \`).join('');
       } catch (e) {
         container.innerHTML = '<div style="padding: 20px; color: #ef4444;">Task sync offline. Retrying...</div>';
       }
     }
     
     loadTasks();
     setInterval(loadTasks, 10000); // Refresh every 10 seconds
     }
  })();
  </script>
</body>
</html>`;
}

// ── Deploy ────────────────────────────────────────────────────────────
let count = 0;
if (!fs.existsSync(SITES_DIR)) fs.mkdirSync(SITES_DIR, { recursive: true });

for (const site of allSites) {
  const siteDir = path.join(SITES_DIR, site.dir);
  const distDir = path.join(siteDir, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const html = generateSite(site);
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
  count++;
  console.log(`✅ ${site.id.padEnd(25)} → ${distDir}/index.html (${(html.length / 1024).toFixed(1)} KB)`);
}

// ── Generate Downloads Hub ───────────────────────────────────────────
function generateDownloadsPage() {
  const site = sites.find(s => s.id === 'headyio');
  const [g1, g2] = site.gradient;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady Downloads — SDKs, Tools & Clients</title>
  <meta name="description" content="Download HeadyBuddy desktop apps, Hive SDKs, CLI tools, and architecture blueprints.">
  <meta name="theme-color" content="${g1}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📥</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --g1: ${g1}; --g2: ${g2}; --accent: ${site.accent};
      --bg: #000000; --surface: rgba(15,15,20,0.18);
      --text: #e2e8f0; --text-muted: rgba(255,255,255,0.6); --border: rgba(255,255,255,0.06);
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: #000000; color: var(--text); line-height: 1.6; overflow-x: hidden; min-height: 100vh; -webkit-font-smoothing: antialiased; }
    #cosmic-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .site-wrap { position: relative; z-index: 10; display: flex; flex-direction: column; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    
    header { padding: 24px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
    .logo-wrap { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .logo-title { font-size: 1.4rem; font-weight: 700; color: var(--accent); letter-spacing: 1px; text-shadow: 0 0 10px rgba(96,165,250,0.4); }
    .logo-sub { font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.15em; text-transform: uppercase; }
    nav { display: flex; gap: 8px; background: rgba(20,20,25,0.12); padding: 6px; border-radius: 100px; backdrop-filter: blur(10px); border: 1px solid var(--border); }
    nav a { padding: 6px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: all 0.3s; }
    nav a:hover, nav a.active { background: var(--accent); color: #000; box-shadow: 0 0 15px var(--accent); }

    .hero { padding: 80px 0 40px; text-align: center; }
    .hero h1 { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 800; color: var(--accent); margin-bottom: 1rem; letter-spacing: -0.03em; }
    .hero p { font-size: 1.1rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 2rem; }

    .dl-section { padding: 40px 0; }
    .dl-category { margin-bottom: 40px; }
    .dl-category h2 { font-size: 1.2rem; font-weight: 600; color: #fff; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 10px; display: flex; align-items: center; gap: 10px; }
    
    .dl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
    .dl-card { background: var(--surface); padding: 24px; border-radius: 20px; border: 1px solid var(--border); backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: space-between; transition: all 0.3s; }
    .dl-card:hover { transform: translateY(-3px); border-color: rgba(96,165,250,0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .dl-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .dl-icon { font-size: 2rem; }
    .dl-title { font-weight: 700; color: #fff; font-size: 1.1rem; }
    .dl-version { font-size: 0.7rem; color: var(--accent); background: rgba(96,165,250,0.1); padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
    .dl-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; flex-grow: 1; }
    
    .dl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #fff; text-decoration: none; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; border: 1px solid var(--border); width: 100%; }
    .dl-btn:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    
    footer { padding: 40px 0; text-align: center; color: var(--text-muted); font-size: 0.75rem; border-top: 1px solid var(--border); margin-top: 60px; }
  </style>
</head>
<body>
  <canvas id="cosmic-canvas"></canvas>
  <div class="site-wrap">
    <div class="container">
      <header>
        <a class="logo-wrap" href="index.html">
          <div class="logo-title">HeadyIO</div>
          <div class="logo-sub">Downloads Hub</div>
        </a>
        <nav>
          <a href="https://headyme.com">Ecosystem</a>
          <a href="https://headyio.com">Developers</a>
          <a href="https://headymcp.com">Marketplace</a>
          <a href="#" class="active" style="color: var(--accent); font-weight: 700;">Downloads</a>
        </nav>
      </header>

      <section class="hero">
        <h1>Heady Downloads Hub</h1>
        <p>Get the latest HeadyBuddy desktop clients, Hive SDKs, CLI tools, and official platform blueprints.</p>
      </section>

      <section class="dl-section">
        <div class="dl-category">
          <h2>🐝 HeadyBuddy Clients</h2>
          <div class="dl-grid">
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🍎</div>
                  <div><span class="dl-title">macOS Client</span><span class="dl-version">v3.2.1</span></div>
                </div>
                <p class="dl-desc">Official HeadyBuddy app for Apple Silicon (M1/M2/M3) and Intel Macs. Includes system tray integration and voice relay.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/clients/HeadyBuddy-3.2.1-arm64.dmg" class="dl-btn">Download for macOS (.dmg)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🪟</div>
                  <div><span class="dl-title">Windows Client</span><span class="dl-version">v3.2.1</span></div>
                </div>
                <p class="dl-desc">Official HeadyBuddy app for Windows 11. Includes global hotkeys, taskbar integration, and cross-device sync.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/clients/HeadyBuddy-3.2.1-Setup.exe" class="dl-btn">Download for Windows (.exe)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🐧</div>
                  <div><span class="dl-title">Linux AppImage</span><span class="dl-version">v3.2.1</span></div>
                </div>
                <p class="dl-desc">Universal AppImage for Debian, Ubuntu, Fedora, and Arch Linux. Built for developers with heavy terminal workflows.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/clients/HeadyBuddy-3.2.1-x86_64.AppImage" class="dl-btn">Download AppImage</a>
            </div>
          </div>
        </div>

        <div class="dl-category">
          <h2>🔧 Browser & IDE Extensions</h2>
          <div class="dl-grid">
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">💻</div>
                  <div><span class="dl-title">VS Code Extension</span><span class="dl-version">v1.1.0</span></div>
                </div>
                <p class="dl-desc">Official Heady AI extension for VS Code. Chat, refactor, and battle-validate code using all 5 Heady models directly in your editor.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/extensions/heady-ai-1.1.0.vsix" class="dl-btn">Download .vsix (Manual Install)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🌐</div>
                  <div><span class="dl-title">Chrome Extension</span><span class="dl-version">v1.0.0</span></div>
                </div>
                <p class="dl-desc">Official Heady AI extension for Chrome. Context menu actions and side panel chat with model-per-action routing.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/extensions/heady-chrome-1.0.0.zip" class="dl-btn">Download .zip (Load Unpacked)</a>
            </div>
          </div>
        </div>

        <div class="dl-category">
          <h2>💻 Developer Tools & SDKs</h2>
          <div class="dl-grid">
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">⚡</div>
                  <div><span class="dl-title">Heady CLI</span><span class="dl-version">v2.8.0</span></div>
                </div>
                <p class="dl-desc">The official command-line interface for Heady. Deploy configurations, manage edge workers, and interact with the Swarm.</p>
              </div>
              <a href="https://headyio.com/api-docs" class="dl-btn">npm install -g heady-cli</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🧰</div>
                  <div><span class="dl-title">Hive SDK (Node.js)</span><span class="dl-version">v1.5.0</span></div>
                </div>
                <p class="dl-desc">Integrate 20-node federated routing and Proof View receipts into your JavaScript/TypeScript applications.</p>
              </div>
              <a href="https://github.com/heady-systems/hive-sdk" class="dl-btn">npm install @heady/hive-sdk</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🐍</div>
                  <div><span class="dl-title">Hive SDK (Python)</span><span class="dl-version">v1.2.0</span></div>
                </div>
                <p class="dl-desc">Python bindings for the Heady Brain API. Perfect for data science and AI pipeline integrations.</p>
              </div>
              <a href="https://pypi.org/project/heady-hive/" class="dl-btn">pip install heady-hive</a>
            </div>
          </div>
        </div>

        <div class="dl-category">
          <h2>📄 Architecture & Resources</h2>
          <div class="dl-grid">
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🗺️</div>
                  <div><span class="dl-title">System Blueprint V3</span></div>
                </div>
                <p class="dl-desc">High-resolution architecture diagram of the 20-node Heady ecosystem, federated routing, and PQC mesh.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/docs/heady-system-blueprint-v3.pdf" class="dl-btn">Download Blueprint (PDF)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🎨</div>
                  <div><span class="dl-title">Brand UI Kit</span></div>
                </div>
                <p class="dl-desc">Figma UI kit containing sacred geometry assets, color palettes, and component libraries for all Heady properties.</p>
              </div>
              <a href="https://manager.headysystems.com/dist/docs/heady-brand-ui-kit.fig" class="dl-btn">Get Figma UI Kit</a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        © 2026 Heady Systems LLC — ∞ SACRED GEOMETRY ∞ — Downloads Hub
      </footer>
    </div>
  </div>

  <script>
    (function(){
        const canvas = document.getElementById('cosmic-canvas');
        const ctx = canvas.getContext('2d');
        let width, height, cx, cy, stars = [], time = 0;
        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            cx = width / 2; cy = height / 2;
            stars = [];
            const n = (width * height) / 4000;
            for(let i=0; i<n; i++) stars.push({ x: Math.random() * width, y: Math.random() * height, z: Math.random() * 2, size: Math.random() * 1.5, speed: Math.random() * 0.005 + 0.002, offset: Math.random() * Math.PI * 2 });
        }
        function drawStars() {
            ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, width, height);
            stars.forEach(s => {
                s.y -= s.z * 0.2; s.x += s.z * 0.1;
                if(s.y < 0) s.y = height; if(s.x > width) s.x = 0;
                const b = Math.sin(time * s.speed + s.offset) * 0.5 + 0.5;
                ctx.fillStyle = 'rgba(255,255,255,' + (b * 0.6) + ')';
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            });
        }
        function animate() { time++; drawStars(); requestAnimationFrame(animate); }
        window.addEventListener('resize', resize); resize(); animate();
    })();
  </script>
</body>
</html>`;
}

const downloadsHtml = generateDownloadsPage();
for (const dirName of ['headyio', 'headyio-com']) {
  const p = path.join(SITES_DIR, dirName, 'dist', 'downloads.html');
  if (fs.existsSync(path.dirname(p))) {
    fs.writeFileSync(p, downloadsHtml);
    console.log(`✅ Generated Downloads Hub → ${p}`);
  }
}

console.log(`\n🎯 Generated ${count} SACRED GEOMETRY sites in ${SITES_DIR}`);

