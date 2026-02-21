
// ╔══════════════════════════════════════════════════════════════════╗
// ║  FILE: resource-manager.js - Heady Systems Resource Manager      ║
// ╚══════════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_BASE = path.join(__dirname, '../../configs');
const configCache = new Map();

function loadConfig(configPath) {
  if (configCache.has(configPath)) return configCache.get(configPath);
  try {
    const fullPath = path.isAbsolute(configPath) ? configPath : path.join(CONFIG_BASE, configPath);
    const raw = fs.readFileSync(fullPath, 'utf8');
    let parsed;
    if (fullPath.endsWith('.json')) {
      parsed = JSON.parse(raw);
    } else {
      parsed = {};
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key) parsed[key] = isNaN(val) ? val : Number(val);
      }
    }
    configCache.set(configPath, parsed);
    return parsed;
  } catch (error) {
    console.warn(`[ResourceManager] Could not load config ${configPath}:`, error.message);
    return {};
  }
}

function invalidateCache(configPath) {
  if (configPath) configCache.delete(configPath);
  else configCache.clear();
}

function getSystemResources() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  return {
    cpu: {
      count: cpus.length,
      model: cpus[0]?.model || 'unknown',
      speed_mhz: cpus[0]?.speed || 0
    },
    memory: {
      total_gb: (totalMem / 1e9).toFixed(2),
      free_gb: (freeMem / 1e9).toFixed(2),
      used_percent: Math.round(((totalMem - freeMem) / totalMem) * 100)
    },
    platform: os.platform(),
    hostname: os.hostname(),
    uptime_hours: (os.uptime() / 3600).toFixed(1)
  };
}

function getOptimalConcurrency() {
  const cpus = os.cpus().length;
  const freeMem = os.freemem();
  const memBasedMax = Math.floor(freeMem / (256 * 1024 * 1024));
  return Math.min(cpus * 2, memBasedMax, 16);
}

function resolveEnvPath(rawPath) {
  return rawPath
    .replace('$HOME', os.homedir())
    .replace('~', os.homedir())
    .replace('$PWD', process.cwd());
}

module.exports = {
  loadConfig,
  invalidateCache,
  getSystemResources,
  getOptimalConcurrency,
  resolveEnvPath
};
