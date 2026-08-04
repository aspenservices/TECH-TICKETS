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

const CACHE_VERSION = "v2.18.0";  // 4 ago 2026 - v2.18.0 = COACHING CALLS integrado con clientes, encima del facelift completo (tramos 1-6). (1) AUTOCOMPLETAR EL CLIENTE: al escribir 2 letras del nombre en "New coaching call" aparecen hasta 6 clientes conocidos, y al elegir uno se rellenan telefono, correo, direccion, ciudad y ZIP, mas una tira con su contexto (cuantos tickets, cuantas coaching calls previas, ultimo trabajo y su spa). No hay coleccion de clientes en esta app: se indexa lo que ya esta en memoria (active+done+coachingCalls) agrupando con _custGroupKey, la misma identidad auditada que aguanta acentos, comas y apostrofes y no depende del orden del nombre, asi que "Carla Reyes" encuentra a "Reyes, Carla". Cada campo se queda con el valor mas reciente NO VACIO campo por campo, para que un ticket nuevo sin correo no borre el correo que si teniamos. El autocompletado RELLENA, no bloquea: lo que se escriba encima gana. El onclick recibe la LLAVE del cliente (solo letras, digitos, dos puntos y barra) en vez del nombre, asi un cliente O'Brien no rompe la comilla del atributo. (2) LA LLAMADA DESAPARECE CUANDO EL TECNICO TERMINA: si la coaching se escalo a Service Log y el tecnico ya cerro ese ticket, deja de ocupar la columna Completed. No se borra nada de Firestore, solo deja de pintarse, y el pie dice cuantas se ocultaron con un boton para traerlas de vuelta. Reaparecen solas en los dos casos en que el trabajo NO se hizo: si el ticket escalado fue cancelado, o si su id quedo huerfano. Todo se calcula del escalatedTicketId que coachEscalate ya escribia, sin escrituras nuevas. (3) LA LLAMADA QUEDA EN EL EXPEDIENTE DEL CLIENTE: al abrir un cliente, sus coaching calls salen en DOS sitios - como nota en "Notes & Scheduling" y como una parada mas en su linea de tiempo de visitas, con lo que se hablo, el error encontrado, la recomendacion y si se resolvio en la llamada o se mando un tecnico. Se pintan DISTINTAS de una visita fisica a proposito (borde y chip en cobre, "No charge" en vez de importe, y la etiqueta dice "Coaching by" y no "Technician"): a ese cliente no fue nadie, y si se factura por visita, confundirlas sale caro. Va en un bloque NUEVO al final del archivo (coachInCustomerScript), 100% aditivo y de solo lectura: no toca el bloque V7 ni el de la vista C del facelift, espera a que V7 pinte, inserta en el DOM ya renderizado y avisa al riel con vcRebuild(). Borrar ese bloque revierte la funcion entera. Sin campos nuevos en Firestore, sin tocar reglas ni Cloud Functions. Verificado byte a byte que siguen intactos los bloques del facelift (customerUltraTechV7CleanScript, customerViewCScript y Style, los dos del reporte) y los de Intake (aspenIntakeScript y Style). mismo numero que APP_VERSION, bump juntos.  // 2 ago 2026 - v2.11.0 = INTAKE rehecho como BANDEJA. Se acabaron las tres columnas de tarjetas: ahora es una lista de nombres a la izquierda y UNA cosa a la derecha con todo dentro, con la piel clara "Estudio" (Fraunces grande, mas aire, radios suaves). (1) La historia del cliente ya NO se recorta: se cayo el max-height:98px que la cortaba a media frase, ahora se lee entera. (2) HISTORIAL DEL CLIENTE dentro de la ficha - cuantos tickets lleva, desde que ano, su spa y una linea de tiempo de sus trabajos pasados con fecha y tecnico; se calcula de los tickets que la app ya tiene en memoria agrupando con _custGroupKey, sin leer nada nuevo de Firestore. Cliente nuevo NO pinta una lista vacia: dice que es la primera vez y sugiere confirmar la ortografia del nombre antes de despachar. (3) AGENDAR AL TECNICO SIN SALIR DE INTAKE - cinco dias y las tarjetas de tecnico muestran su carga real de ESE dia (libre / N trabajos), leida de active; el boton se nombra solo ("Send Pedro on Wed 5") y sigue desactivado hasta elegir dia y tecnico. itkTriage acepta un 3er parametro OPCIONAL {date,tech}: las llamadas viejas de dos argumentos siguen produciendo date:"" y techs:[] igual que antes, asi que no se rompe nada. Un tecnico que ya no este en la lista viva no se asigna a ciegas - se manda sin asignar y se avisa. Coaching call NUNCA lleva tecnico ni fecha: es una llamada, no una visita. (4) Filtros Needs you / All / In motion; los contestados salen arriba, los que llevan mas tiempo sin abrir despues, y los registros de prueba al fondo y solo en "All". (5) En el telefono el detalle entra como hoja deslizante con boton Volver. (6) Arreglado "1 thing need you" -> "needs". Todo vive en los dos bloques de intake; ningun otro bloque tocado; sin campos nuevos en Firestore, sin tocar reglas ni Cloud Functions. mismo numero que APP_VERSION, bump juntos.  // 31 jul 2026 - v2.10.0 = CENTRAL DE INTAKE rehecha, y de paso se corrige la deriva de version: el index venia clavado en APP_VERSION 2.8.1 mientras este sw ya iba en v2.9.4, asi que la app avisaba "version mix" en cada activacion. (1) Se acabo el sellado de "enviado" al abrir Messages: itkSms/itkEml/itkCopy marcan un INTENTO y al volver la app pregunta "did you send it?"; un link copiado o un Messages cerrado sin mandar ya NO infla el denominador de la tasa de respuesta. (2) La tasa suelta se parte en embudo enviado -> abierto -> contestado, con corte por texto vs correo y mediana de respuesta; si ningun documento trae openedAtMs se muestra raya en vez de un 0% inventado. (3) Cabecera nueva de acciones agrupadas arriba de todo (contestados, links frios de +48h, entregados sin tecnico) en vez de cuatro tarjetas de KPI que no se podian pulsar. (4) Nudge en COLA guiada: itkSms navega fuera de la app, asi que un boton que prometa tres textos de un toque miente; la cola vive en sessionStorage (NO localStorage: las apps comparten origen y cuota) y ofrece el siguiente en cada regreso, con un texto de recordatorio distinto al primero. (5) Tablero de columnas desiguales 1.55/1.2/0.75 con calor por edad en el rail, orden por urgencia (antes la columna Waiting no se ordenaba), entregados reducido a riel, caducados colapsados a un contador, chip "looks like a test" para los registros de prueba, y la historia del cliente con degradado y toque para abrir en vez del corte seco a media frase. (6) En movil (<900px) el tablero se cambia por una sola lista en orden de urgencia. Bloque de intake aditivo y reversible; ningun otro bloque tocado. mismo numero que APP_VERSION, bump juntos.   // 29 jul 2026 - v2.9.4 = los errores del Intake dejan de ser mudos. "Could not discard" no decia NADA del motivo real: es el mismo fallo silencioso que venimos sacando del resto del app, y lo escribi yo. Ahora _itkErr traduce el error de Firestore a algo accionable (permisos -> te dice exactamente que regla falta; sin conexion -> te dice que reintentes; ya borrado -> que refresques) y SIEMPRE lo deja en la consola. Aplicado a descartar, cancelar, crear link, triar y sellar como enviado.   // 29 jul 2026 - v2.9.3 = REVISION DEL AREA DE ESTIMADOS, cinco cosas. (1) El SMS del estimado usaba "sms:NUM?&body=", que solo funciona en iOS: en Android el tecnico abria Mensajes con el numero puesto y SIN el link. Ahora pasa por _smsHref. (2) El token era Date.now()+Math.random -- mitad marca de tiempo adivinable y mitad un generador que no es criptografico, con la regla estimates read:signedIn eso dejaba leer nombre, direccion, telefono y precios a quien acertara el token; ahora son 128 bits de crypto.getRandomValues. (3) Los links no caducaban NUNCA: el campo expired existia y la vista lo comprobaba, pero nada en la app lo ponia en true; ahora se guarda expiresAtMs y los viejos (sin ese campo, y con el token debil) se cierran contando desde createdAt. EST_EXPIRE_DAYS=60, un solo numero. (4) La vista del cliente ya NO lee Firestore: pide el estimado a la Cloud Function estimateGet, asi que se acabaron los 9 segundos de _awaitAuth y el fallo invisible del webview de Mensajes; de paso la funcion manda solo lo que se pinta y deja fuera p y r de cada pieza (precio interno y retail), que el navegador del cliente se descargaba entera. (5) Panel nuevo "Sent, not signed yet" arriba del constructor de estimados: antes solo habia un listener del que se acababa de mandar y al cerrar la app se perdia el hilo. REQUIERE desplegar estimateGet ANTES de subir este index.   // 29 jul 2026 - v2.9.2 = ICONOS DE LA BARRA LATERAL. La barra colapsada pone font-size:0 en .tab, asi que el emoji que vive en el TEXTO de la pestana no se ve: el icono tiene que venir de una regla ::before, y faltaban TRES. Intake salia como pastilla naranja vacia, y Journal y Conversations llevaban asi desde que se anadieron. Ahora las 15 pestanas tienen icono, y a las que ya llevan emoji en el texto se les oculta el ::before al desplegar la barra para que no salgan dos.   // 29 jul 2026 - v2.9.1 = la columna TRIAGED del Intake pasa a ser una LISTA DE TRABAJO VIVA en vez de un archivo: un intake se queda ahi solo mientras su ticket sigue abierto, y desaparece solo cuando el tecnico lo completa o cuando se borra el ticket. Se apoya en los listeners que el app ya tiene (el ticket nace sin fecha y entra por el listener where date=="" de la auditoria del 20 jul), asi que cuesta CERO lecturas extra de Firestore. La tarjeta ahora dice en que va: "Nobody assigned yet" en ambar si nadie lo tomo, o el tecnico y la fecha si ya esta asignado, mas un boton para abrir el ticket. Corregido de paso "1 photos" -> "1 photo".   // 29 jul 2026 - v2.9.0 = ESTACION DE INTAKE: pestana nueva (tab14) que genera un link unico por cliente, lo manda por texto o correo, recibe el formulario con fotos y lo tria a Service Log o a Coaching. La pagina publica intake.html NO usa Firebase en el navegador: postea a las Cloud Functions intakeGet/intakeSubmit, que escriben con Admin SDK -- eso elimina la clase de bug del link de estimados (IndexedDB bloqueado en el webview de Mensajes, auth anonima que nunca cuaja, y Firestore sirviendo cache local asi que el fallo era invisible). Incluye ademas 7 arreglos del flujo de Coaching: email y ZIP en el alta (el escalado ya no crea el ticket sin email ni zona), reabrir sin fecha cae en To-Schedule en vez de quedarse atorado en Scheduled, escalar CIERRA la llamada, candado de doble clic al escalar, el KPI "Resolved on call" solo cuenta llamadas CON reporte guardado (antes toda llamada cerrada sin reporte contaba como resuelta y el numero estaba inflado), el SMS usa el separador correcto en Android (con el formato de iOS llegaba vacio) y la tarjeta cerrada sin reporte lo dice en vez de salir en blanco. IMPORTANTE: subir index.html, sw.js e intake.html juntos.   // 28 jul 2026 — v2.8.1 = PASADA DE VERIFICACION del paquete v2.0.0-v2.8.0 contra el archivo FINAL, con todos los bancos re-extraidos del propio archivo (no de copias intermedias). Un bug encontrado y corregido: _stripForeignVisitEvidence borraba _ghostVisit en el SEGUNDO merge -- despues de la primera pasada checkInAt ya quedaba vacio, asi que "nada ajeno" parecia "ya no hay fantasma", y como _mergeTicketSources corre con cada snapshot de Firestore el fantasma se perdia a los segundos y el check-in real se quedaba sin saber que reparar en la base. Ahora el fantasma solo se descarta cuando aparece un sello LEGITIMO de esta visita. Verificado ademas: mismo perfil de parseo que el original, ninguna funcion llamada que no exista, produccion intacta, un solo punto de asignacion del destino de escritura, cero sondas al DOM, cero adivinador de +-30 dias, una sola lista de visitas, reagendo 300.000/300.000 escenarios limpios, guardia 4/4, y sobre los 1.260 tickets reales: 0 citas futuras servidas, 0 contradicciones, 0 duplicados. mismo numero que APP_VERSION, bump juntos. v1.26.0 = FIX de los botones del visor de reporte (Print / PDF, Email Full Report, View Ticket). Causa: #v8ReportOverlay esta en z-index 999999 mientras los modales del app (.mbg) estan en 1000 y los toasts en 4500, asi que TODO lo que abrian esos botones aparecia DETRAS del visor: el app si reaccionaba pero no se veia nada. Ahora, con body.v8r-open, modales y toasts suben por encima del visor; imprimir aisla el reporte (antes se imprimia toda la app); los 4 botones llevan type=button; y cada accion avisa cuando de verdad no se puede (permisos, ticket no cargado) en vez de fallar en silencio. v1.25.0 = Y Series: conectores de medicion DIBUJADOS en la seccion de fusibles (tabs K7-P/Linea 2/Neutro del in.yj, conector A3 de 4 pines a color del in.ye-V3, carcasa de 6 pines del in.xe) con las puntas roja/negra donde van, y pack NUEVO in.xe con su pin-out completo HC1/HC2/LC1/LC2 conmutable. El in.xe no trae mapa de LEDs en la guia de Gecko, asi que la vista LEDS lo dice en vez de inventar. FIX: el diagrama de tarjeta de v1.24.0 habia pisado el campo de texto `board`, y "Board" en Conectores clave mostraba [object Object]; el diagrama ahora vive en `diagram`. v1.24.0 = (a) DIAGRAMA DE TARJETA en la seccion LEDS de la herramienta Y Series: esquema SVG propio (NO la foto del manual de Gecko) de la in.yj y la in.ye-V3 con cada LED en su posicion; tocar un punto abre el caso de ese LED y el acordeon resalta el punto de vuelta; el D9 de la in.ye-V3 sale apagado porque la guia de Gecko lo etiqueta pero no le da caso. (b) la herramienta "Y Series — Gecko Troubleshooting Guide" ya es BILINGUE ES/EN: motor T() + diccionario YSG_ES (267 entradas) dentro del bundle, marcas data-ysgtx para el chrome, y boton oculto #ysgLang que la deja colgarse del idioma global de la app (APP_LANG). Se arreglo de paso _ttToolLangBtn, que no podia ver el boton de idioma de las herramientas shadow (buscaba con document.getElementById): ahora guarda el shadow root al montar (_ttShadowRoot) y busca ahi. El ingles sigue siendo el idioma canonico de los datos. v1.23.0 = herramienta nueva "YE-3 Pack Wiring" (12 configuraciones, terminales A1/A2/A3/A5, diagrama oficial del techbook in.ye-V3, field check y glosario). v1.22.0 = arreglo de raiz del reporte sobre el cliente equivocado: guardia autoritativo que lee el doc fresco antes de escribir (bloquea al tecnico, pide confirmacion al admin), respaldo del estado anterior en auditLog antes de sobrescribir, y candado de doble envio. v1.21.0 = FIX reporte sobre el cliente equivocado: startTicketFrom/startEstimateFrom limpian editingDocId, guardia que bloquea sobrescribir el ticket de otro cliente, y editTkt direcciona por id en vez de indice. v1.20.0 = herramienta nueva "Y Series — Gecko Troubleshooting Guide" (codigos de error, LEDs de diagnostico, fusibles y sintomas; packs in.yj e in.ye-V3). El montaje shadow ahora acepta rootClass por herramienta. v1.19.0 = BluFusion y bomba de circulacion van SIEMPRE juntos (configs 2 y 6 corregidas: el ozono deja su terminal vacio y el in.clear se monta con la circ). v1.18.0 = Board muestra contexto Tech-Tickets por cliente: chip en cada tarjeta (visitas, fecha, facturada/sin facturar, garantia, tickets abiertos, tecnico) + panel de historial de servicio en el detalle del Cobro Sprint. Match por _custGroupKey. v1.17.0 = TODAS las funciones de la lista lineal movidas al Board (header: resumen + filtros por antiguedad + resumen semanal + banner reagendar; por tarjeta: Resolve/Remind/Note/PDF). Puente Invoice Tracker (cross_app_events) intacto. v1.16.0 = Board de cobranza = vista unica en Alerts (columna Trello "En proceso de cobranza"; se oculta la lista lineal, el toggle Board la regresa). v1.15.1 = las notas de reagendar VIEJAS recuperan su fecha del campo reschedAt del ticket. v1.15.0 = reagendar: la nota lleva su fecha, la linea de tiempo se ordena por fecha, y franja de reagendar arriba del ticket. v1.14.0 = logica BluFusion corregida (con circ -> BF/CP en el sitio del ozono; sin circ -> compartido con Pump 1) + config 14 lleva O3 no Pump 5. v1.13.1 = fix aterrizaje del Viewer (caia en calendario) + etiqueta de rol. v1.13.0 = rol Viewer (solo Tech Tools > YE-6, sin listeners de Firestore). v1.12.0 = YE-6 rediseno (paleta Aspen, color por terminal, fix A6, fixes movil) + BluFusion. mismo numero que APP_VERSION, bump juntos. v1.11.0 = Cover Tracker → Service Log bridge (structured deep-link intake, idempotent by srcId, cleanup-exempt). v1.10.0 = fases 1-3 auditoria.
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

  // ── Skip the public customer pages (intake.html). They are NOT part of the
  // staff app shell: letting the HTML handler touch them would cache tokenized
  // URLs into the app cache and, offline, fall back to serving the staff shell
  // in their place. Customers never register this SW (intake.html does not call
  // register()); this guard is for staff devices that already have it.
  if (url.indexOf("/intake.html") !== -1) return;

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
