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
import {
  IconMP,
  IconSearch,
  IconFilter,
  IconInspect,
  IconShieldCheck,
  IconCheckCircle,
  IconAlertTriangle,
  IconAlertOctagon
} from './common/GovIcons';

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
    fetchMPDashboard(stateToUse, selectedMPName, 1, 1500).then((data) => {
      setMpData(data);
      setLoading(false);
    });
  }, [selectedMPName, mpList]);

  const projects = mpData?.projects || [];

  // Filter projects by risk category
  const filteredProjects = projects.filter((p) => {
    const pScore = p.risk_score || 0;
    const pRiskCat = (
      p.risk_category ||
      (pScore >= 80 ? 'critical' : pScore >= 60 ? 'high' : pScore >= 40 ? 'medium' : 'low')
    ).toLowerCase();
    const matchesCategory = categoryFilter === 'all' || pRiskCat === categoryFilter;
    const matchesSearch =
      !searchTerm ||
      p.project_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.work_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contractor?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const riskCounts =
    mpData?.risk_breakdown ||
    projects.reduce(
      (acc, p) => {
        const pScore = p.risk_score || 0;
        const cat = (
          p.risk_category ||
          (pScore >= 80 ? 'critical' : pScore >= 60 ? 'high' : pScore >= 40 ? 'medium' : 'low')
        ).toLowerCase();
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      { all: mpData?.total_projects || projects.length, low: 0, medium: 0, high: 0, critical: 0 }
    );

  return (
    <div>
      {/* Institutional Header */}
      <div className="page-header">
        <h2>
          <IconMP size={24} color="var(--gov-navy-800)" />
          <span>Member of Parliament (MP) Constituency Portfolio</span>
        </h2>
        <p>
          Real-time oversight of parliamentary fund allocations, recommended constituency works, and physical progress monitoring
        </p>
      </div>

      {/* MP Selector & Filter Bar */}
      <div className="filter-bar">
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
            STATE SELECTION
          </label>
          <select
            className="form-control"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="">All States &amp; UTs ({states.length})</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
            PARLIAMENTARY REPRESENTATIVE
          </label>
          <select
            className="form-control"
            value={selectedMPName}
            onChange={(e) => setSelectedMPName(e.target.value)}
            disabled={mpList.length === 0}
          >
            {mpList.length === 0 && <option value="">No representatives found</option>}
            {mpList.map((m, i) => (
              <option key={i} value={m.mp_name}>
                {m.mp_name} — {m.constituency || m.state} ({m.project_count} works · avg risk {m.avg_risk_score})
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 240 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
            PORTFOLIO SEARCH
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-control"
              placeholder="Search work ID, district, agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading && !mpData ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Synchronizing MP constituency records…</span>
        </div>
      ) : !mpData ? (
        <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No records identified for the selected representative.
        </div>
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Recommended Works</div>
              <div className="stat-value">{mpData.total_projects}</div>
              <div className="stat-sub">{mpData.mp_name}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sanctioned Outlay</div>
              <div className="stat-value">{formatCrore(mpData.total_sanctioned)}</div>
              <div className="stat-sub">Constituency budget allocation</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expenditure Incurred</div>
              <div className="stat-value">{formatCrore(mpData.total_spent)}</div>
              <div className="stat-sub">
                {mpData.total_sanctioned > 0
                  ? ((mpData.total_spent / mpData.total_sanctioned) * 100).toFixed(1)
                  : 0}
                % fund absorption
              </div>
            </div>
            <div className="stat-card risk-low">
              <div className="stat-label">Execution Rate</div>
              <div className="stat-value" style={{ color: 'var(--risk-low)' }}>
                {mpData.completion_rate}%
              </div>
              <div className="stat-sub">Physically completed works</div>
            </div>
            <div className="stat-card risk-critical">
              <div className="stat-label">Audit Scrutiny Tiers</div>
              <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>
                {mpData.high_risk_projects}
              </div>
              <div className="stat-sub">High &amp; critical anomaly flags</div>
            </div>
          </div>

          {/* Risk Classification Tabs */}
          <div style={{ display: 'flex', gap: 8, margin: '20px 0 14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: 4 }}>
              FILTER BY STATUS:
            </span>
            <button
              type="button"
              className={`btn ${categoryFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setCategoryFilter('all')}
            >
              All Works ({riskCounts.all})
            </button>
            <button
              type="button"
              className={`btn ${categoryFilter === 'low' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={
                categoryFilter === 'low'
                  ? { background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', borderColor: 'var(--status-approved-border)' }
                  : { color: 'var(--status-approved-text)' }
              }
              onClick={() => setCategoryFilter('low')}
            >
              <IconCheckCircle size={13} color="var(--status-approved-text)" />
              <span>Approved / Compliant ({riskCounts.low || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${categoryFilter === 'medium' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={
                categoryFilter === 'medium'
                  ? { background: 'var(--status-review-bg)', color: 'var(--status-review-text)', borderColor: 'var(--status-review-border)' }
                  : { color: 'var(--status-review-text)' }
              }
              onClick={() => setCategoryFilter('medium')}
            >
              <IconShieldCheck size={13} color="var(--status-review-text)" />
              <span>Under Review ({riskCounts.medium || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${categoryFilter === 'high' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={
                categoryFilter === 'high'
                  ? { background: 'var(--status-escalated-bg)', color: 'var(--status-escalated-text)', borderColor: 'var(--status-escalated-border)' }
                  : { color: 'var(--status-escalated-text)' }
              }
              onClick={() => setCategoryFilter('high')}
            >
              <IconAlertTriangle size={13} color="var(--status-escalated-text)" />
              <span>Audit Escalation ({riskCounts.high || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${categoryFilter === 'critical' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={
                categoryFilter === 'critical'
                  ? { background: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }
                  : { color: 'var(--status-critical-text)' }
              }
              onClick={() => setCategoryFilter('critical')}
            >
              <IconAlertOctagon size={13} color="var(--status-critical-text)" />
              <span>Critical Inquiry ({riskCounts.critical || 0})</span>
            </button>
          </div>

          {/* Project List Table */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>
                  <IconInspect size={18} color="var(--gov-navy-800)" />
                  <span>Constituency Works Ledger</span>
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Showing {filteredProjects.length} of {projects.length} recommended development projects
                </p>
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                No records match the applied criteria.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 540 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Project ID</th>
                      <th>Scope of Work</th>
                      <th>Sector</th>
                      <th>District</th>
                      <th style={{ textAlign: 'right' }}>Sanctioned (₹)</th>
                      <th style={{ textAlign: 'right' }}>Disbursed (₹)</th>
                      <th style={{ textAlign: 'center', width: 90 }}>Progress</th>
                      <th style={{ width: 140 }}>Audit Status</th>
                      <th style={{ textAlign: 'center', width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p, i) => {
                      const score = p.risk_score || 0;
                      const statusClass =
                        score >= 80
                          ? 'critical-alert'
                          : score >= 60
                          ? 'high-risk'
                          : score >= 40
                          ? 'under-review'
                          : 'approved';
                      const statusText =
                        score >= 80
                          ? 'Critical'
                          : score >= 60
                          ? 'Escalated'
                          : score >= 40
                          ? 'Under Review'
                          : 'Compliant';

                      return (
                        <tr
                          key={i}
                          onClick={() => setSelectedProject(p)}
                          style={{ cursor: 'pointer' }}
                          title="Click to view comprehensive project ledger"
                        >
                          <td style={{ fontWeight: 700, color: 'var(--gov-navy-800)' }}>
                            {p.project_id}
                          </td>
                          <td style={{ maxWidth: 260, whiteSpace: 'normal', color: 'var(--text-primary)' }}>
                            {p.work_description}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              {p.category}
                            </span>
                          </td>
                          <td>{p.district}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatLakh(p.amount_sanctioned)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {formatLakh(p.amount_spent)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                                {p.progress_percentage ?? 0}%
                              </span>
                              <div
                                style={{
                                  width: 48,
                                  height: 4,
                                  background: '#E2E8F0',
                                  borderRadius: 2,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(p.progress_percentage ?? 0, 100)}%`,
                                    height: '100%',
                                    background: 'var(--gov-navy-800)',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${statusClass}`}>
                              {statusText} · {score.toFixed(0)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProject(p);
                              }}
                            >
                              <IconInspect size={12} />
                              <span>View</span>
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
