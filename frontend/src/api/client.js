import axios from 'axios';

const rawApiBase = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '');
const API_BASE = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';
const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

// ── Auth token interceptor ──────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mplads_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isAuthEndpoint = err.config?.url?.includes('/api/auth/login');
      if (!isAuthEndpoint) {
        localStorage.removeItem('mplads_token');
        localStorage.removeItem('mplads_user');
        localStorage.removeItem('mplads_role');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ===== Authentication =====

export const login = async (username, password) => {
  const res = await api.post('/api/auth/login', { username, password });
  const { access_token, user, role } = res.data;
  localStorage.setItem('mplads_token', access_token);
  localStorage.setItem('mplads_user', JSON.stringify(user));
  localStorage.setItem('mplads_role', role);
  return res.data;
};

export const logout = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (_) { /* ignore */ }
  localStorage.removeItem('mplads_token');
  localStorage.removeItem('mplads_user');
  localStorage.removeItem('mplads_role');
};

export const getCurrentUser = () => {
  const raw = localStorage.getItem('mplads_user');
  return raw ? JSON.parse(raw) : null;
};

export const getCurrentRole = () => localStorage.getItem('mplads_role') || null;

export const isAuthenticated = () => !!localStorage.getItem('mplads_token');

export const fetchDemoUsers = async () => {
  const res = await api.get('/api/auth/demo-users');
  return res.data;
};

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

export const fetchStatesAndDistricts = async () => {
  try {
    const res = await api.get('/api/dashboard/states-districts');
    return res.data || {};
  } catch (err) {
    console.error('States-districts error:', err);
    return {};
  }
};

export const fetchMPList = async (state = null) => {
  try {
    const params = state ? { state } : {};
    const res = await api.get('/api/dashboard/mps', { params });
    return res.data?.mps || [];
  } catch (err) {
    console.error('MP list error:', err);
    return [];
  }
};

export const fetchMPDashboard = async (state, mpName, page = 1, pageSize = 50) => {
  try {
    const res = await api.get(`/api/dashboard/mp/${encodeURIComponent(state)}/${encodeURIComponent(mpName)}`, {
      params: { page, page_size: pageSize }
    });
    return res.data;
  } catch (err) {
    console.error('MP dashboard error:', err);
    return null;
  }
};

export const fetchProjectDetails = async (projectId) => {
  try {
    const res = await api.get('/api/dashboard/project-detail', {
      params: { project_id: projectId }
    });
    // Ensure valid JSON object returned, not HTML SPA fallback
    if (res.data && typeof res.data === 'object' && res.data.project_id) {
      return res.data;
    }
    return null;
  } catch (err) {
    console.error('Project details error:', err);
    return null;
  }
};

export const fetchProjects = async (params = {}) => {
  try {
    const res = await api.get('/api/dashboard/projects', { params });
    return res.data;
  } catch (err) {
    console.error('Projects list error:', err);
    return { total: 0, projects: [] };
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

export const fetchContractorNetwork = async (params = {}) => {
  try {
    const res = await api.get('/api/dashboard/contractor-network', { params });
    return res.data;
  } catch (err) {
    console.error('Contractor network error:', err);
    return { nodes: [], edges: [], summary: {} };
  }
};

export const fetchContractorDetail = async (contractorName, state = null) => {
  try {
    const params = { name: contractorName };
    if (state) params.state = state;
    const res = await api.get('/api/dashboard/contractor-detail', { params });
    return res.data;
  } catch (err) {
    console.error('Contractor detail error:', err);
    return null;
  }
};

export const fetchCustomChartData = async (config) => {
  try {
    const res = await api.post('/api/dashboard/custom-chart', config);
    return res.data;
  } catch (err) {
    console.error('Custom chart error:', err);
    return { data: [], summary: {} };
  }
};

export const fetchStatesSummary = async () => {
  try {
    const res = await api.get('/api/dashboard/states-summary');
    return res.data?.states || [];
  } catch (err) {
    console.error('States summary error:', err);
    return [];
  }
};

export const fetchMPsSummary = async () => {
  try {
    const res = await api.get('/api/dashboard/mps-summary');
    return res.data?.mps || [];
  } catch (err) {
    console.error('MPs summary error:', err);
    return [];
  }
};

export const fetchContractorsSummary = async () => {
  try {
    const res = await api.get('/api/dashboard/contractors-summary');
    return res.data?.contractors || [];
  } catch (err) {
    console.error('Contractors summary error:', err);
    return [];
  }
};

export const fetchMinistryInsights = async () => {
  try {
    const res = await api.get('/api/dashboard/ministry-insights');
    return res.data;
  } catch (err) {
    console.error('Ministry insights error:', err);
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

// ===== Alert Lifecycle Endpoints =====

export const fetchLifecycleAlerts = async ({ status, severity, state, limit = 100 } = {}) => {
  try {
    const params = { limit };
    if (status) params.status = status;
    if (severity) params.severity = severity;
    if (state) params.state = state;
    const res = await api.get('/api/alerts/', { params });
    return res.data;
  } catch (err) {
    console.error('Lifecycle alerts error:', err);
    return { total: 0, status_counts: {}, alerts: [] };
  }
};

export const fetchAlertById = async (alertId) => {
  const res = await api.get(`/api/alerts/${alertId}`);
  return res.data;
};

export const acknowledgeAlert = async (alertId, acknowledgedBy, notes = '') => {
  const res = await api.patch(`/api/alerts/${alertId}/acknowledge`, null, {
    params: { acknowledged_by: acknowledgedBy, notes },
  });
  return res.data;
};

export const investigateAlert = async (alertId, investigator, notes = '') => {
  const res = await api.patch(`/api/alerts/${alertId}/investigate`, null, {
    params: { investigator, notes },
  });
  return res.data;
};

export const resolveAlert = async (alertId, resolvedBy, resolutionNotes) => {
  const res = await api.patch(`/api/alerts/${alertId}/resolve`, null, {
    params: { resolved_by: resolvedBy, resolution_notes: resolutionNotes },
  });
  return res.data;
};

export const fetchAlertRecommendations = async (alertId, role) => {
  const res = await api.get(`/api/alerts/${alertId}/recommendations`, { params: { role } });
  return res.data;
};

export const sendTestEmail = async (projectId, recipientRole) => {
  const res = await api.post('/api/alerts/send-test-email', null, {
    params: { project_id: projectId, recipient_role: recipientRole },
  });
  return res.data;
};

// ===== Analysis Endpoint =====

export const analyzeProject = async (projectData) => {
  const res = await api.post('/api/analyze', projectData);
  return res.data;
};

export const verifyAsset = async (formData) => {
  const res = await api.post('/api/verify-asset', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// ===== Export Endpoint =====

export const exportReport = async (format = 'csv', filters = {}) => {
  const res = await api.post('/api/dashboard/export', { format, ...filters }, { responseType: 'blob' });
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
    critical: 'var(--risk-critical)',
  };
  return map[category] || map.low;
};
