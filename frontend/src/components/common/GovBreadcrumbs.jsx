import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { IconChevronRight, IconPrinter, IconRefresh } from './GovIcons';

const ROUTE_CRUMBS = {
  '/overview': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'National Overview', active: true },
  ],
  '/mp': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Executive Oversight', to: '/overview' },
    { label: 'MP Constituency Portfolio', active: true },
  ],
  '/state': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Executive Oversight', to: '/overview' },
    { label: 'State Nodal Authority', active: true },
  ],
  '/district': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Operational Units', to: '/overview' },
    { label: 'District Implementation Dashboard', active: true },
  ],
  '/ministry': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Executive Oversight', to: '/overview' },
    { label: 'Ministry (MoSPI) National Analytics', active: true },
  ],
  '/analytics-studio': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Analytical Intelligence', to: '/overview' },
    { label: 'Custom Chart Studio', active: true },
  ],
  '/analyze': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Risk Assessment', to: '/overview' },
    { label: 'AI Project Risk & Anomaly Analyzer', active: true },
  ],
  '/alerts': [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Audit Lifecycle', to: '/overview' },
    { label: 'Alerts, Flags & Escalations', active: true },
  ],
};

export default function GovBreadcrumbs() {
  const location = useLocation();
  const path = location.pathname;
  const crumbs = ROUTE_CRUMBS[path] || [
    { label: 'Portal Home', to: '/overview' },
    { label: 'Dashboard', active: true },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <nav className="gov-breadcrumbs-bar" aria-label="Breadcrumb navigation">
      <div className="gov-breadcrumbs-inner">
        <ol className="gov-breadcrumb-list">
          {crumbs.map((crumb, idx) => (
            <li key={idx} className={`gov-breadcrumb-item ${crumb.active ? 'active' : ''}`}>
              {idx > 0 && <IconChevronRight size={12} className="gov-crumb-separator" />}
              {crumb.active ? (
                <span aria-current="page">{crumb.label}</span>
              ) : (
                <Link to={crumb.to}>{crumb.label}</Link>
              )}
            </li>
          ))}
        </ol>

        <div className="gov-breadcrumbs-tools">
          <span className="gov-data-health-tag">
            <span className="gov-health-dot" aria-hidden="true" />
            <span>Operational · Live Central DB Feed</span>
          </span>
          <button
            type="button"
            className="gov-print-btn"
            onClick={handlePrint}
            title="Print this official report view"
            aria-label="Print or export current page view"
          >
            <IconPrinter size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
