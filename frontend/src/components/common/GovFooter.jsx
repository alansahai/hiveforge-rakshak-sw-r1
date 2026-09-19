import React from 'react';
import { GovSealIcon, IconShieldCheck, IconExternalLink } from './GovIcons';

export default function GovFooter() {
  return (
    <footer className="gov-footer" role="contentinfo">
      {/* ── Top Tricolor Accent Line ── */}
      <div className="gov-tricolor-stripe" aria-hidden="true">
        <span className="stripe-saffron" />
        <span className="stripe-white" />
        <span className="stripe-green" />
      </div>

      <div className="gov-container gov-footer-main">
        <div className="gov-footer-grid">
          {/* Column 1: About */}
          <div className="gov-footer-col">
            <div className="gov-footer-brand">
              <GovSealIcon size={34} />
              <div>
                <h4 className="gov-footer-title">MPLADS Project Monitoring System</h4>
                <p className="gov-footer-subtitle">सांसद स्थानीय क्षेत्र विकास योजना — निगरानी प्रणाली</p>
              </div>
            </div>
            <p className="gov-footer-desc">
              An intelligent public expenditure analytics platform engineered to provide real-time
              anomaly detection, contractor nexus discovery, timeline overrun forecasting, and geo-spatial
              duplicate tracking for parliamentary constituency projects.
            </p>
          </div>

          {/* Column 2: Governance & Reference Links */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-heading">Statutory &amp; Scheme References</h4>
            <ul className="gov-footer-links">
              <li>
                <a href="#guidelines" onClick={(e) => e.preventDefault()} title="Revised MPLADS Guidelines">
                  Revised Scheme Guidelines (Feb 2023)
                </a>
              </li>
              <li>
                <a href="#rti" onClick={(e) => e.preventDefault()} title="Proactive Disclosures under RTI Act">
                  RTI Act Section 4(1)(b) Proactive Disclosures
                </a>
              </li>
              <li>
                <a href="#grievance" onClick={(e) => e.preventDefault()} title="Citizen Grievance Redressal">
                  Public Grievance Redressal Mechanism
                </a>
              </li>
              <li>
                <a href="#audit" onClick={(e) => e.preventDefault()} title="Audit and Comptroller Standards">
                  CAG Administrative &amp; Expenditure Audit Norms
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Standards & Accessibility */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-heading">Compliance &amp; Accessibility</h4>
            <ul className="gov-footer-links">
              <li>
                <span className="gov-badge-compliance">
                  <IconShieldCheck size={14} color="#166534" />
                  <span>GIGW 3.0 Compliant (Level AA)</span>
                </span>
              </li>
              <li>
                <span className="gov-badge-compliance">
                  <IconShieldCheck size={14} color="#166534" />
                  <span>WCAG 2.1 Contrast Accessible</span>
                </span>
              </li>
              <li>
                <span className="gov-footer-meta-item">
                  Platform Release: <strong>v2.4.0-SIH (Stable)</strong>
                </span>
              </li>
              <li>
                <span className="gov-footer-meta-item">
                  Data Pipeline: <strong>98K+ Project Ledger Verified</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Public Service Oversight Notice ── */}
        <div className="gov-footer-disclaimer-box">
          <p className="gov-disclaimer-text">
            <strong>Public Service Oversight Notice:</strong> This digital analytics platform utilizes open MPLADS datasets
            and verified administrative records to provide AI-assisted fund oversight, expenditure tracking, contractor risk discovery,
            and duplicate detection for parliamentary constituencies.
          </p>
        </div>

        {/* ── Bottom Strip ── */}
        <div className="gov-footer-bottom">
          <div className="gov-footer-copy">
            © 2026 MPLADS Project Monitoring &amp; Anomaly Detection Portal.
            Designed for Citizen Transparency &amp; Public Accountability.
          </div>
          <div className="gov-footer-time-stamp">
            Last System Ledger Refresh: 19 September 2026 · All Rights Reserved
          </div>
        </div>
      </div>
    </footer>
  );
}
