/**
 * NER-Lifeline: Central Command Dashboard — Application Logic
 * 
 * Handles:
 *   - Leaflet map with dark tiles and corridor rendering
 *   - Animated supply convoy tracker
 *   - Telemetry polling with SRI gauge updates
 *   - Simulation preset activation
 *   - Cargo type switching
 *   - Multilingual alert ticker
 *   - Incident feed rendering
 */

const API_BASE = window.location.origin;

// ─── Map Setup ─────────────────────────────────────────────────────
const map = L.map('map', {
  center: [25.45, 92.35],
  zoom: 8,
  zoomControl: true,
  attributionControl: false,
});

// Standard OpenStreetMap tiles (Inverted in CSS for Dark Mode)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Layer groups
const segmentLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const incidentLayer = L.layerGroup().addTo(map);
const chokeLayer = L.layerGroup().addTo(map);

// ─── Constants ─────────────────────────────────────────────────────
const GUWAHATI = [26.1445, 91.7362];
const SILCHAR = [24.8333, 92.7789];
const SRI_CIRCUMFERENCE = 138.23; // 2 * π * 22
const SRI_MAX_DAYS = { medical_oxygen: 10, petroleum: 12, essential_grains: 18 };

let currentCargo = 'critical_medical';
let currentVehicleClass = 'LCV';
let currentRoutePath = [];
let convoyMarker = null;
let convoyAnimFrame = null;
let convoyProgress = 0;
let currentConvoyPos = GUWAHATI; // Track for emergency reporting

// ─── Endpoint Markers ──────────────────────────────────────────────
const guwahatiIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#38bdf8;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(56,189,248,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const silcharIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#a78bfa;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(167,139,250,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

L.marker(GUWAHATI, { icon: guwahatiIcon })
  .addTo(map)
  .bindPopup('<b style="color:#38bdf8;">Guwahati Supply Hub</b><br>Primary NER Logistics Origin');

L.marker(SILCHAR, { icon: silcharIcon })
  .addTo(map)
  .bindPopup('<b style="color:#a78bfa;">Silchar Civil Hospital</b><br>Critical Medical Destination');

// ─── Choke Point Markers ───────────────────────────────────────────
const CHOKE_POINTS = [
  { name: 'Sonapur Tunnel (NH6)', lat: 25.1130, lon: 92.3610 },
  { name: 'Kuliang-Ratacherra', lat: 25.0180, lon: 92.4150 },
  { name: 'Jatinga-Haflong (NH27)', lat: 25.1850, lon: 93.0050 },
];

CHOKE_POINTS.forEach(cp => {
  const icon = L.divIcon({
    className: '',
    html: '<div class="choke-marker">⚠</div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  L.marker([cp.lat, cp.lon], { icon })
    .addTo(chokeLayer)
    .bindPopup(`<b style="color:#f59e0b;">Choke Point</b><br>${cp.name}`);
});

// ─── Corridor Segments ─────────────────────────────────────────────
async function loadCorridorSegments() {
  try {
    const res = await fetch(`${API_BASE}/api/corridor-segments`);
    const data = await res.json();
    segmentLayer.clearLayers();
    data.segments.forEach(seg => {
      L.polyline(seg.coords, {
        color: seg.color,
        weight: seg.vulnerability_score > 60 ? 4 : 2.5,
        opacity: seg.vulnerability_score > 60 ? 0.9 : 0.6,
      }).addTo(segmentLayer);
    });
  } catch (e) {
    console.error('[Segments]', e);
  }
}

// ─── Route Computation ─────────────────────────────────────────────
async function computeRoute(cargoType) {
  try {
    const res = await fetch(`${API_BASE}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_lat: GUWAHATI[0],
        start_lon: GUWAHATI[1],
        dest_lat: SILCHAR[0],
        dest_lon: SILCHAR[1],
        cargo_type: cargoType || currentCargo,
        vehicle_class: currentVehicleClass,
      }),
    });
    const data = await res.json();

    // Clear old route
    routeLayer.clearLayers();

    if (data.path && data.path.length > 0) {
      currentRoutePath = data.path;

      // Draw route line with glow effect
      // Background glow
      L.polyline(data.path, {
        color: '#06b6d4',
        weight: 8,
        opacity: 0.15,
      }).addTo(routeLayer);

      // Main line
      L.polyline(data.path, {
        color: '#06b6d4',
        weight: 3.5,
        opacity: 0.9,
        dashArray: null,
      }).addTo(routeLayer);

      // Update stats
      animateValue('convoy-dist', `${data.total_distance_km} km`);
      animateValue('convoy-eta', `${data.estimated_time_hours} hrs`);

      updateSRI2(cargoType || currentCargo);
      checkSpoilageRisk(cargoType || currentCargo, data.estimated_time_hours);

      // Start convoy animation
      startConvoyAnimation(data.path);
    }
  } catch (e) {
    console.error('[Route]', e);
    document.getElementById('convoy-dist').textContent = 'Route Failed';
    document.getElementById('convoy-eta').textContent = '--';
  }
}

// ─── Convoy Animation ──────────────────────────────────────────────
function startConvoyAnimation(path) {
  if (convoyAnimFrame) cancelAnimationFrame(convoyAnimFrame);
  if (convoyMarker) {
    routeLayer.removeLayer(convoyMarker);
    convoyMarker = null;
  }

  if (!path || path.length < 2) return;

  const convoyIcon = L.divIcon({
    className: '',
    html: '<div class="convoy-marker"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  convoyMarker = L.marker(path[0], { icon: convoyIcon, zIndexOffset: 1000 }).addTo(routeLayer);
  convoyProgress = 0;

  const totalSegments = path.length - 1;
  const speed = 0.0003; // Progress per frame

  function animate() {
    convoyProgress += speed;
    if (convoyProgress >= 1) convoyProgress = 0;

    const globalPos = convoyProgress * totalSegments;
    const segIndex = Math.min(Math.floor(globalPos), totalSegments - 1);
    const segProgress = globalPos - segIndex;

    const lat = path[segIndex][0] + (path[segIndex + 1][0] - path[segIndex][0]) * segProgress;
    const lon = path[segIndex][1] + (path[segIndex + 1][1] - path[segIndex][1]) * segProgress;

    currentConvoyPos = [lat, lon];
    convoyMarker.setLatLng(currentConvoyPos);
    convoyAnimFrame = requestAnimationFrame(animate);
  }

  animate();
}

function animateConvoy(path) {
  startConvoyAnimation(path);
}

// ─── Telemetry Polling ─────────────────────────────────────────────
async function updateTelemetry() {
  try {
    const res = await fetch(`${API_BASE}/api/corridor-telemetry`);
    const data = await res.json();
    const st = data.district_status;

    // Isolation badge
    const badge = document.getElementById('isolation-badge');
    if (st.state_key === 'nh6_severed') {
      badge.className = 'badge badge-critical';
      badge.textContent = 'CRITICAL';
    } else if (st.state_key === 'monsoon_warning') {
      badge.className = 'badge badge-warning';
      badge.textContent = 'ELEVATED';
    } else {
      badge.className = 'badge badge-ok';
      badge.textContent = 'NORMAL';
    }

    // Lifelines
    document.getElementById('active-lifelines').textContent =
      st.active_lifelines.map(l => l.split('(')[0].trim()).join(', ');

    // Weather
    animateValue('weather-rain', `${st.live_weather.precipitation_mm_hr} mm/hr`);
    animateValue('weather-soil', st.live_weather.soil_saturation_pct);

    const mviEl = document.getElementById('weather-mvi');
    const mvi = st.live_weather.monsoon_vulnerability_index;
    mviEl.textContent = `${mvi}/100`;
    mviEl.className = `stat-value ${mvi > 70 ? 'rose' : mvi > 40 ? 'amber' : 'emerald'}`;

    // SRI Gauges
    // SRI was removed for cleaner UX

    // Incident feed
    renderIncidentFeed(data.active_incidents);

    // Incident markers on map
    renderIncidentMarkers(data.active_incidents);

    // Simulation badge
    updateSimBadge(st.state_key);

    // Multilingual ticker
    if (data.multilingual_alerts) {
      updateTicker(data.multilingual_alerts);
    }

  } catch (e) {
    console.error('[Telemetry]', e);
  }
}


// ─── Incident Feed ─────────────────────────────────────────────────
let seenIncidents = new Set();

function renderIncidentFeed(incidents) {
  const feed = document.getElementById('incident-feed');
  if (!incidents || incidents.length === 0) {
    feed.innerHTML = '<div class="feed-empty">All strategic corridors clear.</div>';
    return;
  }

  feed.innerHTML = incidents.map(inc => {
    const isNew = !seenIncidents.has(inc.id);
    if (isNew) seenIncidents.add(inc.id);

    const newTag = isNew ? `<span class="new-tag">NEW!</span>` : '';

    const time = inc.timestamp
      ? new Date(inc.timestamp * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    const sevClass = inc.severity === 'BLOCK' ? 'block' : 'caution';
    const typeColor = inc.severity === 'BLOCK' ? 'var(--accent-rose)' : 'var(--accent-amber)';

    const sosBadge = inc.sos_requested ? `<div style="margin-top: 5px;"><span class="badge badge-critical" style="animation: blink 1s infinite;">🚨 SOS RESCUE REQUESTED</span> <button class="btn btn-danger" style="padding: 2px 6px; font-size: 10px; margin-left: 5px;" onclick="dispatchNDRF('${inc.id}')">DISPATCH NDRF</button></div>` : '';

    return `
      <div class="feed-item" id="feed-item-${inc.id}" style="${inc.sos_requested ? 'border: 1px solid var(--accent-rose); background: rgba(244, 63, 94, 0.05);' : ''}">
        <div class="feed-severity ${sevClass}"></div>
        <div class="feed-content">
          <div class="feed-type" style="color:${typeColor}">
            ${inc.incident_type.replace(/_/g, ' ')} [${inc.severity}] ${newTag}
          </div>
          <div class="feed-desc">${inc.description || 'No details'}</div>
          ${sosBadge}
        </div>
        <div class="feed-time">${time}</div>
      </div>
    `;
  }).join('');
}

function dispatchNDRF(incidentId) {
  const item = document.getElementById(`feed-item-${incidentId}`);
  if (item) {
    item.style.border = '1px solid var(--accent-emerald)';
    item.style.background = 'rgba(16, 185, 129, 0.05)';
    const btn = item.querySelector('.btn-danger');
    if (btn) {
      btn.className = 'btn btn-primary';
      btn.style.background = 'var(--accent-emerald)';
      btn.textContent = 'NDRF EN ROUTE';
      btn.disabled = true;
    }
  }
  dispatchOfficialAlert(`NDRF Rescue Team Dispatched to Incident #${incidentId.substring(0,8)}. Radio ping sent.`, 'CRITICAL', 'Command Center');
  
  // Simulate automated API hook to email/radio dispatch system
  console.log(`[SYS-DISPATCH] Sent high-priority radio broadcast & email to SDRF HQ for incident ${incidentId}`);
}

// ─── Incident Map Markers ──────────────────────────────────────────
function renderIncidentMarkers(incidents) {
  incidentLayer.clearLayers();
  if (!incidents) return;

  incidents.forEach(inc => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="incident-marker">${inc.severity === 'BLOCK' ? '💥' : '⚠️'}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const color = inc.severity === 'BLOCK' ? 'var(--accent-rose)' : 'var(--accent-amber)';

    const marker = L.marker([inc.latitude, inc.longitude], { icon })
      .addTo(incidentLayer)
      .bindTooltip(
        `<b style="color:${color}">${inc.incident_type.replace(/_/g, ' ').toUpperCase()}</b><br><span style="color:var(--text-secondary);">${inc.description || ''}</span><br><small style="color:var(--text-muted);">Severity: ${inc.severity} | By: ${inc.reporter_name || 'Unknown'}</small>`,
        { direction: 'top', className: 'incident-tooltip' }
      );

    // Hazard radius circle
    if (inc.severity === 'BLOCK') {
      L.circle([inc.latitude, inc.longitude], {
        radius: 8000,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '5,5',
      }).addTo(incidentLayer);
    }
  });
}

// ─── Simulation Control ────────────────────────────────────────────
async function activateSimulation(preset) {
  try {
    // Visual feedback
    document.querySelectorAll('.sim-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sim-${preset}`).classList.add('active');

    const res = await fetch(`${API_BASE}/api/simulation/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    });
    const data = await res.json();

    // Reload everything
    await loadCorridorSegments();
    await updateTelemetry();
    await computeRoute(currentCargo);

    // Official Alerts
    if (preset === 'nh6_collapse') {
      dispatchOfficialAlert('NH6 Severed. Convoy diverted to secondary route NH27.', 'CRITICAL', 'SDRF Assam & PWD Meghalaya');
    } else if (preset === 'monsoon_heavy') {
      dispatchOfficialAlert('Heavy rainfall (140mm/hr) detected at Sonapur Tunnel. Caution advised.', 'WARNING', 'District Magistrate, East Jaintia Hills');
    } else {
      document.getElementById('alert-dispatch-log').innerHTML = '<div class="feed-empty">No active dispatch alerts.</div>';
    }

  } catch (e) {
    console.error('[Simulation]', e);
  }
}

function updateSimBadge(stateKey) {
  const badge = document.getElementById('sim-badge');
  const text = document.getElementById('sim-badge-text');

  if (stateKey === 'nh6_severed') {
    badge.className = 'sim-badge state-critical';
    text.textContent = 'CRITICAL ALERT';
  } else if (stateKey === 'monsoon_warning') {
    badge.className = 'sim-badge state-warning';
    text.textContent = 'WEATHER WARNING';
  } else {
    badge.className = 'sim-badge state-normal';
    text.textContent = 'NORMAL OPS';
  }
}

// ─── Cargo Selector ────────────────────────────────────────────────
document.querySelectorAll('.cargo-option').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.cargo-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    currentCargo = el.dataset.cargo;

    // Update display
    const labels = {
      critical_medical: 'Critical Medical',
      perishable_food: 'Perishable Food',
      petroleum: 'Petroleum Tanker',
      general_freight: 'General Freight',
    };
    document.getElementById('convoy-cargo').textContent = labels[currentCargo] || currentCargo;

    computeRoute(currentCargo);
  });
});

// ─── Vahan API Mock ────────────────────────────────────────────────
async function fetchVahanData() {
  const regNoInput = document.getElementById('vahan-reg-no');
  const regNo = regNoInput.value.trim();
  const btn = document.getElementById('vahan-fetch-btn');
  
  if (!regNo) {
    alert("Please enter a registration number.");
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch(`${API_BASE}/api/vahan/vehicle/${encodeURIComponent(regNo)}`);
    if (res.ok) {
      const data = await res.json();
      currentVehicleClass = data.vehicle_class;
      document.getElementById('vahan-vehicle-class').value = currentVehicleClass;
      dispatchOfficialAlert(`Vahan API: Resolved ${regNo} as ${data.vehicle_class} (${data.max_weight_tons}t)`, 'INFO', 'System');
      
      // Recompute route based on new constraints
      computeRoute(currentCargo);
    } else {
      alert("Failed to fetch Vahan data.");
    }
  } catch (err) {
    console.error("Vahan API Error:", err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch';
  }
}

function handleManualVehicleChange() {
  const el = document.getElementById('vahan-vehicle-class');
  currentVehicleClass = el.value;
  dispatchOfficialAlert(`Manual Override: Vehicle set to ${currentVehicleClass}`, 'INFO', 'System');
  computeRoute(currentCargo);
}

// ─── Ticker Update ─────────────────────────────────────────────────
function updateTicker(alerts) {
  const track = document.getElementById('ticker-track');
  const langs = [
    { code: 'EN', key: 'en' },
    { code: 'HI', key: 'hi' },
    { code: 'AS', key: 'as' },
    { code: 'BN', key: 'bn' },
    { code: 'KH', key: 'kh' },
  ];

  let html = '';
  // Duplicate for seamless scroll loop
  for (let dup = 0; dup < 2; dup++) {
    langs.forEach((lang, i) => {
      const text = alerts[lang.key] || alerts.en || '';
      html += `<span class="ticker-item"><span class="ticker-lang">${lang.code}</span> ${text}</span>`;
      if (i < langs.length - 1) html += '<span class="ticker-sep">│</span>';
    });
    if (dup === 0) html += '<span class="ticker-sep">│</span>';
  }
  track.innerHTML = html;
}

// ─── Utilities ─────────────────────────────────────────────────────
function animateValue(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (el.textContent !== newValue) {
    el.textContent = newValue;
    el.classList.add('value-update');
    setTimeout(() => el.classList.remove('value-update'), 400);
  }
}

// ─── Clock ─────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('header-clock').textContent =
    now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
}
setInterval(updateClock, 1000);
updateClock();

// ─── Modal Location Picker ────────────────────────────────────────
let reportPickerMap = null;
let reportPickerMarker = null;

function initReportPickerMap() {
  if (reportPickerMap) return; // already initialized

  reportPickerMap = L.map('report-location-picker', {
    center: [25.45, 92.35],
    zoom: 9,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(reportPickerMap);

  // Click to pin
  reportPickerMap.on('click', (e) => {
    placePickerPin(e.latlng.lat, e.latlng.lng);
  });
}

function placePickerPin(lat, lng) {
  const pinIcon = L.divIcon({
    className: '',
    html: `<div style="
      width: 22px; height: 22px;
      background: var(--accent-rose);
      border: 3px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 0 12px rgba(244,63,94,0.7);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

  if (reportPickerMarker) {
    reportPickerMap.removeLayer(reportPickerMarker);
  }

  reportPickerMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true })
    .addTo(reportPickerMap)
    .bindTooltip('Drag to adjust', { permanent: false, direction: 'top' });

  reportPickerMarker.on('drag', (e) => {
    setPickerCoords(e.latlng.lat, e.latlng.lng);
  });
  reportPickerMarker.on('dragend', (e) => {
    const ll = e.target.getLatLng();
    setPickerCoords(ll.lat, ll.lng);
  });

  setPickerCoords(lat, lng);

  // Update hint once pinned
  const hint = document.getElementById('location-pick-hint');
  if (hint) {
    hint.textContent = '✓ Location pinned';
    hint.style.color = 'var(--accent-emerald)';
    hint.style.background = 'rgba(16,185,129,0.1)';
    hint.style.borderColor = 'rgba(16,185,129,0.25)';
  }
}

function setPickerCoords(lat, lng) {
  document.getElementById('modal-lat').value = lat.toFixed(5);
  document.getElementById('modal-lon').value = lng.toFixed(5);
}

function useConvoyPosition() {
  const [lat, lng] = currentConvoyPos;
  reportPickerMap.setView([lat, lng], 10);
  placePickerPin(lat, lng);
}

// ─── Modal Handling ────────────────────────────────────────────────
function openReportModal() {
  const modal = document.getElementById('report-modal');
  modal.classList.add('active');

  // Reset hint
  const hint = document.getElementById('location-pick-hint');
  if (hint) {
    hint.textContent = 'Click on map to pin exact location';
    hint.style.color = 'var(--accent-amber)';
    hint.style.background = 'rgba(245,158,11,0.1)';
    hint.style.borderColor = 'rgba(245,158,11,0.25)';
  }

  // Clear lat/lon
  document.getElementById('modal-lat').value = '';
  document.getElementById('modal-lon').value = '';

  // Wait for CSS transition to fully complete (var(--transition-normal) is 0.25s)
  setTimeout(() => {
    if (!reportPickerMap) {
      initReportPickerMap();
    }
    
    // Force Leaflet to recalculate container size now that it's fully visible
    reportPickerMap.invalidateSize(true);
    
    // Reset view
    reportPickerMap.setView([25.45, 92.35], 9, { animate: false });
    
    if (reportPickerMarker) {
      reportPickerMap.removeLayer(reportPickerMarker);
      reportPickerMarker = null;
    }
    
    // One more invalidate just to be absolutely sure
    requestAnimationFrame(() => {
      reportPickerMap.invalidateSize(true);
    });
  }, 350);
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('active');
}

async function submitDashIncident(e) {
  e.preventDefault();

  const lat = parseFloat(document.getElementById('modal-lat').value);
  const lon = parseFloat(document.getElementById('modal-lon').value);

  if (isNaN(lat) || isNaN(lon)) {
    // Shake the picker to hint user
    const picker = document.getElementById('report-location-picker');
    picker.style.outline = '2px solid var(--accent-rose)';
    picker.style.boxShadow = '0 0 0 4px rgba(244,63,94,0.2)';
    setTimeout(() => {
      picker.style.outline = '';
      picker.style.boxShadow = '';
    }, 1500);
    const hint = document.getElementById('location-pick-hint');
    if (hint) {
      hint.textContent = '⚠ Pin a location on the map first!';
      hint.style.color = 'var(--accent-rose)';
      hint.style.background = 'rgba(244,63,94,0.1)';
      hint.style.borderColor = 'rgba(244,63,94,0.3)';
    }
    return;
  }

  const btn = document.getElementById('btn-submit-dash');
  btn.disabled = true;
  btn.textContent = '⏳ ...';

  const payload = {
    incident_type: document.getElementById('modal-hazard').value,
    severity: document.getElementById('modal-severity').value,
    latitude: lat,
    longitude: lon,
    description: 'Command Center Emergency Override',
    reporter_name: 'Command Center',
    timestamp: Date.now() / 1000
  };

  try {
    const res = await fetch(`${API_BASE}/api/report-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      closeReportModal();
      await updateTelemetry();
      const typeStr = payload.incident_type.replace(/_/g, ' ').toUpperCase();
      dispatchOfficialAlert(`Field Emergency Override: ${typeStr} logged at [${lat.toFixed(4)}, ${lon.toFixed(4)}].`, 'CRITICAL', 'Central Disaster Management Auth.');
    }
  } catch (err) {
    console.error('Modal submit error', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span data-i18n="btn_submit_report">Submit Incident</span>`;
    const pref = localStorage.getItem('ner_lang') || 'en';
    if(window.setLanguage) setLanguage(pref);
  }
}

// ─── Initialize ────────────────────────────────────────────────────
loadCorridorSegments();
updateTelemetry();
computeRoute(currentCargo);

// Poll telemetry every 5 seconds
setInterval(updateTelemetry, 5000);
// Refresh corridor segments every 30 seconds
setInterval(loadCorridorSegments, 30000);

// i18n Init
document.addEventListener('DOMContentLoaded', () => {
  const pref = localStorage.getItem('ner_lang') || 'en';
  document.getElementById('lang-select').value = pref;
  if(window.setLanguage) setLanguage(pref);
});

// ─── Automated Official Alerts ─────────────────────────────────────
function dispatchOfficialAlert(message, type, recipient) {
  const log = document.getElementById('alert-dispatch-log');
  
  // Remove empty state if present
  const empty = log.querySelector('.feed-empty');
  if (empty) empty.remove();

  const isCritical = type === 'CRITICAL';
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const method = isCritical ? 'SMS/RADIO' : 'EMAIL';

  const html = `
    <div class="dispatch-item ${isCritical ? 'critical' : ''}">
      <div class="dispatch-header">
        <span class="dispatch-type">[${method}] DISPATCHED</span>
        <span class="dispatch-time">${time}</span>
      </div>
      <div class="dispatch-body">
        <strong>TO:</strong> ${recipient}<br>
        <strong>MSG:</strong> ${message}
      </div>
    </div>
  `;

  log.insertAdjacentHTML('afterbegin', html);
}

// ─── Spoilage-Risk Optimizer ───────────────────────────────────────
const SHELF_LIFE = {
  'perishable_food': 12,
  'critical_medical': 24,
  'petroleum': 999,
  'general_freight': 999
};

function checkSpoilageRisk(cargo, etaHours) {
  const shelf = SHELF_LIFE[cargo] || 999;
  if (etaHours > shelf) {
    document.getElementById('spoilage-eta').textContent = etaHours.toFixed(1);
    document.getElementById('spoilage-shelf').textContent = shelf;
    
    let action = 'Divert to local cold storage facility immediately.';
    if (cargo === 'critical_medical') action = 'Initiate Intermodal Shift: Request IAF Air Cargo transfer.';
    if (cargo === 'perishable_food') action = 'Divert to Silchar Cold-Chain Hub.';
    
    document.getElementById('spoilage-action').textContent = action;
    document.getElementById('spoilage-modal').classList.add('active');
    
    dispatchOfficialAlert(`SPOILAGE RISK: ${cargo.toUpperCase()} ETA (${etaHours}h) exceeds shelf life (${shelf}h). Diverting.`, 'CRITICAL', 'Logistics Control');
  } else {
    closeSpoilageModal();
  }
}

window.closeSpoilageModal = function() {
  document.getElementById('spoilage-modal').classList.remove('active');
};

// ─── SRI 2.0 (Supply Runway Index) ─────────────────────────────────
function updateSRI2(cargo) {
  // Reset all
  ['medical', 'fuel', 'food'].forEach(type => {
    const el = document.getElementById(`sri-incoming-${type}`);
    if (el) el.textContent = '';
  });

  if (cargo === 'critical_medical') {
    const el = document.getElementById('sri-incoming-medical');
    if (el) el.textContent = '(+4 Days Incoming)';
  } else if (cargo === 'petroleum') {
    const el = document.getElementById('sri-incoming-fuel');
    if (el) el.textContent = '(+7 Days Incoming)';
  } else if (cargo === 'perishable_food') {
    const el = document.getElementById('sri-incoming-food');
    if (el) el.textContent = '(+3 Days Incoming)';
  }
}
