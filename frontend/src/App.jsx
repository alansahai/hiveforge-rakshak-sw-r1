import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import MPDashboard from './components/MPDashboard';
import StateDashboard from './components/StateDashboard';
import DistrictDashboard from './components/DistrictDashboard';
import MinistryDashboard from './components/MinistryDashboard';
import AnalyzeProject from './components/AnalyzeProject';
import AlertPanel from './components/AlertPanel';

function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mp" element={<MPDashboard />} />
          <Route path="/state" element={<StateDashboard />} />
          <Route path="/district" element={<DistrictDashboard />} />
          <Route path="/ministry" element={<MinistryDashboard />} />
          <Route path="/analyze" element={<AnalyzeProject />} />
          <Route path="/alerts" element={<AlertPanel />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
