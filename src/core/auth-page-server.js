/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Universal Auth Page ═══
 *
 * Single auth page used across ALL Heady sites.
 * 25+ providers: OAuth social + AI API key providers.
 * Designed for Colab Flask runtime via ngrok.
 * Embeddable in HF Spaces, Cloud Run, landing page.
 */

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.AUTH_PORT || 3847;

// ── Provider definitions ────────────────────────────────────
const PROVIDERS = {
    // OAuth Social Providers
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
    // AI API Key Providers
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

// In-memory stores
const users = new Map();
const sessions = new Map();

function generateApiKey() {
    return `HY-${crypto.randomBytes(16).toString('hex')}`;
}

function generateSession() {
    return `sess_${crypto.randomBytes(32).toString('hex')}`;
}

function hashPw(pw, salt) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// ── HTML Render ─────────────────────────────────────────────
function renderAuthPage() {
    const oauthButtons = PROVIDERS.oauth.map(p => `
        <button class="provider-btn" data-provider="${p.id}" style="--pcolor:${p.color}" onclick="oauthLogin('${p.id}')">
            <span class="provider-icon">${p.icon}</span>
            <span class="provider-name">${p.name}</span>
        </button>`).join('');

    const apikeyButtons = PROVIDERS.apikey.map(p => `
        <button class="provider-btn apikey" data-provider="${p.id}" style="--pcolor:${p.color}" onclick="showApiKeyInput('${p.id}','${p.name}','${p.prefix}')">
            <span class="provider-icon">${p.icon}</span>
            <span class="provider-name">${p.name}</span>
        </button>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heady — Sign In</title>
    <meta name="description" content="Sign in to Heady with 25+ providers. Google, GitHub, Apple, Discord, or connect your AI API keys.">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        :root{--bg:#0a0a1a;--surface:rgba(20,20,50,0.6);--border:rgba(76,143,255,0.15);--blue:#4c8fff;--cyan:#00d4ff;--purple:#8b5cf6;--gold:#f0a030;--text:#e8e8f0;--dim:#8888aa;--muted:#555577}
        body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow-x:hidden}
        .bg-grid{position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(76,143,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(76,143,255,0.03) 1px,transparent 1px);background-size:60px 60px;z-index:0}
        .bg-glow{position:fixed;top:-30%;left:-10%;width:60%;height:60%;background:radial-gradient(circle,rgba(76,143,255,0.08),transparent 60%);z-index:0;animation:drift 20s ease-in-out infinite alternate}
        .bg-glow-2{position:fixed;bottom:-20%;right:-10%;width:50%;height:50%;background:radial-gradient(circle,rgba(139,92,246,0.06),transparent 60%);z-index:0;animation:drift 15s ease-in-out infinite alternate-reverse}
        @keyframes drift{from{transform:translate(0,0)}to{transform:translate(30px,-20px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

        .auth-container{position:relative;z-index:1;width:100%;max-width:520px;padding:1.5rem;animation:fadeUp 0.6s ease-out}
        .logo-section{text-align:center;margin-bottom:1.5rem}
        .logo-mark{width:56px;height:56px;margin:0 auto .75rem;border-radius:14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4c8fff,#8b5cf6);font-size:24px;font-weight:900;color:white;box-shadow:0 0 40px rgba(76,143,255,0.3)}
        .logo-text{font-size:1.6rem;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(135deg,#4c8fff,#00d4ff,#8b5cf6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .logo-sub{color:var(--dim);font-size:.8rem;margin-top:.2rem}

        .auth-card{background:var(--surface);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:20px;padding:1.5rem;box-shadow:0 8px 40px rgba(0,0,0,0.4);transition:border-color .3s}
        .auth-card:hover{border-color:rgba(76,143,255,0.3)}

        .section-label{font-size:.7rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.6rem;display:flex;align-items:center;gap:.5rem}
        .section-label::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}

        .provider-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem}
        @media(max-width:480px){.provider-grid{grid-template-columns:repeat(2,1fr)}}

        .provider-btn{display:flex;align-items:center;gap:.5rem;padding:.6rem .75rem;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);color:var(--text);font-family:inherit;font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;text-align:left}
        .provider-btn:hover{border-color:var(--pcolor,var(--blue));background:rgba(0,0,0,0.4);transform:translateY(-1px);box-shadow:0 2px 12px rgba(0,0,0,0.3)}
        .provider-btn:active{transform:translateY(0)}
        .provider-icon{font-size:1.1rem;flex-shrink:0}
        .provider-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

        .divider{display:flex;align-items:center;gap:1rem;color:var(--dim);font-size:.75rem;margin:1rem 0}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}

        /* Email/password form */
        .email-form{display:none;margin-top:1rem;animation:fadeUp .3s ease}
        .email-form.active{display:block}
        .form-input{width:100%;padding:.7rem .9rem;border-radius:10px;border:1px solid var(--border);background:rgba(0,0,0,0.3);color:var(--text);font-family:inherit;font-size:.9rem;outline:none;transition:all .2s;margin-bottom:.6rem}
        .form-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(76,143,255,0.1)}
        .form-input::placeholder{color:var(--muted)}
        .submit-btn{width:100%;padding:.75rem;border:none;border-radius:10px;font-family:inherit;font-size:.95rem;font-weight:700;background:linear-gradient(135deg,#4c8fff,#8b5cf6);color:white;cursor:pointer;transition:all .2s;margin-top:.25rem}
        .submit-btn:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(76,143,255,0.4)}

        /* API Key modal */
        .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
        .modal-overlay.active{display:flex}
        .modal{background:#12122a;border:1px solid var(--border);border-radius:16px;padding:1.5rem;max-width:400px;width:90%;animation:fadeUp .3s ease}
        .modal h3{margin-bottom:1rem;font-size:1.1rem}
        .modal-close{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--dim);font-size:1.2rem;cursor:pointer}

        /* Success */
        .success-view{display:none;text-align:center;animation:fadeUp .4s ease}
        .success-view.active{display:block}
        .success-icon{width:64px;height:64px;margin:0 auto 1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.15);border:2px solid rgba(16,185,129,0.4);font-size:28px}
        .api-key-box{background:rgba(0,0,0,0.4);border:1px solid rgba(76,143,255,0.2);border-radius:10px;padding:.75rem;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--cyan);word-break:break-all;margin:1rem 0}
        .copy-btn{background:rgba(76,143,255,0.15);border:1px solid rgba(76,143,255,0.3);color:var(--blue);padding:.25rem .5rem;border-radius:6px;font-size:.7rem;cursor:pointer;float:right}

        .footer{text-align:center;margin-top:1.5rem;color:var(--dim);font-size:.75rem}
        .footer a{color:var(--blue);text-decoration:none}
        .tab-toggle{text-align:center;margin-bottom:1rem}
        .tab-toggle a{color:var(--blue);font-size:.85rem;cursor:pointer;text-decoration:none}
        .tab-toggle a:hover{text-decoration:underline}
        .provider-count{display:inline-block;background:rgba(76,143,255,0.15);color:var(--blue);padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:600;margin-left:.5rem}
    </style>
</head>
<body>
    <div class="bg-grid"></div>
    <div class="bg-glow"></div>
    <div class="bg-glow-2"></div>

    <div class="auth-container">
        <div class="logo-section">
            <div class="logo-mark">H</div>
            <div class="logo-text">Heady</div>
            <div class="logo-sub">Sovereign AI Platform</div>
        </div>

        <div class="auth-card" id="authCard">
            <div class="section-label">Sign in with <span class="provider-count">12 providers</span></div>
            <div class="provider-grid">${oauthButtons}</div>

            <div class="divider">or connect your AI key</div>

            <div class="section-label">AI API Keys <span class="provider-count">13 providers</span></div>
            <div class="provider-grid">${apikeyButtons}</div>

            <div class="divider">or use email</div>

            <div class="tab-toggle"><a onclick="toggleEmail()">Sign in with email →</a></div>
            <div class="email-form" id="emailForm">
                <input class="form-input" id="authName" placeholder="Display name" autocomplete="name">
                <input class="form-input" id="authEmail" placeholder="Email" type="email" autocomplete="email" required>
                <input class="form-input" id="authPw" placeholder="Password" type="password" autocomplete="current-password" required>
                <button class="submit-btn" onclick="emailAuth()">Continue</button>
            </div>
        </div>

        <!-- Success View -->
        <div class="success-view" id="successView">
            <div class="auth-card">
                <div class="success-icon">✓</div>
                <h3 id="successTitle">Welcome to Heady</h3>
                <p style="color:var(--dim);font-size:.85rem;margin-bottom:1rem" id="successSub"></p>
                <div class="api-key-box">
                    <button class="copy-btn" onclick="copyKey()">Copy</button>
                    <span style="color:var(--dim);font-size:.65rem;display:block;margin-bottom:.25rem">YOUR HEADY API KEY</span>
                    <span id="apiKeyVal"></span>
                </div>
                <p style="color:var(--dim);font-size:.7rem">Save this key. Use as <code style="color:var(--cyan)">HEADY_API_KEY</code> in your .env file.</p>
            </div>
        </div>

        <!-- API Key Modal -->
        <div class="modal-overlay" id="apikeyModal">
            <div class="modal">
                <h3 id="modalTitle">Connect API Key</h3>
                <p style="color:var(--dim);font-size:.8rem;margin-bottom:1rem" id="modalSub">Paste your API key to connect this provider</p>
                <input class="form-input" id="modalKey" placeholder="Paste API key..." style="font-family:'JetBrains Mono',monospace;font-size:.8rem">
                <div style="display:flex;gap:.5rem;margin-top:.5rem">
                    <button class="submit-btn" onclick="connectApiKey()" style="flex:1">Connect</button>
                    <button class="submit-btn" onclick="closeModal()" style="flex:0;background:rgba(255,255,255,0.06);padding:.75rem 1.25rem">✕</button>
                </div>
            </div>
        </div>

        <div class="footer">
            <a href="https://headyme.com">headyme.com</a> · © 2026 HeadySystems Inc. · 25+ providers
        </div>
    </div>

    <script>
        let currentApiKeyProvider = null;

        function oauthLogin(provider) {
            // In production: redirect to /auth/{provider} on Colab runtime
            // For now: simulate success
            const btn = document.querySelector('[data-provider="'+provider+'"]');
            btn.style.borderColor = 'var(--blue)';
            btn.style.background = 'rgba(76,143,255,0.1)';
            fetch('/api/signup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: provider+'@heady.oauth', password: 'oauth-'+Date.now(), displayName: provider.charAt(0).toUpperCase()+provider.slice(1)+' User', provider: provider})
            }).then(r=>r.json()).then(d=>{ if(!d.error) showSuccess(d, provider); else alert(d.error); }).catch(()=>showSuccess({user:{displayName:provider+' User',apiKey:'HY-'+provider.toUpperCase().slice(0,3)+'-demo',tier:'spark'},token:'demo'}, provider));
        }

        function showApiKeyInput(provider, name, prefix) {
            currentApiKeyProvider = provider;
            document.getElementById('modalTitle').textContent = 'Connect ' + name;
            document.getElementById('modalSub').textContent = prefix ? 'Key starts with: ' + prefix : 'Paste your ' + name + ' API key';
            document.getElementById('modalKey').value = '';
            document.getElementById('modalKey').placeholder = prefix ? prefix + '...' : 'Paste API key...';
            document.getElementById('apikeyModal').classList.add('active');
            setTimeout(()=>document.getElementById('modalKey').focus(), 100);
        }

        function closeModal() { document.getElementById('apikeyModal').classList.remove('active'); }

        function connectApiKey() {
            const key = document.getElementById('modalKey').value.trim();
            if (!key) return;
            closeModal();
            fetch('/api/signup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: currentApiKeyProvider+'@heady.apikey', password: 'apikey-'+Date.now(), displayName: currentApiKeyProvider.charAt(0).toUpperCase()+currentApiKeyProvider.slice(1)+' User', provider: currentApiKeyProvider, connectedKey: key})
            }).then(r=>r.json()).then(d=>{ if(!d.error) showSuccess(d, currentApiKeyProvider); }).catch(()=>{});
        }

        function toggleEmail() {
            document.getElementById('emailForm').classList.toggle('active');
            if(document.getElementById('emailForm').classList.contains('active')) document.getElementById('authEmail').focus();
        }

        function emailAuth() {
            const email = document.getElementById('authEmail').value;
            const pw = document.getElementById('authPw').value;
            const name = document.getElementById('authName').value;
            if (!email || !pw) return;
            fetch('/api/signup', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password: pw, displayName: name || email.split('@')[0], provider: 'email'})
            }).then(r=>r.json()).then(d=>{
                if (d.error && d.error.includes('exists')) {
                    fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})}).then(r=>r.json()).then(d2=>{if(!d2.error)showSuccess(d2,'email');else alert(d2.error);});
                } else if (!d.error) showSuccess(d, 'email');
                else alert(d.error);
            });
        }

        function showSuccess(data, provider) {
            document.getElementById('authCard').style.display = 'none';
            document.getElementById('successView').classList.add('active');
            document.getElementById('successTitle').textContent = 'Welcome, ' + data.user.displayName;
            document.getElementById('successSub').textContent = 'Connected via ' + provider;
            document.getElementById('apiKeyVal').textContent = data.user.apiKey;
            document.cookie = 'heady_session=' + data.token + '; path=/; max-age=86400; SameSite=Strict';
        }

        function copyKey() {
            navigator.clipboard.writeText(document.getElementById('apiKeyVal').textContent).then(()=>{
                const b = document.querySelector('.copy-btn'); b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy',2000);
            });
        }

        // Close modal on escape
        document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
        document.getElementById('apikeyModal').addEventListener('click', e=>{ if(e.target.id==='apikeyModal') closeModal(); });
        document.getElementById('modalKey').addEventListener('keydown', e=>{ if(e.key==='Enter') connectApiKey(); });
    </script>
</body>
</html>`;
}

// ── API ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

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
            } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid request' })); }
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
                if (!user) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid email or password' })); return; }
                const { hash } = hashPw(password, user.salt);
                if (hash !== user.hash) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid email or password' })); return; }
                const token = generateSession();
                sessions.set(token, { userId: user.id, email });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ user: { id: user.id, email, displayName: user.displayName, tier: 'spark', apiKey: user.apiKey, provider: user.provider }, token }));
            } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid request' })); }
        });
        return;
    }

    if (url.pathname === '/api/providers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(PROVIDERS));
        return;
    }

    if (url.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', version: '3.0.1', providers: PROVIDERS.oauth.length + PROVIDERS.apikey.length, users: users.size, sessions: sessions.size }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderAuthPage());
});

server.listen(PORT, () => {
    console.log(`\n  🔐 Heady Universal Auth — http://localhost:${PORT}`);
    console.log(`     ${PROVIDERS.oauth.length} OAuth + ${PROVIDERS.apikey.length} API Key = ${PROVIDERS.oauth.length + PROVIDERS.apikey.length} providers\n`);
});

module.exports = { PROVIDERS, server };
