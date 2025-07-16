// ==============================
// EMS Electromotores Santana App
// app.js COMPLETO
// ==============================

// --- FIREBASE CONFIG ---
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

// --- FEEDBACK VISUAL ---
function showProgress(show=true, percent=0, msg='') {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  const txt = document.getElementById('progress-msg');
  if (!bar || !inner || !txt) return;
  if (show) {
    bar.style.display = 'block';
    inner.style.width = percent + '%';
    txt.textContent = msg || '';
  } else {
    bar.style.display = 'none';
    inner.style.width = '0%';
    txt.textContent = '';
  }
}
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2200);
}

// --- HERRAMIENTAS ---
function compressImage(file, quality=0.8) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          resolve(new File([blob], file.name, { type: file.type }));
        }, file.type, quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// SUBIR IMÁGENES REPORTE (max 6 por item, feedback)
async function uploadReportImages(reportId, itemIndex, files) {
  const urls = [];
  const max = Math.min(files.length, 6);
  const compressed = await Promise.all(Array.from(files).slice(0, max).map(f => compressImage(f, 0.85)));
  for (let i = 0; i < compressed.length; i++) {
    const file = compressed[i];
    const path = `reportes/${reportId}/${itemIndex}/${file.name}`;
    const ref = storage.ref(path);
    const task = ref.put(file);
    await new Promise((res, rej) => {
      task.on('state_changed', snap => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        showProgress(true, pct, `Subiendo imagen ${i+1}/${compressed.length}`);
      }, rej, async () => {
        const url = await ref.getDownloadURL();
        urls.push(url);
        res();
      });
    });
  }
  showProgress(false);
  return urls;
}
// --- RENDER THUMBS Y ELIMINAR IMAGEN ---
function renderReportItemImages(container, reportId, idx, urls) {
  container.innerHTML = '';
  (urls||[]).forEach((url, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'image-thumb';
    const img = document.createElement('img');
    img.src = url;
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-trash"></i>';
    btn.onclick = async () => {
      if (confirm('¿Eliminar imagen?')) {
        const filename = decodeURIComponent(url.split('/').pop().split('?')[0]);
        await storage.ref(`reportes/${reportId}/${idx}/${filename}`).delete();
        // Borra también en Firestore
        const snap = await db.collection('reportes').doc(reportId).get();
        const items = snap.data().items;
        items[idx].fotos = (items[idx].fotos||[]).filter(u => u !== url);
        await db.collection('reportes').doc(reportId).update({ items });
        renderReportItemImages(container, reportId, idx, items[idx].fotos);
      }
    };
    thumb.appendChild(img);
    thumb.appendChild(btn);
    container.appendChild(thumb);
  });
}

// --- PDF PROFESIONAL DE REPORTE (HEADER SOLO EN 1ra PÁGINA) ---
async function generatePDF(data) {
  showProgress(true, 0, 'Generando PDF...');
  const { PDFDocument } = PDFLib;
  const pdf = await PDFDocument.create();
  const fotos = data.items.flatMap(i => i.fotos || []);
  let pageCount = 0;
  for (let i = 0; i < fotos.length; i += 4) {
    const page = pdf.addPage([600, 800]);
    pageCount++;
    if (pageCount === 1) await drawHeader(page, pdf);
    drawFooter(page, pageCount);
    if (pageCount > 1) drawWatermark(page);
    const batch = fotos.slice(i, i + 4);
    for (let j = 0; j < batch.length; j++) {
      const imgBytes = await fetch(batch[j]).then(r => r.arrayBuffer());
      const embed = batch[j].endsWith('.png') ? await pdf.embedPng(imgBytes) : await pdf.embedJpg(imgBytes);
      const dims = embed.scale(0.23);
      const x = 50 + (j % 2) * (dims.width + 22);
      const y = 680 - Math.floor(j / 2) * (dims.height + 30);
      page.drawImage(embed, { x, y, width: dims.width, height: dims.height });
    }
    showProgress(true, ((i + batch.length) / fotos.length) * 100, `Página ${pageCount}`);
  }
  const pdfBytes = await pdf.save();
  showProgress(false);
  showToast('PDF generado');
  // Descarga directa
  const blob = new Blob([pdfBytes], {type: 'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "reporte.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

async function drawHeader(page, pdf) {
  const imgUrl = "https://i.imgur.com/RQucHEc.png";
  const logoBytes = await fetch(imgUrl).then(r => r.arrayBuffer());
  const embed = await pdf.embedPng(logoBytes);
  page.drawImage(embed, { x: 40, y: 720, width: 72, height: 72 });
  page.drawText("Electromotores Santana", { x: 130, y: 765, size: 16, color: PDFLib.rgb(0.09,0.22,0.38)});
  page.drawText("Carretera a Chichimequillas #306, Menchaca 2, Querétaro", { x: 130, y: 745, size: 11, color: PDFLib.rgb(0.09,0.22,0.38)});
  page.drawText("Tel: 442 469 9895", { x: 130, y: 730, size: 11, color: PDFLib.rgb(0.09,0.22,0.38)});
}
function drawFooter(page, num) {
  page.drawText(`Página ${num}`, { x: 275, y: 22, size: 12, color: PDFLib.rgb(0.3,0.3,0.3) });
}
function drawWatermark(page) {
  page.drawText('Electromotores Santana', { x: 150, y: 400, size: 36, opacity: 0.07, color: PDFLib.rgb(0.09,0.22,0.38)});
}
// ---------- GUARDAR Y FORMULARIO DE REPORTE ---------------
async function saveReport(data, id = null) {
  showProgress(true, 0, 'Guardando reporte...');
  let ref;
  if (id) {
    ref = db.collection('reportes').doc(id);
    await ref.set({ ...data, items: [] });
  } else {
    ref = await db.collection('reportes').add({ ...data, items: [] });
    id = ref.id;
  }
  const items = [];
  for (let i = 0; i < data.items.length; i++) {
    let item = { ...data.items[i] };
    if (item.files && item.files.length) {
      item.fotos = await uploadReportImages(id, i, item.files);
      delete item.files;
    }
    items.push(item);
    showProgress(true, ((i + 1) / data.items.length) * 100, `Procesando actividad ${i + 1}/${data.items.length}`);
  }
  await db.collection('reportes').doc(id).update({ ...data, items });
  showProgress(false);
  showToast('¡Reporte guardado exitosamente!');
  localStorage.removeItem(`draft-reporte-${id}`);
}

async function renderReportForm(id=null) {
  const container = document.getElementById('contenedor');
  container.innerHTML = `<h2>${id ? 'Editar' : 'Nuevo'} Reporte</h2>
    <form id="form-rep">
      <input type="text" name="cliente" placeholder="Cliente" required>
      <input type="date" name="fecha" required>
      <input type="time" name="hora" required>
      <textarea name="notas" placeholder="Notas"></textarea>
      <h3>Actividades</h3>
      <div id="actividades"></div>
      <button type="button" id="agregar-act">Agregar Actividad</button>
      <br><br>
      <button type="submit">Guardar Reporte</button>
      <button type="button" id="cancelar-rep">Cancelar</button>
      <button type="button" id="pdf-rep" style="float:right; display:${id ? 'inline' : 'none'}">📄 Exportar PDF</button>
    </form>
  `;

  let actividades = [];
  if (id) {
    const snap = await db.collection('reportes').doc(id).get();
    const rep = snap.data();
    container.querySelector('[name=cliente]').value = rep.cliente || '';
    container.querySelector('[name=fecha]').value = rep.fecha || '';
    container.querySelector('[name=hora]').value = rep.hora || '';
    container.querySelector('[name=notas]').value = rep.notas || '';
    actividades = (rep.items||[]).map(a=>({...a, files: []})); // limpia 'files'
  }
  const divActs = container.querySelector('#actividades');
  function renderActs() {
    divActs.innerHTML = '';
    actividades.forEach((a,i)=>{
      const row = document.createElement('div');
      row.innerHTML = `
        <textarea placeholder="Descripción" required>${a.descripcion||''}</textarea>
        <input type="file" accept="image/*" multiple>
        <div class="fotos"></div>
        <button type="button">❌</button>
        <button type="button" class="btn-ortografia" title="Corregir redacción IA">🪄</button>
      `;
      row.querySelector('textarea').oninput = e => actividades[i].descripcion = e.target.value;
      row.querySelector('input[type=file]').onchange = e => {
        actividades[i].files = Array.from(e.target.files);
      };
      // Mostrar fotos existentes
      if(a.fotos && a.fotos.length) {
        const fotosDiv = row.querySelector('.fotos');
        renderReportItemImages(fotosDiv, id, i, a.fotos);
      }
      // Borrar actividad
      row.querySelector('button').onclick = ()=>{ actividades.splice(i,1); renderActs(); };
      // Corregir ortografía/redacción (simulado)
      row.querySelector('.btn-ortografia').onclick = ()=> {
        const t = row.querySelector('textarea');
        t.value = autocorrectText(t.value);
        actividades[i].descripcion = t.value;
      };
      divActs.appendChild(row);
    });
  }
  renderActs();
  container.querySelector('#agregar-act').onclick = ()=>{
    actividades.push({descripcion:'',fotos:[],files:[]});
    renderActs();
  };
  container.querySelector('#cancelar-rep').onclick = ()=>listRecords();
  container.querySelector('#form-rep').onsubmit = async function(e){
    e.preventDefault();
    const rep = {
      cliente: this.cliente.value,
      fecha: this.fecha.value,
      hora: this.hora.value,
      notas: this.notas.value,
      items: actividades.map(a=>({
        descripcion: a.descripcion,
        fotos: a.fotos || [],
        files: a.files || []
      }))
    };
    await saveReport(rep, id);
    listRecords();
  }
  if(id) {
    container.querySelector('#pdf-rep').onclick = async ()=> {
      const snap = await db.collection('reportes').doc(id).get();
      await generatePDF(snap.data());
    };
  }
}

// -------- AUTOCORRECT REDACCIÓN (simulado/puedes integrar IA real si quieres) ----------
function autocorrectText(text) {
  if(!text) return '';
  // Ejemplo simple: mayúsculas y punto final
  text = text.trim();
  if(!text) return '';
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if(!text.endsWith('.')) text += '.';
  return text;
}
// ----------- GUARDAR Y FORMULARIO DE COTIZACIÓN ---------------
async function saveCotizacion(data, id = null) {
  showProgress(true, 0, 'Guardando cotización...');
  if (id) {
    await db.collection('cotizaciones').doc(id).set(data);
  } else {
    await db.collection('cotizaciones').add(data);
  }
  showProgress(false);
  showToast('Cotización guardada');
  localStorage.removeItem(`draft-cotizacion-${id || 'new'}`);
}

async function renderCotForm(id = null) {
  const container = document.getElementById('contenedor');
  container.innerHTML = `<h2>${id ? 'Editar' : 'Nueva'} Cotización</h2>
    <form id="form-cot">
      <input type="text" name="cliente" placeholder="Cliente" required>
      <input type="date" name="fecha" required>
      <input type="time" name="hora" required>
      <textarea name="notas" placeholder="Notas"></textarea>
      <h3>Conceptos</h3>
      <div id="conceptos"></div>
      <button type="button" id="agregar-concepto">Agregar Concepto</button>
      <br><br>
      <button type="submit">Guardar Cotización</button>
      <button type="button" id="cancelar-cot">Cancelar</button>
    </form>
  `;
  let conceptos = [];
  if (id) {
    const snap = await db.collection('cotizaciones').doc(id).get();
    const cot = snap.data();
    container.querySelector('[name=cliente]').value = cot.cliente || '';
    container.querySelector('[name=fecha]').value = cot.fecha || '';
    container.querySelector('[name=hora]').value = cot.hora || '';
    container.querySelector('[name=notas]').value = cot.notas || '';
    conceptos = cot.items || [];
  }
  const divConceptos = container.querySelector('#conceptos');
  function renderConceptos() {
    divConceptos.innerHTML = '';
    conceptos.forEach((c,i)=>{
      const row = document.createElement('div');
      row.innerHTML = `
        <input type="text" placeholder="Concepto" value="${c.concepto||''}" required>
        <input type="text" placeholder="Unidad" value="${c.unidad||''}" required>
        <input type="number" placeholder="Cantidad" value="${c.cantidad||''}" required>
        <input type="number" placeholder="Precio" value="${c.precio||''}" required>
        <button type="button">❌</button>
        <button type="button" class="btn-ortografia" title="Corregir redacción IA">🪄</button>
      `;
      row.querySelectorAll('input').forEach((inp,idx)=>{
        inp.oninput = e => {
          if(idx===0) conceptos[i].concepto = inp.value;
          if(idx===1) conceptos[i].unidad = inp.value;
          if(idx===2) conceptos[i].cantidad = Number(inp.value);
          if(idx===3) conceptos[i].precio = Number(inp.value);
        }
      });
      row.querySelector('button').onclick = ()=>{ conceptos.splice(i,1); renderConceptos(); };
      // Corregir ortografía (simulado)
      row.querySelector('.btn-ortografia').onclick = ()=> {
        const inp = row.querySelector('input[type=text]');
        inp.value = autocorrectText(inp.value);
        conceptos[i].concepto = inp.value;
      };
      divConceptos.appendChild(row);
    });
  }
  renderConceptos();
  container.querySelector('#agregar-concepto').onclick = ()=>{
    conceptos.push({concepto:'',unidad:'',cantidad:1,precio:0});
    renderConceptos();
  };
  container.querySelector('#cancelar-cot').onclick = ()=>listRecords();
  container.querySelector('#form-cot').onsubmit = async function(e){
    e.preventDefault();
    const cot = {
      cliente: this.cliente.value,
      fecha: this.fecha.value,
      hora: this.hora.value,
      notas: this.notas.value,
      items: conceptos
    };
    await saveCotizacion(cot, id);
    listRecords();
  }
}
// -------- HISTORIAL COMPLETO Y BOTONES ELIMINAR/EDITAR ---------
async function listRecords() {
  const container = document.getElementById('contenedor');
  container.innerHTML = '<h2>Historial</h2>';
  // Cotizaciones
  const cSnap = await db.collection('cotizaciones').orderBy('fecha','desc').get();
  cSnap.forEach(doc => container.appendChild(recordElement('cotizacion', doc)));
  // Reportes
  const rSnap = await db.collection('reportes').orderBy('fecha','desc').get();
  rSnap.forEach(doc => container.appendChild(recordElement('reporte', doc)));
}

function recordElement(type, doc) {
  const data = doc.data();
  const div = document.createElement('div');
  div.className = 'record';
  div.innerHTML = `<span><strong>${type === 'cotizacion' ? 'Cotización' : 'Reporte'}</strong> ${data.cliente || ''} - ${data.fecha} ${data.hora}</span>`;
  const btnEdit = document.createElement('button');
  btnEdit.textContent = '✏️';
  btnEdit.onclick = () => (type==='reporte'? renderReportForm : renderCotForm)(doc.id);
  const btnDel = document.createElement('button');
  btnDel.textContent = '🗑️';
  btnDel.onclick = () => deleteRecord(type, doc.id);
  div.appendChild(btnEdit);
  div.appendChild(btnDel);
  return div;
}

async function deleteRecord(type, id) {
  if(!confirm('¿Eliminar '+type+'?')) return;
  showProgress(true, 0, 'Eliminando...');
  await db.collection(type+'s').doc(id).delete();
  showProgress(false);
  listRecords();
}

// -------- LIMPIAR FORMULARIOS Y ESTADO INICIAL ----------
window.onload = () => {
  listRecords();
  // Si quieres mostrar panel principal al inicio
};
