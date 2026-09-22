import React, { useState, useEffect } from 'react';
import {
  analyzeProject,
  verifyAsset,
  fetchStatesAndDistricts,
  getRiskColor,
  formatCrore,
  formatLakh,
} from '../api/client';
import {
  IconInspect,
  IconShieldCheck,
  IconAlertTriangle,
  IconAlertOctagon,
  IconCheckCircle,
  IconCamera,
  IconDistrict,
  IconAnalytics,
  IconFileText
} from './common/GovIcons';

const CATEGORIES = [
  'Road Infrastructure',
  'Health',
  'Education',
  'Water Supply',
  'Sanitation',
  'Electricity',
  'Community Hall',
  'Market',
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
  target_demographic: 'general',
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
      district: dists.length > 0 ? dists[0] : '',
    }));
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      setError(err.response?.data?.detail || err.message || 'Analysis calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const riskCat = (result?.risk_category || 'low').toLowerCase();
  const riskColor = getRiskColor(riskCat);

  // Derive score decomposition
  const anomalyScore = Number(result?.anomaly_score || 0);
  const fraudProb = Number(result?.fraud_risk?.probability || 0);
  const effScore = Number(result?.efficiency_risk?.score || 0);

  const anomalyPts = Number(
    result?.score_breakdown?.components?.[0]?.points ?? (0.4 * anomalyScore * 100).toFixed(1)
  );
  const fraudPts = Number(
    result?.score_breakdown?.components?.[1]?.points ?? (0.35 * fraudProb * 100).toFixed(1)
  );
  const effPts = Number(
    result?.score_breakdown?.components?.[2]?.points ?? (0.25 * (1.0 - effScore) * 100).toFixed(1)
  );
  const totalCalculated = (anomalyPts + fraudPts + effPts).toFixed(1);

  return (
    <div>
      <div className="page-header">
        <h2>
          <IconInspect size={24} color="var(--gov-navy-800)" />
          <span>Project Risk Appraisal &amp; Anomaly Engine</span>
        </h2>
        <p>
          Simulate project risk parameters, evaluate baseline financial and schedule deviations, and inspect physical asset verification data
        </p>
      </div>

      <div className="grid-2">
        {/* Form Panel */}
        <div className="panel">
          <div className="panel-header">
            <h3>Project Proposal Parameters</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Work / Project Identifier *</label>
                <input
                  className="form-control"
                  required
                  value={form.project_id}
                  onChange={(e) => handleChange('project_id', e.target.value)}
                  placeholder="e.g. TN-2024-001"
                />
              </div>
              <div className="form-group">
                <label>State Jurisdiction *</label>
                <select
                  className="form-control"
                  value={form.state}
                  onChange={(e) => handleStateChange(e.target.value)}
                >
                  {(statesList.length > 0 ? statesList : ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Uttar Pradesh']).map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="form-group">
                <label>District Authority *</label>
                {districtsList.length > 0 ? (
                  <select
                    className="form-control"
                    value={form.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                  >
                    {districtsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control"
                    required
                    value={form.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    placeholder="e.g. Coimbatore"
                  />
                )}
              </div>
              <div className="form-group">
                <label>Infrastructure Sector *</label>
                <select
                  className="form-control"
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sanctioned Outlay (₹) *</label>
                <input
                  className="form-control"
                  type="number"
                  required
                  min="1"
                  value={form.amount_sanctioned}
                  onChange={(e) => handleChange('amount_sanctioned', e.target.value)}
                  placeholder="e.g. 500000"
                />
              </div>
              <div className="form-group">
                <label>Disbursed Amount (₹) *</label>
                <input
                  className="form-control"
                  type="number"
                  required
                  min="0"
                  value={form.amount_spent}
                  onChange={(e) => handleChange('amount_spent', e.target.value)}
                  placeholder="e.g. 400000"
                />
              </div>
              <div className="form-group">
                <label>Official Approval Date *</label>
                <input
                  className="form-control"
                  type="date"
                  required
                  value={form.approval_date}
                  onChange={(e) => handleChange('approval_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Target Completion Date *</label>
                <input
                  className="form-control"
                  type="date"
                  required
                  value={form.expected_completion_date}
                  onChange={(e) => handleChange('expected_completion_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Actual Completion Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.actual_completion_date}
                  onChange={(e) => handleChange('actual_completion_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Executing Agency / Contractor *</label>
                <input
                  className="form-control"
                  required
                  value={form.contractor}
                  onChange={(e) => handleChange('contractor', e.target.value)}
                  placeholder="e.g. Sri Infrastructures"
                />
              </div>
              <div className="form-group">
                <label>Physical Execution Progress ({form.progress_percentage}%)</label>
                <input
                  className="form-control"
                  type="range"
                  min="0"
                  max="100"
                  value={form.progress_percentage}
                  onChange={(e) => handleChange('progress_percentage', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Scope of Development Work</label>
                <input
                  className="form-control"
                  value={form.work_description}
                  onChange={(e) => handleChange('work_description', e.target.value)}
                  placeholder="e.g. Construction of drain and connectivity road"
                />
              </div>
              <div className="form-group">
                <label>Agency Past Executed Works</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.previous_contractor_projects}
                  onChange={(e) => handleChange('previous_contractor_projects', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Historical Cost Overrun Occurrences</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.previous_contractor_overruns}
                  onChange={(e) => handleChange('previous_contractor_overruns', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Recommending MP Identifier</label>
                <input
                  className="form-control"
                  value={form.mp_name}
                  onChange={(e) => handleChange('mp_name', e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                />
              </div>
              <div className="form-group">
                <label>Demographic Focus Category</label>
                <select
                  className="form-control"
                  value={form.target_demographic}
                  onChange={(e) => handleChange('target_demographic', e.target.value)}
                >
                  <option value="general">General Community Asset</option>
                  <option value="SC">Scheduled Caste (SC) Beneficiary Focus (≥15%)</option>
                  <option value="ST">Scheduled Tribe (ST) Beneficiary Focus (≥7.5%)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="login-error" style={{ marginBottom: 14 }}>
                <IconAlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px 16px', fontSize: '0.88rem', marginTop: 10 }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Analyzing project...</span>
                </>
              ) : (
                <>
                  <IconInspect size={16} />
                  <span>Analyze Project Risk</span>
                </>
              )}
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
                    <span
                      className={`status-badge ${
                        result.risk_score >= 80
                          ? 'critical-alert'
                          : result.risk_score >= 60
                          ? 'high-risk'
                          : result.risk_score >= 40
                          ? 'under-review'
                          : 'approved'
                      }`}
                      style={{ fontSize: '0.84rem', padding: '5px 16px' }}
                    >
                      {riskCat.toUpperCase()} RISK CLASSIFICATION
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Confidence: {(result.model_confidence * 100).toFixed(0)}% · Timestamp:{' '}
                  {new Date(result.computed_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Geo-Adjacency Duplicate Work Alert Banner */}
              {result.geo_duplicate_detected && (
                <div
                  style={{
                    background:
                      result.geo_duplicate_type === 'cross_district'
                        ? 'var(--status-critical-bg)'
                        : 'var(--status-escalated-bg)',
                    border: `1px solid ${
                      result.geo_duplicate_type === 'cross_district'
                        ? 'var(--status-critical-border)'
                        : 'var(--status-escalated-border)'
                    }`,
                    borderRadius: 6,
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <IconAlertTriangle
                    size={20}
                    color={result.geo_duplicate_type === 'cross_district' ? '#DC2626' : '#D97706'}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          color:
                            result.geo_duplicate_type === 'cross_district'
                              ? 'var(--status-critical-text)'
                              : 'var(--status-escalated-text)',
                          fontSize: '0.88rem',
                        }}
                      >
                        {result.geo_duplicate_type === 'cross_district'
                          ? 'Geo-Spatial Cross-Boundary Duplicate Warning!'
                          : 'Same-District Duplicate Work Identified!'}
                      </strong>
                      <span
                        className="status-badge"
                        style={{
                          background: '#FFFFFF',
                          fontSize: '0.68rem',
                          border: '1px solid var(--border-card)',
                        }}
                      >
                        {result.geo_duplicate_type === 'cross_district'
                          ? `Adjacent District (~${result.distance_to_duplicate_km ?? 15} km)`
                          : 'Same District'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {result.geo_duplicate_details?.explanation ||
                        'Dual-funded or overlapping work identified in master repository.'}
                    </p>
                    {result.geo_duplicate_details?.matched_location && (
                      <div style={{ marginTop: 4, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Matched Site: {result.geo_duplicate_details.matched_location} (ID: <code>{result.geo_duplicate_details.matched_project_id}</code>)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mathematical Score Briefing & Decomposition Card */}
              <div className="panel">
                <div className="panel-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3>
                      <IconAnalytics size={18} color="var(--gov-navy-800)" />
                      <span>Mathematical Score Briefing: {result.risk_score}/100</span>
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Ensemble Formulation: (40% × Anomaly) + (35% × Fraud) + (25% × Inefficiency)
                    </span>
                  </div>
                </div>

                {/* Equation Box */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    marginBottom: 14,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Score = (0.40 × {anomalyScore.toFixed(3)}) + (0.35 × {fraudProb.toFixed(3)}) + (0.25 × {(1.0 - effScore).toFixed(3)}) = {totalCalculated} ≈ <strong style={{ color: riskColor }}>{result.risk_score}</strong>
                </div>

                {/* Segmented Point Contribution Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span>Factor Contribution Breakdown</span>
                    <span style={{ fontWeight: 700 }}>{result.risk_score} / 100 Pts</span>
                  </div>
                  <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', background: '#E2E8F0' }}>
                    <div style={{ width: `${Math.min(anomalyPts, 100)}%`, background: 'var(--gov-navy-800)' }} title={`Anomaly: ${anomalyPts} pts`} />
                    <div style={{ width: `${Math.min(fraudPts, 100)}%`, background: '#DC2626' }} title={`Fraud: ${fraudPts} pts`} />
                    <div style={{ width: `${Math.min(effPts, 100)}%`, background: '#D97706' }} title={`Schedule Inefficiency: ${effPts} pts`} />
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: '0.72rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--gov-navy-800)', fontWeight: 600 }}>Anomaly Model: +{anomalyPts} pts (40%)</span>
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>Fraud Classifier: +{fraudPts} pts (35%)</span>
                    <span style={{ color: '#D97706', fontWeight: 600 }}>Schedule Stagnation: +{effPts} pts (25%)</span>
                  </div>
                </div>
              </div>

              {/* Reasoning Behind Risk Flags & Factor Attribution */}
              {result.shap_explanations?.top_features?.length > 0 && (
                <div className="panel">
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <div>
                      <h3>
                        <IconInspect size={18} color="var(--gov-navy-800)" />
                        <span>Reasoning Behind Risk Flags</span>
                      </h3>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        Transparent breakdown of administrative and progress factors influencing the appraisal score
                      </p>
                    </div>
                  </div>

                  {/* Primary Contributors */}
                  {result.shap_explanations.primary_contributors?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#DC2626', fontWeight: 700, marginBottom: 6 }}>
                        Factors Increasing Audit Risk:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {result.shap_explanations.primary_contributors.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              background: '#FFF1F2',
                              padding: '8px 12px',
                              borderRadius: 4,
                              borderLeft: '3px solid #DC2626',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600 }}>
                              <span>{item.display_name}</span>
                              <span style={{ color: '#DC2626' }}>+{item.impact_points} pts</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Value: {item.raw_value} · Contribution: +{item.impact_points || item.contribution} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Protective Factors */}
                  {result.shap_explanations.protective_factors?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700, marginBottom: 6 }}>
                        Protective Compliance Indicators:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {result.shap_explanations.protective_factors.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              background: '#F0FDF4',
                              padding: '8px 12px',
                              borderRadius: 4,
                              borderLeft: '3px solid #166534',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600 }}>
                              <span>{item.display_name}</span>
                              <span style={{ color: '#166534' }}>-{item.impact_points} pts</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Value: {item.raw_value} · Contribution: -{item.impact_points || Math.abs(item.contribution)} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Physical Asset Geo-Tag & Photo Verification Tool */}
              <div className="panel">
                <div className="panel-header" style={{ marginBottom: 10 }}>
                  <div>
                    <h3>
                      <IconCamera size={18} color="var(--gov-navy-800)" />
                      <span>Physical Asset Photo EXIF &amp; Geo-Tag Validation</span>
                    </h3>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Audit ground completion by verifying camera hardware coordinates against the sanctioned location
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleAssetVerify}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    type="submit"
                    disabled={verifyingAsset || !assetFile}
                  >
                    <IconCamera size={13} />
                    <span>{verifyingAsset ? 'Validating EXIF GPS…' : 'Inspect Photo Geotag'}</span>
                  </button>
                </form>

                {assetError && (
                  <div className="login-error" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
                    <IconAlertTriangle size={14} />
                    <span>{assetError}</span>
                  </div>
                )}

                {assetResult && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 4,
                      background: assetResult.verified ? '#F0FDF4' : '#FFF1F2',
                      border: `1px solid ${assetResult.verified ? '#BBF7D0' : '#FECACA'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: assetResult.verified ? '#166534' : '#991B1B',
                          fontSize: '0.86rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {assetResult.verified ? <IconCheckCircle size={15} color="#166534" /> : <IconAlertOctagon size={15} color="#991B1B" />}
                        <span>{assetResult.status === 'VERIFIED' ? 'Asset Ground Coordinates Verified' : 'Discrepancy / No EXIF Location'}</span>
                      </span>
                      {assetResult.distance_km != null && (
                        <span className="status-badge approved" style={{ fontSize: '0.72rem' }}>
                          Distance: {assetResult.distance_km} km (Tolerance: {assetResult.tolerance_km} km)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {assetResult.message}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <IconInspect size={40} color="var(--border-card)" style={{ marginBottom: 12 }} />
              <h3 style={{ color: 'var(--text-heading)', fontWeight: 700, fontSize: '1rem' }}>
                Submit Work Parameters to Execute AI Audit
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4, maxWidth: 440, margin: '6px auto 0' }}>
                The evaluation framework assesses Isolation Forest feature deviations, XGBoost classification probability, and duration drag to synthesize a composite risk index.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
