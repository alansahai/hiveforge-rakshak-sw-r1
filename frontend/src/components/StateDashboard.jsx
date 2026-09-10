import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchStateDashboard, fetchProjects, fetchStatesAndDistricts, formatCrore, formatLakh } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';

export default function StateDashboard() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('Karnataka');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // District click drilldown states
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districtProjects, setDistrictProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);

  // 1. Load available states
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      const stateList = Object.keys(map).sort();
      if (stateList.length > 0) {
        setStates(stateList);
      }
    });
  }, []);

  // 2. Load state aggregate metrics
  useEffect(() => {
    setLoading(true);
    setSelectedDistrict(null);
    setDistrictProjects([]);
    fetchStateDashboard(selectedState).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [selectedState]);

  // 3. Load projects when a district is clicked
  const handleDistrictClick = (districtName) => {
    setSelectedDistrict(districtName);
    setLoadingProjects(true);
    fetchProjects({ state: selectedState, district: districtName, page_size: 50 })
      .then((res) => {
        setDistrictProjects(res.projects || []);
      })
      .finally(() => setLoadingProjects(false));
  };

  const filteredDistrictProjects = districtProjects.filter((p) => {
    if (riskFilter === 'all') return true;
    const cat = (p.risk_category || (p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low')).toLowerCase();
    return cat === riskFilter;
  });

  return (
    <div>
      <div className="page-header">
        <h2>🚩 State Nodal Authority Dashboard</h2>
        <p>State-wide aggregation, district risk distribution, compliance scorecard, and granular project drilldown</p>
      </div>

      {/* State Selector */}
      <div className="filter-bar">
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>SELECT STATE</label>
        <select className="form-control" value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{ minWidth: 260 }}>
          {(states.length > 0 ? states : ['Karnataka', 'Tamil Nadu', 'Maharashtra', 'Uttar Pradesh', 'Gujarat']).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
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
            <div className="stat-card" style={{ borderLeft: '3px solid var(--risk-low)' }}>
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
              <div className="panel-header"><h3>Top 10 Districts by Risk</h3></div>
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

          {/* District Heatmap Table with Click-to-Drilldown */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 style={{ display: 'inline-block', marginRight: 10 }}>District Risk Heatmap — {selectedState}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  👉 Click any district to view its project list below ({data.district_heatmap?.length || 0} districts)
                </span>
              </div>
            </div>
            <div style={{maxHeight:360, overflowY:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Projects</th>
                    <th>Avg Risk</th>
                    <th>High Risk</th>
                    <th>Sanctioned</th>
                    <th>Risk Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.district_heatmap || []).map((d, i) => {
                    const riskCat = d.avg_risk_score >= 70 ? 'critical' : d.avg_risk_score >= 55 ? 'high' : d.avg_risk_score >= 40 ? 'medium' : 'low';
                    const isSelected = selectedDistrict === d.district;

                    return (
                      <tr
                        key={i}
                        onClick={() => handleDistrictClick(d.district)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(59, 130, 246, 0.12)' : undefined,
                          borderLeft: isSelected ? '4px solid var(--accent-primary)' : '4px solid transparent'
                        }}
                        title="Click to load projects for this district"
                      >
                        <td style={{fontWeight:600, color: isSelected ? 'var(--accent-hover)' : 'var(--text-primary)'}}>
                          {isSelected && '👉 '} {d.district}
                        </td>
                        <td>{d.project_count}</td>
                        <td><span className={`risk-badge ${riskCat}`}>{d.avg_risk_score}</span></td>
                        <td style={{color:'var(--risk-high)', fontWeight:600}}>{d.high_risk_count}</td>
                        <td>{formatCrore(d.total_sanctioned)}</td>
                        <td><span className={`risk-badge ${riskCat}`}>{riskCat}</span></td>
                        <td>
                          <button
                            className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'} btn-sm`}
                            style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDistrictClick(d.district);
                            }}
                          >
                            {isSelected ? 'Selected ✓' : 'View Projects'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* District Projects Drilldown Section */}
          {selectedDistrict && (
            <div className="panel" style={{ marginTop: 20, border: '1px solid var(--accent-primary-glow)' }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--accent-hover)' }}>
                    📍 Projects in {selectedDistrict}, {selectedState}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Click any project to inspect full financial, execution, and AI anomaly details
                  </span>
                </div>

                {/* Risk Filter Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    className={`btn ${riskFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('all')}
                  >
                    All ({districtProjects.length})
                  </button>
                  <button
                    className={`btn ${riskFilter === 'low' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={riskFilter === 'low' ? { background: 'var(--risk-low)', borderColor: 'var(--risk-low)' } : { color: 'var(--risk-low)' }}
                    onClick={() => setRiskFilter('low')}
                  >
                    🟢 Safe / Low
                  </button>
                  <button
                    className={`btn ${riskFilter === 'medium' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={riskFilter === 'medium' ? { background: 'var(--risk-medium)', borderColor: 'var(--risk-medium)' } : { color: 'var(--risk-medium)' }}
                    onClick={() => setRiskFilter('medium')}
                  >
                    🟡 Medium
                  </button>
                  <button
                    className={`btn ${riskFilter === 'high' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={riskFilter === 'high' ? { background: 'var(--risk-high)', borderColor: 'var(--risk-high)' } : { color: 'var(--risk-high)' }}
                    onClick={() => setRiskFilter('high')}
                  >
                    🟠 High
                  </button>
                  <button
                    className={`btn ${riskFilter === 'critical' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={riskFilter === 'critical' ? { background: 'var(--risk-critical)', borderColor: 'var(--risk-critical)' } : { color: 'var(--risk-critical)' }}
                    onClick={() => setRiskFilter('critical')}
                  >
                    🔴 Critical
                  </button>
                </div>
              </div>

              {loadingProjects ? (
                <div className="loading-container" style={{ minHeight: 140 }}>
                  <div className="spinner"></div> Loading projects for {selectedDistrict}...
                </div>
              ) : filteredDistrictProjects.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No projects found for {selectedDistrict} with risk category "{riskFilter}".
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>Work Scope</th>
                        <th>Category</th>
                        <th>Sanctioned</th>
                        <th>Spent</th>
                        <th>Progress</th>
                        <th>Risk Score</th>
                        <th>Contractor</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDistrictProjects.map((p, idx) => {
                        const pScore = p.risk_score || 0;
                        const pCat = (p.risk_category || (pScore >= 80 ? 'critical' : pScore >= 60 ? 'high' : pScore >= 40 ? 'medium' : 'low')).toLowerCase();
                        const pProgress = p.progress_percentage || 0;

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedProject(p)}
                            style={{ cursor: 'pointer' }}
                            title="Click to view detailed project profile"
                          >
                            <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{p.project_id}</td>
                            <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: '0.82rem' }}>
                              {p.work_description || 'MPLADS project'}
                            </td>
                            <td><span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.category}</span></td>
                            <td>{formatLakh(p.amount_sanctioned)}</td>
                            <td>{formatLakh(p.amount_spent)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="progress-bar-container" style={{ width: 45, height: 6 }}>
                                  <div
                                    className="progress-bar-fill"
                                    style={{
                                      width: `${Math.min(pProgress, 100)}%`,
                                      background: pProgress >= 95 ? 'var(--risk-low)' : 'var(--accent-primary)'
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{pProgress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`risk-badge ${pCat}`}>
                                {pScore.toFixed(0)}/100
                              </span>
                            </td>
                            <td style={{ maxWidth: 130, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {p.contractor || 'State Agency'}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(p);
                                }}
                              >
                                Details 🔍
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
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
