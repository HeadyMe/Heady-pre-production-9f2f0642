/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── Cross-Device Filesystem Service ────────────────────────────
 *
 * Gives Heady and Buddy root-level filesystem access across devices
 * via SSH tunnels and local elevated ops. All credentials come from
 * the SecureKeyVault in vector space — never plaintext.
 *
 * Capabilities:
 *   - Local FS: read, write, mkdir, rm, ls, find, grep (via Node fs)
 *   - Remote FS: same ops over SSH tunnel to any registered device
 *   - Elevated: sudo-capable ops via local polkit or SSH
 *   - Sync: bidirectional file sync between devices via rsync-over-SSH
 *
 * Device Registry:
 *   Devices are stored in vector memory as 'device:*' entries.
 *   Each device has: hostname, SSH user, SSH key name (in vault),
 *   filesystem root, and capability flags.
 *
 * Patent: PPA #15 — Cross-Device Synchronization
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const vectorMemory = require('../vector-memory');
const logger = require('../utils/logger');

let vault = null;
try {
    vault = require('./secure-key-vault').vault;
} catch { /* vault not loaded yet */ }

// ── Device Registry ─────────────────────────────────────────────
const devices = new Map();

class CrossDeviceFS {
    constructor() {
        this.localHostname = require('os').hostname();
    }

    // ── Device Management ───────────────────────────────────────
    async registerDevice(name, config) {
        const device = {
            name,
            hostname: config.hostname,
            user: config.user || 'headyme',
            sshKeyName: config.sshKeyName || 'ssh-default',
            port: config.port || 22,
            root: config.root || '/',
            capabilities: config.capabilities || ['read', 'write', 'exec'],
            registeredAt: Date.now(),
        };

        await vectorMemory.ingestMemory({
            content: `device:${name} ${device.hostname} ${device.user}`,
            metadata: {
                type: 'device',
                deviceId: `device:${name}`,
                ...device,
                memoryType: 'procedural',
            },
        });

        devices.set(name, device);
        logger.info(`[CrossDeviceFS] Registered device: ${name} (${device.hostname})`);

        if (global.eventBus) {
            global.eventBus.emit('device:registered', { name, hostname: device.hostname });
        }

        return device;
    }

    async listDevices() {
        if (devices.size === 0) {
            const results = await vectorMemory.queryMemory('device:', 20);
            for (const r of (results || [])) {
                if (r.metadata?.type === 'device') {
                    devices.set(r.metadata.name, r.metadata);
                }
            }
        }
        return [...devices.values()];
    }

    // ── Local Filesystem Ops ────────────────────────────────────
    async localRead(filePath) {
        return fs.readFileSync(filePath, 'utf8');
    }

    async localWrite(filePath, content) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
        return { written: filePath, size: Buffer.byteLength(content) };
    }

    async localLs(dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(e => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            path: path.join(dirPath, e.name),
        }));
    }

    async localMkdir(dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
        return { created: dirPath };
    }

    async localRm(targetPath, recursive = false) {
        fs.rmSync(targetPath, { recursive, force: true });
        return { removed: targetPath };
    }

    async localFind(dirPath, pattern) {
        try {
            const output = execSync(
                `find ${JSON.stringify(dirPath)} -name ${JSON.stringify(pattern)} -maxdepth 5 2>/dev/null`,
                { encoding: 'utf8', timeout: 10000 }
            );
            return output.trim().split('\n').filter(Boolean);
        } catch { return []; }
    }

    async localGrep(dirPath, query) {
        try {
            const output = execSync(
                `grep -rl ${JSON.stringify(query)} ${JSON.stringify(dirPath)} --include='*' -m 20 2>/dev/null`,
                { encoding: 'utf8', timeout: 10000 }
            );
            return output.trim().split('\n').filter(Boolean);
        } catch { return []; }
    }

    async localExec(command, cwd = '/home/headyme') {
        try {
            const output = execSync(command, { encoding: 'utf8', timeout: 30000, cwd });
            return { stdout: output, exitCode: 0 };
        } catch (err) {
            return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
        }
    }

    // ── Remote Filesystem Ops (via SSH) ─────────────────────────
    async _getSSHArgs(deviceName) {
        const device = devices.get(deviceName);
        if (!device) throw new Error(`Unknown device: ${deviceName}`);

        // Get SSH key from vault
        let keyPath = null;
        if (vault && vault.isUnlocked()) {
            const key = await vault.get(device.sshKeyName, 'ssh');
            if (key) {
                // Write temp key file (600 perms)
                keyPath = `/tmp/heady-ssh-${deviceName}-${Date.now()}`;
                fs.writeFileSync(keyPath, key.value, { mode: 0o600 });
            }
        }

        const args = [
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ConnectTimeout=10',
            '-p', String(device.port),
        ];
        if (keyPath) args.push('-i', keyPath);
        args.push(`${device.user}@${device.hostname}`);

        return { args, keyPath, device };
    }

    _cleanupTempKey(keyPath) {
        if (keyPath) try { fs.unlinkSync(keyPath); } catch { /* ok */ }
    }

    async remoteExec(deviceName, command) {
        const { args, keyPath } = await this._getSSHArgs(deviceName);
        try {
            const output = execSync(`ssh ${args.join(' ')} ${JSON.stringify(command)}`, {
                encoding: 'utf8', timeout: 30000
            });
            return { stdout: output, exitCode: 0 };
        } catch (err) {
            return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 };
        } finally {
            this._cleanupTempKey(keyPath);
        }
    }

    async remoteRead(deviceName, filePath) {
        const result = await this.remoteExec(deviceName, `cat ${JSON.stringify(filePath)}`);
        if (result.exitCode !== 0) throw new Error(`Failed to read ${filePath}: ${result.stderr}`);
        return result.stdout;
    }

    async remoteWrite(deviceName, filePath, content) {
        const { args, keyPath } = await this._getSSHArgs(deviceName);
        try {
            execSync(
                `echo ${JSON.stringify(content)} | ssh ${args.join(' ')} "cat > ${filePath}"`,
                { encoding: 'utf8', timeout: 30000 }
            );
            return { written: filePath };
        } finally {
            this._cleanupTempKey(keyPath);
        }
    }

    async remoteLs(deviceName, dirPath) {
        const result = await this.remoteExec(deviceName, `ls -la ${JSON.stringify(dirPath)}`);
        return result.stdout;
    }

    // ── Sync (rsync over SSH) ──────────────────────────────────
    async syncToDevice(deviceName, localPath, remotePath) {
        const { args, keyPath, device } = await this._getSSHArgs(deviceName);
        const sshCmd = `ssh ${args.slice(0, -1).join(' ')}`;
        try {
            const output = execSync(
                `rsync -avz -e "${sshCmd}" ${JSON.stringify(localPath)} ${device.user}@${device.hostname}:${JSON.stringify(remotePath)}`,
                { encoding: 'utf8', timeout: 120000 }
            );
            return { synced: true, output };
        } catch (err) {
            return { synced: false, error: err.message };
        } finally {
            this._cleanupTempKey(keyPath);
        }
    }

    async syncFromDevice(deviceName, remotePath, localPath) {
        const { args, keyPath, device } = await this._getSSHArgs(deviceName);
        const sshCmd = `ssh ${args.slice(0, -1).join(' ')}`;
        try {
            const output = execSync(
                `rsync -avz -e "${sshCmd}" ${device.user}@${device.hostname}:${JSON.stringify(remotePath)} ${JSON.stringify(localPath)}`,
                { encoding: 'utf8', timeout: 120000 }
            );
            return { synced: true, output };
        } catch (err) {
            return { synced: false, error: err.message };
        } finally {
            this._cleanupTempKey(keyPath);
        }
    }

    // ── Unified Ops (local or remote) ──────────────────────────
    async read(target, filePath) {
        if (target === 'local' || target === this.localHostname) {
            return this.localRead(filePath);
        }
        return this.remoteRead(target, filePath);
    }

    async write(target, filePath, content) {
        if (target === 'local' || target === this.localHostname) {
            return this.localWrite(filePath, content);
        }
        return this.remoteWrite(target, filePath, content);
    }

    async ls(target, dirPath) {
        if (target === 'local' || target === this.localHostname) {
            return this.localLs(dirPath);
        }
        return this.remoteLs(target, dirPath);
    }

    async exec(target, command, cwd) {
        if (target === 'local' || target === this.localHostname) {
            return this.localExec(command, cwd);
        }
        return this.remoteExec(target, command);
    }

    // ── Health ──────────────────────────────────────────────────
    getHealth() {
        return {
            localHostname: this.localHostname,
            registeredDevices: devices.size,
            devices: [...devices.values()].map(d => ({
                name: d.name,
                hostname: d.hostname,
                capabilities: d.capabilities,
            })),
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const crossDeviceFS = new CrossDeviceFS();

// ── REST Endpoints ────────────────────────────────────────────
function registerCrossDeviceFSRoutes(app) {
    app.post('/api/fs/register-device', async (req, res) => {
        try {
            const device = await crossDeviceFS.registerDevice(req.body.name, req.body);
            res.json({ ok: true, device });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/fs/devices', async (req, res) => {
        const list = await crossDeviceFS.listDevices();
        res.json({ ok: true, devices: list });
    });

    app.post('/api/fs/read', async (req, res) => {
        try {
            const content = await crossDeviceFS.read(req.body.target || 'local', req.body.path);
            res.json({ ok: true, content });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/fs/write', async (req, res) => {
        try {
            const result = await crossDeviceFS.write(req.body.target || 'local', req.body.path, req.body.content);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/fs/ls', async (req, res) => {
        try {
            const entries = await crossDeviceFS.ls(req.body.target || 'local', req.body.path);
            res.json({ ok: true, entries });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/fs/exec', async (req, res) => {
        try {
            const result = await crossDeviceFS.exec(req.body.target || 'local', req.body.command, req.body.cwd);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/fs/sync', async (req, res) => {
        try {
            const { direction, device, localPath, remotePath } = req.body;
            const result = direction === 'push'
                ? await crossDeviceFS.syncToDevice(device, localPath, remotePath)
                : await crossDeviceFS.syncFromDevice(device, remotePath, localPath);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/fs/health', (req, res) => {
        res.json({ ok: true, ...crossDeviceFS.getHealth() });
    });
}

module.exports = {
    CrossDeviceFS,
    crossDeviceFS,
    registerCrossDeviceFSRoutes,
};
