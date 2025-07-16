// EMS Cotizaciones y Reportes v4 - Con subida de imágenes y edición completa
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

function showProgress(show=true, percent=0) {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  if(show){
    bar.style.display = '';
    inner.style.width = percent + '%';
  } else {
    bar.style.display = 'none';
    inner.style.width = '0%';
  }
}

// Lógica para crear nueva cotización/reporte, editar, borrar...
// (Ejemplo abreviado de manejo de imágenes en reportes)
async function uploadReportImages(reportId, itemIndex, files){
  const urls = [];
  for(let i=0;i<files.length;i++){
    const file = files[i];
    const path = `reportes/${reportId}/${itemIndex}/${file.name}`;
    const ref = storage.ref(path);
    const task = ref.put(file);
    task.on('state_changed', snap => {
      const pct = (snap.bytesTransferred/snap.totalBytes)*100;
      showProgress(true, pct);
    });
    await task;
    const url = await ref.getDownloadURL();
    urls.push(url);
  }
  showProgress(false);
  return urls;
}

// Editar reporte: carga previsualización con opción de eliminar cada imagen
function renderReportItemImages(container, reportId, itemIndex, urls) {
  container.innerHTML = '';
  urls.forEach((url, idx) => {
    const div = document.createElement('div');
    div.classList.add('image-thumb');
    const img = document.createElement('img');
    img.src = url;
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-trash"></i>';
    btn.onclick = async () => {
      if(confirm('¿Eliminar esta imagen?')){
        // borrar Storage
        const path = `reportes/${reportId}/${itemIndex}/${getFilenameFromURL(url)}`;
        await storage.ref(path).delete();
        // actualizar Firestore
        const doc = await db.collection('reportes').doc(reportId).get();
        const data = doc.data();
        data.items[itemIndex].fotos = data.items[itemIndex].fotos.filter(u=>u!==url);
        await db.collection('reportes').doc(reportId).update({items: data.items});
        // refrescar UI
        renderReportItemImages(container, reportId, itemIndex, data.items[itemIndex].fotos);
      }
    };
    div.append(img, btn);
    container.append(div);
  });
}

// Helper
function getFilenameFromURL(url){
  return decodeURIComponent(url.split('/').pop().split('?')[0]);
}

// Generación de PDF con pdf-lib
async function generatePDF(data){
  showProgress(true, 0);
  const { PDFDocument, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  // Encabezado fijo
  page.drawText('EMS - Reporte', {x:50, y:770, size:18});
  // Contenido...
  let y = 720;
  // Dibujar imágenes max 2 por fila
  const imgUrls = data.items.flatMap(item=>item.fotos);
  for(let i=0;i<imgUrls.length;i++){
    const u = imgUrls[i];
    const imgBytes = await fetch(u).then(r=>r.arrayBuffer());
    let imgEmbed = u.endsWith('.png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
    const dims = imgEmbed.scale(0.25);
    const x = 50 + (i%2)*(dims.width+10);
    if(i>0 && i%2===0) y -= dims.height + 10;
    page.drawImage(imgEmbed,{x,y: y-dims.height, width:dims.width, height:dims.height});
    showProgress(true, ((i+1)/imgUrls.length)*100);
  }
  // Pie de página fijo
  page.drawText('Página 1', {x:260, y:20, size:12});
  const pdfBytes = await pdfDoc.save();
  showProgress(false);
  return pdfBytes;
}

// Implementa resto de CRUD usando showProgress y clearing forms...

// Ejemplo de limpiar formulario al crear nuevo
function clearForm(type){
  document.querySelector('#form-'+type).reset();
  document.querySelector('#items-'+type).innerHTML = '';
}
