/**
 * Sacred Geometry Background v3.0 — Gyroscopic Flowing Wireframes
 * Dense thin-line meshes that rotate like gyroscopes with HSL color-shifting.
 * All timing governed by φ (1.618).
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895, TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf;

  // 3D → 2D projection
  function proj(x, y, z, rx, ry, rz) {
    // Rotate Z
    let x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz), z1 = z;
    // Rotate X
    let y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx), z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx), x2 = x1;
    // Rotate Y
    let x3 = x2 * Math.cos(ry) + z2 * Math.sin(ry), z3 = -x2 * Math.sin(ry) + z2 * Math.cos(ry);
    return { x: x3, y: y2, z: z3 };
  }

  // Generate torus knot points (dense wireframe mesh)
  function torusKnot(R, r, p, q, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * TAU * 2;
      const rr = R + r * Math.cos(q * t);
      pts.push([rr * Math.cos(p * t), rr * Math.sin(p * t), r * Math.sin(q * t)]);
    }
    return pts;
  }

  // Generate icosphere vertices
  function icosphere(r, detail) {
    const pts = [];
    const t2 = (1 + Math.sqrt(5)) / 2;
    const base = [[-1, t2, 0], [1, t2, 0], [-1, -t2, 0], [1, -t2, 0], [0, -1, t2], [0, 1, t2], [0, -1, -t2], [0, 1, -t2], [t2, 0, -1], [t2, 0, 1], [-t2, 0, -1], [-t2, 0, 1]];
    const norm = Math.sqrt(1 + t2 * t2);
    base.forEach(v => {
      for (let d = 0; d < detail; d++) {
        const a = (d / detail) * TAU;
        const jitter = 0.1;
        pts.push([(v[0] / norm + Math.cos(a) * jitter) * r, (v[1] / norm + Math.sin(a) * jitter) * r, (v[2] / norm) * r]);
      }
    });
    return pts;
  }

  // Flower of Life as dense line mesh
  function flowerLines(r, rings) {
    const lines = [];
    for (let ring = 0; ring < rings; ring++) {
      const n = ring === 0 ? 1 : ring * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const cx = ring === 0 ? 0 : Math.cos(a) * r * ring;
        const cy = ring === 0 ? 0 : Math.sin(a) * r * ring;
        const segs = 48;
        for (let s = 0; s < segs; s++) {
          const a1 = (s / segs) * TAU, a2 = ((s + 1) / segs) * TAU;
          lines.push([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 0]);
        }
      }
    }
    return lines;
  }

  // Shapes configuration — each gyroscope
  const shapes = [
    {
      type: 'torusKnot', cx: 0.5, cy: 0.45, scale: 0.28, p: 2, q: 3, R: 80, r: 30,
      rSpeed: [0.0003 / PHI, 0.0005, 0.0002 * PHI], hueBase: 170
    },
    {
      type: 'flower', cx: 0.22, cy: 0.35, scale: 0.18, rings: 3,
      rSpeed: [-0.0002, 0.0004 / PHI, 0.0001], hueBase: 280
    },
    {
      type: 'torusKnot', cx: 0.78, cy: 0.6, scale: 0.2, p: 3, q: 5, R: 60, r: 25,
      rSpeed: [0.0004, -0.0003 / PHI, 0.00025], hueBase: 40
    },
    {
      type: 'icosphere', cx: 0.35, cy: 0.72, scale: 0.15,
      rSpeed: [-0.00035, 0.0002, 0.00045 / PHI], hueBase: 120
    },
    {
      type: 'flower', cx: 0.7, cy: 0.25, scale: 0.14, rings: 2,
      rSpeed: [0.00025 / PHI, -0.00015, 0.0003], hueBase: 320
    },
    {
      type: 'torusKnot', cx: 0.15, cy: 0.55, scale: 0.12, p: 5, q: 7, R: 50, r: 20,
      rSpeed: [0.00015, 0.00035, -0.0002 / PHI], hueBase: 210
    },
    {
      type: 'icosphere', cx: 0.85, cy: 0.4, scale: 0.13,
      rSpeed: [-0.0002 / PHI, 0.0003, 0.00015], hueBase: 70
    },
  ];

  function drawShape(shape, t) {
    const cx = W * shape.cx, cy = H * shape.cy;
    const sc = Math.min(W, H) * shape.scale;
    const rx = t * shape.rSpeed[0];
    const ry = t * shape.rSpeed[1];
    const rz = t * shape.rSpeed[2];
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.0008 * PHI + shape.hueBase);
    const hue = (shape.hueBase + t * 0.015) % 360;

    ctx.save();
    ctx.translate(cx, cy);

    if (shape.type === 'torusKnot') {
      const pts = torusKnot(shape.R, shape.r, shape.p, shape.q, 300);
      const factor = sc / 120 * breathe;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = proj(pts[i][0] * factor, pts[i][1] * factor, pts[i][2] * factor, rx, ry, rz);
        const b = proj(pts[i + 1][0] * factor, pts[i + 1][1] * factor, pts[i + 1][2] * factor, rx, ry, rz);
        const h = (hue + i * 0.4) % 360;
        const alpha = 0.12 + 0.08 * Math.sin(t * 0.001 + i * 0.05);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsla(${h},65%,60%,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    } else if (shape.type === 'flower') {
      const lines = flowerLines(sc * 0.3, shape.rings);
      lines.forEach((l, i) => {
        const a = proj(l[0] * breathe, l[1] * breathe, l[2], rx, ry, rz);
        const b = proj(l[3] * breathe, l[4] * breathe, l[5], rx, ry, rz);
        const h = (hue + i * 0.15) % 360;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsla(${h},60%,55%,${0.06 + 0.04 * Math.sin(t * 0.0005 + i * 0.02)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      });
    } else if (shape.type === 'icosphere') {
      const pts = icosphere(sc * 0.8, 8);
      // Connect nearby points
      for (let i = 0; i < pts.length; i++) {
        const a = proj(pts[i][0] * breathe, pts[i][1] * breathe, pts[i][2] * breathe, rx, ry, rz);
        for (let j = i + 1; j < Math.min(i + 4, pts.length); j++) {
          const b = proj(pts[j][0] * breathe, pts[j][1] * breathe, pts[j][2] * breathe, rx, ry, rz);
          const h = (hue + (i + j) * 2) % 360;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `hsla(${h},55%,55%,${0.08 + 0.05 * Math.sin(t * 0.0007 + i)})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Flowing grid of phi-spaced dots
  function drawFlowField(t) {
    const spacing = 40;
    for (let gx = 0; gx < W; gx += spacing) {
      for (let gy = 0; gy < H; gy += spacing) {
        const angle = Math.sin(gx * 0.005 + t * 0.0003) * Math.cos(gy * 0.005 + t * 0.0004 / PHI) * TAU;
        const x = gx + Math.cos(angle) * 8;
        const y = gy + Math.sin(angle) * 8;
        const h = (t * 0.01 + gx * 0.3 + gy * 0.3) % 360;
        ctx.beginPath();
        ctx.arc(x, y, 0.6, 0, TAU);
        ctx.fillStyle = `hsla(${h},50%,50%,0.08)`;
        ctx.fill();
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    drawFlowField(frame);
    shapes.forEach(s => drawShape(s, frame));
    raf = requestAnimationFrame(animate);
  }

  function resize(canvas) { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize(canvas);
    window.addEventListener('resize', () => resize(canvas));
    animate();
  }
  function destroy() { if (raf) cancelAnimationFrame(raf); }
  return { init, destroy };
})();
