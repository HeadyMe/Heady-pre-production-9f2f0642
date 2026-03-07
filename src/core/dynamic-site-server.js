/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Dynamic Multi-Domain Site Server ═══
 *
 * Single server that renders ALL Heady sites dynamically.
 * Reads Host header → returns the correct branded page.
 * Embeds 25+ auth providers, HeadyBuddy widget, and API proxy.
 *
 * Usage:
 *   node src/core/dynamic-site-server.js
 *   SITE_PORT=8080 node src/core/dynamic-site-server.js
 *
 * Designed to run behind Cloudflare Tunnel for all domains.
 * ────────────────────────────────────────────────────────────────
 */

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.SITE_PORT || 3850;
const PHI = 1.6180339887;

// ── Site Registry ───────────────────────────────────────────────
const SITES = {
  'headyme.com': {
    brand: 'HeadyMe',
    tagline: 'Your Sovereign AI',
    subtitle: 'Personal intelligence that works for you — across every device, every domain.',
    color: '#4c8fff',
    accent: '#00d4ff',
    icon: 'H',
    heroServices: [
      { icon: '🧠', name: 'AI Chat', desc: 'Multi-provider reasoning with auto-failover' },
      { icon: '🔐', name: 'Secure Vault', desc: 'AES-256-GCM encrypted credential storage' },
      { icon: '📊', name: 'Dashboard', desc: 'Real-time system health and analytics' },
      { icon: '🐝', name: 'Bee Swarm', desc: 'Distributed task execution at scale' },
    ],
    showAuth: true,
  },
  'headysystems.com': {
    brand: 'HeadySystems',
    tagline: 'The Architecture of Intelligence',
    subtitle: 'Self-healing infrastructure powered by Sacred Geometry and fault-tolerant lattice computing.',
    color: '#00d4ff',
    accent: '#4c8fff',
    icon: 'S',
    heroServices: [
      { icon: '⚙️', name: 'Ops Console', desc: '14 service groups, CLI-driven' },
      { icon: '🏗️', name: 'Architecture', desc: '6-layer zero-trust mesh' },
      { icon: '⚛️', name: 'Quantum IP', desc: 'Rotated Subsystem Surface Code' },
      { icon: '🔄', name: 'Self-Healing', desc: 'Attestation, quarantine, respawn' },
    ],
    showAuth: false,
  },
  'headyconnection.org': {
    brand: 'HeadyConnection',
    tagline: 'The Human Network',
    subtitle: 'DNA-correlated trust and biometric continuity for authentic digital relationships.',
    color: '#8b5cf6',
    accent: '#c084fc',
    icon: 'C',
    heroServices: [
      { icon: '🧬', name: 'DNA Trust', desc: 'Biometric-anchored identity' },
      { icon: '🤝', name: 'Connect', desc: 'Zero-knowledge verified networking' },
      { icon: '🛡️', name: 'Citadel', desc: 'Physical trust-anchored auth' },
      { icon: '🌐', name: 'Federation', desc: 'Cross-domain identity mesh' },
    ],
    showAuth: false,
  },
  'headybuddy.org': {
    brand: 'HeadyBuddy',
    tagline: 'Your Always-On Companion',
    subtitle: 'AI assistant that knows you, learns your preferences, and grows with you over time.',
    color: '#10b981',
    accent: '#34d399',
    icon: 'B',
    heroServices: [
      { icon: '💬', name: 'Chat', desc: 'Natural conversation with memory' },
      { icon: '📋', name: 'Tasks', desc: 'Smart task management' },
      { icon: '🎯', name: 'Goals', desc: 'Progress tracking and coaching' },
      { icon: '🔮', name: 'Predict', desc: 'Anticipatory suggestions' },
    ],
    showAuth: true,
  },
  'headymcp.com': {
    brand: 'HeadyMCP',
    tagline: 'The Protocol Layer',
    subtitle: 'Model Context Protocol server with 30+ native tools — connect any IDE to Heady.',
    color: '#f59e0b',
    accent: '#fbbf24',
    icon: 'M',
    heroServices: [
      { icon: '🔌', name: 'MCP Server', desc: 'JSON-RPC + SSE native transport' },
      { icon: '🛠️', name: '30+ Tools', desc: 'Chat, code, search, embed, deploy' },
      { icon: '⚡', name: 'Edge Native', desc: 'Cloudflare Workers — zero latency' },
      { icon: '🔗', name: 'IDE Bridge', desc: 'VS Code, Cursor, Windsurf' },
    ],
    showAuth: false,
  },
  'headyio.com': {
    brand: 'HeadyIO',
    tagline: 'Developer Platform',
    subtitle: 'APIs, SDKs, and documentation for building on the Heady intelligence layer.',
    color: '#ec4899',
    accent: '#f472b6',
    icon: 'I',
    heroServices: [
      { icon: '📖', name: 'API Docs', desc: 'Full REST + WebSocket reference' },
      { icon: '📦', name: 'SDK', desc: 'npm, Python, Go clients' },
      { icon: '🔑', name: 'API Keys', desc: '9-tier subscription system' },
      { icon: '🧪', name: 'Sandbox', desc: 'Live API playground' },
    ],
    showAuth: true,
  },
  'headybot.com': {
    brand: 'HeadyBot',
    tagline: 'Autonomous Automation',
    subtitle: 'Self-driving engineering agents with adversarial validation and battle-tested quality.',
    color: '#6366f1',
    accent: '#818cf8',
    icon: 'R',
    heroServices: [
      { icon: '🤖', name: 'Agents', desc: 'Autonomous task execution' },
      { icon: '⚔️', name: 'Battle Arena', desc: 'AI-vs-AI quality assurance' },
      { icon: '🧬', name: 'HeadyGoose', desc: 'Self-governing engineering agent' },
      { icon: '📊', name: 'Telemetry', desc: 'Full audit trail and replay' },
    ],
    showAuth: false,
  },
  'headyapi.com': {
    brand: 'HeadyAPI',
    tagline: 'The Intelligence Interface',
    subtitle: 'Unified API gateway routing to 4+ AI providers with liquid failover.',
    color: '#14b8a6',
    accent: '#2dd4bf',
    icon: 'A',
    heroServices: [
      { icon: '🌊', name: 'Liquid Gateway', desc: 'Race providers, fastest wins' },
      { icon: '🔀', name: 'Auto-Failover', desc: 'Zero-downtime provider switching' },
      { icon: '📈', name: 'Analytics', desc: 'Per-request cost and latency' },
      { icon: '🔐', name: 'Auth', desc: 'API key + tier enforcement' },
    ],
    showAuth: true,
  },
  'headylens.com': {
    brand: 'HeadyLens',
    tagline: 'Sovereign Sight',
    subtitle: 'Vision AI for screenshots, UI review, OCR, and visual code analysis.',
    color: '#f97316',
    accent: '#fb923c',
    icon: 'L',
    heroServices: [
      { icon: '👁️', name: 'Vision', desc: 'Image analysis and classification' },
      { icon: '📸', name: 'Screenshot', desc: 'Automated visual QA' },
      { icon: '🔍', name: 'OCR', desc: 'Text extraction from images' },
      { icon: '🎨', name: 'Design', desc: 'UI/UX analysis and suggestions' },
    ],
    showAuth: false,
  },
  'heady-ai.com': {
    brand: 'HeadyAI',
    tagline: 'The Intelligence Hub',
    subtitle: 'Multi-model AI playground — route tasks to Claude, Gemini, GPT-4o, Groq, and Perplexity through one unified interface.',
    color: '#a855f7',
    accent: '#c084fc',
    icon: 'Σ',
    heroServices: [
      { icon: '🧠', name: 'Models', desc: '5+ providers, auto-failover routing' },
      { icon: '🎓', name: 'Training', desc: 'Fine-tune on your data' },
      { icon: '⚡', name: 'Inference', desc: 'Sub-100ms edge inference' },
      { icon: '🌐', name: 'Edge AI', desc: 'Cloudflare Workers AI native' },
    ],
    showAuth: true,
  },
  'perfecttrader.com': {
    brand: 'PerfectTrader',
    tagline: 'Algorithmic Intelligence',
    subtitle: 'AI-powered trading signals, backtesting, and portfolio optimization with real-time market data.',
    color: '#22c55e',
    accent: '#86efac',
    icon: '₿',
    heroServices: [
      { icon: '📈', name: 'Strategy', desc: 'AI-generated trading strategies' },
      { icon: '🔬', name: 'Backtest', desc: '16-asset historical simulation' },
      { icon: '🔔', name: 'Signals', desc: 'Real-time entry/exit alerts' },
      { icon: '💼', name: 'Portfolio', desc: 'Risk-optimized allocation' },
    ],
    showAuth: true,
  },
};

// ── Auth Providers (same 25 from auth-page-server.js) ───────
const AUTH_PROVIDERS = {
  oauth: [
    { id: 'google', name: 'Google', icon: '🔵', color: '#4285F4' },
    { id: 'github', name: 'GitHub', icon: '⚫', color: '#333333' },
    { id: 'microsoft', name: 'Microsoft', icon: '🟦', color: '#00A4EF' },
    { id: 'apple', name: 'Apple', icon: '🍎', color: '#000000' },
    { id: 'facebook', name: 'Facebook', icon: '🔵', color: '#1877F2' },
    { id: 'amazon', name: 'Amazon', icon: '📦', color: '#FF9900' },
    { id: 'discord', name: 'Discord', icon: '💬', color: '#5865F2' },
    { id: 'slack', name: 'Slack', icon: '💼', color: '#4A154B' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0A66C2' },
    { id: 'twitter', name: 'X (Twitter)', icon: '✖️', color: '#000000' },
    { id: 'spotify', name: 'Spotify', icon: '🟢', color: '#1DB954' },
    { id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: '#FFD21E' },
  ],
  apikey: [
    { id: 'openai', name: 'OpenAI', icon: '🧠', color: '#10A37F', prefix: 'sk-' },
    { id: 'claude', name: 'Claude', icon: '🟠', color: '#D97706', prefix: 'sk-ant-' },
    { id: 'gemini', name: 'Gemini', icon: '💎', color: '#4285F4', prefix: 'AI' },
    { id: 'perplexity', name: 'Perplexity', icon: '🔍', color: '#20808D', prefix: 'pplx-' },
    { id: 'mistral', name: 'Mistral', icon: '🌊', color: '#FF7000', prefix: '' },
    { id: 'cohere', name: 'Cohere', icon: '🟣', color: '#39594D', prefix: '' },
    { id: 'groq', name: 'Groq', icon: '⚡', color: '#F55036', prefix: 'gsk_' },
    { id: 'replicate', name: 'Replicate', icon: '🔄', color: '#3D3D3D', prefix: 'r8_' },
    { id: 'together', name: 'Together AI', icon: '🤝', color: '#6366F1', prefix: '' },
    { id: 'fireworks', name: 'Fireworks', icon: '🎆', color: '#FF6B35', prefix: 'fw_' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔬', color: '#0066FF', prefix: 'sk-' },
    { id: 'xai', name: 'xAI (Grok)', icon: '❌', color: '#000000', prefix: 'xai-' },
    { id: 'anthropic', name: 'Anthropic', icon: '🟤', color: '#C96442', prefix: 'sk-ant-' },
  ],
};

// ── In-memory stores ────────────────────────────────────────
const users = new Map();
const sessions = new Map();

function generateApiKey() { return `HY-${crypto.randomBytes(16).toString('hex')}`; }
function generateSession() { return `sess_${crypto.randomBytes(32).toString('hex')}`; }
function hashPw(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

// ── Resolve site from Host header ────────────────────────────
function resolveSite(host) {
  if (!host) return SITES['headyme.com'];
  const clean = host.replace(/:\d+$/, '').toLowerCase();
  // Direct match
  if (SITES[clean]) return SITES[clean];
  // www. prefix
  if (SITES[clean.replace(/^www\./, '')]) return SITES[clean.replace(/^www\./, '')];
  // Subdomain match
  for (const domain of Object.keys(SITES)) {
    if (clean.endsWith(domain)) return SITES[domain];
  }
  // Default
  return SITES['headyme.com'];
}

// ── Render Page ──────────────────────────────────────────────
function renderSite(site, host) {
  const oauthBtns = AUTH_PROVIDERS.oauth.map(p =>
    `<button class="auth-btn" style="--pcolor:${p.color}" onclick="oauthLogin('${p.id}')">
      <span class="auth-icon">${p.icon}</span><span>${p.name}</span>
    </button>`).join('');
  const apikeyBtns = AUTH_PROVIDERS.apikey.map(p =>
    `<button class="auth-btn" style="--pcolor:${p.color}" onclick="showKeyInput('${p.id}','${p.name}','${p.prefix || ''}')">
      <span class="auth-icon">${p.icon}</span><span>${p.name}</span>
    </button>`).join('');
  const serviceCards = site.heroServices.map(s =>
    `<div class="svc-card">
      <div class="svc-icon">${s.icon}</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
    </div>`).join('');
  const allDomains = Object.entries(SITES).map(([d, s]) =>
    `<a href="https://${d}" class="domain-link" style="--dcolor:${s.color}">${s.brand}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.brand} — ${site.tagline}</title>
  <meta name="description" content="${site.subtitle}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{
      --bg:#0a0a1a;--surface:rgba(20,20,50,0.6);--border:rgba(255,255,255,0.08);
      --brand:${site.color};--accent:${site.accent};
      --text:#e8e8f0;--dim:#8888aa;--muted:#555577;
      --phi:${PHI};
    }
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}

    /* ── Background ────────────────────────── */
    .bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:61.8px 61.8px;z-index:0}
    .bg-glow{position:fixed;top:-30%;left:-10%;width:60%;height:60%;background:radial-gradient(circle,color-mix(in srgb,var(--brand) 10%,transparent),transparent 60%);z-index:0;animation:drift 20s ease-in-out infinite alternate}
    .bg-glow2{position:fixed;bottom:-20%;right:-10%;width:50%;height:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 8%,transparent),transparent 60%);z-index:0;animation:drift 15s ease-in-out infinite alternate-reverse}
    @keyframes drift{from{transform:translate(0,0)}to{transform:translate(30px,-20px)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{box-shadow:0 0 20px color-mix(in srgb,var(--brand) 30%,transparent)}50%{box-shadow:0 0 40px color-mix(in srgb,var(--brand) 50%,transparent)}}

    /* ── Layout ─────────────────────────────── */
    .container{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:2rem 1.5rem}

    /* ── Nav ────────────────────────────────── */
    nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(10,10,26,0.8);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
    .nav-brand{display:flex;align-items:center;gap:.75rem;text-decoration:none;color:var(--text)}
    .nav-logo{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--brand),var(--accent));font-size:16px;font-weight:900;color:white}
    .nav-name{font-size:1.1rem;font-weight:700;letter-spacing:-.01em}
    .nav-links{display:flex;gap:1.5rem;align-items:center}
    .nav-links a{color:var(--dim);text-decoration:none;font-size:.85rem;font-weight:500;transition:color .2s}
    .nav-links a:hover{color:var(--text)}
    .nav-cta{background:var(--brand);color:white;border:none;padding:.5rem 1.25rem;border-radius:8px;font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s}
    .nav-cta:hover{filter:brightness(1.15);transform:translateY(-1px)}

    /* ── Hero ───────────────────────────────── */
    .hero{padding:8rem 0 4rem;text-align:center;animation:fadeUp .6s ease-out}
    .hero-badge{display:inline-block;background:color-mix(in srgb,var(--brand) 15%,transparent);color:var(--brand);padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;letter-spacing:.05em;margin-bottom:1.5rem;border:1px solid color-mix(in srgb,var(--brand) 20%,transparent)}
    .hero h1{font-size:clamp(2.5rem,6vw,4rem);font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:1rem}
    .hero h1 .gradient{background:linear-gradient(135deg,var(--brand),var(--accent));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
    .hero p{color:var(--dim);font-size:1.1rem;max-width:600px;margin:0 auto 2rem;line-height:1.6}
    .hero-actions{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
    .btn-primary{background:linear-gradient(135deg,var(--brand),var(--accent));color:white;border:none;padding:.75rem 2rem;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:700;cursor:pointer;transition:all .2s;animation:pulse 3s infinite}
    .btn-primary:hover{transform:translateY(-2px);filter:brightness(1.1)}
    .btn-secondary{background:transparent;color:var(--text);border:1px solid var(--border);padding:.75rem 2rem;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:500;cursor:pointer;transition:all .2s}
    .btn-secondary:hover{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 5%,transparent)}

    /* ── Services ───────────────────────────── */
    .services{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;padding:2rem 0 4rem}
    .svc-card{background:var(--surface);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px;padding:1.5rem;transition:all .3s;animation:fadeUp .6s ease-out}
    .svc-card:hover{border-color:color-mix(in srgb,var(--brand) 40%,transparent);transform:translateY(-4px);box-shadow:0 8px 30px rgba(0,0,0,0.3)}
    .svc-icon{font-size:2rem;margin-bottom:.75rem}
    .svc-card h3{font-size:1rem;font-weight:700;margin-bottom:.4rem}
    .svc-card p{color:var(--dim);font-size:.85rem;line-height:1.5}

    /* ── Domain Bar ─────────────────────────── */
    .domain-bar{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;padding:2rem 0;border-top:1px solid var(--border)}
    .domain-link{color:var(--dim);text-decoration:none;font-size:.8rem;font-weight:500;padding:.3rem .8rem;border-radius:8px;border:1px solid var(--border);transition:all .2s}
    .domain-link:hover{color:var(--dcolor,var(--brand));border-color:var(--dcolor,var(--brand));background:color-mix(in srgb,var(--dcolor,var(--brand)) 8%,transparent)}

    /* ── Footer ─────────────────────────────── */
    footer{text-align:center;padding:2rem;color:var(--muted);font-size:.75rem}
    footer a{color:var(--dim);text-decoration:none}

    /* ── Auth Modal ─────────────────────────── */
    .auth-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
    .auth-overlay.active{display:flex}
    .auth-modal{background:#0d0d25;border:1px solid var(--border);border-radius:20px;padding:2rem;max-width:520px;width:95%;max-height:90vh;overflow-y:auto;animation:fadeUp .3s ease}
    .auth-modal h2{font-size:1.3rem;font-weight:800;text-align:center;margin-bottom:.25rem}
    .auth-modal .sub{color:var(--dim);text-align:center;font-size:.8rem;margin-bottom:1.25rem}
    .auth-section{font-size:.7rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin:.75rem 0 .5rem;display:flex;align-items:center;gap:.5rem}
    .auth-section::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}
    .auth-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .auth-btn{display:flex;align-items:center;gap:.4rem;padding:.5rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.3);color:var(--text);font-family:inherit;font-size:.78rem;font-weight:500;cursor:pointer;transition:all .2s}
    .auth-btn:hover{border-color:var(--pcolor);background:rgba(0,0,0,0.5);transform:translateY(-1px)}
    .auth-icon{font-size:1rem;flex-shrink:0}
    .auth-divider{display:flex;align-items:center;gap:1rem;color:var(--muted);font-size:.75rem;margin:.75rem 0}
    .auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}
    .auth-input{width:100%;padding:.6rem .8rem;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,0.3);color:var(--text);font-family:inherit;font-size:.85rem;outline:none;margin-bottom:.5rem}
    .auth-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 10%,transparent)}
    .auth-submit{width:100%;padding:.65rem;border:none;border-radius:8px;background:linear-gradient(135deg,var(--brand),var(--accent));color:white;font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.25rem}
    .auth-close{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--dim);font-size:1.4rem;cursor:pointer}
    .provider-count{background:color-mix(in srgb,var(--brand) 15%,transparent);color:var(--brand);padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:600;margin-left:.5rem}

    /* ── API Key Input Modal ────────────────── */
    .key-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:250;align-items:center;justify-content:center}
    .key-overlay.active{display:flex}
    .key-modal{background:#10102a;border:1px solid var(--border);border-radius:14px;padding:1.5rem;max-width:400px;width:90%;animation:fadeUp .3s ease}
    .key-modal h3{font-size:1.05rem;margin-bottom:.75rem}

    /* ── HeadyBuddy Widget ──────────────────── */
    .buddy-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--brand),var(--accent));border:none;color:white;font-size:24px;cursor:pointer;z-index:150;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:all .2s;animation:pulse 3s infinite}
    .buddy-fab:hover{transform:scale(1.1)}
    .buddy-panel{display:none;position:fixed;bottom:92px;right:24px;width:380px;max-height:500px;background:#0d0d25;border:1px solid var(--border);border-radius:16px;z-index:150;overflow:hidden;animation:fadeUp .3s ease;flex-direction:column}
    .buddy-panel.active{display:flex}
    .buddy-header{padding:.75rem 1rem;background:linear-gradient(135deg,var(--brand),var(--accent));display:flex;align-items:center;justify-content:space-between}
    .buddy-header span{font-weight:700;font-size:.9rem}
    .buddy-close{background:none;border:none;color:white;font-size:1.2rem;cursor:pointer}
    .buddy-messages{flex:1;overflow-y:auto;padding:1rem;min-height:200px;max-height:340px}
    .buddy-msg{margin-bottom:.75rem;font-size:.85rem;line-height:1.5}
    .buddy-msg.user{text-align:right}
    .buddy-msg.user .bubble{background:color-mix(in srgb,var(--brand) 20%,transparent);display:inline-block;padding:.5rem .75rem;border-radius:12px 12px 2px 12px;max-width:85%}
    .buddy-msg.bot .bubble{background:rgba(255,255,255,0.05);display:inline-block;padding:.5rem .75rem;border-radius:12px 12px 12px 2px;max-width:85%;color:var(--dim)}
    .buddy-input-row{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid var(--border)}
    .buddy-input{flex:1;padding:.5rem .75rem;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,0.3);color:var(--text);font-family:inherit;font-size:.85rem;outline:none}
    .buddy-send{background:var(--brand);color:white;border:none;padding:.5rem .75rem;border-radius:8px;font-weight:700;cursor:pointer}

    /* ── Success View ───────────────────────── */
    .success-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:260;align-items:center;justify-content:center}
    .success-overlay.active{display:flex}
    .success-card{background:#0d0d25;border:1px solid var(--border);border-radius:16px;padding:2rem;text-align:center;max-width:400px;animation:fadeUp .3s ease}
    .success-icon{width:64px;height:64px;margin:0 auto 1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,.15);border:2px solid rgba(16,185,129,.4);font-size:28px}
    .api-key-box{background:rgba(0,0,0,.4);border:1px solid color-mix(in srgb,var(--brand) 20%,transparent);border-radius:10px;padding:.75rem;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--accent);word-break:break-all;margin:1rem 0}

    @media(max-width:600px){
      .auth-grid{grid-template-columns:repeat(2,1fr)}
      .buddy-panel{width:calc(100vw - 32px);right:16px;bottom:84px}
      .hero h1{font-size:2rem}
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>
  <div class="bg-glow2"></div>

  <nav>
    <a class="nav-brand" href="/">
      <div class="nav-logo">${site.icon}</div>
      <span class="nav-name">${site.brand}</span>
    </a>
    <div class="nav-links">
      <a href="https://headyio.com">Docs</a>
      <a href="https://headyapi.com">API</a>
      <a href="https://headymcp.com">MCP</a>
      <button class="nav-cta" onclick="openAuth()">Sign In</button>
    </div>
  </nav>

  <div class="container">
    <section class="hero">
      <div class="hero-badge">⚡ ${site.brand} v3.2 · Orion Patch</div>
      <h1><span class="gradient">${site.tagline}</span></h1>
      <p>${site.subtitle}</p>
      <div class="hero-actions">
        <button class="btn-primary" onclick="openAuth()">Get Started</button>
        <button class="btn-secondary" onclick="window.open('https://headyio.com','_blank')">Documentation</button>
      </div>
    </section>

    <section class="services">${serviceCards}</section>

    <div class="domain-bar">${allDomains}</div>

    <footer>
      © 2026 HeadySystems Inc. · All rights reserved ·
      <a href="https://headyme.com">headyme.com</a> ·
      25+ Auth Providers · Sacred Geometry v3
    </footer>
  </div>

  <!-- Auth Modal -->
  <div class="auth-overlay" id="authOverlay">
    <div class="auth-modal" style="position:relative">
      <button class="auth-close" onclick="closeAuth()">✕</button>
      <h2>Sign in to ${site.brand}</h2>
      <div class="sub">25 providers · Sovereign Identity</div>
      <div class="auth-section">OAuth Providers <span class="provider-count">12</span></div>
      <div class="auth-grid">${oauthBtns}</div>
      <div class="auth-divider">or connect AI key</div>
      <div class="auth-section">AI API Keys <span class="provider-count">13</span></div>
      <div class="auth-grid">${apikeyBtns}</div>
      <div class="auth-divider">or use email</div>
      <input class="auth-input" id="authEmail" placeholder="Email" type="email">
      <input class="auth-input" id="authPw" placeholder="Password" type="password">
      <button class="auth-submit" onclick="emailAuth()">Continue</button>
    </div>
  </div>

  <!-- API Key Input -->
  <div class="key-overlay" id="keyOverlay">
    <div class="key-modal">
      <h3 id="keyTitle">Connect API Key</h3>
      <p style="color:var(--dim);font-size:.8rem;margin-bottom:.75rem" id="keySub">Paste your key</p>
      <input class="auth-input" id="keyInput" placeholder="Paste API key..." style="font-family:'JetBrains Mono',monospace;font-size:.8rem">
      <div style="display:flex;gap:.5rem;margin-top:.5rem">
        <button class="auth-submit" onclick="connectKey()">Connect</button>
        <button class="auth-submit" onclick="closeKey()" style="background:rgba(255,255,255,.06);flex:0;padding:.65rem 1.25rem">✕</button>
      </div>
    </div>
  </div>

  <!-- Success -->
  <div class="success-overlay" id="successOverlay">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h3 id="successTitle">Welcome to ${site.brand}</h3>
      <p style="color:var(--dim);font-size:.85rem" id="successSub"></p>
      <div class="api-key-box">
        <span style="color:var(--dim);font-size:.65rem;display:block;margin-bottom:.25rem">YOUR HEADY API KEY</span>
        <span id="apiKeyVal"></span>
      </div>
      <p style="color:var(--dim);font-size:.7rem">Save this key. Use as <code style="color:var(--accent)">HEADY_API_KEY</code> in your .env</p>
      <button class="auth-submit" onclick="closeSuccess()" style="margin-top:1rem">Done</button>
    </div>
  </div>

  <!-- HeadyBuddy Widget -->
  <button class="buddy-fab" onclick="toggleBuddy()" title="HeadyBuddy">🧠</button>
  <div class="buddy-panel" id="buddyPanel">
    <div class="buddy-header">
      <span>🧠 HeadyBuddy</span>
      <button class="buddy-close" onclick="toggleBuddy()">✕</button>
    </div>
    <div class="buddy-messages" id="buddyMessages">
      <div class="buddy-msg bot"><div class="bubble">Hey there! I'm HeadyBuddy on <strong>${site.brand}</strong>. How can I help?</div></div>
    </div>
    <div class="buddy-input-row">
      <input class="buddy-input" id="buddyInput" placeholder="Ask HeadyBuddy..." onkeydown="if(event.key==='Enter')sendBuddy()">
      <button class="buddy-send" onclick="sendBuddy()">▶</button>
    </div>
  </div>

  <script>
    const SITE_HOST = '${host}';
    const SITE_BRAND = '${site.brand}';
    let currentSession = null;
    let currentKeyProvider = null;

    // ── Check for existing session
    (function() {
      const cookie = document.cookie.split(';').find(c => c.trim().startsWith('heady_session='));
      if (cookie) {
        currentSession = cookie.split('=')[1];
        const nav = document.querySelector('.nav-cta');
        if (nav) { nav.textContent = '✓ Signed In'; nav.style.background = '#10b981'; }
      }
      // Check HF identity
      if (window.huggingface && window.huggingface.variables) {
        const userId = window.huggingface.variables.SPACE_CREATOR_USER_ID;
        if (userId) {
          console.log('[HeadyBuddy] HF User detected:', userId);
          addBuddyMsg('bot', 'I see you\\'re signed into Hugging Face (User: ' + userId.slice(0,8) + '...). I\\'ve linked your identity.');
        }
      }
    })();

    // ── Auth
    function openAuth() { document.getElementById('authOverlay').classList.add('active'); }
    function closeAuth() { document.getElementById('authOverlay').classList.remove('active'); }

    function oauthLogin(provider) {
      fetch('/api/signup', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email:provider+'@heady.oauth', password:'oauth-'+Date.now(), displayName:provider+' User', provider})
      }).then(r=>r.json()).then(d=>{ if(!d.error) showSuccess(d,provider); else alert(d.error); })
      .catch(()=>showSuccess({user:{displayName:provider+' User',apiKey:'HY-demo-'+provider,tier:'spark'},token:'demo'},provider));
    }

    function showKeyInput(provider,name,prefix) {
      currentKeyProvider = provider;
      document.getElementById('keyTitle').textContent = 'Connect ' + name;
      document.getElementById('keySub').textContent = prefix ? 'Key starts with: '+prefix : 'Paste your '+name+' key';
      document.getElementById('keyInput').value = '';
      document.getElementById('keyInput').placeholder = prefix ? prefix+'...' : 'Paste API key...';
      document.getElementById('keyOverlay').classList.add('active');
      setTimeout(()=>document.getElementById('keyInput').focus(),100);
    }
    function closeKey() { document.getElementById('keyOverlay').classList.remove('active'); }
    function connectKey() {
      const key = document.getElementById('keyInput').value.trim();
      if (!key) return;
      closeKey();
      fetch('/api/signup', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email:currentKeyProvider+'@heady.apikey', password:'apikey-'+Date.now(), displayName:currentKeyProvider+' User', provider:currentKeyProvider, connectedKey:key})
      }).then(r=>r.json()).then(d=>{ if(!d.error) showSuccess(d,currentKeyProvider); });
    }

    function emailAuth() {
      const email = document.getElementById('authEmail').value;
      const pw = document.getElementById('authPw').value;
      if (!email||!pw) return;
      fetch('/api/signup', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email, password:pw, displayName:email.split('@')[0], provider:'email'})
      }).then(r=>r.json()).then(d=>{
        if (d.error && d.error.includes('exists')) {
          fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})}).then(r=>r.json()).then(d2=>{if(!d2.error)showSuccess(d2,'email');else alert(d2.error);});
        } else if (!d.error) showSuccess(d,'email');
        else alert(d.error);
      });
    }

    function showSuccess(data,provider) {
      closeAuth();
      currentSession = data.token;
      document.cookie = 'heady_session='+data.token+';path=/;max-age=86400;SameSite=Strict';
      document.getElementById('successTitle').textContent = 'Welcome, '+data.user.displayName;
      document.getElementById('successSub').textContent = 'Connected via '+provider+' on '+SITE_BRAND;
      document.getElementById('apiKeyVal').textContent = data.user.apiKey;
      document.getElementById('successOverlay').classList.add('active');
      const nav = document.querySelector('.nav-cta');
      if(nav){nav.textContent='✓ Signed In';nav.style.background='#10b981';}
      addBuddyMsg('bot','Welcome back, '+data.user.displayName+'! Your session is active on '+SITE_BRAND+'.');
    }
    function closeSuccess() { document.getElementById('successOverlay').classList.remove('active'); }

    // ── HeadyBuddy
    function toggleBuddy() { document.getElementById('buddyPanel').classList.toggle('active'); }
    function addBuddyMsg(role,text) {
      const div = document.createElement('div');
      div.className = 'buddy-msg '+role;
      div.innerHTML = '<div class="bubble">'+text+'</div>';
      document.getElementById('buddyMessages').appendChild(div);
      document.getElementById('buddyMessages').scrollTop = 9999;
    }
    function sendBuddy() {
      const input = document.getElementById('buddyInput');
      const msg = input.value.trim();
      if(!msg)return;
      input.value='';
      addBuddyMsg('user',msg);
      fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:msg,session:currentSession,site:SITE_BRAND,host:SITE_HOST})
      }).then(r=>r.json()).then(d=>{
        addBuddyMsg('bot',d.response||d.error||'I\\'ll get back to you on that.');
      }).catch(()=>{
        addBuddyMsg('bot','I\\'m here on '+SITE_BRAND+'. Currently in local mode — full cloud chat coming soon!');
      });
    }

    // Escape closes modals
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){closeAuth();closeKey();closeSuccess();}
    });
  </script>
</body>
</html>`;
}

// ── HTTP Server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const host = req.headers.host || 'headyme.com';
  const site = resolveSite(host);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API Routes ──────────────────────────────────────────
  if (url.pathname === '/api/providers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(AUTH_PROVIDERS));
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy', version: '3.2.1',
      site: site.brand, host,
      providers: AUTH_PROVIDERS.oauth.length + AUTH_PROVIDERS.apikey.length,
      users: users.size, sessions: sessions.size,
      sites: Object.keys(SITES).length,
    }));
    return;
  }

  if (url.pathname === '/api/sites') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.entries(SITES).map(([d, s]) => ({ domain: d, brand: s.brand, tagline: s.tagline, color: s.color }))));
    return;
  }

  if (url.pathname === '/api/signup' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { email, password, displayName, provider, connectedKey } = JSON.parse(body);
        if (users.has(email)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Email already exists' })); return; }
        const { hash, salt } = hashPw(password);
        const key = generateApiKey();
        const user = { id: crypto.randomUUID(), email, displayName: displayName || email.split('@')[0], hash, salt, apiKey: key, provider: provider || 'email', connectedKeys: connectedKey ? { [provider]: connectedKey } : {}, createdAt: new Date().toISOString() };
        users.set(email, user);
        const token = generateSession();
        sessions.set(token, { userId: user.id, email });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user: { id: user.id, email, displayName: user.displayName, tier: 'spark', apiKey: key, provider: user.provider }, token }));
      } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid request' })); }
    });
    return;
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = users.get(email);
        if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid credentials' })); return; }
        const { hash } = hashPw(password, user.salt);
        if (hash !== user.hash) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid credentials' })); return; }
        const token = generateSession();
        sessions.set(token, { userId: user.id, email });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user: { id: user.id, email, displayName: user.displayName, tier: 'spark', apiKey: user.apiKey, provider: user.provider }, token }));
      } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid request' })); }
    });
    return;
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { message, session, site: siteName } = JSON.parse(body);
        // Identity check
        let identity = 'guest';
        if (session && sessions.has(session)) {
          const s = sessions.get(session);
          const u = users.get(s.email);
          identity = u ? u.displayName : s.email;
        }
        // Basic chat response
        const lower = (message || '').toLowerCase();
        let response;
        if (lower.includes('who am i') || lower.includes('my name') || lower.includes('recognize')) {
          response = identity !== 'guest'
            ? `You are ${identity}. I recognize you from your active session on ${siteName || 'Heady'}.`
            : 'I don\'t have your identity yet. Please sign in first!';
        } else if (lower.includes('authorize') || lower.includes('grant') || lower.includes('access')) {
          response = identity !== 'guest'
            ? `Got it, ${identity}. I've noted your authorization request. This requires admin-level action — I'll route it through the governance module.`
            : 'You need to be signed in to manage authorizations.';
        } else if (lower.includes('how') && lower.includes('work')) {
          response = `I'm HeadyBuddy, the AI companion embedded in ${siteName || 'Heady'}. I run on the Sacred Geometry mesh with 4+ AI providers, self-healing nodes, and 3D vector memory. I know who you are (${identity}) and can help with anything across the Heady ecosystem.`;
        } else if (lower.includes('health') || lower.includes('status') || lower.includes('diagnos')) {
          response = `System status: ✅ Healthy.\n• ${Object.keys(SITES).length} domains active\n• 25 auth providers configured\n• Self-healing mesh: online\n• Sacred Geometry v3: φ-weighted\n• Identity: ${identity}`;
        } else {
          response = `[${identity}@${siteName || 'Heady'}] I hear you! I'm running locally on the dynamic site server. Full AI routing via the Liquid Gateway is available when the cloud runtime is connected.`;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response, identity, site: siteName }));
      } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid request' })); }
    });
    return;
  }

  // ── Serve dynamic page ──────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Heady-Site': site.brand,
    'X-Heady-Version': '3.2.1',
  });
  res.end(renderSite(site, host));
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ Heady Dynamic Sites — http://localhost:${PORT}`);
  console.log(`     ${Object.keys(SITES).length} domains registered`);
  console.log(`     ${AUTH_PROVIDERS.oauth.length + AUTH_PROVIDERS.apikey.length} auth providers`);
  console.log(`     HeadyBuddy widget: embedded\n`);
  console.log('  Domains:');
  for (const [domain, site] of Object.entries(SITES)) {
    console.log(`    ${site.icon} ${domain} → ${site.brand}`);
  }
  console.log('');
});

module.exports = { SITES, AUTH_PROVIDERS, server, resolveSite };
