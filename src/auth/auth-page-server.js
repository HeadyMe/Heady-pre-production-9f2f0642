/*
 * © 2026 HeadySystems Inc..
 * Auth Page Server — standalone dev server (native http, no Express needed).
 * Usage: node src/auth-page-server.js
 */
const http = require('http');
const path = require('path');
const { HeadyAuth } = require('./hc_auth');

const PORT = 3847;

// Boot auth engine
const auth = new HeadyAuth({
  dataDir: path.join(__dirname, '..', 'data'),
});

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // JSON helper
  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // ─── Routes ──────────────────────────────────────────
  try {

    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(AUTH_PAGE_HTML);
    }

    // ── Login (email/password) ──
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await parseBody(req);
      if (!username) return json(400, { error: 'Username is required' });
      const session = auth.loginManual(username, password, {
        userAgent: req.headers['user-agent'],
        ip: req.socket.remoteAddress,
      });
      if (!session) return json(401, { error: 'Invalid credentials. Please check your username and password.' });
      return json(200, {
        success: true,
        token: session.token,
        tier: session.tier,
        userId: session.userId,
        method: session.method,
        expiresAt: session.expiresAt,
        redirectTo: '/onboarding/start',
      });
    }

    // ── Register (new account) ──
    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const { username, password, email, displayName } = await parseBody(req);
      if (!username || username.length < 3) return json(400, { error: 'Username must be at least 3 characters' });
      if (!password || password.length < 8) return json(400, { error: 'Password must be at least 8 characters' });
      // Use loginManual with registration flag — HeadyAuth auto-creates on first login
      const session = auth.loginManual(username, password, {
        userAgent: req.headers['user-agent'],
        ip: req.socket.remoteAddress,
        register: true,
        email: email || `${username}@headyme.com`,
        displayName: displayName || username,
      });
      if (!session) return json(500, { error: 'Registration failed. Please try again.' });
      return json(201, {
        success: true,
        token: session.token,
        tier: session.tier,
        userId: session.userId,
        method: 'register',
        expiresAt: session.expiresAt,
        redirectTo: '/onboarding/start',
      });
    }

    // ── Device token auth ──
    if (url.pathname === '/api/auth/device' && req.method === 'POST') {
      const { deviceId } = await parseBody(req);
      if (!deviceId) return json(400, { error: 'deviceId required' });
      const session = auth.loginDevice(deviceId, {
        userAgent: req.headers['user-agent'],
        ip: req.socket.remoteAddress,
      });
      return json(200, {
        success: true,
        token: session.token,
        tier: session.tier,
        method: 'device',
        expiresAt: session.expiresAt,
        redirectTo: '/onboarding/start',
      });
    }

    // ── Google OAuth — initiate redirect ──
    if (url.pathname === '/api/auth/google/start' && req.method === 'GET') {
      try {
        const state = Math.random().toString(36).substring(2, 15);
        const authUrl = auth.getGoogleAuthUrl(state);
        if (!authUrl) return json(503, { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' });
        return json(200, { success: true, authUrl, state });
      } catch (e) {
        return json(503, { error: 'Google OAuth not configured: ' + e.message });
      }
    }

    // ── Google OAuth — callback handler ──
    if (url.pathname === '/api/auth/google/callback' && (req.method === 'GET' || req.method === 'POST')) {
      const code = url.searchParams.get('code') || (await parseBody(req)).code;
      if (!code) return json(400, { error: 'Authorization code required' });
      try {
        const session = await auth.handleGoogleCallback(code, {
          userAgent: req.headers['user-agent'],
          ip: req.socket.remoteAddress,
        });
        // Redirect to onboarding with token
        if (req.method === 'GET') {
          res.writeHead(302, { 'Location': `/?token=${encodeURIComponent(session.token)}&method=google` });
          return res.end();
        }
        return json(200, {
          success: true,
          token: session.token,
          tier: session.tier,
          userId: session.userId,
          method: 'google',
          expiresAt: session.expiresAt,
          redirectTo: '/onboarding/start',
        });
      } catch (e) {
        return json(401, { error: 'Google authentication failed: ' + e.message });
      }
    }

    // ── Verify token ──
    if (url.pathname === '/api/auth/verify' && req.method === 'POST') {
      const { token } = await parseBody(req);
      if (!token) return json(400, { error: 'Token is required' });
      const verified = auth.verify(token);
      if (!verified) return json(200, { valid: false });
      return json(200, { valid: true, ...verified });
    }

    // ── Refresh token ──
    if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
      const { token } = await parseBody(req);
      if (!token) return json(400, { error: 'Token is required' });
      const refreshed = auth.refresh(token);
      if (!refreshed) return json(401, { error: 'Token expired or invalid. Please re-authenticate.' });
      return json(200, {
        success: true,
        token: refreshed.token,
        expiresAt: refreshed.expiresAt,
      });
    }

    // ── Auth status ──
    if (url.pathname === '/api/auth/status' && req.method === 'GET') {
      return json(200, auth.getStatus());
    }

    json(404, { error: 'Not found' });

  } catch (err) {
    console.error('[AuthPage] Route error:', err.message);
    json(500, { error: 'Internal server error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  🔐 Heady Auth Page live at: http://localhost:${PORT}\n`);
});

// ═════════════════════════════════════════════════════════════════
// EMBEDDED AUTH PAGE — Premium glassmorphism dark UI
// ═════════════════════════════════════════════════════════════════
const AUTH_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heady — Sign In</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #07070e;
    --surface: rgba(15, 15, 30, 0.85);
    --glass: rgba(255,255,255,0.04);
    --glass-border: rgba(255,255,255,0.08);
    --accent: #818cf8;
    --accent-glow: rgba(129,140,248,0.25);
    --success: #34d399;
    --error: #f87171;
    --text: #e2e8f0;
    --text-dim: rgba(226,232,240,0.5);
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  body::before {
    content: '';
    position: fixed; inset: 0;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(129,140,248,0.08) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 80%, rgba(52,211,153,0.05) 0%, transparent 50%);
    pointer-events: none;
  }
  .grid-overlay {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }

  .orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.4; pointer-events: none; animation: float 20s ease-in-out infinite; }
  .orb-1 { width: 300px; height: 300px; background: #818cf8; top: -100px; left: -50px; }
  .orb-2 { width: 250px; height: 250px; background: #a855f7; bottom: -80px; right: -60px; animation-delay: -7s; }
  .orb-3 { width: 200px; height: 200px; background: #34d399; top: 50%; left: 60%; animation-delay: -14s; }
  @keyframes float {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(30px,-20px) scale(1.05); }
    66% { transform: translate(-20px,15px) scale(0.95); }
  }

  .auth-wrapper { position: relative; z-index: 1; width: 100%; max-width: 440px; padding: 20px; }
  .auth-card {
    background: var(--surface);
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    padding: 40px 36px;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.5), 0 0 120px var(--accent-glow);
    animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes cardIn { from { opacity:0; transform:translateY(20px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }

  .logo { text-align: center; margin-bottom: 32px; }
  .logo-mark {
    width: 56px; height: 56px; margin: 0 auto 16px;
    background: linear-gradient(135deg, #818cf8 0%, #a855f7 50%, #34d399 100%);
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    box-shadow: 0 8px 32px var(--accent-glow);
    animation: pulse-glow 3s ease-in-out infinite;
  }
  @keyframes pulse-glow { 0%,100% { box-shadow: 0 8px 32px var(--accent-glow); } 50% { box-shadow: 0 8px 48px rgba(129,140,248,0.4); } }
  .logo h1 { font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, #e2e8f0, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .logo p { color: var(--text-dim); font-size: 0.85rem; margin-top: 4px; }

  .tabs { display: flex; gap: 4px; background: var(--glass); border-radius: 12px; padding: 4px; margin-bottom: 28px; }
  .tab {
    flex: 1; padding: 10px 0; border: none; background: transparent;
    color: var(--text-dim); font-family: inherit; font-size: 0.82rem; font-weight: 600;
    border-radius: 10px; cursor: pointer; transition: all 0.25s ease;
  }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--accent); color: #fff; box-shadow: 0 4px 12px var(--accent-glow); }

  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-group input {
    width: 100%; padding: 14px 16px;
    background: var(--glass); border: 1px solid var(--glass-border); border-radius: 12px;
    color: var(--text); font-family: inherit; font-size: 0.95rem; outline: none; transition: all 0.25s ease;
  }
  .form-group input::placeholder { color: rgba(226,232,240,0.25); }
  .form-group input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); background: rgba(129,140,248,0.05); }

  .btn-primary {
    width: 100%; padding: 14px;
    background: linear-gradient(135deg, #818cf8, #6366f1);
    border: none; border-radius: 12px; color: #fff;
    font-family: inherit; font-size: 0.95rem; font-weight: 700;
    cursor: pointer; transition: all 0.25s ease; position: relative; overflow: hidden;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--accent-glow); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary.loading { pointer-events: none; opacity: 0.7; }
  .btn-primary.loading::after { content:''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent); animation: shimmer 1.5s infinite; }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

  .device-btn {
    width: 100%; padding: 14px;
    background: var(--glass); border: 1px solid var(--glass-border); border-radius: 12px;
    color: var(--text); font-family: inherit; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; transition: all 0.25s ease;
    display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;
  }
  .device-btn:hover { border-color: var(--accent); background: rgba(129,140,248,0.06); }

  .panel { display: none; }
  .panel.active { display: block; }

  .result { display: none; margin-top: 24px; padding: 20px; border-radius: 14px; font-size: 0.85rem; animation: slideUp 0.3s ease; word-break: break-all; }
  .result.show { display: block; }
  .result.success { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2); color: var(--success); }
  .result.error { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: var(--error); }
  @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .result h3 { font-size: 0.9rem; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .result-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 0.8rem; }
  .result-grid .label { color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.7rem; }
  .result-grid .value { color: var(--text); font-family: monospace; }

  .session-bar { display: none; margin-top: 20px; padding: 16px; background: rgba(129,140,248,0.06); border: 1px solid rgba(129,140,248,0.15); border-radius: 14px; animation: slideUp 0.3s ease; }
  .session-bar.show { display: block; }
  .session-bar h4 { font-size: 0.78rem; font-weight: 700; color: var(--accent); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }

  .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; color: var(--text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .divider::before, .divider::after { content:''; flex: 1; height: 1px; background: var(--glass-border); }

  .footer { text-align: center; margin-top: 20px; font-size: 0.72rem; color: var(--text-dim); }
  .footer a { color: var(--accent); text-decoration: none; }

  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; animation: blink 2s ease-in-out infinite; }
  .status-dot.online { background: var(--success); }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

  .verify-input-row { display: flex; gap: 8px; }
  .verify-input-row input { flex: 1; }
  .verify-input-row button {
    padding: 14px 20px; background: linear-gradient(135deg, #34d399, #059669);
    border: none; border-radius: 12px; color: #fff; font-family: inherit; font-weight: 700;
    cursor: pointer; white-space: nowrap; transition: all 0.25s ease;
  }
  .verify-input-row button:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(52,211,153,0.3); }
</style>
</head>
<body>
<div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>
<div class="grid-overlay"></div>

<div class="auth-wrapper"><div class="auth-card">
  <div class="logo">
    <div class="logo-mark">
      <svg viewBox="0 0 32 32" fill="none" style="width:28px;height:28px;">
        <path d="M10 8L10 24M10 16L22 16M22 8L22 24" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <h1>HeadyMe</h1>
    <p><span class="status-dot online"></span>Auth Engine Online · 6 Methods</p>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('login')" id="tab-login">Sign In</button>
    <button class="tab" onclick="switchTab('register')" id="tab-register">Register</button>
    <button class="tab" onclick="switchTab('device')" id="tab-device">Device</button>
    <button class="tab" onclick="switchTab('verify')" id="tab-verify">Verify</button>
  </div>

  <div class="panel active" id="panel-login">
    <form id="loginForm" onsubmit="handleLogin(event)">
      <div class="form-group"><label>Username</label><input type="text" id="username" placeholder="your username" autocomplete="username" required></div>
      <div class="form-group"><label>Password</label><input type="password" id="password" placeholder="Enter your password" autocomplete="current-password"></div>
      <button type="submit" class="btn-primary" id="loginBtn">Sign In →</button>
    </form>
    <div class="divider">or continue with</div>
    <button class="device-btn" onclick="handleDeviceAuth()"><span>📱</span> Auto Device Token</button>
    <button class="device-btn" onclick="handleGoogleAuth()"><span>🔵</span> Sign in with Google</button>
  </div>

  <div class="panel" id="panel-register">
    <form id="registerForm" onsubmit="handleRegister(event)">
      <div class="form-group"><label>Username</label><input type="text" id="regUsername" placeholder="Choose a username (3+ chars)" autocomplete="username" required minlength="3"></div>
      <div class="form-group"><label>Email (optional)</label><input type="email" id="regEmail" placeholder="you@example.com" autocomplete="email"></div>
      <div class="form-group"><label>Password</label><input type="password" id="regPassword" placeholder="Min 8 characters" autocomplete="new-password" required minlength="8"></div>
      <div class="form-group"><label>Confirm Password</label><input type="password" id="regConfirm" placeholder="Confirm password" autocomplete="new-password" required></div>
      <button type="submit" class="btn-primary" id="registerBtn">Create Account →</button>
    </form>
    <p style="margin-top:16px;font-size:0.78rem;color:var(--text-dim);text-align:center;">Your @headyme.com account includes AI tools, secure email, and a personalised dashboard.</p>
  </div>

  <div class="panel" id="panel-device">
    <div class="form-group"><label>Device ID</label><input type="text" id="deviceId" placeholder="my-linux-workstation"></div>
    <button class="btn-primary" onclick="handleDeviceAuth()">Connect Device →</button>
    <p style="margin-top:12px;font-size:0.78rem;color:var(--text-dim);">Device tokens auto-renew and persist for 90 days. WARP-detected devices get 365-day premium sessions.</p>
  </div>

  <div class="panel" id="panel-verify">
    <div class="form-group"><label>Session Token</label>
      <div class="verify-input-row"><input type="text" id="verifyToken" placeholder="Paste a token to verify"><button onclick="handleVerify()">Verify</button></div>
    </div>
  </div>

  <div class="result" id="result"></div>
  <div class="session-bar" id="sessionBar"></div>

  <div class="footer">
    <p>© 2026 HeadySystems Inc. · <a href="https://headyme.com">headyme.com</a> · <a href="https://headysystems.com">headysystems.com</a></p>
    <p style="margin-top:4px;">6 auth methods · JWT + Device + OAuth · Sacred Geometry Architecture</p>
    <p style="margin-top:2px;font-size:0.65rem;">51+ patents pending · φ-derived design system</p>
  </div>
</div></div>

<script>
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('panel-'+tab).classList.add('active');
  document.getElementById('result').className = 'result';
}
function showResult(type, content) {
  const el = document.getElementById('result');
  el.className = 'result show ' + type;
  el.innerHTML = content;
}
function formatSession(data) {
  let html = '<h3>✅ Authenticated</h3><div class="result-grid">';
  [['User', data.userId],['Tier', (data.tier||'').toUpperCase()],['Method', data.method],
   ['Token', data.token ? data.token.substring(0,24)+'...' : '—'],
   ['Expires', data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : '—']
  ].forEach(([l,v]) => { html += '<span class="label">'+l+'</span><span class="value">'+(v||'—')+'</span>'; });
  return html + '</div>';
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.classList.add('loading'); btn.textContent = 'Authenticating...';
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Auth failed');
    showResult('success', formatSession(data));
    showSessionBar(data);
    // Store token and show onboarding link
    localStorage.setItem('heady_token', data.token);
    localStorage.setItem('heady_user', JSON.stringify({ userId: data.userId, tier: data.tier, method: data.method }));
    showOnboardingLink(data);
  } catch (err) { showResult('error', '<h3>⚠️ Error</h3><p>'+err.message+'</p>'); }
  finally { btn.classList.remove('loading'); btn.textContent = 'Sign In →'; }
}

async function handleRegister(e) {
  e.preventDefault();
  const pw = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  if (pw !== confirm) { showResult('error', '<h3>⚠️ Error</h3><p>Passwords do not match.</p>'); return; }
  const btn = document.getElementById('registerBtn');
  btn.classList.add('loading'); btn.textContent = 'Creating Account...';
  try {
    const res = await fetch('/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        username: document.getElementById('regUsername').value,
        password: pw,
        email: document.getElementById('regEmail').value || undefined,
      }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    showResult('success', '<h3>🎉 Account Created!</h3>' + formatSession(data));
    showSessionBar(data);
    localStorage.setItem('heady_token', data.token);
    localStorage.setItem('heady_user', JSON.stringify({ userId: data.userId, tier: data.tier, method: 'register' }));
    showOnboardingLink(data);
  } catch (err) { showResult('error', '<h3>⚠️ Error</h3><p>'+err.message+'</p>'); }
  finally { btn.classList.remove('loading'); btn.textContent = 'Create Account →'; }
}

async function handleDeviceAuth() {
  const deviceId = document.getElementById('deviceId')?.value || 'device_'+Math.random().toString(36).substr(2,8);
  try {
    const res = await fetch('/api/auth/device', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({deviceId}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showResult('success', formatSession(data));
    showSessionBar(data);
    localStorage.setItem('heady_token', data.token);
    showOnboardingLink(data);
  } catch (err) { showResult('error', '<h3>⚠️ Error</h3><p>'+err.message+'</p>'); }
}

async function handleGoogleAuth() {
  try {
    const res = await fetch('/api/auth/google/start');
    const data = await res.json();
    if (!res.ok || !data.authUrl) {
      showResult('error', '<h3>ℹ️ Google OAuth</h3><p>' + (data.error || 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.') + '</p><p style="margin-top:8px;font-size:0.78rem;">Use Sign In or Register tabs, or connect a Device token instead.</p>');
      return;
    }
    // Redirect to Google OAuth
    window.location.href = data.authUrl;
  } catch (err) {
    showResult('error', '<h3>ℹ️ Google OAuth</h3><p>Could not initiate Google sign-in: '+err.message+'</p><p style="margin-top:8px;font-size:0.78rem;">Use Sign In or Register tabs instead.</p>');
  }
}

async function handleVerify() {
  const token = document.getElementById('verifyToken').value;
  if (!token) { showResult('error', '<h3>⚠️</h3><p>Paste a token to verify.</p>'); return; }
  try {
    const res = await fetch('/api/auth/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token}) });
    const data = await res.json();
    if (data.valid) {
      showResult('success', '<h3>✅ Token Valid</h3><div class="result-grid">' +
        '<span class="label">User</span><span class="value">'+(data.userId||'—')+'</span>' +
        '<span class="label">Tier</span><span class="value">'+(data.tier||'').toUpperCase()+'</span>' +
        '<span class="label">Method</span><span class="value">'+(data.method||'—')+'</span>' +
        '<span class="label">Expires</span><span class="value">'+(data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : '—')+'</span></div>');
    } else {
      showResult('error', '<h3>❌ Invalid Token</h3><p>Token not found or expired. Please re-authenticate.</p>');
    }
  } catch (err) { showResult('error', '<h3>⚠️ Error</h3><p>'+err.message+'</p>'); }
}

function showSessionBar(data) {
  const bar = document.getElementById('sessionBar');
  bar.className = 'session-bar show';
  bar.innerHTML = '<h4>🔐 Active Session</h4><div class="result-grid">' +
    '<span class="label">Full Token</span><span class="value" style="font-size:0.7rem;word-break:break-all;">'+data.token+'</span></div>' +
    '<p style="margin-top:10px;font-size:0.72rem;color:var(--text-dim);">Copy this token to test in the Verify tab ↗</p>';
  document.getElementById('verifyToken').value = data.token;
}

function showOnboardingLink(data) {
  const bar = document.getElementById('sessionBar');
  bar.innerHTML += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--glass-border);">' +
    '<a href="/onboarding/start" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:linear-gradient(135deg,#818cf8,#6366f1);border-radius:12px;color:#fff;font-weight:700;font-size:0.9rem;text-decoration:none;transition:all 0.25s;">' +
    '🚀 Continue to Setup Wizard →</a></div>';
}

// Check for Google OAuth callback token in URL
(function checkOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const method = params.get('method');
  if (token && method === 'google') {
    localStorage.setItem('heady_token', token);
    showResult('success', '<h3>🎉 Google Sign-In Successful!</h3><p>Redirecting to setup...</p>');
    showSessionBar({ token });
    showOnboardingLink({ token });
    window.history.replaceState({}, '', '/');
  }
})();

document.getElementById('deviceId').value = navigator.userAgent.includes('Linux') ? 'linux-workstation' : 'device-'+Math.random().toString(36).substr(2,6);
</script>
</body>
</html>`;
