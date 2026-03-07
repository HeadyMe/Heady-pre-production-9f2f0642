/**
 * HeadyMonitor — Live Real-Time Monitoring Widget v1.0
 * Injects a floating system health dashboard into any Heady site
 * Usage: HeadyMonitor.init({ position: 'bottom-right' });
 */
const HeadyMonitor = (() => {
    const PHI = 1.618033988749895;
    const SERVICES = [
        { id: 'conductor', name: 'HeadyConductor', icon: '🎯' },
        { id: 'memory', name: 'HeadyMemory', icon: '🧠' },
        { id: 'mcp', name: 'HeadyMCP', icon: '⚡' },
        { id: 'buddy', name: 'HeadyBuddy', icon: '🤖' },
        { id: 'gateway', name: 'LiquidGateway', icon: '🌊' },
        { id: 'security', name: 'ZeroTrust', icon: '🛡️' },
    ];

    // Simulated live metrics (replace with real API calls)
    function getMetrics() {
        const now = Date.now();
        const baseLatency = 42; // ms
        return {
            timestamp: now,
            uptime: '99.97%',
            activeNodes: 20,
            totalNodes: 20,
            requestsPerSec: Math.floor(847 + Math.sin(now / 5000) * 120),
            avgLatency: Math.floor(baseLatency + Math.sin(now / 3000) * 12),
            memoryUsage: (61.8 + Math.sin(now / 7000) * 8).toFixed(1),
            cslGateOps: Math.floor(12400 + Math.sin(now / 4000) * 800),
            services: SERVICES.map(s => ({
                ...s,
                status: Math.random() > 0.02 ? 'healthy' : 'degraded',
                latency: Math.floor(baseLatency / PHI + Math.random() * 20),
                load: Math.floor(30 + Math.random() * 40),
            })),
            sparkline: Array.from({ length: 20 }, (_, i) =>
                40 + Math.sin((now / 2000) + i * 0.5) * 25 + Math.random() * 10
            ),
        };
    }

    function createSparklineSVG(data, color = '#00d4aa', w = 160, h = 32) {
        const max = Math.max(...data), min = Math.min(...data);
        const range = max - min || 1;
        const pts = data.map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 4) - 2;
            return `${x},${y}`;
        }).join(' ');
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs><linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')} ${w},${h} 0,${h}" fill="url(#spark-grad)"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    }

    function injectStyles() {
        if (document.getElementById('heady-monitor-styles')) return;
        const style = document.createElement('style');
        style.id = 'heady-monitor-styles';
        style.textContent = `
      .hm-toggle{position:fixed;bottom:20px;right:20px;z-index:9999;width:48px;height:48px;border-radius:50%;
        background:linear-gradient(135deg,#0d1221 0%,#111827 100%);border:1px solid rgba(0,212,170,0.3);
        cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;
        box-shadow:0 4px 20px rgba(0,212,170,0.2);transition:all 0.3s;backdrop-filter:blur(12px)}
      .hm-toggle:hover{transform:scale(1.1);box-shadow:0 6px 30px rgba(0,212,170,0.35)}
      .hm-toggle .hm-pulse{position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;
        background:#10b981;animation:hm-blink 2s infinite}
      @keyframes hm-blink{0%,100%{opacity:1}50%{opacity:.4}}
      .hm-panel{position:fixed;bottom:80px;right:20px;z-index:9998;width:380px;max-height:520px;
        background:rgba(13,18,33,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:16px;
        backdrop-filter:blur(24px) saturate(180%);box-shadow:0 20px 60px rgba(0,0,0,0.5);
        font-family:'Inter',sans-serif;color:#f0f4ff;overflow:hidden;
        transform:translateY(10px) scale(0.95);opacity:0;pointer-events:none;transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
      .hm-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:auto}
      .hm-header{padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06);
        display:flex;align-items:center;justify-content:space-between}
      .hm-header h3{font-size:0.85rem;font-weight:700;display:flex;align-items:center;gap:8px}
      .hm-header h3 .dot{width:6px;height:6px;border-radius:50%;background:#10b981;animation:hm-blink 2s infinite}
      .hm-uptime{font-size:0.7rem;color:#10b981;font-family:'JetBrains Mono','Fira Code',monospace;font-weight:600}
      .hm-body{padding:12px 20px 16px;overflow-y:auto;max-height:420px}
      .hm-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
      .hm-metric{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:10px 12px}
      .hm-metric .val{font-size:1.15rem;font-weight:700;font-family:'JetBrains Mono',monospace;
        background:linear-gradient(135deg,#00d4aa,#00b891);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .hm-metric .lbl{font-size:0.62rem;color:#4a5568;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px}
      .hm-spark{margin-bottom:14px;background:rgba(255,255,255,0.02);border-radius:8px;padding:8px 10px}
      .hm-spark-label{font-size:0.65rem;color:#8b98b8;margin-bottom:4px;display:flex;justify-content:space-between}
      .hm-services-title{font-size:0.7rem;font-weight:600;color:#8b98b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px}
      .hm-svc{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.03)}
      .hm-svc:last-child{border-bottom:none}
      .hm-svc-icon{font-size:0.9rem;width:24px;text-align:center}
      .hm-svc-name{flex:1;font-size:0.78rem;font-weight:500}
      .hm-svc-lat{font-size:0.68rem;font-family:'JetBrains Mono',monospace;color:#8b98b8}
      .hm-svc-dot{width:7px;height:7px;border-radius:50%}
      .hm-svc-dot.healthy{background:#10b981;box-shadow:0 0 6px rgba(16,185,129,0.4)}
      .hm-svc-dot.degraded{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,0.4)}
      .hm-svc-bar{width:40px;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden}
      .hm-svc-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#00d4aa,#00b891);transition:width 0.5s}
    `;
        document.head.appendChild(style);
    }

    function render(container) {
        const m = getMetrics();
        container.querySelector('.hm-uptime').textContent = m.uptime + ' uptime';
        const metricsHTML = `
      <div class="hm-metric"><div class="val">${m.requestsPerSec}</div><div class="lbl">Requests / sec</div></div>
      <div class="hm-metric"><div class="val">${m.avgLatency}ms</div><div class="lbl">Avg Latency</div></div>
      <div class="hm-metric"><div class="val">${m.memoryUsage}%</div><div class="lbl">Memory (φ-scaled)</div></div>
      <div class="hm-metric"><div class="val">${m.cslGateOps}</div><div class="lbl">CSL Gate Ops</div></div>
    `;
        container.querySelector('.hm-metrics').innerHTML = metricsHTML;
        container.querySelector('.hm-sparkline').innerHTML =
            `<div class="hm-spark-label"><span>Throughput (60s)</span><span>${m.requestsPerSec} rps</span></div>` +
            createSparklineSVG(m.sparkline);
        const svcsHTML = m.services.map(s => `
      <div class="hm-svc">
        <span class="hm-svc-icon">${s.icon}</span>
        <span class="hm-svc-name">${s.name}</span>
        <span class="hm-svc-lat">${s.latency}ms</span>
        <div class="hm-svc-bar"><div class="hm-svc-bar-fill" style="width:${s.load}%"></div></div>
        <div class="hm-svc-dot ${s.status}"></div>
      </div>
    `).join('');
        container.querySelector('.hm-services-list').innerHTML = svcsHTML;
    }

    function init(opts = {}) {
        injectStyles();
        // Toggle button
        const toggle = document.createElement('button');
        toggle.className = 'hm-toggle';
        toggle.setAttribute('aria-label', 'System Monitor');
        toggle.innerHTML = '📊<span class="hm-pulse"></span>';
        document.body.appendChild(toggle);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'hm-panel';
        panel.innerHTML = `
      <div class="hm-header">
        <h3><span class="dot"></span> System Monitor</h3>
        <span class="hm-uptime">—</span>
      </div>
      <div class="hm-body">
        <div class="hm-metrics"></div>
        <div class="hm-spark hm-sparkline"></div>
        <div class="hm-services-title">Service Health</div>
        <div class="hm-services-list"></div>
      </div>
    `;
        document.body.appendChild(panel);

        toggle.addEventListener('click', () => {
            panel.classList.toggle('open');
            toggle.setAttribute('aria-expanded', panel.classList.contains('open'));
        });

        // Live update loop
        render(panel);
        setInterval(() => { if (panel.classList.contains('open')) render(panel); }, 2000);
    }

    return { init };
})();
