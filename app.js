// EMS - Electromotores Santana - app.js

// Configuración Firebase
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
    if (!show) setTimeout(() => { inner.innerHTML = ""; }, 600);
  }
}

// Banner offline
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

// Predictivos
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

// Dictado por voz
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

// ----------- HISTORIAL Y BÚSQUEDA -----------
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

// ----------- COTIZACIONES -----------
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
  savePredictEMS("cliente", datos.cliente);
  items.forEach(it => {
    savePredictEMS("concepto", it.concepto);
    savePredictEMS("unidad", it.unidad);
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
    window.editandoReporte = true;
    abrirReporte(numero);
  }
}
// ================== REPORTES ==================

// Render de un item/actividad del reporte
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

// Agrega una fila/actividad nueva
function agregarRepItemRow() {
  const tbody = document.getElementById('repItemsTable').querySelector('tbody');
  const idx = tbody.children.length;
  fotosItemsReporte[idx] = [];
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow({}, idx, true));
  agregarDictadoMicros();
}

// Elimina un item y sus fotos
function eliminarRepItemRow(btn) {
  const tr = btn.closest('tr');
  const idx = Array.from(tr.parentNode.children).indexOf(tr);
  fotosItemsReporte.splice(idx, 1);
  tr.remove();
}

// Para crear nuevo reporte
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
    actualizarPredictsEMS();
    agregarDictadoMicros();
  }, 100);

  agregarRepItemRow();
  document.getElementById('repForm').onsubmit = enviarReporte;
}

// ABRIR REPORTE — edita SIN duplicados
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
    actualizarPredictsEMS();
    agregarDictadoMicros();
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

// SUBIR imagen
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

// Guardar el reporte en Firestore
async function enviarReporte(e) {
  e.preventDefault();
  showProgress(true, 65, "Guardando...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  let ok = true;
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    let desc = tr.querySelector('textarea[name="descripcion"]').value.trim();
    let fotos = Array.from(tr.querySelectorAll("img"))
      .map(img => img.src)
      .filter(Boolean);
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

// ========== PDF DE REPORTE (AHORA TOMA LAS IMÁGENES DIRECTO DEL DOM) ==========
async function generarPDFReporte(share = false) {
  showProgress(true, 10, "Generando PDF...");
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  // Captura items del DOM, no solo del modelo
  const items = [];
  form.querySelectorAll('#itemsTableR tbody tr').forEach(tr => {
    const descripcion = tr.querySelector('textarea[name="descripcion"]').value.trim();
    const fotos = Array.from(tr.querySelectorAll('.rep-img-list img')).map(img => img.src);
    if (!descripcion && fotos.length === 0) return;
    items.push({ descripcion, fotos });
  });

  // PDF-lib
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 56, my = 72;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  // Logo
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  // Encabezado SOLO en la primera página
  function drawHeader(page, firstPage = false) {
    page.drawImage(logoImg, {
      x: (pageW - 320) / 2,
      y: (pageH - 320) / 2,
      width: 320,
      height: 320,
      opacity: 0.04
    });
    if (firstPage) {
      const logoH = 54;
      page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
      const leftX = mx + logoH + 16;
      page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y, size: 17, font: helvB, color: rgb(0.11,0.20,0.37) });
      page.drawText("Reporte de Servicio", { x: leftX, y: y - 20, size: 12, font: helvB, color: rgb(0.97,0.54,0.11) });
      page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 38, size: 11, font: helv, color: rgb(0.16,0.18,0.22) });
      page.drawText(`No: ${datos.numero||""}`, { x: mx + usableW - 100, y: y, size: 11, font: helvB, color: rgb(0.13,0.22,0.38) });
      page.drawText(`Fecha: ${datos.fecha||""}`, { x: mx + usableW - 100, y: y - 20, size: 11, font: helvB, color: rgb(0.13,0.22,0.38) });
      y -= 54;
    }
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  drawHeader(page, true);
  y -= 42;

  // Por cada item
  for (const it of items) {
    // Imágenes en pares (max 6 por item, 2 por fila)
    for (let i = 0; i < it.fotos.length && i < 6; i += 2) {
      // Salto de página si falta espacio
      if (y < 170) {
        page = pdfDoc.addPage([pageW, pageH]);
        drawHeader(page, false);
        y = pageH - my;
      }
      let imgsRow = it.fotos.slice(i, i+2);
      let w = imgsRow.length === 2 ? 125 : 200;
      let gutter = imgsRow.length === 2 ? 15 : 0;
      let x = mx + (usableW - (w*imgsRow.length + gutter*(imgsRow.length-1))) / 2;

      for (let k = 0; k < imgsRow.length; k++) {
        try {
          const bytes = await fetch(imgsRow[k]).then(r => r.arrayBuffer());
          let img;
          // Prueba PNG, si no JPG
          try {
            img = await pdfDoc.embedPng(bytes);
          } catch {
            img = await pdfDoc.embedJpg(bytes);
          }
          page.drawImage(img, { x, y: y - w, width: w, height: w });
        } catch (e) {
          // Si falla, ignora esa imagen
        }
        x += w + gutter;
      }
      y -= w + 10;
    }
    // Descripción centrada
    if (it.descripcion?.trim()) {
      if (y < 100) {
        page = pdfDoc.addPage([pageW, pageH]);
        drawHeader(page, false);
        y = pageH - my;
      }
      page.drawText(it.descripcion, { x: mx+10, y: y, size: 11, font: helv, color: rgb(0.16,0.18,0.22) });
      y -= 28;
    }
  }

  // Notas
  if (datos.notas?.trim()) {
    if (y < 80) {
      page = pdfDoc.addPage([pageW, pageH]);
      drawHeader(page, false);
      y = pageH - my;
    }
    page.drawText("Notas:", { x: mx, y, size: 12, font: helvB, color: rgb(0.15,0.18,0.22) });
    y -= 16;
    page.drawText(datos.notas.trim(), { x: mx + 38, y, size: 10, font: helv, maxWidth: usableW - 60 });
    y -= 30;
  }

  // Pie de página
  page.drawText("Electromotores Santana · " + (new Date().getFullYear()), { x: mx, y: 22, size: 10, font: helv, color: rgb(0.45,0.46,0.60)});
  page.drawText("Documento confidencial solo para uso del cliente.", { x: mx, y: 10, size: 9, font: helv, color: rgb(0.52,0.51,0.48) });

  // Descargar o compartir
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

// ============= PDF DE COTIZACIÓN =============
async function generarPDFCotizacion(share = false) {
  showProgress(true, 20, "Generando PDF...");
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

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 46, my = 80;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  const logoBytes = await fetch(LOGO_URL).then(r=>r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(logoImg, { x: mx, y: y+20, width: 60, height: 60 });
  page.drawText("ELECTROMOTORES SANTANA", {
    x: mx + 70, y: y+45, size: 18, font: helvB, color: rgb(0.11,0.20,0.37)
  });
  page.drawText("Cotización de Servicios", {
    x: mx + 70, y: y+23, size: 12, font: helv, color: rgb(0.52,0.35,0.09)
  });
  page.drawText(`No: ${datos.numero||""}`, {
    x: mx + usableW - 120, y: y+45, size: 12, font: helvB, color: rgb(0.13,0.22,0.38)
  });
  page.drawText(`Fecha: ${datos.fecha||""}`, {
    x: mx + usableW - 120, y: y+23, size: 12, font: helvB, color: rgb(0.13,0.22,0.38)
  });
  y -= 20;

  page.drawText(`Cliente: ${datos.cliente || ""}`, { x: mx, y: y, size: 12, font: helv, color: rgb(0.16,0.19,0.22)});
  y -= 18;

  // Tabla de conceptos
  const cols = ["Concepto", "Unidad", "Cantidad", "Precio", "Total"];
  let xcols = [mx, mx+210, mx+320, mx+400, mx+480];
  cols.forEach((col, i) => {
    page.drawText(col, { x: xcols[i], y: y, size: 11, font: helvB });
  });
  y -= 12;
  page.drawLine({start: {x:mx, y}, end: {x:pageW-mx, y}, thickness:1, color: rgb(0.83,0.84,0.86)});
  y -= 8;

  let subtotal = 0;
  items.forEach(it => {
    let total = (Number(it.cantidad)||0) * (Number(it.precio)||0);
    subtotal += total;
    let vals = [
      (it.concepto||"").substring(0,40),
      it.unidad||"", 
      it.cantidad||"",
      it.precio? `$${Number(it.precio).toLocaleString("es-MX",{minimumFractionDigits:2})}` : "",
      total? `$${total.toLocaleString("es-MX",{minimumFractionDigits:2})}` : ""
    ];
    vals.forEach((v,i) => {
      page.drawText(String(v), { x: xcols[i], y: y, size: 10.5, font: helv });
    });
    y -= 17;
    if (y < 100) { // Nueva página
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my;
    }
  });

  // Totales
  let iva = datos.incluyeIVA ? subtotal * 0.16 : 0;
  let total = subtotal + iva;
  if (iva > 0) {
    page.drawText("IVA (16%):", { x: mx+400, y: y-2, size: 11, font: helvB });
    page.drawText(`$${iva.toLocaleString("es-MX",{minimumFractionDigits:2})}`, { x: mx+480, y: y-2, size: 11, font: helvB });
    y -= 16;
  }
  page.drawText("Total:", { x: mx+400, y: y-2, size: 13, font: helvB, color: rgb(0.1,0.19,0.34) });
  page.drawText(`$${total.toLocaleString("es-MX",{minimumFractionDigits:2})}`, { x: mx+480, y: y-2, size: 13, font: helvB, color: rgb(0.1,0.19,0.34) });
  y -= 28;

  // Notas
  if (datos.notas) {
    page.drawText("Notas:", { x: mx, y, size: 10.5, font: helvB, color: rgb(0.17,0.18,0.22)});
    y -= 14;
    const notasArr = datos.notas.match(/.{1,100}/g) || [datos.notas];
    notasArr.forEach(str => {
      page.drawText(str, { x: mx + 12, y, size: 10.5, font: helv, color: rgb(0.13,0.15,0.19)});
      y -= 15;
    });
  }

  // Pie
  page.drawText(`Electromotores Santana · ${AUTHOR} · ${new Date().getFullYear()}`, { 
    x: mx, y: 22, size: 10, font: helv, color: rgb(0.41,0.46,0.60)
  });
  page.drawText("Documento confidencial solo para uso del cliente.", { 
    x: mx, y: 8, size: 8, font: helv, color: rgb(0.52,0.51,0.48)
  });

  // Descargar o compartir
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const file = new File([blob], `${datos.numero||"cotizacion"}.pdf`, { type: "application/pdf" });

  if (share && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "Cotización",
        text: `Cotización ${datos.numero||""} de Electromotores Santana`
      });
      return;
    } catch {}
  }
  // Descargar
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${datos.numero||"cotizacion"}.pdf`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
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
window.addEventListener('DOMContentLoaded', () => { actualizarPredictsEMS(); });
actualizarPredictsEMS();
