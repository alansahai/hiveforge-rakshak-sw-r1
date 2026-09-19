import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { formatCrore, formatLakh, getRiskColor } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';

export default function PolicyInsightDetailModal({ insight, onClose }) {
  const [inspectedProjectId, setInspectedProjectId] = useState(null);

  if (!insight) return null;

  const drilldown = insight.drilldown || {};
  const id = insight.id || 'risk_distribution';
  const severity = (insight.severity || 'high').toLowerCase();
  const severityColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#f59e0b';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 860, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.15rem' }}>
                {insight.title}
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: `${severityColor}22`,
                  color: severityColor,
                  border: `1px solid ${severityColor}66`,
                  textTransform: 'uppercase'
                }}
              >
                {severity} Severity Policy Alert
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
              National Programme Implementation Intelligence · Ministry of Statistics and Programme Implementation (MoSPI)
            </div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ cursor: 'pointer' }}>✕</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Finding & Summary Card */}
          <div
            className="panel"
            style={{
              padding: 14,
              marginBottom: 16,
              background: 'var(--bg-secondary)',
              borderLeft: `4px solid ${severityColor}`
            }}
          >
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
              Macroeconomic Forensic Observation
            </div>
            <div style={{ color: 'var(--text-heading)', fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.45, marginBottom: 8 }}>
              {insight.finding}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.4 }}>
              <strong>Impact Assessment:</strong> {insight.impact}
            </div>
          </div>

          {/* Dynamic Visualizations by Insight Type */}
          {id === 'risk_distribution' && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                National Risk Tier Distribution &amp; State Hotspots
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {/* Risk Tier Pie */}
                {drilldown.risk_tiers && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Portfolio Segmentation by Risk Band
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={drilldown.risk_tiers} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" paddingAngle={2} strokeWidth={0}>
                          {drilldown.risk_tiers.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v, n, p) => [`${v.toLocaleString()} works (${p.payload.pct}%)`, p.payload.tier]}
                        />
                        <Legend formatter={(v, entry) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top Flagged States */}
                {drilldown.top_flagged_states && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Top States with Elevated / Critical Works
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={drilldown.top_flagged_states} layout="vertical" margin={{ left: 20, right: 15, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis type="category" dataKey="state" width={90} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v) => [`${v} critical works`, 'Volume']}
                        />
                        <Bar dataKey="flagged_count" fill="#DC2626" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {id === 'contractor_concentration' && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                Market Share &amp; Sanctioned Outlays of Top Contractors
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
                {/* HHI Metric Banner */}
                <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Herfindahl-Hirschman Index (HHI)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: 4 }}>
                    {drilldown.hhi_index || 48.2}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Status: <strong style={{ color: 'var(--text-heading)' }}>{drilldown.hhi_classification}</strong>
                  </div>
                </div>

                {/* Top Contractors Chart */}
                {drilldown.top_contractors && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Total Sanctioned Outlay (₹ Cr)
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={drilldown.top_contractors.slice(0, 5)} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="contractor" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={0} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v) => [`₹${v} Cr`, 'Sanctioned']}
                        />
                        <Bar dataKey="total_sanctioned_cr" fill="#0B3B60" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {id === 'state_performance' && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                Top 5 Benchmark Leaders vs Bottom 5 Lagging States
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {drilldown.top_5_states && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--risk-low)', marginBottom: 6 }}>
                      Best Performing States (Lowest Avg Risk)
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={drilldown.top_5_states} margin={{ left: -15, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="state" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v) => [`${v}/100`, 'Avg Risk Score']}
                        />
                        <Bar dataKey="avg_risk" fill="#15803D" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {drilldown.bottom_5_states && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--risk-critical)', marginBottom: 6 }}>
                      Lagging States (Highest Avg Risk)
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={drilldown.bottom_5_states} margin={{ left: -15, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="state" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v) => [`${v}/100`, 'Avg Risk Score']}
                        />
                        <Bar dataKey="avg_risk" fill="#DC2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {id === 'cost_inflation' && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                Expenditure Overrun Distribution &amp; Excess Capital Outlay
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {drilldown.overrun_tiers && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Overrun Tiers (% Expenditure &gt; Sanctioned)
                    </div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={drilldown.overrun_tiers} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="tier" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} interval={0} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '4px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          formatter={(v, n, p) => [`${v.toLocaleString()} works (${p.payload.pct}%)`, 'Projects']}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {drilldown.overrun_tiers.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Estimated Capital Slippage</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--risk-critical)', marginTop: 4 }}>
                    ₹{drilldown.excess_cr?.toLocaleString() || '180.5'} Cr
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                    Disbursed expenditure exceeding sanctioned project envelopes without prior revised administrative sanction.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabulated Records of Affected Entities / Works */}
          {drilldown.top_entities && drilldown.top_entities.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                  Forensic Sample Records ({id === 'risk_distribution' || id === 'cost_inflation' ? 'Flagged Projects' : id === 'contractor_concentration' ? 'Contractors' : 'States'})
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click row for instant inspection
                </span>
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <table className="data-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      {id === 'contractor_concentration' ? (
                        <>
                          <th>Contractor</th>
                          <th>Works Count</th>
                          <th>Total Outlay</th>
                          <th>Avg Risk</th>
                          <th>Elevated Works</th>
                          <th>Market Share</th>
                        </>
                      ) : id === 'state_performance' ? (
                        <>
                          <th>State Name</th>
                          <th>Works Monitored</th>
                          <th>Avg Risk Score</th>
                          <th>Total Outlay</th>
                          <th>Avg Progress</th>
                        </>
                      ) : (
                        <>
                          <th>Project ID</th>
                          <th>Category</th>
                          <th>Location</th>
                          <th>Sanctioned</th>
                          <th>Spent</th>
                          {id === 'cost_inflation' ? <th>Overrun %</th> : <th>Risk Score</th>}
                          <th>Action</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.top_entities.map((row, idx) => (
                      <tr key={idx} style={{ cursor: row.project_id ? 'pointer' : 'default' }} onClick={() => row.project_id && setInspectedProjectId(row.project_id)}>
                        {id === 'contractor_concentration' ? (
                          <>
                            <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.contractor}</td>
                            <td>{row.project_count}</td>
                            <td>₹{row.total_sanctioned_cr} Cr</td>
                            <td>
                              <span className={`risk-badge ${row.avg_risk_score >= 60 ? 'high' : 'medium'}`} style={{ fontSize: '0.7rem' }}>
                                {row.avg_risk_score}/100
                              </span>
                            </td>
                            <td style={{ color: 'var(--risk-critical)', fontWeight: 600 }}>{row.elevated_risk_count}</td>
                            <td>{row.market_share_pct}%</td>
                          </>
                        ) : id === 'state_performance' ? (
                          <>
                            <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{row.state}</td>
                            <td>{row.projects}</td>
                            <td>
                              <span className={`risk-badge ${row.avg_risk_score >= 60 ? 'critical' : row.avg_risk_score >= 45 ? 'high' : 'low'}`} style={{ fontSize: '0.7rem' }}>
                                {row.avg_risk_score}/100
                              </span>
                            </td>
                            <td>₹{row.total_sanctioned_cr} Cr</td>
                            <td style={{ color: row.avg_progress >= 70 ? 'var(--risk-low)' : 'var(--text-primary)', fontWeight: 600 }}>
                              {row.avg_progress}%
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{row.project_id}</td>
                            <td>{row.category}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{row.district}, {row.state}</td>
                            <td>{formatLakh(row.amount_sanctioned)}</td>
                            <td>{formatLakh(row.amount_spent)}</td>
                            <td>
                              {id === 'cost_inflation' ? (
                                <span style={{ fontWeight: 700, color: row.overrun_pct > 20 ? 'var(--risk-critical)' : 'var(--risk-high)' }}>
                                  +{row.overrun_pct}%
                                </span>
                              ) : (
                                <span className="risk-badge critical" style={{ fontSize: '0.7rem' }}>
                                  {row.risk_score}/100
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedProjectId(row.project_id);
                                }}
                              >
                                View Dossier ↗
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actionable MoSPI Policy Directives Playbook */}
          {drilldown.policy_playbook && drilldown.policy_playbook.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.84rem' }}>
                MoSPI Policy Playbook &amp; Recommended Vigilance Directives
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {drilldown.policy_playbook.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)', minWidth: 18 }}>
                      0{idx + 1}.
                    </span>
                    <span style={{ lineHeight: 1.45 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Empowering evidence-based policymaking under Ministry of Statistics and Programme Implementation
          </span>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ cursor: 'pointer' }}>
            Close Analytics View
          </button>
        </div>
      </div>

      {/* Embedded Project Detail Modal */}
      {inspectedProjectId && (
        <ProjectDetailModal
          projectId={inspectedProjectId}
          onClose={() => setInspectedProjectId(null)}
        />
      )}
    </div>
  );
}
