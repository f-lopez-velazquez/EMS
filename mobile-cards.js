
// ========== MOBILE ACCORDION CARDS PARA COTIZACIONES ==========
// Renderizado premium para móviles con accordion expandible

/**
 * Detecta si estamos en móvil (ancho ≤ 640px)
 */
function isMobileView() {
  return window.innerWidth <= 640;
}

/**
 * Renderiza sección de cotización en formato móvil con accordion cards
 */
function renderCotSeccionMobile(seccion = {}, secId) {
  const id = secId || newUID();
  const items = Array.isArray(seccion.items) ? seccion.items : [{}];
  const isDet = (getSettings()?.cotDetallado === true);
  const titulo = seccion.titulo || 'Conceptos';

  const itemsHtml = items.map((item, idx) =>
    renderMobileItem(item, id, idx, isDet)
  ).join('');

  return `
    <div class="cot-mobile-stack" data-secid="${id}">
      <div class="cot-mobile-header">
        <h3>${titulo}</h3>
        <button type="button" class="btn-primary btn-sm" onclick="agregarItemMobile('${id}')">
          <i class="fa fa-plus"></i> Agregar
        </button>
      </div>
      ${itemsHtml || '<div class="cot-mobile-empty"><i class="fa fa-inbox"></i><p>No hay conceptos aún</p></div>'}
      <div class="cot-mobile-subtotal">
        <span>Subtotal sección:</span>
        <b class="cot-subtotal-val">$0.00</b>
      </div>
    </div>
  `;
}

/**
 * Renderiza un item individual en formato móvil (card expandible)
 */
function renderMobileItem(item = {}, secId, idx, detallado = false) {
  const itemId = `${secId}_${idx}`;

  if (detallado) {
    // Modo detallado: Concepto, Cantidad, Unidad, P.Unit, Total
    const cantidad = item.cantidad || '';
    const unidad = item.unidad || '';
    const punit = item.precioUnit || '';
    const total = (Number(cantidad) || 0) * (Number(punit) || 0);

    return `
      <div class="cot-mobile-item" data-idx="${idx}" data-itemid="${itemId}">
        <div class="cot-mobile-summary" onclick="toggleMobileItem('${itemId}')">
          <div class="cot-mobile-concept">${item.concepto || 'Nuevo concepto'}</div>
          <div class="cot-mobile-calc">
            ${cantidad || 0} × $${Number(punit || 0).toFixed(2)} = <b>$${total.toFixed(2)}</b>
          </div>
          <i class="fa fa-chevron-down cot-mobile-toggle" id="toggle_${itemId}"></i>
        </div>
        
        <div class="cot-mobile-details" id="details_${itemId}" style="display:none">
          <label>Concepto</label>
          <input type="text" class="cot-mobile-input" name="concepto" 
                 value="${safe(item.concepto)}" 
                 placeholder="¿Qué servicio o producto?"
                 oninput="updateMobileSummary('${itemId}')">
          
          <label>Cantidad</label>
          <input type="number" class="cot-mobile-input" name="cantidadSec" 
                 value="${cantidad}" 
                 placeholder="Ej: 2" min="0" step="1"
                 oninput="recalcMobileItemTotal('${itemId}')">
          
          <label>Unidad</label>
          <input type="text" class="cot-mobile-input" name="unidadSec" 
                 value="${safe(unidad)}" 
                 placeholder="Ej: pieza, metro, hora"
                 list="unidadesEMS">
          
          <label>Precio Unitario</label>
          <div class="cot-mobile-price-input">
            <span class="price-symbol">$</span>
            <input type="number" name="precioUnitSec" 
                   value="${punit}" 
                   placeholder="0.00" min="0" step="0.01"
                   oninput="recalcMobileItemTotal('${itemId}')">
          </div>
          
          <div class="cot-mobile-total">
            <span>Total:</span>
            <b class="mobile-total-val">$${total.toFixed(2)}</b>
          </div>
          
          <div class="cot-mobile-actions">
            <button type="button" class="btn-danger btn-sm" onclick="eliminarItemMobile('${itemId}')">
              <i class="fa fa-trash"></i> Eliminar
            </button>
            <button type="button" class="btn-primary btn-sm" onclick="toggleMobileItem('${itemId}')">
              <i class="fa fa-check"></i> Listo
            </button>
          </div>
        </div>
      </div>
    `;
  } else {
    // Modo simple: Concepto, Descripción, Precio
    const descripcionPreview = (item.descripcion || '').substring(0, 50);
    const precio = Number(item.precio || 0);

    return `
      <div class="cot-mobile-item" data-idx="${idx}" data-itemid="${itemId}">
        <div class="cot-mobile-summary" onclick="toggleMobileItem('${itemId}')">
          <div class="cot-mobile-concept">${item.concepto || 'Nuevo concepto'}</div>
          ${descripcionPreview ? `<div class="cot-mobile-preview">${descripcionPreview}...</div>` : ''}
          <div class="cot-mobile-price">
            <b>$${precio.toFixed(2)}</b>
            <i class="fa fa-chevron-down cot-mobile-toggle" id="toggle_${itemId}"></i>
          </div>
        </div>
        
        <div class="cot-mobile-details" id="details_${itemId}" style="display:none">
          <label>Concepto</label>
          <input type="text" class="cot-mobile-input" name="concepto" 
                 value="${safe(item.concepto)}" 
                 placeholder="¿Qué servicio?"
                 list="conceptosEMS"
                 oninput="updateMobileSummary('${itemId}')">
          
          <label>Descripción</label>
          <textarea class="cot-mobile-input" name="descripcion" rows="3"
                    placeholder="Detalles adicionales..."
                    oninput="updateMobileSummary('${itemId}')">${safe(item.descripcion)}</textarea>
          
          <label>Precio</label>
          <div class="cot-mobile-price-input">
            <span class="price-symbol">$</span>
            <input type="number" name="precioSec" 
                   value="${precio || ''}" 
                   placeholder="0.00" min="0" step="0.01"
                   oninput="recalcMobileItemTotal('${itemId}')">
          </div>
          
          <div class="cot-mobile-actions">
            <button type="button" class="btn-danger btn-sm" onclick="eliminarItemMobile('${itemId}')">
              <i class="fa fa-trash"></i> Eliminar
            </button>
            <button type="button" class="btn-primary btn-sm" onclick="toggleMobileItem('${itemId}')">
              <i class="fa fa-check"></i> Listo
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Toggle expand/collapse de un item móvil
 */
function toggleMobileItem(itemId) {
  const details = document.getElementById(`details_${itemId}`);
  const toggle = document.getElementById(`toggle_${itemId}`);
  const item = document.querySelector(`[data-itemid="${itemId}"]`);

  if (!details || !toggle || !item) return;

  if (details.style.display === 'none') {
    // Expandir
    details.style.display = 'block';
    toggle.classList.add('rotated');
    item.classList.add('expanded');

    // Focus en primer input
    const firstInput = details.querySelector('input, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  } else {
    // Colapsar
    details.style.display = 'none';
    toggle.classList.remove('rotated');
    item.classList.remove('expanded');
  }
}

/**
 * Actualiza el summary del item cuando se edita
 */
function updateMobileSummary(itemId) {
  const item = document.querySelector(`[data-itemid="${itemId}"]`);
  if (!item) return;

  const conceptoInput = item.querySelector('input[name="concepto"]');
  const conceptoDisplay = item.querySelector('.cot-mobile-concept');

  if (conceptoInput && conceptoDisplay) {
    const valor = conceptoInput.value.trim() || 'Nuevo concepto';
    conceptoDisplay.textContent = valor;
  }

  // Actualizar preview de descripción si existe
  const descripcionInput = item.querySelector('textarea[name="descripcion"]');
  const previewDisplay = item.querySelector('.cot-mobile-preview');

  if (descripcionInput && previewDisplay) {
    const desc = descripcionInput.value.substring(0, 50);
    previewDisplay.textContent = desc ? `${desc}...` : '';
  }
}

/**
 * Recalcula el total de un item móvil
 */
function recalcMobileItemTotal(itemId) {
  const item = document.querySelector(`[data-itemid="${itemId}"]`);
  if (!item) return;

  const isDet = !!item.querySelector('input[name="cantidadSec"]');

  if (isDet) {
    // Modo detallado
    const cantidad = Number(item.querySelector('input[name="cantidadSec"]')?.value || 0);
    const punit = Number(item.querySelector('input[name="precioUnitSec"]')?.value || 0);
    const total = cantidad * punit;

    // Actualizar display de total
    const totalDisplay = item.querySelector('.mobile-total-val');
    if (totalDisplay) {
      totalDisplay.textContent = `$${total.toFixed(2)}`;
    }

    // Actualizar cálculo en summary
    const calcDisplay = item.querySelector('.cot-mobile-calc b');
    if (calcDisplay) {
      calcDisplay.textContent = `$${total.toFixed(2)}`;
    }

    const calcFull = item.querySelector('.cot-mobile-calc');
    if (calcFull) {
      calcFull.innerHTML = `${cantidad || 0} × $${punit.toFixed(2)} = <b>$${total.toFixed(2)}</b>`;
    }
  } else {
    // Modo simple
    const precio = Number(item.querySelector('input[name="precioSec"]')?.value || 0);
    const priceDisplay = item.querySelector('.cot-mobile-price b');
    if (priceDisplay) {
      priceDisplay.textContent = `$${precio.toFixed(2)}`;
    }
  }

  // Recalcular subtotal de sección
  recalcMobileSubtotal(item.closest('.cot-mobile-stack'));
}

/**
 * Recalcula subtotal de una sección móvil
 */
function recalcMobileSubtotal(stack) {
  if (!stack) return;

  let subtotal = 0;
  const items = stack.querySelectorAll('.cot-mobile-item');

  items.forEach(item => {
    const isDet = !!item.querySelector('input[name="cantidadSec"]');

    if (isDet) {
      const cantidad = Number(item.querySelector('input[name="cantidadSec"]')?.value || 0);
      const punit = Number(item.querySelector('input[name="precioUnitSec"]')?.value || 0);
      subtotal += cantidad * punit;
    } else {
      const precio = Number(item.querySelector('input[name="precioSec"]')?.value || 0);
      subtotal += precio;
    }
  });

  const subtotalDisplay = stack.querySelector('.cot-subtotal-val');
  if (subtotalDisplay) {
    subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
  }

  // Recalcular totales globales
  if (typeof recalcTotalesCotizacion === 'function') {
    recalcTotalesCotizacion();
  }
}

/**
 * Agrega nuevo item móvil a una sección
 */
function agregarItemMobile(secId) {
  const stack = document.querySelector(`[data-secid="${secId}"]`);
  if (!stack) return;

  const items = stack.querySelectorAll('.cot-mobile-item');
  const newIdx = items.length;
  const isDet = (getSettings()?.cotDetallado === true);

  // Remover estado vacío si existe
  const emptyState = stack.querySelector('.cot-mobile-empty');
  if (emptyState) emptyState.remove();

  const newItemHtml = renderMobileItem({}, secId, newIdx, isDet);
  const subtotal = stack.querySelector('.cot-mobile-subtotal');

  if (subtotal) {
    subtotal.insertAdjacentHTML('beforebegin', newItemHtml);
  } else {
    stack.insertAdjacentHTML('beforeend', newItemHtml);
  }

  // Auto-expandir el nuevo item
  const itemId = `${secId}_${newIdx}`;
  setTimeout(() => toggleMobileItem(itemId), 100);

  // Animación bounce
  const newItem = document.querySelector(`[data-itemid="${itemId}"]`);
  if (newItem) {
    newItem.style.animation = 'fadeIn 0.3s ease-in-out';
  }
}

/**
 * Elimina un item móvil
 */
function eliminarItemMobile(itemId) {
  const item = document.querySelector(`[data-itemid="${itemId}"]`);
  if (!item) return;

  // Animación fade out
  item.style.animation = 'fadeOut 0.3s ease-in-out';

  setTimeout(() => {
    const stack = item.closest('.cot-mobile-stack');
    item.remove();

    // Recalcular subtotal
    if (stack) {
      recalcMobileSubtotal(stack);

      // Si no quedan items, mostrar estado vacío
      const remainingItems = stack.querySelectorAll('.cot-mobile-item');
      if (remainingItems.length === 0) {
        const subtotal = stack.querySelector('.cot-mobile-subtotal');
        if (subtotal) {
          subtotal.insertAdjacentHTML('beforebegin',
            '<div class="cot-mobile-empty"><i class="fa fa-inbox"></i><p>No hay conceptos aún</p></div>'
          );
        }
      }
    }
  }, 300);
}

/**
 * Serializa datos de mobile stack para guardar
 */
function serializeMobileStack(stack) {
  if (!stack) return { items: [] };

  const titulo = stack.querySelector('.cot-mobile-header h3')?.textContent || '';
  const items = [];
  const isDet = (getSettings()?.cotDetallado === true);

  stack.querySelectorAll('.cot-mobile-item').forEach(item => {
    if (isDet) {
      const concepto = item.querySelector('input[name="concepto"]')?.value || '';
      const cantidad = Number(item.querySelector('input[name="cantidadSec"]')?.value || 0);
      const unidad = item.querySelector('input[name="unidadSec"]')?.value || '';
      const precioUnit = Number(item.querySelector('input[name="precioUnitSec"]')?.value || 0);
      const total = cantidad * precioUnit;

      if (concepto || cantidad || precioUnit) {
        items.push({ concepto, cantidad, unidad, precioUnit, total });
      }
    } else {
      const concepto = item.querySelector('input[name="concepto"]')?.value || '';
      const descripcion = item.querySelector('textarea[name="descripcion"]')?.value || '';
      const precio = Number(item.querySelector('input[name="precioSec"]')?.value || 0);

      if (concepto || descripcion || precio) {
        items.push({ concepto, descripcion, precio });
      }
    }
  });

  return { titulo, items };
}

// Animación fadeOut para eliminar
if (typeof document !== 'undefined' && !document.getElementById('mobile-animations-style')) {
  const style = document.createElement('style');
  style.id = 'mobile-animations-style';
  style.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.95); }
    }
  `;
  document.head.appendChild(style);
}
