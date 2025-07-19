// === INICIALIZACIÓN Y UTILIDADES ===
const EMS_CONTACT = {
  empresa: "ELECTROMOTORES SANTANA",
  direccion: "Carr. a Chichimequillas 306, Colonia Menchaca 2, 76147 Santiago de Querétaro, Qro.",
  telefono: "442 469 9895; tel/fax: 4422208910",
  correo: "electromotores.santana@gmail.com"
};
const EMS_COLOR = [0.97, 0.54, 0.11]; // rgb(248,138,29)
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

const LOGO_URL = "https://i.imgur.com/CKDrg9w.png";
let fotosItemsReporte = [];
let autoSaveTimer = null;

function showProgress(visible = true, percent = 60, msg = "Generando...") {
  let bar = document.getElementById("progress-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "progress-bar";
    bar.style.position = "fixed";
    bar.style.top = "0";
    bar.style.left = "0";
    bar.style.height = "5px";
    bar.style.width = "100vw";
    bar.style.background = "#26B77A";
    bar.style.zIndex = "1200";
    bar.style.transition = "width 0.3s";
    document.body.appendChild(bar);
  }
  if (visible) {
    bar.style.display = "block";
    bar.style.width = (percent || 60) + "%";
    bar.innerText = msg || "";
  } else {
    bar.style.display = "none";
    bar.innerText = "";
    bar.style.width = "0%";
  }
}
// Helper: Corta texto en líneas sin exceder ancho en puntos (px) usando la fuente PDF
function breakTextLines(text, font, fontSize, maxWidth) {
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


function safe(val) {
  return (val === undefined || val === null) ? "" : String(val);
}
function formatMoney(val) {
  return "$" + Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hoy() { return (new Date()).toISOString().slice(0, 10); }
function ahora() { const d = new Date(); return d.toTimeString().slice(0, 5); }

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
  if (!bar.querySelector(".progress-inner")) {
    let inner = document.createElement("div");
    inner.className = "progress-inner";
    inner.style.width = percent + "%";
    inner.innerText = msg;
    bar.appendChild(inner);
  }
  bar.style.display = visible ? "flex" : "none";
  let inner = bar.querySelector(".progress-inner");
  if (inner) {
    inner.style.width = percent + "%";
    inner.innerText = msg;
  }
  if (!visible) {
    setTimeout(() => {
      bar.style.display = "none";
      if (inner) inner.innerText = "";
      if (inner) inner.style.width = "0%";
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
  // Detiene el autosave si está activo
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);

  fotosItemsReporte = [];
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
              onchange="subirFotoRepItem(this, ${idx})"
            >
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

// === Subida de fotos Cloudinary ===
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
    formData.append('upload_preset', 'ml_default'); // <-- CAMBIA si usas otro
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/ds9b1mczi/image/upload', {
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
      alert("Error al subir la imagen");
    }
  }
  // Re-renderiza la fila
  const tbody = document.querySelector('#repItemsTable tbody');
  tbody.children[idx].outerHTML = renderRepItemRow({
    descripcion: tbody.children[idx].querySelector("textarea").value,
    fotos: fotosItemsReporte[idx]
  }, idx, true);
  showSaved("¡Imagen(es) subida(s)!");
  input.disabled = false;
  input.value = "";
}
function eliminarFotoRepItem(btn, idx, fidx, url) {
  if (!fotosItemsReporte[idx]) return;
  fotosItemsReporte[idx].splice(fidx, 1);
  // Elimina la miniatura del DOM
  btn.parentElement.remove();
}


// ========== Cotización y Reporte: Formulario y Flujos ==========
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
        
      </div>
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>
            <input type="checkbox" name="incluyeIVA"> Incluir IVA (16%)
          </label>
        </div>
        <div class="ems-form-group">
          <label>
            <input type="checkbox" name="anticipo" onchange="this.form.anticipoPorc.parentElement.style.display=this.checked?'':'none'"> Con anticipo
          </label>
          <div style="display:none">
            <input type="number" name="anticipoPorc" min="0" max="100" placeholder="% Anticipo"> %
          </div>
        </div>
        <div class="ems-form-group">
          <label>
            <input type="checkbox" name="corrigeIA"> Mejorar redacción con IA
          </label>
        </div>
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
      if (k !== "items" && form[k] !== undefined) form[k].value = draft[k];
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
  } else {
    agregarCotItemRow();
  }
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

  // === AUTOGUARDADO cada 15 segundos ===
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('cotForm')) guardarCotizacionDraft();
  }, 15000);
}


function nuevoReporte() {
  window.editandoReporte = false;
  fotosItemsReporte = [];
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
        <button type="button" class="btn-danger" onclick="eliminarReporteCompleto()" style="float:right;"><i class="fa fa-trash"></i> Eliminar</button>
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

  // === AUTOGUARDADO cada 15 segundos ===
  if (window.autoSaveTimer) clearInterval(window.autoSaveTimer);
  window.autoSaveTimer = setInterval(() => {
    if (document.getElementById('repForm')) guardarReporteDraft();
  }, 15000);
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
    tipo: 'cotizacion',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
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
      cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
      precio: Number(tr.querySelector('input[name="precio"]').value)
    });
  });

  // Cálculo de totales
  let subtotal = items.reduce((acc, x) => acc + (x.cantidad * x.precio), 0);
  let iva = (form.incluyeIVA && form.incluyeIVA.checked) ? subtotal * 0.16 : 0;
  let total = subtotal + iva;
  let anticipoPorc = (form.anticipo && form.anticipo.checked && form.anticipoPorc.value) ? parseFloat(form.anticipoPorc.value) : 0;
  let anticipo = anticipoPorc ? (total * (anticipoPorc/100)) : 0;

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Medidas A4 en puntos
  const pageW = 595.28, pageH = 841.89;
  const mx = 32, my = 38;
  const usableW = pageW - mx*2;
  let y = pageH - my;

  let page = pdfDoc.addPage([pageW, pageH]);

  // Marca de agua
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);
  page.drawImage(logoImg, {
    x: (pageW-260)/2,
    y: (pageH-260)/2,
    width: 260,
    height: 260,
    opacity: 0.08
  });

  // Encabezado
  const logoH = 46;
  page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
  const leftX = mx + logoH + 14;
  page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y, size: 16, font: helvB, color: rgb(0.10,0.20,0.40) });
  page.drawText("COTIZACIÓN", { x: leftX, y: y - 18, size: 11, font: helvB, color: rgb(0.98,0.54,0.10) });
  page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 34, size: 10.2, font: helv, color: rgb(0.16,0.18,0.22) });
  page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 140, y: y, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + usableW - 140, y: y - 17, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(`Hora: ${datos.hora||""}`, { x: mx + usableW - 140, y: y - 34, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });

  y -= (logoH + 18);

  // Tabla: Encabezados
  page.drawText("Concepto", { x: mx, y, size: 11, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText("Unidad", { x: mx+176, y, size: 11, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText("Cantidad", { x: mx+265, y, size: 11, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText("Precio", { x: mx+350, y, size: 11, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText("Importe", { x: mx+440, y, size: 11, font: helvB, color: rgb(0.12,0.20,0.40) });

  // Tabla: Líneas de tabla
  let rowY = y - 14;
  let colXs = [mx, mx+176, mx+265, mx+350, mx+440, pageW-mx];
  // Encabezado
  page.drawLine({ start: { x: mx, y: rowY }, end: { x: pageW-mx, y: rowY }, thickness: 1.2, color: rgb(0.76,0.80,0.94) });
  // Verticales
  for(let cx of colXs) {
    page.drawLine({ start: { x: cx, y: rowY }, end: { x: cx, y: rowY - 18 - 18 * items.length }, thickness: 0.8, color: rgb(0.76,0.80,0.94) });
  }
  y = rowY - 18;
  for (const it of items) {
    if (y < 110) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my - 70;
    }
    page.drawText(String(it.concepto || ""), { x: mx+2, y, size: 10, font: helv });
    page.drawText(String(it.unidad || ""), { x: mx+176+2, y, size: 10, font: helv });
    page.drawText(String(it.cantidad || ""), { x: mx+265+2, y, size: 10, font: helv });
    page.drawText(formatMoney(it.precio), { x: mx+350+2, y, size: 10, font: helv });
    page.drawText(formatMoney(it.cantidad * it.precio), { x: mx+440+2, y, size: 10, font: helv });
    // Horizontal
    page.drawLine({ start: { x: mx, y: y-3 }, end: { x: pageW-mx, y: y-3 }, thickness: 0.6, color: rgb(0.85,0.85,0.92) });
    y -= 18;
  }

  // Totales
  y -= 8;
  page.drawLine({ start: { x: mx+340, y }, end: { x: pageW-mx, y }, thickness: 1.2, color: rgb(...EMS_COLOR) });
  y -= 12;
  page.drawText("Subtotal:", { x: mx+340, y, size: 10.5, font: helvB });
  page.drawText(formatMoney(subtotal), { x: mx+440, y, size: 10.5, font: helvB });
  y -= 13;
  if (iva > 0) {
    page.drawText("IVA (16%):", { x: mx+340, y, size: 10.5, font: helvB });
    page.drawText(formatMoney(iva), { x: mx+440, y, size: 10.5, font: helvB });
    y -= 13;
  }
  page.drawText("Total:", { x: mx+340, y, size: 11.5, font: helvB, color: rgb(...EMS_COLOR) });
  page.drawText(formatMoney(total), { x: mx+440, y, size: 11.5, font: helvB, color: rgb(...EMS_COLOR) });
  y -= 15;
  if (anticipo > 0) {
    page.drawText(`Anticipo (${anticipoPorc}%):`, { x: mx+340, y, size: 10.5, font: helvB, color: rgb(0.13,0.18,0.38) });
    page.drawText(formatMoney(anticipo), { x: mx+440, y, size: 10.5, font: helvB, color: rgb(0.13,0.18,0.38) });
    y -= 13;
  }

  // Notas / observaciones
  if (datos.notas?.trim()) {
    y -= 12;
    page.drawText("Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 13;
    page.drawText(datos.notas.trim(), { x: mx+12, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32), maxWidth: usableW-20 });
    y -= 10;
  }

  // Pie de página: bien dividido en varias líneas
  const pieArr = [
    `${EMS_CONTACT.empresa}  •  ${EMS_CONTACT.direccion}`,
    `Tel: ${EMS_CONTACT.telefono}  •  ${EMS_CONTACT.correo}`,
    "Vigencia de la cotización: 15 días naturales a partir de la fecha de emisión."
  ];
  page.drawRectangle({
    x: mx, y: 26, width: usableW, height: 42, color: rgb(0.11, 0.24, 0.44)
  });
  let pieY = 60;
  for (let linea of pieArr) {
    page.drawText(linea, {
      x: mx+14, y: pieY, size: 9.2, font: helv, color: rgb(1,1,1),
      maxWidth: usableW-20
    });
    pieY -= 13;
  }

  // Salida PDF
  const pdfBytes = await pdfDoc.save();
  showSaved("PDF Listo");
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Cotizacion_${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Cotización",
      text: `Cotización ${datos.numero||""} de Electromotores Santana`
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function editarCotizacion(datos) {
  nuevaCotizacion();
  const form = document.getElementById("cotForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  if (datos.incluyeIVA) form.incluyeIVA.checked = true;
  if (datos.anticipo) {
    form.anticipo.checked = true;
    form.anticipoPorc.parentElement.style.display = '';
    form.anticipoPorc.value = datos.anticipoPorc;
  }
  const tbody = form.querySelector("#itemsTable tbody");
  tbody.innerHTML = "";
  (datos.items || []).forEach(item => tbody.insertAdjacentHTML("beforeend", renderCotItemRow(item)));
  form.notas.value = datos.notas || "";
  setTimeout(() => {
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
    activarPredictivosInstantaneos();
  }, 100);
}

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
  await db.collection("reportes").doc(datos.numero).set(reporte);
  showSaved("Reporte guardado");
}

// Helper: Corta texto en líneas sin exceder ancho en puntos (px) usando la fuente PDF
function breakTextLines(text, font, fontSize, maxWidth) {
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

async function generarPDFReporte(share = false) {
  showProgress(true, 10, "Generando PDF...");
  await guardarReporteDraft();
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach(tr => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: fotosItemsReporte[Array.from(tr.parentNode.children).indexOf(tr)] || []
    });
  });

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Medidas A4 en puntos
  const pageW = 595.28, pageH = 841.89;
  const mx = 32, my = 38;
  const usableW = pageW - mx*2;
  let y = pageH - my;

  let page = pdfDoc.addPage([pageW, pageH]);

  // Marca de agua (logo grande y translúcido, centrado)
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);
  page.drawImage(logoImg, {
    x: (pageW-260)/2,
    y: (pageH-260)/2,
    width: 260,
    height: 260,
    opacity: 0.08
  });

  // Encabezado
  const logoH = 46;
  page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
  const leftX = mx + logoH + 14;
  page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y, size: 16, font: helvB, color: rgb(0.10,0.20,0.40) });
  page.drawText("REPORTE DE SERVICIO", { x: leftX, y: y - 18, size: 11, font: helvB, color: rgb(0.98,0.54,0.10) });
  page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 34, size: 10.2, font: helv, color: rgb(0.16,0.18,0.22) });
  page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 140, y: y, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + usableW - 140, y: y - 17, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(`Hora: ${datos.hora||""}`, { x: mx + usableW - 140, y: y - 34, size: 10.2, font: helvB, color: rgb(0.13,0.22,0.38) });

  y -= (logoH + 18);

  // Línea divisoria
  page.drawLine({ start: { x: mx, y }, end: { x: pageW-mx, y }, thickness: 2, color: rgb(...EMS_COLOR) });
  y -= 18;

  // Tabla de items
  page.drawText("Actividades y Evidencias:", { x: mx, y, size: 11.5, font: helvB, color: rgb(0.12,0.20,0.40) });
  y -= 14;
  page.drawLine({ start: { x: mx, y }, end: { x: pageW-mx, y }, thickness: 1, color: rgb(0.76,0.80,0.94) });
  y -= 8;

  // ---- PARA CADA ITEM ----
  for (let idx = 0; idx < items.length; idx++) {
    let it = items[idx];
    let fotos = it.fotos || [];
    let hasFotos = fotos.length > 0;
    let maxImgsPerRow = 2;
    let imgW = 170, imgH = 135; // Tamaño de las imágenes
    let imgPad = 26;

    // Prepara la descripción
    let desc = it.descripcion || "";
    let maxTextW = usableW - 40;
    let lines = breakTextLines(desc, helv, 11, maxTextW);
    let descBlockHeight = lines.length * 14 + 12;

    // Prepara el espacio necesario para las fotos
    let totalFotoRows = hasFotos ? Math.ceil(fotos.length / maxImgsPerRow) : 0;
    let fotosBlockHeight = totalFotoRows * (imgH + 10);

    // Suma todo lo que ocupa este item (fotos, descripción y margen)
    let requiredHeight = fotosBlockHeight + descBlockHeight + 24;

    // Si no cabe, haz salto de página ANTES de imprimir nada del item
    if (y < requiredHeight + 80) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my - 70;
    }

    // FOTOS (máximo 2 por fila)
    if (hasFotos) {
      for (let i = 0; i < fotos.length; i += maxImgsPerRow) {
        let rowCount = Math.min(maxImgsPerRow, fotos.length - i);
        for (let j = 0; j < rowCount; j++) {
          let imgUrl = fotos[i+j];
          let imgBytes = await fetch(imgUrl).then(r=>r.arrayBuffer()).catch(()=>null);
          if (!imgBytes) continue;
          let img, ext = imgUrl.split('.').pop().toLowerCase();
          try {
            if (ext === "png" || ext.startsWith("png")) img = await pdfDoc.embedPng(imgBytes);
            else img = await pdfDoc.embedJpg(imgBytes);
          } catch {
            // Si PNG falla, intenta como JPG
            try { img = await pdfDoc.embedJpg(imgBytes); } catch { continue; }
          }
          // Centra las imágenes de la fila
          let totalImgsW = rowCount * imgW + (rowCount-1)*imgPad;
          let startX = mx + (usableW - totalImgsW) / 2;
          let x = startX + j * (imgW + imgPad);
          page.drawImage(img, {
            x: x,
            y: y - imgH,
            width: imgW,
            height: imgH
          });
        }
        y -= (imgH + 10);
      }
      // DESCRIPCIÓN DEL ITEM, centrada abajo del bloque de imágenes
      for (let li = 0; li < lines.length; li++) {
        let textWidth = helv.widthOfTextAtSize(lines[li], 11);
        let textX = mx + usableW/2 - textWidth/2;
        page.drawText(lines[li], { x: textX, y: y - 2 - li*14, size: 11, font: helv, color: rgb(0.15,0.18,0.22) });
      }
      y -= (lines.length*14 + 12);
    } else {
      // Si no hay fotos, solo descripción centrada
      for (let li = 0; li < lines.length; li++) {
        let textWidth = helv.widthOfTextAtSize(lines[li], 11);
        let textX = mx + usableW/2 - textWidth/2;
        page.drawText(lines[li], { x: textX, y: y - 2 - li*14, size: 11, font: helv, color: rgb(0.15,0.18,0.22) });
      }
      y -= (lines.length*14 + 12);
    }
    // Línea divisoria fina entre items
    page.drawLine({ start: { x: mx+10, y: y+4 }, end: { x: pageW-mx-10, y: y+4 }, thickness: 0.6, color: rgb(0.85,0.87,0.92) });
    y -= 8;
  }

  // Notas / observaciones
  if (datos.notas?.trim()) {
    if (y < 80) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my - 70;
    }
    page.drawText("Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.18,0.23,0.42) });
    y -= 13;
    let obs = datos.notas.trim();
    let obsLines = breakTextLines(obs, helv, 10, usableW-20);
    for (let ol = 0; ol < obsLines.length; ol++) {
      page.drawText(obsLines[ol], { x: mx+12, y, size: 10, font: helv, color: rgb(0.18,0.23,0.32) });
      y -= 12;
    }
  }

  // Pie de página limpio y NUNCA cortado
  let pie1 = `${EMS_CONTACT.empresa}  •  ${EMS_CONTACT.direccion}`;
  let pie2 = "Este reporte da fe de los trabajos realizados según solicitud del cliente.";
  let pie3 = `Tel: ${EMS_CONTACT.telefono}  •  ${EMS_CONTACT.correo}`;
  page.drawRectangle({
    x: mx, y: 26, width: usableW, height: 44, color: rgb(0.11, 0.24, 0.44)
  });
  page.drawText(pie1, {
    x: mx+14, y: 61, size: 9, font: helv, color: rgb(1,1,1),
    maxWidth: usableW-20
  });
  page.drawText(pie2, {
    x: mx+14, y: 48, size: 9.7, font: helv, color: rgb(1,1,1),
    maxWidth: usableW-20
  });
  page.drawText(pie3, {
    x: mx+14, y: 35, size: 9, font: helv, color: rgb(1,1,1),
    maxWidth: usableW-20
  });

  // Salida PDF
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Reporte_${datos.numero||"reporte"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Reporte de Servicio",
      text: `Reporte ${datos.numero||""} de Electromotores Santana`
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}






// ======= Dictado por voz para campos con .mic-btn =======
function agregarDictadoMicros() {
  document.querySelectorAll(".mic-btn:not(.ems-mic-init)").forEach(btn => {
    btn.classList.add("ems-mic-init");
    btn.onclick = function() {
      if (!('webkitSpeechRecognition' in window)) {
        alert("Tu navegador no soporta dictado por voz.");
        return;
      }
      const recog = new webkitSpeechRecognition();
      recog.lang = "es-MX";
      recog.onresult = (evt) => {
        const val = evt.results[0][0].transcript;
        const input = btn.parentElement.querySelector("input, textarea");
        if (input) input.value = val;
      };
      recog.start();
    };
  });
}

// ========== Fin del archivo ==========
