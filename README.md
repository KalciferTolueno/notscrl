# NotSCRL — Tu estudio creativo

Editor de carruseles panorámicos para móvil y escritorio. Crea una historia continua, compón con fotos y texto y descarga las páginas en PNG a 1080 px de ancho.

## Qué incluye

- **Inicio de app y sección Borradores:** proyectos independientes con nombre, miniatura, fecha de guardado y acceso desde la navegación inferior. Cada tarjeta permite renombrar, duplicar o eliminar el borrador; al eliminar se limpian los originales que ya no usa ningún proyecto. Compatible con el proyecto guardado por la versión anterior.
- **Cuatro plantillas con vistas previas reales:** panorama, editorial, scrapbook y película de 35 mm. Elegir una plantilla crea un proyecto nuevo y conserva el anterior.
- **Editor para teléfono:** controles del lienzo plegados bajo «Lienzo», herramientas que aparecen al seleccionar, miniaturas compactas para navegar entre páginas, vista de página o panorama y panel de capas. Botón dedicado para Guardar borrador y volver a Borradores.
- **Editor de escritorio:** inspector de propiedades fijo a la derecha con categorías plegables (posición, forma, alineación y ajustes visuales), panel de capas siempre visible y barra de acciones contextual dentro del propio inspector.
- **Capas estilo Photoshop:** miniatura, nombre y número por capa; ojo para ocultar y mostrar; reordenación arrastrando la fila o con Subir/Bajar. Las capas ocultas no se exportan.
- **Stickers con recorte por IA:** separa el sujeto de una foto en el navegador (ISNet o silueta con onnxruntime-web), corrige la máscara con pincel, añade contorno y guarda el sticker en la biblioteca. Todo ocurre en el dispositivo; si el modelo no está disponible, usa el recorte por bordes.
- **GIFs de GIPHY:** búsqueda e inserción mediante un proxy del mismo origen; la clave se configura con `GIPHY_API_KEY` en el servidor (Easypanel) o en `start.bat`. El segmento **Usados** lista los GIFs del proyecto y permite reinsertarlos.
- **Fotos y composición:** recorte, nueve formas y marcos, encuadre con zoom, alineación, orden de capas, duplicación e historial. «Página completa» coloca una foto en los límites exactos de la página activa y restablece recorte, encuadre, giro y marcos; con igual proporción muestra la foto entera, con otra proporción aplica un recorte centrado. Se puede deshacer.
- **Recorte sin desplazamientos:** oculta los píxeles descartados conservando la posición, el tamaño y el encuadre de la foto. El recorte se conserva al guardar y exportar.
- **Eliminar páginas:** selecciona una miniatura y pulsa la papelera. Elimina los elementos cuyo centro pertenece a esa página y desplaza los de las páginas posteriores; se puede deshacer. Siempre queda al menos una página.
- **Texto editable:** contenido, tipografía, tamaño, color, alineación, sombra y opacidad. El texto se ajusta solo al ancho del cuadro, con salto por palabras y corte de palabras largas; el alto crece si hacen falta más líneas.
- **Exportación:** PNG individual, ZIP de todas las páginas o panorama completo. Formatos 4:5 (1080 × 1350), 1:1 (1080 × 1080) y 9:16 (1080 × 1920), de 1 a 10 páginas. Si el lienzo incluye vídeo o GIF, aparece además la exportación en **WebM del panorama** con duración, FPS, códec (VP9/VP8) y calidad, incluida una opción sin compresión de 50 Mbps.
- **Copia de seguridad:** desde Exportar se descarga un `.notscrl.json` con el proyecto y los originales en base64. Restaurar copia crea un proyecto nuevo y conserva las fotos a resolución completa.
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

Las 21 pruebas cubren eliminación de páginas y recuperación, recortes sin cambios de posición o escala, ajuste móvil, fotos a página completa sin recorte cuando coincide la proporción, aislamiento de snapshots, importación secuencial, conservación y exportación de originales, recuperación de lienzos vacíos e imágenes, confirmación de transacciones, respaldo síncrono al salir, guardado con cuota local agotada, estados de cambios pendientes, coordenadas/dimensiones de exportación y ajuste de línea de los textos.

## Guardado y privacidad

Las fotos y los proyectos se procesan en el navegador. IndexedDB guarda el proyecto activo y la biblioteca; localStorage conserva un respaldo del proyecto activo cuando hay espacio. Los campos y las acciones de edición se guardan de inmediato; durante los arrastres se agrupan los cambios para mantener el lienzo fluido y se guarda al terminar. Al ocultar o abandonar la página se intenta guardar otra vez. El respaldo local se escribe antes de esperar la base de datos. El estado **Borrador guardado** aparece después de confirmar la transacción. Si solo funciona el respaldo, la app lo indica e impide crear otro proyecto para proteger el actual.

Los proyectos no se sincronizan entre dispositivos. Borrar los datos del navegador los elimina. La descarga ZIP conserva las imágenes finales; no es un respaldo editable. La app no descarga fuentes ni recursos externos: usa fuentes del sistema, tres tipografías locales incluidas en `fonts/` (SIL OFL) y muestras vectoriales locales. La excepción son los GIFs de GIPHY que el usuario busque o inserte, servidos por el proxy del propio servidor. El modelo de recorte de stickers se sirve desde `js/vendor/` en el mismo origen; la inferencia nunca sale del dispositivo.

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
- `js/sticker-studio.js`, `js/segmenter.js`: recorte de stickers con IA y biblioteca de stickers.
- `js/vendor/`: modelos ONNX y runtime de onnxruntime-web usados en local.
- `DOCUMENTACION.md`: historial técnico y detalle de esta revisión.

Las pruebas visuales se realizaron en navegador a 320 × 568, 390 × 844 y en escritorio. Se comprobó también la recuperación de nombre, texto, foto, formato y páginas después de recargar inmediatamente y de cerrar y reabrir una pestaña, en una sesión de prueba separada de los borradores del usuario. Falta comprobar los gestos en un teléfono físico y Safari iOS.
