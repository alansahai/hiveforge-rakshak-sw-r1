import React, { useState, useEffect } from 'react';
import {
  fetchMPList,
  fetchMPDashboard,
  fetchStatesAndDistricts,
  formatCrore,
  formatLakh,
  getRiskColor
} from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';

export default function MPDashboard() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [mpList, setMpList] = useState([]);
  const [selectedMPName, setSelectedMPName] = useState('');
  const [mpData, setMpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Load states on mount
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      const stateNames = Object.keys(map).sort();
      setStates(stateNames);
    });
  }, []);

  // 2. Load MPs when state changes (or all)
  useEffect(() => {
    setLoading(true);
    fetchMPList(selectedState || null).then((mps) => {
      setMpList(mps);
      if (mps && mps.length > 0) {
        // Keep current selected if valid in new state, else pick first
        const exists = mps.some((m) => m.mp_name === selectedMPName);
        if (!exists) {
          setSelectedMPName(mps[0].mp_name);
        }
      } else {
        setSelectedMPName('');
        setMpData(null);
      }
      setLoading(false);
    });
  }, [selectedState]);

  // 3. Load MP Dashboard data when selected MP changes
  useEffect(() => {
    if (!selectedMPName) return;
    const mpObj = mpList.find((m) => m.mp_name === selectedMPName);
    const stateToUse = mpObj?.state || selectedState || 'Karnataka';

    setLoading(true);
    fetchMPDashboard(stateToUse, selectedMPName, 1, 100).then((data) => {
      setMpData(data);
      setLoading(false);
    });
  }, [selectedMPName, mpList]);

  const projects = mpData?.projects || [];

  // Filter projects by risk category
  const filteredProjects = projects.filter((p) => {
    const pRiskCat = (p.risk_category || (p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low')).toLowerCase();
    const matchesCategory = categoryFilter === 'all' || pRiskCat === categoryFilter;
    const matchesSearch =
      !searchTerm ||
      p.project_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.work_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contractor?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate counts for risk filter pills
  const riskCounts = projects.reduce(
    (acc, p) => {
      const cat = (p.risk_category || (p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low')).toLowerCase();
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    { all: projects.length, low: 0, medium: 0, high: 0, critical: 0 }
  );

  return (
    <div>
      <div className="page-header">
        <h2>🏛️ Member of Parliament (MP) Dashboard</h2>
        <p>Real-time oversight of MP constituency development allocations, project status, and AI anomaly detection</p>
      </div>

      {/* MP Selector & Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>FILTER BY STATE</label>
          <select
            className="form-control"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="">All States ({states.length})</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>SELECT MEMBER OF PARLIAMENT (MP)</label>
          <select
            className="form-control"
            value={selectedMPName}
            onChange={(e) => setSelectedMPName(e.target.value)}
            disabled={mpList.length === 0}
          >
            {mpList.length === 0 && <option value="">No MPs found for state</option>}
            {mpList.map((m, i) => (
              <option key={i} value={m.mp_name}>
                {m.mp_name} — {m.constituency || m.state} ({m.project_count} projects • avg risk {m.avg_risk_score})
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 220 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>SEARCH IN PORTFOLIO</label>
          <input
            className="form-control"
            placeholder="Search project ID, district, work..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && !mpData ? (
        <div className="loading-container"><div className="spinner"></div> Loading MP constituency data...</div>
      ) : !mpData ? (
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>No data found for the selected MP.</div>
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Total Projects</div>
              <div className="stat-value">{mpData.total_projects}</div>
              <div className="stat-sub">{mpData.mp_name}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sanctioned Funds</div>
              <div className="stat-value">{formatCrore(mpData.total_sanctioned)}</div>
              <div className="stat-sub">MPLADS allocation</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Spent</div>
              <div className="stat-value">{formatCrore(mpData.total_spent)}</div>
              <div className="stat-sub">
                {mpData.total_sanctioned > 0 ? ((mpData.total_spent / mpData.total_sanctioned) * 100).toFixed(1) : 0}% utilization
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--risk-low)' }}>
              <div className="stat-label">Completion Rate</div>
              <div className="stat-value" style={{ color: 'var(--risk-low)' }}>{mpData.completion_rate}%</div>
              <div className="stat-sub">Projects completed</div>
            </div>
            <div className="stat-card risk-critical">
              <div className="stat-label">High / Critical Risk</div>
              <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>{mpData.high_risk_projects}</div>
              <div className="stat-sub">Requires verification</div>
            </div>
          </div>

          {/* Risk Category Filters */}
          <div style={{ display: 'flex', gap: 8, margin: '20px 0 14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 4 }}>Filter Risk:</span>
            <button
              className={`btn ${categoryFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setCategoryFilter('all')}
            >
              All Projects ({riskCounts.all})
            </button>
            <button
              className={`btn ${categoryFilter === 'low' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={categoryFilter === 'low' ? { background: 'var(--risk-low)', borderColor: 'var(--risk-low)' } : { color: 'var(--risk-low)' }}
              onClick={() => setCategoryFilter('low')}
            >
              🟢 Safe / Low ({riskCounts.low || 0})
            </button>
            <button
              className={`btn ${categoryFilter === 'medium' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={categoryFilter === 'medium' ? { background: 'var(--risk-medium)', borderColor: 'var(--risk-medium)' } : { color: 'var(--risk-medium)' }}
              onClick={() => setCategoryFilter('medium')}
            >
              🟡 Medium ({riskCounts.medium || 0})
            </button>
            <button
              className={`btn ${categoryFilter === 'high' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={categoryFilter === 'high' ? { background: 'var(--risk-high)', borderColor: 'var(--risk-high)' } : { color: 'var(--risk-high)' }}
              onClick={() => setCategoryFilter('high')}
            >
              🟠 High ({riskCounts.high || 0})
            </button>
            <button
              className={`btn ${categoryFilter === 'critical' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={categoryFilter === 'critical' ? { background: 'var(--risk-critical)', borderColor: 'var(--risk-critical)' } : { color: 'var(--risk-critical)' }}
              onClick={() => setCategoryFilter('critical')}
            >
              🔴 Critical ({riskCounts.critical || 0})
            </button>
          </div>

          {/* Project List Table */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 style={{ display: 'inline-block', marginRight: 10 }}>📋 Constituency Project Portfolio</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {filteredProjects.length} of {projects.length} projects • Click any row or project ID to view full details
                </span>
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                No projects match the selected filter.
              </div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>Work Scope</th>
                      <th>Category</th>
                      <th>District</th>
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
                          title="Click to view detailed project profile"
                        >
                          <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {p.project_id}
                          </td>
                          <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: '0.82rem' }}>
                            {p.work_description || 'Public work'}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.category}</span>
                          </td>
                          <td>{p.district}</td>
                          <td>{formatLakh(p.amount_sanctioned)}</td>
                          <td>{formatLakh(p.amount_spent)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div className="progress-bar-container" style={{ width: 50, height: 6 }}>
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
                          <td style={{ maxWidth: 140, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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
                              View Details 🔍
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

      {/* Project Details Modal */}
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
