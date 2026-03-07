/**
 * HeadySystems — Marketing Landing Page
 *
 * Full landing page with nav, hero, pillars, capabilities, and footer.
 * Dark blue/cyan theme with animated hexagon logo.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/landing/App
 */

'use strict';

import './styles.css';

const PILLARS = [
  {
    key: 'github',
    icon: '⬡',
    name: 'GitHub',
    role: 'Source of Truth',
    desc: 'All Heady domain configs, agent definitions, and MCP manifests live in the monorepo. Every change triggers a projection.',
    bg: 'rgba(76,143,255,0.1)',
    color: '#4c8fff',
  },
  {
    key: 'gcloud',
    icon: '☁',
    name: 'Google Cloud',
    role: 'Compute Backbone',
    desc: 'Cloud Run hosts stateful agent services, Vertex AI powers embedding pipelines, and Firestore persists agent state.',
    bg: 'rgba(0,212,255,0.1)',
    color: '#00d4ff',
  },
  {
    key: 'cloudflare',
    icon: '⚡',
    name: 'Cloudflare',
    role: 'Edge Intelligence',
    desc: 'Workers handle sub-5ms routing, Pages hosts all 7 HeadyWeb micro-frontends, and R2 stores vector snapshots.',
    bg: 'rgba(240,160,48,0.1)',
    color: '#f0a030',
  },
  {
    key: 'colab',
    icon: '⬡',
    name: 'Google Colab',
    role: 'GPU Research',
    desc: 'Colab notebooks drive model fine-tuning, embedding benchmark runs, and experimental agent behavior research.',
    bg: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
  },
];

const CAPABILITIES = [
  {
    title: 'Autonomous Multi-Agent',
    desc: 'Heady agents (HeadyBuddy, HeadyCoder, HeadyRisks, HeadyBattle) collaborate in real time, passing tasks and memory between nodes.',
    color: '#4c8fff',
  },
  {
    title: 'Vector Federation',
    desc: '384-dimensional embeddings are indexed, replicated via gossip protocol, and searchable across all nodes with 0.92 density gate.',
    color: '#00d4ff',
  },
  {
    title: '43+ MCP Tools',
    desc: 'Model Context Protocol enables agents to call over 43 external services — from GitHub Actions to Cloudflare KV — as structured function calls.',
    color: '#8b5cf6',
  },
  {
    title: 'Module Federation',
    desc: 'HeadyWeb dynamically loads 7 micro-frontend UIs at runtime via Webpack 5 Module Federation, each served from independent Cloudflare deployments.',
    color: '#f0a030',
  },
  {
    title: 'Domain Projection',
    desc: 'Every domain (headyme.com, headysystems.com, etc.) resolves to a specific UI projection with its own staleness budget and sync mode.',
    color: '#10B981',
  },
  {
    title: 'Policy Governance',
    desc: 'The Governance Panel enforces approval gates, role-based permissions, and audit logging for every autonomous agent action across the platform.',
    color: '#ef4444',
  },
];

const STATS = [
  { val: '384D', label: 'Vectors', color: 'blue' },
  { val: '43+',  label: 'MCP Tools', color: 'cyan' },
  { val: '9',    label: 'Domains', color: 'gold' },
  { val: '7',    label: 'Micro-UIs', color: 'purple' },
  { val: 'v3.1', label: 'Platform', color: 'green' },
];

// ── Hex Logo SVG ──────────────────────────────────────────────────────────────

function buildHexLogo(size = 80) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-label', 'HeadySystems hexagon logo');
  svg.classList.add('ld-hero-logo');
  svg.innerHTML = `
    <path d="M40 4L72.66 22V58L40 76L7.34 58V22L40 4Z"
      stroke="#4c8fff" stroke-width="1.5" fill="rgba(76,143,255,0.05)"/>
    <path d="M40 14L62.66 27V53L40 66L17.34 53V27L40 14Z"
      stroke="#00d4ff" stroke-width="1" fill="rgba(0,212,255,0.05)"/>
    <path d="M40 24L53 31.5V46.5L40 54L27 46.5V31.5L40 24Z"
      stroke="#8b5cf6" stroke-width="0.8" fill="rgba(139,92,246,0.08)"/>
    <circle cx="40" cy="40" r="5" fill="#4c8fff" opacity="0.9"/>
    <circle cx="40" cy="40" r="9" stroke="#4c8fff" stroke-width="0.5" fill="none" opacity="0.4"/>
    <circle cx="40" cy="40" r="15" stroke="#00d4ff" stroke-width="0.3" fill="none" opacity="0.2"/>
    <!-- Hex vertices connected -->
    <line x1="40" y1="4" x2="40" y2="14" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
    <line x1="40" y1="66" x2="40" y2="76" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
    <line x1="72.66" y1="22" x2="62.66" y2="27" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
    <line x1="7.34" y1="22" x2="17.34" y2="27" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
    <line x1="72.66" y1="58" x2="62.66" y2="53" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
    <line x1="7.34" y1="58" x2="17.34" y2="53" stroke="#4c8fff" stroke-width="0.5" opacity="0.4"/>
  `;
  return svg;
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function buildNav() {
  const nav = document.createElement('nav');
  nav.className = 'ld-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  nav.innerHTML = `
    <a href="#" class="ld-nav-logo" aria-label="HeadySystems home">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M13 2L23.39 8V20L13 26L2.61 20V8L13 2Z"
          stroke="#4c8fff" stroke-width="1.2" fill="rgba(76,143,255,0.08)"/>
        <circle cx="13" cy="13" r="3" fill="#4c8fff" opacity="0.9"/>
      </svg>
      <span class="ld-nav-wordmark">Heady<span>Systems</span></span>
    </a>
    <ul class="ld-nav-links" role="list">
      <li><a href="#architecture">Architecture</a></li>
      <li><a href="#capabilities">Capabilities</a></li>
      <li>
        <a href="https://github.com/HeadyMe/Heady-pre-production-9f2f0642"
           target="_blank" rel="noopener noreferrer">GitHub</a>
      </li>
    </ul>
    <a href="#capabilities" class="ld-nav-cta">Explore Platform</a>
  `;

  return nav;
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function buildHero() {
  const section = document.createElement('section');
  section.className = 'ld-hero';
  section.setAttribute('aria-label', 'Hero');

  // Hex logo (animated)
  section.appendChild(buildHexLogo(80));

  // Eyebrow
  const eyebrow = document.createElement('div');
  eyebrow.className = 'ld-hero-eyebrow';
  eyebrow.textContent = 'HeadySystems Inc. · v3.1.0 · Autonomous AI Platform';
  section.appendChild(eyebrow);

  // Headline
  const headline = document.createElement('h1');
  headline.className = 'ld-hero-headline';
  headline.innerHTML = '<span class="hl-grad">Intelligence,</span> Unified.';
  section.appendChild(headline);

  // Sub
  const sub = document.createElement('p');
  sub.className = 'ld-hero-sub';
  sub.textContent = 'HeadySystems orchestrates autonomous multi-agent AI across 9 domains — from vector memory federation to real-time swarm governance — all through a single universal shell.';
  section.appendChild(sub);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'ld-hero-actions';
  actions.innerHTML = `
    <a href="#architecture" class="ld-btn-primary">Explore Architecture</a>
    <a href="https://github.com/HeadyMe/Heady-pre-production-9f2f0642"
       target="_blank" rel="noopener noreferrer" class="ld-btn-ghost">View on GitHub</a>
  `;
  section.appendChild(actions);

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.className = 'ld-stats-bar';
  STATS.forEach(({ val, label, color }) => {
    const stat = document.createElement('div');
    stat.className = 'ld-stat';
    stat.innerHTML = `
      <div class="ld-stat-val ${color}">${val}</div>
      <div class="ld-stat-label">${label}</div>
    `;
    statsBar.appendChild(stat);
  });
  section.appendChild(statsBar);

  return section;
}

// ── Pillars ───────────────────────────────────────────────────────────────────

function buildPillars() {
  const section = document.createElement('section');
  section.id = 'architecture';
  section.className = 'ld-section';
  section.setAttribute('aria-labelledby', 'pillars-title');

  section.innerHTML = `
    <div class="ld-section-eyebrow">Infrastructure</div>
    <h2 class="ld-section-title" id="pillars-title">The Four Pillars</h2>
    <p class="ld-section-sub">Every Heady deployment is backed by four cloud platforms working in concert.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'ld-pillars-grid';

  PILLARS.forEach(({ key, icon, name, role, desc, bg, color }) => {
    const card = document.createElement('div');
    card.className = `ld-pillar-card ${key}`;
    card.innerHTML = `
      <div class="ld-pillar-icon" style="background:${bg}">
        <span style="color:${color};font-size:22px">${icon}</span>
      </div>
      <div class="ld-pillar-name">${name}</div>
      <div class="ld-pillar-role">${role}</div>
      <div class="ld-pillar-desc">${desc}</div>
    `;
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// ── Capabilities ──────────────────────────────────────────────────────────────

function buildCapabilities() {
  const section = document.createElement('section');
  section.id = 'capabilities';
  section.className = 'ld-section';
  section.setAttribute('aria-labelledby', 'caps-title');

  section.innerHTML = `
    <div class="ld-section-eyebrow">Platform</div>
    <h2 class="ld-section-title" id="caps-title">Core Capabilities</h2>
    <p class="ld-section-sub">Everything you need for production-grade autonomous AI at scale.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'ld-caps-grid';

  CAPABILITIES.forEach(({ title, desc, color }) => {
    const card = document.createElement('div');
    card.className = 'ld-cap-card';
    card.innerHTML = `
      <div class="ld-cap-header">
        <div class="ld-cap-dot" style="background:${color}"></div>
        <div class="ld-cap-title">${title}</div>
      </div>
      <div class="ld-cap-desc">${desc}</div>
    `;
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// ── Footer ────────────────────────────────────────────────────────────────────

function buildFooter() {
  const footer = document.createElement('footer');
  footer.className = 'ld-footer';
  footer.innerHTML = `
    <div class="ld-footer-left">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2L18.66 7V15L10 20L1.34 15V7L10 2Z"
          stroke="#4c8fff" stroke-width="1" fill="none"/>
        <circle cx="10" cy="10" r="2.5" fill="#4c8fff" opacity="0.8"/>
      </svg>
      <span class="ld-footer-wordmark">Heady<span>Systems</span></span>
      <span class="ld-footer-copy">© 2026 HeadySystems Inc. All rights reserved.</span>
    </div>
    <nav class="ld-footer-links" aria-label="Footer links">
      <a href="https://github.com/HeadyMe/Heady-pre-production-9f2f0642"
         target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="#architecture">Architecture</a>
      <a href="#capabilities">Capabilities</a>
    </nav>
    <div class="ld-pplx-credit">
      <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">
        Created with Perplexity Computer
      </a>
    </div>
  `;
  return footer;
}

// ── App Factory ───────────────────────────────────────────────────────────────

/**
 * Create and return the Landing Page DOM tree.
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
function createApp() {
  const root = document.createElement('div');
  root.className = 'ld-root';

  const bgGrid = document.createElement('div');
  bgGrid.className = 'ld-bg-grid';
  root.appendChild(bgGrid);

  const bgGlow = document.createElement('div');
  bgGlow.className = 'ld-bg-glow';
  root.appendChild(bgGlow);

  root.appendChild(buildNav());
  root.appendChild(buildHero());
  root.appendChild(buildPillars());
  root.appendChild(buildCapabilities());
  root.appendChild(buildFooter());

  return {
    element: root,
    destroy() {
      root.remove();
    },
  };
}

export default createApp;
export { createApp };
