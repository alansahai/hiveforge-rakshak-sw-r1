import React from 'react';
import {
  IconCpu,
  IconShieldCheck,
  IconNetwork,
  IconMapPin,
  IconUsers,
  IconCheckCircle
} from './common/GovIcons';
import teamSilhouetteImg from '../assets/team_hiveforge_silhouette.jpg';

export default function TeamHiveForgeSection() {
  return (
    <section className="public-section team-section" id="developer-team">
      <div className="gov-container">
        
        {/* Two-Column Split Grid */}
        <div className="team-split-grid">
          
          {/* LEFT COLUMN: Futuristic Shadowy Team Silhouette Artwork & HUD */}
          <div className="team-left-col">
            <div className="team-shadow-showcase-card">
              
              {/* Header Badges */}
              <div className="team-badge-header">
                <span className="team-innovator-badge">National Innovation · SIH 2026</span>
                <span className="team-srit-tag">Sri Ramakrishna Institute of Technology</span>
              </div>

              {/* Cinematic Futuristic Shadow Silhouette */}
              <div className="team-art-frame">
                <img
                  src={teamSilhouetteImg}
                  alt="Team HiveForge standing together in futuristic shadowy silhouette with cyan holographic backlighting"
                  className="team-silhouette-photo"
                  loading="lazy"
                />
                
                {/* Holographic Cyber Tech Overlays */}
                <div className="art-scanline-overlay" aria-hidden="true" />
                <div className="art-glow-border" aria-hidden="true" />
                
                {/* Floating HUD Badges */}
                <div className="art-hud-badge top-left">
                  <span className="hud-dot" />
                  <span>ENG_UNIT // HIVEFORGE</span>
                </div>
                <div className="art-hud-badge bottom-right">
                  <span>DEPLOYED // GOV_AI_OVERSIGHT</span>
                </div>
              </div>

              {/* Bottom Pedestal Caption */}
              <div className="team-shadow-caption">
                <span className="team-shadow-pill">
                  <IconUsers size={14} color="#FF9933" />
                  <span>Team HiveForge · Engineering Innovation Unit</span>
                </span>
                <span className="team-shadow-subpill">Sri Ramakrishna Institute of Technology</span>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: Short Description & Versatility of the Team */}
          <div className="team-right-col">
            <div className="team-content-card">
              
              <div className="team-eyebrow-wrap">
                <span className="section-eyebrow">Innovation &amp; Engineering Team</span>
              </div>

              <h2 className="team-heading">
                Meet the Developer Team — <span>Team HiveForge</span>
              </h2>

              <div className="team-institution-title">
                Sri Ramakrishna Institute of Technology (SRIT)
              </div>

              <p className="team-summary-text">
                <strong>Team HiveForge</strong> is an engineering innovation unit from <strong>Sri Ramakrishna Institute of Technology</strong>,
                conceived to address one of the most vital imperatives in public administration: real-time expenditure surveillance,
                anti-corruption intelligence, and duplicate prevention for the Members of Parliament Local Area Development Scheme (MPLADS).
              </p>

              <p className="team-summary-text">
                United under the banner of the Smart India Hackathon (SIH 2026), the team has built a resilient, multi-tiered
                digital audit architecture that empowers constitutional stakeholders with actionable algorithmic oversight.
              </p>

              {/* Versatility of the Team */}
              <div className="team-versatility-box">
                <h4 className="versatility-heading">Versatility of Team HiveForge</h4>
                
                <div className="versatility-list">
                  
                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                      <IconCpu size={18} />
                    </div>
                    <div>
                      <strong>Multi-Model Anomaly Ensemble:</strong>
                      <p>Harnessing Isolation Forests, Deep Autoencoder networks, and XGBoost calibrated with 66 forensic parameters to pinpoint budget distortions.</p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#ECFDF5', color: '#047857' }}>
                      <IconMapPin size={18} />
                    </div>
                    <div>
                      <strong>Geospatial &amp; Cartographic Precision:</strong>
                      <p>Implementing sub-500m Haversine geographic buffer clusters to identify and eradicate duplicate project sanctions across overlapping boundaries.</p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                      <IconNetwork size={18} />
                    </div>
                    <div>
                      <strong>Graph Analytics &amp; Cartel Intelligence:</strong>
                      <p>Uncovering vendor-district monopolies, shell contractors, and synthetic bidding cartels using 3D network topology analysis.</p>
                    </div>
                  </div>

                  <div className="versatility-item">
                    <div className="versatility-icon-wrap" style={{ background: '#FEF3C7', color: '#B45309' }}>
                      <IconShieldCheck size={18} />
                    </div>
                    <div>
                      <strong>Statutory Standards &amp; Accessibility:</strong>
                      <p>Adhering strictly to Government of India (GIGW 3.0), WCAG 2.1 AA, and RTI proactive disclosure mandates for institutional accountability.</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Team Highlights Row */}
              <div className="team-tags-row">
                <span className="team-tag-pill">Cross-Disciplinary Engineering</span>
                <span className="team-tag-pill">Sri Ramakrishna Institute of Technology</span>
                <span className="team-tag-pill">Smart India Hackathon 2026</span>
                <span className="team-tag-pill">Zero Leakage Architecture</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
