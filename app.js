// EMS - Electromotores Santana - app.js

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
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 48, my = 60;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  const LOGO_URL = "https://i.imgur.com/RQucHEc.png";
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg = await pdfDoc.embedPng(logoBytes);

  function drawHeader(page, firstPage = false) {
    if (firstPage) {
      page.drawImage(logoImg, { x: mx, y: y - 15, width: 60, height: 60 });
      page.drawText("ELECTROMOTORES SANTANA", { x: mx + 70, y: y + 30, size: 18, font: helvB, color: rgb(0.1,0.18,0.4) });
      page.drawText("Reporte de Servicio", { x: mx + 70, y: y + 8, size: 13, font: helvB, color: rgb(0.98,0.54,0.11) });
      page.drawText("Carr. a Chichimequillas 306, Col. Menchaca, 76147 Santiago de Querétaro, Qro.", { x: mx + 70, y: y - 10, size: 8.8, font: helv, color: rgb(0.2,0.22,0.3) });
      page.drawText("Tel: 442 469 9895 | electromotores.santana@gmail.com", { x: mx + 70, y: y - 24, size: 8.8, font: helv, color: rgb(0.2,0.22,0.3) });
      page.drawText(`Folio: ${datos.numero || ""}`, { x: pageW - mx - 120, y: y + 27, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
      page.drawText(`Fecha: ${datos.fecha || ""}`, { x: pageW - mx - 120, y: y + 13, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
      page.drawText(`Cliente: ${datos.cliente || ""}`, { x: pageW - mx - 120, y: y - 1, size: 10.5, font: helvB, color: rgb(0.13,0.22,0.38) });
    }
  }

  // Pie de página premium (igual al de cotización)
  function drawFooter(page) {
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: 32, color: rgb(0.1,0.18,0.4), opacity: 0.92 });
    page.drawImage(logoImg, { x: pageW / 2 - 20, y: 2, width: 40, height: 28 });
    page.drawText("Electromotores Santana © " + (new Date().getFullYear()), { x: mx, y: 10, size: 9.5, font: helvB, color: rgb(0.97,0.97,0.97) });
    page.drawText("Solo válido para uso del cliente. Carr. a Chichimequillas 306, Qro. Tel: 442 469 9895", { x: mx + 155, y: 10, size: 9, font: helv, color: rgb(0.97,0.97,0.97) });
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  drawHeader(page, true);
  y -= 70;

  for (const it of items) {
    // IMAGENES: hasta 3 por fila, más grandes, bien distribuidas
    for (let i = 0; i < it.fotos.length && i < 6; i += 3) {
      if (y < 200) {
        page = pdfDoc.addPage([pageW, pageH]);
        drawHeader(page, false);
        y = pageH - my;
      }
      let imgsRow = it.fotos.slice(i, i+3);
      let w = 140, h = 110, gutter = 14;
      let totalWidth = imgsRow.length * w + (imgsRow.length - 1) * gutter;
      let x = mx + (usableW - totalWidth) / 2;

      for (let k = 0; k < imgsRow.length; k++) {
        try {
          const bytes = await fetch(imgsRow[k]).then(r => r.arrayBuffer());
          let img;
          try { img = await pdfDoc.embedPng(bytes); } catch { img = await pdfDoc.embedJpg(bytes); }
          page.drawImage(img, { x, y: y - h, width: w, height: h });
        } catch (e) {}
        x += w + gutter;
      }
      y -= h + 12;
    }
    if (it.descripcion?.trim()) {
      if (y < 110) {
        page = pdfDoc.addPage([pageW, pageH]);
        drawHeader(page, false);
        y = pageH - my;
      }
      page.drawText(it.descripcion, { x: mx + 8, y: y, size: 11, font: helv, color: rgb(0.14,0.16,0.22) });
      y -= 30;
    }
  }

  if (datos.notas?.trim()) {
    if (y < 80) {
      page = pdfDoc.addPage([pageW, pageH]);
      drawHeader(page, false);
      y = pageH - my;
    }
    page.drawText("Notas / Observaciones:", { x: mx, y, size: 11, font: helvB, color: rgb(0.09,0.14,0.21) });
    page.drawText(datos.notas.trim(), { x: mx + 150, y, size: 10, font: helv, maxWidth: pageW - mx * 2 - 160 });
    y -= 24;
  }

  drawFooter(page);

  // Final
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

  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 56, my = 72;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  // LOGO Y ENCABEZADO
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  function drawHeader(page, firstPage = false) {
    page.drawImage(logoImg, {
      x: mx,
      y: y - 50,
      width: 56,
      height: 56
    });
    page.drawText("ELECTROMOTORES SANTANA", { x: mx + 70, y: y-2, size: 17, font: helvB, color: rgb(0.13,0.20,0.38) });
    page.drawText("Cotización", { x: mx + 70, y: y-22, size: 13, font: helvB, color: rgb(0.97,0.54,0.11) });
    page.drawText("Carr. a Chichimequillas 306, Colonia Menchaca, 76147 Santiago de Querétaro, Qro.", { x: mx + 70, y: y-38, size: 9, font: helv, color: rgb(0.12,0.12,0.12) });
    page.drawText("Tel: 442 469 9895 | electromotores.santana@gmail.com", { x: mx + 70, y: y-50, size: 9, font: helv, color: rgb(0.12,0.12,0.12) });
    y -= 60;
    page.drawLine({ start: { x: mx, y }, end: { x: pageW - mx, y }, thickness: 1, color: rgb(0.9, 0.55, 0.12) });
    y -= 16;
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  drawHeader(page, true);

  // DATOS
  page.drawText("Cliente:", { x: mx, y, size: 11, font: helvB });
  page.drawText(datos.cliente || "", { x: mx + 60, y, size: 11, font: helv });
  page.drawText("Cotización No:", { x: pageW - mx - 130, y, size: 11, font: helvB });
  page.drawText(datos.numero || "", { x: pageW - mx - 30, y, size: 11, font: helv });
  y -= 18;
  page.drawText("Fecha:", { x: mx, y, size: 11, font: helvB });
  page.drawText(datos.fecha || "", { x: mx + 60, y, size: 11, font: helv });
  page.drawText("Hora:", { x: pageW - mx - 130, y, size: 11, font: helvB });
  page.drawText(datos.hora || "", { x: pageW - mx - 30, y, size: 11, font: helv });
  y -= 30;

  // TABLA (con líneas verticales/horizontales)
  const headers = ["Concepto", "Unidad", "Cantidad", "Precio Unit.", "Importe"];
  const cols = [mx, mx+160, mx+220, mx+290, mx+390, pageW-mx];
  const th = 22;
  let tableY = y;

  // Encabezados
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], { x: cols[i] + 5, y: tableY, size: 11, font: helvB, color: rgb(0.15,0.15,0.20) });
  }
  y = tableY - th;

  // Líneas verticales y horizontales
  for (let x of cols) {
    page.drawLine({ start: { x, y: tableY+th/2 }, end: { x, y: y-3 }, thickness: 1, color: rgb(0.82,0.83,0.87) });
  }
  page.drawLine({ start: { x: cols[0], y: tableY+th/2 }, end: { x: cols[cols.length-1], y: tableY+th/2 }, thickness: 1, color: rgb(0.67,0.7,0.74) });

  // Cuerpo de tabla
  let subtotal = 0;
  for (const item of items) {
    const importe = (item.cantidad || 0) * (item.precio || 0);
    subtotal += importe;
    page.drawText(item.concepto || "", { x: cols[0] + 5, y, size: 10, font: helv });
    page.drawText(item.unidad || "", { x: cols[1] + 5, y, size: 10, font: helv });
    page.drawText(String(item.cantidad || ""), { x: cols[2] + 13, y, size: 10, font: helv });
    page.drawText(`$${(item.precio || 0).toFixed(2)}`, { x: cols[3] + 10, y, size: 10, font: helv });
    page.drawText(`$${importe.toFixed(2)}`, { x: cols[4] + 10, y, size: 10, font: helvB, color: rgb(0.18,0.19,0.27) });
    y -= th;
    // Líneas horizontales por cada fila
    page.drawLine({ start: { x: cols[0], y: y+th }, end: { x: cols[cols.length-1], y: y+th }, thickness: 1, color: rgb(0.95,0.95,0.96) });
  }
  // Línea final de tabla
  page.drawLine({ start: { x: cols[0], y }, end: { x: cols[cols.length-1], y }, thickness: 1.5, color: rgb(0.90,0.90,0.92) });

  // TOTALES
  y -= 6;
  page.drawText("Subtotal:", { x: cols[3]+10, y, size: 11, font: helvB });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: cols[4]+10, y, size: 11, font: helvB });
  y -= th;

  let iva = 0, total = subtotal;
  if (datos.incluyeIVA) {
    iva = subtotal * 0.16;
    total += iva;
    page.drawText("IVA (16%):", { x: cols[3]+10, y, size: 11, font: helvB });
    page.drawText(`$${iva.toFixed(2)}`, { x: cols[4]+10, y, size: 11, font: helvB });
    y -= th;
  }
  page.drawLine({ start: { x: cols[3]+8, y: y+th-8 }, end: { x: cols[cols.length-1], y: y+th-8 }, thickness: 2, color: rgb(0.98,0.70,0.13) });
  page.drawText("TOTAL:", { x: cols[3]+10, y, size: 13, font: helvB, color: rgb(0.97,0.54,0.11) });
  page.drawText(`$${total.toFixed(2)}`, { x: cols[4]+10, y, size: 13, font: helvB, color: rgb(0.97,0.54,0.11) });
  y -= th+3;

  // NOTAS
  if (datos.notas?.trim()) {
    page.drawText("Notas / Condiciones:", { x: mx, y, size: 11, font: helvB });
    y -= 14;
    page.drawText(datos.notas.trim(), { x: mx+12, y, size: 10, font: helv, maxWidth: usableW-20 });
    y -= 18;
  }

  // PIE DE PÁGINA VISUAL
  const footerY = 38;
  page.drawRectangle({
    x: 0, y: 0, width: pageW, height: footerY, color: rgb(0.13,0.20,0.38), opacity: 0.90
  });
  page.drawImage(logoImg, {
    x: pageW/2-23, y: 6, width: 46, height: 26, opacity: 0.25
  });
  page.drawText("Electromotores Santana · Santiago de Querétaro, Qro.", {
    x: mx, y: 20, size: 10, font: helv, color: rgb(0.98,0.98,0.98)
  });
  page.drawText("Carr. a Chichimequillas 306 | Tel: 442 469 9895 | electromotores.santana@gmail.com", {
    x: mx, y: 9, size: 9, font: helv, color: rgb(0.98,0.98,0.98)
  });

  // SAVE Y DESCARGA O COMPARTIR
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
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
