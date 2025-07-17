// ==================== EMS Cotizaciones y Reportes PWA ====================

// --- Configuración Firebase ---
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
const storage = firebase.storage();

const LOGO_URL = "https://i.imgur.com/RQucHEc.png";
const AUTHOR = "Francisco López Velázquez";

// ======= HELPERS =======
function hoy() {
  return (new Date()).toISOString().slice(0, 10);
}
function ahora() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

// Feedback visual
function showProgress(show = true, percent = 0, msg = "") {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  bar.style.display = show ? "" : "none";
  const inner = bar.querySelector(".progress-inner");
  if (inner) {
    inner.style.width = show ? `${percent || 100}%` : "0%";
    inner.innerHTML = msg ? msg : "";
    if (!show) setTimeout(() => { inner.innerHTML = ""; }, 700);
  }
}

// Banner OFFLINE
function showOffline(show = true) {
  const banner = document.getElementById("ems-offline-banner");
  if (!banner) return;
  if (show) {
    banner.style.display = "";
    banner.innerHTML = '<b>Sin conexión.</b> Los datos se guardarán localmente hasta que regreses a Internet.';
  } else {
    banner.style.display = "none";
  }
}
window.addEventListener("online", () => showOffline(false));
window.addEventListener("offline", () => showOffline(true));

// Predictivos locales (para autocompletado)
function savePredictEMS(tipo, valor) {
  if (!valor || valor.length < 2) return;
  const key = `ems_pred_${tipo}`;
  let arr = JSON.parse(localStorage.getItem(key) || "[]");
  if (!arr.includes(valor)) arr.unshift(valor);
  if (arr.length > 25) arr = arr.slice(0, 25);
  localStorage.setItem(key, JSON.stringify(arr));
}
function getPredictEMS(tipo) {
  return JSON.parse(localStorage.getItem(`ems_pred_${tipo}`) || "[]");
}
function actualizarPredictsEMS() {
  const conceptos = getPredictEMS("concepto");
  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = conceptos.map(v=>`<option value="${v}">`).join('');
  const unidades = getPredictEMS("unidad");
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = unidades.map(v=>`<option value="${v}">`).join('');
  const clientes = getPredictEMS("cliente");
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = clientes.map(v=>`<option value="${v}">`).join('');
  const descs = getPredictEMS("desc");
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = descs.map(v=>`<option value="${v}">`).join('');
}

// Dictado por voz universal
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

// -------- Render Home ----------
function renderInicio() {
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
  if (!navigator.onLine) showOffline(true);
};
// ========== HISTORIAL Y BÚSQUEDA ==========

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

  // Búsqueda
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

// ==================== COTIZACIONES =======================

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
      <td>
        <input type="number" name="precio" min="0" step="0.01" value="${item.precio||""}" required>
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
}
function eliminarCotItemRow(btn) {
  btn.closest('tr').remove();
}

function nuevaCotizacion() {
  document.getElementById('root').innerHTML = `
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
          <tbody>
            ${renderCotItemRow()}
          </tbody>
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
        <button type="button" class="btn-mini" onclick="renderInicio()"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="generarPDFCotizacion()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="generarPDFCotizacion(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
  `;
  document.getElementById('cotForm').onsubmit = enviarCotizacion;
  setTimeout(() => {
    actualizarPredictsEMS();
    agregarDictadoMicros();
  }, 100);
}

// Guardar cotización en Firestore (con feedback visual)
async function enviarCotizacion(e) {
  e.preventDefault();
  showProgress(true, 70, "Guardando...");
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
    showProgress(false);
    alert("Completa todos los campos requeridos.");
    return;
  }
  // Predictivo
  savePredictEMS("cliente", datos.cliente);
  items.forEach(it => {
    savePredictEMS("concepto", it.concepto);
    savePredictEMS("unidad", it.unidad);
  });

  // Simula mejora IA
  if (form.corrigeIA && form.corrigeIA.checked) {
    datos.notas = corregirRedaccionIA(datos.notas || "");
    items.forEach(it => it.concepto = corregirRedaccionIA(it.concepto));
  }

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
    showProgress(false);
    return;
  }
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  showProgress(true, 100, "¡Listo!");
  setTimeout(() => showProgress(false), 1000);
  alert("¡Cotización guardada!");
  renderInicio();
}

// Edición de cotización
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
}

function corregirRedaccionIA(text) {
  if (!text || text.trim().length < 1) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/(\s{2,})/g, " ");
}

// ----- ABRIR DETALLE DE EMS -----
async function abrirDetalleEMS(tipo, numero) {
  if (tipo === "cotizacion") {
    let doc = await db.collection("cotizaciones").doc(numero).get();
    if (!doc.exists) return alert("No se encontró la cotización.");
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    abrirReporte(numero);
  }
}
// =============== REPORTES ===============

let fotosItemsReporte = [];

function renderRepItemRow(item = {}, idx = 0, modoEdicion = true) {
  if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = item.fotos ? [...item.fotos] : [];
  let fotosHtml = '';
  (fotosItemsReporte[idx] || []).forEach((url, fidx) => {
    fotosHtml += `
      <div class="ems-rep-foto">
        <img src="${url}" style="width: 70px; height: 70px; object-fit:cover; border-radius:8px; border:1px solid #dbe2ea;">
        ${modoEdicion ? `<button type="button" class="btn-mini" title="Eliminar imagen" onclick="eliminarFotoRepItem(this, ${idx}, ${fidx}, '${url}')"><i class="fa fa-trash"></i></button>` : ''}
      </div>`;
  });

  return `
    <tr>
      <td>
        <textarea name="descripcion" rows="2" required placeholder="Describe la actividad">${item.descripcion||""}</textarea>
      </td>
      <td>
        <div class="ems-rep-fotos-row" id="fotos-item-${idx}">
          ${fotosHtml}
          ${modoEdicion && (fotosItemsReporte[idx]||[]).length < 6 ? `
            <input type="file" accept="image/*"
              style="display:block; margin-top:7px;" 
              onchange="subirFotoRepItem(this, ${idx})"
              ${modoEdicion && (fotosItemsReporte[idx]||[]).length>=6 ? "disabled" : ""}
            >
            <div style="font-size:0.92em; color:#888;">${6 - (fotosItemsReporte[idx]||[]).length} fotos disponibles</div>
          ` : ""}
        </div>
      </td>
      <td>
        ${modoEdicion ? `<button type="button" class="btn-mini" onclick="eliminarRepItemRow(this)"><i class="fa fa-trash"></i></button>` : ''}
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
}

function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const idx = Array.from(tr.parentNode.children).indexOf(tr);
  fotosItemsReporte.splice(idx, 1);
  tr.remove();
}

function nuevoReporte() {
  fotosItemsReporte = [];
  document.getElementById('root').innerHTML = `
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
          <tbody>
            ${renderRepItemRow({}, 0, true)}
          </tbody>
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
        <button type="button" class="btn-mini" onclick="renderInicio()"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
        <button type="button" class="btn-danger" onclick="eliminarReporteCompleto()" style="float:right;"><i class="fa fa-trash"></i> Eliminar</button>
      </div>
    </form>
  `;
  document.getElementById('repForm').onsubmit = enviarReporte;
  setTimeout(() => {
    actualizarPredictsEMS();
    agregarDictadoMicros();
  }, 100);
}

// SUBIR imagen y guardar la URL en fotosItemsReporte[idx]
async function subirFotoRepItem(input, idx) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (!file.type.startsWith("image/")) return;
  input.disabled = true;
  showProgress(true, 15, "Subiendo imagen...");

  const form = document.getElementById('repForm');
  const numero = form ? (form.numero.value || "TEMP") : "TEMP";
  const refPath = `reportes/${numero}/${idx}/${Date.now()}_${file.name.replace(/\s/g, "")}`;
  const storageRef = storage.ref().child(refPath);

  try {
    await storageRef.put(file);
    let url = await storageRef.getDownloadURL();
    if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = [];
    fotosItemsReporte[idx].push(url);
    // Re-render SOLO ese item row
    const tbody = document.querySelector('#repItemsTable tbody');
    tbody.children[idx].outerHTML = renderRepItemRow(
      { descripcion: tbody.children[idx].querySelector("textarea").value, fotos: fotosItemsReporte[idx] },
      idx, true
    );
    showProgress(false);
  } catch (err) {
    showProgress(false);
    alert("Error al subir imagen. Revisa tu conexión.");
  } finally {
    input.disabled = false;
    input.value = "";
  }
}

// Elimina una imagen de UI, Storage y array
async function eliminarFotoRepItem(btn, idx, fidx, url) {
  if (!confirm("¿Eliminar esta imagen?")) return;
  try {
    await storage.refFromURL(url).delete();
  } catch (e) {}
  if (fotosItemsReporte[idx]) fotosItemsReporte[idx].splice(fidx, 1);
  // Re-render
  const tbody = document.querySelector('#repItemsTable tbody');
  tbody.children[idx].outerHTML = renderRepItemRow({
    descripcion: tbody.children[idx].querySelector("textarea").value,
    fotos: fotosItemsReporte[idx]
  }, idx, true);
}

// Guardar el reporte en Firestore con fotosItemsReporte como fuente de verdad
async function enviarReporte(e) {
  e.preventDefault();
  showProgress(true, 65, "Guardando...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  let ok = true;
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    let desc = tr.querySelector('textarea[name="descripcion"]').value.trim();
    let fotos = fotosItemsReporte[idx] || [];
    if (!desc) ok = false;
    if (fotos.length > 6) fotos = fotos.slice(0,6);
    items.push({ descripcion: desc, fotos });
  });
  if (!datos.numero || !datos.cliente || !items.length || !ok) {
    showProgress(false);
    alert("Completa todos los campos requeridos.");
    return;
  }
  savePredictEMS("cliente", datos.cliente);
  items.forEach(it => savePredictEMS("desc", it.descripcion));

  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };

  await db.collection("reportes").doc(datos.numero).set(reporte);
  showProgress(true, 100, "¡Listo!");
  setTimeout(() => showProgress(false), 1000);
  alert("¡Reporte guardado!");
  fotosItemsReporte = [];
  renderInicio();
}

// Editar un reporte: carga items y fotos correctamente (sin duplicados)
async function abrirReporte(numero) {
  let doc = await db.collection("reportes").doc(numero).get();
  if (!doc.exists) return alert("No se encontró el reporte.");
  let datos = doc.data();
  fotosItemsReporte = [];
  nuevoReporte();
  const form = document.getElementById("repForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  const tbody = form.querySelector("#repItemsTable tbody");
  tbody.innerHTML = "";
  (datos.items || []).forEach((item, idx) => {
    fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
    tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
  });
  form.notas.value = datos.notas || "";
}

// Borra todo un reporte y sus imágenes de Storage
async function eliminarReporteCompleto() {
  const form = document.getElementById('repForm');
  const numero = form.numero.value;
  if (!numero) return;
  if (!confirm("¿Eliminar este reporte y todas sus imágenes?")) return;
  let doc = await db.collection("reportes").doc(numero).get();
  if (doc.exists) {
    let datos = doc.data();
    if (datos.items) {
      for (let idx = 0; idx < datos.items.length; idx++) {
        for (let url of (datos.items[idx].fotos || [])) {
          try {
            await storage.refFromURL(url).delete();
          } catch (e) {}
        }
      }
    }
  }
  await db.collection("reportes").doc(numero).delete();
  showProgress(false);
  alert("Reporte eliminado.");
  renderInicio();
}

// ========= PDF DE REPORTE robusto (todas las imágenes de todos los items) ==========
async function generarPDFReporte(share = false) {
  showProgress(true, 15, "Generando PDF...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    const descripcion = tr.querySelector('textarea[name="descripcion"]').value.trim();
    const fotos = fotosItemsReporte[idx] || [];
    items.push({ descripcion, fotos });
  });

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 46, my = 70;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  // Logo
  const logoBytes = await fetch(LOGO_URL).then(r=>r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([pageW, pageH]);
  // Encabezado SOLO en la primera página
  page.drawImage(logoImg, {
    x: (pageW - 310) / 2,
    y: (pageH - 310) / 2,
    width: 310,
    height: 310,
    opacity: 0.05
  });
  page.drawImage(logoImg, { x: mx, y: y - 48, width: 48, height: 48 });
  page.drawText("ELECTROMOTORES SANTANA", {
    x: mx + 58, y: y-6, size: 16, font: helvB, color: rgb(0.11,0.20,0.37)
  });
  page.drawText("Reporte de Servicio", {
    x: mx + 58, y: y-26, size: 11, font: helv, color: rgb(0.52,0.35,0.09)
  });
  page.drawText(`No: ${datos.numero||""}`, {
    x: mx + usableW - 138, y: y-6, size: 12, font: helvB, color: rgb(0.13,0.22,0.38)
  });
  page.drawText(`Fecha: ${datos.fecha||""}`, {
    x: mx + usableW - 138, y: y-26, size: 12, font: helvB, color: rgb(0.13,0.22,0.38)
  });
  y -= 58;

  // Actividades (items)
  for (let idx = 0; idx < items.length; idx++) {
    let item = items[idx];
    if (y < 140) { // Salto de página
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my;
      page.drawImage(logoImg, {
        x: (pageW - 310) / 2,
        y: (pageH - 310) / 2,
        width: 310,
        height: 310,
        opacity: 0.05
      });
    }
    // Descripción
    page.drawText(`• ${item.descripcion}`, { x: mx, y, size: 11.2, font: helv, color: rgb(0.19,0.21,0.24)});
    y -= 22;

    // Imágenes (máx 6 por item, 2 por fila, JPG o PNG)
    if (item.fotos && item.fotos.length > 0) {
      for (let f=0; f<item.fotos.length && f<6; f+=2) {
        let imgObj1 = null, imgObj2 = null;
        try {
          let img1 = await fetch(item.fotos[f]).then(r=>r.arrayBuffer());
          imgObj1 = /\.png$/i.test(item.fotos[f]) || item.fotos[f].includes("png")
            ? await pdfDoc.embedPng(img1)
            : await pdfDoc.embedJpg(img1);
        } catch {}
        try {
          if (f+1 < item.fotos.length) {
            let img2 = await fetch(item.fotos[f+1]).then(r=>r.arrayBuffer());
            imgObj2 = /\.png$/i.test(item.fotos[f+1]) || item.fotos[f+1].includes("png")
              ? await pdfDoc.embedPng(img2)
              : await pdfDoc.embedJpg(img2);
          }
        } catch {}
        let imgY = y;
        if (imgObj1) page.drawImage(imgObj1, { x: mx, y: imgY-80, width: 105, height: 80 });
        if (imgObj2) page.drawImage(imgObj2, { x: mx+120, y: imgY-80, width: 105, height: 80 });
        y -= 90;
      }
    } else {
      y -= 6;
    }
    y -= 5;
  }

  // Notas
  if (datos.notas) {
    y -= 10;
    page.drawText("Notas:", { x: mx, y, size: 10.5, font: helvB, color: rgb(0.17,0.18,0.22)});
    y -= 14;
    const notasArr = datos.notas.match(/.{1,100}/g) || [datos.notas];
    notasArr.forEach(str => {
      page.drawText(str, { x: mx + 12, y, size: 10.5, font: helv, color: rgb(0.13,0.15,0.19)});
      y -= 15;
    });
  }

  // Pie de página
  page.drawText(`Electromotores Santana · ${AUTHOR} · ${new Date().getFullYear()}`, { 
    x: mx, y: 18, size: 10, font: helv, color: rgb(0.41,0.46,0.60)
  });
  page.drawText("Este documento es confidencial y sólo para uso del cliente.", { 
    x: mx, y: 6, size: 8, font: helv, color: rgb(0.52,0.51,0.48)
  });

  // Descargar o compartir
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `${datos.numero||"reporte"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "Reporte de Servicio",
        text: `Reporte ${datos.numero||""} de Electromotores Santana`
      });
      return;
    } catch {}
  }
  // Descargar
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${datos.numero||"reporte"}.pdf`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
// ================== BLOQUE FINAL: Limpieza, protección y extras ===================

// Limpia los tbody de items al abrir cotización/reporte (evita duplicados visuales)
function limpiarTbodyCotizaciones() {
  const tbody = document.querySelector('#itemsTable tbody');
  if (tbody) tbody.innerHTML = '';
}
function limpiarTbodyReportes() {
  const tbody = document.querySelector('#repItemsTable tbody');
  if (tbody) tbody.innerHTML = '';
}

// Protección contra cierre con cambios sin guardar (opcional)
window.onbeforeunload = function(e) {
  const root = document.getElementById('root');
  if (!root) return;
  if (root.innerHTML.includes("ems-form") && document.activeElement.tagName !== "BODY") {
    return "¿Estás seguro de salir? Hay cambios sin guardar.";
  }
};

// Eliminar cotización completa (puedes agregar un botón en la UI)
async function eliminarCotizacionCompleta() {
  const form = document.getElementById('cotForm');
  const numero = form.numero.value;
  if (!numero) return;
  if (!confirm("¿Eliminar esta cotización?")) return;
  await db.collection("cotizaciones").doc(numero).delete();
  showProgress(false);
  alert("Cotización eliminada.");
  renderInicio();
}

// Puedes agregar el botón donde lo desees en tu UI de cotización:
// <button type="button" class="btn-danger" onclick="eliminarCotizacionCompleta()">Eliminar Cotización</button>

// Feedback offline/online
if (!navigator.onLine) showOffline(true);

// Refresca predictivos al cargar
window.addEventListener('DOMContentLoaded', () => {
  actualizarPredictsEMS();
});

// Actualiza predictivos al inicio
actualizarPredictsEMS();

// --------- FIN app.js ---------
