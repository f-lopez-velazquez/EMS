// === INICIALIZACIÓN Y UTILIDADES ===
const EMS_CONTACT = {
  empresa: "ELECTROMOTORES SANTANA",
  direccion: "Carr. a Chichimequillas 306, Colonia Menchaca 2, 76147 Santiago de Querétaro, Qro.",
  telefono: "cel: 442 469 9895; Tel/Fax: 4422208910",
  correo: "electromotores.santana@gmail.com"
};
const EMS_COLOR = [0.97, 0.54, 0.11]; // rgb(248,138,29) (fallback)

// Ajustes (tema/PDF) persistentes
function getSettings() {
  try {
    const raw = localStorage.getItem('EMS_SETTINGS');
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}
function saveSettings(conf) {
  try { localStorage.setItem('EMS_SETTINGS', JSON.stringify(conf||{})); } catch (e) {}
}
function hexToRgbArray(hex) {
  if (!hex || typeof hex !== 'string') return EMS_COLOR;
  const m = hex.replace('#','');
  if (m.length !== 6) return EMS_COLOR;
  const r = parseInt(m.slice(0,2),16)/255, g = parseInt(m.slice(2,4),16)/255, b = parseInt(m.slice(4,6),16)/255;
  return [r,g,b];
}
function getThemeRgbArray() {
  const s = getSettings();
  const hex = (s && s.themeColor);
  if (hex) return hexToRgbArray(hex);
  return EMS_COLOR;
}

// Aplicar tema (CSS vars y meta theme-color)
function setCssVar(name, value) {
  try { document.documentElement.style.setProperty(name, value); } catch (e) {}
}
function shadeHex(hex, percent) {
  // percent: -1..1 (negro..blanco)
  if (!hex) return hex;
  hex = hex.replace('#','');
  if (hex.length !== 6) return '#' + hex;
  const num = parseInt(hex, 16);
  let r = (num >> 16) & 0xFF, g = (num >> 8) & 0xFF, b = num & 0xFF;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  const toHex = (v)=>('0' + v.toString(16)).slice(-2);
  return '#' + toHex(Math.max(0, Math.min(255, r))) + toHex(Math.max(0, Math.min(255, g))) + toHex(Math.max(0, Math.min(255, b)));
}
function applyThemeFromSettings() {
  const s = getSettings();
  const main = (s.themeColor || '#F88A1D');
  const light = shadeHex(main, 0.25);
  setCssVar('--azul', main);
  setCssVar('--azul-claro', light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', main);
}

// === Firebase (tus credenciales) ===
const firebaseConfig = {
  apiKey: "AIzaSyDsXSbJWdMyBgTedntNv3ppj5GAvRUImyc",
  authDomain: "elms-26a5d.firebaseapp.com",
  projectId: "elms-26a5d",
  storageBucket: "elms-26a5d.appspot.com",
  messagingSenderId: "822211669634",
  appId: "1:822211669634:web:9eeb32d9efae360713ce9b"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// === Cloudinary usado en reportes/cotización ===
const CLOUDINARY_CLOUD = "ds9b1mczi";
const CLOUDINARY_PRESET = "ml_default";

// Usa ícono local para coherencia con GH Pages e ícono de pestaña
const LOGO_URL = "./icons/icon-192.png";

// Estado de secciones para Cotización (en DOM, pero guardamos helpers)
let cotSeccionesTemp = [];

// ⬇⬇ IMPORTANTE: fotos por ÍTEM con ID estable (no por índice)
let fotosItemsReporteMap = {}; // { [rowId]: string[] }
let fotosCotizacion = []; // Hasta 5 fotos por cotización
let autoSaveTimer = null;

// ---- Helpers generales ----
function safe(val) { return (val === undefined || val === null) ? "" : String(val); }
function formatMoney(val) { return "$" + Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hoy() { return (new Date()).toISOString().slice(0, 10); }
function ahora() { const d = new Date(); return d.toTimeString().slice(0, 5); }
function newUID(){ return 'i' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }

function mostrarPrecio(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "string" && (val.trim() === "." || val.trim() === "-")) return "";
  if (isNaN(Number(val)) || val === "") return "";
  return "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mostrarPrecioLimpio(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "string" && (val.trim() === "." || val.trim() === "-")) return "";
  if (isNaN(Number(val)) || val === "") return "";
  return "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Barra de progreso
function showProgress(visible = true, percent = 0, msg = "") {
  let bar = document.getElementById("progress-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "progress-bar";
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "center";
    bar.style.position = "fixed";
    bar.style.left = "0";
    bar.style.top = "0";
    bar.style.width = "100vw";
    bar.style.height = "5px";
    bar.style.background = "#26B77A";
    bar.style.zIndex = "1200";
    bar.innerHTML = '';
    document.body.appendChild(bar);
  }
  let inner = bar.querySelector(".progress-inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "progress-inner";
    inner.style.height = "100%";
    inner.style.width = percent + "%";
    inner.innerText = msg;
    bar.appendChild(inner);
  }
  bar.style.display = visible ? "flex" : "none";
  inner.style.width = percent + "%";
  inner.innerText = msg;
  if (!visible) {
    setTimeout(() => {
      bar.style.display = "none";
      inner.innerText = "";
      inner.style.width = "0%";
    }, 400);
  }
}

function showSaved(msg = "Guardado") {
  let el = document.getElementById("saved-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "saved-banner";
    el.style.position = "fixed";
    el.style.bottom = "28px";
    el.style.right = "32px";
    el.style.background = "#26B77A";
    el.style.color = "#fff";
    el.style.padding = "12px 32px";
    el.style.borderRadius = "16px";
    el.style.fontWeight = "bold";
    el.style.zIndex = 1000;
    el.style.boxShadow = "0 2px 12px #0002";
    el.style.fontSize = "1.1em";
    document.body.appendChild(el);
  }
  el.innerHTML = msg;
  el.style.display = "block";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, 1800);
}

// ===== SISTEMA PROFESIONAL DE UI =====

/**
 * Muestra un modal profesional (reemplaza alert)
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'info', 'success', 'warning', 'error'
 * @param {string} title - Título del modal (opcional)
 */
function showModal(message, type = 'info', title = '') {
  return new Promise((resolve) => {
    // Remover modal existente si hay
    const existing = document.querySelector('.ems-modal-overlay');
    if (existing) existing.remove();

    // Íconos por tipo
    const icons = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      error: '✕'
    };

    // Títulos por defecto
    const titles = {
      info: 'Información',
      success: 'Éxito',
      warning: 'Advertencia',
      error: 'Error'
    };

    const overlay = document.createElement('div');
    overlay.className = 'ems-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    overlay.innerHTML = `
      <div class="ems-modal">
        <div class="ems-modal-header">
          <div class="ems-modal-icon ${type}">${icons[type]}</div>
          <h3 class="ems-modal-title" id="modal-title">${title || titles[type]}</h3>
        </div>
        <div class="ems-modal-body">${message}</div>
        <div class="ems-modal-footer">
          <button class="ems-modal-btn primary" autofocus>Aceptar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve(true);
      }, 200);
    };

    overlay.querySelector('.ems-modal-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // ESC para cerrar
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Muestra un modal de confirmación (reemplaza confirm)
 * @param {string} message - Mensaje a mostrar
 * @param {string} title - Título del modal
 */
function showConfirm(message, title = 'Confirmar') {
  return new Promise((resolve) => {
    const existing = document.querySelector('.ems-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ems-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="ems-modal">
        <div class="ems-modal-header">
          <div class="ems-modal-icon warning">⚠️</div>
          <h3 class="ems-modal-title">${title}</h3>
        </div>
        <div class="ems-modal-body">${message}</div>
        <div class="ems-modal-footer">
          <button class="ems-modal-btn secondary">Cancelar</button>
          <button class="ems-modal-btn primary" autofocus>Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = (result) => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    const btns = overlay.querySelectorAll('.ems-modal-btn');
    btns[0].addEventListener('click', () => closeModal(false)); // Cancelar
    btns[1].addEventListener('click', () => closeModal(true));  // Confirmar

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(false);
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Muestra una notificación toast (no bloqueante)
 * @param {string} message - Mensaje
 * @param {string} type - 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duración en ms (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `ems-toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ️',
    warning: '⚠️'
  };

  toast.innerHTML = `<span style="font-size:1.2em;">${icons[type]}</span> ${message}`;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Inicializa el indicador de estado de red
 */
function initNetworkStatus() {
  const statusBar = document.getElementById('network-status');
  if (!statusBar) return;

  const statusText = statusBar.querySelector('.status-text');

  const updateStatus = () => {
    const online = navigator.onLine;
    if (online) {
      statusBar.classList.add('online');
      statusBar.classList.remove('show');
      statusText.textContent = '✓ Conexión restaurada';
      setTimeout(() => statusBar.classList.remove('show'), 2000);
    } else {
      statusBar.classList.remove('online');
      statusBar.classList.add('show');
      statusText.textContent = '⚠️ Sin conexión a Internet';
    }
  };

  window.addEventListener('online', () => {
    updateStatus();
    showToast('Conexión a Internet restaurada', 'success');
  });

  window.addEventListener('offline', () => {
    updateStatus();
    showToast('Sin conexión a Internet', 'error', 5000);
  });

  // Check initial status
  updateStatus();
}

/**
 * Valida un input y muestra estado visual
 * @param {HTMLElement} input - El input a validar
 * @param {boolean} isValid - Si es válido
 * @param {string} errorMsg - Mensaje de error (opcional)
 */
function validateInput(input, isValid, errorMsg = '') {
  if (!input) return;

  // Remover estado previo
  input.classList.remove('error', 'success');
  const parentEl = input.parentElement;
  const prevError = parentEl ? parentEl.querySelector('.error-message') : null;
  if (prevError) prevError.remove();

  if (isValid) {
    input.classList.add('success');
    setTimeout(() => input.classList.remove('success'), 2000);
  } else {
    input.classList.add('error');
    if (errorMsg) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `<span>✕</span> ${errorMsg}`;
      errorDiv.setAttribute('role', 'alert');
      if (parentEl) parentEl.appendChild(errorDiv);
    }
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNetworkStatus);
} else {
  initNetworkStatus();
}

// ===== SISTEMA DE VISTA PREVIA DE PDF =====

// Variable global para el overlay actual
let currentPDFPreviewOverlay = null;

/**
 * Muestra un PDF en el visor de vista previa
 * @param {Uint8Array} pdfBytes - Bytes del PDF generado
 * @param {string} title - Título del documento
 * @param {Function} onRefresh - Función a llamar al refrescar
 */
function mostrarVisorPDF(pdfBytes, title, onRefresh) {
  // Cerrar visor existente si hay
  if (currentPDFPreviewOverlay) {
    currentPDFPreviewOverlay.remove();
  }

  // Crear blob y URL del PDF con parámetro #view=FitH para forzar vista inline
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob) + '#view=FitH&toolbar=1&navpanes=0';

  // Crear overlay
  const overlay = document.createElement('div');
  overlay.className = 'ems-pdf-preview-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Vista previa del PDF');

  // Usar object en lugar de iframe para mejor soporte en móviles
  overlay.innerHTML = `
    <div class="ems-pdf-preview-header">
      <div class="ems-pdf-preview-title">
        <i class="fa fa-file-pdf"></i>
        ${title}
        <span class="ems-pdf-preview-badge">Vista Previa</span>
      </div>
      <div class="ems-pdf-preview-actions">
        <button class="ems-pdf-preview-btn refresh" id="pdf-preview-refresh">
          <i class="fa fa-sync"></i> Actualizar
        </button>
        <button class="ems-pdf-preview-btn close" id="pdf-preview-close">
          <i class="fa fa-times"></i> Cerrar
        </button>
      </div>
    </div>
    <div class="ems-pdf-preview-container" style="position: relative;">
      <div class="ems-pdf-preview-loading" id="pdf-preview-loading" style="display:none;">
        <div class="ems-pdf-preview-spinner"></div>
        <div class="ems-pdf-preview-loading-text">Actualizando...</div>
      </div>
      <object class="ems-pdf-preview-iframe" id="pdf-preview-iframe" data="${url}" type="application/pdf" title="Vista previa del PDF">
        <iframe src="${url}" class="ems-pdf-preview-iframe" title="Vista previa del PDF"></iframe>
      </object>
    </div>
  `;

  document.body.appendChild(overlay);
  currentPDFPreviewOverlay = overlay;

  const loading = overlay.querySelector('#pdf-preview-loading');

  // Botón cerrar
  const closeBtn = overlay.querySelector('#pdf-preview-close');
  closeBtn.addEventListener('click', () => {
    URL.revokeObjectURL(url);
    overlay.remove();
    currentPDFPreviewOverlay = null;
  });

  // Botón refrescar
  const refreshBtn = overlay.querySelector('#pdf-preview-refresh');
  refreshBtn.addEventListener('click', async () => {
    if (onRefresh) {
      loading.style.display = 'flex';
      try {
        await onRefresh();
      } catch (e) {
        showModal('Error al actualizar la vista previa: ' + (e.message || e), 'error');
      }
    }
  });

  // ESC para cerrar
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeBtn.click();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);

  // Cleanup cuando se cierre
  overlay.addEventListener('DOMNodeRemoved', () => {
    URL.revokeObjectURL(url);
    document.removeEventListener('keydown', handleEsc);
  });
}

/**
 * Genera y muestra vista previa de cotización
 * Usa menor calidad de imagen para velocidad
 */
async function previsualizarPDFCotizacion() {
  try {
    // Mostrar indicador de carga
    showProgress(true, 20, "Generando vista previa rápida...");

    const pdfBytes = await generarPDFCotizacion(false, true); // false = no compartir, true = preview

    showProgress(false);

    if (pdfBytes) {
      mostrarVisorPDF(pdfBytes, 'Cotización - Vista Previa', previsualizarPDFCotizacion);
      showToast('Vista previa generada', 'success', 2000);
    } else {
      showModal('No se pudo generar la vista previa', 'error');
    }
  } catch (e) {
    showProgress(false);
    showModal('Error al generar vista previa: ' + (e.message || e), 'error');
    console.error('Error en vista previa:', e);
  }
}

/**
 * Genera y muestra vista previa de reporte
 * Usa menor calidad de imagen para velocidad
 */
async function previsualizarPDFReporte() {
  try {
    // Mostrar indicador de carga
    showProgress(true, 20, "Generando vista previa rápida...");

    const pdfBytes = await generarPDFReporte(false, true); // false = no compartir, true = preview

    showProgress(false);

    if (pdfBytes) {
      mostrarVisorPDF(pdfBytes, 'Reporte - Vista Previa', previsualizarPDFReporte);
      showToast('Vista previa generada', 'success', 2000);
    } else {
      showModal('No se pudo generar la vista previa', 'error');
    }
  } catch (e) {
    showProgress(false);
    showModal('Error al generar vista previa: ' + (e.message || e), 'error');
    console.error('Error en vista previa:', e);
  }
}

// --- Envoltura de texto por palabras (más estética que por caracteres)
function pdfSafe(s) {
  try {
    if (s == null) return '';
    let t = String(s);
    // Reemplaza U+FFFD y normaliza acentos
    t = t.replace(/\uFFFD/g, '?');
    if (t.normalize) t = t.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    // Bullets y BEL a guiones
    t = t.replace(/[•●▪◦]/g, '-').replace(/\u0007/g, '-');
    // Permitir ASCII, latin-1 y saltos de línea
    t = t.replace(/[^\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '');
    return t;
  } catch (e) { return String(s||''); }
}function wrapTextLines(text = "", font, fontSize, maxWidth) {
  const words = String(pdfSafe(text) || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = (line ? line + " " : "") + words[i];
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ====== Compresión de imágenes para PDFs ======
const __IMG_CACHE = new Map();
const PDF_IMG_DEFAULTS = { maxW: 1280, maxH: 1280, quality: 0.72 };

/**
 * Comprime/redimensiona una imagen remota o dataURL a JPEG.
 * Devuelve: ArrayBuffer con JPEG ya comprimido.
 */
async function compressImageToJpegArrayBuffer(src, { maxW, maxH, quality } = PDF_IMG_DEFAULTS) {
  const key = `${src}|${maxW}x${maxH}|q${quality}`;
  if (__IMG_CACHE.has(key)) return __IMG_CACHE.get(key);

  let blob;
  if (src.startsWith('data:')) {
    const res = await fetch(src);
    blob = await res.blob();
  } else {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('No se pudo cargar imagen: ' + src);
    blob = await res.blob();
  }

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const scale = Math.min(maxW / width, maxH / height, 1); // nunca agrandar
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  let outBlob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, w, h);
    outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, w, h);
    outBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  }

  const arrBuf = await outBlob.arrayBuffer();
  __IMG_CACHE.set(key, arrBuf);
  return arrBuf;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// ====== Predictivos Firestore ======
async function savePredictEMSCloud(tipo, valor, user = "general") {
  if (!valor || valor.length < 2) return;
  const docRef = db.collection("predictEMS").doc(user);
  const snap = await docRef.get();
  let data = snap.data() || {};
  if (!data[tipo]) data[tipo] = [];
  if (!data[tipo].includes(valor)) data[tipo].unshift(valor);
  if (data[tipo].length > 30) data[tipo] = data[tipo].slice(0, 30);
  await docRef.set(data, { merge: true });
}
async function getPredictEMSCloud(tipo, user = "general") {
  const docRef = db.collection("predictEMS").doc(user);
  let data = (await docRef.get()).data() || {};
  return data[tipo] || [];
}
async function actualizarPredictsEMSCloud(user = "general") {
  let conceptos = await getPredictEMSCloud("concepto", user);
  let unidades = await getPredictEMSCloud("unidad", user);
  let clientes = await getPredictEMSCloud("cliente", user);
  let descs    = await getPredictEMSCloud("descripcion", user);

  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = conceptos.map(v=>`<option value="${v}">`).join('');
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = unidades.map(v=>`<option value="${v}">`).join('');
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = clientes.map(v=>`<option value="${v}">`).join('');
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = descs.map(v=>`<option value="${v}">`).join('');
}
function activarPredictivosInstantaneos() {
  document.querySelectorAll('input[name="concepto"]').forEach(input => {
    if (!input.hasAttribute('data-predictivo')) {
      input.setAttribute('data-predictivo', '1');
      input.addEventListener('blur', () => savePredictEMSCloud('concepto', input.value));
    }
  });
  document.querySelectorAll('input[name="unidad"]').forEach(input => {
    if (!input.hasAttribute('data-predictivo')) {
      input.setAttribute('data-predictivo', '1');
      input.addEventListener('blur', () => savePredictEMSCloud('unidad', input.value));
    }
  });
  document.querySelectorAll('input[name="cliente"]').forEach(input => {
    if (!input.hasAttribute('data-predictivo')) {
      input.setAttribute('data-predictivo', '1');
      input.addEventListener('blur', () => savePredictEMSCloud('cliente', input.value));
    }
  });
  document.querySelectorAll('textarea[name="descripcion"]').forEach(input => {
    if (!input.hasAttribute('data-predictivo')) {
      input.setAttribute('data-predictivo', '1');
      input.addEventListener('blur', () => savePredictEMSCloud('descripcion', input.value));
    }
  });
}

// --------- Renderización de interfaz ---------
function renderInicio() {
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  fotosItemsReporteMap = {};
  fotosCotizacion = [];
  document.getElementById("root").innerHTML = `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div style="flex:1">
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Cotizaciones y Reportes</span>
      </div>
      <button class="btn-mini" style="margin-left:auto" title="Ajustes" onclick="openSettings()">
        <i class="fa fa-gear"></i>
      </button>
    </div>
    <div class="ems-main-btns">
      <button onclick="nuevaCotizacion()" class="btn-primary"><i class="fa fa-file-invoice"></i> Nueva Cotización</button>
      <button onclick="nuevoReporte()" class="btn-secondary"><i class="fa fa-clipboard-list"></i> Nuevo Reporte</button>
    </div>
    <div class="ems-historial">
      <div class="ems-historial-header">
        <h2><i class="fa fa-clock"></i> Recientes</h2>
        <input type="text" id="buscarEMS" placeholder="Buscar por cliente, número o fecha...">
      </div>
      <div id="historialEMS" class="ems-historial-list"></div>
    </div>
    <div class="ems-credit">Programado por: Francisco López Velázquez.</div>
  `;
  cargarHistorialEMS();
}

window.onload = () => {
  renderInicio();
  try { applyThemeFromSettings(); } catch (e) {}
  try { typeof showOffline === "function" && showOffline(true); } catch (e) {}
  try { installUndoHandlers(); } catch (e) {}
  try { observeSettingsPanel(); } catch (e) {}
};

let ASYNC_ERR_GUARD = false;

// ==== Historial ====
async function cargarHistorialEMS(filtro = "") {
  const cont = document.getElementById("historialEMS");
  if (!cont) return;
  cont.innerHTML = "<div class='ems-historial-cargando'>Cargando...</div>";
  let cotSnap = [], repSnap = [];
  try {
    cotSnap = await db.collection("cotizaciones").orderBy("creada", "desc").limit(20).get();
    repSnap = await db.collection("reportes").orderBy("creada", "desc").limit(20).get();
  } catch (e) {
    cont.innerHTML = "<div class='ems-historial-vacio'>No se pudo cargar historial (offline)</div>";
    return;
  }
  let items = [];
  cotSnap.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
  repSnap.forEach(doc => items.push({ ...doc.data(), id: doc.id }));

  if (filtro && filtro.length > 0) {
    items = items.filter(x =>
      (x.cliente || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (x.numero || "").toLowerCase().includes(filtro.toLowerCase()) ||
      (x.fecha || "").toLowerCase().includes(filtro.toLowerCase())
    );
  }
  items.sort((a, b) => (b.creada || "") > (a.creada || "") ? 1 : -1);
  if (items.length === 0) {
    cont.innerHTML = "<div class='ems-historial-vacio'>No hay cotizaciones ni reportes.</div>";
    return;
  }
  cont.innerHTML = items.slice(0, 20).map(x => `
    <div class="ems-card-ems ${x.tipo === "cotizacion" ? "ems-cotizacion" : "ems-reporte"}" onclick="abrirDetalleEMS('${x.tipo}', '${x.numero}')">
      <div class="ems-card-ico"><i class="fa ${x.tipo === "cotizacion" ? "fa-file-invoice" : "fa-clipboard-list"}"></i></div>
      <div class="ems-card-main">
        <div class="ems-card-tipo">${x.tipo === "cotizacion" ? "Cotización" : "Reporte"}</div>
        <div class="ems-card-cliente"><b>${x.cliente || ""}</b></div>
        <div class="ems-card-fecha">${x.fecha || ""} ${x.hora ? "— " + x.hora : ""}</div>
        <div class="ems-card-numero">#${x.numero || ""}</div>
      </div>
      <div class="ems-card-ir"><i class="fa fa-chevron-right"></i></div>
    </div>
  `).join("");
}

// Abrir detalle desde historial (cotización o reporte)
function abrirDetalleEMS(tipo, numero) {
try{ window.abrirDetalleEMS = abrirDetalleEMS; }catch(e){}
  try { if (!tipo || !numero) return; } catch (e) { return; }
  try { showSaved('Cargando...'); } catch (e) {}
  const col = (tipo === 'cotizacion') ? 'cotizaciones' : 'reportes';
  try {
    db.collection(col).doc(String(numero)).get().then((doc)=>{
      if (!doc || !doc.exists) {
        try { showModal('No se encontró el documento solicitado.', 'warning'); } catch (e) {}
        return;
      }
      const data = doc.data() || {};
      data.numero = data.numero || String(numero);
      try {
        if (tipo === 'cotizacion') {
          localStorage.setItem('EMS_COT_BORRADOR', JSON.stringify(data));
          localStorage.removeItem('EMS_REP_BORRADOR');
          nuevaCotizacion();
        } else {
          localStorage.setItem('EMS_REP_BORRADOR', JSON.stringify(data));
          localStorage.removeItem('EMS_COT_BORRADOR');
          nuevoReporte();
        }
      } catch (e) { console.warn('No se pudo preparar el borrador local', e); }
    }).catch((e)=>{
      console.error('Error cargando detalle:', e);
      try { showModal('Error cargando detalle: ' + (e && e.message ? e.message : e), 'error'); } catch (e2) {}
    });
  } catch (e) {
    console.error('Error inesperado en abrirDetalleEMS:', e);
  }
}
document.addEventListener("input", e => {
  if (e.target && e.target.id === "buscarEMS") {
    cargarHistorialEMS(e.target.value);
  }
});

// ========== Cotización ==========
function renderCotItemRow(item = {}) {
  return `
    <tr>
      <td>
        <input type="text" name="concepto" list="conceptosEMS" value="${item.concepto||""}" required autocomplete="off">
        <datalist id="conceptosEMS"></datalist>
      </td>
      <td>
        <input type="text" name="unidad" list="unidadesEMS" value="${item.unidad||""}" required autocomplete="off">
        <datalist id="unidadesEMS"></datalist>
      </td>
      <td>
        <input type="number" name="cantidad" min="0" value="${item.cantidad||""}" required>
      </td>
      <td style="white-space:nowrap;display:flex;align-items:center;">
        <span style="margin-right:4px;color:#13823b;font-weight:bold;">$</span>
        <input type="number" name="precio" min="0" step="0.01" value="${item.precio||""}" required style="width:90px;">
      </td>
      <td>
        <button type="button" class="btn-mini" onclick="eliminarCotItemRow(this)"><i class="fa fa-trash"></i></button>
      </td>
    </tr>
  `;
}
function agregarCotItemRow() {
  const tbody = document.getElementById('itemsTable').querySelector('tbody');
  tbody.insertAdjacentHTML('beforeend', renderCotItemRow());
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
}
function eliminarCotItemRow(btn) {
  btn.closest('tr').remove();
}

// ========== NUEVO: Secciones de cotización ==========
function renderCotSeccion(seccion = {}, rowId) {
  const id = rowId || newUID();
  const items = Array.isArray(seccion.items) ? seccion.items : [];
  const itemsHtml = items.map(it => `
      <tr>
        <td><input type="text" name="concepto" value="${safe(it.concepto)}" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences"></td>
        <td><textarea name="descripcion" rows="2" placeholder="Detalle del concepto..." spellcheck="true" autocapitalize="sentences">${safe(it.descripcion)}</textarea></td>
        <td style="white-space:nowrap;display:flex;align-items:center;">
          <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
          <input type="number" name="precioSec" min="0" step="0.01" value="${safe(it.precio)}" style="width:100px;">
          <button type="button" class="btn-mini" onclick="this.closest('tr').remove(); recalcSeccionSubtotal(this.closest('.cot-seccion'))"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
  `).join('');
  return `
    <div class="cot-seccion" data-secid="${id}">
      <div class="cot-seccion-head">
        <input type="text" class="cot-sec-title" name="sec_titulo" placeholder="Título de sección (ej. Refacciones, Mano de obra)" value="${safe(seccion.titulo)}">
        <div class="cot-sec-actions">
          <button type="button" class="btn-mini" onclick="agregarRubroEnSeccion(this)"><i class="fa fa-plus"></i> Agregar rubro</button>
          <button type="button" class="btn-mini" onclick="eliminarCotSeccion(this)"><i class="fa fa-trash"></i></button>
        </div>
      </div>
      <table class="ems-items-table cot-seccion-table">
        <thead>
          <tr>
            <th style="width:30%">Concepto</th>
            <th>Descripción</th>
            <th style="width:180px">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="cot-seccion-subtotal"><span>Subtotal sección:</span> <b class="cot-subtotal-val">$0.00</b></div>
    </div>
  `;
}
function agregarCotSeccion(preload = null) {
  const wrap = document.getElementById('cotSeccionesWrap');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', renderCotSeccion(preload||{ items:[{},{},] }));
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  recalcTotalesCotizacion();
}
function eliminarCotSeccion(btn) {
  const sec = btn.closest('.cot-seccion');
  if (sec) { sec.remove(); recalcTotalesCotizacion(); }
}
function agregarRubroEnSeccion(btn) {
  const sec = btn.closest('.cot-seccion');
  if (!sec) return;
  const tbody = sec.querySelector('tbody');
  tbody.insertAdjacentHTML('beforeend', `
    <tr>
      <td><input type="text" name="concepto" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences"></td>
      <td><textarea name="descripcion" rows="2" placeholder="Detalle del concepto..." spellcheck="true" autocapitalize="sentences"></textarea></td>
      <td style="white-space:nowrap;display:flex;align-items:center;">
        <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
        <input type="number" name="precioSec" min="0" step="0.01" style="width:100px;">
        <button type="button" class="btn-mini" onclick="this.closest('tr').remove(); recalcSeccionSubtotal(this.closest('.cot-seccion'))"><i class="fa fa-trash"></i></button>
      </td>
    </tr>
  `);
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  recalcSeccionSubtotal(sec);
}
function recalcSeccionSubtotal(sec) {
  if (!sec) return;
  const precios = Array.from(sec.querySelectorAll('input[name="precioSec"]'));
  const subtotal = precios.reduce((a,inp)=>{
    const v = String(inp.value||"").trim();
    if (v===''||v==='.'||v==='-') return a;
    const n = Number(v); return a + (isNaN(n)?0:n);
  },0);
  const el = sec.querySelector('.cot-subtotal-val');
  if (el) el.textContent = mostrarPrecioLimpio(subtotal);
  return subtotal;
}
function recalcTotalesCotizacion() {
  const sections = Array.from(document.querySelectorAll('#cotSeccionesWrap .cot-seccion'));
  let subtotal = 0;
  sections.forEach(sec => subtotal += recalcSeccionSubtotal(sec) || 0);
  const form = document.getElementById('cotForm');
  // Inyecta checkbox de términos si no existe (evita depender del HTML exacto)
  try {
    const tituloEl = form.querySelector('input[name="titulo"]');
    const sup = tituloEl ? tituloEl.closest('.ems-form-group') : null;
    if (sup && !form.querySelector('input[name="incluyeTerminos"]')) {
      const g = document.createElement('div');
      g.className = 'ems-form-group';
      g.innerHTML = '<label><input type="checkbox" name="incluyeTerminos"> Incluir términos y condiciones</label>';
      sup.parentNode.insertBefore(g, sup);
    }
  } catch (e) {}
  if (!form) return;
  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal * 0.16 : 0;
  const total = subtotal + iva;
  const box = document.getElementById('cotResumenTotales');
  if (box) {
    box.querySelector('.cot-res-sub').textContent = mostrarPrecioLimpio(subtotal);
    box.querySelector('.cot-res-iva').textContent = mostrarPrecioLimpio(iva);
    box.querySelector('.cot-res-tot').textContent = mostrarPrecioLimpio(total);
  }
}

// === Fotos de COTIZACIÓN (Cloudinary, máx 5) ===
async function subirFotosCot(input) {
  if (!input.files || input.files.length === 0) return;
  const cupo = 5 - ((Array.isArray(fotosCotizacion) ? fotosCotizacion.length : 0));
  if (cupo <= 0) { showModal("Máximo 5 imágenes permitidas.", "warning"); input.value = ""; return; }

  const files = Array.from(input.files).slice(0, cupo);
  input.disabled = true;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;

    showSaved(`Subiendo imagen ${i+1} de ${files.length}...`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        if (fotosCotizacion.length < 5) fotosCotizacion.push(data.secure_url);
      } else {
        showModal("No se pudo subir la imagen a Cloudinary. Intenta nuevamente.", "error");
      }
    } catch (e) {
      showModal("Error al subir la imagen: " + (e.message || "Error desconocido"), "error");
    }
  }

  renderCotFotosPreview();
  input.disabled = false;
  input.value = "";

  try { guardarCotizacionDraft(); } catch(e) {}
}
function renderCotFotosPreview() {
  const cont = document.getElementById('cotFotosPreview');
  if (!cont) return;
  const fotos = fotosCotizacion || [];
  let html = '';
  for (let i = 0; i < fotos.length; i += 2) {
    html += `<div class="ems-rep-fotos-pair">`;
    for (let j = i; j < i + 2 && j < fotos.length; ++j) {
      html += `
        <div class="ems-rep-foto">
          <img src="${fotos[j]}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #dbe2ea;display:block;margin:auto;">
          <button type="button" class="ems-btn-delimg" title="Eliminar" onclick="eliminarFotoCot(${j})"><i class="fa fa-trash"></i></button>
        </div>
      `;
    }
    html += `</div>`;
  }
  html += `<div style="font-size:0.92em; color:#888;">${Math.max(0, 5 - fotos.length)} fotos disponibles</div>`;
  cont.innerHTML = html;
}
function eliminarFotoCot(index) {
  fotosCotizacion.splice(index, 1);
  renderCotFotosPreview();
  try { guardarCotizacionDraft(); } catch(e) {}
}

function nuevaCotizacion() {
  // Botón de volver al inicio arriba
  let volverBtn = `
    <button class="btn-secondary" onclick="renderInicio()" style="margin-bottom:14px;">
      <i class="fa fa-arrow-left"></i> Volver al inicio
    </button>
  `;
  document.getElementById('root').innerHTML = volverBtn + `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Nueva Cotización</span>
      </div>
      <button class="btn-mini" style="margin-left:auto" title="Ajustes" onclick="openSettings()">
        <i class="fa fa-gear"></i>
      </button>
    </div>
    <form id="cotForm" class="ems-form" autocomplete="off" oninput="recalcTotalesCotizacion()">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. Cotización</label>
          <input type="text" name="numero" required placeholder="Ej. COT-2024-001">
        </div>
        <div class="ems-form-group">
          <label>Fecha</label>
          <input type="date" name="fecha" required value="${hoy()}">
        </div>
      </div>
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>Cliente</label>
          <div class="ems-form-input-icon">
            <input type="text" name="cliente" list="clientesEMS" required placeholder="Nombre o Empresa" autocomplete="off" spellcheck="true" autocapitalize="words">
            <button type="button" class="mic-btn" title="Dictar por voz"><i class="fa fa-microphone"></i></button>
          </div>
          <datalist id="clientesEMS"></datalist>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora" value="${ahora()}">
        </div>
      </div>
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label><input type="checkbox" name="incluyeIVA"> Incluir IVA (16%)</label>
        </div>
        <div class="ems-form-group">
          <label><input type="checkbox" name="anticipo" onchange="this.form.anticipoPorc.parentElement.style.display=this.checked?'':'none'"> Con anticipo</label>
          <div style="display:none"><input type="number" name="anticipoPorc" min="0" max="100" placeholder="% Anticipo"> %</div>
        </div>
        <div class="ems-form-group">
          <label><input type="checkbox" name="corrigeIA"> Mejorar redacción con IA</label>
        </div>
      </div>
      <!-- SUPERTÍTULO GENERAL -->
      <div class="ems-form-group">
        <label>Supertítulo general del documento</label>
        <input type="text" name="titulo" placeholder="Ej: Motor de 5 HP, Rebobinado de alternador..." autocomplete="off" spellcheck="true" autocapitalize="sentences">
      </div>
      <!-- Secciones -->
      <div id="cotSeccionesWrap"></div>
      <button type="button" class="btn-secondary" onclick="agregarCotSeccion()"><i class="fa fa-list"></i> Agregar sección</button>

      <!-- Resumen Totales -->
      <div id="cotResumenTotales" class="cot-resumen">
        <div>Subtotal: <b class="cot-res-sub">$0.00</b></div>
        <div>IVA (16%): <b class="cot-res-iva">$0.00</b></div>
        <div>Total: <b class="cot-res-tot">$0.00</b></div>
      </div>
      <div class="ems-form-group">
        <label>Notas / Observaciones</label>
        <div class="ems-form-input-icon">
          <textarea name="notas" rows="3" placeholder="Detalles, condiciones..." spellcheck="true" autocapitalize="sentences"></textarea>
          <button type="button" class="mic-btn"><i class="fa fa-microphone"></i></button>
        </div>
      </div>
      <!-- Imágenes para PDF (hasta 5) -->
      <div class="ems-form-group">
        <label>Imágenes para el PDF (hasta 5)</label>
        <div id="cotFotosPreview" class="ems-rep-fotos-row"></div>
        <input id="cotFotosInput" type="file" accept="image/*" multiple onchange="subirFotosCot(this)">
        <small>Se suben a Cloudinary y se insertan al final del PDF.</small>
      </div>
      <div class="ems-form-actions">
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_COT_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="button" class="btn-secondary" onclick="undoCot()"><i class="fa fa-undo"></i> Deshacer</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="previsualizarPDFCotizacion()" title="Ver vista previa antes de generar el PDF final"><i class="fa fa-eye"></i> Vista Previa</button>
        <button type="button" class="btn-secondary" onclick="guardarCotizacionDraft(); generarPDFCotizacion()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarCotizacionDraft(); generarPDFCotizacion(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
    <div class="ems-credit">Programado por: Francisco López Velázquez.</div>
  `;

  const form = document.getElementById('cotForm');

  fotosCotizacion = [];

  // Draft
  let draft = localStorage.getItem('EMS_COT_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    Object.keys(draft).forEach(k => {
      if (k !== "items" && k !== "fotos" && k !== "secciones" && form[k] !== undefined) form[k].value = draft[k];
    });
    // Secciones nuevas o fallback a items
    const wrap = document.getElementById('cotSeccionesWrap');
    wrap.innerHTML = '';
    if (Array.isArray(draft.secciones) && draft.secciones.length) {
      draft.secciones.forEach(sec => agregarCotSeccion(sec));
    } else if (Array.isArray(draft.items) && draft.items.length) {
      const sec = { titulo: 'General', items: draft.items.map(it=>({ concepto: it.concepto, descripcion: '', precio: it.precio })) };
      agregarCotSeccion(sec);
    } else {
      agregarCotSeccion({ titulo: 'General', items: [{},{},] });
    }
    if (form.anticipo && form.anticipo.checked) {
      form.anticipoPorc.parentElement.style.display = '';
      form.anticipoPorc.value = draft.anticipoPorc || "";
    }
    if (Array.isArray(draft.fotos)) fotosCotizacion = [...draft.fotos];
    // Términos desde borrador o ajustes por defecto
    try {
      const s = getSettings();
      const def = !!(s.pdf && s.pdf.termsDefault);
      if (form.incluyeTerminos) {
        form.incluyeTerminos.checked = (draft.incluyeTerminos === 'on') || (draft.incluyeTerminos === true) || (draft.incluyeTerminos === 'true') || (draft.incluyeTerminos === 1) || (draft.incluyeTerminos === '1') || (draft.incluyeTerminos === undefined && def);
      }
    } catch (e) {}
  } else {
    // Inicial con una sección
    agregarCotSeccion({ titulo: 'General', items: [{},{}] });
    try {
      const s = getSettings();
      if (form.incluyeTerminos) form.incluyeTerminos.checked = !!(s.pdf && s.pdf.termsDefault);
    } catch (e) {}
  }

  renderCotFotosPreview();

  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
    try { pushUndoCotSnapshot(); } catch (e) {}
  }, 100);

  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarCotizacion(e);
    localStorage.removeItem('EMS_COT_BORRADOR');
  };

  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    try {
      if (document.getElementById('cotForm') && typeof guardarCotizacionDraft === 'function') {
        guardarCotizacionDraft();
      }
    } catch (e) {}
  }, 15000);

  setTimeout(() => {
    if(form && form.numero && form.numero.value && !document.getElementById('btnEliminarCot')){
      let btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-danger";
      btn.id = "btnEliminarCot";
      btn.style.float = "right";
      btn.innerHTML = '<i class="fa fa-trash"></i> Eliminar';
      btn.onclick = function(){ eliminarCotizacionCompleta(); };
      form.querySelector(".ems-form-actions").appendChild(btn);
    }
  }, 300);
}

// ========== Reporte (con imágenes Cloudinary) ==========
function renderRepItemRow(item = {}, rowId, modoEdicion = true) {
  const id = rowId || item._id || newUID();
  if (!fotosItemsReporteMap[id]) fotosItemsReporteMap[id] = Array.isArray(item.fotos) ? [...item.fotos] : [];
  const fotos = fotosItemsReporteMap[id] || [];

  // Agrupa fotos de 2 en 2 (solo para vista previa en la app)
  let fotosHtml = '';
  for (let i = 0; i < fotos.length; i += 2) {
    fotosHtml += `<div class="ems-rep-fotos-pair">`;
    for (let j = i; j < i + 2 && j < fotos.length; ++j) {
      fotosHtml += `
        <div class="ems-rep-foto">
          <img src="${fotos[j]}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #dbe2ea;display:block;margin:auto;">
          ${modoEdicion ? `<button type="button" class="ems-btn-delimg" title="Eliminar imagen" onclick="eliminarFotoRepItem(this, '${id}', ${j})"><i class="fa fa-trash"></i></button>` : ''}
        </div>
      `;
    }
    fotosHtml += `</div>`;
  }
  return `
    <tr data-rowid="${id}">
      <td>
        <textarea name="descripcion" list="descEMS" rows="2" required placeholder="Describe la actividad" style="width:97%" spellcheck="true" autocapitalize="sentences">${item.descripcion||""}</textarea>
        <datalist id="descEMS"></datalist>
      </td>
      <td>
        <div class="ems-rep-fotos-row" id="fotos-item-${id}">
          ${fotosHtml}
          ${modoEdicion && (fotos.length < 6) ? `
            <input type="file" accept="image/*" multiple
              style="display:block; margin-top:7px;"
              onchange="subirFotoRepItem(this, '${id}')">
            <div style="font-size:0.92em; color:#888;">${6 - fotos.length} fotos disponibles</div>
          ` : ""}
        </div>
      </td>
      <td>
        ${modoEdicion ? `<button type="button" class="ems-btn-delrow" onclick="eliminarRepItemRow(this)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    </tr>
  `;
}
function agregarRepItemRow() {
  const tbody = document.getElementById('repItemsTable').querySelector('tbody');
  const id = newUID();
  fotosItemsReporteMap[id] = [];
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow({_id:id}, id, true));
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
}
function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const id = tr.getAttribute('data-rowid');
  if (id && fotosItemsReporteMap[id]) delete fotosItemsReporteMap[id];
  tr.remove();
}
async function subirFotoRepItem(input, id) {
  if (!input.files || input.files.length === 0) return;
  const list = fotosItemsReporteMap[id] || (fotosItemsReporteMap[id] = []);
  const files = Array.from(input.files).slice(0, 6 - list.length);
  input.disabled = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    showSaved(`Subiendo imagen ${i+1} de ${files.length}...`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        if (list.length < 6) list.push(data.secure_url);
      } else {
        showModal("No se pudo subir la imagen a Cloudinary. Intenta nuevamente.", "error");
      }
    } catch (err) {
      showModal("Error al subir la imagen: " + (err.message || "Error desconocido"), "error");
    }
  }
  // Re-renderiza la fila
  const tr = document.querySelector(`#repItemsTable tbody tr[data-rowid="${id}"]`);
  const desc = (tr && tr.querySelector("textarea")) ? tr.querySelector("textarea").value : "";
  if (tr) tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporteMap[id], _id:id }, id, true);
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  showSaved("¡Imagen(es) subida(s)!");
  input.disabled = false;
  input.value = "";
}
function eliminarFotoRepItem(btn, id, fidx) {
  if (!fotosItemsReporteMap[id]) return;
  fotosItemsReporteMap[id].splice(fidx, 1);
  const tr = btn.closest('tr');
  const desc = (tr && tr.querySelector("textarea")) ? tr.querySelector("textarea").value : "";
  tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporteMap[id], _id:id }, id, true);
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
}

// ========== Reporte: Formulario y Flujos ==========
function nuevoReporte() {
  window.editandoReporte = false;
  fotosItemsReporteMap = {};

  let volverBtn = `
    <button class="btn-secondary" onclick="renderInicio()" style="margin-bottom:14px;">
      <i class="fa fa-arrow-left"></i> Volver al inicio
    </button>
  `;
  document.getElementById('root').innerHTML = volverBtn + `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Nuevo Reporte</span>
      </div>
      <button class="btn-mini" style="margin-left:auto" title="Ajustes" onclick="openSettings()">
        <i class="fa fa-gear"></i>
      </button>
    </div>
    <form id="repForm" class="ems-form" autocomplete="off">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. Reporte</label>
          <input type="text" name="numero" required placeholder="Ej. REP-2024-001">
        </div>
        <div class="ems-form-group">
          <label>Fecha</label>
          <input type="date" name="fecha" required value="${hoy()}">
        </div>
      </div>
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>Cliente</label>
          <div class="ems-form-input-icon">
            <input type="text" name="cliente" list="clientesEMS" required placeholder="Nombre o Empresa" autocomplete="off">
            <button type="button" class="mic-btn" title="Dictar por voz"><i class="fa fa-microphone"></i></button>
          </div>
          <datalist id="clientesEMS"></datalist>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora" value="${ahora()}">
        </div>
      </div>
      <!-- NUEVA SECCIÓN: CONCEPTO -->
      <div class="ems-form-group">
        <label>Concepto (ej. MOTOR 4HP)</label>
        <input type="text" name="concepto" list="conceptosEMS" placeholder="Equipo/Trabajo principal" autocomplete="off">
        <datalist id="conceptosEMS"></datalist>
      </div>
      <div>
        <table class="ems-items-table" id="repItemsTable">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Fotos (máx 6)</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="button" class="btn-secondary" onclick="agregarRepItemRow()">Agregar actividad/item</button>
      </div>
      <div class="ems-form-group">
        <label>Notas / Observaciones</label>
        <div class="ems-form-input-icon">
          <textarea name="notas" rows="3" placeholder="Observaciones del servicio..."></textarea>
          <button type="button" class="mic-btn"><i class="fa fa-microphone"></i></button>
        </div>
      </div>
      <div class="ems-form-actions">
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_REP_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="button" class="btn-secondary" onclick="undoRep()"><i class="fa fa-undo"></i> Deshacer</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="previsualizarPDFReporte()" title="Ver vista previa antes de generar el PDF final"><i class="fa fa-eye"></i> Vista Previa</button>
        <button type="button" class="btn-secondary" onclick="guardarReporteDraft(); generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarReporteDraft(); generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
    <div class="ems-credit">Programado por: Francisco López Velázquez.</div>
  `;
  const form = document.getElementById('repForm');
  // Inyecta checkbox de términos en Reporte si no existe
  try {
    const notasEl = form.querySelector('textarea[name="notas"]');
    const notas = notasEl ? notasEl.closest('.ems-form-group') : null;
    if (notas && !form.querySelector('input[name="incluyeTerminos"]')) {
      const g = document.createElement('div');
      g.className = 'ems-form-group';
      g.innerHTML = '<label><input type="checkbox" name="incluyeTerminos"> Incluir términos y condiciones</label>';
      notas.parentNode.insertBefore(g, notas);
    }
  } catch (e) {}
  let draft = localStorage.getItem('EMS_REP_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    Object.keys(draft).forEach(k => {
      if (k !== "items" && form[k] !== undefined) form[k].value = draft[k];
    });
    const tbody = form.querySelector("#repItemsTable tbody");
    tbody.innerHTML = "";
    fotosItemsReporteMap = {};
    (draft.items || []).forEach((item) => {
      const id = item._id || newUID();
      fotosItemsReporteMap[id] = Array.isArray(item.fotos) ? [...item.fotos] : [];
      tbody.insertAdjacentHTML("beforeend", renderRepItemRow({ ...item, _id:id }, id, true));
    });
    if ((draft.items || []).length === 0) agregarRepItemRow();
  } else {
    agregarRepItemRow();
  }
  // Default de términos desde ajustes si no hay borrador
  try {
    const s = getSettings();
    if (form.incluyeTerminos && (!draft || draft.incluyeTerminos === undefined)) form.incluyeTerminos.checked = !!(s.pdf && s.pdf.termsDefault);
    if (draft && form.incluyeTerminos) {
      form.incluyeTerminos.checked = (draft.incluyeTerminos === 'on') || (draft.incluyeTerminos === true) || (draft.incluyeTerminos === 'true') || (draft.incluyeTerminos === 1) || (draft.incluyeTerminos === '1');
    }
  } catch (e) {}
  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
    try { pushUndoRepSnapshot(); } catch (e) {}
  }, 100);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarReporte(e);
    localStorage.removeItem('EMS_REP_BORRADOR');
  };

  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('repForm')) guardarReporteDraft();
  }, 15000);

  setTimeout(() => {
    if(form && form.numero && form.numero.value && !document.getElementById('btnEliminarRep')){
      let btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-danger";
      btn.id = "btnEliminarRep";
      btn.style.float = "right";
      btn.innerHTML = '<i class="fa fa-trash"></i> Eliminar';
      btn.onclick = function(){ eliminarReporteCompleto(); };
      form.querySelector(".ems-form-actions").appendChild(btn);
    }
  }, 300);
}

// ========== GUARDADO, PDF, EDICIÓN, DETALLE ==========
async function enviarCotizacion(e) {
  if (e && e.preventDefault) e.preventDefault();
  showSaved('Guardando...');
  const form = document.getElementById('cotForm');
  if (!form) { showModal('No hay formulario de cotización activo.', 'error'); return; }
  const datos = Object.fromEntries(new FormData(form));
  const secciones = [];
  document.querySelectorAll('#cotSeccionesWrap .cot-seccion').forEach(sec => {
    const tituloEl = sec.querySelector('input[name="sec_titulo"]');
    const titulo = tituloEl ? tituloEl.value.trim() : '';
    const items = [];
    sec.querySelectorAll('tbody tr').forEach(tr => {
      const concepto = (tr.querySelector('input[name="concepto"]')||{}).value || '';
      const descripcion = (tr.querySelector('textarea[name="descripcion"]')||{}).value || '';
      const precio = Number((tr.querySelector('input[name="precioSec"]')||{}).value||0);
      if (concepto || descripcion || precio) items.push({ concepto, descripcion, precio });
    });
    if (titulo || items.length) secciones.push({ titulo, items });
  });
  if (!datos.numero || !datos.cliente || !secciones.length) {
    showSaved('Faltan datos');
    showModal('Por favor completa número, cliente y al menos una sección.', 'warning');
    return;
  }
  try { savePredictEMSCloud('cliente', datos.cliente); } catch (e) {}
  try { secciones.forEach(sec => (sec.items||[]).forEach(it => { savePredictEMSCloud('concepto', it.concepto); })); } catch (e) {}
  const subtotal = secciones.reduce((a,sec)=> a + (sec.items||[]).reduce((s,it)=> s + (Number(it.precio)||0),0), 0);
  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal*0.16 : 0;
  const total = subtotal + iva;
  const cotizacion = {
    ...datos,
    secciones,
    subtotal, iva, total,
    fotos: (Array.isArray(fotosCotizacion)?fotosCotizacion:[]).slice(0,5),
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  if (!navigator.onLine) {
    showModal('Sin conexión a Internet. Los datos se guardarán localmente. Intenta guardar cuando tengas conexión.', 'warning');
    showSaved('Offline');
    return;
  }
  await db.collection('cotizaciones').doc(datos.numero).set(cotizacion);
  try { localStorage.removeItem('EMS_COT_BORRADOR'); } catch (e) {}
  showSaved('¡Cotización guardada!');
  renderInicio();
}
try{ window.enviarCotizacion = enviarCotizacion; }catch(e){}

// ====== Eliminar docs ======
async function eliminarCotizacionCompleta(numero) {
  if (!numero) {
    const form = document.getElementById('cotForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return showModal("No se encontró el número de cotización.", "error");
  const confirmed = await showConfirm("¿Estás seguro que deseas eliminar esta cotización? Esta acción no se puede deshacer.", "Confirmar eliminación");
  if (!confirmed) return;
  try {
    await db.collection("cotizaciones").doc(numero).delete();
    showSaved("Cotización eliminada");
    localStorage.removeItem('EMS_COT_BORRADOR');
    renderInicio();
  } catch (e) {
    showModal("Error eliminando cotización: " + (e.message || e), "error");
  }
}
async function eliminarReporteCompleto(numero) {
  if (!numero) {
    const form = document.getElementById('repForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return showModal("No se encontró el número de reporte.", "error");
  const confirmed = await showConfirm("¿Estás seguro que deseas eliminar este reporte? Esta acción no se puede deshacer.", "Confirmar eliminación");
  if (!confirmed) return;
  try {
    await db.collection("reportes").doc(numero).delete();
    showSaved("Reporte eliminado");
    localStorage.removeItem('EMS_REP_BORRADOR');
    renderInicio();
  } catch (e) {
    showModal("Error eliminando reporte: " + (e.message || e), "error");
  }
}

// ======= Dictado por voz =======
function agregarDictadoMicros() {
  document.querySelectorAll(".mic-btn:not(.ems-mic-init)").forEach(btn => {
    btn.classList.add("ems-mic-init");
    btn.onclick = function() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition;
      if (!SpeechRecognition) { showModal("Tu navegador no soporta dictado por voz.", "warning"); return; }
      const recog = new SpeechRecognition();
      recog.lang = "es-MX";
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.onresult = (evt) => {
        const val = evt.results[0][0].transcript;
        const input = btn.parentElement.querySelector("input, textarea");
        if (input) {
          if (input.value) input.value += " " + val;
          else input.value = val;
          input.dispatchEvent(new Event("input"));
        }
      };
      recog.onerror = () => showToast("No se pudo reconocer el audio. Intenta nuevamente.", "error");
      recog.start();
    };
  });
}

// Observa la apertura del panel de ajustes y añade controles de términos + guardado simplificado
function observeSettingsPanel() { }
function confirmByTyping(seed = 'eliminar', title = 'Confirmar acción', onConfirm = ()=>{}) {
  const words = ['eliminar','borrar','confirmar','continuar','aprobar','aceptar'];
  const w = words[Math.floor(Math.random()*words.length)];
  const overlay = document.createElement('div');
  overlay.className = 'ems-confirm-overlay';
  overlay.innerHTML = `
    <div class="ems-confirm-box">
      <h3>${title}</h3>
      <p>Escribe <b>${w}</b> para confirmar. Esta acción no se puede deshacer.</p>
      <input type="text" id="emsConfirmInput" placeholder="Escribe la palabra aquí" style="width:100%;padding:10px;border:1px solid #d2dbe7;border-radius:8px;">
      <div class="ems-confirm-actions">
        <button class="btn-mini" id="emsConfirmCancel">Cancelar</button>
        <button class="btn-danger" id="emsConfirmOk"><i class="fa fa-trash"></i> Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=>{ try { document.body.removeChild(overlay); } catch (e) {} };
  overlay.querySelector('#emsConfirmCancel').onclick = close;
  overlay.querySelector('#emsConfirmOk').onclick = ()=>{
    const val = overlay.querySelector('#emsConfirmInput').value.trim().toLowerCase();
    if (val === w) { try { onConfirm(); } finally { close(); } }
    else { showToast('Palabra incorrecta. Intenta nuevamente.', 'error'); }
  };
}

// Re-definir eliminaciones puntuales para requerir confirmación por palabra
const __orig_eliminarCotItemRow = typeof eliminarCotItemRow === 'function' ? eliminarCotItemRow : null;
function eliminarCotItemRow(btn){
  confirmByTyping('eliminar','Eliminar este elemento de cotización',()=>{
    try{ const tr = btn.closest('tr'); if (tr) tr.remove(); if (typeof recalcTotalesCotizacion==='function') recalcTotalesCotizacion(); }catch(e){}
  });
}

const __orig_eliminarRepItemRow = typeof eliminarRepItemRow === 'function' ? eliminarRepItemRow : null;
function eliminarRepItemRow(btn){
  confirmByTyping('eliminar','Eliminar esta actividad del reporte',()=>{
    try{
      const tr = btn.closest('tr');
      const id = tr ? tr.getAttribute('data-rowid') : null;
      if (id && fotosItemsReporteMap[id]) delete fotosItemsReporteMap[id];
      if (tr) tr.remove();
    }catch(e){}
  });
}

const __orig_eliminarFotoRepItem = typeof eliminarFotoRepItem === 'function' ? eliminarFotoRepItem : null;
function eliminarFotoRepItem(btn, id, fidx){
  confirmByTyping('borrar','Eliminar esta imagen del item',()=>{
    try{
      if (!fotosItemsReporteMap[id]) return;
      fotosItemsReporteMap[id].splice(fidx,1);
      const tr = btn.closest('tr');
      const desc = (tr && tr.querySelector('textarea')) ? tr.querySelector('textarea').value : '';
      tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporteMap[id], _id:id }, id, true);
      agregarDictadoMicros(); activarPredictivosInstantaneos();
    }catch{}
  });
}

const __orig_eliminarFotoCot = typeof eliminarFotoCot === 'function' ? eliminarFotoCot : null;
function eliminarFotoCot(index){
  confirmByTyping('borrar','Eliminar esta imagen de la cotización',()=>{
    try{ fotosCotizacion.splice(index,1); renderCotFotosPreview(); if (typeof guardarCotizacionDraft==='function') guardarCotizacionDraft(); }catch(e){}
  });
}

const __orig_eliminarCotizacionCompleta = typeof eliminarCotizacionCompleta === 'function' ? eliminarCotizacionCompleta : null;
async function eliminarCotizacionCompleta(numero){
  if (!numero){ const form = document.getElementById('cotForm'); if (form && form.numero && form.numero.value) numero=form.numero.value; }
  if (!numero) return showModal('No se encontró el número de cotización.', 'error');
  confirmByTyping('eliminar','Para confirmar escribe la palabra indicada', async ()=>{
    try{ await db.collection('cotizaciones').doc(numero).delete(); showSaved('Cotización eliminada'); localStorage.removeItem('EMS_COT_BORRADOR'); renderInicio(); }
    catch(e){ showModal('Error eliminando cotización: '+((e && e.message)||e), 'error'); }
  });
}

const __orig_eliminarReporteCompleto = typeof eliminarReporteCompleto === 'function' ? eliminarReporteCompleto : null;
async function eliminarReporteCompleto(numero){
  if (!numero){ const form = document.getElementById('repForm'); if (form && form.numero && form.numero.value) numero=form.numero.value; }
  if (!numero) return showModal('No se encontró el número de reporte.', 'error');
  confirmByTyping('eliminar','Para confirmar escribe la palabra indicada', async ()=>{
    try{ await db.collection('reportes').doc(numero).delete(); showSaved('Reporte eliminado'); localStorage.removeItem('EMS_REP_BORRADOR'); renderInicio(); }
    catch(e){ showModal('Error eliminando reporte: '+((e && e.message)||e), 'error'); }
  });
}
// ===== Panel de Ajustes (tema/pdf) =====
function openSettings() {
  const s = getSettings();
  const themeHex = s.themeColor || '#F88A1D';
  const pdf = s.pdf || {};
  const overlay = document.createElement('div');
  overlay.className = 'ems-settings-overlay';
  overlay.innerHTML = `
    <div class="ems-settings-modal">
      <div class="ems-settings-head">
        <h3 style="margin:0">Ajustes de Apariencia y PDF</h3>
        <button class="btn-mini" onclick="this.closest('.ems-settings-overlay').remove()"><i class='fa fa-times'></i></button>
      </div>
      <div class="ems-settings-body">
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Color principal (PDF)</label><input type="color" id="setThemeColor" value="${themeHex}"></div>
          <div class="ems-form-group"><label>Mostrar crédito</label><select id="setShowCredit"><option value="1" ${s.showCredit!==false?'selected':''}>Sí</option><option value="0" ${s.showCredit===false?'selected':''}>No</option></select></div>
        </div>
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Galería base (px)</label><input type="number" id="setGalBase" min="120" max="300" value="${pdf.galleryBase||200}"></div>
          <div class="ems-form-group"><label>Galería min (px)</label><input type="number" id="setGalMin" min="120" max="260" value="${pdf.galleryMin||160}"></div>
          <div class="ems-form-group"><label>Galería max (px)</label><input type="number" id="setGalMax" min="160" max="300" value="${pdf.galleryMax||235}"></div>
        </div>
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Espaciado título</label><input type="number" id="setTitleGap" min="4" max="20" value="${pdf.titleGap||8}"></div>
          <div class="ems-form-group"><label>Espaciado tarjeta</label><input type="number" id="setCardGap" min="4" max="20" value="${pdf.cardGap||8}"></div>
          <div class="ems-form-group"><label>Espaciado bloques</label><input type="number" id="setBlockGap" min="4" max="20" value="${pdf.blockGap||6}"></div>
        </div>
      </div>
      <div class="ems-form-actions">
        <button class="btn-mini" onclick="this.closest('.ems-settings-overlay').remove()">Cancelar</button>
        <button class="btn-primary" id="btnSaveSettings">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btnSaveSettings').onclick = () => {
    const next = {
      themeColor: overlay.querySelector('#setThemeColor').value,
      showCredit: overlay.querySelector('#setShowCredit').value === '1',
      pdf: {
        galleryBase: Number(overlay.querySelector('#setGalBase').value)||200,
        galleryMin: Number(overlay.querySelector('#setGalMin').value)||160,
        galleryMax: Number(overlay.querySelector('#setGalMax').value)||235,
        titleGap: Number(overlay.querySelector('#setTitleGap').value)||8,
        cardGap: Number(overlay.querySelector('#setCardGap').value)||8,
        blockGap: Number(overlay.querySelector('#setBlockGap').value)||6,
      }
    };
    saveSettings(next);
    showSaved('Ajustes guardados');
    try { applyThemeFromSettings(); } catch (e) {}
    overlay.remove();
  };
}

// ====== Undo/Redo (Deshacer básico) ======
function serializeCotizacionForm() {
  const form = document.getElementById('cotForm');
  if (!form) return null;
  const datos = Object.fromEntries(new FormData(form));
  const secciones = [];
  document.querySelectorAll('#cotSeccionesWrap .cot-seccion').forEach(sec => {
    const titulo = sec.querySelector('input[name="sec_titulo"]').value.trim();
    const items = [];
    sec.querySelectorAll('tbody tr').forEach(tr=>{
      const concepto = tr.querySelector('input[name="concepto"]').value;
      const descripcion = tr.querySelector('textarea[name="descripcion"]').value;
      const precio = Number(tr.querySelector('input[name="precioSec"]').value||0);
      if (concepto || descripcion || precio) items.push({ concepto, descripcion, precio });
    });
    if (titulo || items.length) secciones.push({ titulo, items });
  });
  return { ...datos, secciones, fotos: (fotosCotizacion||[]).slice(0) };
}
function applyCotSnapshot(snap) {
  if (!snap) return;
  editarCotizacion({ ...snap, tipo: 'cotizacion' });
}
function pushUndoCotSnapshot() {
  const snap = serializeCotizacionForm();
  if (!snap) return;
  window.__EMS_UNDO_COT = window.__EMS_UNDO_COT || [];
  window.__EMS_UNDO_COT.push(snap);
  if (window.__EMS_UNDO_COT.length > 20) window.__EMS_UNDO_COT.shift();
}
function undoCot() {
  const stack = window.__EMS_UNDO_COT || [];
  if (stack.length < 2) { showSaved('Nada que deshacer'); return; }
  stack.pop();
  const prev = stack[stack.length-1];
  applyCotSnapshot(prev);
  showSaved('Deshecho');
}

function serializeReporteForm() {
  const form = document.getElementById('repForm');
  if (!form) return null;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    const id = tr.getAttribute('data-rowid') || newUID();
    items.push({ _id: id, descripcion: tr.querySelector('textarea[name="descripcion"]').value, fotos: (fotosItemsReporteMap[id]||[]).slice(0) });
  });
  return { ...datos, items };
}
function applyRepSnapshot(snap) {
  if (!snap) return;
  nuevoReporte();
  const form = document.getElementById('repForm');
  form.numero.value = snap.numero||'';
  form.fecha.value = snap.fecha||'';
  form.cliente.value = snap.cliente||'';
  form.hora.value = snap.hora||'';
  form.concepto.value = snap.concepto||'';
  const tbody = form.querySelector('#repItemsTable tbody');
  tbody.innerHTML='';
  fotosItemsReporteMap = {};
  (snap.items||[]).forEach((item)=>{
    const id = item._id || newUID();
    fotosItemsReporteMap[id] = Array.isArray(item.fotos)? [...item.fotos]:[];
    tbody.insertAdjacentHTML('beforeend', renderRepItemRow({ ...item, _id:id }, id, true));
  });
  form.notas.value = snap.notas||'';
  setTimeout(()=>{ actualizarPredictsEMSCloud(); agregarDictadoMicros(); activarPredictivosInstantaneos(); }, 100);
}
function pushUndoRepSnapshot() {
  const snap = serializeReporteForm();
  if (!snap) return;
  window.__EMS_UNDO_REP = window.__EMS_UNDO_REP || [];
  window.__EMS_UNDO_REP.push(snap);
  if (window.__EMS_UNDO_REP.length > 20) window.__EMS_UNDO_REP.shift();
}
function undoRep() {
  const stack = window.__EMS_UNDO_REP || [];
  if (stack.length < 2) { showSaved('Nada que deshacer'); return; }
  stack.pop();
  const prev = stack[stack.length-1];
  applyRepSnapshot(prev);
  showSaved('Deshecho');
}

function installUndoHandlers() {
  // Ctrl+Z global
  window.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (document.getElementById('cotForm')) { e.preventDefault(); return undoCot(); }
      if (document.getElementById('repForm')) { e.preventDefault(); return undoRep(); }
    }
  });
  // Snapshots on input changes (debounced)
  let t;
  document.addEventListener('input', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      if (document.getElementById('cotForm')) pushUndoCotSnapshot();
      if (document.getElementById('repForm')) pushUndoRepSnapshot();
    }, 400);
  }, true);
}

// === Sidebar de opciones (sustituye checkboxes inline) ===
function openSideOptions(type){
  const form = document.getElementById(type==='cot'?'cotForm':'repForm');
  if (!form) return;
  let ov = document.getElementById('ems-side-overlay');
  if (!ov){
    ov = document.createElement('div'); ov.id='ems-side-overlay'; ov.className='ems-side-overlay';
    ov.innerHTML = '<div id="ems-sidebar" class="ems-sidebar"><div class="ems-sidebar-header"><div class="ems-sidebar-title">Opciones</div><button class="btn-mini" id="emsSideClose">×</button></div><div class="ems-sidebar-body"></div><div class="ems-side-actions"><button class="btn-mini" id="emsSideCancel">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', (e)=>{ if(e.target===ov) closeSideOptions(); });
    ov.querySelector('#emsSideClose').onclick = closeSideOptions;
    ov.querySelector('#emsSideCancel').onclick = closeSideOptions;
  }
  const body = ov.querySelector('.ems-sidebar-body');
  body.innerHTML='';
  function addSwitch(labelText, el){
    const row = document.createElement('div'); row.className='ems-switch';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent = labelText;
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!(el && el.checked);
    cb.addEventListener('change', ()=>{ if(el){ el.checked = cb.checked; el.dispatchEvent(new Event('input',{bubbles:true})); if(el.name==='incluyeIVA'){ try{ recalcTotalesCotizacion(); }catch(e){} } if(el.name==='anticipo'){ try{ el.form.anticipoPorc.parentElement.style.display=cb.checked?'':'' }catch(e){} } } });
    row.appendChild(lab); row.appendChild(cb); body.appendChild(row);
  }
  const iva = form.querySelector('input[name="incluyeIVA"]'); if (iva) addSwitch('Incluir IVA (16%)', iva);
  const antic = form.querySelector('input[name="anticipo"]'); if (antic) addSwitch('Con anticipo', antic);
  const terms = form.querySelector('input[name="incluyeTerminos"]'); if (terms) addSwitch('Incluir términos y condiciones', terms);
  const ai = form.querySelector('input[name="corrigeIA"]'); if (ai) addSwitch('Mejorar redacción con IA', ai);
  if (antic && form.anticipoPorc){
    const row = document.createElement('div'); row.className='ems-switch';
    const lab = document.createElement('div'); lab.className='label'; lab.textContent = '% Anticipo';
    const inp = document.createElement('input'); inp.type='number'; inp.min='0'; inp.max='100'; inp.value = form.anticipoPorc.value||''; inp.style.width='90px';
    inp.addEventListener('input', ()=>{ form.anticipoPorc.value = inp.value; });
    row.appendChild(lab); row.appendChild(inp); body.appendChild(row);
  }
  ov.classList.add('open'); ov.querySelector('#ems-sidebar').classList.add('open');
}
function closeSideOptions(){ const ov=document.getElementById('ems-side-overlay'); if(!ov) return; ov.classList.remove('open'); const sb=ov.querySelector('#ems-sidebar'); if(sb) sb.classList.remove('open'); }

function ensureSideOptionButtons(){
  ['cotForm','repForm'].forEach(function(fid){
    const f = document.getElementById(fid); if(!f) return;
    const act = f.querySelector('.ems-form-actions');
    if (act && !document.getElementById('btnOpts_'+fid)){
      const b = document.createElement('button'); b.type='button'; b.className='btn-secondary'; b.id='btnOpts_'+fid; b.innerHTML='<i class="fa fa-sliders"></i> Opciones';
      b.onclick = function(){ openSideOptions(fid==='cotForm'?'cot':'rep'); };
      act.insertBefore(b, act.firstChild);
    }
    const iva = f.querySelector('input[name="incluyeIVA"]'); if (iva){ const row = iva.closest('.ems-form-row'); if(row) row.style.display='none'; }
  });
}

// Activar inserción de botones en cargas y DOM dinámico
(function(){ try{ ensureSideOptionButtons(); }catch(e){}
  try{
    const mo = new MutationObserver(()=>{ try{ ensureSideOptionButtons(); }catch(e){} });
    mo.observe(document.body, { childList:true, subtree:true });
  }catch(e){}
})();

try{ window.guardarCotizacionDraft = guardarCotizacionDraft; }catch(e){}
try{ window.generarPDFCotizacion = generarPDFCotizacion; }catch(e){}
try{ window.previsualizarPDFCotizacion = previsualizarPDFCotizacion; }catch(e){}
try{ window.previsualizarPDFReporte = previsualizarPDFReporte; }catch(e){}
