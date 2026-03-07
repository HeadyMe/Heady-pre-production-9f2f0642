/**
 * @file ui-projection-engine.js
 * @description Dynamic UI generation engine for HeadyBuddy.
 *   Produces optimal, Sacred-Geometry-aligned layout projections based on
 *   user preferences, device characteristics, role, subscription tier, and
 *   HeadyBee / HeadySwarm template configurations.
 *
 * @module onboarding/ui-projection-engine
 * @author HeadyConnection <eric@headyconnection.org>
 * @version 1.0.0
 */

import { HEADYBEE_TEMPLATES } from './headybee-ui-templates.js';

// ---------------------------------------------------------------------------
// Sacred Geometry Constants
// ---------------------------------------------------------------------------

/** φ — The Golden Ratio */
const PHI = 1.6180339887;

/** Inverse golden ratio (short side fraction) */
const PHI_INV = 1 / PHI;            // ≈ 0.618

/** Fibonacci sequence used for widget sizing / allocation scoring */
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/** Column counts that align with Fibonacci / Sacred Geometry principles */
const SACRED_COLUMN_COUNTS = new Set([1, 2, 3, 5, 8, 13]);

// ---------------------------------------------------------------------------
// Projection Types
// ---------------------------------------------------------------------------

/**
 * All supported projection layout archetypes.
 * @readonly
 * @enum {string}
 */
export const ProjectionType = Object.freeze({
  DASHBOARD:          'dashboard',
  COMPANION_CHAT:     'companion-chat',
  COMMAND_CENTER:     'command-center',
  MINIMAL:            'minimal',
  FOCUS:              'focus',
  CREATIVE_STUDIO:    'creative-studio',
  TRADING_DESK:       'trading-desk',
  DEVELOPER_CONSOLE:  'developer-console',
});

// ---------------------------------------------------------------------------
// Device breakpoints
// ---------------------------------------------------------------------------

const DEVICE_BREAKPOINTS = {
  mobile:  { maxWidth: 767,  columns: 1, sidebarMode: 'hidden',  navMode: 'bottom' },
  tablet:  { maxWidth: 1199, columns: 2, sidebarMode: 'overlay', navMode: 'side'   },
  desktop: { maxWidth: null, columns: 5, sidebarMode: 'fixed',   navMode: 'side'   },
};

// ---------------------------------------------------------------------------
// Behaviour pattern thresholds
// ---------------------------------------------------------------------------

const PATTERN_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// UIProjectionEngine
// ---------------------------------------------------------------------------

/**
 * @class UIProjectionEngine
 *
 * @description
 * Core engine that synthesises user preferences, device characteristics,
 * HeadyBee template registry data, and Sacred Geometry scoring into
 * concrete UI projection objects. A projection is a fully serialisable
 * descriptor that the headyme.com frontend uses to render the workspace.
 *
 * @example
 * const engine = new UIProjectionEngine({ redis, logger });
 * const projection = await engine.generateProjection({
 *   userId:     'user-123',
 *   templateId: 'heady-command-center',
 *   deviceInfo: { deviceType: 'desktop' },
 *   preferences: { theme: 'dark' },
 * });
 */
export class UIProjectionEngine {
  /**
   * @param {object}  opts
   * @param {import('redis').RedisClientType} [opts.redis]  - Optional Redis for caching
   * @param {object}  [opts.logger]                         - Pino / console compatible logger
   * @param {number}  [opts.cacheSeconds=300]               - Projection cache TTL
   */
  constructor({ redis = null, logger = console, cacheSeconds = 300 } = {}) {
    /** @private */ this._redis        = redis;
    /** @private */ this._logger       = logger;
    /** @private */ this._cacheTtl     = cacheSeconds;
    /** @private */ this._behaviorLog  = new Map(); // in-memory fallback
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generates a complete UI projection for the given context.
   *
   * @param {object}  opts
   * @param {string}  opts.userId
   * @param {string}  opts.templateId         - HeadyBee template ID
   * @param {object}  [opts.deviceInfo]       - Parsed device / UA info
   * @param {object}  [opts.preferences]      - User UI preferences
   * @param {string}  [opts.role]             - User role (admin / developer / analyst / etc.)
   * @param {string}  [opts.tier]             - Subscription tier (free / pro / enterprise)
   * @param {boolean} [opts.previewMode=false]
   * @returns {Promise<UIProjection>}
   */
  async generateProjection({
    userId,
    templateId,
    deviceInfo  = {},
    preferences = {},
    role        = 'user',
    tier        = 'free',
    previewMode = false,
  } = {}) {
    const cacheKey = this._projectionCacheKey(userId, templateId, deviceInfo.deviceType);

    if (!previewMode && this._redis) {
      const cached = await this._redis.get(cacheKey).catch(() => null);
      if (cached) {
        this._logger.debug({ userId, templateId }, '[UIProjection] Cache hit');
        return JSON.parse(cached);
      }
    }

    const template = HEADYBEE_TEMPLATES[templateId] ||
                     HEADYBEE_TEMPLATES['heady-onboarding-lite'];

    const device      = this._resolveDevice(deviceInfo);
    const colorScheme = this._buildColorScheme(template, preferences);
    const typography  = this._buildTypography(template, preferences);
    const grid        = this._buildGrid(template, device, preferences);
    const widgets     = this._placeWidgets(template, grid, device, tier);
    const navigation  = this._buildNavigation(template, device);
    const animations  = this._buildAnimations(template, preferences);
    const a11y        = this._buildAccessibility(preferences);
    const sgScore     = this.scoreTemplate(template, { device, preferences });

    const projection = {
      id:           `proj-${userId}-${templateId}-${Date.now()}`,
      userId,
      templateId,
      projectionType: template.projectionType || ProjectionType.DASHBOARD,
      generatedAt:   Date.now(),
      previewMode,

      // Core layout
      grid,
      widgets,
      navigation,

      // Visual
      colorScheme,
      typography,
      animations,

      // Accessibility
      a11y,

      // Meta
      device,
      role,
      tier,
      sacredGeometryScore: sgScore,

      // Dynamic re-projection config
      reProjectionTriggers: this._buildReProjectionTriggers(template),
    };

    if (!previewMode && this._redis) {
      await this._redis.set(cacheKey, JSON.stringify(projection), {
        EX: this._cacheTtl,
      }).catch(() => {/* non-fatal */});
    }

    this._logger.info({ userId, templateId, sgScore },
      '[UIProjection] Projection generated');

    return projection;
  }

  /**
   * Returns the optimal template ID for a given user context by scoring all
   * templates against the user's device, role, tier, and stated preferences.
   *
   * @param {object} context
   * @param {string} [context.role]
   * @param {string} [context.tier]
   * @param {object} [context.deviceInfo]
   * @param {object} [context.preferences]
   * @returns {string} Winning template ID
   */
  getOptimalLayout({ role = 'user', tier = 'free', deviceInfo = {}, preferences = {} } = {}) {
    const device    = this._resolveDevice(deviceInfo);
    let   bestId    = 'heady-onboarding-lite';
    let   bestScore = -Infinity;

    for (const [id, template] of Object.entries(HEADYBEE_TEMPLATES)) {
      const score = this.scoreTemplate(template, {
        device, preferences, role, tier,
      });
      if (score > bestScore) {
        bestScore = score;
        bestId    = id;
      }
    }

    this._logger.debug({ role, tier, bestId, bestScore },
      '[UIProjection] Optimal layout resolved');
    return bestId;
  }

  /**
   * Scores a template against a given context using Sacred Geometry principles.
   * Higher is better. Returns a float in [0, 100].
   *
   * Scoring dimensions:
   *   - Fibonacci column alignment                 (max 20)
   *   - Golden ratio widget area distribution      (max 25)
   *   - Role / tier match                          (max 20)
   *   - Device responsiveness penalty / bonus      (max 15)
   *   - Template's own sacredGeometryScore         (max 20)
   *
   * @param {object} template
   * @param {object} context
   * @returns {number}
   */
  scoreTemplate(template, { device = {}, preferences = {}, role = 'user', tier = 'free' } = {}) {
    let score = 0;

    // 1. Fibonacci column alignment
    const cols = template.widgetLayout?.columns || 3;
    if (SACRED_COLUMN_COUNTS.has(cols)) {
      const fibIdx = FIBONACCI.indexOf(cols);
      score += 20 * (fibIdx / (FIBONACCI.length - 1));
    }

    // 2. Golden ratio widget area distribution
    score += this._scoreWidgetAreaDistribution(template.widgetLayout?.widgets || []);

    // 3. Role & tier match
    const roleMatch = template.recommendedRoles?.includes(role?.toLowerCase())   ? 10 : 0;
    const tierMatch = template.recommendedTiers?.includes(tier?.toLowerCase())   ? 10 : 0;
    score += roleMatch + tierMatch;

    // 4. Device responsiveness
    const deviceType = device.deviceType || 'desktop';
    const hasResponsive = template.widgetLayout?.responsive?.[deviceType];
    score += hasResponsive ? 15 : 5;

    // 5. Template's own Sacred Geometry score (normalised to 20 pts)
    const sgRaw = template.sacredGeometryScore ?? 0; // assumed 0–100
    score += (sgRaw / 100) * 20;

    // Preference affinity bonuses
    if (preferences.theme && template.colorPalette?.defaultTheme === preferences.theme) {
      score += 3;
    }
    if (preferences.reducedMotion && template.animationPresets?.reducedMotionSupport) {
      score += 2;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Applies an already-generated projection, optionally storing it as the
   * user's active projection in Redis.
   *
   * @param {string}       userId
   * @param {UIProjection} projection
   * @returns {Promise<UIProjection>}
   */
  async applyProjection(userId, projection) {
    const key = `heady:projection:active:${userId}`;
    if (this._redis) {
      await this._redis.set(key, JSON.stringify(projection), {
        EX: 60 * 60 * 24, // 24h
      }).catch(() => {});
    }
    this._logger.info({ userId, projectionId: projection.id },
      '[UIProjection] Projection applied');
    return projection;
  }

  /**
   * Switches a user's active projection to a new template, invalidating
   * the cache and generating a fresh projection.
   *
   * @param {string} userId
   * @param {string} newTemplateId
   * @param {object} [opts]
   * @returns {Promise<UIProjection>}
   */
  async switchProjection(userId, newTemplateId, opts = {}) {
    // Invalidate cached projection for old template
    await this._invalidateProjectionCache(userId);

    const projection = await this.generateProjection({
      userId,
      templateId: newTemplateId,
      ...opts,
    });

    await this.applyProjection(userId, projection);
    return projection;
  }

  /**
   * Records a user behaviour event and triggers dynamic re-projection if
   * behaviour patterns suggest a different template would be optimal.
   *
   * @param {string} userId
   * @param {string} eventType - e.g. 'widget_resize', 'panel_close', 'focus_mode_enter'
   * @param {object} [meta={}]
   * @returns {Promise<{ reProjected: boolean, projection?: UIProjection }>}
   */
  async recordBehaviorEvent(userId, eventType, meta = {}) {
    const logKey = `heady:behavior:${userId}`;
    const event  = { eventType, meta, ts: Date.now() };

    if (this._redis) {
      await this._redis.rPush(logKey, JSON.stringify(event)).catch(() => {});
      await this._redis.expire(logKey, 60 * 60 * 24 * PATTERN_WINDOW_DAYS).catch(() => {});
    } else {
      const log = this._behaviorLog.get(userId) || [];
      log.push(event);
      this._behaviorLog.set(userId, log.slice(-200));
    }

    const pattern = await this._detectBehaviorPattern(userId);
    if (pattern?.suggestTemplate) {
      this._logger.info({ userId, pattern },
        '[UIProjection] Behavior pattern detected — re-projecting');
      const newProjection = await this.generateProjection({
        userId,
        templateId: pattern.suggestTemplate,
        ...(meta.deviceInfo ? { deviceInfo: meta.deviceInfo } : {}),
      });
      return { reProjected: true, projection: newProjection, pattern };
    }

    return { reProjected: false };
  }

  // -------------------------------------------------------------------------
  // Private: Grid Builder
  // -------------------------------------------------------------------------

  /**
   * Constructs the grid descriptor for a projection.
   * Uses Fibonacci-aligned column counts and golden-ratio row proportions.
   *
   * @private
   * @param {object} template
   * @param {object} device
   * @param {object} preferences
   * @returns {GridConfig}
   */
  _buildGrid(template, device, preferences) {
    const templateCols = template.widgetLayout?.columns || 5;
    const deviceCols   = DEVICE_BREAKPOINTS[device.deviceType]?.columns || templateCols;
    const columns      = Math.min(templateCols, deviceCols);

    // Row heights use Fibonacci multiples of the base unit
    const baseUnit = preferences.density === 'compact'  ? 48 :
                     preferences.density === 'spacious' ? 80 : 64;

    const rowHeights = FIBONACCI.slice(1, 6).map((f) => `${f * baseUnit}px`);

    const gap = Math.round(baseUnit * PHI_INV * 0.25);

    return {
      columns,
      rowHeights,
      gap:         `${gap}px`,
      baseUnit:    `${baseUnit}px`,
      goldenRatio: PHI,
      responsive:  this._buildResponsiveGrid(template, device),
    };
  }

  /**
   * Builds responsive grid overrides for non-desktop devices.
   * @private
   */
  _buildResponsiveGrid(template, device) {
    const overrides = {};
    for (const [bp, config] of Object.entries(DEVICE_BREAKPOINTS)) {
      overrides[bp] = {
        columns:     config.columns,
        sidebarMode: config.sidebarMode,
        navMode:     config.navMode,
        maxWidth:    config.maxWidth ? `${config.maxWidth}px` : 'none',
      };
    }
    return overrides;
  }

  // -------------------------------------------------------------------------
  // Private: Widget Placement
  // -------------------------------------------------------------------------

  /**
   * Positions all template widgets within the grid using Sacred Geometry
   * Fibonacci sizing rules.
   *
   * @private
   * @param {object} template
   * @param {GridConfig} grid
   * @param {object} device
   * @param {string} tier
   * @returns {WidgetPlacement[]}
   */
  _placeWidgets(template, grid, device, tier) {
    const widgets     = template.widgetLayout?.widgets || [];
    const tierWeights = { free: 0.5, pro: 0.75, enterprise: 1.0 };
    const tierWeight  = tierWeights[tier] || 0.5;

    return widgets
      .filter((w) => {
        // Exclude enterprise-only widgets for non-enterprise tiers
        if (w.requiredTier === 'enterprise' && tier !== 'enterprise') return false;
        if (w.requiredTier === 'pro' && tier === 'free')              return false;
        return true;
      })
      .map((w, idx) => {
        // Fibonacci-based column span
        const fibIdx   = idx % FIBONACCI.length;
        const maxSpan  = Math.min(grid.columns, 8);
        const rawSpan  = FIBONACCI[fibIdx % 6] || 1; // keep spans in [1,8]
        const colSpan  = Math.min(rawSpan, maxSpan);

        // Row span: golden ratio of colSpan
        const rowSpan  = Math.max(1, Math.round(colSpan * PHI_INV));

        // Priority (higher priority → closer to top-left)
        const priority = (w.priority || 5) * tierWeight;

        return {
          widgetId:    w.id,
          beeWorkerId: w.beeWorkerId,
          label:       w.label,
          colSpan,
          rowSpan,
          priority,
          minWidth:    w.minWidth  || `${colSpan * 120}px`,
          minHeight:   w.minHeight || `${rowSpan * 80}px`,
          resizable:   w.resizable ?? true,
          collapsible: w.collapsible ?? true,
          requiredTier: w.requiredTier || 'free',
          defaultVisible: w.defaultVisible ?? true,
          refreshIntervalMs: w.refreshIntervalMs || 30_000,
        };
      });
  }

  // -------------------------------------------------------------------------
  // Private: Navigation
  // -------------------------------------------------------------------------

  /**
   * Builds the navigation descriptor for a projection.
   * @private
   */
  _buildNavigation(template, device) {
    const deviceConfig = DEVICE_BREAKPOINTS[device.deviceType] ||
                         DEVICE_BREAKPOINTS.desktop;

    const items = (template.navigationItems || []).map((item) => ({
      id:       item.id,
      label:    item.label,
      icon:     item.icon,
      route:    item.route,
      badge:    item.badge || null,
      children: item.children || [],
    }));

    // Default nav items every template includes
    const defaultItems = [
      { id: 'dashboard',   label: 'Dashboard',   icon: 'layout-dashboard', route: '/dashboard' },
      { id: 'headybuddy',  label: 'HeadyBuddy',  icon: 'bot',              route: '/companion'  },
      { id: 'settings',    label: 'Settings',    icon: 'settings',         route: '/settings'   },
      { id: 'help',        label: 'Help',        icon: 'help-circle',      route: '/help'       },
    ];

    return {
      mode:        deviceConfig.navMode,
      sidebarMode: deviceConfig.sidebarMode,
      items:       items.length ? items : defaultItems,
      logoUrl:     '/assets/heady-logo.svg',
      collapsed:   device.deviceType === 'mobile',
    };
  }

  // -------------------------------------------------------------------------
  // Private: Visual
  // -------------------------------------------------------------------------

  /**
   * Builds the resolved colour scheme for a projection.
   * @private
   */
  _buildColorScheme(template, preferences) {
    const palette     = template.colorPalette || {};
    const theme       = preferences.theme || palette.defaultTheme || 'dark';
    const accentColor = preferences.colorAccent || palette.accent || '#6366f1';

    const darkTokens = {
      background:  palette.dark?.background  || '#0a0a0f',
      surface:     palette.dark?.surface     || '#12121a',
      border:      palette.dark?.border      || '#1e1e2e',
      text:        palette.dark?.text        || '#e2e8f0',
      textMuted:   palette.dark?.textMuted   || '#64748b',
      accent,
    };

    const lightTokens = {
      background:  palette.light?.background  || '#f8fafc',
      surface:     palette.light?.surface     || '#ffffff',
      border:      palette.light?.border      || '#e2e8f0',
      text:        palette.light?.text        || '#0f172a',
      textMuted:   palette.light?.textMuted   || '#64748b',
      accent,
    };

    function accent() { return accentColor; }

    return {
      theme,
      tokens: theme === 'light' ? lightTokens : darkTokens,
      accent: accentColor,
      highContrast: preferences.highContrast || false,
      cssVars: this._buildCssVars(
        theme === 'light' ? lightTokens : darkTokens, accentColor,
      ),
    };
  }

  /**
   * Converts token map to CSS custom property declarations.
   * @private
   */
  _buildCssVars(tokens, accent) {
    return {
      '--heady-bg':          tokens.background,
      '--heady-surface':     tokens.surface,
      '--heady-border':      tokens.border,
      '--heady-text':        tokens.text,
      '--heady-text-muted':  tokens.textMuted,
      '--heady-accent':      accent,
      '--heady-phi':         String(PHI),
      '--heady-phi-inv':     String(PHI_INV),
    };
  }

  /**
   * Builds the typography descriptor.
   * @private
   */
  _buildTypography(template, preferences) {
    const typo = template.typography || {};
    return {
      fontFamily:    typo.fontFamily    || '"Inter var", Inter, system-ui, sans-serif',
      monoFamily:    typo.monoFamily    || '"JetBrains Mono", "Fira Code", monospace',
      baseSizePx:    typo.baseSizePx    || 14,
      scaleRatio:    typo.scaleRatio    || PHI_INV + 0.5, // ~1.118 — minor 2nd
      lineHeight:    typo.lineHeight    || PHI_INV + 1,   // ≈ 1.618 — golden
      headingWeight: typo.headingWeight || 600,
      bodyWeight:    typo.bodyWeight    || 400,
    };
  }

  /**
   * Builds the animation preset descriptor.
   * @private
   */
  _buildAnimations(template, preferences) {
    const presets = template.animationPresets || {};
    const reduced = preferences.reducedMotion || false;

    return {
      enabled:        !reduced,
      reducedMotion:  reduced,
      durationFast:   reduced ? '0ms' : presets.durationFast   || '150ms',
      durationNormal: reduced ? '0ms' : presets.durationNormal || '250ms',
      durationSlow:   reduced ? '0ms' : presets.durationSlow   || '400ms',
      easing:         presets.easing  || 'cubic-bezier(0.4, 0, 0.2, 1)',
      easingBounce:   presets.easingBounce || 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      particlesEnabled: !reduced && (presets.particles || false),
    };
  }

  /**
   * Builds accessibility feature flags.
   * @private
   */
  _buildAccessibility(preferences) {
    return {
      highContrast:      preferences.highContrast      || false,
      reducedMotion:     preferences.reducedMotion     || false,
      screenReaderMode:  preferences.screenReaderMode  || false,
      focusRingVisible:  preferences.focusRingVisible  ?? true,
      keyboardNavEnabled: true,
      ariaLiveRegions:   true,
      minimumTouchTarget: '44px',
    };
  }

  // -------------------------------------------------------------------------
  // Private: Re-Projection
  // -------------------------------------------------------------------------

  /**
   * Builds the re-projection trigger rules for a template.
   * @private
   */
  _buildReProjectionTriggers(template) {
    return [
      {
        trigger:          'device_orientation_change',
        action:           'regenerate',
        debounceMs:       500,
      },
      {
        trigger:          'window_resize',
        action:           'reflow_widgets',
        debounceMs:       200,
      },
      {
        trigger:          'preference_change',
        action:           'apply_theme',
        debounceMs:       100,
      },
      {
        trigger:          'behavior_pattern_detected',
        action:           'suggest_template_switch',
        confidenceThreshold: 0.75,
      },
      ...(template.customTriggers || []),
    ];
  }

  /**
   * Analyses stored behaviour events to detect patterns.
   * @private
   */
  async _detectBehaviorPattern(userId) {
    const logKey = `heady:behavior:${userId}`;
    let events   = [];

    if (this._redis) {
      const raw = await this._redis.lRange(logKey, -100, -1).catch(() => []);
      events = raw.map((r) => { try { return JSON.parse(r); } catch { return null; } })
                  .filter(Boolean);
    } else {
      events = this._behaviorLog.get(userId) || [];
    }

    // Focus mode pattern: user frequently closes panels
    const closeCount = events.filter((e) => e.eventType === 'panel_close').length;
    if (closeCount >= 5) {
      return { suggestTemplate: 'heady-focus-mode', confidence: 0.8, reason: 'frequent_panel_close' };
    }

    // Developer pattern: code widget opened frequently
    const codeEvents = events.filter((e) => e.eventType === 'widget_expand' &&
                                            e.meta?.widgetId?.includes('code'));
    if (codeEvents.length >= 3) {
      return { suggestTemplate: 'heady-developer-console', confidence: 0.75, reason: 'code_heavy_usage' };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Private: Scoring helpers
  // -------------------------------------------------------------------------

  /**
   * Scores widget area distribution against golden ratio.
   * Compares the ratio of total primary widget area to secondary widget area.
   *
   * @private
   * @param {object[]} widgets
   * @returns {number} 0–25
   */
  _scoreWidgetAreaDistribution(widgets) {
    if (!widgets.length) return 0;

    const sorted    = [...widgets].sort((a, b) => (b.priority || 5) - (a.priority || 5));
    const primary   = sorted.slice(0, Math.ceil(sorted.length * PHI_INV));
    const secondary = sorted.slice(Math.ceil(sorted.length * PHI_INV));

    if (!secondary.length) return 12.5;

    const primaryArea   = primary.reduce((acc, w)   => acc + ((w.colSpan || 1) * (w.rowSpan || 1)), 0);
    const secondaryArea = secondary.reduce((acc, w) => acc + ((w.colSpan || 1) * (w.rowSpan || 1)), 0);

    const ratio    = primaryArea / secondaryArea;
    const delta    = Math.abs(ratio - PHI);
    const maxDelta = PHI * 2;
    const norm     = Math.max(0, 1 - delta / maxDelta);
    return norm * 25;
  }

  // -------------------------------------------------------------------------
  // Private: Utility
  // -------------------------------------------------------------------------

  /**
   * Resolves a normalised device descriptor from raw device info.
   * @private
   */
  _resolveDevice(deviceInfo = {}) {
    const type       = deviceInfo.deviceType || 'desktop';
    const bpConfig   = DEVICE_BREAKPOINTS[type] || DEVICE_BREAKPOINTS.desktop;
    return {
      deviceType:   type,
      screenWidth:  deviceInfo.screenWidth  || null,
      screenHeight: deviceInfo.screenHeight || null,
      ...bpConfig,
    };
  }

  /**
   * Redis cache key for a user projection.
   * @private
   */
  _projectionCacheKey(userId, templateId, deviceType = 'desktop') {
    return `heady:projection:cache:${userId}:${templateId}:${deviceType}`;
  }

  /**
   * Invalidates all cached projections for a user.
   * @private
   */
  async _invalidateProjectionCache(userId) {
    if (!this._redis) return;
    const pattern = `heady:projection:cache:${userId}:*`;
    try {
      const keys = await this._redis.keys(pattern);
      if (keys.length) await this._redis.del(keys);
    } catch (err) {
      this._logger.warn({ err }, '[UIProjection] Cache invalidation failed');
    }
  }
}

// ---------------------------------------------------------------------------
// JSDoc typedefs
// ---------------------------------------------------------------------------

/**
 * @typedef {object} UIProjection
 * @property {string}       id
 * @property {string}       userId
 * @property {string}       templateId
 * @property {string}       projectionType
 * @property {number}       generatedAt
 * @property {boolean}      previewMode
 * @property {GridConfig}   grid
 * @property {WidgetPlacement[]} widgets
 * @property {object}       navigation
 * @property {object}       colorScheme
 * @property {object}       typography
 * @property {object}       animations
 * @property {object}       a11y
 * @property {object}       device
 * @property {string}       role
 * @property {string}       tier
 * @property {number}       sacredGeometryScore
 * @property {object[]}     reProjectionTriggers
 */

/**
 * @typedef {object} GridConfig
 * @property {number}   columns
 * @property {string[]} rowHeights
 * @property {string}   gap
 * @property {string}   baseUnit
 * @property {number}   goldenRatio
 * @property {object}   responsive
 */

/**
 * @typedef {object} WidgetPlacement
 * @property {string}  widgetId
 * @property {string}  beeWorkerId
 * @property {string}  label
 * @property {number}  colSpan
 * @property {number}  rowSpan
 * @property {number}  priority
 * @property {string}  minWidth
 * @property {string}  minHeight
 * @property {boolean} resizable
 * @property {boolean} collapsible
 * @property {string}  requiredTier
 * @property {boolean} defaultVisible
 * @property {number}  refreshIntervalMs
 */
