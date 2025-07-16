// EMS PWA v6 - Optimización de imágenes y feedback mejorado
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

function showProgress(show=true, percent=0, message='') {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  if (show) {
    bar.style.display = '';
    inner.style.width = percent + '%';
    inner.textContent = message;
  } else {
    bar.style.display = 'none';
    inner.style.width = '0%';
    inner.textContent = '';
  }
}

// Comprimir imagen con canvas
function compressImage(file, quality=0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name, {type: file.type});
          resolve(compressedFile);
        }, file.type, quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Subir imágenes optimizadas y mostrar feedback
async function uploadReportImages(reportId, itemIndex, files) {
  const urls = [];
  let total = files.length;
  for (let i = 0; i < files.length; i++) {
    // Comprimir antes de subir
    const compressed = await compressImage(files[i], 0.8);
    const path = `reportes/${reportId}/${itemIndex}/${compressed.name}`;
    const ref = storage.ref(path);
    const task = ref.put(compressed);
    task.on('state_changed', (snap) => {
      const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
      showProgress(true, pct, `Subiendo imagen ${i+1}/${total}`);
    });
    await task;
    const url = await ref.getDownloadURL();
    urls.push(url);
  }
  showProgress(false);
  return urls;
}

// Guardar reporte con todas las imágenes
async function saveReport(reportData) {
  try {
    showProgress(true, 0, 'Iniciando guardado de reporte...');
    // Primero guarda datos principales sin fotos
    const reportRef = await db.collection('reportes').add({...reportData, items: []});
    const reportId = reportRef.id;
    // Procesar items uno a uno
    for (let idx = 0; idx < reportData.items.length; idx++) {
      const item = reportData.items[idx];
      if (item.files && item.files.length) {
        // Limitar a 6
        const files = Array.from(item.files).slice(0, 6);
        const urls = await uploadReportImages(reportId, idx, files);
        item.fotos = urls;
      }
      // Actualiza item en Firestore
      await db.collection('reportes').doc(reportId).update({
        items: firebase.firestore.FieldValue.arrayUnion(item)
      });
      showProgress(true, ((idx+1)/reportData.items.length)*100, `Guardando item ${idx+1}/${reportData.items.length}`);
    }
    showProgress(false);
    alert('Reporte guardado exitosamente');
  } catch (error) {
    showProgress(false);
    alert('Error al guardar el reporte: ' + error.message);
  }
}

// Resto de lógica: loadReport, editReport, deleteReport, generatePDF, etc.
// Asegúrate de envolver cada proceso con showProgress y desactivar al final.
