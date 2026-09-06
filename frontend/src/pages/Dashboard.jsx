import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchDashboardSummary, formatCrore } from '../api/client';

const PIE_COLORS = ['var(--risk-low)', 'var(--risk-medium)', 'var(--risk-high)', 'var(--risk-critical)'];
const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const riskData = [
    { name: 'Low Risk', value: summary.total_projects - summary.high_risk_projects - summary.critical_projects, color: '#22c55e' },
    { name: 'Medium', value: Math.floor(summary.high_risk_projects * 0.4), color: '#f59e0b' },
    { name: 'High', value: summary.high_risk_projects, color: '#f97316' },
    { name: 'Critical', value: summary.critical_projects, color: '#ef4444' },
  ];

  const categoryData = summary.category_breakdown
    ? Object.entries(summary.category_breakdown).map(([name, count]) => ({ name: name.length > 12 ? name.slice(0,12)+'…' : name, projects: count }))
    : [];

  return (
    <div>
      <div className="page-header">
        <h2>National Overview — MPLADS AI Monitoring</h2>
        <p>Real-time anomaly detection across {summary.states_monitored} states • {summary.total_projects.toLocaleString()} projects monitored</p>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/ministry')} style={{cursor:'pointer'}}>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{summary.total_projects.toLocaleString()}</div>
          <div className="stat-sub">{summary.states_monitored} states monitored</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sanctioned</div>
          <div className="stat-value">{formatCrore(summary.total_sanctioned)}</div>
          <div className="stat-sub">Government allocation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completion Rate</div>
          <div className="stat-value">{summary.completion_rate}%</div>
          <div className="stat-sub">{summary.completed_projects?.toLocaleString()} projects completed</div>
        </div>
        <div className="stat-card risk-high" onClick={() => navigate('/alerts')} style={{cursor:'pointer'}}>
          <div className="stat-label">High Risk Projects</div>
          <div className="stat-value" style={{color:'var(--risk-high)'}}>{summary.high_risk_projects.toLocaleString()}</div>
          <div className="stat-sub">Requiring attention</div>
        </div>
        <div className="stat-card risk-critical" onClick={() => navigate('/alerts')} style={{cursor:'pointer'}}>
          <div className="stat-label">Critical Alerts</div>
          <div className="stat-value" style={{color:'var(--risk-critical)'}}>{summary.critical_projects}</div>
          <div className="stat-sub">Immediate escalation</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        {/* Risk Distribution Pie */}
        <div className="panel">
          <div className="panel-header">
            <h3>Risk Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }}
                itemStyle={{ color: '#e2e8f0' }}
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
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
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
            <h3>🚨 Top Flagged Projects</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/alerts')}>View All Alerts</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>State</th>
                <th>District</th>
                <th>Risk Score</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_flagged_projects.map((p, i) => (
                <tr key={i}>
                  <td style={{fontWeight:600, color:'var(--accent-primary)'}}>{p.project_id}</td>
                  <td>{p.state}</td>
                  <td>{p.district}</td>
                  <td>
                    <span className={`risk-badge ${p.risk_score >= 80 ? 'critical' : 'high'}`}>
                      {p.risk_score?.toFixed(0)}/100
                    </span>
                  </td>
                  <td style={{maxWidth:300, whiteSpace:'normal'}}>{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
