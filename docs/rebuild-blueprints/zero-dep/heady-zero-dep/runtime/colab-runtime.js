/**
 * @file colab-runtime.js
 * @description Colab-specific runtime: GPU detection, memory management,
 * auto-reconnect, ngrok/localtunnel tunneling, resource monitoring,
 * and checkpoint/resume for long-running tasks.
 *
 * Runs in Colab's Node.js environment. Gracefully degrades outside Colab.
 * Zero external dependencies — child_process, fs, os, events, crypto.
 * Sacred Geometry: PHI-scaled reconnect intervals, Fibonacci retry counts.
 *
 * @module HeadyRuntime/ColabRuntime
 */

import { EventEmitter }                       from 'events';
import { spawn, exec }                        from 'child_process';
import { existsSync, writeFileSync, readFileSync,
         mkdirSync, statSync, unlinkSync,
         readdirSync }                        from 'fs';
import { join }                               from 'path';
import { hostname, totalmem, freemem }        from 'os';
import { randomUUID }                         from 'crypto';
import { performance }                        from 'perf_hooks';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

const phiDelay  = (n, base = 1000) => Math.min(Math.round(base * Math.pow(PHI, n)), 300_000);

// ─── Environment Detection ────────────────────────────────────────────────────
function detectColab() {
  return !!(
    process.env.COLAB_BACKEND_URL ||
    process.env.GCS_READ_BUCKET   ||
    process.env.COLAB_JUPYTER_TOKEN ||
    existsSync('/content')
  );
}

// ─── Shell Helper ─────────────────────────────────────────────────────────────
function shell(cmd, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
      else resolve(stdout.trim());
    });
  });
}

// ─── GPU Probe ────────────────────────────────────────────────────────────────
/**
 * @typedef {object} GPUInfo
 * @property {boolean} available
 * @property {string}  name
 * @property {number}  vramMB          Total VRAM in MB
 * @property {number}  vramFreeMB
 * @property {number}  utilizationPct
 * @property {string}  driver
 */

async function probeGPU() {
  try {
    const raw = await shell(
      'nvidia-smi --query-gpu=name,memory.total,memory.free,utilization.gpu,driver_version --format=csv,noheader,nounits',
      8_000
    );
    const [name, total, free, util, driver] = raw.split(',').map(s => s.trim());
    return {
      available:       true,
      name:            name ?? 'unknown',
      vramMB:          parseInt(total,  10) || 0,
      vramFreeMB:      parseInt(free,   10) || 0,
      utilizationPct:  parseInt(util,   10) || 0,
      driver:          driver ?? 'unknown',
    };
  } catch {
    return { available: false, name: 'none', vramMB: 0, vramFreeMB: 0, utilizationPct: 0, driver: '' };
  }
}

// ─── Memory Snapshot ──────────────────────────────────────────────────────────
function memSnapshot() {
  const totalMB  = Math.round(totalmem()  / 1024 / 1024);
  const freeMB   = Math.round(freemem()   / 1024 / 1024);
  const usedMB   = totalMB - freeMB;
  const heap     = process.memoryUsage();
  return {
    totalMB, freeMB, usedMB,
    usedPct:    Math.round(usedMB / totalMB * 100),
    heapUsedMB: Math.round(heap.heapUsed     / 1024 / 1024),
    heapTotalMB:Math.round(heap.heapTotal    / 1024 / 1024),
    rssMB:      Math.round(heap.rss          / 1024 / 1024),
    externalMB: Math.round(heap.external     / 1024 / 1024),
  };
}

// ─── Tunnel Manager ───────────────────────────────────────────────────────────
class TunnelManager {
  constructor() {
    this._proc    = null;
    this._url     = null;
    this._port    = null;
    this._tool    = null;  // 'ngrok' | 'localtunnel' | null
  }

  async start(port, opts = {}) {
    this._port = port;

    // Prefer ngrok if auth token is available
    const ngrokToken = process.env.NGROK_AUTH_TOKEN ?? opts.ngrokToken;
    if (ngrokToken) {
      try {
        this._url  = await this._startNgrok(port, ngrokToken);
        this._tool = 'ngrok';
        return this._url;
      } catch (e) {
        // fall through to localtunnel
      }
    }

    // Try localtunnel (requires `lt` CLI from npm — may be available in Colab)
    try {
      this._url  = await this._startLocalTunnel(port);
      this._tool = 'localtunnel';
      return this._url;
    } catch (e) {
      throw new Error(`TunnelManager: no tunnel tool available. Install ngrok or localtunnel. (${e.message})`);
    }
  }

  async _startNgrok(port, token) {
    // Use ngrok HTTP API to start tunnel
    await shell(`ngrok authtoken ${token}`, 10_000);
    this._proc = spawn('ngrok', ['http', String(port), '--log=stdout', '--log-format=json'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ngrok start timeout')), 15_000);
      this._proc.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.url && obj.url.startsWith('https://')) {
              clearTimeout(timer);
              resolve(obj.url);
            }
          } catch { /* skip */ }
        }
      });
      this._proc.on('exit', () => { clearTimeout(timer); reject(new Error('ngrok exited')); });
    });
  }

  async _startLocalTunnel(port) {
    const out = await shell(`lt --port ${port} --print-requests 2>/dev/null | head -1`, 20_000);
    const match = out.match(/https?:\/\/[^\s]+/);
    if (!match) throw new Error('localtunnel URL not found in output');
    return match[0];
  }

  stop() {
    this._proc?.kill('SIGTERM');
    this._proc = null;
    this._url  = null;
  }

  get url()  { return this._url;  }
  get port() { return this._port; }
  get tool() { return this._tool; }
}

// ─── Checkpoint Manager ────────────────────────────────────────────────────────
class CheckpointManager {
  /**
   * @param {string} dir  Checkpoint directory (default /tmp/heady-checkpoints)
   */
  constructor(dir = process.env.CHECKPOINT_DIR ?? '/tmp/heady-checkpoints') {
    this._dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  /**
   * Save a checkpoint.
   * @param {string} taskId
   * @param {object} state
   * @param {object} [meta]
   */
  save(taskId, state, meta = {}) {
    const path = this._path(taskId);
    const record = {
      taskId,
      ts:        new Date().toISOString(),
      version:   (this._loadRaw(taskId)?.version ?? 0) + 1,
      state,
      meta,
    };
    writeFileSync(path, JSON.stringify(record), 'utf8');
    return record;
  }

  /**
   * Load checkpoint state.
   * @param {string} taskId
   * @returns {object|null}
   */
  load(taskId) {
    const record = this._loadRaw(taskId);
    return record?.state ?? null;
  }

  /** Load full checkpoint record */
  loadRecord(taskId) {
    return this._loadRaw(taskId);
  }

  /** Check if checkpoint exists */
  exists(taskId) {
    return existsSync(this._path(taskId));
  }

  /** Delete a checkpoint */
  remove(taskId) {
    try { unlinkSync(this._path(taskId)); } catch { /* ignore */ }
  }

  _path(taskId) {
    return join(this._dir, `${taskId}.checkpoint.json`);
  }

  _loadRaw(taskId) {
    const path = this._path(taskId);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch { return null; }
  }

  list() {
    try {
      return readdirSync(this._dir)
        .filter(f => f.endsWith('.checkpoint.json'))
        .map(f => f.replace('.checkpoint.json', ''));
    } catch { return []; }
  }
}

// ─── Resource Monitor ─────────────────────────────────────────────────────────
class ResourceMonitor extends EventEmitter {
  /**
   * @param {number} intervalMs  Polling interval (default PHI-scaled ~2618ms)
   */
  constructor(intervalMs = Math.round(1000 * PHI * PHI)) {
    super();
    this._intervalMs = intervalMs;
    this._timer      = null;
    this._lastGPU    = null;
    this._lastMem    = null;
    this._history    = [];  // last 13 snapshots
  }

  async start() {
    await this._poll();
    this._timer = setInterval(() => this._poll(), this._intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async _poll() {
    const [gpu, mem] = await Promise.all([probeGPU(), Promise.resolve(memSnapshot())]);
    const snapshot = { ts: new Date().toISOString(), gpu, mem };

    this._lastGPU = gpu;
    this._lastMem = mem;
    this._history.push(snapshot);
    if (this._history.length > 13) this._history.shift();

    this.emit('snapshot', snapshot);

    // Warn thresholds
    if (mem.usedPct > 90) this.emit('highMemory', snapshot);
    if (gpu.available && gpu.utilizationPct > 95) this.emit('highGPU', snapshot);
    if (gpu.available && gpu.vramFreeMB < 500)    this.emit('lowVRAM', snapshot);
  }

  current() {
    return { gpu: this._lastGPU, mem: this._lastMem };
  }

  history(n = 13) {
    return this._history.slice(-n);
  }
}

// ─── ColabRuntime ─────────────────────────────────────────────────────────────
export class ColabRuntime extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  [opts.role]         Node role (BRAIN/CONDUCTOR/SENTINEL)
   * @param {number}  [opts.httpPort]     Port to expose via tunnel
   * @param {string}  [opts.checkpointDir]
   * @param {number}  [opts.monitorIntervalMs]
   */
  constructor(opts = {}) {
    super();
    this._role     = opts.role    ?? process.env.HEADY_NODE_ROLE ?? 'BRAIN';
    this._port     = opts.httpPort ?? parseInt(process.env.PORT ?? '3000', 10);
    this._isColab  = detectColab();
    this._nodeId   = process.env.HEADY_NODE_ID ?? randomUUID().slice(0, 8);

    this._tunnel   = new TunnelManager();
    this._monitor  = new ResourceMonitor(opts.monitorIntervalMs);
    this._checkpoints = new CheckpointManager(opts.checkpointDir);

    // GPU allocation state
    this._gpuFraction = parseFloat(process.env.GPU_MEMORY_FRACTION ?? '0.9');
    this._gpuInfo     = null;

    // Reconnect state
    this._reconnectAttempt = 0;
    this._reconnectTimer   = null;

    // Wire monitor events
    this._monitor.on('highMemory', (s) => this.emit('highMemory', s));
    this._monitor.on('highGPU',    (s) => this.emit('highGPU',    s));
    this._monitor.on('lowVRAM',    (s) => this.emit('lowVRAM',    s));
    this._monitor.on('snapshot',   (s) => this.emit('resource',   s));
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async start() {
    // Detect GPU
    this._gpuInfo = await probeGPU();

    // Start resource monitor
    await this._monitor.start();

    // Colab-specific: install auto-reconnect listener
    if (this._isColab) {
      this._installReconnectHandler();
    }

    this.emit('ready', {
      nodeId:   this._nodeId,
      role:     this._role,
      isColab:  this._isColab,
      gpu:      this._gpuInfo,
      mem:      memSnapshot(),
      port:     this._port,
    });

    return this;
  }

  async stop() {
    this._monitor.stop();
    this._tunnel.stop();
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
  }

  // ─── Tunnel ─────────────────────────────────────────────────────────────

  /**
   * Expose this node's HTTP port via ngrok/localtunnel.
   * @param {number} [port]  Defaults to this._port
   * @returns {Promise<string>} Public URL
   */
  async exposeTunnel(port) {
    const url = await this._tunnel.start(port ?? this._port);
    this.emit('tunnelOpen', { url, port: port ?? this._port, tool: this._tunnel.tool });
    return url;
  }

  get tunnelUrl() { return this._tunnel.url; }

  // ─── GPU ────────────────────────────────────────────────────────────────

  async gpuInfo() {
    this._gpuInfo = await probeGPU();
    return this._gpuInfo;
  }

  /**
   * Allocate a fraction of GPU memory (Colab: TensorFlow/PyTorch env var approach).
   * Returns allocation descriptor; actual allocation happens in Python process.
   */
  allocateGPU(fraction) {
    const f = Math.max(0.1, Math.min(1.0, fraction ?? this._gpuFraction));
    process.env.TF_FORCE_GPU_ALLOW_GROWTH   = 'false';
    process.env.TF_GPU_MEMORY_FRACTION       = String(f);
    process.env.PYTORCH_CUDA_ALLOC_CONF      = `max_split_size_mb:${Math.round((this._gpuInfo?.vramMB ?? 4096) * f / 512) * 512}`;
    this._gpuFraction = f;
    this.emit('gpuAllocated', { fraction: f, vramMB: this._gpuInfo?.vramMB });
    return { fraction: f, vramMB: this._gpuInfo?.vramMB ?? 0 };
  }

  // ─── Memory Management ───────────────────────────────────────────────────

  /**
   * Request garbage collection (if --expose-gc flag is set).
   * Safe no-op if gc() is unavailable.
   */
  gc() {
    if (typeof global.gc === 'function') {
      global.gc();
      this.emit('gc', memSnapshot());
    }
  }

  /** Current resource snapshot */
  resources() {
    return this._monitor.current();
  }

  resourceHistory(n = 13) {
    return this._monitor.history(n);
  }

  // ─── Auto-Reconnect ──────────────────────────────────────────────────────

  _installReconnectHandler() {
    // In Colab, the kernel may die. We watch for the SIGTERM/disconnect patterns.
    process.on('SIGTERM', () => {
      this.emit('disconnect', { reason: 'SIGTERM', attempt: this._reconnectAttempt });
      this._scheduleReconnect();
    });

    // Colab sends periodic keepalive — if missed, we consider it disconnected.
    // This is a passive listener; the actual reconnect logic lives in the
    // orchestrator that calls this runtime.
    process.on('SIGINT', () => {
      this.emit('interrupt', { ts: new Date().toISOString() });
    });
  }

  _scheduleReconnect() {
    const attempt = this._reconnectAttempt;
    const delay   = phiDelay(attempt, 5_000);  // 5s * PHI^n

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectAttempt++;
      this.emit('reconnecting', { attempt, delayMs: delay });

      try {
        await this.start();
        this._reconnectAttempt = 0;
        this.emit('reconnected', { attempt });
      } catch (e) {
        this.emit('reconnectFailed', { attempt, error: e.message });
        if (this._reconnectAttempt <= FIBONACCI.length) {
          this._scheduleReconnect();
        } else {
          this.emit('reconnectGiveUp', { totalAttempts: this._reconnectAttempt });
        }
      }
    }, delay);
  }

  // ─── Checkpoints ────────────────────────────────────────────────────────

  saveCheckpoint(taskId, state, meta = {}) {
    return this._checkpoints.save(taskId, state, meta);
  }

  loadCheckpoint(taskId) {
    return this._checkpoints.load(taskId);
  }

  hasCheckpoint(taskId) {
    return this._checkpoints.exists(taskId);
  }

  listCheckpoints() {
    return this._checkpoints.list();
  }

  // ─── Info ────────────────────────────────────────────────────────────────

  info() {
    return {
      nodeId:   this._nodeId,
      role:     this._role,
      isColab:  this._isColab,
      hostname: hostname(),
      gpu:      this._gpuInfo,
      mem:      memSnapshot(),
      port:     this._port,
      tunnel:   this._tunnel.url,
      pid:      process.pid,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _runtime = null;

export function getColabRuntime(opts = {}) {
  if (!_runtime) _runtime = new ColabRuntime(opts);
  return _runtime;
}

export { probeGPU, memSnapshot, TunnelManager, CheckpointManager, ResourceMonitor };
export default ColabRuntime;
