/**
 * HeadyOS Founder's Pilot — Landing Page Application
 * φ = 1.618033988749895
 * All animation timings, intervals, and thresholds derive from φ and Fibonacci.
 */

'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
const API_ENDPOINT = 'https://api.headyme.com/pilot/signup';

/* ── Navigation scroll behavior ────────────────────────────── */
(function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  let lastScrollY = 0;
  let ticking = false;

  const updateNav = () => {
    const scrollY = window.scrollY;
    if (scrollY > FIB[6]) {          // fib(7)=13px threshold
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScrollY = scrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });
})();

/* ── Smooth Scrolling ───────────────────────────────────────── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navHeight = document.getElementById('nav')?.offsetHeight ?? FIB[8]; // fib(9)=34
      const targetY = target.getBoundingClientRect().top + window.scrollY - navHeight - FIB[5]; // fib(6)=8 extra

      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    });
  });
})();

/* ── Intersection Observer Reveal ───────────────────────────── */
(function initRevealAnimations() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: `0px 0px -${FIB[5]}px 0px` // -8px bottom margin
    }
  );

  revealEls.forEach(el => observer.observe(el));
})();

/* ── Sacred Geometry Canvas Animation ──────────────────────── */
(function initSacredCanvas() {
  const canvas = document.getElementById('sacred-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width, height, animFrame;
  let t = 0; // time parameter

  const resize = () => {
    width  = canvas.width  = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  /**
   * Draw a golden spiral starting at (cx, cy)
   * using Fibonacci rectangle decomposition.
   * @param {number} cx - center x
   * @param {number} cy - center y
   * @param {number} scale - base scale
   * @param {number} alpha - opacity
   * @param {string} color - stroke color
   */
  const drawGoldenSpiral = (cx, cy, scale, alpha, color) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.618;

    // Draw Fibonacci circles (arcs of the golden spiral)
    let a = scale;
    let b = scale * PHI;
    let x = cx, y = cy;

    const startAngles = [Math.PI, Math.PI * 0.5, 0, Math.PI * 1.5];

    for (let i = 0; i < FIB[5]; i++) { // fib(6)=8 iterations
      const r = a;
      const startA = startAngles[i % 4];
      const endA   = startA + Math.PI * 0.5;

      ctx.beginPath();
      ctx.arc(x, y, r, startA, endA);
      ctx.stroke();

      // Advance pivot
      switch (i % 4) {
        case 0: x += a; break;
        case 1: y -= a; break;
        case 2: x -= b; break;
        case 3: y += b; break;
      }

      const next = b;
      b = a + b;
      a = next;
    }

    ctx.restore();
  };

  /**
   * Draw a Fibonacci circle set (concentric, Fibonacci radii)
   */
  const drawFibCircles = (cx, cy, baseR, alpha, color) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    [1, 2, 3, 5, 8, 13, 21, 34].forEach(n => {
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * n * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  };

  /**
   * Draw a rotating pentagon/hexagon sacred pattern
   */
  const drawSacredPolygon = (cx, cy, r, sides, rotation, alpha, color) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotation;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Main render loop
   */
  const render = () => {
    ctx.clearRect(0, 0, width, height);

    t += 1 / (PHI * 60); // φ-derived time step

    // ── Background golden spirals ──────────────────────────
    drawGoldenSpiral(
      width * 0.618, height * 0.382,  // φ-positioned
      width * 0.05,
      0.08,
      '#c9a84c'
    );

    drawGoldenSpiral(
      width * 0.1, height * 0.8,
      width * 0.03,
      0.05,
      '#3d7bd4'
    );

    // ── Rotating Fibonacci circles ─────────────────────────
    drawFibCircles(
      width * 0.85, height * 0.15,
      width * 0.008,
      0.06,
      '#c9a84c'
    );

    drawFibCircles(
      width * 0.15, height * 0.85,
      width * 0.006,
      0.04,
      '#3d7bd4'
    );

    // ── Rotating sacred polygons ───────────────────────────
    // Hexagon
    drawSacredPolygon(
      width * 0.5, height * 0.5,
      Math.min(width, height) * 0.42,
      6,
      t * (1 / PHI) * 0.1,
      0.025,
      '#c9a84c'
    );

    // Pentagon
    drawSacredPolygon(
      width * 0.5, height * 0.5,
      Math.min(width, height) * 0.34,
      5,
      -t * 0.05,
      0.02,
      '#3d7bd4'
    );

    // Inner triangle
    drawSacredPolygon(
      width * 0.5, height * 0.5,
      Math.min(width, height) * 0.21,
      3,
      t * 0.08,
      0.03,
      '#2ea87e'
    );

    // ── Phi-positioned radial lines ────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 0.5;

    const cx = width * 0.618;
    const cy = height * 0.382;
    const lineCount = FIB[8]; // fib(9)=34

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + t * 0.02;
      const len   = Math.min(width, height) * 0.38;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(angle) * len,
        cy + Math.sin(angle) * len
      );
      ctx.stroke();
    }

    ctx.restore();

    animFrame = requestAnimationFrame(render);
  };

  render();

  // Reduce animation when tab is hidden (save CPU)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      render();
    }
  });
})();

/* ── Form Validation & Submission ───────────────────────────── */
(function initForm() {
  const form     = document.getElementById('pilot-form');
  const success  = document.getElementById('form-success');
  const submitBtn = document.getElementById('form-submit-btn');
  if (!form) return;

  /**
   * Show/hide error for a field
   * @param {string} fieldId
   * @param {boolean} hasError
   */
  const setError = (fieldId, hasError) => {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(`${fieldId}-error`);
    if (!field) return;

    field.classList.toggle('error', hasError);
    if (error) error.classList.toggle('visible', hasError);
  };

  /**
   * Validate all required fields.
   * @returns {boolean} isValid
   */
  const validate = () => {
    let valid = true;

    const firstName = document.getElementById('first-name');
    if (!firstName?.value.trim()) {
      setError('first-name', true); valid = false;
    } else { setError('first-name', false); }

    const lastName = document.getElementById('last-name');
    if (!lastName?.value.trim()) {
      setError('last-name', true); valid = false;
    } else { setError('last-name', false); }

    const email = document.getElementById('email');
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email?.value.trim() || !emailRe.test(email.value)) {
      setError('email', true); valid = false;
    } else { setError('email', false); }

    const orgName = document.getElementById('org-name');
    if (!orgName?.value.trim()) {
      setError('org-name', true); valid = false;
    } else { setError('org-name', false); }

    const orgType = document.getElementById('org-type');
    if (!orgType?.value) {
      setError('org-type', true); valid = false;
    } else { setError('org-type', false); }

    const useCase = document.getElementById('use-case');
    if (!useCase?.value) {
      setError('use-case', true); valid = false;
    } else { setError('use-case', false); }

    const description = document.getElementById('description');
    if (!description?.value.trim() || description.value.trim().length < FIB[10]) {
      // Minimum FIB[10]=89 characters
      setError('description', true); valid = false;
    } else { setError('description', false); }

    const terms = document.getElementById('terms');
    if (!terms?.checked) {
      setError('terms', true); valid = false;
    } else { setError('terms', false); }

    return valid;
  };

  // Real-time validation on blur
  form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.addEventListener('blur', () => validate(), { passive: true });
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const payload = {
      firstName:    document.getElementById('first-name')?.value.trim(),
      lastName:     document.getElementById('last-name')?.value.trim(),
      email:        document.getElementById('email')?.value.trim(),
      orgName:      document.getElementById('org-name')?.value.trim(),
      orgType:      document.getElementById('org-type')?.value,
      teamSize:     document.getElementById('team-size')?.value,
      useCase:      document.getElementById('use-case')?.value,
      description:  document.getElementById('description')?.value.trim(),
      githubUrl:    document.getElementById('github')?.value.trim() || null,
      newsletter:   document.getElementById('newsletter')?.checked ?? false,
      termsAccepted: true,
      pilotTier:    'FOUNDER',
      cohort:       1,
      appliedAt:    new Date().toISOString(),
    };

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      // Show success state
      form.style.display = 'none';
      success.classList.add('visible');

      // Track conversion event
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'pilot_application_submitted', {
          event_category: 'engagement',
          event_label: payload.orgType,
        });
      }

    } catch (err) {
      console.error('[HeadyOS] Form submission failed:', err);

      // Show error on submit button, re-enable
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submission failed — please try again';
      submitBtn.style.background = 'linear-gradient(135deg, #e05a5a, #a03030)';

      // Reset button after fib(11)=89 * 100ms = 8.9s
      setTimeout(() => {
        submitBtn.textContent = 'Submit Application →';
        submitBtn.style.background = '';
      }, FIB[10] * 100);
    }
  });
})();

/* ── Animate stat counters on scroll ────────────────────────── */
(function initCounters() {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statNumbers.length) return;

  const animateCounter = (el, target, duration) => {
    const isNumeric = !isNaN(parseFloat(target));
    if (!isNumeric) return; // Skip φ, etc.

    const end  = parseFloat(target);
    const start = 0;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out using φ-based curve
      const eased = 1 - Math.pow(1 - progress, PHI);
      const current = Math.round(start + (end - start) * eased);

      el.textContent = current.toString();
      if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = el.textContent;
      const dur    = FIB[10] * 10; // 89 * 10 = 890ms animation duration

      animateCounter(el, target, dur);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => observer.observe(el));
})();
