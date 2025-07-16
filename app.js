// ======================
// EMS Cotizaciones y Reportes v3
// ======================

const LOGO_URL = "https://i.imgur.com/RQucHEc.png";
const AUTHOR = "Francisco López Velázquez";

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

// ===== Helpers =====
function hoy() {
  return (new Date()).toISOString().slice(0, 10);
}
function ahora() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}
function showProgress(show = true) {
  document.getElementById("progress-bar").style.display = show ? "" : "none";
}
function showOffline(show = true) {
  const banner = document.getElementById("ems-offline-banner");
  if (show) {
    banner.style.display = "";
    banner.innerHTML = '<b>Sin conexión.</b> Los datos se guardarán localmente hasta que regreses a Internet.';
  } else {
    banner.style.display = "none";
  }
}
window.addEventListener("online", () => showOffline(false));
window.addEventListener("offline", () => showOffline(true));
// ===== Predictivo (localStorage) =====
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
  // Cotizaciones
  const conceptos = getPredictEMS("concepto");
  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = conceptos.map(v=>`<option value="${v}">`).join('');

  const unidades = getPredictEMS("unidad");
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = unidades.map(v=>`<option value="${v}">`).join('');

  // Ambos formularios
  const clientes = getPredictEMS("cliente");
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = clientes.map(v=>`<option value="${v}">`).join('');

  // Descripciones en reportes
  const descs = getPredictEMS("desc");
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = descs.map(v=>`<option value="${v}">`).join('');
}

// === Dictado universal ===
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
// ===== Render Home UI =====
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
// ---- Guardado automático (autosave) ----

let autosaveInterval = null;
function iniciarAutosave(formId, tipo) {
  clearInterval(autosaveInterval);
  autosaveInterval = setInterval(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const datos = Object.fromEntries(new FormData(form));
    if (tipo === "cotizacion") {
      const items = [];
      form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
        items.push({
          concepto: tr.querySelector('input[name="concepto"]').value,
          unidad: tr.querySelector('input[name="unidad"]').value,
          cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
          precio: Number(tr.querySelector('input[name="precio"]').value)
        });
      });
      localStorage.setItem("ems_cot_borrador", JSON.stringify({ ...datos, items }));
    } else {
      const items = [];
      form.querySelectorAll('#itemsTableR tbody tr').forEach(tr => {
        items.push({
          descripcion: tr.querySelector('textarea[name="descripcion"]').value,
          fotos: Array.from(tr.querySelectorAll('.rep-img-list img')).map(img => img.src)
        });
      });
      localStorage.setItem("ems_rep_borrador", JSON.stringify({ ...datos, items }));
    }
  }, 50000);
}

function cargarBorradorCot() {
  try {
    const borrador = JSON.parse(localStorage.getItem("ems_cot_borrador") || "{}");
    if (!borrador.numero && !borrador.cliente) return;
    if (confirm("¿Cargar el último borrador de cotización?")) {
      editarCotizacion(borrador);
    }
  } catch {}
}
function cargarBorradorRep() {
  try {
    const borrador = JSON.parse(localStorage.getItem("ems_rep_borrador") || "{}");
    if (!borrador.numero && !borrador.cliente) return;
    if (confirm("¿Cargar el último borrador de reporte?")) {
      editarReporte(borrador);
    }
  } catch {}
}
// ======== Cotización UI y lógica ========

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
    iniciarAutosave('cotForm', 'cotizacion');
  }, 100);
  cargarBorradorCot();
  iniciarAutoGuardado("cotizacion");
  cargarBorradorSiExiste("cotizacion");
}

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
// ========= Reporte UI y lógica =========

function nuevoReporte() {
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
          <datalist id="clientesEMS"></datalist>
        </div>
        <div class="ems-form-group">
          <label>Hora</label>
          <input type="time" name="hora" value="${ahora()}">
        </div>
        <div class="ems-form-group">
          <label>
            <input type="checkbox" name="corrigeIA"> Mejorar redacción con IA
          </label>
        </div>
      </div>
      <div>
        <table class="ems-items-table" id="itemsTableR">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Fotos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${renderRepItemRow()}
          </tbody>
        </table>
        <button type="button" class="btn-secondary" onclick="agregarRepItemRow()">Agregar item</button>
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
        <button type="button" class="btn-secondary" onclick="generarPDFReporte()"><i class="fa fa-file-pdf"></i> PDF</button>
        <button type="button" class="btn-success" onclick="generarPDFReporte(true)"><i class="fa fa-share-alt"></i> Compartir</button>
      </div>
    </form>
  `;
  document.getElementById('repForm').onsubmit = enviarReporte;
  setTimeout(() => {
    actualizarPredictsEMS();
    agregarDictadoMicros();
    iniciarAutosave('repForm', 'reporte');
  }, 100);
  cargarBorradorRep();
  iniciarAutoGuardado("reporte");
  cargarBorradorSiExiste("reporte");
}

function renderRepItemRow(item = {}) {
  let imgsHtml = '';
  if (item.fotos && item.fotos.length) {
    imgsHtml = item.fotos.map(src => `<img src="${src}" width="44" height="44" style="margin-right:4px">`).join('');
  }
  return `
    <tr>
      <td>
        <textarea name="descripcion" list="descEMS" required rows="2" autocomplete="off">${item.descripcion||""}</textarea>
        <datalist id="descEMS"></datalist>
      </td>
      <td>
        <div class="rep-img-list">${imgsHtml}</div>
        <input type="file" accept="image/*" multiple onchange="handleRepImgUpload(this)">
      </td>
      <td>
        <button type="button" class="btn-mini" onclick="eliminarRepItemRow(this)"><i class="fa fa-trash"></i></button>
      </td>
    </tr>
  `;
}
function agregarRepItemRow() {
  const tbody = document.getElementById('itemsTableR').querySelector('tbody');
  tbody.insertAdjacentHTML('beforeend', renderRepItemRow());
  agregarDictadoMicros();
}
function eliminarRepItemRow(btn) {
  btn.closest('tr').remove();
}
function handleRepImgUpload(input) {
  const list = input.previousElementSibling;
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.width = 44; img.height = 44;
      img.style.marginRight = "4px";
      list.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}
// ========== GUARDAR Cotización ==========
async function enviarCotizacion(e) {
  e.preventDefault();
  showProgress(true);
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
    guardarPendienteEMS('cotizacion', cotizacion);
    showProgress(false);
    alert("Guardado localmente. Se enviará a la nube cuando regreses a internet.");
    renderInicio();
    return;
  }
  await db.collection("cotizaciones").doc(datos.numero).set(cotizacion);
  showProgress(false);
  alert("¡Cotización guardada!");
  renderInicio();
}

// ========== GUARDAR Reporte ==========
async function enviarReporte(e) {
  e.preventDefault();
  showProgress(true);
  const form = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTableR tbody tr').forEach(tr => {
    items.push({
      descripcion: tr.querySelector('textarea[name="descripcion"]').value,
      fotos: Array.from(tr.querySelectorAll('.rep-img-list img')).map(img => img.src)
    });
  });
  if (!datos.numero || !datos.cliente || !items.length) {
    showProgress(false);
    alert("Completa todos los campos requeridos.");
    return;
  }
  savePredictEMS("cliente", datos.cliente);
  items.forEach(it => savePredictEMS("desc", it.descripcion));
  if (form.corrigeIA && form.corrigeIA.checked) {
    datos.notas = corregirRedaccionIA(datos.notas || "");
    items.forEach(it => it.descripcion = corregirRedaccionIA(it.descripcion));
  }
  const reporte = {
    ...datos,
    items,
    tipo: 'reporte',
    fecha: datos.fecha,
    hora: datos.hora || ahora(),
    creada: new Date().toISOString()
  };
  if (!navigator.onLine) {
    guardarPendienteEMS('reporte', reporte);
    showProgress(false);
    alert("Guardado localmente. Se enviará a la nube cuando regreses a internet.");
    renderInicio();
    return;
  }
  await db.collection("reportes").doc(datos.numero).set(reporte);
  showProgress(false);
  alert("¡Reporte guardado!");
  renderInicio();
}

// --- Simulación simple de corrección IA (puedes conectar API real después) ---
function corregirRedaccionIA(texto) {
  // Esto es una simulación simple (mejora ortografía y mayúsculas)
  return (texto||"")
    .replace(/\s+/g, " ")
    .replace(/\bi\b/g, "I")
    .replace(/(^|\.\s+)([a-z])/g, (m,p1,p2)=>p1+p2.toUpperCase())
    .replace(/\s\./g,".")
    .replace(/\s\,/g,",");
}
async function generarPDFCotizacion(share = false) {
  showProgress(true);
  const form = document.getElementById('cotForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    const concepto = tr.querySelector('input[name="concepto"]').value.trim();
    const cantidad = Number(tr.querySelector('input[name="cantidad"]').value);
    const precio   = Number(tr.querySelector('input[name="precio"]').value);
    if (!concepto || (cantidad === 0 && precio === 0)) return;
    items.push({ concepto, unidad: tr.querySelector('input[name="unidad"]').value, cantidad, precio });
  });

  // Totales
  const subtotal = items.reduce((s,i)=> s + i.cantidad * i.precio, 0);
  const iva      = datos.incluyeIVA ? subtotal * 0.16 : 0;
  const total    = subtotal + iva;
  const anticipo = (datos.anticipo && datos.anticipoPorc)
                 ? total * (Number(datos.anticipoPorc)/100)
                 : 0;

  // PDF
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 56, my = 72;
  const usableW = pageW - mx * 2;
  let y = pageH - my;

  // Marca de agua
  const logoBytes = await fetch(LOGO_URL).then(r=>r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(logoImg, {
    x: (pageW - 320) / 2,
    y: (pageH - 320) / 2,
    width: 320,
    height: 320,
    opacity: 0.04
  });

  // Logo en encabezado (alto total)
  const logoH = 60;
  page.drawImage(logoImg, {
    x: mx,
    y: y - logoH + 6,
    width: logoH,
    height: logoH
  });

  // Título
  const leftX = mx + logoH + 18;
  page.drawText("ELECTROMOTORES SANTANA", {
    x: leftX, y: y, size: 19, font: helvB, color: rgb(0.11,0.20,0.37)
  });
  page.drawText("embobinados y soluciones eléctricas", {
    x: leftX, y: y - 18, size: 11, font: helv, color: rgb(0.5,0.53,0.6)
  });
  page.drawText("Cotización", {
    x: leftX, y: y - 34, size: 13, font: helvB, color: rgb(0.97,0.54,0.11)
  });
  page.drawText(`Cliente: ${datos.cliente||""}`, {
    x: leftX, y: y - 52, size: 11, font: helv, color: rgb(0.16,0.18,0.22)
  });

  // No. y fecha alineados derecha
  const noTxt = `No: ${datos.numero||""}`;
  const feTxt = `Fecha: ${datos.fecha||""}`;
  const noW   = helvB.widthOfTextAtSize(noTxt, 12);
  const feW   = helvB.widthOfTextAtSize(feTxt, 12);
  page.drawText(noTxt, { x: mx + usableW - noW, y: y, size: 12, font: helvB, color: rgb(0.13,0.22,0.38) });
  page.drawText(feTxt, { x: mx + usableW - feW, y: y - 18, size: 12, font: helvB, color: rgb(0.13,0.22,0.38) });

  // Línea divisoria
  y -= 74;
  page.drawLine({ start:{x:mx,y}, end:{x:pageW-mx,y}, thickness:1.2, color:rgb(0.80,0.84,0.9) });
  y -= 22;

  // Tabla de items (manejo de salto de página)
  const tableX = mx, tableW = usableW;
  const cols   = [0, 160, 260, 340, 440, tableW];
  const rowH   = 32;
  // Cabecera tabla
  page.drawRectangle({ x: tableX, y: y, width: tableW, height: rowH, color: rgb(0.11,0.20,0.37) });
  ["Concepto","Unidad","Cantidad","P. Unitario","Total"].forEach((h,i) => {
    page.drawText(h, { x: tableX + cols[i] + 6, y: y + 8, size: 11, font: helvB, color: rgb(1,1,1) });
  });
  y -= rowH;
  let idx = 0;

  function saltarPagina() {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - my;
    // Marca de agua
    page.drawImage(logoImg, {
      x: (pageW - 320) / 2,
      y: (pageH - 320) / 2,
      width: 320,
      height: 320,
      opacity: 0.04
    });
  }

  for (; idx < items.length; idx++) {
    if (y < my + 180) { // suficiente para totales, notas, pie
      saltarPagina();
    }
    const it = items[idx];
    if (idx % 2 === 1) {
      page.drawRectangle({ x: tableX, y: y, width: tableW, height: rowH, color: rgb(0.96,0.97,0.99) });
    }
    page.drawText(it.concepto, { x: tableX + 6,          y: y + 8, size: 10.5, font: helv, color: rgb(0.15,0.18,0.22) });
    page.drawText(it.unidad,   { x: tableX + cols[1] + 6, y: y + 8, size: 10.5, font: helv });
    page.drawText(`${it.cantidad}`,   { x: tableX + cols[2] + 6, y: y + 8, size: 10.5, font: helv });
    page.drawText(`$${it.precio.toFixed(2)}`, { x: tableX + cols[3] + 6, y: y + 8, size: 10.5, font: helv });
    page.drawText(`$${(it.cantidad * it.precio).toFixed(2)}`, { x: tableX + cols[4] + 6, y: y + 8, size: 10.5, font: helv });
    y -= rowH;
  }

  // Línea antes de totales
  y -= 10;
  page.drawLine({ start: { x: mx + usableW - 200, y }, end: { x: mx + usableW, y }, thickness: 2, color: rgb(0.13,0.24,0.38) });
  y -= 4;

  // Totales alineados caja
  let ty = y - 10;
  const bx = mx + usableW - 200;
  page.drawRectangle({ x: bx, y: ty - 78, width: 200, height: 86, color: rgb(0.96,0.97,0.99) });
  ty -= 10;
  page.drawText("Subtotal:", { x: bx + 10,   y: ty, size: 11, font: helvB });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: bx + 120, y: ty, size: 11, font: helv });
  ty -= 20;
  if (datos.incluyeIVA) {
    page.drawText("IVA (16%):", { x: bx + 10,   y: ty, size: 11, font: helvB });
    page.drawText(`$${iva.toFixed(2)}`,    { x: bx + 120, y: ty, size: 11, font: helv });
    ty -= 20;
  }
  page.drawText("TOTAL:", { x: bx + 10,    y: ty, size: 13, font: helvB, color: rgb(0.98,0.54,0.08) });
  page.drawText(`$${total.toFixed(2)}`, { x: bx + 120, y: ty, size: 13, font: helvB, color: rgb(0.98,0.54,0.08) });
  if (anticipo > 0) {
    ty -= 20;
    page.drawText("Anticipo:", { x: bx + 10,    y: ty, size: 11, font: helvB });
    page.drawText(`$${anticipo.toFixed(2)}`, { x: bx + 120, y: ty, size: 11, font: helv });
  }

  // Notas
  y = ty - 40;
  page.drawText("Notas:", { x: mx, y, size: 12, font: helvB, color: rgb(0.15,0.18,0.22) });
  if ((datos.notas || "").trim()) {
    page.drawText(datos.notas.trim(), {
      x: mx + 56,
      y,
      size: 10,
      font: helv,
      maxWidth: usableW - 90
    });
  }

  // Pie de página
  const footer = "Carretera a Chichimequillas #306, Menchaca 2, Querétaro | Tel: 442 469 9895";
  const fw     = helv.widthOfTextAtSize(footer, 11);
  page.drawText(footer, {
    x: (pageW - fw) / 2,
    y: 22,
    size: 11,
    font: helv,
    color: rgb(0.5,0.5,0.5)
  });

  // Descargar/Compartir
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob     = new Blob([pdfBytes], { type: "application/pdf" });
  const file     = new File([blob], `Cotizacion_${datos.numero}.pdf`, { type: "application/pdf" });

  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `Cotización ${datos.numero}` });
  } else {
    // fuerza descarga cuando share=false o no hay API de compartir
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download= file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
async function generarPDFReporte(share = false) {
  showProgress(true);
  const form  = document.getElementById('repForm');
  const datos = Object.fromEntries(new FormData(form));
  const items = [];
  form.querySelectorAll('#itemsTableR tbody tr').forEach(tr => {
    const descripcion = tr.querySelector('textarea[name="descripcion"]').value.trim();
    const fotos = Array.from(tr.querySelectorAll('.rep-img-list img')).map(i => i.src);
    if (!descripcion && fotos.length === 0) return;
    items.push({ descripcion, fotos });
  });

  // PDF setup
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595, pageH = 842;
  const mx = 56, my = 72;
  const usableW = pageW - mx * 2;
  const marginBottom = 90;
  let y = pageH - my;

  // Marca de agua
  const logoBytes = await fetch(LOGO_URL).then(r => r.arrayBuffer());
  const logoImg   = await pdfDoc.embedPng(logoBytes);

  // Encabezado (reutilizable por página)
  async function drawHeader(page) {
    page.drawImage(logoImg, {
      x: (pageW - 320) / 2,
      y: (pageH - 320) / 2,
      width: 320,
      height: 320,
      opacity: 0.04
    });
    // Logo en encabezado
    const logoH = 60;
    page.drawImage(logoImg, { x: mx, y: y - logoH + 6, width: logoH, height: logoH });
    const leftX = mx + logoH + 18;
    page.drawText("ELECTROMOTORES SANTANA", { x: leftX, y: y, size: 19, font: helvB, color: rgb(0.11,0.20,0.37) });
    page.drawText("embobinados y soluciones eléctricas", { x: leftX, y: y - 18, size: 11, font: helv, color: rgb(0.5,0.53,0.6) });
    page.drawText("Reporte de Servicio", { x: leftX, y: y - 34, size: 13, font: helvB, color: rgb(0.97,0.54,0.11) });
    page.drawText(`Cliente: ${datos.cliente||""}`, { x: leftX, y: y - 52, size: 11, font: helv, color: rgb(0.16,0.18,0.22) });
    // No. y fecha alineados derecha
    const noTxt = `No: ${datos.numero||""}`;
    const feTxt = `Fecha: ${datos.fecha||""}`;
    const noW   = helvB.widthOfTextAtSize(noTxt, 12);
    const feW   = helvB.widthOfTextAtSize(feTxt, 12);
    page.drawText(noTxt, { x: mx + usableW - noW, y: y, size: 12, font: helvB, color: rgb(0.13,0.22,0.38) });
    page.drawText(feTxt, { x: mx + usableW - feW, y: y - 18, size: 12, font: helvB, color: rgb(0.13,0.22,0.38) });
    // Línea divisoria
    page.drawLine({ start:{x:mx,y: y-74}, end:{x:pageW-mx, y: y-74}, thickness:1.2, color:rgb(0.80,0.84,0.9) });
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  await drawHeader(page);
  y -= (74 + 32);

  // Por cada item: imágenes en pares centradas, luego descripción centrada
  for (const it of items) {
    const fotos = it.fotos || [];
    // Divide en pares (de 2)
    for (let i = 0; i < fotos.length; i += 2) {
      // Calcula espacio, añade nueva página si necesario
      if (y < marginBottom + 140) {
        page = pdfDoc.addPage([pageW, pageH]);
        await drawHeader(page);
        y = pageH - my - (74 + 32);
      }
      let imgsInRow = fotos.slice(i, i+2);
      let w = imgsInRow.length === 2 ? 180 : 220;
      let gutter = imgsInRow.length === 2 ? 18 : 0;
      let x = mx + (usableW - (w*imgsInRow.length + gutter*(imgsInRow.length-1)))/2;

      for (let k=0; k<imgsInRow.length; k++) {
        try {
          const bytes = await fetch(imgsInRow[k]).then(r => r.arrayBuffer());
          const img   = await pdfDoc.embedPng(bytes);
          page.drawImage(img, { x, y: y - w, width: w, height: w });
        } catch(e){}
        x += w + gutter;
      }
      y -= w + 12;
    }
    // Descripción centrada, multi-línea
    if (y < marginBottom + 60) {
      page = pdfDoc.addPage([pageW, pageH]);
      await drawHeader(page);
      y = pageH - my - (74 + 32);
    }
    if (it.descripcion?.trim()) {
      const fontSize = 11, lineHeight = 16;
      const words = it.descripcion.split(" ");
      let line = "", lines = [];
      for (const w of words) {
        if (helv.widthOfTextAtSize(line + w + " ", fontSize) > usableW - 50) {
          lines.push(line);
          line = w + " ";
        } else {
          line += w + " ";
        }
      }
      if (line) lines.push(line);
      lines.forEach((ln, j) => {
        const tw = helv.widthOfTextAtSize(ln, fontSize);
        page.drawText(ln, { x: mx + (usableW-tw)/2, y: y - (j*lineHeight), size: fontSize, font: helv, color: rgb(0.14,0.17,0.27) });
      });
      y -= lines.length * lineHeight + 20;
    }
  }

  // Notas
  if (datos.notas?.trim()) {
    if (y < marginBottom + 60) {
      page = pdfDoc.addPage([pageW, pageH]);
      await drawHeader(page);
      y = pageH - my - (74 + 32);
    }
    page.drawText("Notas:", { x: mx, y, size:12, font:helvB, color:rgb(0.15,0.18,0.22) });
    y -= 16;
    page.drawText(datos.notas.trim(), { x: mx + 48, y, size:10, font:helv, maxWidth: usableW - 60 });
    y -= 40;
  }

  // Pie de página
  const footer = "Carretera a Chichimequillas #306, Menchaca 2, Querétaro | Tel: 442 469 9895";
  const fw     = helv.widthOfTextAtSize(footer, 11);
  page.drawText(footer, { x: (pageW - fw)/2, y:22, size:11, font:helv, color:rgb(0.5,0.5,0.5) });

  // Descargar/Compartir
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  const blob     = new Blob([pdfBytes], { type: "application/pdf" });
  const file     = new File([blob], `Reporte_${datos.numero}.pdf`, { type: "application/pdf" });

  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `Reporte ${datos.numero}` });
  } else {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download= file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

// Exportar para que el botón lo encuentre siempre
window.generarPDFReporte = generarPDFReporte;
// Predictivo (localStorage)
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
  // Cotizaciones
  const conceptos = getPredictEMS("concepto");
  const datalistConceptos = document.getElementById("conceptosEMS");
  if (datalistConceptos) datalistConceptos.innerHTML = conceptos.map(v=>`<option value="${v}">`).join('');
  const unidades = getPredictEMS("unidad");
  const datalistUnidades = document.getElementById("unidadesEMS");
  if (datalistUnidades) datalistUnidades.innerHTML = unidades.map(v=>`<option value="${v}">`).join('');
  // Clientes
  const clientes = getPredictEMS("cliente");
  const datalistClientes = document.getElementById("clientesEMS");
  if (datalistClientes) datalistClientes.innerHTML = clientes.map(v=>`<option value="${v}">`).join('');
  // Descripciones
  const descs = getPredictEMS("desc");
  const datalistDesc = document.getElementById("descEMS");
  if (datalistDesc) datalistDesc.innerHTML = descs.map(v=>`<option value="${v}">`).join('');
}

// Dictado por voz (Chrome)
function iniciarDictadoCot(btn, name) {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Tu navegador no soporta dictado por voz.");
    return;
  }
  const recog = new webkitSpeechRecognition();
  recog.lang = "es-MX";
  recog.onresult = (evt) => {
    const val = evt.results[0][0].transcript;
    const input = btn.parentElement.querySelector(`[name="${name}"]`);
    if (input) input.value = val;
  };
  recog.start();
}
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

// Edición de reporte
function editarReporte(datos) {
  nuevoReporte();
  const form = document.getElementById("repForm");
  form.numero.value = datos.numero;
  form.fecha.value = datos.fecha;
  form.cliente.value = datos.cliente;
  form.hora.value = datos.hora;
  const tbody = form.querySelector("#itemsTableR tbody");
  tbody.innerHTML = "";
  (datos.items || []).forEach(item => {
    tbody.insertAdjacentHTML("beforeend", renderRepItemRow(item));
    // Agregar imágenes
    if (item.fotos && item.fotos.length) {
      const tr = tbody.lastElementChild;
      const div = tr.querySelector('.rep-img-list');
      item.fotos.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.width = 44; img.height = 44;
        img.style.marginRight = "4px";
        div.appendChild(img);
      });
    }
  });
  form.notas.value = datos.notas || "";
}

// Idem para cotizaciones
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
let autoSaveInterval = null;
let ultimoTipoForm = "";
let ultimoFormId = "";

// Llama esto al mostrar formulario de cotización o reporte
function iniciarAutoGuardado(tipo) {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  ultimoTipoForm = tipo;
  ultimoFormId = tipo === "cotizacion" ? "cotForm" : "repForm";
  autoSaveInterval = setInterval(autoGuardarBorrador, 50000); // cada 50 segundos
}

function autoGuardarBorrador() {
  const form = document.getElementById(ultimoFormId);
  if (!form) return;
  let datos = Object.fromEntries(new FormData(form));
  if (ultimoTipoForm === "cotizacion") {
    datos.items = [];
    form.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
      datos.items.push({
        concepto: tr.querySelector('input[name="concepto"]').value,
        unidad: tr.querySelector('input[name="unidad"]').value,
        cantidad: Number(tr.querySelector('input[name="cantidad"]').value),
        precio: Number(tr.querySelector('input[name="precio"]').value)
      });
    });
  } else if (ultimoTipoForm === "reporte") {
    datos.items = [];
    form.querySelectorAll('#itemsTableR tbody tr').forEach(tr => {
      datos.items.push({
        descripcion: tr.querySelector('textarea[name="descripcion"]').value,
        fotos: Array.from(tr.querySelectorAll('.rep-img-list img')).map(img => img.src)
      });
    });
  }
  // Guardar en localStorage
  localStorage.setItem(`ems_borrador_${ultimoTipoForm}`, JSON.stringify(datos));
  // Mostrar feedback rápido
  const pb = document.getElementById("progress-bar");
  pb.style.display = "";
  pb.querySelector(".progress-inner").style.width = "100%";
  pb.querySelector(".progress-inner").style.background = "#8bc34a";
  pb.querySelector(".progress-inner").innerHTML = "<i class='fa fa-save'></i> Borrador guardado";
  setTimeout(() => {
    pb.querySelector(".progress-inner").style.width = "0%";
    pb.querySelector(".progress-inner").innerHTML = "";
    pb.style.display = "none";
  }, 1200);
}

function cargarBorradorSiExiste(tipo) {
  const borrador = JSON.parse(localStorage.getItem(`ems_borrador_${tipo}`) || "null");
  if (!borrador) return;
  setTimeout(() => {
    if (tipo === "cotizacion") editarCotizacion(borrador);
    if (tipo === "reporte") editarReporte(borrador);
  }, 300);
}

window.abrirDetalleEMS = async function(tipo, numero) {
  showProgress(true);
  let doc;
  if (tipo === "cotizacion") {
    doc = await db.collection("cotizaciones").doc(numero).get();
    if (!doc.exists) {
      showProgress(false);
      alert("Cotización no encontrada");
      return;
    }
    editarCotizacion(doc.data());
  } else if (tipo === "reporte") {
    doc = await db.collection("reportes").doc(numero).get();
    if (!doc.exists) {
      showProgress(false);
      alert("Reporte no encontrado");
      return;
    }
    editarReporte(doc.data());
  }
  showProgress(false);
}


// ——— EMS PWA v7 Overrides ———

// Override uploadReportImages: parallel uploads with compression and full feedback
async function uploadReportImages(reportId, itemIndex, files) {
  const urls = [];
  const total = Math.min(files.length, 6);
  const comps = await Promise.all(Array.from(files).slice(0,6).map(f => compressImage(f,0.8)));
  await Promise.all(comps.map((file,i) => {
    const path = `reportes/${reportId}/${itemIndex}/${file.name}`;
    const ref = storage.ref(path);
    const task = ref.put(file);
    return new Promise((res,rej)=>{
      task.on('state_changed', snap => {
        const pct = (snap.bytesTransferred/snap.totalBytes)*100;
        showProgress(true,pct,`Subiendo imagen ${i+1}/${total}`);
      }, err=>rej(err), ()=>res(ref.getDownloadURL()));
    }).then(r=>r).then(url=>{
      urls.push(url);
    });
  }));
  showProgress(false);
  return urls;
}

// Override saveReport: single set() with all items
async function saveReport(reportData) {
  try {
    showProgress(true, 0, 'Iniciando guardado de reporte...');
    const reportRef = await db.collection('reportes').add({...reportData, items: []});
    const reportId = reportRef.id;
    const updatedItems = [];
    for (let idx = 0; idx < reportData.items.length; idx++) {
      let item = reportData.items[idx];
      if (item.files && item.files.length) {
        const urls = await uploadReportImages(reportId, idx, item.files);
        item = {...item, fotos: urls};
      }
      updatedItems.push(item);
      showProgress(true, ((idx+1)/reportData.items.length)*100, `Procesando item ${idx+1}/${reportData.items.length}`);
    }
    await db.collection('reportes').doc(reportId).set({ ...reportData, items: updatedItems });
    showProgress(false);
    alert('Reporte guardado exitosamente');
  } catch (error) {
    showProgress(false);
    alert('Error al guardar el reporte: ' + error.message);
  }
}

// Override generatePDF: header only on first page
async function generatePDF(data) {
  showProgress(true, 0);
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const items = data.items.flatMap(item => item.fotos);
  let pageCount = 0;
  for (let i = 0; i < items.length; i += 2) {
    const page = pdfDoc.addPage([600,800]);
    pageCount++;
    // Encabezado solo en primera página
    if (pageCount === 1) {
      page.drawText('EMS - Reporte', {x:50,y:770,size:18});
    });
    }
    // Pie de página fijo
    page.drawText(`Página ${pageCount}`, {x:260,y:20,size:12});
    // Marca de agua en páginas posteriores
    if (pageCount > 1) {
      page.drawText('EMS', {x:250,y:400,size:50,opacity:0.1});
    }
    const slice = items.slice(i, i+2);
    let yPos = pageCount===1 ? 720 : 720;
    for (let j = 0; j < slice.length; j++) {
      const imgBytes = await fetch(slice[j]).then(r => r.arrayBuffer());
      const imgEmbed = slice[j].endsWith('.png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
      const dims = imgEmbed.scale(0.25);
      const x = 50 + j*(dims.width+10);
      page.drawImage(imgEmbed, {x, y: yPos, width:dims.width, height:dims.height});
    }
    showProgress(true, ((i+slice.length)/items.length)*100, 'Generando PDF...');
  }
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  return pdfBytes;
}

// ————————— End Overrides —————————
