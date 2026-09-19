import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCrore, formatLakh, getRiskColor } from '../api/client';
import ProjectDetailModal from './ProjectDetailModal';
import DISTRICT_COORDS_DB from '../assets/districtCoordinates.json';

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

// State centroids fallback for Indian States & UTs
const STATE_CENTROIDS = {
  'tamil nadu': [11.1271, 78.6569],
  'karnataka': [15.3173, 75.7139],
  'kerala': [10.8505, 76.2711],
  'andhra pradesh': [15.9129, 79.7400],
  'telangana': [18.1124, 79.0193],
  'maharashtra': [19.7515, 75.7139],
  'gujarat': [22.2587, 71.1924],
  'rajasthan': [27.0238, 74.2179],
  'uttar pradesh': [26.8467, 80.9462],
  'madhya pradesh': [22.9734, 78.6569],
  'bihar': [25.0961, 85.3131],
  'jharkhand': [23.6102, 85.2799],
  'west bengal': [22.9868, 87.8550],
  'odisha': [20.9517, 85.0985],
  'punjab': [31.1471, 75.3412],
  'haryana': [29.0588, 76.0856],
  'delhi': [28.7041, 77.1025]
};

// Comprehensive fallback centroid coordinates for Indian districts
const FALLBACK_DISTRICT_COORDS = {
  // Tamil Nadu (All 38 Districts)
  'krishnagiri': [12.5186, 78.2137],
  'dharmapuri': [12.1211, 78.1582],
  'salem': [11.6643, 78.1460],
  'namakkal': [11.2189, 78.1674],
  'erode': [11.3410, 77.7172],
  'coimbatore': [11.0168, 76.9558],
  'tirupur': [11.1085, 77.3411],
  'tiruppur': [11.1085, 77.3411],
  'nilgiris': [11.4102, 76.6950],
  'the nilgiris': [11.4102, 76.6950],
  'dindigul': [10.3673, 77.9803],
  'karur': [10.9601, 78.0766],
  'tiruchirappalli': [10.7905, 78.7047],
  'trichy': [10.7905, 78.7047],
  'perambalur': [11.2342, 78.8821],
  'ariyalur': [11.1401, 79.0786],
  'thanjavur': [10.7870, 79.1378],
  'tiruvarur': [10.7725, 79.6365],
  'thiruvarur': [10.7725, 79.6365],
  'nagapattinam': [10.7672, 79.8449],
  'mayiladuthurai': [11.1075, 79.6523],
  'pudukkottai': [10.3797, 78.8208],
  'madurai': [9.9252, 78.1198],
  'theni': [10.0104, 77.4768],
  'virudhunagar': [9.5872, 77.9514],
  'sivaganga': [9.8433, 78.4809],
  'ramanathapuram': [9.3639, 78.8395],
  'thoothukudi': [8.7642, 78.1348],
  'thoothukkudi': [8.7642, 78.1348],
  'tuticorin': [8.7642, 78.1348],
  'tirunelveli': [8.7139, 77.7567],
  'tenkasi': [8.9594, 77.3152],
  'kanyakumari': [8.0883, 77.5385],
  'kanniyakumari': [8.0883, 77.5385],
  'chennai': [13.0827, 80.2707],
  'thiruvallur': [13.1439, 79.9083],
  'tiruvallur': [13.1439, 79.9083],
  'kancheepuram': [12.8342, 79.7036],
  'kanchipuram': [12.8342, 79.7036],
  'chengalpattu': [12.6841, 79.9836],
  'ranipet': [12.9272, 79.3330],
  'vellore': [12.9165, 79.1325],
  'tirupathur': [12.4958, 78.5678],
  'tirupattur': [12.4958, 78.5678],
  'tiruvannamalai': [12.2253, 79.0747],
  'villupuram': [11.9401, 79.4861],
  'viluppuram': [11.9401, 79.4861],
  'kallakurichi': [11.7384, 78.9639],
  'cuddalore': [11.7480, 79.7714],

  // Karnataka
  'dharwad': [15.4589, 75.0078],
  'haveri': [14.7954, 75.3992],
  'belagavi': [15.8497, 74.4977],
  'bengaluru urban': [12.9716, 77.5946],
  'bengaluru rural': [13.2255, 77.5753],
  'mysuru': [12.2958, 76.6394],
  'ballari': [15.1394, 76.9214],
  'gadag': [15.4167, 75.6333],
  'shivamogga': [13.9299, 75.5681],

  // Uttar Pradesh
  'jaunpur': [25.7464, 82.6837],
  'varanasi': [25.3176, 82.9739],
  'lucknow': [26.8467, 80.9462],
  'prayagraj': [25.4358, 81.8463],
  'allahabad': [25.4358, 81.8463],
  'kanpur nagar': [26.4499, 80.3319],
  'bijnor': [29.3724, 78.1358],
  'mirzapur': [25.1337, 82.5644],

  // Maharashtra
  'mumbai': [19.0760, 72.8777],
  'mumbai suburban': [19.1334, 72.8956],
  'pune': [18.5204, 73.8567],
  'thane': [19.2183, 72.9781],
  'nagpur': [21.1458, 79.0882],
  'nashik': [19.9975, 73.7898],

  // Gujarat
  'ahmedabad': [23.0225, 72.5714],
  'gandhinagar': [23.2156, 72.6369],
  'surat': [21.1702, 72.8311],

  // Bihar & Jharkhand
  'patna': [25.5941, 85.1376],
  'gaya': [24.7914, 85.0002],
  'ranchi': [23.3441, 85.3096],
  'dhanbad': [23.7957, 86.4304],

  // Other Major Districts
  'kolkata': [22.5726, 88.3639],
  'thiruvananthapuram': [8.5241, 76.9366],
  'hyderabad': [17.3850, 78.4867],
  'jaipur': [26.9124, 75.7873],
  'bhopal': [23.2599, 77.4126],
  'chandigarh': [30.7333, 76.7794]
};

const TILE_PROVIDERS = {
  streets: {
    name: 'Standard Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19
  },
  dark: {
    name: 'High-Contrast Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19
  },
  satellite: {
    name: 'Satellite Orthoimagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19
  }
};

function createTileLayer(providerKey) {
  const provider = TILE_PROVIDERS[providerKey] || TILE_PROVIDERS.streets;
  return L.tileLayer(provider.url, {
    maxZoom: provider.maxZoom || 19,
    subdomains: provider.subdomains !== undefined ? provider.subdomains : '',
    crossOrigin: true,
    keepBuffer: 8,
    updateWhenIdle: false,
    updateWhenZooming: true
  });
}


export default function RealTimeDistrictMap({
  districtName = '',
  stateName = '',
  districtCoordinates = null,
  projects = [],
  height = '480px',
  onSelectProject = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerGroupRef = useRef(null);
  const circleLayerRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('streets');
  const [riskFilter, setRiskFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [inspectModalProject, setInspectModalProject] = useState(null);

  // Compute District Centroid Coordinates with multi-tier fallback
  const [centerLat, centerLon] = useMemo(() => {
    // 1. If explicit districtCoordinates passed and not dummy Central India (20.5937, 78.9629)
    if (districtCoordinates) {
      const lat = districtCoordinates.lat != null ? districtCoordinates.lat : (districtCoordinates.latitude != null ? districtCoordinates.latitude : (Array.isArray(districtCoordinates) ? districtCoordinates[0] : null));
      const lon = districtCoordinates.lon != null ? districtCoordinates.lon : (districtCoordinates.longitude != null ? districtCoordinates.longitude : (Array.isArray(districtCoordinates) ? districtCoordinates[1] : null));
      if (lat != null && lon != null && !(Math.abs(Number(lat) - 20.5937) < 0.001 && Math.abs(Number(lon) - 78.9629) < 0.001)) {
        return [Number(lat), Number(lon)];
      }
    }

    const dClean = (districtName || '').trim().toLowerCase();
    const sClean = (stateName || '').trim().toLowerCase();
    const aliasD = DISTRICT_ALIASES[dClean] || dClean;

    // 2. Check DISTRICT_COORDS_DB with state namespace
    if (sClean) {
      const stateKey = `${sClean}::${dClean}`;
      const stateAliasKey = `${sClean}::${aliasD}`;
      if (DISTRICT_COORDS_DB[stateKey]) return DISTRICT_COORDS_DB[stateKey];
      if (DISTRICT_COORDS_DB[stateAliasKey]) return DISTRICT_COORDS_DB[stateAliasKey];
    }

    // 3. Direct lookup in DISTRICT_COORDS_DB
    if (DISTRICT_COORDS_DB[dClean]) return DISTRICT_COORDS_DB[dClean];
    if (DISTRICT_COORDS_DB[aliasD]) return DISTRICT_COORDS_DB[aliasD];

    // 4. FALLBACK_DISTRICT_COORDS lookup
    if (FALLBACK_DISTRICT_COORDS[dClean]) return FALLBACK_DISTRICT_COORDS[dClean];
    if (FALLBACK_DISTRICT_COORDS[aliasD]) return FALLBACK_DISTRICT_COORDS[aliasD];

    // 5. Derive centroid from projects GPS if available
    if (projects && projects.length > 0) {
      const valid = projects.filter(p => p.latitude && p.longitude && Number(p.latitude) > 6 && Number(p.latitude) < 38 && Number(p.longitude) > 68 && Number(p.longitude) < 98);
      if (valid.length > 0) {
        const avgLat = valid.reduce((sum, p) => sum + Number(p.latitude), 0) / valid.length;
        const avgLon = valid.reduce((sum, p) => sum + Number(p.longitude), 0) / valid.length;
        return [Number(avgLat.toFixed(4)), Number(avgLon.toFixed(4))];
      }
    }

    // 6. State centroid fallback if state is known (NEVER drop into Central India for known state)
    if (sClean && STATE_CENTROIDS[sClean]) {
      return STATE_CENTROIDS[sClean];
    }

    // 7. General national fallback
    return [20.5937, 78.9629];
  }, [districtCoordinates, districtName, stateName, projects]);

  // Unique categories for filtering
  const categoriesList = useMemo(() => {
    const set = new Set();
    projects.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [projects]);

  // Filtered projects for map markers
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (riskFilter !== 'all') {
        const cat = (p.risk_category || (p.risk_score >= 80 ? 'critical' : p.risk_score >= 60 ? 'high' : p.risk_score >= 40 ? 'medium' : 'low')).toLowerCase();
        if (cat !== riskFilter) return false;
      }
      if (categoryFilter !== 'all') {
        if ((p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [projects, riskFilter, categoryFilter]);

  // 1. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer with buffer to prevent grey patches
    const tileLayer = createTileLayer(activeLayer);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer group for dynamic markers
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    // Force map to recalculate size across progressive render cycles
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);
    const t3 = setTimeout(invalidate, 600);
    const t4 = setTimeout(invalidate, 1200);

    let resizeObserver = null;
    if (typeof window !== 'undefined' && window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        invalidate();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);


  // 2. Center map when district center coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([centerLat, centerLon], 11, { animate: true });

    // Draw district jurisdictional perimeter boundary circle
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
    }

    const circle = L.circle([centerLat, centerLon], {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '5 5',
      radius: 14000 // ~14 km radius representing district cluster
    }).addTo(map);

    circleLayerRef.current = circle;
  }, [centerLat, centerLon]);

  // 3. Switch Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const newTileLayer = createTileLayer(activeLayer);
    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
    map.invalidateSize();
  }, [activeLayer]);


  // 4. Render Project Pins onto Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    filteredProjects.forEach((p) => {
      const pLat = p.latitude || centerLat;
      const pLon = p.longitude || centerLon;

      const riskScore = p.risk_score || 0;
      const isCritical = riskScore >= 80;
      const isHigh = riskScore >= 60 && riskScore < 80;
      const color = isCritical ? '#ef4444' : isHigh ? '#f97316' : riskScore >= 40 ? '#f59e0b' : '#22c55e';

      // Custom high-tech radar map pin
      const icon = L.divIcon({
        className: 'project-geo-marker',
        html: `
          <div style="position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            ${isCritical ? `<div style="position:absolute; width:34px; height:34px; border-radius:50%; border:2px solid #ef4444; animation:mapPulse 1.8s infinite; pointer-events:none;"></div>` : ''}
            <div style="width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #ffffff; box-shadow:0 2px 10px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:800;">
              ${isCritical ? '!' : ''}
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([pLat, pLon], { icon });

      // Hover Tooltip
      marker.bindTooltip(`
        <div style="font-size:11px; font-family:sans-serif;">
          <strong>${p.project_id}</strong><br/>
          <span style="color:${color}; font-weight:700;">Risk ${Math.round(riskScore)}/100</span> • ${p.progress_percentage || 0}% Done
        </div>
      `, { direction: 'top', offset: [0, -10] });

      // Click Popup with project summary dossier
      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '220px';
      popupContent.style.padding = '4px';
      popupContent.style.fontFamily = 'inherit';
      popupContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
          <span style="font-weight:700; color:#60a5fa; font-size:12px;">${p.project_id}</span>
          <span style="font-size:10px; font-weight:700; color:#fff; background:${color}; padding:2px 6px; border-radius:4px;">
            ${(p.risk_category || 'low').toUpperCase()} • ${Math.round(riskScore)}/100
          </span>
        </div>
        <div style="font-size:11px; margin-bottom:6px; color:#e2e8f0; line-height:1.3;">
          ${p.work_description || 'Public MPLADS infrastructure work'}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:10px; margin-bottom:8px;">
          <div>
            <span style="color:#94a3b8;">Sanctioned:</span><br/>
            <strong style="color:#fff;">${formatLakh(p.amount_sanctioned || 0)}</strong>
          </div>
          <div>
            <span style="color:#94a3b8;">Spent:</span><br/>
            <strong style="color:#fff;">${formatLakh(p.amount_spent || 0)}</strong>
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:2px;">
            <span>Progress:</span>
            <span>${p.progress_percentage || 0}%</span>
          </div>
          <div style="width:100%; height:4px; background:rgba(255,255,255,0.2); border-radius:2px; overflow:hidden;">
            <div style="width:${p.progress_percentage || 0}%; height:100%; background:${color};"></div>
          </div>
        </div>
        <button id="inspect-btn-${p.project_id}" style="width:100%; background:var(--accent-primary, #0B3B60); color:#fff; border:none; padding:6px 8px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">
          Inspect Project Dossier
        </button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`inspect-btn-${p.project_id}`);
        if (btn) {
          btn.onclick = () => {
            if (onSelectProject) {
              onSelectProject(p);
            } else {
              setInspectModalProject(p);
            }
          };
        }
      });

      marker.on('click', () => {
        setSelectedProjectId(p.project_id);
      });

      group.addLayer(marker);
    });
  }, [filteredProjects, centerLat, centerLon, onSelectProject]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([centerLat, centerLon], 11, { animate: true });
  };

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
      {/* Map Control Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: 10
      }}>
        {/* District Title & Live Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Real-Time District Geospatial Project Map — {districtName || 'District Overview'}
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Jurisdiction: {stateName || 'State'} • Centroid GPS: [{centerLat.toFixed(4)}, {centerLon.toFixed(4)}]
            </span>
          </div>
          <span style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '0.68rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}></span> LIVE GEOSPATIAL FEED
          </span>
        </div>

        {/* Right Controls: Filters & Layers */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Risk Filter Buttons */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 6, padding: 2 }}>
            {[
              { id: 'all', label: `All (${projects.length})` },
              { id: 'low', label: '🟢 Safe' },
              { id: 'medium', label: '🟡 Med' },
              { id: 'high', label: '🟠 High' },
              { id: 'critical', label: '🔴 Crit' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRiskFilter(f.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.7rem',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: riskFilter === f.id ? 'var(--accent-primary)' : 'transparent',
                  color: riskFilter === f.id ? '#fff' : 'var(--text-secondary)',
                  fontWeight: riskFilter === f.id ? 700 : 500
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          {categoriesList.length > 0 && (
            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 130, fontSize: '0.72rem', padding: '3px 6px' }}
            >
              <option value="all">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Tile Layer Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 6, padding: 2 }}>
            {Object.entries(TILE_PROVIDERS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.7rem',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: activeLayer === key ? 'var(--accent-primary)' : 'transparent',
                  color: activeLayer === key ? '#fff' : 'var(--text-secondary)',
                  fontWeight: activeLayer === key ? 700 : 500
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            title="Recenter to District Centroid"
            style={{
              padding: '3px 8px',
              fontSize: '0.74rem',
              borderRadius: 6,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            🎯 Recenter
          </button>
        </div>
      </div>

      {/* Map Container Element */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Floating Telemetry Stats Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-card)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.74rem',
          color: 'var(--text-primary)',
          zIndex: 10,
          display: 'flex',
          gap: 14,
          boxShadow: 'var(--glass-shadow)'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Projects Mapped: </span>
            <strong style={{ color: '#38bdf8' }}>{filteredProjects.length}</strong> / {projects.length}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Critical Anomalies: </span>
            <strong style={{ color: '#ef4444' }}>
              {projects.filter(p => (p.risk_score || 0) >= 80).length}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Cluster Radius: </span>
            <strong style={{ color: '#a78bfa' }}>~14 km</strong>
          </div>
        </div>
      </div>

      {/* Embedded Project Modal on click */}
      {inspectModalProject && (
        <ProjectDetailModal
          projectId={inspectModalProject.project_id}
          onClose={() => setInspectModalProject(null)}
        />
      )}
    </div>
  );
}
