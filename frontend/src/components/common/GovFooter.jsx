import React from 'react';
import { GovSealIcon, IconShieldCheck } from './GovIcons';
import { useLanguage } from '../../context/LanguageContext';

export default function GovFooter() {
  const { language, t } = useLanguage();

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
                <h4 className="gov-footer-title">
                  {t('portal_title')}
                </h4>
                <p className="gov-footer-subtitle">
                  {t('mospi_name')}
                </p>
              </div>
            </div>
            <p className="gov-footer-desc">
              {language === 'hi'
                ? 'संसदीय निर्वाचन क्षेत्र विकास योजना (एमपीलैड्स) कार्यों की वास्तविक समय पर निगरानी, निधि प्रवाह और पारदर्शिता सुनिश्चित करने हेतु आधिकारिक पोर्टल।'
                : 'A public expenditure assurance platform engineered for real-time fund tracking, physical milestone verification, and transparency across parliamentary constituency works.'}
            </p>
          </div>

          {/* Column 2: Governance & Reference Links */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-heading">
              {language === 'hi' ? 'वैधानिक एवं योजना संदर्भ' : 'Statutory & Scheme References'}
            </h4>
            <ul className="gov-footer-links">
              <li>
                <a href="#guidelines" onClick={(e) => e.preventDefault()} title="Revised Scheme Guidelines">
                  {language === 'hi' ? 'संशोधित योजना दिशानिर्देश (2023)' : 'Revised Scheme Guidelines (Feb 2023)'}
                </a>
              </li>
              <li>
                <a href="#rti" onClick={(e) => e.preventDefault()} title="RTI Proactive Disclosures">
                  {language === 'hi' ? 'आरटीआई अधिनियम धारा 4(1)(b) स्वतः प्रकटीकरण' : 'RTI Act Section 4(1)(b) Proactive Disclosures'}
                </a>
              </li>
              <li>
                <a href="#grievance" onClick={(e) => e.preventDefault()} title="Citizen Grievance Redressal">
                  {language === 'hi' ? 'लोक शिकायत निवारण प्रणाली' : 'Public Grievance Redressal Mechanism'}
                </a>
              </li>
              <li>
                <a href="#audit" onClick={(e) => e.preventDefault()} title="CAG Audit Norms">
                  {language === 'hi' ? 'कैग (CAG) प्रशासनिक एवं व्यय लेखा परीक्षा मानक' : 'CAG Administrative & Expenditure Audit Norms'}
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Standards & Accessibility */}
          <div className="gov-footer-col">
            <h4 className="gov-footer-heading">
              {language === 'hi' ? 'प्रणाली मानक एवं अनुपालन' : 'System Standards & Coverage'}
            </h4>
            <ul className="gov-footer-links">
              <li>
                <span className="gov-badge-compliance">
                  <IconShieldCheck size={14} color="#166534" />
                  <span>{language === 'hi' ? 'अखिल भारतीय निगरानी कवरेज' : 'Pan-India Monitoring Ledger'}</span>
                </span>
              </li>
              <li>
                <span className="gov-badge-compliance">
                  <IconShieldCheck size={14} color="#166534" />
                  <span>{language === 'hi' ? 'सुलभता एवं कंट्रास्ट अनुपालित' : 'High Contrast Accessible Design'}</span>
                </span>
              </li>
              <li>
                <span className="gov-footer-meta-item">
                  {language === 'hi' ? 'प्लेटफ़ॉर्म संस्करण:' : 'Platform Build:'} <strong>v2.4.0 (Stable)</strong>
                </span>
              </li>
              <li>
                <span className="gov-footer-meta-item">
                  {language === 'hi' ? 'परियोजना डेटा:' : 'Data Scope:'} <strong>98K+ Works Monitored</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Public Service Oversight Notice ── */}
        <div className="gov-footer-disclaimer-box">
          <p className="gov-disclaimer-text">
            <strong>{language === 'hi' ? 'सार्वजनिक सेवा सूचना:' : 'Public Service Oversight Notice:'}</strong>{' '}
            {t('footer_disclaimer')}
          </p>
        </div>

        {/* ── Bottom Strip ── */}
        <div className="gov-footer-bottom">
          <div className="gov-footer-copy">
            {t('footer_copyright')}
          </div>
          <div className="gov-footer-time-stamp">
            {language === 'hi' ? 'अंतिम डेटा अद्यतन: 2026 · सर्वाधिकार सुरक्षित' : 'Last Ledger Refresh: September 2026 · All Rights Reserved'}
          </div>
        </div>
      </div>
    </footer>
  );
}
