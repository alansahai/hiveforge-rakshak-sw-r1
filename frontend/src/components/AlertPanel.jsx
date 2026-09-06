import React, { useState, useEffect } from 'react';
import { fetchAlerts } from '../api/client';

export default function AlertPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [totalAlerts, setTotalAlerts] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchAlerts(severityFilter || null, stateFilter || null, 50).then(data => {
      setAlerts(data?.alerts || []);
      setTotalAlerts(data?.total_alerts || 0);
      setLoading(false);
    });
  }, [severityFilter, stateFilter]);

  return (
    <div>
      <div className="page-header">
        <h2>🚨 Anomaly Alerts & Fraud Flags</h2>
        <p>Live alerts from AI risk scoring engine — filtered by severity and state</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <button className={`btn ${severityFilter === '' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setSeverityFilter('')}>All</button>
        <button className={`btn ${severityFilter === 'critical' ? 'btn-danger' : 'btn-outline'} btn-sm`} onClick={() => setSeverityFilter('critical')}>🔴 Critical</button>
        <button className={`btn ${severityFilter === 'high' ? 'btn-outline' : 'btn-outline'} btn-sm`} onClick={() => setSeverityFilter('high')} style={severityFilter === 'high' ? {borderColor:'var(--risk-high)', color:'var(--risk-high)'} : {}}>🟠 High</button>
        <input
          className="form-control"
          placeholder="Filter by state..."
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{minWidth:200}}
        />
        <span style={{fontSize:'0.82rem', color:'var(--text-muted)', marginLeft:'auto'}}>{totalAlerts} alerts loaded</span>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div> Fetching alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="panel" style={{textAlign:'center', padding:40}}>
          <div style={{fontSize:'2rem', marginBottom:8}}>✅</div>
          <h3 style={{color:'var(--risk-low)', marginBottom:4}}>No Matching Alerts</h3>
          <p style={{color:'var(--text-muted)'}}>All projects within acceptable risk thresholds for selected filters</p>
        </div>
      ) : (
        <div>
          {alerts.map((alert, i) => (
            <div key={i} className={`alert-item ${alert.severity === 'critical' ? 'critical' : ''}`}>
              <div className="alert-header">
                <div className="alert-title">
                  <span className={`risk-badge ${alert.severity}`} style={{marginRight:8}}>{alert.severity}</span>
                  [{alert.project_id}] — {alert.state || 'National'}
                  {alert.district && <span style={{color:'var(--text-muted)', marginLeft:6}}>• {alert.district}</span>}
                </div>
                <span className={`risk-badge ${alert.severity}`}>Score: {alert.risk_score}</span>
              </div>
              <div className="alert-body">
                <p style={{marginBottom:6}}>{alert.message}</p>
                {alert.recipients && alert.recipients.length > 0 && (
                  <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6}}>
                    📬 Recipients: {alert.recipients.join(' • ')}
                  </div>
                )}
                <div style={{fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4}}>
                  Created: {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'N/A'}
                  {alert.resolved_at && <span style={{color:'var(--risk-low)', marginLeft:12}}>✅ Resolved: {alert.resolved_at}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
