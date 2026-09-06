import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDistrictDashboard, formatCrore, formatLakh } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'West Bengal'
];

export default function DistrictDashboard() {
  const [selectedState, setSelectedState] = useState('Karnataka');
  const [selectedDistrict, setSelectedDistrict] = useState('Dharwad');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDistrictDashboard(selectedState, selectedDistrict).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [selectedState, selectedDistrict]);

  return (
    <div>
      <div className="page-header">
        <h2>📍 District Authority Dashboard</h2>
        <p>Granular project milestone verification, budget tracking, and contractor performance</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-control" value={selectedState} onChange={e => setSelectedState(e.target.value)}>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="form-control"
          placeholder="Enter district name..."
          value={selectedDistrict}
          onChange={e => setSelectedDistrict(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setLoading(true)}
        />
        <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); fetchDistrictDashboard(selectedState, selectedDistrict).then(d => { setData(d); setLoading(false); }); }}>
          Search
        </button>
      </div>

      {loading || !data ? (
        <div className="loading-container"><div className="spinner"></div> Loading {selectedDistrict} data...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Projects</div>
              <div className="stat-value">{data.total_projects}</div>
              <div className="stat-sub">{selectedDistrict}, {selectedState}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Budget Allocated</div>
              <div className="stat-value">{formatCrore(data.budget_burndown?.allocated)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Amount Spent</div>
              <div className="stat-value">{formatCrore(data.budget_burndown?.spent)}</div>
            </div>
            <div className="stat-card" style={{borderLeft: '3px solid var(--chart-3)'}}>
              <div className="stat-label">Remaining Budget</div>
              <div className="stat-value" style={{color:'var(--chart-3)'}}>{formatCrore(data.budget_burndown?.remaining)}</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Budget Burndown Chart */}
            <div className="panel">
              <div className="panel-header"><h3>Budget Burndown</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[
                  { name: 'Allocated', value: data.budget_burndown?.allocated || 0 },
                  { name: 'Spent', value: data.budget_burndown?.spent || 0 },
                  { name: 'Remaining', value: data.budget_burndown?.remaining || 0 }
                ]} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={v => `₹${(v / 10000000).toFixed(0)}Cr`} />
                  <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid rgba(99,130,190,0.15)', borderRadius: '6px' }} itemStyle={{ color: '#e2e8f0' }} formatter={v => formatCrore(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#3b82f6">
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Contractor Performance */}
            <div className="panel">
              <div className="panel-header"><h3>Contractor Performance</h3></div>
              <div style={{maxHeight:260, overflowY:'auto'}}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contractor</th>
                      <th>Projects</th>
                      <th>Avg Risk</th>
                      <th>Sanctioned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.contractor_performance || []).map((c, i) => {
                      const riskCat = c.avg_risk_score >= 70 ? 'critical' : c.avg_risk_score >= 50 ? 'high' : c.avg_risk_score >= 35 ? 'medium' : 'low';
                      return (
                        <tr key={i}>
                          <td style={{fontWeight:500, maxWidth:150}}>{c.contractor}</td>
                          <td>{c.project_count}</td>
                          <td><span className={`risk-badge ${riskCat}`}>{c.avg_risk_score}</span></td>
                          <td>{formatLakh(c.total_sanctioned)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Active Projects Gantt */}
          <div className="panel">
            <div className="panel-header"><h3>Active Projects Timeline</h3></div>
            <div style={{maxHeight:400, overflowY:'auto'}}>
              {(data.active_projects_gantt || []).map((p, i) => {
                const progress = p.progress_percentage || 0;
                const riskColor = p.risk_score >= 70 ? 'var(--risk-critical)' : p.risk_score >= 50 ? 'var(--risk-high)' : p.risk_score >= 30 ? 'var(--risk-medium)' : 'var(--risk-low)';
                return (
                  <div className="gantt-row" key={i}>
                    <div className="gantt-label" title={p.work_description}>
                      <span style={{fontWeight:600, color:'var(--accent-primary)', fontSize:'0.75rem'}}>{p.project_id}</span>
                      <br />
                      <span style={{fontSize:'0.7rem'}}>{p.work_description}</span>
                    </div>
                    <div className="gantt-bar-wrap">
                      <div className="gantt-bar" style={{width: `${Math.max(progress, 5)}%`, background: `linear-gradient(90deg, ${riskColor}aa, ${riskColor})`}}>
                        {progress.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{width:50, textAlign:'right'}}>
                      <span className={`risk-badge ${p.risk_score >= 60 ? 'high' : 'low'}`} style={{fontSize:'0.65rem'}}>{p.risk_score?.toFixed(0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
