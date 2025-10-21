# AGENTS.md · Guía para agentes/CLIs

Este documento orienta a cualquier CLI/IA que intervenga en este proyecto. Mantenerlo actualizado es obligatorio al tocar arquitectura, contratos o flujos.

## Resumen (v2.0)
- Tipo: WebApp estática (HTML/CSS/JS) publicada en GitHub Pages desde el root del repo.
- Objetivo: Crear y gestionar Cotizaciones y Reportes con PDFs estéticos, usables en móvil, con corrector, confirmación segura al eliminar, opción de deshacer (Ctrl+Z) y experiencia “app nativa”.
- Persistencia: Firebase Firestore (colecciones `cotizaciones`, `reportes`, `predictEMS`).
- Medios: Imágenes en Cloudinary para anexos.
- PDF: PDFLib en el navegador (sin servidor).
- Offline: Service Worker con caché de assets, sin interceptar Firestore/Cloudinary.
- Novedades 2.0:
  - UI tipo app: bloqueo del botón atrás, sin menú contextual en contenido, selección de texto deshabilitada salvo inputs.
  - Cargando/Bloqueo global durante procesos (PDF/Uploads) con `showProgress()` y máscara `ems-busy-mask`.
  - Botón de fotos mejorado (“Agregar fotos”) para cámara/galería y `capture="environment"` en móviles.
  - Checkboxes reemplazados por toggles deslizables (`.ems-toggle`).
  - Términos y Condiciones editables (guardado en `EMS_SETTINGS.tc`) e incluidos en PDFs.
  - Compartir: al compartir, se descarga y además se abre el share del sistema (Web Share API cuando esté disponible).
  - Notificaciones esporádicas de pendientes (toasts/Notifications) con `schedulePendingNotifications()`.
  - Cotización con “Tabla detallada” opcional (Concepto, Cantidad, Unidad, P. Unitario, Total) y detección automática por sección.
  - UX móvil profesional: tablas normal y detallada se apilan en tarjetas en ≤640px (labels virtuales, inputs full‑width).
  - Delegación global de eventos (CSP‑friendly): uso de `data-action` + `initActionDelegates()` en lugar de `onclick` inline.

## Estructura
- `index.html`: Entrypoint. Carga `styles.css`, `app.js`, PDFLib y Firebase. Registra el Service Worker (bust `?v=XX`).
- `styles.css`: Diseño mobile-first, accesible y de alto contraste. Evitar degradados. Variables CSS. Incluye estilos `ems-toggle`, `ems-file-btn`, `ems-busy-mask`.
- `app.js`: Lógica de UI, persistencia, generación de PDFs, Undo/Redo y confirmaciones. UI tipo app (bloqueo atrás/context menu), notificaciones, share, modo detallado, y delegación global de eventos con `data-action`.
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
  - Opcional para notificaciones: campo `estado='pendiente'` o `pendiente=true` por documento (usado por `schedulePendingNotifications`).
- Cloudinary: subida anónima con `upload_preset`.
- LocalStorage:
  - Borradores: `EMS_COT_BORRADOR`, `EMS_REP_BORRADOR`.
  - Ajustes: `EMS_SETTINGS` con:
    - `themeColor`, `showCredit`, `pdf` ({`galleryBase`,`galleryMin`,`galleryMax`,`titleGap`,`cardGap`,`blockGap`})
    - `tc` (Términos y Condiciones editables, string)
  - Undo stacks en memoria: `window.__EMS_UNDO_COT`, `window.__EMS_UNDO_REP` (no persistente).
  - Encoding: mantener archivos en UTF‑8. Para textos sensibles en template strings (placeholders), preferir escapes Unicode (`\u00F3` para ó) si el host altera encoding.

## PDF
- Librería: PDFLib (desde CDN). No hay servidor.
- Generadores:
  - Cotización: `generarPDFCotizacion(share?: boolean, isPreview?: boolean)`.
  - Reporte: `generarPDFReporte(share?: boolean, isPreview?: boolean)`.
- Contratos clave:
  - Siempre inicializar `ctx.state = { prevBlock, inGallery, currentSection }` antes de usar helpers (p. ej., `drawSectionBand`).
  - Usa `ensureSpace` para saltos de página y respeta `FOOTER_SAFE`.
  - Watermark/logo vía `getLogoImage(pdfDoc)` (usa `./icons/icon-192.png`).
  - Incluir T&C si `getSettings().tc` no está vacío: usar `drawLabeledCard(..., { label: 'Términos y Condiciones', text: s.tc })`.
- Estilo:
  - Sin degradados ni colores de bajo contraste. Usar `emsRgb()` (derivado de tema) y `gray()`.
  - Modo detallado: si un ítem de la sección contiene `cantidad`/`unidad`/`precioUnit`/`total`, el encabezado y las filas se renderizan como detallados; de lo contrario, se usa el formato normal (Descripción/Precio).

## Service Worker
- Cache name debe incrementarse en cada cambio relevante (`CACHE_NAME = 'ems-cache-vXX'`).
- Fetch:
  - Para Firestore/Cloudinary: responder con `fetch(req)` y `return;` (no cachear ni interceptar).
  - Navegación (`mode === 'navigate'`): network-first con fallback a `index.html`.
  - Assets same-origin: cache-first con actualización pasiva.
- Registrar con bust de caché en `index.html` (query param `?v=XX`) para forzar update.

## Confirmación y seguridad
- Eliminaciones usan confirmación por palabra aleatoria: `confirmByTyping()`.
  - Cualquier nueva acción destructiva debe usar este patrón.
- UX tipo app (nativo):
  - Bloquear botón atrás (`history.pushState` + `popstate` neutralizado).
  - Desactivar `contextmenu` y selección de texto global (excepto inputs/textarea).
  - Mostrar máscara de “cargando” durante operaciones largas con `showProgress(true, ...)` y ocultar al finalizar.

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
 
## Notificaciones de pendientes
- Implementadas en `schedulePendingNotifications()` (en `app.js`).
- Estrategia: intervalos con aleatoriedad suave (jitter) y límite de frecuencia (guardado en `localStorage`).
- Preferencia: `Notification` API si el usuario otorga permiso; fallback a `showToast()` dentro de la app.
- Fuente de datos: Firestore (`cotizaciones` y `reportes`) con filtro sugerido `estado='pendiente'` o `pendiente=true`.

## Checklist al hacer cambios
1) UI/UX
- Mantener alto contraste; sin degradados; botones visibles en móvil.
- Verificar que botones de borrar muestran icono (FA o fallback).
- Verificar toggles `.ems-toggle` en cotización.
- Verificar botón “Agregar fotos” abre cámara/galería y sube a Cloudinary.
- No agregar `onclick` inline. Usar `data-action` + `initActionDelegates()`.
- Revisar UX móvil (≤640px): tablas normal/detallada apiladas, labels claros, inputs full‑width.
2) PDFs
- Probar `generarPDFCotizacion` y `generarPDFReporte` (chrome/ios).
- Confirmar que `ctx.state` está inicializado y que `ensureSpace` se usa correctamente.
- Confirmar inclusión de Términos y Condiciones cuando existan en ajustes.
- En cotización verificar que secciones “detalladas” muestran encabezado y totales por renglón; secciones “normales” usan Descripción/Precio.
3) Service Worker
- Bump de `CACHE_NAME`.
- Asegurar bypass de Firestore/Cloudinary.
- Hard reload tras deploy (PWA: cerrar/abrir).
4) Confirmaciones y Undo
- Las acciones destructivas usan `confirmByTyping`.
- Deshacer (Ctrl+Z) funciona en cotización y reporte.
5) Publicación
- Commit con mensaje claro. Push a `main` (Pages). Revisar consola en producción.

Regla operativa (obligatoria): tras cualquier cambio efectivo, ejecutar siempre:
- `git add -A && git commit -m "<mensaje claro>"`
- `git push origin main`
Si el push falla por credenciales, configura `user.name`, `user.email` y PAT de GitHub antes de reintentar. GitHub Pages publica desde `main`, por lo que el push es imprescindible para ver los cambios.

## Cómo probar rápido
- Local: `npx serve .` y abrir en navegador.
- Generar PDF con 1-2 items, con fotos (usar Cloudinary); validar pie de página y subtotales.
- Borrar un ítem/foto y verificar confirmación por palabra y Ctrl+Z.
- Inspeccionar consola: no deben aparecer errores del SW sobre Firestore.

## Glosario de funciones clave
- UI raíz: `renderInicio()`.
- Cotización: `nuevaCotizacion()`, `enviarCotizacion()`, `generarPDFCotizacion(share, isPreview)`.
- Reporte: `nuevoReporte()`, `enviarReporte()`, `generarPDFReporte(share, isPreview)`.
- Vista Previa PDF:
  - `previsualizarPDFCotizacion()` - Vista previa rápida de cotización
  - `previsualizarPDFReporte()` - Vista previa rápida de reporte
  - `mostrarVisorPDF(pdfBytes, title, onRefresh)` - Visor de PDF en overlay
- Undo: `pushUndoCotSnapshot()`, `undoCot()`, `pushUndoRepSnapshot()`, `undoRep()`.
- SW: evento `fetch` con bypass para Firestore/Cloudinary.
- UI Profesional:
  - `showModal(message, type, title)` - Modales profesionales (reemplaza alert)
  - `showConfirm(message, title)` - Confirmaciones profesionales (reemplaza confirm)
  - `showToast(message, type, duration)` - Notificaciones no bloqueantes
  - `initNetworkStatus()` - Monitor de estado de red online/offline
  - `validateInput(input, isValid, errorMsg)` - Validación visual de inputs
- Notificaciones: `schedulePendingNotifications()` - verifica pendientes y avisa esporádicamente
- Cargando global: `showProgress(visible, percent, msg)` - muestra barra y bloquea interacción
- Archivos/fotos: `subirFotosCot(input)` - sube a Cloudinary (máx 5)
- Eventos (CSP): `initActionDelegates()` y acciones `data-action` (ver sección CSP/Eventos)
- Cotización detallada: `agregarCotSeccionDet()`, `renderCotSeccionDet()`, `recalcSeccionSubtotal()` (modo normal/detallado)

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
Entradas:
- Fecha: 2025-10-21 (Secciones/Rubros simétricos + fix UI)
  - Agente: Codex CLI
  - Resumen: Reorganización completa de secciones y rubros para simetría y funcionalidad: filas normal/detallado con estructura consistente, sin estilos inline, contenedor de precio compacto (.ems-price), eliminación del duplicado de renderCotSeccionDet y sin onclick inline (delegación global). Mejora visual de textareas e inputs para alineación limpia.
  - Archivos clave: pp.js (renderCotSeccion, renderCotSeccionDet, agregarRubroEnSeccion), styles.css (.ems-price), index.html (bust v61), service-worker.js (v61)
  - Notas: Si no se ven cambios, recargar duro la PWA por el SW.
  - Agente: Codex CLI
  - Resumen: Corregido el bug donde al agregar una nueva sección se insertaban 2 rubros por defecto; ahora solo 1. Unificada la delegación de eventos en secciones detalladas (sin onclick inline) para botones Agregar rubro/Eliminar sección y Eliminar fila. Mejora visual menor en los textboxes (acciones consistentes, sin duplicados inesperados).
  - Archivos clave: `app.js` (agregarCotSeccion, agregarCotSeccionDet, renderCotSeccionDet, agregarRubroEnSeccion), `index.html` (SW bust v61)
  - Notas: Se mantiene el diseño mobile‑first existente. Si no se ve el cambio, recargar PWA; el SW se registra con `?v=61`.
- Fecha: 2025-10-21 (Cotización UI: descripciones auto/ON-OFF + scroll)
  - Agente: Codex CLI
  - Resumen: Mejorada la disposición de inputs en cotización. En modo simple, la columna Descripción se oculta automáticamente si todas están vacías y puede alternarse con un botón "Descripciones: ON/OFF" por sección. En modo detallado se aumentó el ancho de Cantidad y se fuerza scroll horizontal dentro de la tabla (no en toda la app). Se añadieron reglas CSS para overflow y para ocultar/mostrar la columna sin romper el layout.
  - Archivos clave: `app.js` (initDescControlsForSection, refreshDescVisibility, delegación `toggle-desc`), `styles.css` (scroll y ocultar columna), `AGENTS.md`.
  - Notas: El serializer tolera ausencia de `descripcion`. Los botones de acciones siguen usando `data-action` (CSP-friendly).
- Ajustes posteriores: Anchos por columna en simple (40/40/20; 70/30 sin descripción) y detallada (38/12/18/16/16); inputs 100% del ancho de celda y textareas 40px de alto para mantener filas compactas.
  - Responsive por pantalla: zebra más marcada y borde de tabla 2px para cotización; separadores verticales entre columnas. Breakpoints ≤640px y ≤360px con ajustes de anchos, alturas (30px en ultra-compacto) y min-width del contenedor para que el scroll horizontal ocurra solo en la sección.
- Fecha: 2025-10-21 (PDF detallado + textos + UX tabla)
  - Agente: Codex CLI
  - Resumen: Alineación correcta de columnas en tabla detallada del PDF (Cant./Unidad/P. Unit./Total) y subtotales por sección. Normalización de acentos con decodificador unicode en PDF y UI (se eliminan literales \uXXXX visibles). En la UI, la tabla detallada es horizontal con scroll dentro de la tabla (no en toda la página). Footer con separadores “·”, “Página” y datos corregidos.
  - Archivos clave: `app.js`, `styles.css`, `index.html`, `service-worker.js`
  - Notas: SW v46 para forzar actualización. Si persiste texto con \uXXXX en algún lugar de la UI, se corrige en runtime con `normalizeEscapedTexts()`. Hard reload/reabrir PWA tras el deploy.
- Fecha: 2025-10-21 (Fix encoding/U+FFFD + SW v44)
  - Agente: Codex CLI
  - Resumen: Eliminados caracteres U+FFFD en app.js que rompían el parseo ("illegal character" en línea ~1282). Estandarizados campos a `descripcion` (sin acento) y actualizado uso de predictivos. Bump SW a v44 para forzar actualización.
  - Archivos clave: `app.js`, `service-worker.js`, `index.html`
  - Notas: Error de Firebase desaparece al ejecutarse `initializeApp` tras corregir el parse. Requiere recarga dura de la PWA.
- Fecha: 2025-10-21 (Bugfix JS + SW v43)
  - Agente: Codex CLI
  - Resumen: Corregido error de sintaxis en app.js (línea con "function //" que rompía la carga: "function statement requires a name"). Se inicializa la delegación global de eventos en onload. Bump del Service Worker a v43 para propagar cambios.
  - Archivos clave: `app.js`, `service-worker.js`, `index.html`
  - Notas: El error de Firebase "No Firebase App '[DEFAULT]'" desaparece al ejecutarse `firebase.initializeApp()` tras el fix. PWA requiere recarga dura para tomar SW.
- Fecha: 2025-10-21 (UX móvil + Delegación eventos)
  - Agente: Codex CLI
  - Resumen: Tablas normal y detallada apiladas en móvil (grid con labels virtuales, inputs full‑width). Migración a `data-action` con `initActionDelegates()` (CSP‑friendly) en Cotización. Correcciones de acentos/encoding y serializador robusto para modo detallado/normal.
  - Archivos clave: `styles.css` (responsive tablas), `app.js` (delegación y fixes)
  - Notas: PDF refleja encabezados/filas según el tipo de sección. Pendiente (opcional): migrar Reporte a `data-action` para eliminar todos los `onclick`.
- Fecha: 2025-10-20 (Versión 2.0 - UX nativa + Share + T&C)
  - Agente: Codex CLI
  - Resumen: Experiencia tipo app (bloqueo atrás y sin menú contextual en contenido), overlay de “cargando” que bloquea edición durante generación de PDFs y subidas de fotos, botón de fotos mejorado con acceso a cámara/galería, checkboxes reemplazados por toggles deslizables, Términos y Condiciones editables (guardados y añadidos a PDFs), y compartir que descarga y además abre el share del sistema. Notificaciones esporádicas de pendientes con Firestore. SW v42.
  - Archivos clave: `AGENTS.md`, `app.js`, `styles.css`, `index.html`, `service-worker.js`
  - Notas: Requiere actualizar PWA (cerrar/abrir) por SW. Requiere conceder permiso de notificaciones para avisos del sistema; si no, se usan toasts.
- Fecha: 2025-10-18 (Vista Previa PDF en Tiempo Real)
  - Agente: Claude Code
  - Resumen: Sistema completo de vista previa de PDFs antes de generarlos. Visor profesional en overlay con iframe, barra de acciones (actualizar/cerrar), spinner de carga, soporte ESC y accesibilidad (ARIA). Funciones generarPDFCotizacion() y generarPDFReporte() ahora aceptan parámetro isPreview que usa menor calidad de imagen (640x640, quality 0.5 vs 1280x1280, quality 0.72) para generación rápida. Retornan pdfBytes cuando isPreview=true en lugar de descargar. Botones "Vista Previa" agregados en UI de cotización y reporte con icono ojo. Función mostrarVisorPDF() crea overlay con backdrop blur, iframe para mostrar PDF, botón de actualizar que regenera en tiempo real, botón cerrar con cleanup de URLs. Funciones previsualizarPDFCotizacion() y previsualizarPDFReporte() orquestan el flujo completo. CSS profesional con +140 líneas de estilos responsivos. Usuario puede ver estructura y distribución antes de generar PDF final de alta calidad.
  - Archivos clave: `app.js` (+140 líneas vista previa, modificación generarPDFCotizacion/generarPDFReporte), `styles.css` (+140 líneas visor), `service-worker.js` (v40), `index.html` (v40)
  - Notas: Vista previa rápida con menor calidad. Botón actualizar regenera en tiempo real. Responsive mobile-first. Accesibilidad completa. UX espectacular para verificar estructura antes del PDF final.

- Fecha: 2025-10-18 (Optimización Profesional Total - Sistema UI/UX Enterprise)
  - Agente: Claude Code
  - Resumen: TRANSFORMACIÓN PROFESIONAL COMPLETA de la webapp. Sistema de modales profesionales reemplazando todos los alert() nativos (25+ instancias) con modales animados con tipos (info/success/warning/error), atributos ARIA y soporte de teclado (ESC). Sistema de confirmación profesional reemplazando confirm() nativos con showConfirm(). Toast notifications no bloqueantes con animaciones. Indicador de estado de red online/offline persistente. Validación visual de inputs con estados error/success. Service Worker v39 con manejo robusto de errores, fallbacks offline, detección automática de actualizaciones cada 60s y notificación al usuario. Meta tags de seguridad (referrer policy, X-UA-Compatible) y performance (preconnect, dns-prefetch para Firebase/Cloudinary). CSS profesional con +240 líneas de nuevos componentes (modales, toasts, spinners, estados de validación). Funciones helper documentadas: showModal(), showConfirm(), showToast(), initNetworkStatus(), validateInput(). Experiencia de usuario nivel enterprise.
  - Archivos clave: `app.js` (+250 líneas de sistema UI profesional, reemplazo de 25+ alerts/confirms), `styles.css` (+240 líneas de componentes UI), `index.html` (meta tags seguridad/performance, SW update detection), `service-worker.js` (v39, error handling robusto)
  - Notas: UX/UI completamente profesional. Sin alerts/confirms nativos. Modales accesibles (ARIA). Detección de updates automática. Estado de red visible. Inputs con validación visual. Manejo de errores robusto en SW. Mejor performance con preconnect. Sistema listo para producción enterprise.

- Fecha: 2025-10-18 (Optimización Total por Pantalla + Zoom)
  - Agente: Claude Code
  - Resumen: REESCRITURA CSS completa con análisis profundo por tamaño de pantalla. Breakpoints específicos: 320-374px (SE), 375-479px (iPhone), 480-639px (Pro Max), 640-767px (iPad Mini), 768-1023px (iPad), 1024px+ (Desktop). Elementos balanceados: checkboxes 18px, inputs 44px altura, botones 40px, iconos 44px, labels 13px, espaciado proporcional. Zoom sutil (1.01) al escribir en inputs. Distribución responsive perfecta. Max-width por pantalla. Sin elementos muy grandes ni muy pequeños.
  - Archivos clave: `styles.css` (reescritura total 890 líneas), `service-worker.js` (v38), `index.html` (v38)
  - Notas: Tamaños perfectamente balanceados. Zoom al escribir implementado. Checkboxes 18px apropiados. Responsive óptimo para cada dispositivo. Sistema completo de breakpoints.

- Fecha: 2025-10-18 (Fix SW + UX Mejorada)
  - Agente: Claude Code
  - Resumen: Corregido error crítico de SW interceptando Firestore (ahora NO intercepta googleapis.com/gstatic.com). Inputs más grandes y dinámicos (min-height 48-52px), labels más claros, textareas 120px, hover effects en inputs, tarjetas con animación de barra lateral, iconos 56px con zoom hover, botones con elevación, padding mejorado en tablas. UX ultra intuitiva.
  - Archivos clave: `service-worker.js` (v37, bypass correcto), `styles.css` (inputs dinámicos, navegación mejorada), `index.html` (v37)
  - Notas: SW ya NO da error con Firestore. Inputs y navegación mucho más intuitivos. Feedback visual mejorado en toda la app.

- Fecha: 2025-10-18 (Rediseño Minimalista Ultra-Optimizado)
  - Agente: Claude Code
  - Resumen: Rediseño COMPLETO minimalista sin degradados. Paleta de colores sólidos (azul #2563eb), diseño ultra-limpio, botones optimizados para móviles (56px altura, grid 1fr evita cortes), espaciado consistente con variables, tablas responsivas, formularios en columna en móvil, acciones sticky mejoradas, splash screen minimalista, sombras sutiles, bordes redondeados consistentes (8px), theme-color actualizado. TODO sin degradados, enfoque en claridad y usabilidad móvil.
  - Archivos clave: `styles.css` (reescritura total minimalista), `index.html` (splash, theme-color #2563eb), `manifest.json` (colores actualizados), `service-worker.js` (v36)
  - Notas: Diseño WOW minimalista profesional. Botones ya no se cortan en pantalla. Grid responsive mobile-first. Simetría y distribución perfecta de elementos. Requiere hard reload y reinstalar PWA.

- Fecha: 2025-10-18 (Rediseño Mobile-First Completo)
  - Agente: Claude Code
  - Resumen: Rediseño completo de la interfaz con estética mobile-first moderna. Paleta de colores vibrante basada en Material Design, animaciones suaves, efectos glassmorphism, sistema de spacing y radius con variables CSS, botones con ripple effect, tarjetas con hover elevado, header sticky con gradiente, galería de fotos en grid, modales con backdrop blur, splash screen animado, responsive design optimizado para móviles (inputs 16px para evitar zoom iOS), acciones sticky en bottom, meta tags PWA mejorados, manifest.json con shortcuts, y SW v34.
  - Archivos clave: `styles.css` (rediseño completo), `index.html` (meta tags, splash screen), `manifest.json` (shortcuts, categorías), `service-worker.js` (v34)
  - Notas: Diseño completamente optimizado para dispositivos móviles con interacciones táctiles mejoradas. Sistema de diseño coherente con variables CSS. Animaciones y transiciones suaves. Requiere hard reload/desinstalar PWA y reinstalar para ver cambios completos.

- Fecha: 2025-10-18
  - Agente: CLI
  - Resumen: Rediseño con alto contraste (sin degradados), íconos de borrado/mic con fallback, confirmación por palabra en eliminaciones, Undo (Ctrl+Z) para cotización y reporte, corrección de PDFs (ctx.state en cotización) y SW v33 con bypass explícito para Firestore/Cloudinary. Creado AGENTS.md.
  - Archivos clave: `styles.css`, `app.js`, `index.html`, `service-worker.js`, `AGENTS.md`
  - Notas: probado generación de PDF y navegación. Requiere hard reload/PWA relanzar para tomar SW.
- CSP / Eventos
  - Evitar handlers inline (`onclick`). Usar `data-action` y el delegado `initActionDelegates()`.
  - Acciones soportadas (Cotización): `add-section`, `add-section-det`, `add-row`, `remove-row`, `remove-section`, `cot-cancel`, `cot-undo`, `cot-preview`, `cot-pdf`, `cot-share`, `del-photo-cot`.

  Acciones delegadas (mapa rápido)
  - `add-section` → `agregarCotSeccion()`
  - `add-section-det` → `agregarCotSeccionDet()`
  - `add-row` → `agregarRubroEnSeccion(btn)` (usa el botón clickeado para ubicar la sección)
  - `remove-row` → elimina la fila y llama `recalcSeccionSubtotal(sec)` (resuelto en el switch del delegado)
  - `remove-section` → `eliminarCotSeccion(btn)`
  - `cot-cancel` → limpia borrador de cotización + `renderInicio()`
  - `cot-undo` → `undoCot()`
  - `cot-preview` → `previsualizarPDFCotizacion()`
  - `cot-pdf` → `guardarCotizacionDraft()`; `generarPDFCotizacion()`
  - `cot-share` → `guardarCotizacionDraft()`; `generarPDFCotizacion(true)`
  - `del-photo-cot` → `eliminarFotoCot(idx)` (leer índice de `data-idx`)

  Cómo añadir un nuevo botón/acción
  - En el HTML/plantilla, agrega el atributo `data-action="mi-accion"` al botón o enlace. Evita `onclick`.
  - En `initActionDelegates()` (app.js), añade un `case 'mi-accion':` dentro del `switch` y llama a la función necesaria.
  - Si requiere parámetros, pásalos con `data-*` (ej. `data-id`, `data-idx`) y léelos con `getAttribute` en el delegado.
  - Para acciones destructivas, usa `confirmByTyping()` antes de ejecutar.
  - Si el cambio afecta al PDF o contratos, actualiza este AGENTS.md y valida ambos modos (normal/detallado).
