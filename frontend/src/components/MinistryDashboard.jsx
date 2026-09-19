import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import {
  fetchMinistryDashboard,
  fetchMinistryInsights,
  fetchStatesSummary,
  formatCrore,
  formatLakh
} from '../api/client';
import ContractorNetworkGraph from './ContractorNetworkGraph';
import PolicyInsightDetailModal from './PolicyInsightDetailModal';
import {
  IconMinistry,
  IconAnalytics,
  IconInspect,
  IconState,
  IconDistrict,
  IconShieldCheck,
  IconAlertTriangle,
  IconCheckCircle,
  IconFileText,
  IconExternalLink
} from './common/GovIcons';

const RISK_PIE_COLORS = ['#15803D', '#D97706', '#C2410C', '#DC2626'];

export default function MinistryDashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [selectedInsightModal, setSelectedInsightModal] = useState(null);
  const [statesSummary, setStatesSummary] = useState([]);
  const [selectedStates, setSelectedStates] = useState([
    'Maharashtra',
    'Karnataka',
    'Uttar Pradesh',
    'Gujarat'
  ]);
  const [stateToAdd, setStateToAdd] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetchMinistryDashboard(),
      fetchMinistryInsights(),
      fetchStatesSummary(),
    ]).then(([d, ins, states]) => {
      setData(d);
      setInsights(ins);
      setStatesSummary(states || []);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Synchronizing Ministry (MoSPI) National Analytics &amp; Risk Intelligence…</span>
      </div>
    );
  }

  const riskPieData = data.risk_distribution_pie
    ? [
        { name: 'Low Risk', value: data.risk_distribution_pie.low, color: '#15803D' },
        { name: 'Medium Risk', value: data.risk_distribution_pie.medium, color: '#D97706' },
        { name: 'High Risk', value: data.risk_distribution_pie.high, color: '#C2410C' },
        { name: 'Critical Inquiry', value: data.risk_distribution_pie.critical, color: '#DC2626' },
      ]
    : [];

  const timeSeriesData = data.time_series_trends || [];
  const stateComparison = data.state_comparison_heatmap || [];

  return (
    <div>
      {/* Institutional Page Header */}
      <div className="page-header">
        <h2>
          <IconMinistry size={24} color="var(--gov-navy-800)" />
          <span>Ministry of Statistics &amp; Programme Implementation (MoSPI)</span>
        </h2>
        <p>
          Pan-India macroeconomic expenditure analytics, fund utilization benchmarks, and systemic anomaly forecasting
        </p>
      </div>

      {/* National KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Monitored Works</div>
          <div className="stat-value">
            {data.national_summary?.total_projects?.toLocaleString()}
          </div>
          <div className="stat-sub">Across all States &amp; UTs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Central Outlay Sanctioned</div>
          <div className="stat-value">
            {formatCrore((data.national_summary?.total_sanctioned_cr || 0) * 10000000)}
          </div>
          <div className="stat-sub">Cumulative allocation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cumulative Expenditure</div>
          <div className="stat-value">
            {formatCrore((data.national_summary?.total_spent_cr || 0) * 10000000)}
          </div>
          <div className="stat-sub">Disbursed on ground</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mean Completion Span</div>
          <div className="stat-value">
            {data.trend_analysis?.average_completion_days || 312} Days
          </div>
          <div className="stat-sub">Trend: {data.trend_analysis?.efficiency_trend || 'Steady'}</div>
        </div>
        <div className="stat-card risk-critical">
          <div className="stat-label">Audit Escalation Rate</div>
          <div className="stat-value" style={{ color: 'var(--risk-critical)', fontSize: '1.4rem' }}>
            {data.trend_analysis?.audit_escalation_rate || '3.2%'}
          </div>
          <div className="stat-sub">Critical inquiry ratio</div>
        </div>
      </div>

      {/* Charts Row: Risk Pie + Quarterly Trend */}
      <div className="grid-2">
        {/* National Risk Distribution */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <IconShieldCheck size={18} color="var(--gov-navy-800)" />
              <span>National Portfolio Risk Classification</span>
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskPieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                dataKey="value"
                paddingAngle={2}
                stroke="#FFFFFF"
                strokeWidth={2}
              >
                {riskPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
              />
              <Legend
                formatter={(v) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{v}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quarterly Performance Trends */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <IconAnalytics size={18} color="var(--gov-navy-800)" />
              <span>Quarterly Fund Utilization &amp; Completion Trajectory</span>
            </h3>
          </div>
          {timeSeriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  domain={[60, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '4px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
                <Legend
                  formatter={(v) => (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{v}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="completion_rate"
                  stroke="#0B3B60"
                  strokeWidth={2.5}
                  dot={{ fill: '#0B3B60', r: 4 }}
                  name="Completion Rate %"
                />
                <Line
                  type="monotone"
                  dataKey="fund_utilization"
                  stroke="#15803D"
                  strokeWidth={2.5}
                  dot={{ fill: '#15803D', r: 4 }}
                  name="Fund Utilization %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-container">No temporal performance series found</div>
          )}
        </div>
      </div>

      {/* Multi-State Comparative Benchmark Matrix */}
      <div className="panel">
        <div
          className="panel-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <h3>
              <IconState size={18} color="var(--gov-navy-800)" />
              <span>Inter-State Comparative Benchmark Engine</span>
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Evaluate regional fund absorption, cost overrun variance, and systemic anomaly divergence
            </p>
          </div>

          {/* Preset regional clusters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setSelectedStates(['Maharashtra', 'Uttar Pradesh', 'Karnataka', 'Gujarat'])
              }
            >
              Top 4 High-Volume
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setSelectedStates(['Karnataka', 'Tamil Nadu', 'Kerala', 'Andhra Pradesh', 'Telangana'])
              }
            >
              Southern Zone
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setSelectedStates(['Uttar Pradesh', 'Rajasthan', 'Punjab', 'Haryana'])
              }
            >
              Northern Zone
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: '#C2410C', borderColor: 'var(--status-escalated-border)' }}
              onClick={() => {
                const highRisk = [...statesSummary]
                  .sort((a, b) => b.avg_risk_score - a.avg_risk_score)
                  .slice(0, 4)
                  .map((s) => s.state);
                setSelectedStates(
                  highRisk.length ? highRisk : ['Bihar', 'Jharkhand', 'Uttar Pradesh']
                );
              }}
            >
              Highest Risk Tiers
            </button>
          </div>
        </div>

        {/* State Tag Selector */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            COMPARING:
          </span>
          {selectedStates.map((st) => (
            <span
              key={st}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#EBF4FC',
                color: 'var(--gov-navy-900)',
                border: '1px solid var(--border-card)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.74rem',
                fontWeight: 600,
              }}
            >
              <span>{st}</span>
              <button
                type="button"
                onClick={() => setSelectedStates(selectedStates.filter((s) => s !== st))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  lineHeight: 1,
                  padding: 0,
                }}
                title={`Remove ${st}`}
              >
                ✕
              </button>
            </span>
          ))}

          {/* Add state dropdown */}
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 160, padding: '3px 8px', fontSize: '0.74rem' }}
            value={stateToAdd}
            onChange={(e) => {
              if (e.target.value && !selectedStates.includes(e.target.value)) {
                setSelectedStates([...selectedStates, e.target.value]);
              }
              setStateToAdd('');
            }}
          >
            <option value="">+ Add State / UT…</option>
            {statesSummary
              .filter((s) => !selectedStates.includes(s.state))
              .map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
          </select>
        </div>

        {/* State Comparison Table */}
        {(() => {
          const comparedData = statesSummary.filter((s) => selectedStates.includes(s.state));
          if (comparedData.length === 0) {
            return (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                Please select at least one State or Union Territory above.
              </div>
            );
          }

          return (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State / Union Territory</th>
                    <th style={{ textAlign: 'right' }}>Works Monitored</th>
                    <th style={{ textAlign: 'right' }}>Sanctioned (₹)</th>
                    <th style={{ textAlign: 'right' }}>Expenditure (₹)</th>
                    <th style={{ textAlign: 'right' }}>Cost Overrun %</th>
                    <th style={{ textAlign: 'center' }}>Avg Anomaly Score</th>
                    <th style={{ textAlign: 'center' }}>Completion %</th>
                    <th>Top Priority District</th>
                    <th style={{ textAlign: 'center', width: 120 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {comparedData.map((s, idx) => {
                    const riskCat =
                      s.avg_risk_score >= 65
                        ? 'critical-alert'
                        : s.avg_risk_score >= 50
                        ? 'high-risk'
                        : s.avg_risk_score >= 35
                        ? 'under-review'
                        : 'approved';

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--gov-navy-900)' }}>
                          {s.state}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {s.total_projects?.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCrore(s.total_sanctioned)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {formatCrore(s.total_spent)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: s.cost_overrun_pct > 10 ? 'var(--risk-critical)' : 'inherit',
                          }}
                        >
                          {s.cost_overrun_pct?.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge ${riskCat}`}>
                            {s.avg_risk_score?.toFixed(0)}/100
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {s.completion_rate}%
                        </td>
                        <td>{s.top_flagged_district || 'N/A'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() =>
                              navigate(`/state?state=${encodeURIComponent(s.state)}`)
                            }
                            title="Drill down to State Authority Dashboard"
                          >
                            <span>Drilldown</span>
                            <IconExternalLink size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Interactive AI Contractor Network Graph */}
      <ContractorNetworkGraph />

      {/* Forensic Policy Insights Cards */}
      {insights && insights.insights && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="panel-header">
            <div>
              <h3>
                <IconFileText size={18} color="var(--gov-navy-800)" />
                <span>Forensic Policy Findings &amp; Corrective Directives</span>
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Algorithmic extraction based on {insights.total_projects_analyzed?.toLocaleString()} evaluated infrastructure works
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {insights.insights.map((ins, i) => (
              <div
                key={i}
                className="stat-card"
                style={{
                  cursor: 'pointer',
                  borderLeftColor:
                    ins.severity === 'critical' ? 'var(--risk-critical)' : 'var(--risk-medium)',
                }}
                onClick={() => setSelectedInsightModal(ins)}
                title="Click to view deep analytical charts and forensic entities"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-heading)' }}>
                    {ins.title}
                  </strong>
                  <span
                    className={`status-badge ${
                      ins.severity === 'critical' ? 'critical-alert' : 'under-review'
                    }`}
                  >
                    {ins.severity || 'Escalated'}
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.45 }}>
                  {ins.finding}
                </p>

                {ins.impact && (
                  <div
                    style={{
                      background: 'var(--status-escalated-bg)',
                      color: 'var(--status-escalated-text)',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '0.76rem',
                      marginBottom: 8,
                    }}
                  >
                    <strong>Systemic Impact:</strong> {ins.impact}
                  </div>
                )}

                {ins.recommendation && (
                  <div
                    style={{
                      background: 'var(--status-approved-bg)',
                      color: 'var(--status-approved-text)',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '0.76rem',
                      marginBottom: 10,
                    }}
                  >
                    <strong>Corrective Action:</strong> {ins.recommendation}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--gov-navy-800)',
                  }}
                >
                  <IconInspect size={13} />
                  <span>Inspect Forensic Evidence &amp; Cluster Details</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deep Policy Insight Analytics Modal */}
      {selectedInsightModal && (
        <PolicyInsightDetailModal
          insight={selectedInsightModal}
          onClose={() => setSelectedInsightModal(null)}
        />
      )}
    </div>
  );
}
