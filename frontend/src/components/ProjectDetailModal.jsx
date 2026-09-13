import React, { useState, useEffect } from 'react';
import { fetchProjectDetails, formatCrore, formatLakh, getRiskColor } from '../api/client';

export default function ProjectDetailModal({ project, projectId, onClose }) {
  const effectiveId = (project?.project_id || projectId || '').trim();
  const [data, setData] = useState(project || null);
  const [loading, setLoading] = useState(!project && !!effectiveId);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!effectiveId) return;
    let isMounted = true;

    if (project) {
      setData(project);
      setEnriching(true);
    } else {
      setData(null);
      setLoading(true);
    }
    setError('');

    fetchProjectDetails(effectiveId)
      .then((res) => {
        if (!isMounted) return;
        if (res && typeof res === 'object' && res.project_id) {
          setData((prev) => ({
            ...(prev || {}),
            ...res,
            // Guard against nullifying valid numeric values
            amount_sanctioned: res.amount_sanctioned != null ? res.amount_sanctioned : (prev?.amount_sanctioned || 0),
            amount_spent: res.amount_spent != null ? res.amount_spent : (prev?.amount_spent || 0),
            risk_score: res.risk_score != null ? res.risk_score : (prev?.risk_score || 0),
            progress_percentage: res.progress_percentage != null ? res.progress_percentage : (prev?.progress_percentage || 0),
          }));
        } else if (!project) {
          setError(`No records found for Project ID: ${effectiveId}`);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (!project) {
          setError(err.message || 'Failed to load project details');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setEnriching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveId, project]);

  if (!effectiveId) return null;

  const rawRiskScore = data?.risk_score ?? data?.ensemble_risk_score ?? 0;
  const riskScore = typeof rawRiskScore === 'number' ? Math.round(rawRiskScore) : Number(rawRiskScore || 0);
  const riskCategory = (data?.risk_category || (riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low')).toLowerCase();
  const riskColor = getRiskColor(riskCategory);

  const sanctioned = Number(data?.amount_sanctioned || 0);
  const spent = Number(data?.amount_spent || 0);
  const progress = Number(data?.progress_percentage || 0);
  const overrunPct = sanctioned > 0 ? (((spent - sanctioned) / sanctioned) * 100).toFixed(1) : '0.0';
  const utilization = sanctioned > 0 ? ((spent / sanctioned) * 100).toFixed(1) : '0.0';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card alert-detail-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>
                {data?.project_id || projectId}
              </h3>
              <span className={`risk-badge ${riskCategory}`} style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
                {riskCategory.toUpperCase()} RISK • {riskScore}/100
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
              📍 {data?.district || 'District'}, {data?.state || 'State'} {data?.constituency && `• ${data.constituency}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: 200 }}>
            <div className="spinner"></div> Loading comprehensive project profile...
          </div>
        ) : error ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: 30, color: 'var(--risk-critical)' }}>
            ⚠️ {error}
          </div>
        ) : data ? (
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {/* Work Description Banner */}
            <div className="panel" style={{ padding: 14, marginBottom: 16, borderLeft: `3px solid ${riskColor}` }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                Work Scope & Description
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500 }}>
                {data.work_description || 'Public development works authorized under MPLADS.'}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>🏷️ <strong>Category:</strong> {data.category || 'General Infrastructure'}</span>
                {data.house && <span>🏛️ <strong>House:</strong> {data.house}</span>}
                {data.mp_name && <span>👤 <strong>MP:</strong> {data.mp_name}</span>}
              </div>
            </div>

            {/* Financial & Physical Metrics Grid */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              <div className="stat-card" style={{ padding: 12 }}>
                <div className="stat-label" style={{ fontSize: '0.72rem' }}>Sanctioned</div>
                <div className="stat-value" style={{ fontSize: '1.15rem' }}>{formatLakh(sanctioned)}</div>
                <div className="stat-sub">₹{sanctioned.toLocaleString()}</div>
              </div>

              <div className="stat-card" style={{ padding: 12 }}>
                <div className="stat-label" style={{ fontSize: '0.72rem' }}>Spent</div>
                <div className="stat-value" style={{ fontSize: '1.15rem', color: spent > sanctioned ? 'var(--risk-critical)' : 'var(--text-heading)' }}>
                  {formatLakh(spent)}
                </div>
                <div className="stat-sub">{utilization}% utilized</div>
              </div>

              <div className="stat-card" style={{ padding: 12 }}>
                <div className="stat-label" style={{ fontSize: '0.72rem' }}>Physical Progress</div>
                <div className="stat-value" style={{ fontSize: '1.15rem', color: progress >= 90 ? 'var(--risk-low)' : 'var(--accent-primary)' }}>
                  {progress.toFixed(0)}%
                </div>
                <div className="stat-sub">Milestone status</div>
              </div>

              <div className="stat-card" style={{ padding: 12, borderLeft: `3px solid ${Number(overrunPct) > 0 ? 'var(--risk-high)' : 'var(--risk-low)'}` }}>
                <div className="stat-label" style={{ fontSize: '0.72rem' }}>Cost Variance</div>
                <div className="stat-value" style={{ fontSize: '1.15rem', color: Number(overrunPct) > 0 ? 'var(--risk-high)' : 'var(--risk-low)' }}>
                  {Number(overrunPct) > 0 ? `+${overrunPct}%` : `${overrunPct}%`}
                </div>
                <div className="stat-sub">{Number(overrunPct) > 0 ? 'Budget overrun' : 'Within budget'}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4, color: 'var(--text-secondary)' }}>
                <span>Physical Execution Completion</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{progress}%</span>
              </div>
              <div className="progress-bar-container" style={{ height: 8 }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: progress >= 95 ? 'var(--risk-low)' : progress >= 50 ? 'var(--accent-primary)' : 'var(--risk-medium)'
                  }}
                />
              </div>
            </div>

            {/* Execution & Contractor Details */}
            <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
              <div className="panel-header" style={{ marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Contractor & Implementation Details</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Contractor:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    🏗️ {data.contractor || 'State Designated Agency'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Implementing District:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    📍 {data.district} Planning Office
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Approval Date:</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                    📅 {data.approval_date ? String(data.approval_date).slice(0, 10) : 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Completion:</span>
                  <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                    🏁 {data.completion_date ? String(data.completion_date).slice(0, 10) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Diagnostics & Explainability */}
            <div className="panel" style={{ padding: 16, marginBottom: 14, border: '1px solid var(--border-card)', background: 'var(--bg-card)' }}>
              <div className="panel-header" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🤖</span> AI Diagnostic Signals & Explainable Risk Factors (XAI)
                </h4>
                <span style={{ fontSize: '0.74rem', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  Ensemble ML & Spatial Analysis
                </span>
              </div>

              {/* 1. Deep Forensic Duplicate Work Dossier (if flagged) */}
              {((data.geo_duplicate_flag && Number(data.geo_duplicate_flag) === 1) || data.geo_duplicate_detected || data.geo_duplicate_details?.geo_duplicate_detected || (data.explanations && data.explanations.toLowerCase().includes('duplicate'))) && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '14px 16px',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.4rem' }}>🌐</span>
                      <strong style={{ color: '#f87171', fontSize: '0.92rem' }}>
                        {data.geo_duplicate_details?.geo_duplicate_type === 'same_district'
                          ? 'Same-District Duplicate Work Flagged'
                          : 'Cross-District Duplicate Work Flagged'}
                      </strong>
                    </div>
                    {data.geo_duplicate_details?.distance_to_duplicate_km != null && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                        📍 {data.geo_duplicate_details.distance_to_duplicate_km} km distance
                      </span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 12, lineHeight: 1.4 }}>
                    {data.geo_duplicate_details?.explanation || (
                      data.geo_duplicate_flag || (data.explanations && data.explanations.toLowerCase().includes('cross-boundary'))
                        ? 'Physical proximity analysis indicates a near-identical work sanctioned across administrative borders within ~15-40 km.'
                        : 'Matching category and financial sanction recorded in district project registry.'
                    )}
                  </div>

                  {/* Forensic Comparison Card */}
                  {data.geo_duplicate_details?.matched_project_id && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 6, padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
                        Forensic Evidence Comparison
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.8rem' }}>
                        {/* Current Project Side */}
                        <div style={{ padding: '8px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.74rem', marginBottom: 4 }}>CURRENT PROJECT</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{data.project_id}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>📍 {data.district}, {data.state}</div>
                          <div style={{ marginTop: 4, fontWeight: 600 }}>₹{Number(data.amount_sanctioned || 0).toLocaleString()}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: 2 }}>🏗️ {data.contractor || 'Designated Agency'}</div>
                        </div>

                        {/* Matched Sibling Project Side */}
                        <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.74rem', marginBottom: 4 }}>MATCHED SIBLING WORK</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{data.geo_duplicate_details.matched_project_id}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>📍 {data.geo_duplicate_details.matched_location}</div>
                          <div style={{ marginTop: 4, fontWeight: 600 }}>₹{Number(data.geo_duplicate_details.matched_amount || 0).toLocaleString()}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: 2 }}>🏗️ {data.geo_duplicate_details.matched_contractor || 'Sibling Vendor'}</div>
                        </div>
                      </div>

                      {/* Variance & Cartel Indicators */}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {data.geo_duplicate_details.budget_variance_pct != null && (
                          <span>💰 <strong>Budget Variance:</strong> {data.geo_duplicate_details.budget_variance_pct}%</span>
                        )}
                        <span>🏢 <strong>Vendor Match:</strong> {data.geo_duplicate_details.same_contractor ? '⚠️ Same contractor across administrative border' : 'Different contractors at duplicate GPS proximity'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Model Consensus Matrix */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Anomaly Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--chart-1)', marginTop: 2 }}>
                    {data.anomaly_score !== undefined ? Number(data.anomaly_score).toFixed(3) : '0.460'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Isolation Forest</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fraud Probability</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: Number(data.fraud_probability) >= 0.5 ? 'var(--risk-critical)' : 'var(--text-primary)', marginTop: 2 }}>
                    {data.fraud_probability !== undefined ? `${(Number(data.fraud_probability) * 100).toFixed(1)}%` : '0.0%'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>GBDT Classifier</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Schedule Status</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: Number(data.days_behind_schedule) > 30 ? 'var(--risk-high)' : 'var(--risk-low)', marginTop: 2 }}>
                    {data.days_behind_schedule ? `${data.days_behind_schedule}d delay` : 'Nominal'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Timeline Regressor</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Band</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: riskColor, marginTop: 2 }}>
                    {riskCategory.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Composite {riskScore}/100</div>
                </div>
              </div>

              {/* 3. SHAP-style Explainable AI Feature Contribution Waterfall */}
              {data.xai_breakdown && (
                <div style={{ background: 'var(--bg-input)', borderRadius: 6, padding: 12, marginBottom: 14, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>XAI Feature Contribution Breakdown (Risk Attribution)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Score Impact</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.xai_breakdown.primary_risk_drivers?.map((driver, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#f87171' }}>⚠️ {driver.feature}</span>
                          <span style={{ fontWeight: 700, color: '#f87171' }}>{driver.impact}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{driver.evidence}</div>
                        <div className="progress-bar-container" style={{ height: 4, marginTop: 3 }}>
                          <div className="progress-bar-fill" style={{ width: `${Math.min(driver.score * 2.5, 100)}%`, background: '#ef4444' }}></div>
                        </div>
                      </div>
                    ))}
                    {data.xai_breakdown.mitigating_factors?.map((mit, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#34d399' }}>✅ {mit.feature}</span>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>{mit.impact}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{mit.evidence}</div>
                        <div className="progress-bar-container" style={{ height: 4, marginTop: 3 }}>
                          <div className="progress-bar-fill" style={{ width: `${Math.min(Math.abs(mit.score) * 2.5, 100)}%`, background: '#10b981' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Diagnostic Finding Summary */}
              {data.explanations && (
                <div className="explanation-card" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                  <strong>Diagnostic Finding:</strong> {data.explanations}
                </div>
              )}

              {/* 5. Decisive Vigilance Action Playbook */}
              {data.recommended_action && (
                <div style={{
                  padding: '12px 14px',
                  background: (Number(data.fraud_probability) >= 0.6 || riskScore >= 75 || data.geo_duplicate_flag == 1) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                  border: `1px solid ${(Number(data.fraud_probability) >= 0.6 || riskScore >= 75 || data.geo_duplicate_flag == 1) ? '#ef4444' : 'rgba(59, 130, 246, 0.2)'}`,
                  borderRadius: 8,
                  fontSize: '0.84rem'
                }}>
                  <div style={{ color: (Number(data.fraud_probability) >= 0.6 || riskScore >= 75 || data.geo_duplicate_flag == 1) ? '#f87171' : 'var(--accent-hover)', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💡</span> Recommended Vigilance Action & Next Steps:
                  </div>
                  <div style={{ color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {data.recommended_action}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-card)' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
