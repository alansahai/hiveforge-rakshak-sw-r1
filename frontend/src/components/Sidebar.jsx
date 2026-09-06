import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  const links = [
    { to: '/', icon: '📊', label: 'Overview' },
    { to: '/mp', icon: '🏛️', label: 'MP Dashboard' },
    { to: '/state', icon: '🚩', label: 'State Authority' },
    { to: '/district', icon: '📍', label: 'District Authority' },
    { to: '/ministry', icon: '🌐', label: 'Ministry (MoSPI)' },
    { to: '/analyze', icon: '🔬', label: 'Analyze Project' },
    { to: '/alerts', icon: '🚨', label: 'Alerts & Flags' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>MPLADS AI Monitor</h1>
        <p>Smart Anomaly Detection</p>
      </div>

      <nav className="sidebar-nav">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot"></span>
          System Online — 98K Projects Monitored
        </div>
      </div>
    </aside>
  );
}
