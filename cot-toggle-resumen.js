
// ========== TOGGLE SECCIONES Y RESUMEN ==========

/**
 * Cambia entre modo simple y detallado de una sección
 */
function toggleSeccionMode(checkbox) {
    const seccion = checkbox.closest('.cot-seccion');
    if (!seccion) return;

    const isDetallado = checkbox.checked;
    const secId = seccion.dataset.secid;

    // Serializar datos actuales antes de cambiar
    const data = serializeCotSeccion(seccion);

    // Detectar si estamos en móvil
    const isMobile = window.innerWidth <= 640;

    let newHtml;
    if (isMobile && typeof renderCotSeccionMobile === 'function') {
        // Renderizar en modo móvil
        newHtml = renderCotSeccionMobile(data, secId);
    } else {
        // Renderizar desktop
        newHtml = isDetallado
            ? renderCotSeccionDet(data, secId)
            : renderCotSeccion(data, secId);
    }

    // Reemplazar HTML
    seccion.outerHTML = newHtml;

    // Recalcular totales
    recalcTotalesCotizacion();

    // Actualizar resumen
    if (typeof renderCotResumen === 'function') {
        renderCotResumen();
    }
}

/**
 * Serializa datos de una sección (compatible con simple y detallado)
 */
function serializeCotSeccion(seccion) {
    if (!seccion) return { items: [] };

    const titulo = seccion.querySelector('.cot-sec-title')?.value || '';
    const isDet = !!seccion.querySelector('[data-mode="det"]') || !!seccion.dataset.mode;
    const items = [];

    // Para desktop: serializar desde tabla
    const rows = seccion.querySelectorAll('tbody tr');
    rows.forEach(row => {
        if (isDet) {
            // Modo detallado
            const concepto = row.querySelector('input[name="concepto"]')?.value || '';
            const cantidad = Number(row.querySelector('input[name="cantidadSec"]')?.value || 0);
            const unidad = row.querySelector('input[name="unidadSec"]')?.value || '';
            const precioUnit = Number(row.querySelector('input[name="precioUnitSec"]')?.value || 0);
            const total = cantidad * precioUnit;

            if (concepto || cantidad || precioUnit) {
                items.push({ concepto, cantidad, unidad, precioUnit, total });
            }
        } else {
            // Modo simple
            const concepto = row.querySelector('input[name="concepto"]')?.value || '';
            const descripcion = row.querySelector('textarea[name="descripcion"]')?.value || '';
            const precio = Number(row.querySelector('input[name="precioSec"]')?.value || 0);

            if (concepto || descripcion || precio) {
                items.push({ concepto, descripcion, precio });
            }
        }
    });

    // Para móvil: serializar desde mobile stack si existe
    const mobileStack = seccion.querySelector('.cot-mobile-stack');
    if (mobileStack && typeof serializeMobileStack === 'function') {
        const mobileData = serializeMobileStack(mobileStack);
        return { titulo: mobileData.titulo || titulo, items: mobileData.items };
    }

    return { titulo, items };
}

/**
 * Renderiza vista de resumen consolidada de todas las secciones
 */
function renderCotResumen() {
    const wrap = document.getElementById('cotSeccionesWrap');
    if (!wrap) return;

    const secciones = wrap.querySelectorAll('.cot-seccion');
    let allItems = [];
    let subtotalGeneral = 0;

    secciones.forEach((sec, idx) => {
        const data = serializeCotSeccion(sec);
        const titulo = data.titulo || `Sección ${idx + 1}`;
        const items = data.items || [];

        items.forEach(item => {
            const cantidad = item.cantidad || 1;
            const unidad = item.unidad || '';
            const precioUnit = item.precioUnit || item.precio || 0;
            const total = item.total || item.precio || 0;

            allItems.push({
                seccion: titulo,
                concepto: item.concepto || '-',
                descripcion: item.descripcion || '',
                cantidad: cantidad,
                unidad: unidad,
                precioUnit: precioUnit,
                total: total
            });

            subtotalGeneral += total;
        });
    });

    // Crear o actualizar panel de resumen
    let resumenPanel = document.getElementById('cotResumen');
    if (!resumenPanel) {
        // Crear panel si no existe
        const totalesDiv = document.getElementById('cotTotales');
        if (totalesDiv) {
            const panel = document.createElement('div');
            panel.id = 'cotResumen';
            panel.className = 'cot-resumen-panel';
            totalesDiv.parentNode.insertBefore(panel, totalesDiv);
            resumenPanel = panel;
        }
    }

    if (!resumenPanel || allItems.length === 0) return;

    // Generar HTML del resumen
    let html = `
    <div class="cot-resumen-header">
      <h3>📋 Vista de Resumen</h3>
      <span class="cot-resumen-count">${allItems.length} concepto(s)</span>
    </div>
    <div class="cot-resumen-scroll">
      <table class="cot-resumen-table">
        <thead>
          <tr>
            <th>Sección</th>
            <th>Concepto</th>
            <th>Cantidad</th>
            <th>Precio Unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

    allItems.forEach(item => {
        html += `
      <tr>
        <td><span class="seccion-badge">${item.seccion}</span></td>
        <td>
          <div class="concepto-cell">
            <strong>${item.concepto}</strong>
            ${item.descripcion ? `<small>${item.descripcion.substring(0, 50)}...</small>` : ''}
          </div>
        </td>
        <td class="qty-cell">${item.cantidad} ${item.unidad}</td>
        <td class="price-cell">$${Number(item.precioUnit).toFixed(2)}</td>
        <td class="total-cell"><b>$${Number(item.total).toFixed(2)}</b></td>
      </tr>
    `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr class="resumen-total-row">
            <td colspan="4" style="text-align:right;"><b>Total General:</b></td>
            <td class="total-cell"><b class="total-general">$${subtotalGeneral.toFixed(2)}</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

    resumenPanel.innerHTML = html;
}

// Auto-actualizar resumen al escribir (con debounce)
let resumenTimeout;
document.addEventListener('input', (e) => {
    if (e.target.closest('#cotForm')) {
        clearTimeout(resumenTimeout);
        resumenTimeout = setTimeout(() => {
            if (typeof renderCotResumen === 'function') {
                renderCotResumen();
            }
        }, 500);
    }
});
