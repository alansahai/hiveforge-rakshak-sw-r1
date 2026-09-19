import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDistrictDashboard, fetchStatesAndDistricts, fetchProjects, formatCrore, formatLakh } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';
import RealTimeDistrictMap from './RealTimeDistrictMap';
import {
  IconDistrict,
  IconInspect,
  IconSearch,
  IconFilter,
  IconShieldCheck,
  IconCheckCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconFileText,
  IconBuilding
} from './common/GovIcons';

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
          matchedDist = dists.find(d => d.toLowerCase() === dTarget);
          if (!matchedDist) {
            const alias = DISTRICT_ALIASES[dTarget];
            if (alias) {
              matchedDist = dists.find(d => d.toLowerCase() === alias.toLowerCase() || d.toLowerCase().includes(alias.toLowerCase()));
            }
          }
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
        <h2>
          <IconDistrict size={24} color="var(--gov-navy-800)" />
          <span>District Authority Implementation Dashboard</span>
        </h2>
        <p>
          District magistrate &amp; collectorate execution oversight, budget burndown, agency performance, and on-ground project tracking
        </p>
      </div>

      {/* Cascading State & District Dropdown Filters */}
      <div className="filter-bar">
        <div style={{ minWidth: 240 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
            1. STATE JURISDICTION
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
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
            2. DISTRICT COLLECTORATE / AUTHORITY
          </label>
          <select
            className="form-control"
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            disabled={districtsList.length === 0}
          >
            {districtsList.length === 0 && <option value="">No districts recorded</option>}
            {districtsList.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Loading {selectedDistrict} administrative ledger…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Allocated Works</div>
              <div className="stat-value">{data.total_projects}</div>
              <div className="stat-sub">{selectedDistrict}, {selectedState}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Outlay Allocated</div>
              <div className="stat-value">{formatCrore(data.budget_burndown?.allocated)}</div>
              <div className="stat-sub">District envelope</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cumulative Expenditure</div>
              <div className="stat-value">{formatCrore(data.budget_burndown?.spent)}</div>
              <div className="stat-sub">Disbursed to date</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--gov-navy-600)' }}>
              <div className="stat-label">Unspent Balance</div>
              <div className="stat-value" style={{ color: 'var(--gov-navy-800)' }}>
                {formatCrore(data.budget_burndown?.remaining)}
              </div>
              <div className="stat-sub">Available capital</div>
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
              <div className="panel-header">
                <h3>Fiscal Burndown Distribution</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    { name: 'Allocated', value: data.budget_burndown?.allocated || 0 },
                    { name: 'Disbursed', value: data.budget_burndown?.spent || 0 },
                    { name: 'Unspent Balance', value: data.budget_burndown?.remaining || 0 }
                  ]}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickFormatter={v => `₹${(v / 10000000).toFixed(1)}Cr`} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '4px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                    formatter={v => formatCrore(v)}
                  />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="var(--gov-navy-800)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Contractor Performance */}
            <div className="panel">
              <div className="panel-header">
                <h3>Implementing Agency Track Record</h3>
              </div>
              <div className="table-responsive" style={{ maxHeight: 260 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Agency / Contractor</th>
                      <th style={{ textAlign: 'right' }}>Works</th>
                      <th style={{ textAlign: 'center' }}>Avg Anomaly</th>
                      <th style={{ textAlign: 'right' }}>Sanctioned Outlay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.contractor_performance || []).map((c, i) => {
                      const riskCat =
                        c.avg_risk_score >= 70
                          ? 'critical-alert'
                          : c.avg_risk_score >= 50
                          ? 'high-risk'
                          : c.avg_risk_score >= 35
                          ? 'under-review'
                          : 'approved';
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                            {c.contractor}
                          </td>
                          <td style={{ textAlign: 'right' }}>{c.project_count}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${riskCat}`}>
                              {c.avg_risk_score}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>
                            {formatLakh(c.total_sanctioned)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Active Projects Timeline */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Active Works Implementation Milestones</h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Click any project row to inspect full project audit details
                </p>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(data.active_projects_gantt || []).map((p, i) => {
                const progress = p.progress_percentage || 0;
                const riskClass =
                  p.risk_score >= 70
                    ? 'critical-alert'
                    : p.risk_score >= 50
                    ? 'high-risk'
                    : p.risk_score >= 30
                    ? 'under-review'
                    : 'approved';

                return (
                  <div
                    className="gantt-row"
                    key={i}
                    onClick={() => setSelectedProject(p)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view comprehensive project details"
                  >
                    <div className="gantt-label" title={p.work_description}>
                      <span style={{ fontWeight: 700, color: 'var(--gov-navy-800)', fontSize: '0.75rem' }}>
                        {p.project_id}
                      </span>
                      <br />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {p.work_description}
                      </span>
                    </div>
                    <div className="gantt-bar-wrap">
                      <div
                        className="gantt-bar"
                        style={{
                          width: `${Math.max(progress, 5)}%`,
                          background: 'var(--gov-navy-800)'
                        }}
                      >
                        {progress.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ width: 85, textAlign: 'right' }}>
                      <span className={`status-badge ${riskClass}`} style={{ fontSize: '0.68rem' }}>
                        {p.risk_score?.toFixed(0)}/100
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
                  <h3>
                    <IconFileText size={18} color="var(--gov-navy-800)" />
                    <span>Works Implementation Ledger ({selectedDistrict})</span>
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Showing {filteredProjects.length} of {allDistrictProjects.length} registered works
                  </p>
                </div>

                {/* Risk Filter Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('all')}
                  >
                    All ({allDistrictProjects.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'low' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={
                      riskFilter === 'low'
                        ? { background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', borderColor: 'var(--status-approved-border)' }
                        : { color: 'var(--status-approved-text)' }
                    }
                    onClick={() => setRiskFilter('low')}
                  >
                    <IconCheckCircle size={12} />
                    <span>Approved / Low</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'medium' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={
                      riskFilter === 'medium'
                        ? { background: 'var(--status-review-bg)', color: 'var(--status-review-text)', borderColor: 'var(--status-review-border)' }
                        : { color: 'var(--status-review-text)' }
                    }
                    onClick={() => setRiskFilter('medium')}
                  >
                    <IconShieldCheck size={12} />
                    <span>Under Review</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'high' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={
                      riskFilter === 'high'
                        ? { background: 'var(--status-escalated-bg)', color: 'var(--status-escalated-text)', borderColor: 'var(--status-escalated-border)' }
                        : { color: 'var(--status-escalated-text)' }
                    }
                    onClick={() => setRiskFilter('high')}
                  >
                    <IconAlertTriangle size={12} />
                    <span>Audit Escalation</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'critical' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    style={
                      riskFilter === 'critical'
                        ? { background: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }
                        : { color: 'var(--status-critical-text)' }
                    }
                    onClick={() => setRiskFilter('critical')}
                  >
                    <IconAlertOctagon size={12} />
                    <span>Critical Inquiry</span>
                  </button>
                </div>
              </div>

              {/* Date-Range Filter Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 4, width: '100%' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Sanction Date Window:
                </span>
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
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                  >
                    Clear Filter ✕
                  </button>
                )}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No projects found in {selectedDistrict} with matching filters.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 420 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>Sanction Date</th>
                      <th>Work Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Sanctioned (₹)</th>
                      <th style={{ textAlign: 'right' }}>Spent (₹)</th>
                      <th style={{ textAlign: 'center' }}>Progress</th>
                      <th style={{ textAlign: 'center' }}>Anomaly Score</th>
                      <th>Agency</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p, idx) => {
                      const pScore = p.risk_score || 0;
                      const statusClass =
                        pScore >= 80
                          ? 'critical-alert'
                          : pScore >= 60
                          ? 'high-risk'
                          : pScore >= 40
                          ? 'under-review'
                          : 'approved';
                      const pProgress = p.progress_percentage || 0;

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedProject(p)}
                          style={{ cursor: 'pointer' }}
                          title="Click to view full project breakdown"
                        >
                          <td style={{ fontWeight: 700, color: 'var(--gov-navy-800)' }}>
                            {p.project_id}
                            {p.geo_duplicate_flag === 1 && (
                              <span
                                className="status-badge critical-alert"
                                style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px' }}
                              >
                                Geo-Dup
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {p.approval_date || 'N/A'}
                          </td>
                          <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: '0.82rem' }}>
                            {p.work_description || 'MPLADS work'}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              {p.category}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLakh(p.amount_sanctioned)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatLakh(p.amount_spent)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                              {pProgress.toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${statusClass}`}>
                              {pScore.toFixed(0)}/100
                            </span>
                          </td>
                          <td style={{ maxWidth: 140, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {p.contractor || 'State Agency'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProject(p);
                              }}
                            >
                              <IconInspect size={12} />
                              <span>Inspect</span>
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
