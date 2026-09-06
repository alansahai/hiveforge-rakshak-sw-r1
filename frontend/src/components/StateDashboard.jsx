import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchStateDashboard, formatCrore } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export default function StateDashboard() {
  const [selectedState, setSelectedState] = useState('Karnataka');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchStateDashboard(selectedState).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [selectedState]);

  return (
    <div>
      <div className="page-header">
        <h2>🚩 State Nodal Authority Dashboard</h2>
        <p>State-wide aggregation, district risk distribution, and compliance scorecard</p>
      </div>

      {/* State Selector */}
      <div className="filter-bar">
        <select className="form-control" value={selectedState} onChange={e => setSelectedState(e.target.value)}>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading || !data ? (
        <div className="loading-container"><div className="spinner"></div> Loading {selectedState} data...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Projects</div>
              <div className="stat-value">{data.total_projects?.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Completed</div>
              <div className="stat-value" style={{color:'var(--risk-low)'}}>{data.completed_count?.toLocaleString()}</div>
            </div>
            <div className="stat-card risk-high">
              <div className="stat-label">At Risk</div>
              <div className="stat-value" style={{color:'var(--risk-high)'}}>{data.at_risk_count?.toLocaleString()}</div>
            </div>
            <div className="stat-card risk-critical">
              <div className="stat-label">Critical</div>
              <div className="stat-value" style={{color:'var(--risk-critical)'}}>{data.critical_count}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Sanctioned</div>
              <div className="stat-value">{formatCrore(data.total_sanctioned)}</div>
            </div>
          </div>

          {/* Compliance Scorecard + District Heatmap */}
          <div className="grid-2">
            {/* Compliance Scorecard */}
            <div className="panel">
              <div className="panel-header"><h3>Compliance Scorecard</h3></div>
              <div style={{display:'flex', flexDirection:'column', gap:16, padding:'8px 0'}}>
                {[
                  { label: 'On-Time Completion', value: data.compliance_scorecard?.on_time_completion_pct, suffix: '%', color: 'var(--risk-low)' },
                  { label: 'Cost Efficiency', value: data.compliance_scorecard?.cost_efficiency_pct, suffix: '%', color: 'var(--accent-primary)' },
                  { label: 'Transparency Index', value: data.compliance_scorecard?.transparency_index, suffix: '/100', color: 'var(--chart-2)' }
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                      <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>{item.label}</span>
                      <span style={{fontSize:'0.85rem', fontWeight:700, color: item.color}}>{item.value}{item.suffix}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{width:`${Math.min(item.value || 0, 100)}%`, background: item.color}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* District Risk Bar Chart */}
            <div className="panel">
              <div className="panel-header"><h3>District Risk Distribution</h3></div>
              {data.district_heatmap && data.district_heatmap.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.district_heatmap.slice(0, 10)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                    <YAxis type="category" dataKey="district" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }} itemStyle={{ color: '#e2e8f0' }} />
                    <Bar dataKey="avg_risk_score" fill="#f97316" radius={[0, 4, 4, 0]} name="Avg Risk Score" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="loading-container">No district data available</div>
              )}
            </div>
          </div>

          {/* District Heatmap Table */}
          <div className="panel">
            <div className="panel-header">
              <h3>District Risk Heatmap — {selectedState}</h3>
              <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>{data.district_heatmap?.length || 0} districts</span>
            </div>
            <div style={{maxHeight:400, overflowY:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Projects</th>
                    <th>Avg Risk</th>
                    <th>High Risk</th>
                    <th>Sanctioned</th>
                    <th>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.district_heatmap || []).map((d, i) => {
                    const riskCat = d.avg_risk_score >= 70 ? 'critical' : d.avg_risk_score >= 55 ? 'high' : d.avg_risk_score >= 40 ? 'medium' : 'low';
                    return (
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{d.district}</td>
                        <td>{d.project_count}</td>
                        <td><span className={`risk-badge ${riskCat}`}>{d.avg_risk_score}</span></td>
                        <td style={{color:'var(--risk-high)', fontWeight:600}}>{d.high_risk_count}</td>
                        <td>{formatCrore(d.total_sanctioned)}</td>
                        <td><span className={`risk-badge ${riskCat}`}>{riskCat}</span></td>
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
  );
}
