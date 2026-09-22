import React from 'react';
import {
  IconCpu,
  IconShieldCheck,
  IconNetwork,
  IconMapPin,
  IconUsers,
  IconFileText
} from './common/GovIcons';
import teamSilhouetteImg from '../assets/team_hiveforge_silhouette.jpg';
import { useLanguage } from '../context/LanguageContext';

export default function TeamHiveForgeSection() {
  const { language } = useLanguage();

  return (
    <section className="public-section team-section" id="developer-team">
      <div className="gov-container">
        {/* Two-Column Split Grid */}
        <div className="team-split-grid">
          
          {/* LEFT COLUMN: Team Photo Showcase Card */}
          <div className="team-left-col">
            <div className="team-shadow-showcase-card">
              
              {/* Header Badges */}
              <div className="team-badge-header">
                <span className="team-innovator-badge">Smart India Hackathon 2026</span>
                <span className="team-srit-tag">Sri Ramakrishna Institute of Technology</span>
              </div>

              {/* Clean Team Photograph Container (No futuristic HUD/scanlines) */}
              <div className="team-art-frame">
                <img
                  src={teamSilhouetteImg}
                  alt="Team HiveForge — Sri Ramakrishna Institute of Technology"
                  className="team-silhouette-photo"
                  loading="lazy"
                />
              </div>

              {/* Pedestal Caption */}
              <div className="team-shadow-caption">
                <span className="team-shadow-pill">
                  <IconUsers size={14} color="#FF9933" />
                  <span>Team HiveForge · Engineering Unit</span>
                </span>
                <span className="team-shadow-subpill">Sri Ramakrishna Institute of Technology, Coimbatore</span>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: Factual Engineering Description */}
          <div className="team-right-col">
            <div className="team-content-card">
              
              <div className="team-eyebrow-wrap">
                <span className="section-eyebrow">
                  {language === 'hi' ? 'सॉफ्टवेयर इंजीनियरिंग एवं सिस्टम आर्किटेक्चर' : 'Software Engineering & System Architecture'}
                </span>
              </div>

              <h2 className="team-heading">
                {language === 'hi' ? 'विकासक दल — ' : 'Engineering Team — '}
                <span>Team HiveForge</span>
              </h2>

              <div className="team-institution-title">
                Sri Ramakrishna Institute of Technology (SRIT)
              </div>

              <p className="team-summary-text">
                {language === 'hi'
                  ? 'टीम हाइवफोर्ज श्री रामकृष्ण इंस्टीट्यूट ऑफ टेक्नोलॉजी की एक इंजीनियरिंग टीम है, जिसने सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI) के लिए सांसद निधि योजना निगरानी प्रणाली का प्रोटोटाइप विकसित किया है।'
                  : 'Team HiveForge is an engineering development team from Sri Ramakrishna Institute of Technology (SRIT), building the prototype MPLADS Project Monitoring System for the Ministry of Statistics and Programme Implementation (MoSPI).'}
              </p>

              <p className="team-summary-text">
                {language === 'hi'
                  ? 'यह प्रणाली आधुनिक वेब मानकों, मशीन लर्निंग आधारित विसंगति विश्लेषण और भौगोलिक सूचना तंत्र (GIS) का उपयोग करके पारदर्शी परियोजना ट्रैकिंग प्रदान करती है।'
                  : 'The solution combines modern web standards, machine learning risk appraisal, and spatial coordinate verification into a dependable public-sector monitoring dashboard.'}
              </p>

              {/* Technical Architecture Highlights */}
              <div className="team-versatility-box">
                <h4 className="versatility-heading">
                  {language === 'hi' ? 'प्रमुख तकनीकी विशेषताएं' : 'Technical Architecture & Stack'}
                </h4>
                
                <div className="versatility-list">
                  
                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                      <IconCpu size={18} />
                    </div>
                    <div>
                      <strong>{language === 'hi' ? 'मशीन लर्निंग जोखिम मूल्यांकन:' : 'Machine Learning Risk Appraisal:'}</strong>
                      <p>
                        {language === 'hi'
                          ? 'आइसोलेशन फॉरेस्ट और ग्रेडिएंट बूस्टेड ट्री एल्गोरिदम के माध्यम से वित्तीय और समय-सीमा विचलन का पारदर्शी विश्लेषण।'
                          : 'Isolation Forest and Gradient Boosted Decision Trees analyzing cost variances and milestone lag against historical district baselines.'}
                      </p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#ECFDF5', color: '#047857' }}>
                      <IconMapPin size={18} />
                    </div>
                    <div>
                      <strong>{language === 'hi' ? 'स्थानिक डुप्लिकेट कार्य पहचान:' : 'Geospatial Duplicate Verification:'}</strong>
                      <p>
                        {language === 'hi'
                          ? 'हवरसाइन दूरी गणना और जीपीएस निर्देशांकों के आधार पर अंतर-जिला दोहरे कार्यों की पहचान।'
                          : 'Haversine distance calculation cross-referencing latitude-longitude coordinates to prevent duplicate sanctions within adjacent boundaries.'}
                      </p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                      <IconNetwork size={18} />
                    </div>
                    <div>
                      <strong>{language === 'hi' ? 'अनुबंधक संकेंद्रण विश्लेषण:' : 'Contractor Allocation Analytics:'}</strong>
                      <p>
                        {language === 'hi'
                          ? 'जिला स्तर पर विक्रेताओं की कार्य क्षमता और समवर्ती कार्य आवंटन की निगरानी।'
                          : 'Relational mapping tracking vendor allocation concurrency, expenditure velocity, and historical completion rates.'}
                      </p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#FEF3C7', color: '#B45309' }}>
                      <IconShieldCheck size={18} />
                    </div>
                    <div>
                      <strong>{language === 'hi' ? 'भूमिका-आधारित प्रशासनिक पहुंच:' : 'Role-Based Governance (RBAC):'}</strong>
                      <p>
                        {language === 'hi'
                          ? 'संसदीय, जिला, राज्य और केंद्रीय मंत्रालय स्तर पर विशिष्ट वैधानिक कार्यप्रवाह और सुरक्षित प्रमाणीकरण।'
                          : 'Tailored administrative workflows and secure authentication for District, State Nodal, MP, and Ministry authorities.'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Technical Highlights Pills */}
              <div className="team-tags-row">
                <span className="team-tag-pill">React 18 SPA</span>
                <span className="team-tag-pill">Python FastAPI</span>
                <span className="team-tag-pill">XGBoost &amp; TreeSHAP</span>
                <span className="team-tag-pill">GeoSpatial Analytics</span>
                <span className="team-tag-pill">Sri Ramakrishna Institute of Technology</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
