/**
 * NER-Lifeline: Field Patrol PWA — Application Logic
 *
 * Handles:
 *   - IndexedDB local persistence for offline incident queue
 *   - Photo capture and base64 encoding
 *   - GPS auto-detection with mock fallback
 *   - Offline/Online toggle for demo simulation
 *   - Background sync on network restoration
 *   - Sync queue visualization and management
 *   - Haptic feedback on mobile
 */

const API_BASE = window.location.origin;

// ─── State ─────────────────────────────────────────────────────────
let db = null;
let selectedHazard = 'landslide';
let selectedSeverity = 'BLOCK';
let photoBase64 = null;
let isForceOffline = false;
let syncHistory = [];
let pwaMap = null;
let userMarker = null;

// ─── Voice Alerts ──────────────────────────────────────────────────

// Cache resolved voices per lang — cleared when voices change
let _voiceCache = {};
window.speechSynthesis.onvoiceschanged = () => { _voiceCache = {}; };

/**
 * Returns the best available voice for a given BCP-47 lang code.
 * Prefers neural/natural/enhanced voices. Falls back to any same-lang
 * voice, then any English voice.
 */
function _pickBestVoice(lang) {
  if (_voiceCache[lang] !== undefined) return _voiceCache[lang];

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return (_voiceCache[lang] = null);

  const qualityHints = ['natural', 'premium', 'enhanced', 'online', 'wavenet', 'neural'];
  const langPrefix = lang.split('-')[0];

  // Exact lang match, then prefix match
  let candidates = voices.filter(v => v.lang === lang);
  if (!candidates.length) candidates = voices.filter(v => v.lang.startsWith(langPrefix));

  if (!candidates.length) {
    // No voice for this language at all — fall back to best English
    const engVoices = voices.filter(v => v.lang.startsWith('en'));
    const best = engVoices.find(v => qualityHints.some(h => v.name.toLowerCase().includes(h))) || engVoices[0] || null;
    return (_voiceCache[lang] = best);
  }

  // Rank by quality hint
  const scored = candidates.map(v => {
    const idx = qualityHints.findIndex(h => v.name.toLowerCase().includes(h));
    return { v, score: idx === -1 ? 999 : idx };
  }).sort((a, b) => a.score - b.score);

  return (_voiceCache[lang] = scored[0].v);
}

/**
 * Resolves a translation key OR speaks a raw string.
 * Key detection: if the string exists in the i18n dictionary, use the
 * translated version. Otherwise speak the string as-is.
 */
function _resolveVoiceText(keyOrText) {
  if (!window.getVoiceTranslation) return keyOrText;
  // getVoiceTranslation returns the key itself when not found
  // so we must check the dictionary has an entry, not just compare strings
  const translated = window.getVoiceTranslation(keyOrText);
  // If it returned something different (a real translation), use it
  // If it returned the key back (fallback), just speak the key as plain text
  return translated;
}

/**
 * Speak a voice-key (from i18n) or a raw text string, in the current UI language.
 */
function speakOfflineAlert(keyOrText) {
  if (!('speechSynthesis' in window)) return;

  const text = _resolveVoiceText(keyOrText);

  const langMap = { 'hi': 'hi-IN', 'bn': 'bn-IN', 'as': 'as-IN', 'en': 'en-US' };
  const currentLang = localStorage.getItem('ner_pwa_lang') || 'en';
  const targetLang = langMap[currentLang] || 'en-US';

  function _speak() {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    const voice = _pickBestVoice(targetLang);
    if (voice) {
      utterance.voice = voice;
    } else if (currentLang !== 'en') {
      // No native voice found — show a one-time toast so user knows
      _showVoiceMissingToast(currentLang);
    }

    window.speechSynthesis.speak(utterance);
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    _speak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', function handler() {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      _speak();
    });
  }
}

/** One-time toast telling the user to install the language TTS pack */
let _voiceToastShown = false;
function _showVoiceMissingToast(lang) {
  if (_voiceToastShown) return;
  _voiceToastShown = true;
  const names = { hi: 'Hindi (हिन्दी)', bn: 'Bengali (বাংলা)', as: 'Assamese (অসমীয়া)' };
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1e293b;border:1px solid #f59e0b;border-radius:10px;padding:10px 14px;
    font-size:12px;color:#f8fafc;z-index:9999;max-width:320px;text-align:center;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);`;
  toast.innerHTML = `⚠️ <strong>${names[lang] || lang} TTS voice not installed.</strong><br>
    <span style="color:#94a3b8;font-size:11px;">To hear voice in ${names[lang] || lang}: 
    Install the language pack in your OS/browser settings, then refresh.</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}


// ─── IndexedDB Setup ───────────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NER_Patrol_DB', 2);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('incident_queue')) {
        database.createObjectStore('incident_queue', { keyPath: 'id', autoIncrement: false });
      }
      if (!database.objectStoreNames.contains('sync_history')) {
        database.createObjectStore('sync_history', { keyPath: 'id', autoIncrement: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e);
  });
}

// ─── Queue Operations ──────────────────────────────────────────────
function addToQueue(incident) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('incident_queue', 'readwrite');
    tx.objectStore('incident_queue').add(incident);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

function getAllQueued() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('incident_queue', 'readonly');
    const req = tx.objectStore('incident_queue').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

function deleteFromQueue(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('incident_queue', 'readwrite');
    tx.objectStore('incident_queue').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

function getQueueCount() {
  return new Promise((resolve) => {
    const tx = db.transaction('incident_queue', 'readonly');
    const req = tx.objectStore('incident_queue').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

// ─── Sync History ──────────────────────────────────────────────────
function addToHistory(incident) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('sync_history', 'readwrite');
      const record = { ...incident, synced_at: Date.now() };
      tx.objectStore('sync_history').put(record);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    } catch (e) {
      resolve();
    }
  });
}

function getHistory() {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('sync_history', 'readonly');
      const req = tx.objectStore('sync_history').getAll();
      req.onsuccess = () => resolve(req.result.slice(-5).reverse());
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// ─── Network State ─────────────────────────────────────────────────
function isOnline() {
  if (isForceOffline) return false;
  return navigator.onLine;
}

function updateNetworkUI() {
  const bar = document.getElementById('net-bar');
  const text = document.getElementById('net-text');
  const online = isOnline();

  bar.className = `net-bar ${online ? 'online' : 'offline'}`;

  // Update i18n key and translation
  const key = online ? 'net_online' : 'net_offline';
  text.setAttribute('data-i18n', key);
  if (window.setLanguage) {
    const lang = localStorage.getItem('ner_pwa_lang') || 'en';
    // Instead of calling full setLanguage, just get the dict
    // Or simpler, just call setLanguage
    setLanguage(lang);
  } else {
    text.textContent = online ? 'ONLINE — CONNECTED' : 'OFFLINE — ZERO CONNECTIVITY';
  }

  document.getElementById('sync-btn').disabled = !online;
}

function toggleOfflineMode() {
  isForceOffline = !isForceOffline;
  const toggle = document.getElementById('offline-toggle');
  toggle.classList.toggle('active', isForceOffline);
  updateNetworkUI();

  if (isForceOffline) {
    speakOfflineAlert("We are offline");
  } else {
    speakOfflineAlert("Network connection detected");
  }

  // Haptic feedback
  if (navigator.vibrate) navigator.vibrate(50);

  // If back online, auto-sync
  if (isOnline()) {
    syncQueue();
  }
}

// ─── Hazard & Severity Selection ───────────────────────────────────
function selectHazard(el) {
  document.querySelectorAll('.hazard-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedHazard = el.dataset.type;
  if (navigator.vibrate) navigator.vibrate(30);
}

function selectSeverity(el) {
  document.querySelectorAll('.severity-btn').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedSeverity = el.dataset.sev;
  if (navigator.vibrate) navigator.vibrate(30);
}

// ─── GPS Detection ─────────────────────────────────────────────────
function detectGPS() {
  const btn = document.querySelector('.gps-detect-btn');
  btn.textContent = '⏳';

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        document.getElementById('inp-lat').value = lat.toFixed(6);
        document.getElementById('inp-lon').value = lon.toFixed(6);
        btn.textContent = '✅';
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => { btn.textContent = '📍'; }, 2000);
        updateMapLocation(lat, lon);
      },
      () => {
        // Fallback to mock NER coordinates
        mockGPS();
        btn.textContent = '📍';
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    mockGPS();
    btn.textContent = '📍';
  }
}

function mockGPS() {
  // Simulate coordinates along the NER corridor
  const points = [
    [25.1130, 92.3610], // Sonapur
    [25.0180, 92.4150], // Kuliang
    [25.4530, 92.2030], // Jowai
    [25.5788, 91.8933], // Shillong
  ];
  const pt = points[Math.floor(Math.random() * points.length)];
  document.getElementById('inp-lat').value = (pt[0] + (Math.random() - 0.5) * 0.02).toFixed(6);
  document.getElementById('inp-lon').value = (pt[1] + (Math.random() - 0.5) * 0.02).toFixed(6);
}

// ─── Photo Handler ─────────────────────────────────────────────────
function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;

  const label = document.getElementById('photo-label');
  label.textContent = `📷 ${file.name.substring(0, 25)}...`;
  label.classList.add('has-photo');

  const reader = new FileReader();
  reader.onload = (e) => {
    photoBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── Form Submit ───────────────────────────────────────────────────
document.getElementById('incident-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Processing...';

  const isSos = document.getElementById('inp-sos').checked;

  const incident = {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    incident_type: selectedHazard,
    severity: selectedSeverity,
    latitude: parseFloat(document.getElementById('inp-lat').value),
    longitude: parseFloat(document.getElementById('inp-lon').value),
    description: document.getElementById('inp-desc').value,
    reporter_name: 'Field Officer T. Sangma',
    image_base64: photoBase64,
    timestamp: Date.now() / 1000,
    created_at: new Date().toISOString(),
    sos_requested: isSos
  };

  if (isSos) {
    document.getElementById('sos-modal').classList.add('active');
    speakOfflineAlert("voice_sos");
  }

  if (isOnline()) {
    // Direct upload
    try {
      await sendToServer(incident);
      showSubmitSuccess('✅ Uploaded to Command Center');
      await addToHistory(incident);
      speakOfflineAlert("voice_uploaded");
    } catch (err) {
      // Fallback to queue
      await addToQueue(incident);
      showSubmitSuccess('📋 Saved to Offline Queue');
      speakOfflineAlert("voice_queued");
    }
  } else {
    // Store locally
    await addToQueue(incident);
    showSubmitSuccess('📋 Saved to Offline Queue');
    speakOfflineAlert("voice_queued");
  }

  // Haptic feedback
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  // Reset form
  photoBase64 = null;
  document.getElementById('photo-label').textContent = '📷 Tap to Capture or Select Photo';
  document.getElementById('photo-label').classList.remove('has-photo');
  document.getElementById('inp-desc').value = '';
  document.getElementById('inp-photo').value = '';
  document.getElementById('inp-sos').checked = false;

  // Update displays
  await updateQueueUI();
  await updateHistoryUI();
});

async function sendToServer(incident) {
  const payload = { ...incident };
  // Don't send huge base64 in batch for speed; truncate for demo
  if (payload.image_base64 && payload.image_base64.length > 50000) {
    payload.image_base64 = payload.image_base64.substring(0, 50000);
  }

  const res = await fetch(`${API_BASE}/api/report-incident`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

function showSubmitSuccess(msg) {
  const btn = document.getElementById('submit-btn');
  btn.textContent = msg;
  btn.classList.add('success');
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = '⚡ Log Incident Report';
    btn.classList.remove('success');
    btn.disabled = false;
  }, 2500);
}

// ─── Sync Engine ───────────────────────────────────────────────────
async function syncQueue() {
  if (!isOnline()) return;

  const queued = await getAllQueued();
  if (queued.length === 0) return;

  // Try batch sync first
  try {
    const payload = queued.map(inc => ({
      incident_type: inc.incident_type,
      severity: inc.severity,
      latitude: inc.latitude,
      longitude: inc.longitude,
      description: inc.description,
      reporter_name: inc.reporter_name,
      timestamp: inc.timestamp,
      sos_requested: inc.sos_requested || false
    }));

    const res = await fetch(`${API_BASE}/api/incidents/batch-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidents: payload }),
    });

    if (res.ok) {
      // Clear queue
      for (const inc of queued) {
        await deleteFromQueue(inc.id);
        await addToHistory(inc);
      }
      await updateQueueUI();
      await updateHistoryUI();
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      return;
    }
  } catch (e) {
    console.warn('[Sync] Batch failed, trying individual:', e);
  }

  // Fallback: individual sync
  for (const inc of queued) {
    try {
      await sendToServer(inc);
      await deleteFromQueue(inc.id);
      await addToHistory(inc);
    } catch (err) {
      console.warn('[Sync] Failed for:', inc.id);
    }
  }

  await updateQueueUI();
  await updateHistoryUI();
}

async function manualSync() {
  const btn = document.getElementById('sync-btn');
  btn.textContent = '⏳ Syncing...';
  btn.disabled = true;

  await syncQueue();

  btn.textContent = '🔄 Force Sync Now';
  btn.disabled = !isOnline();
}

// ─── UI Updates ────────────────────────────────────────────────────
async function updateQueueUI() {
  const count = await getQueueCount();
  const queued = await getAllQueued();

  // Update badges
  document.getElementById('queue-count').textContent = count;
  document.getElementById('header-queue-count').textContent = count;

  // Update queue list
  const list = document.getElementById('queue-list');
  if (queued.length === 0) {
    list.innerHTML = '<div class="queue-empty">No pending incidents. All synced. ✅</div>';
  } else {
    list.innerHTML = queued.map(inc => {
      const icons = {
        landslide: '🏔️',
        flash_flood: '🌊',
        bridge_damage: '🌉',
      };
      const time = new Date(inc.timestamp * 1000).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <div class="queue-item">
          <span class="queue-item-icon">${icons[inc.incident_type] || '⚠️'}</span>
          <span class="queue-item-text">${inc.incident_type.replace(/_/g, ' ')} [${inc.severity}]</span>
          <span class="queue-item-time">${time}</span>
          <span class="queue-item-status">⏳</span>
        </div>
      `;
    }).join('');
  }
}

async function updateHistoryUI() {
  const history = await getHistory();
  const list = document.getElementById('history-list');

  if (history.length === 0) {
    list.innerHTML = '<div class="queue-empty">No recent syncs.</div>';
    return;
  }

  list.innerHTML = history.map(inc => {
    const time = inc.synced_at
      ? new Date(inc.synced_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    return `
      <div class="history-item">
        <span>✅</span>
        <span style="flex:1; color: var(--text-sec);">${(inc.incident_type || '').replace(/_/g, ' ')} — ${inc.severity}</span>
        <span style="font-family: var(--mono); font-size: 10px;">${time}</span>
      </div>
    `;
  }).join('');
}

// ─── Network Event Listeners ───────────────────────────────────────
window.addEventListener('online', () => {
  if (!isForceOffline) {
    updateNetworkUI();
    syncQueue();
  }
});

window.addEventListener('offline', () => {
  updateNetworkUI();
});

// ─── Service Worker Registration ───────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/field-static/sw.js')
    .then(reg => {
      console.log('[PWA] Service Worker registered:', reg.scope);
      // Register background sync
      if ('sync' in reg) {
        reg.sync.register('sync-incidents').catch(() => { });
      }
    })
    .catch(err => console.warn('[PWA] SW registration failed:', err));
}

// ─── Initialize Map ────────────────────────────────────────────────
function initMap() {
  // Center near Sonapur / NH6
  pwaMap = L.map('pwa-map', { zoomControl: false }).setView([25.0180, 92.4150], 12);

  // Use OSM with a dark filter (simulated via CSS invert later, or just base Carto)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    className: 'map-tiles'
  }).addTo(pwaMap);

  // Add the user's reporting location marker
  userMarker = L.marker([25.0180, 92.4150]).addTo(pwaMap);
}

function updateMapLocation(lat, lon) {
  if (pwaMap && userMarker) {
    const newPos = new L.LatLng(lat, lon);
    userMarker.setLatLng(newPos);
    pwaMap.panTo(newPos);
  }
}

// ─── Initialize ────────────────────────────────────────────────────
(async () => {
  await initDB();
  initMap();
  updateNetworkUI();
  await updateQueueUI();
  await updateHistoryUI();
})();

function closeSOSModal() {
  document.getElementById('sos-modal').classList.remove('active');
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
