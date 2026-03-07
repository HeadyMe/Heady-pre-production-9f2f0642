/**
 * Sacred Geometry v7.0 — One Large Unique Shape Per Site
 * Each site gets a unique sacred geometry form filling ~70% of the viewport.
 * 800+ densely packed thin lines. Phi-dynamic morphing. Cosmic starfield.
 * Reads data-heady-site attribute to pick shape.
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895, PHI_INV = 0.618033988749895, TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf, stars = [];

  function rot3d(x, y, z, rx, ry, rz) {
    let a = x * Math.cos(rz) - y * Math.sin(rz), b = x * Math.sin(rz) + y * Math.cos(rz);
    let d = b * Math.cos(rx) - z * Math.sin(rx), e = b * Math.sin(rx) + z * Math.cos(rx);
    let f = a * Math.cos(ry) + e * Math.sin(ry);
    return { x: f, y: d };
  }
  function pw(t, f, p) { return Math.sin(t * f * PHI_INV + p); }

  // Stars
  function initStars() {
    stars = []; for (let i = 0; i < 250; i++) {
      const a = Math.random() * TAU, sp = 0.15 + Math.random() * 0.8;
      stars.push({
        x: Math.random() * 2400 - 200, y: Math.random() * 1400 - 200, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        sz: 0.3 + Math.random() * 2, h: Math.random() * 360, tw: Math.random() * TAU, br: 0.3 + Math.random() * 0.5
      });
    }
  }
  function drawStars(t) {
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.tw += 0.025;
      if (s.x < -20) s.x = W + 20; if (s.x > W + 20) s.x = -20; if (s.y < -20) s.y = H + 20; if (s.y > H + 20) s.y = -20;
      const al = s.br * (0.4 + 0.6 * Math.sin(s.tw)), h = (s.h + t * 0.02) % 360;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * (0.5 + 0.5 * Math.sin(s.tw)), 0, TAU);
      ctx.fillStyle = `hsla(${h},80%,80%,${al})`; ctx.fill();
      if (s.sz > 1.3) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * 3.5, 0, TAU);
        ctx.fillStyle = `hsla(${h},60%,70%,${al * 0.05})`; ctx.fill();
      }
    });
  }

  function drawNebula(t) {
    [[0.25, 0.4, 280], [0.75, 0.55, 190], [0.5, 0.7, 340]].forEach(([cx, cy, hb]) => {
      const x = W * cx + Math.sin(t * 0.0004) * 30, y = H * cy + Math.cos(t * 0.0005 / PHI) * 25, r = 300;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${(hb + t * 0.012) % 360},55%,35%,0.06)`); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }

  function drawShoot() {
    if (Math.random() > 0.008) return; const sx = Math.random() * W, sy = Math.random() * H * 0.5,
      a = 0.15 + Math.random() * 0.4, l = 80 + Math.random() * 140, h = Math.random() * 360;
    const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l);
    g.addColorStop(0, `hsla(${h},85%,85%,0.7)`); g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
    ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // ═══ SHAPE LIBRARY — one per site ═══
  const SITE_SHAPES = {
    headyme: { name: 'Flower of Life', type: 'flower', rings: 4, hueBase: 170 },
    headyos: { name: 'Metatron Cube', type: 'metatron', hueBase: 270 },
    heady-ai: { name: 'Torus Knot 2,3', type: 'torus', p: 2, q: 3, hueBase: 0 },
    headysystems: { name: 'Torus Knot 3,5', type: 'torus', p: 3, q: 5, hueBase: 45 },
    headyex: { name: 'Sri Yantra', type: 'sri', hueBase: 320 },
    headyfinance: { name: 'Torus Knot 5,8', type: 'torus', p: 5, q: 8, hueBase: 200 },
    'headyconnection-com': { name: 'Vesica Piscis', type: 'vesica', hueBase: 160 },
    'headyconnection-org': { name: 'Torus Knot 3,7', type: 'torus', p: 3, q: 7, hueBase: 90 },
    'admin-portal': { name: 'Flower of Life', type: 'flower', rings: 3, hueBase: 30 },
  };

  function getSiteKey() {
    const el = document.documentElement;
    return el.getAttribute('data-heady-site') || 'headyme';
  }

  // ═══ DRAW FUNCTIONS — LARGE, DENSE ═══
  function drawTorus(t, cfg) {
    const segs = 800;
    const size = Math.min(W, H) * 0.38;
    const R = 80, r = 35;
    const pM = cfg.p + pw(t, 0.0002, 0) * 0.5;
    const qM = cfg.q + pw(t, 0.00015, 2) * 0.4;
    const rx = t * 0.0015 + pw(t, 0.0004, 0) * 0.4;
    const ry = t * 0.002 + pw(t, 0.0003 * PHI, 1) * 0.5;
    const rz = t * 0.001 * PHI_INV + pw(t, 0.00035, 2) * 0.3;
    const cx = W / 2 + pw(t, 0.00012, 0) * W * 0.06;
    const cy = H / 2 + pw(t, 0.0001 * PHI, 3) * H * 0.05;
    const baseHue = (cfg.hueBase + t * 0.08 + pw(t, 0.0005, 0) * 50) % 360;
    const breathe = 0.92 + 0.08 * pw(t, 0.0015 * PHI_INV, 0);
    const factor = size / 110 * breathe;
    ctx.save(); ctx.translate(cx, cy);
    // Main mesh
    for (let i = 0; i < segs; i++) {
      const t1 = (i / segs) * TAU * 2, t2 = ((i + 1) / segs) * TAU * 2;
      const r1 = R + r * Math.cos(qM * t1), r2 = R + r * Math.cos(qM * t2);
      const a = rot3d(r1 * Math.cos(pM * t1) * factor, r1 * Math.sin(pM * t1) * factor, r * Math.sin(qM * t1) * factor, rx, ry, rz);
      const b = rot3d(r2 * Math.cos(pM * t2) * factor, r2 * Math.sin(pM * t2) * factor, r * Math.sin(qM * t2) * factor, rx, ry, rz);
      const h = (baseHue + i * PHI_INV * 1.8) % 360;
      const alpha = 0.4 + 0.3 * pw(t, 0.002, i * 0.02);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${h},80%,65%,${alpha})`; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // Dense cross-mesh — connects every 5th point to its φ opposite
    for (let i = 0; i < segs; i += 5) {
      const j = (i + Math.floor(segs * PHI_INV)) % segs;
      const t1 = (i / segs) * TAU * 2, t2 = (j / segs) * TAU * 2;
      const r1 = R + r * Math.cos(qM * t1), r2 = R + r * Math.cos(qM * t2);
      const a = rot3d(r1 * Math.cos(pM * t1) * factor, r1 * Math.sin(pM * t1) * factor, r * Math.sin(qM * t1) * factor, rx, ry, rz);
      const b = rot3d(r2 * Math.cos(pM * t2) * factor, r2 * Math.sin(pM * t2) * factor, r * Math.sin(qM * t2) * factor, rx, ry, rz);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${(baseHue + 180 + i * 0.4) % 360},70%,55%,0.18)`; ctx.lineWidth = 0.35; ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlower(t, cfg) {
    const size = Math.min(W, H) * 0.35;
    const rx = t * 0.001 + pw(t, 0.0004, 0) * 0.5;
    const ry = t * 0.0015 + pw(t, 0.0003 * PHI, 1) * 0.4;
    const rz = t * 0.0008 * PHI_INV + pw(t, 0.00035, 2) * 0.3;
    const cx = W / 2 + pw(t, 0.00015, 0) * W * 0.05;
    const cy = H / 2 + pw(t, 0.00012 * PHI, 3) * H * 0.04;
    const baseHue = (cfg.hueBase + t * 0.1 + pw(t, 0.0006, 0) * 60) % 360;
    const breathe = 0.9 + 0.1 * pw(t, 0.0012 * PHI_INV, 0);
    const r = size * 0.22;
    ctx.save(); ctx.translate(cx, cy);
    for (let ring = 0; ring < cfg.rings; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let i = 0; i < n; i++) {
        const ca = (i / n) * TAU;
        const ocx = ring === 0 ? 0 : Math.cos(ca) * r * ring;
        const ocy = ring === 0 ? 0 : Math.sin(ca) * r * ring;
        const cSegs = 64;
        for (let s = 0; s < cSegs; s++) {
          const a1 = (s / cSegs) * TAU, a2 = ((s + 1) / cSegs) * TAU;
          const pa = rot3d((ocx + Math.cos(a1) * r) * breathe, (ocy + Math.sin(a1) * r) * breathe, ring * 8, rx, ry, rz);
          const pb = rot3d((ocx + Math.cos(a2) * r) * breathe, (ocy + Math.sin(a2) * r) * breathe, ring * 8, rx, ry, rz);
          const h = (baseHue + s * PHI * 5 + ring * 50 + i * 20) % 360;
          const alpha = 0.3 + 0.25 * pw(t, 0.0015, s * 0.06 + ring);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `hsla(${h},78%,62%,${alpha})`; ctx.lineWidth = 0.65; ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawMetatron(t, cfg) {
    const size = Math.min(W, H) * 0.35;
    const rx = t * 0.0012 + pw(t, 0.0005, 0) * 0.4;
    const ry = t * 0.0018 + pw(t, 0.0004 * PHI, 1) * 0.5;
    const rz = t * 0.0007 * PHI_INV + pw(t, 0.0003, 2) * 0.3;
    const cx = W / 2 + pw(t, 0.00013, 0) * W * 0.06;
    const cy = H / 2 + pw(t, 0.0001 * PHI, 3) * H * 0.05;
    const baseHue = (cfg.hueBase + t * 0.09 + pw(t, 0.0007, 0) * 55) % 360;
    const breathe = 0.88 + 0.12 * pw(t, 0.001 * PHI_INV, 0);
    // 13 points: center + 6 inner + 6 outer
    const pts = [[0, 0, 0]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      pts.push([Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, 0]);
      pts.push([Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55, 0]);
    }
    ctx.save(); ctx.translate(cx, cy);
    // Connect ALL points — dense mesh
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const pa = rot3d(pts[i][0] * breathe, pts[i][1] * breathe, pts[i][2], rx, ry, rz);
        const pb = rot3d(pts[j][0] * breathe, pts[j][1] * breathe, pts[j][2], rx, ry, rz);
        const h = (baseHue + (i + j) * 12) % 360;
        const alpha = 0.3 + 0.2 * pw(t, 0.001, (i + j) * 0.1);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `hsla(${h},75%,60%,${alpha})`; ctx.lineWidth = 0.6; ctx.stroke();
      }
    }
    // Circles at each point
    for (let i = 0; i < pts.length; i++) {
      const cr = size * (i === 0 ? 0.12 : 0.07);
      for (let s = 0; s < 48; s++) {
        const a1 = (s / 48) * TAU, a2 = ((s + 1) / 48) * TAU;
        const pa = rot3d((pts[i][0] + Math.cos(a1) * cr) * breathe, (pts[i][1] + Math.sin(a1) * cr) * breathe, 0, rx, ry, rz);
        const pb = rot3d((pts[i][0] + Math.cos(a2) * cr) * breathe, (pts[i][1] + Math.sin(a2) * cr) * breathe, 0, rx, ry, rz);
        const h = (baseHue + s * 8 + i * 30) % 360;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `hsla(${h},70%,58%,${0.25 + 0.15 * pw(t, 0.002, s * 0.05 + i)})`;
        ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawSri(t, cfg) {
    const size = Math.min(W, H) * 0.35;
    const rx = t * 0.001 + pw(t, 0.0005, 0) * 0.45;
    const ry = t * 0.0014 + pw(t, 0.0004 * PHI, 1) * 0.4;
    const rz = t * 0.0009 * PHI_INV + pw(t, 0.00035, 2) * 0.35;
    const cx = W / 2 + pw(t, 0.00014, 0) * W * 0.05;
    const cy = H / 2 + pw(t, 0.00011 * PHI, 3) * H * 0.04;
    const baseHue = (cfg.hueBase + t * 0.1 + pw(t, 0.0006, 0) * 65) % 360;
    const breathe = 0.9 + 0.1 * pw(t, 0.0013 * PHI_INV, 0);
    ctx.save(); ctx.translate(cx, cy);
    // 9 interlocking triangles (4 up, 5 down) at different scales
    for (let layer = 0; layer < 9; layer++) {
      const s = size * (0.2 + layer * 0.07) * breathe;
      const up = layer % 2 === 0;
      const offset = up ? -Math.PI / 2 : Math.PI / 2;
      const segs = 60;
      for (let i = 0; i < 3; i++) {
        const a1 = (i / 3) * TAU + offset, a2 = ((i + 1) / 3) * TAU + offset;
        const x1 = Math.cos(a1) * s, y1 = Math.sin(a1) * s, x2 = Math.cos(a2) * s, y2 = Math.sin(a2) * s;
        for (let seg = 0; seg < segs; seg++) {
          const t1 = seg / segs, t2 = (seg + 1) / segs;
          const pa = rot3d((x1 + t1 * (x2 - x1)), (y1 + t1 * (y2 - y1)), layer * 5, rx, ry, rz);
          const pb = rot3d((x1 + t2 * (x2 - x1)), (y1 + t2 * (y2 - y1)), layer * 5, rx, ry, rz);
          const h = (baseHue + seg * 3 + layer * 40 + i * 20) % 360;
          const alpha = 0.3 + 0.2 * pw(t, 0.0018, seg * 0.05 + layer);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `hsla(${h},78%,62%,${alpha})`; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    // Central bindu dot
    const cp = rot3d(0, 0, 0, rx, ry, rz);
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 4, 0, TAU);
    ctx.fillStyle = `hsla(${baseHue},90%,75%,0.6)`; ctx.fill();
    ctx.restore();
  }

  function drawVesica(t, cfg) {
    const size = Math.min(W, H) * 0.35;
    const rx = t * 0.0011 + pw(t, 0.00045, 0) * 0.4;
    const ry = t * 0.0016 + pw(t, 0.00035 * PHI, 1) * 0.45;
    const rz = t * 0.00075 * PHI_INV + pw(t, 0.0003, 2) * 0.3;
    const cx = W / 2 + pw(t, 0.00013, 0) * W * 0.06;
    const cy = H / 2 + pw(t, 0.0001 * PHI, 3) * H * 0.05;
    const baseHue = (cfg.hueBase + t * 0.1 + pw(t, 0.00055, 0) * 60) % 360;
    const breathe = 0.9 + 0.1 * pw(t, 0.0012 * PHI_INV, 0);
    const d = size * 0.35;
    ctx.save(); ctx.translate(cx, cy);
    // Two overlapping circles + outer
    [-1, 1, 0].forEach((dir, ci) => {
      const r = ci === 2 ? size * 0.7 : size * 0.5;
      const ox = dir * d;
      const segs = 80;
      for (let s = 0; s < segs; s++) {
        const a1 = (s / segs) * TAU, a2 = ((s + 1) / segs) * TAU;
        const pa = rot3d((ox + Math.cos(a1) * r) * breathe, (Math.sin(a1) * r) * breathe, ci * 10, rx, ry, rz);
        const pb = rot3d((ox + Math.cos(a2) * r) * breathe, (Math.sin(a2) * r) * breathe, ci * 10, rx, ry, rz);
        const h = (baseHue + s * 4 + ci * 60) % 360;
        const alpha = 0.3 + 0.2 * pw(t, 0.0015, s * 0.05 + ci);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `hsla(${h},75%,60%,${alpha})`; ctx.lineWidth = 0.6; ctx.stroke();
      }
    });
    ctx.restore();
  }

  let siteShape = null;
  function animate() {
    ctx.clearRect(0, 0, W, H); frame++;
    drawNebula(frame); drawStars(frame); drawShoot();
    if (!siteShape) return;
    const cfg = siteShape;
    if (cfg.type === 'torus') drawTorus(frame, cfg);
    else if (cfg.type === 'flower') drawFlower(frame, cfg);
    else if (cfg.type === 'metatron') drawMetatron(frame, cfg);
    else if (cfg.type === 'sri') drawSri(frame, cfg);
    else if (cfg.type === 'vesica') drawVesica(frame, cfg);
    raf = requestAnimationFrame(animate);
  }

  function resize(c) { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; }
  function init(id) {
    const c = document.getElementById(id); if (!c) return;
    ctx = c.getContext('2d'); resize(c); initStars();
    const key = getSiteKey();
    siteShape = SITE_SHAPES[key] || SITE_SHAPES.headyme;
    window.addEventListener('resize', () => { resize(c); initStars(); });
    animate();
  }
  function destroy() { if (raf) cancelAnimationFrame(raf); }
  return { init, destroy };
})();
