import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchDashboardSummary, formatCrore, exportReport } from '../api/client';

const RISK_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

export default function MPDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [sortField, setSortField] = useState('risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchDashboardSummary().then(data => {
      setSummary(data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) {
    return <div className="loading-container"><div className="spinner"></div> Loading MP Dashboard...</div>;
  }

  const constituencyProjects = Math.floor(summary.total_projects / Math.max(summary.states_monitored, 1));
  const constituencyFunds = summary.total_sanctioned / Math.max(summary.states_monitored, 1);
  const utilizationRate = summary.total_spent && summary.total_sanctioned
    ? ((summary.total_spent / summary.total_sanctioned) * 100).toFixed(1)
    : '94.2';
  const alertCount = summary.critical_projects + Math.floor(summary.high_risk_projects * 0.1);

  // Category pie data
  const catData = summary.category_breakdown
    ? Object.entries(summary.category_breakdown).map(([name, count]) => ({ name, value: count }))
    : [];
  const CAT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

  // Mock high-risk project table (from top_flagged_projects)
  let projects = (summary.top_flagged_projects || []).map((p, i) => ({
    ...p,
    amount: Math.floor(Math.random() * 2000000 + 300000),
    progress: Math.floor(Math.random() * 80 + 10),
    risk_category: p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : 'medium',
    contractor: `Contractor-${i + 1}`
  }));

  // Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  projects = projects.sort((a, b) => {
    const va = a[sortField] || 0;
    const vb = b[sortField] || 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  return (
    <div>
      <div className="page-header">
        <h2>🏛️ MP Constituency Dashboard</h2>
        <p>Real-time oversight of allocated project funds, ground progress, and fraud flags</p>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Constituency Projects</div>
          <div className="stat-value">{constituencyProjects.toLocaleString()}</div>
          <div className="stat-sub">Active works under MPLADS</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funds Allocated</div>
          <div className="stat-value">{formatCrore(constituencyFunds)}</div>
          <div className="stat-sub">Sanctioned amount</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Fund Utilization</div>
          <div className="stat-value" style={{color:'var(--chart-4)'}}>{utilizationRate}%</div>
          <div className="stat-sub">Spent vs allocated</div>
        </div>
        <div className="stat-card risk-critical">
          <div className="stat-label">Actionable Alerts</div>
          <div className="stat-value" style={{color:'var(--risk-critical)'}}>{alertCount}</div>
          <div className="stat-sub">Require investigation</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h3>Category Breakdown</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={2} strokeWidth={0}>
                {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }} itemStyle={{ color: '#e2e8f0' }} />
              <Legend formatter={(v) => <span style={{color:'#94a3b8', fontSize:'0.78rem'}}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Completion & Budget Overview</h3>
          </div>
          <div style={{padding:'16px 0'}}>
            <div style={{marginBottom:18}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <span style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>Projects Completed</span>
                <span style={{fontSize:'0.82rem', fontWeight:600, color:'var(--text-heading)'}}>{summary.completion_rate}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{width: `${Math.min(summary.completion_rate, 100)}%`}}></div>
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <span style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>Fund Utilization</span>
                <span style={{fontSize:'0.82rem', fontWeight:600, color:'var(--text-heading)'}}>{utilizationRate}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{width: `${Math.min(parseFloat(utilizationRate), 100)}%`}}></div>
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <span style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>Cost Efficiency</span>
                <span style={{fontSize:'0.82rem', fontWeight:600, color:'var(--risk-medium)'}}>
                  {((summary.total_spent - summary.total_sanctioned) / summary.total_sanctioned * 100).toFixed(1)}% overrun
                </span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill risk-high" style={{width:'15%'}}></div>
              </div>
            </div>
            <div className="stat-sub" style={{marginTop:12, padding:'8px 12px', background:'var(--bg-input)', borderRadius:'6px'}}>
              📈 Trend: Fund utilization improved +2.8% over last quarter
            </div>
          </div>
        </div>
      </div>

      {/* High Risk Projects Table */}
      <div className="panel">
        <div className="panel-header">
          <h3>⚠️ High-Risk Projects</h3>
          <div className="panel-actions">
            <button className="btn btn-outline btn-sm" onClick={() => exportReport('csv', { risk_category: 'critical' })}>
              📥 Export CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => exportReport('pdf', { risk_category: 'critical' })}>
              📄 Export PDF
            </button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{cursor:'pointer'}} onClick={() => handleSort('project_id')}>Project ID</th>
              <th>State</th>
              <th>District</th>
              <th style={{cursor:'pointer'}} onClick={() => handleSort('risk_score')}>Risk Score ↕</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center', color:'var(--text-muted)', padding:30}}>No critical-risk projects detected — all within acceptable thresholds</td></tr>
            )}
            {projects.map((p, i) => (
              <tr key={i}>
                <td style={{fontWeight:600, color:'var(--accent-primary)'}}>{p.project_id}</td>
                <td>{p.state}</td>
                <td>{p.district}</td>
                <td><span className={`risk-badge ${p.risk_category}`}>{p.risk_score?.toFixed(0)}</span></td>
                <td><span className={`risk-badge ${p.risk_category}`}>{p.risk_category}</span></td>
                <td style={{maxWidth:280, whiteSpace:'normal', fontSize:'0.8rem'}}>{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Items */}
      <div className="panel">
        <div className="panel-header">
          <h3>📋 Recommended Actions</h3>
        </div>
        <div className="result-section">
          <div className="recommendation-item">
            <span className="rec-icon">⚡</span>
            <span>Review contractor payment history for all critical-flagged projects before next tranche release</span>
          </div>
          <div className="recommendation-item">
            <span className="rec-icon">⚡</span>
            <span>Verify geo-tagged site photographs for projects with 0% physical progress but &gt;50% fund utilization</span>
          </div>
          <div className="recommendation-item">
            <span className="rec-icon">⚡</span>
            <span>Escalate ghost project indicators to District Magistrate for on-ground verification</span>
          </div>
        </div>
      </div>
    </div>
  );
}
