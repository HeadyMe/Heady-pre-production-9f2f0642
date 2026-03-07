/**
 * Heady Swarm Dashboard — App Component
 *
 * Real-time agent swarm monitoring dashboard.
 * Shows 6 agent cards, swarm topology graph, task queue, and live metrics.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/swarm-dashboard/App
 */

'use strict';

import './styles.css';

// ── Agent data ────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: 'agent-buddy-01',
    name: 'HeadyBuddy',
    status: 'active',
    task: 'Answering user query #8821',
    memory: 64,
    uptime: '14h 22m',
    model: 'GPT-4o',
    domain: 'headyme.com',
  },
  {
    id: 'agent-battle-01',
    name: 'HeadyBattle',
    status: 'active',
    task: 'Running eval: agent-perf-v2',
    memory: 78,
    uptime: '6h 05m',
    model: 'Claude-3.5-S',
    domain: 'headyme.com',
  },
  {
    id: 'agent-analyze-01',
    name: 'HeadyAnalyze',
    status: 'idle',
    task: 'Waiting for task assignment',
    memory: 21,
    uptime: '2h 41m',
    model: 'Gemini-1.5',
    domain: 'headysystems.com',
  },
  {
    id: 'agent-risks-01',
    name: 'HeadyRisks',
    status: 'active',
    task: 'Audit: governance-policy-v8',
    memory: 55,
    uptime: '9h 18m',
    model: 'GPT-4o',
    domain: 'headymcp.com',
  },
  {
    id: 'agent-patterns-01',
    name: 'HeadyPatterns',
    status: 'idle',
    task: 'Pattern extraction queued',
    memory: 33,
    uptime: '1h 02m',
    model: 'Gemini-1.5',
    domain: 'headyconnection.org',
  },
  {
    id: 'agent-coder-01',
    name: 'HeadyCoder',
    status: 'active',
    task: 'PR #412: vector-federation fix',
    memory: 88,
    uptime: '11h 34m',
    model: 'Claude-3.5-S',
    domain: 'headysystems.com',
  },
];

const TASKS = [
  { name: 'embed-batch-v4',          agent: 'HeadyBuddy',   color: '#22c55e', status: 'running' },
  { name: 'eval-swarm-topology',     agent: 'HeadyBattle',  color: '#22c55e', status: 'running' },
  { name: 'audit-mcp-tools',         agent: 'HeadyRisks',   color: '#fbbf24', status: 'queued' },
  { name: 'codegen-vector-fix',      agent: 'HeadyCoder',   color: '#22c55e', status: 'running' },
  { name: 'analyze-usage-trends',    agent: 'HeadyAnalyze', color: '#fbbf24', status: 'queued' },
  { name: 'pattern-extract-docs',    agent: 'HeadyPatterns', color: '#6b7280', status: 'pending' },
  { name: 'deploy-governance-v8',    agent: 'HeadyRisks',   color: '#6b7280', status: 'pending' },
];

// ── Topology SVG ──────────────────────────────────────────────────────────────

function buildTopologySVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 240 180');
  svg.classList.add('sw-topology-svg');

  const nodes = [
    { x: 120, y: 90, r: 8, main: true, label: 'CORE' },
    { x: 55,  y: 45, r: 5, label: 'BUDDY' },
    { x: 185, y: 45, r: 5, label: 'BATTLE' },
    { x: 30,  y: 120, r: 5, label: 'ANALYZE' },
    { x: 210, y: 120, r: 5, label: 'RISKS' },
    { x: 80,  y: 155, r: 4, label: 'PATTERNS' },
    { x: 160, y: 155, r: 4, label: 'CODER' },
    { x: 120, y: 20,  r: 3, label: 'VECTOR' },
  ];

  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[1,2],[3,5],[4,6]];

  edges.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', nodes[a].x);
    line.setAttribute('y1', nodes[a].y);
    line.setAttribute('x2', nodes[b].x);
    line.setAttribute('y2', nodes[b].y);
    line.setAttribute('stroke', 'rgba(245,166,35,0.2)');
    line.setAttribute('stroke-width', '0.8');
    svg.appendChild(line);
  });

  nodes.forEach((n) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x);
    circle.setAttribute('cy', n.y);
    circle.setAttribute('r', n.r);
    circle.setAttribute('fill', n.main ? '#F5A623' : 'rgba(245,166,35,0.35)');
    circle.setAttribute('stroke', '#F5A623');
    circle.setAttribute('stroke-width', '0.8');
    svg.appendChild(circle);

    if (n.label && n.r > 3) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', n.x);
      text.setAttribute('y', n.y + n.r + 9);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '7');
      text.setAttribute('fill', 'rgba(245,166,35,0.5)');
      text.setAttribute('font-family', 'JetBrains Mono, monospace');
      text.textContent = n.label;
      svg.appendChild(text);
    }
  });

  return svg;
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildTopbar() {
  const bar = document.createElement('div');
  bar.className = 'sw-topbar';
  bar.innerHTML = `
    <div class="sw-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20.53 7.5V16.5L11 22L1.47 16.5V7.5L11 2Z"
          stroke="#F5A623" stroke-width="1.2" fill="rgba(245,166,35,0.08)"/>
        <circle cx="11" cy="11" r="2.5" fill="#F5A623" opacity="0.9"/>
      </svg>
      Swarm Dashboard
    </div>
    <span class="sw-badge live">● LIVE</span>
    <span class="sw-badge ok">SWARM HEALTHY</span>
    <div class="sw-spacer"></div>
    <span class="sw-clock" id="sw-clock"></span>
  `;
  return bar;
}

function buildMetricsStrip() {
  const strip = document.createElement('div');
  strip.className = 'sw-metrics-strip';
  const metrics = [
    { val: '6', label: 'Total Agents',    color: 'gold',  delta: '+0 today', dir: 'up' },
    { val: '4', label: 'Active Now',      color: 'green', delta: '+1 since 6h', dir: 'up' },
    { val: '2,841', label: 'Tasks Done',  color: 'blue',  delta: '+12 today', dir: 'up' },
    { val: '0.3%', label: 'Error Rate',   color: 'red',   delta: '-0.1% vs avg', dir: 'up' },
    { val: '43+', label: 'MCP Tools',     color: 'gold',  delta: 'all healthy', dir: 'up' },
  ];
  metrics.forEach(({ val, label, color, delta, dir }) => {
    const m = document.createElement('div');
    m.className = 'sw-metric';
    m.innerHTML = `
      <div class="sw-metric-val ${color}">${val}</div>
      <div class="sw-metric-label">${label}</div>
      <div class="sw-metric-delta ${dir}">${delta}</div>
    `;
    strip.appendChild(m);
  });
  return strip;
}

function buildAgentCard(agent) {
  const card = document.createElement('div');
  card.className = `sw-agent-card ${agent.status}`;

  const memPct = agent.memory;
  card.innerHTML = `
    <div class="sw-card-header">
      <div class="sw-agent-name">${agent.name}</div>
      <div class="sw-status-pill ${agent.status}">${agent.status}</div>
    </div>
    <div class="sw-card-rows">
      <div class="sw-card-row">
        <span class="sw-card-key">Task</span>
        <span class="sw-card-val">${agent.task}</span>
      </div>
      <div class="sw-card-row">
        <span class="sw-card-key">Model</span>
        <span class="sw-card-val">${agent.model}</span>
      </div>
      <div class="sw-card-row">
        <span class="sw-card-key">Domain</span>
        <span class="sw-card-val">${agent.domain}</span>
      </div>
      <div class="sw-card-row">
        <span class="sw-card-key">Uptime</span>
        <span class="sw-card-val">${agent.uptime}</span>
      </div>
    </div>
    <div style="font-family:var(--font-mono);font-size:9px;color:var(--sw-muted);margin-top:8px;display:flex;justify-content:space-between;">
      <span>MEM</span><span>${memPct}%</span>
    </div>
    <div class="sw-mem-bar-wrap">
      <div class="sw-mem-bar" style="width:${memPct}%;background:${memPct > 75 ? '#ef4444' : '#F5A623'}"></div>
    </div>
  `;
  return card;
}

function buildRightPanel() {
  const panel = document.createElement('div');
  panel.className = 'sw-right-panel';

  // Topology
  const topoSection = document.createElement('div');
  topoSection.className = 'sw-panel-section';
  const topoTitle = document.createElement('div');
  topoTitle.className = 'sw-panel-title';
  topoTitle.textContent = 'Swarm Topology';
  topoSection.appendChild(topoTitle);
  topoSection.appendChild(buildTopologySVG());
  panel.appendChild(topoSection);

  // Task queue
  const queueTitle = document.createElement('div');
  queueTitle.className = 'sw-panel-section';
  const qtitle = document.createElement('div');
  qtitle.className = 'sw-panel-title';
  qtitle.textContent = 'Task Queue';
  queueTitle.appendChild(qtitle);
  panel.appendChild(queueTitle);

  const queue = document.createElement('div');
  queue.className = 'sw-task-queue';
  TASKS.forEach(({ name, agent, color }) => {
    const item = document.createElement('div');
    item.className = 'sw-task-item';
    item.innerHTML = `
      <div class="sw-task-dot" style="background:${color}"></div>
      <div class="sw-task-name">${name}</div>
      <div class="sw-task-agent">${agent}</div>
    `;
    queue.appendChild(item);
  });
  panel.appendChild(queue);

  return panel;
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp() {
  const root = document.createElement('div');
  root.className = 'sw-root';

  root.appendChild(buildTopbar());
  root.appendChild(buildMetricsStrip());

  const main = document.createElement('div');
  main.className = 'sw-main';

  const agentsSection = document.createElement('div');
  agentsSection.className = 'sw-agents-section';

  const title = document.createElement('div');
  title.className = 'sw-agents-section-title';
  title.textContent = `Agent Fleet — ${AGENTS.length} registered`;
  agentsSection.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'sw-cards-grid';
  AGENTS.forEach((agent) => grid.appendChild(buildAgentCard(agent)));
  agentsSection.appendChild(grid);

  main.appendChild(agentsSection);
  main.appendChild(buildRightPanel());
  root.appendChild(main);

  // Clock
  const clockEl = root.querySelector('#sw-clock');
  const updateClock = () => {
    if (clockEl) clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  return {
    element: root,
    destroy() { clearInterval(clockInterval); root.remove(); },
  };
}

export default createApp;
export { createApp };
