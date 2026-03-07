const state = { token: null };

const byId = (id) => document.getElementById(id);
const sessionEl = byId('session');
const saveResultEl = byId('save-result');
const searchResultEl = byId('search-result');
const mcpResultEl = byId('mcp-result');

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function call(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    },
    ...options
  });
  return response.json();
}

function setSession(payload) {
  state.token = payload.token;
  sessionEl.textContent = JSON.stringify(payload, null, 2);
}

byId('register').onclick = async () => {
  const payload = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: byId('email').value,
      password: byId('password').value,
      name: byId('name').value
    })
  });
  setSession(payload);
};

byId('login').onclick = async () => {
  const payload = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: byId('email').value,
      password: byId('password').value
    })
  });
  setSession(payload);
};

byId('save-memory').onclick = async () => {
  const payload = await call('/api/memory/upsert', {
    method: 'POST',
    body: JSON.stringify({
      namespace: byId('namespace').value,
      content: byId('content').value,
      metadata: { source: 'browser-console' }
    })
  });
  saveResultEl.textContent = JSON.stringify(payload, null, 2);
};

byId('search-memory').onclick = async () => {
  const payload = await call('/api/memory/search', {
    method: 'POST',
    body: JSON.stringify({
      namespace: byId('namespace').value,
      query: byId('query').value,
      limit: 5
    })
  });
  searchResultEl.textContent = JSON.stringify(payload, null, 2);
};

byId('list-tools').onclick = async () => {
  const payload = await call('/mcp/rpc', {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  mcpResultEl.textContent = JSON.stringify(payload, null, 2);
};

byId('whoami').onclick = async () => {
  const payload = await call('/mcp/rpc', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'auth.me', arguments: {} }
    })
  });
  mcpResultEl.textContent = JSON.stringify(payload, null, 2);
};
