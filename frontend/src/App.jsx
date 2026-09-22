import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import GovHeader from './components/common/GovHeader';
import GovBreadcrumbs from './components/common/GovBreadcrumbs';
import GovFooter from './components/common/GovFooter';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import PublicPortalPage from './pages/PublicPortalPage';
import MPDashboard from './components/MPDashboard';
import StateDashboard from './components/StateDashboard';
import DistrictDashboard from './components/DistrictDashboard';
import MinistryDashboard from './components/MinistryDashboard';
import AnalyzeProject from './components/AnalyzeProject';
import AlertPanel from './components/AlertPanel';
import CustomChartStudio from './components/CustomChartStudio';
import { isAuthenticated, getCurrentRole } from './api/client';
import { LanguageProvider } from './context/LanguageContext';

// ── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ element }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return element;
}

// ── Layout with Government Portal Header, Breadcrumbs, Sidebar, and Footer ──
function AppLayout({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('mplads_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mplads_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="gov-portal-wrapper">
      <GovHeader theme={theme} onToggleTheme={toggleTheme} />
      <div className="app-layout">
        <Sidebar />
        <div className="main-wrapper">
          <GovBreadcrumbs />
          <main id="main-content" className="main-content" tabIndex="-1">
            {children}
          </main>
          <GovFooter />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Routes>
        {/* Public Landing & Overview Portal Dashboard */}
        <Route path="/" element={<PublicPortalPage />} />

        {/* Public Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — all wrapped in government public service portal layout */}
        <Route
          path="/overview"
          element={
            <ProtectedRoute
              element={<AppLayout><Dashboard /></AppLayout>}
            />
          }
        />
        <Route
          path="/mp"
          element={
            <ProtectedRoute
              element={<AppLayout><MPDashboard /></AppLayout>}
            />
          }
        />
        <Route
          path="/state"
          element={
            <ProtectedRoute
              element={<AppLayout><StateDashboard /></AppLayout>}
            />
          }
        />
        <Route
          path="/district"
          element={
            <ProtectedRoute
              element={<AppLayout><DistrictDashboard /></AppLayout>}
            />
          }
        />
        <Route
          path="/ministry"
          element={
            <ProtectedRoute
              element={<AppLayout><MinistryDashboard /></AppLayout>}
            />
          }
        />
        <Route
          path="/analyze"
          element={
            <ProtectedRoute
              element={<AppLayout><AnalyzeProject /></AppLayout>}
            />
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute
              element={<AppLayout><AlertPanel /></AppLayout>}
            />
          }
        />
        <Route
          path="/analytics-studio"
          element={
            <ProtectedRoute
              element={<AppLayout><CustomChartStudio /></AppLayout>}
            />
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;
