import React, { useState } from 'react';
import { analyzeProject, getRiskColor } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'West Bengal'
];

const CATEGORIES = ['Health', 'Education', 'Road Infrastructure', 'Water Supply', 'Sanitation', 'Electricity', 'Community Hall', 'Market'];

const initialForm = {
  project_id: '',
  amount_sanctioned: '',
  amount_spent: '',
  approval_date: '',
  expected_completion_date: '',
  actual_completion_date: '',
  state: 'Karnataka',
  district: '',
  category: 'Health',
  contractor: '',
  progress_percentage: 50,
  work_description: '',
  previous_contractor_projects: 1,
  previous_contractor_overruns: 0
};

export default function AnalyzeProject() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        previous_contractor_projects: parseInt(form.previous_contractor_projects),
        previous_contractor_overruns: parseInt(form.previous_contractor_overruns),
      };
      const res = await analyzeProject(payload);
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const riskCat = result?.risk_category || 'low';
  const riskColor = getRiskColor(riskCat);

  return (
    <div>
      <div className="page-header">
        <h2>🔬 Analyze Individual Project</h2>
        <p>Submit project data for real-time AI risk scoring, fraud detection, and efficiency analysis</p>
      </div>

      <div className="grid-2">
        {/* Form */}
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
                <select className="form-control" value={form.state} onChange={e => handleChange('state', e.target.value)}>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>District *</label>
                <input className="form-control" required value={form.district} onChange={e => handleChange('district', e.target.value)} placeholder="e.g. Visakhapatnam" />
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
                <input className="form-control" type="number" required min="0" value={form.amount_spent} onChange={e => handleChange('amount_spent', e.target.value)} placeholder="e.g. 650000" />
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
                <label>Contractor *</label>
                <input className="form-control" required value={form.contractor} onChange={e => handleChange('contractor', e.target.value)} placeholder="e.g. ABC Constructions" />
              </div>
              <div className="form-group">
                <label>Progress % ({form.progress_percentage}%)</label>
                <input className="form-control" type="range" min="0" max="100" value={form.progress_percentage} onChange={e => handleChange('progress_percentage', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Work Description</label>
                <input className="form-control" value={form.work_description} onChange={e => handleChange('work_description', e.target.value)} placeholder="Construction of health center" />
              </div>
              <div className="form-group">
                <label>Contractor Past Projects</label>
                <input className="form-control" type="number" min="0" value={form.previous_contractor_projects} onChange={e => handleChange('previous_contractor_projects', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Past Cost Overruns</label>
                <input className="form-control" type="number" min="0" value={form.previous_contractor_overruns} onChange={e => handleChange('previous_contractor_overruns', e.target.value)} />
              </div>
            </div>
            {error && <div style={{color:'var(--risk-critical)', marginBottom:12, fontSize:'0.85rem'}}>❌ {error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%', justifyContent:'center', padding:'12px', fontSize:'0.95rem'}}>
              {loading ? <><div className="spinner" style={{width:16, height:16, borderWidth:2}}></div> Analyzing...</> : '🔬 Run AI Risk Analysis'}
            </button>
          </form>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <>
              {/* Risk Gauge */}
              <div className="panel" style={{textAlign:'center'}}>
                <div className="risk-gauge">
                  <div className="gauge-value" style={{color: riskColor}}>{result.risk_score}</div>
                  <div className="gauge-label">
                    <span className={`risk-badge ${riskCat}`} style={{fontSize:'0.85rem', padding:'5px 14px'}}>{riskCat} Risk</span>
                  </div>
                </div>
                <div style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
                  Model confidence: {(result.model_confidence * 100).toFixed(0)}% • Computed: {new Date(result.computed_at).toLocaleString()}
                </div>
              </div>

              {/* Sub-scores */}
              <div className="stats-grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                <div className="stat-card">
                  <div className="stat-label">Anomaly Score</div>
                  <div className="stat-value" style={{fontSize:'1.4rem'}}>{result.anomaly_score?.toFixed(3)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Fraud Probability</div>
                  <div className="stat-value" style={{fontSize:'1.4rem', color: result.fraud_risk?.probability > 0.5 ? 'var(--risk-critical)' : 'var(--text-heading)'}}>
                    {(result.fraud_risk?.probability * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Efficiency Score</div>
                  <div className="stat-value" style={{fontSize:'1.4rem'}}>{result.efficiency_risk?.score?.toFixed(3)}</div>
                  <div className="stat-sub">{result.efficiency_risk?.days_behind_schedule} days behind</div>
                </div>
              </div>

              {/* Fraud Indicators */}
              <div className="panel">
                <div className="panel-header"><h3>Fraud Analysis</h3></div>
                <div style={{marginBottom:8}}>
                  {result.fraud_risk?.indicators?.map((ind, i) => (
                    <span key={i} className="risk-badge high" style={{marginRight:6, marginBottom:4}}>{ind}</span>
                  ))}
                </div>
                <div className="explanation-card">{result.fraud_risk?.explanation}</div>
              </div>

              {/* Efficiency */}
              <div className="panel">
                <div className="panel-header"><h3>Efficiency Analysis</h3></div>
                <div className="explanation-card">{result.efficiency_risk?.explanation}</div>
              </div>

              {/* Recommendations */}
              <div className="panel">
                <div className="panel-header"><h3>Recommendations</h3></div>
                <div className="result-section">
                  {result.recommendations?.map((rec, i) => (
                    <div key={i} className="recommendation-item">
                      <span className="rec-icon">⚡</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12, padding:'10px 14px', background:'var(--bg-input)', borderRadius:'6px', fontSize:'0.82rem', color:'var(--text-secondary)'}}>
                  📢 Alert Escalation: {result.alert_escalation}
                </div>
              </div>
            </>
          ) : (
            <div className="panel" style={{textAlign:'center', padding:60}}>
              <div style={{fontSize:'3rem', marginBottom:12, opacity:0.3}}>🔬</div>
              <h3 style={{color:'var(--text-muted)', fontWeight:500}}>Submit project details to run AI analysis</h3>
              <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:8}}>
                The engine will score anomaly risk, fraud probability, and efficiency using the trained ensemble model.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
