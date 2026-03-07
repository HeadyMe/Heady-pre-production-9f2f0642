/**
 * Heady Projection Monitor — App Component
 *
 * Deployment projection monitoring: target health, pipeline visualizer,
 * domain mapping table, sync mode, staleness budgets.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/projection-monitor/App
 */

'use strict';

import './styles.css';

// ── Data ──────────────────────────────────────────────────────────────────────

const PROJECTION_TARGETS = [
  {
    name: 'Cloud Run',
    status: 'healthy',
    endpoint: 'https://heady-api-xyz-uc.a.run.app',
    stalenessBudget: '60s',
    lastSync: '3s ago',
    syncMode: 'event-driven',
    version: 'v3.1.0-prod',
  },
  {
    name: 'Cloudflare Pages',
    status: 'healthy',
    endpoint: 'https://headyme.com',
    stalenessBudget: '300s',
    lastSync: '12s ago',
    syncMode: 'event-driven',
    version: 'v3.1.0-edge',
  },
  {
    name: 'HuggingFace Spaces',
    status: 'stale',
    endpoint: 'https://huggingface.co/spaces/headyme/vector',
    stalenessBudget: '120s',
    lastSync: '4m 22s ago',
    syncMode: 'manual',
    version: 'v3.0.9-hf',
  },
  {
    name: 'GitHub Monorepo',
    status: 'syncing',
    endpoint: 'github.com/HeadyMe/Heady-pre-production-9f2f0642',
    stalenessBudget: '∞',
    lastSync: 'in progress',
    syncMode: 'event-driven',
    version: 'HEAD',
  },
];

const PIPELINE_PHASES = [
  { num: '1', name: 'Source Change Detected',     status: 'done',    label: 'DONE' },
  { num: '2', name: 'Policy Gate Evaluation',      status: 'done',    label: 'DONE' },
  { num: '3', name: 'Build & Bundle',              status: 'done',    label: 'DONE' },
  { num: '4', name: 'Projection Sync',             status: 'active',  label: 'ACTIVE' },
  { num: '5', name: 'Health Check & Verification', status: 'pending', label: 'PENDING' },
];

const DOMAIN_MAP = [
  { domain: 'headyme.com',                target: 'Cloudflare Pages',  health: 'ok',   ui: 'antigravity' },
  { domain: 'headysystems.com',           target: 'Cloudflare Pages',  health: 'ok',   ui: 'landing' },
  { domain: 'headymcp.com',               target: 'Cloud Run',         health: 'ok',   ui: 'governance-panel' },
  { domain: 'headyconnection.org',        target: 'HuggingFace',       health: 'warn', ui: 'vector-explorer' },
  { domain: 'app.headyme.com',            target: 'Cloud Run',         health: 'ok',   ui: 'swarm-dashboard' },
  { domain: 'ide.headysystems.com',       target: 'Cloud Run',         health: 'ok',   ui: 'heady-ide' },
  { domain: 'deploy.headyme.com',         target: 'Cloud Run',         health: 'ok',   ui: 'projection-monitor' },
];

// ── Builders ──────────────────────────────────────────────────────────────────

function buildHeader() {
  const h = document.createElement('header');
  h.className = 'pm-header';
  h.innerHTML = `
    <div class="pm-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20.53 7.5V16.5L11 22L1.47 16.5V7.5L11 2Z"
          stroke="#00d4ff" stroke-width="1.2" fill="rgba(0,212,255,0.06)"/>
        <circle cx="11" cy="11" r="2.5" fill="#00d4ff" opacity="0.9"/>
      </svg>
      Projection Monitor
    </div>
    <span class="pm-badge">EVENT-DRIVEN</span>
    <div class="pm-spacer"></div>
    <span class="pm-clock" id="pm-clock"></span>
  `;
  return h;
}

function buildTargetsPanel() {
  const panel = document.createElement('div');
  panel.className = 'pm-panel';

  const title = document.createElement('div');
  title.className = 'pm-panel-title';
  title.textContent = 'Projection Targets';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'pm-targets-list';

  PROJECTION_TARGETS.forEach((t) => {
    const card = document.createElement('div');
    card.className = `pm-target-card ${t.status}`;
    card.innerHTML = `
      <div class="pm-target-header">
        <div class="pm-target-name">${t.name}</div>
        <div class="pm-target-status ${t.status}">${t.status}</div>
      </div>
      <div class="pm-target-rows">
        <div class="pm-target-row">
          <span class="pm-target-key">Endpoint</span>
          <span class="pm-target-val">${t.endpoint}</span>
        </div>
        <div class="pm-target-row">
          <span class="pm-target-key">Staleness Budget</span>
          <span class="pm-target-val">${t.stalenessBudget}</span>
        </div>
        <div class="pm-target-row">
          <span class="pm-target-key">Last Sync</span>
          <span class="pm-target-val">${t.lastSync}</span>
        </div>
        <div class="pm-target-row">
          <span class="pm-target-key">Sync Mode</span>
          <span class="pm-target-val">${t.syncMode}</span>
        </div>
        <div class="pm-target-row">
          <span class="pm-target-key">Version</span>
          <span class="pm-target-val">${t.version}</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  panel.appendChild(list);
  return panel;
}

function buildPipelinePanel() {
  const panel = document.createElement('div');
  panel.className = 'pm-panel';

  const title = document.createElement('div');
  title.className = 'pm-panel-title';
  title.textContent = 'Projection Pipeline — Autonomous';
  panel.appendChild(title);

  const pipeline = document.createElement('div');
  pipeline.className = 'pm-pipeline';

  PIPELINE_PHASES.forEach(({ num, name, status, label }, i) => {
    const phase = document.createElement('div');
    phase.className = 'pm-phase';
    phase.innerHTML = `
      <div class="pm-phase-num">${num}</div>
      <div class="pm-phase-name">${name}</div>
      <div class="pm-phase-status ${status}">${label}</div>
    `;
    if (i < PIPELINE_PHASES.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'pm-phase-arrow';
      arrow.textContent = '↓';
      phase.appendChild(arrow);
    }
    pipeline.appendChild(phase);
  });

  panel.appendChild(pipeline);
  return panel;
}

function buildDomainMapPanel() {
  const panel = document.createElement('div');
  panel.className = 'pm-panel';

  const title = document.createElement('div');
  title.className = 'pm-panel-title';
  title.textContent = 'Domain → Projection Mapping';
  panel.appendChild(title);

  const table = document.createElement('table');
  table.className = 'pm-domain-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Domain</th>
        <th>Target</th>
        <th>UI</th>
        <th>Health</th>
      </tr>
    </thead>
    <tbody>
      ${DOMAIN_MAP.map(({ domain, target, health, ui }) => `
        <tr>
          <td class="pm-domain-name">${domain}</td>
          <td class="pm-domain-target">${target}</td>
          <td style="font-family:var(--font-mono);font-size:10px;color:var(--pm-muted)">${ui}</td>
          <td><span class="pm-health-dot ${health}"></span></td>
        </tr>
      `).join('')}
    </tbody>
  `;
  panel.appendChild(table);
  return panel;
}

function buildSyncStatusPanel() {
  const panel = document.createElement('div');
  panel.className = 'pm-panel';

  const title = document.createElement('div');
  title.className = 'pm-panel-title';
  title.textContent = 'Sync Configuration';
  panel.appendChild(title);

  const items = [
    { key: 'Primary Sync Mode',   val: 'Event-Driven (Webhook)' },
    { key: 'Fallback Mode',       val: 'Polling (60s interval)' },
    { key: 'Retry Policy',        val: 'Exponential backoff · 3x' },
    { key: 'Max Staleness',       val: '300s (platform default)' },
    { key: 'Conflict Resolution', val: 'Last-write-wins + audit' },
    { key: 'Active Syncs',        val: '1 in progress' },
    { key: 'Sync Queue Depth',    val: '3 pending' },
    { key: 'Last Full Sync',      val: new Date(Date.now() - 300000).toISOString().slice(0, 19) + 'Z' },
  ];

  const rows = document.createElement('div');
  rows.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  items.forEach(({ key, val }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--pm-surface2);border:1px solid var(--pm-border);border-radius:5px;font-size:11px;';
    row.innerHTML = `
      <span style="color:var(--pm-muted)">${key}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--pm-text)">${val}</span>
    `;
    rows.appendChild(row);
  });
  panel.appendChild(rows);
  return panel;
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp() {
  const root = document.createElement('div');
  root.className = 'pm-root';

  root.appendChild(buildHeader());

  const main = document.createElement('div');
  main.className = 'pm-main';

  const top = document.createElement('div');
  top.className = 'pm-top';
  top.appendChild(buildTargetsPanel());
  top.appendChild(buildPipelinePanel());

  const bottom = document.createElement('div');
  bottom.className = 'pm-bottom';
  bottom.appendChild(buildDomainMapPanel());
  bottom.appendChild(buildSyncStatusPanel());

  main.appendChild(top);
  main.appendChild(bottom);
  root.appendChild(main);

  const clockEl = root.querySelector('#pm-clock');
  const update = () => { if (clockEl) clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
  update();
  const interval = setInterval(update, 1000);

  return {
    element: root,
    destroy() { clearInterval(interval); root.remove(); },
  };
}

export default createApp;
export { createApp };
