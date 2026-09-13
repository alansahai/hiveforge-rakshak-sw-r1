import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStatesSummary, fetchStateDashboard, formatCrore, formatLakh, getRiskColor } from '../api/client';
import { OFFICIAL_INDIA_STATES, INDIA_CANVAS_VIEWBOX } from '../assets/indiaMapData';
import DISTRICT_COORDS_DB from '../assets/districtCoordinates.json';
import DistrictDetailModal from './DistrictDetailModal';
import RealTimeDistrictMap from './RealTimeDistrictMap';

// Known spelling transliterations and district aliases
const DISTRICT_ALIASES = {
  'thoothukudi': 'thoothukkudi',
  'tuticorin': 'thoothukkudi',
  'thoothukkudi': 'thoothukkudi',
  'tiruvallur': 'thiruvallur',
  'thiruvallur': 'thiruvallur',
  'kanyakumari': 'kanniyakumari',
  'kanniyakumari': 'kanniyakumari',
  'tirupur': 'tiruppur',
  'tiruppur': 'tiruppur',
  'villupuram': 'viluppuram',
  'viluppuram': 'viluppuram',
  'tirupathur': 'tirupathur',
  'tirupattur': 'tirupathur',
  'tiruvarur': 'thiruvarur',
  'thiruvarur': 'thiruvarur',
  'kanchipuram': 'kancheepuram',
  'kancheepuram': 'kancheepuram',
  'tiruchirappalli': 'tiruchirappalli',
  'trichy': 'tiruchirappalli',
  'dharashiv': 'osmanabad',
  'osmanabad': 'osmanabad',
  'chhatrapati sambhajinagar': 'aurangabad',
  'aurangabad': 'aurangabad',
  'prayagraj': 'allahabad',
  'allahabad': 'allahabad',
  'ayodhya': 'faizabad',
  'faizabad': 'faizabad',
  'gurugram': 'gurgaon',
  'gurgaon': 'gurgaon',
  'mysuru': 'mysore',
  'mysore': 'mysore',
  'belagavi': 'belgaum',
  'belgaum': 'belgaum',
  'kalaburagi': 'gulbarga',
  'gulbarga': 'kalaburagi'
};

const normalizeDistrictQuery = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/th/g, 't')
    .replace(/kk/g, 'k')
    .replace(/pp/g, 'p')
    .replace(/ll/g, 'l')
    .replace(/nn/g, 'n')
    .replace(/tt/g, 't')
    .replace(/rr/g, 'r')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/[^a-z0-9]/g, '');
};

const matchesDistrict = (districtName, query) => {
  if (!districtName || !query) return false;
  const dNorm = districtName.toLowerCase().trim();
  const qNorm = query.toLowerCase().trim();
  if (dNorm.includes(qNorm)) return true;

  const aliasD = DISTRICT_ALIASES[dNorm];
  if (aliasD && (aliasD.includes(qNorm) || qNorm.includes(aliasD))) return true;

  const aliasQ = DISTRICT_ALIASES[qNorm];
  if (aliasQ && (dNorm.includes(aliasQ) || aliasQ.includes(dNorm))) return true;

  const nD = normalizeDistrictQuery(dNorm);
  const nQ = normalizeDistrictQuery(qNorm);
  if (nD && nQ && (nD.includes(nQ) || nQ.includes(nD))) return true;

  return false;
};

export default function IndiaStateMap() {
  const [statesData, setStatesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef(null);

  // Drill-down State & Districts
  const [viewMode, setViewMode] = useState('national'); // 'national' or 'state'
  const [stateDistricts, setStateDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const [activeDistrictModal, setActiveDistrictModal] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchStatesSummary().then((data) => {
      setStatesData(data || []);
      setLoading(false);
      // Default select high-volume state
      const initial = data?.find((s) => s.state.toLowerCase() === 'maharashtra') || data?.[0] || null;
      if (initial) setSelectedState(initial);
    });
  }, []);

  // Map state name to API summary metrics
  const stateMetricsMap = useMemo(() => {
    const map = {};
    statesData.forEach((s) => {
      map[s.state.toLowerCase()] = s;
    });
    return map;
  }, [statesData]);

  const getIntensityColor = (riskScore) => {
    if (riskScore >= 65) return '#ef4444';
    if (riskScore >= 50) return '#f97316';
    if (riskScore >= 35) return '#f59e0b';
    return '#22c55e';
  };

  const activeFocusState = hoveredState || selectedState;
  const filteredList = useMemo(() => {
    if (!searchQuery) return statesData;
    return statesData.filter((s) => s.state.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [statesData, searchQuery]);

  // Load districts whenever entering state view mode or switching selectedState in state mode
  const loadStateDistricts = async (stateName) => {
    if (!stateName) return;
    setDistrictsLoading(true);
    try {
      const res = await fetchStateDashboard(stateName);
      if (res && res.district_heatmap) {
        setStateDistricts(res.district_heatmap);
      } else {
        setStateDistricts([]);
      }
    } catch (err) {
      console.error('Error fetching state districts:', err);
      setStateDistricts([]);
    } finally {
      setDistrictsLoading(false);
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(5.0, Number((prev * 1.3).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.75, Number((prev * 0.77).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setViewMode('national');
    setSelectedDistrict(null);
  };

  const handleFocusState = (stateObj) => {
    if (!stateObj) return;
    const node = OFFICIAL_INDIA_STATES.find(s => s.name.toLowerCase() === stateObj.state.toLowerCase());
    if (!node) return;
    const targetZoom = 2.6;
    // Map canvas is 780x880 with center at (390, 422)
    // When scaled by targetZoom, pan = 390 - node.cx * targetZoom, 422 - node.cy * targetZoom
    const newPanX = 390 - node.cx * targetZoom;
    const newPanY = 422 - node.cy * targetZoom;
    setZoom(targetZoom);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleDrillDownToState = (stateObj) => {
    if (!stateObj) return;
    setSelectedState(stateObj);
    setSelectedDistrict(null);
    setViewMode('state');
    handleFocusState(stateObj);
    loadStateDistricts(stateObj.state);
  };

  // Mouse wheel zoom
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prev) => Math.max(0.75, Math.min(5.0, Number((prev * factor).toFixed(2)))));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Mouse drag panning
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Exact conformal cartographic projection matching official Survey of India SVG paths
  const projectLatLonToSvg = (lat, lon) => {
    const k = Math.cos(22 * Math.PI / 180);
    const scale = 25.883118;
    const paddingX = 40;
    const paddingY = 30;
    const minLon = 68.2096;
    const maxLat = 37.0517;
    const x = paddingX + ((lon - minLon) * k) * scale;
    const y = paddingY + (maxLat - lat) * scale;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  // District coordinates mapped using real nationwide geographic coordinates + cartographic decluttering
  const districtNodes = useMemo(() => {
    if (!selectedState || !stateDistricts.length) return [];
    const node = OFFICIAL_INDIA_STATES.find(s => s.name.toLowerCase() === selectedState.state.toLowerCase());
    if (!node) return [];

    const stateKey = selectedState.state.toLowerCase();

    // First pass: project each district to exact conformal SVG canvas coordinates
    const initialNodes = stateDistricts.map((d, i) => {
      const dClean = d.district.toLowerCase();
      const aliasD = DISTRICT_ALIASES[dClean] || dClean;
      const namespaced = `${stateKey}::${dClean}`;
      const aliasNamespaced = `${stateKey}::${aliasD}`;

      let lat = null;
      let lon = null;

      // 1. Check nationwide verified database (state::district namespace)
      if (DISTRICT_COORDS_DB[namespaced]) {
        [lat, lon] = DISTRICT_COORDS_DB[namespaced];
      } else if (DISTRICT_COORDS_DB[aliasNamespaced]) {
        [lat, lon] = DISTRICT_COORDS_DB[aliasNamespaced];
      } else if (DISTRICT_COORDS_DB[dClean]) {
        [lat, lon] = DISTRICT_COORDS_DB[dClean];
      } else if (DISTRICT_COORDS_DB[aliasD]) {
        [lat, lon] = DISTRICT_COORDS_DB[aliasD];
      } else if (d.lat && d.lon) {
        lat = d.lat;
        lon = d.lon;
      }

      if (lat && lon) {
        const pt = projectLatLonToSvg(lat, lon);
        return {
          ...d,
          cx: pt.x,
          cy: pt.y,
          hasExactCoords: true
        };
      }

      // Safe fallback distributed within state centroid
      const ring = i % 3;
      const radius = 10 + ring * 7;
      const angle = (2 * Math.PI * i) / Math.max(stateDistricts.length, 1);
      return {
        ...d,
        cx: node.cx + radius * Math.cos(angle),
        cy: node.cy + radius * Math.sin(angle),
        hasExactCoords: false
      };
    });

    // Second pass: Cartographic Label Placement & Anti-Collision Offsets
    return initialNodes.map((dist, idx) => {
      let closestDist = Infinity;
      let closestNeighbor = null;

      for (let j = 0; j < initialNodes.length; j++) {
        if (idx === j) continue;
        const other = initialNodes[j];
        const dx = other.cx - dist.cx;
        const dy = other.cy - dist.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) {
          closestDist = d;
          closestNeighbor = other;
        }
      }

      // Default label placement: centered underneath the pin
      let labelAnchor = 'middle';
      let labelDx = 0;
      let labelDy = 7.5;

      if (closestDist < 18 && closestNeighbor) {
        const dx = dist.cx - closestNeighbor.cx;
        const dy = dist.cy - closestNeighbor.cy;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx >= 0) {
            // Repel eastward (to the right)
            labelAnchor = 'start';
            labelDx = 4.5;
            labelDy = 1.8;
          } else {
            // Repel westward (to the left)
            labelAnchor = 'end';
            labelDx = -4.5;
            labelDy = 1.8;
          }
        } else {
          if (dy >= 0) {
            // Repel southward (below)
            labelAnchor = 'middle';
            labelDx = 0;
            labelDy = 7.5;
          } else {
            // Repel northward (above)
            labelAnchor = 'middle';
            labelDx = 0;
            labelDy = -5.2;
          }
        }
      }

      return {
        ...dist,
        labelAnchor,
        labelDx,
        labelDy
      };
    });
  }, [selectedState, stateDistricts]);

  // Filtered districts for the table matrix with fuzzy and alias matching
  const filteredDistricts = useMemo(() => {
    if (!districtSearch) return stateDistricts;
    return stateDistricts.filter(d => matchesDistrict(d.district, districtSearch));
  }, [stateDistricts, districtSearch]);

  return (
    <div className="panel" style={{ border: '1px solid rgba(59, 130, 246, 0.3)', background: 'var(--bg-card)' }}>
      {/* Panel Header */}
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)' }}>
            🗺️ Official Pan-India 37 States & UTs Cartographic Risk Intensity Map
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Official Survey of India boundaries across all 37 States & UTs. Scroll/drag to zoom, and drill down into any district.
          </span>
        </div>

        {/* State Search & View mode */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search any state or UT..."
            style={{ width: 220, fontSize: '0.78rem', padding: '5px 10px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Breadcrumb & Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        marginBottom: 12,
        border: '1px solid var(--border-subtle)',
        fontSize: '0.82rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleResetZoom}
            style={{
              background: viewMode === 'national' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              color: viewMode === 'national' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            🇮🇳 Pan-India National Map
          </button>

          {selectedState && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>&gt;</span>
              <button
                onClick={() => {
                  setViewMode('state');
                  handleFocusState(selectedState);
                  if (!stateDistricts.length) loadStateDistricts(selectedState.state);
                }}
                style={{
                  background: viewMode === 'state' && !selectedDistrict ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: viewMode === 'state' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🚩 {selectedState.state}
              </button>
            </>
          )}

          {selectedDistrict && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>&gt;</span>
              <span style={{
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#c4b5fd',
                borderRadius: 6,
                padding: '4px 10px',
                fontWeight: 600
              }}>
                📍 District {selectedDistrict.district}
              </span>
            </>
          )}
        </div>

        {/* State Drill-down Quick Switch button */}
        {selectedState && viewMode === 'national' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleDrillDownToState(selectedState)}
            style={{ fontSize: '0.76rem', padding: '4px 12px' }}
          >
            🔍 Drill Down into {selectedState.state} Districts
          </button>
        )}
        {viewMode === 'state' && (
          <button
            className="btn btn-outline btn-sm"
            onClick={handleResetZoom}
            style={{ fontSize: '0.76rem', padding: '4px 12px' }}
          >
            ← Back to National Map
          </button>
        )}
      </div>

      {/* Fast State Quick Selector Pills */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        padding: '4px 0 10px 0',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 14
      }}>
        {filteredList.map((s) => {
          const isSelected = selectedState?.state.toLowerCase() === s.state.toLowerCase();
          const riskColor = getIntensityColor(s.avg_risk_score);
          return (
            <button
              key={s.state}
              onClick={() => {
                setSelectedState(s);
                setSelectedDistrict(null);
                if (viewMode === 'state') {
                  handleFocusState(s);
                  loadStateDistricts(s.state);
                }
              }}
              style={{
                background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-input)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 14,
                padding: '3px 10px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: riskColor }}></span>
              {s.state}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: 380 }}>
          <div className="spinner"></div> Synthesizing national spatial risk model...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
          alignItems: 'start'
        }}>
          {/* SVG Map Container with Zoom/Pan Canvas */}
          <div
            ref={mapContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              position: 'relative',
              background: 'var(--bg-secondary)',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              padding: 12,
              overflow: 'hidden',
              minWidth: 0,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            {/* Floating Zoom & Map Controls */}
            <div style={{
              position: 'absolute',
              top: 18,
              right: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 20
            }}>
              <button
                onClick={handleZoomIn}
                title="Zoom In (+)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              >
                -
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset View (⟲)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              >
                ⟲
              </button>
              {selectedState && (
                <button
                  onClick={() => handleFocusState(selectedState)}
                  title="Focus Selected State"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: 'rgba(59, 130, 246, 0.25)',
                    border: '1px solid var(--accent-primary)',
                    color: '#60a5fa',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}
                >
                  🎯
                </button>
              )}
            </div>

            {/* Current Zoom Level Pill */}
            <div style={{
              position: 'absolute',
              bottom: 40,
              right: 18,
              background: 'rgba(0,0,0,0.6)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              zIndex: 20
            }}>
              Zoom: {Math.round(zoom * 100)}%
            </div>

            <svg
              viewBox={INDIA_CANVAS_VIEWBOX}
              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 620 }}
            >
              {/* Background Map Grid & Filters */}
              <defs>
                <pattern id="map-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                </pattern>
                <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <radialGradient id="ocean-radial" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#0b1222" />
                  <stop offset="100%" stopColor="#040711" />
                </radialGradient>
              </defs>

              {/* Background & Compass */}
              <rect x="25" y="15" width="730" height="815" fill="url(#ocean-radial)" rx="8" />
              <rect x="25" y="15" width="730" height="815" fill="url(#map-grid-pattern)" rx="8" />

              {/* Geographical Ambiance Watermark Text */}
              <text x="100" y="620" fill="rgba(255,255,255,0.06)" fontSize="13" fontStyle="italic" letterSpacing="4" fontFamily="sans-serif">ARABIAN SEA</text>
              <text x="470" y="620" fill="rgba(255,255,255,0.06)" fontSize="13" fontStyle="italic" letterSpacing="4" fontFamily="sans-serif">BAY OF BENGAL</text>
              <text x="260" y="805" fill="rgba(255,255,255,0.06)" fontSize="12" fontStyle="italic" letterSpacing="4" fontFamily="sans-serif">INDIAN OCEAN</text>

              {/* Pan and Zoom Group */}
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                style={{ transition: isDragging ? 'none' : 'transform 0.25s ease-out' }}
              >
                {/* State Cartographic Geographic Shapes */}
                {OFFICIAL_INDIA_STATES.map((node) => {
                  const metrics = stateMetricsMap[node.name.toLowerCase()] || {
                    state: node.name,
                    avg_risk_score: 25,
                    total_projects: 0
                  };
                  const riskColor = getIntensityColor(metrics.avg_risk_score);
                  const isSelected = selectedState?.state.toLowerCase() === node.name.toLowerCase();
                  const isHovered = hoveredState?.state.toLowerCase() === node.name.toLowerCase();

                  // If in state mode, dim non-selected states slightly to emphasize focused state
                  const isDimmed = viewMode === 'state' && !isSelected;

                  return (
                    <g
                      key={node.id}
                      style={{ cursor: 'pointer', opacity: isDimmed ? 0.35 : 1, transition: 'all 0.2s ease' }}
                      onMouseEnter={() => setHoveredState(metrics)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedState(metrics);
                        if (isSelected && viewMode === 'national') {
                          handleDrillDownToState(metrics);
                        } else if (viewMode === 'state' && !isSelected) {
                          handleDrillDownToState(metrics);
                        }
                      }}
                    >
                      {/* Official Geographic Boundary Path */}
                      {node.d && (
                        <path
                          d={node.d}
                          fill={isSelected ? 'rgba(59, 130, 246, 0.55)' : isHovered ? `${riskColor}55` : `${riskColor}28`}
                          stroke={isSelected ? '#ffffff' : isHovered ? '#60a5fa' : riskColor}
                          strokeWidth={isSelected ? (viewMode === 'state' ? 3.5 : 2.5) : isHovered ? 1.8 : 0.9}
                          filter={isSelected || isHovered ? 'url(#map-glow)' : undefined}
                          style={{ transition: 'all 0.15s ease' }}
                        />
                      )}

                      {/* Dedicated Marker for Small UTs, Islands & Enclaves */}
                      {(node.isUT || node.isSpecial) && (
                        <g>
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r={isSelected || isHovered ? 11 : 8}
                            fill="none"
                            stroke={isSelected ? '#60a5fa' : riskColor}
                            strokeWidth="1.5"
                            opacity={isSelected || isHovered ? 0.9 : 0.5}
                            strokeDasharray="3 2"
                          />
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r={isSelected || isHovered ? 6 : 4.5}
                            fill={isSelected ? '#3b82f6' : riskColor}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            filter={isSelected || isHovered ? 'url(#map-glow)' : undefined}
                          />
                        </g>
                      )}

                      {/* State Centroid Label (Hidden in State Drill-down mode to prevent obscuring district nodes) */}
                      {(!isSelected || viewMode !== 'state') && (
                        <>
                          <text
                            x={node.cx}
                            y={node.cy - 1}
                            textAnchor="middle"
                            fill={isSelected || isHovered ? '#ffffff' : '#e2e8f0'}
                            fontSize={node.name.length > 14 ? 7.5 : 8.5}
                            fontWeight={isSelected || isHovered ? 700 : 600}
                            style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                          >
                            {node.name.length > 12 ? node.name.split(' ').map(w => w[0]).join('') : node.name}
                          </text>

                          {/* Risk Metric Tag */}
                          <text
                            x={node.cx}
                            y={node.cy + 9}
                            textAnchor="middle"
                            fill={isSelected ? '#93c5fd' : riskColor}
                            fontSize="7.5"
                            fontWeight="bold"
                            style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                          >
                            {metrics.avg_risk_score}/100
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* State District Spatial Nodes Overlay (When in State Drill-down Mode) */}
                {viewMode === 'state' && districtNodes.map((dist) => {
                  const distRiskColor = getIntensityColor(dist.avg_risk_score);
                  const isDistSelected = selectedDistrict?.district.toLowerCase() === dist.district.toLowerCase();
                  const isDistHovered = hoveredDistrict?.district.toLowerCase() === dist.district.toLowerCase();

                  // Scale-invariant sizing: crisp, compact beacons that stay readable at any zoom level
                  const z = Math.max(1, Math.sqrt(zoom));
                  const rOuter = (isDistSelected ? 5.6 : isDistHovered ? 4.5 : 3.2) / z;
                  const rInner = (isDistSelected ? 2.8 : isDistHovered ? 2.2 : 1.5) / z;
                  const strokeW = (isDistSelected ? 1.4 : 0.8) / z;
                  const fontSize = (isDistSelected ? 6.2 : isDistHovered ? 5.2 : 4.2) / z;

                  // Smart cartographic offset calculated away from nearby neighbors
                  const lx = dist.cx + (dist.labelDx || 0) / z;
                  const ly = dist.cy + (dist.labelDy || 7.5) / z;
                  const anchor = dist.labelAnchor || 'middle';

                  return (
                    <g
                      key={dist.district}
                      style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
                      onMouseEnter={() => setHoveredDistrict(dist)}
                      onMouseLeave={() => setHoveredDistrict(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDistrict(dist);
                      }}
                    >
                      {/* District Pin Beacon Ring */}
                      <circle
                        cx={dist.cx}
                        cy={dist.cy}
                        r={rOuter}
                        fill={isDistSelected ? 'rgba(59, 130, 246, 0.45)' : isDistHovered ? 'rgba(96, 165, 250, 0.3)' : 'rgba(0,0,0,0.6)'}
                        stroke={isDistSelected ? '#ffffff' : isDistHovered ? '#60a5fa' : distRiskColor}
                        strokeWidth={strokeW}
                      />
                      {/* Inner Pin */}
                      <circle
                        cx={dist.cx}
                        cy={dist.cy}
                        r={rInner}
                        fill={distRiskColor}
                        stroke="#ffffff"
                        strokeWidth={strokeW * 0.7}
                      />
                      {/* District Name Label with smart offset away from neighbors */}
                      <text
                        x={lx}
                        y={ly}
                        textAnchor={anchor}
                        fill={isDistSelected ? '#ffffff' : isDistHovered ? '#93c5fd' : '#f1f5f9'}
                        fontSize={fontSize}
                        fontWeight={isDistSelected || isDistHovered ? 700 : 500}
                        style={{
                          pointerEvents: 'none',
                          userSelect: 'none',
                          paintOrder: 'stroke',
                          stroke: '#080e1a',
                          strokeWidth: `${1.8 / z}px`,
                          strokeLinejoin: 'round'
                        }}
                      >
                        {dist.district.length > 13 && !isDistSelected && !isDistHovered ? `${dist.district.slice(0, 11)}…` : dist.district}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Map Legend */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#22c55e' }}></span> Low Risk (&lt;35)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#f59e0b' }}></span> Medium (35-50)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#f97316' }}></span> High (50-65)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#ef4444' }}></span> Critical (65+)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #60a5fa', background: '#3b82f6' }}></span> UT / District Pin
              </span>
            </div>
          </div>

          {/* Side Inspector Column: State / District Quick Insight */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* If a district is selected, show District Insight card */}
            {selectedDistrict ? (
              <div style={{
                background: 'var(--bg-card)',
                border: `1px solid ${getIntensityColor(selectedDistrict.avg_risk_score)}`,
                borderRadius: 10,
                padding: 18,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      District Intelligence Inspection
                    </span>
                    <span className="risk-badge" style={{
                      background: `${getIntensityColor(selectedDistrict.avg_risk_score)}22`,
                      color: getIntensityColor(selectedDistrict.avg_risk_score),
                      border: `1px solid ${getIntensityColor(selectedDistrict.avg_risk_score)}`,
                      fontSize: '0.72rem'
                    }}>
                      RISK SCORE • {selectedDistrict.avg_risk_score}/100
                    </span>
                  </div>
                  <h3 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    📍 {selectedDistrict.district}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Administered under {selectedState?.state || 'State'}
                  </span>
                </div>

                {/* District Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Projects Monitored</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: 2 }}>
                      {selectedDistrict.project_count?.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Sanctioned</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {formatCrore(selectedDistrict.total_sanctioned)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>High-Risk Works</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: selectedDistrict.high_risk_count > 0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                      {selectedDistrict.high_risk_count || 0}
                    </div>
                  </div>
                </div>

                {/* Embedded Real-Time Geospatial District Map */}
                <div style={{ margin: '4px 0 6px 0', borderRadius: 6, overflow: 'hidden' }}>
                  <RealTimeDistrictMap
                    districtName={selectedDistrict.district}
                    stateName={selectedState?.state}
                    districtCoordinates={selectedDistrict.lat && selectedDistrict.lon ? { lat: selectedDistrict.lat, lon: selectedDistrict.lon } : null}
                    projects={[]}
                    height="240px"
                  />
                </div>

                {/* CTAs */}
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => setActiveDistrictModal({ district: selectedDistrict.district, state: selectedState?.state })}
                >
                  🔍 View Detailed District Intelligence &amp; Projects
                </button>

                <button
                  className="btn btn-outline"
                  style={{ width: '100%', padding: '8px 14px', fontSize: '0.8rem' }}
                  onClick={() => navigate(`/district?state=${encodeURIComponent(selectedState?.state || '')}&district=${encodeURIComponent(selectedDistrict.district)}`)}
                >
                  📍 Open Full District Authority Dashboard
                </button>
              </div>
            ) : activeFocusState ? (
              /* State Authority Quick Insight Card */
              <div style={{
                background: 'var(--bg-card)',
                border: `1px solid ${getIntensityColor(activeFocusState.avg_risk_score)}`,
                borderRadius: 10,
                padding: 18,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14
              }}>
                {/* Header */}
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      State Authority Quick Insight
                    </span>
                    <span className={`risk-badge ${activeFocusState.risk_category || 'low'}`} style={{ fontSize: '0.72rem' }}>
                      {(activeFocusState.risk_category || 'low').toUpperCase()} • {activeFocusState.avg_risk_score}/100
                    </span>
                  </div>
                  <h3 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🚩 {activeFocusState.state}
                  </h3>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Projects Monitored</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: 2 }}>
                      {activeFocusState.total_projects?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {activeFocusState.completed_count?.toLocaleString() || 0} completed
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Sanctioned</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {formatCrore(activeFocusState.total_sanctioned)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Central outlay</div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expenditure</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: activeFocusState.total_spent > activeFocusState.total_sanctioned ? 'var(--risk-high)' : 'var(--text-primary)', marginTop: 2 }}>
                      {formatCrore(activeFocusState.total_spent)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {activeFocusState.cost_overrun_pct > 0 ? `+${activeFocusState.cost_overrun_pct}% overrun` : 'Within allocation'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Physical Completion</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--risk-low)', marginTop: 2 }}>
                      {activeFocusState.completion_rate}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Execution efficiency</div>
                  </div>
                </div>

                {/* Top Flagged District */}
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 6, padding: '10px 12px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Priority Vigilance Focus:</span>
                  <div style={{ color: '#f87171', fontWeight: 700, marginTop: 2 }}>
                    📍 District {activeFocusState.top_flagged_district || 'Regional Cluster'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: 2 }}>
                    {activeFocusState.critical_count || 0} critical alerts flagged across local implementing agencies.
                  </div>
                </div>

                {/* Drill Down into Districts Button */}
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => handleDrillDownToState(activeFocusState)}
                >
                  <span>🔍</span> Drill Down into {activeFocusState.state} Districts
                </button>

                {/* Go to State Authority Page */}
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => navigate(`/state?state=${encodeURIComponent(activeFocusState.state)}`)}
                >
                  <span>🚩</span> Open State Authority Management Page
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 10 }}>
                Hover or click any region on the map to preview risk insights.
              </div>
            )}

            {/* If in State Drill-Down Mode: Show District Matrix Explorer Table */}
            {viewMode === 'state' && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                padding: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📍 {selectedState?.state} District Risk Matrix ({stateDistricts.length})
                  </h4>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Filter district..."
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    style={{ width: 140, fontSize: '0.74rem', padding: '3px 8px' }}
                  />
                </div>

                {districtsLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Loading district heatmap...
                  </div>
                ) : filteredDistricts.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    No matching districts found.
                  </div>
                ) : (
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 8px' }}>District</th>
                          <th style={{ padding: '6px 8px' }}>Projects</th>
                          <th style={{ padding: '6px 8px' }}>Risk</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDistricts.map((d) => {
                          const rColor = getIntensityColor(d.avg_risk_score);
                          const isSel = selectedDistrict?.district.toLowerCase() === d.district.toLowerCase();
                          return (
                            <tr
                              key={d.district}
                              onClick={() => setSelectedDistrict(d)}
                              style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                background: isSel ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.1s'
                              }}
                            >
                              <td style={{ padding: '6px 8px', fontWeight: isSel ? 700 : 500, color: 'var(--text-primary)' }}>
                                {d.district}
                              </td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                                {d.project_count}
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <span style={{ color: rColor, fontWeight: 700 }}>
                                  {d.avg_risk_score}/100
                                </span>
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDistrict(d);
                                    setActiveDistrictModal({ district: d.district, state: selectedState?.state });
                                  }}
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* District Detail Modal */}
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
