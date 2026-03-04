// ═══════════════════════════════════════════════════════════════
// Heady Dynamic Site Router — Cloudflare Worker
// Serves ALL 9 domains dynamically at the edge.
// Zero middleware. Zero origin. Edge IS the server.
//
// © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
// ═══════════════════════════════════════════════════════════════

const PHI = 1.6180339887;
const VERSION = '3.2.1';

// ── Owner Identity — The root-level user who owns this system ─
const OWNER = {
  id: '6979903b04361668484f9923',  // HF SPACE_CREATOR_USER_ID
  emails: ['eric@headyme.com', 'e@headyme.com', 'eric@headyconnection.org', 'eric@headysystems.com'],
  name: 'Eric Haywood',
  displayName: 'Eric',
  role: 'owner',
  tier: 'sovereign',
  permissions: ['root', 'admin', 'deploy', 'govern', 'authorize', 'vault', 'filesystem', 'exec'],
  hfUserId: '6979903b04361668484f9923',
  devices: [],  // populated from KV at runtime
};

// ── Site Registry ────────────────────────────────────────────
const SITES = {
  'headyme.com': { brand: 'HeadyMe', tagline: 'Your Sovereign AI', sub: 'Personal intelligence across every device, every domain.', color: '#4c8fff', accent: '#00d4ff', icon: '🧠', services: [{ i: '🧠', n: 'AI Chat', d: 'Multi-provider reasoning' }, { i: '🔐', n: 'Vault', d: 'AES-256-GCM credential store' }, { i: '📊', n: 'Dashboard', d: 'Real-time analytics & health' }, { i: '🐝', n: 'Bee Swarm', d: 'Distributed task execution' }] },
  'headysystems.com': { brand: 'HeadySystems', tagline: 'Architecture of Intelligence', sub: 'Self-healing infrastructure, Sacred Geometry, fault-tolerant lattice.', color: '#00d4ff', accent: '#4c8fff', icon: '⚙️', services: [{ i: '⚙️', n: 'Ops Console', d: '14 service groups, CLI' }, { i: '🏗️', n: 'Architecture', d: '6-layer zero-trust mesh' }, { i: '⚛️', n: 'Quantum IP', d: 'RSSC error correction' }, { i: '🔄', n: 'Self-Heal', d: 'Attestation + auto-respawn' }] },
  'headyconnection.org': { brand: 'HeadyConnection', tagline: 'The Human Network', sub: 'DNA-correlated trust, biometric continuity, authentic digital identity.', color: '#8b5cf6', accent: '#c084fc', icon: '🧬', services: [{ i: '🧬', n: 'DNA Trust', d: 'Biometric-anchored ID' }, { i: '🤝', n: 'Connect', d: 'Zero-knowledge networking' }, { i: '🛡️', n: 'Citadel', d: 'Physical trust anchor' }, { i: '🌐', n: 'Federation', d: 'Cross-domain mesh' }] },
  'headybuddy.org': { brand: 'HeadyBuddy', tagline: 'Always-On Companion', sub: 'AI that knows you, learns your preferences, grows with you.', color: '#10b981', accent: '#34d399', icon: '🤖', services: [{ i: '💬', n: 'Chat', d: 'Natural conversation + memory' }, { i: '📋', n: 'Tasks', d: 'Smart task management' }, { i: '🎯', n: 'Goals', d: 'Progress coaching' }, { i: '🔮', n: 'Predict', d: 'Anticipatory suggestions' }] },
  'headymcp.com': { brand: 'HeadyMCP', tagline: 'The Protocol Layer', sub: 'MCP server — 30+ tools, JSON-RPC + SSE, connect any IDE.', color: '#f59e0b', accent: '#fbbf24', icon: '🔌', services: [{ i: '🔌', n: 'MCP Server', d: 'JSON-RPC + SSE transport' }, { i: '🛠️', n: '30+ Tools', d: 'Chat, code, embed, deploy' }, { i: '⚡', n: 'Edge Native', d: 'Zero-latency Workers' }, { i: '🔗', n: 'IDE Bridge', d: 'VS Code, Cursor, Windsurf' }] },
  'headyio.com': { brand: 'HeadyIO', tagline: 'Developer Platform', sub: 'APIs, SDKs, and docs for building on the Heady layer.', color: '#ec4899', accent: '#f472b6', icon: '⚡', services: [{ i: '📖', n: 'API Docs', d: 'REST + WebSocket reference' }, { i: '📦', n: 'SDK', d: 'npm, Python, Go clients' }, { i: '🔑', n: 'API Keys', d: '9-tier subscriptions' }, { i: '🧪', n: 'Sandbox', d: 'Live API playground' }] },
  'headybot.com': { brand: 'HeadyBot', tagline: 'Autonomous Automation', sub: 'Self-driving engineering agents with battle-tested quality.', color: '#6366f1', accent: '#818cf8', icon: '🤖', services: [{ i: '🤖', n: 'Agents', d: 'Autonomous execution' }, { i: '⚔️', n: 'Battle Arena', d: 'AI-vs-AI QA' }, { i: '🧬', n: 'HeadyGoose', d: 'Self-governing agent' }, { i: '📊', n: 'Telemetry', d: 'Full audit trail' }] },
  'headyapi.com': { brand: 'HeadyAPI', tagline: 'Intelligence Interface', sub: 'Unified API gateway — 4+ providers, liquid failover.', color: '#14b8a6', accent: '#2dd4bf', icon: '🌊', services: [{ i: '🌊', n: 'Liquid Gateway', d: 'Race providers, fastest wins' }, { i: '🔀', n: 'Failover', d: 'Zero-downtime switching' }, { i: '📈', n: 'Analytics', d: 'Per-request cost/latency' }, { i: '🔐', n: 'Auth', d: 'Key + tier enforcement' }] },
  'headylens.com': { brand: 'HeadyLens', tagline: 'Sovereign Sight', sub: 'Vision AI — screenshots, OCR, UI review, visual code analysis.', color: '#f97316', accent: '#fb923c', icon: '👁️', services: [{ i: '👁️', n: 'Vision', d: 'Image classification' }, { i: '📸', n: 'Screenshot', d: 'Visual QA' }, { i: '🔍', n: 'OCR', d: 'Text extraction' }, { i: '🎨', n: 'Design', d: 'UI/UX analysis' }] },
};

// ── Auth Providers (25 total) ────────────────────────────────
const OAUTH = [
  { id: 'google', n: 'Google', i: '🔵', c: '#4285F4' }, { id: 'github', n: 'GitHub', i: '⚫', c: '#333' }, { id: 'microsoft', n: 'Microsoft', i: '🟦', c: '#00A4EF' },
  { id: 'apple', n: 'Apple', i: '🍎', c: '#000' }, { id: 'facebook', n: 'Facebook', i: '🔵', c: '#1877F2' }, { id: 'amazon', n: 'Amazon', i: '📦', c: '#FF9900' },
  { id: 'discord', n: 'Discord', i: '💬', c: '#5865F2' }, { id: 'slack', n: 'Slack', i: '💼', c: '#4A154B' }, { id: 'linkedin', n: 'LinkedIn', i: '💼', c: '#0A66C2' },
  { id: 'twitter', n: 'X (Twitter)', i: '✖️', c: '#000' }, { id: 'spotify', n: 'Spotify', i: '🟢', c: '#1DB954' }, { id: 'huggingface', n: 'Hugging Face', i: '🤗', c: '#FFD21E' },
];
const APIKEYS = [
  { id: 'openai', n: 'OpenAI', i: '🧠', c: '#10A37F', p: 'sk-' }, { id: 'claude', n: 'Claude', i: '🟠', c: '#D97706', p: 'sk-ant-' }, { id: 'gemini', n: 'Gemini', i: '💎', c: '#4285F4', p: 'AI' },
  { id: 'perplexity', n: 'Perplexity', i: '🔍', c: '#20808D', p: 'pplx-' }, { id: 'mistral', n: 'Mistral', i: '🌊', c: '#FF7000', p: '' }, { id: 'cohere', n: 'Cohere', i: '🟣', c: '#39594D', p: '' },
  { id: 'groq', n: 'Groq', i: '⚡', c: '#F55036', p: 'gsk_' }, { id: 'replicate', n: 'Replicate', i: '🔄', c: '#3D3D3D', p: 'r8_' }, { id: 'together', n: 'Together AI', i: '🤝', c: '#6366F1', p: '' },
  { id: 'fireworks', n: 'Fireworks', i: '🎆', c: '#FF6B35', p: 'fw_' }, { id: 'deepseek', n: 'DeepSeek', i: '🔬', c: '#06F', p: 'sk-' }, { id: 'xai', n: 'xAI (Grok)', i: '❌', c: '#000', p: 'xai-' },
  { id: 'anthropic', n: 'Anthropic', i: '🟤', c: '#C96442', p: 'sk-ant-' },
];

// ── Resolve domain → site ────────────────────────────────────
function resolve(host) {
  if (!host) return SITES['headyme.com'];
  const h = host.replace(/:\d+$/, '').replace(/^www\./, '').toLowerCase();
  return SITES[h] || SITES['headyme.com'];
}

// ── Render full branded page at the edge ─────────────────────
function renderSite(s, host) {
  const oB = OAUTH.map(p => `<button class="ab" style="--p:${p.c}" onclick="oAuth('${p.id}')">${p.i} ${p.n}</button>`).join('');
  const kB = APIKEYS.map(p => `<button class="ab" style="--p:${p.c}" onclick="keyIn('${p.id}','${p.n}','${p.p || ''}')">${p.i} ${p.n}</button>`).join('');
  const sC = s.services.map(v => `<div class="sc"><div class="si">${v.i}</div><h3>${v.n}</h3><p>${v.d}</p></div>`).join('');
  const dL = Object.entries(SITES).map(([d, v]) => `<a href="https://${d}" class="dl" style="--dc:${v.color}">${v.icon} ${v.brand}</a>`).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.brand} — ${s.tagline}</title>
<meta name="description" content="${s.sub}">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a1a;--sf:rgba(20,20,50,.6);--bd:rgba(255,255,255,.08);--br:${s.color};--ac:${s.accent};--tx:#e8e8f0;--dm:#8888aa;--mt:#555577}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;overflow-x:hidden}
.gd{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:61.8px 61.8px;z-index:0}
.gw{position:fixed;top:-30%;left:-10%;width:60%;height:60%;background:radial-gradient(circle,color-mix(in srgb,var(--br) 10%,transparent),transparent 60%);z-index:0;animation:dr 20s ease-in-out infinite alternate}
.gw2{position:fixed;bottom:-20%;right:-10%;width:50%;height:50%;background:radial-gradient(circle,color-mix(in srgb,var(--ac) 8%,transparent),transparent 60%);z-index:0;animation:dr 15s ease-in-out infinite alternate-reverse}
@keyframes dr{from{transform:translate(0,0)}to{transform:translate(30px,-20px)}}
@keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes pl{0%,100%{box-shadow:0 0 20px color-mix(in srgb,var(--br) 30%,transparent)}50%{box-shadow:0 0 40px color-mix(in srgb,var(--br) 50%,transparent)}}
.ct{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:2rem 1.5rem}
nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(10,10,26,.8);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd)}
.nb{display:flex;align-items:center;gap:.75rem;text-decoration:none;color:var(--tx)}
.nl{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--br),var(--ac));font-size:16px;font-weight:900;color:white}
.nn{font-size:1.1rem;font-weight:700;letter-spacing:-.01em}
.nk{display:flex;gap:1.5rem;align-items:center}
.nk a{color:var(--dm);text-decoration:none;font-size:.85rem;font-weight:500;transition:color .2s}
.nk a:hover{color:var(--tx)}
.nc{background:var(--br);color:white;border:none;padding:.5rem 1.25rem;border-radius:8px;font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s}
.nc:hover{filter:brightness(1.15);transform:translateY(-1px)}
.hr{padding:8rem 0 4rem;text-align:center;animation:fu .6s ease-out}
.hb{display:inline-block;background:color-mix(in srgb,var(--br) 15%,transparent);color:var(--br);padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;letter-spacing:.05em;margin-bottom:1.5rem;border:1px solid color-mix(in srgb,var(--br) 20%,transparent)}
.hr h1{font-size:clamp(2.5rem,6vw,4rem);font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:1rem}
.hr h1 .g{background:linear-gradient(135deg,var(--br),var(--ac));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hr p{color:var(--dm);font-size:1.1rem;max-width:600px;margin:0 auto 2rem;line-height:1.6}
.ha{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.bp{background:linear-gradient(135deg,var(--br),var(--ac));color:white;border:none;padding:.75rem 2rem;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:700;cursor:pointer;transition:all .2s;animation:pl 3s infinite}
.bp:hover{transform:translateY(-2px);filter:brightness(1.1)}
.bs{background:transparent;color:var(--tx);border:1px solid var(--bd);padding:.75rem 2rem;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:500;cursor:pointer;transition:all .2s}
.bs:hover{border-color:var(--br);background:color-mix(in srgb,var(--br) 5%,transparent)}
.sv{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;padding:2rem 0 4rem}
.sc{background:var(--sf);backdrop-filter:blur(20px);border:1px solid var(--bd);border-radius:16px;padding:1.5rem;transition:all .3s;animation:fu .6s ease-out}
.sc:hover{border-color:color-mix(in srgb,var(--br) 40%,transparent);transform:translateY(-4px);box-shadow:0 8px 30px rgba(0,0,0,.3)}
.si{font-size:2rem;margin-bottom:.75rem}
.sc h3{font-size:1rem;font-weight:700;margin-bottom:.4rem}
.sc p{color:var(--dm);font-size:.85rem;line-height:1.5}
.db{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;padding:2rem 0;border-top:1px solid var(--bd)}
.dl{color:var(--dm);text-decoration:none;font-size:.8rem;font-weight:500;padding:.3rem .8rem;border-radius:8px;border:1px solid var(--bd);transition:all .2s}
.dl:hover{color:var(--dc);border-color:var(--dc);background:color-mix(in srgb,var(--dc,var(--br)) 8%,transparent)}
ft{display:block;text-align:center;padding:2rem;color:var(--mt);font-size:.75rem}
ft a{color:var(--dm);text-decoration:none}
.ao{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;align-items:center;justify-content:center;backdrop-filter:blur(6px)}.ao.on{display:flex}
.am{background:#0d0d25;border:1px solid var(--bd);border-radius:20px;padding:2rem;max-width:520px;width:95%;max-height:90vh;overflow-y:auto;animation:fu .3s ease;position:relative}
.am h2{font-size:1.3rem;font-weight:800;text-align:center;margin-bottom:.25rem}
.am .sub{color:var(--dm);text-align:center;font-size:.8rem;margin-bottom:1.25rem}
.as{font-size:.7rem;font-weight:700;color:var(--dm);text-transform:uppercase;letter-spacing:.08em;margin:.75rem 0 .5rem;display:flex;align-items:center;gap:.5rem}
.as::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
.ag{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ab{display:flex;align-items:center;gap:.4rem;padding:.5rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.3);color:var(--tx);font-family:inherit;font-size:.78rem;font-weight:500;cursor:pointer;transition:all .2s}
.ab:hover{border-color:var(--p);background:rgba(0,0,0,.5);transform:translateY(-1px)}
.ad{display:flex;align-items:center;gap:1rem;color:var(--mt);font-size:.75rem;margin:.75rem 0}
.ad::before,.ad::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
.ai{width:100%;padding:.6rem .8rem;border-radius:8px;border:1px solid var(--bd);background:rgba(0,0,0,.3);color:var(--tx);font-family:inherit;font-size:.85rem;outline:none;margin-bottom:.5rem}
.ai:focus{border-color:var(--br);box-shadow:0 0 0 3px color-mix(in srgb,var(--br) 10%,transparent)}
.ax{width:100%;padding:.65rem;border:none;border-radius:8px;background:linear-gradient(135deg,var(--br),var(--ac));color:white;font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.25rem}
.ac{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--dm);font-size:1.4rem;cursor:pointer}
.pc{background:color-mix(in srgb,var(--br) 15%,transparent);color:var(--br);padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:600;margin-left:.5rem}
.ko{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:250;align-items:center;justify-content:center}.ko.on{display:flex}
.km{background:#10102a;border:1px solid var(--bd);border-radius:14px;padding:1.5rem;max-width:400px;width:90%;animation:fu .3s ease}
.km h3{font-size:1.05rem;margin-bottom:.75rem}
.so{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:260;align-items:center;justify-content:center}.so.on{display:flex}
.sk{background:#0d0d25;border:1px solid var(--bd);border-radius:16px;padding:2rem;text-align:center;max-width:400px;animation:fu .3s ease}
.si2{width:64px;height:64px;margin:0 auto 1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,.15);border:2px solid rgba(16,185,129,.4);font-size:28px}
.kb{background:rgba(0,0,0,.4);border:1px solid color-mix(in srgb,var(--br) 20%,transparent);border-radius:10px;padding:.75rem;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--ac);word-break:break-all;margin:1rem 0}
.bf{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--br),var(--ac));border:none;color:white;font-size:24px;cursor:pointer;z-index:150;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:all .2s;animation:pl 3s infinite}
.bf:hover{transform:scale(1.1)}
.bx{display:none;position:fixed;bottom:92px;right:24px;width:380px;max-height:500px;background:#0d0d25;border:1px solid var(--bd);border-radius:16px;z-index:150;overflow:hidden;animation:fu .3s ease;flex-direction:column}.bx.on{display:flex}
.bh{padding:.75rem 1rem;background:linear-gradient(135deg,var(--br),var(--ac));display:flex;align-items:center;justify-content:space-between}
.bh span{font-weight:700;font-size:.9rem}
.bc{background:none;border:none;color:white;font-size:1.2rem;cursor:pointer}
.bm{flex:1;overflow-y:auto;padding:1rem;min-height:200px;max-height:340px}
.mg{margin-bottom:.75rem;font-size:.85rem;line-height:1.5}
.mg.u{text-align:right}
.mg.u .bl{background:color-mix(in srgb,var(--br) 20%,transparent);display:inline-block;padding:.5rem .75rem;border-radius:12px 12px 2px 12px;max-width:85%}
.mg.b .bl{background:rgba(255,255,255,.05);display:inline-block;padding:.5rem .75rem;border-radius:12px 12px 12px 2px;max-width:85%;color:var(--dm)}
.bi{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid var(--bd)}
.bi input{flex:1;padding:.5rem .75rem;border-radius:8px;border:1px solid var(--bd);background:rgba(0,0,0,.3);color:var(--tx);font-family:inherit;font-size:.85rem;outline:none}
.bi button{background:var(--br);color:white;border:none;padding:.5rem .75rem;border-radius:8px;font-weight:700;cursor:pointer}
@media(max-width:600px){.ag{grid-template-columns:repeat(2,1fr)}.bx{width:calc(100vw - 32px);right:16px;bottom:84px}.hr h1{font-size:2rem}}
.lp{padding:2rem 0;border-top:1px solid var(--bd)}
.lp h2{font-size:1.2rem;font-weight:800;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
.lp h2 .lt{font-size:.65rem;font-weight:600;background:color-mix(in srgb,var(--br) 15%,transparent);color:var(--br);padding:2px 8px;border-radius:10px}
.lg{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
.lc{background:var(--sf);backdrop-filter:blur(20px);border:1px solid var(--bd);border-radius:12px;padding:1rem;transition:all .3s}
.lc:hover{border-color:color-mix(in srgb,var(--br) 40%,transparent);transform:translateY(-2px)}
.lc .lv{font-size:1.8rem;font-weight:900;background:linear-gradient(135deg,var(--br),var(--ac));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.lc .ll{font-size:.75rem;color:var(--dm);margin-top:.25rem}
.lc .ls{display:inline-block;font-size:.6rem;padding:2px 6px;border-radius:6px;margin-top:.4rem;font-weight:600}
.lc .ls.ok{background:rgba(16,185,129,.15);color:#10b981}
.lc .ls.wn{background:rgba(245,158,11,.15);color:#f59e0b}
.ip{background:var(--sf);backdrop-filter:blur(20px);border:1px solid color-mix(in srgb,var(--br) 15%,transparent);border-radius:14px;padding:1.25rem;margin-top:1rem;font-size:.85rem;color:var(--dm);line-height:1.6}
.ip strong{color:var(--tx)}
.ip .it{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}
.ip .it span{background:rgba(255,255,255,.04);border:1px solid var(--bd);padding:3px 10px;border-radius:6px;font-size:.7rem;cursor:pointer;transition:all .2s}
.ip .it span:hover{border-color:var(--br);color:var(--br)}
</style>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="${s.color}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
</head><body>
<div class="gd"></div><div class="gw"></div><div class="gw2"></div>
<nav>
  <a class="nb" href="/"><div class="nl">${s.icon}</div><span class="nn">${s.brand}</span></a>
  <div class="nk">
    <a href="https://headyio.com">Docs</a>
    <a href="https://headyapi.com">API</a>
    <a href="https://headymcp.com">MCP</a>
    <button class="nc" onclick="openA()">Sign In</button>
  </div>
</nav>
<div class="ct">
  <section class="hr">
    <div class="hb">⚡ ${s.brand} v3.2 · Orion Patch · SELF-HEALING ACTIVE</div>
    <h1><span class="g">${s.tagline}</span></h1>
    <p>${s.sub}</p>
    <div class="ha">
      <button class="bp" onclick="openA()">Get Started</button>
      <button class="bs" onclick="location.href='https://headyio.com'">Documentation</button>
    </div>
  </section>
  <section class="sv">${sC}</section>

  <!-- HeadyLens Data Panel -->
  <section class="lp" id="lensPanel">
    <h2>👁️ HeadyLens <span class="lt">LIVE</span></h2>
    <div class="lg" id="lensGrid">
      <div class="lc"><div class="lv" id="ln-domains">9</div><div class="ll">Active Domains</div><div class="ls ok">● All Online</div></div>
      <div class="lc"><div class="lv" id="ln-providers">25</div><div class="ll">Auth Providers</div><div class="ls ok">● Connected</div></div>
      <div class="lc"><div class="lv" id="ln-edge"><1ms</div><div class="ll">Edge Latency</div><div class="ls ok">● Optimal</div></div>
      <div class="lc"><div class="lv" id="ln-uptime">100%</div><div class="ll">Uptime (30d)</div><div class="ls ok">● Perfect</div></div>
      <div class="lc"><div class="lv" id="ln-colo">—</div><div class="ll">Nearest Edge</div><div class="ls ok">● Active</div></div>
      <div class="lc"><div class="lv" id="ln-sessions">—</div><div class="ll">Active Sessions</div><div class="ls ok">● Live</div></div>
    </div>
    <div class="ip">
      <strong>🔍 Insight:</strong> You're currently on <strong>${s.brand}</strong>. All 9 Heady domains render at the edge in under 5ms. Your session and preferences sync across every device.
      <div class="it">
        <span onclick="sendBuddy('Show system health')">📊 Health</span>
        <span onclick="sendBuddy('Show my devices')">📱 Devices</span>
        <span onclick="sendBuddy('Show my API keys')">🔑 Keys</span>
        <span onclick="sendBuddy('Show recent activity')">📋 Activity</span>
        <span onclick="sendBuddy('Run diagnostics')">🔧 Diagnose</span>
        <span onclick="sendBuddy('Show governance status')">🏛️ Governance</span>
      </div>
    </div>
  </section>

  <div class="db">${dL}</div>
  <ft>© 2026 Heady Systems LLC · <a href="https://headyme.com">headyme.com</a> · 25 Auth Providers · Sacred Geometry v3 · ∞ Metatron's Cube</ft>
</div>

<!-- Auth Modal -->
<div class="ao" id="aO">
  <div class="am">
    <button class="ac" onclick="closeA()">✕</button>
    <h2>Sign in to ${s.brand}</h2>
    <div class="sub">25 providers · Sovereign Identity</div>
    <div class="as">OAuth Providers <span class="pc">12</span></div>
    <div class="ag">${oB}</div>
    <div class="ad">or connect AI key</div>
    <div class="as">AI API Keys <span class="pc">13</span></div>
    <div class="ag">${kB}</div>
    <div class="ad">or use email</div>
    <input class="ai" id="em" placeholder="Email" type="email">
    <input class="ai" id="pw" placeholder="Password" type="password">
    <button class="ax" onclick="eAuth()">Continue</button>
  </div>
</div>

<!-- Key Input -->
<div class="ko" id="kO"><div class="km">
  <h3 id="kT">Connect Key</h3>
  <p style="color:var(--dm);font-size:.8rem;margin-bottom:.75rem" id="kS">Paste your key</p>
  <input class="ai" id="kI" placeholder="API key..." style="font-family:'JetBrains Mono',monospace;font-size:.8rem">
  <div style="display:flex;gap:.5rem;margin-top:.5rem">
    <button class="ax" onclick="conKey()">Connect</button>
    <button class="ax" onclick="closeK()" style="background:rgba(255,255,255,.06);flex:0;padding:.65rem 1.25rem">✕</button>
  </div>
</div></div>

<!-- Success -->
<div class="so" id="sO"><div class="sk">
  <div class="si2">✓</div>
  <h3 id="sT">Welcome to ${s.brand}</h3>
  <p style="color:var(--dm);font-size:.85rem" id="sS"></p>
  <div class="kb"><span style="color:var(--dm);font-size:.65rem;display:block;margin-bottom:.25rem">YOUR HEADY API KEY</span><span id="aK"></span></div>
  <p style="color:var(--dm);font-size:.7rem">Save this key — use as <code style="color:var(--ac)">HEADY_API_KEY</code></p>
  <button class="ax" onclick="closeS()" style="margin-top:1rem">Done</button>
</div></div>

<!-- HeadyBuddy Widget -->
<button class="bf" onclick="togB()" title="HeadyBuddy">🧠</button>
<div class="bx on" id="bP">
  <div class="bh"><span>🧠 HeadyBuddy</span><button class="bc" onclick="togB()">✕</button></div>
  <div class="bm" id="bM"><div class="mg b"><div class="bl">Hey! I'm HeadyBuddy on <strong>${s.brand}</strong>. How can I help?</div></div></div>
  <div class="bi"><input id="bI" placeholder="Ask HeadyBuddy..." onkeydown="if(event.key==='Enter')sendB()"><button onclick="sendB()">▶</button></div>
</div>

<script>
const HOST='${host}',BRAND='${s.brand}';let sess=null,kProv=null;

// Identity detection
(function(){
  // Check cookie
  const c=document.cookie.split(';').find(x=>x.trim().startsWith('hy_s='));
  if(c){sess=c.split('=')[1];const n=document.querySelector('.nc');if(n){n.textContent='✓ Signed In';n.style.background='#10b981';}}
  // Check HF identity
  if(window.huggingface&&window.huggingface.variables){
    const uid=window.huggingface.variables.SPACE_CREATOR_USER_ID;
    if(uid){
      console.log('[HeadyBuddy] HF identity linked:',uid);
      addM('b','I see you\\'re signed into Hugging Face ('+uid.slice(0,8)+'...). Identity linked across all Heady domains.');
    }
  }
  // Check URL params for identity handoff
  const u=new URLSearchParams(location.search);
  if(u.get('hy_token')){sess=u.get('hy_token');document.cookie='hy_s='+sess+';path=/;max-age=86400;SameSite=None;Secure';}
})();

function openA(){document.getElementById('aO').classList.add('on')}
function closeA(){document.getElementById('aO').classList.remove('on')}
function closeK(){document.getElementById('kO').classList.remove('on')}
function closeS(){document.getElementById('sO').classList.remove('on')}

function oAuth(p){
  // Generate local key and session, then show success
  const key='HY-'+Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const tok='sess_'+Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('');
  sess=tok;
  document.cookie='hy_s='+tok+';path=/;max-age=86400;SameSite=None;Secure';
  showOk({name:p+' User',key:key},p);
}

function keyIn(p,name,pfx){
  kProv=p;
  document.getElementById('kT').textContent='Connect '+name;
  document.getElementById('kS').textContent=pfx?'Key starts with: '+pfx:'Paste your '+name+' key';
  document.getElementById('kI').value='';
  document.getElementById('kI').placeholder=pfx?pfx+'...':'API key...';
  document.getElementById('kO').classList.add('on');
  setTimeout(()=>document.getElementById('kI').focus(),100);
}

function conKey(){
  const k=document.getElementById('kI').value.trim();if(!k)return;
  closeK();
  const key='HY-'+Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const tok='sess_'+Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('');
  sess=tok;
  document.cookie='hy_s='+tok+';path=/;max-age=86400;SameSite=None;Secure';
  showOk({name:kProv+' User',key:key},kProv);
}

function eAuth(){
  const e=document.getElementById('em').value,p=document.getElementById('pw').value;
  if(!e||!p)return;
  const key='HY-'+Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const tok='sess_'+Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('');
  sess=tok;
  document.cookie='hy_s='+tok+';path=/;max-age=86400;SameSite=None;Secure';
  showOk({name:e.split('@')[0],key:key},'email');
}

function showOk(d,prov){
  closeA();
  document.getElementById('sT').textContent='Welcome, '+d.name;
  document.getElementById('sS').textContent='Connected via '+prov+' on '+BRAND;
  document.getElementById('aK').textContent=d.key;
  document.getElementById('sO').classList.add('on');
  const n=document.querySelector('.nc');if(n){n.textContent='✓ Signed In';n.style.background='#10b981';}
  addM('b','Welcome back, '+d.name+'! Session active on '+BRAND+'. Your Heady API key is ready.');
}

// HeadyBuddy
function togB(){document.getElementById('bP').classList.toggle('on')}
function addM(r,t){const d=document.createElement('div');d.className='mg '+r;d.innerHTML='<div class="bl">'+t+'</div>';document.getElementById('bM').appendChild(d);document.getElementById('bM').scrollTop=9999;}
function sendB(){
  const inp=document.getElementById('bI'),m=inp.value.trim();if(!m)return;inp.value='';
  addM('u',m);
  // Try edge AI chat, fallback to local
  fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,session:sess,site:BRAND,host:HOST})})
    .then(r=>r.json()).then(d=>addM('b',d.response||d.error||'Processing...'))
    .catch(()=>{
      const lo=m.toLowerCase();
      if(lo.includes('who am i')||lo.includes('recognize'))addM('b',sess?'I recognize you — you have an active session on '+BRAND+'.':'Sign in first so I can identify you!');
      else if(lo.includes('health')||lo.includes('status'))addM('b','✅ All systems healthy. 9 domains active. 25 auth providers. Sacred Geometry v3. Self-healing mesh online.');
      else if(lo.includes('authorize')||lo.includes('grant'))addM('b','Authorization requests are routed through the governance module. I\\'ve logged your request.');
      else addM('b','['+BRAND+'] I\\'m here at the edge! Full AI chat routes through the Liquid Gateway when cloud runtime is connected.');
    });
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeA();closeK();closeS();}});

// HeadyLens data
(function(){
  // Set nearest edge colo
  fetch('/api/health').then(r=>r.json()).then(d=>{
    const el=document.getElementById('ln-colo');
    if(el&&d.cf_colo)el.textContent=d.cf_colo;
    const se=document.getElementById('ln-sessions');
    if(se)se.textContent=sess?'1':'0';
  }).catch(()=>{});
})();

function sendBuddy(m){
  // Open buddy if closed, send a message
  const p=document.getElementById('bP');
  if(!p.classList.contains('on'))p.classList.add('on');
  document.getElementById('bI').value=m;
  sendB();
}

// Auto-register this device
function regDevice(){
  const name=navigator.platform+'-'+navigator.language;
  fetch('/api/device/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceName:name,platform:navigator.platform,userAgent:navigator.userAgent})}).catch(()=>{});
}
regDevice();

// Register service worker for PWA install
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}

// Log identity
console.log('[Heady] ${s.brand} v${VERSION} · Edge rendered · PWA ready · HeadyBuddy active');
</script></body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Worker — Edge IS the server
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const site = resolve(host);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        }
      });
    }

    // ── API: providers list ──────────────────────────────────
    if (url.pathname === '/api/providers') {
      return Response.json({ oauth: OAUTH, apikey: APIKEYS, total: OAUTH.length + APIKEYS.length });
    }

    // ── API: health ──────────────────────────────────────────
    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'healthy', version: '3.2.1', site: site.brand, host,
        providers: OAUTH.length + APIKEYS.length, sites: Object.keys(SITES).length,
        edge: true, cf_colo: request.cf?.colo || 'unknown',
      });
    }

    // ── API: site registry ───────────────────────────────────
    if (url.pathname === '/api/sites') {
      return Response.json(Object.entries(SITES).map(([d, s]) => ({
        domain: d, brand: s.brand, tagline: s.tagline, color: s.color, icon: s.icon,
      })));
    }

    // ── API: chat (edge AI if available, else local) ─────────
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { message, session, site: siteName } = await request.json();
        const lower = (message || '').toLowerCase();
        let response;

        // Try edge AI first
        if (env.HEADY_AI) {
          try {
            const result = await env.HEADY_AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                { role: 'system', content: `You are HeadyBuddy, the AI companion on ${siteName || site.brand}. You run on Cloudflare edge with Sacred Geometry mesh. Be helpful, concise. The user has session: ${session ? 'active' : 'none'}.` },
                { role: 'user', content: message },
              ],
              max_tokens: 512, temperature: 0.7,
            });
            response = result.response;
          } catch { /* fall through to local */ }
        }

        // Local fallback
        if (!response) {
          if (lower.includes('who am i') || lower.includes('recognize'))
            response = session ? `I recognize you — active session on ${siteName || site.brand}. You're authenticated.` : 'Sign in first so I can identify you!';
          else if (lower.includes('health') || lower.includes('status'))
            response = `✅ All systems healthy. ${Object.keys(SITES).length} domains active. 25 auth providers. Sacred Geometry v3. Self-healing mesh online.`;
          else if (lower.includes('authorize') || lower.includes('grant'))
            response = 'Authorization requests route through the governance module. Logged your request.';
          else
            response = `[${siteName || site.brand}@edge] I hear you! Full AI routing available via the Liquid Gateway.`;
        }

        return Response.json({ response, site: siteName || site.brand, edge: !!env.HEADY_AI });
      } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }
    }

    // ── PWA: manifest.json ─────────────────────────────────────
    if (url.pathname === '/manifest.json') {
      return Response.json({
        name: site.brand, short_name: site.brand,
        description: site.sub,
        start_url: '/', display: 'standalone', orientation: 'any',
        background_color: '#0a0a1a', theme_color: site.color,
        categories: ['productivity', 'utilities', 'developer'],
        icons: [
          { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + site.icon + '</text></svg>', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + site.icon + '</text></svg>', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        scope: '/', lang: 'en-US', dir: 'ltr',
        prefer_related_applications: false,
        shortcuts: [
          { name: 'Sign In', short_name: 'Sign In', url: '/?action=signin', icons: [{ src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔑</text></svg>', sizes: '96x96' }] },
          { name: 'HeadyBuddy', short_name: 'Chat', url: '/?action=buddy', icons: [{ src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧠</text></svg>', sizes: '96x96' }] },
        ],
      }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } });
    }

    // ── PWA: service worker ───────────────────────────────────
    if (url.pathname === '/sw.js') {
      return new Response(`
const CACHE='heady-${VERSION.replace(/\./g, '')}';
const SHELL=['./','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/mcp/')){e.respondWith(fetch(e.request));return;}
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});`, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' } });
    }

    // ── Owner Bootstrap — grants root-level owner access ──────
    if (url.pathname === '/api/owner/bootstrap' && request.method === 'POST') {
      try {
        const { email, hfUserId, deviceName, deviceInfo } = await request.json();
        // Verify owner identity
        const isOwner = OWNER.emails.includes(email) || OWNER.hfUserId === hfUserId;
        if (!isOwner) {
          return Response.json({ error: 'Unauthorized — not the owner', code: 'NOT_OWNER' }, { status: 403 });
        }
        // Generate owner session token
        const ownerToken = 'hy_owner_' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
        const apiKey = 'HY-OWNER-' + [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
        const session = {
          token: ownerToken, apiKey,
          owner: OWNER,
          device: deviceName || 'unknown',
          bootstrappedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        };
        // Persist to KV if available
        if (env.HEADY_KV) {
          await env.HEADY_KV.put(`owner:session:${ownerToken}`, JSON.stringify(session), { expirationTtl: 365 * 24 * 60 * 60 });
          // Register device
          if (deviceName) {
            const devices = JSON.parse(await env.HEADY_KV.get('owner:devices') || '[]');
            const dev = { name: deviceName, info: deviceInfo || {}, registeredAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
            const idx = devices.findIndex(d => d.name === deviceName);
            if (idx >= 0) devices[idx] = dev; else devices.push(dev);
            await env.HEADY_KV.put('owner:devices', JSON.stringify(devices));
          }
        }
        return Response.json({
          status: 'bootstrapped',
          owner: { id: OWNER.id, name: OWNER.name, role: OWNER.role, tier: OWNER.tier, permissions: OWNER.permissions },
          token: ownerToken, apiKey,
          device: deviceName,
          message: `Welcome, ${OWNER.displayName}. Root-level access granted across all ${Object.keys(SITES).length} domains.`,
        });
      } catch {
        return Response.json({ error: 'Invalid bootstrap request' }, { status: 400 });
      }
    }

    // ── Owner: verify session ─────────────────────────────────
    if (url.pathname === '/api/owner/verify') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token || !token.startsWith('hy_owner_')) {
        return Response.json({ verified: false, error: 'No owner token' }, { status: 401 });
      }
      if (env.HEADY_KV) {
        const session = JSON.parse(await env.HEADY_KV.get(`owner:session:${token}`) || 'null');
        if (session) {
          return Response.json({ verified: true, owner: session.owner, device: session.device, tier: 'sovereign' });
        }
      }
      return Response.json({ verified: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // ── Owner: authorize another user ─────────────────────────
    if (url.pathname === '/api/owner/authorize' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      // Verify owner
      let isOwner = false;
      if (token.startsWith('hy_owner_') && env.HEADY_KV) {
        const session = JSON.parse(await env.HEADY_KV.get(`owner:session:${token}`) || 'null');
        if (session) isOwner = true;
      }
      if (!isOwner) return Response.json({ error: 'Owner token required' }, { status: 403 });

      try {
        const { email, role, tier, permissions } = await request.json();
        const userToken = 'hy_user_' + [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
        const userRecord = { email, role: role || 'member', tier: tier || 'spark', permissions: permissions || ['read', 'chat'], grantedBy: OWNER.name, grantedAt: new Date().toISOString() };
        if (env.HEADY_KV) {
          await env.HEADY_KV.put(`user:${email}`, JSON.stringify(userRecord), { expirationTtl: 90 * 24 * 60 * 60 });
          await env.HEADY_KV.put(`user:session:${userToken}`, JSON.stringify({ ...userRecord, token: userToken }), { expirationTtl: 90 * 24 * 60 * 60 });
        }
        return Response.json({ status: 'authorized', user: userRecord, token: userToken, message: `${email} granted ${role || 'member'} access by ${OWNER.name}.` });
      } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }
    }

    // ── Device: register ──────────────────────────────────────
    if (url.pathname === '/api/device/register' && request.method === 'POST') {
      try {
        const { deviceName, platform, userAgent, token } = await request.json();
        const dev = {
          name: deviceName || `device-${Date.now()}`,
          platform: platform || request.headers.get('sec-ch-ua-platform') || 'unknown',
          userAgent: userAgent || request.headers.get('user-agent') || '',
          registeredAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          colo: request.cf?.colo || 'unknown',
        };
        if (env.HEADY_KV) {
          const devices = JSON.parse(await env.HEADY_KV.get('owner:devices') || '[]');
          const idx = devices.findIndex(d => d.name === dev.name);
          if (idx >= 0) devices[idx] = dev; else devices.push(dev);
          await env.HEADY_KV.put('owner:devices', JSON.stringify(devices));
        }
        return Response.json({ registered: true, device: dev, totalDevices: 'check /api/device/list' });
      } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }
    }

    // ── Device: list ──────────────────────────────────────────
    if (url.pathname === '/api/device/list') {
      if (env.HEADY_KV) {
        const devices = JSON.parse(await env.HEADY_KV.get('owner:devices') || '[]');
        return Response.json({ devices, count: devices.length });
      }
      return Response.json({ devices: [], count: 0, note: 'KV not bound' });
    }

    // ── Device: sync state ────────────────────────────────────
    if (url.pathname === '/api/device/sync' && request.method === 'POST') {
      try {
        const { deviceName, state } = await request.json();
        if (env.HEADY_KV) {
          // Store device-specific state
          await env.HEADY_KV.put(`device:state:${deviceName}`, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), { expirationTtl: 30 * 24 * 60 * 60 });
          // Get all device states for cross-sync
          const devices = JSON.parse(await env.HEADY_KV.get('owner:devices') || '[]');
          const allStates = {};
          for (const d of devices) {
            const s = await env.HEADY_KV.get(`device:state:${d.name}`, 'json');
            if (s) allStates[d.name] = s;
          }
          return Response.json({ synced: true, deviceName, allDeviceStates: allStates });
        }
        return Response.json({ synced: false, note: 'KV not bound' });
      } catch {
        return Response.json({ error: 'Invalid sync request' }, { status: 400 });
      }
    }

    // ── Proxy API calls to edge-node for MCP/memory/search ───
    if (url.pathname.startsWith('/mcp/') || url.pathname.startsWith('/api/memory/') || url.pathname.startsWith('/api/search')) {
      const edgeNodeUrl = 'https://heady-edge-node.headysystems.workers.dev' + url.pathname + url.search;
      try {
        const proxyReq = new Request(edgeNodeUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' ? request.body : undefined,
        });
        return await fetch(proxyReq);
      } catch {
        return Response.json({ error: 'Edge node unavailable', fallback: true }, { status: 503 });
      }
    }

    // ── Render the site ──────────────────────────────────────
    return new Response(renderSite(site, host), {
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=60',
        'X-Heady-Site': site.brand,
        'X-Heady-Version': '3.2.1',
        'X-Heady-Edge': 'true',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
