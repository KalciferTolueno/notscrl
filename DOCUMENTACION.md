# 📖 Documentación Completa del Proyecto — NotSCRL Studio

> **Nombre del archivo:** `DOCUMENTACION.md`  
> **Proyecto:** NotSCRL — Mobile-First Panoramic Instagram Carousel Studio Web  
> **Fecha de consolidación:** Noviembre 2026  
> **Actualización:** la sección 6 describe la revisión del estudio; las secciones anteriores conservan el historial del agente previo.
> **Repositorio base e inspiración:** [SCRL](https://scrl.com/) + Metodología Clean-Room [morluto/rea](https://github.com/morluto/rea)  
> **Diseño de Interfaz:** Basado en la skill oficial [`ceorkm/mobile-app-ui-design`](https://github.com/ceorkm/mobile-app-ui-design)

---

## 📑 Índice de Contenidos

1. [Resumen Ejecutivo y Propósito](#1-resumen-ejecutivo-y-propósito)
2. [Arquitectura y Estructura del Código](#2-arquitectura-y-estructura-del-código)
3. [Registro Cronológico de Funcionalidades Implementadas](#3-registro-cronológico-de-funcionalidades-implementadas)
   * [3.1. Motor Panorámico y Metodología REA](#31-motor-panorámico-y-metodología-rea)
   * [3.2. Transformación Mobile-First (Skill mobile-app-ui-design)](#32-transformación-mobile-first-skill-mobile-app-ui-design)
   * [3.3. Refinamientos de UX y Barra Superior Flotante](#33-refinamientos-de-ux-y-barra-superior-flotante)
   * [3.4. Motor de Recorte y Máscaras Geométricas](#34-motor-de-recorte-y-máscaras-geométricas)
   * [3.5. Corrección de Física de Esquinas (Anclaje Fijo)](#35-corrección-de-física-de-esquinas-anclaje-fijo)
   * [3.6. Adaptabilidad Vertical Móvil (Eliminación de Vista Cuadrada)](#36-adaptabilidad-vertical-móvil-eliminación-de-vista-cuadrada)
   * [3.7. Persistencia en Caché (IndexedDB + LocalStorage)](#37-persistencia-en-caché-indexeddb--localstorage)
   * [3.8. Control Gradual de Capas (+1 / -1)](#38-control-gradual-de-capas-1---1)
   * [3.9. Algoritmo Anti-Deformación (`object-fit: cover`)](#39-algoritmo-anti-deformación-object-fit-cover)
   * [3.10. Herramienta de Encuadre Manual de Fotos dentro de Formas](#310-herramienta-de-encuadre-manual-de-fotos-dentro-de-formas)
4. [Guía de Uso y Atajos](#4-guía-de-uso-y-atajos)
5. [Instrucciones de Despliegue y Acceso](#5-instrucciones-de-despliegue-y-acceso)

---

## 1. Resumen Ejecutivo y Propósito

**NotSCRL** es una aplicación web de diseño visual de alto rendimiento, optimizada prioritariamente para dispositivos móviles y perfectamente funcional en PC, cuyo objetivo es permitir la creación de **carruseles panorámicos continuos (*seamless carousels*) para Instagram, TikTok y LinkedIn**.

Permite que una o múltiples fotografías, textos o elementos gráficos atraviesen las costuras (*seams*) entre diapositivas consecutivas sin saltos perceptibles, cortando el resultado final en imágenes individuales a **1080p** y empaquetándolas en un archivo **ZIP** descargable en un clic, todo ejecutado 100% en el cliente sin requerir librerías externas ni servidores pesados.

---

## 2. Arquitectura y Estructura del Código

El proyecto fue desarrollado bajo una premisa de **cero dependencias externas en tiempo de ejecución** (*zero-dependency pure JS/CSS/HTML*):

```
NotSCRL/
├── index.html                  # Shell único móvil/escritorio con accesos thumb-zone
├── server.js                   # Servidor HTTP nativo Node.js (0.0.0.0:3000 para acceso LAN)
├── build.js                    # Empaquetador offline de módulos hacia notscrl.bundle.js
├── DOCUMENTACION.md            # Documentación exhaustiva técnica y de usuario
├── README.md                   # Resumen del proyecto y guía de inicio rápido
├── REA_ANALYSIS.md             # Informe técnico de ingeniería inversa de REA y SCRL
├── css/
│   └── styles.css              # Sistema de diseño 60/30/10, grid 8pt, drawers y animaciones
└── js/
    ├── zip.js                  # Compresor ZIP binario nativo en memoria (RFC 1951 / PKZIP)
    ├── assets.js               # Paletas de color, tipografías, fotos vectoriales y stickers
    ├── objects.js              # Capas del lienzo (ImageItem, TextItem, StickerItem, máscaras)
    ├── canvas.js               # Motor Canvas 2D de alta resolución (pan, zoom, guías, magnetismo)
    ├── storage.js              # Gestor de caché y persistencia (IndexedDB + localStorage)
    ├── exporter.js             # Motor de render offscreen a 1080p y corte automático de slides
    ├── preview.js              # Simulador de feed de Instagram con física de swipe táctil
    ├── cropper.js              # Herramienta de recorte con regla de tercios y relaciones de aspecto
    ├── frame-adjuster.js       # Herramienta de reencuadre y paneo manual dentro de formas
    ├── templates.js            # Plantillas estéticas preconfiguradas (Wanderlust, Vogue, etc.)
    ├── app.js                  # Coordinador central de eventos y drawers
    └── notscrl.bundle.js       # Bundle único compilado para máxima compatibilidad
```

---

## 3. Registro Cronológico de Funcionalidades Implementadas

### 3.1. Motor Panorámico y Metodología REA
* Inspirado en la desconstrucción analítica de `morluto/rea`, se creó un motor de renderizado 2D continuo donde la coordenada $X$ se extiende de $0$ a $(\text{slideCount} \times \text{slideWidth})$.
* Soporte nativo para 3 relaciones de aspecto de Instagram:
  * **Retrato (4:5)**: $1080 \times 1350\text{ px}$.
  * **Cuadrado (1:1)**: $1080 \times 1080\text{ px}$.
  * **Stories / Reels (9:16)**: $1080 \times 1920\text{ px}$.
* Generador ZIP en memoria (`js/zip.js`) que compila la cabecera del archivo, los registros locales y el directorio central sin requerir JSZip ni librerías externas.

### 3.2. Transformación Mobile-First (Skill `mobile-app-ui-design`)
A petición del usuario, se instaló la skill [`ceorkm/mobile-app-ui-design`](https://github.com/ceorkm/mobile-app-ui-design) y se rediseñó por completo la interfaz:
* **Regla de Color 60/30/10:** 60% fondo carbón profundo (`#08090d`), 30% tarjetas elevadas con desenfoque de fondo (`#181b24`), 10% acento eléctrico azul-violeta (`#3b82f6`).
* **Zona del Pulgar (*Thumb-Zone*):** Toda la navegación primaria se ubicó en la parte inferior de la pantalla accesible con una sola mano.
* **Cajón Deslizante (*Bottom Sheet Drawer*):** Submenús para añadir fotos, tipografía, stickers, plantillas y fondos sin saturar la pantalla.
* **Dianas táctiles de al menos 44×44pt:** Facilidad de pulsación en pantallas táctiles.

### 3.3. Refinamientos de UX y Barra Superior Flotante
* **Eliminación de etiquetas invasivas:** Se retiraron las etiquetas rojas fijas "SEAM 1" y "SEAM 2", reemplazándolas por líneas guía sutiles y elegantes.
* **Reposicionamiento de la barra de acciones contextuales:** La barra con botones como *Centrar*, *Ajustar*, *Cruzar*, etc., se reubicó **en la parte superior de la pantalla** (directamente debajo del encabezado). Con esto se resolvió el problema de que tapaba el centro del lienzo e impedía ver las fotos mientras se editaban.
* **Lienzo Limpio / Vacío:** Botón directo "Vaciar" en el encabezado y plantilla "Lienzo Blanco Vacío" en la sección de Estilos para comenzar proyectos en blanco con un solo toque.
* **Guías Magnéticas Inteligentes:** Detección de imán (*snapping*) con umbral de 22px hacia:
  * Centro exacto de la diapositiva activa (horizontal y vertical).
  * Líneas divisorias de corte (*seams*).
  * Centros y bordes de otras imágenes en el lienzo (líneas guía dinámicas en cian y magenta).

### 3.4. Motor de Recorte y Máscaras Geométricas
* Máscaras vectoriales aplicables a cualquier imagen:
  * ⚪ **Círculo:** Recorte perfectamente circular.
  * ⭐ **Estrella:** Silueta geométrica de 5 puntas.
  * 💖 **Corazón:** Curva bezier proporcional.
  * 🏛️ **Arco:** Bóveda arquitectónica editorial.
  * 🌸 **Flor:** Silueta floral de 8 pétalos simétricos.
  * 📸 **Polaroid:** Marco fotográfico analógico con pie manuscrito editable.
  * 🎞️ **Film 35mm:** Bordes de celuloide con perforaciones de arrastre de carrete.
  * 🔲 **Rectángulo redondeado ajustable:** Radio de esquina de 0 a 60px.

### 3.5. Corrección de Física de Esquinas (Anclaje Fijo)
* **Diagnóstico del problema anterior:** Al redimensionar una imagen estirando un tirador de esquina, el motor calculaba el nuevo tamaño y reubicaba el centro en `(oldCx, oldCy)`. Esto provocaba que la esquina opuesta se desplazara hacia afuera en dirección contraria, "descalzando" la imagen de su sitio.
* **Solución matemática implementada:**
  * Al iniciar el arrastre, se registra la coordenada global de la esquina opuesta como **ancla fija** ($A$).
  * Si se arrastra la esquina inferior-derecha (`se`), la esquina superior-izquierda (`nw`) queda estrictamente inmóvil en el lienzo.
  * Se proyecta el movimiento del puntero sobre la orientación rotada del objeto, escalando la dimensión de forma 1:1 con el cursor y recalculando el nuevo centro para que el ancla $A$ tenga desplazamiento cero ($0.00\text{ px}$).

### 3.6. Adaptabilidad Vertical Móvil (Eliminación de Vista Cuadrada)
* **Diagnóstico del problema anterior:** La función `fitToScreen()` forzaba a que las 3 diapositivas completas (3240px de ancho) entraran en los ~360px de ancho del teléfono. Esto comprimía la altura del lienzo a solo ~140px, dejando dos enormes franjas negras arriba y abajo y dando la apariencia visual de una app achatada o "cuadrada".
* **Solución implementada:**
  * **Modo de enfoque en Diapositiva Vertical:** En dispositivos móviles, el lienzo ahora escala por **altura** (`availH / slideHeight * 0.90`), llenando el 90% del espacio vertical disponible.
  * Las diapositivas en formato **9:16 Story** y **4:5 Retrato** se ven altas, nítidas y ocupan la pantalla del móvil exactamente como en la aplicación nativa de Instagram o SCRL.
  * La diapositiva continua se extiende hacia la derecha permitiendo deslizarse con un dedo (*pan*) para ver las siguientes páginas.
  * **Botón "Centrar / Vista" y Doble Toque:** Permite alternar en cualquier momento entre la vista vertical de diapositiva y la vista panorámica completa de todo el carrusel.

### 3.7. Persistencia en Caché (IndexedDB + LocalStorage)
* **Problema resuelto:** Al recargar la página (`F5`) o cerrar el navegador, el proyecto desaparecía y volvía a la plantilla inicial.
* **Motor `StorageManager`:**
  * Se implementó auto-guardado debounced (350ms) en cada cambio del lienzo (`onCanvasChange`).
  * Guarda automáticamente en **IndexedDB** (`NotScrlStorageDB`), permitiendo almacenar proyectos con fotos en alta resolución según la cuota disponible del navegador.
  * Cuenta con respaldo síncrono en `localStorage`.
  * Al abrir la app, detecta si hay un proyecto previo y lo restaura de forma instantánea y transparente.

### 3.8. Control Gradual de Capas (+1 / -1)
* **Problema resuelto:** Al usar el botón "Enviar al fondo", la imagen se iba detrás de todas las capas existentes.
* **Nuevos controles implementados:**
  * En la **barra superior contextual**: Se añadieron los botones directos 🔼 **Subir** (`bringForward`, +1 capa) y 🔽 **Bajar** (`sendBackward`, -1 capa).
  * En el cajón inferior **"Formas y Ajustes"**: Se organizó una botonera completa de 4 acciones:
    * `▲ Subir 1 Capa`
    * `▼ Bajar 1 Capa`
    * `⏫ Al Frente` (al tope de la pila)
    * `⏬ Al Fondo` (al fondo de la pila)

### 3.9. Algoritmo Anti-Deformación (`object-fit: cover`)
* **Problema resuelto:** Al aplicar formas o recortar fotos de diferentes proporciones, el renderizado nativo estiraba los píxeles vertical u horizontalmente.
* **Implementación matemática:**
  * Método `drawImageCover(ctx, dx, dy, dw, dh)` en `ImageItem`.
  * Calcula la relación de aspecto de origen ($sw / sh$) y la de destino ($dw / dh$).
  * Recorta el sobrante manteniendo la misma escala en los ejes X e Y ($scale_X \equiv scale_Y$).
  * **Cero deformación:** Las caras y paisajes mantienen su aspecto natural tanto en recortes rectangulares como dentro de círculos, arcos o corazones.

### 3.10. Herramienta de Encuadre Manual de Fotos dentro de Formas
* **Funcionalidad:** Botón dedicado 🖼️ **"Encuadre"** en la barra superior (y en la pestaña de ajustes).
* **Modal interactivo `FrameAdjuster`:**
  * Muestra la silueta de la forma elegida (círculo, arco, estrella, corazón, etc.) sobre un lienzo en tiempo real.
  * Permite **arrastrar la fotografía con el ratón o el dedo** para reposicionarla libremente dentro de la máscara (ideal para centrar caras o detalles).
  * **Control deslizante de Zoom (1.0x a 3.5x)** para acercar o alejar el motivo dentro de la figura.
  * Botón **"Centrar"** para restaurar el encuadre por defecto.
  * Botón **"✓ Aplicar Encuadre"** que actualiza la propiedad `fitOffset` en el objeto y lo renderiza de inmediato en el carrusel y en las descargas a 1080p.

---

## 4. Guía de Uso y Atajos

### Atajos de Teclado (PC)
| Tecla | Acción |
| :--- | :--- |
| `Espacio + Arrastrar` | Desplazarse por el lienzo (*Pan*) |
| `Rueda del Ratón` | Desplazamiento horizontal / vertical |
| `Ctrl + Rueda` | Zoom in / Zoom out suave |
| `Ctrl + Z` | Deshacer (*Undo*) |
| `Ctrl + Y` o `Ctrl + Shift + Z` | Rehacer (*Redo*) |
| `Flechas del Teclado` | Mover elemento seleccionado (2px / 10px con `Shift`) |
| `Supr` o `Backspace` | Eliminar elemento seleccionado |
| `Doble Clic en Foto` | Abrir herramienta de Encuadre / Recorte |
| `Doble Clic en Lienzo Vacío` | Alternar entre vista de diapositiva y panorama completo |

### Gestos Táctiles (Móvil / Tablet)
| Gesto | Acción |
| :--- | :--- |
| `Arrastrar con 1 dedo en fondo` | Desplazarse horizontalmente por el carrusel |
| `Pellizcar con 2 dedos` | Zoom in / Zoom out en el lienzo |
| `Doble toque en lienzo vacío` | Alternar entre vista completa y altura vertical adaptada |
| `Doble toque sobre una imagen` | Abrir directamente el ajustador de encuadre manual |
| `Arrastrar tirador de esquina` | Redimensionar la imagen fijando la esquina opuesta |

---

## 5. Instrucciones de Despliegue y Acceso

### Acceso Local (En el equipo de desarrollo)
La aplicación se encuentra en ejecución continua en segundo plano. Puedes abrirla en tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

### Acceso desde Teléfonos Móviles o Tablets (Misma Red Wi-Fi)
Para probar la experiencia táctil en tu dispositivo móvil sin instalar nada:
1. Conecta tu teléfono a la misma red Wi-Fi de tu ordenador.
2. Abre Google Chrome o Safari en tu teléfono e ingresa la dirección IP local:
👉 **`http://192.168.1.11:3000`**

### Recompilación del Bundle
Si realizas modificaciones en cualquiera de los módulos en `js/`, actualiza el bundle autónomo ejecutando:
```bash
node build.js
```
Esto genera automáticamente `js/notscrl.bundle.js` listo para producción y compatible tanto con protocolo HTTP como con apertura directa local `file:///`.

### Recorte de stickers con IA
El editor de stickers recorta el sujeto con **ISNet general-use** a 1024 px, ejecutado en el navegador con `onnxruntime-web` y el backend **WebGPU** (≈2,5 s por imagen una vez caliente). Si el navegador no expone WebGPU, cae a **silueta** (U²-Net podado, 320 px) sobre wasm (≈9 s). Nada sale del dispositivo: modelos y runtimes viven en `js/vendor/` (~250 MB en total).

Sobre la máscara del modelo se aplica una limpieza en `js/segmenter.js` para que un sticker sea un solo sujeto:

1. Se conserva solo el **componente conectado más grande** y se rellenan sus huecos.
2. Una **apertura morfológica** elimina ramas, tallos y cables finos pegados al sujeto.
3. Se descarta el fondo que sigue pegado: relleno desde el borde comparando cada píxel con el anterior y con una paleta de colores del borde, protegiendo el núcleo de la silueta.
4. Los restos que tocan el contorno se pelan por color y el polvo casi transparente se anula.

Las decisiones de limpieza se toman sobre una rejilla de 512 px y se aplican a la máscara completa de 1024, para conservar el detalle del pelo sin pagar el coste a resolución completa.

- Servido por `node server.js` (o cualquier HTTP): funciona el recorte automático.
- Abierto directamente como `file:///`: el navegador bloquea la lectura del modelo y el editor cae al recorte por bordes de siempre, con un aviso en pantalla.
- Descartados tras medir: u2net (168 MB, 2–3× más lento sin mejora), BiRefNet_lite (224 MB; WebGPU rechaza sus shaders por límite de buffers) y RMBG-1.4 (176 MB, licencia no comercial).




## 6. Revisión del estudio — 9 de noviembre de 2026

### Experiencia y diseño

Se añadió una pantalla de inicio editorial en tonos papel, oliva y terracota, con navegación entre Inicio, Proyectos y Plantillas. El editor mantiene un entorno oscuro para distinguir la interfaz del contenido. Las cuatro plantillas se muestran con miniaturas renderizadas a partir de sus objetos reales.

El flujo de creación permite elegir nombre, formato y cantidad de páginas. Cada proyecto tiene un identificador propio y una miniatura. Las plantillas crean proyectos separados; no sustituyen el trabajo actual. El proyecto activo de versiones anteriores se migra sin borrar su contenido.

El editor separa encabezado, formato, controles de vista, herramientas contextuales, lienzo, páginas y herramientas de creación. Las miniaturas navegan a la página elegida; las fotos y textos nuevos aparecen en la página visible. El panel Capas permite seleccionar objetos sin tocar directamente el lienzo. Los controles de texto ahora permiten editar también tipografía, tamaño, color y alineación.

### Correcciones de funcionamiento

- Los proyectos vacíos se recuperan sin volver a la plantilla inicial.
- La serialización excluye HTMLImageElement y guarda su fuente; esto evita errores DataCloneError en IndexedDB.
- El estado de guardado espera la confirmación de la transacción. El respaldo local se utiliza si la base de datos falla; al recuperar se elige el respaldo más reciente.
- El cambio de proyecto se bloquea si no se pudo conservar el anterior en la biblioteca.
- La restauración espera la decodificación de imágenes antes de renderizar. Los snapshots y las copias de objetos mantienen ajustes anidados independientes.
- Los controles continuos guardan un paso de historial al finalizar la interacción. Cambiar formato, mover con teclado y cambiar fondo también quedan registrados.
- El ajuste de página respeta tanto el ancho como el alto disponibles, conserva la página activa y el gesto de pellizco mantiene el punto de enfoque.
- La vista previa se reinicia en la primera página al abrirse. Los diálogos de recorte, encuadre, vista previa y exportación se mantienen dentro de la pantalla.
- Las miniaturas usan renders pequeños. El ZIP renderiza una página a resolución completa por vez y libera ese canvas antes de continuar, evitando reservar un panorama completo y todas las páginas simultáneamente.
- La exportación muestra progreso y errores recuperables, y las miniaturas respetan la proporción elegida.
- No se solicitan fuentes de Google: la interfaz y las tipografías funcionan con fuentes locales del sistema.

### Accesibilidad

Botones de galería y stickers operables con teclado, etiquetas para campos e iconos, foco visible, estados de selección, cierre con Escape, foco contenido en los paneles y retorno al control de origen. El fondo de los diálogos queda inerte. Se respeta prefers-reduced-motion y no se deshabilita el zoom del navegador.

### Validación

Se añadieron ocho pruebas automáticas en `tests/studio.test.cjs`. Se revisaron en navegador la creación y cambio de proyectos, recuperación tras recargar, texto, fotos de muestra, máscaras, encuadre, recorte, formatos, vista previa y exportación. Se descargó un ZIP real con tres PNG y se verificó su integridad y dimensiones 1080 × 1920.

Se revisó el diseño a 320 × 568, 390 × 844 y en escritorio. Estas comprobaciones no sustituyen una prueba de gestos en hardware móvil ni una prueba en Safari iOS.

### Límites actuales

El almacenamiento tiene la cuota que permite cada navegador; IndexedDB no es ilimitado. Borrar los datos del navegador elimina los proyectos. La biblioteca es local y no se sincroniza. El ZIP contiene imágenes finales, no un proyecto editable. No se añadió autenticación, sincronización ni infraestructura remota.


## 7. Pulido móvil y Borradores — 9 de noviembre de 2026

- El inicio pasa de una presentación con título grande e ilustración a un panel compacto de app: borradores recientes, galería horizontal de plantillas y creación accesible junto a la navegación inferior.
- La pestaña **Borradores** sustituye la etiqueta Proyectos. Muestra todos los trabajos, con miniatura, nombre, formato, páginas, fecha y contador. Los proyectos anteriores siguen disponibles; no se borran ni se reinicia la base de datos.
- Las herramientas contextuales quedan debajo del lienzo, cerca del pulgar, sin superponerse a la composición. Se priorizan Editar, Recortar, Encuadre, Forma, Duplicar y Borrar.
- Se añadió **Guardar borrador** al encabezado. La flecha de regreso guarda y abre Borradores; si el guardado falla, mantiene abierto el editor y explica el problema.
- Los cambios en campos y las acciones terminadas inician el guardado inmediatamente. Durante el arrastre se agrupan cambios y se guarda al terminar. Esto cubre el cierre de una pestaña que no dispara eventos de salida.
- El respaldo local se escribe antes del primer await. Si IndexedDB ya está listo, su transacción se inicia también sin esperar otra tarea. visibilitychange y pagehide solicitan un último guardado; nunca se guardan estados a medio restaurar.
- Una transacción anterior no puede mostrar Borrador guardado si hay cambios nuevos pendientes. Las miniaturas se actualizan antes de guardar manualmente o regresar a Borradores.
- Una visita nueva no crea un proyecto de ejemplo como si fuera un borrador del usuario. La biblioteca vacía incluye una acción para crear el primer carrusel.

Validación: 12 pruebas automáticas. En navegador se probó escribir texto y recargar inmediatamente sin guardar manualmente; después se añadió una foto, se cambió el nombre y se cerró y reabrió la pestaña. Se recuperaron nombre, texto, foto, formato 9:16 y cuatro páginas. Las pruebas de edición usan otro puerto/origen para mantener intactos los borradores del usuario.

El guardado sigue siendo local: un borrado de datos del navegador, almacenamiento privado o una terminación forzada del sistema no equivalen a un cierre normal. La app muestra un error si no puede conservar un borrador. Sigue pendiente validar en un teléfono físico y Safari iOS.

## 8. Escritorio, capas y ajustes - 12 de noviembre de 2026

### Inspector de propiedades

En pantallas de 1024 px o más, las propiedades y las capas viven en dos tarjetas de vidrio flotantes separadas a la derecha, con el mismo tratamiento que el resto del chrome. El panel se organiza en categorías plegables: **Posición y tamaño**, **Forma de recorte y marco**, **Alineación y ajuste de medidas** y **Ajustes visuales**. Todas empiezan minimizadas y abrir una cierra la anterior, de modo que el panel muestra solo el grupo que se está usando. El encabezado quedó reducido a la etiqueta PROPIEDADES; el tipo de elemento ya no se repite.

Las acciones que antes ocupaban la barra inferior del lienzo se trasladaron al inspector en una cuadrícula de cuatro botones: Recortar, Página completa, Duplicar y Eliminar. La barra inferior deja de mostrarse en escritorio y el lienzo gana esa altura. Recortar sigue disponible con doble clic y Eliminar con Supr o Backspace.

Los sliders muestran siempre su valor: borde redondeado en píxeles, opacidad en porcentaje, pincel y contorno de stickers en píxeles. El valor se actualiza al arrastrar y cuando el panel sincroniza una selección. El zoom de encuadre conserva su etiqueta propia.

### Capas

La categoría duplicada **Capas de profundidad** se eliminó. El panel **Capas** incorpora ahora una interfaz tipo Photoshop: miniatura, nombre, número de capa y un ojo para ocultar o mostrar. El orden se cambia arrastrando la fila con un indicador de inserción, o con los botones Subir/Bajar para el elemento seleccionado. La visibilidad se respeta en el lienzo y en la exportación PNG, ZIP y panorama. Las capas ocultas se atenúan en la lista y siguen siendo seleccionables.

En escritorio el panel queda fijado al pie del inspector, siempre visible, con scroll propio y un máximo de 40 % de la altura.

### Persistencia y otras correcciones

- Recargar la página mantiene abierto el proyecto activo. Se guarda en localStorage si el usuario estaba en el editor o en inicio; al arrancar se restaura esa vista. Entrar al editor y recargar reabre el mismo proyecto; volver a inicio y recargar mantiene inicio.
- El corazón de las máscaras se redibujó con dos lóbulos y muesca central, y usa el lado corto del marco para no deformarse en fotos anchas.
- «Ocupar 2 páginas» limita el alto a la página menos márgenes, recalcula el ancho según la proporción y centra el elemento en la costura y en la vertical, sin salirse por abajo.
- Las imágenes nuevas se crean con borde redondeado 0. Las plantillas conservan sus radios de diseño.
- El editor ocupa el ancho completo de la ventana. Se eliminó el límite de 1600 px que dejaba franjas laterales en monitores anchos.
- La barra superior no tiene contenedor visual: el botón de volver, el nombre y las acciones flotan directamente sobre el fondo. En escritorio ocupa las tres columnas, de modo que el botón de volver queda en el borde izquierdo y no después del riel.
- La tira de páginas reserva altura para las miniaturas de 60 px; antes el `max-height` recortaba su borde inferior y los botones parecían cortados.
- En escritorio, el nombre del panorama y el porcentaje de zoom comparten fila con las miniaturas, a los lados, sin una línea extra encima.
- El visor del lienzo tiene esquinas redondeadas (16 px en móvil, 22 px en escritorio) y recorta el contenido que llega a las esquinas al hacer zoom.
- El visor deja 10 px a cada lado en móvil y 12 px en escritorio para no chocar con el riel ni con las tarjetas laterales.
- La toolbar incluye una herramienta de mano (botón o tecla H) que alterna entre mover el lienzo y editar. Con la mano activa, arrastrar desplaza la vista sin seleccionar ni mover objetos, y el doble toque no cambia de vista.
- En escritorio, los paneles de Fotos, Texto, Stickers, Plantillas y Fondo abren como tarjeta flotante junto al riel izquierdo, centrada verticalmente y sin oscurecer el editor.
- El panel Texto permite escribir el contenido, elegir fuente, tamaño, color y alineación, activar negrita o cursiva e insertar emojis. Edita en vivo el texto seleccionado o crea uno nuevo con ese estilo. Incluye interlineado y espaciado entre letras; el selector marca «Personalizada» si un proyecto antiguo usa una fuente fuera de la lista.
- GIPHY queda configurado con la clave del proyecto en `GIPHY_API_KEY` (start.bat local y entorno de Easypanel); el cliente ya no exige pegar una clave. El nuevo segmento **Usados** lista, sin duplicados, los GIFs presentes en el proyecto y permite reinsertarlos; cada GIF guarda id, título y dimensiones para reconstruir la lista.
- Los GIFs se reproducen en el lienzo: al insertarlos o restaurarlos se decodifican sus fotogramas con `ImageDecoder` y el motor dibuja el frame correspondiente en cada render. Si el navegador no soporta `ImageDecoder`, el GIF queda en un contenedor oculto del DOM y se dibuja su frame animado.
- Se añadieron tipografías divertidas locales: Pixel (Press Start 2P), Bungee, Espacial (Russo One), Cómic y Manuscrita divertida. Los desplegables nativos usan esquema oscuro para que las opciones no aparezcan en blanco.
- La barra de acciones contextuales centra sus botones (`safe center`) y sigue siendo desplazable cuando no caben.
- El contenedor de esa barra ya no pinta su propio velo, así que las esquinas superiores redondeadas (20 px) y su borde se ven sobre el lienzo.
- Si el lienzo contiene vídeo o GIF, el diálogo de exportación añade un bloque de vídeo: duración (1–30 s), FPS (24/30/60), calidad (8, 20 o 50 Mbps sin compresión) y códec WebM VP9/VP8. Graba el panorama completo mientras los medios se reproducen; sin medios animados el bloque no aparece y se mantiene la exportación PNG.
- El acordeón y el inspector son accesibles con teclado: las categorías responden a Enter y Espacio y exponen aria-expanded.
- El texto hace salto de línea por palabras según el ancho del cuadro (y parte palabras más largas que el ancho). Al escribir o cambiar tipografía/tamaño, el alto del cuadro crece para que las líneas quepan.
- Exportar incluye **Copia de seguridad (.json)** y **Restaurar copia**. El archivo lleva el proyecto serializado y los originales en base64; al restaurar se guardan los originales con claves nuevas, se remapean los `originalKey` y se abre como un proyecto nuevo, sin tocar el actual.
- Rendimiento: el bucle de animación se detiene si la pestaña está oculta o el editor desactivado, dibuja como máximo a 30 fps y limita los frames de GIF a 480 px de lado. Al volver a la pestaña se reanuda.
- Cada tarjeta de Borradores tiene acciones de renombrar, duplicar y eliminar. Al borrar, se eliminan de IndexedDB solo los originales que ningún proyecto restante referencia; duplicar comparte los originales.
- El editor recuerda por proyecto el zoom, el desplazamiento y la vista página/panorama; se restauran al abrir si el ancho de ventana no cambió más de 240 px.
- El panel Texto añade interlineado y espaciado entre letras; el alto del cuadro se recalcula al cambiarlos. Las fuentes ajenas a la lista aparecen como «Personalizada» en el selector.

### Validación

`node build.js`, `node --check` y las 21 pruebas de `tests/studio.test.cjs` pasan. En navegador headless se comprobó: recarga en editor y en inicio, estado inicial del acordeón (cuatro categorías cerradas), exclusividad al abrir, ocultar capas, reordenación por arrastre y por Subir/Bajar, corazón en marcos cuadrados y anchos, «Ocupar 2 páginas» con una foto vertical en 793 × 1190 dentro de una página de 1080 × 1350, ajuste de línea de textos, exportación/importación de una copia con original, y el freno del bucle de animación con el editor desactivado.

### Límites actuales

El modelo grande `isnet.onnx` (170 MB) y el runtime WebGPU se mantienen fuera de Git por tamaño; el repositorio incluye `silueta.onnx` y el runtime wasm, suficiente para el recorte en cualquier navegador. El arrastre de capas es HTML5 y está pensado para ratón; en táctil se usan Subir/Bajar. El estado plegado del inspector no se guarda entre recargas y la selección vuelve vacía al recargar.
