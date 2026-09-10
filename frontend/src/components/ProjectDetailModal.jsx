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
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
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
            <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
              <div className="panel-header" style={{ marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem' }}>🤖 AI Diagnostic Signals & Risk Factors</h4>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Anomaly Score</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--chart-1)' }}>
                    {data.anomaly_score !== undefined ? Number(data.anomaly_score).toFixed(3) : 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fraud Probability</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: Number(data.fraud_probability) > 0.4 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                    {data.fraud_probability !== undefined ? `${(Number(data.fraud_probability) * 100).toFixed(1)}%` : '0.0%'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Schedule Delay</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: Number(data.days_behind_schedule) > 30 ? 'var(--risk-high)' : 'var(--text-primary)' }}>
                    {data.days_behind_schedule ? `${data.days_behind_schedule} days` : 'On track'}
                  </div>
                </div>
              </div>

              {data.explanations && (
                <div className="explanation-card" style={{ marginBottom: 8, fontSize: '0.86rem' }}>
                  <strong>Diagnostic Finding:</strong> {data.explanations}
                </div>
              )}

              {data.recommended_action && (
                <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 6, fontSize: '0.84rem' }}>
                  <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>💡 Recommended Action: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{data.recommended_action}</span>
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
