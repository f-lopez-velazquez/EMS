// === INICIALIZACI?N Y UTILIDADES ===
const EMS_CONTACT = {
  empresa: "ELECTROMOTORES SANTANA",
  direccion: "Carr. a Chichimequillas 306, Colonia Menchaca 2, 76147 Santiago de Quer\u00E9taro, Qro.",
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
  } catch { return {}; }
}
function saveSettings(conf) {
  try { localStorage.setItem('EMS_SETTINGS', JSON.stringify(conf||{})); } catch {}
}

// Decodifica secuencias unicode con barra invertida (soporta "\\uXXXX" y "\uXXXX")
function decodeU(str) {
  if (!str || typeof str !== 'string') return str;
  const single = str.replace(/\\u/g, '\\u');
  return single.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// Normaliza placeholders/textos con escapes unicode en el DOM recién insertado
function normalizeEscapedTexts(root) {
  try {
    const scope = root || document;
    // placeholders
    scope.querySelectorAll('[placeholder]').forEach(el => {
      const ph = el.getAttribute('placeholder');
      if (ph && /\\u[0-9a-fA-F]{4}/.test(ph)) el.setAttribute('placeholder', decodeU(ph));
    });
    // textos simples en celdas/labels/spans
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const toFix = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/\\u[0-9a-fA-F]{4}/.test(node.nodeValue)) toFix.push(node);
    }
    toFix.forEach(n => n.nodeValue = decodeU(n.nodeValue));
  } catch {}
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
  const hex = s?.themeColor;
  if (hex) return hexToRgbArray(hex);
  return EMS_COLOR;
}

// Aplicar tema (CSS vars y meta theme-color)
function setCssVar(name, value) {
  try { document.documentElement.style.setProperty(name, value); } catch {}
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

// === Cloudinary usado en reportes/COTIZACI\u00D3N ===
const CLOUDINARY_CLOUD = "ds9b1mczi";
const CLOUDINARY_PRESET = "ml_default";

// Usa ?cono local para coherencia con GH Pages e ?cono de pesta?a
const LOGO_URL = "./icons/icon-192.png";

// Estado de secciones para COTIZACI\u00D3N (en DOM, pero guardamos helpers)
let cotSeccionesTemp = [];

// ?? IMPORTANTE: fotos por ?TEM con ID estable (no por ?ndice)
let fotosItemsReporteMap = {}; // { [rowId]: string[] }
let fotosCotizacion = []; // Hasta 5 fotos por COTIZACI\u00D3N
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
function showProgress(visible = true, percent = 0, msg = '') {
  let bar = document.getElementById('progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'progress-bar';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'center';
    bar.style.position = 'fixed';
    bar.style.left = '0';
    bar.style.top = '0';
    bar.style.width = '100vw';
    bar.style.height = '5px';
    bar.style.background = '#26B77A';
    bar.style.zIndex = '1200';
    bar.innerHTML = '';
    document.body.appendChild(bar);
  }
  let inner = bar.querySelector('.progress-inner');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'progress-inner';
    inner.style.height = '100%';
    inner.style.width = percent + '%';
    inner.innerText = msg;
    bar.appendChild(inner);
  }
  bar.style.display = visible ? 'flex' : 'none';
  inner.style.width = percent + '%';
  inner.innerText = msg || (visible ? '' : '');

  // Busy mask to block interactions
  var mask = document.getElementById('ems-busy-mask');
  if (!mask) {
    mask = document.createElement('div');
    mask.id = 'ems-busy-mask';
    mask.className = 'ems-busy-mask';
    mask.innerHTML = '<div class=\'spinner\'>Cargando?</div>';
    document.body.appendChild(mask);
  }
  // Garantizar overlay limpio y din?mico con puntos y texto
  try {
    var _box = mask.querySelector('.ems-busy-box');
    if (!_box) {
      mask.innerHTML = "<div class='ems-busy-box'><div class='ems-dots'><span class='ems-dot'></span><span class='ems-dot'></span><span class='ems-dot'></span></div><span class='ems-busy-text' role='status' aria-live='polite'></span></div>";
      _box = mask.querySelector('.ems-busy-box');
    }
    var _txt = mask.querySelector('.ems-busy-text');
    if (_txt) _txt.textContent = msg || 'Cargando?';
  } catch (e) {}
  if (visible) { mask.classList.add('show'); } else { mask.classList.remove('show'); }
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
 * @param {string} title - t\u00EDtulo del modal (opcional)
 */
function showModal(message, type = 'info', title = '') {
  return new Promise((resolve) => {
    // Remover modal existente si hay
    const existing = document.querySelector('.ems-modal-overlay');
    if (existing) existing.remove();

    // ?conos por tipo
    const icons = {
      info: '??',
      success: '?',
      warning: '??',
      error: '?'
    };

    // t\u00EDtulos por defecto
    const titles = {
      info: 'Informaci?n',
      success: '?xito',
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
 * Muestra un modal de confirmaci?n (reemplaza confirm)
 * @param {string} message - Mensaje a mostrar
 * @param {string} title - t\u00EDtulo del modal
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
          <div class="ems-modal-icon warning">??</div>
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
 * Muestra una notificaci?n toast (no bloqueante)
 * @param {string} message - Mensaje
 * @param {string} type - 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duraci?n en ms (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `ems-toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icons = {
    success: '?',
    error: '?',
    info: '??',
    warning: '??'
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
      statusText.textContent = '? Conexi?n restaurada';
      setTimeout(() => statusBar.classList.remove('show'), 2000);
    } else {
      statusBar.classList.remove('online');
      statusBar.classList.add('show');
      statusText.textContent = '?? Sin conexi?n a Internet';
    }
  };

  window.addEventListener('online', () => {
    updateStatus();
    showToast('Conexi?n a Internet restaurada', 'success');
  });

  window.addEventListener('offline', () => {
    updateStatus();
    showToast('Sin conexi?n a Internet', 'error', 5000);
  });

  // Check initial status
  updateStatus();
}

/**
 * Valida un input y muestra estado visual
 * @param {HTMLElement} input - El input a validar
 * @param {boolean} isValid - Si es v?lido
 * @param {string} errorMsg - Mensaje de error (opcional)
 */
function validateInput(input, isValid, errorMsg = '') {
  if (!input) return;

  // Remover estado previo
  input.classList.remove('error', 'success');
  const prevError = input.parentElement?.querySelector('.error-message');
  if (prevError) prevError.remove();

  if (isValid) {
    input.classList.add('success');
    setTimeout(() => input.classList.remove('success'), 2000);
  } else {
    input.classList.add('error');
    if (errorMsg) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `<span>?</span> ${errorMsg}`;
      errorDiv.setAttribute('role', 'alert');
      input.parentElement?.appendChild(errorDiv);
    }
  }
}

// Inicializar cuando el DOM est\u00E1 listo
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
 * @param {string} title - t\u00EDtulo del documento
 * @param {Function} onRefresh - Funci?n a llamar al refrescar
 */
function mostrarVisorPDF(pdfBytes, title, onRefresh) {
  // Cerrar visor existente si hay
  if (currentPDFPreviewOverlay) {
    currentPDFPreviewOverlay.remove();
  }

  // Crear blob y URL del PDF con par?metro #view=FitH para forzar vista inline
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob) + '#view=FitH&toolbar=1&navpanes=0';

  // Crear overlay
  const overlay = document.createElement('div');
  overlay.className = 'ems-pdf-preview-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Vista previa del PDF');

  // Usar object en lugar de iframe para mejor soporte en m?viles
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

  // Bot?n cerrar
  const closeBtn = overlay.querySelector('#pdf-preview-close');
  closeBtn.addEventListener('click', () => {
    URL.revokeObjectURL(url);
    overlay.remove();
    currentPDFPreviewOverlay = null;
  });

  // Bot?n refrescar
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
 * Genera y muestra vista previa de COTIZACI\u00D3N
 * Usa menor calidad de imagen para velocidad
 */
async function previsualizarPDFCotizacion() {
  try {
    // Mostrar indicador de carga
    showProgress(true, 20, "Generando vista previa r\u00E1pida...");

    const pdfBytes = await generarPDFCotizacion(false, true); // false = no compartir, true = preview

    showProgress(false);

    if (pdfBytes) {
      mostrarVisorPDF(pdfBytes, 'COTIZACI\u00D3N - Vista Previa', previsualizarPDFCotizacion);
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
    showProgress(true, 20, "Generando vista previa r\u00E1pida...");

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

// --- Envoltura de texto por palabras (m?s est\u00E1tica que por caracteres)
function wrapTextLines(text = "", font, fontSize, maxWidth) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
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

// ====== Compresi?n de im?genes para PDFs ======
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

// --------- Renderizaci?n de interfaz ---------
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
      <button onclick="nuevaCotizacion()" class="btn-primary"><i class="fa fa-file-invoice"></i> Nueva COTIZACI\u00D3N</button>
      <button onclick="nuevoReporte()" class="btn-secondary"><i class="fa fa-clipboard-list"></i> Nuevo Reporte</button>
    </div>
    <div class="ems-historial">
      <div class="ems-historial-header">
        <h2><i class="fa fa-clock"></i> Recientes</h2>
        <input type="text" id="buscarEMS" placeholder="Buscar por cliente, n\u00FAmero o fecha...">
      </div>
      <div id="historialEMS" class="ems-historial-list"></div>
    </div>
    <div class="ems-credit">Programado por: Francisco L\u00F3pez Vel\u00E1zquez.</div>
  `;
  cargarHistorialEMS();
}

window.onload = () => {
  renderInicio();
  // Modo app-like: bloquear atr?s y men?s contextuales globales
  try {
    if (!history.state || !history.state.ems) history.replaceState({ems:'root'}, '');
    window.addEventListener('popstate', function(e){ e.preventDefault(); history.pushState({ems:'root'}, ''); });
    document.addEventListener('contextmenu', function(e){
      const tag = (e.target && e.target.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
    }, true);
  } catch (e) {}
  try { applyThemeFromSettings(); } catch {}
  try { typeof showOffline === "function" && showOffline(true); } catch {}
  try { normalizeEscapedTexts(document); } catch {}

// Delegación global de Acciónes para evitar inline handlers (CSP-friendly)
//function // Delegación global de acciones para evitar inline handlers (CSP-friendly)
function initActionDelegates() {
  document.addEventListener('click', async (ev) => {
    const btn = ev.target && ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    try {
      switch (act) {
        case 'add-section': ev.preventDefault(); agregarCotSeccion(); break;
        case 'add-section-det': ev.preventDefault(); agregarCotSeccionDet(); break;
        case 'add-row': ev.preventDefault(); agregarRubroEnSeccion(btn); break;
        case 'remove-row': ev.preventDefault(); const tr=btn.closest('tr'); const sec=btn.closest('.cot-seccion'); if(tr) tr.remove(); try{recalcSeccionSubtotal(sec);}catch{} break;
        case 'remove-section': ev.preventDefault(); eliminarCotSeccion(btn); break;
        case 'cot-cancel': ev.preventDefault(); try{ localStorage.removeItem('EMS_COT_BORRADOR'); }catch{} renderInicio(); break;
        case 'cot-undo': ev.preventDefault(); undoCot(); break;
        case 'cot-preview': ev.preventDefault(); previsualizarPDFCotizacion(); break;
        case 'cot-pdf': ev.preventDefault(); try{ await guardarCotizacionDraft(); }catch{} generarPDFCotizacion(); break;
        case 'cot-share': ev.preventDefault(); try{ await guardarCotizacionDraft(); }catch{} generarPDFCotizacion(true); break;
        case 'del-photo-cot': ev.preventDefault(); const idx = Number(btn.getAttribute('data-idx')); if(!Number.isNaN(idx)) eliminarFotoCot(idx); break;
        default: break;
      }
    } catch(e){ console.warn('Acción fallida', act, e); }
  });
}
  try { initActionDelegates(); } catch {}
  try { installUndoHandlers(); } catch {}
  try { schedulePendingNotifications(); } catch {}
};

let ASYNC_ERR_GUARD = false;

// ===== Notificaciones espor?dicas de pendientes =====
function schedulePendingNotifications() {
  const MIN_MINUTES = 15; // m?nimo cada 15 min
  const JITTER_MIN  = 10; // ?10 min aleatorio
  const keyLast = 'EMS_LAST_PENDING_NOTIFY';
  const keyCounts = 'EMS_LAST_PENDING_COUNTS';

  async function notify(msg) {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          try { await Notification.requestPermission(); } catch {}
        }
        if (Notification.permission === 'granted') {
          new Notification('EMS', { body: msg });
          return;
        }
      }
    } catch {}
    try { showToast(msg, 'info', 5000); } catch {}
  }

  async function checkNow() {
    try {
      const last = Number(localStorage.getItem(keyLast) || '0');
      const now = Date.now();
      if (now - last < MIN_MINUTES * 60000) return; // demasiado pronto

      // Consultas: estado='pendiente' o pendiente=true (dos consultas simples)
      let cotPend = 0, repPend = 0;
      try {
        const q1 = await db.collection('cotizaciones').where('estado','==','pendiente').limit(20).get();
        cotPend += q1.size;
      } catch {}
      try {
        const q2 = await db.collection('cotizaciones').where('pendiente','==',true).limit(20).get();
        cotPend = Math.max(cotPend, q2.size);
      } catch {}
      try {
        const q3 = await db.collection('reportes').where('estado','==','pendiente').limit(20).get();
        repPend += q3.size;
      } catch {}
      try {
        const q4 = await db.collection('reportes').where('pendiente','==',true).limit(20).get();
        repPend = Math.max(repPend, q4.size);
      } catch {}

      const prev = JSON.parse(localStorage.getItem(keyCounts) || '{"cot":0,"rep":0}');
      // Notificar solo si hay al menos 1 y cambi? vs ?ltima vez
      if (cotPend > 0 && cotPend !== Number(prev.cot||0)) {
        await notify(`Tienes ${cotPend} COTIZACI\u00D3N(es) pendiente(s).`);
      }
      if (repPend > 0 && repPend !== Number(prev.rep||0)) {
        await notify(`Tienes ${repPend} reporte(s) pendiente(s).`);
      }
      localStorage.setItem(keyCounts, JSON.stringify({ cot: cotPend, rep: repPend }));
      localStorage.setItem(keyLast, String(now));
    } catch {}
  }

  // primera comprobaci?n diferida
  setTimeout(checkNow, 5000);

  // programar siguientes con jitter
  (function loop() {
    const jitter = (Math.random() * (JITTER_MIN * 2) - JITTER_MIN) * 60000; // ?JITTER
    const delay = MIN_MINUTES * 60000 + Math.max(-JITTER_MIN*60000, Math.min(jitter, JITTER_MIN*60000));
    setTimeout(async () => { await checkNow(); loop(); }, delay);
  })();
}

// ==== Historial ====
async function cargarHistorialEMS(filtro = "") {
  const cont = document.getElementById("historialEMS");
  if (!cont) return;
  cont.innerHTML = "<div class='ems-historial-cargando'>Cargando...</div>";
  let cotSnap = [], repSnap = [];
  try {
    cotSnap = await db.collection("cotizaciones").orderBy("creada", "desc").limit(20).get();
    repSnap = await db.collection("reportes").orderBy("creada", "desc").limit(20).get();
  } catch {
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
        <div class="ems-card-tipo">${x.tipo === "cotizacion" ? "COTIZACI\u00D3N" : "Reporte"}</div>
        <div class="ems-card-cliente"><b>${x.cliente || ""}</b></div>
        <div class="ems-card-fecha">${x.fecha || ""} ${x.hora ? "? " + x.hora : ""}</div>
        <div class="ems-card-numero">#${x.numero || ""}</div>
      </div>
      <div class="ems-card-ir"><i class="fa fa-chevron-right"></i></div>
    </div>
  `).join("");
}
document.addEventListener("input", e => {
  if (e.target && e.target.id === "buscarEMS") {
    cargarHistorialEMS(e.target.value);
  }
});

// ========== COTIZACI\u00D3N ==========
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

function toggleCotMode(flag) {
  try {
    const s = getSettings();
    s.cotDetallado = !!flag;
    saveSettings(s);
    // Re-render conservando datos actuales
    const snap = serializeCotizacionForm();
    editarCotizacion({ ...snap, tipo: 'cotizacion' });
    showSaved(flag? 'Modo detallado activo' : 'Modo normal activo');
  } catch (e) { console.warn('toggleCotMode', e); }
}

// ========== NUEVO: Secciones de COTIZACI\u00D3N ==========
function renderCotSeccion(seccion = {}, rowId) {
  const id = rowId || newUID();
  const items = Array.isArray(seccion.items) ? seccion.items : [];
  const isDet = (getSettings()?.cotDetallado === true) || items.some(x=> x && (x.cantidad!==undefined || x.unidad!==undefined || x.precioUnit!==undefined));
  const itemsHtml = items.map(it => `
      <tr>
        <td><input type="text" name="concepto" value="${safe(it.concepto)}" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences"></td>
        <td><textarea name="descripcion" rows="2" placeholder="Detalle del concepto..." spellcheck="true" autocapitalize="sentences">${safe(it.descripcion)}</textarea></td>
        <td style="white-space:nowrap;display:flex;align-items:center;">
          <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
          <input type="number" name="precioSec" min="0" step="0.01" value="${safe(it.precio)}" style="width:100px;">
          <button type="button" class="btn-mini" data-action="remove-row"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
  `).join('');
  return `
    <div class="cot-seccion" data-secid="${id}">
      <div class="cot-seccion-head">
        <input type="text" class="cot-sec-title" name="sec_titulo" placeholder="T\\u00EDtulo de secci\\u00F3n (ej. Refacciones, Mano de obra)" value="${safe(seccion.titulo)}">
        <div class="cot-sec-actions">
          <button type="button" class="btn-mini" data-action="add-row"><i class="fa fa-plus"></i> Agregar rubro</button>
          <button type="button" class="btn-mini" data-action="remove-section"><i class="fa fa-trash"></i></button>
        </div>
      </div>
      <table class="ems-items-table cot-seccion-table">
        <thead>
          <tr>
            <th style="width:30%">Concepto</th>
            <th>Descripci\\u00F3n</th>
            <th style="width:180px">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="cot-seccion-subtotal"><span>Subtotal secci\\u00F3n:</span> <b class="cot-subtotal-val">$0.00</b></div>
    </div>
  `;
}
function agregarCotSeccion(preload = null) {
  const wrap = document.getElementById('cotSeccionesWrap');
  if (!wrap) return;
  const isDet = (getSettings()?.cotDetallado === true) || (preload && Array.isArray(preload.items) && preload.items.some(it=> it && (it.cantidad!==undefined || it.unidad!==undefined || it.precioUnit!==undefined)));
  const html = isDet ? renderCotSeccionDet(preload||{ items:[{},{},] }) : renderCotSeccion(preload||{ items:[{},{},] });
  wrap.insertAdjacentHTML('beforeend', html);
  try { normalizeEscapedTexts(wrap.lastElementChild || wrap); } catch {}
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
  const isDet = (sec.getAttribute('data-mode') === 'det') || !!sec.querySelector('input[name="precioUnitSec"]');
  if (isDet) {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input type="text" name="concepto" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences"></td>
        <td style="width:80px"><input type="number" name="cantidadSec" min="0" step="1" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))"></td>
        <td style="width:100px"><input type="text" name="unidadSec" list="unidadesEMS" autocomplete="off"></td>
        <td style="white-space:nowrap;display:flex;align-items:center;">
          <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
          <input type="number" name="precioUnitSec" min="0" step="0.01" style="width:100px;" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))">
        </td>
        <td style="width:110px"><span class="cot-row-total">$0.00</span></td>
        <td><button type="button" class="btn-mini" data-action="remove-row"><i class="fa fa-trash"></i></button></td>
      </tr>
    `);
  } else {
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
  }
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  recalcSeccionSubtotal(sec);
}
function recalcSeccionSubtotal(sec) {
  if (!sec) return;
  const unitarios = Array.from(sec.querySelectorAll('input[name="precioUnitSec"]'));
  let subtotal = 0;
  if (unitarios.length) {
    const rows = Array.from(sec.querySelectorAll('tbody tr'));
    rows.forEach(tr => {
      const c = Number(tr.querySelector('input[name="cantidadSec"]')?.value||0);
      const pu = Number(tr.querySelector('input[name="precioUnitSec"]')?.value||0);
      const tot = c*pu;
      const span = tr.querySelector('.cot-row-total');
      if (span) span.textContent = mostrarPrecioLimpio(tot);
      subtotal += tot;
    });
  } else {
    const precios = Array.from(sec.querySelectorAll('input[name="precioSec"]'));
    subtotal = precios.reduce((a,inp)=>{
      const v = String(inp.value||"").trim();
      if (v===''||v==='.'||v==='-') return a;
      const n = Number(v); return a + (isNaN(n)?0:n);
    },0);
  }
  const el = sec.querySelector('.cot-subtotal-val');
  if (el) el.textContent = mostrarPrecioLimpio(subtotal);
  return subtotal;
}
function recalcTotalesCotizacion() {
  const sections = Array.from(document.querySelectorAll('#cotSeccionesWrap .cot-seccion'));
  let subtotal = 0;
  sections.forEach(sec => subtotal += recalcSeccionSubtotal(sec) || 0);
  const form = document.getElementById('cotForm');
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

// === Fotos de COTIZACI\u00D3N (Cloudinary, m?x 5) ===
async function subirFotosCot(input) {
  if (!input.files || input.files.length === 0) return;
  const cupo = 5 - (fotosCotizacion?.length || 0);
  if (cupo <= 0) { showModal("M?ximo 5 im?genes permitidas.", "warning"); input.value = ""; return; }

  const files = Array.from(input.files).slice(0, cupo);
  input.disabled = true;
  showProgress(true, 5, `Preparando subida (${files.length})...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    const pct = Math.round(((i) / Math.max(1, files.length)) * 80) + 10;
    showProgress(true, pct, `Subiendo imagen ${i+1} de ${files.length}...`);
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
  showProgress(false, 100, "Listo");

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
  // Bot?n de volver al inicio arriba
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
        <span class="ems-subtitle">Nueva COTIZACI\u00D3N</span>
      </div>
      <button class="btn-mini" style="margin-left:auto" title="Ajustes" onclick="openSettings()">
        <i class="fa fa-gear"></i>
      </button>
    </div>
    <form id="cotForm" class="ems-form" autocomplete="off" oninput="recalcTotalesCotizacion()">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. COTIZACI\u00D3N</label>
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
          <label>Incluir IVA (16%)</label>
          <label class="ems-switch" aria-label="Incluir IVA (16%)">
            <input class="ems-toggle" id="incluyeIVA" type="checkbox" name="incluyeIVA">
            <span class="ems-switch-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="ems-form-group">
          <label>Con anticipo</label>
          <label class="ems-switch" aria-label="Con anticipo">
            <input class="ems-toggle" id="anticipo" type="checkbox" name="anticipo" onchange="this.form.anticipoPorc.parentElement.style.display=this.checked?'':'none'">
            <span class="ems-switch-ui" aria-hidden="true"></span>
          </label>
          <div style="display:none"><input type="number" name="anticipoPorc" min="0" max="100" placeholder="% Anticipo"> %</div>
        </div>
        <div class="ems-form-group">
          <label>Mejorar redAcción con IA</label>
          <label class="ems-switch" aria-label="Mejorar redAcción con IA">
            <input class="ems-toggle" id="corrigeIA" type="checkbox" name="corrigeIA">
            <span class="ems-switch-ui" aria-hidden="true"></span>
          </label>
        </div>
      </div>
      <!-- SUPERt\u00EDtulo GENERAL -->
      <div class="ems-form-group">
        <label>Supert\u00EDtulo general del documento</label>
        <input type="text" name="titulo" placeholder="Ej: Motor de 5 HP, Rebobinado de alternador..." autocomplete="off" spellcheck="true" autocapitalize="sentences">
      </div>
      <!-- Secciones -->
            <div class="ems-form-group">
        <label>Secciones</label>
        <div id="cotSeccionesWrap"></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="btn-secondary" data-action="add-section"><i class="fa fa-list"></i> Sección (normal)</button>
          <button type="button" class="btn-secondary" data-action="add-section-det"><i class="fa fa-table"></i> Sección detallada</button>
        </div>
        <small>Normal: concepto+descripcion+precio. Detallada: concepto+cantidad+unidad+precio unitario+total.</small>
      </div>

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
      <!-- Im?genes para PDF (hasta 5) -->
      <div class="ems-form-group">
        <label>Im?genes para el PDF (hasta 5)</label>
        <div id="cotFotosPreview" class="ems-rep-fotos-row"></div>
        <input id="cotFotosInput" type="file" accept="image/*" multiple onchange="subirFotosCot(this)" style="display:none">
        <label for="cotFotosInput" class="ems-file-btn"><i class="fa fa-camera"></i> Agregar fotos</label>
        <small>Se suben a Cloudinary y se insertan al final del PDF.</small>
      </div>
      <div class="ems-form-actions">
        <button type="button" class="btn-mini" data-action="cot-cancel"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="button" class="btn-secondary" data-action="cot-undo"><i class="fa fa-undo"></i> Deshacer</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" data-action="cot-preview" title="Ver vista previa antes de generar el PDF final"><i class="fa fa-eye"></i> Vista Previa</button>
        <button type="button" class="btn-secondary" data-action="cot-pdf"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" data-action="cot-share"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
    <div class="ems-credit">Programado por: Francisco L\u00F3pez Vel\u00E1zquez.</div>
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
  } else {
    // Inicial con una seccion
    agregarCotSeccion({ titulo: 'General', items: [{},{}] });
  }

  renderCotFotosPreview();

  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
    try { pushUndoCotSnapshot(); } catch {}
  }, 100);

  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarCotizacion(e);
    localStorage.removeItem('EMS_COT_BORRADOR');
  };

  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('cotForm')) guardarCotizacionDraft();
  }, 15000);

  // eliminar si ya existe
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

// ========== Reporte (con im?genes Cloudinary) ==========
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
  const desc = tr?.querySelector("textarea")?.value || "";
  if (tr) tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporteMap[id], _id:id }, id, true);
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  showSaved("?Imagen(es) subida(s)!");
  input.disabled = false;
  input.value = "";
}
function eliminarFotoRepItem(btn, id, fidx) {
  if (!fotosItemsReporteMap[id]) return;
  fotosItemsReporteMap[id].splice(fidx, 1);
  const tr = btn.closest('tr');
  const desc = tr?.querySelector("textarea")?.value || "";
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
      <!-- NUEVA secci\u00F3n: CONCEPTO -->
      <div class="ems-form-group">
        <label>Concepto (ej. MOTOR 4HP)</label>
        <input type="text" name="concepto" list="conceptosEMS" placeholder="Equipo/Trabajo principal" autocomplete="off">
        <datalist id="conceptosEMS"></datalist>
      </div>
      <div>
        <table class="ems-items-table" id="repItemsTable">
          <thead>
            <tr>
              <th>Descripci\\u00F3n</th>
              <th>Fotos (m?x 6)</th>
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
    <div class="ems-credit">Programado por: Francisco L\u00F3pez Vel\u00E1zquez.</div>
  `;
  const form = document.getElementById('repForm');
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
  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
    try { pushUndoRepSnapshot(); } catch {}
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

// ========== GUARDADO, PDF, EDICI?N, DETALLE ==========
async function enviarCotizacion(e) {
  e.preventDefault();
  showSaved("Guardando...");
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  // Tomar secciones
  const secciones = [];
  document.querySelectorAll('#cotSeccionesWrap .cot-seccion').forEach(sec => {
    const titulo = sec.querySelector('input[name="sec_titulo"]').value.trim();
    const items = [];
    sec.querySelectorAll('tbody tr').forEach(tr=>{
      const concepto = tr.querySelector('input[name="concepto"]').value;
      if (tr.querySelector('input[name="precioUnitSec"]')) {
        const cantidad = Number(tr.querySelector('input[name="cantidadSec"]').value||0);
        const unidad = tr.querySelector('input[name="unidadSec"]').value||'';
        const precioUnit = Number(tr.querySelector('input[name="precioUnitSec"]').value||0);
        const total = cantidad * precioUnit;
        if (concepto || cantidad || unidad || precioUnit) items.push({ concepto, cantidad, unidad, precioUnit, total });
      } else {
        const descripcion = tr.querySelector('textarea[name="descripcion"]').value;
        const precio = Number(tr.querySelector('input[name="precioSec"]').value||0);
        if (concepto || descripcion || precio) items.push({ concepto, descripcion, precio });
      }
    });
    if (titulo || items.length) secciones.push({ titulo, items });
  });
  if (!datos.numero || !datos.cliente || !secciones.length) {
    showSaved("Faltan datos");
    showModal("Por favor completa todos los campos requeridos: n\u00FAmero, cliente y al menos una seccion.", "warning");
    return;
  }
  savePredictEMSCloud("cliente", datos.cliente);
  secciones.forEach(sec => (sec.items||[]).forEach(it => { savePredictEMSCloud("concepto", it.concepto); }));
  // C?lculos
  const subtotal = secciones.reduce((a,sec)=> a + (sec.items||[]).reduce((s,it)=> s + (it.total!=null? Number(it.total): Number(it.precio)||0),0), 0);
  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal*0.16 : 0;
  const total = subtotal + iva;
  const cotizacion = {
    ...datos,
    secciones,
    subtotal,
    iva,
    total,
    fotos: fotosCotizacion.slice(0,5),
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  if (!navigator.onLine) {
    showModal("Sin conexi?n a Internet. Los datos se guardar?n localmente. Intenta guardar cuando tengas conexi?n.", "warning");
    showSaved("Offline");
    return;
  }
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  localStorage.removeItem('EMS_COT_BORRADOR');
  showSaved("?COTIZACI\u00D3N guardada!");
  renderInicio();
}

async function guardarCotizacionDraft() {
  const form = document.getElementById('cotForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const secciones = [];
  document.querySelectorAll('#cotSeccionesWrap .cot-seccion').forEach(sec => {
    const titulo = sec.querySelector('input[name="sec_titulo"]').value.trim();
    const items = [];
    sec.querySelectorAll('tbody tr').forEach(tr=>{
      const concepto = tr.querySelector('input[name="concepto"]').value;
      if (tr.querySelector('input[name="precioUnitSec"]')) {
        const cantidad = Number(tr.querySelector('input[name="cantidadSec"]').value||0);
        const unidad = tr.querySelector('input[name="unidadSec"]').value||'';
        const precioUnit = Number(tr.querySelector('input[name="precioUnitSec"]').value||0);
        const total = cantidad * precioUnit;
        if (concepto || cantidad || unidad || precioUnit) items.push({ concepto, cantidad, unidad, precioUnit, total });
      } else {
        const descripcion = tr.querySelector('textarea[name="descripcion"]').value;
        const precio = Number(tr.querySelector('input[name="precioSec"]').value||0);
        if (concepto || descripcion || precio) items.push({ concepto, descripcion, precio });
      }
    });
    if (titulo || items.length) secciones.push({ titulo, items });
  });
  const subtotal = secciones.reduce((a,sec)=> a + (sec.items||[]).reduce((s,it)=> s + (it.total!=null? Number(it.total): Number(it.precio)||0), 0), 0);
  const incluyeIVA = datos.incluyeIVA === 'on';
  const iva = incluyeIVA ? subtotal*0.16 : 0;
  const total = subtotal + iva;
  const cotizacion = {
    ...datos,
    secciones,
    subtotal, iva, total,
    fotos: fotosCotizacion.slice(0,5),
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  await db.collection("cotizaciones").doc(datos.numero || "BORRADOR").set(cotizacion);
  localStorage.setItem('EMS_COT_BORRADOR', JSON.stringify(cotizacion));
  showSaved("COTIZACI\u00D3N guardada");
}

// ====== Helpers PDF est\u00E1ticos ======
function emsRgb(arr = EMS_COLOR) {
  const { rgb } = PDFLib;
  const theme = Array.isArray(arr) ? arr : getThemeRgbArray();
  return rgb(theme[0], theme[1], theme[2]);
}
function gray(v) {
  const { rgb } = PDFLib;
  return rgb(v, v, v);
}
function drawTextRight(page, text, xRight, y, opts) {
  const width = opts.font.widthOfTextAtSize(text, opts.size);
  page.drawText(text, { x: xRight - width, y, ...opts });
}
function rule(page, x1, y, x2, color = gray(0.85), thickness = 0.6) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}
function drawSectionTitle(page, x, y, text, fonts, opts = {}) {
  const gap = opts.titleGap ?? 10; // gap extra bajo el t\u00EDtulo
  if (!opts.dryRun) page.drawRectangle({ x, y: y - 10, width: 4, height: 14, color: emsRgb(), opacity: 0.9 });
  if (!opts.dryRun) page.drawText(String(text || "").toUpperCase(), { x: x + 10, y: y - 6, size: 11.5, font: fonts.bold, color: gray(0.18) });
  return y - 20 - gap;
}

// === Compactaci?n global (menos blanco) ===
const FOOTER_SAFE = 70;              // zona reservada inferior (pie de P\u00E1gina)
const TOP_PAD_NO_HEADER = 6;        // respiro arriba cuando NO hay encabezado
const WATERMARK_W = 220, WATERMARK_H = 220, WATERMARK_OP = 0.04;

// --- Banda de seccion (mejora de contraste y asociaci?n) con reserva anti-solape
function drawSectionBand(pdfDoc, ctx, label, { continuation = false, preservePageStart = false } = {}) {
  const { fonts, dims } = ctx;
  const bandH = 26;
  ensureSpace(pdfDoc, ctx, bandH + 6); // un poco m?s compacto
  const page = ctx.pages[ctx.pages.length - 1];
  page.drawRectangle({
    x: dims.mx,
    y: ctx.y - bandH + 6,
    width: dims.usableW,
    height: bandH,
    color: emsRgb(),
    opacity: 0.10,
    borderColor: emsRgb(),
    borderWidth: 0.8
  });
  const txt = continuation ? `${label} ? continuaci?n` : label;
  page.drawText(String(txt).toUpperCase(), {
    x: dims.mx + 10,
    y: ctx.y - bandH + 12,
    size: 11.5,
    font: fonts.bold,
    color: emsRgb()
  });
  ctx.y -= bandH + 8; // gap m?s corto
  if (!preservePageStart) ctx._atPageStart = false;
  ctx.state.prevBlock = "section-band";
}

// --- Logo embebido (cach? por documento)
async function getLogoImage(pdfDoc) {
  if (!pdfDoc.__EMS_LOGO_IMG_TRIED) {
    pdfDoc.__EMS_LOGO_IMG_TRIED = true;
    try {
      const bytes = await fetch(LOGO_URL, { mode: 'cors' }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      try { pdfDoc.__EMS_LOGO_IMG = await pdfDoc.embedPng(bytes); }
      catch { pdfDoc.__EMS_LOGO_IMG = await pdfDoc.embedJpg(bytes); }
    } catch (e) {
      console.warn('No se pudo cargar el logo para watermark/header:', e);
      pdfDoc.__EMS_LOGO_IMG = null; // seguimos sin logo
    }
  }
  return pdfDoc.__EMS_LOGO_IMG;
}

// Header con logo (solo se usa en PRIMERA P\u00E1gina)
function addHeader(pdfDoc, page, typeLabel, datos, fonts, dims, isFirst = false, logoImg = null, opts = {}) {
  const { pageW, mx } = dims;
  let yTop = dims.pageH - dims.my;

  if (!opts.dryRun && logoImg) {
    page.drawImage(logoImg, { x: mx, y: yTop - 46, width: 46, height: 46 });
  }

  if (!opts.dryRun) {
    page.drawText(EMS_CONTACT.empresa, { x: mx + 64, y: yTop - 4, size: 16.5, font: fonts.bold, color: gray(0.18) });
    page.drawText(typeLabel, { x: mx + 64, y: yTop - 22, size: 12, font: fonts.bold, color: emsRgb() });

    page.drawText(`Cliente: ${datos.cliente || ""}`, { x: mx + 64, y: yTop - 38, size: 10.5, font: fonts.reg, color: gray(0.25) });
    drawTextRight(page, `No: ${datos.numero || ""}`, pageW - mx, yTop - 4, { size: 10.5, font: fonts.bold, color: gray(0.25) });
    drawTextRight(page, `Fecha: ${datos.fecha || ""}${datos.hora ? " \u00B7 " + datos.hora : ""}`, pageW - mx, yTop - 22, { size: 10.5, font: fonts.bold, color: gray(0.25) });

    rule(page, mx, yTop - 48, pageW - mx, gray(0.85), 0.8);
  }
  return yTop - 58;
}

// Pie de P\u00E1gina en TODAS las P\u00E1ginas
function applyFooters(pdfDoc, pages, fonts, dims) {
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const y = 56;
    rule(page, dims.mx, y + 14, dims.pageW - dims.mx, gray(0.85), 0.8);
    page.drawText(`${EMS_CONTACT.empresa}  \u00B7  ${EMS_CONTACT.direccion}`, { x: dims.mx + 8, y: y + 2, size: 9.2, font: fonts.reg, color: gray(0.25) });
    page.drawText(`Tel: ${EMS_CONTACT.telefono}  \u00B7  ${EMS_CONTACT.correo}`, { x: dims.mx + 8, y: y - 11, size: 9.2, font: fonts.reg, color: gray(0.25) });
    drawTextRight(page, `P\u00E1gina ${i + 1} de ${total}`, dims.pageW - dims.mx, y - 11, { size: 9.2, font: fonts.bold, color: gray(0.45) });
    try {
      const s = getSettings();
      if (s.showCredit !== false) {
        page.drawText('Programado por: Francisco L\u00F3pez Vel\u00E1zquez.', { x: dims.mx + 8, y: y - 24, size: 8.8, font: fonts.reg, color: gray(0.55) });
      }
    } catch {}
  }
}

async function embedSmart(pdfDoc, url) {
  try {
    // 1) Intento r?pido: comprimir a JPEG y embeber
    const jpegBytes = await compressImageToJpegArrayBuffer(url, PDF_IMG_DEFAULTS);
    return await pdfDoc.embedJpg(jpegBytes);
  } catch (err) {
    // 2) Fallback: descargar tal cual y probar JPG/PNG
    try {
      const orig = await fetch(url, { mode: 'cors' }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      try { return await pdfDoc.embedJpg(orig); } catch { return await pdfDoc.embedPng(orig); }
    } catch {
      // 3) Si todo falla (403/CORS), devolvemos null para que el flujo siga sin imagen
      return null;
    }
  }
}

// === Watermark tenue
function drawWatermark(page, dims, logoImg, op = WATERMARK_OP) {
  try { page.drawImage(logoImg, { x: (dims.pageW - WATERMARK_W) / 2, y: (dims.pageH - WATERMARK_H) / 2, width: WATERMARK_W, height: WATERMARK_H, opacity: op }); } catch {}
}

// === Control de salto de P\u00E1gina (sin encabezado en P\u00E1ginas siguientes)
function ensureSpace(pdfDoc, ctx, needed) {
  const { dims, logoImg, opts } = ctx;
  const bottomSafe = FOOTER_SAFE; // m?s compacto
  if (ctx.y - needed < bottomSafe) {
    const page = pdfDoc.addPage([dims.pageW, dims.pageH]);
    ctx.pages.push(page);
    if (!opts.dryRun && logoImg) drawWatermark(page, dims, logoImg, WATERMARK_OP);
    // Arranque de P\u00E1gina SIN encabezado: casi al tope
    ctx.y = dims.pageH - dims.my - TOP_PAD_NO_HEADER;
    ctx._atPageStart = true;
    ctx.state.prevBlock = "page-start";
    if (ctx.state.inGallery && ctx.state.currentSection) {
      drawSectionBand(pdfDoc, ctx, ctx.state.currentSection, { continuation: true, preservePageStart: true });
      ctx._atPageStart = true;
    }
  }
}

// --- Card de texto con etiqueta tipo ?p?ldora? (con reserva para primera fila de fotos)
function drawLabeledCard(pdfDoc, ctx, { label, text, fontSize = 11, pad = 10, reserveBelow = 0 }) {
  const { dims, fonts, opts } = ctx;
  if (ctx.state.prevBlock === "section-band") ctx.y -= 2;

  const page = ctx.pages[ctx.pages.length - 1];
  const labelTxt = String(label || "").toUpperCase();
  const bodyTxt  = String(text || "").trim();
  const lines = wrapTextLines(bodyTxt, fonts.reg, fontSize, dims.usableW - 2*pad);
  const bodyH = Math.max(22, lines.length * (fontSize + 3) + 2*pad);
  const cardSelfHeight = 22 + 6 + bodyH + (opts.cardGap || 8);
  const needed = cardSelfHeight + (reserveBelow || 0);

  ensureSpace(pdfDoc, ctx, needed);

  const pillW = Math.min(dims.usableW, fonts.bold.widthOfTextAtSize(labelTxt, 10.5) + 14);
  if (!opts.dryRun) {
    page.drawRectangle({ x: dims.mx, y: ctx.y - 18, width: pillW, height: 18, color: emsRgb(), opacity: 0.95 });
    page.drawText(labelTxt, { x: dims.mx + 7, y: ctx.y - 14, size: 10.5, font: fonts.bold, color: PDFLib.rgb(1,1,1) });

    const topBodyY = ctx.y - 18 - 5;
    page.drawRectangle({ x: dims.mx, y: topBodyY - bodyH, width: dims.usableW, height: bodyH, color: gray(0.985), borderColor: gray(0.90), borderWidth: 0.8 });
    let y = topBodyY - pad - fontSize;
    lines.forEach(ln => {
      page.drawText(ln, { x: dims.mx + pad, y, size: fontSize, font: fonts.reg, color: gray(0.18) });
      y -= (fontSize + 3);
    });
  }

  const topBodyY = ctx.y - 18 - 5;
  const endY = topBodyY - bodyH + (-(opts.cardGap || 8));
  ctx.y = endY;
  ctx._atPageStart = false;
  ctx.state.prevBlock = "card";
}

// ====== OBSERVACIONES EN LISTA ======
function parseObservaciones(raw) {
  let t = String(raw || "").trim();
  if (!t) return [];
  t = t.replace(/\r\n/g, "\n")
       .replace(/[;?]/g, "\n")
       .replace(/\n{2,}/g, "\n")
       .replace(/\t/g, " ");
  const lines = t.split("\n").map(s => s.trim()).filter(Boolean);
  const items = [];
  for (let ln of lines) {
    ln = ln.replace(/^\s*[-*?]\s+/, "")
           .replace(/^\s*\d+[\.\)]\s+/, "");
    if (ln) items.push(ln);
  }
  return items;
}
function drawBulletList(pdfDoc, ctx, items, { bullet = "?", fontSize = 10, lineGap = 4, leftPad = 8, bulletGap = 6 } = {}) {
  const { dims, fonts, opts } = ctx;
  const xBullet = dims.mx + leftPad;
  const xText = xBullet + bulletGap + 6;
  const maxW = dims.usableW - (xText - dims.mx) - leftPad;

  for (const it of items) {
    const lines = wrapTextLines(it, fonts.reg, fontSize, maxW);
    const needed = (lines.length * (fontSize + lineGap)) + 2 + (opts.blockGap || 6);
    ensureSpace(pdfDoc, ctx, needed);

    if (!opts.dryRun) {
      ctx.pages[ctx.pages.length - 1].drawText(bullet, {
        x: xBullet,
        y: ctx.y - fontSize,
        size: fontSize,
        font: fonts.bold,
        color: gray(0.25)
      });

      let y = ctx.y - fontSize;
      lines.forEach((ln) => {
        ctx.pages[ctx.pages.length - 1].drawText(ln, { x: xText, y, size: fontSize, font: fonts.reg, color: gray(0.28) });
        y -= (fontSize + lineGap);
      });
    }

    ctx.y -= (lines.length * (fontSize + lineGap)) + (opts.blockGap || 6);
  }
  ctx._atPageStart = false;
  ctx.state.prevBlock = "list";
}

// --- Utilidades de galer?a ---
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function availablePageHeight(ctx) {
  // altura real libre hasta el footer seguro (m?s compacto)
  return ctx.y - FOOTER_SAFE;
}

// Dibuja una sola imagen (centrada)
async function drawSingleImageBlock(pdfDoc, ctx, url, { maxWFactor = 0.92, maxH = 300, pad = 6 } = {}) {
  const { dims, opts } = ctx;
  const img = await embedSmart(pdfDoc, url);
  if (!img) return;
  const maxW = Math.floor(dims.usableW * maxWFactor);
  let w = img.width, h = img.height;
  const scale = Math.min(maxW / w, maxH / h, 1);
  w = Math.round(w * scale); h = Math.round(h * scale);

  const needed = h + pad * 2 + (opts.blockGap || 6);
  ensureSpace(pdfDoc, ctx, needed);

  if (!opts.dryRun) {
    const p = ctx.pages[ctx.pages.length - 1];
    p.drawRectangle({ x: dims.mx, y: ctx.y - (h + pad * 2), width: dims.usableW, height: h + pad * 2, color: gray(0.99), borderColor: gray(0.90), borderWidth: 0.6 });
    const x = dims.mx + (dims.usableW - w) / 2;
    const y = ctx.y - pad - h;
    p.drawImage(img, { x, y, width: w, height: h });
  }
  ctx.y -= (h + pad * 2 + (opts.blockGap || 6));
  ctx._atPageStart = false;
  ctx.state.prevBlock = "image";
}

// == Grid 2x2 inteligente (garantiza 4 por P\u00E1gina al inicio) ==
async function drawFourUpGrid(pdfDoc, ctx, row1Imgs, row2Imgs, { gutter = 8, pad = 6, vGap = 8 } = {}) {
  const { dims, opts } = ctx;

  const emb1 = [], emb2 = [];
  for (const u of row1Imgs) { const e = await embedSmart(pdfDoc, u); if (e) emb1.push({img:e, r:e.width/e.height}); }
  for (const u of row2Imgs) { const e = await embedSmart(pdfDoc, u); if (e) emb2.push({img:e, r:e.width/e.height}); }
  if (emb1.length + emb2.length === 0) return;

  const sumR1 = emb1.reduce((a,b)=>a+b.r,0) || 1;
  const sumR2 = emb2.reduce((a,b)=>a+b.r,0) || 1;

  let h1 = Math.floor((dims.usableW - gutter*(emb1.length-1)) / sumR1);
  let h2 = Math.floor((dims.usableW - gutter*(emb2.length-1)) / sumR2);

  const boxH = pad*2 + h1 + vGap + h2 + pad*2 + (opts.blockGap || 6);
  let avail = availablePageHeight(ctx) - 8;
  if (boxH > avail) {
    const s = (avail) / boxH;
    h1 = Math.floor(h1 * s);
    h2 = Math.floor(h2 * s);
  }

  const needed = pad*2 + h1 + vGap + h2 + pad*2 + (opts.blockGap || 6);
  ensureSpace(pdfDoc, ctx, needed);

  if (!opts.dryRun) {
    const p = ctx.pages[ctx.pages.length - 1];
    const topY = ctx.y;

    // fila 1
    let x = dims.mx + Math.round((dims.usableW - (emb1.reduce((a,b)=>a+Math.round(b.r*h1),0) + gutter*(emb1.length-1)))/2);
    let y = topY - pad - h1;
    for (let i=0;i<emb1.length;i++) {
      const w = Math.round(emb1[i].r*h1);
      p.drawImage(emb1[i].img, { x, y, width: w, height: h1 });
      x += w + gutter;
    }

    // fila 2
    x = dims.mx + Math.round((dims.usableW - (emb2.reduce((a,b)=>a+Math.round(b.r*h2),0) + gutter*(emb2.length-1)))/2);
    y = topY - pad - h1 - vGap - h2;
    for (let i=0;i<emb2.length;i++) {
      const w = Math.round(emb2[i].r*h2);
      p.drawImage(emb2[i].img, { x, y, width: w, height: h2 });
      x += w + gutter;
    }

    // marco sutil de bloque
    p.drawRectangle({
      x: dims.mx,
      y: topY - (pad*2 + h1 + vGap + h2),
      width: dims.usableW,
      height: pad*2 + h1 + vGap + h2,
      color: gray(0.99),
      borderColor: gray(0.90),
      borderWidth: 0.6
    });
  }

  ctx.y -= (pad*2 + h1 + vGap + h2 + (opts.blockGap || 6));
  ctx._atPageStart = false;
  ctx.state.prevBlock = "grid2x2";
}

// Dibuja dos im?genes lado a lado
async function drawTwoImageRow(pdfDoc, ctx, urls, { gutter = 8, rowPad = 5, targetH = 210, maxH = 230 } = {}) {
  const { dims, opts } = ctx;
  const imgs = [];
  for (const u of urls) {
    const img = await embedSmart(pdfDoc, u);
    if (img) imgs.push({ img, r: img.width / img.height });
  }
  if (imgs.length === 0) return;
  if (imgs.length === 1) return drawSingleImageBlock(pdfDoc, ctx, urls[0], { maxH });

  let rowH = clamp(targetH, 160, maxH);
  const sumR = imgs[0].r + imgs[1].r;
  rowH = Math.min(rowH, Math.floor((dims.usableW - gutter) / sumR));

  const needed = rowPad * 2 + rowH + (opts.blockGap || 6);
  ensureSpace(pdfDoc, ctx, needed);

  if (!opts.dryRun) {
    const p = ctx.pages[ctx.pages.length - 1];
    const topY = ctx.y;
    p.drawRectangle({ x: dims.mx, y: topY - (rowPad * 2 + rowH), width: dims.usableW, height: rowPad * 2 + rowH, color: gray(0.99), borderColor: gray(0.90), borderWidth: 0.6 });

    const w1 = Math.round(imgs[0].r * rowH);
    const w2 = Math.round(imgs[1].r * rowH);
    let startX = dims.mx + Math.round((dims.usableW - (w1 + w2 + gutter)) / 2);
    const y = topY - rowPad - rowH;
    p.drawImage(imgs[0].img, { x: startX, y, width: w1, height: rowH });
    p.drawImage(imgs[1].img, { x: startX + w1 + gutter, y, width: w2, height: rowH });
  }

  ctx.y -= (rowPad * 2 + rowH + (opts.blockGap || 6));
  ctx._atPageStart = false;
  ctx.state.prevBlock = "row2";
}

/**
 * Galer?a "packed" profesional (m?s compacta):
 * - En inicio de P\u00E1gina usa grid 2?2 para asegurar 4 fotos por hoja.
 * - Evita filas de 1 imagen (funde con la siguiente).
 * - Ajusta din?micamente la altura objetivo a lo disponible.
 * - ?ltima fila centrada sin estirar de m?s.
 * - Marca continuidad de seccion cuando salta de P\u00E1gina.
 */
async function drawSmartGallery(
  pdfDoc,
  ctx,
  images,
  {
    title = null,
    captions = false,
    baseTargetRowH = 200,
    minRowH = 160,
    maxRowH = 235,
    minImgW = 150,
    gutter = 8,
    rowPad = 5,
  } = {}
) {
  const { dims, fonts, opts } = ctx;
  const page = () => ctx.pages[ctx.pages.length - 1];

  if (!Array.isArray(images) || images.length === 0) return;

  // t\u00EDtulo opcional
  if (title) {
    ensureSpace(pdfDoc, ctx, 24 + (opts.titleGap ?? 8));
    ctx.y = drawSectionTitle(page(), dims.mx, ctx.y, title, fonts, { titleGap: opts.titleGap ?? 8, dryRun: opts.dryRun });
    ctx._atPageStart = false;
    ctx.state.prevBlock = "title";
  }

  // Pre-embed ratios
  const emb = [];
  for (const url of images) {
    const img = await embedSmart(pdfDoc, url);
    if (!img) continue;
    emb.push({ img, r: img.width / img.height });
  }
  if (emb.length === 0) return;

  let i = 0;
  let figCounter = 1;
  ctx.state.inGallery = true;

  while (i < emb.length) {
    // Si estamos al inicio de P\u00E1gina y hay >= 4 im?genes, aplicar grid 2x2
    if (ctx._atPageStart && (emb.length - i) >= 4) {
      await drawFourUpGrid(pdfDoc, ctx,
        [images[i], images[i+1]],
        [images[i+2], images[i+3]],
        { gutter: 8, pad: 6, vGap: 8 }
      );
      i += 4;
      continue;
    }

    // Altura objetivo din?mica para llenado eficiente
    const dynamicTarget = clamp(Math.floor(availablePageHeight(ctx) / 2) - 10, minRowH, maxRowH);
    const targetRowH = clamp(dynamicTarget || baseTargetRowH, minRowH, maxRowH);

    // Construcci?n de fila evitando 1 sola imagen
    let row = [];
    let sumRatios = 0;

    while (i < emb.length) {
      row.push(emb[i]);
      sumRatios += emb[i].r;
      const widthAtTarget = Math.round(sumRatios * targetRowH) + gutter * (row.length - 1);

      const minWidthAtTarget = Math.min(...row.map(o => o.r * targetRowH));
      if (minWidthAtTarget < minImgW && row.length > 1) {
        row.pop(); sumRatios -= emb[i].r; break;
      }
      if (widthAtTarget >= dims.usableW) break;
      i++;
    }
    if (row.length > 0 && emb[i] === row[row.length - 1]) i++;

    // Si qued? una sola imagen y a?n hay m?s disponibles, forzar pareja
    if (row.length === 1 && i < emb.length) {
      row.push(emb[i]); sumRatios += emb[i].r; i++;
    }

    // altura final de fila
    let rowH = (dims.usableW - gutter * (row.length - 1)) / sumRatios;
    rowH = clamp(rowH, minRowH, maxRowH);

    // Asegurar que cabe en la P\u00E1gina
    const boxH = rowPad * 2 + rowH + (captions ? 16 : 0) + (opts.blockGap || 6);
    ensureSpace(pdfDoc, ctx, boxH);

    if (!opts.dryRun) {
      const p = page();
      const topY = ctx.y;

      p.drawRectangle({
        x: dims.mx,
        y: topY - (rowPad * 2 + rowH + (captions ? 16 : 0)),
        width: dims.usableW,
        height: rowPad * 2 + rowH + (captions ? 16 : 0),
        color: gray(0.99),
        borderColor: gray(0.90),
        borderWidth: 0.6
      });

      let widths = row.map(o => Math.round(o.r * rowH));
      let totalRowWidth = widths.reduce((a, b) => a + b, 0) + gutter * (row.length - 1);

      // reajuste fino
      while (totalRowWidth > dims.usableW && rowH > minRowH) {
        rowH -= 1;
        widths = row.map(o => Math.round(o.r * rowH));
        totalRowWidth = widths.reduce((a, b) => a + b, 0) + gutter * (row.length - 1);
      }

      let startX = dims.mx + Math.round((dims.usableW - totalRowWidth) / 2);
      let x = startX;
      const iy = topY - rowPad - rowH;
      for (let k = 0; k < row.length; k++) {
        p.drawImage(row[k].img, { x, y: iy, width: widths[k], height: rowH });
        if (captions) {
          p.drawText(`Figura ${figCounter}`, { x, y: iy - 12, size: 9.2, font: fonts.reg, color: gray(0.45) });
        }
        figCounter++;
        x += widths[k] + gutter;
      }
    }

    ctx.y -= (rowPad * 2 + rowH + (captions ? 16 : 0) + (opts.blockGap || 6));
    ctx._atPageStart = false;
    ctx.state.prevBlock = "galleryRow";
  }

  ctx.state.inGallery = false;
}

// ====== COTIZACI\u00D3N: PDF ======
async function generarPDFCotizacion(share = false, isPreview = false) {
  // Configuraci?n de calidad seg?n modo
  const imgQuality = isPreview
    ? { maxW: 640, maxH: 640, quality: 0.5 } // Baja calidad para preview r?pido
    : PDF_IMG_DEFAULTS; // Alta calidad para PDF final

  showProgress(true, 10, isPreview ? "Generando vista previa..." : "Generando PDF...");
  if (!isPreview) await guardarCotizacionDraft();

  // Usar serializador robusto (normal/detallado)
  const snap = serializeCotizacionForm();
  const datos = { ...snap };
  const secciones = (snap && Array.isArray(snap.secciones)) ? snap.secciones : [];

  // Subtotal soporta filas normales (precio) y detalladas (total)
  let subtotal = secciones.reduce((acc, sec)=> acc + (sec.items||[]).reduce((a,it)=> a + (it.total!=null ? Number(it.total) : Number(it.precio)||0), 0), 0);
  const form = document.getElementById('cotForm');
  const incluyeIVA = form && form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dims = { pageW: 595.28, pageH: 841.89, mx: 32, my: 38 };
  dims.usableW = dims.pageW - dims.mx * 2;

  const fonts = { reg: helv, bold: helvB };
  const logoImg = await getLogoImage(pdfDoc);

  const ctx = { 
    pages: [], y: 0, dims, fonts, datos, 
    typeLabel: decodeU(" COTIZACI\\\\u00D3N\), logoImg, _atPageStart: true,
    opts: { dryRun: false, titleGap: 8, cardGap: 8, blockGap: 6 },
    state: { prevBlock: 'start', inGallery: false, currentSection: null }
  };

  const first = pdfDoc.addPage([dims.pageW, dims.pageH]);
  ctx.pages.push(first);
  drawWatermark(first, dims, logoImg, WATERMARK_OP);
  ctx.y = addHeader(pdfDoc, first, ctx.typeLabel, datos, fonts, dims, true, logoImg);
  ctx._atPageStart = true;

  // SUPERt\u00EDtulo (opcional)
  if ((datos.titulo || "").trim()) {
    const titulo = datos.titulo.trim();
    const rectH = 32;
    first.drawRectangle({ x: dims.mx, y: ctx.y - rectH + 10, width: dims.usableW, height: rectH, color: emsRgb(), opacity: 0.08, borderColor: emsRgb(), borderWidth: 1 });
    const w = helvB.widthOfTextAtSize(titulo, 15);
    first.drawText(titulo, { x: dims.mx + (dims.usableW - w) / 2, y: ctx.y - rectH / 2 + 12, size: 15, font: helvB, color: emsRgb() });
    ctx.y -= rectH + 14;
    ctx._atPageStart = false;
  } else {
    ctx.y -= 6;
  }

  const currentPage = () => ctx.pages[ctx.pages.length - 1];
  for (let s = 0; s < secciones.length; s++) {
    const sec = secciones[s];
    const items = sec.items || [];
    const isDet = items.some(it => it && (it.precioUnit != null || it.cantidad != null || it.unidad != null || it.total != null));
    // Banda de seccion
    drawSectionBand(pdfDoc, ctx, sec.titulo || `Seccion ${s+1}`);
    ensureSpace(pdfDoc, ctx, 24);
    const pT = currentPage();
    const thY = ctx.y;
    pT.drawRectangle({ x: dims.mx, y: thY - 18, width: dims.usableW, height: 20, color: emsRgb(), opacity: 0.98 });
    if (!isDet) {
      // Cabecera normal
      pT.drawText("Concepto", { x: dims.mx + 6, y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
    pT.drawText(decodeU("Descripci\\u00F3n"), { x: dims.mx + 180, y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      pT.drawText("Precio", { x: dims.mx + dims.usableW - 120, y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
    } else {
      // Cabecera detallada
      const widths = { cant: 60, unidad: 90, punit: 100, total: 100 };
      const conceptW = dims.usableW - (widths.cant + widths.unidad + widths.punit + widths.total) - 18;
      var xConcept = dims.mx + 6;
      var xCant    = xConcept + conceptW + 6;
      var xUnidad  = xCant + widths.cant + 6;
      var xPunit   = xUnidad + widths.unidad + 6;
      var xTotal   = xPunit + widths.punit + 6;
      pT.drawText("Concepto", { x: xConcept, y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      pT.drawText("Cant.",    { x: xCant,    y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      pT.drawText("Unidad",   { x: xUnidad,  y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      pT.drawText("P. Unit.", { x: xPunit,   y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      pT.drawText("Total",    { x: xTotal,   y: thY - 12, size: 11, font: helvB, color: rgb(1,1,1) });
      // Guardar en ctx para filas
      ctx.__detCols = { widths, conceptW, xConcept, xCant, xUnidad, xPunit, xTotal };
    }
    ctx.y = thY - 24;
    let subSec = 0;
    items.forEach((it, idx) => {
      ensureSpace(pdfDoc, ctx, 22);
      const p = currentPage();
      if (idx % 2 === 0) {
        p.drawRectangle({ x: dims.mx, y: ctx.y - 2, width: dims.usableW, height: 18, color: rgb(0.98,0.91,0.75), opacity: 0.16 });
      }
      if (!isDet) {
        p.drawText(String(it.concepto||""), { x: dims.mx + 6, y: ctx.y, size: 10, font: helv, color: gray(0.24) });
        const maxW = dims.usableW - 120 - (180 - 6);
        const lines = wrapTextLines(String(it.descripcion||""), helv, 10, maxW);
        let yy = ctx.y;
        lines.slice(0,3).forEach((ln)=>{ p.drawText(ln, { x: dims.mx + 180, y: yy, size: 10, font: helv, color: gray(0.28) }); yy -= 12; });
        drawTextRight(p, mostrarPrecioLimpio(it.precio), dims.mx + dims.usableW - 6, ctx.y, { size: 10, font: helv, color: gray(0.24) });
        subSec += Number(it.precio)||0;
      } else {
        const cols = ctx.__detCols;
        const cantidad = Number(it.cantidad)||0;
        const unidad = String(it.unidad||"");
        const precioUnit = Number(it.precioUnit)||0;
        const totalRow = (it.total!=null ? Number(it.total) : (cantidad*precioUnit));
        p.drawText(String(it.concepto||""), { x: cols.xConcept, y: ctx.y, size: 10, font: helv, color: gray(0.24) });
        drawTextRight(p, String(cantidad), (cols.xCant + cols.widths.cant) - 6, ctx.y, { size: 10, font: helv, color: gray(0.28) });
        p.drawText(unidad, { x: cols.xUnidad, y: ctx.y, size: 10, font: helv, color: gray(0.28) });
        drawTextRight(p, mostrarPrecioLimpio(precioUnit), (cols.xPunit + cols.widths.punit) - 6, ctx.y, { size: 10, font: helv, color: gray(0.24) });
        drawTextRight(p, mostrarPrecioLimpio(totalRow), dims.mx + dims.usableW - 6, ctx.y, { size: 10, font: helvB, color: gray(0.24) });
        subSec += Number(totalRow)||0;
      }
      rule(p, dims.mx, ctx.y - 3, dims.pageW - dims.mx, gray(0.93), 0.4);
      ctx.y -= 18;
    });
    ctx.y -= 4;
    const pS = currentPage();
    pS.drawText(decodeU("Subtotal secci\\u00F3n:"), { x: dims.mx + dims.usableW - 180, y: ctx.y, size: 10.5, font: helvB, color: gray(0.3) });
    drawTextRight(pS, mostrarPrecioLimpio(subSec), dims.mx + dims.usableW - 6, ctx.y, { size: 10.5, font: helvB, color: gray(0.3) });
    ctx.y -= 16;
    delete ctx.__detCols;
  }

  // Totales generales
  ctx.y -= 6;
  rule(currentPage(), dims.mx + 336, ctx.y, dims.pageW - dims.mx, emsRgb(), 1);
  ctx.y -= 12;
  const pTot = currentPage();
  pTot.drawText("Subtotal:", { x: dims.mx + 336, y: ctx.y, size: 10.5, font: helvB, color: gray(0.25) });
  drawTextRight(pTot, mostrarPrecioLimpio(subtotal), dims.pageW - dims.mx, ctx.y, { size: 10.5, font: helvB, color: gray(0.25) });
  ctx.y -= 13;
  if (iva > 0) {
    pTot.drawText("IVA (16%):", { x: dims.mx + 336, y: ctx.y, size: 10.5, font: helvB, color: gray(0.25) });
    drawTextRight(pTot, mostrarPrecioLimpio(iva), dims.pageW - dims.mx, ctx.y, { size: 10.5, font: helvB, color: emsRgb() });
    ctx.y -= 13;
  }
  pTot.drawText("Total:", { x: dims.mx + 336, y: ctx.y, size: 11.5, font: helvB, color: emsRgb() });
  drawTextRight(pTot, mostrarPrecioLimpio(total), dims.pageW - dims.mx, ctx.y, { size: 11.5, font: helvB, color: emsRgb() });
  ctx.y -= 14;

  // Anexos fotogr\u00E1ficos ? galer?a packed
  if (Array.isArray(fotosCotizacion) && fotosCotizacion.length) {
    const s = getSettings();
    const pdfCfg = s?.pdf || {};
    await drawSmartGallery(pdfDoc, ctx, fotosCotizacion.slice(0, 10), {
      title: "Anexos fotogr\u00E1ficos",
      captions: false,
      baseTargetRowH: Number(pdfCfg.galleryBase)||200,
      minRowH: Number(pdfCfg.galleryMin)||160,
      maxRowH: Number(pdfCfg.galleryMax)||235,
      minImgW: 150,
      gutter: 8,
      rowPad: 5
    });
  }

  // Observaciones
  if ((datos.notas || "").trim()) {
    ensureSpace(pdfDoc, ctx, 48);
    ctx.y = drawSectionTitle(currentPage(), dims.mx, ctx.y, "Observaciones", fonts, { titleGap: 8, dryRun: false });
    const itemsObs = parseObservaciones(datos.notas);
    if (itemsObs.length) {
      drawBulletList(pdfDoc, ctx, itemsObs, { bullet: "-", fontSize: 10, lineGap: 4, leftPad: 8, bulletGap: 6 });
    }
  }

  // T\u00E9rminos y Condiciones (desde ajustes o por defecto)
  try {
    const s = getSettings();
    const tc = (s && typeof s.tc === 'string' && s.tc.trim()) || 'Vigencia: 15 d\u00EDas naturales a partir de la fecha de COTIZACI\u00D3N.\nPrecios en MXN. El IVA se incluye s\u00F3lo si est\u00E1 indicado.\nTiempo de entrega sujeto a confirmaci?n. Garant?a limitada por defecto de fabricaci?n y/o servicio seg?n aplique.';
    if (tc && String(tc).trim()) {
      ensureSpace(pdfDoc, ctx, 48);
      ctx.y = drawSectionTitle(currentPage(), dims.mx, ctx.y, "T\u00E9rminos y Condiciones", fonts, { titleGap: 8, dryRun: false });
      drawLabeledCard(pdfDoc, ctx, { label: "T\u00E9rminos", text: String(tc).trim(), fontSize: 10 });
    }
  } catch {}

  applyFooters(pdfDoc, ctx.pages, fonts, dims);

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });

  // Si es preview, retornar los bytes directamente
  if (isPreview) {
    showProgress(false, 100, "Vista previa lista");
    return pdfBytes;
  }

  // Si no es preview, proceder con download y luego compartir (si fue solicitado)
  showProgress(true, 90, "Exportando...");
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Cotizacion_${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    // Descargar
    if (isIOS()) {
      window.open(url, '_blank', 'noopener');
    } else {
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
    }
    // Compartir (si aplica y est\u00E1 soportado)
    if (share && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "COTIZACI\u00D3N", text: `COTIZACI\u00D3N ${datos.numero||""} de Electromotores Santana` });
      } catch (_) { /* usuario cancel? o no disponible */ }
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showProgress(false, 100, "PDF Listo");
  }
}

// Variante detallada: Concepto, Cantidad, Unidad, P. Unitario, Total
function renderCotSeccionDet(seccion = {}, rowId) {
  const id = rowId || newUID();
  const items = Array.isArray(seccion.items) ? seccion.items : [];
  const itemsHtml = items.map(it => {
    const cantidad = it.cantidad ?? '';
    const unidad = it.unidad ?? '';
    const punit = it.precioUnit ?? '';
    const tot = (Number(cantidad)||0) * (Number(punit)||0);
    return `
      <tr>
        <td><input type="text" name="concepto" value="${safe(it.concepto)}" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences"></td>
        <td style="width:80px"><input type="number" name="cantidadSec" min="0" step="1" value="${safe(cantidad)}" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))"></td>
        <td style="width:100px"><input type="text" name="unidadSec" value="${safe(unidad)}" list="unidadesEMS" autocomplete="off"></td>
        <td style="white-space:nowrap;display:flex;align-items:center;">
          <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
          <input type="number" name="precioUnitSec" min="0" step="0.01" value="${safe(punit)}" style="width:100px;" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))">
        </td>
        <td style="width:110px"><span class="cot-row-total">${mostrarPrecioLimpio(tot)}</span></td>
        <td><button type="button" class="btn-mini" onclick="this.closest('tr').remove(); recalcSeccionSubtotal(this.closest('.cot-seccion'))"><i class="fa fa-trash"></i></button></td>
      </tr>
    `;
  }).join('');
  return `
    <div class="cot-seccion" data-secid="${id}" data-mode="det">
      <div class="cot-seccion-head">
        <input type="text" class="cot-sec-title" name="sec_titulo" placeholder="T\\u00EDtulo de secci\\u00F3n (ej. Refacciones, Mano de obra)" value="${safe(seccion.titulo)}">
        <div class="cot-sec-actions">
          <button type="button" class="btn-mini" onclick="agregarRubroEnSeccion(this)"><i class="fa fa-plus"></i> Agregar rubro</button>
          <button type="button" class="btn-mini" onclick="eliminarCotSeccion(this)"><i class="fa fa-trash"></i></button>
        </div>
      </div>
      <table class="ems-items-table cot-seccion-table" data-mode="det">
        <thead>
          <tr>
            <th style="width:30%">Concepto</th>
            <th style="width:80px">Cant.</th>
            <th style="width:100px">Unidad</th>
            <th style="width:140px">P. Unitario</th>
            <th style="width:120px">Total</th>
            <th style="width:40px"></th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="cot-seccion-subtotal"><span>Subtotal secci\\u00F3n:</span> <b class="cot-subtotal-val">$0.00</b></div>
    </div>
  `;
}

function editarCotizacion(datos) {
  nuevaCotizacion();
  const form = document.getElementById("cotForm");
  form.numero.value = datos.numero || "";
  form.fecha.value = datos.fecha || "";
  form.cliente.value = datos.cliente || "";
  form.hora.value = datos.hora || "";
  if (datos.incluyeIVA) form.incluyeIVA.checked = true;
  if (datos.anticipo) {
    form.anticipo.checked = true;
    form.anticipoPorc.parentElement.style.display = '';
    form.anticipoPorc.value = datos.anticipoPorc || "";
  }
  if (form.titulo) form.titulo.value = datos.titulo || "";
  form.notas.value = datos.notas || "";

  const wrap = document.getElementById('cotSeccionesWrap');
  wrap.innerHTML = '';
  if (Array.isArray(datos.secciones) && datos.secciones.length) {
    datos.secciones.forEach(sec => agregarCotSeccion(sec));
  } else if (Array.isArray(datos.items) && datos.items.length) {
    const sec = { titulo: 'General', items: datos.items.map(it=>({ concepto: it.concepto, descripcion: '', precio: it.precio })) };
    agregarCotSeccion(sec);
  } else {
    agregarCotSeccion({ titulo: 'General', items: [{},{}] });
  }

  fotosCotizacion = Array.isArray(datos.fotos) ? [...datos.fotos] : [];
  renderCotFotosPreview();

  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
  }, 100);
}

// ----- Abrir detalle desde Historial -----
async function abrirReporte(numero) {
  let doc = await db.collection("reportes").doc(numero).get();
  if (!doc.exists) return showModal("No se encontr? el reporte con el n\u00FAmero especificado.", "error");
  const datos = doc.data();
  nuevoReporte();
  const form = document.getElementById("repForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  form.concepto.value = datos.concepto || "";
  const tbody = form.querySelector("#repItemsTable tbody");
  tbody.innerHTML = "";
  fotosItemsReporteMap = {};
  (datos.items || []).forEach((item) => {
    const id = item._id || newUID();
    fotosItemsReporteMap[id] = Array.isArray(item.fotos) ? [...item.fotos] : [];
    tbody.insertAdjacentHTML("beforeend", renderRepItemRow({ ...item, _id:id }, id, true));
  });
  if ((datos.items || []).length === 0) agregarRepItemRow();
  form.notas.value = datos.notas || "";
  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
  }, 100);
}

async function abrirDetalleEMS(tipo, numero) {
  if (tipo === "cotizacion") {
    let doc = await db.collection("cotizaciones").doc(numero).get();
    if (!doc.exists) return showModal("No se encontr? la COTIZACI\u00D3N con el n\u00FAmero especificado.", "error");
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    window.editandoReporte = true;
    abrirReporte?.(numero);
  }
}

// ======= (NUEVO) Medidor de altura de tarjeta de descripci?n =======
function measureCardHeight(ctx, text, fontSize = 11, pad = 10) {
  const { fonts, dims, opts } = ctx;
  const lines = wrapTextLines(String(text||"").trim(), fonts.reg, fontSize, dims.usableW - 2*pad);
  const bodyH = Math.max(22, lines.length * (fontSize + 3) + 2*pad);
  return 22 + 6 + bodyH + (opts.cardGap || 8); // altura total de la tarjeta
}

// ======= Motor de composici?n con PRE-FLIGHT (Reportes) =======
async function composeReportePDF({ datos, items, params, dryRun = false }) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dims = { pageW: 595.28, pageH: 841.89, mx: 32, my: 38 };
  dims.usableW = dims.pageW - dims.mx*2;
  const fonts = { reg: helv, bold: helvB };
  const logoImg = await getLogoImage(pdfDoc);

  const ctx = { 
    pages: [], y: 0, dims, fonts, datos, 
    typeLabel: "REPORTE DE SERVICIO", logoImg, _atPageStart: true,
    opts: { 
      dryRun,
      titleGap: params.titleGap,
      cardGap: params.cardGap,
      blockGap: params.blockGap
    },
    state: { prevBlock: "start", inGallery: false, currentSection: null },
    audit: { pages: 0 }
  };

  // Primera P\u00E1gina
  let page = pdfDoc.addPage([dims.pageW, dims.pageH]);
  ctx.pages.push(page);
  if (!dryRun) {
    drawWatermark(page, dims, logoImg, WATERMARK_OP);
  }
  ctx.y = addHeader(pdfDoc, page, ctx.typeLabel, datos, fonts, dims, true, logoImg, { dryRun });
  ctx._atPageStart = true;

  // CONCEPTO (si existe)
  if ((datos.concepto || "").trim()) {
    drawLabeledCard(pdfDoc, ctx, { label: "Concepto", text: datos.concepto.trim(), fontSize: 12 });
  }

  // Lista de items
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const fotos = Array.isArray(it.fotos) ? it.fotos : [];

    // Preparaci?n: estimar altura de banda + tarjeta + primera fila de fotos
    const descText = `? ${String(it.descripcion || "").trim()}`;
    const cardH = measureCardHeight(ctx, descText, 11, 10);
    const bandH = 26 + 8; // alto de la banda + respiro
    // Reserva conservadora para la 1? fila (pero compacta)
    const reserveFirstRow = fotos.length > 0 ? (params.maxRowH + 2*5 + (ctx.opts.blockGap || 6) + 18) : 0;

    // Garantiza que todo el bloque inicial del ?tem entre junto
    ensureSpace(pdfDoc, ctx, bandH + cardH + reserveFirstRow);

    // Banda de seccion
    ctx.state.currentSection = `Seccion ${i + 1}`;
    drawSectionBand(pdfDoc, ctx, ctx.state.currentSection);

    // DESCRIPCI?N (p?ldora) con reserva de la primera fila de fotos
    drawLabeledCard(pdfDoc, ctx, { label: "Descripci\\u00F3n", text: descText, fontSize: 11, reserveBelow: reserveFirstRow });

    // Fotos del ?tem ? galer?a packed
    if (fotos.length) {
      await drawSmartGallery(pdfDoc, ctx, fotos, {
        title: null,
        captions: false,
        baseTargetRowH: params.baseRowH,
        minRowH: params.minRowH,
        maxRowH: params.maxRowH,
        minImgW: 150,
        gutter: 8,
        rowPad: 5
      });
    }

    // Separador suave entre items (m?s corto)
    if (i < items.length - 1) {
      const needed = 8;
      ensureSpace(pdfDoc, ctx, needed);
      if (!dryRun) rule(ctx.pages[ctx.pages.length - 1], dims.mx, ctx.y, dims.pageW - dims.mx, gray(0.9), 0.5);
      ctx.y -= 6;
    }
  }

  // Observaciones como lista
  if ((datos.notas || "").trim()) {
    ensureSpace(pdfDoc, ctx, 48);
    if (!dryRun) ctx.y = drawSectionTitle(ctx.pages[ctx.pages.length - 1], dims.mx, ctx.y, "Observaciones", fonts, { titleGap: params.titleGap, dryRun });
    else ctx.y = drawSectionTitle(ctx.pages[ctx.pages.length - 1], dims.mx, ctx.y, "Observaciones", fonts, { titleGap: params.titleGap, dryRun: true });

    const itemsObs = parseObservaciones(datos.notas);
    if (itemsObs.length) {
      drawBulletList(pdfDoc, ctx, itemsObs, { bullet: "-", fontSize: 10, lineGap: 4, leftPad: 8, bulletGap: 6 });
    }
  }

  ctx.audit.pages = ctx.pages.length;
  return { pdfDoc, ctx };
}

// ======= GUARDADO Y PDF DE REPORTES ==========
async function enviarReporte(e) {
  e.preventDefault();
  showSaved("Guardando...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    const id = tr.getAttribute('data-rowid') || newUID();
    items.push({
      _id: id,
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporteMap[id] || [])
    });
  });
  if (!datos.numero || !datos.cliente || !items.length) {
    showSaved("Faltan datos");
    showModal("Por favor completa todos los campos requeridos: n\u00FAmero, cliente y al menos un item.", "warning");
    return;
  }
  savePredictEMSCloud("cliente", datos.cliente);
  if (datos.concepto) savePredictEMSCloud("concepto", datos.concepto);
  items.forEach(it => savePredictEMSCloud("descripcion", it.descripcion));
  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  if (!navigator.onLine) {
    showModal("Sin conexi?n a Internet. Los datos se guardar?n localmente. Intenta guardar cuando tengas conexi?n.", "warning");
    showSaved("Offline");
    return;
  }
  await db.collection("reportes").doc(datos.numero).set(reporte);
  localStorage.removeItem('EMS_REP_BORRADOR');
  showSaved("?Reporte guardado!");
  renderInicio();
}

async function guardarReporteDraft() {
  const form = document.getElementById('repForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    const id = tr.getAttribute('data-rowid') || newUID();
    items.push({
      _id: id,
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporteMap[id] || [])
    });
  });
  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  await db.collection("reportes").doc(datos.numero || "BORRADOR").set(reporte);
  localStorage.setItem('EMS_REP_BORRADOR', JSON.stringify(reporte));
  showSaved("Reporte guardado");
}

// === Generador de Reporte con an?lisis PRE-FLIGHT y auto-ajuste ===
async function generarPDFReporte(share = false, isPreview = false) {
  // Configuraci?n de calidad seg?n modo
  const imgQuality = isPreview
    ? { maxW: 640, maxH: 640, quality: 0.5 } // Baja calidad para preview r?pido
    : PDF_IMG_DEFAULTS; // Alta calidad para PDF final

  showProgress(true, 10, isPreview ? "Analizando vista previa..." : "Analizando dise?o...");
  if (!isPreview) await guardarReporteDraft();

  const form = document.getElementById('repForm');
  if (!form) { showProgress(false); showModal("No hay formulario de reporte activo.", "error"); return; }

  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    const id = tr.getAttribute('data-rowid') || newUID();
    items.push({
      _id: id,
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporteMap[id] || []).slice(0, 6),
    });
  });

  // Par?metros iniciales compactos, con ajustes desde panel
  const s = getSettings();
  const pdfCfg = s?.pdf || {};
  let params = {
    baseRowH: Number(pdfCfg.galleryBase)||200,
    minRowH: Number(pdfCfg.galleryMin)||160,
    maxRowH: Number(pdfCfg.galleryMax)||235,
    titleGap: Number(pdfCfg.titleGap)||8,
    cardGap: Number(pdfCfg.cardGap)||8,
    blockGap: Number(pdfCfg.blockGap)||6
  };

  // --- Pre-flight con hasta 2 ajustes autom?ticos ---
  for (let attempt = 0; attempt < 2; attempt++) {
    const { ctx } = await composeReportePDF({ datos, items, params, dryRun: true });
    if (ctx.audit.pages >= 6) {
      // documento muy largo: compactar m?s
      params.baseRowH = Math.max(180, params.baseRowH - 10);
      params.minRowH  = Math.max(150, params.minRowH - 8);
      params.maxRowH  = Math.max(210, params.maxRowH - 12);
      params.cardGap  = Math.max(6, params.cardGap - 2);
      params.blockGap = Math.max(6, params.blockGap - 2);
      params.titleGap = Math.max(6, params.titleGap - 2);
      continue;
    }
    break;
  }

  showProgress(true, 45, "Componiendo PDF...");

  // --- Render final (no dry run) ---
  const { pdfDoc, ctx } = await composeReportePDF({ datos, items, params, dryRun: false });

  // T\u00E9rminos y Condiciones (desde ajustes o por defecto)
  try {
    const s = getSettings();
    const tc = (s && typeof s.tc === 'string' && s.tc.trim()) || 'Vigencia: 15 d\u00EDas naturales a partir de la fecha de COTIZACI\u00D3N.\nPrecios en MXN. El IVA se incluye s\u00F3lo si est\u00E1 indicado.\nTiempo de entrega sujeto a confirmaci?n. Garant?a limitada por defecto de fabricaci?n y/o servicio seg?n aplique.';
    if (tc && String(tc).trim()) {
      ensureSpace(pdfDoc, ctx, 48);
      ctx.y = drawSectionTitle(ctx.pages[ctx.pages.length - 1], ctx.dims.mx, ctx.y, "T\u00E9rminos y Condiciones", ctx.fonts, { titleGap: 8, dryRun: false });
      drawLabeledCard(pdfDoc, ctx, { label: "T\u00E9rminos", text: String(tc).trim(), fontSize: 10 });
    }
  } catch {}

  // Pie de P\u00E1gina en todas
  applyFooters(pdfDoc, ctx.pages, ctx.fonts, ctx.dims);

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });

  // Si es preview, retornar los bytes directamente
  if (isPreview) {
    showProgress(false);
    showSaved("Vista previa lista");
    return pdfBytes;
  }

  // Si no es preview, proceder con download/share normal
  showProgress(true, 90, "Exportando...");

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const fileName = `Reporte_${datos.numero || "reporte"}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    // Descargar primero
    if (isIOS()) {
      window.open(url, '_blank', 'noopener');
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // Compartir si fue solicitado y est\u00E1 soportado
    if (share && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Reporte", text: `Reporte ${datos.numero||""} de Electromotores Santana` }); } catch {}
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showProgress(false);
  }
}

// ====== Eliminar docs ======
async function eliminarCotizacionCompleta(numero) {
  if (!numero) {
    const form = document.getElementById('cotForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return showModal("No se encontr? el n\u00FAmero de COTIZACI\u00D3N.", "error");
  const confirmed = await showConfirm("?est\u00E1s seguro que deseas eliminar esta COTIZACI\u00D3N? Esta Acción no se puede deshacer.", "Confirmar eliminaci?n");
  if (!confirmed) return;
  try {
    await db.collection("cotizaciones").doc(numero).delete();
    showSaved("COTIZACI\u00D3N eliminada");
    localStorage.removeItem('EMS_COT_BORRADOR');
    renderInicio();
  } catch (e) {
    showModal("Error eliminando COTIZACI\u00D3N: " + (e.message || e), "error");
  }
}
async function eliminarReporteCompleto(numero) {
  if (!numero) {
    const form = document.getElementById('repForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return showModal("No se encontr? el n\u00FAmero de reporte.", "error");
  const confirmed = await showConfirm("?est\u00E1s seguro que deseas eliminar este reporte? Esta Acción no se puede deshacer.", "Confirmar eliminaci?n");
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

// ====== Sobrescrituras de confirmaci?n por palabra en Acciónes destructivas ======
function confirmByTyping(seed = 'eliminar', title = 'Confirmar Acción', onConfirm = ()=>{}) {
  const words = ['eliminar','borrar','confirmar','continuar','aprobar','aceptar'];
  const w = words[Math.floor(Math.random()*words.length)];
  const overlay = document.createElement('div');
  overlay.className = 'ems-confirm-overlay';
  overlay.innerHTML = `
    <div class="ems-confirm-box">
      <h3>${title}</h3>
      <p>Escribe <b>${w}</b> para confirmar. Esta Acción no se puede deshacer.</p>
      <input type="text" id="emsConfirmInput" placeholder="Escribe la palabra aqu?" style="width:100%;padding:10px;border:1px solid #d2dbe7;border-radius:8px;">
      <div class="ems-confirm-actions">
        <button class="btn-mini" id="emsConfirmCancel">Cancelar</button>
        <button class="btn-danger" id="emsConfirmOk"><i class="fa fa-trash"></i> Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=>{ try { document.body.removeChild(overlay); } catch {} };
  overlay.querySelector('#emsConfirmCancel').onclick = close;
  overlay.querySelector('#emsConfirmOk').onclick = ()=>{
    const val = overlay.querySelector('#emsConfirmInput').value.trim().toLowerCase();
    if (val === w) { try { onConfirm(); } finally { close(); } }
    else { showToast('Palabra incorrecta. Intenta nuevamente.', 'error'); }
  };
}

// Re-definir eliminaciones puntuales para requerir confirmaci?n por palabra
const __orig_eliminarCotItemRow = typeof eliminarCotItemRow === 'function' ? eliminarCotItemRow : null;
function eliminarCotItemRow(btn){
  confirmByTyping('eliminar','Eliminar este elemento de COTIZACI\u00D3N',()=>{
    try{ const tr = btn.closest('tr'); tr && tr.remove(); recalcTotalesCotizacion?.(); }catch{}
  });
}

const __orig_eliminarRepItemRow = typeof eliminarRepItemRow === 'function' ? eliminarRepItemRow : null;
function eliminarRepItemRow(btn){
  confirmByTyping('eliminar','Eliminar esta actividad del reporte',()=>{
    try{
      const tr = btn.closest('tr');
      const id = tr?.getAttribute('data-rowid');
      if (id && fotosItemsReporteMap[id]) delete fotosItemsReporteMap[id];
      tr && tr.remove();
    }catch{}
  });
}

const __orig_eliminarFotoRepItem = typeof eliminarFotoRepItem === 'function' ? eliminarFotoRepItem : null;
function eliminarFotoRepItem(btn, id, fidx){
  confirmByTyping('borrar','Eliminar esta imagen del item',()=>{
    try{
      if (!fotosItemsReporteMap[id]) return;
      fotosItemsReporteMap[id].splice(fidx,1);
      const tr = btn.closest('tr');
      const desc = tr?.querySelector('textarea')?.value || '';
      tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporteMap[id], _id:id }, id, true);
      agregarDictadoMicros(); activarPredictivosInstantaneos();
    }catch{}
  });
}

const __orig_eliminarFotoCot = typeof eliminarFotoCot === 'function' ? eliminarFotoCot : null;
function eliminarFotoCot(index){
  confirmByTyping('borrar','Eliminar esta imagen de la COTIZACI\u00D3N',()=>{
    try{ fotosCotizacion.splice(index,1); renderCotFotosPreview(); guardarCotizacionDraft?.(); }catch{}
  });
}

const __orig_eliminarCotizacionCompleta = typeof eliminarCotizacionCompleta === 'function' ? eliminarCotizacionCompleta : null;
async function eliminarCotizacionCompleta(numero){
  if (!numero){ const form = document.getElementById('cotForm'); if (form && form.numero && form.numero.value) numero=form.numero.value; }
  if (!numero) return showModal('No se encontr? el n\u00FAmero de COTIZACI\u00D3N.', 'error');
  confirmByTyping('eliminar','Para confirmar escribe la palabra indicada', async ()=>{
    try{ await db.collection('cotizaciones').doc(numero).delete(); showSaved('COTIZACI\u00D3N eliminada'); localStorage.removeItem('EMS_COT_BORRADOR'); renderInicio(); }
    catch(e){ showModal('Error eliminando COTIZACI\u00D3N: '+(e?.message||e), 'error'); }
  });
}

const __orig_eliminarReporteCompleto = typeof eliminarReporteCompleto === 'function' ? eliminarReporteCompleto : null;
async function eliminarReporteCompleto(numero){
  if (!numero){ const form = document.getElementById('repForm'); if (form && form.numero && form.numero.value) numero=form.numero.value; }
  if (!numero) return showModal('No se encontr? el n\u00FAmero de reporte.', 'error');
  confirmByTyping('eliminar','Para confirmar escribe la palabra indicada', async ()=>{
    try{ await db.collection('reportes').doc(numero).delete(); showSaved('Reporte eliminado'); localStorage.removeItem('EMS_REP_BORRADOR'); renderInicio(); }
    catch(e){ showModal('Error eliminando reporte: '+(e?.message||e), 'error'); }
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
        <h3 style="margin:0">Ajustes r?pidos</h3>
        <button class="btn-mini" onclick="this.closest('.ems-settings-overlay').remove()"><i class='fa fa-times'></i></button>
      </div>
      <div class="ems-settings-body">
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Color principal</label><input type="color" id="setThemeColor" value="${themeHex}"></div>
          <div class="ems-form-group"><label>Mostrar cr?dito (pie de P\u00E1gina)</label><select id="setShowCredit"><option value="1" ${s.showCredit!==false?'selected':''}>S?</option><option value="0" ${s.showCredit===false?'selected':''}>No</option></select></div>
        </div>
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Tama?o base de fotos (px)</label><input type="number" id="setGalBase" min="120" max="300" value="${pdf.galleryBase||200}"></div>
          <div class="ems-form-group"><label>Tama?o m?nimo (px)</label><input type="number" id="setGalMin" min="120" max="260" value="${pdf.galleryMin||160}"></div>
          <div class="ems-form-group"><label>Tama?o m?ximo (px)</label><input type="number" id="setGalMax" min="160" max="300" value="${pdf.galleryMax||235}"></div>
        </div>
        <div class="ems-form-row">
          <div class="ems-form-group"><label>Espaciado de t\u00EDtulos</label><input type="number" id="setTitleGap" min="4" max="20" value="${pdf.titleGap||8}"></div>
          <div class="ems-form-group"><label>Espaciado entre tarjetas</label><input type="number" id="setCardGap" min="4" max="20" value="${pdf.cardGap||8}"></div>
          <div class="ems-form-group"><label>Espaciado entre bloques</label><input type="number" id="setBlockGap" min="4" max="20" value="${pdf.blockGap||6}"></div>
        </div>
        <div class="ems-form-group">
          <label>T\u00E9rminos y Condiciones (aparecen al final del PDF)</label>
          <textarea id="setTC" rows="4" placeholder="Escribe aqu? tus T\u00E9rminos...">${(s.tc||'')}</textarea>
          <small>Se guardan en el dispositivo y se incluyen en Cotizaciones y Reportes.</small>
        </div>
      </div>
      <div class="ems-form-actions">
        <button class="btn-mini" onclick="this.closest('.ems-settings-overlay').remove()">Cancelar</button>
        <button class="btn-primary" id="btnSaveSettings">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // A?adir control de "Tabla detallada" para cotizaciones
  try {
    const body = overlay.querySelector('.ems-settings-body');
    if (body && !overlay.querySelector('#setCotDet')) {
      const row = document.createElement('div');
      row.className = 'ems-form-row';
      row.innerHTML = `<div class="ems-form-group"><label>Tabla detallada de COTIZACI\u00D3N</label>
        <label class="ems-switch"><input type="checkbox" id="setCotDet" ${getSettings()?.cotDetallado? 'checked':''}><span class="ems-switch-ui" aria-hidden="true"></span></label>
      </div>`;
      body.insertBefore(row, body.firstElementChild?.nextElementSibling || null);
    }
  } catch {}
  // Ayudas r\u00E1pidas (??)
  try {
    const addHelpFor = (sel, tip) => {
      const el = overlay.querySelector(sel);
      if (!el) return;
      const label = el.closest('.ems-form-group')?.querySelector('label');
      if (!label) return;
      const h = document.createElement('span');
      h.className = 'ems-help';
      h.title = tip;
      h.textContent = '?';
      label.appendChild(h);
    };
    addHelpFor('#setThemeColor', 'Color usado en botones y PDF.');
    addHelpFor('#setShowCredit', 'Muestra o no la leyenda en el pie del PDF.');
    addHelpFor('#setGalBase', 'Altura objetivo de las filas de fotos en el PDF.');
    addHelpFor('#setGalMin', 'Altura m?nima posible de una fila de fotos.');
    addHelpFor('#setGalMax', 'Altura m?xima posible de una fila de fotos.');
    addHelpFor('#setTitleGap', 'Espacio inferior bajo cada t\u00EDtulo en el PDF.');
    addHelpFor('#setCardGap', 'Separaci?n entre bloques de texto tipo tarjeta.');
    addHelpFor('#setBlockGap', 'Separaci?n general entre secciones.');
    // Default de T&C si vac?o
    const tc = overlay.querySelector('#setTC');
    if (tc && !String(tc.value||'').trim()) {
      tc.value = 'Vigencia: 15 d\u00EDas naturales a partir de la fecha de COTIZACI\u00D3N.\nPrecios en MXN. El IVA se incluye s\u00F3lo si est\u00E1 indicado.\nTiempo de entrega sujeto a confirmaci?n. Garant?a limitada por defecto de fabricaci?n y/o servicio seg?n aplique.';
    }
    addHelpFor('#setTC', 'Se insertan al final del PDF (COTIZACI\u00D3N y reporte).');
  } catch {}
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
      },
      tc: String(overlay.querySelector('#setTC').value||'').trim()
    };
    try { next.cotDetallado = !!overlay.querySelector('#setCotDet')?.checked; } catch {}
    saveSettings(next);
    showSaved('Ajustes guardados');
    try { applyThemeFromSettings(); } catch {}
    overlay.remove();
  };
}

// ====== Undo/Redo (Deshacer b?sico) ======
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

// ===== Hotfix: serializeCotizacionForm robusto (modo normal y detallado) =====
// Re-declaramos la funci�n al final del archivo para asegurar que esta versi�n prevalezca
function serializeCotizacionForm() {
  const form = document.getElementById('cotForm');
  if (!form) return null;
  const datos = Object.fromEntries(new FormData(form));
  const secciones = [];
  document.querySelectorAll('#cotSeccionesWrap .cot-seccion').forEach(sec => {
    const titulo = (sec.querySelector('input[name="sec_titulo"]')?.value || '').trim();
    const items = [];
    sec.querySelectorAll('tbody tr').forEach(tr => {
      const concepto = tr.querySelector('input[name="concepto"]')?.value || '';
      if (tr.querySelector('input[name="precioUnitSec"]')) {
        const cantidad = Number(tr.querySelector('input[name="cantidadSec"]')?.value || 0) || 0;
        const unidad = tr.querySelector('input[name="unidadSec"]')?.value || '';
        const precioUnit = Number(tr.querySelector('input[name="precioUnitSec"]')?.value || 0) || 0;
        const total = cantidad * precioUnit;
        if (concepto || cantidad || unidad || precioUnit) items.push({ concepto, cantidad, unidad, precioUnit, total });
      } else {
        const descripcion = tr.querySelector('textarea[name="descripcion"]')?.value || '';
        const precio = Number(tr.querySelector('input[name="precioSec"]')?.value || 0) || 0;
        if (concepto || descripcion || precio) items.push({ concepto, descripcion, precio });
      }
    });
    if (titulo || items.length) secciones.push({ titulo, items });
  });
  return { ...datos, secciones, fotos: (window.fotosCotizacion||[]).slice(0) };
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





// Agrega una seccion DETALLADA expl�citamente desde la UI
function agregarCotSeccionDet(preload = null) {
  const wrap = document.getElementById('cotSeccionesWrap');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', renderCotSeccionDet(preload||{ items:[{},{},] }));
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
  recalcTotalesCotizacion();
}

// Render de seccion DETALLADA (Concepto, Cantidad, Unidad, P. Unitario, Total)
function renderCotSeccionDet(seccion = {}, rowId) {
  const id = rowId || newUID();
  const items = Array.isArray(seccion.items) ? seccion.items : [];
  const itemsHtml = items.map(it => {
    const cantidad = it.cantidad ?? '';
    const unidad = it.unidad ?? '';
    const punit = it.precioUnit ?? '';
    const tot = (Number(cantidad)||0) * (Number(punit)||0);
    return `
      <tr>
        <td><input type="text" name="concepto" list="conceptosEMS" autocomplete="off" spellcheck="true" autocapitalize="sentences" value="${safe(it.concepto)}"></td>
        <td style="width:80px"><input type="number" name="cantidadSec" min="0" step="1" value="${safe(cantidad)}" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))"></td>
        <td style="width:100px"><input type="text" name="unidadSec" list="unidadesEMS" autocomplete="off" value="${safe(unidad)}"></td>
        <td style="white-space:nowrap;display:flex;align-items:center;">
          <span style=\"margin-right:4px;color:#13823b;font-weight:bold;\">$</span>
          <input type="number" name="precioUnitSec" min="0" step="0.01" style="width:100px;" value="${safe(punit)}" oninput="recalcSeccionSubtotal(this.closest('.cot-seccion'))">
        </td>
        <td style="width:110px"><span class="cot-row-total">${mostrarPrecioLimpio(tot)}</span></td>
        <td><button type="button" class="btn-mini" onclick="this.closest('tr').remove(); recalcSeccionSubtotal(this.closest('.cot-seccion'))"><i class="fa fa-trash"></i></button></td>
      </tr>
    `;
  }).join('');
  return `
    <div class="cot-seccion" data-secid="${id}" data-mode="det">
      <div class="cot-seccion-head">
        <input type="text" class="cot-sec-title" name="sec_titulo" placeholder="T\\u00EDtulo de secci\\u00F3n (ej. Refacciones, Mano de obra)" value="${safe(seccion.titulo)}">
        <div class="cot-sec-actions">
          <button type="button" class="btn-mini" onclick="agregarRubroEnSeccion(this)"><i class="fa fa-plus"></i> Agregar rubro</button>
          <button type="button" class="btn-mini" onclick="eliminarCotSeccion(this)"><i class="fa fa-trash"></i></button>
        </div>
      </div>
      <table class="ems-items-table cot-seccion-table" data-mode="det">
        <thead>
          <tr>
            <th style="width:30%">Concepto</th>
            <th style="width:80px">Cant.</th>
            <th style="width:100px">Unidad</th>
            <th style="width:140px">P. Unitario</th>
            <th style="width:120px">Total</th>
            <th style="width:40px"></th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="cot-seccion-subtotal"><span>Subtotal secci\\u00F3n:</span> <b class="cot-subtotal-val">$0.00</b></div>
    </div>
  `;
}












try { if (typeof initActionDelegates === 'function') initActionDelegates(); } catch {}





















