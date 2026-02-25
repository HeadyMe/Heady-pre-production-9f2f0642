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

    @media (max-width: 768px) {
      .p-grid { grid-template-columns: 1fr; }
      nav { display: none; }
      .hero h1 { font-size: 2.8rem; }
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
        </nav>
      </header>

      <section class="hero">
        <div class="status"><span class="status-dot"></span> Heady Ecosystem Online</div>
        <h1>${site.title.split('—')[0].trim()}</h1>
        <p class="hero-sub">${site.tagline.split('.')[0]}</p>
        <div class="sacred-badge">${site.geoType.toUpperCase()} · SACRED GEOMETRY v3</div>
        <p class="hero-mantra">${site.description}</p>
        <a href="${site.ctaHref}" class="btn btn-primary">${site.cta}</a>
      </section>

      <section class="playbook">
        <div class="p-grid">
          <div class="p-card"><h3>Target Buyer</h3><p>${site.buyer}</p></div>
          <div class="p-card" style="grid-column: span 2;"><h3>Killer Workflow</h3><p><i>${site.workflow}</i></p></div>
        </div>
      </section>

      <section class="features">
        ${site.features.map(f => `
        <div class="f-card">
          <div class="f-icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>`).join('')}
      </section>

      <footer>
        © ${new Date().getFullYear()} ${site.title.split('—')[0].trim()} — ∞ SACRED GEOMETRY ∞ — Powered by HCFP Auto-Success 135
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
              <a href="#" class="dl-btn">Download for macOS (.dmg)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🪟</div>
                  <div><span class="dl-title">Windows Client</span><span class="dl-version">v3.2.1</span></div>
                </div>
                <p class="dl-desc">Official HeadyBuddy app for Windows 11. Includes global hotkeys, taskbar integration, and cross-device sync.</p>
              </div>
              <a href="#" class="dl-btn">Download for Windows (.exe)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🐧</div>
                  <div><span class="dl-title">Linux AppImage</span><span class="dl-version">v3.2.1</span></div>
                </div>
                <p class="dl-desc">Universal AppImage for Debian, Ubuntu, Fedora, and Arch Linux. Built for developers with heavy terminal workflows.</p>
              </div>
              <a href="#" class="dl-btn">Download AppImage</a>
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
              <a href="#" class="dl-btn">npm install -g heady-cli</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🧰</div>
                  <div><span class="dl-title">Hive SDK (Node.js)</span><span class="dl-version">v1.5.0</span></div>
                </div>
                <p class="dl-desc">Integrate 20-node federated routing and Proof View receipts into your JavaScript/TypeScript applications.</p>
              </div>
              <a href="#" class="dl-btn">npm install @heady/hive-sdk</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🐍</div>
                  <div><span class="dl-title">Hive SDK (Python)</span><span class="dl-version">v1.2.0</span></div>
                </div>
                <p class="dl-desc">Python bindings for the Heady Brain API. Perfect for data science and AI pipeline integrations.</p>
              </div>
              <a href="#" class="dl-btn">pip install heady-hive</a>
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
              <a href="#" class="dl-btn">Download Blueprint (PDF)</a>
            </div>
            <div class="dl-card">
              <div>
                <div class="dl-header">
                  <div class="dl-icon">🎨</div>
                  <div><span class="dl-title">Brand UI Kit</span></div>
                </div>
                <p class="dl-desc">Figma UI kit containing sacred geometry assets, color palettes, and component libraries for all Heady properties.</p>
              </div>
              <a href="#" class="dl-btn">Get Figma UI Kit</a>
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

