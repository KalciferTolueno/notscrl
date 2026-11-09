# NotSCRL — Tu estudio creativo

Editor de carruseles panorámicos para móvil y escritorio. Crea una historia continua, compón con fotos y texto y descarga las páginas en PNG a 1080 px de ancho.

## Qué incluye

- **Inicio de app y sección Borradores:** proyectos independientes con nombre, miniatura, fecha de guardado y acceso desde la navegación inferior. Compatible con el proyecto guardado por la versión anterior.
- **Cuatro plantillas con vistas previas reales:** panorama, editorial, scrapbook y película de 35 mm. Elegir una plantilla crea un proyecto nuevo y conserva el anterior.
- **Editor para teléfono:** controles táctiles, herramientas del elemento junto al pulgar, miniaturas para navegar entre páginas, vista de página o panorama y panel de capas. Botón dedicado para Guardar borrador y volver a Borradores.
- **Fotos y composición:** recorte, ocho formas y marcos, encuadre con zoom, alineación, orden de capas, duplicación e historial.
- **Texto editable:** contenido, tipografía, tamaño, color, alineación, sombra y opacidad.
- **Exportación:** PNG individual, ZIP de todas las páginas o panorama completo. Formatos 4:5 (1080 × 1350), 1:1 (1080 × 1080) y 9:16 (1080 × 1920), de 1 a 10 páginas.
- **Accesibilidad:** controles con etiquetas, foco de teclado, cierre con Escape, aislamiento del fondo en los diálogos y respeto a movimiento reducido.

## Ejecutar

Requiere Node.js para servir la app, sin instalar paquetes:

```sh
node build.js
node server.js
```

Abre [http://localhost:3000](http://localhost:3000). Para probar desde el teléfono, usa la dirección de red que imprime el servidor y conecta ambos dispositivos a la misma red Wi-Fi. El servidor debe permanecer abierto.

También se puede abrir `index.html` directamente, aunque la disponibilidad de almacenamiento depende del navegador y del protocolo.

## Desarrollo y comprobaciones

Edita los módulos de `js/` y recompila con `node build.js`. `index.html` carga `js/notscrl.bundle.js`.

```sh
node --test tests/studio.test.cjs
node --check js/notscrl.bundle.js
```

Las 16 pruebas cubren ajuste móvil, aislamiento de snapshots, importación secuencial, conservación y exportación de originales, recuperación de lienzos vacíos e imágenes, confirmación de transacciones, respaldo síncrono al salir, guardado con cuota local agotada, estados de cambios pendientes y coordenadas/dimensiones de exportación.

## Guardado y privacidad

Las fotos y los proyectos se procesan en el navegador. IndexedDB guarda el proyecto activo y la biblioteca; localStorage conserva un respaldo del proyecto activo cuando hay espacio. Los campos y las acciones de edición se guardan de inmediato; durante los arrastres se agrupan los cambios para mantener el lienzo fluido y se guarda al terminar. Al ocultar o abandonar la página se intenta guardar otra vez. El respaldo local se escribe antes de esperar la base de datos. El estado **Borrador guardado** aparece después de confirmar la transacción. Si solo funciona el respaldo, la app lo indica e impide crear otro proyecto para proteger el actual.

Los proyectos no se sincronizan entre dispositivos. Borrar los datos del navegador los elimina. La descarga ZIP conserva las imágenes finales; no es un respaldo editable. La app no descarga fuentes ni recursos externos y utiliza fuentes del sistema y muestras vectoriales locales.

Las fotos nuevas conservan su archivo original sin recomprimir en un almacén separado de IndexedDB. El editor y sus miniaturas usan vistas previas de hasta 1280 px; las descargas PNG, ZIP y panorama cargan los originales de uno en uno para reducir la memoria simultánea. Si no se puede guardar o recuperar un original, la app informa del fallo. Las fotos importadas antes de este cambio conservan la fuente que ya tenían guardada; hay que volver a añadirlas para recuperar un original que se hubiera reducido.

## Archivos principales

- `index.html`: inicio, editor, paneles y diálogos.
- `css/styles.css`: sistema visual y adaptación a pantallas.
- `js/studio.js`: navegación, biblioteca, creación de proyectos, miniaturas y capas.
- `js/app.js`: herramientas, carga de fotos, controles y accesibilidad de diálogos.
- `js/canvas.js`, `js/objects.js`: lienzo, gestos, historial, objetos y máscaras.
- `js/storage.js`: persistencia, recuperación y estados de guardado.
- `js/exporter.js`, `js/zip.js`: renderizado y descarga.
- `js/cropper.js`, `js/frame-adjuster.js`, `js/preview.js`: recorte, encuadre y simulador.
- `DOCUMENTACION.md`: historial técnico y detalle de esta revisión.

Las pruebas visuales se realizaron en navegador a 320 × 568, 390 × 844 y en escritorio. Se comprobó también la recuperación de nombre, texto, foto, formato y páginas después de recargar inmediatamente y de cerrar y reabrir una pestaña, en una sesión de prueba separada de los borradores del usuario. Falta comprobar los gestos en un teléfono físico y Safari iOS.
