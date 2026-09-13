import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  fetchCustomChartData,
  fetchStatesAndDistricts,
  fetchMPsSummary,
  fetchContractorsSummary,
  formatCrore,
  formatLakh,
  getRiskColor
} from '../api/client';
import ContractorDetailModal from './ContractorDetailModal';

const THEMES = {
  cyber: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#2dd4bf', '#fbbf24', '#34d399'],
  emerald: ['#10b981', '#059669', '#14b8a6', '#06b6d4', '#84cc16', '#22c55e', '#15803d', '#34d399'],
  sunset: ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d97706', '#b91c1c', '#fb923c', '#fbbf24'],
  ocean: ['#3b82f6', '#1d4ed8', '#0284c7', '#0369a1', '#6366f1', '#4f46e5', '#38bdf8', '#2563eb'],
};

const X_AXIS_OPTIONS = [
  { value: 'category', label: '🏷️ Project Category (Roads, Water, Health...)' },
  { value: 'state', label: '🚩 State / Union Territory' },
  { value: 'district', label: '📍 District' },
  { value: 'mp_name', label: '👤 Member of Parliament (MP)' },
  { value: 'contractor', label: '🏗️ Implementing Agency / Contractor' },
  { value: 'risk_category', label: '⚠️ Risk Tier (Low, Medium, High, Critical)' },
  { value: 'timeline_status', label: '⏱️ Timeline Status (On track, Delayed...)' },
  { value: 'house', label: '🏛️ House (Lok Sabha vs Rajya Sabha)' },
  { value: 'year', label: '📅 Sanction Year' },
];

const Y_AXIS_OPTIONS = [
  { value: 'amount_sanctioned', label: '💰 Total Amount Sanctioned (₹)', format: 'currency' },
  { value: 'amount_spent', label: '💸 Total Amount Spent (₹)', format: 'currency' },
  { value: 'risk_score', label: '⚡ Risk Score (0 - 100)', format: 'number' },
  { value: 'project_count', label: '📊 Project Volume (Count)', format: 'number' },
  { value: 'cost_overrun', label: '📈 Cost Overrun %', format: 'percent' },
  { value: 'progress_percentage', label: '🏗️ Physical Progress %', format: 'percent' },
  { value: 'critical_alerts', label: '🚨 Critical Projects Count', format: 'number' },
  { value: 'days_behind_schedule', label: '⏳ Days Behind Schedule', format: 'number' },
];

const PRESETS = [
  {
    name: 'State vs Total Sanctioned Outlay',
    config: { x_axis: 'state', y_axis: 'amount_sanctioned', agg: 'sum', chart_type: 'bar', limit: 12 }
  },
  {
    name: 'MP vs Total Allocated Outlay',
    config: { x_axis: 'mp_name', y_axis: 'amount_sanctioned', agg: 'sum', chart_type: 'bar', limit: 10 }
  },
  {
    name: 'Contractor vs High-Risk Works',
    config: { x_axis: 'contractor', y_axis: 'risk_score', agg: 'mean', chart_type: 'bar', limit: 12 }
  },
  {
    name: 'Category vs Cost Overrun %',
    config: { x_axis: 'category', y_axis: 'cost_overrun', agg: 'mean', chart_type: 'bar', limit: 10 }
  },
  {
    name: 'Risk Band vs Project Count',
    config: { x_axis: 'risk_category', y_axis: 'project_count', agg: 'count', chart_type: 'pie', limit: 6 }
  },
  {
    name: 'State vs Average Risk Score',
    config: { x_axis: 'state', y_axis: 'risk_score', agg: 'mean', chart_type: 'bar', limit: 15 }
  }
];

export default function CustomChartStudio() {
  const navigate = useNavigate();

  // Studio Top Tab: 'plotter' | 'mps' | 'vendors'
  const [studioTab, setStudioTab] = useState('plotter');

  // Plotter configuration
  const [xAxis, setXAxis] = useState('category');
  const [yAxis, setYAxis] = useState('amount_sanctioned');
  const [agg, setAgg] = useState('sum');
  const [chartType, setChartType] = useState('bar');
  const [limit, setLimit] = useState(15);
  const [theme, setTheme] = useState('cyber');

  // Filters
  const [selectedStateFilter, setSelectedStateFilter] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [statesList, setStatesList] = useState([]);

  // Plotter Data
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chart');

  // Multi-MP Benchmarking State
  const [mpsRoster, setMpsRoster] = useState([]);
  const [selectedMpKeys, setSelectedMpKeys] = useState([]);
  const [mpSearch, setMpSearch] = useState('');
  const [mpsLoading, setMpsLoading] = useState(false);

  // Multi-Vendor Benchmarking State
  const [vendorsRoster, setVendorsRoster] = useState([]);
  const [selectedVendorNames, setSelectedVendorNames] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [activeContractorModal, setActiveContractorModal] = useState(null);

  // Initialize dropdowns and rosters
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      setStatesList(Object.keys(map).sort());
    });
  }, []);

  // Fetch MPs Roster
  useEffect(() => {
    if (studioTab === 'mps' && mpsRoster.length === 0) {
      setMpsLoading(true);
      fetchMPsSummary().then((list) => {
        setMpsRoster(list || []);
        // Pre-select top 3 MPs
        if (list && list.length > 0) {
          const priya = list.find(m => m.mp_name.toLowerCase().includes('priya'));
          const topList = list.slice(0, 3);
          const initial = priya ? [priya, ...topList.filter(m => m.mp_name !== priya.mp_name)].slice(0, 3) : topList;
          setSelectedMpKeys(initial.map(m => `${m.mp_name}__${m.state}`));
        }
        setMpsLoading(false);
      });
    }
  }, [studioTab, mpsRoster.length]);

  // Fetch Contractors Roster
  useEffect(() => {
    if (studioTab === 'vendors' && vendorsRoster.length === 0) {
      setVendorsLoading(true);
      fetchContractorsSummary().then((list) => {
        setVendorsRoster(list || []);
        // Pre-select top 3 contractors
        if (list && list.length > 0) {
          setSelectedVendorNames(list.slice(0, 4).map(v => v.contractor));
        }
        setVendorsLoading(false);
      });
    }
  }, [studioTab, vendorsRoster.length]);

  // Load custom chart data
  const loadData = () => {
    setLoading(true);
    const payload = {
      x_axis: xAxis,
      y_axis: yAxis,
      agg,
      chart_type: chartType,
      limit: Number(limit)
    };
    if (selectedStateFilter) payload.state = selectedStateFilter;
    if (selectedRiskFilter) payload.risk_category = selectedRiskFilter;
    if (minAmountFilter) payload.min_amount = Number(minAmountFilter);

    fetchCustomChartData(payload)
      .then((res) => {
        setChartData(res.data || []);
        setSummary(res.summary || {});
      })
      .catch((err) => {
        console.error('Custom chart load error:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (studioTab === 'plotter') {
      loadData();
    }
  }, [xAxis, yAxis, agg, chartType, limit, selectedStateFilter, selectedRiskFilter, minAmountFilter, studioTab]);

  const colors = THEMES[theme] || THEMES.cyber;

  const formatTooltipValue = (val) => {
    if (val == null) return '0';
    if (yAxis === 'amount_sanctioned' || yAxis === 'amount_spent') {
      return formatCrore(val);
    }
    if (yAxis === 'cost_overrun' || yAxis === 'progress_percentage') {
      return `${Number(val).toFixed(1)}%`;
    }
    if (yAxis === 'risk_score') {
      return `${Number(val).toFixed(1)}/100`;
    }
    return Number(val).toLocaleString();
  };

  const handleApplyPreset = (preset) => {
    setXAxis(preset.config.x_axis);
    setYAxis(preset.config.y_axis);
    setAgg(preset.config.agg);
    setChartType(preset.config.chart_type);
    if (preset.config.limit) setLimit(preset.config.limit);
  };

  const exportCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const headers = [xAxis, `${agg}_${yAxis}`, 'sample_records_count'];
    const rows = chartData.map((d) => [
      `"${String(d.name).replace(/"/g, '""')}"`,
      d.value,
      d.count
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mplads_${xAxis}_vs_${yAxis}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered active selected MPs for comparison
  const comparedMps = useMemo(() => {
    const set = new Set(selectedMpKeys);
    return mpsRoster.filter(m => set.has(`${m.mp_name}__${m.state}`));
  }, [mpsRoster, selectedMpKeys]);

  // MP Comparison chart data
  const mpFundsComparisonData = useMemo(() => {
    return comparedMps.map(m => ({
      name: m.mp_name.length > 14 ? `${m.mp_name.slice(0, 13)}…` : m.mp_name,
      fullName: m.mp_name,
      state: m.state,
      sanctionedCr: Number((m.total_sanctioned / 1e7).toFixed(2)),
      spentCr: Number((m.total_spent / 1e7).toFixed(2)),
      utilizationPct: m.total_sanctioned > 0 ? Number(((m.total_spent / m.total_sanctioned) * 100).toFixed(1)) : 0,
      completionRate: m.completion_rate,
      riskScore: m.avg_risk_score,
      totalProjects: m.total_projects
    }));
  }, [comparedMps]);

  // Filtered active selected Vendors for comparison
  const comparedVendors = useMemo(() => {
    const set = new Set(selectedVendorNames);
    return vendorsRoster.filter(v => set.has(v.contractor));
  }, [vendorsRoster, selectedVendorNames]);

  // Vendor Comparison chart data
  const vendorComparisonData = useMemo(() => {
    return comparedVendors.map(v => ({
      name: v.contractor.length > 16 ? `${v.contractor.slice(0, 15)}…` : v.contractor,
      fullName: v.contractor,
      projects: v.total_projects,
      sanctionedCr: Number((v.total_sanctioned / 1e7).toFixed(2)),
      spentCr: Number((v.total_spent / 1e7).toFixed(2)),
      riskScore: v.avg_risk_score,
      districtsCount: v.districts_count,
      concurrency: v.concurrency_alert ? 1 : 0
    }));
  }, [comparedVendors]);

  return (
    <div style={{ paddingBottom: 30 }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>📊 Self-Service Analytics Studio &amp; Multi-Entity Benchmarking Hub</h2>
          <p>Create arbitrary dimensional plots, analyze multi-MP portfolios side-by-side, and cross-compare implementing contractors</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {studioTab === 'plotter' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={exportCSV}
              disabled={chartData.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>📥</span> Export CSV
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🔄</span> Refresh Intelligence
          </button>
        </div>
      </div>

      {/* Primary Studio Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 18,
        paddingBottom: 4
      }}>
        <button
          onClick={() => setStudioTab('plotter')}
          style={{
            background: studioTab === 'plotter' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: studioTab === 'plotter' ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${studioTab === 'plotter' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: '0.84rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          📊 Custom X/Y Plotter
        </button>

        <button
          onClick={() => setStudioTab('mps')}
          style={{
            background: studioTab === 'mps' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: studioTab === 'mps' ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${studioTab === 'mps' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: '0.84rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          👥 Multi-MP Comparative Benchmarking
        </button>

        <button
          onClick={() => setStudioTab('vendors')}
          style={{
            background: studioTab === 'vendors' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: studioTab === 'vendors' ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${studioTab === 'vendors' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: '0.84rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          🏗️ Multi-Vendor Comparative Hub
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: CUSTOM X/Y PLOTTER
      ───────────────────────────────────────────────────────────── */}
      {studioTab === 'plotter' && (
        <div>
          {/* Presets Strip */}
          <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
              💡 Popular Analytical Query Templates:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                  onClick={() => handleApplyPreset(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Workbench Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left Column: Workbench Controls */}
            <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛠️</span> Plot Configurator
              </h3>

              {/* X-Axis Dimension */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  X-AXIS (DIMENSION / CATEGORY)
                </label>
                <select
                  className="form-control"
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value)}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  {X_AXIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Y-Axis Metric */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Y-AXIS (VALUE / METRIC)
                </label>
                <select
                  className="form-control"
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value)}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  {Y_AXIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Aggregation Function */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  AGGREGATION METHOD
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[
                    { id: 'sum', label: 'Sum' },
                    { id: 'mean', label: 'Average' },
                    { id: 'count', label: 'Count' },
                    { id: 'max', label: 'Max' }
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAgg(a.id)}
                      style={{
                        padding: '6px 0',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: agg === a.id ? 'var(--accent-primary)' : 'var(--bg-input)',
                        border: `1px solid ${agg === a.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        color: agg === a.id ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visualization Type */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  VISUALIZATION TYPE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'bar', label: '📊 Bar' },
                    { id: 'horizontal_bar', label: '📶 Horiz' },
                    { id: 'line', label: '📈 Line' },
                    { id: 'area', label: '🏔️ Area' },
                    { id: 'scatter', label: '🔘 Scatter' },
                    { id: 'pie', label: '🍩 Donut' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChartType(c.id)}
                      style={{
                        padding: '6px 4px',
                        fontSize: '0.74rem',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: chartType === c.id ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-input)',
                        border: `1px solid ${chartType === c.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        color: chartType === c.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter: State */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                  FILTER BY STATE
                </label>
                <select
                  className="form-control"
                  value={selectedStateFilter}
                  onChange={(e) => setSelectedStateFilter(e.target.value)}
                  style={{ width: '100%', fontSize: '0.76rem' }}
                >
                  <option value="">All India (National)</option>
                  {statesList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Filter: Risk Tier */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                  FILTER BY RISK BAND
                </label>
                <select
                  className="form-control"
                  value={selectedRiskFilter}
                  onChange={(e) => setSelectedRiskFilter(e.target.value)}
                  style={{ width: '100%', fontSize: '0.76rem' }}
                >
                  <option value="">All Risk Bands</option>
                  <option value="low">Safe / Low Risk (&lt;40)</option>
                  <option value="medium">Medium Risk (40-60)</option>
                  <option value="high">High Risk (60-80)</option>
                  <option value="critical">Critical Risk (&gt;=80)</option>
                </select>
              </div>

              {/* Display Limit & Theme */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    TOP SAMPLES
                  </label>
                  <select
                    className="form-control"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    style={{ width: '100%', fontSize: '0.76rem' }}
                  >
                    <option value={8}>Top 8</option>
                    <option value={12}>Top 12</option>
                    <option value={15}>Top 15</option>
                    <option value={20}>Top 20</option>
                    <option value={30}>Top 30</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    PALETTE
                  </label>
                  <select
                    className="form-control"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    style={{ width: '100%', fontSize: '0.76rem' }}
                  >
                    <option value="cyber">Cyber Neon</option>
                    <option value="emerald">Emerald</option>
                    <option value="sunset">Sunset Amber</option>
                    <option value="ocean">Deep Ocean</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column: Canvas View */}
            <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
              {/* Header */}
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                    {xAxis.toUpperCase()} vs {agg.toUpperCase()} OF {yAxis.toUpperCase()}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Matching {summary.total_records_matched?.toLocaleString() || 0} projects across {summary.groups_count || 0} data categories
                  </span>
                </div>

                {/* Switcher */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 6, padding: 2 }}>
                  <button
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.74rem',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: activeTab === 'chart' ? 'var(--accent-primary)' : 'transparent',
                      color: activeTab === 'chart' ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setActiveTab('chart')}
                  >
                    📈 Plot View
                  </button>
                  <button
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.74rem',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: activeTab === 'table' ? 'var(--accent-primary)' : 'transparent',
                      color: activeTab === 'table' ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setActiveTab('table')}
                  >
                    📋 Data Table ({chartData.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-container" style={{ minHeight: 400 }}>
                  <div className="spinner"></div> Computing custom multi-dimensional aggregation...
                </div>
              ) : chartData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
                  No data points matched the specified filters. Try adjusting your parameters.
                </div>
              ) : activeTab === 'chart' ? (
                <div style={{ width: '100%', height: 440 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 65 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={65} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), `${agg} ${yAxis}`]}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, idx) => (
                            <Cell key={idx} fill={colors[idx % colors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === 'horizontal_bar' ? (
                      <BarChart data={chartData} layout="vertical" margin={{ top: 15, right: 25, left: 75, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={75} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), `${agg} ${yAxis}`]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.map((_, idx) => (
                            <Cell key={idx} fill={colors[idx % colors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 65 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={65} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), `${agg} ${yAxis}`]}
                        />
                        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} dot={{ fill: colors[1], r: 5 }} />
                      </LineChart>
                    ) : chartType === 'area' ? (
                      <AreaChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 65 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors[0]} stopOpacity={0.5} />
                            <stop offset="95%" stopColor={colors[0]} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={65} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), `${agg} ${yAxis}`]}
                        />
                        <Area type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2.5} fillOpacity={1} fill="url(#areaGrad)" />
                      </AreaChart>
                    ) : chartType === 'pie' ? (
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={135} dataKey="value" paddingAngle={2} strokeWidth={0}>
                          {chartData.map((_, idx) => (
                            <Cell key={idx} fill={colors[idx % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), `${agg} ${yAxis}`]}
                        />
                        <Legend formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{v}</span>} />
                      </PieChart>
                    ) : (
                      <ScatterChart margin={{ top: 20, right: 25, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis dataKey="value" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(val) => [formatTooltipValue(val), yAxis]}
                        />
                        <Scatter data={chartData} fill={colors[0]} />
                      </ScatterChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{xAxis.toUpperCase()}</th>
                        <th>{agg.toUpperCase()} OF {yAxis.toUpperCase()}</th>
                        <th>Sample Projects Mapped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                          <td style={{ fontWeight: 700, color: colors[idx % colors.length] }}>
                            {formatTooltipValue(row.value)}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {row.count?.toLocaleString()} projects
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: MULTI-MP COMPARATIVE BENCHMARKING HUB
      ───────────────────────────────────────────────────────────── */}
      {studioTab === 'mps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* MP Selector & Multi-Selection Bar */}
          <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👥 Select Members of Parliament to Compare ({comparedMps.length} selected)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Benchmark fund utilization, completion rate, portfolio risk score, and execution velocity across constituencies.
                </span>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search MP name or state..."
                value={mpSearch}
                onChange={(e) => setMpSearch(e.target.value)}
                style={{ width: 240, fontSize: '0.8rem' }}
              />
            </div>

            {/* MP Quick Picker Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto', padding: '4px 0' }}>
              {mpsLoading ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading parliamentary roster...</div>
              ) : (
                mpsRoster
                  .filter(m => !mpSearch || m.mp_name.toLowerCase().includes(mpSearch.toLowerCase()) || m.state.toLowerCase().includes(mpSearch.toLowerCase()))
                  .map((m) => {
                    const key = `${m.mp_name}__${m.state}`;
                    const isSelected = selectedMpKeys.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedMpKeys.length > 1) {
                              setSelectedMpKeys(selectedMpKeys.filter(k => k !== key));
                            }
                          } else {
                            setSelectedMpKeys([...selectedMpKeys, key]);
                          }
                        }}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-input)',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          borderRadius: 14,
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {m.mp_name} ({m.state})
                      </button>
                    );
                  })
              )}
            </div>
          </div>

          {/* MP Comparison Visualizations */}
          {comparedMps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
              Please select at least one MP above to initiate comparative analysis.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
                {/* Outlay vs Expenditure Chart */}
                <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    💰 Sanctioned Funds vs Actual Expenditure (₹ Crore)
                  </h4>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mpFundsComparisonData} margin={{ top: 15, right: 15, left: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={40} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          formatter={(val, name) => [`₹${val} Cr`, name === 'sanctionedCr' ? 'Sanctioned Outlay' : 'Amount Spent']}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 6 }} />
                        <Bar dataKey="sanctionedCr" name="Sanctioned Outlay" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="spentCr" name="Amount Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Completion Rate vs Average Risk Score Chart */}
                <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    ⚡ Completion Rate (%) vs Portfolio Risk Score (/100)
                  </h4>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mpFundsComparisonData} margin={{ top: 15, right: 15, left: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={40} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          formatter={(val, name) => [name === 'completionRate' ? `${val}%` : `${val}/100`, name === 'completionRate' ? 'Physical Completion %' : 'Avg Risk Score']}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 6 }} />
                        <Bar dataKey="completionRate" name="Physical Completion %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="riskScore" name="Avg Risk Score" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* MP Comparison Benchmarking Table */}
              <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  📋 Multi-MP Portfolio Scorecard
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>MP Name</th>
                        <th>State / Constituency</th>
                        <th>Total Projects</th>
                        <th>Sanctioned Outlay</th>
                        <th>Amount Spent</th>
                        <th>Utilization %</th>
                        <th>Physical Completion</th>
                        <th>Risk Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedMps.map((m) => {
                        const util = m.total_sanctioned > 0 ? ((m.total_spent / m.total_sanctioned) * 100).toFixed(1) : 0;
                        const rColor = getRiskColor(m.risk_category || 'low');
                        return (
                          <tr key={`${m.mp_name}__${m.state}`}>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.mp_name}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{m.state} {m.constituency ? `• ${m.constituency}` : ''}</td>
                            <td>{m.total_projects?.toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>{formatCrore(m.total_sanctioned)}</td>
                            <td>{formatCrore(m.total_spent)}</td>
                            <td style={{ fontWeight: 700, color: util > 100 ? '#ef4444' : 'var(--text-primary)' }}>{util}%</td>
                            <td style={{ color: '#22c55e', fontWeight: 600 }}>{m.completion_rate}%</td>
                            <td>
                              <span style={{ color: rColor, fontWeight: 700 }}>
                                {m.avg_risk_score}/100
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                onClick={() => navigate(`/mp?state=${encodeURIComponent(m.state)}&mp=${encodeURIComponent(m.mp_name)}`)}
                              >
                                View MP Dashboard
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: MULTI-VENDOR COMPARATIVE BENCHMARKING HUB
      ───────────────────────────────────────────────────────────── */}
      {studioTab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Vendor Selector & Multi-Selection Bar */}
          <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🏗️ Select Contractors / Vendors to Compare ({comparedVendors.length} selected)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Examine vendor concentration, cross-district execution sprawl, and systemic project delivery risks.
                </span>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search contractor name..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                style={{ width: 240, fontSize: '0.8rem' }}
              />
            </div>

            {/* Vendor Quick Picker Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto', padding: '4px 0' }}>
              {vendorsLoading ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading contractor registry...</div>
              ) : (
                vendorsRoster
                  .filter(v => !vendorSearch || v.contractor.toLowerCase().includes(vendorSearch.toLowerCase()))
                  .map((v) => {
                    const isSelected = selectedVendorNames.includes(v.contractor);
                    return (
                      <button
                        key={v.contractor}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedVendorNames.length > 1) {
                              setSelectedVendorNames(selectedVendorNames.filter(n => n !== v.contractor));
                            }
                          } else {
                            setSelectedVendorNames([...selectedVendorNames, v.contractor]);
                          }
                        }}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-input)',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          borderRadius: 14,
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {v.contractor} ({v.total_projects} works)
                      </button>
                    );
                  })
              )}
            </div>
          </div>

          {/* Vendor Comparison Visualizations */}
          {comparedVendors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
              Please select at least one Contractor above to initiate comparative analysis.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
                {/* Projects Volume & Outlay Chart */}
                <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    📊 Work Volume vs Contract Value (₹ Crore)
                  </h4>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vendorComparisonData} margin={{ top: 15, right: 15, left: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={40} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          formatter={(val, name) => [name === 'sanctionedCr' ? `₹${val} Cr` : `${val} works`, name === 'sanctionedCr' ? 'Contract Value' : 'Projects Volume']}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 6 }} />
                        <Bar dataKey="projects" name="Projects Volume" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="sanctionedCr" name="Contract Value (₹ Cr)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Risk Score & Cross-District Concurrency Chart */}
                <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    ⚠️ Average Risk Score (/100) &amp; Operating Districts
                  </h4>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vendorComparisonData} margin={{ top: 15, right: 15, left: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={40} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                          formatter={(val, name) => [name === 'riskScore' ? `${val}/100` : `${val} districts`, name === 'riskScore' ? 'Avg Risk Score' : 'Operating Districts Count']}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 6 }} />
                        <Bar dataKey="riskScore" name="Avg Risk Score" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="districtsCount" name="Operating Districts Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Vendor Benchmarking Table */}
              <div className="panel" style={{ padding: 16, background: 'var(--bg-card)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  📋 Contractor Delivery Risk Matrix
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Contractor Name</th>
                        <th>Projects Awarded</th>
                        <th>Contract Value</th>
                        <th>Amount Spent</th>
                        <th>Districts Operating</th>
                        <th>Concurrency Alert</th>
                        <th>Overrun %</th>
                        <th>Avg Risk</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedVendors.map((v) => {
                        const rColor = getRiskColor(v.risk_category || 'low');
                        return (
                          <tr key={v.contractor}>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v.contractor}</td>
                            <td>{v.total_projects}</td>
                            <td style={{ fontWeight: 600 }}>{formatCrore(v.total_sanctioned)}</td>
                            <td>{formatCrore(v.total_spent)}</td>
                            <td>{v.districts_count} districts</td>
                            <td>
                              {v.concurrency_alert ? (
                                <span style={{ color: '#ef4444', fontWeight: 700, background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem' }}>
                                  ⚡ Flagged
                                </span>
                              ) : (
                                <span style={{ color: '#22c55e', fontSize: '0.72rem' }}>Normal</span>
                              )}
                            </td>
                            <td style={{ color: v.cost_overrun_pct > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                              {v.cost_overrun_pct > 0 ? `+${v.cost_overrun_pct}%` : '0%'}
                            </td>
                            <td>
                              <span style={{ color: rColor, fontWeight: 700 }}>
                                {v.avg_risk_score}/100
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                onClick={() => setActiveContractorModal(v.contractor)}
                              >
                                View Contractor Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Contractor Modal */}
          {activeContractorModal && (
            <ContractorDetailModal
              contractorName={activeContractorModal}
              onClose={() => setActiveContractorModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
