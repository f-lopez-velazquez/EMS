/* EMS - Cotizaciones y Reportes (app.js)
   - Arregla error "$1 is not defined"
   - Guarda correctamente cotizaciones (items + notas + fotos)
   - Soporte de hasta 5 fotos por Cotización usando Cloudinary
   - Historial combinado y apertura de detalles
   - PDF de Cotización con imágenes
   - Autosave (borrador) y botón Eliminar en edición
   - Compatible con Firebase v8.10.1 (app + firestore)
*/

// ================== CONFIGURACIONES ==================

// Logo para PDF (puedes poner un PNG propio o dejar el ícono de la PWA)
const LOGO_URL = "icons/icon-512.png";

// Datos de contacto que aparecen en el PDF
const EMS_CONTACT = {
  empresa: "Electromotores Santana",
  direccion: "Ojuelos # 197, San Jerónimo Tepetlacalco, Tlalnepantla, Edo. Méx.",
  telefono: "55-1234-5678",
  correo: "electromotoressantana@gmail.com",
};

// --- Firebase ---
// (Usa tus propias credenciales)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Cloudinary ---
// Cambia estos valores por los tuyos (o deja los de tus presets)
const CLOUDINARY_CLOUD = "ds9b1mczi";      // <---- cámbialo
const CLOUDINARY_PRESET = "ml_default";    // <---- cámbialo

// Estado global para fotos
let fotosItemsReporte = [];     // Array de arrays (por ítem) para Reportes
let fotosCotizacion = [];       // Array de URLs para Cotización

// ================== UTILIDADES UI ==================

function ahora() {
  const d = new Date();
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function breakTextLines(text, font, size, maxW) {
  // Rompe texto simple para PDFLib
  const words = (text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? (line + " " + w) : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

let savedTimer = null;
function showSaved(msg = "Guardado.") {
  let bar = document.getElementById("progress-bar");
  if (!bar) return;
  bar.style.display = "flex";
  bar.innerHTML = `<div class="progress-inner" id="progress-inner"> ${msg}</div>`;
  const inner = document.getElementById("progress-inner");
  requestAnimationFrame(() => {
    inner.style.width = "100%";
  });
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    bar.style.display = "none";
    inner.style.width = "0%";
  }, 1200);
}

// Predictivos (muy simple, guardados en Firestore colección "predictivos")
async function savePredictEMSCloud(tipo, valor) {
  if (!valor || !valor.trim()) return;
  const docRef = db.collection("predictivos").doc(tipo);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    let arr = [];
    if (snap.exists) arr = snap.data().values || [];
    if (!arr.includes(valor)) {
      arr.unshift(valor);
      arr = arr.slice(0, 60);
    }
    tx.set(docRef, { values: arr });
  });
}

async function loadPredictEMSCloud() {
  const tipos = ["cliente", "concepto", "unidad", "descripcion"];
  const res = {};
  for (const t of tipos) {
    try {
      const s = await db.collection("predictivos").doc(t).get();
      res[t] = s.exists ? (s.data().values || []) : [];
    } catch { res[t] = []; }
  }
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = (res.cliente || []).map(v=>`<option value="${v}">`).join("");
  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = (res.concepto || []).map(v=>`<option value="${v}">`).join("");
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = (res.unidad || []).map(v=>`<option value="${v}">`).join("");
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = (res.descripcion || []).map(v=>`<option value="${v}">`).join("");
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

// ================== HOME / HISTORIAL ==================

async function cargarHistorialEMS(filtro = "") {
  const cont = document.getElementById("historialEMS");
  if (!cont) return;
  cont.innerHTML = "<div class='ems-historial-cargando'>Cargando…</div>";

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

  cont.innerHTML = items.slice(0,20).map(x => `
    <div class="ems-card-ems ${x.tipo === "cotizacion" ? "ems-cotizacion" : "ems-reporte"}"
         onclick="abrirDetalleEMS('${x.tipo}', '${x.numero}')">
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

  const buscar = document.getElementById("buscarEMS");
  if (buscar && !buscar._listen) {
    buscar._listen = true;
    buscar.addEventListener("input", e => cargarHistorialEMS(e.target.value));
  }
}

function renderInicio() {
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  fotosItemsReporte = [];
  fotosCotizacion = [];
  document.getElementById("root").innerHTML = `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Cotizaciones y Reportes</span>
      </div>
    </div>
    <div class="ems-main-btns">
      <button onclick="nuevaCotizacion()" class="btn-primary"><i class="fa fa-file-invoice"></i> Nueva Cotización</button>
      <button onclick="nuevoReporte()" class="btn-secondary"><i class="fa fa-clipboard-list"></i> Nuevo Reporte</button>
    </div>
    <div class="ems-historial">
      <div class="ems-historial-header">
        <h2><i class="fa fa-clock"></i> Recientes</h2>
        <input type="text" id="buscarEMS" placeholder="Buscar por cliente, número o fecha.">
      </div>
      <div id="historialEMS" class="ems-historial-list"></div>
    </div>
  `;
  cargarHistorialEMS();
}

window.onload = () => {
  renderInicio();
  if (!navigator.onLine) console.log("offline");
};

// ================== COTIZACIÓN ==================

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
  activarPredictivosInstantaneos();
}
function eliminarCotItemRow(btn) {
  btn.closest('tr').remove();
}

// UI para galería de fotos de Cotización
function renderFotosCotizacion() {
  const cont = document.getElementById("cotFotos");
  if (!cont) return;
  const max = 5;
  let html = `<div class="ems-cot-fotos-row">`;
  fotosCotizacion.forEach((url, i) => {
    html += `
      <div class="ems-rep-foto">
        <img src="${url}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #dbe2ea;display:block;margin:auto;">
        <button type="button" class="ems-btn-delimg" title="Eliminar imagen" onclick="eliminarFotoCot(${i})"><i class="fa fa-trash"></i></button>
      </div>`;
  });
  html += `</div>`;
  if (fotosCotizacion.length < max) {
    html += `
      <input type="file" accept="image/*" multiple
             style="display:block; margin-top:7px;"
             onchange="subirFotoCot(this)">
      <div style="font-size:0.92em; color:#888;">${max - fotosCotizacion.length} fotos disponibles</div>`;
  }
  cont.innerHTML = html;
}

async function subirFotoCot(input) {
  if (!input.files || input.files.length === 0) return;
  const restantes = 5 - fotosCotizacion.length;
  const files = Array.from(input.files).slice(0, restantes);
  input.disabled = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    showSaved(`Subiendo imagen ${i+1} de ${files.length}…`);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: "POST", body: fd
      });
      const data = await res.json();
      if (data.secure_url) fotosCotizacion.push(data.secure_url);
    } catch (err) {
      console.error(err);
      alert("No se pudo subir una imagen");
    }
  }
  input.value = "";
  input.disabled = false;
  renderFotosCotizacion();
}

function eliminarFotoCot(idx) {
  fotosCotizacion.splice(idx, 1);
  renderFotosCotizacion();
}

function nuevaCotizacion() {
  fotosCotizacion = [];
  let volverBtn = `
    <button class="btn-secondary" onclick="renderInicio()" style="margin-bottom:14px;">
      <i class="fa fa-arrow-left"></i> Volver al inicio
    </button>`;

  document.getElementById('root').innerHTML = volverBtn + `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Nueva Cotización</span>
      </div>
    </div>
    <form id="cotForm" class="ems-form" autocomplete="off">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. Cotización</label>
          <input type="text" name="numero" required placeholder="Ej. COT-2025-001">
        </div>
        <div class="ems-form-group">
          <label>Fecha</label>
          <input type="date" name="fecha" required>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora" value="${new Date().toTimeString().slice(0,5)}">
        </div>
      </div>

      <div class="ems-form-row">
        <div class="ems-form-group" style="flex:2">
          <label>Cliente</label>
          <input type="text" name="cliente" list="clientesEMS" placeholder="Nombre del cliente" required>
          <datalist id="clientesEMS"></datalist>
        </div>
        <div class="ems-form-group">
          <label><input type="checkbox" name="incluyeIVA"> Incluir IVA (16%)</label>
        </div>
        <div class="ems-form-group">
          <label><input type="checkbox" name="anticipo" onchange="document.querySelector('[name=anticipoPorc]').parentElement.style.display = this.checked ? '' : 'none'"> Anticipo</label>
          <div style="display:none">
            <input type="number" name="anticipoPorc" min="0" max="100" step="5" placeholder="% anticipo">
          </div>
        </div>
      </div>

      <div class="ems-form-group">
        <label>Título del trabajo/equipo (opcional)</label>
        <input type="text" name="titulo" placeholder="Ej. Rebobinado de alternador.">
      </div>

      <div>
        <table class="ems-items-table" id="itemsTable">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Unidad</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="button" class="btn-secondary" onclick="agregarCotItemRow()">Agregar item</button>
      </div>

      <div class="ems-form-group">
        <label>Notas / Observaciones</label>
        <textarea name="notas" rows="3" placeholder="Detalles, condiciones."></textarea>
      </div>

      <div class="ems-form-group">
        <label>Fotos (hasta 5)</label>
        <div id="cotFotos"></div>
      </div>

      <div class="ems-form-actions">
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_COT_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="guardarCotizacionDraft(); generarPDFCotizacion()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarCotizacionDraft(); generarPDFCotizacion(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
  `;

  const form = document.getElementById('cotForm');
  // Draft
  let draft = localStorage.getItem('EMS_COT_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    Object.keys(draft).forEach(k => {
      if (k !== "items" && k !== "fotos" && form[k] !== undefined) form[k].value = draft[k];
    });
    const tbody = form.querySelector("#itemsTable tbody");
    tbody.innerHTML = "";
    (draft.items || []).forEach(item => tbody.insertAdjacentHTML("beforeend", renderCotItemRow(item)));
    if ((draft.items || []).length === 0) agregarCotItemRow();
    fotosCotizacion = Array.isArray(draft.fotos) ? [...draft.fotos] : [];
  } else {
    agregarCotItemRow();
  }
  renderFotosCotizacion();
  setTimeout(loadPredictEMSCloud, 50);
  activarPredictivosInstantaneos();

  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarCotizacion(e);
    localStorage.removeItem('EMS_COT_BORRADOR');
  };

  // Autosave
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('cotForm')) guardarCotizacionDraft();
  }, 15000);
}

async function enviarCotizacion(e) {
  e.preventDefault();
  showSaved("Guardando…");
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
      precio: Number(tr.querySelector('input[name="precio"]').value)
    });
  });
  if (!datos.numero || !datos.cliente || !items.length) {
    showSaved("Faltan datos");
    alert("Completa No., Cliente e items.");
    return;
  }

  savePredictEMSCloud("cliente", datos.cliente);
  items.forEach(it => {
    savePredictEMSCloud("concepto", it.concepto);
    savePredictEMSCloud("unidad", it.unidad);
  });

  const cotizacion = {
    ...datos,
    items,
    fotos: fotosCotizacion.slice(0,5),
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  showSaved("¡Cotización guardada!");
  renderInicio();
}

async function guardarCotizacionDraft() {
  const form = document.getElementById('cotForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
      precio: Number(tr.querySelector('input[name="precio"]').value)
    });
  });
  const cotizacion = {
    ...datos,
    items,
    fotos: fotosCotizacion.slice(0,5),
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  // Guarda borrador local para recuperación
  localStorage.setItem('EMS_COT_BORRADOR', JSON.stringify(cotizacion));
  // Y también en Firestore (para que el card de "Recientes" salga con datos)
  if (datos.numero) {
    await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
    showSaved("Cotización guardada");
  }
}

async function generarPDFCotizacion(share = false) {
  showSaved("Generando PDF…");
  await guardarCotizacionDraft();
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: tr.querySelector('input[name="cantidad"]').value,
      precio: tr.querySelector('input[name="precio"]').value
    });
  });

  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Medidas A4
  const pageW = 595.28, pageH = 841.89;
  const mx = 32, my = 38;
  const usableW = pageW - mx*2;
  let y = pageH - my;

  let page = pdfDoc.addPage([pageW, pageH]);

  // Marca de agua / logo
  let logoImg = null;
  try {
    const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
    logoImg = await pdfDoc.embedPng(logoBytes);
  } catch {}

  if (logoImg) {
    page.drawImage(logoImg, {
      x: (pageW-220)/2, y: (pageH-240)/2, width: 220, height: 220, opacity: 0.06
    });
  }

  // Encabezado
  if (logoImg) page.drawImage(logoImg, { x: mx, y: y - 46 + 10, width: 46, height: 46 });
  const leftX = mx + 46 + 14;
  page.drawText(EMS_CONTACT.empresa.toUpperCase(), { x: leftX, y: y + 2, size: 17, font: helvB, color: rgb(0.10,0.20,0.40) });
  page.drawText("COTIZACIÓN", { x: leftX, y: y - 16, size: 12, font: helvB, color: rgb(0.98,0.54,0.10) });
  page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 32, size: 10.5, font: helv, color: rgb(0.16,0.18,0.22) });
  page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 180, y: y + 2, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + usableW - 180, y: y - 15, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });

  y -= (46 + 24);

  // Título
  if (datos.titulo && datos.titulo.trim()) {
    const titulo = datos.titulo.trim();
    page.drawRectangle({ x: mx, y: y - 33 + 9, width: usableW, height: 33, color: rgb(0.97, 0.90, 0.82) });
    page.drawText(titulo, { x: mx+14, y: y - 3, size: 15, font: helvB, color: rgb(0.12,0.22,0.42) });
    y -= 45;
  }

  // Tabla de items (simple)
  page.drawText("CONCEPTO", { x: mx, y, size: 11, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText("CANT", { x: mx + usableW - 150, y, size: 11, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText("PRECIO", { x: mx + usableW - 90, y, size: 11, font: helvB, color: rgb(0.13,0.22,0.38) });
  y -= 14;
  page.drawLine({ start:{x:mx, y}, end:{x:pageW-mx, y}, thickness: 1, color: rgb(0.86,0.88,0.93) });
  y -= 6;

  function fmtMoney(val) {
    const s = String(val ?? "").trim();
    if (!s || s === "." || s === "-") return "";
    const n = Number(s);
    if (isNaN(n)) return "";
    return "$" + n.toLocaleString("en-US",{minimumFractionDigits:2, maximumFractionDigits:2});
  }

  let subtotal = 0;
  for (const it of items) {
    const cantidad = Number(it.cantidad);
    const precio = Number(it.precio);
    if (!isNaN(cantidad) && !isNaN(precio)) subtotal += cantidad * precio;

    const conceptoLines = breakTextLines(it.concepto || "", helv, 10, usableW - 190);
    for (const line of conceptoLines) {
      page.drawText(line, { x: mx, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32) });
      y -= 12;
    }
    page.drawText(String(it.cantidad ?? ""), { x: mx + usableW - 150, y: y + 12, size: 10, font: helv, color: rgb(0.18,0.23,0.32) });
    page.drawText(fmtMoney(it.precio), { x: mx + usableW - 90, y: y + 12, size: 10, font: helv, color: rgb(0.18,0.23,0.32) });

    y -= 6;
    page.drawLine({ start:{x:mx+8, y}, end:{x:pageW-mx-8, y}, thickness: 0.6, color: rgb(0.90,0.92,0.95) });
    y -= 8;
  }

  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal * 0.16 : 0;
  const total = subtotal + iva;
  const anticipoPorc = (form.anticipo && form.anticipo.checked && form.anticipoPorc.value) ? parseFloat(form.anticipoPorc.value) : 0;
  const anticipo = anticipoPorc ? total * (anticipoPorc/100) : 0;

  if (y < 120) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my - 60; }

  page.drawText(`Subtotal: ${fmtMoney(subtotal)}`, { x: mx + usableW - 200, y, size: 11, font: helvB, color: rgb(0.15,0.22,0.40) }); y -= 14;
  if (incluyeIVA) { page.drawText(`IVA 16%: ${fmtMoney(iva)}`, { x: mx + usableW - 200, y, size: 11, font: helvB, color: rgb(0.15,0.22,0.40) }); y -= 14; }
  page.drawText(`TOTAL: ${fmtMoney(total)}`, { x: mx + usableW - 200, y, size: 12, font: helvB, color: rgb(0.05,0.45,0.15) }); y -= 16;
  if (anticipoPorc) { page.drawText(`Anticipo ${anticipoPorc}%: ${fmtMoney(anticipo)}`, { x: mx + usableW - 200, y, size: 11, font: helvB, color: rgb(0.55,0.20,0.05) }); y -= 14; }

  // Notas
  if (datos.notas?.trim()) {
    if (y < 90) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my - 60; }
    page.drawText("Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) }); y -= 13;
    const obsLines = breakTextLines(datos.notas.trim(), helv, 10, usableW-20);
    for (const ln of obsLines) { page.drawText(ln, { x: mx+12, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32) }); y -= 12; }
  }

  // Fotos (máx 5) en 2 columnas
  if (fotosCotizacion.length) {
    if (y < 200) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my - 60; }
    page.drawText("Evidencia fotográfica:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 14;

    const imgW = 180, imgH = 120, pad = 10, cols = 2;
    for (let i = 0; i < fotosCotizacion.length; i++) {
      if (i % cols === 0) {
        if (y < imgH + 60) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my - 60; }
      }
      let imgBytes;
      try { imgBytes = await fetch(fotosCotizacion[i]).then(r=>r.arrayBuffer()); } catch { continue; }
      let img;
      try { img = await pdfDoc.embedPng(imgBytes); } catch { try { img = await pdfDoc.embedJpg(imgBytes); } catch { continue; } }
      const col = i % cols;
      const x = mx + col * (imgW + pad);
      page.drawImage(img, { x, y: y - imgH, width: imgW, height: imgH });
      if (col === cols - 1 || i === fotosCotizacion.length - 1) y -= (imgH + 10);
    }
  }

  // Pie
  let pie = [
    `${EMS_CONTACT.empresa}  •  ${EMS_CONTACT.direccion}`,
    `Tel: ${EMS_CONTACT.telefono}  •  ${EMS_CONTACT.correo}`,
    "Vigencia de la cotización: 15 días naturales a partir de la fecha de emisión."
  ];
  let py = 56;
  for (const linea of pie) {
    page.drawText(linea, { x: mx+8, y: py, size: 9.2, font: helv, color: rgb(0.10,0.20,0.56) });
    py -= 13;
  }

  const pdfBytes = await pdfDoc.save();
  showSaved("PDF listo");
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Cotizacion_${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Cotización", text: `Cotización ${datos.numero||""}` });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }
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
  const tbody = form.querySelector("#itemsTable tbody");
  tbody.innerHTML = "";
  (datos.items || []).forEach(item => tbody.insertAdjacentHTML("beforeend", renderCotItemRow(item)));
  fotosCotizacion = Array.isArray(datos.fotos) ? [...datos.fotos].slice(0,5) : [];
  renderFotosCotizacion();
  setTimeout(loadPredictEMSCloud, 50);
  activarPredictivosInstantaneos();
}

// ================== REPORTE (con fotos por ítem) ==================
// (Se mantiene tu mismo flujo; solo lo esencial)

function renderRepItemRow(item = {}, idx = 0, modoEdicion = true) {
  if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = item.fotos ? [...item.fotos] : [];
  // Agrupa fotos de 2 en 2
  let fotosHtml = '';
  const fotos = fotosItemsReporte[idx] || [];
  for (let i = 0; i < fotos.length; i += 2) {
    fotosHtml += `<div class="ems-rep-fotos-pair">`;
    for (let j = i; j < i + 2 && j < fotos.length; ++j) {
      fotosHtml += `
        <div class="ems-rep-foto">
          <img src="${fotos[j]}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #dbe2ea;display:block;margin:auto;">
          ${modoEdicion ? `<button type="button" class="ems-btn-delimg" title="Eliminar imagen" onclick="eliminarFotoRepItem(this, ${idx}, ${j}, '${fotos[j]}')"><i class="fa fa-trash"></i></button>` : ''}
        </div>`;
    }
    fotosHtml += `</div>`;
  }
  return `
    <tr>
      <td>
        <textarea name="descripcion" list="descEMS" rows="2" required placeholder="Describe la actividad" style="width:97%">${item.descripcion||""}</textarea>
        <datalist id="descEMS"></datalist>
      </td>
      <td>
        <div class="ems-rep-fotos-row" id="fotos-item-${idx}">
          ${fotosHtml}
          ${modoEdicion && (fotos.length < 6) ? `
            <input type="file" accept="image/*" multiple
              style="display:block; margin-top:7px;"
              onchange="subirFotoRepItem(this, ${idx})"
            >
            <div style="font-size:0.92em; color:#888;">${6 - fotos.length} fotos disponibles</div>
          ` : ""}
        </div>
      </td>
      <td>
        ${modoEdicion ? `<button type="button" class="ems-btn-delrow" onclick="eliminarRepItemRow(this)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    </tr>`;
}

function agregarRepItemRow() {
  const tbody = document.getElementById('repItemsTable').querySelector('tbody');
  const idx = tbody.children.length;
  fotosItemsReporte[idx] = [];
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow({}, idx, true));
  activarPredictivosInstantaneos();
}
function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const idx = Array.from(tr.parentNode.children).indexOf(tr);
  fotosItemsReporte.splice(idx, 1);
  tr.remove();
}

// Subida fotos Cloudinary por ítem
async function subirFotoRepItem(input, idx) {
  if (!input.files || input.files.length === 0) return;
  const files = Array.from(input.files).slice(0, 6 - (fotosItemsReporte[idx]?.length || 0));
  if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = [];
  input.disabled = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    showSaved(`Subiendo imagen ${i+1} de ${files.length}…`);
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
        if (fotosItemsReporte[idx].length < 6) fotosItemsReporte[idx].push(data.secure_url);
      } else {
        alert("No se pudo subir la imagen a Cloudinary");
      }
    } catch (err) {
      console.error(err);
      alert("Error subiendo imagen");
    }
  }
  input.disabled = false;
  // re-render solo el bloque de ese ítem
  const tr = input.closest('tr');
  const tbody = tr.parentElement;
  const index = Array.from(tbody.children).indexOf(tr);
  tr.outerHTML = renderRepItemRow({ descripcion: tr.querySelector('textarea[name=descripcion]').value, fotos: fotosItemsReporte[index] }, index, true);
}

function eliminarFotoRepItem(btn, idx, j) {
  if (!fotosItemsReporte[idx]) return;
  fotosItemsReporte[idx].splice(j, 1);
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  tr.outerHTML = renderRepItemRow({ descripcion: tr.querySelector('textarea[name=descripcion]').value, fotos: fotosItemsReporte[idx] }, idx, true);
}

// Nuevo Reporte (form)
function nuevoReporte() {
  window.editandoReporte = false;
  fotosItemsReporte = [];
  let volverBtn = `
    <button class="btn-secondary" onclick="renderInicio()" style="margin-bottom:14px;">
      <i class="fa fa-arrow-left"></i> Volver al inicio
    </button>`;
  document.getElementById('root').innerHTML = volverBtn + `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Nuevo Reporte</span>
      </div>
    </div>
    <form id="repForm" class="ems-form" autocomplete="off">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. Reporte</label>
          <input type="text" name="numero" required placeholder="Ej. REP-2025-001">
        </div>
        <div class="ems-form-group">
          <label>Fecha</label>
          <input type="date" name="fecha" required>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora" value="${new Date().toTimeString().slice(0,5)}">
        </div>
      </div>

      <div class="ems-form-row">
        <div class="ems-form-group" style="flex:2">
          <label>Cliente</label>
          <input type="text" name="cliente" list="clientesEMS" placeholder="Nombre del cliente" required>
          <datalist id="clientesEMS"></datalist>
        </div>
      </div>

      <table class="ems-items-table" id="repItemsTable">
        <thead>
          <tr><th>Descripción</th><th>Evidencia (máx 6)</th><th></th></tr>
        </thead>
        <tbody></tbody>
      </table>
      <button type="button" class="btn-secondary" onclick="agregarRepItemRow()">Agregar actividad</button>

      <div class="ems-form-group">
        <label>Notas / Observaciones</label>
        <textarea name="notas" rows="3" placeholder="Notas generales del servicio"></textarea>
      </div>

      <div class="ems-form-actions">
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_REP_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
      </div>
    </form>`;

  const form = document.getElementById('repForm');
  let draft = localStorage.getItem('EMS_REP_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    Object.keys(draft).forEach(k => {
      if (k !== "items" && form[k] !== undefined) form[k].value = draft[k];
    });
    const tbody = form.querySelector("#repItemsTable tbody");
    tbody.innerHTML = "";
    fotosItemsReporte = [];
    (draft.items || []).forEach((item, idx) => {
      fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
      tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
    });
    if ((draft.items || []).length === 0) agregarRepItemRow();
  } else {
    agregarRepItemRow();
  }
  setTimeout(loadPredictEMSCloud, 50);

  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarReporte(e);
    localStorage.removeItem('EMS_REP_BORRADOR');
  };

  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('repForm')) guardarReporteDraft();
  }, 15000);
}

async function enviarReporte(e) {
  e.preventDefault();
  showSaved("Guardando…");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporte[idx] || []).slice(0,6)
    });
  });
  if (!datos.numero || !datos.cliente || !items.length) {
    showSaved("Faltan datos");
    alert("Completa No., Cliente y al menos una actividad.");
    return;
  }
  savePredictEMSCloud("cliente", datos.cliente);
  items.forEach(it => savePredictEMSCloud("descripcion", it.descripcion));

  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  await db.collection("reportes").doc(datos.numero).set(reporte);
  showSaved("¡Reporte guardado!");
  renderInicio();
}

async function guardarReporteDraft() {
  const form = document.getElementById('repForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporte[idx] || []).slice(0,6)
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
  localStorage.setItem('EMS_REP_BORRADOR', JSON.stringify(reporte));
  if (datos.numero) await db.collection("reportes").doc(datos.numero).set(reporte);
  showSaved("Reporte guardado");
}

// ========= Abrir detalle (desde Historial) =========

async function abrirDetalleEMS(tipo, numero) {
  if (tipo === "cotizacion") {
    const doc = await db.collection("cotizaciones").doc(numero).get();
    if (!doc.exists) return alert("No se encontró la cotización.");
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    const doc = await db.collection("reportes").doc(numero).get();
    if (!doc.exists) return alert("No se encontró el reporte.");
    const datos = doc.data();
    nuevoReporte();
    const form = document.getElementById("repForm");
    form.numero.value = datos.numero || "";
    form.fecha.value = datos.fecha || "";
    form.cliente.value = datos.cliente || "";
    form.hora.value = datos.hora || "";
    const tbody = form.querySelector("#repItemsTable tbody");
    tbody.innerHTML = "";
    fotosItemsReporte = [];
    (datos.items || []).forEach((item, idx) => {
      fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
      tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
    });
    if ((datos.items || []).length === 0) agregarRepItemRow();
    form.notas && (form.notas.value = datos.notas || "");
  }
}

// Arranque
// (El HTML incluye <script src="app.js"></script> al final de <body>)
