/**
 * Sacred Geometry v6.0 — Phi-Dynamic Morphing Gyroscopes
 * Every parameter (shape, color, position, scale, rotation) governed by φ.
 * Shapes drift on all 3 axes and morph their geometry in real-time.
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895, PHI_INV = 0.618033988749895, TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf, stars = [];

  function rot3d(x, y, z, rx, ry, rz) {
    let a = x * Math.cos(rz) - y * Math.sin(rz), b = x * Math.sin(rz) + y * Math.cos(rz), c = z;
    let d = b * Math.cos(rx) - c * Math.sin(rx), e = b * Math.sin(rx) + c * Math.cos(rx);
    let f = a * Math.cos(ry) + e * Math.sin(ry), g = -a * Math.sin(ry) + e * Math.cos(ry);
    return { x: f, y: d, z: g };
  }

  // φ-oscillator: smooth wave at golden-ratio frequency
  function phiWave(t, freq, phase) {
    return Math.sin(t * freq * PHI_INV + phase);
  }

  // === DRIFTING STARS ===
  function initStars() {
    stars = [];
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * TAU, sp = 0.2 + Math.random() * 1.2;
      stars.push({
        x: Math.random() * 2400 - 200, y: Math.random() * 1400 - 200,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: 0.4 + Math.random() * 2.5, hue: Math.random() * 360,
        tw: Math.random() * TAU, br: 0.4 + Math.random() * 0.6
      });
    }
  }
  function drawStars(t) {
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.tw += 0.03;
      if (s.x < -20) s.x = W + 20; if (s.x > W + 20) s.x = -20;
      if (s.y < -20) s.y = H + 20; if (s.y > H + 20) s.y = -20;
      const al = s.br * (0.5 + 0.5 * Math.sin(s.tw));
      const h = (s.hue + t * 0.03) % 360;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (0.6 + 0.4 * Math.sin(s.tw)), 0, TAU);
      ctx.fillStyle = `hsla(${h},85%,82%,${al})`; ctx.fill();
      if (s.size > 1.5) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 4, 0, TAU);
        ctx.fillStyle = `hsla(${h},70%,70%,${al * 0.06})`; ctx.fill();
      }
    });
  }

  function drawNebula(t) {
    [[0.2, 0.3, 280], [0.75, 0.6, 200], [0.5, 0.8, 340], [0.1, 0.7, 30], [0.85, 0.2, 160]].forEach(([cx, cy, hb]) => {
      const x = W * cx + Math.sin(t * 0.0005 + hb) * 40, y = H * cy + Math.cos(t * 0.0006 / PHI + hb) * 30;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 250);
      grad.addColorStop(0, `hsla(${(hb + t * 0.015) % 360},60%,40%,0.07)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad; ctx.fillRect(x - 250, y - 250, 500, 500);
    });
  }

  function drawShootingStar() {
    if (Math.random() > 0.01) return;
    const sx = Math.random() * W, sy = Math.random() * H * 0.6;
    const a = 0.15 + Math.random() * 0.4, len = 80 + Math.random() * 150, h = Math.random() * 360;
    const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    grad.addColorStop(0, `hsla(${h},85%,85%,0.8)`); grad.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.stroke();
  }

  // === PHI-DYNAMIC TORUS KNOT ===
  // p,q morph over time; shape drifts on all axes
  function drawDynTorus(shape, t) {
    const segs = 500;
    // Phi-dynamic parameters
    const pMorph = shape.pBase + phiWave(t, 0.0003, shape.phase) * 0.8;
    const qMorph = shape.qBase + phiWave(t, 0.0002, shape.phase * PHI) * 0.6;
    const scaleMorph = shape.sc * (0.8 + 0.2 * phiWave(t, 0.0004, shape.phase * 2));
    const RMorph = shape.R * (0.85 + 0.15 * phiWave(t, 0.0005 * PHI_INV, shape.phase));
    const rMorph = shape.r * (0.9 + 0.1 * phiWave(t, 0.0003 * PHI, shape.phase + 1));

    // Gyroscopic rotation — each axis at phi-related speed
    const rx = t * shape.rs[0] + phiWave(t, 0.0006, 0) * 0.3;
    const ry = t * shape.rs[1] + phiWave(t, 0.0004 * PHI, 1) * 0.4;
    const rz = t * shape.rs[2] + phiWave(t, 0.0005 * PHI_INV, 2) * 0.2;

    // Position drifts on each axis using phi waves
    const driftX = W * shape.cx + phiWave(t, 0.0002, shape.phase) * W * 0.08;
    const driftY = H * shape.cy + phiWave(t, 0.00015 * PHI, shape.phase + 3) * H * 0.06;

    // Hue cycles through full spectrum governed by phi
    const baseHue = (shape.hue + t * 0.1 + phiWave(t, 0.0008, shape.phase) * 60) % 360;

    ctx.save();
    ctx.translate(driftX, driftY);
    const factor = scaleMorph * 0.008;
    const breathe = 0.9 + 0.1 * phiWave(t, 0.002 * PHI_INV, shape.phase);

    for (let i = 0; i < segs; i++) {
      const t1 = (i / segs) * TAU * 2, t2 = ((i + 1) / segs) * TAU * 2;
      const r1 = RMorph + rMorph * Math.cos(qMorph * t1);
      const r2 = RMorph + rMorph * Math.cos(qMorph * t2);
      const ax = r1 * Math.cos(pMorph * t1) * factor * breathe;
      const ay = r1 * Math.sin(pMorph * t1) * factor * breathe;
      const az = rMorph * Math.sin(qMorph * t1) * factor * breathe;
      const bx = r2 * Math.cos(pMorph * t2) * factor * breathe;
      const by = r2 * Math.sin(pMorph * t2) * factor * breathe;
      const bz = rMorph * Math.sin(qMorph * t2) * factor * breathe;
      const a = rot3d(ax, ay, az, rx, ry, rz), b = rot3d(bx, by, bz, rx, ry, rz);
      // Color shifts per segment with phi
      const h = (baseHue + i * PHI_INV * 2) % 360;
      const sat = 70 + 15 * phiWave(t, 0.001, i * 0.01);
      const lit = 60 + 10 * phiWave(t, 0.0008, i * 0.02 + 1);
      const alpha = 0.35 + 0.25 * phiWave(t, 0.003, i * 0.03);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${h},${sat}%,${lit}%,${alpha})`;
      ctx.lineWidth = 0.7; ctx.stroke();
    }
    // Cross-mesh
    for (let i = 0; i < segs; i += 6) {
      const j = (i + Math.floor(segs * PHI_INV)) % segs;
      const t1 = (i / segs) * TAU * 2, t2 = (j / segs) * TAU * 2;
      const r1 = RMorph + rMorph * Math.cos(qMorph * t1), r2 = RMorph + rMorph * Math.cos(qMorph * t2);
      const a = rot3d(r1 * Math.cos(pMorph * t1) * factor * breathe, r1 * Math.sin(pMorph * t1) * factor * breathe, rMorph * Math.sin(qMorph * t1) * factor * breathe, rx, ry, rz);
      const b = rot3d(r2 * Math.cos(pMorph * t2) * factor * breathe, r2 * Math.sin(pMorph * t2) * factor * breathe, rMorph * Math.sin(qMorph * t2) * factor * breathe, rx, ry, rz);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `hsla(${(baseHue + 180 + i * 0.3) % 360},65%,55%,0.15)`;
      ctx.lineWidth = 0.3; ctx.stroke();
    }
    ctx.restore();
  }

  // === PHI-DYNAMIC FLOWER OF LIFE ===
  function drawDynFlower(shape, t) {
    const sc = shape.sc * (0.85 + 0.15 * phiWave(t, 0.0003, shape.phase));
    const rx = t * shape.rs[0] + phiWave(t, 0.0005, 0) * 0.4;
    const ry = t * shape.rs[1] + phiWave(t, 0.0004 * PHI, 1) * 0.3;
    const rz = t * shape.rs[2] + phiWave(t, 0.0003 * PHI_INV, 2) * 0.25;
    const driftX = W * shape.cx + phiWave(t, 0.00018, shape.phase) * W * 0.07;
    const driftY = H * shape.cy + phiWave(t, 0.00014 * PHI, shape.phase + 2) * H * 0.05;
    const baseHue = (shape.hue + t * 0.12 + phiWave(t, 0.0006, shape.phase) * 80) % 360;
    const breathe = 0.88 + 0.12 * phiWave(t, 0.0018 * PHI_INV, shape.phase);
    const r = sc * 0.25;

    ctx.save(); ctx.translate(driftX, driftY);
    for (let ring = 0; ring < shape.rings; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let i = 0; i < n; i++) {
        const ca = (i / n) * TAU;
        const ocx = ring === 0 ? 0 : Math.cos(ca) * r * ring;
        const ocy = ring === 0 ? 0 : Math.sin(ca) * r * ring;
        const circleSegs = 48;
        for (let s = 0; s < circleSegs; s++) {
          const a1 = (s / circleSegs) * TAU, a2 = ((s + 1) / circleSegs) * TAU;
          const pa = rot3d((ocx + Math.cos(a1) * r) * breathe, (ocy + Math.sin(a1) * r) * breathe, 0, rx, ry, rz);
          const pb = rot3d((ocx + Math.cos(a2) * r) * breathe, (ocy + Math.sin(a2) * r) * breathe, 0, rx, ry, rz);
          const h = (baseHue + s * PHI * 4 + ring * 40 + i * 15) % 360;
          const alpha = 0.25 + 0.2 * phiWave(t, 0.002, s * 0.08 + ring);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `hsla(${h},75%,62%,${alpha})`;
          ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  const shapes = [
    {
      type: 'torus', cx: 0.48, cy: 0.42, sc: 320, pBase: 2, qBase: 3, R: 80, r: 32,
      rs: [0.002 / PHI, 0.003, 0.0013 * PHI], hue: 0, phase: 0
    },
    {
      type: 'flower', cx: 0.2, cy: 0.35, sc: 230, rings: 3,
      rs: [-0.0015, 0.0025 / PHI, 0.0008], hue: 180, phase: 2.5
    },
    {
      type: 'torus', cx: 0.8, cy: 0.58, sc: 260, pBase: 3, qBase: 5, R: 60, r: 28,
      rs: [0.0025, -0.0018 / PHI, 0.0015], hue: 90, phase: 5
    },
    {
      type: 'flower', cx: 0.65, cy: 0.22, sc: 170, rings: 2,
      rs: [0.0018 / PHI, -0.001, 0.002], hue: 270, phase: 7.5
    },
    {
      type: 'torus', cx: 0.12, cy: 0.65, sc: 190, pBase: 5, qBase: 7, R: 50, r: 22,
      rs: [0.001, 0.0022, -0.0012 / PHI], hue: 45, phase: 10
    },
    {
      type: 'torus', cx: 0.88, cy: 0.38, sc: 180, pBase: 3, qBase: 4, R: 55, r: 24,
      rs: [-0.0013 / PHI, 0.0017, 0.001], hue: 320, phase: 12.5
    },
  ];

  function animate() {
    ctx.clearRect(0, 0, W, H); frame++;
    drawNebula(frame); drawStars(frame); drawShootingStar();
    shapes.forEach(s => {
      if (s.type === 'torus') drawDynTorus(s, frame);
      else drawDynFlower(s, frame);
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
