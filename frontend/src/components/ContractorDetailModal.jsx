import React, { useState, useEffect } from 'react';
import { fetchContractorDetail, formatCrore, formatLakh, getRiskColor } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';

export default function ContractorDetailModal({ contractorName, state = '', onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => {
    if (!contractorName) return;
    setLoading(true);
    setError('');

    fetchContractorDetail(contractorName, state)
      .then((res) => {
        if (res && res.contractor_name) {
          setData(res);
        } else {
          setError(`No data found for contractor: ${contractorName}`);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch contractor dossier.');
      })
      .finally(() => setLoading(false));
  }, [contractorName, state]);

  if (!contractorName) return null;

  const riskCat = (data?.risk_category || 'low').toLowerCase();
  const riskColor = getRiskColor(riskCat);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.15rem' }}>
                {data?.contractor_name || contractorName}
              </h3>
              {data && (
                <span className={`risk-badge ${riskCat}`} style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
                  {riskCat.toUpperCase()} RISK • {data.avg_risk_score}/100
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
              Contractor Enterprise Dossier &amp; Network Integrity Profile
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Content Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          {loading ? (
            <div className="loading-container" style={{ minHeight: 250 }}>
              <div className="spinner"></div> Synthesizing vendor intelligence profile...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--risk-critical)' }}>
              {error}
            </div>
          ) : data ? (
            <>
              {/* Concurrency / Cartel Alert Banner */}
              {data.concurrency_flag && (
                <div style={{
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid var(--border-danger)',
                  borderRadius: 4,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div>
                    <div style={{ color: 'var(--risk-critical)', fontWeight: 700, fontSize: '0.86rem' }}>
                      Cross-District Concurrency &amp; Vendor Concentration Alert
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>
                      This vendor is executing works simultaneously across {data.districts_count} administrative districts with {data.active_projects} active project commitments. High exposure to execution delays and resource reallocation.
                    </div>
                  </div>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Projects</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{data.total_projects}</div>
                  <div className="stat-sub">{data.completed_projects} completed</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Sanctioned Value</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatCrore(data.total_sanctioned)}</div>
                  <div className="stat-sub">Central outlay</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Spent</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: data.total_spent > data.total_sanctioned ? 'var(--risk-high)' : 'var(--text-heading)' }}>
                    {formatCrore(data.total_spent)}
                  </div>
                  <div className="stat-sub">{data.cost_overrun_pct > 0 ? `+${data.cost_overrun_pct}% overrun` : 'Within budget'}</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Risk Score</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: riskColor }}>{data.avg_risk_score}</div>
                  <div className="stat-sub">{data.critical_projects} critical flags</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Operating Footprint</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{data.districts_count}</div>
                  <div className="stat-sub">Districts mapped</div>
                </div>
              </div>

              {/* Operating Districts Breakdown */}
              {data.operating_districts && data.operating_districts.length > 0 && (
                <div className="panel" style={{ padding: 14, marginBottom: 18 }}>
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Operating Districts &amp; Regional Footprint</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.operating_districts.length} active jurisdictions</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {data.operating_districts.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.8rem'
                        }}
                      >
                        <strong style={{ color: 'var(--text-primary)' }}>{d.district}</strong>
                        {d.state && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({d.state})</span>}
                        <span className="risk-badge low" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {d.project_count} proj
                        </span>
                        <span style={{ color: d.avg_risk_score >= 60 ? 'var(--risk-high)' : 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600 }}>
                          Risk {d.avg_risk_score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Portfolio Table */}
              <div className="panel" style={{ padding: 14 }}>
                <div className="panel-header" style={{ marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Managed Projects Portfolio</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any row to inspect deep diagnostic findings</span>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>Work Scope</th>
                        <th>District</th>
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
                            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.work_description}>
                              {p.work_description || 'Public works infrastructure'}
                            </td>
                            <td>{p.district}</td>
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
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-card)' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close Dossier
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
