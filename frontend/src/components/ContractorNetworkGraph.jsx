import React, { useState, useEffect, useMemo } from 'react';
import { fetchContractorNetwork, fetchStatesAndDistricts, formatCrore, formatLakh } from '../api/client';

export default function ContractorNetworkGraph({ defaultState = '' }) {
  const [data, setData] = useState({ nodes: [], edges: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState(defaultState);
  const [statesList, setStatesList] = useState([]);
  const [filterHighRiskOnly, setFilterHighRiskOnly] = useState(false);
  const [minProjects, setMinProjects] = useState(2);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Load states list
  useEffect(() => {
    fetchStatesAndDistricts().then((map) => {
      setStatesList(Object.keys(map).sort());
    });
  }, []);

  // Fetch network data
  useEffect(() => {
    setLoading(true);
    fetchContractorNetwork({
      state: selectedState || undefined,
      min_projects: minProjects,
      limit_contractors: 28
    }).then((res) => {
      setData(res || { nodes: [], edges: [], summary: {} });
      setLoading(false);
    });
  }, [selectedState, minProjects]);

  // Compute 2D node coordinates for SVG graph
  const { layoutNodes, layoutEdges } = useMemo(() => {
    const rawNodes = data.nodes || [];
    const rawEdges = data.edges || [];

    // Filter high-risk contractors if toggled
    const validContractorIds = new Set(
      rawNodes
        .filter((n) => n.type === 'contractor' && (!filterHighRiskOnly || n.is_high_risk))
        .map((n) => n.id)
    );

    const activeEdges = rawEdges.filter((e) => validContractorIds.has(e.source));
    const activeDistrictIds = new Set(activeEdges.map((e) => e.target));

    const activeNodes = rawNodes.filter(
      (n) => validContractorIds.has(n.id) || activeDistrictIds.has(n.id)
    );

    const width = 850;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    const contractors = activeNodes.filter((n) => n.type === 'contractor');
    const districts = activeNodes.filter((n) => n.type === 'district');

    const nodePositions = {};

    // Position Districts in an outer circle
    const districtRadius = 210;
    districts.forEach((d, i) => {
      const angle = (2 * Math.PI * i) / Math.max(districts.length, 1) - Math.PI / 2;
      nodePositions[d.id] = {
        ...d,
        x: centerX + districtRadius * Math.cos(angle),
        y: centerY + districtRadius * Math.sin(angle),
        radius: Math.min(22, Math.max(14, Math.sqrt(d.project_count || 1) * 3.5)),
        color: '#8b5cf6'
      };
    });

    // Position Contractors in an inner circle
    const contractorRadius = 115;
    contractors.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(contractors.length, 1) - Math.PI / 2 + (Math.PI / Math.max(contractors.length, 1));
      const isHigh = c.is_high_risk;
      nodePositions[c.id] = {
        ...c,
        x: centerX + contractorRadius * Math.cos(angle),
        y: centerY + contractorRadius * Math.sin(angle),
        radius: Math.min(26, Math.max(13, Math.sqrt(c.project_count || 1) * 4.2)),
        color: isHigh ? '#ef4444' : '#06b6d4'
      };
    });

    const positionedEdges = activeEdges
      .map((e) => {
        const source = nodePositions[e.source];
        const target = nodePositions[e.target];
        if (!source || !target) return null;
        return {
          ...e,
          sourceNode: source,
          targetNode: target,
          width: Math.min(5, Math.max(1.2, (e.project_count || 1) * 0.75))
        };
      })
      .filter(Boolean);

    return {
      layoutNodes: Object.values(nodePositions),
      layoutEdges: positionedEdges
    };
  }, [data, filterHighRiskOnly]);

  const activeFocus = hoveredNode || selectedNode;

  // Determine connected node IDs for highlighting
  const connectedIds = useMemo(() => {
    if (!activeFocus) return null;
    const ids = new Set([activeFocus.id]);
    layoutEdges.forEach((e) => {
      if (e.source === activeFocus.id) ids.add(e.target);
      if (e.target === activeFocus.id) ids.add(e.source);
    });
    return ids;
  }, [activeFocus, layoutEdges]);

  return (
    <div className="panel" style={{ border: '1px solid rgba(139, 92, 246, 0.25)', background: 'linear-gradient(180deg, rgba(20, 26, 43, 0.85) 0%, rgba(13, 18, 30, 0.95) 100%)' }}>
      {/* Header with Title and Control Buttons */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#c4b5fd' }}>
            🕸️ Contractor–District Relationship Network
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            AI-driven bipartite network graph revealing vendor concentration, cross-district operations, and systemic concurrency risk
          </span>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* State Filter */}
          <select
            className="form-control"
            style={{ width: 170, fontSize: '0.78rem', padding: '4px 8px' }}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="">All India (National)</option>
            {statesList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* High Risk Only Toggle */}
          <button
            className={`btn ${filterHighRiskOnly ? 'btn-primary' : 'btn-outline'} btn-sm`}
            style={filterHighRiskOnly ? { background: '#ef4444', borderColor: '#ef4444', fontSize: '0.76rem' } : { color: '#f87171', fontSize: '0.76rem' }}
            onClick={() => setFilterHighRiskOnly(!filterHighRiskOnly)}
          >
            {filterHighRiskOnly ? '🔥 High-Risk Only (Active)' : 'Show High-Risk Only'}
          </button>

          {/* Min Projects Filter */}
          <select
            className="form-control"
            style={{ width: 130, fontSize: '0.78rem', padding: '4px 8px' }}
            value={minProjects}
            onChange={(e) => setMinProjects(Number(e.target.value))}
          >
            <option value={1}>≥ 1 Project</option>
            <option value={2}>≥ 2 Projects</option>
            <option value={5}>≥ 5 Projects</option>
            <option value={10}>≥ 10 Projects</option>
          </select>
        </div>
      </div>

      {/* Network Summary Metrics Bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, margin: '8px 0 16px 0', fontSize: '0.8rem' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Contractors Mapped: </span>
          <strong style={{ color: '#06b6d4' }}>{data.summary?.total_contractors || 0}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Districts Linked: </span>
          <strong style={{ color: '#a78bfa' }}>{data.summary?.total_districts || 0}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>High-Risk Vendors: </span>
          <strong style={{ color: '#ef4444' }}>{data.summary?.high_risk_contractors || 0}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Cross-District Operators: </span>
          <strong style={{ color: '#f59e0b' }}>{data.summary?.cross_district_contractors || 0}</strong>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: '0.74rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span> High-Risk Vendor
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }}></span> Standard Vendor
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }}></span> District Authority
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ height: 420 }}>
          <div className="spinner"></div> Synthesizing contractor network graph...
        </div>
      ) : layoutNodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
          No contractor relationships found for the selected filter criteria.
        </div>
      ) : (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8, background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.05)' }}>
          <svg
            viewBox="0 0 850 520"
            style={{ width: '100%', height: 'auto', maxHeight: 520, display: 'block' }}
          >
            {/* Defs for glowing filter and markers */}
            <defs>
              <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background grid markings */}
            <circle cx="425" cy="260" r="115" fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
            <circle cx="425" cy="260" r="210" fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />

            {/* Edges */}
            <g className="edges">
              {layoutEdges.map((edge, idx) => {
                const isEdgeHighlighted =
                  connectedIds &&
                  connectedIds.has(edge.source) &&
                  connectedIds.has(edge.target);
                const isDimmed = connectedIds && !isEdgeHighlighted;

                return (
                  <line
                    key={idx}
                    x1={edge.sourceNode.x}
                    y1={edge.sourceNode.y}
                    x2={edge.targetNode.x}
                    y2={edge.targetNode.y}
                    stroke={
                      isEdgeHighlighted
                        ? edge.is_high_risk ? '#ef4444' : '#38bdf8'
                        : edge.is_high_risk ? 'rgba(239, 68, 68, 0.35)' : 'rgba(148, 163, 184, 0.2)'
                    }
                    strokeWidth={isEdgeHighlighted ? edge.width + 1.5 : edge.width}
                    opacity={isDimmed ? 0.08 : 1}
                    style={{ transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {layoutNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const isConnected = connectedIds ? connectedIds.has(node.id) : true;
                const opacity = connectedIds && !isConnected ? 0.18 : 1;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: 'pointer', transition: 'opacity 0.25s' }}
                    opacity={opacity}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                  >
                    {/* Pulsing Outer Ring for High Risk Contractor */}
                    {node.type === 'contractor' && node.is_high_risk && (
                      <circle
                        r={node.radius + 6}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity="0.8"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={node.radius}
                      fill={node.color}
                      stroke={isSelected || isHovered ? '#ffffff' : 'rgba(255,255,255,0.25)'}
                      strokeWidth={isSelected || isHovered ? 3 : 1.5}
                      filter={node.is_high_risk ? 'url(#glow-red)' : node.type === 'district' ? 'url(#glow-purple)' : undefined}
                    />

                    {/* Node Icon / Symbol */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize={node.radius > 16 ? 12 : 9}
                      fill="#ffffff"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.type === 'contractor' ? (node.is_high_risk ? '⚠️' : '🏗️') : '📍'}
                    </text>

                    {/* Node Label */}
                    <text
                      y={node.radius + 12}
                      textAnchor="middle"
                      fill={node.type === 'contractor' ? (node.is_high_risk ? '#fca5a5' : '#7dd3fc') : '#c4b5fd'}
                      fontSize="9.5"
                      fontWeight={isSelected || isHovered ? 700 : 500}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Interactive Inspection HUD Card */}
          {activeFocus && (
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                maxWidth: 320,
                background: 'rgba(15, 23, 42, 0.94)',
                border: `1px solid ${activeFocus.color}`,
                borderRadius: 8,
                padding: '12px 14px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: activeFocus.color, fontWeight: 700 }}>
                  {activeFocus.type === 'contractor' ? 'Contractor Vendor Profile' : 'District Project Hub'}
                </span>
                {selectedNode && (
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', color: '#ffffff' }}>
                {activeFocus.name}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '6px 0' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Total Projects:</span>
                  <div style={{ fontWeight: 700 }}>{activeFocus.project_count || 0}</div>
                </div>
                {activeFocus.type === 'contractor' && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Avg Risk Score:</span>
                    <div style={{ fontWeight: 700, color: activeFocus.is_high_risk ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                      {activeFocus.avg_risk_score}/100
                    </div>
                  </div>
                )}
                {activeFocus.total_sanctioned && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Total Value Sanctioned:</span>
                    <div style={{ fontWeight: 700 }}>{formatLakh(activeFocus.total_sanctioned)}</div>
                  </div>
                )}
              </div>
              {activeFocus.concurrency_flag && (
                <div style={{ marginTop: 6, padding: '4px 6px', background: 'rgba(239,68,68,0.15)', borderRadius: 4, color: '#fca5a5', fontSize: '0.72rem' }}>
                  ⚡ <strong>Concurrency Flag:</strong> Multi-district public work execution
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
