import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDistrictDashboard, fetchStatesAndDistricts, fetchProjects, formatCrore, formatLakh } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';
import RealTimeDistrictMap from './RealTimeDistrictMap';

// Known spelling transliterations and district aliases
const DISTRICT_ALIASES = {
  'thoothukudi': 'thoothukkudi',
  'tuticorin': 'thoothukkudi',
  'thoothukkudi': 'thoothukkudi',
  'tiruvallur': 'thiruvallur',
  'thiruvallur': 'thiruvallur',
  'kanyakumari': 'kanniyakumari',
  'kanniyakumari': 'kanniyakumari',
  'tirupur': 'tiruppur',
  'tiruppur': 'tiruppur',
  'villupuram': 'viluppuram',
  'viluppuram': 'viluppuram',
  'tirupathur': 'tirupathur',
  'tirupattur': 'tirupathur',
  'tiruvarur': 'thiruvarur',
  'thiruvarur': 'thiruvarur',
  'kanchipuram': 'kancheepuram',
  'kancheepuram': 'kancheepuram',
  'tiruchirappalli': 'tiruchirappalli',
  'trichy': 'tiruchirappalli',
  'dharashiv': 'osmanabad',
  'osmanabad': 'osmanabad',
  'chhatrapati sambhajinagar': 'aurangabad',
  'aurangabad': 'aurangabad',
  'prayagraj': 'allahabad',
  'allahabad': 'allahabad',
  'ayodhya': 'faizabad',
  'faizabad': 'faizabad',
  'gurugram': 'gurgaon',
  'gurgaon': 'gurgaon',
  'mysuru': 'mysore',
  'mysore': 'mysore',
  'belagavi': 'belgaum',
  'belgaum': 'belgaum',
  'kalaburagi': 'gulbarga',
  'gulbarga': 'kalaburagi'
};

const normalizeDistrictQuery = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/th/g, 't')
    .replace(/kk/g, 'k')
    .replace(/pp/g, 'p')
    .replace(/ll/g, 'l')
    .replace(/nn/g, 'n')
    .replace(/tt/g, 't')
    .replace(/rr/g, 'r')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/[^a-z0-9]/g, '');
};

const matchesDistrict = (districtName, query) => {
  if (!districtName || !query) return false;
  const dNorm = districtName.toLowerCase().trim();
  const qNorm = query.toLowerCase().trim();
  if (dNorm.includes(qNorm)) return true;

  const aliasD = DISTRICT_ALIASES[dNorm];
  if (aliasD && (aliasD.includes(qNorm) || qNorm.includes(aliasD))) return true;

  const aliasQ = DISTRICT_ALIASES[qNorm];
  if (aliasQ && (dNorm.includes(aliasQ) || aliasQ.includes(dNorm))) return true;

  const nD = normalizeDistrictQuery(dNorm);
  const nQ = normalizeDistrictQuery(qNorm);
  if (nD && nQ && (nD.includes(nQ) || nQ.includes(nD))) return true;

  return false;
};

export default function DistrictDashboard() {
  const [searchParams] = useSearchParams();
  const stateFromUrl = searchParams.get('state');
  const districtFromUrl = searchParams.get('district');

  const [statesMap, setStatesMap] = useState({});
  const [statesList, setStatesList] = useState([]);
  const [selectedState, setSelectedState] = useState(stateFromUrl || 'Karnataka');
  const [districtsList, setDistrictsList] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(districtFromUrl || 'Dharwad');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allDistrictProjects, setAllDistrictProjects] = useState([]);
  const [riskFilter, setRiskFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  // 1. Fetch States and their Districts mapping on mount
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      setStatesMap(map);
      const states = Object.keys(map).sort();
      setStatesList(states);

      let matchedState = null;
      if (stateFromUrl) {
        matchedState = states.find(s => s.toLowerCase() === stateFromUrl.toLowerCase().trim());
      }
      const defaultState = matchedState || (map['Karnataka'] ? 'Karnataka' : states[0] || '');
      setSelectedState(defaultState);

      const dists = map[defaultState] || [];
      setDistrictsList(dists);
      if (dists.length > 0) {
        let matchedDist = null;
        if (districtFromUrl) {
          const dTarget = districtFromUrl.toLowerCase().trim();
          // 1. Exact match case-insensitive
          matchedDist = dists.find(d => d.toLowerCase() === dTarget);
          // 2. Alias match
          if (!matchedDist) {
            const alias = DISTRICT_ALIASES[dTarget];
            if (alias) {
              matchedDist = dists.find(d => d.toLowerCase() === alias.toLowerCase() || d.toLowerCase().includes(alias.toLowerCase()));
            }
          }
          // 3. Phonetic/consonant fuzzy match
          if (!matchedDist) {
            matchedDist = dists.find(d => matchesDistrict(d, dTarget));
          }
        }
        const defaultDist = matchedDist || (dists.includes('Dharwad') ? 'Dharwad' : dists[0]);
        setSelectedDistrict(defaultDist);
      }
    });
  }, [stateFromUrl, districtFromUrl]);

  // 2. When State selection changes, update the cascading District dropdown
  const handleStateChange = (newState) => {
    setSelectedState(newState);
    const dists = statesMap[newState] || [];
    setDistrictsList(dists);
    if (dists.length > 0) {
      setSelectedDistrict(dists[0]);
    } else {
      setSelectedDistrict('');
    }
  };

  // 3. Load District Dashboard data when State or District changes
  useEffect(() => {
    if (!selectedState || !selectedDistrict) return;
    setLoading(true);
    fetchDistrictDashboard(selectedState, selectedDistrict).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [selectedState, selectedDistrict]);

  // 4. Load projects with optional date-range filters
  useEffect(() => {
    if (!selectedState || !selectedDistrict) return;
    const params = { state: selectedState, district: selectedDistrict, page_size: 100 };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    fetchProjects(params).then(res => {
      setAllDistrictProjects(res.projects || []);
    });
  }, [selectedState, selectedDistrict, startDate, endDate]);

  const filteredProjects = allDistrictProjects.filter(p => {
    if (riskFilter === 'all') return true;
    const cat = (p.risk_category || (p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low')).toLowerCase();
    return cat === riskFilter;
  });

  return (
    <div>
      <div className="page-header">
        <h2>📍 District Authority Dashboard</h2>
        <p>Granular project milestone verification, budget tracking, contractor performance, and single project inspection</p>
      </div>

      {/* Cascading State & District Dropdown Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 240 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            1. SELECT STATE
          </label>
          <select
            className="form-control"
            value={selectedState}
            onChange={e => handleStateChange(e.target.value)}
          >
            {statesList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 260, flex: 1 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            2. SELECT DISTRICT (AUTO-POPULATED)
          </label>
          <select
            className="form-control"
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            disabled={districtsList.length === 0}
          >
            {districtsList.length === 0 && <option value="">No districts available</option>}
            {districtsList.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
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
            <div className="stat-card" style={{ borderLeft: '3px solid var(--chart-3)' }}>
              <div className="stat-label">Remaining Budget</div>
              <div className="stat-value" style={{ color: 'var(--chart-3)' }}>{formatCrore(data.budget_burndown?.remaining)}</div>
            </div>
          </div>

          {/* Real-Time Geospatial District Project Map */}
          <div style={{ marginBottom: 20 }}>
            <RealTimeDistrictMap
              districtName={selectedDistrict}
              stateName={selectedState}
              districtCoordinates={data.coordinates}
              projects={allDistrictProjects.length > 0 ? allDistrictProjects : (data.projects || [])}
              height="460px"
              onSelectProject={(p) => setSelectedProject(p)}
            />
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
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '6px' }} itemStyle={{ color: 'var(--text-primary)' }} formatter={v => formatCrore(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Contractor Performance */}
            <div className="panel">
              <div className="panel-header"><h3>Contractor Performance</h3></div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
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
                          <td style={{ fontWeight: 500, maxWidth: 150 }}>{c.contractor}</td>
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

          {/* Active Projects Timeline */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div>
                <h3 style={{ display: 'inline-block', marginRight: 10 }}>Active Projects Timeline</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any project row to inspect full project details
                </span>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(data.active_projects_gantt || []).map((p, i) => {
                const progress = p.progress_percentage || 0;
                const riskColor = p.risk_score >= 70 ? 'var(--risk-critical)' : p.risk_score >= 50 ? 'var(--risk-high)' : p.risk_score >= 30 ? 'var(--risk-medium)' : 'var(--risk-low)';
                return (
                  <div
                    className="gantt-row"
                    key={i}
                    onClick={() => setSelectedProject(p)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view comprehensive project details"
                  >
                    <div className="gantt-label" title={p.work_description}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{p.project_id}</span>
                      <br />
                      <span style={{ fontSize: '0.7rem' }}>{p.work_description}</span>
                    </div>
                    <div className="gantt-bar-wrap">
                      <div className="gantt-bar" style={{ width: `${Math.max(progress, 5)}%`, background: `linear-gradient(90deg, ${riskColor}aa, ${riskColor})` }}>
                        {progress.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ width: 60, textAlign: 'right' }}>
                      <span className={`risk-badge ${p.risk_score >= 60 ? 'high' : 'low'}`} style={{ fontSize: '0.65rem' }}>
                        {p.risk_score?.toFixed(0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comprehensive District Projects Table with Risk Filters */}
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>📋 All Projects in {selectedDistrict}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Showing {filteredProjects.length} projects • Click any row or button to view project details
                  </span>
                </div>

                {/* Risk Filter Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    className={`btn ${riskFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('all')}
                  >
                    All ({allDistrictProjects.length})
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

              {/* Date-Range Filter Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 6, width: '100%' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Sanction Date Range:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>From:</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ padding: '3px 8px', fontSize: '0.78rem', width: 140 }}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>To:</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ padding: '3px 8px', fontSize: '0.78rem', width: 140 }}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                  >
                    Clear Dates ✕
                  </button>
                )}
                {(startDate || endDate) && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-hover)' }}>
                    Filtering {filteredProjects.length} projects within selected date window
                  </span>
                )}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No projects found in {selectedDistrict} with matching filters {startDate || endDate ? `between ${startDate || 'beginning'} and ${endDate || 'present'}` : ''}.
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>Sanction Date</th>
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
                    {filteredProjects.map((p, idx) => {
                      const pScore = p.risk_score || 0;
                      const pCat = (p.risk_category || (pScore >= 80 ? 'critical' : pScore >= 60 ? 'high' : pScore >= 40 ? 'medium' : 'low')).toLowerCase();
                      const pProgress = p.progress_percentage || 0;

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedProject(p)}
                          style={{ cursor: 'pointer' }}
                          title="Click to view full project breakdown"
                        >
                          <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {p.project_id}
                            {p.geo_duplicate_flag === 1 && (
                              <span className="risk-badge" style={{ marginLeft: 6, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.68rem', padding: '1px 5px' }}>
                                🌐 Geo-Dup
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {p.approval_date || 'N/A'}
                          </td>
                          <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: '0.82rem' }}>
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
