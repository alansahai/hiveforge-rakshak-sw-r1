import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { fetchDashboardSummary, formatCrore } from '../api/client';
import ProjectDetailModal from '../components/ProjectDetailModal';
import IndiaStateMap from '../components/IndiaStateMap';
import {
  IconOverview,
  IconAnalytics,
  IconInspect,
  IconAlertTriangle,
  IconShieldCheck,
  IconCheckCircle
} from '../components/common/GovIcons';

const BAR_COLORS = [
  '#0B3B60',
  '#2563EB',
  '#15803D',
  '#D97706',
  '#C2410C',
  '#475569',
  '#0284C7',
  '#7C3AED'
];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardSummary().then((data) => {
      setSummary(data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Retrieving National Overview &amp; Anomaly Ledger…</span>
      </div>
    );
  }

  const lowCount =
    summary.low_risk_projects ??
    Math.max(
      0,
      summary.total_projects -
        (summary.high_risk_projects || 0) -
        (summary.critical_projects || 0)
    );
  const medCount =
    summary.medium_risk_projects ?? Math.floor((summary.high_risk_projects || 0) * 0.4);
  const highCount = summary.high_risk_projects ?? 0;
  const critCount = summary.critical_projects ?? 0;

  const riskData = [
    { name: 'Approved / Low Risk (<40)', value: lowCount, color: '#15803D' },
    { name: 'Under Review / Medium (40-60)', value: medCount, color: '#D97706' },
    { name: 'Audit Escalation / High (60-80)', value: highCount, color: '#C2410C' },
    { name: 'Critical Inquiry (≥80)', value: critCount, color: '#DC2626' },
  ];

  const categoryData = summary.category_breakdown
    ? Object.entries(summary.category_breakdown).map(([name, count]) => ({
        name,
        projects: count,
      }))
    : [];

  return (
    <div>
      {/* Institutional Page Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h2>
            <IconOverview size={24} color="var(--gov-navy-800)" />
            <span>National Infrastructure Performance &amp; Risk Overview</span>
          </h2>
          <p>
            Real-time multi-tier anomaly detection across {summary.states_monitored} States &amp; UTs ·{' '}
            <strong>{summary.total_projects.toLocaleString()}</strong> development works monitored
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}
          onClick={() => navigate('/analytics-studio')}
        >
          <IconAnalytics size={16} />
          <span>Launch Custom Analytics Studio</span>
        </button>
      </div>

      {/* KPI Administrative Cards */}
      <div className="stats-grid">
        <div
          className="stat-card"
          onClick={() => navigate('/ministry')}
          style={{ cursor: 'pointer' }}
          title="Click to view Ministry analytics"
        >
          <div className="stat-label">Total Works Monitored</div>
          <div className="stat-value">{summary.total_projects.toLocaleString()}</div>
          <div className="stat-sub">Across {summary.states_monitored} States &amp; UTs</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Central Outlay</div>
          <div className="stat-value">{formatCrore(summary.total_sanctioned)}</div>
          <div className="stat-sub">Cumulative sanctioned capital</div>
        </div>

        <div className="stat-card risk-low">
          <div className="stat-label">Normal / Low Risk Works</div>
          <div className="stat-value" style={{ color: 'var(--risk-low)' }}>
            {lowCount.toLocaleString()}
          </div>
          <div className="stat-sub">
            {((lowCount / Math.max(summary.total_projects, 1)) * 100).toFixed(1)}% verified compliant
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Execution Rate</div>
          <div className="stat-value">{summary.completion_rate}%</div>
          <div className="stat-sub">
            {summary.completed_projects?.toLocaleString()} completed works
          </div>
        </div>

        <div
          className="stat-card risk-high"
          onClick={() => navigate('/alerts')}
          style={{ cursor: 'pointer' }}
          title="Click to view escalated works"
        >
          <div className="stat-label">Audit Escalation</div>
          <div className="stat-value" style={{ color: 'var(--risk-high)' }}>
            {highCount.toLocaleString()}
          </div>
          <div className="stat-sub">Detailed scrutiny required</div>
        </div>

        <div
          className="stat-card risk-critical"
          onClick={() => navigate('/alerts')}
          style={{ cursor: 'pointer' }}
          title="Click to inspect critical flags"
        >
          <div className="stat-label">Critical Inquiry Flags</div>
          <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>
            {critCount.toLocaleString()}
          </div>
          <div className="stat-sub">Immediate inquiry triggered</div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid-2">
        {/* Risk Distribution Breakdown */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <IconShieldCheck size={18} color="var(--gov-navy-800)" />
              <span>National Risk Tier Distribution</span>
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              All 4 Categorical Tiers
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="46%"
                innerRadius={60}
                outerRadius={105}
                dataKey="value"
                paddingAngle={2}
                stroke="#FFFFFF"
                strokeWidth={2}
              >
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                formatter={(val) => [val.toLocaleString() + ' Works', 'Count']}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sectoral Breakdown Bar */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <IconAnalytics size={18} color="var(--gov-navy-800)" />
              <span>Sectoral Allocation of Works</span>
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Works Volume by Domain
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={categoryData}
              margin={{ top: 10, right: 20, left: 10, bottom: 55 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={55}
                axisLine={false}
              />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                formatter={(val) => [val.toLocaleString() + ' Works', 'Projects']}
              />
              <Bar dataKey="projects" radius={[2, 2, 0, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pan-India Cartographic Map */}
      <IndiaStateMap />

      {/* Top Flagged Works Scrutiny Table */}
      {summary.top_flagged_projects && summary.top_flagged_projects.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="panel-header">
            <div>
              <h3>
                <IconAlertTriangle size={18} color="#DC2626" />
                <span>Priority Scrutiny: Top Flagged Constituency Works</span>
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Algorithmic detection triggers for cost inflation, contractor collusion, or multi-year schedule stagnation
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/alerts')}>
              View All Audit Records
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Project ID</th>
                  <th>State</th>
                  <th>District</th>
                  <th style={{ width: 150 }}>Risk Classification</th>
                  <th>Diagnostic Anomaly Trigger</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_flagged_projects.map((p, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedProject(p)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view complete project audit record"
                  >
                    <td style={{ fontWeight: 700, color: 'var(--gov-navy-800)' }}>
                      {p.project_id}
                    </td>
                    <td>{p.state}</td>
                    <td>{p.district}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          p.risk_score >= 80 ? 'critical-alert' : 'high-risk'
                        }`}
                      >
                        {p.risk_score >= 80 ? 'Critical' : 'Escalated'} · {p.risk_score?.toFixed(0)}/100
                      </span>
                    </td>
                    <td style={{ maxWidth: 360, whiteSpace: 'normal', color: 'var(--text-secondary)' }}>
                      {p.reason}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(p);
                        }}
                      >
                        <IconInspect size={13} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          projectId={selectedProject.project_id}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
