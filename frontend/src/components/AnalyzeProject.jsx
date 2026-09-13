import React, { useState, useEffect } from 'react';
import { analyzeProject, verifyAsset, fetchStatesAndDistricts, getRiskColor, formatCrore, formatLakh } from '../api/client';

const CATEGORIES = [
  'Road Infrastructure', 'Health', 'Education', 'Water Supply',
  'Sanitation', 'Electricity', 'Community Hall', 'Market'
];

const initialForm = {
  project_id: 'TES-01',
  amount_sanctioned: 500000,
  amount_spent: 400000,
  approval_date: '2024-08-10',
  expected_completion_date: '2025-09-10',
  actual_completion_date: '',
  state: 'Tamil Nadu',
  district: 'Coimbatore',
  category: 'Road Infrastructure',
  contractor: 'Sri Infrastructures',
  progress_percentage: 83,
  work_description: 'Construction of local connectivity road and drain infrastructure',
  previous_contractor_projects: 1,
  previous_contractor_overruns: 0,
  mp_name: 'Dr. Ramesh Kumar',
  target_demographic: 'general'
};

export default function AnalyzeProject() {
  const [statesMap, setStatesMap] = useState({});
  const [statesList, setStatesList] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Asset Photo Verification State
  const [assetFile, setAssetFile] = useState(null);
  const [verifyingAsset, setVerifyingAsset] = useState(false);
  const [assetResult, setAssetResult] = useState(null);
  const [assetError, setAssetError] = useState('');

  const handleAssetVerify = async (e) => {
    e.preventDefault();
    if (!assetFile) {
      setAssetError('Please select a site photograph first.');
      return;
    }
    setAssetError('');
    setVerifyingAsset(true);
    setAssetResult(null);

    try {
      const fd = new FormData();
      fd.append('file', assetFile);
      fd.append('project_id', form.project_id);
      fd.append('district', form.district);
      fd.append('state', form.state);
      fd.append('tolerance_km', '5.0');
      const res = await verifyAsset(fd);
      setAssetResult(res);
    } catch (err) {
      setAssetError(err.response?.data?.detail || err.message || 'Asset verification failed.');
    } finally {
      setVerifyingAsset(false);
    }
  };

  // 1. Fetch States & Districts
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      setStatesMap(map);
      const sList = Object.keys(map).sort();
      setStatesList(sList);
      if (sList.length > 0) {
        const initialDists = map[form.state] || map[sList[0]] || [];
        setDistrictsList(initialDists);
      }
    });
  }, []);

  const handleStateChange = (newState) => {
    const dists = statesMap[newState] || [];
    setDistrictsList(dists);
    setForm((prev) => ({
      ...prev,
      state: newState,
      district: dists.length > 0 ? dists[0] : ''
    }));
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const payload = {
        ...form,
        amount_sanctioned: parseFloat(form.amount_sanctioned),
        amount_spent: parseFloat(form.amount_spent),
        progress_percentage: parseFloat(form.progress_percentage),
        previous_contractor_projects: parseInt(form.previous_contractor_projects || 1),
        previous_contractor_overruns: parseInt(form.previous_contractor_overruns || 0),
      };
      const res = await analyzeProject(payload);
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const riskCat = (result?.risk_category || 'low').toLowerCase();
  const riskColor = getRiskColor(riskCat);

  // Derive score decomposition if backend returned it, or compute client-side fallback
  const anomalyScore = Number(result?.anomaly_score || 0);
  const fraudProb = Number(result?.fraud_risk?.probability || 0);
  const effScore = Number(result?.efficiency_risk?.score || 0);
  const delayDays = result?.efficiency_risk?.days_behind_schedule || 0;

  const anomalyPts = Number(result?.score_breakdown?.components?.[0]?.points ?? (0.40 * anomalyScore * 100).toFixed(1));
  const fraudPts = Number(result?.score_breakdown?.components?.[1]?.points ?? (0.35 * fraudProb * 100).toFixed(1));
  const effPts = Number(result?.score_breakdown?.components?.[2]?.points ?? (0.25 * (1.0 - effScore) * 100).toFixed(1));
  const totalCalculated = (anomalyPts + fraudPts + effPts).toFixed(1);

  const drivers = result?.score_breakdown?.key_drivers || [];

  return (
    <div>
      <div className="page-header">
        <h2>🔬 Analyze Individual Project</h2>
        <p>Submit project parameters for real-time AI risk scoring, mathematical score briefing, and fraud diagnostics</p>
      </div>

      <div className="grid-2">
        {/* Form Panel */}
        <div className="panel">
          <div className="panel-header"><h3>Project Details</h3></div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Project ID *</label>
                <input className="form-control" required value={form.project_id} onChange={e => handleChange('project_id', e.target.value)} placeholder="e.g. AP-2024-001" />
              </div>
              <div className="form-group">
                <label>State *</label>
                <select className="form-control" value={form.state} onChange={e => handleStateChange(e.target.value)}>
                  {(statesList.length > 0 ? statesList : ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Uttar Pradesh']).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>District *</label>
                {districtsList.length > 0 ? (
                  <select className="form-control" value={form.district} onChange={e => handleChange('district', e.target.value)}>
                    {districtsList.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <input className="form-control" required value={form.district} onChange={e => handleChange('district', e.target.value)} placeholder="e.g. Coimbatore" />
                )}
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select className="form-control" value={form.category} onChange={e => handleChange('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Amount Sanctioned (₹) *</label>
                <input className="form-control" type="number" required min="1" value={form.amount_sanctioned} onChange={e => handleChange('amount_sanctioned', e.target.value)} placeholder="e.g. 500000" />
              </div>
              <div className="form-group">
                <label>Amount Spent (₹) *</label>
                <input className="form-control" type="number" required min="0" value={form.amount_spent} onChange={e => handleChange('amount_spent', e.target.value)} placeholder="e.g. 400000" />
              </div>
              <div className="form-group">
                <label>Approval Date *</label>
                <input className="form-control" type="date" required value={form.approval_date} onChange={e => handleChange('approval_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Expected Completion *</label>
                <input className="form-control" type="date" required value={form.expected_completion_date} onChange={e => handleChange('expected_completion_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Actual Completion</label>
                <input className="form-control" type="date" value={form.actual_completion_date} onChange={e => handleChange('actual_completion_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contractor Name *</label>
                <input className="form-control" required value={form.contractor} onChange={e => handleChange('contractor', e.target.value)} placeholder="e.g. Sri Infrastructures" />
              </div>
              <div className="form-group">
                <label>Physical Progress ({form.progress_percentage}%)</label>
                <input className="form-control" type="range" min="0" max="100" value={form.progress_percentage} onChange={e => handleChange('progress_percentage', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Work Description</label>
                <input className="form-control" value={form.work_description} onChange={e => handleChange('work_description', e.target.value)} placeholder="e.g. Construction of drain and road" />
              </div>
              <div className="form-group">
                <label>Contractor Past Projects</label>
                <input className="form-control" type="number" min="0" value={form.previous_contractor_projects} onChange={e => handleChange('previous_contractor_projects', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Past Cost Overruns</label>
                <input className="form-control" type="number" min="0" value={form.previous_contractor_overruns} onChange={e => handleChange('previous_contractor_overruns', e.target.value)} />
              </div>
              <div className="form-group">
                <label>MP Name (Policy Compliance)</label>
                <input className="form-control" value={form.mp_name} onChange={e => handleChange('mp_name', e.target.value)} placeholder="e.g. Dr. Ramesh Kumar" />
              </div>
              <div className="form-group">
                <label>Beneficiary Demographics (MoSPI)</label>
                <select className="form-control" value={form.target_demographic} onChange={e => handleChange('target_demographic', e.target.value)}>
                  <option value="general">General Public Works</option>
                  <option value="SC">Scheduled Caste (SC) Beneficiaries</option>
                  <option value="ST">Scheduled Tribe (ST) Beneficiaries</option>
                </select>
              </div>
            </div>

            {error && <div style={{ color: 'var(--risk-critical)', marginBottom: 12, fontSize: '0.85rem' }}>❌ {error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem' }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Analyzing with AI Models...</> : '🔬 Run AI Risk Analysis'}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div>
          {result ? (
            <>
              {/* Risk Gauge Panel */}
              <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div className="risk-gauge">
                  <div className="gauge-value" style={{ color: riskColor, fontSize: '3.4rem', fontWeight: 800 }}>
                    {result.risk_score}
                  </div>
                  <div className="gauge-label" style={{ marginTop: 4 }}>
                    <span className={`risk-badge ${riskCat}`} style={{ fontSize: '0.9rem', padding: '6px 18px', fontWeight: 700 }}>
                      {riskCat.toUpperCase()} RISK
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Model confidence: {(result.model_confidence * 100).toFixed(0)}% • Computed: {new Date(result.computed_at).toLocaleString()}
                </div>
              </div>

              {/* Geo-Adjacency Duplicate Work Alert Banner */}
              {result.geo_duplicate_detected && (
                <div style={{
                  background: result.geo_duplicate_type === 'cross_district' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${result.geo_duplicate_type === 'cross_district' ? '#ef4444' : '#f59e0b'}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>
                    {result.geo_duplicate_type === 'cross_district' ? '🌐' : '📋'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{
                        color: result.geo_duplicate_type === 'cross_district' ? 'var(--risk-critical)' : 'var(--risk-medium)',
                        fontSize: '0.95rem'
                      }}>
                        {result.geo_duplicate_type === 'cross_district'
                          ? '🚨 Geo-Adjacency Cross-Boundary Duplicate Detected!'
                          : '⚠️ Same-District Duplicate Work Detected!'}
                      </strong>
                      <span className="risk-badge" style={{
                        background: result.geo_duplicate_type === 'cross_district' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                        color: result.geo_duplicate_type === 'cross_district' ? '#fca5a5' : '#fde68a',
                        fontSize: '0.72rem',
                        padding: '2px 8px'
                      }}>
                        {result.geo_duplicate_type === 'cross_district'
                          ? `Adjacent District (~${result.distance_to_duplicate_km ?? 15} km)`
                          : 'Exact Same District'}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {result.geo_duplicate_details?.explanation || (
                        result.geo_duplicate_type === 'cross_district'
                          ? `Duplicate work detected across administrative boundary in neighboring district (${result.distance_to_duplicate_km ?? 15} km away). Likely dual-funded or duplicate geo-spatial allocation.`
                          : 'A work with matching category and budget exists in the district master dataset.'
                      )}
                    </p>
                    {result.geo_duplicate_details?.matched_location && (
                      <div style={{ marginTop: 6, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        📍 <strong>Matched Reference:</strong> {result.geo_duplicate_details.matched_location} (ID: <code>{result.geo_duplicate_details.matched_project_id}</code>)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MATHEMATICAL SCORE BRIEFING & DECOMPOSITION CARD */}
              <div className="panel" style={{ border: '1px solid var(--border-card)', background: 'var(--bg-card)' }}>
                <div className="panel-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--accent-hover)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      📊 Score Briefing: How was {result.risk_score}/100 Calculated?
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Ensemble Formula: (40% × Anomaly) + (35% × Fraud) + (25% × Inefficiency)
                    </span>
                  </div>
                </div>

                {/* Formula Equation Box */}
                <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.85rem', color: '#93c5fd', marginBottom: 16 }}>
                  Risk Score = (0.40 × {anomalyScore.toFixed(3)}) + (0.35 × {fraudProb.toFixed(3)}) + (0.25 × {(1.0 - effScore).toFixed(3)}) = {totalCalculated} ≈ <strong style={{ color: riskColor }}>{result.risk_score}</strong>
                </div>

                {/* Segmented Point Contribution Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    <span>Point Contribution Breakdown (Total 100 pts)</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{result.risk_score} / 100</span>
                  </div>
                  <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      title={`Anomaly Contribution: ${anomalyPts} pts`}
                      style={{ width: `${Math.min(anomalyPts, 100)}%`, background: '#3b82f6', transition: 'width 0.5s' }}
                    />
                    <div
                      title={`Fraud Probability Contribution: ${fraudPts} pts`}
                      style={{ width: `${Math.min(fraudPts, 100)}%`, background: '#ef4444', transition: 'width 0.5s' }}
                    />
                    <div
                      title={`Schedule Inefficiency Contribution: ${effPts} pts`}
                      style={{ width: `${Math.min(effPts, 100)}%`, background: '#f59e0b', transition: 'width 0.5s' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.74rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#60a5fa' }}>🔵 Anomaly: <strong>+{anomalyPts} pts</strong> (40%)</span>
                    <span style={{ color: '#f87171' }}>🔴 Fraud: <strong>+{fraudPts} pts</strong> (35%)</span>
                    <span style={{ color: '#fbbf24' }}>🟡 Inefficiency: <strong>+{effPts} pts</strong> (25%)</span>
                  </div>
                </div>

                {/* Component Breakdown Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>1. Anomaly Model</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#60a5fa', margin: '3px 0' }}>{anomalyScore.toFixed(3)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Contributes <strong>+{anomalyPts}</strong> pts to score</div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #ef4444' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>2. Fraud Classifier</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: Number(fraudProb) > 0.3 ? 'var(--risk-critical)' : 'var(--text-primary)', margin: '3px 0' }}>
                      {(fraudProb * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Contributes <strong>+{fraudPts}</strong> pts to score</div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>3. Efficiency Model</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fbbf24', margin: '3px 0' }}>{effScore.toFixed(3)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Contributes <strong>+{effPts}</strong> pts to score</div>
                  </div>
                </div>

                {/* Key Driver Tags */}
                {drivers.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                      Active Risk Trigger Drivers:
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {drivers.map((d, i) => (
                        <span
                          key={i}
                          className="risk-badge"
                          style={{
                            background: d.severity === 'high' ? 'rgba(239, 68, 68, 0.15)' : d.severity === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                            color: d.severity === 'high' ? 'var(--risk-critical)' : d.severity === 'medium' ? 'var(--risk-medium)' : 'var(--accent-hover)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.76rem',
                            padding: '3px 10px'
                          }}
                        >
                          ⚡ <strong>{d.factor}:</strong> {d.impact}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plain-English Summary Briefing */}
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  📝 <strong>Officer Briefing:</strong> {result.score_breakdown?.plain_english_summary || `Project scored ${result.risk_score}/100. Isolation forest caught ${anomalyScore.toFixed(2)} deviation while timeline progress is ${effScore > 0.7 ? 'on track' : 'lagging'}.`}
                </div>
              </div>

              {/* Fraud Analysis Detail */}
              <div className="panel">
                <div className="panel-header"><h3>Fraud Indicators & Financial Signals</h3></div>
                <div style={{ marginBottom: 8 }}>
                  {result.fraud_risk?.indicators?.map((ind, i) => (
                    <span key={i} className="risk-badge high" style={{ marginRight: 6, marginBottom: 4, textTransform: 'uppercase' }}>
                      {ind.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <div className="explanation-card">{result.fraud_risk?.explanation}</div>
              </div>

              {/* Efficiency Analysis Detail */}
              <div className="panel">
                <div className="panel-header"><h3>Milestone & Execution Efficiency</h3></div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span className={`risk-badge ${delayDays > 60 ? 'critical' : delayDays > 0 ? 'high' : 'low'}`}>
                    {delayDays > 0 ? `⚠️ ${delayDays} days behind schedule` : '✅ Milestone on schedule'}
                  </span>
                </div>
                <div className="explanation-card">{result.efficiency_risk?.explanation}</div>
              </div>

              {/* Actionable Recommendations */}
              <div className="panel">
                <div className="panel-header"><h3>Actionable Inspection Steps</h3></div>
                <div className="result-section">
                  {result.recommendations?.map((rec, i) => (
                    <div key={i} className="recommendation-item">
                      <span className="rec-icon">⚡</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  📢 <strong>Escalation Protocol:</strong> {result.alert_escalation}
                </div>
              </div>

              {/* MoSPI MPLADS Policy Compliance Scorecard */}
              {result.compliance_assessment && (
                <div className="panel" style={{ border: `1px solid ${result.compliance_assessment.overall_status === 'COMPLIANT' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                  <div className="panel-header" style={{ marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📜 MoSPI MPLADS Guidelines Compliance
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Statutory Rules & Permissibility Verification
                      </span>
                    </div>
                    <span className={`risk-badge ${result.compliance_assessment.overall_status === 'COMPLIANT' ? 'low' : result.compliance_assessment.overall_status === 'AT_RISK' ? 'medium' : 'critical'}`}>
                      {result.compliance_assessment.overall_status} • {result.compliance_assessment.compliance_score}/100
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rule A: Financial Ceiling</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: result.compliance_assessment.rule_breakdown?.financial_ceiling === 'PASS' ? '#22c55e' : '#ef4444', marginTop: 3 }}>
                        {result.compliance_assessment.rule_breakdown?.financial_ceiling || 'PASS'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rule B: SC Allocation (15%)</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: result.compliance_assessment.rule_breakdown?.sc_allocation === 'PASS' ? '#22c55e' : '#f59e0b', marginTop: 3 }}>
                        {result.compliance_assessment.rule_breakdown?.sc_allocation || 'PASS'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rule C: ST Allocation (7.5%)</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: result.compliance_assessment.rule_breakdown?.st_allocation === 'PASS' ? '#22c55e' : '#f59e0b', marginTop: 3 }}>
                        {result.compliance_assessment.rule_breakdown?.st_allocation || 'PASS'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rule D: Prohibited Works</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: result.compliance_assessment.rule_breakdown?.prohibited_works === 'PASS' ? '#22c55e' : '#ef4444', marginTop: 3 }}>
                        {result.compliance_assessment.rule_breakdown?.prohibited_works || 'PASS'}
                      </div>
                    </div>
                  </div>

                  {result.compliance_assessment.violations?.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
                      <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.82rem', marginBottom: 4 }}>
                        ⚠️ Ineligible Work & Non-Compliance Findings:
                      </div>
                      {result.compliance_assessment.violations.map((v, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          • <strong>{v.rule_name}:</strong> {v.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Genuine SHAP Explainability Breakdown */}
              {result.shap_explanations?.top_features?.length > 0 && (
                <div className="panel">
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>🔍 TreeExplainer SHAP Feature Attribution</h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Mathematical feature attributions computed via tree gradient explainers
                      </span>
                    </div>
                  </div>

                  {/* Primary Contributors */}
                  {result.shap_explanations.primary_contributors?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 700, marginBottom: 6 }}>
                        🔺 Factors Increasing Risk:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {result.shap_explanations.primary_contributors.map((item, i) => (
                          <div key={i} style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #ef4444' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                              <span>{item.display_name}</span>
                              <span style={{ color: '#f87171' }}>+{item.impact_points} pts</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Observed Value: {item.raw_value} • SHAP contribution: +{item.contribution}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Protective Factors */}
                  {result.shap_explanations.protective_factors?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#4ade80', fontWeight: 700, marginBottom: 6 }}>
                        🛡️ Protective Factors Reducing Risk:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {result.shap_explanations.protective_factors.map((item, i) => (
                          <div key={i} style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #22c55e' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                              <span>{item.display_name}</span>
                              <span style={{ color: '#4ade80' }}>-{item.impact_points} pts</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Observed Value: {item.raw_value} • SHAP contribution: {item.contribution}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Physical Asset Geo-Tag & Photo Verification Tool */}
              <div className="panel" style={{ border: '1px solid rgba(147, 197, 253, 0.25)' }}>
                <div className="panel-header" style={{ marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      📸 Physical Asset Geo-Tag & EXIF Verification
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Upload site photograph to extract camera GPS coordinates & verify physical ground execution
                    </span>
                  </div>
                </div>

                <form onSubmit={handleAssetVerify} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setAssetFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}
                  />
                  <button className="btn btn-outline btn-sm" type="submit" disabled={verifyingAsset || !assetFile}>
                    {verifyingAsset ? 'Extracting EXIF GPS...' : '📍 Verify Asset Geo-Tag'}
                  </button>
                </form>

                {assetError && <div style={{ color: 'var(--risk-critical)', fontSize: '0.8rem', marginBottom: 8 }}>⚠️ {assetError}</div>}

                {assetResult && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: assetResult.verified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${assetResult.verified ? '#22c55e' : '#ef4444'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: assetResult.verified ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>
                        {assetResult.status === 'VERIFIED' ? '✅ Asset Physically Verified' : assetResult.status === 'DISCREPANCY' ? '🚨 Physical Discrepancy Flagged' : '⚠️ No GPS EXIF Data'}
                      </span>
                      {assetResult.distance_km != null && (
                        <span className="risk-badge" style={{ fontSize: '0.74rem' }}>
                          Distance: {assetResult.distance_km} km (Tolerance: {assetResult.tolerance_km} km)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {assetResult.message}
                    </div>
                    {assetResult.photo_location && (
                      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>📍 Photo: ({assetResult.photo_location.latitude}, {assetResult.photo_location.longitude})</span>
                        <span>🎯 Site: ({assetResult.site_location.latitude}, {assetResult.site_location.longitude})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Data Provenance Badges */}
              {result.data_provenance && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Data Provenance & Model Lineage:</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="risk-badge low">Anomaly: {result.data_provenance.anomaly_score}</span>
                    <span className="risk-badge low">Fraud: {result.data_provenance.fraud_probability}</span>
                    <span className="risk-badge low">Efficiency: {result.data_provenance.efficiency_score}</span>
                    <span className="risk-badge medium">Compliance: {result.data_provenance.compliance}</span>
                    <span className="risk-badge medium">Spatial: {result.data_provenance.geo_duplicate}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.3 }}>🔬</div>
              <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Submit project parameters to run AI analysis</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                The engine will evaluate Isolation Forest anomalies, XGBoost fraud probability, and completion duration efficiency to synthesize a composite score.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
