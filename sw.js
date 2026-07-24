/* ═══ FCM push nivel 2 (Jul 2026): recibe con la app CERRADA ═══ */
try{
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyDsmFIRqRrvTqRgzWKLFjA9Sdnro7nz8zc',
    authDomain:'tech-tickets-a9485.firebaseapp.com',
    projectId:'tech-tickets-a9485',
    storageBucket:'tech-tickets-a9485.firebasestorage.app',
    messagingSenderId:'680308339087',
    appId:'1:680308339087:web:3d18766c4b0e465a1a9bfa'
  });
  var _msg=firebase.messaging();
  _msg.onBackgroundMessage(function(payload){
    try{
      var d=(payload&&payload.data)||{};
      var title=d.title||('\uD83D\uDCAC '+(d.peer||'Mensaje'));
      var body=d.body||'Nuevo mensaje';
      self.registration.showNotification(title,{body:body,tag:'dm-'+(d.peer||'x'),renotify:true,vibrate:[100,50,100],data:{peer:d.peer||''}});
    }catch(_e){}
  });
}catch(e){/* messaging no disponible: el SW sigue funcionando normal */}

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

const CACHE_VERSION = "v1.26.0";  // 24 jul 2026 — v1.26.0 = FIX de los botones del visor de reporte (Print / PDF, Email Full Report, View Ticket). Causa: #v8ReportOverlay esta en z-index 999999 mientras los modales del app (.mbg) estan en 1000 y los toasts en 4500, asi que TODO lo que abrian esos botones aparecia DETRAS del visor: el app si reaccionaba pero no se veia nada. Ahora, con body.v8r-open, modales y toasts suben por encima del visor; imprimir aisla el reporte (antes se imprimia toda la app); los 4 botones llevan type=button; y cada accion avisa cuando de verdad no se puede (permisos, ticket no cargado) en vez de fallar en silencio. v1.25.0 = Y Series: conectores de medicion DIBUJADOS en la seccion de fusibles (tabs K7-P/Linea 2/Neutro del in.yj, conector A3 de 4 pines a color del in.ye-V3, carcasa de 6 pines del in.xe) con las puntas roja/negra donde van, y pack NUEVO in.xe con su pin-out completo HC1/HC2/LC1/LC2 conmutable. El in.xe no trae mapa de LEDs en la guia de Gecko, asi que la vista LEDS lo dice en vez de inventar. FIX: el diagrama de tarjeta de v1.24.0 habia pisado el campo de texto `board`, y "Board" en Conectores clave mostraba [object Object]; el diagrama ahora vive en `diagram`. v1.24.0 = (a) DIAGRAMA DE TARJETA en la seccion LEDS de la herramienta Y Series: esquema SVG propio (NO la foto del manual de Gecko) de la in.yj y la in.ye-V3 con cada LED en su posicion; tocar un punto abre el caso de ese LED y el acordeon resalta el punto de vuelta; el D9 de la in.ye-V3 sale apagado porque la guia de Gecko lo etiqueta pero no le da caso. (b) la herramienta "Y Series — Gecko Troubleshooting Guide" ya es BILINGUE ES/EN: motor T() + diccionario YSG_ES (267 entradas) dentro del bundle, marcas data-ysgtx para el chrome, y boton oculto #ysgLang que la deja colgarse del idioma global de la app (APP_LANG). Se arreglo de paso _ttToolLangBtn, que no podia ver el boton de idioma de las herramientas shadow (buscaba con document.getElementById): ahora guarda el shadow root al montar (_ttShadowRoot) y busca ahi. El ingles sigue siendo el idioma canonico de los datos. v1.23.0 = herramienta nueva "YE-3 Pack Wiring" (12 configuraciones, terminales A1/A2/A3/A5, diagrama oficial del techbook in.ye-V3, field check y glosario). v1.22.0 = arreglo de raiz del reporte sobre el cliente equivocado: guardia autoritativo que lee el doc fresco antes de escribir (bloquea al tecnico, pide confirmacion al admin), respaldo del estado anterior en auditLog antes de sobrescribir, y candado de doble envio. v1.21.0 = FIX reporte sobre el cliente equivocado: startTicketFrom/startEstimateFrom limpian editingDocId, guardia que bloquea sobrescribir el ticket de otro cliente, y editTkt direcciona por id en vez de indice. v1.20.0 = herramienta nueva "Y Series — Gecko Troubleshooting Guide" (codigos de error, LEDs de diagnostico, fusibles y sintomas; packs in.yj e in.ye-V3). El montaje shadow ahora acepta rootClass por herramienta. v1.19.0 = BluFusion y bomba de circulacion van SIEMPRE juntos (configs 2 y 6 corregidas: el ozono deja su terminal vacio y el in.clear se monta con la circ). v1.18.0 = Board muestra contexto Tech-Tickets por cliente: chip en cada tarjeta (visitas, fecha, facturada/sin facturar, garantia, tickets abiertos, tecnico) + panel de historial de servicio en el detalle del Cobro Sprint. Match por _custGroupKey. v1.17.0 = TODAS las funciones de la lista lineal movidas al Board (header: resumen + filtros por antiguedad + resumen semanal + banner reagendar; por tarjeta: Resolve/Remind/Note/PDF). Puente Invoice Tracker (cross_app_events) intacto. v1.16.0 = Board de cobranza = vista unica en Alerts (columna Trello "En proceso de cobranza"; se oculta la lista lineal, el toggle Board la regresa). v1.15.1 = las notas de reagendar VIEJAS recuperan su fecha del campo reschedAt del ticket. v1.15.0 = reagendar: la nota lleva su fecha, la linea de tiempo se ordena por fecha, y franja de reagendar arriba del ticket. v1.14.0 = logica BluFusion corregida (con circ -> BF/CP en el sitio del ozono; sin circ -> compartido con Pump 1) + config 14 lleva O3 no Pump 5. v1.13.1 = fix aterrizaje del Viewer (caia en calendario) + etiqueta de rol. v1.13.0 = rol Viewer (solo Tech Tools > YE-6, sin listeners de Firestore). v1.12.0 = YE-6 rediseno (paleta Aspen, color por terminal, fix A6, fixes movil) + BluFusion. mismo numero que APP_VERSION, bump juntos. v1.11.0 = Cover Tracker → Service Log bridge (structured deep-link intake, idempotent by srcId, cleanup-exempt). v1.10.0 = fases 1-3 auditoria.
const CACHE_NAME = "aspen-spas-" + CACHE_VERSION;

// Cap for runtime-cached entries (fonts, images, CDN extras). The app-shell
// URLs are never evicted. Without a cap the cache grows forever (audit 22 jul).
const MAX_RUNTIME_ENTRIES = 180;

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
  // FIX (20 jul 2026): decia 10.7.1 pero el index carga 10.12.0 desde hace
  // meses. O sea el pre-cache guardaba archivos que la app NUNCA pide, y los
  // que si usa quedaban fuera del shell offline hasta la segunda carga.
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js",
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

// ─── ACTIVATE: Clean up old caches → claim tabs → announce version ──────────
// (22 jul 2026) Antes había DOS listeners de "activate" (limpieza aquí y el
// anuncio de version al final del archivo). Unificados en UNO para controlar el
// orden: primero limpiar y reclamar, y solo DESPUES anunciar SW_ACTIVATED a las
// ventanas — asi el index nunca recibe el anuncio antes de que el SW controle.
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
    }).then(function () {
      // Take control of all open tabs immediately
      return self.clients.claim();
    }).then(function () {
      // Version badge: anunciar CACHE_VERSION a las ventanas ya controladas
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
        cs.forEach(function (c) { try { c.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION }); } catch (_e) {} });
      });
    })
  );
});

// ─── FETCH: Serve from cache, fall back to network ──────────────────
self.addEventListener("fetch", function (event) {
  const req = event.request;
  const url = req.url;

  // ── Skip Firestore/Firebase API requests — handled by SDK's own offline cache
  // Also skip unpkg.com: Leaflet is loaded from there with crossorigin="" (CORS
  // mode). If the SW intercepts and serves an "opaque" response for a CORS
  // request, the browser rejects it (ERR_FAILED) and the route map fails to load.
  // Letting the network handle unpkg directly lets the browser do the correct
  // CORS fetch (unpkg sends Access-Control-Allow-Origin: *), so Leaflet loads.
  if (
    url.indexOf("firestore.googleapis.com") !== -1 ||
    url.indexOf("firebaseio.com") !== -1 ||
    url.indexOf("googleapis.com/identitytoolkit") !== -1 ||
    url.indexOf("securetoken.googleapis.com") !== -1 ||
    url.indexOf("unpkg.com") !== -1
  ) {
    return; // Let the network handle these (SDK/CDN manage their own semantics)
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
        cache.put(req, respClone).then(function () {
          _maybeTrimCache(cache);
        }).catch(function () {}); // silent
      });
    }
    return resp;
  });
}

// Runtime cache cap (22 jul 2026): every ~10 puts, if the cache exceeds
// MAX_RUNTIME_ENTRIES, evict the oldest entries that are NOT part of the
// app shell. Cache keys preserve insertion order, so the front is the oldest.
var _trimCounter = 0;
function _maybeTrimCache(cache) {
  _trimCounter++;
  if (_trimCounter % 10 !== 0) return;
  cache.keys().then(function (keys) {
    if (keys.length <= MAX_RUNTIME_ENTRIES) return;
    var shellSet = APP_SHELL.map(function (u) { return new URL(u, self.location.href).href; });
    var evictable = keys.filter(function (k) { return shellSet.indexOf(k.url) === -1; });
    var excess = keys.length - MAX_RUNTIME_ENTRIES;
    evictable.slice(0, excess).forEach(function (k) {
      cache.delete(k).catch(function () {});
    });
  }).catch(function () {});
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


// ═══ DM notifications: tap → focus app & open that thread (Jul 2026) ═══
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var peer=(e.notification.data&&e.notification.data.peer)||'';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){
    for(var i=0;i<cs.length;i++){var c=cs[i];
      if('focus' in c){c.focus();try{c.postMessage({type:'openDm',peer:peer})}catch(_e){}return;}
    }
    if(clients.openWindow)return clients.openWindow('./');
  }));
});


/* Version badge: el anuncio de CACHE_VERSION vive ahora DENTRO del unico
   listener de "activate" de arriba (unificado 22 jul 2026). */
