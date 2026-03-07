/**
 * Sacred Geometry Background — Gyroscopic Animated Canvas v2.0
 * Renders layered, slowly rotating sacred geometry (Flower of Life, Metatron's Cube,
 * Sri Yantra triangles, Fibonacci spirals, Vesica Piscis) with thin color-shifting lines.
 *
 * Usage: <canvas id="heroCanvas"></canvas>
 *        SacredGeometryBG.init('heroCanvas');
 */
const SacredGeometryBG = (() => {
  const PHI = 1.618033988749895;
  const TAU = Math.PI * 2;
  let ctx, W, H, frame = 0, raf;

  // Color palette that shifts over time
  function hueShift(base, offset) {
    return `hsla(${(base + offset) % 360}, 70%, 65%, `;
  }

  function drawFlowerOfLife(cx, cy, r, rot, alpha, hue) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    // Central circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.strokeStyle = hueShift(hue, 0) + (alpha * 0.4) + ')';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // 6 surrounding circles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, r, 0, TAU);
      ctx.strokeStyle = hueShift(hue, i * 15) + (alpha * 0.3) + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // Second ring — 12 circles
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 2, Math.sin(a) * r * 2, r, 0, TAU);
      ctx.strokeStyle = hueShift(hue, i * 10 + 60) + (alpha * 0.15) + ')';
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMetatronsCube(cx, cy, r, rot, alpha, hue) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      pts.push([Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    pts.push([0, 0]);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.strokeStyle = `hsla(${(hue + (i + j) * 8) % 360}, 60%, 60%, ${alpha * 0.18})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 0.08, 0, TAU);
      ctx.strokeStyle = hueShift(hue, i * 20) + (alpha * 0.25) + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSriYantra(cx, cy, r, rot, alpha, hue) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let layer = 0; layer < 4; layer++) {
      const lr = r * (1 - layer * 0.2);
      const h = (hue + layer * 30) % 360;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU - Math.PI / 2;
        const x = Math.cos(a) * lr, y = Math.sin(a) * lr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsla(${h}, 65%, 60%, ${alpha * 0.25})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + Math.PI / 2;
        const x = Math.cos(a) * lr * 0.9, y = Math.sin(a) * lr * 0.9;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsla(${(h + 120) % 360}, 65%, 60%, ${alpha * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.03, 0, TAU);
    ctx.fillStyle = hueShift(hue, 180) + (alpha * 0.5) + ')';
    ctx.fill();
    ctx.restore();
  }

  function drawFibonacciSpiral(cx, cy, r, rot, alpha, hue) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    const steps = 200;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * 6 * Math.PI;
      const sr = r * 0.01 * Math.pow(PHI, t / (2 * Math.PI)) * 0.15;
      const x = Math.cos(t) * sr;
      const y = Math.sin(t) * sr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, `hsla(${hue}, 70%, 65%, ${alpha * 0.3})`);
    grad.addColorStop(0.618, `hsla(${(hue + 60) % 360}, 70%, 65%, ${alpha * 0.2})`);
    grad.addColorStop(1, `hsla(${(hue + 120) % 360}, 70%, 65%, ${alpha * 0.1})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }

  function drawVesicaPiscis(cx, cy, r, rot, alpha, hue) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const d = r * 0.5;
    [-1, 1].forEach((dir, i) => {
      ctx.beginPath();
      ctx.arc(dir * d, 0, r, 0, TAU);
      ctx.strokeStyle = hueShift(hue, i * 60) + (alpha * 0.2) + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, TAU);
    ctx.strokeStyle = hueShift(hue, 90) + (alpha * 0.1) + ')';
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawHexGrid(alpha, hue) {
    const size = 60;
    const h = size * Math.sqrt(3);
    for (let row = -1; row < H / h + 1; row++) {
      for (let col = -1; col < W / size + 1; col++) {
        const x = col * size * 1.5;
        const y = row * h + (col % 2 ? h / 2 : 0);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const px = x + Math.cos(a) * size * 0.3;
          const py = y + Math.sin(a) * size * 0.3;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `hsla(${(hue + col * 3 + row * 5) % 360}, 50%, 50%, ${alpha * 0.04})`;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }
  }

  const layers = [
    { draw: drawFlowerOfLife, x: 0.3, y: 0.35, scale: 0.22, speed: 0.00012, hueBase: 170 },
    { draw: drawMetatronsCube, x: 0.7, y: 0.3, scale: 0.18, speed: -0.00015, hueBase: 270 },
    { draw: drawSriYantra, x: 0.5, y: 0.65, scale: 0.2, speed: 0.0001, hueBase: 45 },
    { draw: drawFibonacciSpiral, x: 0.2, y: 0.7, scale: 0.25, speed: -0.00008, hueBase: 200 },
    { draw: drawVesicaPiscis, x: 0.8, y: 0.7, scale: 0.15, speed: 0.00018, hueBase: 320 },
    { draw: drawFlowerOfLife, x: 0.5, y: 0.2, scale: 0.12, speed: -0.0002, hueBase: 120 },
    { draw: drawMetatronsCube, x: 0.15, y: 0.45, scale: 0.14, speed: 0.00013, hueBase: 30 },
    { draw: drawFibonacciSpiral, x: 0.85, y: 0.5, scale: 0.18, speed: -0.00011, hueBase: 90 },
  ];

  function animate() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    const globalHue = (frame * 0.05) % 360;
    drawHexGrid(0.6, globalHue);
    layers.forEach(l => {
      const rot = frame * l.speed;
      const breathe = 0.7 + 0.3 * Math.sin(frame * 0.001 + l.hueBase);
      const r = Math.min(W, H) * l.scale;
      const hue = (l.hueBase + globalHue) % 360;
      l.draw(W * l.x, H * l.y, r, rot, breathe, hue);
    });
    for (let i = 0; i < 30; i++) {
      const a = frame * 0.0003 * (i % 2 ? 1 : -1) + (i / 30) * TAU;
      const orbitR = 80 + i * (Math.min(W, H) * 0.012);
      const x = W / 2 + Math.cos(a) * orbitR * (i % 2 ? 1 : 1 / PHI);
      const y = H / 2 + Math.sin(a) * orbitR * (i % 2 ? 1 / PHI : 1);
      const sz = 1 + (i % 3) * 0.5;
      const h = (globalHue + i * 12) % 360;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, TAU);
      ctx.fillStyle = `hsla(${h}, 70%, 65%, ${0.25 + 0.15 * Math.sin(frame * 0.002 + i)})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(animate);
  }

  function resize(canvas) {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

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
