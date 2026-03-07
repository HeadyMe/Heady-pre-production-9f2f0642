/**
 * @file headybee-ui-templates.js
 * @description Complete HeadyBee UI template registry. Each template defines
 *   a fully-specified workspace layout that the UIProjectionEngine uses to
 *   generate concrete projections. Templates are keyed by their unique ID
 *   and exported as the HEADYBEE_TEMPLATES map.
 *
 *   Sacred Geometry alignment: column counts, widget spans, and resource
 *   allocations follow Fibonacci numbers (1,1,2,3,5,8,13,21,34,55) and
 *   golden ratio (φ ≈ 1.618) proportions throughout.
 *
 * @module onboarding/headybee-ui-templates
 * @author HeadyConnection <eric@headyconnection.org>
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Shared colour palette base tokens
// ---------------------------------------------------------------------------

const PALETTES = {
  cosmic: {
    defaultTheme: 'dark',
    accent:        '#6366f1',
    dark:  { background: '#07070f', surface: '#0f0f1a', border: '#1a1a2e', text: '#e2e8f0', textMuted: '#64748b' },
    light: { background: '#f1f5f9', surface: '#ffffff', border: '#e2e8f0', text: '#0f172a', textMuted: '#64748b' },
  },
  emerald: {
    defaultTheme: 'dark',
    accent:        '#10b981',
    dark:  { background: '#030f09', surface: '#071a10', border: '#0d2b1a', text: '#d1fae5', textMuted: '#6b7280' },
    light: { background: '#f0fdf4', surface: '#ffffff', border: '#d1fae5', text: '#064e3b', textMuted: '#6b7280' },
  },
  amber: {
    defaultTheme: 'dark',
    accent:        '#f59e0b',
    dark:  { background: '#0c0a03', surface: '#1a1505', border: '#2d2108', text: '#fef3c7', textMuted: '#92400e' },
    light: { background: '#fffbeb', surface: '#ffffff', border: '#fde68a', text: '#78350f', textMuted: '#92400e' },
  },
  rose: {
    defaultTheme: 'dark',
    accent:        '#f43f5e',
    dark:  { background: '#0f0305', surface: '#1a0508', border: '#2e0912', text: '#ffe4e6', textMuted: '#9f1239' },
    light: { background: '#fff1f2', surface: '#ffffff', border: '#fecdd3', text: '#881337', textMuted: '#9f1239' },
  },
  sky: {
    defaultTheme: 'dark',
    accent:        '#0ea5e9',
    dark:  { background: '#030b0f', surface: '#071420', border: '#0c2238', text: '#e0f2fe', textMuted: '#0369a1' },
    light: { background: '#f0f9ff', surface: '#ffffff', border: '#bae6fd', text: '#0c4a6e', textMuted: '#0369a1' },
  },
  purple: {
    defaultTheme: 'dark',
    accent:        '#a855f7',
    dark:  { background: '#080412', surface: '#0f071e', border: '#1e0d3c', text: '#f3e8ff', textMuted: '#7e22ce' },
    light: { background: '#faf5ff', surface: '#ffffff', border: '#e9d5ff', text: '#4c1d95', textMuted: '#7e22ce' },
  },
  slate: {
    defaultTheme: 'light',
    accent:        '#475569',
    dark:  { background: '#0f172a', surface: '#1e293b', border: '#334155', text: '#f1f5f9', textMuted: '#94a3b8' },
    light: { background: '#f8fafc', surface: '#ffffff', border: '#e2e8f0', text: '#0f172a', textMuted: '#64748b' },
  },
  forest: {
    defaultTheme: 'dark',
    accent:        '#22c55e',
    dark:  { background: '#041009', surface: '#081c0f', border: '#0d2e18', text: '#dcfce7', textMuted: '#15803d' },
    light: { background: '#f0fdf4', surface: '#ffffff', border: '#bbf7d0', text: '#14532d', textMuted: '#15803d' },
  },
};

// ---------------------------------------------------------------------------
// Shared animation presets
// ---------------------------------------------------------------------------

const ANIMATIONS = {
  fluid: {
    durationFast: '150ms', durationNormal: '250ms', durationSlow: '400ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easingBounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    particles: true, reducedMotionSupport: true,
  },
  minimal: {
    durationFast: '80ms', durationNormal: '150ms', durationSlow: '250ms',
    easing: 'linear', easingBounce: 'ease-out',
    particles: false, reducedMotionSupport: true,
  },
  snappy: {
    durationFast: '100ms', durationNormal: '180ms', durationSlow: '300ms',
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easingBounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    particles: false, reducedMotionSupport: true,
  },
  none: {
    durationFast: '0ms', durationNormal: '0ms', durationSlow: '0ms',
    easing: 'linear', particles: false, reducedMotionSupport: true,
  },
};

// ---------------------------------------------------------------------------
// Typography presets
// ---------------------------------------------------------------------------

const TYPOGRAPHY = {
  modern: {
    fontFamily: '"Inter var", Inter, system-ui, sans-serif',
    monoFamily: '"JetBrains Mono", "Fira Code", monospace',
    baseSizePx: 14, scaleRatio: 1.25, lineHeight: 1.618,
    headingWeight: 600, bodyWeight: 400,
  },
  technical: {
    fontFamily: '"IBM Plex Sans", "Inter var", system-ui, sans-serif',
    monoFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
    baseSizePx: 13, scaleRatio: 1.2, lineHeight: 1.5,
    headingWeight: 500, bodyWeight: 400,
  },
  creative: {
    fontFamily: '"Outfit", "Inter var", system-ui, sans-serif',
    monoFamily: '"Fira Code", monospace',
    baseSizePx: 15, scaleRatio: 1.333, lineHeight: 1.7,
    headingWeight: 700, bodyWeight: 300,
  },
  compact: {
    fontFamily: '"Inter var", system-ui, sans-serif',
    monoFamily: '"JetBrains Mono", monospace',
    baseSizePx: 12, scaleRatio: 1.18, lineHeight: 1.5,
    headingWeight: 600, bodyWeight: 400,
  },
};

// ---------------------------------------------------------------------------
// Helper: widget builder
// ---------------------------------------------------------------------------

/**
 * Shorthand to construct a widget definition.
 *
 * @param {string} id
 * @param {string} label
 * @param {string} beeWorkerId - Corresponding HeadyBee worker ID
 * @param {number} [priority=5]
 * @param {number} [colSpan=1]
 * @param {number} [rowSpan=1]
 * @param {object} [overrides={}]
 * @returns {object}
 */
function w(id, label, beeWorkerId, priority = 5, colSpan = 1, rowSpan = 1, overrides = {}) {
  return {
    id, label, beeWorkerId, priority, colSpan, rowSpan,
    resizable:          true,
    collapsible:        true,
    defaultVisible:     true,
    requiredTier:       'free',
    refreshIntervalMs:  30_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HEADYBEE_TEMPLATES registry
// ---------------------------------------------------------------------------

/**
 * Complete HeadyBee UI template registry.
 * Keys are template IDs (snake_case with heady- prefix).
 *
 * @type {Object.<string, HeadyBeeTemplate>}
 */
export const HEADYBEE_TEMPLATES = {

  // =========================================================================
  // 1. heady-command-center
  // =========================================================================

  'heady-command-center': {
    id:          'heady-command-center',
    name:        'Heady Command Center',
    description: 'Full-spectrum power-user dashboard with all available widgets, ' +
                 'real-time telemetry, multi-swarm monitoring, and universal quick-launch.',
    category:    'power',
    projectionType: 'command-center',
    thumbnailUrl:   '/assets/templates/heady-command-center.png',
    sacredGeometryScore: 95,
    recommendedRoles:    ['admin', 'power-user', 'developer', 'operator'],
    recommendedTiers:    ['enterprise', 'pro'],
    colorPalette:        PALETTES.cosmic,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.fluid,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 5 },
        mobile:  { columns: 2 },
      },
      widgets: [
        w('system-health',       'System Health',           'bee-ops-monitor',      9, 3, 2),
        w('llm-router',          'LLM Router Status',       'bee-llm-router',       8, 2, 2),
        w('companion-chat',      'HeadyBuddy Chat',         'bee-companion',        8, 3, 3),
        w('command-palette',     'Command Palette',         'bee-command-exec',     9, 2, 1),
        w('swarm-overview',      'Swarm Overview',          'bee-swarm-coord',      7, 5, 2),
        w('security-alerts',     'Security Alerts',         'bee-auth-guard',       9, 3, 2, { requiredTier: 'pro' }),
        w('mcp-tools',           'MCP Tools',               'bee-mcp-bridge',       7, 3, 2),
        w('research-panel',      'Research Panel',          'bee-research',         6, 3, 2),
        w('code-workspace',      'Code Workspace',          'bee-codegen',          6, 5, 3, { requiredTier: 'pro' }),
        w('analytics-charts',    'Analytics Charts',        'bee-telemetry',        6, 3, 2),
        w('edge-stats',          'Edge / CDN Stats',        'bee-edge-proxy',       5, 2, 1, { requiredTier: 'pro' }),
        w('deployment-pipeline', 'Deployment Pipeline',     'bee-deploy',           7, 3, 2, { requiredTier: 'enterprise' }),
        w('bot-manager',         'Bot Manager',             'bee-bot-runtime',      5, 2, 2),
        w('file-explorer',       'File Explorer',           'bee-fs-bridge',        4, 2, 2),
        w('notifications',       'Notifications',           'bee-notification',     8, 2, 1),
        w('quick-actions',       'Quick Actions',           'bee-command-exec',     7, 2, 1),
      ],
    },

    headySwarmConfig: {
      swarmId: 'operations-swarm',
      secondarySwarms: ['intelligence-swarm', 'security-swarm'],
    },

    navigationItems: [
      { id: 'home',       label: 'Home',       icon: 'home',           route: '/dashboard'      },
      { id: 'swarms',     label: 'Swarms',     icon: 'share-2',        route: '/swarms'         },
      { id: 'companion',  label: 'Companion',  icon: 'bot',            route: '/companion'      },
      { id: 'security',   label: 'Security',   icon: 'shield',         route: '/security'       },
      { id: 'deploy',     label: 'Deploy',     icon: 'send',           route: '/deploy'         },
      { id: 'settings',   label: 'Settings',   icon: 'settings',       route: '/settings'       },
    ],
  },

  // =========================================================================
  // 2. heady-companion
  // =========================================================================

  'heady-companion': {
    id:          'heady-companion',
    name:        'Heady Companion',
    description: 'Minimalist chat-focused companion view. One primary chat interface, ' +
                 'memory panel, and a collapsible quick-tools tray. Distraction-free.',
    category:    'companion',
    projectionType: 'companion-chat',
    thumbnailUrl:   '/assets/templates/heady-companion.png',
    sacredGeometryScore: 89,
    recommendedRoles:    ['user', 'creative', 'student', 'researcher'],
    recommendedTiers:    ['free', 'pro', 'enterprise'],
    colorPalette:        PALETTES.cosmic,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.fluid,

    widgetLayout: {
      columns: 3,              // Fibonacci 3
      responsive: {
        desktop: { columns: 3 },
        tablet:  { columns: 2 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('companion-chat-main', 'HeadyBuddy Chat',    'bee-companion',    9, 2, 5),
        w('memory-panel',        'Memory & Context',   'bee-memory',       7, 1, 3),
        w('quick-tools',         'Quick Tools',        'bee-command-exec', 5, 1, 2),
        w('recent-files',        'Recent Files',       'bee-fs-bridge',    4, 1, 2),
      ],
    },

    headySwarmConfig: {
      swarmId: 'companion-swarm',
      secondarySwarms: ['intelligence-swarm'],
    },

    navigationItems: [
      { id: 'chat',       label: 'Chat',        icon: 'message-circle', route: '/companion'  },
      { id: 'history',    label: 'History',     icon: 'clock',          route: '/history'    },
      { id: 'settings',   label: 'Settings',    icon: 'settings',       route: '/settings'   },
    ],
  },

  // =========================================================================
  // 3. heady-developer-console
  // =========================================================================

  'heady-developer-console': {
    id:          'heady-developer-console',
    name:        'Heady Developer Console',
    description: 'IDE-inspired layout for developers: code editor, terminal, ' +
                 'MCP tool browser, git status, CI/CD pipeline, and log viewer.',
    category:    'developer',
    projectionType: 'developer-console',
    thumbnailUrl:   '/assets/templates/heady-developer-console.png',
    sacredGeometryScore: 91,
    recommendedRoles:    ['developer', 'devops', 'architect'],
    recommendedTiers:    ['pro', 'enterprise'],
    colorPalette:        PALETTES.emerald,
    typography:          TYPOGRAPHY.technical,
    animationPresets:    ANIMATIONS.snappy,

    widgetLayout: {
      columns: 13,             // Fibonacci 13
      responsive: {
        desktop: { columns: 13 },
        tablet:  { columns: 5  },
        mobile:  { columns: 2  },
      },
      widgets: [
        w('file-tree',           'File Tree',          'bee-fs-bridge',    8, 2, 5),
        w('code-editor',         'Code Editor',        'bee-codegen',      9, 8, 5, { requiredTier: 'pro' }),
        w('mcp-tool-browser',    'MCP Tools',          'bee-mcp-bridge',   7, 3, 5),
        w('terminal',            'Terminal',           'bee-command-exec', 9, 8, 3, { requiredTier: 'pro' }),
        w('git-status',          'Git Status',         'bee-git-ops',      7, 3, 2),
        w('deployment-pipeline', 'CI/CD Pipeline',     'bee-deploy',       7, 5, 2, { requiredTier: 'enterprise' }),
        w('log-viewer',          'Log Viewer',         'bee-log-agg',      6, 5, 3, { requiredTier: 'pro' }),
        w('llm-assist',          'AI Code Assist',     'bee-llm-router',   8, 3, 2),
        w('package-manager',     'Package Manager',    'bee-package-ops',  5, 3, 2),
        w('test-runner',         'Test Runner',        'bee-test-ops',     6, 5, 2, { requiredTier: 'pro' }),
      ],
    },

    headySwarmConfig: {
      swarmId: 'creation-swarm',
      secondarySwarms: ['operations-swarm', 'edge-cloud-swarm'],
    },

    navigationItems: [
      { id: 'editor',    label: 'Editor',    icon: 'code-2',     route: '/editor'    },
      { id: 'terminal',  label: 'Terminal',  icon: 'terminal',   route: '/terminal'  },
      { id: 'deploy',    label: 'Deploy',    icon: 'rocket',     route: '/deploy'    },
      { id: 'mcp',       label: 'MCP',       icon: 'plug',       route: '/mcp'       },
      { id: 'settings',  label: 'Settings',  icon: 'settings',   route: '/settings'  },
    ],
  },

  // =========================================================================
  // 4. heady-creative-studio
  // =========================================================================

  'heady-creative-studio': {
    id:          'heady-creative-studio',
    name:        'Heady Creative Studio',
    description: 'Music, art, and content creation workspace: canvas, sample library, ' +
                 'generative AI tools, inspiration board, content planner, and publish.',
    category:    'creative',
    projectionType: 'creative-studio',
    thumbnailUrl:   '/assets/templates/heady-creative-studio.png',
    sacredGeometryScore: 88,
    recommendedRoles:    ['creative', 'artist', 'musician', 'content-creator'],
    recommendedTiers:    ['pro', 'enterprise'],
    colorPalette:        PALETTES.purple,
    typography:          TYPOGRAPHY.creative,
    animationPresets:    ANIMATIONS.fluid,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 3 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('canvas',            'Creative Canvas',      'bee-creative-gen',   9, 5, 4, { requiredTier: 'pro' }),
        w('inspiration-board', 'Inspiration Board',    'bee-research',       7, 3, 2),
        w('ai-image-gen',      'AI Image Generator',  'bee-image-gen',      8, 3, 3, { requiredTier: 'pro' }),
        w('sample-library',    'Sample Library',      'bee-audio-proc',     7, 3, 2, { requiredTier: 'pro' }),
        w('timeline',          'Project Timeline',    'bee-project-mgr',    6, 5, 2),
        w('content-planner',   'Content Planner',     'bee-content-sched',  6, 3, 2),
        w('publish-tools',     'Publish & Share',     'bee-publish',        5, 3, 2),
        w('ai-writing',        'AI Writing Assist',   'bee-llm-router',     7, 5, 2),
        w('asset-library',     'Asset Library',       'bee-fs-bridge',      5, 3, 3),
        w('companion-chat',    'Creative Companion',  'bee-companion',      6, 3, 2),
      ],
    },

    headySwarmConfig: {
      swarmId: 'creation-swarm',
      secondarySwarms: ['companion-swarm', 'intelligence-swarm'],
    },

    navigationItems: [
      { id: 'canvas',    label: 'Canvas',    icon: 'palette',        route: '/canvas'    },
      { id: 'library',   label: 'Library',   icon: 'library',        route: '/library'   },
      { id: 'publish',   label: 'Publish',   icon: 'share',          route: '/publish'   },
      { id: 'companion', label: 'AI Assist', icon: 'sparkles',       route: '/companion' },
      { id: 'settings',  label: 'Settings',  icon: 'settings',       route: '/settings'  },
    ],
  },

  // =========================================================================
  // 5. heady-trading-desk
  // =========================================================================

  'heady-trading-desk': {
    id:          'heady-trading-desk',
    name:        'Heady Trading Desk',
    description: 'Financial data and trading workspace: live price feeds, portfolio ' +
                 'tracker, AI sentiment analysis, order management, and P&L charts.',
    category:    'finance',
    projectionType: 'trading-desk',
    thumbnailUrl:   '/assets/templates/heady-trading-desk.png',
    sacredGeometryScore: 87,
    recommendedRoles:    ['trader', 'analyst', 'investor', 'quant'],
    recommendedTiers:    ['pro', 'enterprise'],
    colorPalette:        PALETTES.amber,
    typography:          TYPOGRAPHY.compact,
    animationPresets:    ANIMATIONS.snappy,

    widgetLayout: {
      columns: 13,            // Fibonacci 13
      responsive: {
        desktop: { columns: 13 },
        tablet:  { columns: 5  },
        mobile:  { columns: 2  },
      },
      widgets: [
        w('price-chart',       'Price Chart',          'bee-market-data',    9, 8, 4, { requiredTier: 'pro', refreshIntervalMs: 5_000 }),
        w('order-book',        'Order Book',           'bee-trading-ops',    9, 3, 4, { requiredTier: 'pro', refreshIntervalMs: 2_000 }),
        w('portfolio',         'Portfolio Overview',   'bee-portfolio',      8, 5, 2, { requiredTier: 'pro' }),
        w('sentiment',         'AI Sentiment',         'bee-llm-router',     7, 3, 2),
        w('news-feed',         'Market News',          'bee-research',       7, 5, 2, { refreshIntervalMs: 60_000 }),
        w('positions',         'Open Positions',       'bee-trading-ops',    8, 5, 3, { requiredTier: 'enterprise', refreshIntervalMs: 5_000 }),
        w('alerts',            'Price Alerts',         'bee-notification',   8, 3, 2),
        w('pnl-chart',         'P&L Chart',            'bee-analytics',      7, 5, 2, { requiredTier: 'pro' }),
        w('watchlist',         'Watchlist',            'bee-market-data',    7, 3, 2),
        w('ai-signals',        'AI Trading Signals',   'bee-strategy',       6, 5, 2, { requiredTier: 'enterprise' }),
      ],
    },

    headySwarmConfig: {
      swarmId: 'intelligence-swarm',
      secondarySwarms: ['analytics-swarm', 'operations-swarm'],
    },

    navigationItems: [
      { id: 'markets',   label: 'Markets',   icon: 'trending-up',    route: '/markets'   },
      { id: 'portfolio', label: 'Portfolio', icon: 'briefcase',      route: '/portfolio' },
      { id: 'signals',   label: 'Signals',   icon: 'zap',            route: '/signals'   },
      { id: 'research',  label: 'Research',  icon: 'search',         route: '/research'  },
      { id: 'settings',  label: 'Settings',  icon: 'settings',       route: '/settings'  },
    ],
  },

  // =========================================================================
  // 6. heady-enterprise-admin
  // =========================================================================

  'heady-enterprise-admin': {
    id:          'heady-enterprise-admin',
    name:        'Heady Enterprise Admin',
    description: 'Full-spectrum enterprise administration: user management, tenant ' +
                 'configuration, audit logs, compliance dashboards, billing, and SLA monitoring.',
    category:    'admin',
    projectionType: 'dashboard',
    thumbnailUrl:   '/assets/templates/heady-enterprise-admin.png',
    sacredGeometryScore: 92,
    recommendedRoles:    ['admin', 'sysadmin', 'cto', 'compliance'],
    recommendedTiers:    ['enterprise'],
    colorPalette:        PALETTES.slate,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.snappy,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 3 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('tenant-overview',    'Tenant Overview',      'bee-tenant-mgr',     9, 3, 2, { requiredTier: 'enterprise' }),
        w('user-management',    'User Management',      'bee-user-mgr',       9, 5, 3, { requiredTier: 'enterprise' }),
        w('audit-log',          'Audit Log',            'bee-audit',          8, 5, 3, { requiredTier: 'enterprise', refreshIntervalMs: 10_000 }),
        w('compliance',         'Compliance Dashboard', 'bee-compliance',     8, 3, 2, { requiredTier: 'enterprise' }),
        w('billing',            'Billing & Usage',      'bee-billing',        7, 3, 2, { requiredTier: 'enterprise' }),
        w('sla-monitor',        'SLA Monitor',          'bee-sla',            8, 5, 2, { requiredTier: 'enterprise', refreshIntervalMs: 15_000 }),
        w('security-overview',  'Security Overview',    'bee-auth-guard',     9, 3, 2, { requiredTier: 'enterprise' }),
        w('api-usage',          'API Usage',            'bee-api-gw',         6, 3, 2, { requiredTier: 'enterprise' }),
        w('system-health',      'System Health',        'bee-ops-monitor',    7, 5, 2, { requiredTier: 'enterprise' }),
        w('policy-editor',      'Policy Editor',        'bee-governance',     5, 3, 2, { requiredTier: 'enterprise' }),
      ],
    },

    headySwarmConfig: {
      swarmId: 'security-swarm',
      secondarySwarms: ['operations-swarm', 'sacred-governance-swarm'],
    },

    navigationItems: [
      { id: 'tenants',    label: 'Tenants',    icon: 'building-2',  route: '/admin/tenants'    },
      { id: 'users',      label: 'Users',      icon: 'users',       route: '/admin/users'      },
      { id: 'audit',      label: 'Audit',      icon: 'file-text',   route: '/admin/audit'      },
      { id: 'compliance', label: 'Compliance', icon: 'shield-check',route: '/admin/compliance' },
      { id: 'billing',    label: 'Billing',    icon: 'credit-card', route: '/admin/billing'    },
      { id: 'settings',   label: 'Settings',   icon: 'settings',    route: '/settings'         },
    ],
  },

  // =========================================================================
  // 7. heady-community-hub
  // =========================================================================

  'heady-community-hub': {
    id:          'heady-community-hub',
    name:        'Heady Community Hub',
    description: 'HeadyConnection nonprofit and social workspace: community feed, ' +
                 'event calendar, project board, volunteer tools, and impact metrics.',
    category:    'community',
    projectionType: 'dashboard',
    thumbnailUrl:   '/assets/templates/heady-community-hub.png',
    sacredGeometryScore: 84,
    recommendedRoles:    ['community-manager', 'nonprofit', 'volunteer', 'organizer'],
    recommendedTiers:    ['free', 'pro', 'enterprise'],
    colorPalette:        PALETTES.forest,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.fluid,

    widgetLayout: {
      columns: 5,             // Fibonacci 5
      responsive: {
        desktop: { columns: 5 },
        tablet:  { columns: 3 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('community-feed',    'Community Feed',       'bee-social',        9, 3, 4),
        w('event-calendar',    'Event Calendar',       'bee-calendar',      7, 2, 3),
        w('project-board',     'Project Board',        'bee-project-mgr',   7, 3, 3),
        w('volunteer-map',     'Volunteer Map',        'bee-geo-data',      6, 2, 2),
        w('impact-metrics',    'Impact Metrics',       'bee-analytics',     7, 3, 2),
        w('announcements',     'Announcements',        'bee-notification',  8, 2, 2),
        w('companion-chat',    'Community AI',         'bee-companion',     6, 3, 2),
        w('resource-library',  'Resource Library',     'bee-fs-bridge',     5, 2, 2),
      ],
    },

    headySwarmConfig: {
      swarmId: 'companion-swarm',
      secondarySwarms: ['analytics-swarm'],
    },

    navigationItems: [
      { id: 'feed',      label: 'Feed',      icon: 'rss',         route: '/community'       },
      { id: 'events',    label: 'Events',    icon: 'calendar',    route: '/events'          },
      { id: 'projects',  label: 'Projects',  icon: 'folder',      route: '/projects'        },
      { id: 'impact',    label: 'Impact',    icon: 'heart',       route: '/impact'          },
      { id: 'settings',  label: 'Settings',  icon: 'settings',    route: '/settings'        },
    ],
  },

  // =========================================================================
  // 8. heady-research-lab
  // =========================================================================

  'heady-research-lab': {
    id:          'heady-research-lab',
    name:        'Heady Research Lab',
    description: 'Deep research and analysis workspace: multi-source search, ' +
                 'knowledge graph, citation manager, document analysis, and synthesis.',
    category:    'research',
    projectionType: 'dashboard',
    thumbnailUrl:   '/assets/templates/heady-research-lab.png',
    sacredGeometryScore: 90,
    recommendedRoles:    ['researcher', 'analyst', 'academic', 'scientist'],
    recommendedTiers:    ['free', 'pro', 'enterprise'],
    colorPalette:        PALETTES.sky,
    typography:          TYPOGRAPHY.technical,
    animationPresets:    ANIMATIONS.minimal,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 3 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('research-search',   'Research Search',      'bee-research',      9, 3, 3),
        w('knowledge-graph',   'Knowledge Graph',      'bee-knowledge',     8, 5, 4),
        w('document-reader',   'Document Reader',      'bee-doc-proc',      8, 3, 4),
        w('citation-manager',  'Citation Manager',     'bee-citations',     6, 3, 2),
        w('synthesis',         'AI Synthesis',         'bee-llm-router',    8, 5, 2, { requiredTier: 'pro' }),
        w('timeline',          'Research Timeline',    'bee-project-mgr',   5, 3, 2),
        w('data-visualiser',   'Data Visualiser',      'bee-analytics',     6, 5, 2),
        w('companion-chat',    'Research Companion',   'bee-companion',     7, 3, 2),
        w('export',            'Export & Publish',     'bee-publish',       5, 3, 2),
      ],
    },

    headySwarmConfig: {
      swarmId: 'intelligence-swarm',
      secondarySwarms: ['analytics-swarm', 'companion-swarm'],
    },

    navigationItems: [
      { id: 'search',    label: 'Search',    icon: 'search',       route: '/research'  },
      { id: 'library',   label: 'Library',   icon: 'book-open',    route: '/library'   },
      { id: 'synthesis', label: 'Synthesis', icon: 'git-merge',    route: '/synthesis' },
      { id: 'export',    label: 'Export',    icon: 'download',     route: '/export'    },
      { id: 'settings',  label: 'Settings',  icon: 'settings',     route: '/settings'  },
    ],
  },

  // =========================================================================
  // 9. heady-bot-manager
  // =========================================================================

  'heady-bot-manager': {
    id:          'heady-bot-manager',
    name:        'Heady Bot Manager',
    description: 'Bot and automation management: bot registry, workflow builder, ' +
                 'trigger editor, run history, A/B testing, and performance metrics.',
    category:    'automation',
    projectionType: 'dashboard',
    thumbnailUrl:   '/assets/templates/heady-bot-manager.png',
    sacredGeometryScore: 86,
    recommendedRoles:    ['developer', 'automator', 'devops', 'admin'],
    recommendedTiers:    ['pro', 'enterprise'],
    colorPalette:        PALETTES.emerald,
    typography:          TYPOGRAPHY.technical,
    animationPresets:    ANIMATIONS.snappy,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 3 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('bot-registry',      'Bot Registry',         'bee-bot-runtime',   9, 3, 3, { requiredTier: 'pro' }),
        w('workflow-builder',  'Workflow Builder',     'bee-workflow',      9, 5, 4, { requiredTier: 'pro' }),
        w('trigger-editor',    'Trigger Editor',       'bee-trigger',       7, 3, 2, { requiredTier: 'pro' }),
        w('run-history',       'Run History',          'bee-log-agg',       7, 5, 2),
        w('ab-testing',        'A/B Testing',          'bee-experiment',    6, 3, 2, { requiredTier: 'enterprise' }),
        w('bot-metrics',       'Bot Performance',      'bee-telemetry',     6, 5, 2, { refreshIntervalMs: 15_000 }),
        w('error-log',         'Error Log',            'bee-log-agg',       8, 3, 2, { refreshIntervalMs: 10_000 }),
        w('scheduling',        'Scheduler',            'bee-scheduler',     5, 3, 2, { requiredTier: 'pro' }),
      ],
    },

    headySwarmConfig: {
      swarmId: 'operations-swarm',
      secondarySwarms: ['creation-swarm', 'analytics-swarm'],
    },

    navigationItems: [
      { id: 'bots',      label: 'Bots',      icon: 'cpu',          route: '/bots'      },
      { id: 'workflows', label: 'Workflows', icon: 'git-branch',   route: '/workflows' },
      { id: 'triggers',  label: 'Triggers',  icon: 'zap',          route: '/triggers'  },
      { id: 'metrics',   label: 'Metrics',   icon: 'bar-chart-2',  route: '/metrics'   },
      { id: 'settings',  label: 'Settings',  icon: 'settings',     route: '/settings'  },
    ],
  },

  // =========================================================================
  // 10. heady-mcp-dashboard
  // =========================================================================

  'heady-mcp-dashboard': {
    id:          'heady-mcp-dashboard',
    name:        'Heady MCP Dashboard',
    description: 'Model Context Protocol tools and server management: MCP server registry, ' +
                 'tool catalogue, request tracer, token usage, and latency heat-maps.',
    category:    'developer',
    projectionType: 'developer-console',
    thumbnailUrl:   '/assets/templates/heady-mcp-dashboard.png',
    sacredGeometryScore: 88,
    recommendedRoles:    ['developer', 'ml-engineer', 'admin'],
    recommendedTiers:    ['pro', 'enterprise'],
    colorPalette:        PALETTES.cosmic,
    typography:          TYPOGRAPHY.technical,
    animationPresets:    ANIMATIONS.snappy,

    widgetLayout: {
      columns: 8,             // Fibonacci 8
      responsive: {
        desktop: { columns: 8 },
        tablet:  { columns: 3 },
        mobile:  { columns: 2 },
      },
      widgets: [
        w('mcp-server-registry', 'MCP Server Registry',  'bee-mcp-bridge',  9, 3, 3, { requiredTier: 'pro' }),
        w('tool-catalogue',      'Tool Catalogue',       'bee-mcp-bridge',  9, 5, 3, { requiredTier: 'pro' }),
        w('request-tracer',      'Request Tracer',       'bee-tracer',      8, 5, 3, { requiredTier: 'pro', refreshIntervalMs: 5_000 }),
        w('token-usage',         'Token Usage',          'bee-telemetry',   8, 3, 2, { refreshIntervalMs: 10_000 }),
        w('latency-heatmap',     'Latency Heat Map',     'bee-analytics',   7, 5, 2, { requiredTier: 'enterprise' }),
        w('llm-router',          'LLM Router',           'bee-llm-router',  8, 3, 2),
        w('model-config',        'Model Config',         'bee-model-cfg',   6, 3, 2, { requiredTier: 'pro' }),
        w('error-rate',          'Error Rate',           'bee-ops-monitor', 7, 3, 2, { refreshIntervalMs: 10_000 }),
      ],
    },

    headySwarmConfig: {
      swarmId: 'intelligence-swarm',
      secondarySwarms: ['operations-swarm', 'analytics-swarm'],
    },

    navigationItems: [
      { id: 'servers',  label: 'MCP Servers', icon: 'server',      route: '/mcp/servers' },
      { id: 'tools',    label: 'Tools',       icon: 'tool',        route: '/mcp/tools'   },
      { id: 'tracer',   label: 'Tracer',      icon: 'activity',    route: '/mcp/tracer'  },
      { id: 'usage',    label: 'Usage',       icon: 'bar-chart',   route: '/mcp/usage'   },
      { id: 'settings', label: 'Settings',    icon: 'settings',    route: '/settings'    },
    ],
  },

  // =========================================================================
  // 11. heady-onboarding-lite
  // =========================================================================

  'heady-onboarding-lite': {
    id:          'heady-onboarding-lite',
    name:        'Heady Onboarding Lite',
    description: 'Simplified starter template for new users. Companion chat front-and-center ' +
                 'with a guided task checklist and minimal tooling to avoid overwhelm.',
    category:    'starter',
    projectionType: 'companion-chat',
    thumbnailUrl:   '/assets/templates/heady-onboarding-lite.png',
    sacredGeometryScore: 82,
    recommendedRoles:    ['user', 'student', 'newcomer'],
    recommendedTiers:    ['free', 'pro', 'enterprise'],
    colorPalette:        PALETTES.cosmic,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.fluid,

    widgetLayout: {
      columns: 3,             // Fibonacci 3
      responsive: {
        desktop: { columns: 3 },
        tablet:  { columns: 2 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('companion-chat',    'HeadyBuddy Chat',      'bee-companion',     9, 2, 4),
        w('getting-started',   'Getting Started',      'bee-onboarding',    8, 1, 2),
        w('quick-search',      'Quick Search',         'bee-research',      7, 1, 1),
        w('recent-activity',   'Recent Activity',      'bee-log-agg',       5, 1, 2),
        w('notifications',     'Notifications',        'bee-notification',  6, 1, 1),
      ],
    },

    headySwarmConfig: {
      swarmId: 'companion-swarm',
      secondarySwarms: [],
    },

    navigationItems: [
      { id: 'home',     label: 'Home',    icon: 'home',         route: '/dashboard' },
      { id: 'chat',     label: 'Chat',    icon: 'message-circle',route: '/companion' },
      { id: 'help',     label: 'Help',    icon: 'help-circle',  route: '/help'      },
      { id: 'settings', label: 'Setup',   icon: 'settings-2',   route: '/settings'  },
    ],
  },

  // =========================================================================
  // 12. heady-focus-mode
  // =========================================================================

  'heady-focus-mode': {
    id:          'heady-focus-mode',
    name:        'Heady Focus Mode',
    description: 'Single-task, distraction-free environment. One primary pane, ' +
                 'a minimal taskbar, Pomodoro timer, and zero decorative elements.',
    category:    'productivity',
    projectionType: 'focus',
    thumbnailUrl:   '/assets/templates/heady-focus-mode.png',
    sacredGeometryScore: 93,    // Near-perfect — minimalism honours Sacred Geometry
    recommendedRoles:    ['user', 'developer', 'researcher', 'writer'],
    recommendedTiers:    ['free', 'pro', 'enterprise'],
    colorPalette:        PALETTES.slate,
    typography:          TYPOGRAPHY.modern,
    animationPresets:    ANIMATIONS.none,

    widgetLayout: {
      columns: 1,             // Fibonacci 1 — perfect singularity
      responsive: {
        desktop: { columns: 1 },
        tablet:  { columns: 1 },
        mobile:  { columns: 1 },
      },
      widgets: [
        w('focus-pane',    'Focus Pane',      'bee-companion',      9, 1, 5, {
          collapsible: false, resizable: false,
        }),
        w('pomodoro',      'Pomodoro Timer',  'bee-scheduler',      7, 1, 1, {
          defaultVisible: true, refreshIntervalMs: 1_000,
        }),
        w('task-list',     'Task List',       'bee-project-mgr',    6, 1, 2),
      ],
    },

    headySwarmConfig: {
      swarmId: 'companion-swarm',
      secondarySwarms: [],
    },

    navigationItems: [
      { id: 'focus',    label: 'Focus',   icon: 'target',       route: '/focus'     },
      { id: 'tasks',    label: 'Tasks',   icon: 'check-square', route: '/tasks'     },
      { id: 'exit',     label: 'Exit',    icon: 'log-out',      route: '/dashboard' },
    ],
  },
};

// ---------------------------------------------------------------------------
// JSDoc typedef
// ---------------------------------------------------------------------------

/**
 * @typedef {object} HeadyBeeTemplate
 * @property {string}   id
 * @property {string}   name
 * @property {string}   description
 * @property {string}   category
 * @property {string}   projectionType
 * @property {string}   thumbnailUrl
 * @property {number}   sacredGeometryScore      - 0–100 Sacred Geometry alignment score
 * @property {string[]} recommendedRoles
 * @property {string[]} recommendedTiers
 * @property {object}   colorPalette
 * @property {object}   typography
 * @property {object}   animationPresets
 * @property {object}   widgetLayout
 * @property {object}   widgetLayout.columns
 * @property {object}   widgetLayout.responsive
 * @property {object[]} widgetLayout.widgets
 * @property {object}   headySwarmConfig
 * @property {string}   headySwarmConfig.swarmId
 * @property {string[]} headySwarmConfig.secondarySwarms
 * @property {object[]} navigationItems
 */
