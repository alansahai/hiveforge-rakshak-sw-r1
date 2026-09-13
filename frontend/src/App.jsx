import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import MPDashboard from './components/MPDashboard';
import StateDashboard from './components/StateDashboard';
import DistrictDashboard from './components/DistrictDashboard';
import MinistryDashboard from './components/MinistryDashboard';
import AnalyzeProject from './components/AnalyzeProject';
import AlertPanel from './components/AlertPanel';
import CustomChartStudio from './components/CustomChartStudio';
import { isAuthenticated, getCurrentRole } from './api/client';

// ── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ element }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return element;
}

// ── Layout with sidebar ──────────────────────────────────────────────────────
function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated()
            ? <Navigate to={`/${getCurrentRole() || 'ministry'}`} replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* Protected — all wrapped in sidebar layout */}
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
  );
}

export default App;
