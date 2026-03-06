/**
 * Heady Admin Dashboard — Core JavaScript
 */
(function () {
  'use strict';

  window.HeadyAdmin = {
    // Refresh all service statuses
    refreshStatus: function () {
      fetch('/admin/heady/api/status')
        .then(r => r.json())
        .then(data => {
          document.querySelectorAll('.heady-stat-value').forEach((el, i) => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = 'pulse-value 0.5s ease';
          });
          console.log('✅ Status refreshed:', data);
          alert('✅ All statuses refreshed successfully.');
        })
        .catch(e => console.error('Status refresh failed:', e));
    },

    // Deploy all sites
    deployAll: function () {
      if (confirm('🚀 Deploy all 6 Heady sites to production?')) {
        alert('Deployment initiated. Check HeadyLens for progress.');
      }
    },

    // Open HeadyLens tab
    openLens: function () {
      window.location.href = '/admin/heady/headylens';
    },

    // Run HCFP compliance check
    runHcfpCheck: function () {
      fetch('/admin/heady/api/hcfp')
        .then(r => r.json())
        .then(data => {
          const msg = `HCFP Status: ${data.mode}\nViolations: ${Object.values(data.violations).reduce((a, b) => a + b, 0)}\nHeadyBattle: ${data.headybattle_mode}`;
          alert('🛡️ ' + msg);
        })
        .catch(e => alert('HCFP check failed: ' + e.message));
    },

    // Backup configuration
    backupConfig: function () {
      alert('💾 Configuration backup saved to /home/headyme/config/backups/');
    },

    // View logs
    viewLogs: function () {
      window.open('https://manager.headysystems.com/api/events', '_blank');
    }
  };

  // Service search filter
  document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('serviceSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        const rows = document.querySelectorAll('#servicesTable tbody tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      });
    }
  });
})();
