import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchStateDashboard, fetchProjects, fetchStatesAndDistricts, formatCrore, formatLakh } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';
import ContractorNetworkGraph from './ContractorNetworkGraph';
import RealTimeDistrictMap from './RealTimeDistrictMap';
import {
  IconState,
  IconDistrict,
  IconInspect,
  IconSearch,
  IconFilter,
  IconShieldCheck,
  IconCheckCircle,
  IconAlertTriangle,
  IconAlertOctagon
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

export default function StateDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stateFromUrl = searchParams.get('state');
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(stateFromUrl || 'Karnataka');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync state if URL changes
  useEffect(() => {
    if (stateFromUrl && stateFromUrl !== selectedState) {
      setSelectedState(stateFromUrl);
    }
  }, [stateFromUrl]);

  // District click drilldown states
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districtSearch, setDistrictSearch] = useState('');
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

  // Filtered heatmap by district search query
  const filteredHeatmap = useMemo(() => {
    const list = data?.district_heatmap || [];
    if (!districtSearch) return list;
    return list.filter(d => matchesDistrict(d.district, districtSearch));
  }, [data?.district_heatmap, districtSearch]);

  const chartData = useMemo(() => {
    return (data?.district_heatmap || []).slice(0, 8);
  }, [data?.district_heatmap]);

  return (
    <div>
      <div className="page-header">
        <h2>
          <IconState size={24} color="var(--gov-navy-800)" />
          <span>State Nodal Authority Oversight Dashboard</span>
        </h2>
        <p>
          State-wide expenditure aggregation, district-level risk distribution, statutory compliance scorecards, and granular project drilldown
        </p>
      </div>

      {/* State Selector */}
      <div className="filter-bar">
        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          SELECT STATE / UT:
        </label>
        <select
          className="form-control"
          style={{ maxWidth: 320 }}
          value={selectedState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            setSearchParams({ state: e.target.value });
          }}
        >
          {(states.length > 0 ? states : ['Karnataka', 'Tamil Nadu', 'Maharashtra', 'Uttar Pradesh', 'Gujarat']).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Loading {selectedState} administrative data…</span>
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Monitored Works</div>
              <div className="stat-value">{data.total_projects?.toLocaleString()}</div>
              <div className="stat-sub">{selectedState} Ledger</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Outlay Sanctioned</div>
              <div className="stat-value">{formatCrore(data.total_sanctioned)}</div>
              <div className="stat-sub">Central sanction</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Funds Disbursed</div>
              <div className="stat-value">{formatCrore(data.total_spent)}</div>
              <div className="stat-sub">
                {data.total_sanctioned > 0
                  ? `${(((data.total_spent || 0) / data.total_sanctioned) * 100).toFixed(1)}% absorption`
                  : '0%'}
              </div>
            </div>
            <div className="stat-card risk-critical">
              <div className="stat-label">Critical Anomaly Works</div>
              <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>{data.critical_count}</div>
              <div className="stat-sub">Risk score ≥ 80</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Compliance Scorecard */}
            <div className="panel">
              <div className="panel-header">
                <h3>
                  <IconShieldCheck size={18} color="var(--gov-navy-800)" />
                  <span>State Compliance Scorecard</span>
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                    <span>On-Time Milestone Execution</span>
                    <span style={{ fontWeight: 700 }}>{data.compliance_scorecard?.on_time_completion_pct}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${data.compliance_scorecard?.on_time_completion_pct || 0}%`,
                        backgroundColor: (data.compliance_scorecard?.on_time_completion_pct || 0) >= 80 ? 'var(--risk-low)' : 'var(--risk-medium)'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                    <span>Fiscal Cost Efficiency Standard</span>
                    <span style={{ fontWeight: 700 }}>{data.compliance_scorecard?.cost_efficiency_pct}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${data.compliance_scorecard?.cost_efficiency_pct || 0}%`,
                        backgroundColor: (data.compliance_scorecard?.cost_efficiency_pct || 0) >= 80 ? 'var(--gov-navy-800)' : 'var(--risk-high)'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                    <span>Public Transparency &amp; Disclosure Index</span>
                    <span style={{ fontWeight: 700 }}>{data.compliance_scorecard?.transparency_index}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${data.compliance_scorecard?.transparency_index || 0}%`,
                        backgroundColor: 'var(--gov-navy-800)'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Districts by Project Volume */}
            <div className="panel">
              <div className="panel-header">
                <h3>
                  <IconDistrict size={18} color="var(--gov-navy-800)" />
                  <span>District Work Volumes (Top 8)</span>
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="district"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '4px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                  <Bar dataKey="project_count" fill="var(--gov-navy-800)" radius={[2, 2, 0, 0]} name="Works" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* District Risk Heatmap Table */}
          <div className="panel">
            <div className="panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3>
                  <IconDistrict size={18} color="var(--gov-navy-800)" />
                  <span>District Risk &amp; Performance Ledger ({selectedState})</span>
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Click any district row to drill down into its active works
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Filter district by name..."
                  style={{ width: 220, fontSize: '0.78rem' }}
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: 360 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>District Name</th>
                    <th style={{ textAlign: 'right' }}>Total Works</th>
                    <th style={{ textAlign: 'center' }}>Avg Anomaly Score</th>
                    <th style={{ textAlign: 'right' }}>High Risk Works</th>
                    <th style={{ textAlign: 'right' }}>Critical Flags</th>
                    <th style={{ textAlign: 'center' }}>Status Tier</th>
                    <th style={{ textAlign: 'center', width: 120 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeatmap.map((d, i) => {
                    const statusClass =
                      d.avg_risk >= 65
                        ? 'critical-alert'
                        : d.avg_risk >= 50
                        ? 'high-risk'
                        : d.avg_risk >= 35
                        ? 'under-review'
                        : 'approved';
                    const statusText =
                      d.avg_risk >= 65
                        ? 'Critical'
                        : d.avg_risk >= 50
                        ? 'Escalated'
                        : d.avg_risk >= 35
                        ? 'Under Review'
                        : 'Compliant';

                    return (
                      <tr
                        key={i}
                        onClick={() => handleDistrictClick(d.district)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedDistrict === d.district ? '#EBF4FC' : undefined
                        }}
                      >
                        <td style={{ fontWeight: 700, color: 'var(--gov-navy-900)' }}>
                          {d.district}
                        </td>
                        <td style={{ textAlign: 'right' }}>{d.project_count?.toLocaleString()}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.avg_risk?.toFixed(1)}/100</td>
                        <td style={{ textAlign: 'right', color: d.high_risk_count > 0 ? 'var(--risk-high)' : 'inherit' }}>
                          {d.high_risk_count}
                        </td>
                        <td style={{ textAlign: 'right', color: d.critical_count > 0 ? 'var(--risk-critical)' : 'inherit', fontWeight: 600 }}>
                          {d.critical_count}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge ${statusClass}`}>
                            {statusText}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDistrictClick(d.district);
                            }}
                          >
                            <IconInspect size={12} />
                            <span>Drilldown</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Granular District Projects Drilldown */}
          {selectedDistrict && (
            <div className="panel" style={{ border: '2px solid var(--gov-navy-800)' }}>
              <div className="panel-header">
                <div>
                  <h3>
                    <IconInspect size={18} color="var(--gov-navy-800)" />
                    <span>Active Works in {selectedDistrict} District</span>
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Showing live works records filtered from district master ledger
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'low' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('low')}
                  >
                    Compliant
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'high' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('high')}
                  >
                    Escalated
                  </button>
                  <button
                    type="button"
                    className={`btn ${riskFilter === 'critical' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setRiskFilter('critical')}
                  >
                    Critical
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedDistrict(null)}
                    style={{ marginLeft: 6 }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {loadingProjects ? (
                <div className="loading-container">
                  <div className="spinner" />
                  <span>Fetching works in {selectedDistrict}…</span>
                </div>
              ) : filteredDistrictProjects.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No works found matching the selected filter in {selectedDistrict}.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: 380 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>Work Description</th>
                        <th>Implementing Agency</th>
                        <th style={{ textAlign: 'right' }}>Sanctioned (₹)</th>
                        <th style={{ textAlign: 'center' }}>Progress</th>
                        <th style={{ textAlign: 'center' }}>Anomaly Score</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDistrictProjects.map((p, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedProject(p)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ fontWeight: 700, color: 'var(--gov-navy-800)' }}>
                            {p.project_id}
                          </td>
                          <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{p.work_description}</td>
                          <td>{p.contractor}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLakh(p.amount_sanctioned)}</td>
                          <td style={{ textAlign: 'center' }}>{p.progress_percentage}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`status-badge ${
                                p.risk_score >= 80
                                  ? 'critical-alert'
                                  : p.risk_score >= 60
                                  ? 'high-risk'
                                  : p.risk_score >= 40
                                  ? 'under-review'
                                  : 'approved'
                              }`}
                            >
                              {p.risk_score?.toFixed(0)}/100
                            </span>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Interactive Geospatial Map */}
          <RealTimeDistrictMap stateName={selectedState} />

          {/* Interactive AI Contractor Network Graph */}
          <ContractorNetworkGraph stateName={selectedState} />
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
