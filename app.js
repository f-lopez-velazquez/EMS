// Firebase initialization
firebase.initializeApp({
  apiKey: 'TU_API_KEY', authDomain: 'TU_AUTH_DOMAIN',
  projectId: 'TU_PROJECT_ID', storageBucket: 'TU_STORAGE_BUCKET',
  messagingSenderId: 'TU_SENDER_ID', appId: 'TU_APP_ID'
});
const db = firebase.firestore();
const storage = firebase.storage();
const promptedReports = {}; // track prompts in-memory

// Progress bar
function showProgress(show=true, percent=0) {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  if(show) {
    bar.style.display = 'block';
    inner.style.width = percent + '%';
  } else {
    bar.style.display = 'none';
  }
}

// Navigation handlers
document.getElementById('btn-historial').onclick = listRecords;
document.getElementById('btn-nuevo-rep').onclick = () => newReport();
document.getElementById('btn-nueva-cot').onclick = () => newCotizacion();

// List both cotizaciones and reportes
async function listRecords() {
  const container = document.getElementById('contenedor');
  container.innerHTML = '';
  // Fetch cotizaciones
  const cSnap = await db.collection('cotizaciones').orderBy('fecha','desc').get();
  cSnap.forEach(doc => container.appendChild(recordElement('cotizacion', doc)));
  // Fetch reportes
  const rSnap = await db.collection('reportes').orderBy('fecha','desc').get();
  rSnap.forEach(doc => container.appendChild(recordElement('reporte', doc)));
}

// Create record DOM element
function recordElement(type, doc) {
  const data = doc.data();
  const div = document.createElement('div');
  div.className = 'record';
  div.innerHTML = `<span><strong>${type}</strong> ${data.cliente || ''} - ${data.fecha} ${data.hora}</span>`;
  const btnEdit = document.createElement('button');
  btnEdit.textContent = '✏️';
  btnEdit.onclick = () => (type==='reporte'? loadReport : loadCotizacion)(doc.id);
  const btnDel = document.createElement('button');
  btnDel.textContent = '🗑️';
  btnDel.onclick = () => deleteRecord(type, doc.id);
  div.appendChild(btnEdit);
  div.appendChild(btnDel);
  return div;
}

// Delete record
async function deleteRecord(type, id) {
  if(!confirm('¿Eliminar '+type+'?')) return;
  showProgress(true, 0);
  await db.collection(type+'s').doc(id).delete();
  showProgress(false);
  listRecords();
}

// Load report
async function loadReport(reportId) {
  if(!promptedReports[reportId] && localStorage.getItem('draft-'+reportId)) {
    promptedReports[reportId] = true;
    const load = confirm('¿Cargar el último borrador de este reporte?');
    localStorage.removeItem('draft-'+reportId);
    if(load) await loadDraft(reportId);
  }
  document.getElementById('contenedor').innerHTML = ''; // clear
  // ... load and render form for editing report ...
}

// Load cotizacion (stub)
async function loadCotizacion(cotId) {
  // similar logic for cotizaciones
  alert('Editar cotización '+cotId);
}

// Other functions: newReport, newCotizacion, saveReport, uploadReportImages, generatePDF, etc.
// Ensure in generatePDF: header only on first page.
