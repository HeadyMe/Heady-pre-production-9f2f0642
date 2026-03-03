/**
 * HeadyBuddy Universal Widget v2.0
 * Drop-in overlay for ALL Heady sites — auth, chat, vector memory
 * Include via: <script src="/buddy-widget.js"></script>
 */
(function () {
  'use strict';
  const API = (window.HEADY_CONFIG && window.HEADY_CONFIG.apiUrl) || window.HEADY_API || 'https://api.headysystems.com';
  const BRAND = { primary: '#7c3aed', accent: '#06b6d4', bg: '#0a0a1a', surface: '#1a1a2e', text: '#e0e0ff', dim: '#6b7280' };

  // ─── State ───
  let user = null, chatHistory = [], isOpen = false, isMinimized = true;

  // ─── Styles ───
  const css = document.createElement('style');
  css.textContent = `
    #heady-buddy-fab{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;
      background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border:none;cursor:pointer;
      box-shadow:0 4px 24px rgba(124,58,237,.4);z-index:99999;transition:all .3s;display:flex;align-items:center;justify-content:center;font-size:24px}
    #heady-buddy-fab:hover{transform:scale(1.1);box-shadow:0 6px 32px rgba(124,58,237,.6)}
    #heady-buddy-panel{position:fixed;bottom:96px;right:24px;width:380px;height:520px;background:${BRAND.bg};
      border:1px solid rgba(124,58,237,.3);border-radius:16px;z-index:99998;display:none;flex-direction:column;
      box-shadow:0 8px 48px rgba(0,0,0,.6);font-family:system-ui,-apple-system,sans-serif;overflow:hidden;backdrop-filter:blur(20px)}
    #heady-buddy-panel.open{display:flex}
    .hb-header{padding:14px 16px;background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,182,212,.1));
      border-bottom:1px solid rgba(124,58,237,.2);display:flex;align-items:center;justify-content:space-between}
    .hb-header h3{margin:0;color:${BRAND.text};font-size:15px;font-weight:600;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});
      -webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hb-header button{background:none;border:none;color:${BRAND.dim};cursor:pointer;font-size:18px;padding:4px 8px}
    .hb-header button:hover{color:${BRAND.text}}
    .hb-auth{padding:16px;text-align:center;border-bottom:1px solid rgba(124,58,237,.15)}
    .hb-auth-btn{background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});color:#fff;border:none;
      padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all .2s}
    .hb-auth-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(124,58,237,.4)}
    .hb-user{color:${BRAND.accent};font-size:12px;margin-top:4px}
    .hb-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
    .hb-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word}
    .hb-msg.user{align-self:flex-end;background:linear-gradient(135deg,${BRAND.primary},#6d28d9);color:#fff;border-bottom-right-radius:4px}
    .hb-msg.bot{align-self:flex-start;background:${BRAND.surface};color:${BRAND.text};border:1px solid rgba(124,58,237,.15);border-bottom-left-radius:4px}
    .hb-msg.system{align-self:center;background:transparent;color:${BRAND.dim};font-size:11px;font-style:italic}
    .hb-input-row{padding:12px;border-top:1px solid rgba(124,58,237,.2);display:flex;gap:8px;background:rgba(10,10,26,.8)}
    .hb-input{flex:1;background:${BRAND.surface};border:1px solid rgba(124,58,237,.2);border-radius:10px;
      padding:10px 14px;color:${BRAND.text};font-size:13px;outline:none;resize:none;font-family:inherit}
    .hb-input:focus{border-color:${BRAND.primary}}
    .hb-send{background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border:none;border-radius:10px;
      padding:10px 16px;color:#fff;cursor:pointer;font-size:14px;transition:all .2s}
    .hb-send:hover{transform:scale(1.05)}
    .hb-send:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .hb-typing{color:${BRAND.dim};font-size:12px;padding:4px 14px;animation:hb-pulse 1.5s infinite}
    @keyframes hb-pulse{0%,100%{opacity:.4}50%{opacity:1}}
  `;
  document.head.appendChild(css);

  // ─── DOM ───
  const fab = document.createElement('button');
  fab.id = 'heady-buddy-fab';
  fab.innerHTML = '🧠';
  fab.title = 'HeadyBuddy';
  fab.onclick = () => togglePanel();

  const panel = document.createElement('div');
  panel.id = 'heady-buddy-panel';
  panel.innerHTML = `
    <div class="hb-header">
      <h3>🧠 HeadyBuddy</h3>
      <div>
        <button onclick="document.getElementById('heady-buddy-panel').classList.remove('open')" title="Close">✕</button>
      </div>
    </div>
    <div class="hb-auth" id="hb-auth-section">
      <button class="hb-auth-btn" id="hb-auth-btn">Sign In with Google</button>
      <div class="hb-user" id="hb-user-info"></div>
    </div>
    <div class="hb-messages" id="hb-messages">
      <div class="hb-msg system">Welcome! Ask me anything about Heady.</div>
    </div>
    <div class="hb-input-row">
      <input class="hb-input" id="hb-input" placeholder="Ask HeadyBuddy..." />
      <button class="hb-send" id="hb-send" onclick="window._hbSend()">▶</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // ─── Auth ───
  const authBtn = document.getElementById('hb-auth-btn');
  const userInfo = document.getElementById('hb-user-info');
  const authSection = document.getElementById('hb-auth-section');

  // Check for stored auth
  const stored = localStorage.getItem('heady_user');
  if (stored) { try { user = JSON.parse(stored); showUser(); } catch { } }

  authBtn.onclick = async () => {
    // Simple email-based auth for now (Firebase can be layered on later)
    const email = prompt('Enter your email to sign in:');
    if (!email) return;
    user = { email, id: btoa(email).replace(/=/g, ''), name: email.split('@')[0], ts: Date.now() };
    localStorage.setItem('heady_user', JSON.stringify(user));
    showUser();
    addMsg('system', `Signed in as ${user.name}. Your conversations are now saved.`);
  };

  function showUser() {
    if (!user) return;
    authBtn.textContent = 'Sign Out';
    userInfo.textContent = user.email;
    authBtn.onclick = () => { user = null; localStorage.removeItem('heady_user'); authBtn.textContent = 'Sign In with Google'; userInfo.textContent = ''; };
  }

  // ─── Chat ───
  const msgBox = document.getElementById('hb-messages');
  const input = document.getElementById('hb-input');
  const sendBtn = document.getElementById('hb-send');

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window._hbSend(); } });

  function addMsg(type, text) {
    const div = document.createElement('div');
    div.className = `hb-msg ${type}`;
    div.textContent = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
    return div;
  }

  window._hbSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    addMsg('user', text);
    chatHistory.push({ role: 'user', content: text });

    const typing = document.createElement('div');
    typing.className = 'hb-typing';
    typing.textContent = 'HeadyBuddy is thinking...';
    msgBox.appendChild(typing);
    msgBox.scrollTop = msgBox.scrollHeight;

    // ── Helper: extract AI text from any response shape ──
    function extractReply(data) {
      if (!data || typeof data !== 'object') return null;
      // Standard Heady brain response
      if (data.response && typeof data.response === 'string' && data.response.length > 5) return data.response;
      // Alternative field names
      if (data.reply && typeof data.reply === 'string') return data.reply;
      if (data.text && typeof data.text === 'string') return data.text;
      // OpenAI-compatible format
      if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
      if (data.choices && data.choices[0]?.text) return data.choices[0].text;
      // HuggingFace format
      if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
      // Nested content (Anthropic)
      if (data.content && Array.isArray(data.content) && data.content[0]?.text) return data.content[0].text;
      // Gemini format
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
      // message field (only if it looks like actual content, not metadata)
      if (data.message && typeof data.message === 'string' && data.message.length > 10 && !data.endpoint) return data.message;
      return null;
    }

    // ── Helper: detect metadata-only response from edge proxy ──
    function isMetadataOnly(data) {
      if (!data || typeof data !== 'object') return false;
      return (data.endpoint || data.routed || data.cache || data.responseTime) && !extractReply(data);
    }

    // ── Primary: HeadyBrain API ──
    let replied = false;
    try {
      const res = await fetch(`${API}/api/brain/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, user: user?.id, history: chatHistory.slice(-6) }),
      });
      const data = await res.json();

      if (!isMetadataOnly(data)) {
        const reply = extractReply(data);
        if (reply) {
          typing.remove();
          addMsg('bot', reply);
          chatHistory.push({ role: 'assistant', content: reply });
          replied = true;

          // Store to vector memory if authenticated
          if (user) {
            fetch(`${API}/api/vector/store`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `Chat: Q: ${text} A: ${reply}`, metadata: { type: 'chat', user: user.id, source: window.location.hostname } }),
            }).catch(() => { });
          }
        }
      }
    } catch (e) {
      // Primary failed, will try fallback
    }

    // ── Fallback: HuggingFace Inference API ──
    if (!replied) {
      typing.textContent = 'Routing to HeadyBrain fallback...';
      try {
        const hfRes = await fetch('https://router.huggingface.co/novita/v3/openai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'Qwen/Qwen3-4B',
            messages: [
              { role: 'system', content: 'You are HeadyBrain, the AI reasoning engine of the Heady ecosystem. You power HeadySystems, HeadyConnection, and HeadyMe. Be helpful, concise, and warm.' },
              ...chatHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
            ],
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });
        const hfData = await hfRes.json();
        const hfReply = extractReply(hfData);
        typing.remove();
        if (hfReply) {
          addMsg('bot', hfReply);
          chatHistory.push({ role: 'assistant', content: hfReply });
        } else {
          addMsg('bot', 'HeadyBrain is processing your request. The AI backbone is initializing — please try again in a moment.');
        }
      } catch (e) {
        typing.remove();
        addMsg('bot', 'HeadyBrain is currently offline. All providers are being retried. Please try again shortly.');
      }
    }

    sendBtn.disabled = false;
    input.focus();
  };

  function togglePanel() {
    const p = document.getElementById('heady-buddy-panel');
    p.classList.toggle('open');
    if (p.classList.contains('open')) input.focus();
  }
})();
