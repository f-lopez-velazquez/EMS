
// ========== TOGGLE MODO SIMPLE/DETALLADO POR SECCIÓN ==========

/**
 * Cambia el modo de una sección entre simple y detallado
 */
function toggleSeccionMode(checkbox) {
    const seccion = checkbox.closest('.cot-seccion');
    if (!seccion) return;

    const isDetallado = checkbox.checked;
    const secId = seccion.dataset.secid;

    // 1. Serializar datos actuales
    const data = serializeSeccionData(seccion, isDetallado);

    // 2. Re-renderizar en nuevo modo
    const newHtml = isDetallado
        ? renderCotSeccionDet(data, secId)
        : renderCotSeccion(data, secId);

    // 3. Reemplazar HTML
    seccion.outerHTML = newHtml;

    // 4. Recalcular totales
    recalcTotalesCotizacion();
}

/**
 * Serializa los datos de una sección para preservarlos al cambiar de modo
 * Hace mapeo inteligente entre campos de modo simple y detallado
 */
function serializeSeccionData(seccion, toDetallado) {
    const titulo = seccion.querySelector('.cot-sec-title')?.value || '';
    const isDet = seccion.dataset.mode === 'det';
    const items = [];

    seccion.querySelectorAll('tbody tr').forEach(row => {
        if (isDet) {
            // MODO ACTUAL: Detallado → Convertir a estructura destino
            const concepto = row.querySelector('[name="concepto"]')?.value || '';
            const cantidad = Number(row.querySelector('[name="cantidadSec"]')?.value || 0);
            const unidad = row.querySelector('[name="unidadSec"]')?.value || '';
            const precioUnit = Number(row.querySelector('[name="precioUnitSec"]')?.value || 0);

            if (!concepto && !cantidad && !precioUnit) return;

            if (toDetallado) {
                // Destino: Detallado (mantener estructura)
                items.push({ concepto, cantidad, unidad, precioUnit });
            } else {
                // Destino: Simple (convertir: Total = Cantidad × P.Unit → Precio)
                const precio = cantidad * precioUnit;
                items.push({
                    concepto,
                    descripcion: '', // No hay descripción en modo detallado
                    precio
                });
            }
        } else {
            // MODO ACTUAL: Simple → Convertir a estructura destino
            const concepto = row.querySelector('[name="concepto"]')?.value || '';
            const descripcion = row.querySelector('[name="descripcion"]')?.value || '';
            const precio = Number(row.querySelector('[name="precioSec"]')?.value || 0);

            if (!concepto && !descripcion && !precio) return;

            if (toDetallado) {
                // Destino: Detallado (convertir: Precio → Cantidad=1, P.Unit=Precio)
                items.push({
                    concepto,
                    cantidad: precio > 0 ? 1 : 0, // Si hay precio, cantidad = 1
                    unidad: 'pieza', // Unidad por defecto
                    precioUnit: precio
                });
            } else {
                // Destino: Simple (mantener estructura)
                items.push({ concepto, descripcion, precio });
            }
        }
    });

    return { titulo, items };
}
