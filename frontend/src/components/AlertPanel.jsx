import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchLifecycleAlerts,
  acknowledgeAlert,
  investigateAlert,
  resolveAlert,
  fetchAlertRecommendations,
  fetchStatesAndDistricts,
  sendTestEmail,
  getCurrentUser,
  getCurrentRole,
} from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';

const STATUS_META = {
  open:          { label: 'Open',          emoji: '🔴', color: 'var(--risk-critical)' },
  acknowledged:  { label: 'Acknowledged',  emoji: '🟡', color: 'var(--risk-medium)' },
  investigating: { label: 'Investigating', emoji: '🔵', color: '#60a5fa' },
  resolved:      { label: 'Resolved',      emoji: '🟢', color: 'var(--risk-low)' },
};

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ alert, action, onClose, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getCurrentUser();
  const actor = user?.username || 'system_user';

  const ACTION_LABELS = {
    acknowledge: { title: 'Acknowledge Alert', verb: 'Acknowledge', notesLabel: 'Notes (optional)', notesRequired: false },
    investigate: { title: 'Start Investigation', verb: 'Start Investigation', notesLabel: 'Investigation plan / initial findings', notesRequired: false },
    resolve:     { title: 'Resolve Alert', verb: 'Mark Resolved', notesLabel: 'Resolution notes (required — what was found and done?)', notesRequired: true },
  };
  const meta = ACTION_LABELS[action];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (meta.notesRequired && !notes.trim()) {
      setError('Resolution notes are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let result;
      if (action === 'acknowledge') result = await acknowledgeAlert(alert.alert_id, actor, notes);
      else if (action === 'investigate') result = await investigateAlert(alert.alert_id, actor, notes);
      else if (action === 'resolve') result = await resolveAlert(alert.alert_id, actor, notes);
      onSuccess(result?.alert || { ...alert, status: action === 'resolve' ? 'resolved' : action === 'investigate' ? 'investigating' : 'acknowledged' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{meta.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            Alert: <strong style={{ color: 'var(--text)' }}>{alert.alert_id}</strong> · Project: <strong style={{ color: 'var(--text)' }}>{alert.project_id}</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            Acting as: <strong style={{ color: 'var(--accent)' }}>{actor}</strong>
          </p>
          {error && <div className="login-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{meta.notesLabel}</label>
              <textarea
                className="form-control"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter your notes here…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? 'Submitting…' : meta.verb}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Recommendations Panel ─────────────────────────────────────────────────────
function RecommendationsPanel({ alertId, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertRecommendations(alertId, role || 'district')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [alertId, role]);

  if (loading) return <div className="loading-container" style={{ padding: 16 }}><div className="spinner" /></div>;
  if (!data) return null;

  const rec = data.recommendations;
  const priorityColor = rec.priority === 'IMMEDIATE' ? 'var(--risk-critical)' : rec.priority === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

  return (
    <div className="recommendations-panel">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <span className="risk-badge" style={{ background: priorityColor, color: '#fff', padding: '3px 10px' }}>
          {rec.priority}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Timeline: <strong style={{ color: 'var(--text)' }}>{rec.timeline}</strong>
        </span>
      </div>
      <h4 style={{ color: 'var(--text)', marginBottom: 10, fontSize: '0.9rem' }}>Recommended Actions ({role?.toUpperCase()})</h4>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {rec.actions.map((action, i) => (
          <li key={i} style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: '0.85rem' }}>{action}</li>
        ))}
      </ul>
      <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <strong>Escalation:</strong> {rec.escalation}
      </div>
    </div>
  );
}

// ── Alert Detail Drawer ───────────────────────────────────────────────────────
function AlertDetailDrawer({ alert, onClose, onAction, onViewProject }) {
  const [showRecs, setShowRecs] = useState(false);
  const [modal, setModal] = useState(null);
  const role = getCurrentRole();
  const statusMeta = STATUS_META[alert.status || 'open'];
  const hasValidProject = alert.project_id && alert.project_id !== 'PROJ-UNKNOWN' && alert.project_id.toLowerCase() !== 'nan';

  const canAcknowledge = alert.status === 'open';
  const canInvestigate = ['open', 'acknowledged'].includes(alert.status);
  const canResolve = ['acknowledged', 'investigating'].includes(alert.status);

  const handleTestEmail = async () => {
    try {
      const result = await sendTestEmail(alert.project_id, role || 'district');
      alert(`📧 Email ${result.mode === 'demo' ? 'logged to console' : 'sent'}: ${result.message}`);
    } catch {
      alert('Email test failed.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card alert-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ marginBottom: 4 }}>{alert.project_id}</h3>
            <span style={{ color: statusMeta.color, fontWeight: 700, fontSize: '0.85rem' }}>
              {statusMeta.emoji} {statusMeta.label}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Risk score badge */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`risk-badge ${alert.severity || 'high'}`}>
              Risk: {alert.risk_score}/100
            </span>
            <span className="risk-badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
              {alert.alert_type || alert.severity}
            </span>
            <span className="risk-badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
              {alert.state} {alert.district && `· ${alert.district}`}
            </span>
            {hasValidProject && (
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
                onClick={() => {
                  onClose();
                  if (onViewProject) onViewProject(alert);
                }}
              >
                🔍 View Full Project Details
              </button>
            )}
          </div>

          {/* Explanation */}
          <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
            <h5 style={{ marginBottom: 6, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Finding</h5>
            <p style={{ color: 'var(--text)', fontSize: '0.9rem', margin: 0 }}>{alert.explanation || alert.message}</p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {canAcknowledge && (
              <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--risk-medium)', color: 'var(--risk-medium)' }}
                onClick={() => setModal('acknowledge')}>
                🟡 Acknowledge
              </button>
            )}
            {canInvestigate && (
              <button className="btn btn-outline btn-sm" style={{ borderColor: '#60a5fa', color: '#60a5fa' }}
                onClick={() => setModal('investigate')}>
                🔵 Investigate
              </button>
            )}
            {canResolve && (
              <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--risk-low)', color: 'var(--risk-low)' }}
                onClick={() => setModal('resolve')}>
                🟢 Resolve
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={handleTestEmail}>
              📧 Test Email
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowRecs(!showRecs)}>
              {showRecs ? '▲ Hide' : '💡 Recommendations'}
            </button>
          </div>

          {/* Role-specific recommendations */}
          {showRecs && <RecommendationsPanel alertId={alert.alert_id} role={role} />}

          {/* Owner & resolution */}
          {alert.current_owner && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              👤 Owner: <strong style={{ color: 'var(--text)' }}>{alert.current_owner}</strong>
            </div>
          )}
          {alert.resolution_notes && (
            <div className="panel" style={{ padding: 12, marginBottom: 12, borderColor: 'var(--risk-low)' }}>
              <h5 style={{ margin: '0 0 6px', fontSize: '0.78rem', color: 'var(--risk-low)', textTransform: 'uppercase' }}>Resolution Notes</h5>
              <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.88rem' }}>{alert.resolution_notes}</p>
            </div>
          )}

          {/* Audit trail */}
          {alert.status_history && alert.status_history.length > 0 && (
            <div>
              <h5 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Audit Trail</h5>
              <div className="timeline">
                {alert.status_history.map((entry, i) => {
                  const meta = STATUS_META[entry.status] || STATUS_META.open;
                  return (
                    <div key={i} className="timeline-item">
                      <div className="timeline-dot" style={{ background: meta.color }} />
                      <div className="timeline-content">
                        <div style={{ fontWeight: 700, color: meta.color, fontSize: '0.82rem' }}>
                          {meta.emoji} {meta.label}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          by <strong>{entry.updated_by}</strong> · {new Date(entry.updated_at).toLocaleString()}
                        </div>
                        {entry.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: 4 }}>{entry.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Created / resolved timestamps */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12 }}>
            Created: {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'N/A'}
            {alert.resolved_at && (
              <span style={{ marginLeft: 12, color: 'var(--risk-low)' }}>
                ✅ Resolved: {new Date(alert.resolved_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Sub-modal for lifecycle actions */}
        {modal && (
          <ActionModal
            alert={alert}
            action={modal}
            onClose={() => setModal(null)}
            onSuccess={(updated) => { onAction(updated); setModal(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onClick, onViewProject }) {
  const statusMeta = STATUS_META[alert.status || 'open'];
  const hasValidProject = alert.project_id && alert.project_id !== 'PROJ-UNKNOWN' && alert.project_id.toLowerCase() !== 'nan';

  return (
    <div
      className={`alert-item ${alert.severity === 'critical' ? 'critical' : ''}`}
      onClick={() => onClick(alert)}
      style={{ cursor: 'pointer' }}
    >
      <div className="alert-header">
        <div className="alert-title">
          <span style={{
            background: statusMeta.color + '22',
            color: statusMeta.color,
            border: `1px solid ${statusMeta.color}44`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: '0.75rem',
            fontWeight: 700,
            marginRight: 8,
          }}>
            {statusMeta.emoji} {statusMeta.label}
          </span>
          <span className={`risk-badge ${alert.severity}`} style={{ marginRight: 8 }}>{alert.severity}</span>
          [{alert.project_id}] — {alert.state || 'National'}
          {alert.district && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {alert.district}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`risk-badge ${alert.severity}`}>Score: {alert.risk_score}</span>
          {hasValidProject && (
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewProject) onViewProject(alert);
              }}
              title="Click to view full project details"
            >
              Project Details 🔍
            </button>
          )}
        </div>
      </div>
      <div className="alert-body">
        <p style={{ marginBottom: 6 }}>{alert.explanation || alert.message}</p>
        {alert.current_owner && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            👤 {alert.current_owner}
          </span>
        )}
        {alert.recipients && alert.recipients.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            📬 {alert.recipients.slice(0, 2).join(' · ')}
            {alert.recipients.length > 2 && ` +${alert.recipients.length - 2} more`}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Created: {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'N/A'}
        </div>
      </div>
    </div>
  );
}

// ── Main AlertPanel ───────────────────────────────────────────────────────────
export default function AlertPanel() {
  const [allAlerts, setAllAlerts] = useState([]);
  const [legacyAlerts, setLegacyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [states, setStates] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);
  const [activeTab, setActiveTab] = useState('lifecycle'); // 'lifecycle' | 'live'
  const [emailTestResult, setEmailTestResult] = useState(null);

  // Load list of all states on mount
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      if (map) {
        setStates(Object.keys(map).sort());
      }
    });
  }, []);

  const loadLifecycle = useCallback(async () => {
    setLoading(true);
    const data = await fetchLifecycleAlerts({
      status: statusFilter,
      severity: severityFilter || undefined,
      state: stateFilter || undefined,
    });
    setAllAlerts(data.alerts || []);
    setStatusCounts(data.status_counts || {});
    setLoading(false);
  }, [statusFilter, severityFilter, stateFilter]);

  const loadLegacy = useCallback(async () => {
    setLoading(true);
    const { fetchAlerts } = await import('../api/client');
    const data = await fetchAlerts(severityFilter || null, stateFilter || null, 50);
    setLegacyAlerts(data?.alerts || []);
    setLoading(false);
  }, [severityFilter, stateFilter]);

  useEffect(() => {
    if (activeTab === 'lifecycle') loadLifecycle();
    else loadLegacy();
  }, [activeTab, loadLifecycle, loadLegacy]);

  const handleAlertAction = (updatedAlert) => {
    setAllAlerts((prev) => prev.map((a) => a.alert_id === updatedAlert.alert_id ? updatedAlert : a));
    setStatusCounts({});
    loadLifecycle();
    if (selectedAlert?.alert_id === updatedAlert.alert_id) setSelectedAlert(updatedAlert);
  };

  const handleSendTestEmail = async () => {
    setEmailTestResult(null);
    try {
      const result = await sendTestEmail('WS/TEST/DEMO/001', getCurrentRole() || 'district');
      setEmailTestResult(result);
    } catch {
      setEmailTestResult({ success: false, message: 'Test email request failed.' });
    }
  };

  const rawDisplayedAlerts = activeTab === 'lifecycle' ? allAlerts : legacyAlerts;
  const displayedAlerts = rawDisplayedAlerts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.project_id?.toLowerCase().includes(q) ||
      a.alert_id?.toLowerCase().includes(q) ||
      a.district?.toLowerCase().includes(q) ||
      a.state?.toLowerCase().includes(q) ||
      a.explanation?.toLowerCase().includes(q) ||
      a.message?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <h2>🚨 Anomaly Alerts & Fraud Flags</h2>
        <p>AI risk scoring engine — full alert lifecycle management with audit trail</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${activeTab === 'lifecycle' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setActiveTab('lifecycle')}
        >
          📋 Alert Lifecycle (Managed)
        </button>
        <button
          className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setActiveTab('live')}
        >
          🔴 Live Risk Alerts (98K dataset)
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleSendTestEmail}
          style={{ marginLeft: 'auto' }}
        >
          📧 Send Test Email
        </button>
      </div>

      {/* Test email result */}
      {emailTestResult && (
        <div className="panel" style={{ marginBottom: 16, padding: 14, borderColor: emailTestResult.success ? 'var(--risk-low)' : 'var(--risk-high)' }}>
          <strong>{emailTestResult.success ? '✅' : '❌'} Email {emailTestResult.mode === 'demo' ? '(Demo Mode — check backend console)' : ''}</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {emailTestResult.message} · Sent to: {emailTestResult.email_sent_to}
          </p>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setEmailTestResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Status lifecycle tabs (only for lifecycle tab) */}
      {activeTab === 'lifecycle' && (
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          {[null, 'open', 'acknowledged', 'investigating', 'resolved'].map((s) => {
            const meta = s ? STATUS_META[s] : null;
            const count = s ? (statusCounts[s] ?? 0) : allAlerts.length;
            return (
              <button
                key={s ?? 'all'}
                className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-outline'} btn-sm`}
                style={s && statusFilter !== s ? { borderColor: STATUS_META[s].color, color: STATUS_META[s].color } : {}}
                onClick={() => setStatusFilter(s)}
              >
                {meta ? `${meta.emoji} ${meta.label}` : 'All'} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Filters Bar: Dropdown + Search Input */}
      <div className="filter-bar" style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {activeTab === 'live' && (
          <>
            <button className={`btn ${severityFilter === '' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setSeverityFilter('')}>All</button>
            <button className={`btn ${severityFilter === 'critical' ? 'btn-danger' : 'btn-outline'} btn-sm`} onClick={() => setSeverityFilter('critical')}>🔴 Critical</button>
            <button className={`btn btn-outline btn-sm`} onClick={() => setSeverityFilter('high')} style={severityFilter === 'high' ? { borderColor: 'var(--risk-high)', color: 'var(--risk-high)' } : {}}>🟠 High</button>
          </>
        )}

        {/* State Selector Dropdown */}
        <div style={{ minWidth: 220 }}>
          <select
            className="form-control"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">All States & UTs ({states.length || 37})</option>
            {states.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Text Search Field */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            className="form-control"
            placeholder="🔍 Search project ID, district, keyword…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {displayedAlerts.length} alerts
        </span>
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /> Fetching alerts…</div>
      ) : displayedAlerts.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
          {activeTab === 'lifecycle' ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
              <h3 style={{ color: 'var(--text-muted)', marginBottom: 4 }}>No Lifecycle Alerts Found</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                No active lifecycle alerts matching your filter criteria.<br />
                Try selecting <strong>"All States"</strong> or switch to the <strong>Live Risk Alerts</strong> tab.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
              <h3 style={{ color: 'var(--risk-low)', marginBottom: 4 }}>No Matching Alerts</h3>
              <p style={{ color: 'var(--text-muted)' }}>All projects within acceptable risk thresholds for selected filters.</p>
            </>
          )}
        </div>
      ) : (
        <div>
          {displayedAlerts.map((alert, i) => (
            <AlertCard
              key={alert.alert_id || i}
              alert={alert}
              onClick={setSelectedAlert}
              onViewProject={setSelectedProjectForModal}
            />
          ))}
        </div>
      )}

      {/* Alert Detail Drawer */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAction={handleAlertAction}
          onViewProject={setSelectedProjectForModal}
        />
      )}

      {/* Comprehensive Project Detail Modal */}
      {selectedProjectForModal && (
        <ProjectDetailModal
          project={selectedProjectForModal}
          projectId={selectedProjectForModal.project_id}
          onClose={() => setSelectedProjectForModal(null)}
        />
      )}
    </div>
  );
}
