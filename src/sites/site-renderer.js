/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * DYNAMIC SITE RENDERER — One template, infinite sites
 * ═══════════════════════════════════════════════════════
 * Renders a fully branded, interactive site from a config object.
 * Preconfigured sites load from site-registry.json.
 * Custom sites load from user config created during onboarding.
 * No React, no build step, no static files. Pure server-rendered HTML.
 * ═══════════════════════════════════════════════════════
 */

"use strict";

const fs = require("fs");
const path = require("path");
const registry = require("./site-registry.json");

const USER_SITES_PATH = path.join(__dirname, "..", "..", "data", "user-sites.json");

/**
 * Resolve a hostname to a site config.
 * 1. Check domain aliases
 * 2. Check preconfigured sites
 * 3. Check user-created sites
 * 4. Fallback to headyme.com
 */
function resolveSite(hostname) {
    const canonical = registry.domainAliases[hostname] || hostname;
    if (registry.preconfigured[canonical]) {
        return { ...registry.preconfigured[canonical], domain: canonical, type: "preconfigured" };
    }
    // Check user-created sites
    try {
        if (fs.existsSync(USER_SITES_PATH)) {
            const userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
            if (userSites[canonical]) {
                return { ...userSites[canonical], domain: canonical, type: "custom" };
            }
        }
    } catch { /* corrupted user-sites.json — ignore */ }

    // Fallback
    return { ...registry.preconfigured["headyme.com"], domain: "headyme.com", type: "fallback" };
}

/**
 * Resolve a site by slug (for /v/:slug routes)
 */
function resolveSiteBySlug(slug) {
    const domain = {
        headyme: "headyme.com", headysystems: "headysystems.com",
        headyconnection: "headyconnection.org", headymcp: "headymcp.com",
        headyos: "headyos.com", headyapi: "headyapi.com", headyio: "headyio.com",
    }[slug];
    if (domain) return resolveSite(domain);

    // Check user sites by slug
    try {
        if (fs.existsSync(USER_SITES_PATH)) {
            const userSites = JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8"));
            for (const [d, cfg] of Object.entries(userSites)) {
                if (cfg.slug === slug) return { ...cfg, domain: d, type: "custom" };
            }
        }
    } catch { }
    return null;
}

/**
 * Get nav items for a site
 */
function getNavItems(site) {
    const allSites = { ...registry.preconfigured };
    try {
        if (fs.existsSync(USER_SITES_PATH)) {
            Object.assign(allSites, JSON.parse(fs.readFileSync(USER_SITES_PATH, "utf8")));
        }
    } catch { }

    const items = [];
    for (const [domain, cfg] of Object.entries(allSites)) {
        const slug = domain.replace(/\.(com|org|io)$/, "");
        items.push({
            slug, name: cfg.name, domain,
            active: domain === site.domain,
            href: domain === site.domain ? "#" : `https://${domain}`,
        });
    }
    return items;
}

/**
 * Render a complete HTML page for a site config.
 */
function renderSite(site) {
    const c = site.accent || "#818cf8";
    const cd = site.accentDark || site.accent || "#6366f1";
    const geo = site.sacredGeometry || "Flower of Life";
    const nav = getNavItems(site);

    const featuresHTML = (site.features || []).map(f => `
    <div class="card">
      <div class="card-icon">${f.icon}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </div>`).join("");

    const statsHTML = (site.stats || []).map(s => `
    <div class="stat">
      <div class="stat-val">${s.value}</div>
      <div class="stat-lbl">${s.label}</div>
    </div>`).join("");

    const navHTML = nav.map(n => `<a href="${n.href}" class="${n.active ? "active" : ""}">${n.name}</a>`).join("");

    const chatHTML = site.chatEnabled !== false ? renderChatWidget(site) : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${site.name} — ${site.tagline}</title>
<meta name="description" content="${(site.description || "").replace(/"/g, "&quot;")}">
<meta property="og:title" content="${site.name} — ${site.tagline}">
<meta property="og:description" content="${(site.description || "").replace(/"/g, "&quot;")}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✦</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--accent:${c};--accent-dark:${cd};--bg:#050508;--surface:rgba(15,15,20,0.18);--border:rgba(255,255,255,0.04);--text:#e2e8f0;--text-dim:rgba(255,255,255,0.5);--text-muted:rgba(255,255,255,0.3)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
#geo-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.wrap{position:relative;z-index:10;min-height:100vh;display:flex;flex-direction:column}

/* ── Header ── */
header{display:flex;justify-content:space-between;align-items:center;padding:1.25rem 2rem;position:sticky;top:0;z-index:100;background:rgba(5,5,8,0.7);backdrop-filter:blur(20px) saturate(1.4);border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:.75rem;text-decoration:none}
.logo-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent);animation:pulse 2s ease infinite}
.logo-name{font-size:1.3rem;font-weight:700;color:var(--accent);letter-spacing:1px;text-shadow:0 0 15px color-mix(in srgb, var(--accent) 40%, transparent)}
.logo-tag{font-size:.6rem;color:var(--text-muted);letter-spacing:.15em;text-transform:uppercase}
nav{display:flex;gap:.25rem;flex-wrap:wrap;padding:.35rem;border-radius:100px;background:rgba(255,255,255,0.02);border:1px solid var(--border);backdrop-filter:blur(10px)}
nav a{padding:.3rem .85rem;border-radius:50px;font-size:.7rem;font-weight:500;color:var(--text-dim);text-decoration:none;transition:all .25s}
nav a:hover{color:#fff;background:rgba(255,255,255,0.06)}
nav a.active{background:var(--accent);color:#000;font-weight:600;box-shadow:0 0 20px color-mix(in srgb, var(--accent) 50%, transparent)}

/* ── Hero ── */
.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6rem 2rem 3rem;text-align:center}
.status-pill{display:inline-flex;align-items:center;gap:.5rem;padding:.45rem 1.1rem;border-radius:50px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:.65rem;color:#fff;margin-bottom:2rem;letter-spacing:1.5px;text-transform:uppercase;backdrop-filter:blur(8px)}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:pulse 2s ease infinite;box-shadow:0 0 8px var(--accent)}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.hero h1{font-size:clamp(3rem,8vw,5.5rem);font-weight:800;color:var(--accent);margin-bottom:.75rem;letter-spacing:-.03em;text-shadow:0 0 40px color-mix(in srgb, var(--accent) 25%, transparent)}
.hero-tagline{font-size:clamp(.9rem,2vw,1.15rem);color:#fff;letter-spacing:.25em;text-transform:uppercase;opacity:.85;margin-bottom:.75rem;font-weight:300}
.sacred-badge{display:inline-block;padding:.35rem 1.1rem;border:1px solid color-mix(in srgb, var(--accent) 25%, transparent);border-radius:50px;font-size:.6rem;font-weight:600;letter-spacing:.2em;color:var(--accent);text-transform:uppercase;margin-bottom:1.5rem}
.hero-desc{font-size:.85rem;color:var(--text-dim);max-width:560px;line-height:1.7;margin-bottom:2.5rem}

/* ── Stats ── */
.stats{display:inline-grid;grid-template-columns:repeat(4,1fr);gap:2rem;background:var(--surface);padding:1.75rem 2.5rem;border-radius:20px;backdrop-filter:blur(12px);border:1px solid var(--border);margin-bottom:3.5rem}
.stat{text-align:center}
.stat-val{font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:.35rem;text-shadow:0 0 15px rgba(255,255,255,0.4)}
.stat-lbl{font-size:.65rem;color:var(--accent);text-transform:uppercase;letter-spacing:.15em;font-weight:600}

/* ── Cards ── */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem;max-width:1100px;margin:0 auto 5rem;padding:0 2rem;width:100%}
.card{background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:20px;padding:2rem;text-align:left;transition:all .35s ease;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at top right,color-mix(in srgb, var(--accent) 6%, transparent),transparent 70%);opacity:0;transition:opacity .35s}
.card:hover{transform:translateY(-4px);border-color:color-mix(in srgb, var(--accent) 30%, transparent);box-shadow:0 16px 40px rgba(0,0,0,.4),0 0 25px color-mix(in srgb, var(--accent) 8%, transparent)}
.card:hover::after{opacity:1}
.card-icon{font-size:1.8rem;margin-bottom:1.25rem}
.card h3{font-size:1rem;font-weight:600;color:#fff;margin-bottom:.6rem;position:relative;z-index:1}
.card p{font-size:.8rem;color:var(--text-dim);line-height:1.7;position:relative;z-index:1}

/* ── Footer ── */
footer{text-align:center;padding:2.5rem;color:var(--text-muted);font-size:.7rem;letter-spacing:1.5px;text-transform:uppercase}
footer a{color:var(--accent);text-decoration:none;opacity:.6;transition:opacity .2s}
footer a:hover{opacity:1}

/* ── Auth Button ── */
.auth-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1.5rem;border-radius:50px;border:1px solid color-mix(in srgb, var(--accent) 30%, transparent);background:color-mix(in srgb, var(--accent) 8%, transparent);color:var(--accent);font-size:.75rem;font-weight:600;cursor:pointer;transition:all .25s;text-decoration:none;letter-spacing:.05em}
.auth-btn:hover{background:var(--accent);color:#000;box-shadow:0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)}

/* ── Responsive ── */
@media(max-width:768px){
  header{flex-direction:column;gap:1rem;padding:1rem}
  nav{justify-content:center}
  .stats{grid-template-columns:repeat(2,1fr);gap:1.25rem;padding:1.25rem 1.5rem}
  .cards{padding:0 1rem}
  .hero{padding:4rem 1.5rem 2rem}
}
${site.customCSS || ""}
</style>
</head>
<body>
<canvas id="geo-canvas"></canvas>
<div class="wrap">
<header>
  <a class="logo" href="/">
    <div class="logo-dot"></div>
    <div><div class="logo-name">${site.name}</div><div class="logo-tag">${site.tagline}</div></div>
  </a>
  <nav>${navHTML}</nav>
</header>
<section class="hero">
  <div class="status-pill"><span class="status-dot"></span> ${site.name} Online</div>
  <h1>${site.name}</h1>
  <p class="hero-tagline">${site.tagline}</p>
  <div class="sacred-badge">${geo} · ${(site.role || "heady").replace(/-/g, " ").toUpperCase()}</div>
  <p class="hero-desc">${site.description || ""}</p>
  <div class="stats">${statsHTML}</div>
</section>
<div class="cards">${featuresHTML}</div>
<footer>
  <p>© 2026 ${site.name} — Powered by <a href="https://headysystems.com">Heady Systems</a> · Sacred Geometry Architecture</p>
</footer>
</div>
${chatHTML}
<script>
${renderCanvasJS(geo, c, cd)}
</script>
<script>
${renderAuthJS(site)}
</script>
</body>
</html>`;
}

/**
 * Canvas sacred geometry animation — adapts per geometry type
 */
function renderCanvasJS(geoType, accent, accentDark) {
    return `(function(){
  const canvas=document.getElementById('geo-canvas');
  const ctx=canvas.getContext('2d');
  let W,H,cx,cy,stars=[],t=0;
  const ac='${accent}',acd='${accentDark}';
  function rgb(hex){const v=parseInt(hex.replace('#',''),16);return{r:(v>>16)&255,g:(v>>8)&255,b:v&255};}
  const c1=rgb(ac);
  function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;cx=W/2;cy=H/2;stars=[];for(let i=0;i<(W*H)/5000;i++)stars.push({x:Math.random()*W,y:Math.random()*H,z:Math.random()*2,s:Math.random()*1.5,b:Math.random()*.02+.005,o:Math.random()*Math.PI*2});}
  function drawStars(){ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);for(const s of stars){s.y-=s.z*.15;s.x+=s.z*.08;if(s.y<0)s.y=H;if(s.x>W)s.x=0;const b=Math.sin(t*s.b+s.o)*.5+.5;ctx.fillStyle='rgba(255,255,255,'+b*.65+')';ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();}}
  function hue(i,n,a){const h=(i/n*360+t*.02)%360;return 'hsla('+h+','+(70+Math.sin(t*.001+i)*15)+'%,'+(55+Math.sin(t*.0008+i*.5)*15)+'%,'+a+')';}
  function proj(x,y,z){const ty=Math.sin(t*.00012)*.3,tx=Math.cos(t*.00009)*.25;const cy2=Math.cos(ty),sy=Math.sin(ty),cx2=Math.cos(tx),sx=Math.sin(tx);return{x:x*cy2-z*sy,y:y*cx2-(x*sy+z*cy2)*sx};}
  function drawGeo(){
    const R=Math.max(W,H)*.45;const br=Math.sin(t*.002)*.02+1;const dx=Math.sin(t*.0006)*20,dy=Math.cos(t*.0005)*15;
    ctx.save();ctx.translate(cx+dx,cy+dy);ctx.scale(br,br);ctx.rotate(t*.00015);ctx.lineWidth=.3;ctx.lineCap='round';
    ${geoType === "Metatrons Cube" ? `
    const nodes=[{x:0,y:0,z:0}];for(let i=0;i<6;i++){const a=Math.PI/3*i;nodes.push({x:Math.cos(a)*R*.45,y:Math.sin(a)*R*.45,z:Math.sin(a+t*.0002)*R*.1});}for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;nodes.push({x:Math.cos(a)*R*.85,y:Math.sin(a)*R*.85,z:Math.cos(a+t*.0003)*R*.15});}let li=0;const tl=nodes.length*(nodes.length-1)/2;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const p1=proj(nodes[i].x,nodes[i].y,nodes[i].z),p2=proj(nodes[j].x,nodes[j].y,nodes[j].z);ctx.strokeStyle=hue(li,tl,.35);ctx.shadowColor=hue(li,tl,.12);ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();li++;}
    ` : geoType === "Seed of Life" ? `
    let idx=0;const tot=19;for(let ring=0;ring<3;ring++){const n=ring===0?1:6;const dist=ring*R*.28;const cR=R*(.28+ring*.06);for(let i=0;i<n;i++){const a=Math.PI*2/6*i+ring*.5;const raw=ring===0?{x:0,y:0}:{x:Math.cos(a)*dist,y:Math.sin(a)*dist};const p=proj(raw.x,raw.y,Math.sin(a+t*.0003)*R*.1);ctx.strokeStyle=hue(idx,tot,.5);ctx.shadowColor=hue(idx,tot,.25);ctx.shadowBlur=10;ctx.beginPath();ctx.arc(p.x,p.y,cR,0,Math.PI*2);ctx.stroke();idx++;}}
    ` : geoType === "Fibonacci Spiral" ? `
    ctx.strokeStyle=hue(0,1,.45);ctx.shadowColor=hue(0,1,.15);ctx.shadowBlur=12;ctx.beginPath();const PHI=1.618;for(let a=0;a<Math.PI*12;a+=.02){const r=Math.pow(PHI,a/(Math.PI*2))*8;const p=proj(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*.3+t*.0002)*R*.05);if(a===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();
    for(let i=0;i<12;i++){const a=Math.PI*2/12*i;const r2=R*(.2+i*.06);const p=proj(Math.cos(a+t*.0001)*r2,Math.sin(a+t*.0001)*r2,0);ctx.strokeStyle=hue(i,12,.3);ctx.beginPath();ctx.arc(p.x,p.y,2+i*.8,0,Math.PI*2);ctx.stroke();}
    ` : `
    let idx=0;const tot=37;for(let ring=0;ring<4;ring++){const n=ring===0?1:ring*6;const dist=ring*R*.22;for(let i=0;i<n;i++){const a=Math.PI*2/Math.max(n,1)*i;const raw=ring===0?{x:0,y:0}:{x:Math.cos(a)*dist,y:Math.sin(a)*dist};const p=proj(raw.x,raw.y,Math.cos(a*2+t*.0002)*R*.08);ctx.strokeStyle=hue(idx,tot,.45);ctx.shadowColor=hue(idx,tot,.2);ctx.shadowBlur=10;ctx.beginPath();ctx.arc(p.x,p.y,R*.22,0,Math.PI*2);ctx.stroke();idx++;}}
    `}
    ctx.restore();
  }
  function loop(){t++;drawStars();drawGeo();requestAnimationFrame(loop);}
  addEventListener('resize',resize);resize();loop();
})();`;
}

/**
 * Device-based auth — no Firebase, no external dependency.
 * WARP-aware, 365-day sessions, persistent device ID.
 */
function renderAuthJS(site) {
    return `(function(){
  const DK='heady_device_id',TK='heady_auth_token',SK='heady_session';
  if(!localStorage.getItem(DK))localStorage.setItem(DK,crypto.randomUUID());
  const warp=navigator.userAgent.includes('Cloudflare-WARP')||localStorage.getItem('heady_warp')==='true';
  if(warp)localStorage.setItem('heady_warp','true');
  const maxAge=365*86400000;
  let tok=localStorage.getItem(TK);
  try{if(tok&&JSON.parse(atob(tok)).exp<Date.now())tok=null;}catch{tok=null;}
  if(!tok){
    tok=btoa(JSON.stringify({sub:localStorage.getItem(DK),iat:Date.now(),exp:Date.now()+maxAge,site:'${site.domain}',warp,pwa:matchMedia('(display-mode:standalone)').matches}));
    localStorage.setItem(TK,tok);
  }
  const days=Math.round((JSON.parse(atob(tok)).exp-Date.now())/86400000);
  console.log('🔐 ${site.name}:',days+'d auth |',warp?'WARP':'Device','|',localStorage.getItem(DK).slice(0,8));
})();`;
}

/**
 * Chat widget HTML + JS
 */
function renderChatWidget(site) {
    const c = site.accent || "#818cf8";
    return `
<button class="fab" onclick="toggleChat()" title="Chat with ${site.name}" style="position:fixed;bottom:2rem;right:2rem;width:56px;height:56px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px color-mix(in srgb, var(--accent) 50%, transparent);transition:all .3s;z-index:200;font-size:1.5rem;color:#000">✦</button>
<div id="chat-panel" style="display:none;position:fixed;bottom:80px;right:16px;width:380px;max-height:min(520px,70vh);background:rgba(10,10,20,0.8);border:1px solid color-mix(in srgb, ${c} 20%, transparent);border-radius:20px;z-index:10000;font-family:Inter,system-ui;box-shadow:0 24px 80px rgba(0,0,0,.6),0 0 40px color-mix(in srgb, ${c} 10%, transparent);backdrop-filter:blur(24px) saturate(1.5);flex-direction:column;overflow:hidden">
  <div style="padding:14px 16px;background:linear-gradient(135deg,color-mix(in srgb, ${c} 12%, transparent),transparent);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px">
    <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,${c},${site.accentDark || c});display:flex;align-items:center;justify-content:center;font-size:16px">✦</div>
    <div style="flex:1"><div style="color:#fff;font-weight:600;font-size:14px">${site.name}</div><div style="color:#34d399;font-size:11px;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;background:#34d399;border-radius:50%;display:inline-block"></span>Online</div></div>
    <button onclick="toggleChat()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:20px;cursor:pointer">✕</button>
  </div>
  <div id="chat-msgs" style="flex:1;overflow-y:auto;padding:16px;min-height:180px"></div>
  <div style="padding:12px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px;background:rgba(0,0,0,.2)">
    <input id="chat-in" style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:13px;outline:none;font-family:inherit" placeholder="Ask ${site.name} anything..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendChat();}">
    <button onclick="sendChat()" style="background:linear-gradient(135deg,${c},${site.accentDark || c});border:none;border-radius:12px;padding:10px 16px;color:#000;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">Send</button>
  </div>
</div>
<script>
(function(){
  const msgs=document.getElementById('chat-msgs');
  msgs.innerHTML='<div style="margin-bottom:12px"><div style="background:color-mix(in srgb, ${c} 10%, transparent);border:1px solid color-mix(in srgb, ${c} 12%, transparent);border-radius:16px 16px 16px 4px;color:rgba(255,255,255,.88);padding:10px 14px;font-size:13px;line-height:1.5;max-width:90%">Hey! I\\'m ${site.name}\\'s AI, connected to the full Heady ecosystem. Ask me anything! ✨</div></div>';
  window.toggleChat=function(){const p=document.getElementById('chat-panel');if(p.style.display==='flex'){p.style.display='none';}else{p.style.display='flex';document.getElementById('chat-in').focus();msgs.scrollTop=msgs.scrollHeight;}};
  window.sendChat=async function(){const inp=document.getElementById('chat-in');const m=inp.value.trim();if(!m)return;inp.value='';
    msgs.innerHTML+='<div style="text-align:right;margin-bottom:12px"><div style="background:color-mix(in srgb, ${c} 15%, transparent);border:1px solid color-mix(in srgb, ${c} 15%, transparent);border-radius:16px 16px 4px 16px;color:rgba(255,255,255,.92);padding:10px 14px;font-size:13px;display:inline-block;max-width:85%;text-align:left">'+m.replace(/</g,'&lt;')+'</div></div>';
    msgs.innerHTML+='<div id="typing" style="margin-bottom:12px"><div style="color:rgba(255,255,255,.4);font-size:12px">thinking...</div></div>';msgs.scrollTop=msgs.scrollHeight;
    try{const r=await fetch('/api/brain/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,context:{site:'${site.domain}'}})});const d=await r.json();const reply=(d.response||d.message||'Processing...').replace(/</g,'&lt;').replace(/\\n/g,'<br>');
    const el=document.getElementById('typing');if(el)el.remove();
    msgs.innerHTML+='<div style="margin-bottom:12px"><div style="background:color-mix(in srgb, ${c} 10%, transparent);border:1px solid color-mix(in srgb, ${c} 12%, transparent);border-radius:16px 16px 16px 4px;color:rgba(255,255,255,.88);padding:10px 14px;font-size:13px;line-height:1.5;max-width:90%">'+reply+'</div></div>';
    }catch(e){const el=document.getElementById('typing');if(el)el.remove();msgs.innerHTML+='<div style="margin-bottom:12px"><div style="background:color-mix(in srgb, ${c} 10%, transparent);border:1px solid color-mix(in srgb, ${c} 12%, transparent);border-radius:16px 16px 16px 4px;color:rgba(255,255,255,.88);padding:10px 14px;font-size:13px">Connected to ${site.name} ✨</div></div>';}
    msgs.scrollTop=msgs.scrollHeight;};
})();
</script>`;
}

module.exports = { renderSite, resolveSite, resolveSiteBySlug, getNavItems };
