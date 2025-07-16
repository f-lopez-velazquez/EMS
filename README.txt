# EMS Cotizaciones y Reportes

Aplicación web progresiva (PWA) para gestión de cotizaciones y reportes de servicio.

## Características

- Crear, editar, eliminar cotizaciones y reportes.
- Subida de hasta 6 imágenes por item de reporte a Firebase Storage.
- Edición completa de registros e imágenes (agregar, eliminar, reemplazar).
- Generación de PDF con layout fijo (encabezado/pie) e imágenes (2 por fila).
- Feedback visual con barra de progreso en todas las acciones.
- Responsive para móvil y escritorio.
- Instalable PWA, funciona offline.

## Despliegue

1. Configura Firebase (Firestore y Storage) en `app.js`.
2. Asegúrate de tener `icons/icon-192.png` y `icons/icon-512.png`.
3. Sube la carpeta a GitHub Pages (rutas relativas).
4. ¡Instala la app y úsala!

## Notas

- Eliminar imágenes en Firebase Storage al borrarlas en la app.
- Limitar a 6 imágenes por item.
- Mostrar mensajes claros de éxito o error en cada operación.
