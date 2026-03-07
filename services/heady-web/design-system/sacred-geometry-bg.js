/**
 * HeadySystems Sacred Geometry Animated Background
 * A4 sacred-geometry-bg.js — v1.0.0
 *
 * Standalone, zero-dependency canvas-based sacred geometry background renderer.
 * Draws golden spirals, Fibonacci sequences, rotating geometric patterns,
 * and a connected particle network with φ-spaced nodes.
 *
 * Features:
 *   - Fibonacci lattice particle distribution
 *   - Golden spiral (logarithmic, r = a·e^bθ where b = ln(φ)/(π/2))
 *   - Flower of Life geometry
 *   - Metatron's Cube outline
 *   - Nested rotating polygons (3, 5, 6, 8, 13 sides)
 *   - Connected particle network with proximity-based opacity
 *   - Subtle glow halos using radial gradients
 *   - Performance-optimized with requestAnimationFrame + dirty-flag
 *   - Configurable via data attributes OR JS constructor
 *   - Responsive via ResizeObserver
 *   - Reduced-motion support
 *
 * Usage — Automatic (data attributes):
 *   <canvas id="my-bg"
 *     data-heady-sacred
 *     data-accent-color="#2dd4bf"
 *     data-secondary-color="#8b5cf6"
 *     data-node-count="89"
 *     data-speed="1.0"
 *     data-opacity="0.8"
 *     data-show-spirals="true"
 *     data-show-geometry="true"
 *     data-show-nodes="true"
 *     data-show-metatron="false">
 *   </canvas>
 *   <script src="sacred-geometry-bg.js"></script>
 *
 * Usage — Programmatic:
 *   const bg = new SacredGeometryBg(document.getElementById('canvas'), {
 *     accentColor: '#2dd4bf',
 *     nodeCount: 55,
 *   });
 *   bg.start();
 *   // Later:
 *   bg.stop();
 *   bg.setConfig({ speed: 0.5 });
 */

/* global define */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SacredGeometryBg = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ─── Sacred Constants ────────────────────────────────────── */
  const PHI        = 1.618033988749895;
  const PHI_INV    = 0.6180339887498949;    // 1/φ
  const PHI_SQ     = 2.6180339887498953;    // φ²
  const TAU        = Math.PI * 2;
  const GOLDEN_ANG = TAU * PHI_INV;         // ≈ 2.399 rad — the golden angle

  /**
   * Fibonacci sequence cache (first 20 values)
   */
  const FIB = (function () {
    const a = [1, 1];
    for (let i = 2; i < 20; i++) a.push(a[i-1] + a[i-2]);
    return a;
  }());

  /* ─── Color Helpers ───────────────────────────────────────── */
  function hexToRgb(hex) {
    const clean = hex.replace(/^#/, '');
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean;
    return {
      r: parseInt(full.slice(0,2), 16),
      g: parseInt(full.slice(2,4), 16),
      b: parseInt(full.slice(4,6), 16),
    };
  }

  function rgba(rgb, a) {
    return `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  /**
   * Lerp between two RGB colors
   */
  function lerpRgb(a, b, t) {
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  /* ─── Default Configuration ───────────────────────────────── */
  const DEFAULTS = {
    accentColor:      '#20808d',
    accentColorLight: '#2dd4bf',
    secondaryColor:   '#8b5cf6',
    goldColor:        '#d4a843',

    // Particle network
    nodeCount:        89,          // Fibonacci
    connectDistance:  144,         // Fibonacci
    nodeSpeed:        0.25,
    nodeMinRadius:    1.0,
    nodeMaxRadius:    3.0,

    // Global modifiers
    speed:            1.0,
    opacity:          0.75,

    // Layer toggles
    showSpirals:      true,
    showGeometry:     true,
    showNodes:        true,
    showMetatron:     false,   // Metatron's Cube (heavy — off by default)
    showVortex:       true,    // Subtle vortex gradient overlay

    // Background
    backgroundColor:  'transparent',  // 'transparent' or a CSS color
  };

  /* ─── SacredGeometryBg Class ──────────────────────────────── */
  function SacredGeometryBg(canvas, userConfig) {
    if (!(this instanceof SacredGeometryBg)) {
      return new SacredGeometryBg(canvas, userConfig);
    }

    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.cfg    = Object.assign({}, DEFAULTS, userConfig);

    // Internal state
    this._running  = false;
    this._rafId    = null;
    this._t        = 0;       // time in seconds
    this._lastTs   = 0;
    this._nodes    = [];
    this._w        = 0;
    this._h        = 0;
    this._prefersReducedMotion = (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    // Precompute colors
    this._updateColors();

    // Bind methods
    this._frame   = this._frame.bind(this);
    this._resize  = this._resize.bind(this);

    // Setup resize handling
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(canvas.parentElement || canvas);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resize);
    }

    this._resize();
  }

  /* ── Public API ── */

  SacredGeometryBg.prototype.start = function () {
    if (this._running) return this;
    this._running = true;
    this._lastTs  = performance.now();
    this._rafId   = requestAnimationFrame(this._frame);
    return this;
  };

  SacredGeometryBg.prototype.stop = function () {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    return this;
  };

  SacredGeometryBg.prototype.destroy = function () {
    this.stop();
    if (this._ro) this._ro.disconnect();
    else if (typeof window !== 'undefined') window.removeEventListener('resize', this._resize);
    this.ctx.clearRect(0, 0, this._w, this._h);
  };

  /**
   * Update configuration at runtime.
   * @param {Object} newCfg
   */
  SacredGeometryBg.prototype.setConfig = function (newCfg) {
    Object.assign(this.cfg, newCfg);
    this._updateColors();
    if (newCfg.nodeCount !== undefined) this._initNodes();
    return this;
  };

  /* ── Private: Color precomputation ── */

  SacredGeometryBg.prototype._updateColors = function () {
    this._accent    = hexToRgb(this.cfg.accentColor);
    this._accentL   = hexToRgb(this.cfg.accentColorLight);
    this._secondary = hexToRgb(this.cfg.secondaryColor);
    this._gold      = hexToRgb(this.cfg.goldColor);
  };

  /* ── Private: Resize ── */

  SacredGeometryBg.prototype._resize = function () {
    const c = this.canvas;
    const parent = c.parentElement;
    const dpr    = Math.min(window.devicePixelRatio || 1, 2);

    // Use offsetWidth/Height of parent or canvas element
    const displayW = (parent ? parent.offsetWidth  : c.offsetWidth)  || window.innerWidth;
    const displayH = (parent ? parent.offsetHeight : c.offsetHeight) || window.innerHeight;

    c.width  = Math.round(displayW * dpr);
    c.height = Math.round(displayH * dpr);
    c.style.width  = displayW + 'px';
    c.style.height = displayH + 'px';

    this.ctx.scale(dpr, dpr);
    this._w   = displayW;
    this._h   = displayH;
    this._dpr = dpr;

    this._initNodes();
  };

  /* ── Private: Node initialization ── */

  SacredGeometryBg.prototype._initNodes = function () {
    const w    = this._w;
    const h    = this._h;
    const count = this.cfg.nodeCount;

    this._nodes = [];

    for (let i = 0; i < count; i++) {
      // Fibonacci lattice (sunflower distribution)
      const frac   = i / count;
      const r      = Math.sqrt(frac) * Math.min(w, h) * 0.47;
      const angle  = i * GOLDEN_ANG;

      this._nodes.push({
        x:     w * 0.5 + Math.cos(angle) * r,
        y:     h * 0.5 + Math.sin(angle) * r,
        vx:    (Math.random() - 0.5) * this.cfg.nodeSpeed * this.cfg.speed,
        vy:    (Math.random() - 0.5) * this.cfg.nodeSpeed * this.cfg.speed,
        // Unique oscillation per node using φ-multiples
        phase: (i * PHI_INV * TAU) % TAU,
        freq:  0.4 + (i % FIB[7]) / FIB[7] * 1.2,   // 0.4 – 1.6 Hz
        baseR: this.cfg.nodeMinRadius + (i % FIB[5]) / FIB[5] * (this.cfg.nodeMaxRadius - this.cfg.nodeMinRadius),
        // Assign color band: 0=accent, 1=secondary, 2=gold, using φ-partition
        colorBand: i % 3,
      });
    }
  };

  /* ── Private: Animation frame ── */

  SacredGeometryBg.prototype._frame = function (timestamp) {
    if (!this._running) return;

    const dt = Math.min((timestamp - this._lastTs) / 1000, 0.05);
    this._lastTs = timestamp;

    // Reduced-motion: draw one static frame, then stop animating
    if (this._prefersReducedMotion) {
      this._draw(0);
      return; // don't schedule next frame
    }

    this._t += dt * this.cfg.speed;
    this._draw(dt);

    this._rafId = requestAnimationFrame(this._frame);
  };

  /* ── Private: Main draw ── */

  SacredGeometryBg.prototype._draw = function (dt) {
    const ctx = this.ctx;
    const w   = this._w;
    const h   = this._h;
    const t   = this._t;
    const cfg = this.cfg;
    const op  = cfg.opacity;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (cfg.backgroundColor !== 'transparent') {
      ctx.fillStyle = cfg.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    // Layer order: geometry first, then spirals, then particles on top
    if (cfg.showVortex)    this._drawVortex();
    if (cfg.showGeometry)  this._drawGeometry();
    if (cfg.showMetatron)  this._drawMetatron();
    if (cfg.showSpirals)   this._drawSpirals();
    if (cfg.showNodes) {
      this._updateNodes(dt);
      this._drawConnections();
      this._drawNodes();
    }
  };

  /* ── Vortex background gradient ── */

  SacredGeometryBg.prototype._drawVortex = function () {
    const ctx = this.ctx;
    const w   = this._w;
    const h   = this._h;
    const t   = this._t;
    const cx  = w * 0.5;
    const cy  = h * 0.5;

    // Slowly rotating radial gradient overlay
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    grd.addColorStop(0,   rgba(this._accent, 0.06 * this.cfg.opacity));
    grd.addColorStop(0.38, rgba(this._secondary, 0.03 * this.cfg.opacity));
    grd.addColorStop(0.618, rgba(this._gold, 0.02 * this.cfg.opacity));
    grd.addColorStop(1,   rgba(this._accent, 0));

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  /* ── Golden Spirals ── */

  SacredGeometryBg.prototype._drawSpirals = function () {
    const ctx  = this.ctx;
    const w    = this._w;
    const h    = this._h;
    const t    = this._t;
    const cx   = w * 0.5;
    const cy   = h * 0.5;
    const dim  = Math.min(w, h);

    // Logarithmic spiral: r = a * e^(b*θ)
    // b = ln(φ) / (π/2) ≈ 0.306 — this produces the "golden" growth rate
    const b = Math.log(PHI) / (Math.PI / 2);

    const drawSpiral = (cx, cy, scale, startAngle, color, alpha, clockwise) => {
      const a      = scale * 0.005;
      const maxTh  = Math.PI * 10;     // 5 full turns
      const steps  = 500;
      const dir    = clockwise ? 1 : -1;

      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = dir * (i / steps) * maxTh + startAngle;
        const r     = a * Math.exp(b * (i / steps) * maxTh);
        const x     = cx + r * Math.cos(theta);
        const y     = cy + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Gradient along spiral: transparent → color → transparent
      const endR = a * Math.exp(b * maxTh);
      const grd  = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(endR, scale));
      grd.addColorStop(0,   rgba(color, 0));
      grd.addColorStop(0.3, rgba(color, alpha * 0.5));
      grd.addColorStop(0.7, rgba(color, alpha));
      grd.addColorStop(1,   rgba(color, 0));

      ctx.strokeStyle = grd;
      ctx.lineWidth   = 1.0;
      ctx.stroke();
    };

    // Primary CCW spiral — accent color
    drawSpiral(cx, cy, dim * 0.6, t * 0.03, this._accentL, 0.18 * this.cfg.opacity, false);

    // Secondary CW spiral — secondary color, offset by π
    drawSpiral(cx, cy, dim * 0.6, t * -0.025 + Math.PI, this._secondary, 0.12 * this.cfg.opacity, true);

    // Corner spirals at golden-ratio intersections
    const offX = w * PHI_INV;
    const offY = h * PHI_INV;
    const smallScale = dim * 0.28;

    drawSpiral(offX, offY, smallScale, t * 0.05, this._gold, 0.09 * this.cfg.opacity, false);
    drawSpiral(w - offX, h - offY, smallScale, t * -0.04, this._accent, 0.08 * this.cfg.opacity, true);
    drawSpiral(w - offX, offY, smallScale, t * 0.035 + Math.PI, this._secondary, 0.07 * this.cfg.opacity, false);
    drawSpiral(offX, h - offY, smallScale, t * -0.03, this._gold, 0.07 * this.cfg.opacity, true);
  };

  /* ── Sacred Geometry Overlays ── */

  SacredGeometryBg.prototype._drawGeometry = function () {
    const ctx = this.ctx;
    const w   = this._w;
    const h   = this._h;
    const t   = this._t;
    const cx  = w * 0.5;
    const cy  = h * 0.5;
    const dim = Math.min(w, h);
    const op  = this.cfg.opacity;

    /* Nested rotating polygons
       Sides follow Fibonacci: 3, 5, 8, 13 — each rotates at different φ-multiple speed
    */
    const polygons = [
      { sides:  3, r: dim * 0.42, rotSpeed:  0.009, color: this._accent,    alpha: 0.05 * op },
      { sides:  5, r: dim * 0.35, rotSpeed: -0.007, color: this._secondary, alpha: 0.045 * op },
      { sides:  6, r: dim * 0.50, rotSpeed:  0.005, color: this._gold,      alpha: 0.035 * op },
      { sides:  3, r: dim * 0.25, rotSpeed: -0.012, color: this._accentL,   alpha: 0.06 * op },
      { sides:  8, r: dim * 0.56, rotSpeed:  0.004, color: this._secondary, alpha: 0.025 * op },
      { sides: 13, r: dim * 0.62, rotSpeed: -0.003, color: this._gold,      alpha: 0.02 * op },
    ];

    polygons.forEach(p => {
      const angle = t * p.rotSpeed;
      ctx.beginPath();
      for (let i = 0; i <= p.sides; i++) {
        const a = (i / p.sides) * TAU + angle;
        const x = cx + p.r * Math.cos(a);
        const y = cy + p.r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(p.color, p.alpha);
      ctx.lineWidth   = 0.7;
      ctx.stroke();
    });

    /* Flower of Life — 7 overlapping circles */
    this._drawFlowerOfLife(cx, cy, dim * 0.14, t * 0.015, op);

    /* Fibonacci arc series */
    this._drawFibonacciArcs(cx, cy, dim * 0.08, t * 0.008, op);
  };

  /**
   * Draw 7-circle Flower of Life
   */
  SacredGeometryBg.prototype._drawFlowerOfLife = function (cx, cy, r, rotation, op) {
    const ctx = this.ctx;

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = rgba(this._accent, 0.06 * op);
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // 6 surrounding circles (Flower of Life)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU + rotation;
      const ox = cx + r * Math.cos(angle);
      const oy = cy + r * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.strokeStyle = rgba(i % 2 === 0 ? this._accent : this._secondary, 0.045 * op);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // Outer bounding circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2, 0, TAU);
    ctx.strokeStyle = rgba(this._gold, 0.04 * op);
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    // Vesica piscis cross-connections (2 primary)
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * TAU + rotation;
      const a2 = ((i + 1) / 6) * TAU + rotation;
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      ctx.strokeStyle = rgba(this._secondary, 0.04 * op);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  };

  /**
   * Draw a Fibonacci golden rectangle spiral (square series)
   */
  SacredGeometryBg.prototype._drawFibonacciArcs = function (cx, cy, unit, rotation, op) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Draw 8 Fibonacci quarter-circles
    let x = 0, y = 0;
    const dirs = [
      [1, 0, 3],   // arc center offsets and start-angle multiplier
      [0, 1, 0],
      [-1, 0, 1],
      [0, -1, 2],
    ];

    let a = 1, b = 1;
    for (let i = 0; i < 8; i++) {
      const dir = dirs[i % 4];
      const r   = a * unit;
      const startA = dir[2] * Math.PI / 2;
      const endA   = startA + Math.PI / 2;

      ctx.beginPath();
      const arcAlpha = (0.05 + i * 0.01) * op;
      ctx.arc(
        x + dir[0] * r,
        y + dir[1] * r,
        r, startA, endA
      );
      ctx.strokeStyle = rgba(i % 2 === 0 ? this._accent : this._gold, arcAlpha);
      ctx.lineWidth   = 0.8;
      ctx.stroke();

      // Move to next Fibonacci square
      x += dir[0] * (a + b) * unit * 0;   // simplified: just scale
      const temp = a + b; a = b; b = temp;
    }

    ctx.restore();
  };

  /* ── Metatron's Cube ── */

  SacredGeometryBg.prototype._drawMetatron = function () {
    const ctx  = this.ctx;
    const w    = this._w;
    const h    = this._h;
    const t    = this._t;
    const cx   = w * 0.5;
    const cy   = h * 0.5;
    const dim  = Math.min(w, h);
    const R    = dim * 0.3;
    const op   = this.cfg.opacity * 0.05;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.005);

    // 13 circles of Metatron's Cube
    const centers = [{ x: 0, y: 0 }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      centers.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + TAU / 12;
      centers.push({ x: R * Math.sqrt(3) * Math.cos(a), y: R * Math.sqrt(3) * Math.sin(a) });
    }

    // Draw circles
    centers.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, TAU);
      ctx.strokeStyle = rgba(i === 0 ? this._accent : this._secondary, op * 0.6);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // Draw connecting lines (Metatron structure)
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < Math.min(centers.length, 13); j++) {
        ctx.beginPath();
        ctx.moveTo(centers[i].x, centers[i].y);
        ctx.lineTo(centers[j].x, centers[j].y);
        ctx.strokeStyle = rgba(this._gold, op * 0.4);
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  /* ── Node Physics ── */

  SacredGeometryBg.prototype._updateNodes = function (dt) {
    const w   = this._w;
    const h   = this._h;
    const spd = this.cfg.speed;
    const mg  = 60;    // margin before soft-bounce

    this._nodes.forEach(n => {
      n.x += n.vx * dt * 60 * spd;
      n.y += n.vy * dt * 60 * spd;

      if (n.x < mg)     { n.vx = Math.abs(n.vx); }
      if (n.x > w - mg) { n.vx = -Math.abs(n.vx); }
      if (n.y < mg)     { n.vy = Math.abs(n.vy); }
      if (n.y > h - mg) { n.vy = -Math.abs(n.vy); }
    });
  };

  /* ── Connections between nodes ── */

  SacredGeometryBg.prototype._drawConnections = function () {
    const ctx   = this.ctx;
    const nodes = this._nodes;
    const dist  = this.cfg.connectDistance;
    const dist2 = dist * dist;
    const op    = this.cfg.opacity;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a  = nodes[i];
        const b  = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;

        if (d2 >= dist2) continue;

        const prox  = 1 - d2 / dist2;
        const alpha = prox * prox * 0.28 * op;   // quadratic falloff

        // Color based on average color bands
        const bandA = a.colorBand;
        const bandB = b.colorBand;
        const colors = [this._accentL, this._secondary, this._gold];
        const cA = colors[bandA];
        const cB = colors[bandB];

        const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grd.addColorStop(0, rgba(cA, alpha));
        grd.addColorStop(1, rgba(cB, alpha));

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grd;
        ctx.lineWidth   = prox * 1.4;
        ctx.stroke();
      }
    }
  };

  /* ── Node rendering with glow ── */

  SacredGeometryBg.prototype._drawNodes = function () {
    const ctx   = this.ctx;
    const nodes = this._nodes;
    const t     = this._t;
    const op    = this.cfg.opacity;
    const colors = [this._accentL, this._secondary, this._gold];

    nodes.forEach(n => {
      const pulse = 0.5 + 0.5 * Math.sin(t * n.freq + n.phase);
      const r     = n.baseR * (1 + pulse * 0.5);
      const alpha = (0.35 + pulse * 0.55) * op;
      const rgb   = colors[n.colorBand];

      // Glow halo (radial gradient)
      const glowR = r * 5;
      const grd   = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      grd.addColorStop(0,    rgba(rgb, alpha * 0.9));
      grd.addColorStop(0.35, rgba(rgb, alpha * 0.35));
      grd.addColorStop(0.7,  rgba(rgb, alpha * 0.08));
      grd.addColorStop(1,    rgba(rgb, 0));

      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, TAU);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fillStyle = rgba(rgb, alpha);
      ctx.fill();
    });
  };

  /* ─── Auto-init on DOMContentLoaded ─────────────────────── */

  /**
   * Scan the DOM for canvas elements with [data-heady-sacred]
   * and auto-initialize SacredGeometryBg on each.
   */
  function autoInit() {
    document.querySelectorAll('canvas[data-heady-sacred]').forEach(canvas => {
      const d = canvas.dataset;

      const config = {
        accentColor:      d.accentColor      || DEFAULTS.accentColor,
        accentColorLight: d.accentColorLight || DEFAULTS.accentColorLight,
        secondaryColor:   d.secondaryColor   || DEFAULTS.secondaryColor,
        goldColor:        d.goldColor        || DEFAULTS.goldColor,
        nodeCount:        d.nodeCount        ? parseInt(d.nodeCount, 10)        : DEFAULTS.nodeCount,
        connectDistance:  d.connectDistance  ? parseInt(d.connectDistance, 10)  : DEFAULTS.connectDistance,
        speed:            d.speed            ? parseFloat(d.speed)              : DEFAULTS.speed,
        opacity:          d.opacity          ? parseFloat(d.opacity)            : DEFAULTS.opacity,
        showSpirals:      d.showSpirals      !== 'false',
        showGeometry:     d.showGeometry     !== 'false',
        showNodes:        d.showNodes        !== 'false',
        showMetatron:     d.showMetatron     === 'true',
        showVortex:       d.showVortex       !== 'false',
        backgroundColor:  d.backgroundColor  || DEFAULTS.backgroundColor,
      };

      const instance = new SacredGeometryBg(canvas, config);
      instance.start();

      // Store reference on element
      canvas._sacredGeoBg = instance;
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      // Already loaded
      setTimeout(autoInit, 0);
    }
  }

  /* ─── Exports ─────────────────────────────────────────────── */
  SacredGeometryBg.autoInit = autoInit;
  SacredGeometryBg.PHI      = PHI;
  SacredGeometryBg.PHI_INV  = PHI_INV;
  SacredGeometryBg.FIB      = FIB;
  SacredGeometryBg.DEFAULTS = DEFAULTS;

  return SacredGeometryBg;
}));
