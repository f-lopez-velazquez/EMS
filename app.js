// Configura Firebase
firebase.initializeApp({
  apiKey: "TU_API_KEY", authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID", storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID", appId: "TU_APP_ID"
});
const db = firebase.firestore();
const storage = firebase.storage();

// Muestra/Oculta barra de progreso
function showProgress(show=true, percent=0, msg='') {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  if (show) {
    bar.style.display = 'block';
    inner.style.width = percent + '%';
  } else {
    bar.style.display = 'none';
  }
}

// Comprime imagen con canvas
function compressImage(file, quality=0.8) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
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

// Subida paralela de imágenes con feedback
async function uploadReportImages(reportId, itemIndex, files) {
  const urls = [];
  const max = Math.min(files.length, 6);
  const compressed = await Promise.all(Array.from(files).slice(0, max).map(f => compressImage(f, 0.8)));
  await Promise.all(compressed.map((file, i) =>
    new Promise((res, rej) => {
      const path = `reportes/${reportId}/${itemIndex}/${file.name}`;
      const ref = storage.ref(path);
      const task = ref.put(file);
      task.on('state_changed', snap => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        showProgress(true, pct, `Subiendo imagen ${i + 1}/${max}`);
      }, err => rej(err), async () => {
        const url = await ref.getDownloadURL();
        urls.push(url);
        res();
      });
    })
  ));
  showProgress(false);
  return urls;
}

// Guarda reporte atómico
async function saveReport(data) {
  showProgress(true, 0, 'Guardando reporte...');
  const ref = await db.collection('reportes').add({ ...data, items: [] });
  const items = [];
  for (let i = 0; i < data.items.length; i++) {
    let item = { ...data.items[i] };
    if (item.files) {
      item.fotos = await uploadReportImages(ref.id, i, item.files);
    }
    items.push(item);
    showProgress(true, ((i + 1) / data.items.length) * 100, `Procesando item ${i + 1}/${data.items.length}`);
  }
  await db.collection('reportes').doc(ref.id).set({ ...data, items });
  showProgress(false);
}

// Carga reporte con prompt única
async function loadReport(reportId) {
  const draftKey = `draft-${reportId}`;
  const promptedKey = `prompted-draft-${reportId}`;
  const hasDraft = !!localStorage.getItem(draftKey);
  const alreadyPrompted = !!sessionStorage.getItem(promptedKey);

  if (hasDraft && !alreadyPrompted) {
    sessionStorage.setItem(promptedKey, 'true');
    const load = confirm('¿Quieres cargar el último borrador de este reporte?');
    localStorage.removeItem(draftKey);
    if (load) await loadDraft(reportId);
  }

  const container = document.getElementById('items-reporte');
  container.innerHTML = '';

  const snap = await db.collection('reportes').doc(reportId).get();
  const data = snap.data();
  setFormValues(data);

  data.items.forEach((item, idx) => {
    const elem = renderReportItem(item, idx);
    container.appendChild(elem);
    const photosDiv = elem.querySelector('.fotos');
    photosDiv.innerHTML = '';
    renderReportItemImages(photosDiv, reportId, idx, item.fotos);
  });
}

// Genera PDF: header solo en 1ª página
async function generatePDF(data) {
  showProgress(true, 0, 'Generando PDF...');
  const { PDFDocument } = PDFLib;
  const pdf = await PDFDocument.create();
  const flat = data.items.flatMap(i => i.fotos);
  let pageCount = 0;

  for (let i = 0; i < flat.length; i += 2) {
    const page = pdf.addPage([600, 800]);
    pageCount++;
    if (pageCount === 1) drawHeader(page);
    drawFooter(page, pageCount);
    if (pageCount > 1) drawWatermark(page);

    const batch = flat.slice(i, i + 2);
    for (let j = 0; j < batch.length; j++) {
      const bytes = await fetch(batch[j]).then(r => r.arrayBuffer());
      const embed = batch[j].endsWith('.png')
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
      const dims = embed.scale(0.25);
      page.drawImage(embed, { x: 50 + j * (dims.width + 10), y: 720, width: dims.width, height: dims.height });
    }
    showProgress(true, ((i + batch.length) / flat.length) * 100, `Página ${pageCount}`);
  }
  const pdfBytes = await pdf.save();
  showProgress(false);
  return pdfBytes;
}

// Funciones auxiliares stub
function drawHeader(page) {
  page.drawText('EMS - Reporte de Servicio', { x: 50, y: 780, size: 18 });
}
function drawFooter(page, num) {
  page.drawText(`Página ${num}`, { x: 260, y: 20, size: 12 });
}
function drawWatermark(page) {
  page.drawText('EMS', { x: 250, y: 400, size: 50, opacity: 0.1 });
}

// Stubs a implementar según UI
function setFormValues(data) { /*...*/ }
function renderReportItem(item, idx) { 
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = '<textarea spellcheck="true" autocorrect="on"></textarea><div class="fotos"></div>';
  return div;
}
function renderReportItemImages(container, reportId, idx, urls) {
  container.innerHTML = '';
  urls.forEach((url, i) => {
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
        await db.collection('reportes').doc(reportId).update({
          items: firebase.firestore.FieldValue.arrayRemove({ fotos: [url] })
        });
        renderReportItemImages(container, reportId, idx, urls.filter(u => u !== url));
      }
    };
    thumb.appendChild(img);
    thumb.appendChild(btn);
    container.appendChild(thumb);
  });
}
