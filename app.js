// EMS - Electromotores Santana - app.js
const EMS_CONTACT = {
  empresa: "ELECTROMOTORES SANTANA",
  direccion: "Carr. a Chichimequillas 306, Colonia Menchaca, 76147 Santiago de Querétaro, Qro.",
  telefono: "442 469 9895",
  correo: "electromotores.santana@gmail.com"
};

// Naranja corporativo para líneas y totales
const EMS_COLOR = [0.97, 0.54, 0.11]; // rgb(248,138,29)

// Firebase config
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

const LOGO_URL = "https://i.imgur.com/RQucHEc.png";
let fotosItemsReporte = [];

function hoy() { return (new Date()).toISOString().slice(0, 10); }
function ahora() { const d = new Date(); return d.toTimeString().slice(0, 5); }
function formatMoney(val) {
  return "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showProgress(show = true, percent = 0, msg = "") {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  bar.style.display = show ? "" : "none";
  const inner = bar.querySelector(".progress-inner");
  if (inner) {
    inner.style.width = show ? `${percent || 100}%` : "0%";
    inner.innerHTML = msg ? msg : "";
    if (!show) setTimeout(() => { inner.innerHTML = ""; }, 400);
  }
}
function showOffline(show = true) {
  const banner = document.getElementById("ems-offline-banner");
  if (!banner) return;
  banner.style.display = show ? "" : "none";
  if (show) {
    banner.innerHTML = '<b>Sin conexión.</b> Los datos se guardarán localmente hasta que regreses a Internet.';
  }
}
window.addEventListener("online", () => showOffline(false));
window.addEventListener("offline", () => showOffline(true));


// --- Predictivos sincronizados con Firestore ---
async function savePredictEMSCloud(tipo, valor, user = "general") {
  if (!valor || valor.length < 2) return;
  const docRef = db.collection("predictEMS").doc(user);
  let data = (await docRef.get()).data() || {};
  if (!data[tipo]) data[tipo] = [];
  if (!data[tipo].includes(valor)) data[tipo].unshift(valor);
  if (data[tipo].length > 25) data[tipo] = data[tipo].slice(0, 25);
  await docRef.set(data, { merge: true });
}
async function getPredictEMSCloud(tipo, user = "general") {
  const docRef = db.collection("predictEMS").doc(user);
  let data = (await docRef.get()).data() || {};
  return data[tipo] || [];
}
// Para cargar todos los predictivos y actualizar los datalists
async function actualizarPredictsEMSCloud(user = "general") {
  let conceptos = await getPredictEMSCloud("concepto", user);
  let unidades = await getPredictEMSCloud("unidad", user);
  let clientes = await getPredictEMSCloud("cliente", user);
  let descs    = await getPredictEMSCloud("desc", user);
  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = conceptos.map(v=>`<option value="${v}">`).join('');
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = unidades.map(v=>`<option value="${v}">`).join('');
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = clientes.map(v=>`<option value="${v}">`).join('');
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = descs.map(v=>`<option value="${v}">`).join('');
}


// Predictivos (localStorage)
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
// ----------- Pantalla de inicio -----------
function renderInicio() {
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
  if (!navigator.onLine) showOffline(true);
};

// ----------- Historial y búsqueda -----------
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
// ------------- Cotizaciones (mismos métodos que antes) -------------

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
    //actualizarPredictsEMS();
    actualizarPredictsEMSCloud();
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
    showProgress(false);
    return;
  }
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  showProgress(true, 100, "¡Listo!");
  setTimeout(() => showProgress(false), 1000);
  renderInicio();
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
}

// ----- ABRIR DETALLE DE EMS -----
async function abrirDetalleEMS(tipo, numero) {
  if (tipo === "cotizacion") {
    let doc = await db.collection("cotizaciones").doc(numero).get();
    if (!doc.exists) return alert("No se encontró la cotización.");
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    window.editandoReporte = true;
    abrirReporte(numero);
  }
}

// ================== REPORTES ==================

// Renderiza un item/actividad del reporte (sin duplicados de fotos)
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
            <input type="file" accept="image/*" multiple
              style="display:block; margin-top:7px;"
              onchange="subirFotoRepItem(this, ${idx})"
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

// Agrega una actividad nueva
function agregarRepItemRow() {
  const tbody = document.getElementById('repItemsTable').querySelector('tbody');
  const idx = tbody.children.length;
  fotosItemsReporte[idx] = [];
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow({}, idx, true));
  agregarDictadoMicros();
}

// Elimina una fila de actividad y sus fotos (visual)
function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const idx = Array.from(tr.parentNode.children).indexOf(tr);
  fotosItemsReporte.splice(idx, 1);
  tr.remove();
}

// Crear nuevo reporte
function nuevoReporte() {
  window.editandoReporte = false;
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
        <button type="button" class="btn-mini" onclick="renderInicio()"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
        <button type="button" class="btn-danger" onclick="eliminarReporteCompleto()" style="float:right;"><i class="fa fa-trash"></i> Eliminar</button>
      </div>
    </form>
  `;
  setTimeout(() => {
    //actualizarPredictsEMS();
    actualizarPredictsEMSCloud();
    agregarDictadoMicros();
  }, 100);
  agregarRepItemRow();
  document.getElementById('repForm').onsubmit = enviarReporte;
}

// Abrir reporte para editar (sin duplicar imágenes)
async function abrirReporte(numero) {
  let doc = await db.collection("reportes").doc(numero).get();
  if (!doc.exists) return alert("No se encontró el reporte.");
  let datos = doc.data();
  fotosItemsReporte = [];
  document.getElementById('root').innerHTML = `
    <div class="ems-header">
      <img src="${LOGO_URL}" class="ems-logo">
      <div>
        <h1>Electromotores Santana</h1>
        <span class="ems-subtitle">Editar Reporte</span>
      </div>
    </div>
    <form id="repForm" class="ems-form" autocomplete="off">
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>No. Reporte</label>
          <input type="text" name="numero" required>
        </div>
        <div class="ems-form-group">
          <label>Fecha</label>
          <input type="date" name="fecha" required>
        </div>
      </div>
      <div class="ems-form-row">
        <div class="ems-form-group">
          <label>Cliente</label>
          <div class="ems-form-input-icon">
            <input type="text" name="cliente" list="clientesEMS" required autocomplete="off">
            <button type="button" class="mic-btn" title="Dictar por voz"><i class="fa fa-microphone"></i></button>
          </div>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora">
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
          <textarea name="notas" rows="3"></textarea>
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
  setTimeout(() => {
    actualizarPredictsEMS && actualizarPredictsEMSCloud();//actualizarPredictsEMS();
    agregarDictadoMicros && agregarDictadoMicros();
  }, 100);
  const form = document.getElementById("repForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  form.notas.value = datos.notas || "";
  const tbody = form.querySelector("#repItemsTable tbody");
  tbody.innerHTML = "";
  (datos.items || []).forEach((item, idx) => {
    fotosItemsReporte[idx] = Array.isArray(item.fotos) ? [...item.fotos] : [];
    tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item, idx, true));
  });
  form.onsubmit = enviarReporte;
}
// SUBIR imagen (con barra de progreso, Cloudinary)
async function subirFotoRepItem(input, idx) {
  if (!input.files || input.files.length === 0) return;
  const files = Array.from(input.files).slice(0, 6 - (fotosItemsReporte[idx]?.length || 0));
  if (!fotosItemsReporte[idx]) fotosItemsReporte[idx] = [];
  input.disabled = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    showProgress(true, Math.round((i/files.length)*80)+10, `Subiendo imagen ${i+1} de ${files.length}...`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default'); // Default unsigned preset (debes tenerlo en Cloudinary)
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
  // Renderiza de nuevo la fila
  const tbody = document.querySelector('#repItemsTable tbody');
  tbody.children[idx].outerHTML = renderRepItemRow({
    descripcion: tbody.children[idx].querySelector("textarea").value,
    fotos: fotosItemsReporte[idx]
  }, idx, true);
  showProgress(true, 100, "¡Imagen(es) subida(s)!");
  setTimeout(() => showProgress(false), 900);
  input.disabled = false;
  input.value = "";
}

// Elimina una imagen del UI y del array (Cloudinary no permite borrar sin autenticación, así que solo del array)
async function eliminarFotoRepItem(btn, idx, fidx, url) {
  if (!confirm("¿Eliminar esta imagen?")) return;
  if (fotosItemsReporte[idx]) fotosItemsReporte[idx].splice(fidx, 1);
  const tbody = document.querySelector('#repItemsTable tbody');
  tbody.children[idx].outerHTML = renderRepItemRow({
    descripcion: tbody.children[idx].querySelector("textarea").value,
    fotos: fotosItemsReporte[idx]
  }, idx, true);
}

// Guardar el reporte en Firestore (ahora solo URLs Cloudinary)
async function enviarReporte(e) {
  e.preventDefault();
  showProgress(true, 65, "Guardando...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  let ok = true;
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    let desc = tr.querySelector('textarea[name="descripcion"]').value.trim();
    let fotos = (fotosItemsReporte[idx] || []).filter(Boolean);
    if (!desc) ok = false;
    if (fotos.length > 6) fotos = fotos.slice(0,6);
    items.push({ descripcion: desc, fotos });
  });
  if (!datos.numero || !datos.cliente || !items.length || !ok) {
    showProgress(false);
    alert("Completa todos los campos requeridos.");
    return;
  }
  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  try {
    await db.collection("reportes").doc(datos.numero).set(reporte);
    showProgress(true, 100, "¡Listo!");
    setTimeout(() => showProgress(false), 900);
    fotosItemsReporte = [];
    renderInicio();
  } catch (err) {
    showProgress(false);
    alert("Ocurrió un error al guardar el reporte. Intenta de nuevo.");
  }
}

// Eliminar un reporte completo (ya no elimina imágenes de Cloudinary)
async function eliminarReporteCompleto() {
  const form = document.getElementById('repForm');
  const numero = form.numero.value;
  if (!numero) return;
  if (!confirm("¿Eliminar este reporte? (Las imágenes seguirán en Cloudinary)")) return;
  await db.collection("reportes").doc(numero).delete();
  showProgress(false);
  alert("Reporte eliminado.");
  renderInicio();
}

// -------- PDF DE REPORTE 100% FUNCIONAL --------
async function generarPDFReporte(share = false) {
  showProgress(true, 10, "Generando PDF...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    const descripcion = tr.querySelector('textarea[name="descripcion"]').value.trim();
    const fotos = (fotosItemsReporte[idx] || []).filter(Boolean);
    items.push({ descripcion, fotos });
  });

  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const naranja = rgb(0.97,0.54,0.11);
  const azul = rgb(0.11,0.20,0.37);
  const gris = rgb(0.48,0.53,0.56);

  const pageW = 595, pageH = 842;
  const mx = 48, my = 65;
  let y = pageH - my;

  // Logo
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  // Datos empresa
  const EMS_EMPRESA = "Electromotores Santana";
  const EMS_CONTACT = "Carr. a Chichimequillas 306, Col. Menchaca, 76147 Santiago de Querétaro, Qro.\nTel. 442 469 9895 · electromotores.santana@gmail.com";

  // Encabezado
  function drawHeader(page, isFirst) {
    // Marca de agua (en todas las páginas)
    page.drawImage(logoImg, {
      x: (pageW - 330) / 2,
      y: (pageH - 330) / 2,
      width: 330,
      height: 330,
      opacity: 0.09
    });
    // Header
    const logoH = 54;
    page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
    const leftX = mx + logoH + 14;
    page.drawText(EMS_EMPRESA, { x: leftX, y: y, size: 17, font: helvB, color: azul });
    page.drawText("Reporte de Servicio", { x: leftX, y: y - 20, size: 12, font: helvB, color: naranja });
    page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 38, size: 11, font: helv, color: gris });
    page.drawText(`No: ${datos.numero||""}`, { x: pageW - mx - 170, y: y, size: 11, font: helvB, color: azul });
    page.drawText(`Fecha: ${datos.fecha||""}`, { x: pageW - mx - 170, y: y - 20, size: 11, font: helvB, color: azul });
    page.drawText(EMS_CONTACT, { x: mx, y: y - 56, size: 9.5, font: helv, color: gris, maxWidth: pageW - mx*2 });
    y -= 74;
  }

  // --- NUEVA PAGINA ---
  let page = pdfDoc.addPage([pageW, pageH]);
  y = pageH - my;
  drawHeader(page, true);
  y -= 30;

  // --- ITEMS ---
  for (const it of items) {
    if (y < 240) {
      page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; drawHeader(page);
      y -= 30;
    }
    // IMAGENES (max 4 por fila, grandes, margen)
    const maxImgs = 4, imgSize = 108, gutter = 16;
    let imgs = (it.fotos||[]).slice(0,8);
    for (let i = 0; i < imgs.length; i += maxImgs) {
      let rowImgs = imgs.slice(i, i+maxImgs);
      let rowW = rowImgs.length * imgSize + (rowImgs.length-1)*gutter;
      let x = mx + (pageW - mx*2 - rowW) / 2;
      for (let k = 0; k < rowImgs.length; k++) {
        try {
          const bytes = await fetch(rowImgs[k]).then(r => r.arrayBuffer());
          let img;
          try { img = await pdfDoc.embedPng(bytes); }
          catch { img = await pdfDoc.embedJpg(bytes); }
          page.drawImage(img, { x, y: y-imgSize, width: imgSize, height: imgSize });
        } catch (e) {}
        x += imgSize + gutter;
      }
      y -= imgSize + 7;
    }
    // DESCRIPCION
    if (it.descripcion?.trim()) {
      if (y < 70) {
        page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; drawHeader(page);
        y -= 30;
      }
      page.drawText((it.descripcion||"").toString(), { x: mx+10, y: y, size: 11.5, font: helv, color: azul, maxWidth: pageW-mx*2-25 });
      y -= 22;
    }
    // Separador entre items
    page.drawLine({ start:{x:mx, y:y+4}, end:{x:pageW-mx, y:y+4}, thickness: 1, color: gris, opacity: 0.45 });
    y -= 14;
  }

  // Notas
  if ((datos.notas||"").trim().length) {
    if (y < 60) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; drawHeader(page); y -= 20; }
    page.drawText("Notas:", { x: mx, y, size: 11.5, font: helvB, color: azul });
    y -= 13;
    page.drawText((datos.notas||"").toString(), { x: mx+40, y, size: 10, font: helv, color: gris, maxWidth: pageW-mx*2-50 });
    y -= 12;
  }

  // Pie de página profesional (derecha)
  page.drawText(`Electromotores Santana · ${new Date().getFullYear()}`, {
    x: pageW-240, y: 22, size: 9, font: helv, color: gris
  });
  page.drawText("Carr. a Chichimequillas 306, Col. Menchaca, Querétaro · electromotores.santana@gmail.com", {
    x: pageW-415, y: 10, size: 8.7, font: helv, color: gris, maxWidth: 400
  });

  // Guardar y descargar
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
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}



// --------- PDF DE COTIZACIÓN ---------
// --------- PDF DE COTIZACIÓN PROFESIONAL ---------
async function generarPDFCotizacion(share = false) {
  showProgress(true, 10, "Generando PDF...");
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
  const incluyeIVA = form.incluyeIVA && form.incluyeIVA.checked;
  const tieneAnticipo = form.anticipo && form.anticipo.checked;
  const porcAnticipo = Number(form.anticipoPorc?.value || 0);

  // --- CALCULOS ---
  let subtotal = 0;
  items.forEach(it => { subtotal += it.cantidad * it.precio; });
  let iva = incluyeIVA ? subtotal * 0.16 : 0;
  let total = subtotal + iva;
  let anticipo = tieneAnticipo ? total * (porcAnticipo / 100) : 0;

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Formato y colores
  const naranja = rgb(0.97,0.54,0.11);
  const azul = rgb(0.11,0.20,0.37);
  const gris = rgb(0.48,0.53,0.56);

  const pageW = 595, pageH = 842;
  const mx = 48, my = 65; // margen superior aumentado
  let y = pageH - my;

  // Logo
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg = await pdfDoc.embedPng(logoBytes);

  // Datos empresa
  const EMS_EMPRESA = "Electromotores Santana";
  const EMS_CONTACT = "Carr. a Chichimequillas 306, Col. Menchaca, 76147 Santiago de Querétaro, Qro.\nTel. 442 469 9895 · electromotores.santana@gmail.com";

  // Header
  function drawHeader(page, isFirst) {
    // Logo grande de fondo como marca de agua (en todas las páginas)
    page.drawImage(logoImg, {
      x: (pageW - 330) / 2,
      y: (pageH - 330) / 2,
      width: 330,
      height: 330,
      opacity: 0.07
    });
    // Encabezado con logo y texto
    const logoH = 54;
    page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
    const leftX = mx + logoH + 14;
    page.drawText(EMS_EMPRESA, { x: leftX, y: y, size: 17, font: helvB, color: azul });
    page.drawText("Cotización de Servicio", { x: leftX, y: y - 20, size: 12, font: helvB, color: naranja });
    page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 38, size: 11, font: helv, color: gris });
    page.drawText(`No: ${datos.numero||""}`, { x: mx + 320, y: y, size: 11, font: helvB, color: azul });
    page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + 320, y: y - 20, size: 11, font: helvB, color: azul });
    page.drawText(EMS_CONTACT, { x: mx, y: y - 56, size: 9.5, font: helv, color: gris, maxWidth: pageW - mx*2 });
    y -= 74;
  }

  // --- Nueva página ---
  let page = pdfDoc.addPage([pageW, pageH]);
  y = pageH - my;
  drawHeader(page, true);
  y -= 28;

  // --- TABLA ---
  // Encabezados tabla
  const tableX = mx, tableW = pageW - mx*2;
  const col1 = tableX, col2 = col1 + 170, col3 = col2 + 64, col4 = col3 + 58, col5 = col4 + 85;
  page.drawText("Concepto", { x: col1, y, size: 11, font: helvB, color: azul });
  page.drawText("Unidad", { x: col2, y, size: 11, font: helvB, color: azul });
  page.drawText("Cantidad", { x: col3, y, size: 11, font: helvB, color: azul });
  page.drawText("Precio", { x: col4, y, size: 11, font: helvB, color: azul });
  page.drawText("Importe", { x: col5, y, size: 11, font: helvB, color: azul });
  y -= 14;

  // Línea superior
  page.drawLine({ start: {x:tableX, y}, end: {x:tableX+tableW, y}, thickness: 1, color: gris });

  // Filas
  y -= 8;
  for (const it of items) {
    if (y < 120) {
      page = pdfDoc.addPage([pageW, pageH]); y = pageH - my; drawHeader(page);
      y -= 50;
    }
    // Fondo de la fila
    page.drawRectangle({
      x: tableX, y: y-4, width: tableW, height: 24, color: rgb(1,1,1), opacity: 0.94, borderColor: rgb(0.89,0.89,0.89)
    });
    // Texto
    page.drawText((it.concepto||"").toString(), { x: col1+3, y: y, size: 10.6, font: helv, color: rgb(0.18,0.18,0.18), maxWidth: col2-col1-6 });
    page.drawText((it.unidad||"").toString(),   { x: col2+2, y, size: 10.6, font: helv, color: rgb(0.23,0.23,0.25), maxWidth: col3-col2-6 });
    page.drawText(String(it.cantidad||""),      { x: col3+2, y, size: 10.6, font: helv, color: azul });
    page.drawText("$" + String(it.precio.toFixed(2)), { x: col4+4, y, size: 10.6, font: helv, color: azul });
    page.drawText("$" + String((it.cantidad*it.precio).toFixed(2)), { x: col5+6, y, size: 10.6, font: helv, color: naranja });
    // Línea inferior
    y -= 25;
    page.drawLine({ start: {x:tableX, y}, end: {x:tableX+tableW, y}, thickness: 0.6, color: gris });
  }

  // Subtotales, IVA, Total y anticipo resaltados
  y -= 18;
  let tx = col5+6;
  function rightLine(txt, valor, color, size=11, yMod=0) {
    page.drawText(txt,   { x: col4-22, y:y+yMod, size, font: helv, color: gris });
    page.drawText("$"+valor, { x: tx, y:y+yMod, size, font: helvB, color });
  }
  rightLine("Subtotal", subtotal.toFixed(2), azul, 11.5);
  y -= 17;
  if (incluyeIVA) { rightLine("IVA 16%", iva.toFixed(2), naranja, 11.2); y -= 17; }
  rightLine("TOTAL", total.toFixed(2), naranja, 13);
  y -= 23;

  if (tieneAnticipo) {
    rightLine(`Anticipo (${porcAnticipo.toFixed(1)}%)`, anticipo.toFixed(2), rgb(0.96,0.40,0.11), 11.5, 2);
    y -= 16;
    rightLine("Total pendiente", (total-anticipo).toFixed(2), azul, 11.8, 2);
    y -= 16;
  }

  // Observaciones/Notas
  if ((datos.notas||"").trim().length) {
    y -= 23;
    page.drawText("Notas:", { x: tableX, y, size: 11, font: helvB, color: azul });
    y -= 14;
    page.drawText((datos.notas||"").toString(), { x: tableX+44, y, size: 10, font: helv, color: gris, maxWidth: tableW-50 });
    y -= 15;
  }

  // Pie de página profesional (derecha)
  page.drawText(`Electromotores Santana · ${new Date().getFullYear()}`, {
    x: pageW-240, y: 22, size: 9, font: helv, color: gris
  });
  page.drawText("Carr. a Chichimequillas 306, Col. Menchaca, Querétaro · electromotores.santana@gmail.com", {
    x: pageW-415, y: 10, size: 8.7, font: helv, color: gris, maxWidth: 400
  });

  // Guardar y descargar
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `Cotizacion_${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Cotización de Servicio",
      text: `Cotización ${datos.numero||""} de Electromotores Santana`
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}



// --------- Protección contra cierre accidental -------------
window.onbeforeunload = function(e) {
  const root = document.getElementById('root');
  if (!root) return;
  if (root.innerHTML.includes("ems-form") && document.activeElement.tagName !== "BODY") {
    return "¿Estás seguro de salir? Hay cambios sin guardar.";
  }
};

// --------- Inicialización predictivos -------------
window.addEventListener('DOMContentLoaded', () => { actualizarPredictsEMSCloud();; });
actualizarPredictsEMSCloud();;
