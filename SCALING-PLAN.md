# TECH-TICKETS — Plan de escalado del snapshot (Firestore)

**Estado: DISEÑO — no implementado a propósito.** Este es el único punto de la
auditoría de julio 2026 que no se debe cambiar en caliente: media app asume que
`active[]` y `done[]` contienen la historia completa. Implementarlo mal rompe
Customers, Cobranza, el pairing y los KPIs a la vez. Este documento deja el
camino trazado para hacerlo con calma.

## El problema (medido)

`db.collection("tickets").onSnapshot(...)` sin filtros: cada dispositivo
descarga **todos los documentos de la colección** en cada arranque frío, y
Firestore cobra una lectura por documento. Con ~50 tickets/semana:

| | Hoy | +1 año | +3 años |
|---|---|---|---|
| Docs en la colección | ~2,500 | ~5,000 | ~10,000 |
| Lecturas por arranque frío × dispositivo | 2,500 | 5,000 | 10,000 |
| Memoria en el teléfono | ~15 MB | ~30 MB | ~60 MB |

12 dispositivos × 2 arranques/día × 5,000 docs = **120k lecturas/día** solo por
abrir la app. El free tier es 50k/día.

## Quién necesita qué (inventario de consumidores)

| Consumidor | ¿Necesita historia completa? |
|---|---|
| Daily / Calendar / Route / Service Log | No — operan sobre ±90 días |
| Verdict engine / Enterprise | No — tickets visibles |
| Pairing report↔dispatch (cleanup) | No — ventana ±30 días |
| Cobranza (`_porCobrarData`) | Parcial — saldos abiertos pueden ser viejos |
| Customers / 360 / `getCustData` | **Sí** — es su razón de ser |
| KPIs mensuales del Admin | Parcial — 2 meses |

## Fases (cada una deployable y reversible por sí sola)

### Fase A — Listener operativo acotado (el 90% del ahorro)
Cambiar el listener principal a `where("dateMs", ">=", hoy−120d)`.
- **Prerrequisito:** los tickets no tienen `dateMs` numérico consistente →
  migración one-shot que escriba `dateMs` desde `date` en todos los docs
  (batches de 400, botón en Admin, idempotente).
- **Excepción crítica:** las llamadas abiertas sin fecha (`status=="pending"`,
  dispatches) deben entrar SIEMPRE → segundo listener
  `where("fieldReportSubmitted","==",false)` y merge por id.
- Cobranza: tercer query one-shot al abrir la pestaña:
  `where("total",">",0)` + filtro cliente de saldo, o persistir un flag
  `paidInFull:true` al saldar (mejor a largo plazo).

### Fase B — Customers bajo demanda
`Customers` deja de depender del array global: al abrir la pestaña, one-shot
`get()` paginado (500/página) cacheado en IndexedDB con `updatedAtMs` como
cursor incremental. `getCustData` consulta ese caché.

### Fase C — Archivado anual
Job manual en Admin (o Cloud Function programada): mover `done` con
`date < hoy−18 meses` a `tickets_archive`. El 360 muestra "N visitas más en el
archivo — cargar" con un `get()` puntual.

## Regla de oro para implementarla
Cada fase se prueba con la suite `smoke.js` extendida + una semana en paralelo:
el listener nuevo escribe a consola las diferencias contra el viejo antes de
apagar el viejo. Nunca las tres fases en un mismo deploy.
