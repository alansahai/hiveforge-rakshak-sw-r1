import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchDashboardSummary, formatCrore } from '../api/client';
import ProjectDetailModal from '../components/ProjectDetailModal';

const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardSummary().then(data => {
      setSummary(data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) {
    return <div className="loading-container"><div className="spinner"></div> Loading national overview...</div>;
  }

  const lowCount = summary.low_risk_projects ?? Math.max(0, summary.total_projects - (summary.high_risk_projects || 0) - (summary.critical_projects || 0));
  const medCount = summary.medium_risk_projects ?? Math.floor((summary.high_risk_projects || 0) * 0.4);
  const highCount = summary.high_risk_projects ?? 0;
  const critCount = summary.critical_projects ?? 0;

  const riskData = [
    { name: 'Safe / Low (<40)', value: lowCount, color: '#22c55e' },
    { name: 'Medium (40-60)', value: medCount, color: '#f59e0b' },
    { name: 'High (60-80)', value: highCount, color: '#f97316' },
    { name: 'Critical (>=80)', value: critCount, color: '#ef4444' },
  ];

  // Full category names without truncation so nothing gets clipped
  const categoryData = summary.category_breakdown
    ? Object.entries(summary.category_breakdown).map(([name, count]) => ({ name, projects: count }))
    : [];

  return (
    <div>
      <div className="page-header">
        <h2>National Overview — MPLADS AI Monitoring</h2>
        <p>Real-time anomaly detection across {summary.states_monitored} states • {summary.total_projects.toLocaleString()} projects monitored</p>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="stat-card" onClick={() => navigate('/ministry')} style={{cursor:'pointer'}}>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{summary.total_projects.toLocaleString()}</div>
          <div className="stat-sub">{summary.states_monitored} states</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sanctioned</div>
          <div className="stat-value">{formatCrore(summary.total_sanctioned)}</div>
          <div className="stat-sub">Central allocation</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--risk-low)' }}>
          <div className="stat-label">Safe / Low Risk</div>
          <div className="stat-value" style={{color:'var(--risk-low)'}}>{lowCount.toLocaleString()}</div>
          <div className="stat-sub">{((lowCount / Math.max(summary.total_projects, 1)) * 100).toFixed(1)}% safe</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completion Rate</div>
          <div className="stat-value">{summary.completion_rate}%</div>
          <div className="stat-sub">{summary.completed_projects?.toLocaleString()} completed</div>
        </div>
        <div className="stat-card risk-high" onClick={() => navigate('/alerts')} style={{cursor:'pointer'}}>
          <div className="stat-label">High Risk</div>
          <div className="stat-value" style={{color:'var(--risk-high)'}}>{highCount.toLocaleString()}</div>
          <div className="stat-sub">Attention required</div>
        </div>
        <div className="stat-card risk-critical" onClick={() => navigate('/alerts')} style={{cursor:'pointer'}}>
          <div className="stat-label">Critical Alerts</div>
          <div className="stat-value" style={{color:'var(--risk-critical)'}}>{critCount.toLocaleString()}</div>
          <div className="stat-sub">Immediate escalation</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        {/* Risk Distribution Pie */}
        <div className="panel">
          <div className="panel-header">
            <h3>Risk Distribution Breakdown</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>All 4 Risk Bands</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="46%" innerRadius={60} outerRadius={105} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(val) => [val.toLocaleString() + ' projects', 'Count']}
              />
              <Legend
                formatter={(value) => <span style={{color:'#94a3b8', fontSize:'0.8rem'}}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown Bar */}
        <div className="panel">
          <div className="panel-header">
            <h3>Projects by Category</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Category View</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryData} margin={{ top: 10, right: 20, left: 10, bottom: 55 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={55}
                axisLine={false}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="projects" radius={[4, 4, 0, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flagged Projects */}
      {summary.top_flagged_projects && summary.top_flagged_projects.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 style={{ display: 'inline-block', marginRight: 10 }}>🚨 Top Flagged Projects</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click any row to inspect complete project details</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/alerts')}>View All Alerts</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>State</th>
                <th>District</th>
                <th>Risk Score</th>
                <th>Diagnostic Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_flagged_projects.map((p, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedProject(p)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full project breakdown"
                >
                  <td style={{fontWeight:600, color:'var(--accent-primary)'}}>{p.project_id}</td>
                  <td>{p.state}</td>
                  <td>{p.district}</td>
                  <td>
                    <span className={`risk-badge ${p.risk_score >= 80 ? 'critical' : 'high'}`}>
                      {p.risk_score?.toFixed(0)}/100
                    </span>
                  </td>
                  <td style={{maxWidth:300, whiteSpace:'normal'}}>{p.reason}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(p);
                      }}
                    >
                      Inspect 🔍
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
