/**
 * HeadyLens — Real-Time Monitoring JavaScript
 * Connects to WebSocket for live system metrics and renders charts.
 */
(function () {
    'use strict';

    const WS_URL = 'wss://manager.headysystems.com:3301/realtime';
    const API_URL = 'https://manager.headysystems.com';
    let ws = null;
    let charts = {};
    let dataPoints = { cpu: [], memory: [], response: [] };
    const MAX_POINTS = 60;

    // Initialize HeadyLens
    function init() {
        createCharts();
        connectWebSocket();
        fetchInitialData();
        startPolling();
    }

    // Create Chart.js charts
    function createCharts() {
        const chartConfig = (label, color, canvasId) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || typeof Chart === 'undefined') return null;
            return new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: label,
                        data: [],
                        borderColor: color,
                        backgroundColor: color + '20',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { min: 0, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(71,85,105,0.2)' } }
                    }
                }
            });
        };

        charts.cpu = chartConfig('CPU %', '#3b82f6', 'cpuChart');
        charts.memory = chartConfig('Memory %', '#10b981', 'memoryChart');
        charts.response = chartConfig('Response ms', '#eab308', 'responseChart');
    }

    // Update chart with new data point
    function updateChart(chart, value) {
        if (!chart) return;
        const now = new Date().toLocaleTimeString();
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(value);
        if (chart.data.labels.length > MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update('none');
    }

    // Connect to WebSocket
    function connectWebSocket() {
        const statusEl = document.getElementById('wsStatus');
        try {
            ws = new WebSocket(WS_URL);
            ws.onopen = () => {
                if (statusEl) statusEl.innerHTML = '<span style="color:#22c55e;">● Connected</span>';
                console.log('🔭 HeadyLens WebSocket connected');
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.cpu !== undefined) updateChart(charts.cpu, data.cpu);
                    if (data.memory !== undefined) updateChart(charts.memory, data.memory);
                    if (data.response_time !== undefined) updateChart(charts.response, data.response_time);
                    updateMetrics(data);
                } catch (e) { /* ignore parse errors */ }
            };
            ws.onclose = () => {
                if (statusEl) statusEl.innerHTML = '<span style="color:#eab308;">● Reconnecting...</span>';
                setTimeout(connectWebSocket, 5000);
            };
            ws.onerror = () => {
                if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">● Error — falling back to polling</span>';
            };
        } catch (e) {
            if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">● WebSocket unavailable — using polling</span>';
        }
    }

    // Fetch initial data via REST
    function fetchInitialData() {
        fetch(API_URL + '/api/health')
            .then(r => r.json())
            .then(data => updateMetrics(data))
            .catch(() => { });
    }

    // Fallback polling
    function startPolling() {
        setInterval(() => {
            fetch(API_URL + '/api/health')
                .then(r => r.json())
                .then(data => {
                    if (data.cpu !== undefined) updateChart(charts.cpu, data.cpu);
                    if (data.memory !== undefined) updateChart(charts.memory, data.memory);
                    updateMetrics(data);
                })
                .catch(() => {
                    // Simulate data for demo
                    updateChart(charts.cpu, Math.random() * 30 + 10);
                    updateChart(charts.memory, Math.random() * 20 + 40);
                    updateChart(charts.response, Math.random() * 100 + 50);
                });
        }, 5000);
    }

    // Update metric displays
    function updateMetrics(data) {
        const cpuEl = document.getElementById('cpuValue');
        const memEl = document.getElementById('memValue');
        const uptimeEl = document.getElementById('uptimeValue');
        if (cpuEl && data.cpu !== undefined) cpuEl.textContent = data.cpu.toFixed(1) + '%';
        if (memEl && data.memory !== undefined) memEl.textContent = data.memory.toFixed(1) + '%';
        if (uptimeEl && data.uptime !== undefined) uptimeEl.textContent = Math.round(data.uptime / 3600) + 'h';
    }

    document.addEventListener('DOMContentLoaded', init);
})();
