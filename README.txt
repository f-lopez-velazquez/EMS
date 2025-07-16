# EMS Cotizaciones y Reportes

Aplicación web progresiva (PWA) para gestión de cotizaciones y reportes de servicio.

## Características

- Crear, editar, eliminar cotizaciones y reportes.
- Subida de hasta 6 imágenes por ítem de reporte a Firebase Storage.
- Compresión de imágenes antes de subir para optimizar velocidad sin perder calidad (canvas).
- Edición completa de registros e imágenes (agregar, eliminar, reemplazar).
- Generación de PDF con layout fijo (encabezado en primer página, pie de página y marca de agua en siguientes; imágenes máx 2 por fila).
- Feedback visual con barra de progreso y mensajes de "Cargando..." durante todas las acciones.
- Responsive para móvil y escritorio.
- Instalable PWA, funciona offline.

## Despliegue

1. Configura Firebase (Firestore y Storage) en `app.js`.
2. Asegúrate de tener `icons/icon-192.png` y `icons/icon-512.png`.
3. Sube la carpeta a GitHub Pages (rutas relativas).
4. ¡Instala la app y úsala!

## Notas

- Eliminar imágenes en Firebase Storage al borrarlas en la app.
- Limitar a 6 imágenes por ítem.
- Mostrar mensajes claros de éxito o error en cada operación.
- Las imágenes se comprimen usando canvas a un 80% de calidad antes de subir.
