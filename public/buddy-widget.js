/**
 * HeadyBuddy Universal Widget v3.0
 * Auth-aware + user-scoped persistent 3D vector workspace chat.
 */
(function () {
  'use strict';
  const API = window.HEADY_API || 'https://api.headysystems.com';
  const BRAND = { primary: '#7c3aed', accent: '#06b6d4', bg: '#0a0a1a', surface: '#1a1a2e', text: '#e0e0ff', dim: '#6b7280' };
  const DK = 'heady_device_id';
  const TK = 'heady_auth_token';
  const UK = 'heady_user';

  let user = null, chatHistory = [];

  const css = document.createElement('style');
  css.textContent = `#heady-buddy-fab{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border:none;cursor:pointer;box-shadow:0 4px 24px rgba(124,58,237,.4);z-index:99999}#heady-buddy-panel{position:fixed;bottom:96px;right:24px;width:380px;height:520px;background:${BRAND.bg};border:1px solid rgba(124,58,237,.3);border-radius:16px;z-index:99998;display:none;flex-direction:column;overflow:hidden}#heady-buddy-panel.open{display:flex}.hb-header{padding:14px 16px;background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,182,212,.1));border-bottom:1px solid rgba(124,58,237,.2);display:flex;align-items:center;justify-content:space-between}.hb-auth{padding:12px;border-bottom:1px solid rgba(124,58,237,.15)}.hb-auth-btn{background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer}.hb-user{color:${BRAND.accent};font-size:12px;margin-top:4px}.hb-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.hb-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px}.hb-msg.user{align-self:flex-end;background:linear-gradient(135deg,${BRAND.primary},#6d28d9);color:#fff}.hb-msg.bot{align-self:flex-start;background:${BRAND.surface};color:${BRAND.text}}.hb-msg.system{align-self:center;background:transparent;color:${BRAND.dim};font-size:11px}.hb-input-row{padding:12px;border-top:1px solid rgba(124,58,237,.2);display:flex;gap:8px}.hb-input{flex:1;background:${BRAND.surface};border:1px solid rgba(124,58,237,.2);border-radius:10px;padding:10px 14px;color:${BRAND.text}}.hb-send{background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border:none;border-radius:10px;padding:10px 16px;color:#fff;cursor:pointer}`;
  document.head.appendChild(css);

  const fab = document.createElement('button');
  fab.id = 'heady-buddy-fab';
  fab.textContent = '🧠';

  const panel = document.createElement('div');
  panel.id = 'heady-buddy-panel';
  panel.innerHTML = '<div class="hb-header"><h3 style="margin:0;color:#e0e0ff">🧠 HeadyBuddy</h3><button id="hb-close" style="background:none;border:none;color:#6b7280;cursor:pointer">✕</button></div><div class="hb-auth"><button class="hb-auth-btn" id="hb-auth-btn">Authenticate</button><div class="hb-user" id="hb-user-info"></div></div><div class="hb-messages" id="hb-messages"><div class="hb-msg system">Connected to secure Heady 3D vector workspace.</div></div><div class="hb-input-row"><input id="hb-input" class="hb-input" placeholder="Ask HeadyBuddy..."><button id="hb-send" class="hb-send">▶</button></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const authBtn = panel.querySelector('#hb-auth-btn');
  const userInfo = panel.querySelector('#hb-user-info');
  const msgBox = panel.querySelector('#hb-messages');
  const input = panel.querySelector('#hb-input');
  const sendBtn = panel.querySelector('#hb-send');

  function ensureDevice() {
    const existing = localStorage.getItem(DK);
    if (existing) return existing;
    const created = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `heady-${Date.now()}`;
    localStorage.setItem(DK, created);
    return created;
  }

  function userKey() {
    const token = localStorage.getItem(TK) || 'anon';
    return `buddy_history:${location.hostname}:${token.slice(0, 16)}`;
  }

  function addMsg(type, text) {
    const div = document.createElement('div');
    div.className = `hb-msg ${type}`;
    div.textContent = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(userKey()) || '[]'); } catch { return []; }
  }

  function saveHistory(items) {
    localStorage.setItem(userKey(), JSON.stringify(items.slice(-40)));
  }

  async function refreshAuth() {
    const token = localStorage.getItem(TK);
    const storedUser = localStorage.getItem(UK);
    if (storedUser) {
      try { user = JSON.parse(storedUser); } catch { }
    }
    if (token && !user) {
      user = { id: token.slice(0, 16), email: 'authenticated-user' };
    }
    userInfo.textContent = user ? `${user.email || user.id} · AUTH` : 'Not authenticated';
    authBtn.textContent = user ? 'Clear Session' : 'Authenticate';
  }

  authBtn.onclick = () => {
    if (user) {
      user = null;
      localStorage.removeItem(UK);
      localStorage.removeItem(TK);
      refreshAuth();
      return;
    }
    addMsg('system', 'Use platform sign-in to set heady_auth_token. Buddy will auto-bind once token exists.');
  };

  panel.querySelector('#hb-close').onclick = () => panel.classList.remove('open');
  fab.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) input.focus(); };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  async function send() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    const safeText = text.replace(/[<>]/g, '');
    const token = localStorage.getItem(TK) || '';
    const device = ensureDevice();
    const workspaceId = `vw:${location.hostname}:${(token || 'anon').slice(0, 16)}:${device.slice(0, 16)}`;

    addMsg('user', safeText);
    chatHistory = loadHistory();
    chatHistory.push({ role: 'user', content: safeText, ts: Date.now() });
    saveHistory(chatHistory);
    sendBtn.disabled = true;

    try {
      const res = await fetch(`${API}/api/brain/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Heady-Device': device,
          'X-Heady-Workspace': workspaceId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: safeText,
          history: chatHistory.slice(-8),
          context: { site: location.hostname, workspaceId, channel: 'buddy-chat', vector3d: true },
        }),
      });
      const data = await res.json();
      const confirmed = Boolean(data.confirmed || data.done || data.status === 'done' || data.status === 'completed' || data?.confirmation?.done);
      const reply = (data.response || data.reply || data.message || 'Request accepted by Heady.') + (confirmed ? '' : ' (awaiting final confirmation)');
      addMsg('bot', reply);
      chatHistory.push({ role: 'assistant', content: reply, confirmed, ts: Date.now() });
      saveHistory(chatHistory);
    } catch {
      addMsg('bot', 'Connection interrupted. Request retained in your workspace history.');
    }
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.onclick = send;
  refreshAuth();
})();
