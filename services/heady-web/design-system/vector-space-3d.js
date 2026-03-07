/**
 * Heady 3D Vector Space — 8-Octant Activity Visualizer v1.0
 * Renders an isometric 3D cube with 8 octants showing live system activity.
 * Each octant maps to a Heady service category.
 *
 * Usage: HeadyVectorSpace.init('vectorSpaceContainer');
 */
const HeadyVectorSpace = (() => {
    const PHI = 1.618033988749895;
    const TAU = Math.PI * 2;
    let canvas, ctx, W, H, frame = 0, raf;
    let rotX = -0.45, rotY = 0.6, autoRotSpeed = 0.001;

    const OCTANTS = [
        { name: 'Orchestration', color: [0, 212, 170], sign: [1, 1, 1] },
        { name: 'Intelligence', color: [139, 92, 246], sign: [-1, 1, 1] },
        { name: 'Memory', color: [0, 180, 255], sign: [1, -1, 1] },
        { name: 'Security', color: [244, 63, 94], sign: [-1, -1, 1] },
        { name: 'Development', color: [245, 158, 11], sign: [1, 1, -1] },
        { name: 'Infrastructure', color: [16, 185, 129], sign: [-1, 1, -1] },
        { name: 'Business', color: [201, 168, 76], sign: [1, -1, -1] },
        { name: 'Identity', color: [168, 85, 247], sign: [-1, -1, -1] },
    ];

    // Activity data per octant (simulated)
    function getActivity() {
        const t = Date.now() / 1000;
        return OCTANTS.map((o, i) => ({
            ...o,
            activity: 0.3 + 0.5 * Math.abs(Math.sin(t * 0.3 + i * PHI)),
            particles: Math.floor(3 + 5 * Math.abs(Math.sin(t * 0.2 + i))),
            pulsePhase: (t * 0.5 + i * 0.8) % TAU,
        }));
    }

    function project(x, y, z) {
        // Rotate around Y
        let x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
        let z1 = x * Math.sin(rotY) + z * Math.cos(rotY);
        // Rotate around X
        let y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
        // Perspective
        const fov = 600;
        const scale = fov / (fov + z2 + 300);
        return { x: W / 2 + x1 * scale, y: H / 2 + y1 * scale, z: z2, scale };
    }

    function drawLine(x1, y1, z1, x2, y2, z2, color, alpha) {
        const p1 = project(x1, y1, z1);
        const p2 = project(x2, y2, z2);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }

    function drawAxes(size) {
        const a = 0.15;
        // X axis (red-ish)
        drawLine(-size, 0, 0, size, 0, 0, [255, 100, 100], a);
        // Y axis (green-ish)
        drawLine(0, -size, 0, 0, size, 0, [100, 255, 100], a);
        // Z axis (blue-ish)
        drawLine(0, 0, -size, 0, 0, size, [100, 100, 255], a);
    }

    function drawWireframeCube(size, color, alpha) {
        const s = size;
        const edges = [
            [-s, -s, -s, s, -s, -s], [-s, s, -s, s, s, -s],
            [-s, -s, s, s, -s, s], [-s, s, s, s, s, s],
            [-s, -s, -s, -s, s, -s], [s, -s, -s, s, s, -s],
            [-s, -s, s, -s, s, s], [s, -s, s, s, s, s],
            [-s, -s, -s, -s, -s, s], [s, -s, -s, s, -s, s],
            [-s, s, -s, -s, s, s], [s, s, -s, s, s, s],
        ];
        edges.forEach(e => drawLine(e[0], e[1], e[2], e[3], e[4], e[5], color, alpha));
    }

    function drawOctant(oct, size) {
        const cx = oct.sign[0] * size * 0.5;
        const cy = oct.sign[1] * size * 0.5;
        const cz = oct.sign[2] * size * 0.5;
        const p = project(cx, cy, cz);
        const r = 8 + oct.activity * 25;
        const pulse = 1 + 0.15 * Math.sin(oct.pulsePhase);

        // Glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * pulse * 2);
        grad.addColorStop(0, `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},${0.3 * oct.activity})`);
        grad.addColorStop(1, `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * pulse * 2, 0, TAU);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core sphere
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * pulse * p.scale, 0, TAU);
        ctx.fillStyle = `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},${0.15 + 0.35 * oct.activity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},${0.4 + 0.3 * oct.activity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Particles orbiting
        for (let i = 0; i < oct.particles; i++) {
            const a = frame * 0.008 * (i % 2 ? 1 : -1) + (i / oct.particles) * TAU;
            const orbit = size * 0.25;
            const px = cx + Math.cos(a) * orbit * 0.3 * oct.sign[0];
            const py = cy + Math.sin(a) * orbit * 0.3 * oct.sign[1];
            const pz = cz + Math.sin(a * PHI) * orbit * 0.3 * oct.sign[2];
            const pp = project(px, py, pz);
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, 1.5 * pp.scale, 0, TAU);
            ctx.fillStyle = `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},${0.4 + 0.3 * Math.sin(frame * 0.02 + i)})`;
            ctx.fill();
        }

        // Label
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillStyle = `rgba(${oct.color[0]},${oct.color[1]},${oct.color[2]},0.8)`;
        ctx.textAlign = 'center';
        ctx.fillText(oct.name, p.x, p.y + r * pulse + 14);
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = `rgba(255,255,255,0.5)`;
        ctx.fillText(Math.floor(oct.activity * 100) + '%', p.x, p.y + 4);
    }

    function drawConnections(octants, size) {
        for (let i = 0; i < octants.length; i++) {
            for (let j = i + 1; j < octants.length; j++) {
                const a = octants[i], b = octants[j];
                const combined = (a.activity + b.activity) / 2;
                if (combined > 0.5) {
                    const ax = a.sign[0] * size * 0.5, ay = a.sign[1] * size * 0.5, az = a.sign[2] * size * 0.5;
                    const bx = b.sign[0] * size * 0.5, by = b.sign[1] * size * 0.5, bz = b.sign[2] * size * 0.5;
                    drawLine(ax, ay, az, bx, by, bz, [255, 255, 255], 0.04 + combined * 0.06);
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, W, H);
        frame++;
        rotY += autoRotSpeed;

        const size = Math.min(W, H) * 0.35;
        const octants = getActivity();

        drawWireframeCube(size, [255, 255, 255], 0.08);
        drawAxes(size * 1.15);
        // Dividing planes
        drawLine(-size, 0, -size, -size, 0, size, [255, 255, 255], 0.04);
        drawLine(size, 0, -size, size, 0, size, [255, 255, 255], 0.04);
        drawLine(-size, 0, -size, size, 0, -size, [255, 255, 255], 0.04);
        drawLine(-size, 0, size, size, 0, size, [255, 255, 255], 0.04);
        drawLine(0, -size, -size, 0, -size, size, [255, 255, 255], 0.04);
        drawLine(0, size, -size, 0, size, size, [255, 255, 255], 0.04);
        drawLine(0, -size, -size, 0, size, -size, [255, 255, 255], 0.04);
        drawLine(0, -size, size, 0, size, size, [255, 255, 255], 0.04);

        drawConnections(octants, size);
        // Sort by z for painter's algorithm
        const sorted = octants.map((o, i) => {
            const p = project(o.sign[0] * size * 0.5, o.sign[1] * size * 0.5, o.sign[2] * size * 0.5);
            return { ...o, depth: p.z, idx: i };
        }).sort((a, b) => b.depth - a.depth);
        sorted.forEach(o => drawOctant(o, size));

        // Title
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('3D VECTOR SPACE — 8 OCTANTS', W / 2, H - 12);

        raf = requestAnimationFrame(animate);
    }

    function resize() {
        W = canvas.width = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
    }

    function init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        // Create canvas if it doesn't exist
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:100%;display:block;border-radius:14px;background:rgba(10,14,23,0.6);border:1px solid rgba(255,255,255,0.06)';
        container.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
        // Mouse drag rotation
        let dragging = false, lastX, lastY;
        canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; autoRotSpeed = 0; });
        window.addEventListener('mouseup', () => { dragging = false; autoRotSpeed = 0.001; });
        canvas.addEventListener('mousemove', e => {
            if (!dragging) return;
            rotY += (e.clientX - lastX) * 0.005;
            rotX += (e.clientY - lastY) * 0.005;
            lastX = e.clientX; lastY = e.clientY;
        });
        animate();
    }

    return { init };
})();
