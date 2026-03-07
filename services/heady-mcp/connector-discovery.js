/**
 * ═══════════════════════════════════════════════════════════════
 * CONN-003: MCP Connector Auto-Discovery
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Scans the filesystem, npm registry, and running processes to
 * auto-discover MCP-compatible servers and register them.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ConnectorAutoDiscovery {
    constructor(options = {}) {
        this.searchPaths = options.searchPaths || [
            process.env.HOME + '/Heady',
            process.env.HOME + '/.agents',
            '/usr/local/lib/node_modules',
        ];
        this.discovered = new Map();
        this.scanInterval = options.scanInterval || 60000;
    }

    /**
     * Run full discovery scan
     */
    async scan() {
        const results = {
            filesystem: await this.scanFilesystem(),
            packages: await this.scanPackages(),
            processes: await this.scanProcesses(),
            timestamp: new Date().toISOString(),
        };

        return {
            total: this.discovered.size,
            connectors: Array.from(this.discovered.values()),
            ...results,
        };
    }

    /**
     * Scan filesystem for MCP server configurations
     */
    async scanFilesystem() {
        const found = [];

        for (const searchPath of this.searchPaths) {
            if (!fs.existsSync(searchPath)) continue;

            try {
                const entries = this._walkDir(searchPath, 3);

                for (const entry of entries) {
                    // Look for MCP server indicators
                    if (entry.endsWith('mcp.json') || entry.endsWith('mcp-config.json')) {
                        try {
                            const config = JSON.parse(fs.readFileSync(entry, 'utf-8'));
                            this._registerFromConfig(entry, config);
                            found.push(entry);
                        } catch (e) { /* skip invalid json */ }
                    }

                    // Look for package.json with MCP keywords
                    if (entry.endsWith('package.json') && entry.includes('mcp')) {
                        try {
                            const pkg = JSON.parse(fs.readFileSync(entry, 'utf-8'));
                            if (pkg.keywords?.includes('mcp') || pkg.name?.includes('mcp')) {
                                this._registerFromPackage(entry, pkg);
                                found.push(entry);
                            }
                        } catch (e) { /* skip */ }
                    }
                }
            } catch (e) { /* permission errors */ }
        }

        return { scanned: this.searchPaths.length, found: found.length };
    }

    /**
     * Scan installed npm packages for MCP servers
     */
    async scanPackages() {
        const found = [];
        try {
            const output = execSync('npm ls --json --depth=0 2>/dev/null', { encoding: 'utf-8', timeout: 10000 });
            const deps = JSON.parse(output);

            for (const [name, info] of Object.entries(deps.dependencies || {})) {
                if (name.includes('mcp') || name.includes('model-context')) {
                    found.push(name);
                    this.discovered.set(`npm:${name}`, {
                        id: `npm:${name}`,
                        name,
                        source: 'npm',
                        version: info.version,
                        transport: 'stdio',
                    });
                }
            }
        } catch (e) { /* npm not available or no package.json */ }

        return { found: found.length };
    }

    /**
     * Scan running processes for MCP servers
     */
    async scanProcesses() {
        const found = [];
        try {
            const output = execSync('pgrep -la "mcp" 2>/dev/null || true', { encoding: 'utf-8', timeout: 5000 });
            const lines = output.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const match = line.match(/^(\d+)\s+(.+)$/);
                if (match) {
                    const [, pid, cmd] = match;
                    found.push({ pid: parseInt(pid), command: cmd });
                    this.discovered.set(`proc:${pid}`, {
                        id: `proc:${pid}`,
                        name: cmd.split('/').pop().split(' ')[0],
                        source: 'process',
                        pid: parseInt(pid),
                        transport: 'stdio',
                    });
                }
            }
        } catch (e) { /* pgrep not available */ }

        return { found: found.length };
    }

    _registerFromConfig(filepath, config) {
        const id = `file:${filepath}`;
        this.discovered.set(id, {
            id,
            name: config.name || path.basename(path.dirname(filepath)),
            source: 'filesystem',
            configPath: filepath,
            transport: config.transport || 'streamable-http',
            capabilities: config.tools?.map(t => t.name) || [],
        });
    }

    _registerFromPackage(filepath, pkg) {
        const id = `pkg:${pkg.name}`;
        this.discovered.set(id, {
            id,
            name: pkg.name,
            source: 'package',
            version: pkg.version,
            configPath: filepath,
            transport: 'stdio',
            capabilities: pkg.mcp?.tools || [],
        });
    }

    _walkDir(dir, maxDepth, depth = 0) {
        if (depth >= maxDepth) return [];
        const results = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '_archive') continue;
                const full = path.join(dir, entry.name);
                if (entry.isFile()) results.push(full);
                else if (entry.isDirectory()) results.push(...this._walkDir(full, maxDepth, depth + 1));
            }
        } catch (e) { /* permission denied */ }
        return results;
    }
}

if (require.main === module) {
    const discovery = new ConnectorAutoDiscovery();
    discovery.scan().then(results => {
        console.log('═══ MCP Connector Auto-Discovery ═══');
        console.log(`Discovered: ${results.total} connectors`);
        for (const c of results.connectors) {
            console.log(`  ${c.id}: ${c.name} (${c.source}, ${c.transport})`);
        }
        console.log('✅ Auto-discovery complete');
    });
}

module.exports = { ConnectorAutoDiscovery };
