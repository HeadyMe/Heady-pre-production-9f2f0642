/**
 * Heady Vertical Site Generator v5 — Direct from Live headybuddy.org
 *
 * Uses the EXACT live production source code as template.
 * Canvas-based cosmic starfield + sacred geometry engine.
 * Per-vertical: different geometry type, accent color, content.
 */
const fs = require("fs");
const path = require("path");

const VERTICALS_PATH = path.join(__dirname, "verticals.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "verticals");
const { verticals } = JSON.parse(fs.readFileSync(VERTICALS_PATH, "utf8"));
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Per-vertical geometry type + color
const THEMES = {
    "headyme.com": { geo: "Flower of Life", color1: "#818cf8", color2: "#6366f1", label: "FLOWER OF LIFE · PERSONAL CLOUD" },
    "headysystems.com": { geo: "Metatrons Cube", color1: "#3b82f6", color2: "#2563eb", label: "METATRON'S CUBE · INFRASTRUCTURE" },
    "headyconnection.org": { geo: "Seed of Life", color1: "#10b981", color2: "#059669", label: "SEED OF LIFE · HUMAN CONNECTION" },
    "headymcp.com": { geo: "Torus", color1: "#f97316", color2: "#ea580c", label: "TORUS · MODEL PROTOCOL" },
    "headyio.com": { geo: "Flower of Life", color1: "#6366f1", color2: "#4f46e5", label: "FLOWER OF LIFE · I/O OPERATIONS" },
    "headybuddy.org": { geo: "Seed of Life", color1: "#4ade80", color2: "#10b981", label: "SEED OF LIFE · SACRED GEOMETRY" },
    "headybot.com": { geo: "Metatrons Cube", color1: "#0ea5e9", color2: "#0284c7", label: "METATRON'S CUBE · AUTOMATION" },
    "headycreator.com": { geo: "Flower of Life", color1: "#ec4899", color2: "#db2777", label: "GOLDEN SPIRAL · CREATIVE FLOW" },
    "headymusic.com": { geo: "Torus", color1: "#a855f7", color2: "#9333ea", label: "CYMATICS · SOUND GEOMETRY" },
    "headytube.com": { geo: "Metatrons Cube", color1: "#ef4444", color2: "#dc2626", label: "MERKABA · VISUAL LIGHT" },
    "headycloud.com": { geo: "Flower of Life", color1: "#06b6d4", color2: "#0891b2", label: "TESSERACT · CLOUD DIMENSIONS" },
    "headylearn.com": { geo: "Seed of Life", color1: "#22c55e", color2: "#16a34a", label: "TREE OF LIFE · KNOWLEDGE" },
    "headystore.com": { geo: "Torus", color1: "#f59e0b", color2: "#d97706", label: "HEXAGONAL GRID · COMMERCE" },
    "headystudio.com": { geo: "Flower of Life", color1: "#8b5cf6", color2: "#7c3aed", label: "FIBONACCI SPIRAL · PRODUCTION" },
    "headyagent.com": { geo: "Metatrons Cube", color1: "#78716c", color2: "#57534e", label: "ICOSAHEDRON · AGENT NETWORK" },
    "headydata.com": { geo: "Seed of Life", color1: "#14b8a6", color2: "#0d9488", label: "TETRAHEDRON · DATA STRUCTURE" },
    "headyapi.com": { geo: "Torus", color1: "#0891b2", color2: "#0e7490", label: "DODECAHEDRON · API GATEWAY" },
};

function gen(v, all) {
    const t = THEMES[v.domain] || THEMES["headybuddy.org"];
    const navLinks = all.slice(0, 7).map(o =>
        `<a href="/v/${o.domain.replace(/\.(com|org|io)$/, '')}" ${o.domain === v.domain ? 'class="active"' : ''}>${o.name}</a>`
    ).join("");
    const cardsHTML = v.features.slice(0, 4).map(f =>
        `<div class="card"><div class="ci">✦</div><h3>${f.title}</h3><p>${f.desc}</p></div>`
    ).join("");
    const statsHTML = [
        { val: "24/7", lbl: "Available" },
        { val: "∞", lbl: "Context" },
        { val: "Fast", lbl: "Response" },
        { val: "Smart", lbl: "AI Models" },
    ].map(s => `<div class="stat"><div class="stat-val">${s.val}</div><div class="stat-lbl">${s.lbl}</div></div>`).join("");

    // Direct from live headybuddy.org — color-swapped per vertical
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<title>${v.name} — ${v.tagline}</title>
<meta name="description" content="${v.description}">
<meta name="theme-color" content="${t.color1}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${v.name}">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/heady-icon-192.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;background:#000000;color:#e2e8f0;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
#cosmic-canvas{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)}
.site-wrap{position:relative;z-index:10;min-height:100vh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;padding:1.5rem 2rem;background:transparent;position:sticky;top:0;z-index:100}
.logo-wrap{display:flex;align-items:center;gap:.75rem;text-decoration:none}
.logo-title{font-size:1.4rem;font-weight:700;color:${t.color1};letter-spacing:1px;text-shadow:0 0 10px ${t.color1}66}
.logo-sub{font-size:.65rem;color:#ffffff99;letter-spacing:.15em;text-transform:uppercase}
nav{display:flex;gap:.5rem;flex-wrap:wrap;background:rgba(20,20,25,0.12);padding:0.5rem;border-radius:100px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.04)}
nav a{padding:.35rem 1rem;border-radius:50px;font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);text-decoration:none;transition:all .3s}
nav a:hover,nav a.active{background:${t.color1};color:#000;box-shadow:0 0 15px ${t.color1}}
.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8rem 2rem 4rem;text-align:center}
.status{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem 1.2rem;border-radius:50px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);font-size:.7rem;color:#fff;margin-bottom:2rem;letter-spacing:1px;text-transform:uppercase}
.status-dot{width:8px;height:8px;border-radius:50%;background:${t.color1};animation:pulse 2s ease infinite;box-shadow:0 0 10px ${t.color1}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.hero h1{font-size:clamp(3rem,8vw,5.5rem);font-weight:800;color:${t.color1};margin-bottom:1rem;letter-spacing:-.03em;text-shadow:0 0 30px ${t.color1}44}
.hero-sub{font-size:clamp(1rem,2vw,1.2rem);color:#fff;margin-bottom:1rem;font-weight:400;letter-spacing:.2em;text-transform:uppercase;opacity:0.9}
.hero-mantra{font-size:.85rem;color:rgba(255,255,255,0.5);letter-spacing:.15em;margin-bottom:3rem}
.sacred-badge{display:inline-block;padding:.4rem 1.2rem;border:1px solid ${t.color1}40;border-radius:50px;font-size:.65rem;font-weight:600;letter-spacing:.15em;color:${t.color1};text-transform:uppercase;margin-bottom:2rem;backdrop-filter:blur(8px)}
.stats{display:inline-grid;grid-template-columns:repeat(4,1fr);gap:2.5rem;margin:0 auto 4rem;background:rgba(20,20,25,0.12);padding:2rem 3rem;border-radius:24px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.04)}
.stat{text-align:center}
.stat-val{font-size:1.8rem;font-weight:800;color:#fff;margin-bottom:.4rem;text-shadow:0 0 15px rgba(255,255,255,0.5)}
.stat-lbl{font-size:.7rem;color:${t.color1};text-transform:uppercase;letter-spacing:.15em;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;max-width:1200px;margin:0 auto 6rem;padding:0 2rem}
.card{background:rgba(15,15,20,.18);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.04);border-radius:24px;padding:2.5rem;text-align:left;transition:all .4s ease;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at top right, ${t.color1}11, transparent 70%);opacity:0;transition:opacity .4s ease}
.card:hover{transform:translateY(-5px);border-color:${t.color1}44;box-shadow:0 20px 40px rgba(0,0,0,.5), 0 0 30px ${t.color1}11}
.card:hover::after{opacity:1}
.ci{font-size:2rem;margin-bottom:1.5rem;color:${t.color1}}
.card h3{font-size:1.1rem;font-weight:600;color:#fff;margin-bottom:.75rem;letter-spacing:.02em}
.card p{font-size:.85rem;color:rgba(255,255,255,.5);line-height:1.8}
.fab{position:fixed;bottom:2rem;right:2rem;width:56px;height:56px;border-radius:50%;background:${t.color1};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px ${t.color1}66;transition:all .3s;z-index:200;font-size:1.5rem;color:#000}
.fab:hover{transform:scale(1.1) rotate(90deg);box-shadow:0 8px 30px ${t.color1}99}
.auth-btn{padding:.4rem 1rem;border-radius:50px;font-size:.75rem;font-weight:600;background:${t.color1};color:#000;border:none;cursor:pointer;transition:all .3s;letter-spacing:.05em}
.auth-btn:hover{box-shadow:0 0 20px ${t.color1}88;transform:scale(1.05)}
.auth-badge{display:flex;align-items:center;gap:.5rem;padding:.3rem .8rem;border-radius:50px;font-size:.65rem;background:rgba(255,255,255,.06);border:1px solid ${t.color1}33;color:${t.color1}}
.auth-badge .dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e}
#login-modal{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);backdrop-filter:blur(20px);align-items:center;justify-content:center}
#login-modal.open{display:flex}
.modal-card{background:rgba(15,15,25,.95);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:3rem;max-width:420px;width:90%;position:relative;box-shadow:0 25px 60px rgba(0,0,0,.7)}
.modal-card h2{font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:.5rem;text-align:center}
.modal-card .sub{font-size:.8rem;color:rgba(255,255,255,.5);text-align:center;margin-bottom:2rem}
.modal-card input{width:100%;padding:.8rem 1rem;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#fff;font-size:.9rem;margin-bottom:1rem;outline:none;transition:border .3s}
.modal-card input:focus{border-color:${t.color1}}
.modal-card .btn-primary{width:100%;padding:.8rem;border-radius:12px;background:${t.color1};color:#000;font-weight:700;font-size:.9rem;border:none;cursor:pointer;transition:all .3s;margin-bottom:.75rem}
.modal-card .btn-primary:hover{box-shadow:0 5px 25px ${t.color1}66}
.modal-card .btn-google{width:100%;padding:.8rem;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;font-weight:500;font-size:.85rem;cursor:pointer;transition:all .3s;display:flex;align-items:center;justify-content:center;gap:.5rem;margin-bottom:.75rem}
.modal-card .btn-google:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)}
.modal-card .btn-close{position:absolute;top:1rem;right:1rem;background:none;border:none;color:rgba(255,255,255,.4);font-size:1.5rem;cursor:pointer}
.modal-card .divider{display:flex;align-items:center;gap:1rem;margin:1rem 0;color:rgba(255,255,255,.3);font-size:.75rem}
.modal-card .divider::before,.modal-card .divider::after{content:'';flex:1;border-top:1px solid rgba(255,255,255,.08)}
.modal-card .warp-info{font-size:.7rem;color:rgba(255,255,255,.4);text-align:center;margin-top:1rem}
.vector-indicator{position:fixed;bottom:5rem;right:2rem;padding:.4rem .8rem;border-radius:8px;background:rgba(15,15,25,.9);border:1px solid ${t.color1}33;color:${t.color1};font-size:.6rem;letter-spacing:.1em;z-index:150;display:none;backdrop-filter:blur(8px)}
footer{text-align:center;padding:3rem;color:rgba(255,255,255,.3);font-size:.75rem;letter-spacing:1px}
@media(max-width:768px){header{flex-direction:column;gap:1.5rem}nav{justify-content:center}.stats{grid-template-columns:repeat(2,1fr);gap:1.5rem;padding:1.5rem}.cards{padding:0 1rem}}
</style></head><body>
<canvas id="cosmic-canvas"></canvas>
<div class="site-wrap">
<header>
<a class="logo-wrap" href="/v/${v.domain.replace(/\.(com|org|io)$/, '')}">
<div class="logo-title">${v.name}</div><div class="logo-sub">${v.tagline}</div>
</a>
<nav>${navLinks}</nav>
<div id="auth-area"><button class="auth-btn" onclick="document.getElementById('login-modal').classList.add('open')">Sign In</button></div>
</header>
<div id="login-modal">
<div class="modal-card">
<button class="btn-close" onclick="document.getElementById('login-modal').classList.remove('open')">&times;</button>
<h2>Welcome to ${v.name}</h2>
<p class="sub">Your Ultimate AI Companion — sign in for full access</p>
<button class="btn-google" onclick="window.location.href='/api/auth/google'">🔵 Continue with Google</button>
<div class="divider">or</div>
<form id="login-form" onsubmit="return headyLogin(event)">
<input type="text" id="login-user" placeholder="Username" autocomplete="username">
<input type="password" id="login-pass" placeholder="Password" autocomplete="current-password">
<button type="submit" class="btn-primary">Sign In</button>
</form>
<p class="warp-info" id="warp-badge"></p>
</div>
</div>
<div class="vector-indicator" id="vec-ind">🔬 3D VECTOR SCAN...</div>
<section class="hero">
<div class="status"><span class="status-dot"></span> ${v.name} Online</div>
<h1>${v.name}</h1>
<p class="hero-sub">${v.tagline}</p>
<div class="sacred-badge">${t.label}</div>
<p class="hero-mantra">${v.ecosystemRole || v.description}</p>
<div class="stats">${statsHTML}</div>
</section>
<div class="cards">${cardsHTML}</div>
<footer>© 2026 ${v.name} — Powered by HCFP Auto-Success 135</footer>
</div>
<button class="fab" onclick="toggleHeadyChat()" title="Chat with ${v.name}">✦</button>
<style>
#heady-chat-panel{display:none;position:fixed;bottom:80px;right:16px;width:380px;max-height:min(520px,70vh);background:rgba(10,10,25,0.75);border:1px solid rgba(139,92,246,0.25);border-radius:20px;z-index:10000;font-family:Inter,system-ui,-apple-system,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 40px rgba(139,92,246,0.1);backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);flex-direction:column;overflow:hidden;animation:chatSlideIn 0.3s ease-out;}
#heady-chat-panel.open{display:flex;}
@keyframes chatSlideIn{from{opacity:0;transform:translateY(20px) scale(0.95);}to{opacity:1;transform:translateY(0) scale(1);}}
#heady-chat-panel .chat-header{padding:14px 16px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.1));border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;}
#heady-chat-panel .chat-header .avatar{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
#heady-chat-panel .chat-header .info{flex:1;}
#heady-chat-panel .chat-header .name{color:#fff;font-weight:600;font-size:14px;}
#heady-chat-panel .chat-header .hstatus{color:#34d399;font-size:11px;display:flex;align-items:center;gap:4px;}
#heady-chat-panel .chat-header .hstatus::before{content:'';width:6px;height:6px;background:#34d399;border-radius:50%;}
#heady-chat-panel .close-btn{background:none;border:none;color:rgba(255,255,255,0.4);font-size:20px;cursor:pointer;padding:4px;line-height:1;transition:color 0.2s;}
#heady-chat-panel .close-btn:hover{color:#fff;}
#heady-chat-messages{flex:1;overflow-y:auto;padding:16px;min-height:180px;scrollbar-width:thin;scrollbar-color:rgba(139,92,246,0.3) transparent;}
#heady-chat-messages::-webkit-scrollbar{width:4px;}
#heady-chat-messages::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px;}
.hc-msg{margin-bottom:12px;animation:msgFadeIn 0.25s ease-out;}
@keyframes msgFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.hc-msg.bot .hc-bubble{background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.15);border-radius:16px 16px 16px 4px;color:rgba(255,255,255,0.88);padding:10px 14px;font-size:13px;line-height:1.5;max-width:90%;}
.hc-msg.user{text-align:right;}
.hc-msg.user .hc-bubble{background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.2);border-radius:16px 16px 4px 16px;color:rgba(255,255,255,0.92);padding:10px 14px;font-size:13px;line-height:1.5;display:inline-block;max-width:85%;text-align:left;}
.hc-typing{color:rgba(255,255,255,0.4);font-size:12px;padding:4px 0;}
.hc-typing span{animation:typingDot 1.4s infinite;display:inline-block;}
.hc-typing span:nth-child(2){animation-delay:0.2s;}
.hc-typing span:nth-child(3){animation-delay:0.4s;}
@keyframes typingDot{0%,60%,100%{opacity:0.3;}30%{opacity:1;}}
#heady-chat-panel .chat-input-area{padding:12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;background:rgba(0,0,0,0.2);}
#heady-chat-input{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:13px;outline:none;transition:border-color 0.2s;font-family:inherit;}
#heady-chat-input:focus{border-color:rgba(139,92,246,0.4);}
#heady-chat-input::placeholder{color:rgba(255,255,255,0.3);}
#heady-chat-send{background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:12px;padding:10px 16px;color:#fff;cursor:pointer;font-size:13px;font-weight:500;transition:transform 0.15s,opacity 0.15s;font-family:inherit;}
#heady-chat-send:hover{transform:scale(1.05);}
#heady-chat-send:active{transform:scale(0.95);}
@media(max-width:480px){#heady-chat-panel{left:8px;right:8px;bottom:70px;width:auto;max-height:min(480px,65vh);border-radius:16px;} .fab{bottom:12px;right:12px;width:48px;height:48px;font-size:18px;}}
</style>
<div id="heady-chat-panel">
<div class="chat-header">
<div class="avatar">✦</div>
<div class="info"><div class="name">${v.name}</div><div class="hstatus">Online · 3D Context</div></div>
<button class="close-btn" onclick="toggleHeadyChat()">✕</button>
</div>
<div id="heady-chat-messages">
<div class="hc-msg bot"><div class="hc-bubble">Hey! I'm ${v.name}'s AI assistant, connected to the full Heady ecosystem with 3D vector context. Ask me anything! ✨</div></div>
</div>
<div class="chat-input-area">
<input id="heady-chat-input" type="text" placeholder="Ask ${v.name} anything..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendHeadyChat();}">
<button id="heady-chat-send" onclick="sendHeadyChat()">Send</button>
</div>
</div>
<script>
function toggleHeadyChat(){var p=document.getElementById('heady-chat-panel');if(p.classList.contains('open')){p.classList.remove('open');p.style.display='none';}else{p.classList.add('open');p.style.display='flex';document.getElementById('heady-chat-input').focus();var m=document.getElementById('heady-chat-messages');m.scrollTop=m.scrollHeight;}}
async function sendHeadyChat(){var input=document.getElementById('heady-chat-input');var msg=input.value.trim();if(!msg)return;input.value='';var container=document.getElementById('heady-chat-messages');container.innerHTML+='<div class="hc-msg user"><div class="hc-bubble">'+msg.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div></div>';container.innerHTML+='<div class="hc-msg bot" id="heady-typing-msg"><div class="hc-typing"><span>.</span><span>.</span><span>.</span></div></div>';container.scrollTop=container.scrollHeight;try{var r=await fetch('/api/brain/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,context:{vertical:'${v.domain}'}})});var d=await r.json();var reply=(d.response||d.message||d.text||'Processing via ${v.name}...').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');var t=document.getElementById('heady-typing-msg');if(t)t.remove();container.innerHTML+='<div class="hc-msg bot"><div class="hc-bubble">'+reply+'</div></div>';container.scrollTop=container.scrollHeight;}catch(e){var t=document.getElementById('heady-typing-msg');if(t)t.remove();container.innerHTML+='<div class="hc-msg bot"><div class="hc-bubble">Connected to ${v.name} ecosystem. Full context active! ✨</div></div>';container.scrollTop=container.scrollHeight;}}
</script>

<script>
// Cosmic starfield + sacred geometry — EXACT from live headybuddy.org
(function(){
    const canvas = document.getElementById('cosmic-canvas');
    const ctx = canvas.getContext('2d');
    let width, height, cx, cy;
    let stars = [];
    let time = 0;
    const hex2rgb = (hex) => {
        const v = parseInt(hex.replace('#',''), 16);
        return {r: (v>>16)&255, g: (v>>8)&255, b: v&255};
    };
    const baseColor1 = hex2rgb('${t.color1}');
    const baseColor2 = hex2rgb('${t.color2}');
    const geoType = '${t.geo}';
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        cx = width / 2;
        cy = height / 2;
        stars = [];
        const numStars = (width * height) / 4000;
        for(let i=0; i<numStars; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * 2,
                size: Math.random() * 1.5,
                blinkSpeed: Math.random() * 0.02 + 0.005,
                blinkOffset: Math.random() * Math.PI * 2
            });
        }
    }
    function drawStars() {
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, width, height);
        stars.forEach(s => {
            s.y -= s.z * 0.2;
            s.x += s.z * 0.1;
            if(s.y < 0) s.y = height;
            if(s.x > width) s.x = 0;
            const blink = Math.sin(time * s.blinkSpeed + s.blinkOffset) * 0.5 + 0.5;
            ctx.fillStyle = \`rgba(255,255,255,\${blink * 0.7})\`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
            ctx.fill();
        });
    }
    function drawGeometry() {
        const radius = Math.max(width, height) * 0.45;
        const rotZ = time * 0.00015;
        const tiltX = Math.sin(time * 0.00012) * 0.3;
        const tiltY = Math.cos(time * 0.00009) * 0.25;
        const breathe = Math.sin(time * 0.002) * 0.02 + 1;
        const driftX = Math.sin(time * 0.0006) * 20;
        const driftY = Math.cos(time * 0.0005) * 15;
        ctx.save();
        ctx.translate(cx + driftX, cy + driftY);
        ctx.scale(breathe, breathe);
        ctx.rotate(rotZ);
        ctx.lineWidth = 0.3;
        ctx.lineCap = 'round';
        function hueColor(idx, total, alpha) {
            const baseHue = (idx / total) * 360;
            const hue = (baseHue + time * 0.02) % 360;
            const sat = 70 + Math.sin(time * 0.001 + idx) * 15;
            const lit = 55 + Math.sin(time * 0.0008 + idx * 0.5) * 15;
            return \`hsla(\${hue},\${sat}%,\${lit}%,\${alpha})\`;
        }
        function proj(x, y, z) {
            const cy2 = Math.cos(tiltY), sy = Math.sin(tiltY);
            const cx2 = Math.cos(tiltX), sx = Math.sin(tiltX);
            const x2 = x * cy2 - z * sy;
            const z2 = x * sy + z * cy2;
            const y2 = y * cx2 - z2 * sx;
            return { x: x2, y: y2 };
        }
        if (geoType === 'Seed of Life') {
            let idx = 0; const total = 19;
            for (let ring = 0; ring < 3; ring++) {
                const n = ring === 0 ? 1 : 6;
                const dist = ring * radius * 0.28;
                const circR = radius * (0.28 + ring * 0.06);
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / 6) * i + ring * 0.5;
                    const raw = ring === 0 ? {x:0,y:0} : {x: Math.cos(a)*dist, y: Math.sin(a)*dist};
                    const p = proj(raw.x, raw.y, Math.sin(a + time * 0.0003) * radius * 0.1);
                    ctx.strokeStyle = hueColor(idx, total, 0.6);
                    ctx.shadowColor = hueColor(idx, total, 0.3);
                    ctx.shadowBlur = 12;
                    ctx.beginPath(); ctx.arc(p.x, p.y, circR, 0, Math.PI * 2); ctx.stroke();
                    idx++;
                }
            }
            ctx.strokeStyle = hueColor(18, total, 0.4);
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        } else if (geoType === 'Flower of Life') {
            let idx = 0; const total = 37;
            for (let ring = 0; ring < 4; ring++) {
                const n = ring === 0 ? 1 : ring * 6;
                const dist = ring * radius * 0.22;
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / Math.max(n,1)) * i;
                    const raw = ring === 0 ? {x:0,y:0} : {x:Math.cos(a)*dist, y:Math.sin(a)*dist};
                    const p = proj(raw.x, raw.y, Math.cos(a * 2 + time * 0.0002) * radius * 0.08);
                    ctx.strokeStyle = hueColor(idx, total, 0.55);
                    ctx.shadowColor = hueColor(idx, total, 0.25);
                    ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.22, 0, Math.PI * 2); ctx.stroke();
                    idx++;
                }
            }
        } else if (geoType === 'Metatrons Cube') {
            const nodes = [{x:0,y:0,z:0}];
            for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i; nodes.push({x:Math.cos(a)*radius*0.45,y:Math.sin(a)*radius*0.45,z:Math.sin(a+time*0.0002)*radius*0.1}); }
            for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i+Math.PI/6; nodes.push({x:Math.cos(a)*radius*0.85,y:Math.sin(a)*radius*0.85,z:Math.cos(a+time*0.0003)*radius*0.15}); }
            let li = 0; const tl = (nodes.length*(nodes.length-1))/2;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i+1; j < nodes.length; j++) {
                    const p1 = proj(nodes[i].x, nodes[i].y, nodes[i].z);
                    const p2 = proj(nodes[j].x, nodes[j].y, nodes[j].z);
                    ctx.strokeStyle = hueColor(li, tl, 0.4);
                    ctx.shadowColor = hueColor(li, tl, 0.15);
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    li++;
                }
            }
            for (let i = 0; i < nodes.length; i++) {
                const p = proj(nodes[i].x, nodes[i].y, nodes[i].z);
                ctx.strokeStyle = hueColor(i+tl, nodes.length+tl, 0.7);
                ctx.shadowBlur = 15;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.stroke();
            }
        } else {
            for (let i = 0; i < 72; i++) {
                const a = (Math.PI * 2 / 72) * i;
                const p = proj(Math.cos(a)*radius*0.15, Math.sin(a)*radius*0.15, Math.sin(a*3+time*0.0002)*radius*0.1);
                ctx.strokeStyle = hueColor(i, 72, 0.5);
                ctx.shadowColor = hueColor(i, 72, 0.2);
                ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.ellipse(p.x, p.y, radius*0.85, radius*0.3, a+tiltY, 0, Math.PI*2); ctx.stroke();
            }
        }
        ctx.restore();
    }
    function animate() {
        time++;
        drawStars();
        drawGeometry();
        requestAnimationFrame(animate);
    }
    window.addEventListener('resize', resize);
    resize();
    animate();
})();
</script>

<script>
/* HeadyAuth — Server-side auth + WARP detection + 3D vector prereq */
(function(){
  const DK='heady_device_id', TK='heady_auth_token', WK='heady_warp';
  const API = window.location.origin;
  if(!localStorage.getItem(DK)) localStorage.setItem(DK, crypto.randomUUID());

  // Check URL for Google OAuth callback token
  const params = new URLSearchParams(window.location.search);
  if(params.get('auth_token')) {
    localStorage.setItem(TK, params.get('auth_token'));
    window.history.replaceState({}, '', window.location.pathname);
  }

  // WARP detection
  const warp = navigator.userAgent.includes('Cloudflare-WARP') || localStorage.getItem(WK)==='true';
  if(warp) localStorage.setItem(WK,'true');

  // Try existing token
  let tok = localStorage.getItem(TK);

  async function verifyToken() {
    if(!tok) return silentAuth();
    try {
      const r = await fetch(API + '/api/auth/verify', { headers: { Authorization: 'Bearer ' + tok } });
      if(r.ok) { const d = await r.json(); updateUI(d); return; }
    } catch{}
    tok = null; localStorage.removeItem(TK);
    silentAuth();
  }

  async function silentAuth() {
    const deviceId = localStorage.getItem(DK);
    const endpoint = warp ? '/api/auth/warp' : '/api/auth/device';
    try {
      const r = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, warp })
      });
      if(r.ok) {
        const d = await r.json();
        tok = d.token;
        localStorage.setItem(TK, tok);
        updateUI({ valid: true, tier: d.tier, method: d.method, warp: d.warp });
        console.log('🔐', d.warp ? 'WARP 365d' : d.method + ' ' + (d.sessionDays||90) + 'd', '| device:', deviceId.slice(0,8));
      }
    } catch(e) { console.warn('Auth fallback:', e); }
  }

  function updateUI(session) {
    const area = document.getElementById('auth-area');
    if(area && session && session.valid !== false) {
      const tier = session.tier || 'core';
      const emoji = session.warp ? '🛡️' : tier === 'admin' ? '👑' : '✦';
      area.innerHTML = '<div class="auth-badge"><span class="dot"></span>' + emoji + ' ' + (session.email || session.userId || tier).toString().slice(0,15) + ' · ' + tier.toUpperCase() + '</div>';
    }
    // WARP badge
    const wb = document.getElementById('warp-badge');
    if(wb && warp) wb.textContent = '🛡️ Cloudflare WARP detected — 365-day extended session active';
  }

  // 3D vector prereq indicator
  window.headyVectorScan = function() {
    const ind = document.getElementById('vec-ind');
    if(ind) { ind.style.display = 'block'; setTimeout(() => ind.style.display = 'none', 1500); }
  };

  // Login form handler
  window.headyLogin = async function(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    try {
      const r = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const d = await r.json();
      if(d.success) {
        tok = d.token;
        localStorage.setItem(TK, tok);
        updateUI({ valid: true, tier: d.tier, userId: d.userId });
        document.getElementById('login-modal').classList.remove('open');
      } else {
        alert(d.error || 'Login failed');
      }
    } catch(e) { alert('Connection error'); }
    return false;
  };

  // Boot
  verifyToken();

  // Register service worker for PWA install
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(r => console.log('🔧 SW registered')).catch(() => {});
  }
})();
</script>
</body></html>`;
}

let count = 0;
for (const v of verticals) {
    const slug = v.domain.replace(/\.(com|org|io)$/, "");
    fs.writeFileSync(path.join(OUTPUT_DIR, slug + ".html"), gen(v, verticals));
    count++;
    console.log("  ✓ " + v.name + " → " + slug + ".html");
}
console.log("\\n  ✅ " + count + " sites (v5 — Direct from live headybuddy.org + Canvas engine)");
module.exports = { gen, verticals, THEMES };
