// === INICIALIZACIÓN Y UTILIDADES ===
const EMS_CONTACT = {
  empresa: "ELECTROMOTORES SANTANA",
  direccion: "Carr. a Chichimequillas 306, Colonia Menchaca 2, 76147 Santiago de Querétaro, Qro.",
  telefono: "cel: 442 469 9895; Tel/Fax: 4422208910",
  correo: "electromotores.santana@gmail.com"
};
const EMS_COLOR = [0.97, 0.54, 0.11]; // rgb(248,138,29)

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

// === Cloudinary usado en reportes (lo reutilizamos en cotización) ===
const CLOUDINARY_CLOUD = "ds9b1mczi";
const CLOUDINARY_PRESET = "ml_default";

const LOGO_URL = "https://i.imgur.com/CKDrg9w.png";

let fotosItemsReporte = [];
let fotosCotizacion = []; // Hasta 5 fotos por cotización
let autoSaveTimer = null;

// ---- Helpers generales ----
function safe(val) { return (val === undefined || val === null) ? "" : String(val); }
function formatMoney(val) { return "$" + Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hoy() { return (new Date()).toISOString().slice(0, 10); }
function ahora() { const d = new Date(); return d.toTimeString().slice(0, 5); }

function mostrarPrecio(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "string" && (val.trim() === "." || val.trim() === "-")) return "";
  if (Number(val) === 0 && (val === "." || val === "-")) return "";
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

// Helper PDF: cortar texto por ancho
function breakTextLines(text = "", font, fontSize, maxWidth) {
  let lines = [];
  let currentLine = "";
  for (let char of text) {
    let nextLine = currentLine + char;
    let width = font.widthOfTextAtSize(nextLine, fontSize);
    if (width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ====== Predictivos Firestore ======
async function savePredictEMSCloud(tipo, valor, user = "general") {
  if (!valor || valor.length < 2) return;
  const docRef = db.collection("predictEMS").doc(user);
  let data = (await docRef.get()).data() || {};
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
        <input type="text" id="buscarEMS" placeholder="Buscar por cliente, número o fecha...">
      </div>
      <div id="historialEMS" class="ems-historial-list"></div>
    </div>
  `;
  cargarHistorialEMS();
}

window.onload = () => {
  renderInicio();
  if (!navigator.onLine) showOffline?.(true);
};

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
        <div class="ems-card-tipo">${x.tipo === "cotizacion" ? "Cotización" : "Reporte"}</div>
        <div class="ems-card-cliente"><b>${x.cliente || ""}</b></div>
        <div class="ems-card-fecha">${x.fecha || ""} ${x.hora ? "— " + x.hora : ""}</div>
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

// === Fotos de COTIZACIÓN (Cloudinary, máx 5) ===
async function subirFotosCot(input) {
  if (!input.files || input.files.length === 0) return;
  const cupo = 5 - (fotosCotizacion?.length || 0);
  if (cupo <= 0) { alert("Máximo 5 imágenes."); input.value = ""; return; }

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
        alert("No se pudo subir la imagen a Cloudinary");
      }
    } catch (e) {
      alert("Error al subir la imagen");
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
    </div>
    <form id="cotForm" class="ems-form" autocomplete="off">
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
      <!-- CAMPO NUEVO DE TÍTULO -->
      <div class="ems-form-group">
        <label>Título del trabajo/equipo</label>
        <input type="text" name="titulo" placeholder="Ej: Motor de 5 HP, Rebobinado de alternador..." autocomplete="off">
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
        <div class="ems-form-input-icon">
          <textarea name="notas" rows="3" placeholder="Detalles, condiciones..."></textarea>
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
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="guardarCotizacionDraft(); generarPDFCotizacion()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarCotizacionDraft(); generarPDFCotizacion(true)"><i class="fa fa-share-alt"></i> Compartir</button>
        <!-- El botón de eliminar se insertará dinámicamente -->
      </div>
    </form>
  `;

  // <<< CORRECCIÓN: definir 'form' y quitar el $1 que rompía >>>
  const form = document.getElementById('cotForm');

  // Inicializa fotos de cotización
  fotosCotizacion = [];

  // Draft
  let draft = localStorage.getItem('EMS_COT_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    Object.keys(draft).forEach(k => {
      if (k !== "items" && k !== "fotos" && form[k] !== undefined) form[k].value = draft[k];
    });
    // Items tabla
    const tbody = form.querySelector("#itemsTable tbody");
    tbody.innerHTML = "";
    (draft.items || []).forEach(item => tbody.insertAdjacentHTML("beforeend", renderCotItemRow(item)));
    if ((draft.items || []).length === 0) agregarCotItemRow();
    if (form.anticipo && form.anticipo.checked) {
      form.anticipoPorc.parentElement.style.display = '';
      form.anticipoPorc.value = draft.anticipoPorc || "";
    }
    // Fotos desde draft
    if (Array.isArray(draft.fotos)) fotosCotizacion = [...draft.fotos];
  } else {
    agregarCotItemRow();
  }

  renderCotFotosPreview();

  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
  }, 100);

  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarCotizacion(e);
    localStorage.removeItem('EMS_COT_BORRADOR');
  };

  // AUTOGUARDADO cada 15 s
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('cotForm')) guardarCotizacionDraft();
  }, 15000);

  // BOTÓN ELIMINAR SOLO EN EDICIÓN
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
        </div>
      `;
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
              onchange="subirFotoRepItem(this, ${idx})">
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
  const idx = tbody.children.length;
  fotosItemsReporte[idx] = [];
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow({}, idx, true));
  agregarDictadoMicros();
  activarPredictivosInstantaneos();
}
function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const idx = Array.from(tr.parentNode.children).indexOf(tr);
  fotosItemsReporte.splice(idx, 1);
  tr.remove();
}
async function subirFotoRepItem(input, idx) {
  if (!input.files || input.files.length === 0) return;
  const files = Array.from(input.files).slice(0, 6 - (fotosItemsReporte[idx]?.length || 0));
  if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = [];
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
        if (fotosItemsReporte[idx].length < 6) fotosItemsReporte[idx].push(data.secure_url);
      } else {
        alert("No se pudo subir la imagen a Cloudinary");
      }
    } catch (err) {
      alert("Error al subir la imagen");
    }
  }
  // Re-renderiza la fila
  const tbody = document.querySelector('#repItemsTable tbody');
  const tr = tbody.children[idx];
  const desc = tr.querySelector("textarea")?.value || "";
  tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporte[idx] }, idx, true);
  showSaved("¡Imagen(es) subida(s)!");
  input.disabled = false;
  input.value = "";
}
function eliminarFotoRepItem(btn, idx, fidx/*, url*/) {
  if (!fotosItemsReporte[idx]) return;
  fotosItemsReporte[idx].splice(fidx, 1);
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  const desc = tr.querySelector("textarea")?.value || "";
  tr.outerHTML = renderRepItemRow({ descripcion: desc, fotos: fotosItemsReporte[idx] }, idx, true);
}

// ========== Reporte: Formulario y Flujos ==========
function nuevoReporte() {
  window.editandoReporte = false;
  fotosItemsReporte = [];

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
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="guardarReporteDraft(); generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarReporteDraft(); generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
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
    fotosItemsReporte = [];
    (draft.items || []).forEach((item, idx) => {
      fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
      tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
    });
    if ((draft.items || []).length === 0) agregarRepItemRow();
  } else {
    agregarRepItemRow();
  }
  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
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
  e.preventDefault();
  showSaved("Guardando...");
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
    alert("Completa todos los campos requeridos.");
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
  if (!navigator.onLine) {
    alert("Sin conexión. Guarda localmente o espera a tener Internet.");
    showSaved("Offline");
    return;
  }
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  localStorage.removeItem('EMS_COT_BORRADOR');
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
  // Guarda remoto (como antes) y también local para recuperación offline
  await db.collection("cotizaciones").doc(datos.numero || "BORRADOR").set(cotizacion);
  localStorage.setItem('EMS_COT_BORRADOR', JSON.stringify(cotizacion));
  showSaved("Cotización guardada");
}

async function generarPDFCotizacion(share = false) {
  showSaved("Generando PDF...");
  await guardarCotizacionDraft();
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: tr.querySelector('input[name="cantidad"]').value,
      precio: tr.querySelector('input[name="precio"]').value // string para validaciones
    });
  });

  // Totales con chequeo de ".", "-"
  let subtotal = items.reduce((acc, x) => {
    const cantidadVal = String(x.cantidad).trim();
    const precioVal = String(x.precio).trim();
    if (
      cantidadVal === "" || cantidadVal === "." || cantidadVal === "-" ||
      precioVal === "" || precioVal === "." || precioVal === "-"
    ) return acc;
    let cantidad = Number(x.cantidad);
    let precio = Number(x.precio);
    if (isNaN(cantidad) || isNaN(precio)) return acc;
    return acc + (cantidad * precio);
  }, 0);
  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const iva = incluyeIVA ? subtotal * 0.16 : 0;
  const total = subtotal + iva;
  const anticipoPorc = (form.anticipo && form.anticipo.checked && form.anticipoPorc.value) ? parseFloat(form.anticipoPorc.value) : 0;
  const anticipo = anticipoPorc ? (total * (anticipoPorc/100)) : 0;

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

  // Marca de agua
  try {
    const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
    const logoImg   = await pdfDoc.embedPng(logoBytes);
    page.drawImage(logoImg, { x: (pageW-220)/2, y: (pageH-240)/2, width: 220, height: 220, opacity: 0.06 });

    const logoH = 46;
    page.drawImage(logoImg, { x: mx, y: y - logoH + 10, width: logoH, height: logoH });

    const leftX = mx + logoH + 14;
    page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y + 2, size: 17, font: helvB, color: rgb(0.10,0.20,0.40) });
    page.drawText("COTIZACIÓN", { x: leftX, y: y - 16, size: 12, font: helvB, color: rgb(0.98,0.54,0.10) });
    page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 32, size: 10.5, font: helv, color: rgb(0.16,0.18,0.22) });
    page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 180, y: y + 2, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
    page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + usableW - 180, y: y - 15, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
  } catch { /* sin logo, continúa */ }

  y -= (46 + 24);

  // TÍTULO (opcional)
  if (datos.titulo && datos.titulo.trim()) {
    const titulo = datos.titulo.trim();
    const fontSizeTitulo = 15;
    const rectHeight = 33;
    page.drawRectangle({
      x: mx, y: y - rectHeight + 9, width: usableW, height: rectHeight,
      color: rgb(0.97, 0.54, 0.11), opacity: 0.17, borderColor: rgb(0.97, 0.54, 0.11), borderWidth: 1.2
    });
    const textWidth = helvB.widthOfTextAtSize(titulo, fontSizeTitulo);
    const textX = mx + (usableW - textWidth) / 2;
    const textY = y - rectHeight/2 + 10;
    page.drawText(titulo, { x: textX, y: textY, size: fontSizeTitulo, font: helvB, color: rgb(0.97, 0.54, 0.11) });
    y -= rectHeight + 13;
  } else {
    y -= 10;
  }

  // Tabla cabecera
  page.drawRectangle({ x: mx, y: y + 2, width: usableW, height: 20, color: rgb(0.98,0.54,0.11), opacity: 0.97 });
  page.drawText("Concepto", { x: mx + 2, y: y + 6, size: 11, font: helvB, color: rgb(1,1,1) });
  page.drawText("Unidad",   { x: mx+176, y: y + 6, size: 11, font: helvB, color: rgb(1,1,1) });
  page.drawText("Cantidad", { x: mx+265, y: y + 6, size: 11, font: helvB, color: rgb(1,1,1) });
  page.drawText("Precio",   { x: mx+350, y: y + 6, size: 11, font: helvB, color: rgb(1,1,1) });
  page.drawText("Importe",  { x: mx+440, y: y + 6, size: 11, font: helvB, color: rgb(1,1,1) });

  // Líneas y filas
  let rowY = y - 16;
  let colXs = [mx, mx+176, mx+265, mx+350, mx+440, pageW-mx];
  page.drawLine({ start: { x: mx, y: rowY }, end: { x: pageW-mx, y: rowY }, thickness: 1.1, color: rgb(0.96,0.78,0.30) });
  y = rowY - 18;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const cantidadVal = String(it.cantidad).trim();
    const precioVal = String(it.precio).trim();
    if (y < 110) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my - 70;
    }
    if (i % 2 === 0) {
      page.drawRectangle({ x: mx, y: y - 2, width: usableW, height: 18, color: rgb(0.98,0.91,0.75), opacity: 0.29 });
    }
    page.drawText(String(it.concepto || ""), { x: mx+2, y, size: 10, font: helv, color: rgb(0.13,0.18,0.38) });
    page.drawText(String(it.unidad || ""),   { x: mx+176+2, y, size: 10, font: helv, color: rgb(0.13,0.18,0.38) });
    page.drawText(String(it.cantidad || ""), { x: mx+265+2, y, size: 10, font: helv, color: rgb(0.13,0.18,0.38) });
    page.drawText(mostrarPrecioLimpio(it.precio),  { x: mx+350+2, y, size: 10, font: helv, color: rgb(0.10,0.35,0.16) });

    let importe = "";
    if (cantidadVal !== "" && cantidadVal !== "." && cantidadVal !== "-" &&
        precioVal   !== "" && precioVal   !== "." && precioVal   !== "-" &&
        !isNaN(Number(it.cantidad)) && !isNaN(Number(it.precio))) {
      importe = mostrarPrecioLimpio(Number(it.cantidad) * Number(it.precio));
    }
    page.drawText(importe, { x: mx+440+2, y, size: 10, font: helv, color: rgb(0.10,0.35,0.16) });
    page.drawLine({ start: { x: mx, y: y-3 }, end: { x: pageW-mx, y: y-3 }, thickness: 0.47, color: rgb(0.98,0.85,0.48) });
    y -= 18;
  }

  // Totales
  y -= 8;
  page.drawLine({ start: { x: mx+340, y }, end: { x: pageW-mx, y }, thickness: 1.1, color: rgb(0.97, 0.54, 0.11) });
  y -= 13;
  page.drawText("Subtotal:", { x: mx+340, y, size: 10.5, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText(mostrarPrecioLimpio(subtotal), { x: mx+440, y, size: 10.5, font: helvB, color: rgb(0.12,0.20,0.40) });
  y -= 13;
  if (iva > 0) {
    page.drawText("IVA (16%):", { x: mx+340, y, size: 10.5, font: helvB, color: rgb(0.12,0.20,0.40) });
    page.drawText(mostrarPrecioLimpio(iva), { x: mx+440, y, size: 10.5, font: helvB, color: rgb(0.97,0.54,0.11) });
    y -= 13;
  }
  page.drawText("Total:", { x: mx+340, y, size: 11.5, font: helvB, color: rgb(0.97,0.54,0.11) });
  page.drawText(mostrarPrecioLimpio(total), { x: mx+440, y, size: 11.5, font: helvB, color: rgb(0.97,0.54,0.11) });
  y -= 17;
  if (anticipo > 0) {
    page.drawText(`Anticipo (${anticipoPorc}%):`, { x: mx+340, y, size: 10.5, font: helvB, color: rgb(0.97,0.54,0.11) });
    page.drawText(mostrarPrecioLimpio(anticipo), { x: mx+440, y, size: 10.5, font: helvB, color: rgb(0.97,0.54,0.11) });
    y -= 13;
  }

  // IMÁGENES DE COTIZACIÓN (si existen) — SIEMPRE fuera de "notas"
  if (Array.isArray(fotosCotizacion) && fotosCotizacion.length) {
    const pad = 16;
    const maxPorFila = 2;
    const maxAncho = Math.floor((usableW - pad) / 2);
    const maxAlto = 180;

    if (y < 80) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }
    page.drawText("Imágenes:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 14;

    let idx = 0;
    while (idx < fotosCotizacion.length) {
      const fila = fotosCotizacion.slice(idx, idx + maxPorFila);
      if (y - maxAlto - 24 < my) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }

      const escalas = [];
      let totalW = 0;
      for (let j = 0; j < fila.length; j++) {
        const url = fila[j];
        let bytes, img;
        try {
          bytes = await fetch(url).then(r => r.arrayBuffer());
          try { img = await pdfDoc.embedPng(bytes); } catch { img = await pdfDoc.embedJpg(bytes); }
        } catch { continue; }
        let w = img.width, h = img.height;
        let scale = Math.min(maxAncho / w, maxAlto / h);
        w = w * scale; h = h * scale;
        escalas.push({ img, w, h });
        totalW += w;
      }

      const gaps = (escalas.length > 1) ? pad : 0;
      let startX = mx + (usableW - (totalW + gaps)) / 2;

      let x = startX;
      for (let j = 0; j < escalas.length; j++) {
        const { img, w, h } = escalas[j];
        page.drawImage(img, { x, y: y - h, width: w, height: h });
        x += w + pad;
      }

      y -= (Math.max(...escalas.map(e => e.h)) + 16);
      idx += maxPorFila;
    }
  }

  // Notas / observaciones
  if (datos.notas?.trim()) {
    if (y < 80) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }
    page.drawText("Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 13;
    page.drawText(datos.notas.trim(), { x: mx+12, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32), maxWidth: usableW-20 });
    y -= 10;
  }

  // Pie
  const pieArr = [
    `${EMS_CONTACT.empresa}  •  ${EMS_CONTACT.direccion}`,
    `Tel: ${EMS_CONTACT.telefono}  •  ${EMS_CONTACT.correo}`,
    "Vigencia de la cotización: 15 días naturales a partir de la fecha de emisión."
  ];
  let pieY = 56;
  for (let linea of pieArr) {
    page.drawText(linea, { x: mx+8, y: pieY, size: 9.2, font: helv, color: rgb(0.10,0.20,0.56), maxWidth: usableW-16 });
    pieY -= 13;
  }

  const pdfBytes = await pdfDoc.save();
  showSaved("PDF Listo");
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Cotizacion_${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Cotización", text: `Cotización ${datos.numero||""} de Electromotores Santana` });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
  form.notas.value = datos.notas || "";

  // Fotos cotización
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
  if (!doc.exists) return alert("No se encontró el reporte.");
  const datos = doc.data();
  nuevoReporte();
  const form = document.getElementById("repForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  const tbody = form.querySelector("#repItemsTable tbody");
  tbody.innerHTML = "";
  fotosItemsReporte = [];
  (datos.items || []).forEach((item, idx) => {
    fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
    tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
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
    if (!doc.exists) return alert("No se encontró la cotización.");
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    window.editandoReporte = true;
    abrirReporte?.(numero);
  }
}

// ======= GUARDADO Y PDF DE REPORTES ==========
async function enviarReporte(e) {
  e.preventDefault();
  showSaved("Guardando...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: fotosItemsReporte[Array.from(tr.parentNode.children).indexOf(tr)] || []
    });
  });
  if (!datos.numero || !datos.cliente || !items.length) {
    showSaved("Faltan datos");
    alert("Completa todos los campos requeridos.");
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
  if (!navigator.onLine) {
    alert("Sin conexión. Guarda localmente o espera a tener Internet.");
    showSaved("Offline");
    return;
  }
  await db.collection("reportes").doc(datos.numero).set(reporte);
  localStorage.removeItem('EMS_REP_BORRADOR');
  showSaved("¡Reporte guardado!");
  renderInicio();
}

async function guardarReporteDraft() {
  const form = document.getElementById('repForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: fotosItemsReporte[Array.from(tr.parentNode.children).indexOf(tr)] || []
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

async function generarPDFReporte(share = false) {
  // Progreso
  showProgress(true, 10, "Generando PDF...");
  await guardarReporteDraft();

  const form = document.getElementById('repForm');
  if (!form) { showProgress(false); alert("No hay formulario de reporte activo."); return; }

  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    const idx = Array.from(tr.parentNode.children).indexOf(tr);
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: (fotosItemsReporte[idx] || []).slice(0, 6),
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

  // Marca de agua + cabecera
  try {
    const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
    const logoImg   = await pdfDoc.embedPng(logoBytes);
    page.drawImage(logoImg, { x: (pageW-220)/2, y: (pageH-240)/2, width: 220, height: 220, opacity: 0.06 });

    const logoH = 46;
    page.drawImage(logoImg, { x: mx, y: y - logoH + 10, width: logoH, height: logoH });

    const leftX = mx + logoH + 14;
    page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y + 2, size: 17, font: helvB, color: rgb(0.10,0.20,0.40) });
    page.drawText("REPORTE DE SERVICIO", { x: leftX, y: y - 16, size: 12, font: helvB, color: rgb(0.98,0.54,0.10) });

    page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 32, size: 10.5, font: helv, color: rgb(0.16,0.18,0.22) });
    page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 180, y: y + 2, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
    page.drawText(`Fecha: ${datos.fecha||""} ${datos.hora?("• "+datos.hora):""}`, { x: mx + usableW - 180, y: y - 15, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
  } catch (e) { /* sin logo */ }

  y -= (46 + 24);

  // Lista de actividades
  const bullet = "• ";
  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    // Nueva página si se requiere
    if (y < 120) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }

    // Descripción con fondo alternado
    if (i % 2 === 0) {
      page.drawRectangle({ x: mx, y: y - 2, width: usableW, height: 18, color: rgb(0.98,0.91,0.75), opacity: 0.29 });
    }
    const text = bullet + String(it.descripcion || "").trim();
    const maxWidth = usableW - 12;
    const lines = breakTextLines(text, helv, 11, maxWidth);
    for (let li = 0; li < lines.length; li++) {
      page.drawText(lines[li], { x: mx + 2, y, size: 11, font: helv, color: rgb(0.13,0.18,0.38) });
      y -= 14;
      if (y < 120 && li < lines.length - 1) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }
    }
    y -= 4;

    // Fotos del ítem (máx 2 por fila)
    const fotos = Array.isArray(it.fotos) ? it.fotos : [];
    const pad = 16, maxPorFila = 2, maxAncho = Math.floor((usableW - pad) / 2), maxAlto = 180;

    let idx = 0;
    while (idx < fotos.length) {
      if (y - maxAlto - 24 < my) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }

      const fila = fotos.slice(idx, idx + maxPorFila);
      const escalas = [];
      let totalW = 0;

      for (let j = 0; j < fila.length; j++) {
        const url = fila[j];
        let bytes, img;
        try {
          bytes = await fetch(url).then(r => r.arrayBuffer());
        } catch { bytes = null; }
        if (!bytes) { continue; }

        try {
          img = await pdfDoc.embedPng(bytes);
        } catch {
          try { img = await pdfDoc.embedJpg(bytes); }
          catch { continue; }
        }

        let w = img.width, h = img.height;
        const scale = Math.min(maxAncho / w, maxAlto / h);
        w *= scale; h *= scale;
        escalas.push({ img, w, h });
        totalW += w;
      }

      const gaps = (escalas.length > 1) ? pad : 0;
      const startX = mx + (usableW - (totalW + gaps)) / 2;

      let x = startX;
      for (const { img, w, h } of escalas) {
        page.drawImage(img, { x, y: y - h, width: w, height: h });
        x += w + pad;
      }

      y -= (Math.max(0, ...escalas.map(e => e.h)) + 16);
      idx += maxPorFila;
    }

    y -= 6;
    page.drawLine({ start: { x: mx, y }, end: { x: pageW - mx, y }, thickness: 0.4, color: rgb(0.98,0.85,0.48) });
    y -= 10;
  }

  // Notas / observaciones
  if ((datos.notas || "").trim()) {
    if (y < 100) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; }
    page.drawText("Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 13;
    page.drawText(String(datos.notas).trim(), { x: mx+12, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32), maxWidth: usableW-20 });
    y -= 10;
  }

  // Pie
  const pieArr = [
    `${EMS_CONTACT.empresa}  •  ${EMS_CONTACT.direccion}`,
    `Tel: ${EMS_CONTACT.telefono}  •  ${EMS_CONTACT.correo}`
  ];
  let pieY = 56;
  for (let linea of pieArr) {
    page.drawText(linea, { x: mx+8, y: pieY, size: 9.2, font: helv, color: rgb(0.10,0.20,0.56), maxWidth: usableW-16 });
    pieY -= 13;
  }

  // Salvar y compartir/descargar
  const pdfBytes = await pdfDoc.save();
  showProgress(false, 100, "PDF listo");

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const fileName = `Reporte_${datos.numero || "reporte"}.pdf`;

  // Share-first con fallback
  if (share && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Reporte", text: `Reporte ${datos.numero||""} de Electromotores Santana` });
        return;
      }
    } catch { /* seguimos al fallback */ }
  }

  // Descarga compatible (iOS/PWA incl.)
  const url = URL.createObjectURL(blob);
  try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
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
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}


// ====== Eliminar docs ======
async function eliminarCotizacionCompleta(numero) {
  if (!numero) {
    const form = document.getElementById('cotForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return alert("No se encontró el número de cotización.");
  if (!confirm("¿Estás seguro que deseas eliminar esta cotización? Esta acción no se puede deshacer.")) return;
  try {
    await db.collection("cotizaciones").doc(numero).delete();
    showSaved("Cotización eliminada");
    localStorage.removeItem('EMS_COT_BORRADOR');
    renderInicio();
  } catch (e) {
    alert("Error eliminando cotización: " + (e.message || e));
  }
}
async function eliminarReporteCompleto(numero) {
  if (!numero) {
    const form = document.getElementById('repForm');
    if (form && form.numero && form.numero.value) numero = form.numero.value;
  }
  if (!numero) return alert("No se encontró el número de reporte.");
  if (!confirm("¿Estás seguro que deseas eliminar este reporte? Esta acción no se puede deshacer.")) return;
  try {
    await db.collection("reportes").doc(numero).delete();
    showSaved("Reporte eliminado");
    localStorage.removeItem('EMS_REP_BORRADOR');
    renderInicio();
  } catch (e) {
    alert("Error eliminando reporte: " + (e.message || e));
  }
}

// ======= Dictado por voz =======
function agregarDictadoMicros() {
  document.querySelectorAll(".mic-btn:not(.ems-mic-init)").forEach(btn => {
    btn.classList.add("ems-mic-init");
    btn.onclick = function() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition;
      if (!SpeechRecognition) { alert("Tu navegador no soporta dictado por voz."); return; }
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
      recog.onerror = () => alert("No se pudo reconocer audio.");
      recog.start();
    };
  });
}
