/**
 * NER-Lifeline: Service Worker — Offline Caching & Background Sync
 *
 * Strategies:
 *   - INSTALL: Pre-cache critical app shell assets
 *   - FETCH: Cache-first for static assets, network-first for API calls
 *   - SYNC: Background sync for incident queue flush
 */

const CACHE_NAME = 'ner-patrol-v2';
const STATIC_ASSETS = [
  '/field/',
  '/field-static/app.js',
  '/field-static/manifest.json',
];

// ─── Install: Pre-cache critical assets ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate: Clean up old caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: Hybrid caching strategy ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first with no cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ status: 'offline', message: 'No network connectivity' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses for future offline use
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      });
    })
  );
});

// ─── Background Sync: Flush incident queue ─────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-incidents') {
    event.waitUntil(syncIncidentQueue());
  }
});

async function syncIncidentQueue() {
  try {
    const db = await openDB();
    const incidents = await getAllFromStore(db, 'incident_queue');

    if (incidents.length === 0) return;

    const payload = incidents.map((inc) => ({
      incident_type: inc.incident_type,
      severity: inc.severity,
      latitude: inc.latitude,
      longitude: inc.longitude,
      description: inc.description,
      reporter_name: inc.reporter_name,
      timestamp: inc.timestamp,
    }));

    const res = await fetch('/api/incidents/batch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidents: payload }),
    });

    if (res.ok) {
      // Clear synced items
      for (const inc of incidents) {
        await deleteFromStore(db, 'incident_queue', inc.id);
      }
      console.log(`[SW] Background synced ${incidents.length} incidents`);

      // Notify the client
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({ type: 'sync-complete', count: incidents.length });
      });
    }
  } catch (e) {
    console.warn('[SW] Background sync failed:', e);
  }
}

// ─── IndexedDB Helpers (for Service Worker context) ────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NER_Patrol_DB', 2);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

function deleteFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}
