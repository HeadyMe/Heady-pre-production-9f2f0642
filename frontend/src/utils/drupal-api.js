
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
// ║  FILE: drupal-api.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3300';

// Create axios instance with Drupal headers
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
});

// Add authentication if available
if (import.meta.env.VITE_API_TOKEN) {
  api.defaults.headers.common['Authorization'] = `Bearer ${import.meta.env.VITE_API_TOKEN}`;
}

// Drupal API functions
export const fetchAPI = async (endpoint) => {
  try {
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

export const postAPI = async (endpoint, data) => {
  try {
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error('API post error:', error);
    throw error;
  }
};

// Content fetching helpers
export const getContent = async (contentType, filters = {}) => {
  const params = new URLSearchParams({
    'filter[type]': contentType,
    ...filters
  });
  
  return fetchAPI(`/jsonapi/node/${contentType}?${params}`);
};

export const getMenu = async (menuName) => {
  return fetchAPI(`/jsonapi/menu_items/${menuName}`);
};

// Form submission
export const submitForm = async (formId, data) => {
  return postAPI(`/jsonapi/webform_submission/${formId}`, {
    data: {
      type: 'webform_submission--' + formId,
      attributes: data
    }
  });
};

export default api;
