# AGENTS.md · Guía para agentes/CLIs

Este documento orienta a cualquier CLI/IA que intervenga en este proyecto. Mantenerlo actualizado es obligatorio al tocar arquitectura, contratos o flujos.

## Resumen
- Tipo: WebApp estática (HTML/CSS/JS) publicada en GitHub Pages desde el root del repo.
- Objetivo: Crear y gestionar Cotizaciones y Reportes con PDFs estéticos, usables en móvil, con corrector, confirmación segura al eliminar y opción de deshacer (Ctrl+Z).
- Persistencia: Firebase Firestore (colecciones `cotizaciones`, `reportes`, `predictEMS`).
- Medios: Imágenes en Cloudinary para anexos.
- PDF: PDFLib en el navegador (sin servidor).
- Offline: Service Worker con caché de assets, sin interceptar Firestore/Cloudinary.

## Estructura
- `index.html`: Entrypoint. Carga `styles.css`, `app.js`, PDFLib y Firebase. Registra el Service Worker.
- `styles.css`: Diseño mobile-first, accesible y de alto contraste. Evitar degradados. Usar variables CSS.
- `app.js`: Lógica de UI, persistencia, generación de PDFs, Undo/Redo y confirmaciones.
- `service-worker.js`: Caché de assets y control de actualización. No interceptar Firestore/Cloudinary.
- `manifest.json`: PWA (start_url/scope relativos) e iconos.
- `icons/`: Íconos (favicon/apple-touch). El logo se usa desde `./icons/icon-192.png`.

## Ejecución/Despliegue
- Local (recomendado utilizar un servidor estático):
  - `npx serve .` ó `python -m http.server` y navegar a `http://localhost:PORT/`.
  - Nota: El SW requiere contexto http(s); abre en servidor local, no como `file://`.
- Producción: GitHub Pages (branch `main`, root). Hacer push a `main` publica.

## Convenciones de código
- JS:
  - Vanilla JS, sin bundlers. Mantener funciones puras/modulares cuando sea posible.
  - Nombres descriptivos; evitar one-letter vars.
  - No introducir libs que rompan CSP de GitHub Pages.
- CSS:
  - Variables en `:root`: `--text`, `--text-muted`, `--text-subtle`, `--azul`, etc.
  - Alto contraste. Evitar texto naranja. Evitar degradados.
  - Botón primario sólido (`var(--azul)`) y secundarios con borde.
- Accesibilidad:
  - `spellcheck`/`autocapitalize` en inputs relevantes.
  - Foco visible (`outline`), placeholders legibles.
- UI móvil:
  - Mobile-first; evitar `position: sticky` en contenedores que oculten botones/footers.

## Flujo de datos
- Firebase Firestore V8 SDK.
  - Colecciones: `cotizaciones` (doc por `numero`), `reportes` (doc por `numero`), `predictEMS` (doc por usuario con arrays de predictivos).
- Cloudinary: subida anónima con `upload_preset`.
- LocalStorage:
  - Borradores: `EMS_COT_BORRADOR`, `EMS_REP_BORRADOR`.
  - Ajustes: `EMS_SETTINGS` (tema/PDF).
  - Undo stacks en memoria: `window.__EMS_UNDO_COT`, `window.__EMS_UNDO_REP` (no persistente).

## PDF
- Librería: PDFLib (desde CDN). No hay servidor.
- Generadores:
  - Cotización: `generarPDFCotizacion(share?: boolean)`.
  - Reporte: `generarPDFReporte(share?: boolean)`.
- Contratos clave:
  - Siempre inicializar `ctx.state = { prevBlock, inGallery, currentSection }` antes de usar helpers (p. ej., `drawSectionBand`).
  - Usa `ensureSpace` para saltos de página y respeta `FOOTER_SAFE`.
  - Watermark/logo vía `getLogoImage(pdfDoc)` (usa `./icons/icon-192.png`).
- Estilo:
  - Sin degradados ni colores de bajo contraste. Usar `emsRgb()` (derivado de tema) y `gray()`.

## Service Worker
- Cache name debe incrementarse en cada cambio relevante (`CACHE_NAME = 'ems-cache-vXX'`).
- Fetch:
  - Para Firestore/Cloudinary: responder con `fetch(req)` y `return;` (no cachear ni interceptar).
  - Navegación (`mode === 'navigate'`): network-first con fallback a `index.html`.
  - Assets same-origin: cache-first con actualización pasiva.
- Registrar con bust de caché en `index.html` (query param temporal) para forzar update.

## Confirmación y seguridad
- Eliminaciones usan confirmación por palabra aleatoria: `confirmByTyping()`.
  - Cualquier nueva acción destructiva debe usar este patrón.

## Undo/Redo (Ctrl+Z)
- Cotización:
  - Serializa con `serializeCotizacionForm()` y apila con `pushUndoCotSnapshot()`.
  - Revertir con `undoCot()` o Ctrl/Cmd+Z si `#cotForm` existe.
- Reporte:
  - Serializa con `serializeReporteForm()`; apila con `pushUndoRepSnapshot()` y revierte con `undoRep()`.
- Límite de snapshots: 20. Se generan también con listener debounced al `input`.

## Predictivos
- Guardar en `predictEMS` con `savePredictEMSCloud(tipo, valor)`. Cargar con `actualizarPredictsEMSCloud()`.
- Tipos: `concepto`, `unidad`, `cliente`, `descripcion`.

## Iconos
- Preferir Font Awesome desde CDN sin SRI (evita mismatch). 
- Fallback CSS incluidos para íconos críticos (trash, mic, etc.) si la CDN falla.

## Checklist al hacer cambios
1) UI/UX
- Mantener alto contraste; sin degradados; botones visibles en móvil.
- Verificar que botones de borrar muestran icono (FA o fallback).
2) PDFs
- Probar `generarPDFCotizacion` y `generarPDFReporte` (chrome/ios).
- Confirmar que `ctx.state` está inicializado y que `ensureSpace` se usa correctamente.
3) Service Worker
- Bump de `CACHE_NAME`.
- Asegurar bypass de Firestore/Cloudinary.
- Hard reload tras deploy (PWA: cerrar/abrir).
4) Confirmaciones y Undo
- Las acciones destructivas usan `confirmByTyping`.
- Deshacer (Ctrl+Z) funciona en cotización y reporte.
5) Publicación
- Commit con mensaje claro. Push a `main` (Pages). Revisar consola en producción.

## Cómo probar rápido
- Local: `npx serve .` y abrir en navegador.
- Generar PDF con 1-2 items, con fotos (usar Cloudinary); validar pie de página y subtotales.
- Borrar un ítem/foto y verificar confirmación por palabra y Ctrl+Z.
- Inspeccionar consola: no deben aparecer errores del SW sobre Firestore.

## Glosario de funciones clave
- UI raíz: `renderInicio()`.
- Cotización: `nuevaCotizacion()`, `enviarCotizacion()`, `generarPDFCotizacion()`.
- Reporte: `nuevoReporte()`, `enviarReporte()`, `generarPDFReporte()`.
- Undo: `pushUndoCotSnapshot()`, `undoCot()`, `pushUndoRepSnapshot()`, `undoRep()`.
- SW: evento `fetch` con bypass para Firestore/Cloudinary.

## Notas para futuras IA/CLI
- Si cambias contratos (forma de `secciones`, PDFs o SW), actualiza este AGENTS.md.
- Documenta en el commit qué cambiaste y por qué (especialmente si afecta a PDF o SW).
- Evita introducir dependencias que requieran build; mantener todo en cliente.

---
Última actualización: mantener este archivo al día en cada intervención.

## Registro de cambios de agentes

Mantenido en orden cronológico inverso (lo más reciente primero). Cada intervención debe añadir una entrada breve y verificable.

Plantilla sugerida:
- Fecha: AAAA-MM-DD
- Agente (opcional): nombre o CLI
- Resumen: 1–3 líneas de qué se cambió y por qué
- Archivos clave: rutas tocadas
- Notas: validaciones, impactos, acciones pendientes

Entradas:
- Fecha: 2025-10-18
  - Agente: CLI
  - Resumen: Rediseño con alto contraste (sin degradados), íconos de borrado/mic con fallback, confirmación por palabra en eliminaciones, Undo (Ctrl+Z) para cotización y reporte, corrección de PDFs (ctx.state en cotización) y SW v33 con bypass explícito para Firestore/Cloudinary. Creado AGENTS.md.
  - Archivos clave: `styles.css`, `app.js`, `index.html`, `service-worker.js`, `AGENTS.md`
  - Notas: probado generación de PDF y navegación. Requiere hard reload/PWA relanzar para tomar SW.
