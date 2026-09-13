import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout, getCurrentUser, getCurrentRole } from '../api/client';

const ROLE_ICONS = { mp: '🏛️', district: '📍', state: '🚩', ministry: '🌐' };
const ROLE_LABELS = { mp: 'MP', district: 'District', state: 'State', ministry: 'Ministry' };
const ROLE_COLORS = {
  mp: 'var(--accent)',
  district: 'var(--risk-medium)',
  state: 'var(--risk-low)',
  ministry: '#a78bfa',
};

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = getCurrentRole();
  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('mplads_theme') || 'dark';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mplads_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const links = [
    { to: '/overview', icon: '📊', label: 'Overview' },
    { to: '/mp', icon: '🏛️', label: 'MP Dashboard' },
    { to: '/state', icon: '🚩', label: 'State Authority' },
    { to: '/district', icon: '📍', label: 'District Authority' },
    { to: '/ministry', icon: '🌐', label: 'Ministry (MoSPI)' },
    { to: '/analytics-studio', icon: '📈', label: 'Analytics Studio' },
    { to: '/analyze', icon: '🔬', label: 'Analyze Project' },
    { to: '/alerts', icon: '🚨', label: 'Alerts & Flags' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // User initial avatar
  const initial = user?.full_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>MPLADS AI Monitor</h1>
        <p>Smart Anomaly Detection</p>
      </div>

      {/* User profile pill */}
      {user && (
        <div className="sidebar-user">
          <div
            className="user-avatar"
            style={{ background: ROLE_COLORS[role] || 'var(--accent)' }}
          >
            {initial}
          </div>
          <div className="user-info">
            <div className="user-name">{user.full_name?.split('—')[0]?.trim() || user.username}</div>
            <div
              className="user-role-badge"
              style={{ background: ROLE_COLORS[role] || 'var(--accent)' }}
            >
              {ROLE_ICONS[role]} {ROLE_LABELS[role] || role}
            </div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            marginBottom: 10,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="system-status" style={{ marginBottom: 8 }}>
          <span className="status-dot" />
          System Online — 98K Projects Monitored
        </div>
        {user && (
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            🚪 Sign Out
          </button>
        )}
      </div>
    </aside>
  );
}
