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
import {
  IconAlerts,
  IconAlertOctagon,
  IconAlertTriangle,
  IconShieldCheck,
  IconCheckCircle,
  IconInspect,
  IconSearch,
  IconFilter,
  IconUser,
  IconFileText
} from './common/GovIcons';

const STATUS_META = {
  open: {
    label: 'Open / Flagged',
    badgeClass: 'critical-alert',
    color: '#DC2626',
  },
  acknowledged: {
    label: 'Acknowledged',
    badgeClass: 'under-review',
    color: '#D97706',
  },
  investigating: {
    label: 'Investigating',
    badgeClass: 'status-completed',
    color: '#0369A1',
  },
  resolved: {
    label: 'Resolved & Closed',
    badgeClass: 'approved',
    color: '#166534',
  },
};

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ alert, action, onClose, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getCurrentUser();
  const actor = user?.username || 'system_user';

  const ACTION_LABELS = {
    acknowledge: {
      title: 'Acknowledge Audit Alert',
      verb: 'Record Acknowledgement',
      notesLabel: 'Administrative Remarks (Optional)',
      notesRequired: false,
    },
    investigate: {
      title: 'Initiate Official Inquiry',
      verb: 'Launch Investigation',
      notesLabel: 'Investigation Plan / Initial Ground Findings',
      notesRequired: false,
    },
    resolve: {
      title: 'Formal Resolution of Alert',
      verb: 'Mark Audit Resolved',
      notesLabel: 'Resolution Findings & Corrective Orders (Required)',
      notesRequired: true,
    },
  };
  const meta = ACTION_LABELS[action];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (meta.notesRequired && !notes.trim()) {
      setError('Official resolution notes are mandatory before closing an audit flag.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let result;
      if (action === 'acknowledge') result = await acknowledgeAlert(alert.alert_id, actor, notes);
      else if (action === 'investigate') result = await investigateAlert(alert.alert_id, actor, notes);
      else if (action === 'resolve') result = await resolveAlert(alert.alert_id, actor, notes);
      onSuccess(
        result?.alert || {
          ...alert,
          status:
            action === 'resolve'
              ? 'resolved'
              : action === 'investigate'
              ? 'investigating'
              : 'acknowledged',
        }
      );
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Action submission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{meta.title}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: '0.82rem' }}>
            Alert ID: <strong style={{ color: 'var(--gov-navy-900)' }}>{alert.alert_id}</strong> · Work ID:{' '}
            <strong style={{ color: 'var(--gov-navy-900)' }}>{alert.project_id}</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 14, fontSize: '0.82rem' }}>
            Authorizing Officer:{' '}
            <strong style={{ color: 'var(--gov-navy-800)' }}>{actor}</strong>
          </p>
          {error && (
            <div className="login-error" style={{ marginBottom: 12 }}>
              <IconAlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{meta.notesLabel}</label>
              <textarea
                className="form-control"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter official observations and administrative directives…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? 'Processing…' : meta.verb}
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

  if (loading)
    return (
      <div className="loading-container" style={{ padding: 16 }}>
        <div className="spinner" />
      </div>
    );
  if (!data) return null;

  const rec = data.recommendations;
  const statusClass =
    rec.priority === 'IMMEDIATE'
      ? 'critical-alert'
      : rec.priority === 'HIGH'
      ? 'high-risk'
      : 'under-review';

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid var(--border-card)',
        borderRadius: '4px',
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <span className={`status-badge ${statusClass}`}>
          Priority: {rec.priority}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Mandatory Window: <strong style={{ color: 'var(--text-heading)' }}>{rec.timeline}</strong>
        </span>
      </div>
      <h4 style={{ color: 'var(--text-heading)', marginBottom: 8, fontSize: '0.88rem' }}>
        Recommended Regulatory Interventions ({role?.toUpperCase()})
      </h4>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {rec.actions.map((action, i) => (
          <li
            key={i}
            style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: '0.82rem' }}
          >
            {action}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 10, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        <strong>Administrative Escalation Path:</strong> {rec.escalation}
      </div>
    </div>
  );
}

// ── Alert Detail Drawer / Modal ───────────────────────────────────────────────
function AlertDetailModal({ alert, onClose, onAction, onViewProject }) {
  const [showRecs, setShowRecs] = useState(false);
  const [modal, setModal] = useState(null);
  const role = getCurrentRole();
  const statusMeta = STATUS_META[alert.status || 'open'] || STATUS_META.open;

  const canAcknowledge = alert.status === 'open';
  const canInvestigate = alert.status === 'open' || alert.status === 'acknowledged';
  const canResolve = alert.status !== 'resolved';

  const hasValidProject =
    alert.project_id &&
    alert.project_id !== 'PROJ-UNKNOWN' &&
    alert.project_id.toLowerCase() !== 'nan';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 660 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Audit Flag Examination: {alert.alert_id}</h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Recorded against Project ID: <strong>{alert.project_id}</strong>
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Metadata chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <span className={`status-badge ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </span>
            <span
              className={`status-badge ${
                alert.risk_score >= 80
                  ? 'critical-alert'
                  : alert.risk_score >= 60
                  ? 'high-risk'
                  : 'under-review'
              }`}
            >
              Risk: {alert.risk_score}/100
            </span>
            <span
              style={{
                fontSize: '0.74rem',
                padding: '2px 8px',
                background: '#F1F5F9',
                color: 'var(--text-secondary)',
                borderRadius: '3px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {alert.state} {alert.district && `· ${alert.district}`}
            </span>
            {hasValidProject && (
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto', fontSize: '0.74rem' }}
                onClick={() => {
                  onClose();
                  if (onViewProject) onViewProject(alert);
                }}
              >
                <IconInspect size={12} />
                <span>Inspect Full Work Ledger</span>
              </button>
            )}
          </div>

          {/* Finding */}
          <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
            <h5 style={{ margin: '0 0 6px', fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Anomaly Finding &amp; Evidence Trigger
            </h5>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
              {alert.explanation || alert.message}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {canAcknowledge && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setModal('acknowledge')}
              >
                <IconShieldCheck size={13} color="var(--risk-medium)" />
                <span>Acknowledge</span>
              </button>
            )}
            {canInvestigate && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setModal('investigate')}
              >
                <IconInspect size={13} color="#0369A1" />
                <span>Start Investigation</span>
              </button>
            )}
            {canResolve && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setModal('resolve')}
              >
                <IconCheckCircle size={13} color="var(--risk-low)" />
                <span>Resolve Flag</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowRecs(!showRecs)}
            >
              <IconFileText size={13} />
              <span>{showRecs ? 'Hide Action Directives' : 'Regulatory Directives'}</span>
            </button>
          </div>

          {/* Recommendations */}
          {showRecs && <RecommendationsPanel alertId={alert.alert_id} role={role} />}

          {/* Owner & resolution */}
          {alert.current_owner && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Assigned Audit Officer: <strong style={{ color: 'var(--text-heading)' }}>{alert.current_owner}</strong>
            </div>
          )}
          {alert.resolution_notes && (
            <div
              style={{
                padding: 12,
                marginBottom: 12,
                background: 'var(--status-approved-bg)',
                border: '1px solid var(--status-approved-border)',
                borderRadius: 4,
              }}
            >
              <h5 style={{ margin: '0 0 4px', fontSize: '0.74rem', color: 'var(--status-approved-text)', textTransform: 'uppercase' }}>
                Resolution Order
              </h5>
              <p style={{ color: 'var(--status-approved-text)', margin: 0, fontSize: '0.84rem' }}>
                {alert.resolution_notes}
              </p>
            </div>
          )}

          {/* Audit trail */}
          {alert.status_history && alert.status_history.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h5 style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Statutory Audit Trail
              </h5>
              <div className="timeline">
                {alert.status_history.map((entry, i) => {
                  const meta = STATUS_META[entry.status] || STATUS_META.open;
                  return (
                    <div key={i} className="timeline-item">
                      <div className="timeline-dot" style={{ background: meta.color }} />
                      <div className="timeline-content">
                        <div style={{ fontWeight: 700, color: meta.color, fontSize: '0.8rem' }}>
                          {meta.label}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Recorded by <strong>{entry.updated_by}</strong> · {new Date(entry.updated_at).toLocaleString()}
                        </div>
                        {entry.notes && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sub-modal for lifecycle actions */}
        {modal && (
          <ActionModal
            alert={alert}
            action={modal}
            onClose={() => setModal(null)}
            onSuccess={(updated) => {
              onAction(updated);
              setModal(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Alert Card Item ───────────────────────────────────────────────────────────
function AlertCard({ alert, onClick }) {
  const statusMeta = STATUS_META[alert.status || 'open'] || STATUS_META.open;

  return (
    <div
      className={`alert-item ${alert.severity === 'critical' ? 'critical' : ''}`}
      onClick={() => onClick(alert)}
      style={{
        cursor: 'pointer',
        borderLeft: `4px solid ${alert.severity === 'critical' ? 'var(--risk-critical)' : 'var(--risk-high)'}`,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: '4px',
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      <div className="alert-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-badge ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
          <span
            className={`status-badge ${
              alert.severity === 'critical' ? 'critical-alert' : 'high-risk'
            }`}
          >
            {alert.severity || 'high'}
          </span>
          <strong style={{ fontSize: '0.86rem', color: 'var(--gov-navy-900)' }}>
            [{alert.project_id}] — {alert.state || 'National'}
          </strong>
        </div>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : ''}
        </span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
        {alert.explanation || alert.message}
      </div>
    </div>
  );
}

// ── Main AlertPanel Component ─────────────────────────────────────────────────
export default function AlertPanel() {
  const [allAlerts, setAllAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [states, setStates] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);

  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      if (map) setStates(Object.keys(map).sort());
    });
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLifecycleAlerts({
        status: statusFilter,
        severity: severityFilter || undefined,
        state: stateFilter || undefined,
      });
      setAllAlerts(data.alerts || []);
    } catch {
      setAllAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, stateFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAlertAction = (updatedAlert) => {
    setAllAlerts((prev) =>
      prev.map((a) => (a.alert_id === updatedAlert.alert_id ? updatedAlert : a))
    );
    loadAlerts();
    if (selectedAlert?.alert_id === updatedAlert.alert_id) setSelectedAlert(updatedAlert);
  };

  const displayedAlerts = allAlerts.filter((a) => {
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
        <h2>
          <IconAlerts size={24} color="var(--gov-navy-800)" />
          <span>Statutory Audit &amp; Anomaly Alert Lifecycle Engine</span>
        </h2>
        <p>
          Automated multi-criteria surveillance ledger — active investigation records, audit history, and corrective regulatory orders
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
            SEARCH ALERTS / PROJECT ID
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="Search by ID, State, District, finding keyword…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
            SEVERITY TIER
          </label>
          <select
            className="form-control"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical Anomaly</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Variance</option>
          </select>
        </div>

        <div style={{ minWidth: 180 }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
            STATE JURISDICTION
          </label>
          <select
            className="form-control"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">All States &amp; UTs</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lifecycle Status Tab Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${statusFilter === null ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setStatusFilter(null)}
        >
          All Records ({allAlerts.length})
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'open' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          style={statusFilter === 'open' ? { background: '#DC2626', borderColor: '#DC2626' } : { color: '#DC2626' }}
          onClick={() => setStatusFilter('open')}
        >
          <IconAlertOctagon size={13} />
          <span>Active Inquiries</span>
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'acknowledged' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          style={statusFilter === 'acknowledged' ? { background: '#D97706', borderColor: '#D97706' } : { color: '#D97706' }}
          onClick={() => setStatusFilter('acknowledged')}
        >
          <IconShieldCheck size={13} />
          <span>Acknowledged</span>
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'investigating' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          style={statusFilter === 'investigating' ? { background: '#0369A1', borderColor: '#0369A1' } : { color: '#0369A1' }}
          onClick={() => setStatusFilter('investigating')}
        >
          <IconInspect size={13} />
          <span>Under Investigation</span>
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          style={statusFilter === 'resolved' ? { background: '#166534', borderColor: '#166534' } : { color: '#166534' }}
          onClick={() => setStatusFilter('resolved')}
        >
          <IconCheckCircle size={13} />
          <span>Resolved / Closed</span>
        </button>
      </div>

      {/* Alert Feed / Cards */}
      <div className="panel">
        <div className="panel-header">
          <h3>
            <IconAlertTriangle size={18} color="var(--gov-navy-800)" />
            <span>Recorded Audit Discrepancies ({displayedAlerts.length})</span>
          </h3>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Click any entry to inspect evidence and execute statutory audit actions
          </span>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span>Scanning central anomaly ledger…</span>
          </div>
        ) : displayedAlerts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit records matching the specified filters.
          </div>
        ) : (
          <div>
            {displayedAlerts.map((alert) => (
              <AlertCard
                key={alert.alert_id}
                alert={alert}
                onClick={(a) => setSelectedAlert(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Alert Detail & Action Modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAction={handleAlertAction}
          onViewProject={(a) => {
            setSelectedProjectForModal({ project_id: a.project_id, state: a.state, district: a.district });
          }}
        />
      )}

      {/* Project Detail Modal */}
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
