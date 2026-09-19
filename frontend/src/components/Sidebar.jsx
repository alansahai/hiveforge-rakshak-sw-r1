import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  IconOverview,
  IconMP,
  IconState,
  IconDistrict,
  IconMinistry,
  IconAnalytics,
  IconInspect,
  IconAlerts,
  GovSealIcon
} from './common/GovIcons';

const EXECUTIVE_LINKS = [
  { to: '/overview', icon: <IconOverview size={17} />, label: 'National Overview' },
  { to: '/mp', icon: <IconMP size={17} />, label: 'MP Constituency Portfolio' },
  { to: '/state', icon: <IconState size={17} />, label: 'State Nodal Authority' },
  { to: '/district', icon: <IconDistrict size={17} />, label: 'District Authority' },
  { to: '/ministry', icon: <IconMinistry size={17} />, label: 'Ministry of Statistics (MoSPI)' },
];

const ANALYTICS_LINKS = [
  { to: '/analytics-studio', icon: <IconAnalytics size={17} />, label: 'Custom Chart Studio' },
  { to: '/analyze', icon: <IconInspect size={17} />, label: 'AI Project Risk Analyzer' },
  { to: '/alerts', icon: <IconAlerts size={17} />, label: 'Alerts & Audit Flags' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Portal primary navigation">
      <div className="sidebar-brand-box">
        <div className="dept-code">Civic Infrastructure Analytics</div>
        <div className="dept-name">MPLADS e-Samiksha</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-group-title">Executive Oversight</div>
        {EXECUTIVE_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-group-title" style={{ marginTop: 10 }}>
          Intelligence &amp; Auditing
        </div>
        {ANALYTICS_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot" aria-hidden="true" />
          <span>Central Audit Engine Active · 98K+ Works Monitored</span>
        </div>
      </div>
    </aside>
  );
}
