/**
 * HeadyMe Antigravity — App Component
 *
 * 3D vector space visualization with Sacred Geometry motifs.
 * Features: rotating hex wireframes, particle field, orbit controls,
 * neural architecture matrix, live heuristic feed, swarm topology.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/antigravity/App
 */

'use strict';

import './styles.css';
import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMERALD = 0x10B981;
const EMERALD_DIM = 0x0a7050;
const GOLD = 0xF5A623;
const ACCENT = 0x7B61FF;
const PARTICLE_COUNT = 480;
const HEX_RINGS = 3;

// ── Heuristic feed data ───────────────────────────────────────────────────────

const FEED_ENTRIES = [
  { label: 'HeadyBuddy',    action: 'cluster convergence',  value: '0.94 ρ' },
  { label: 'Antigravity',   action: 'projection updated',   value: 'Δ 3.2ms' },
  { label: 'VectorEngine',  action: 'density gate pass',    value: '384D ✓' },
  { label: 'SwarmCore',     action: 'node handshake',        value: '9 peers' },
  { label: 'HeadyCoder',    action: 'embedding indexed',     value: 'v12341' },
  { label: 'GovEngine',     action: 'policy eval pass',      value: 'APPROVE' },
];

const ENTITY_DATA = {
  id: 'vec_4f2a91c3',
  type: 'AgentMemory',
  dim: '384D',
  density: '0.92',
  cluster: 'C-Alpha-7',
  domain: 'headyme.com',
  ttl: '∞ pinned',
  updated: new Date().toISOString().slice(0, 19) + 'Z',
};

// ── Three.js Scene ────────────────────────────────────────────────────────────

/**
 * Create and manage the Three.js 3D viewport scene.
 * @param {HTMLElement} canvasContainer - Container to mount the renderer into
 * @returns {{ dispose: () => void }}
 */
function createThreeScene(canvasContainer) {
  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvasContainer.clientWidth || 600, canvasContainer.clientHeight || 400);
  renderer.setClearColor(0x0a0c10, 1);
  canvasContainer.appendChild(renderer.domElement);

  // Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    (canvasContainer.clientWidth || 600) / (canvasContainer.clientHeight || 400),
    0.1,
    1000
  );
  camera.position.set(0, 0, 18);

  // Fog
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.025);

  // ── Sacred Geometry Hex Grid ──────────────────────────────────────────────
  const hexGroup = new THREE.Group();

  const hexShape = new THREE.Shape();
  const r = 2.0;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) hexShape.moveTo(x, y);
    else hexShape.lineTo(x, y);
  }
  hexShape.closePath();

  const hexPoints = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    hexPoints.push(new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle), 0));
  }
  hexPoints.push(hexPoints[0].clone());
  const hexLineGeo = new THREE.BufferGeometry().setFromPoints(hexPoints);

  const hexPositions = [
    [0, 0, 0],
    [3.46, 2, -2], [-3.46, 2, -2],
    [3.46, -2, -2], [-3.46, -2, -2],
    [0, 4, -4], [0, -4, -4],
  ];

  hexPositions.forEach(([x, y, z], i) => {
    const mat = new THREE.LineBasicMaterial({
      color: i === 0 ? EMERALD : EMERALD_DIM,
      transparent: true,
      opacity: i === 0 ? 0.85 : 0.3 + Math.random() * 0.2,
    });
    const line = new THREE.LineLoop(hexLineGeo, mat);
    line.position.set(x, y, z);
    line.rotation.z = (Math.PI / 6) * (i % 2);
    hexGroup.add(line);
  });

  scene.add(hexGroup);

  // ── Inner sacred geometry: dodecahedron wireframe ────────────────────────
  const dodecGeo = new THREE.DodecahedronGeometry(3.5, 0);
  const dodecEdges = new THREE.EdgesGeometry(dodecGeo);
  const dodecMat = new THREE.LineBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.18,
  });
  const dodecMesh = new THREE.LineSegments(dodecEdges, dodecMat);
  scene.add(dodecMesh);

  // ── Icosahedron ───────────────────────────────────────────────────────────
  const icoGeo = new THREE.IcosahedronGeometry(1.8, 0);
  const icoEdges = new THREE.EdgesGeometry(icoGeo);
  const icoMat = new THREE.LineBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0.35,
  });
  const icoMesh = new THREE.LineSegments(icoEdges, icoMat);
  scene.add(icoMesh);

  // ── Particle field ────────────────────────────────────────────────────────
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const col = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 6 + Math.random() * 10;

    positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Color: mostly emerald, some gold, some accent
    const t = Math.random();
    if (t < 0.6)       col.setHex(EMERALD);
    else if (t < 0.8)  col.setHex(GOLD);
    else               col.setHex(ACCENT);

    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ── Central glowing sphere ────────────────────────────────────────────────
  const coreGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: EMERALD });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  scene.add(coreMesh);

  // ── Connection lines between hex nodes ───────────────────────────────────
  const lineMat = new THREE.LineBasicMaterial({
    color: EMERALD_DIM,
    transparent: true,
    opacity: 0.15,
  });
  const lineGroup = new THREE.Group();
  for (let i = 0; i < hexPositions.length - 1; i++) {
    const [x1, y1, z1] = hexPositions[i];
    const [x2, y2, z2] = hexPositions[i + 1];
    const pts = [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    lineGroup.add(new THREE.Line(geo, lineMat));
  }
  scene.add(lineGroup);

  // ── Lighting ──────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x10B981, 0.3));
  const pointLight = new THREE.PointLight(EMERALD, 1.5, 30);
  pointLight.position.set(0, 0, 5);
  scene.add(pointLight);

  // ── Simple orbit controls (manual) ───────────────────────────────────────
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let rotX = 0, rotY = 0;

  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - prevMouse.x) * 0.005;
    rotX += (e.clientY - prevMouse.y) * 0.005;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  // ── Resize handler ─────────────────────────────────────────────────────────
  const resizeObserver = new ResizeObserver(() => {
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(canvasContainer);

  // ── Animation loop ────────────────────────────────────────────────────────
  let animId = null;
  let frame = 0;

  const animate = () => {
    animId = requestAnimationFrame(animate);
    frame++;

    const t = frame * 0.008;

    // Auto-rotate
    hexGroup.rotation.y = rotY + t * 0.3;
    hexGroup.rotation.x = rotX + Math.sin(t * 0.2) * 0.08;

    dodecMesh.rotation.y = -t * 0.15;
    dodecMesh.rotation.x = t * 0.07;

    icoMesh.rotation.y = t * 0.25;
    icoMesh.rotation.z = t * 0.12;

    particles.rotation.y = t * 0.04;

    // Core pulse
    const pulse = 0.9 + 0.15 * Math.sin(t * 3);
    coreMesh.scale.setScalar(pulse);

    renderer.render(scene, camera);
  };

  animate();

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}

// ── DOM Builders ──────────────────────────────────────────────────────────────

function buildHeader() {
  const header = document.createElement('header');
  header.className = 'ag-header';
  header.innerHTML = `
    <div class="ag-header-logo">
      <svg class="ag-logo-hex" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 2L25.26 8.5V21.5L14 28L2.74 21.5V8.5L14 2Z"
          stroke="#10B981" stroke-width="1.2" fill="none"/>
        <path d="M14 6L21.79 10.5V19.5L14 24L6.21 19.5V10.5L14 6Z"
          stroke="#10B981" stroke-width="0.6" fill="rgba(16,185,129,0.06)"/>
        <circle cx="14" cy="14" r="2.5" fill="#10B981" opacity="0.9"/>
      </svg>
      <div>
        <div class="ag-header-title">HeadyMe Antigravity</div>
        <div class="ag-header-subtitle">Autonomous Vector Intelligence</div>
      </div>
    </div>
    <span class="ag-badge">V3.1-STABLE</span>
    <div class="ag-header-spacer"></div>
    <div class="ag-header-meta">
      <div class="ag-status-dot"></div>
      <span class="ag-timestamp" id="ag-clock"></span>
    </div>
  `;
  return header;
}

function buildNeuralMatrix() {
  const panel = document.createElement('div');
  panel.className = 'ag-panel';
  panel.innerHTML = `<div class="ag-panel-title">Neural Architecture</div>`;

  const matrix = document.createElement('div');
  matrix.className = 'ag-matrix';

  const activations = [
    0.9, 0.7, 0.4, 0.8, 0.6, 0.3, 0.9, 0.5,
    0.8, 0.5, 0.9, 0.4, 0.7, 0.8, 0.2, 0.6,
    0.3, 0.9, 0.6, 0.7, 0.5, 0.9, 0.4, 0.8,
    0.7, 0.4, 0.8, 0.6, 0.9, 0.3, 0.7, 0.5,
    0.5, 0.8, 0.3, 0.9, 0.4, 0.6, 0.8, 0.7,
    0.9, 0.6, 0.7, 0.3, 0.8, 0.5, 0.4, 0.9,
    0.4, 0.7, 0.5, 0.8, 0.6, 0.9, 0.3, 0.7,
    0.6, 0.3, 0.9, 0.5, 0.7, 0.4, 0.8, 0.6,
  ];

  activations.forEach((val) => {
    const cell = document.createElement('div');
    cell.className = 'ag-matrix-cell';
    const alpha = 0.1 + val * 0.9;
    cell.style.background = `rgba(16, 185, 129, ${alpha})`;
    matrix.appendChild(cell);
  });

  panel.appendChild(matrix);

  // Animate cells
  setInterval(() => {
    const cells = matrix.querySelectorAll('.ag-matrix-cell');
    cells.forEach((cell) => {
      if (Math.random() < 0.15) {
        const v = 0.1 + Math.random() * 0.9;
        cell.style.opacity = String(v);
      }
    });
  }, 800);

  return panel;
}

function buildHeuristicFeed() {
  const panel = document.createElement('div');
  panel.className = 'ag-panel';
  panel.innerHTML = `<div class="ag-panel-title">Live Heuristic Feed</div>`;

  const feed = document.createElement('div');
  feed.className = 'ag-feed';

  FEED_ENTRIES.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'ag-feed-item';
    item.innerHTML = `
      <div class="ag-feed-icon" style="background: rgba(16,185,129,0.25); border: 1px solid rgba(16,185,129,0.4);"></div>
      <div class="ag-feed-item-text">
        <strong>${entry.label}</strong><br/>
        ${entry.action} — <span style="color:#F5A623">${entry.value}</span>
      </div>
    `;
    feed.appendChild(item);
  });

  panel.appendChild(feed);
  return panel;
}

function buildViewport() {
  const wrap = document.createElement('div');
  wrap.className = 'ag-viewport-wrap';

  const hdr = document.createElement('div');
  hdr.className = 'ag-viewport-header';
  hdr.innerHTML = `
    <span class="ag-viewport-label">Vector Space Viewport · 384D → 3D Projection</span>
    <div class="ag-viewport-controls">
      <button class="ag-ctrl-btn">Reset</button>
      <button class="ag-ctrl-btn">Wireframe</button>
      <button class="ag-ctrl-btn">Export</button>
    </div>
  `;
  wrap.appendChild(hdr);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'ag-canvas-container';
  canvasWrap.id = 'ag-canvas-container';

  const overlay = document.createElement('div');
  overlay.className = 'ag-canvas-overlay';
  overlay.innerHTML = `
    <div class="ag-overlay-corner tl">NODE DENSITY<br/>▒▒▒▒▒ 0.92</div>
    <div class="ag-overlay-corner tr">CLUSTER: C-ALPHA-7<br/>384 DIMENSIONS</div>
    <div class="ag-overlay-corner bl">PROJECTION: UMAP-3D<br/>EPOCH 2841</div>
    <div class="ag-overlay-corner br">FPS: LIVE<br/>VECTORS: 43,291</div>
  `;
  canvasWrap.appendChild(overlay);
  wrap.appendChild(canvasWrap);

  return { wrap, canvasWrap };
}

function buildEntityPanel() {
  const panel = document.createElement('div');
  panel.className = 'ag-panel';
  panel.innerHTML = `
    <div class="ag-panel-title">Selected Entity</div>
    <div class="ag-entity-id">${ENTITY_DATA.id}</div>
    ${Object.entries(ENTITY_DATA)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => `
        <div class="ag-entity-row">
          <span class="ag-entity-key">${k.toUpperCase()}</span>
          <span class="ag-entity-val">${v}</span>
        </div>
      `).join('')}
  `;
  return panel;
}

function buildTopologyPanel() {
  const panel = document.createElement('div');
  panel.className = 'ag-panel';
  panel.innerHTML = `<div class="ag-panel-title">Swarm Topology</div>`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 120');
  svg.classList.add('ag-topology-svg');

  // Draw a simple node graph
  const nodes = [
    { x: 100, y: 60, r: 6, main: true },
    { x: 40,  y: 25, r: 4 },
    { x: 160, y: 25, r: 4 },
    { x: 40,  y: 95, r: 4 },
    { x: 160, y: 95, r: 4 },
    { x: 20,  y: 60, r: 3 },
    { x: 180, y: 60, r: 3 },
    { x: 100, y: 10, r: 3 },
    { x: 100, y: 110, r: 3 },
  ];

  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 5], [2, 6], [3, 5], [4, 6],
    [0, 7], [0, 8],
  ];

  edges.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', nodes[a].x);
    line.setAttribute('y1', nodes[a].y);
    line.setAttribute('x2', nodes[b].x);
    line.setAttribute('y2', nodes[b].y);
    line.setAttribute('stroke', 'rgba(16,185,129,0.25)');
    line.setAttribute('stroke-width', '0.8');
    svg.appendChild(line);
  });

  nodes.forEach((n) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x);
    circle.setAttribute('cy', n.y);
    circle.setAttribute('r', n.r);
    circle.setAttribute('fill', n.main ? '#10B981' : 'rgba(16,185,129,0.4)');
    circle.setAttribute('stroke', '#10B981');
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);
  });

  panel.appendChild(svg);
  return panel;
}

function buildHUD() {
  const hud = document.createElement('div');
  hud.className = 'ag-hud';

  const bars = [
    { label: 'Node Density', heights: [60, 75, 55, 90, 70, 85, 65, 80] },
    { label: 'Cluster Dist.', heights: [40, 60, 80, 55, 70, 45, 85, 60] },
    { label: 'Sync Rate',     heights: [80, 60, 90, 70, 55, 85, 65, 75] },
  ];

  bars.forEach(({ label, heights }) => {
    const item = document.createElement('div');
    item.className = 'ag-hud-item';

    const lbl = document.createElement('div');
    lbl.className = 'ag-hud-label';
    lbl.textContent = label;
    item.appendChild(lbl);

    const barWrap = document.createElement('div');
    barWrap.className = 'ag-hud-bar-wrap';
    heights.forEach((h) => {
      const bar = document.createElement('div');
      bar.className = 'ag-hud-bar';
      bar.style.height = `${h}%`;
      barWrap.appendChild(bar);
    });
    item.appendChild(barWrap);
    hud.appendChild(item);
  });

  hud.appendChild(Object.assign(document.createElement('div'), { className: 'ag-hud-spacer' }));

  const proj = document.createElement('div');
  proj.className = 'ag-hud-projection';
  proj.innerHTML = `
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <polygon points="5,1 9,3.5 9,6.5 5,9 1,6.5 1,3.5" stroke="#10B981" stroke-width="0.8" fill="none"/>
    </svg>
    HEADY v3.1.0 · CLOUDFLARE EDGE · 43,291 VECTORS · SYNC: EVENT-DRIVEN
  `;
  hud.appendChild(proj);

  return hud;
}

// ── Main App Factory ──────────────────────────────────────────────────────────

/**
 * Create the Antigravity application DOM tree.
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
function createApp() {
  const root = document.createElement('div');
  root.className = 'ag-root';

  // Build layout
  root.appendChild(buildHeader());

  const layout = document.createElement('div');
  layout.className = 'ag-layout';

  // Left sidebar
  const leftSidebar = document.createElement('div');
  leftSidebar.className = 'ag-sidebar ag-sidebar-left';
  leftSidebar.appendChild(buildNeuralMatrix());
  leftSidebar.appendChild(buildHeuristicFeed());
  layout.appendChild(leftSidebar);

  // Center viewport
  const { wrap: viewportWrap, canvasWrap } = buildViewport();
  layout.appendChild(viewportWrap);

  // Right sidebar
  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'ag-sidebar ag-sidebar-right';
  rightSidebar.appendChild(buildEntityPanel());
  rightSidebar.appendChild(buildTopologyPanel());
  layout.appendChild(rightSidebar);

  root.appendChild(layout);
  root.appendChild(buildHUD());

  // Clock
  const clockEl = root.querySelector('#ag-clock');
  const updateClock = () => {
    if (clockEl) clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  // Three.js scene — initialized after root is in DOM
  let scene = null;
  const initScene = () => {
    if (canvasWrap.isConnected) {
      scene = createThreeScene(canvasWrap);
    }
  };

  // Use MutationObserver to init scene once element is in DOM
  if (canvasWrap.isConnected) {
    initScene();
  } else {
    const observer = new MutationObserver(() => {
      if (canvasWrap.isConnected) {
        observer.disconnect();
        initScene();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return {
    element: root,
    destroy() {
      clearInterval(clockInterval);
      scene?.dispose();
    },
  };
}

export default createApp;
export { createApp };
