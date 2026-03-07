/**
 * Sacred Geometry v4.0 — Cosmic Starfield + Gyroscopic Wireframes
 * Bright visible shapes, starry cosmos, full HSL spectrum, flowing motion.
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895, TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf, stars = [];

  function proj(x, y, z, rx, ry, rz) {
    let x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz), z1 = z;
    let y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx), z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx), x2 = x1;
    let x3 = x2 * Math.cos(ry) + z2 * Math.sin(ry); z2 = -x2 * Math.sin(ry) + z2 * Math.cos(ry);
    return { x: x3, y: y2, z: z2 };
  }

  // Starfield
  function initStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000,
        z: Math.random() * 1000, speed: 0.1 + Math.random() * 0.4,
        size: 0.5 + Math.random() * 2, hue: Math.random() * 360,
        twinkle: Math.random() * TAU
      });
    }
  }

  function drawStars(t) {
    stars.forEach(s => {
      s.twinkle += 0.02;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.twinkle));
      const sx = (s.x / (s.z * 0.001 + 1)) + W / 2;
      const sy = (s.y / (s.z * 0.001 + 1)) + H / 2;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) return;
      ctx.beginPath();
      ctx.arc(sx, sy, s.size * alpha, 0, TAU);
      const h = (s.hue + t * 0.02) % 360;
      ctx.fillStyle = `hsla(${h},80%,80%,${alpha * 0.7})`;
      ctx.fill();
      // Star glow
      if (s.size > 1.2) {
        ctx.beginPath();
        ctx.arc(sx, sy, s.size * 3, 0, TAU);
        ctx.fillStyle = `hsla(${h},70%,70%,${alpha * 0.08})`;
        ctx.fill();
      }
    });
  }

  // Nebula clouds
  function drawNebula(t) {
    const clouds = [
      { x: 0.2, y: 0.3, r: 250, h: 280, s: 60 }, // purple
      { x: 0.75, y: 0.6, r: 300, h: 200, s: 50 }, // cyan
      { x: 0.5, y: 0.8, r: 200, h: 340, s: 55 }, // magenta
      { x: 0.1, y: 0.7, r: 180, h: 30, s: 65 },  // orange
      { x: 0.85, y: 0.2, r: 220, h: 160, s: 50 }, // teal
    ];
    clouds.forEach(c => {
      const cx = W * c.x + Math.sin(t * 0.0003 + c.h) * 30;
      const cy = H * c.y + Math.cos(t * 0.0004 / PHI + c.h) * 20;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r);
      const h = (c.h + t * 0.01) % 360;
      grad.addColorStop(0, `hsla(${h},${c.s}%,40%,0.06)`);
      grad.addColorStop(0.5, `hsla(${h},${c.s}%,30%,0.03)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - c.r, cy - c.r, c.r * 2, c.r * 2);
    });
  }

  function torusKnot(R, r, p, q, segs) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * TAU * 2;
      const rr = R + r * Math.cos(q * t);
      pts.push([rr * Math.cos(p * t), rr * Math.sin(p * t), r * Math.sin(q * t)]);
    }
    return pts;
  }

  function flowerLines(r, rings) {
    const lines = [];
    for (let ring = 0; ring < rings; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const cx = ring === 0 ? 0 : Math.cos(a) * r * ring;
        const cy = ring === 0 ? 0 : Math.sin(a) * r * ring;
        for (let s = 0; s < 36; s++) {
          const a1 = (s / 36) * TAU, a2 = ((s + 1) / 36) * TAU;
          lines.push([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 0]);
        }
      }
    }
    return lines;
  }

  const shapes = [
    {
      type: 'torus', cx: 0.5, cy: 0.45, scale: 0.3, p: 2, q: 3, R: 80, r: 30,
      rSpeed: [0.0008 / PHI, 0.0012, 0.0005 * PHI], hueBase: 0, lineWidth: 1
    },
    {
      type: 'flower', cx: 0.2, cy: 0.35, scale: 0.22, rings: 3,
      rSpeed: [-0.0006, 0.001 / PHI, 0.0003], hueBase: 180, lineWidth: 0.8
    },
    {
      type: 'torus', cx: 0.8, cy: 0.6, scale: 0.22, p: 3, q: 5, R: 60, r: 25,
      rSpeed: [0.001, -0.0007 / PHI, 0.0006], hueBase: 90, lineWidth: 0.9
    },
    {
      type: 'flower', cx: 0.65, cy: 0.25, scale: 0.16, rings: 2,
      rSpeed: [0.0007 / PHI, -0.0004, 0.0008], hueBase: 270, lineWidth: 0.7
    },
    {
      type: 'torus', cx: 0.15, cy: 0.65, scale: 0.14, p: 5, q: 7, R: 50, r: 20,
      rSpeed: [0.0004, 0.0009, -0.0005 / PHI], hueBase: 45, lineWidth: 0.7
    },
    {
      type: 'torus', cx: 0.85, cy: 0.4, scale: 0.15, p: 3, q: 4, R: 55, r: 22,
      rSpeed: [-0.0005 / PHI, 0.0007, 0.0004], hueBase: 320, lineWidth: 0.7
    },
  ];

  function drawShape(shape, t) {
    const cx = W * shape.cx, cy = H * shape.cy;
    const sc = Math.min(W, H) * shape.scale;
    const rx = t * shape.rSpeed[0], ry = t * shape.rSpeed[1], rz = t * shape.rSpeed[2];
    const breathe = 0.9 + 0.1 * Math.sin(t * 0.002 * PHI + shape.hueBase);
    const baseHue = (shape.hueBase + t * 0.08) % 360; // fast hue shift

    ctx.save();
    ctx.translate(cx, cy);

    if (shape.type === 'torus') {
      const pts = torusKnot(shape.R, shape.r, shape.p, shape.q, 400);
      const factor = sc / 120 * breathe;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = proj(pts[i][0] * factor, pts[i][1] * factor, pts[i][2] * factor, rx, ry, rz);
        const b = proj(pts[i + 1][0] * factor, pts[i + 1][1] * factor, pts[i + 1][2] * factor, rx, ry, rz);
        const h = (baseHue + i * 0.9) % 360;
        const alpha = 0.35 + 0.25 * Math.sin(t * 0.003 + i * 0.04);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsla(${h},75%,65%,${alpha})`;
        ctx.lineWidth = shape.lineWidth;
        ctx.stroke();
      }
    } else if (shape.type === 'flower') {
      const lines = flowerLines(sc * 0.3, shape.rings);
      lines.forEach((l, i) => {
        const a = proj(l[0] * breathe, l[1] * breathe, l[2], rx, ry, rz);
        const b = proj(l[3] * breathe, l[4] * breathe, l[5], rx, ry, rz);
        const h = (baseHue + i * 0.6) % 360;
        const alpha = 0.2 + 0.15 * Math.sin(t * 0.002 + i * 0.03);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsla(${h},70%,60%,${alpha})`;
        ctx.lineWidth = shape.lineWidth;
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  // Shooting stars
  function drawShootingStar(t) {
    if (Math.random() > 0.005) return;
    const sx = Math.random() * W, sy = Math.random() * H * 0.5;
    const angle = Math.PI * 0.2 + Math.random() * 0.3;
    const len = 60 + Math.random() * 100;
    const h = Math.random() * 360;
    const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    grad.addColorStop(0, `hsla(${h},80%,80%,0.7)`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    drawNebula(frame);
    drawStars(frame);
    drawShootingStar(frame);
    shapes.forEach(s => drawShape(s, frame));
    raf = requestAnimationFrame(animate);
  }

  function resize(canvas) { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize(canvas);
    initStars();
    window.addEventListener('resize', () => { resize(canvas); initStars(); });
    animate();
  }
  function destroy() { if (raf) cancelAnimationFrame(raf); }
  return { init, destroy };
})();
