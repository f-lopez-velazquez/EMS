// Configurar Firebase
firebase.initializeApp({
  apiKey: "...", authDomain: "...", projectId: "...",
  storageBucket: "...", messagingSenderId: "...", appId: "..."
});
const db = firebase.firestore();
const storage = firebase.storage();

// showProgress
function showProgress(show=true, percent=0, msg='') {
  const bar = document.getElementById('progress-bar');
  const inner = bar.querySelector('.progress-inner');
  if (show) {
    bar.style.display='block';
    inner.style.width = percent + '%';
  } else bar.style.display='none';
}

// compressImage
function compressImage(file, quality=0.8){
  //...
  return Promise.resolve(file); // sustituir con implementación
}

// uploadReportImages
async function uploadReportImages(reportId, idx, files){
  const urls=[]; const max=Math.min(files.length,6);
  const comps = await Promise.all(Array.from(files).slice(0,max).map(f=>compressImage(f)));
  await Promise.all(comps.map((f,i)=>new Promise((res)=> {
    const ref=storage.ref(`reportes/${reportId}/${idx}/${f.name}`);
    ref.put(f).on('state_changed',snap=>showProgress(true,(snap.bytesTransferred/snap.totalBytes)*100),null,async()=>{
      urls.push(await ref.getDownloadURL()); res();
    });
  })));
  showProgress(false);
  return urls;
}

// saveReport
async function saveReport(data){
  showProgress(true,0,'Guardando...');
  const ref = await db.collection('reportes').add({...data,items:[]});
  const items = [];
  for(let i=0;i<data.items.length;i++){
    const it = {...data.items[i]};
    if(it.files) it.fotos = await uploadReportImages(ref.id,i,it.files);
    items.push(it);
  }
  await db.collection('reportes').doc(ref.id).set({...data,items});
  showProgress(false);
}

// loadReport
async function loadReport(id){
  const draftKey='draft-'+id;
  if(localStorage.getItem(draftKey)){
    if(confirm('Cargar último borrador?')) loadDraft(id);
    localStorage.removeItem(draftKey);
  }
  document.getElementById('items-reporte').innerHTML='';
  const snap = await db.collection('reportes').doc(id).get();
  const data = snap.data();
  data.items.forEach((it, i)=>{
    const el = document.createElement('div');
    // agregar descripción e imágenes
    it.fotos.forEach(url=>{
      const img=document.createElement('img'); img.src=url;
      el.appendChild(img);
    });
    document.getElementById('items-reporte').appendChild(el);
  });
}

// generatePDF
async function generatePDF(data){
  showProgress(true,0,'Generando PDF...');
  const {PDFDocument} = PDFLib; const pdf=await PDFDocument.create();
  const photos=data.items.flatMap(i=>i.fotos);
  let pageCount=0;
  for(let i=0;i<photos.length;i+=2){
    const page=pdf.addPage([600,800]); pageCount++;
    if(pageCount===1) page.drawText('EMS - Reporte',{x:50,y:770,size:18});
    page.drawText(`Página ${pageCount}`,{x:260,y:20,size:12});
    if(pageCount>1) page.drawText('EMS',{x:250,y:400,size:50,opacity:0.1});
    const batch=photos.slice(i,i+2);
    await Promise.all(batch.map(async (u,j)=>{
      const imgBytes=await fetch(u).then(r=>r.arrayBuffer());
      const embed=u.endsWith('.png')?await pdf.embedPng(imgBytes):await pdf.embedJpg(imgBytes);
      const dims=embed.scale(0.25);
      page.drawImage(embed,{x:50+j*(dims.width+10),y:720,width:dims.width,height:dims.height});
    }));
    showProgress(true,((i+batch.length)/photos.length)*100);
  }
  const bytes=await pdf.save(); showProgress(false);
  return bytes;
}
