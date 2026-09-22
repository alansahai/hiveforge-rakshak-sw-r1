import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GovHeader from '../components/common/GovHeader';
import GovFooter from '../components/common/GovFooter';
import TeamHiveForgeSection from '../components/TeamHiveForgeSection';
import {
  GovSealIcon,
  IconLock,
  IconArrowRight,
  IconShieldCheck,
  IconAlertTriangle,
  IconCpu,
  IconDatabase,
  IconNetwork,
  IconMapPin,
  IconFileText,
  IconMP,
  IconDistrict,
  IconState,
  IconMinistry,
  IconRupee,
  IconCheckCircle
} from '../components/common/GovIcons';
import { isAuthenticated, getCurrentRole } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export default function PublicPortalPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [theme, setTheme] = useState(() => localStorage.getItem('mplads_theme') || 'light');
  const loggedIn = isAuthenticated();
  const userRole = getCurrentRole();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mplads_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleRoleSelect = (role) => {
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="gov-portal-wrapper public-portal">
      {/* Institutional Global Header with Login Button */}
      <GovHeader theme={theme} onToggleTheme={toggleTheme} />

      {/* Main Public Information Surface */}
      <main id="main-content" className="public-content" tabIndex="-1">
        
        {/* ── 1. Institutional Hero Section ── */}
        <section className="public-hero">
          <div className="gov-container public-hero-inner">
            <div className="public-hero-badge">
              <GovSealIcon size={26} />
              <span>{t('mospi_name')} · {t('gov_title')}</span>
            </div>

            <h1 className="public-hero-title">
              {t('hero_title')}
            </h1>

            <p className="public-hero-lead">
              {t('hero_subtitle')}
            </p>

            <div className="public-hero-actions">
              {!loggedIn ? (
                <button
                  type="button"
                  className="btn btn-primary public-cta-btn"
                  onClick={() => navigate('/login')}
                  id="btn-public-login"
                >
                  <IconLock size={18} />
                  <span>{t('sign_in')}</span>
                  <IconArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary public-cta-btn"
                  onClick={() => navigate(`/${userRole || 'overview'}`)}
                  id="btn-public-dashboard"
                >
                  <span>{t('dashboard')}</span>
                  <IconArrowRight size={16} />
                </button>
              )}

              <a href="#telemetry" className="btn btn-outline public-explore-btn">
                <span>{language === 'hi' ? 'राष्ट्रीय संकेतक देखें' : 'Explore National Telemetry'}</span>
              </a>
            </div>
          </div>
        </section>

        {/* ── 2. Live National Telemetry Counters ── */}
        <section id="telemetry" className="public-section public-telemetry-section">
          <div className="gov-container">
            <div className="section-title-wrap">
              <span className="section-eyebrow">National Public Ledger</span>
              <h2 className="section-title">Verified Program Telemetry &amp; Macro Indicators</h2>
              <p className="section-subtitle">
                Continuous surveillance across all Parliamentary Constituencies with live algorithmic verification.
              </p>
            </div>

            <div className="public-stats-grid">
              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  <IconFileText size={22} />
                </div>
                <div className="public-stat-val">98,452+</div>
                <div className="public-stat-lbl">Development Works Monitored</div>
                <div className="public-stat-meta">Across 543 Parliamentary Constituencies</div>
              </div>

              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#ECFDF5', color: '#047857' }}>
                  <IconRupee size={22} />
                </div>
                <div className="public-stat-val">₹49,226 Cr</div>
                <div className="public-stat-lbl">Cumulative Central Outlay Tracked</div>
                <div className="public-stat-meta">Complete financial ledger reconciliation</div>
              </div>

              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                  <IconMapPin size={22} />
                </div>
                <div className="public-stat-val">37</div>
                <div className="public-stat-lbl">States &amp; Union Territories</div>
                <div className="public-stat-meta">Comprehensive pan-India coverage</div>
              </div>

              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#FEF3C7', color: '#B45309' }}>
                  <IconCheckCircle size={22} />
                </div>
                <div className="public-stat-val">80.1%</div>
                <div className="public-stat-lbl">National Utilization Velocity</div>
                <div className="public-stat-meta">₹39,410 Cr verified disbursed</div>
              </div>

              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#FFF1F2', color: '#BE123C' }}>
                  <IconAlertTriangle size={22} />
                </div>
                <div className="public-stat-val">2,418</div>
                <div className="public-stat-lbl">Preventative Audit Escalations</div>
                <div className="public-stat-meta">Early risk mitigation before disbursement</div>
              </div>

              <div className="public-stat-card">
                <div className="stat-card-icon-wrap" style={{ background: '#F0FDF4', color: '#15803D' }}>
                  <IconCpu size={22} />
                </div>
                <div className="public-stat-val">66</div>
                <div className="public-stat-lbl">Engineered AI Features</div>
                <div className="public-stat-meta">Real-time XGBoost + Autoencoder scoring</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. What is MPLADS & The AI Oversight Mandate ── */}
        <section className="public-section public-about-section">
          <div className="gov-container">
            <div className="public-about-grid">
              <div className="public-about-text">
                <span className="section-eyebrow">Institutional Overview</span>
                <h2 className="section-title">Members of Parliament Local Area Development Scheme</h2>
                <p className="public-about-desc">
                  The MPLADS scheme was instituted by the Government of India to empower Members of Parliament (MPs)
                  to recommend developmental works of capital nature based on locally felt community needs.
                  Priority sectors include drinking water, primary education, sanitation, roads, bridges, irrigation,
                  and public health infrastructure.
                </p>
                <p className="public-about-desc">
                  Under the <strong>Revised Scheme Guidelines (February 2023)</strong> issued by the Ministry of Statistics
                  and Programme Implementation (MoSPI), the entire process has been digitized. This portal acts as the
                  central intelligence engine, continuously monitoring project lifecycles to ensure that every rupee
                  serves public welfare without delay, cost escalation, or improper procurement collusion.
                </p>
                <div className="public-key-principles">
                  <div className="principle-item">
                    <IconCheckCircle size={18} color="#15803D" />
                    <div>
                      <strong>Zero Duplicate Funding:</strong> Prevents multiple sanctions at identical geographic sites.
                    </div>
                  </div>
                  <div className="principle-item">
                    <IconCheckCircle size={18} color="#15803D" />
                    <div>
                      <strong>Contractor Cartel Immunity:</strong> Detects shell bidders and skewed vendor allocations.
                    </div>
                  </div>
                  <div className="principle-item">
                    <IconCheckCircle size={18} color="#15803D" />
                    <div>
                      <strong>Statutory Audit Dossiers:</strong> Generates instant CAG and RTI compliant audit documentation.
                    </div>
                  </div>
                </div>
              </div>

              <div className="public-about-card">
                <div className="about-card-badge">Digital Governance Engine</div>
                <h3>Scheme Architecture &amp; Fund Flow</h3>
                <ul className="public-flow-list">
                  <li>
                    <span className="flow-step-num">01</span>
                    <div>
                      <strong>Constituency Allocation:</strong> ₹5.00 Crore per MP annually in two equal installments.
                    </div>
                  </li>
                  <li>
                    <span className="flow-step-num">02</span>
                    <div>
                      <strong>District Sanction:</strong> District Authority validates eligibility, cost estimates, and implements works.
                    </div>
                  </li>
                  <li>
                    <span className="flow-step-num">03</span>
                    <div>
                      <strong>AI Surveillance:</strong> Automatic audit scans for budget inflation, cartel bids, and milestone delays.
                    </div>
                  </li>
                  <li>
                    <span className="flow-step-num">04</span>
                    <div>
                      <strong>Physical Inspection:</strong> Geotagged photographic verification before final utilization release.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. The Four Core AI Technology Pillars ── */}
        <section className="public-section public-pillars-section">
          <div className="gov-container">
            <div className="section-title-wrap">
              <span className="section-eyebrow">Advanced Analytics Architecture</span>
              <h2 className="section-title">The Four Pillars of Algorithmic Governance</h2>
              <p className="section-subtitle">
                Engineered for maximum reliability, mathematical rigor, and explainability under Indian statutory audit standards.
              </p>
            </div>

            <div className="public-pillars-grid">
              <div className="pillar-card">
                <div className="pillar-header">
                  <div className="pillar-icon-box" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                    <IconCpu size={26} />
                  </div>
                  <span className="pillar-number">Pillar 01</span>
                </div>
                <h3 className="pillar-title">Multi-Model Anomaly Ensemble</h3>
                <p className="pillar-desc">
                  Combines three complementary machine learning architectures: <strong>Isolation Forest</strong> for multidimensional outlier isolation,
                  <strong>Autoencoder Neural Networks</strong> for non-linear reconstruction deviation, and <strong>XGBoost</strong> calibrated on historical CAG audit irregularities.
                </p>
                <div className="pillar-footer">
                  <span className="pillar-tag">66 Scrutiny Variables</span>
                  <span className="pillar-tag">Real-Time Scoring</span>
                </div>
              </div>

              <div className="pillar-card">
                <div className="pillar-header">
                  <div className="pillar-icon-box" style={{ background: '#ECFDF5', color: '#047857' }}>
                    <IconMapPin size={26} />
                  </div>
                  <span className="pillar-number">Pillar 02</span>
                </div>
                <h3 className="pillar-title">Geospatial Duplicate Tracking</h3>
                <p className="pillar-desc">
                  Leverages high-precision <strong>Haversine coordinate clustering</strong> and spatial buffer zones to detect duplicate or overlapping works
                  sanctioned within a 500-meter radius across consecutive fiscal years or overlapping assembly boundaries.
                </p>
                <div className="pillar-footer">
                  <span className="pillar-tag">GPS Coordinate Radius</span>
                  <span className="pillar-tag">Zero Double-Billing</span>
                </div>
              </div>

              <div className="pillar-card">
                <div className="pillar-header">
                  <div className="pillar-icon-box" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                    <IconNetwork size={26} />
                  </div>
                  <span className="pillar-number">Pillar 03</span>
                </div>
                <h3 className="pillar-title">Contractor Cartel Nexus Graph</h3>
                <p className="pillar-desc">
                  3D graph network analysis tracking vendor-district co-occurrence. Automatically identifies bid-rigging rings,
                  monopolistic fund capture, contractor address collusion, and disproportionate contract awards to interconnected entities.
                </p>
                <div className="pillar-footer">
                  <span className="pillar-tag">Graph Topology</span>
                  <span className="pillar-tag">Nexus Flagging</span>
                </div>
              </div>

              <div className="pillar-card">
                <div className="pillar-header">
                  <div className="pillar-icon-box" style={{ background: '#FEF3C7', color: '#B45309' }}>
                    <IconShieldCheck size={26} />
                  </div>
                  <span className="pillar-number">Pillar 04</span>
                </div>
                <h3 className="pillar-title">
                  {language === 'hi' ? 'पारदर्शी ऑडिट एवं स्पष्ट जोखिम कारण' : 'Transparent Audit & Reasoned Risk Attribution'}
                </h3>
                <p className="pillar-desc">
                  {language === 'hi'
                    ? 'प्रत्येक जोखिम मूल्यांकन के साथ स्पष्ट प्रशासनिक और प्रगति कारकों का विवरण, जो नोडल अधिकारियों को पारदर्शी निर्णय लेने में सक्षम बनाता है।'
                    : 'Zero unverified decisions. Every risk evaluation is accompanied by explicit administrative feature contributions, translating anomaly indicators into transparent, structured audit justifications for nodal officers.'}
                </p>
                <div className="pillar-footer">
                  <span className="pillar-tag">Audit Trail</span>
                  <span className="pillar-tag">Administrative Transparency</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Multi-Tier Role-Based Governance Access ── */}
        <section className="public-section public-roles-section">
          <div className="gov-container">
            <div className="section-title-wrap">
              <span className="section-eyebrow">
                {language === 'hi' ? 'प्रशासनिक पदानुक्रम' : 'Administrative Hierarchy'}
              </span>
              <h2 className="section-title">
                {language === 'hi' ? 'भूमिका-आधारित शासन पोर्टल' : 'Role-Based Governance Portals'}
              </h2>
              <p className="section-subtitle">
                {language === 'hi'
                  ? 'सरकारी प्रशासन के प्रत्येक स्तर के वैधानिक दायित्वों के अनुरूप समर्पित डैशबोर्ड।'
                  : 'Dedicated interfaces tailored to the statutory responsibilities of each level of government administration.'}
              </p>
            </div>

            <div className="public-roles-grid">
              {/* Role 1: MP */}
              <div className="role-portal-card">
                <div className="role-card-top">
                  <div className="role-badge-icon mp-color">
                    <IconMP size={24} />
                  </div>
                  <div>
                    <span className="role-tier">Constituency Tier</span>
                    <h3 className="role-name">
                      {language === 'hi' ? 'सांसद (लोकसभा / राज्यसभा)' : 'Member of Parliament (MP)'}
                    </h3>
                  </div>
                </div>
                <p className="role-card-desc">
                  Track recommended works, monitor fund sanction approvals, review physical milestone completion, and receive automated contractor risk alerts.
                </p>
                <ul className="role-features-list">
                  <li>Constituency capital allocation ledger</li>
                  <li>Work recommendation tracking</li>
                  <li>Citizen grievance integration</li>
                </ul>
                <button
                  type="button"
                  className="btn btn-outline role-access-btn"
                  onClick={() => handleRoleSelect('mp')}
                >
                  <IconLock size={14} />
                  <span>{language === 'hi' ? 'सांसद पोर्टल लॉगिन' : 'Sign In as MP'}</span>
                  <IconArrowRight size={14} />
                </button>
              </div>

              {/* Role 2: District Authority */}
              <div className="role-portal-card">
                <div className="role-card-top">
                  <div className="role-badge-icon district-color">
                    <IconDistrict size={24} />
                  </div>
                  <div>
                    <span className="role-tier">Implementation Tier</span>
                    <h3 className="role-name">
                      {language === 'hi' ? 'जिला मजिस्ट्रेट / उपायुक्त' : 'District Authority (DM / DC)'}
                    </h3>
                  </div>
                </div>
                <p className="role-card-desc">
                  Execute works, supervise technical sanctions, inspect contractor milestones, disburse funds, and submit geotagged physical verification photos.
                </p>
                <ul className="role-features-list">
                  <li>Administrative sanction issuance</li>
                  <li>Vendor disbursement validation</li>
                  <li>Geotagged site inspection records</li>
                </ul>
                <button
                  type="button"
                  className="btn btn-outline role-access-btn"
                  onClick={() => handleRoleSelect('district')}
                >
                  <IconLock size={14} />
                  <span>{language === 'hi' ? 'जिला प्राधिकरण लॉगिन' : 'Sign In as District Authority'}</span>
                  <IconArrowRight size={14} />
                </button>
              </div>

              {/* Role 3: State Nodal */}
              <div className="role-portal-card">
                <div className="role-card-top">
                  <div className="role-badge-icon state-color">
                    <IconState size={24} />
                  </div>
                  <div>
                    <span className="role-tier">State Level Tier</span>
                    <h3 className="role-name">
                      {language === 'hi' ? 'राज्य नोडल विभाग' : 'State Nodal Officer'}
                    </h3>
                  </div>
                </div>
                <p className="role-card-desc">
                  Monitor state-wide implementation trends, compare inter-district performance, identify regional bottleneck clusters, and oversee compliance.
                </p>
                <ul className="role-features-list">
                  <li>Inter-district performance metrics</li>
                  <li>State anomaly heatmap scrutiny</li>
                  <li>Stalled projects intervention</li>
                </ul>
                <button
                  type="button"
                  className="btn btn-outline role-access-btn"
                  onClick={() => handleRoleSelect('state')}
                >
                  <IconLock size={14} />
                  <span>{language === 'hi' ? 'राज्य नोडल लॉगिन' : 'Sign In as State Nodal'}</span>
                  <IconArrowRight size={14} />
                </button>
              </div>

              {/* Role 4: Central Ministry */}
              <div className="role-portal-card">
                <div className="role-card-top">
                  <div className="role-badge-icon ministry-color">
                    <IconMinistry size={24} />
                  </div>
                  <div>
                    <span className="role-tier">National Oversight Tier</span>
                    <h3 className="role-name">
                      {language === 'hi' ? 'सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय' : 'Ministry Official (MoSPI)'}
                    </h3>
                  </div>
                </div>
                <p className="role-card-desc">
                  Macro-level national analytics, inter-state benchmarking, algorithmic risk threshold management, and automated CAG audit report generation.
                </p>
                <ul className="role-features-list">
                  <li>Pan-India expenditure analytics</li>
                  <li>Systemic cartel network detection</li>
                  <li>Statutory audit dossier export</li>
                </ul>
                <button
                  type="button"
                  className="btn btn-outline role-access-btn"
                  onClick={() => handleRoleSelect('ministry')}
                >
                  <IconLock size={14} />
                  <span>{language === 'hi' ? 'मंत्रालय अधिकारी लॉगिन' : 'Sign In as Ministry Official'}</span>
                  <IconArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. 4-Step Governance Lifecycle ── */}
        <section className="public-section public-lifecycle-section">
          <div className="gov-container">
            <div className="section-title-wrap">
              <span className="section-eyebrow">Operating Protocol</span>
              <h2 className="section-title">The 4-Step Intelligent Governance Workflow</h2>
              <p className="section-subtitle">
                From constituency recommendation to verified asset completion.
              </p>
            </div>

            <div className="public-steps-grid">
              <div className="step-card">
                <div className="step-num">Step 1</div>
                <h4 className="step-title">Recommendation &amp; Sanction</h4>
                <p className="step-desc">
                  Hon'ble MP recommends public infrastructure work. District Authority verifies statutory eligibility and issues administrative sanction.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num">Step 2</div>
                <h4 className="step-title">Automated Ledger Ingestion</h4>
                <p className="step-desc">
                  Tender specifications, vendor credentials, GPS coordinates, and budgeted outlays are ingested into the centralized ledger.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num">Step 3</div>
                <h4 className="step-title">Appraisal &amp; Risk Scoring</h4>
                <p className="step-desc">
                  Multi-factor risk appraisal scans for cost inflation, contractor concentration, and duplicate spatial footprints, assigning a 0-100 score.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num">Step 4</div>
                <h4 className="step-title">Administrative Audit &amp; Resolution</h4>
                <p className="step-desc">
                  Flagged items trigger automated audit inquiries and site inspections before fund disbursements are authorized.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Direct Official Login CTA Banner ── */}
        <section className="public-cta-banner">
          <div className="gov-container public-cta-banner-inner">
            <div className="public-cta-text">
              <h2>Enter the Authorized MPLADS Oversight Portal</h2>
              <p>
                Authorized government personnel, MPs, District Magistrates, and auditors may log in to access full data ledgers.
              </p>
            </div>
            <div className="public-cta-button-group">
              <button
                type="button"
                className="btn btn-primary cta-banner-btn"
                onClick={() => navigate('/login')}
              >
                <IconLock size={18} />
                <span>{t('sign_in')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 8. Meet the Developer Team — Team HiveForge (Sri Ramakrishna Institute of Technology) ── */}
        <TeamHiveForgeSection />

      </main>

      {/* Full-width Institutional Footer */}
      <GovFooter />
    </div>
  );
}
