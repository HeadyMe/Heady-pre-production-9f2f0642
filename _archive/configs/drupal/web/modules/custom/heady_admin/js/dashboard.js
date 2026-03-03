/**
 * Heady Admin Dashboard — Dynamic data loading
 */
(function () {
    'use strict';

    // Auto-refresh dashboard every 30 seconds
    let refreshInterval = null;

    function startAutoRefresh() {
        refreshInterval = setInterval(() => {
            fetch('/admin/heady/api/status')
                .then(r => r.json())
                .then(data => {
                    // Update stat values
                    const vals = document.querySelectorAll('.heady-stat-value');
                    if (vals[0]) vals[0].textContent = data.stats.total_services;
                    if (vals[1]) vals[1].textContent = data.stats.hcfp_mode;
                    if (vals[2]) vals[2].textContent = data.stats.system_health + '%';
                    if (vals[3]) vals[3].textContent = data.stats.uptime_hours + 'h';
                })
                .catch(() => { }); // Silently retry
        }, 30000);
    }

    document.addEventListener('DOMContentLoaded', startAutoRefresh);
})();
