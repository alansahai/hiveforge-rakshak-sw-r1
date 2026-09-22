import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import {
  GovSealIcon,
  IconMP,
  IconDistrict,
  IconState,
  IconMinistry,
  IconShieldCheck,
  IconAlertTriangle,
  IconHelpCircle
} from '../components/common/GovIcons';

const ROLE_ICONS = {
  mp: <IconMP size={20} />,
  district: <IconDistrict size={20} />,
  state: <IconState size={20} />,
  ministry: <IconMinistry size={20} />,
};

const ROLE_LABELS = {
  mp: 'Member of Parliament',
  district: 'District Authority',
  state: 'State Nodal Officer',
  ministry: 'Ministry Official (MoSPI)',
};

const ROLE_REDIRECT = {
  mp: '/mp',
  district: '/district',
  state: '/state',
  ministry: '/ministry'
};

const DEMO_CREDENTIALS = [
  { role: 'mp', username: 'mp_demo', password: 'demo123' },
  { role: 'district', username: 'district_demo', password: 'demo123' },
  { role: 'state', username: 'state_demo', password: 'demo123' },
  { role: 'ministry', username: 'ministry_demo', password: 'demo123' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role');
    if (roleParam) {
      const match = DEMO_CREDENTIALS.find((c) => c.role === roleParam);
      if (match) {
        setUsername(match.username);
        setPassword(match.password);
        setSelectedRole(match.role);
        setError('');
      }
    }
  }, [location.search]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError(language === 'hi' ? 'कृपया अपना आधिकारिक उपयोगकर्ता नाम और पासवर्ड दर्ज करें।' : 'Please enter your assigned username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login(username, password);
      const redirect = ROLE_REDIRECT[data.role] || '/overview';
      navigate(redirect, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || t('login_error_msg');
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
      <div className="login-container">
        {/* Left Side: Institutional Identity & Oversight Briefing */}
        <div className="login-brand">
          <div className="login-brand-header">
            <GovSealIcon size={52} />
            <div>
              <div style={{ color: '#FDBA74', fontSize: '0.85rem', fontWeight: 700 }}>
                {language === 'hi' ? 'भारत सरकार · सांख्यिकी मंत्रालय' : 'Government of India · MoSPI'}
              </div>
              <h1 className="login-brand-title">
                {language === 'hi' ? 'सांसद निधि निगरानी पोर्टल' : 'MPLADS e-Samiksha Portal'}
              </h1>
              <div style={{ color: '#CBD5E1', fontSize: '0.82rem', marginTop: 2 }}>
                {language === 'hi'
                  ? 'परियोजना निगरानी, विसंगति पहचान एवं निधि जवाबदेही प्रणाली'
                  : 'Project Monitoring, Anomaly Detection & Fund Oversight System'}
              </div>
            </div>
          </div>

          <p className="login-brand-sub">
            {language === 'hi'
              ? 'संसदीय निर्वाचन क्षेत्र विकास कार्यों की समयबद्धता, वित्तीय अनुशासन और वास्तविक भौतिक प्रगति की निगरानी हेतु आधिकारिक मंच।'
              : 'A secure administrative surveillance platform engineered for parliamentary constituency fund tracking, contractor risk discovery, and physical asset verification.'}
          </p>

          <div className="login-brand-stats">
            <div className="brand-stat">
              <span className="brand-stat-val">98K+</span>
              <span className="brand-stat-lbl">{language === 'hi' ? 'निगरानी कार्य' : 'Works Monitored'}</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-val">37</span>
              <span className="brand-stat-lbl">{language === 'hi' ? 'राज्य एवं संघ राज्य' : 'States & UTs'}</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-val">4 Roles</span>
              <span className="brand-stat-lbl">{language === 'hi' ? 'संस्थागत स्तर' : 'Multi-Tier Access'}</span>
            </div>
          </div>

          <ul className="login-brand-features">
            <li>
              <IconShieldCheck size={16} color="#86EFAC" />
              <span>{language === 'hi' ? 'लागत विचलन एवं समय सीमा की वास्तविक निगरानी' : 'Multi-layer anomaly detection (Cost overrun, contractor nexus, schedule drag)'}</span>
            </li>
            <li>
              <IconShieldCheck size={16} color="#86EFAC" />
              <span>{language === 'hi' ? 'भौगोलिक निर्देशांकों के आधार पर दोहरे कार्यों की रोकथाम' : 'Cross-boundary duplicate works prevention via geospatial coordinates'}</span>
            </li>
            <li>
              <IconShieldCheck size={16} color="#86EFAC" />
              <span>{language === 'hi' ? 'जियोटैग युक्त भौतिक परिसंपत्ति सत्यापन' : 'Geotagged physical asset verification with automated EXIF location validation'}</span>
            </li>
          </ul>

          <div className="login-brand-note">
            <strong>{language === 'hi' ? 'सुरक्षा सूचना:' : 'Security Notice:'}</strong>{' '}
            {language === 'hi'
              ? 'केवल अधिकृत सरकारी अधिकारी और प्रशासनिक लेखा परीक्षक। सभी सत्र वैधानिक निगरानी के अधीन हैं।'
              : 'Authorized government personnel and administrative auditors only. All sessions and data requests are monitored and logged under statutory governance norms.'}
          </div>
        </div>

        {/* Right Side: Secure Authentication Card */}
        <div className="login-form-card">
          <div className="login-back-bar">
            <button
              type="button"
              className="login-back-btn"
              onClick={() => navigate('/')}
              title="Return to Public Site Overview"
            >
              {language === 'hi' ? '← सार्वजनिक मुख्य पृष्ठ' : '← Back to Public Portal'}
            </button>
          </div>
          <div className="login-form-header">
            <h2>{t('login_heading')}</h2>
            <p>{t('login_subheading')}</p>
          </div>

          {/* Role selector */}
          <div className="role-selector" role="group" aria-label="Select Demo Role">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                type="button"
                className={`role-btn ${selectedRole === cred.role ? 'active' : ''}`}
                onClick={() => fillDemo(cred)}
                title={`Select ${ROLE_LABELS[cred.role]} role`}
              >
                <span className="role-btn-icon">{ROLE_ICONS[cred.role]}</span>
                <span className="role-btn-label">{ROLE_LABELS[cred.role]}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="login-error" role="alert">
                <IconAlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-username">{t('login_username')}</label>
              <input
                id="login-username"
                type="text"
                className="form-control"
                placeholder="e.g. mp_demo, district_demo, state_demo, ministry_demo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">{t('login_password')}</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px 16px', marginTop: 8 }}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" />{' '}
                  {language === 'hi' ? 'प्रमाणपत्र सत्यापित किए जा रहे हैं…' : 'Authenticating Credentials…'}
                </>
              ) : (
                t('login_submit')
              )}
            </button>
          </form>

          <div className="login-demo-hint">
            <IconHelpCircle size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>{language === 'hi' ? 'मूल्यांकन मार्गदर्शन:' : 'Evaluation Note:'}</strong>{' '}
              {language === 'hi'
                ? 'परीक्षण हेतु उपरोक्त 4 भूमिका बटनों में से किसी एक पर क्लिक करें। सभी डेमो खातों का डिफ़ॉल्ट पासवर्ड '
                : 'Click any of the four role buttons above to auto-populate test credentials. Default password for all demo accounts is '}
              <code>demo123</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
