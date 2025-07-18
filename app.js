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
let ultimoEstadoForm = "";
let autoSaveTimer = null;

function safe(val) {
  return (val === undefined || val === null) ? "" : String(val);
}

async function guardarDraft(tipo) {
  if (tipo === "cotizacion") {
    if (document.getElementById('cotForm')) await guardarDraftCotizacion();
  } else if (tipo === "reporte") {
    if (document.getElementById('repForm')) await guardarDraftReporte();
  }
}


function guardarCotizacionDraft() {
  const form = document.getElementById('cotForm');
  if (!form) return;
  // Campos simples
  const datos = Object.fromEntries(new FormData(form));
  // Items de tabla
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
      precio: Number(tr.querySelector('input[name="precio"]').value)
    });
  });
  datos.items = items;
  localStorage.setItem('EMS_COT_BORRADOR', JSON.stringify(datos));
}


function guardarReporteDraft() {
  const form = document.getElementById('repForm');
  if (!form) return;
  // Campos simples
  const datos = Object.fromEntries(new FormData(form));
  // Items de tabla
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    let desc = tr.querySelector('textarea[name="descripcion"]').value.trim();
    let fotos = (window.fotosItemsReporte?.[idx] || []).filter(Boolean); // toma las fotos temporales
    items.push({ descripcion: desc, fotos });
  });
  datos.items = items;
  localStorage.setItem('EMS_REP_BORRADOR', JSON.stringify(datos));
}


// Llama esto después de renderCotizacion() y renderReporte()
function iniciarAutoSave(formId, saveFn) {
  clearInterval(autoSaveTimer);
  ultimoEstadoForm = "";
  autoSaveTimer = setInterval(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const actual = new FormData(form);
    const str = JSON.stringify(Array.from(actual.entries()));
    if (str !== ultimoEstadoForm) {
      ultimoEstadoForm = str;
      saveFn();
      mostrarGuardado();
    }
  }, 15000);
}

function mostrarGuardado() {
  let m = document.getElementById("mensaje-guardado");
  if (!m) {
    m = document.createElement("div");
    m.id = "mensaje-guardado";
    m.style.position = "fixed";
    m.style.bottom = "25px";
    m.style.right = "28px";
    m.style.background = "#06c167d8";
    m.style.color = "#fff";
    m.style.padding = "8px 18px";
    m.style.fontSize = "1em";
    m.style.zIndex = "9999";
    m.style.borderRadius = "12px";
    m.style.boxShadow = "0 2px 10px #2222";
    document.body.appendChild(m);
  }
  m.innerText = "Guardado";
  m.style.opacity = "1";
  setTimeout(() => { m.style.opacity = "0"; }, 1500);
}

function hoy() { return (new Date()).toISOString().slice(0, 10); }
function ahora() { const d = new Date(); return d.toTimeString().slice(0, 5); }
function formatMoney(val) {
  return "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

async function guardarDraftCotizacion() {
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

async function guardarDraftReporte() {
  const form = document.getElementById('repForm');
  if (!form) return;
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#repItemsTable tbody tr').forEach((tr, idx) => {
    let desc = tr.querySelector('textarea[name="descripcion"]').value.trim();
    let fotos = (fotosItemsReporte[idx] || []).filter(Boolean);
    if (fotos.length > 6) fotos = fotos.slice(0,6);
    items.push({ descripcion: desc, fotos });
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
            <!-- FILAS SE AGREGAN ABAJO -->
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
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_COT_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="guardarCotizacionDraft(); generarPDFCotizacion()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarCotizacionDraft(); generarPDFCotizacion(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
  `;
  const form = document.getElementById('cotForm');
  // Cargar draft si existe
  let draft = localStorage.getItem('EMS_COT_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    // Campos simples
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
  }, 100);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarCotizacion(e);
    localStorage.removeItem('EMS_COT_BORRADOR');
  };
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
        <button type="button" class="btn-mini" onclick="renderInicio(); localStorage.removeItem('EMS_REP_BORRADOR')"><i class="fa fa-arrow-left"></i> Cancelar</button>
        <button type="submit" class="btn-primary"><i class="fa fa-save"></i> Guardar</button>
        <button type="button" class="btn-secondary" onclick="guardarReporteDraft(); generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="guardarReporteDraft(); generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
        <button type="button" class="btn-danger" onclick="eliminarReporteCompleto()" style="float:right;"><i class="fa fa-trash"></i> Eliminar</button>
      </div>
    </form>
  `;
  const form = document.getElementById('repForm');
  // Cargar draft si existe
  let draft = localStorage.getItem('EMS_REP_BORRADOR');
  if (draft) {
    draft = JSON.parse(draft);
    // Campos simples
    Object.keys(draft).forEach(k => {
      if (k !== "items" && form[k] !== undefined) form[k].value = draft[k];
    });
    // Items de tabla
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
    actualizarPredictsEMSCloud()();
    agregarDictadoMicros();
  }, 100);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await enviarReporte(e);
    localStorage.removeItem('EMS_REP_BORRADOR');
  };
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
    actualizarPredictsEMSCloud() && actualizarPredictsEMSCloud();//actualizarPredictsEMS();
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
  await guardarDraft('reporte');
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

  const pageW = 595.28, pageH = 841.89;
  const mx = 32, my = 42;
  const usableW = pageW - mx*2;
  let y = pageH - my;

  const EMS_CONTACT = "Carr. a Chichimequillas 306, Col. Menchaca, Querétaro, Qro.\nTel: 442 469 9895 | electromotores.santana@gmail.com";
  const VIGENCIA = "Vigencia: 15 días. Todo lo no previsto en este reporte se informará oportunamente.";

  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(logoImg, { x: mx, y: y-54, width: 54, height: 54 });
  page.drawText("ELECTROMOTORES SANTANA", { x: mx+64, y: y-5, size: 19, font: helvB, color: rgb(0.12,0.20,0.40) });
  page.drawText("Reporte de Servicio", { x: mx+64, y: y-26, size: 13, font: helvB, color: rgb(1, 0.60, 0.13) });
  page.drawText(EMS_CONTACT, {
    x: mx+64, y: y-45, size: 9.5, font: helv, color: rgb(0.08,0.12,0.18),
    maxWidth: usableW-68, lineHeight: 11
  });
  y -= 62;
  page.drawLine({ start: { x: mx, y }, end: { x: pageW-mx, y }, thickness: 2, color: rgb(1, 0.60, 0.13) });
  y -= 14;

  // --- Datos reporte ---
  page.drawText("Cliente:", { x: mx, y, size: 12, font: helvB });
  page.drawText(datos.cliente || "", { x: mx+55, y, size: 12, font: helv });
  page.drawText("Reporte No.:", { x: pageW/2+14, y, size: 12, font: helvB });
  page.drawText(datos.numero || "", { x: pageW/2+110, y, size: 12, font: helv });
  y -= 16;
  page.drawText("Fecha:", { x: mx, y, size: 12, font: helvB });
  page.drawText(datos.fecha || "", { x: mx+55, y, size: 12, font: helv });
  page.drawText("Hora:", { x: pageW/2+60, y, size: 12, font: helvB });
  page.drawText(datos.hora || "", { x: pageW/2+110, y, size: 12, font: helv });

  y -= 26;

  // --- ITEMS ---
  for (const it of items) {
    let fotos = it.fotos || [];
    if (fotos.length) {
      let imgW = fotos.length === 1 ? 240 : fotos.length === 2 ? 190 : 130;
      let gutter = 16;
      let imgsPerRow = fotos.length > 2 ? 2 : fotos.length;
      for (let i = 0; i < fotos.length; i += imgsPerRow) {
        if (y < 170) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - my - 80;
        }
        let imgsRow = fotos.slice(i, i+imgsPerRow);
        let rowStart = pageW/2 - (imgsRow.length*imgW + (imgsRow.length-1)*gutter)/2;
        let xi = rowStart;
        for (let k = 0; k < imgsRow.length; k++) {
          try {
            const bytes = await fetch(imgsRow[k]).then(r => r.arrayBuffer());
            let img;
            try { img = await pdfDoc.embedPng(bytes); }
            catch { img = await pdfDoc.embedJpg(bytes); }
            page.drawImage(img, { x: xi, y: y-imgW, width: imgW, height: imgW });
          } catch (e) {}
          xi += imgW + gutter;
        }
        y -= imgW + 16;
      }
    }
    // Descripción con margen
    if (it.descripcion?.trim()) {
      if (y < 110) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - my - 80;
      }
      page.drawText(it.descripcion, {
        x: mx+5, y: y, size: 12, font: helv, color: rgb(0.13,0.14,0.16), maxWidth: usableW-20, lineHeight: 16
      });
      let descLines = Math.ceil(it.descripcion.length/(usableW/7));
      y -= 24 + descLines*12;
    } else {
      y -= 20;
    }
    // Línea divisoria
    page.drawLine({
      start: { x: mx, y: y+7 },
      end:   { x: pageW-mx, y: y+7 },
      thickness: 1.2,
      color: rgb(0.76,0.80,0.94)
    });
    y -= 12;
  }

  // Notas / observaciones
  if (datos.notas?.trim()) {
    if (y < 70) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - my - 40;
    }
    page.drawText("Observaciones:", { x: mx, y, size: 12, font: helvB, color: rgb(0.15,0.18,0.22) });
    y -= 14;
    page.drawText(datos.notas.trim(), { x: mx+14, y, size: 11, font: helv, maxWidth: usableW-22 });
    y -= 14;
  }

  // Pie de página
  page.drawRectangle({
    x: mx, y: 26, width: usableW, height: 32, color: rgb(0.11, 0.24, 0.44)
  });
  page.drawText(VIGENCIA, {
    x: mx+14, y: 39, size: 10, font: helv, color: rgb(1,1,1),
    maxWidth: usableW-20
  });
  page.drawText("Electromotores Santana © "+(new Date().getFullYear()), {
    x: mx+14, y: 29, size: 10, font: helv, color: rgb(0.96,0.96,0.96)
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



// --------- PDF DE COTIZACIÓN PROFESIONAL ---------
async function generarPDFCotizacion(share = false) {
  showProgress(true, 10, "Generando PDF...");
  await guardarDraft('cotizacion');
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    items.push({
      concepto: tr.querySelector('input[name="concepto"]').value,
      unidad: tr.querySelector('input[name="unidad"]').value,
      cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
      precio: Number(tr.querySelector('input[name="precio"]').value),
      importe: Number(tr.querySelector('input[name="cantidad"]').value) * Number(tr.querySelector('input[name="precio"]').value)
    });
  });

  let subtotal = items.reduce((sum, x) => sum + (x.importe || 0), 0);
  let incluyeIVA = form.incluyeIVA?.checked || false;
  let iva = incluyeIVA ? subtotal * 0.16 : 0;
  let total = subtotal + iva;
  let anticipo = 0, anticipoPorc = 0;
  if (form.anticipo?.checked) {
    anticipoPorc = Number(form.anticipoPorc.value) || 0;
    anticipo = total * (anticipoPorc/100);
  }

  // PDF LIB
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28, pageH = 841.89; // A4
  const mx = 32, my = 38;
  const usableW = pageW - mx*2;
  let y = pageH - my;

  const EMS_CONTACT = "Carr. a Chichimequillas 306, Col. Menchaca, Querétaro, Qro.\nTel: 442 469 9895 | electromotores.santana@gmail.com";
  const VIGENCIA = "Vigencia: 15 días. Todo lo no previsto en esta cotización se informará oportunamente.";

  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([pageW, pageH]);
  // Encabezado
  page.drawImage(logoImg, { x: mx, y: y-58, width: 64, height: 64 });
  page.drawText("ELECTROMOTORES SANTANA", {
    x: mx + 80, y: y-10, size: 23, font: helvB, color: rgb(0.12,0.20,0.40)
  });
  page.drawText("Cotización", {
    x: mx + 80, y: y-36, size: 17, font: helvB, color: rgb(1, 0.60, 0.13)
  });
  page.drawText(EMS_CONTACT, {
    x: mx + 80, y: y-56, size: 10.5, font: helv, color: rgb(0.08,0.12,0.18),
    maxWidth: usableW - 85, lineHeight: 13
  });

  // Línea naranja bajo encabezado
  y -= 74;
  page.drawLine({ start: { x: mx, y }, end: { x: pageW-mx, y }, thickness: 2, color: rgb(1, 0.60, 0.13) });
  y -= 18;

  // --- DATOS COTIZACION ---
  page.drawText("Cliente:", { x: mx, y, size: 12, font: helvB, color: rgb(0.07,0.08,0.12)});
  page.drawText(datos.cliente || "", { x: mx+65, y, size: 12, font: helv, color: rgb(0.07,0.08,0.12)});
  page.drawText("Cotización No.:", { x: pageW/2 + 24, y, size: 12, font: helvB });
  page.drawText(datos.numero || "", { x: pageW/2 + 130, y, size: 12, font: helv });
  y -= 19;
  page.drawText("Fecha:", { x: mx, y, size: 12, font: helvB });
  page.drawText(datos.fecha || "", { x: mx+65, y, size: 12, font: helv });
  page.drawText("Hora:", { x: pageW/2 + 70, y, size: 12, font: helvB });
  page.drawText(datos.hora || "", { x: pageW/2 + 130, y, size: 12, font: helv });

  y -= 21;

  // --- TABLA ---
  // Mejoramos el espaciado y simetría de líneas
  const th = 25, tf = 23;
  const cols = [
    { name: "Concepto", w: 0.30 },
    { name: "Unidad",   w: 0.18 },
    { name: "Cantidad", w: 0.16 },
    { name: "Precio",   w: 0.18 },
    { name: "Importe",  w: 0.18 }
  ];
  let colX = [mx];
  for (let i=0; i<cols.length; ++i) {
    colX.push(mx + Math.round(usableW * cols.slice(0,i+1).reduce((a,c)=>a+c.w,0)));
  }
  // Encabezado tabla
  let yTable = y;
  page.drawRectangle({
    x: mx, y: yTable, width: usableW, height: -th,
    color: rgb(1,0.60,0.13), borderColor: rgb(1,0.60,0.13), borderWidth: 0.5
  });
  for (let i=0; i<cols.length; ++i) {
    page.drawText(cols[i].name, { x: colX[i]+7, y: yTable-17, size: 12, font: helvB, color: rgb(0.12,0.20,0.40) });
    if (i>0) {
      page.drawLine({ start: {x: colX[i], y: yTable}, end: {x: colX[i], y: yTable-th-items.length*tf-10}, thickness: 1, color: rgb(0.8,0.8,0.8) });
    }
  }

  // Filas de items
  y = yTable-th;
  for (let idx=0; idx<items.length; ++idx) {
    let it = items[idx];
    for (let i=0; i<cols.length; ++i) {
      let val = [
        it.concepto||"", it.unidad||"", String(it.cantidad), `$${(it.precio||0).toFixed(2)}`, `$${(it.importe||0).toFixed(2)}`
      ][i];
      page.drawText(val, {
        x: colX[i]+7, y: y-15, size: 11, font: helv, color: rgb(0.14,0.16,0.23)
      });
    }
    // línea bajo fila
    page.drawLine({
      start: {x: mx, y: y-1}, end: {x: pageW-mx, y: y-1}, thickness: 0.7,
      color: idx === items.length-1 ? rgb(1,0.60,0.13) : rgb(0.80,0.80,0.80)
    });
    y -= tf;
  }
  // Línea naranja tras tabla
  y -= 8;
  page.drawLine({ start: {x: mx, y}, end: {x: pageW-mx, y}, thickness: 2, color: rgb(1, 0.60, 0.13) });
  y -= 8;

  // Totales
  let xtot = pageW-mx-170;
  page.drawText("Subtotal:", { x: xtot, y, size: 13, font: helvB, color: rgb(0.2,0.2,0.26)});
  page.drawText(`$${subtotal.toLocaleString("en-US", {minimumFractionDigits:2})}`, { x: xtot+87, y, size: 13, font: helvB, color: rgb(0.12,0.12,0.12)});
  y -= 20;
  page.drawText("IVA (16%):", { x: xtot, y, size: 13, font: helvB, color: rgb(0.45,0.48,0.56)});
  page.drawText(`$${iva.toLocaleString("en-US", {minimumFractionDigits:2})}`, { x: xtot+87, y, size: 13, font: helvB, color: rgb(0.12,0.12,0.12)});
  y -= 23;
  page.drawText("TOTAL:", { x: xtot, y, size: 17, font: helvB, color: rgb(1, 0.60, 0.13)});
  page.drawText(`$${total.toLocaleString("en-US", {minimumFractionDigits:2})}`, { x: xtot+87, y, size: 17, font: helvB, color: rgb(1, 0.48, 0.06)});
  y -= 22;
  if (anticipoPorc && anticipo > 0) {
    page.drawText(`Anticipo ${anticipoPorc}%:`, { x: xtot, y, size: 14, font: helvB, color: rgb(0.16, 0.58, 0.22)});
    page.drawText(`$${anticipo.toLocaleString("en-US", {minimumFractionDigits:2})}`, { x: xtot+87, y, size: 14, font: helvB, color: rgb(0.13,0.58,0.21)});
    y -= 18;
  }

  // Observaciones/Notas
  if (datos.notas?.trim()) {
    y -= 20;
    page.drawText("Observaciones:", { x: mx, y, size: 12, font: helvB, color: rgb(0.14,0.15,0.20)});
    y -= 16;
    page.drawText(datos.notas.trim(), { x: mx+10, y, size: 11, font: helv, color: rgb(0.16,0.16,0.20), maxWidth: usableW-20, lineHeight: 13 });
    y -= 18;
  }

  // Pie de página
  page.drawRectangle({
    x: mx, y: 26, width: usableW, height: 32, color: rgb(0.11, 0.24, 0.44)
  });
  page.drawText(VIGENCIA, {
    x: mx+14, y: 39, size: 10, font: helv, color: rgb(1,1,1),
    maxWidth: usableW-20
  });
  page.drawText("Electromotores Santana © "+(new Date().getFullYear()), {
    x: mx+14, y: 29, size: 10, font: helv, color: rgb(0.96,0.96,0.96)
  });

  // Salida PDF
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





function mostrarGuardado() {
  let el = document.getElementById("guardado-msg");
  if (!el) {
    el = document.createElement("div");
    el.id = "guardado-msg";
    el.style.position = "fixed";
    el.style.top = "14px";
    el.style.right = "20px";
    el.style.zIndex = 9999;
    el.style.background = "#e4fae7";
    el.style.color = "#1e6e24";
    el.style.fontWeight = "bold";
    el.style.border = "1px solid #b9e5c8";
    el.style.padding = "8px 16px";
    el.style.borderRadius = "10px";
    el.style.boxShadow = "0 2px 12px #0001";
    document.body.appendChild(el);
  }
  el.textContent = "¡Borrador guardado!";
  el.style.display = "";
  setTimeout(() => { el.style.display = "none"; }, 1200);
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

setInterval(() => {
  if (document.getElementById('cotForm')) guardarCotizacionDraft();
  if (document.getElementById('repForm')) guardarReporteDraft();
}, 15000);
