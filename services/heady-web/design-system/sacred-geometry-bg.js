/**
 * Sacred Geometry v5.0 — Drifting Stars + Dense 3D Wireframe Gyroscopes
 * Stars move through space. Shapes = hundreds of densely packed thin lines. Fast 3D rotation.
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895, TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf, stars = [];

  function rot3d(x, y, z, rx, ry, rz) {
    let a = x * Math.cos(rz) - y * Math.sin(rz), b = x * Math.sin(rz) + y * Math.cos(rz), c = z;
    let d = b * Math.cos(rx) - c * Math.sin(rx), e = b * Math.sin(rx) + c * Math.cos(rx);
    let f = a * Math.cos(ry) + e * Math.sin(ry), g = -a * Math.sin(ry) + e * Math.cos(ry);
    return { x: f, y: d, z: g };
  }

  // === DRIFTING STARS — move across the screen ===
  function initStars() {
    stars = [];
    for (let i = 0; i < 300; i++) {
      const angle = Math.random() * TAU;
      const speed = 0.2 + Math.random() * 1.2;
      stars.push({
        x: Math.random() * 2400 - 200, y: Math.random() * 1400 - 200,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 0.4 + Math.random() * 2.5, hue: Math.random() * 360,
        twinkle: Math.random() * TAU, brightness: 0.4 + Math.random() * 0.6
      });
    }
  }
  function drawStars(t) {
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.twinkle += 0.03;
      if (s.x < -20) s.x = W + 20;
      if (s.x > W + 20) s.x = -20;
      if (s.y < -20) s.y = H + 20;
      if (s.y > H + 20) s.y = -20;
      const alpha = s.brightness * (0.5 + 0.5 * Math.sin(s.twinkle));
      const h = (s.hue + t * 0.03) % 360;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.6 + 0.4 * Math.sin(s.twinkle)), 0, TAU);
      ctx.fillStyle = `hsla(${h},85%,82%,${alpha})`;
      ctx.fill();
      if (s.size > 1.5) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 4, 0, TAU);
        ctx.fillStyle = `hsla(${h},70%,70%,${alpha * 0.06})`;
        ctx.fill();
      }
    });
  }

  // Nebula
  function drawNebula(t) {
    [[0.2, 0.3, 280], [0.75, 0.6, 200], [0.5, 0.8, 340], [0.1, 0.7, 30], [0.85, 0.2, 160]].forEach(([cx, cy, hb]) => {
      const x = W * cx + Math.sin(t * 0.0005 + hb) * 40;
      const y = H * cy + Math.cos(t * 0.0006 / PHI + hb) * 30;
      const r = 250;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const h = (hb + t * 0.015) % 360;
      grad.addColorStop(0, `hsla(${h},60%,40%,0.07)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }

  // Shooting stars — more frequent
  function drawShootingStar() {
    if (Math.random() > 0.01) return;
    const sx = Math.random() * W, sy = Math.random() * H * 0.6;
    const a = 0.15 + Math.random() * 0.4, len = 80 + Math.random() * 150;
    const h = Math.random() * 360;
    const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    grad.addColorStop(0, `hsla(${h},85%,85%,0.8)`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.stroke();
  }

  // === DENSE TORUS KNOT — many line segments ===
  function drawDenseTorus(cx, cy, R, r, p, q, sc, rx, ry, rz, hue, t) {
    const segs = 600; // very dense
    ctx.save(); ctx.translate(cx, cy);
    const factor = sc * 0.008;
    const breathe = 0.92 + 0.08 * Math.sin(t * 0.003 * PHI);
    for (let i = 0; i < segs; i++) {
      const t1 = (i / segs) * TAU * 2, t2 = ((i + 1) / segs) * TAU * 2;
      const r1 = R + r * Math.cos(q * t1), r2 = R + r * Math.cos(q * t2);
      const ax = r1 * Math.cos(p * t1) * factor * breathe;
      const ay = r1 * Math.sin(p * t1) * factor * breathe;
      const az = r * Math.sin(q * t1) * factor * breathe;
      const bx = r2 * Math.cos(p * t2) * factor * breathe;
      const by = r2 * Math.sin(p * t2) * factor * breathe;
      const bz = r * Math.sin(q * t2) * factor * breathe;
      const a = rot3d(ax, ay, az, rx, ry, rz), b = rot3d(bx, by, bz, rx, ry, rz);
      const h = (hue + i * 0.6 + t * 0.1) % 360;
      const alpha = 0.4 + 0.3 * Math.sin(t * 0.004 + i * 0.02);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${h},80%,65%,${alpha})`;
      ctx.lineWidth = 0.7; ctx.stroke();
    }
    // Cross-connecting lines for mesh density
    for (let i = 0; i < segs; i += 8) {
      const j = (i + segs / 3) % segs;
      const t1 = (i / segs) * TAU * 2, t2 = (j / segs) * TAU * 2;
      const r1 = R + r * Math.cos(q * t1), r2 = R + r * Math.cos(q * t2);
      const a = rot3d(r1 * Math.cos(p * t1) * factor * breathe, r1 * Math.sin(p * t1) * factor * breathe, r * Math.sin(q * t1) * factor * breathe, rx, ry, rz);
      const b = rot3d(r2 * Math.cos(p * t2) * factor * breathe, r2 * Math.sin(p * t2) * factor * breathe, r * Math.sin(q * t2) * factor * breathe, rx, ry, rz);
      const h = (hue + i * 0.3 + 180) % 360;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${h},70%,55%,0.12)`;
      ctx.lineWidth = 0.3; ctx.stroke();
    }
    ctx.restore();
  }

  // === DENSE FLOWER OF LIFE — many concentric circles as line segments ===
  function drawDenseFlower(cx, cy, sc, rings, rx, ry, rz, hue, t) {
    ctx.save(); ctx.translate(cx, cy);
    const breathe = 0.9 + 0.1 * Math.sin(t * 0.0025);
    const r = sc * 0.25;
    for (let ring = 0; ring < rings; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let i = 0; i < n; i++) {
        const ca = (i / n) * TAU;
        const ocx = ring === 0 ? 0 : Math.cos(ca) * r * ring;
        const ocy = ring === 0 ? 0 : Math.sin(ca) * r * ring;
        const segs = 60;
        for (let s = 0; s < segs; s++) {
          const a1 = (s / segs) * TAU, a2 = ((s + 1) / segs) * TAU;
          const x1 = ocx + Math.cos(a1) * r, y1 = ocy + Math.sin(a1) * r;
          const x2 = ocx + Math.cos(a2) * r, y2 = ocy + Math.sin(a2) * r;
          const pa = rot3d(x1 * breathe, y1 * breathe, 0, rx, ry, rz);
          const pb = rot3d(x2 * breathe, y2 * breathe, 0, rx, ry, rz);
          const h = (hue + s * 6 + ring * 30 + i * 10 + t * 0.08) % 360;
          const alpha = 0.3 + 0.2 * Math.sin(t * 0.002 + s * 0.1);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `hsla(${h},75%,62%,${alpha})`;
          ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Shape definitions — faster rotation speeds
  const shapes = [
    {
      type: 'torus', cx: 0.48, cy: 0.42, sc: 300, p: 2, q: 3, R: 80, r: 32,
      rs: [0.002 / PHI, 0.003, 0.0013 * PHI], hue: 0
    },
    {
      type: 'flower', cx: 0.2, cy: 0.35, sc: 220, rings: 3,
      rs: [-0.0015, 0.0025 / PHI, 0.0008], hue: 180
    },
    {
      type: 'torus', cx: 0.8, cy: 0.58, sc: 240, p: 3, q: 5, R: 60, r: 28,
      rs: [0.0025, -0.0018 / PHI, 0.0015], hue: 90
    },
    {
      type: 'flower', cx: 0.65, cy: 0.22, sc: 160, rings: 2,
      rs: [0.0018 / PHI, -0.001, 0.002], hue: 270
    },
    {
      type: 'torus', cx: 0.12, cy: 0.65, sc: 180, p: 5, q: 7, R: 50, r: 22,
      rs: [0.001, 0.0022, -0.0012 / PHI], hue: 45
    },
    {
      type: 'torus', cx: 0.88, cy: 0.38, sc: 170, p: 3, q: 4, R: 55, r: 24,
      rs: [-0.0013 / PHI, 0.0017, 0.001], hue: 320
    },
  ];

  function animate() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    drawNebula(frame);
    drawStars(frame);
    drawShootingStar();
    shapes.forEach(s => {
      const rx = frame * s.rs[0], ry = frame * s.rs[1], rz = frame * s.rs[2];
      const h = (s.hue + frame * 0.08) % 360;
      if (s.type === 'torus') drawDenseTorus(W * s.cx, H * s.cy, s.R, s.r, s.p, s.q, s.sc, rx, ry, rz, h, frame);
      else drawDenseFlower(W * s.cx, H * s.cy, s.sc, s.rings, rx, ry, rz, h, frame);
    });
    raf = requestAnimationFrame(animate);
  }

  function resize(c) { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; }
  function init(id) {
    const c = document.getElementById(id); if (!c) return;
    ctx = c.getContext('2d'); resize(c); initStars();
    window.addEventListener('resize', () => { resize(c); initStars(); }); animate();
  }
  function destroy() { if (raf) cancelAnimationFrame(raf); }
  return { init, destroy };
})();
