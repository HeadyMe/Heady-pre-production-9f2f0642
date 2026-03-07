/**
 * HeadySystems Sacred Geometry Design System
 * A4 Animation Library — v1.0.0
 *
 * Provides:
 *   - HeadyAnimations.init()          — auto-init all features
 *   - HeadyAnimations.scrollReveal()  — IntersectionObserver-based reveals
 *   - HeadyAnimations.counters()      — Animated number counters
 *   - HeadyAnimations.particles()     — Sacred geometry canvas background
 *   - HeadyAnimations.pageTransition()— Page enter/exit animations
 *   - HeadyAnimations.hoverEffects()  — Card and button hover enhancements
 *   - HeadyAnimations.loadingSpinner()— Geometric spinner factory
 *   - HeadyAnimations.easing         — φ-based easing functions
 *
 * Golden Ratio: φ = 1.618033988749895
 * Fibonacci durations (ms): 89, 144, 233, 377, 610, 987
 *
 * Usage:
 *   <script src="animations.js"></script>
 *   <script>HeadyAnimations.init();</script>
 */

(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.HeadyAnimations = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ─── Constants ──────────────────────────────────────────── */
  const PHI = 1.618033988749895;
  const PHI_INV = 0.6180339887498949;
  const TWO_PI = Math.PI * 2;

  /** Fibonacci sequence for timing and spacing */
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

  /* ─── φ-Based Easing Functions ───────────────────────────── */
  const easing = {
    /**
     * Golden ease out — fast start, decelerates to φ-proportioned rest
     * @param {number} t 0..1
     * @returns {number}
     */
    goldenOut(t) {
      const c1 = PHI_INV;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    /**
     * Golden ease in
     * @param {number} t
     */
    goldenIn(t) {
      return 1 - easing.goldenOut(1 - t);
    },

    /**
     * Golden ease in-out — symmetric φ curve
     */
    goldenInOut(t) {
      return t < 0.5
        ? easing.goldenIn(t * 2) / 2
        : (easing.goldenOut(t * 2 - 1) + 1) / 2;
    },

    /**
     * Spring — slight overshoot, φ-tuned
     */
    spring(t) {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0
        : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },

    /**
     * Linear
     */
    linear(t) {
      return t;
    },
  };

  /* ─── Animation Utilities ────────────────────────────────── */
  /**
   * Lightweight tweening engine using requestAnimationFrame
   * @param {Object} opts
   * @param {number} opts.from
   * @param {number} opts.to
   * @param {number} opts.duration — milliseconds
   * @param {Function} opts.ease
   * @param {Function} opts.onUpdate — called with current value
   * @param {Function} [opts.onComplete]
   * @returns {{ cancel: Function }} — cancel handle
   */
  function tween({ from, to, duration, ease = easing.goldenOut, onUpdate, onComplete }) {
    let startTime = null;
    let rafId;
    let cancelled = false;

    function step(timestamp) {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = from + (to - from) * ease(progress);

      onUpdate(value);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        onUpdate(to);
        if (onComplete) onComplete();
      }
    }

    rafId = requestAnimationFrame(step);

    return {
      cancel() {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  }

  /**
   * Stagger a set of elements with φ-based delay
   * @param {Element[]} elements
   * @param {Function} fn — called with (element, index, delay)
   * @param {number} [baseDelay=55] — ms per step
   */
  function stagger(elements, fn, baseDelay = 55) {
    elements.forEach((el, i) => {
      const delay = baseDelay * i;
      setTimeout(() => fn(el, i, delay), delay);
    });
  }

  /* ─── Scroll Reveal ──────────────────────────────────────── */
  /**
   * Activate IntersectionObserver-based reveal animations.
   * Watches [data-reveal] and [data-reveal-stagger] elements.
   * CSS transitions handle the actual animation (see components.css).
   *
   * @param {Object} [opts]
   * @param {number} [opts.threshold=0.15] — 0-1 visibility threshold
   * @param {string} [opts.rootMargin="0px 0px -55px 0px"]
   * @param {boolean} [opts.once=true] — reveal once or on re-entry
   */
  function scrollReveal(opts = {}) {
    const {
      threshold = 0.15,
      rootMargin = '0px 0px -55px 0px',
      once = true,
    } = opts;

    if (!('IntersectionObserver' in window)) {
      // Fallback: reveal everything immediately
      document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
        el.classList.add('revealed');
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          entry.target.classList.remove('revealed');
        }
      });
    }, { threshold, rootMargin });

    document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
      observer.observe(el);
    });

    return { observer };
  }

  /* ─── Animated Number Counters ───────────────────────────── */
  /**
   * Animate number counters when they enter the viewport.
   * Uses [data-counter] elements with data-count target value.
   *
   * HTML: <span data-counter data-count="1200" data-suffix="+" data-prefix="$"></span>
   *
   * @param {Object} [opts]
   * @param {number} [opts.duration=987] — animation duration ms
   * @param {Function} [opts.ease] — easing function
   * @param {number} [opts.threshold=0.5]
   */
  function counters(opts = {}) {
    const {
      duration = 987,
      ease: easeFn = easing.goldenOut,
      threshold = 0.5,
    } = opts;

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-counter]').forEach(el => {
        const target = parseFloat(el.dataset.count || '0');
        el.textContent = formatNumber(target, el);
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const el = entry.target;
        const target = parseFloat(el.dataset.count || '0');
        const start = parseFloat(el.dataset.from || '0');
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        const tweenDuration = parseInt(el.dataset.duration || String(duration), 10);

        tween({
          from: start,
          to: target,
          duration: tweenDuration,
          ease: easeFn,
          onUpdate(value) {
            el.textContent = formatNumber(value, el, decimals);
          },
          onComplete() {
            el.textContent = formatNumber(target, el, decimals);
            el.dispatchEvent(new CustomEvent('heady:counter:complete', { bubbles: true }));
          },
        });
      });
    }, { threshold });

    document.querySelectorAll('[data-counter]').forEach(el => {
      observer.observe(el);
    });

    return { observer };
  }

  /**
   * Format a counter value with optional prefix/suffix and locale formatting.
   */
  function formatNumber(value, el, decimals = 0) {
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix}${formatted}${suffix}`;
  }

  /* ─── Sacred Geometry Particle Canvas ────────────────────── */
  /**
   * Renders an animated sacred geometry particle background onto a canvas.
   * Features: golden spirals, rotating geometric overlays, connected nodes.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [config]
   * @param {string} [config.accentColor="#2dd4bf"]
   * @param {string} [config.secondaryColor="#8b5cf6"]
   * @param {number} [config.nodeCount=89] — particle count (Fibonacci)
   * @param {number} [config.connectDistance=144] — max connection distance
   * @param {number} [config.speed=1.0] — animation speed multiplier
   * @param {number} [config.opacity=0.7] — overall opacity
   * @param {boolean} [config.showSpirals=true]
   * @param {boolean} [config.showNodes=true]
   * @param {boolean} [config.showGeometry=true]
   * @returns {{ stop: Function, start: Function, resize: Function }}
   */
  function particleCanvas(canvas, config = {}) {
    const ctx = canvas.getContext('2d');
    let running = true;
    let rafId;
    let t = 0; // global time (seconds)
    let lastTime = 0;

    const cfg = {
      accentColor:      config.accentColor      || '#2dd4bf',
      secondaryColor:   config.secondaryColor   || '#8b5cf6',
      goldColor:        config.goldColor        || '#d4a843',
      nodeCount:        config.nodeCount        || 89,
      connectDistance:  config.connectDistance  || 144,
      speed:            config.speed            || 1.0,
      opacity:          config.opacity          || 0.7,
      showSpirals:      config.showSpirals      !== false,
      showNodes:        config.showNodes        !== false,
      showGeometry:     config.showGeometry     !== false,
    };

    // Parse a hex color to RGB components
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : { r: 45, g: 212, b: 191 };
    }

    const accentRgb    = hexToRgb(cfg.accentColor);
    const secondaryRgb = hexToRgb(cfg.secondaryColor);
    const goldRgb      = hexToRgb(cfg.goldColor);

    function rgba(rgb, a) {
      return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
    }

    // ── Node system ──
    let nodes = [];
    let w, h;

    function resize() {
      w = canvas.width  = canvas.offsetWidth  || window.innerWidth;
      h = canvas.height = canvas.offsetHeight || window.innerHeight;
      initNodes();
    }

    function initNodes() {
      nodes = Array.from({ length: cfg.nodeCount }, (_, i) => {
        // Fibonacci-distributed initial positions
        const angle  = i * TWO_PI * PHI_INV;
        const radius = Math.sqrt(i / cfg.nodeCount) * Math.min(w, h) * 0.45;
        return {
          x:  w * 0.5 + Math.cos(angle) * radius * (0.5 + Math.random() * 0.5),
          y:  h * 0.5 + Math.sin(angle) * radius * (0.5 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.3 * cfg.speed,
          vy: (Math.random() - 0.5) * 0.3 * cfg.speed,
          r:  1 + Math.random() * 2.5,
          // φ-based oscillation phase
          phase: i * PHI_INV * TWO_PI,
          pulseFreq: 0.5 + Math.random() * 1.5,
          // Color variant: teal, secondary, gold
          colorIdx: i % 3,
        };
      });
    }

    function updateNodes(dt) {
      const margin = 50;
      nodes.forEach(n => {
        n.x += n.vx * dt * 60;
        n.y += n.vy * dt * 60;
        // Soft bounce at edges
        if (n.x < margin || n.x > w - margin) { n.vx *= -1; n.x = Math.max(margin, Math.min(w - margin, n.x)); }
        if (n.y < margin || n.y > h - margin) { n.vy *= -1; n.y = Math.max(margin, Math.min(h - margin, n.y)); }
      });
    }

    function drawConnections() {
      const dist2 = cfg.connectDistance * cfg.connectDistance;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < dist2) {
            const proximity = 1 - d2 / dist2;
            const alpha = proximity * 0.25 * cfg.opacity;
            // Use accent color for connections
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, rgba(accentRgb, alpha));
            grad.addColorStop(0.5, rgba(secondaryRgb, alpha * 0.6));
            grad.addColorStop(1, rgba(accentRgb, alpha));
            ctx.strokeStyle = grad;
            ctx.lineWidth = proximity * 1.2;
            ctx.stroke();
          }
        }
      }
    }

    function drawNodes() {
      const colors = [accentRgb, secondaryRgb, goldRgb];
      nodes.forEach(n => {
        const pulse = 0.5 + 0.5 * Math.sin(t * n.pulseFreq + n.phase);
        const r = n.r * (1 + pulse * 0.4);
        const alpha = (0.4 + pulse * 0.5) * cfg.opacity;
        const rgb = colors[n.colorIdx];

        // Glow
        const glowR = r * 4;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, rgba(rgb, alpha * 0.8));
        grd.addColorStop(0.4, rgba(rgb, alpha * 0.3));
        grd.addColorStop(1, rgba(rgb, 0));

        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, TWO_PI);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, TWO_PI);
        ctx.fillStyle = rgba(rgb, alpha);
        ctx.fill();
      });
    }

    // ── Sacred Geometry Overlays ──

    /**
     * Draw a golden spiral centered at (cx, cy).
     * Uses the polar form r = a * e^(b*θ) where b = ln(φ)/( π/2)
     */
    function drawGoldenSpiral(cx, cy, scale, rotation, alpha) {
      const b = Math.log(PHI) / (Math.PI / 2);
      const a = scale * 0.01;
      const maxTheta = Math.PI * 8; // 4 full turns
      const steps = 600;

      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * maxTheta + rotation;
        const r = a * Math.exp(b * theta);
        const x = cx + r * Math.cos(theta);
        const y = cy + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale);
      grd.addColorStop(0,   rgba(accentRgb, 0));
      grd.addColorStop(0.3, rgba(accentRgb, alpha * 0.4));
      grd.addColorStop(0.7, rgba(accentRgb, alpha));
      grd.addColorStop(1,   rgba(accentRgb, 0));
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /**
     * Draw a Fibonacci (Flower of Life style) polygon
     */
    function drawRegularPolygon(cx, cy, r, sides, rotation, rgb, alpha) {
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * TWO_PI + rotation;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(rgb, alpha);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    /**
     * Draw overlapping Fibonacci circles (Flower of Life foundation)
     */
    function drawFibonacciCircles() {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const baseR = Math.min(w, h) * 0.15;
      const alphaBase = 0.04 * cfg.opacity;

      // 6-fold Flower of Life geometry
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TWO_PI + t * 0.02;
        const ox = cx + baseR * Math.cos(angle);
        const oy = cy + baseR * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(ox, oy, baseR, 0, TWO_PI);
        ctx.strokeStyle = rgba(accentRgb, alphaBase);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Central circle
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, TWO_PI);
      ctx.strokeStyle = rgba(accentRgb, alphaBase * 1.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 2, 0, TWO_PI);
      ctx.strokeStyle = rgba(secondaryRgb, alphaBase * 0.6);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    function drawGeometricOverlays() {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const minDim = Math.min(w, h);

      // Nested φ-scaled polygons rotating at different rates
      const polyConfig = [
        { sides: 3, r: minDim * 0.35, speed: 0.008, rgb: accentRgb,    alpha: 0.05 },
        { sides: 5, r: minDim * 0.30, speed: -0.006, rgb: secondaryRgb, alpha: 0.04 },
        { sides: 6, r: minDim * 0.40, speed: 0.005,  rgb: goldRgb,      alpha: 0.035 },
        { sides: 3, r: minDim * 0.22, speed: -0.010, rgb: accentRgb,    alpha: 0.06 },
        { sides: 8, r: minDim * 0.45, speed: 0.003,  rgb: secondaryRgb, alpha: 0.025 },
      ];

      polyConfig.forEach(p => {
        drawRegularPolygon(cx, cy, p.r, p.sides, t * p.speed, p.rgb, p.alpha * cfg.opacity);
      });

      // Fibonacci circles at center
      drawFibonacciCircles();
    }

    function drawSpirals() {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const scale = Math.min(w, h) * 0.55;

      // Two counter-rotating golden spirals
      drawGoldenSpiral(cx, cy, scale, t * 0.04, 0.15 * cfg.opacity);
      drawGoldenSpiral(cx, cy, scale, t * -0.03 + Math.PI, 0.1 * cfg.opacity);

      // Corner spirals at golden-ratio positions
      const offX = w * PHI_INV;
      const offY = h * PHI_INV;
      drawGoldenSpiral(offX, offY, scale * 0.4, t * 0.06, 0.07 * cfg.opacity);
      drawGoldenSpiral(w - offX, h - offY, scale * 0.4, t * -0.05 + Math.PI, 0.06 * cfg.opacity);
    }

    // ── Main render loop ──
    function render(timestamp) {
      if (!running) return;

      const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap dt at 50ms
      lastTime = timestamp;
      t += dt * cfg.speed;

      ctx.clearRect(0, 0, w, h);

      if (cfg.showGeometry) drawGeometricOverlays();
      if (cfg.showSpirals)  drawSpirals();
      if (cfg.showNodes) {
        updateNodes(dt);
        drawConnections();
        drawNodes();
      }

      rafId = requestAnimationFrame(render);
    }

    function start() {
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(render);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    // Initialize
    resize();
    start();

    // Handle resize
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resize())
      : null;
    if (resizeObserver) resizeObserver.observe(canvas.parentElement || canvas);
    else window.addEventListener('resize', resize);

    return { start, stop, resize };
  }

  /* ─── Page Transition Effects ────────────────────────────── */
  /**
   * Adds CSS-based page transition overlay and triggers on navigation.
   * Creates a full-viewport overlay that sweeps in/out.
   *
   * @param {Object} [opts]
   * @param {string} [opts.color="var(--color-surface-0)"]
   * @param {number} [opts.duration=377] — ms
   */
  function pageTransition(opts = {}) {
    const { duration = 377 } = opts;

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'heady-page-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: var(--color-surface-0, #080c14);
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity ${duration}ms cubic-bezier(0.382, 0.0, 0.618, 1.0);
    `;
    document.body.appendChild(overlay);

    // Page enter animation
    function enter() {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'all';
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
      }, duration * PHI_INV);
    }

    // Page exit animation
    function exit(callback) {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'all';
      setTimeout(() => {
        if (callback) callback();
      }, duration);
    }

    // Intercept internal navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      // Only internal, non-hash, non-external links
      if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto') && !link.hasAttribute('target')) {
        e.preventDefault();
        exit(() => { window.location.href = href; });
      }
    });

    // Trigger enter on load
    enter();

    return { enter, exit };
  }

  /* ─── Hover Effects ──────────────────────────────────────── */
  /**
   * Attach enhanced hover effects to cards and buttons.
   * Creates a mouse-tracking spotlight effect on glassmorphic cards.
   *
   * @param {Object} [opts]
   * @param {string} [opts.cardSelector=".heady-card, .heady-feature-card, .heady-pricing-card, .heady-testimonial-card"]
   * @param {string} [opts.buttonSelector=".heady-button--primary"]
   */
  function hoverEffects(opts = {}) {
    const {
      cardSelector = '.heady-card, .heady-feature-card, .heady-pricing-card, .heady-testimonial-card, .heady-metric-counter',
      buttonSelector = '.heady-button--primary',
    } = opts;

    // Card spotlight effect
    document.querySelectorAll(cardSelector).forEach(card => {
      card.style.position = card.style.position || 'relative';
      card.style.overflow = 'hidden';

      // Create spotlight pseudo-overlay
      const spotlight = document.createElement('div');
      spotlight.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        opacity: 0;
        transition: opacity 200ms ease;
        z-index: 0;
        background: radial-gradient(300px circle at var(--mx, 50%) var(--my, 50%),
          rgba(255,255,255,0.04) 0%, transparent 70%);
      `;
      card.appendChild(spotlight);

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 100;
        const my = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${mx}%`);
        card.style.setProperty('--my', `${my}%`);
        spotlight.style.opacity = '1';
      });

      card.addEventListener('mouseleave', () => {
        spotlight.style.opacity = '0';
      });
    });

    // Button magnetic hover effect
    document.querySelectorAll(buttonSelector).forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = (e.clientX - rect.left - rect.width / 2) * 0.15;
        const dy = (e.clientY - rect.top - rect.height / 2) * 0.15;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ─── Geometric Loading Spinner ──────────────────────────── */
  /**
   * Create a canvas-based sacred geometry loading spinner.
   *
   * @param {Object} [opts]
   * @param {number} [opts.size=55] — px
   * @param {string} [opts.color="#2dd4bf"]
   * @param {number} [opts.thickness=2]
   * @returns {HTMLCanvasElement}
   */
  function loadingSpinner(opts = {}) {
    const {
      size = 55,
      color = '#2dd4bf',
      thickness = 2,
    } = opts;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.cssText = `width:${size}px;height:${size}px;display:block;`;

    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    let angle = 0;
    let rafId;

    // Parse color
    function hexToRgbArr(hex) {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [45, 212, 191];
    }
    const [cr, cg, cb] = hexToRgbArr(color);

    function draw() {
      ctx.clearRect(0, 0, size, size);

      // Outer ring (dashed, 5-segment pentagon style)
      const outerR = size * 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, TWO_PI);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.12)`;
      ctx.lineWidth = thickness;
      ctx.stroke();

      // Animated arc — φ-derived sweep angle
      const sweep = Math.PI * (1 + PHI_INV); // ~5.1 radians ≈ 292°
      const grad = ctx.createConicalGradient
        ? ctx.createConicalGradient(cx, cy, angle)
        : null;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, angle, angle + sweep);
      if (grad) {
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},1)`);
        ctx.strokeStyle = grad;
      } else {
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.9)`;
      }
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Inner triangle (rotates at φ × outer speed)
      const innerR = outerR * PHI_INV;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = angle * PHI + (i / 3) * TWO_PI;
        const x = cx + innerR * Math.cos(a);
        const y = cy + innerR * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`;
      ctx.lineWidth = thickness * 0.75;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, thickness * 1.5, 0, TWO_PI);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.8)`;
      ctx.fill();

      // Advance angle at φ-derived rate
      angle += 0.04 * PHI;
      rafId = requestAnimationFrame(draw);
    }

    draw();

    canvas.stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
    };

    return canvas;
  }

  /* ─── Sticky Nav Scroll Behavior ────────────────────────── */
  /**
   * Add 'scrolled' class to .heady-nav when page is scrolled.
   * @param {number} [threshold=34]
   */
  function stickyNav(threshold = 34) {
    const nav = document.querySelector('.heady-nav');
    if (!nav) return;

    function update() {
      nav.classList.toggle('scrolled', window.scrollY > threshold);
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ─── Mobile Nav Toggle ──────────────────────────────────── */
  function mobileNav() {
    const toggle = document.querySelector('.heady-nav__toggle');
    const drawer = document.querySelector('.heady-nav__mobile');
    if (!toggle || !drawer) return;

    let open = false;

    toggle.addEventListener('click', () => {
      open = !open;
      drawer.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });

    // Close on link click
    drawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        open = false;
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ─── Copy Code Blocks ───────────────────────────────────── */
  function codeBlockCopy() {
    document.querySelectorAll('.heady-code-block__copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const block = btn.closest('.heady-code-block');
        const code = block?.querySelector('pre')?.textContent || '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        } catch {
          btn.textContent = 'Failed';
        }
      });
    });
  }

  /* ─── Master Init ────────────────────────────────────────── */
  /**
   * Initialize all animation features with sensible defaults.
   * Call once on DOMContentLoaded.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.scrollReveal=true]
   * @param {boolean} [opts.counters=true]
   * @param {boolean} [opts.hoverEffects=true]
   * @param {boolean} [opts.pageTransition=false] — off by default (adds overlay)
   * @param {boolean} [opts.stickyNav=true]
   * @param {boolean} [opts.mobileNav=true]
   * @param {boolean} [opts.codeBlockCopy=true]
   */
  function init(opts = {}) {
    const options = {
      scrollReveal:    opts.scrollReveal    !== false,
      counters:        opts.counters        !== false,
      hoverEffects:    opts.hoverEffects    !== false,
      pageTransition:  opts.pageTransition  || false,
      stickyNav:       opts.stickyNav       !== false,
      mobileNav:       opts.mobileNav       !== false,
      codeBlockCopy:   opts.codeBlockCopy   !== false,
    };

    const instances = {};

    if (options.stickyNav)     stickyNav();
    if (options.mobileNav)     mobileNav();
    if (options.scrollReveal)  instances.scrollReveal  = scrollReveal(opts.scrollRevealOpts);
    if (options.counters)      instances.counters      = counters(opts.counterOpts);
    if (options.hoverEffects)  hoverEffects(opts.hoverOpts);
    if (options.codeBlockCopy) codeBlockCopy();
    if (options.pageTransition) instances.pageTransition = pageTransition(opts.transitionOpts);

    // Auto-init canvas backgrounds
    document.querySelectorAll('canvas[data-heady-bg]').forEach(canvas => {
      const config = {
        accentColor:     canvas.dataset.accentColor     || undefined,
        secondaryColor:  canvas.dataset.secondaryColor  || undefined,
        nodeCount:       parseInt(canvas.dataset.nodeCount || '89', 10),
        connectDistance: parseInt(canvas.dataset.connectDistance || '144', 10),
        speed:           parseFloat(canvas.dataset.speed || '1.0'),
        opacity:         parseFloat(canvas.dataset.opacity || '0.7'),
        showSpirals:     canvas.dataset.showSpirals  !== 'false',
        showNodes:       canvas.dataset.showNodes    !== 'false',
        showGeometry:    canvas.dataset.showGeometry !== 'false',
      };
      instances[`canvas_${canvas.id || 'bg'}`] = particleCanvas(canvas, config);
    });

    return instances;
  }

  /* ─── Public API ─────────────────────────────────────────── */
  return {
    PHI,
    FIB,
    easing,
    tween,
    stagger,
    init,
    scrollReveal,
    counters,
    particleCanvas,
    pageTransition,
    hoverEffects,
    loadingSpinner,
    stickyNav,
    mobileNav,
    codeBlockCopy,
  };
}));
