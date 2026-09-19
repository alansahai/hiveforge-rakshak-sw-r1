import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDistrictDashboard, formatCrore, formatLakh, getRiskColor } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';
import RealTimeDistrictMap from './RealTimeDistrictMap';

export default function DistrictDetailModal({ districtName, stateName = '', onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [modalTab, setModalTab] = useState('map'); // 'map' | 'table' | 'contractors'
  const navigate = useNavigate();

  useEffect(() => {
    if (!districtName) return;
    setLoading(true);
    setError('');

    fetchDistrictDashboard(stateName || 'All', districtName)
      .then((res) => {
        if (res && res.district) {
          setData(res);
        } else {
          setError(`No data found for district: ${districtName}`);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch district intelligence.');
      })
      .finally(() => setLoading(false));
  }, [districtName, stateName]);

  if (!districtName) return null;

  const riskCat = (data?.risk_category || 'low').toLowerCase();
  const riskColor = getRiskColor(riskCat);

  const handleNavigateToDistrictAuthority = () => {
    onClose();
    const effectiveState = data?.state || stateName || '';
    navigate(`/district?state=${encodeURIComponent(effectiveState)}&district=${encodeURIComponent(districtName)}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 850, width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.15rem' }}>
                {data?.district || districtName} District Project Hub
              </h3>
              {data && (
                <span className={`risk-badge ${riskCat}`} style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
                  {riskCat.toUpperCase()} RISK • {data.avg_risk_score}/100
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
              Jurisdictional Oversight • {data?.state || stateName || 'State'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          {loading ? (
            <div className="loading-container" style={{ minHeight: 250 }}>
              <div className="spinner"></div> Synthesizing district project registry...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--risk-critical)' }}>
              {error}
            </div>
          ) : data ? (
            <>
              {/* Top Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 4, marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Detailed administrative view for District Planning &amp; Implementing Agencies
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.78rem' }}
                  onClick={handleNavigateToDistrictAuthority}
                >
                  Open Full District Authority Dashboard →
                </button>
              </div>

              {/* KPI Cards Grid */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Projects</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{data.total_projects}</div>
                  <div className="stat-sub">{data.completed_count || 0} completed</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Sanctioned</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatCrore(data.budget_burndown?.allocated || 0)}</div>
                  <div className="stat-sub">Central allocation</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Spent</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: (data.budget_burndown?.spent || 0) > (data.budget_burndown?.allocated || 0) ? 'var(--risk-high)' : 'var(--text-heading)' }}>
                    {formatCrore(data.budget_burndown?.spent || 0)}
                  </div>
                  <div className="stat-sub">{data.cost_overrun_pct > 0 ? `+${data.cost_overrun_pct}% overrun` : 'Within budget'}</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Risk Score</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: riskColor }}>{data.avg_risk_score}</div>
                  <div className="stat-sub">{data.critical_count || 0} critical alerts</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Completion Rate</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--risk-low)' }}>{data.completion_rate || 0}%</div>
                  <div className="stat-sub">Milestone execution</div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <button
                  onClick={() => setModalTab('map')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: modalTab === 'map' ? 'var(--accent-primary)' : 'var(--bg-input)',
                    border: `1px solid ${modalTab === 'map' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    color: modalTab === 'map' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Live Geospatial Map
                </button>
                <button
                  onClick={() => setModalTab('table')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: modalTab === 'table' ? 'var(--accent-primary)' : 'var(--bg-input)',
                    border: `1px solid ${modalTab === 'table' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    color: modalTab === 'table' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Projects Registry ({data.projects?.length || 0})
                </button>
                <button
                  onClick={() => setModalTab('contractors')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: modalTab === 'contractors' ? 'var(--accent-primary)' : 'var(--bg-input)',
                    border: `1px solid ${modalTab === 'contractors' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    color: modalTab === 'contractors' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Active Contractors ({data.contractor_performance?.length || 0})
                </button>
              </div>

              {/* Tab 1: Live Real-Time Geospatial Map */}
              {modalTab === 'map' && (
                <div style={{ marginBottom: 16 }}>
                  <RealTimeDistrictMap
                    districtName={data.district || districtName}
                    stateName={data.state || stateName}
                    districtCoordinates={data.coordinates}
                    projects={data.projects || []}
                    height="380px"
                    onSelectProject={(p) => setSelectedProjectId(p.project_id)}
                  />
                </div>
              )}

              {/* Tab 2: Active Contractors */}
              {modalTab === 'contractors' && data.contractor_performance && data.contractor_performance.length > 0 && (
                <div className="panel" style={{ padding: 14, marginBottom: 18 }}>
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Key Contractors Active in {data.district}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top vendor allocation</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                    {data.contractor_performance.slice(0, 6).map((c, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.contractor}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatLakh(c.total_sanctioned)} sanctioned</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="risk-badge low" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            {c.project_count} proj
                          </span>
                          <div style={{ color: c.avg_risk_score >= 60 ? 'var(--risk-high)' : 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600, marginTop: 2 }}>
                            Risk {c.avg_risk_score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: District Projects Table */}
              {modalTab === 'table' && (
                <div className="panel" style={{ padding: 14 }}>
                <div className="panel-header" style={{ marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Monitored Public Works in {data.district}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any row to inspect deep diagnostic findings</span>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>Work Scope</th>
                        <th>Contractor</th>
                        <th>Sanctioned</th>
                        <th>Spent</th>
                        <th>Progress</th>
                        <th>Risk Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects && data.projects.length > 0 ? (
                        data.projects.map((p, i) => (
                          <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectId(p.project_id)}>
                            <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{p.project_id}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.work_description}>
                              {p.work_description || 'Public works infrastructure'}
                            </td>
                            <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.contractor}
                            </td>
                            <td>{formatLakh(p.amount_sanctioned)}</td>
                            <td>{formatLakh(p.amount_spent)}</td>
                            <td>
                              <span style={{ fontWeight: 600, color: p.progress_percentage >= 90 ? 'var(--risk-low)' : 'var(--text-primary)' }}>
                                {p.progress_percentage}%
                              </span>
                            </td>
                            <td>
                              <span className={`risk-badge ${p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low'}`} style={{ fontSize: '0.72rem' }}>
                                {p.risk_score}/100
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProjectId(p.project_id);
                                }}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No individual project records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleNavigateToDistrictAuthority}
          >
            Go to Full District Authority Page
          </button>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Nested Project Inspection Modal */}
      {selectedProjectId && (
        <ProjectDetailModal
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  );
}
