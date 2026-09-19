import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchContractorNetwork, fetchStatesAndDistricts, formatCrore, formatLakh } from '../api/client';
import ContractorDetailModal from './ContractorDetailModal';
import DistrictDetailModal from './DistrictDetailModal';

export default function ContractorNetworkGraph({ defaultState = '' }) {
  const [data, setData] = useState({ nodes: [], edges: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState(defaultState);
  const [statesList, setStatesList] = useState([]);
  const [filterHighRiskOnly, setFilterHighRiskOnly] = useState(false);
  const [minProjects, setMinProjects] = useState(2);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeContractorModal, setActiveContractorModal] = useState(null);
  const [activeDistrictModal, setActiveDistrictModal] = useState(null);

  // UI status states for button toggles
  const [is3D, setIs3D] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  // Canvas and animation references
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const projectedNodesRef = useRef([]);

  // Mutable camera reference for zero-lag 60+ FPS manipulation
  const cameraRef = useRef({
    rotX: 0.45,       // Pitch tilt in radians
    rotY: 0.15,       // Yaw rotation in radians
    zoom: 1.0,
    panX: 0,
    panY: 0,
    is3D: true,
    autoRotate: true
  });

  // Drag interaction state
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialRotX: 0.45,
    initialRotY: 0.15,
    initialPanX: 0,
    initialPanY: 0,
    isPanMode: false,
    hasMoved: false
  });

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

  // Sync React state flags to mutable camera reference
  useEffect(() => {
    cameraRef.current.is3D = is3D;
    cameraRef.current.autoRotate = autoRotate;
  }, [is3D, autoRotate]);

  // Base 3D node positions layout computation
  const { nodes3D, edges3D, nodeMap } = useMemo(() => {
    const rawNodes = data.nodes || [];
    const rawEdges = data.edges || [];

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

    const contractors = activeNodes.filter((n) => n.type === 'contractor');
    const districts = activeNodes.filter((n) => n.type === 'district');

    const mapped = {};
    const n3D = [];

    // Outer Torus ring for District Hubs
    const districtRadius = 250;
    districts.forEach((d, i) => {
      const angle = (2 * Math.PI * i) / Math.max(districts.length, 1);
      const nodeObj = {
        ...d,
        x0: districtRadius * Math.cos(angle),
        y0: Math.sin(i * 1.6) * 35,
        z0: districtRadius * Math.sin(angle),
        radius: Math.min(22, Math.max(14, Math.sqrt(d.project_count || 1) * 3.4)),
        color: '#8b5cf6',
        secondaryColor: '#c4b5fd'
      };
      mapped[d.id] = nodeObj;
      n3D.push(nodeObj);
    });

    // Inner Orbital Sphere for Contractors
    const numContractors = contractors.length;
    contractors.forEach((c, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(numContractors, 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const contractorRadius = 135;

      const riskScore = c.avg_risk_score || 0;
      const riskColor = c.is_high_risk || riskScore >= 70 ? '#ef4444' : riskScore >= 50 ? '#f97316' : riskScore >= 35 ? '#f59e0b' : '#22c55e';
      const secondaryColor = c.is_high_risk || riskScore >= 70 ? '#fca5a5' : riskScore >= 50 ? '#fdba74' : riskScore >= 35 ? '#fde68a' : '#86efac';

      const nodeObj = {
        ...c,
        x0: contractorRadius * Math.sin(phi) * Math.cos(theta),
        y0: (contractorRadius * 0.75) * Math.cos(phi),
        z0: contractorRadius * Math.sin(phi) * Math.sin(theta),
        radius: Math.min(18, Math.max(10, Math.sqrt(c.project_count || 1) * 2.8)),
        color: riskColor,
        secondaryColor: secondaryColor
      };
      mapped[c.id] = nodeObj;
      n3D.push(nodeObj);
    });

    const e3D = activeEdges.map((e) => ({
      ...e,
      sourceNode: mapped[e.source],
      targetNode: mapped[e.target]
    })).filter((e) => e.sourceNode && e.targetNode);

    return { nodes3D: n3D, edges3D: e3D, nodeMap: mapped };
  }, [data, filterHighRiskOnly]);

  // Perspective camera presets
  const applyCameraPreset = (type) => {
    if (type === 'isometric') {
      cameraRef.current.rotX = 0.55;
      cameraRef.current.rotY = 0.78;
      cameraRef.current.panX = 0;
      cameraRef.current.panY = 0;
      cameraRef.current.zoom = 1.0;
      cameraRef.current.is3D = true;
      setIs3D(true);
    } else if (type === 'top') {
      cameraRef.current.rotX = 1.57; // 90 deg down
      cameraRef.current.rotY = 0.0;
      cameraRef.current.panX = 0;
      cameraRef.current.panY = 0;
      cameraRef.current.zoom = 1.0;
      cameraRef.current.is3D = true;
      setIs3D(true);
    } else if (type === 'front') {
      cameraRef.current.rotX = 0.0;
      cameraRef.current.rotY = 0.0;
      cameraRef.current.panX = 0;
      cameraRef.current.panY = 0;
      cameraRef.current.zoom = 1.0;
      cameraRef.current.is3D = true;
      setIs3D(true);
    }
  };

  const handleResetCamera = () => {
    cameraRef.current.rotX = 0.45;
    cameraRef.current.rotY = 0.15;
    cameraRef.current.zoom = 1.0;
    cameraRef.current.panX = 0;
    cameraRef.current.panY = 0;
    cameraRef.current.is3D = true;
    cameraRef.current.autoRotate = true;
    setIs3D(true);
    setAutoRotate(true);
    setSelectedNode(null);
  };

  // Connected nodes set for selective highlighting
  const connectedIds = useMemo(() => {
    const active = selectedNode || hoveredNode;
    if (!active) return null;
    const set = new Set([active.id]);
    edges3D.forEach((e) => {
      if (e.source === active.id) set.add(e.target);
      if (e.target === active.id) set.add(e.source);
    });
    return set;
  }, [selectedNode, hoveredNode, edges3D]);

  // Main high-performance hardware-accelerated Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 850;
      const height = canvas.clientHeight || 520;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cam = cameraRef.current;

      // Auto-rotation increment
      if (cam.autoRotate && cam.is3D && !dragRef.current.isDragging) {
        cam.rotY = (cam.rotY + 0.005) % (Math.PI * 2);
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const cosY = Math.cos(cam.rotY);
      const sinY = Math.sin(cam.rotY);
      const cosX = Math.cos(cam.rotX);
      const sinX = Math.sin(cam.rotX);
      const perspective = 680;

      // Draw background grid & holographic orbital rings
      if (cam.is3D) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        // Inner orbital ellipse
        ctx.beginPath();
        const innerRy = Math.max(12, 135 * Math.abs(cosX) * cam.zoom);
        ctx.ellipse(centerX + cam.panX, centerY + cam.panY + (cam.rotX * 30), 135 * cam.zoom, innerRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Outer torus ellipse
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
        ctx.beginPath();
        const outerRy = Math.max(20, 250 * Math.abs(cosX) * cam.zoom);
        ctx.ellipse(centerX + cam.panX, centerY + cam.panY + (cam.rotX * 60), 250 * cam.zoom, outerRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // Project all nodes to screen coordinates
      const projected = nodes3D.map((n) => {
        if (!cam.is3D) {
          // 2D Flat Planar Mode
          const screenX = centerX + n.x0 * 0.95 * cam.zoom + cam.panX;
          const screenY = centerY + n.z0 * 0.95 * cam.zoom + cam.panY;
          return {
            ...n,
            screenX,
            screenY,
            scale: cam.zoom,
            depth: 0,
            renderedRadius: Math.max(4, n.radius * cam.zoom)
          };
        }

        // 3D Euler Euler Rotation
        const x1 = n.x0 * cosY - n.z0 * sinY;
        const z1 = n.x0 * sinY + n.z0 * cosY;
        const y2 = n.y0 * cosX - z1 * sinX;
        const z2 = n.y0 * sinX + z1 * cosX;

        const depthScale = (perspective / (perspective + z2)) * cam.zoom;
        const screenX = centerX + x1 * depthScale + cam.panX;
        const screenY = centerY + y2 * depthScale + cam.panY;

        return {
          ...n,
          screenX,
          screenY,
          scale: depthScale,
          depth: z2,
          renderedRadius: Math.max(3, n.radius * depthScale)
        };
      });

      projectedNodesRef.current = projected;

      // Project edge positions
      const mappedProjected = {};
      projected.forEach((p) => {
        mappedProjected[p.id] = p;
      });

      const projectedEdges = edges3D.map((e) => {
        const sNode = mappedProjected[e.source];
        const tNode = mappedProjected[e.target];
        const avgDepth = sNode && tNode ? (sNode.depth + tNode.depth) / 2 : 0;
        return {
          ...e,
          sNode,
          tNode,
          avgDepth
        };
      }).filter((e) => e.sNode && e.tNode);

      // Depth sort edges: draw furthest edges first
      projectedEdges.sort((a, b) => b.avgDepth - a.avgDepth);

      // 1. Draw Edges
      projectedEdges.forEach((e) => {
        const isHighlighted = connectedIds && connectedIds.has(e.source) && connectedIds.has(e.target);
        const isDimmed = connectedIds && !isHighlighted;

        const baseAlpha = isDimmed ? 0.05 : isHighlighted ? 0.95 : Math.max(0.12, Math.min(0.65, 0.35 * (e.sNode.scale + e.tNode.scale) / 2));
        const strokeColor = isHighlighted
          ? (e.is_high_risk ? 'rgba(239, 68, 68, 0.95)' : 'rgba(56, 189, 248, 0.95)')
          : (e.is_high_risk ? `rgba(239, 68, 68, ${baseAlpha})` : `rgba(148, 163, 184, ${baseAlpha})`);

        ctx.beginPath();
        ctx.moveTo(e.sNode.screenX, e.sNode.screenY);
        ctx.lineTo(e.tNode.screenX, e.tNode.screenY);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isHighlighted ? (e.width || 2) + 2 : Math.max(1, (e.width || 1.5) * e.sNode.scale);
        ctx.stroke();
      });

      // Depth sort nodes: draw furthest nodes first (painter's algorithm)
      const sortedNodes = [...projected].sort((a, b) => b.depth - a.depth);

      // 2. Draw Nodes
      sortedNodes.forEach((node) => {
        const isNodeConnected = connectedIds && connectedIds.has(node.id);
        const isDimmed = connectedIds && !isNodeConnected;
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isSelected = selectedNode && selectedNode.id === node.id;

        const nodeAlpha = isDimmed ? 0.15 : 1.0;
        const r = isHovered || isSelected ? node.renderedRadius * 1.25 : node.renderedRadius;

        ctx.save();
        ctx.globalAlpha = nodeAlpha;

        // Glowing outer reticle ring for hovered / selected / high-risk nodes
        if (isHovered || isSelected || (node.is_high_risk && !isDimmed)) {
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isHovered || isSelected ? '#38bdf8' : 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
          ctx.stroke();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Inner specular highlight
        ctx.beginPath();
        ctx.arc(node.screenX - r * 0.3, node.screenY - r * 0.3, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();

        // Node border
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, r, 0, Math.PI * 2);
        ctx.strokeStyle = node.secondaryColor || '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Labels for districts or highlighted/hovered nodes
        if ((node.type === 'district' && node.scale > 0.7) || isHovered || isSelected) {
          const fontSize = Math.max(9, Math.min(13, 11 * node.scale));
          ctx.font = `${isHovered || isSelected ? '700' : '600'} ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : 'rgba(226, 232, 240, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          // Text shadow for legibility
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          const displayName = node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name;
          ctx.fillText(displayName, node.screenX, node.screenY + r + 3);
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      });

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [nodes3D, edges3D, connectedIds, hoveredNode, selectedNode]);

  // Spatial hit collision detection
  const findNodeAtPosition = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const projected = projectedNodesRef.current || [];
    // Search in reverse order (front-most nodes first)
    for (let i = projected.length - 1; i >= 0; i--) {
      const node = projected[i];
      const dx = x - node.screenX;
      const dy = y - node.screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= node.renderedRadius + 6) {
        return node;
      }
    }
    return null;
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    const drag = dragRef.current;
    drag.isDragging = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.initialRotX = cameraRef.current.rotX;
    drag.initialRotY = cameraRef.current.rotY;
    drag.initialPanX = cameraRef.current.panX;
    drag.initialPanY = cameraRef.current.panY;
    drag.isPanMode = e.shiftKey || e.button === 1;
    drag.hasMoved = false;
  };

  const handleMouseMove = (e) => {
    const drag = dragRef.current;
    if (drag.isDragging) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.hasMoved = true;
      }

      if (drag.isPanMode || !cameraRef.current.is3D) {
        // Pan Mode
        cameraRef.current.panX = drag.initialPanX + dx;
        cameraRef.current.panY = drag.initialPanY + dy;
      } else {
        // 3D Rotation Mode
        const sensitivity = 0.007;
        cameraRef.current.rotY = (drag.initialRotY + dx * sensitivity) % (Math.PI * 2);
        // Clamp pitch tilt between -80 and +80 degrees
        cameraRef.current.rotX = Math.max(-1.4, Math.min(1.4, drag.initialRotX - dy * sensitivity));
      }
    } else {
      // Hover detection
      const hit = findNodeAtPosition(e.clientX, e.clientY);
      if (hit !== hoveredNode) {
        setHoveredNode(hit);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
        }
      }
    }
  };

  const handleMouseUp = (e) => {
    const drag = dragRef.current;
    if (drag.isDragging && !drag.hasMoved) {
      // Single click without drag: select or inspect node
      const hit = findNodeAtPosition(e.clientX, e.clientY);
      if (hit) {
        setSelectedNode(hit);
        if (hit.type === 'contractor') {
          setActiveContractorModal(hit.name);
        } else {
          setActiveDistrictModal({ district: hit.name, state: hit.state || selectedState });
        }
      } else {
        setSelectedNode(null);
      }
    }
    drag.isDragging = false;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNode ? 'pointer' : 'grab';
    }
  };

  // Wheel zoom listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      cameraRef.current.zoom = Math.max(0.5, Math.min(3.8, Number((cameraRef.current.zoom * zoomFactor).toFixed(3))));
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const activeFocus = selectedNode || hoveredNode;

  return (
    <div className="panel" ref={containerRef} style={{ marginTop: 24, position: 'relative' }}>
      {/* Header & Controls */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-heading)' }}>
            3D Contractor Cartel &amp; Cross-District Network
            <span style={{ fontSize: '0.72rem', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              60 FPS Canvas Engine
            </span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Hardware-accelerated 3D spatial intelligence revealing vendor dominance, multi-district concurrency, and cartel topologies
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* State Filter */}
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            <option value="">All India (National Network)</option>
            {statesList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Min Projects Filter */}
          <select
            value={minProjects}
            onChange={(e) => setMinProjects(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
          >
            <option value={1}>≥ 1 Projects</option>
            <option value={2}>≥ 2 Projects</option>
            <option value={3}>≥ 3 Projects</option>
            <option value={5}>≥ 5 Projects</option>
          </select>

          {/* High-risk filter toggle */}
          <label style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: filterHighRiskOnly ? '#f87171' : 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={filterHighRiskOnly}
              onChange={(e) => setFilterHighRiskOnly(e.target.checked)}
            />
            <span>High Risk Only</span>
          </label>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 8,
        fontSize: '0.75rem'
      }}>
        {/* Camera Perspective Presets */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Perspective:</span>
          <button
            onClick={() => applyCameraPreset('isometric')}
            className="btn btn-outline btn-sm"
            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
          >
            Isometric
          </button>
          <button
            onClick={() => applyCameraPreset('top')}
            className="btn btn-outline btn-sm"
            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
          >
            Top-Down
          </button>
          <button
            onClick={() => applyCameraPreset('front')}
            className="btn btn-outline btn-sm"
            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
          >
            Front
          </button>
        </div>

        {/* View Mode & Orbit Controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setIs3D(!is3D)}
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: is3D ? 'var(--accent-primary-glow)' : 'var(--bg-card)',
              color: is3D ? 'var(--accent-hover)' : 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {is3D ? '3D Projection' : '2D Planar Layout'}
          </button>

          {is3D && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                padding: '3px 9px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: autoRotate ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                color: autoRotate ? '#4ade80' : 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {autoRotate ? 'Pause Orbit' : 'Auto-Orbit'}
            </button>
          )}

          <button
            onClick={handleResetCamera}
            title="Reset Camera Orientation & Zoom"
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            ⟲ Reset Camera
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: 460 }}>
          <div className="spinner"></div> Generating 3D Contractor-District Topology...
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 520,
            overflow: 'hidden',
            borderRadius: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            userSelect: 'none'
          }}
        >
          {/* Hardware-accelerated HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: 'grab'
            }}
          />

          {/* Controls Quick Guide HUD */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            right: 14,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-card)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            Drag: Rotate 3D · Shift+Drag: Pan · Scroll: Zoom · Click Node: Open Dossier
          </div>

          {/* Color Legend HUD */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 14,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-card)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: '0.72rem',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            color: 'var(--text-primary)',
            zIndex: 10
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }}></span>
              District Hub
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
              Critical Risk
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
              Medium Risk
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              Low Risk
            </span>
          </div>

          {/* Interactive Inspection Dossier Card on Hover / Selection */}
          {activeFocus && (
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${activeFocus.color || 'var(--border-card)'}`,
                borderRadius: 8,
                padding: '12px 16px',
                width: 270,
                boxShadow: 'var(--glass-shadow)',
                zIndex: 25,
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: activeFocus.color, fontWeight: 700 }}>
                  {activeFocus.type === 'contractor' ? 'Contractor Vendor Profile' : 'District Project Hub'}
                </span>
                {selectedNode && (
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', color: 'var(--text-heading)' }}>
                {activeFocus.name}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '6px 0', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Total Projects:</span>
                  <div style={{ fontWeight: 700 }}>{activeFocus.project_count || 0}</div>
                </div>
                {activeFocus.type === 'contractor' && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Avg Risk Score:</span>
                    <div style={{ fontWeight: 700, color: activeFocus.color }}>
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
                  <strong>Concurrency Flag:</strong> Multi-district public work execution
                </div>
              )}
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: 10, fontSize: '0.75rem', padding: '5px 8px' }}
                onClick={() => {
                  if (activeFocus.type === 'contractor') {
                    setActiveContractorModal(activeFocus.name);
                  } else {
                    setActiveDistrictModal({ district: activeFocus.name, state: activeFocus.state || selectedState });
                  }
                }}
              >
                Open Detailed {activeFocus.type === 'contractor' ? 'Contractor' : 'District'} View
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contractor Detailed View Modal */}
      {activeContractorModal && (
        <ContractorDetailModal
          contractorName={activeContractorModal}
          state={selectedState}
          onClose={() => setActiveContractorModal(null)}
        />
      )}

      {/* District Detailed View Modal */}
      {activeDistrictModal && (
        <DistrictDetailModal
          districtName={activeDistrictModal.district}
          stateName={activeDistrictModal.state}
          onClose={() => setActiveDistrictModal(null)}
        />
      )}
    </div>
  );
}
