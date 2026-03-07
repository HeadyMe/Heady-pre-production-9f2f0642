/**
 * Heady Vector Explorer — App Component
 *
 * Semantic vector memory exploration with Three.js 3D scatter plot.
 * Features: search, 3D point cloud, vector details, federation status, replication log.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/vector-explorer/App
 */

'use strict';

import './styles.css';
import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL   = 0x10B981;
const GOLD   = 0xF5A623;
const BLUE   = 0x4c8fff;
const CYAN   = 0x00d4ff;
const POINT_COUNT = 380;

// ── Sample vector data ────────────────────────────────────────────────────────

const SAMPLE_VECTORS = [
  { id: 'vec_4f2a91c3', text: 'autonomous agent boot sequence', cluster: 'C-Alpha',  dim: 384, density: 0.94 },
  { id: 'vec_b8e12440', text: 'vector federation gossip pull',  cluster: 'C-Beta',   dim: 384, density: 0.91 },
  { id: 'vec_7c4d9101', text: 'MCP tool invocation pattern',   cluster: 'C-Gamma',  dim: 384, density: 0.88 },
  { id: 'vec_3a8f0c22', text: 'governance policy evaluation',   cluster: 'C-Delta',  dim: 384, density: 0.93 },
  { id: 'vec_d2b59f84', text: 'heady coder pull request fix',   cluster: 'C-Alpha',  dim: 384, density: 0.89 },
];

const SELECTED_VECTOR = SAMPLE_VECTORS[0];
const EMBEDDING_PREVIEW = '[ 0.0421, -0.2187, 0.8832, 0.1204, -0.5563, 0.7741, 0.0329, -0.4412, 0.2918, 0.6604 … +374 ]';

const FEDERATION_NODES = [
  { name: 'node-headyme',      count: '18,441', active: true },
  { name: 'node-headysystems', count: '12,302', active: true },
  { name: 'node-headymcp',     count: '7,291',  active: true },
  { name: 'node-colab-gpu',    count: '5,257',  active: false },
];

const REPLICATION_LOG = [
  { time: '03:07:11', action: 'PUSH', peer: 'node-headysystems', count: 3 },
  { time: '03:06:58', action: 'PULL', peer: 'node-headymcp',     count: 12 },
  { time: '03:05:43', action: 'GOSSIP', peer: 'node-headyme',    count: 8 },
  { time: '03:04:01', action: 'PUSH', peer: 'node-headysystems', count: 1 },
  { time: '03:02:30', action: 'PULL', peer: 'node-colab-gpu',    count: 0 },
];

// ── Three.js 3D Scatter Plot ──────────────────────────────────────────────────

/**
 * Create a 3D point cloud scatter plot representing the vector space.
 * @param {HTMLElement} container
 * @returns {{ dispose: () => void }}
 */
function createScatterPlot(container) {
  const w = container.clientWidth || 500;
  const h = container.clientHeight || 340;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x0a0f0d, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0f0d, 0.03);

  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);
  camera.position.set(0, 0, 22);

  // ── Point cloud ─────────────────────────────────────────────────────────
  const positions = new Float32Array(POINT_COUNT * 3);
  const colors = new Float32Array(POINT_COUNT * 3);
  const col = new THREE.Color();

  // Create clusters
  const clusterCenters = [
    { x: -4, y: 2,  z: -1 },   // C-Alpha (teal)
    { x:  4, y: -2, z: 2  },   // C-Beta  (gold)
    { x:  0, y: 5,  z: -3 },   // C-Gamma (blue)
    { x: -3, y: -4, z: 3  },   // C-Delta (cyan)
  ];

  const clusterColors = [TEAL, GOLD, BLUE, CYAN];

  for (let i = 0; i < POINT_COUNT; i++) {
    const ci = Math.floor(Math.random() * 4);
    const center = clusterCenters[ci];

    positions[i * 3]     = center.x + (Math.random() - 0.5) * 5;
    positions[i * 3 + 1] = center.y + (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 5;

    col.setHex(clusterColors[ci]);
    colors[i * 3]     = col.r * (0.5 + Math.random() * 0.5);
    colors[i * 3 + 1] = col.g * (0.5 + Math.random() * 0.5);
    colors[i * 3 + 2] = col.b * (0.5 + Math.random() * 0.5);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // ── Highlight selected vector ────────────────────────────────────────────
  const selectedGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const selectedMat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.9 });
  const selectedMesh = new THREE.Mesh(selectedGeo, selectedMat);
  selectedMesh.position.set(-4.2, 2.3, -0.8);
  scene.add(selectedMesh);

  // Ring around selected
  const ringGeo = new THREE.RingGeometry(0.35, 0.45, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: TEAL, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(selectedMesh.position);
  scene.add(ring);

  // ── Cluster centroids ────────────────────────────────────────────────────
  clusterCenters.forEach((c, i) => {
    const cGeo = new THREE.OctahedronGeometry(0.3, 0);
    const cMat = new THREE.MeshBasicMaterial({ color: clusterColors[i], transparent: true, opacity: 0.6 });
    const cMesh = new THREE.Mesh(cGeo, cMat);
    cMesh.position.set(c.x, c.y, c.z);
    scene.add(cMesh);
  });

  // ── Axes helper ──────────────────────────────────────────────────────────
  const axesMat = new THREE.LineBasicMaterial({ color: 0x223024, transparent: true, opacity: 0.4 });
  [
    [[0, 0, 0], [8, 0, 0]],
    [[0, 0, 0], [0, 8, 0]],
    [[0, 0, 0], [0, 0, 8]],
  ].forEach(([a, b]) => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...a),
      new THREE.Vector3(...b),
    ]);
    scene.add(new THREE.Line(g, axesMat));
  });

  // ── Mouse orbit ──────────────────────────────────────────────────────────
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let rotX = 0, rotY = 0;

  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - prevMouse.x) * 0.005;
    rotX += (e.clientY - prevMouse.y) * 0.005;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  // ── Resize ───────────────────────────────────────────────────────────────
  const resizeObserver = new ResizeObserver(() => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    renderer.setSize(cw, ch);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // ── Animate ──────────────────────────────────────────────────────────────
  let animId = null;
  let frame = 0;

  const animate = () => {
    animId = requestAnimationFrame(animate);
    frame++;
    const t = frame * 0.006;

    points.rotation.y = rotY + t * 0.12;
    points.rotation.x = rotX + Math.sin(t * 0.18) * 0.05;

    ring.rotation.z = t * 1.5;
    ring.rotation.y = t * 0.8;

    selectedMesh.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3));

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

// ── Builders ──────────────────────────────────────────────────────────────────

function buildHeader() {
  const h = document.createElement('header');
  h.className = 've-header';
  h.innerHTML = `
    <div class="ve-logo">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L20.53 7.5V16.5L11 22L1.47 16.5V7.5L11 2Z"
          stroke="#10B981" stroke-width="1.2" fill="rgba(16,185,129,0.06)"/>
        <circle cx="11" cy="11" r="2.5" fill="#10B981" opacity="0.9"/>
      </svg>
      Vector Explorer
    </div>
    <span class="ve-badge">384D · FEDERATED</span>
    <div class="ve-spacer"></div>
    <span class="ve-clock" id="ve-clock"></span>
  `;
  return h;
}

function buildSearchBar() {
  const bar = document.createElement('div');
  bar.className = 've-search-bar';
  bar.innerHTML = `
    <input class="ve-search-input" type="text"
      placeholder="Search vectors by meaning… (e.g. 'autonomous agent memory')"
      value="autonomous agent boot" aria-label="Semantic vector search"/>
    <button class="ve-search-btn">Search</button>
    <button class="ve-search-tag active">Semantic</button>
    <button class="ve-search-tag">Exact</button>
    <button class="ve-search-tag">Cluster</button>
  `;
  return bar;
}

function buildVectorDetails() {
  const section = document.createElement('div');
  section.className = 've-panel-section';

  const title = document.createElement('div');
  title.className = 've-panel-title';
  title.textContent = 'Selected Vector';
  section.appendChild(title);

  section.innerHTML += `
    <div class="ve-panel-title">Selected Vector</div>
    <div class="ve-vec-id">${SELECTED_VECTOR.id}</div>
    <div class="ve-vec-row"><span class="ve-vec-key">Text</span><span class="ve-vec-val">${SELECTED_VECTOR.text}</span></div>
    <div class="ve-vec-row"><span class="ve-vec-key">Dimensions</span><span class="ve-vec-val">${SELECTED_VECTOR.dim}D</span></div>
    <div class="ve-vec-row"><span class="ve-vec-key">Cluster</span><span class="ve-vec-val">${SELECTED_VECTOR.cluster}</span></div>
    <div class="ve-vec-row"><span class="ve-vec-key">Density</span><span class="ve-vec-val">${SELECTED_VECTOR.density}</span></div>
    <div class="ve-vec-row"><span class="ve-vec-key">TTL</span><span class="ve-vec-val">∞ pinned</span></div>
    <div class="ve-embedding-preview">${EMBEDDING_PREVIEW}</div>
  `;

  return section;
}

function buildStats() {
  const section = document.createElement('div');
  section.className = 've-panel-section';
  section.innerHTML = `
    <div class="ve-panel-title">Stats</div>
    <div class="ve-stats-grid">
      <div class="ve-stat-card"><div class="ve-stat-val">43,291</div><div class="ve-stat-label">Total Vectors</div></div>
      <div class="ve-stat-card"><div class="ve-stat-val">384</div><div class="ve-stat-label">Dimensions</div></div>
      <div class="ve-stat-card"><div class="ve-stat-val">3</div><div class="ve-stat-label">Proj. Dims</div></div>
      <div class="ve-stat-card"><div class="ve-stat-val">0.92</div><div class="ve-stat-label">Density Gate</div></div>
    </div>
  `;
  return section;
}

function buildFederationStatus() {
  const section = document.createElement('div');
  section.className = 've-panel-section';

  const title = document.createElement('div');
  title.className = 've-panel-title';
  title.textContent = 'Federation Nodes';
  section.appendChild(title);

  const list = document.createElement('div');
  list.className = 've-fed-list';
  FEDERATION_NODES.forEach(({ name, count, active }) => {
    const item = document.createElement('div');
    item.className = 've-fed-item';
    item.innerHTML = `
      <div class="ve-fed-dot" style="background:${active ? 'var(--ve-teal)' : 'var(--ve-muted)'}"></div>
      <div class="ve-fed-name">${name}</div>
      <div class="ve-fed-count">${count}</div>
    `;
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function buildReplicationLog() {
  const section = document.createElement('div');
  section.className = 've-panel-section';

  const title = document.createElement('div');
  title.className = 've-panel-title';
  title.textContent = 'Replication Log';
  section.appendChild(title);

  const log = document.createElement('div');
  log.className = 've-rep-log';
  REPLICATION_LOG.forEach(({ time, action, peer, count }) => {
    const item = document.createElement('div');
    item.className = 've-rep-item';
    item.innerHTML = `
      <span>${time}</span>
      <span class="action">${action}</span>
      <span class="peer">${peer}</span>
      <span>${count > 0 ? `+${count}` : 'no-op'}</span>
    `;
    log.appendChild(item);
  });
  section.appendChild(log);
  return section;
}

// ── App Factory ───────────────────────────────────────────────────────────────

function createApp() {
  const root = document.createElement('div');
  root.className = 've-root';

  root.appendChild(buildHeader());
  root.appendChild(buildSearchBar());

  const main = document.createElement('div');
  main.className = 've-main';

  // Center (3D plot)
  const center = document.createElement('div');
  center.className = 've-center';

  const plotHeader = document.createElement('div');
  plotHeader.className = 've-plot-header';
  plotHeader.innerHTML = `
    <span class="ve-plot-label">384D → 3D UMAP Projection · 43,291 Vectors · 4 Clusters</span>
    <span class="ve-plot-meta">Drag to orbit · Scroll to zoom</span>
  `;
  center.appendChild(plotHeader);

  const plotContainer = document.createElement('div');
  plotContainer.className = 've-plot-container';
  plotContainer.id = 've-plot-container';

  const overlay = document.createElement('div');
  overlay.className = 've-plot-overlay';
  overlay.innerHTML = `
    <div class="ve-overlay-corner tl">CLUSTER VIEW<br/>UMAP-3D · EPOCH 2841</div>
    <div class="ve-overlay-corner br">ρ=0.92 DENSITY GATE<br/>FEDERATED · 4 NODES</div>
  `;
  plotContainer.appendChild(overlay);
  center.appendChild(plotContainer);
  main.appendChild(center);

  // Right panel
  const rightPanel = document.createElement('div');
  rightPanel.className = 've-right-panel';
  rightPanel.appendChild(buildVectorDetails());
  rightPanel.appendChild(buildStats());
  rightPanel.appendChild(buildFederationStatus());
  rightPanel.appendChild(buildReplicationLog());
  main.appendChild(rightPanel);

  root.appendChild(main);

  // Clock
  const clockEl = root.querySelector('#ve-clock');
  const updateClock = () => { if (clockEl) clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  // Three.js scene — init after mounted
  let scene = null;
  const initScene = () => {
    if (plotContainer.isConnected) {
      scene = createScatterPlot(plotContainer);
    }
  };

  if (plotContainer.isConnected) {
    initScene();
  } else {
    const observer = new MutationObserver(() => {
      if (plotContainer.isConnected) {
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
