/**
 * Heady Governance Panel — App Component
 *
 * Policy engine status, approval gates, rules editor, audit log, RBAC matrix.
 * Dark purple theme for policy and governance management.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/governance-panel/App
 */

'use strict';

import './styles.css';

// ── Data ──────────────────────────────────────────────────────────────────────

const ENGINE_STATUS = [
  { name: 'Policy Evaluator',    status: 'RUNNING', dot: 'green' },
  { name: 'Approval Gate FSM',   status: 'RUNNING', dot: 'green' },
  { name: 'Audit Logger',        status: 'RUNNING', dot: 'green' },
  { name: 'RBAC Enforcer',       status: 'STANDBY', dot: 'amber' },
];

const GATES = [
  { name: 'Deploy to Production',     scope: 'cloudflare-pages',  status: 'pending'  },
  { name: 'Publish MCP Tool v12',     scope: 'headymcp.com',       status: 'approved' },
  { name: 'Agent Permission Expand',  scope: 'heady-buddy',        status: 'pending'  },
  { name: 'Vector Store Purge',       scope: 'vector-federation',  status: 'rejected' },
  { name: 'New Domain Registration',  scope: 'headystack',         status: 'approved' },
  { name: 'Model Fine-tune Commit',   scope: 'colab-pipeline',     status: 'pending'  },
];

const RULES = [
  { name: 'no-unapproved-deploy',      scope: 'cloudflare-*',     level: 'hard' },
  { name: 'require-audit-log',         scope: '*',                 level: 'hard' },
  { name: 'mcp-tool-whitelist',        scope: 'headymcp.com',      level: 'hard' },
  { name: 'rate-limit-embeddings',     scope: 'vector-*',          level: 'soft' },
  { name: 'agent-memory-cap',          scope: 'swarm-*',           level: 'soft' },
  { name: 'log-model-inferences',      scope: '*',                 level: 'info' },
  { name: 'warn-on-stale-projection',  scope: 'projections-*',     level: 'soft' },
  { name: 'enforce-rbac',              scope: 'governance-panel',  level: 'hard' },
];

const AUDIT_LOG = [
  { time: '03:07:12', event: '<strong>HeadyRisks</strong> evaluated policy: deploy-to-prod',      outcome: 'ok',   cls: 'ok'  },
  { time: '03:06:58', event: '<strong>GovernancePanel</strong> approval gate opened: model-finetune', outcome: 'WARN', cls: 'warn' },
  { time: '03:05:43', event: '<strong>HeadyCoder</strong> committed PR #412 to main',              outcome: 'OK',   cls: 'ok'  },
  { time: '03:04:01', event: '<strong>VectorEngine</strong> attempted purge — REJECTED by rule',   outcome: 'DENY', cls: 'err' },
  { time: '03:02:30', event: '<strong>HeadyBuddy</strong> invoked MCP tool: github.search_code',   outcome: 'OK',   cls: 'ok'  },
  { time: '03:01:15', event: '<strong>RBAC</strong> permission check: swarm-admin role granted',    outcome: 'OK',   cls: 'ok'  },
  { time: '02:59:44', event: '<strong>PolicyEval</strong> rule updated: rate-limit-embeddings',    outcome: 'INFO', cls: 'warn' },
];

const RBAC_ROLES = [
  { role: 'swarm-admin',   deploy: 'Y', purge: 'Y', mcp: 'Y', audit: 'Y', rbac: 'Y'  },
  { role: 'agent-op',      deploy: 'R', purge: 'N', mcp: 'Y', audit: 'Y', rbac: 'N'  },
  { role: 'read-only',     deploy: 'N', purge: 'N', mcp: 'N', audit: 'Y', rbac: 'N'  },
  { role: 'policy-editor', deploy: 'N', purge: 'R', mcp: 'R', audit: 'Y', rbac: 'R'  },
];

const PERM_COLS = ['DEPLOY', 'PURGE', 'MCP', 'AUDIT', 'RBAC'];

// ── Builders ──────────────────────────────────────────────────────────────────

function buildHeader() {
  const h = document.createElement('header');
  h.className = 'gv-header';
  h.innerHTML = `
    <div class="gv-header-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20.53 7.5V16.5L11 22L1.47 16.5V7.5L11 2Z"
          stroke="#8b5cf6" stroke-width="1.2" fill="rgba(139,92,246,0.08)"/>
        <circle cx="11" cy="11" r="2.5" fill="#8b5cf6" opacity="0.9"/>
      </svg>
      Governance Panel
    </div>
    <span class="gv-badge">MCP Policy v8</span>
    <div class="gv-spacer"></div>
    <span class="gv-clock" id="gv-clock"></span>
  `;
  return h;
}

function buildPolicyEnginePanel() {
  const panel = document.createElement('div');
  panel.className = 'gv-panel';

  const title = document.createElement('div');
  title.className = 'gv-panel-title';
  title.textContent = 'Policy Engine Status';
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'gv-engine-grid';
  ENGINE_STATUS.forEach(({ name, status, dot }) => {
    const card = document.createElement('div');
    card.className = 'gv-engine-card';
    card.innerHTML = `
      <div class="gv-engine-name">${name}</div>
      <div class="gv-engine-status">
        <div class="gv-dot ${dot}"></div>
        ${status}
      </div>
    `;
    grid.appendChild(card);
  });
  panel.appendChild(grid);

  // Compliance score meter
  const complianceWrap = document.createElement('div');
  complianceWrap.className = 'gv-compliance-wrap';
  complianceWrap.innerHTML = `
    <div class="gv-compliance-label">
      <span>Overall Compliance Score</span>
      <span class="gv-compliance-val">94.7%</span>
    </div>
    <div class="gv-compliance-bar-track">
      <div class="gv-compliance-bar" style="width:94.7%"></div>
    </div>
  `;
  panel.appendChild(complianceWrap);

  return panel;
}

function buildApprovalGatesPanel() {
  const panel = document.createElement('div');
  panel.className = 'gv-panel';

  const title = document.createElement('div');
  title.className = 'gv-panel-title';
  title.textContent = 'Approval Gates';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'gv-gates-list';
  GATES.forEach(({ name, scope, status }) => {
    const item = document.createElement('div');
    item.className = 'gv-gate-item';
    item.innerHTML = `
      <div class="gv-gate-name">${name}</div>
      <div class="gv-gate-scope">${scope}</div>
      <div class="gv-gate-status ${status}">${status}</div>
    `;
    list.appendChild(item);
  });
  panel.appendChild(list);

  return panel;
}

function buildRulesPanel() {
  const panel = document.createElement('div');
  panel.className = 'gv-panel';

  const title = document.createElement('div');
  title.className = 'gv-panel-title';
  title.textContent = 'Governance Rules';
  panel.appendChild(title);

  const table = document.createElement('table');
  table.className = 'gv-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rule Name</th>
        <th>Scope</th>
        <th>Enforcement</th>
      </tr>
    </thead>
    <tbody>
      ${RULES.map(({ name, scope, level }) => `
        <tr>
          <td><span style="font-family:var(--font-mono);font-size:11px">${name}</span></td>
          <td style="font-family:var(--font-mono);font-size:11px;color:var(--gv-muted)">${scope}</td>
          <td><span class="gv-enforcement ${level}">${level}</span></td>
        </tr>
      `).join('')}
    </tbody>
  `;
  panel.appendChild(table);

  // RBAC matrix
  const rbacTitle = document.createElement('div');
  rbacTitle.className = 'gv-panel-title';
  rbacTitle.style.marginTop = '16px';
  rbacTitle.textContent = 'Role-Based Access Control';
  panel.appendChild(rbacTitle);

  const rbacWrap = document.createElement('div');
  rbacWrap.className = 'gv-rbac';

  const rbacTable = document.createElement('table');
  rbacTable.innerHTML = `
    <thead>
      <tr>
        <th>ROLE</th>
        ${PERM_COLS.map((c) => `<th>${c}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${RBAC_ROLES.map(({ role, deploy, purge, mcp, audit, rbac }) => {
        const vals = [deploy, purge, mcp, audit, rbac];
        return `
          <tr>
            <td class="role-name">${role}</td>
            ${vals.map((v) => `<td class="perm-${v.toLowerCase()}">${v}</td>`).join('')}
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
  rbacWrap.appendChild(rbacTable);
  panel.appendChild(rbacWrap);

  return panel;
}

function buildAuditLogPanel() {
  const panel = document.createElement('div');
  panel.className = 'gv-panel';

  const title = document.createElement('div');
  title.className = 'gv-panel-title';
  title.textContent = 'Audit Log';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'gv-audit-list';
  AUDIT_LOG.forEach(({ time, event, outcome, cls }) => {
    const item = document.createElement('div');
    item.className = 'gv-audit-item';
    item.innerHTML = `
      <div class="gv-audit-time">${time}</div>
      <div class="gv-audit-event">${event}</div>
      <div class="gv-audit-outcome ${cls}">${outcome}</div>
    `;
    list.appendChild(item);
  });
  panel.appendChild(list);

  return panel;
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp() {
  const root = document.createElement('div');
  root.className = 'gv-root';

  root.appendChild(buildHeader());

  const main = document.createElement('div');
  main.className = 'gv-main';

  main.appendChild(buildPolicyEnginePanel());
  main.appendChild(buildApprovalGatesPanel());
  main.appendChild(buildRulesPanel());
  main.appendChild(buildAuditLogPanel());

  root.appendChild(main);

  const clockEl = root.querySelector('#gv-clock');
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
