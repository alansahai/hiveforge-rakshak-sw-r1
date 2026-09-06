import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

// ===== Dashboard Endpoints =====

export const fetchDashboardSummary = async () => {
  try {
    const res = await api.get('/api/dashboard/summary');
    return res.data;
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return null;
  }
};

export const fetchStateDashboard = async (state) => {
  try {
    const res = await api.get(`/api/dashboard/state/${encodeURIComponent(state)}`);
    return res.data;
  } catch (err) {
    console.error('State dashboard error:', err);
    return null;
  }
};

export const fetchDistrictDashboard = async (state, district) => {
  try {
    const res = await api.get(`/api/dashboard/district/${encodeURIComponent(state)}/${encodeURIComponent(district)}`);
    return res.data;
  } catch (err) {
    console.error('District dashboard error:', err);
    return null;
  }
};

export const fetchMinistryDashboard = async () => {
  try {
    const res = await api.get('/api/dashboard/ministry');
    return res.data;
  } catch (err) {
    console.error('Ministry dashboard error:', err);
    return null;
  }
};

export const fetchAlerts = async (severity = null, state = null, limit = 50) => {
  try {
    const params = {};
    if (severity) params.severity = severity;
    if (state) params.state = state;
    params.limit = limit;
    const res = await api.get('/api/dashboard/alerts', { params });
    return res.data;
  } catch (err) {
    console.error('Alerts error:', err);
    return { total_alerts: 0, alerts: [] };
  }
};

// ===== Analysis Endpoint =====

export const analyzeProject = async (projectData) => {
  const res = await api.post('/api/analyze', projectData);
  return res.data;
};

// ===== Export Endpoint =====

export const exportReport = async (format = 'csv', filters = {}) => {
  const res = await api.post('/api/dashboard/export', {
    format,
    ...filters
  }, { responseType: 'blob' });
  
  // Trigger download
  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mplads_report.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

// ===== Utility =====

export const formatCrore = (amount) => {
  if (!amount) return '₹0';
  const cr = amount / 10000000;
  if (cr >= 100) return `₹${cr.toFixed(0)} Cr`;
  return `₹${cr.toFixed(2)} Cr`;
};

export const formatLakh = (amount) => {
  if (!amount) return '₹0';
  return `₹${(amount / 100000).toFixed(2)} L`;
};

export const getRiskColor = (category) => {
  const map = {
    low: 'var(--risk-low)',
    medium: 'var(--risk-medium)',
    high: 'var(--risk-high)',
    critical: 'var(--risk-critical)'
  };
  return map[category] || map.low;
};
