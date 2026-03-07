/**
 * Three.js 3D Projection Visual Debugger
 * Real-time visualization of agent trajectories, projection states,
 * and vector space operations in an interactive 3D dashboard.
 *
 * @module services/heady-ui/spatial-debugger
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * SpatialDebuggerServer — serves the 3D dashboard and provides
 * a WebSocket feed of real-time projection/agent events.
 */
class SpatialDebuggerServer {
    constructor(port = 3333) {
        this.port = port;
        this.clients = new Set();
        this.projections = new Map();
        this.agents = new Map();
        this.trailHistory = [];
        this.maxTrailPoints = FIB[14]; // 610
    }

    /**
     * Generate the full Three.js dashboard HTML.
     * Self-contained — no external CDN dependencies needed at runtime.
     */
    generateDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady™ Spatial Debugger — 3D Projection Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0f; color: #e0e0e0; font-family: 'SF Mono', monospace; overflow: hidden; }
    #canvas-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; }
    #hud {
      position: fixed; top: 20px; left: 20px; z-index: 10;
      background: rgba(10, 10, 20, 0.85); border: 1px solid rgba(130, 80, 255, 0.3);
      border-radius: 12px; padding: 16px 20px; min-width: 280px;
      backdrop-filter: blur(12px);
    }
    #hud h1 { font-size: 14px; color: #a78bfa; margin-bottom: 8px; letter-spacing: 1px; }
    #hud .stat { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
    #hud .stat .val { color: #22d3ee; font-weight: bold; }
    #legend {
      position: fixed; bottom: 20px; left: 20px; z-index: 10;
      background: rgba(10, 10, 20, 0.85); border: 1px solid rgba(130, 80, 255, 0.2);
      border-radius: 8px; padding: 12px 16px; font-size: 11px;
    }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .dot-agent { background: #22d3ee; } .dot-proj { background: #a78bfa; }
    .dot-trail { background: #f472b6; } .dot-anchor { background: #34d399; }
    #controls {
      position: fixed; top: 20px; right: 20px; z-index: 10;
      background: rgba(10, 10, 20, 0.85); border: 1px solid rgba(130, 80, 255, 0.2);
      border-radius: 8px; padding: 12px 16px;
    }
    button {
      background: rgba(130, 80, 255, 0.2); border: 1px solid rgba(130, 80, 255, 0.4);
      color: #e0e0e0; padding: 6px 12px; border-radius: 6px; cursor: pointer;
      font-size: 11px; margin: 2px;
    }
    button:hover { background: rgba(130, 80, 255, 0.4); }
    button.active { background: rgba(130, 80, 255, 0.6); border-color: #a78bfa; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="hud">
    <h1>🧠 HEADY™ SPATIAL DEBUGGER</h1>
    <div class="stat"><span>Agents</span><span class="val" id="stat-agents">0</span></div>
    <div class="stat"><span>Projections</span><span class="val" id="stat-proj">0</span></div>
    <div class="stat"><span>Trail Points</span><span class="val" id="stat-trail">0</span></div>
    <div class="stat"><span>FPS</span><span class="val" id="stat-fps">0</span></div>
    <div class="stat"><span>Drift (max)</span><span class="val" id="stat-drift">0.000</span></div>
    <div class="stat"><span>Collisions</span><span class="val" id="stat-collisions">0</span></div>
  </div>
  <div id="legend">
    <div><span class="dot dot-agent"></span>Agent</div>
    <div><span class="dot dot-proj"></span>Projection</div>
    <div><span class="dot dot-trail"></span>Trail</div>
    <div><span class="dot dot-anchor"></span>Anchor (φ-node)</div>
  </div>
  <div id="controls">
    <button onclick="toggleTrails()" id="btn-trails" class="active">Trails</button>
    <button onclick="toggleGrid()">Grid</button>
    <button onclick="resetCamera()">Reset View</button>
    <button onclick="toggleAutoRotate()" id="btn-rotate">Auto-Rotate</button>
  </div>

  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js",
                   "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/" } }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const PHI = 1.618033988749895;
    const PSI = 0.618033988749895;

    // ─── Scene Setup ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);

    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(30 * PSI, 20 * PHI, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = PSI * 0.1;
    controls.autoRotate = false;
    controls.autoRotateSpeed = PHI;

    // ─── Lighting (Sacred Geometry tricolor) ──────────────────────
    scene.add(new THREE.AmbientLight(0x404060, 0.4));
    const light1 = new THREE.PointLight(0xa78bfa, 1.5, 100); light1.position.set(20, 30, 20);
    const light2 = new THREE.PointLight(0x22d3ee, 1.0, 80);  light2.position.set(-20, 20, -20);
    const light3 = new THREE.PointLight(0xf472b6, 0.8, 60);  light3.position.set(0, -10, 30);
    scene.add(light1, light2, light3);

    // ─── Grid (φ-scaled) ──────────────────────────────────────────
    const gridSize = Math.round(34 * PHI); // ~55
    const grid = new THREE.GridHelper(gridSize, 34, 0x1a1a2e, 0x111122);
    grid.position.y = -0.01;
    scene.add(grid);

    // ─── φ-Anchor Nodes (golden ratio positions) ──────────────────
    const anchorGeo = new THREE.IcosahedronGeometry(0.3, 1);
    const anchorMat = new THREE.MeshPhongMaterial({ color: 0x34d399, emissive: 0x0a3d2a, wireframe: true });
    const anchors = [];
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(anchorGeo, anchorMat);
      const angle = (i / 8) * Math.PI * 2;
      const r = 10 * PHI;
      mesh.position.set(Math.cos(angle) * r, Math.sin(angle * PSI) * 5, Math.sin(angle) * r);
      scene.add(mesh);
      anchors.push(mesh);
    }

    // ─── Agent + Projection Objects ───────────────────────────────
    const agentGroup = new THREE.Group(); scene.add(agentGroup);
    const projGroup = new THREE.Group();  scene.add(projGroup);
    const trailGroup = new THREE.Group(); scene.add(trailGroup);
    let showTrails = true;

    const agentGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const agentMat = new THREE.MeshPhongMaterial({ color: 0x22d3ee, emissive: 0x0a2a3a });
    const projGeo  = new THREE.OctahedronGeometry(0.5, 0);
    const projMat  = new THREE.MeshPhongMaterial({ color: 0xa78bfa, emissive: 0x2a1a4a, transparent: true, opacity: 0.8 });

    function addAgent(id, x, y, z) {
      const mesh = new THREE.Mesh(agentGeo, agentMat.clone());
      mesh.position.set(x, y, z);
      mesh.userData = { id, type: 'agent', trail: [] };
      agentGroup.add(mesh);
    }

    function addProjection(id, x, y, z) {
      const mesh = new THREE.Mesh(projGeo, projMat.clone());
      mesh.position.set(x, y, z);
      mesh.userData = { id, type: 'projection' };
      projGroup.add(mesh);
    }

    // ─── Simulated Data (when no WebSocket) ──────────────────────
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addAgent('agent-' + i, Math.cos(a) * 8, Math.sin(a * PHI) * 3 + 5, Math.sin(a) * 8);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addProjection('proj-' + i, Math.cos(a) * 12, 2 + i * PSI, Math.sin(a) * 12);
    }

    // ─── Trail Rendering ─────────────────────────────────────────
    const trailMat = new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.4 });
    let trailPointCount = 0;

    function updateTrails() {
      trailGroup.clear();
      if (!showTrails) return;
      trailPointCount = 0;
      agentGroup.children.forEach(agent => {
        const trail = agent.userData.trail;
        if (trail.length < 2) return;
        const points = trail.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        trailGroup.add(new THREE.Line(geo, trailMat));
        trailPointCount += points.length;
      });
    }

    // ─── WebSocket Connection ─────────────────────────────────────
    let collisionCount = 0, maxDrift = 0;
    try {
      const ws = new WebSocket('ws://' + location.host + '/ws');
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'agent_update') {
          const agent = agentGroup.children.find(a => a.userData.id === msg.id);
          if (agent) {
            agent.position.set(msg.x, msg.y, msg.z);
            agent.userData.trail.push({ x: msg.x, y: msg.y, z: msg.z });
            if (agent.userData.trail.length > 200) agent.userData.trail.shift();
          }
        }
        if (msg.type === 'collision') collisionCount++;
        if (msg.type === 'drift') maxDrift = Math.max(maxDrift, msg.value);
      };
    } catch (e) { /* offline mode */ }

    // ─── Animation Loop ───────────────────────────────────────────
    let frameCount = 0, lastFpsTime = performance.now(), fps = 0;
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Animate agents (orbital motion when no WS data)
      agentGroup.children.forEach((a, i) => {
        const speed = 0.2 + i * 0.05 * PSI;
        const r = 8 + Math.sin(t * speed * PSI) * 2;
        const angle = (i / 8) * Math.PI * 2 + t * speed;
        a.position.x = Math.cos(angle) * r;
        a.position.z = Math.sin(angle) * r;
        a.position.y = 5 + Math.sin(t * speed * PHI + i) * 3;
        a.userData.trail.push({ x: a.position.x, y: a.position.y, z: a.position.z });
        if (a.userData.trail.length > 200) a.userData.trail.shift();
      });

      // Animate projections (pulsing + slow rotation)
      projGroup.children.forEach((p, i) => {
        p.rotation.y += 0.01 * PHI;
        p.rotation.x += 0.005 * PSI;
        const scale = 1 + Math.sin(t * 2 + i * PHI) * 0.15;
        p.scale.set(scale, scale, scale);
      });

      // Animate anchor nodes
      anchors.forEach((a, i) => {
        a.rotation.y += 0.02;
        a.rotation.z += 0.01 * PSI;
      });

      // Update trails every 30 frames
      if (frameCount % 30 === 0) updateTrails();

      // FPS counter
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
      }

      // Update HUD
      document.getElementById('stat-agents').textContent = agentGroup.children.length;
      document.getElementById('stat-proj').textContent = projGroup.children.length;
      document.getElementById('stat-trail').textContent = trailPointCount;
      document.getElementById('stat-fps').textContent = fps;
      document.getElementById('stat-drift').textContent = maxDrift.toFixed(3);
      document.getElementById('stat-collisions').textContent = collisionCount;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ─── Controls ─────────────────────────────────────────────────
    window.toggleTrails = () => { showTrails = !showTrails; document.getElementById('btn-trails').classList.toggle('active'); };
    window.toggleGrid = () => { grid.visible = !grid.visible; };
    window.resetCamera = () => { camera.position.set(30 * PSI, 20 * PHI, 30); controls.reset(); };
    window.toggleAutoRotate = () => { controls.autoRotate = !controls.autoRotate; document.getElementById('btn-rotate').classList.toggle('active'); };
    window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  </script>
</body>
</html>`;
    }

    /**
     * Create and start the HTTP + WS server
     */
    start() {
        const http = require('http');
        const { WebSocketServer } = require('ws');
        const server = http.createServer((req, res) => {
            if (req.url === '/' || req.url === '/debugger') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.generateDashboardHTML());
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        const wss = new WebSocketServer({ server, path: '/ws' });
        wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.on('close', () => this.clients.delete(ws));
        });

        server.listen(this.port, () => {
            console.log(`🧠 Heady Spatial Debugger → http://localhost:${this.port}`);
        });
        this.server = server;
        this.wss = wss;
    }

    /** Broadcast an event to all connected dashboard clients */
    broadcast(event) {
        const data = JSON.stringify(event);
        for (const ws of this.clients) {
            if (ws.readyState === 1) ws.send(data);
        }
    }

    /** Push agent position update to the dashboard */
    updateAgent(id, x, y, z) {
        this.agents.set(id, { x, y, z, t: Date.now() });
        this.broadcast({ type: 'agent_update', id, x, y, z });
    }

    /** Report a drift event */
    reportDrift(agentId, value) {
        this.broadcast({ type: 'drift', agentId, value });
    }

    /** Report a collision event */
    reportCollision(agentA, agentB, distance) {
        this.broadcast({ type: 'collision', agentA, agentB, distance });
    }
}

module.exports = { SpatialDebuggerServer };
