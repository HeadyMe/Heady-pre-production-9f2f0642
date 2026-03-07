/**
 * Heady IDE — App Component
 *
 * VS Code-inspired code editor with AI HeadyBuddy sidebar.
 * Dark theme, blue accents, syntax highlighting, file tree.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/heady-ide/App
 */

'use strict';

import './styles.css';

// ── File tree ─────────────────────────────────────────────────────────────────

const FILE_TREE = [
  { name: 'heady-web-portal', type: 'dir', open: true, depth: 0 },
  { name: 'src', type: 'dir', open: true, depth: 1 },
  { name: 'shell', type: 'dir', open: true, depth: 2 },
  { name: 'index.js', type: 'file', depth: 3, color: '#f9e2af', active: false },
  { name: 'load-dynamic-remote.js', type: 'file', depth: 3, color: '#f9e2af' },
  { name: 'index.html', type: 'file', depth: 3, color: '#f38ba8' },
  { name: 'services', type: 'dir', open: false, depth: 2 },
  { name: 'vector-federation.js', type: 'file', depth: 2, color: '#a6e3a1' },
  { name: 'bootstrap.js', type: 'file', depth: 2, color: '#f9e2af' },
  { name: 'remotes', type: 'dir', open: true, depth: 1 },
  { name: 'antigravity', type: 'dir', open: false, depth: 2 },
  { name: 'landing', type: 'dir', open: false, depth: 2 },
  { name: 'heady-ide', type: 'dir', open: true, depth: 2 },
  { name: 'App.js', type: 'file', depth: 3, color: '#f9e2af', active: true },
  { name: 'mount.js', type: 'file', depth: 3, color: '#f9e2af' },
  { name: 'styles.css', type: 'file', depth: 3, color: '#89dceb' },
  { name: 'scripts', type: 'dir', open: false, depth: 1 },
  { name: 'configs', type: 'dir', open: false, depth: 1 },
  { name: 'webpack.config.js', type: 'file', depth: 1, color: '#f9e2af' },
  { name: 'package.json', type: 'file', depth: 1, color: '#a6e3a1' },
];

// ── Sample code (heady-manager.js) ────────────────────────────────────────────

const CODE_LINES = [
  { t: 'cmt', v: '/**' },
  { t: 'cmt', v: ' * HeadyManager — Autonomous Agent Orchestrator' },
  { t: 'cmt', v: ' * © 2026 HeadySystems Inc.' },
  { t: 'cmt', v: ' */' },
  { t: '', v: '' },
  { t: 'kw', v: "'use strict';" },
  { t: '', v: '' },
  { t: '', v: [{ t: 'kw', v: 'const' }, { t: '', v: ' {' }, { t: 'prop', v: ' VectorFederation' }, { t: '', v: ' } = ' }, { t: 'kw', v: 'require' }, { t: '', v: "(" }, { t: 'str', v: "'./vector-federation'" }, { t: '', v: ');' }] },
  { t: '', v: [{ t: 'kw', v: 'const' }, { t: '', v: ' {' }, { t: 'prop', v: ' resolveDomain' }, { t: '', v: ' } = ' }, { t: 'kw', v: 'require' }, { t: '', v: "(" }, { t: 'str', v: "'./services/domain-router'" }, { t: '', v: ');' }] },
  { t: '', v: '' },
  { t: '', v: [{ t: 'kw', v: 'const' }, { t: '', v: ' AGENTS = [' }, { t: 'str', v: "'HeadyBuddy'" }, { t: '', v: ', ' }, { t: 'str', v: "'HeadyCoder'" }, { t: '', v: ', ' }, { t: 'str', v: "'HeadyRisks'" }, { t: '', v: '];' }] },
  { t: '', v: '' },
  { t: 'cmt', v: '/** @param {string} agentId */' },
  { t: '', v: [{ t: 'kw', v: 'async function' }, { t: '', v: ' ' }, { t: 'fn', v: 'bootAgent' }, { t: '', v: '(' }, { t: 'prop', v: 'agentId' }, { t: '', v: ') {' }] },
  { t: '', v: [{ t: '', v: '  ' }, { t: 'kw', v: 'const' }, { t: '', v: ' domain = ' }, { t: 'fn', v: 'resolveDomain' }, { t: '', v: '(window.location.hostname);' }] },
  { t: '', v: [{ t: '', v: '  ' }, { t: 'kw', v: 'if' }, { t: '', v: ' (!domain) ' }, { t: 'kw', v: 'throw new' }, { t: '', v: ' ' }, { t: 'cls', v: 'Error' }, { t: '', v: "(" }, { t: 'str', v: '`Unknown domain: ${window.location.hostname}`' }, { t: '', v: ');' }] },
  { t: '', v: '' },
  { t: '', v: [{ t: '', v: '  ' }, { t: 'kw', v: 'const' }, { t: '', v: ' fed = ' }, { t: 'kw', v: 'new' }, { t: '', v: ' ' }, { t: 'cls', v: 'VectorFederation' }, { t: '', v: '({ nodeId: agentId, dimensions: ' }, { t: 'num', v: '384' }, { t: '', v: ' });' }] },
  { t: '', v: [{ t: '', v: '  await fed.' }, { t: 'fn', v: 'upsert' }, { t: '', v: '({' }] },
  { t: '', v: [{ t: '', v: '    ' }, { t: 'prop', v: 'id' }, { t: '', v: ': agentId,' }] },
  { t: '', v: [{ t: '', v: '    ' }, { t: 'prop', v: 'embedding' }, { t: '', v: ': ' }, { t: 'cls', v: 'Array' }, { t: '', v: '.from({ length: ' }, { t: 'num', v: '384' }, { t: '', v: ' }, () =>' }] },
  { t: '', v: [{ t: '', v: '      ' }, { t: 'cls', v: 'Math' }, { t: '', v: '.random() * ' }, { t: 'num', v: '2' }, { t: '', v: ' - ' }, { t: 'num', v: '1' }, { t: '', v: '),' }] },
  { t: '', v: [{ t: '', v: '    ' }, { t: 'prop', v: 'text' }, { t: '', v: ': `agent:${agentId}`,' }] },
  { t: '', v: [{ t: '', v: '    ' }, { t: 'prop', v: 'metadata' }, { t: '', v: ': { domain: domain.' }, { t: 'prop', v: 'uiId' }, { t: '', v: ' },' }] },
  { t: '', v: [{ t: '', v: '  });' }] },
  { t: '', v: '' },
  { t: '', v: [{ t: '', v: '  ' }, { t: 'kw', v: 'return' }, { t: '', v: ' fed;' }] },
  { t: '', v: [{ t: '', v: '}' }] },
  { t: '', v: '' },
  { t: '', v: [{ t: 'kw', v: 'module' }, { t: '', v: '.exports = { ' }, { t: 'fn', v: 'bootAgent' }, { t: '', v: ', AGENTS };' }] },
];

const TERMINAL_LINES = [
  { cl: 'prompt', v: '~/heady-web-portal $  npm run build:remotes' },
  { cl: 'info',   v: '> webpack --env remote --env appName=antigravity' },
  { cl: 'ok',     v: '✓ asset remoteEntry.js [emitted] 28.4 KiB' },
  { cl: 'ok',     v: '✓ asset main.abc12.js [emitted] 142 KiB' },
  { cl: 'info',   v: '> webpack --env remote --env appName=landing' },
  { cl: 'ok',     v: '✓ asset remoteEntry.js [emitted] 24.1 KiB' },
  { cl: 'info',   v: '> webpack --env remote --env appName=heady-ide' },
  { cl: 'ok',     v: '✓ asset remoteEntry.js [emitted] 19.8 KiB' },
  { cl: 'ok',     v: '' },
  { cl: 'ok',     v: '7 remotes built successfully in 8.4s' },
  { cl: 'prompt', v: '~/heady-web-portal $  _' },
];

const BUDDY_MESSAGES = [
  { type: 'buddy', text: 'Hey! I\'m HeadyBuddy. I can help you write, debug, and understand Heady code. What are you working on?' },
  { type: 'user',  text: 'Explain the VectorFederation upsert method' },
  { type: 'buddy', text: 'The `upsert()` method adds or updates a vector entry in the federation store. It validates that the embedding has exactly 384 dimensions, then saves it with a timestamp. After saving locally, it fires-and-forgets a `_replicateToPeers()` call to push the entry to up to `replicationFactor` active peer nodes via HTTP POST.' },
];

// ── Builders ──────────────────────────────────────────────────────────────────

function renderTokenLine(line) {
  if (typeof line === 'string') return document.createTextNode(line);
  if (Array.isArray(line)) {
    const span = document.createElement('span');
    line.forEach((tok) => {
      if (tok.t && tok.t !== '') {
        const s = document.createElement('span');
        s.className = `s-${tok.t}`;
        s.textContent = tok.v;
        span.appendChild(s);
      } else {
        span.appendChild(document.createTextNode(tok.v));
      }
    });
    return span;
  }
  const span = document.createElement('span');
  if (line.t) span.className = `s-${line.t}`;
  span.textContent = line.v;
  return span;
}

function buildEditor() {
  const pane = document.createElement('div');
  pane.className = 'ide-editor-pane';

  const content = document.createElement('div');
  content.className = 'ide-editor-content';

  const code = document.createElement('div');
  code.className = 'ide-code-block';

  const lineNums = document.createElement('div');
  lineNums.className = 'ide-line-nums';

  const codeLines = document.createElement('div');
  codeLines.className = 'ide-code-lines';

  CODE_LINES.forEach((line, i) => {
    const numDiv = document.createElement('div');
    numDiv.textContent = String(i + 1);
    lineNums.appendChild(numDiv);

    const lineDiv = document.createElement('div');
    if (typeof line.v === 'string' && line.t) {
      const sp = document.createElement('span');
      sp.className = `s-${line.t}`;
      sp.textContent = line.v;
      lineDiv.appendChild(sp);
    } else if (Array.isArray(line.v)) {
      line.v.forEach((tok) => {
        const sp = document.createElement('span');
        if (tok.t) sp.className = `s-${tok.t}`;
        sp.textContent = tok.v;
        lineDiv.appendChild(sp);
      });
    } else {
      lineDiv.textContent = typeof line.v === 'string' ? line.v : '';
    }
    codeLines.appendChild(lineDiv);
  });

  code.appendChild(lineNums);
  code.appendChild(codeLines);
  content.appendChild(code);
  pane.appendChild(content);

  // Bottom panel
  const bottomPanel = document.createElement('div');
  bottomPanel.className = 'ide-bottom-panel';

  const panelTabs = document.createElement('div');
  panelTabs.className = 'ide-panel-tabs';
  ['Terminal', 'Problems', 'Output'].forEach((name, i) => {
    const tab = document.createElement('div');
    tab.className = `ide-panel-tab ${i === 0 ? 'active' : ''}`;
    tab.textContent = name;
    panelTabs.appendChild(tab);
  });
  bottomPanel.appendChild(panelTabs);

  const panelContent = document.createElement('div');
  panelContent.className = 'ide-panel-content';
  TERMINAL_LINES.forEach(({ cl, v }) => {
    const line = document.createElement('div');
    line.className = cl || '';
    line.textContent = v;
    panelContent.appendChild(line);
  });
  bottomPanel.appendChild(panelContent);
  pane.appendChild(bottomPanel);

  return pane;
}

function buildFileExplorer() {
  const explorer = document.createElement('div');
  explorer.className = 'ide-explorer';

  const header = document.createElement('div');
  header.className = 'ide-explorer-header';
  header.textContent = 'Explorer';
  explorer.appendChild(header);

  FILE_TREE.forEach(({ name, type, open, depth, color, active }) => {
    const item = document.createElement('div');
    const indent = depth * 14;
    item.className = `ide-tree-item${type === 'dir' ? ' folder' : ''}${active ? ' active' : ''} ${type === 'dir' ? (open ? 'dir-open' : 'dir-closed') : ''}`;
    item.style.paddingLeft = `${8 + indent}px`;

    const icon = document.createElement('span');
    if (type === 'dir') {
      icon.textContent = open ? '📂' : '📁';
    } else {
      icon.textContent = '📄';
    }
    icon.style.fontSize = '12px';

    const label = document.createElement('span');
    label.textContent = name;
    if (color && type === 'file') label.style.color = color;

    item.appendChild(icon);
    item.appendChild(label);
    explorer.appendChild(item);
  });

  return explorer;
}

function buildBuddySidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'ide-buddy-sidebar';

  const header = document.createElement('div');
  header.className = 'ide-buddy-header';
  header.innerHTML = `
    <div class="ide-buddy-avatar">⬡</div>
    <div>
      <div class="ide-buddy-name">HeadyBuddy</div>
      <div class="ide-buddy-status">● READY · GPT-4o</div>
    </div>
  `;
  sidebar.appendChild(header);

  const messages = document.createElement('div');
  messages.className = 'ide-buddy-messages';
  BUDDY_MESSAGES.forEach(({ type, text }) => {
    const msg = document.createElement('div');
    msg.className = `ide-msg ${type}`;
    msg.textContent = text;
    messages.appendChild(msg);
  });
  sidebar.appendChild(messages);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'ide-buddy-input-wrap';
  inputWrap.innerHTML = `
    <input class="ide-buddy-input" placeholder="Ask HeadyBuddy…" type="text"/>
    <button class="ide-buddy-send">Send</button>
  `;
  sidebar.appendChild(inputWrap);

  return sidebar;
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp() {
  const root = document.createElement('div');
  root.className = 'ide-root';

  // Title bar
  const titlebar = document.createElement('div');
  titlebar.className = 'ide-titlebar';
  titlebar.innerHTML = `
    <div class="ide-window-controls">
      <div class="ide-wc red"></div>
      <div class="ide-wc yellow"></div>
      <div class="ide-wc green"></div>
    </div>
    <span class="ide-titlebar-text">heady-manager.js — heady-web-portal</span>
  `;
  root.appendChild(titlebar);

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'ide-toolbar';
  const tabs = document.createElement('div');
  tabs.className = 'ide-tabs';
  const tabData = [
    { name: 'heady-manager.js', color: '#f9e2af', active: true },
    { name: 'vector-federation.js', color: '#a6e3a1', active: false },
    { name: 'load-dynamic-remote.js', color: '#f9e2af', active: false },
  ];
  tabData.forEach(({ name, color, active }) => {
    const tab = document.createElement('div');
    tab.className = `ide-tab ${active ? 'active' : ''}`;
    tab.innerHTML = `
      <div class="ide-tab-dot" style="background:${color}"></div>
      <span>${name}</span>
      <span class="ide-tab-close">×</span>
    `;
    tabs.appendChild(tab);
  });
  toolbar.appendChild(tabs);

  const actions = document.createElement('div');
  actions.className = 'ide-toolbar-actions';
  actions.innerHTML = `
    <button class="ide-action-btn run">▶ Run</button>
    <button class="ide-action-btn debug">⬡ Debug</button>
  `;
  toolbar.appendChild(actions);
  root.appendChild(toolbar);

  // Main area
  const main = document.createElement('div');
  main.className = 'ide-main';

  const activityBar = document.createElement('div');
  activityBar.className = 'ide-activity-bar';
  ['📁', '🔍', '🔀', '🐛', '⬡'].forEach((icon, i) => {
    const btn = document.createElement('button');
    btn.className = `ide-ab-btn ${i === 0 ? 'active' : ''}`;
    btn.textContent = icon;
    btn.setAttribute('aria-label', ['Explorer', 'Search', 'Git', 'Debug', 'Heady'][i]);
    activityBar.appendChild(btn);
  });

  main.appendChild(activityBar);
  main.appendChild(buildFileExplorer());
  main.appendChild(buildEditor());
  main.appendChild(buildBuddySidebar());
  root.appendChild(main);

  // Status bar
  const statusbar = document.createElement('div');
  statusbar.className = 'ide-statusbar';
  [
    '⬡ main',
    '⬡ heady-ide',
    'JavaScript',
    'UTF-8',
    'LF',
    'v3.1.0',
    'HeadyBuddy ✓',
  ].forEach((text) => {
    const item = document.createElement('div');
    item.className = 'ide-sb-item';
    item.textContent = text;
    statusbar.appendChild(item);
  });
  root.appendChild(statusbar);

  return {
    element: root,
    destroy() { root.remove(); },
  };
}

export default createApp;
export { createApp };
