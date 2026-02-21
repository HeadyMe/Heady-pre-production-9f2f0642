// Heady Systems Admin JavaScript

(function (Drupal) {
  'use strict';

  Drupal.behaviors.headyAdmin = {
    attach: function (context, settings) {
      
      // Initialize dashboard
      if (context === document) {
        initDashboard();
      }

      // Navigation
      const navItems = document.querySelectorAll('.heady-nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', function(e) {
          navItems.forEach(nav => nav.classList.remove('active'));
          this.classList.add('active');
        });
      });

      // Search functionality
      const searchInput = document.querySelector('.heady-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          const searchTerm = this.value.toLowerCase();
          const rows = document.querySelectorAll('tbody tr');
          
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
          });
        });
      }

      // Modal functionality
      const modalTriggers = document.querySelectorAll('[data-modal-trigger]');
      modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
          const modalId = this.dataset.modalTrigger;
          openModal(modalId);
        });
      });

      // Close modals
      const modalCloses = document.querySelectorAll('.heady-modal-close');
      modalCloses.forEach(close => {
        close.addEventListener('click', function() {
          const modal = this.closest('.heady-modal');
          closeModal(modal.id);
        });
      });

      // Auto-refresh functionality
      setInterval(() => {
        refreshData();
      }, 30000);

    }
  };

  function initDashboard() {
    // Show notification on load
    showNotification('Heady Systems Admin loaded successfully!', 'success');
    
    // Load initial data
    loadDashboardData();
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'heady-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? 'var(--success)' : 'var(--primary)'};
      color: white;
      border-radius: 0.5rem;
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function refreshData() {
    // Fetch fresh data from API
    fetch('/admin/api/status')
      .then(response => response.json())
      .then(data => {
        updateDashboardStats(data.stats);
        updateServicesTable(data.services);
      })
      .catch(error => {
        console.error('Error refreshing data:', error);
      });
  }

  function loadDashboardData() {
    // Initial data load
    refreshData();
  }

  function updateDashboardStats(stats) {
    const statElements = document.querySelectorAll('.heady-stat-value');
    const values = [
      stats.total_services,
      stats.active_domains,
      stats.active_tunnels,
      stats.system_health + '%'
    ];
    
    statElements.forEach((element, index) => {
      if (values[index]) {
        element.style.transform = 'scale(1.1)';
        setTimeout(() => {
          element.textContent = values[index];
          element.style.transform = 'scale(1)';
        }, 200);
      }
    });
  }

  function updateServicesTable(services) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    services.forEach(service => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${service.name}</strong></td>
        <td>${service.type}</td>
        <td><span class="heady-status-badge status-${service.status}">● ${service.status.charAt(0).toUpperCase() + service.status.slice(1)}</span></td>
        <td>${service.domain}</td>
        <td>${service.port}</td>
        <td>
          <button class="heady-btn heady-btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
          <button class="heady-btn heady-btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Stop</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

})(Drupal);
