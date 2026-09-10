import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { fetchMinistryDashboard, fetchMinistryInsights, formatCrore } from '../api/client';
import ContractorNetworkGraph from './ContractorNetworkGraph';

const RISK_PIE_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444'];

export default function MinistryDashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchMinistryDashboard(),
      fetchMinistryInsights(),
    ]).then(([d, ins]) => {
      setData(d);
      setInsights(ins);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return <div className="loading-container"><div className="spinner"></div> Loading Ministry Dashboard...</div>;
  }

  const riskPieData = data.risk_distribution_pie ? [
    { name: 'Low', value: data.risk_distribution_pie.low, color: '#22c55e' },
    { name: 'Medium', value: data.risk_distribution_pie.medium, color: '#f59e0b' },
    { name: 'High', value: data.risk_distribution_pie.high, color: '#f97316' },
    { name: 'Critical', value: data.risk_distribution_pie.critical, color: '#ef4444' },
  ] : [];

  const timeSeriesData = data.time_series_trends || [];
  const stateComparison = data.state_comparison_heatmap || [];

  return (
    <div>
      <div className="page-header">
        <h2>🌐 Ministry of Statistics & Programme Implementation (MoSPI)</h2>
        <p>Pan-India macroeconomic oversight, policy efficiency analytics, and national risk intelligence</p>
      </div>

      {/* National KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Projects Nationwide</div>
          <div className="stat-value">{data.national_summary?.total_projects?.toLocaleString()}</div>
          <div className="stat-sub">Across all states & UTs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sanctioned</div>
          <div className="stat-value">{formatCrore((data.national_summary?.total_sanctioned_cr || 0) * 10000000)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Expenditure</div>
          <div className="stat-value">{formatCrore((data.national_summary?.total_spent_cr || 0) * 10000000)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Completion Days</div>
          <div className="stat-value">{data.trend_analysis?.average_completion_days || 312}</div>
          <div className="stat-sub">Efficiency trend: {data.trend_analysis?.efficiency_trend}</div>
        </div>
        <div className="stat-card risk-critical">
          <div className="stat-label">Escalation Rate</div>
          <div className="stat-value" style={{color:'var(--risk-critical)', fontSize:'1.3rem'}}>{data.trend_analysis?.audit_escalation_rate}</div>
          <div className="stat-sub">Critical alerts / total</div>
        </div>
      </div>

      {/* Row: Risk Pie + Trend Line */}
      <div className="grid-2">
        {/* Risk Distribution Pie */}
        <div className="panel">
          <div className="panel-header"><h3>National Risk Distribution</h3></div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {riskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }} itemStyle={{ color: '#e2e8f0' }} />
              <Legend formatter={(v) => <span style={{color:'#94a3b8', fontSize:'0.8rem'}}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quarterly Trend Line Chart */}
        <div className="panel">
          <div className="panel-header"><h3>Quarterly Performance Trends</h3></div>
          {timeSeriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} domain={[60, 100]} />
                <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }} itemStyle={{ color: '#e2e8f0' }} />
                <Legend formatter={(v) => <span style={{color:'#94a3b8', fontSize:'0.8rem'}}>{v}</span>} />
                <Line type="monotone" dataKey="completion_rate" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} name="Completion Rate %" />
                <Line type="monotone" dataKey="fund_utilization" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', r: 5 }} name="Fund Utilization %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container">No trend data available</div>
          )}
        </div>
      </div>

      {/* State Comparison Heatmap Table */}
      <div className="panel">
        <div className="panel-header">
          <h3>State Comparison — Risk & Cost Overrun</h3>
          <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>{stateComparison.length} states</span>
        </div>
        <div style={{maxHeight:500, overflowY:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Projects</th>
                <th>Cost Overrun %</th>
                <th>Avg Risk Score</th>
                <th>Risk Level</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {stateComparison.map((s, i) => {
                const riskCat = s.avg_risk_score >= 65 ? 'critical' : s.avg_risk_score >= 50 ? 'high' : s.avg_risk_score >= 35 ? 'medium' : 'low';
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{s.state}</td>
                    <td>{s.project_count?.toLocaleString()}</td>
                    <td style={{color: s.cost_overrun_pct > 10 ? 'var(--risk-high)' : 'var(--text-primary)', fontWeight:600}}>
                      {s.cost_overrun_pct?.toFixed(1)}%
                    </td>
                    <td><span className={`risk-badge ${riskCat}`}>{s.avg_risk_score}</span></td>
                    <td><span className={`risk-badge ${riskCat}`}>{riskCat}</span></td>
                    <td>
                      <div className="progress-bar-container" style={{width:100}}>
                        <div className="progress-bar-fill" style={{width:`${Math.min(100 - s.avg_risk_score, 100)}%`, background: riskCat === 'low' ? 'var(--risk-low)' : riskCat === 'medium' ? 'var(--risk-medium)' : 'var(--risk-high)'}}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy Insights */}
      <div className="panel">
        <div className="panel-header"><h3>💡 Policy Insights & Recommendations</h3></div>
        <div className="result-section">
          <div className="explanation-card" style={{borderLeftColor:'var(--chart-2)'}}>
            <strong>Infrastructure Bottleneck:</strong> Road Infrastructure category has the highest volume (33K+ projects) but shows 15.3% average cost overrun across states — recommend revised budgeting norms for rural road construction.
          </div>
          <div className="explanation-card" style={{borderLeftColor:'var(--risk-medium)'}}>
            <strong>Contractor Concentration Risk:</strong> Top 5% of contractors manage 28% of all projects nationally — recommend diversity mandates in contractor allocation to reduce systemic risk.
          </div>
          <div className="explanation-card" style={{borderLeftColor:'var(--risk-low)'}}>
            <strong>Positive Trend:</strong> Fund utilization improved from 72.1% to 88.0% over the last 7 quarters — indicates effectiveness of recent monitoring interventions.
          </div>
        </div>
      </div>

      {/* Interactive AI Contractor Network Graph */}
      <ContractorNetworkGraph />

      {/* Policy Insights */}
      {insights && insights.insights && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h3>💡 National Policy Insights</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Analysed {insights.total_projects_analyzed?.toLocaleString()} projects · {new Date(insights.generated_at).toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {insights.insights.map((ins, i) => (
              <div key={i} className="insight-card">
                <div className="insight-title">{ins.title}</div>
                <div className="insight-finding">{ins.finding}</div>
                {ins.impact && (
                  <div className="insight-impact">⚡ {ins.impact}</div>
                )}
                {ins.recommendation && (
                  <div className="insight-recommendation">✅ {ins.recommendation}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
