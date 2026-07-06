/**
 * Aspen Spas - Service Ticket System
 * Service Worker for offline support (PWA)
 *
 * Strategy:
 * - App shell (HTML, fonts, Firebase SDK): Cache-first with network fallback
 * - Firestore data: handled by Firebase SDK's own offline persistence (IndexedDB)
 *
 * To force update: bump CACHE_VERSION below.
 */

const CACHE_VERSION = "v1.1.76";
const CACHE_NAME = "aspen-spas-" + CACHE_VERSION;

// How long to wait for the network on an HTML navigation before falling back to
// the cached app shell. Long enough that a normal connection serves fresh code,
// short enough that a flaky field connection doesn't block the launch.
const HTML_NET_TIMEOUT_MS = 3000;

// Files that make up the "app shell" — cached on install for instant offline load.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./st.bundle.json",
  // Firebase SDK CDN URLs — same versions used in index.html
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js",
  // Google Fonts CSS (the .woff2 files are fetched separately and cached at runtime)
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap",
];

// ─── INSTALL: Pre-cache the app shell ────────────────────────────────
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("[SW] Pre-caching app shell");
      // Cache files individually so one bad URL doesn't break the whole install
      return Promise.all(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn("[SW] Failed to cache:", url, err);
          });
        })
      );
    })
  );
  // Activate the new SW immediately (don't wait for old tabs to close)
  self.skipWaiting();
});

// ─── ACTIVATE: Clean up old caches ───────────────────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_NAME && name.startsWith("aspen-spas-")) {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── FETCH: Serve from cache, fall back to network ──────────────────
self.addEventListener("fetch", function (event) {
  const req = event.request;
  const url = req.url;

  // ── Skip Firestore/Firebase API requests — handled by SDK's own offline cache
  if (
    url.indexOf("firestore.googleapis.com") !== -1 ||
    url.indexOf("firebaseio.com") !== -1 ||
    url.indexOf("googleapis.com/identitytoolkit") !== -1 ||
    url.indexOf("securetoken.googleapis.com") !== -1
  ) {
    return; // Let the network handle these (Firebase SDK has its own caching)
  }

  // ── Skip non-GET requests
  if (req.method !== "GET") return;

  // ── Skip chrome-extension:// and other non-http(s) protocols
  if (!url.startsWith("http")) return;

  // ── NETWORK-FIRST (with timeout) for the app shell HTML ──────────────
  // Fix (Jun 2026): the cache-first path below served a STALE index.html and
  // only refreshed it in the background, so a freshly deployed fix showed up
  // "one load late" — the May-2026 incident (Jeremy's iPhone PWA kept running
  // cached buggy code when a deploy didn't bump the version). We now try the
  // NETWORK FIRST so the newest code wins, BUT with a short timeout fallback to
  // cache: the index.html is large (~1.3MB), so on a slow/flaky field
  // connection we must not block the launch on a full download. If the network
  // doesn't answer within HTML_NET_TIMEOUT_MS we serve the cached shell
  // instantly; the in-flight fetch still refreshes the cache for next launch.
  const isDoc =
    req.mode === "navigate" ||
    req.destination === "document" ||
    (req.headers.get("Accept") || "").indexOf("text/html") !== -1;
  if (isDoc) {
    event.respondWith(htmlNetworkFirst(req));
    return;
  }

  // Cache-first strategy with network fallback + runtime caching
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // Found in cache → return it (and refresh in background for next time)
        fetchAndCache(req).catch(function () {}); // silent
        return cached;
      }
      // Not in cache → fetch from network and cache it for next time
      return fetchAndCache(req).catch(function () {
        // If offline AND not in cache, return a graceful fallback for documents
        if (req.destination === "document" || req.headers.get("Accept")?.indexOf("text/html") !== -1) {
          return caches.match("./index.html");
        }
        // Otherwise just fail silently
        return new Response("", { status: 503, statusText: "Offline" });
      });
    })
  );
});

function fetchAndCache(req) {
  return fetch(req).then(function (resp) {
    // Only cache successful responses
    if (!resp || resp.status !== 200) return resp;

    // Cache same-origin responses + CDN responses (Firebase SDK, Google Fonts)
    const isCDN =
      req.url.indexOf("gstatic.com") !== -1 ||
      req.url.indexOf("googleapis.com/css") !== -1 ||
      req.url.indexOf("fonts.gstatic.com") !== -1;

    if (resp.type === "basic" || (isCDN && resp.type === "cors")) {
      const respClone = resp.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(req, respClone).catch(function () {}); // silent
      });
    }
    return resp;
  });
}

// Network-first for the HTML shell, with a timeout fallback to cache so a slow
// connection never blocks the launch. The network fetch keeps running even
// after a timeout so the cache is refreshed for the next launch (revalidate).
function htmlNetworkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(resp) {
      if (settled) return;
      settled = true;
      resolve(resp);
    }
    // 1) Start the network fetch. On success, refresh the cache and (if we
    //    haven't already fallen back) serve the fresh response.
    fetch(req)
      .then(function (resp) {
        // Refresh the cached shell whenever we get a good same-origin response.
        if (resp && resp.ok && resp.type === "basic") {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function (c) {
            c.put(req, copy).catch(function () {});
          });
        }
        // Serve the fresh response if it's good; on a 4xx/5xx prefer the cached
        // shell (a transient server error shouldn't replace a working app).
        if (resp && resp.ok) {
          done(resp);
        } else {
          caches.match(req).then(function (hit) {
            done(hit || resp);
          });
        }
      })
      .catch(function () {
        // Network failed entirely → cache, then offline fallback.
        caches.match(req).then(function (hit) {
          done(hit || caches.match("./index.html"));
        });
      });
    // 2) If the network is too slow, serve the cached shell now (only if we
    //    actually have it cached; otherwise keep waiting for the network).
    setTimeout(function () {
      if (settled) return;
      caches.match(req).then(function (hit) {
        if (hit) done(hit);
      });
    }, HTML_NET_TIMEOUT_MS);
  });
}

// ─── MESSAGE: Handle skip-waiting from page (for forced updates) ────
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
