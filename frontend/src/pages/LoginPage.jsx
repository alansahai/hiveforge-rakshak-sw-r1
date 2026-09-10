import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, fetchDemoUsers } from '../api/client';

const ROLE_ICONS = { mp: '🏛️', district: '📍', state: '🚩', ministry: '🌐' };
const ROLE_LABELS = {
  mp: 'Member of Parliament',
  district: 'District Authority',
  state: 'State Nodal Officer',
  ministry: 'Ministry Official (MoSPI)',
};
const ROLE_REDIRECT = { mp: '/mp', district: '/district', state: '/state', ministry: '/ministry' };

const DEMO_CREDENTIALS = [
  { role: 'mp', username: 'mp_demo', password: 'demo123' },
  { role: 'district', username: 'district_demo', password: 'demo123' },
  { role: 'state', username: 'state_demo', password: 'demo123' },
  { role: 'ministry', username: 'ministry_demo', password: 'demo123' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login(username, password);
      const redirect = ROLE_REDIRECT[data.role] || '/';
      navigate(redirect);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid credentials. Please try again.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (cred) => {
    setUsername(cred.username);
    setPassword(cred.password);
    setSelectedRole(cred.role);
    setError('');
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-orb orb1" />
        <div className="login-bg-orb orb2" />
        <div className="login-bg-orb orb3" />
      </div>

      <div className="login-container">
        {/* Left — branding */}
        <div className="login-brand">
          <div className="login-brand-icon">🇮🇳</div>
          <h1 className="login-brand-title">MPLADS AI Monitor</h1>
          <p className="login-brand-sub">Smart Anomaly Detection & Fraud Prevention</p>
          <div className="login-brand-stats">
            <div className="brand-stat">
              <span className="brand-stat-val">98K+</span>
              <span className="brand-stat-lbl">Projects Monitored</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-val">38%</span>
              <span className="brand-stat-lbl">Flagged High Risk</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-val">4 Roles</span>
              <span className="brand-stat-lbl">Multi-Role Access</span>
            </div>
          </div>
          <p className="login-brand-note">
            Government of India · Ministry of Statistics &amp; Programme Implementation · SIH 2026
          </p>
        </div>

        {/* Right — form */}
        <div className="login-form-card">
          <div className="login-form-header">
            <h2>Sign In</h2>
            <p>Select your role or enter credentials below</p>
          </div>

          {/* Role selector */}
          <div className="role-selector">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                type="button"
                className={`role-btn ${selectedRole === cred.role ? 'active' : ''}`}
                onClick={() => fillDemo(cred)}
              >
                <span className="role-btn-icon">{ROLE_ICONS[cred.role]}</span>
                <span className="role-btn-label">{ROLE_LABELS[cred.role]}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                className="form-control"
                placeholder="e.g. mp_demo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="demo123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? (
                <><span className="spinner-sm" /> Signing in…</>
              ) : (
                '→ Sign In'
              )}
            </button>
          </form>

          <div className="login-demo-hint">
            <span>💡</span>
            <span>Click a role card above to auto-fill demo credentials. All roles use password <code>demo123</code>.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
