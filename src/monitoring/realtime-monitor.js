
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: realtime-monitor.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/*
 * Heady Systems Real-Time Monitor
 * Sub-second monitoring for all system components
 * WebSocket-based real-time updates
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class RealtimeMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            updateInterval: options.updateInterval || 100, // 100ms updates
            historySize: options.historySize || 1000,
            enableWebSocket: options.enableWebSocket !== false,
            wsPort: options.wsPort || 3301,
            enableMetrics: options.enableMetrics !== false,
            enableAlerts: options.enableAlerts !== false,
            serviceTimeoutMs: options.serviceTimeoutMs || 1000,
            managerHealthUrl: options.managerHealthUrl || process.env.HEADY_MANAGER_HEALTH_URL || 'https://manager.headysystems.com/api/health',
            staticHealthUrl: options.staticHealthUrl || process.env.HEADY_STATIC_HEALTH_URL || 'https://headybuddy.org',
            headyBattleComplianceUrl: options.headyBattleComplianceUrl || process.env.HEADYBATTLE_COMPLIANCE_URL || 'https://battle.headysystems.com/api/HeadyBattle-compliance',
            domainCheckTimeoutMs: options.domainCheckTimeoutMs || 2000,
            alertThresholds: {
                cpu: 80,
                memory: 85,
                responseTime: 1000,
                errorRate: 5
            },
            ...options
        };
        
        this.isRunning = false;
        this.startTime = Date.now();
        this.lastUpdate = Date.now();
        
        // Data storage
        this.metrics = new Map();
        this.history = new Map();
        this.alerts = [];
        this.connections = new Set();
        
        // WebSocket server
        this.wss = null;
        
        // Component monitors
        this.componentMonitors = new Map();
        
        // Initialize monitoring
        this.initialize();
    }
    
    initialize() {
        console.log('🔍 Initializing Real-Time Monitor...');
        console.log(`📡 Update interval: ${this.config.updateInterval}ms`);
        console.log(`🌐 WebSocket port: ${this.config.wsPort}`);
        
        // Setup WebSocket server
        if (this.config.enableWebSocket) {
            this.setupWebSocket();
        }
        
        // Initialize component monitors
        this.initializeComponentMonitors();
        
        // Start monitoring
        this.start();
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ 
            port: this.config.wsPort,
            path: '/realtime'
        });
        
        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });
        
        console.log(`🌐 WebSocket server listening on port ${this.config.wsPort}`);
    }
    
    handleConnection(ws) {
        const connectionId = this.generateConnectionId();
        ws.connectionId = connectionId;
        this.connections.add(ws);
        
        console.log(`🔗 Client connected: ${connectionId}`);
        
        // Send initial data
        this.sendInitialData(ws);
        
        // Handle messages
        ws.on('message', (message) => {
            this.handleMessage(ws, message);
        });
        
        // Handle disconnection
        ws.on('close', () => {
            this.connections.delete(ws);
            console.log(`🔌 Client disconnected: ${connectionId}`);
        });
        
        // Send periodic updates
        const updateInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                this.sendUpdate(ws);
            } else {
                clearInterval(updateInterval);
            }
        }, this.config.updateInterval);
    }
    
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    initializeComponentMonitors() {
        // System monitor
        this.componentMonitors.set('system', new SystemMonitor());
        
        // Process monitor
        this.componentMonitors.set('process', new ProcessMonitor());
        
        // Services monitor
        this.componentMonitors.set('services', new ServicesMonitor({
            managerHealthUrl: this.config.managerHealthUrl,
            staticHealthUrl: this.config.staticHealthUrl,
            timeoutMs: this.config.serviceTimeoutMs
        }));
        
        // Network monitor
        this.componentMonitors.set('network', new NetworkMonitor());
        
        // HeadyBattle compliance monitor
        this.componentMonitors.set('HeadyBattle', new HeadyBattleMonitor({
            complianceUrl: this.config.headyBattleComplianceUrl,
            timeoutMs: this.config.serviceTimeoutMs
        }));
        
        // Domain monitor
        this.componentMonitors.set('domains', new DomainMonitor({
            timeoutMs: this.config.domainCheckTimeoutMs
        }));
        
        console.log(`📊 Initialized ${this.componentMonitors.size} component monitors`);
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('▶️ Starting real-time monitoring...');
        
        // Start monitoring loop
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.updateInterval);
        
        // Start component monitors
        for (const [name, monitor] of this.componentMonitors) {
            monitor.start();
            monitor.on('data', (data) => {
                this.handleComponentData(name, data);
            });
        }
        
        this.emit('started');
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        console.log('⏸️ Stopping real-time monitoring...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Stop component monitors
        for (const monitor of this.componentMonitors.values()) {
            monitor.stop();
        }
        
        // Close WebSocket connections
        for (const ws of this.connections) {
            ws.close();
        }
        
        this.emit('stopped');
    }
    
    async collectMetrics() {
        const timestamp = Date.now();
        const metrics = {
            timestamp,
            uptime: timestamp - this.startTime,
            components: {}
        };
        
        // Collect from all component monitors
        for (const [name, monitor] of this.componentMonitors) {
            try {
                const componentData = await monitor.getData();
                metrics.components[name] = componentData;
                this.metrics.set(name, componentData);
                
                // Store in history
                if (!this.history.has(name)) {
                    this.history.set(name, []);
                }
                const history = this.history.get(name);
                history.push({ timestamp, ...componentData });
                
                // Limit history size
                if (history.length > this.config.historySize) {
                    history.shift();
                }
                
                // Check for alerts
                if (this.config.enableAlerts) {
                    this.checkAlerts(name, componentData);
                }
                
            } catch (error) {
                console.error(`❌ Error collecting metrics for ${name}:`, error);
                metrics.components[name] = { error: error.message };
            }
        }
        
        this.lastUpdate = timestamp;
        this.emit('metrics', metrics);
        
        // Broadcast to WebSocket clients
        this.broadcast(metrics);
    }
    
    handleComponentData(componentName, data) {
        this.emit('componentData', { componentName, data });
    }
    
    checkAlerts(componentName, data) {
        const thresholds = this.config.alertThresholds;
        
        // CPU alert
        if (data.cpu && data.cpu > thresholds.cpu) {
            this.createAlert('cpu', componentName, `CPU usage: ${data.cpu}%`, 'warning');
        }
        
        // Memory alert
        if (data.memory && data.memory > thresholds.memory) {
            this.createAlert('memory', componentName, `Memory usage: ${data.memory}%`, 'warning');
        }
        
        // Response time alert
        if (data.responseTime && data.responseTime > thresholds.responseTime) {
            this.createAlert('response_time', componentName, `Response time: ${data.responseTime}ms`, 'warning');
        }
        
        // Error rate alert
        if (data.errorRate && data.errorRate > thresholds.errorRate) {
            this.createAlert('error_rate', componentName, `Error rate: ${data.errorRate}%`, 'critical');
        }
    }
    
    createAlert(type, component, message, severity = 'warning') {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            component,
            message,
            severity,
            timestamp: Date.now()
        };
        
        this.alerts.unshift(alert);
        
        // Limit alerts size
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(0, 100);
        }
        
        console.log(`🚨 Alert [${severity.toUpperCase()}] ${component}: ${message}`);
        this.emit('alert', alert);
    }
    
    broadcast(data) {
        for (const ws of this.connections) {
            if (ws.readyState === WebSocket.OPEN) {
                this.sendUpdate(ws, data);
            }
        }
    }
    
    sendInitialData(ws) {
        const initialData = {
            type: 'initial',
            config: this.config,
            metrics: this.getLatestMetrics(),
            alerts: this.alerts.slice(0, 10),
            timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(initialData));
    }
    
    sendUpdate(ws, data = null) {
        if (!data) {
            data = {
                type: 'update',
                metrics: this.getLatestMetrics(),
                alerts: this.alerts.slice(0, 5),
                timestamp: Date.now()
            };
        }
        
        try {
            ws.send(JSON.stringify(data));
        } catch (error) {
            console.error('❌ Error sending WebSocket update:', error);
        }
    }
    
    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'subscribe':
                    this.handleSubscription(ws, data);
                    break;
                case 'getHistory':
                    this.handleHistoryRequest(ws, data);
                    break;
                case 'getMetrics':
                    this.handleMetricsRequest(ws, data);
                    break;
                default:
                    console.log('📨 Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }
    
    handleSubscription(ws, data) {
        ws.subscriptions = data.components || ['all'];
        console.log(`📝 Client ${ws.connectionId} subscribed to:`, ws.subscriptions);
    }
    
    handleHistoryRequest(ws, data) {
        const component = data.component;
        const limit = data.limit || 100;
        const history = this.history.get(component) || [];
        
        const response = {
            type: 'history',
            component,
            data: history.slice(-limit),
            timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(response));
    }
    
    handleMetricsRequest(ws, data) {
        const response = {
            type: 'metrics',
            data: this.getLatestMetrics(),
            timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(response));
    }
    
    getLatestMetrics() {
        const latest = {};
        for (const [name, data] of this.metrics) {
            latest[name] = data;
        }
        return latest;
    }
    
    getStats() {
        return {
            uptime: Date.now() - this.startTime,
            isRunning: this.isRunning,
            connections: this.connections.size,
            components: this.componentMonitors.size,
            alerts: this.alerts.length,
            lastUpdate: this.lastUpdate,
            updateInterval: this.config.updateInterval
        };
    }
}

// Component Monitor Classes
class SystemMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        const os = require('os');
        
        return {
            cpu: this.getCPUUsage(),
            memory: this.getMemoryUsage(),
            loadAverage: os.loadavg(),
            uptime: os.uptime(),
            timestamp: Date.now()
        };
    }
    
    getCPUUsage() {
        const cpus = require('os').cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        return Math.round(100 - (totalIdle / totalTick * 100));
    }
    
    getMemoryUsage() {
        const os = require('os');
        const total = os.totalmem();
        const free = os.freemem();
        return Math.round((total - free) / total * 100);
    }
}

class ProcessMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.process = process;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        const memUsage = this.process.memoryUsage();
        
        return {
            pid: this.process.pid,
            uptime: this.process.uptime(),
            cpu: this.process.cpuUsage(),
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            timestamp: Date.now()
        };
    }
}

class ServicesMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
        this.services = new Map();
        this.managerHealthUrl = options.managerHealthUrl || process.env.HEADY_MANAGER_HEALTH_URL || 'https://manager.headysystems.com/api/health';
        this.staticHealthUrl = options.staticHealthUrl || process.env.HEADY_STATIC_HEALTH_URL || 'https://headybuddy.org';
        this.timeoutMs = options.timeoutMs || 1000;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        // Check HeadyManager service
        const headyManagerStatus = await this.checkService(this.managerHealthUrl);
        
        // Check static server
        const staticServerStatus = await this.checkService(this.staticHealthUrl);
        
        return {
            headyManager: headyManagerStatus,
            staticServer: staticServerStatus,
            totalServices: 2,
            runningServices: [headyManagerStatus, staticServerStatus].filter(s => s.status === 'online').length,
            timestamp: Date.now()
        };
    }
    
    async checkService(url) {
        try {
            const start = Date.now();
            const response = await this.fetchWithTimeout(url, {}, this.timeoutMs);
            const responseTime = Date.now() - start;
            
            return {
                url,
                status: 'online',
                responseTime,
                statusCode: response.status,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                url,
                status: 'offline',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = this.timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }
    }
}

class NetworkMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        return {
            connections: this.connections || 0,
            bandwidth: this.bandwidth || { in: 0, out: 0 },
            timestamp: Date.now()
        };
    }
}

class HeadyBattleMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
        this.lastCheck = Date.now();
        this.complianceUrl = options.complianceUrl || process.env.HEADYBATTLE_COMPLIANCE_URL || 'https://battle.headysystems.com/api/HeadyBattle-compliance';
        this.timeoutMs = options.timeoutMs || 1000;
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        try {
            const response = await this.fetchWithTimeout(this.complianceUrl, {}, this.timeoutMs);
            const data = await response.json();
            
            return {
                compliance: data.compliance_status || 'UNKNOWN',
                interceptions: data.metrics?.total_interceptions || 0,
                violations: data.metrics?.bypass_attempts || 0,
                enforcement: data.enforcement_active || false,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                compliance: 'ERROR',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = this.timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }
    }
}

class DomainMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
        this.timeoutMs = options.timeoutMs || 2000;
        this.domains = [
            'headysystems.com',
            'headyconnection.org', 
            'headyme.com',
            'headymcp.com',
            'headyio.com',
            'headybuddy.org',
            'headybot.com'
        ];
    }
    
    start() {
        this.isRunning = true;
    }
    
    stop() {
        this.isRunning = false;
    }
    
    async getData() {
        const results = {};
        
        for (const domain of this.domains) {
            results[domain] = await this.checkDomain(domain);
        }
        
        return {
            domains: results,
            totalDomains: this.domains.length,
            onlineDomains: Object.values(results).filter(d => d.status === 'online').length,
            timestamp: Date.now()
        };
    }
    
    async checkDomain(domain) {
        try {
            const start = Date.now();
            await this.fetchWithTimeout(`https://${domain}`, {
                method: 'HEAD'
            }, this.timeoutMs);
            const responseTime = Date.now() - start;
            
            return {
                domain,
                status: 'online',
                responseTime,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                domain,
                status: 'offline',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = this.timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }
    }
}

module.exports = RealtimeMonitor;
