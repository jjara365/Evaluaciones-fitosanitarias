# Versión 13 — qué cambió y cómo actualizar

**Actualizar (importante):**
1. Reemplaza en GitHub `index.html`, `sw.js` (y `manifest`/íconos si no cambian, no hace falta). Vuelve a pegar tu URL en `const SYNC={url:""}`.
2. En Apps Script reemplaza todo `Code.gs` y haz **Implementar → Administrar implementaciones → Editar → Nueva versión**.
3. Ejecuta una vez cualquier función (por ejemplo `cerrarCampanasDiario`) y **autoriza el acceso a Drive** (las fotos se guardan ahí). Sin este paso las fotos no suben.
4. Opcional: activador diario de tiempo para `cerrarCampanasDiario` (el sistema igual revisa solo una vez al día cuando alguien abre la app).

**Novedades**
- Teclado: la tecla de acción dice «siguiente» y pasa a la siguiente variable; en la última, «listo».
- Fotos: botón «Tomar foto» (hasta 3 por defecto; en el editor de cartillas se elige 0, 1, 3 o 5). Se comprimen y suben aparte de los datos, sin frenar. Hoja nueva **Fotos** con el enlace, el código de muestra y el usuario. Carpeta de Drive «Fotos evaluaciones…».
- Espaciado más compacto en las cartillas.
- Campaña vigente: solo se puede evaluar entre inicio y cierre de campaña (ambos días incluidos). El aviso sale bajo la válvula. Pasado el cierre, la válvula pasa a CERRADO al día siguiente. Si la fecha del lote está vacía no se valida. El servidor marca `alerta_campana` si llegara algo fuera de fecha (por ejemplo, evaluación hecha sin señal).
- Registros: tabla resumen (evaluaciones, muestras, lotes, válvulas, hectáreas, tiempo promedio, fotos, por cartilla) con botón «Compartir imagen» para mandar al supervisor, y «Ver recorrido».
- Eval. Axilas: el botón de abajo ahora es «Guardar brote N». Arriba, junto a «Planta · Rama · Brote», están «＋ Nueva rama (N)» y «＋ Nueva planta (N)». Estos dos NO guardan: si hay datos sin guardar en el brote actual, preguntan antes de descartarlos.
- Mapa de recorrido: dibujo SVG sin mapa de fondo (no gasta datos). El evaluador ve el suyo en Registros; el administrador, el de todos en Supervisión (periodo y cartilla a elegir, hasta 1 500 puntos).
- Código de muestra: `USUARIO-AAMMDD-NNN`, correlativo por usuario y día (funciona sin señal). En cartillas por capas todos los brotes de una planta comparten el código. Se conserva al corregir.
- Columnas nuevas en cada cartilla: `codigo_muestra`, `duracion_s`, `area_ha`, `n_fotos`, `alerta_campana`.

**Límites a tener en cuenta**
- El tiempo por evaluación se mide desde que se abre el formulario hasta guardar; mayores de 30 min no cuentan.
- Las fotos no se guardan en el borrador; los enlaces de Drive son privados salvo que compartas la carpeta.
- Si el mismo usuario evalúa desde dos celulares el mismo día, los correlativos pueden repetirse.
- Pruebas hechas con simulación (no en Sheet ni celular reales): hacer piloto con 2–3 evaluadores.

---

# Puesta en marcha — versión 12 (80 evaluadores y cartillas más flexibles)

## Qué trae la versión 12 (novedades sobre la 11)

### A. Refuerzos para 80 evaluadores
1. **Envíos escalonados.** Los envíos automáticos esperan entre 0 y 15 segundos al azar, así los celulares no llegan todos juntos. Si un envío falla, la app reintenta sola esperando cada vez más (15 s, 30 s, 1 min… hasta 5 min). **☁ Enviar ahora** sale al instante.
2. **Caché de configuración en el servidor.** El servidor guarda unos minutos una copia de plantillas, maestra, fundos, áreas y placas, y los 80 celulares leen esa copia en vez de leer las hojas. Cualquier cambio hecho **desde la app** la renueva sola. Si editas las hojas **a mano**, usa el menú **Evaluaciones > Forzar actualización en los celulares**.
3. **Hoja «Recepcion».** Los envíos de evaluaciones caen primero en la hoja `Recepcion` (rápido) y se pasan por lotes a la hoja de cada cartilla. Las reservas de combustible se siguen guardando al instante (por la regla de una reserva por placa y día).
   - **Instala el activador (recomendado, 1 minuto):** Apps Script > icono del reloj (Activadores) > **Añadir activador** > función `procesarRecepcionAuto` > evento: *controlado por tiempo* > *temporizador de minutos* > **cada minuto**. La primera vez pedirá autorizar.
   - **Si no lo instalas:** lo recibido pasa a las hojas en el siguiente envío de cualquiera (cuando lo más antiguo lleva más de 90 s), al abrir Supervisión, al descargar una cartilla por fechas, o con el menú **Evaluaciones > Procesar recepción ahora**. **Antes de bajar el Sheet para cargarlo a tu base, usa ese menú** para que no quede nada en `Recepcion`.
   - Si una fila de recepción no se puede leer, pasa a `Recepcion_errores`. Si falla la escritura, los registros se quedan en `Recepcion` y se reintentan; no se pierde nada.
   - Para volver a escribir directo en las hojas (como en la v11): Apps Script > Configuración del proyecto > Propiedades del script > agrega `RECEPCION` = `NO`.
4. **Prueba de carga (simulada).** 80 evaluadores enviando tandas de 20 registros contra una hoja de 5 000 filas: cada envío lee en promedio unas 1 900 celdas con recepción, frente a unas 11 500 con escritura directa; 0 registros perdidos y 0 duplicados, incluso cuando 40 evaluadores reenviaron su última tanda; y 80 sondeos de configuración sin cambios no leyeron ninguna hoja. Es una simulación de la lógica: **no mide la velocidad real de Google**, por eso conviene el piloto real.

### B. Más opciones al crear o editar cartillas (Agrícola > Plantillas)
1. **Cambiar el tipo de dato** de un campo que ya existe (pide confirmación). Lo ya guardado no se modifica; los registros nuevos usan el tipo nuevo. Ojo: si pasas de texto a número, los datos viejos de la columna siguen siendo texto.
2. **Encabezado de la cartilla:**
   - **Nivel:** hasta válvula (lote › turno › válvula), hasta turno, o **solo hasta lote**. A nivel de lote, el registro guarda turno y válvula vacíos y la app suma plantas y área de las válvulas del lote.
   - **Turno:** obligatorio, opcional o no pedirlo.
   - **Fecha editable:** por defecto hoy; se puede elegir una fecha pasada (con aviso en rojo), nunca futura.
   - **Semana de cultivo:** se calcula desde el **inicio de campaña** del lote (se asume que es la fecha de poda) y se guarda en la columna `semana_cultivo`.
3. **Capas de evaluación** (planta › rama › brote…): escribe una capa por línea, de la mayor a la menor (máximo 4), y asigna cada campo a su capa.
   - Cada capa puede tener **un contador** (N° de planta, N° de rama, N° de brote). Al marcarlo, empieza en 1.
   - Se guarda **una fila por la capa más profunda** (un brote = una fila) repitiendo en ella los datos de la planta y la rama. Así Power BI lo lee sin trabajo extra.
   - Botones al guardar: **siguiente brote** (planta y rama se conservan, brote +1, el resto vuelve a su valor por defecto), **siguiente rama** y **siguiente planta**. No hay máximo de ramas ni de brotes.
4. **Campos calculados:** suma, resta, multiplicación, división, porcentaje y promedio entre campos numéricos. Se toman **en el orden de la lista** (la pantalla del editor muestra la fórmula en palabras antes de guardar: «(A ÷ B) × 100»). El servidor repite la cuenta, así que el dato guardado no depende del celular.

### C. Nueva cartilla «Eval. Axilas» (módulo Fenología)
- Se crea sola una vez, con el servidor nuevo. Se puede editar o desactivar.
- Encabezado: fecha (editable), campaña, variedad, fundo, sub fundo, módulo, lote y válvula desde el programa; turno opcional; semana de cultivo automática.
- Datos generales: **Tipo de poda** (Normal, Adelanta, Traspaso, Siembra, Ensayo, Otro).
- Capa **Planta:** N° de planta (conteo, empieza en 1) y Categoría (Normal, Pequeña, Enferma).
- Capa **Rama:** N° de rama (conteo, empieza en 1).
- Capa **Brote:** N° de brote (empieza en 1); axilas vegetativo, veg. órganos, yemas, productivos y falso cargador (conteo, empiezan en 0) y **Total axilas** (suma automática de los 5).
- Hoja propia: `Fenología - Eval. Axilas`, una fila por brote.
- **Asígnala a los evaluadores** en Usuarios > Accesos.

### Para actualizar (versión 12)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia). La hoja `Plantillas` gana sola la columna «Configuración» y las cartillas anteriores quedan con encabezado completo hasta válvula, igual que antes.
2. Instala el **activador** de `procesarRecepcionAuto` (punto A.3).
3. Sube a GitHub `index.html` y `sw.js` (revisa tu URL `/exec` en `const SYNC`: el archivo viene vacío). Los celulares verán "Hay una nueva versión – Actualizar".
4. Haz un piloto real con 2 o 3 evaluadores antes de abrirlo a todos.

---

## (versión anterior)
# Puesta en marcha — versión 11 (umbrales por cultivo, descarga por fechas, cartilla de poda)

## Qué trae la versión 11 (novedades sobre la 10)

1. **Se quitó "Duplicar último registro"** (botón en evaluación, en reserva y tarjeta de Inicio).
2. **Reserva de combustible: filtrar placas.** Arriba de la lista de placas hay un selector **Filtrar por tipo de unidad** y un cuadro **Buscar placa o conductor** (no distingue mayúsculas, espacios ni guiones). Muestra cuántas placas quedan "(2 de 5)". Si ya elegiste una placa, no desaparece aunque cambies el filtro.
3. **Umbrales con CULTIVO.** La hoja `Umbrales` ahora tiene **Cultivo** como primera columna. El cultivo se elige de la maestra de Variedades. El mismo umbral puede repetirse en cultivos distintos. En la importación masiva, el formato también empieza con Cultivo.
   - Al actualizar, la hoja vieja se migra sola y queda una copia en `Umbrales_respaldo_v10`. Si en Variedades hay **un solo cultivo**, se asigna a los umbrales existentes; si hay varios, quedan **sin cultivo** y debes completarlos (Agrícola > Umbrales > editar).
4. **Descargar una cartilla por fechas (administrador).** Inicio > Supervisión > tarjeta "Descargar una cartilla por fechas": eliges la cartilla (incluye Reserva de combustible), desde, hasta, y si quieres incluir anulados. Baja un CSV directo del servidor (necesita internet y que los celulares ya hayan enviado). Por defecto no incluye los ANULADOS y avisa cuántos omitió. Máximo 20 000 registros por descarga.
5. **Nueva cartilla "Eval. de Poda"** en el módulo **Calidad**, con los datos de la imagen:
   - Datos generales (texto): Supervisor, Podador. Fecha, cultivo, campaña, sub fundo, módulo, lote y válvula salen del encabezado de la app.
   - 17 datos a evaluar, todos **numéricos enteros (mínimo 0) y obligatorios**: N° de ramas, < 6 mm, > 16 mm, lignificadas, herbáceas, cruzadas, con altura indicada, debajo / encima de la altura indicada, c/3 flujos, tirasavias, con daño por corte, con corte recto, con mal corte, Categoría, con altura de 30 a 35, con altura menor a 30.
   - Se crea sola **una vez** al abrir la app con el servidor nuevo. Es una plantilla normal: puedes editarla, ocultar campos o desactivarla en Plantillas, y no se vuelve a crear.
   - **Asígnala a los evaluadores** en Usuarios > Accesos (el administrador la ve sin asignar). Sus registros van a la hoja `Calidad - Eval. de Poda`.

### Para actualizar (versión 11)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia).
2. Sube a GitHub `index.html` y `sw.js` (revisa tu URL `/exec` en `const SYNC`: el archivo viene vacío). Los celulares verán "Hay una nueva versión – Actualizar".
3. Entra como administrador, abre Agrícola > Umbrales y completa el cultivo de los umbrales que queden sin cultivo.

---

## (versión anterior)
# Puesta en marcha — versión 10 (botones y control de calidad de la data)

## Qué trae la versión 10 (novedades sobre la 9)

1. **Cabecera siempre visible:** 🟢 En línea / 🔴 Sin señal, "3 sin enviar" (o "✔ Todo al día"), el botón **☁ Enviar ahora** (aparece cuando hay pendientes) y el chip de **📍 GPS** (toca para volver a buscar la ubicación).
2. **🔑 Cambiar mi clave y Salir** en la cabecera (y también en Ajustes > Mi cuenta). Pide la clave actual, necesita internet y después se puede entrar sin señal con la clave nueva. Un usuario solo cambia la suya.
3. **Duplicar último registro:** copia solo el encabezado (cartilla, fundo, lote, válvula; en reservas: sub fundo, área y combustible). Los valores quedan en blanco. También hay una tarjeta "Repetir último registro" en Inicio.
4. **Borradores:** lo que escribes en una evaluación o reserva se guarda solo en el celular (también al cerrar la app o si se acaba la batería). Al volver aparece "Tienes una evaluación a medias: Retomar / Descartar". Botón **💾 Borrador** para guardar a pedido.
5. **GPS:** además de las evaluaciones, las reservas guardan latitud, longitud y precisión (columnas nuevas en `Reservas_Combustible`). Si se guarda sin GPS, la app lo avisa.
6. **Aviso de nueva versión:** cuando subas una versión nueva a GitHub (cambia el número en `sw.js`, p. ej. evalcampo-v11), los celulares muestran "Hay una nueva versión – Actualizar". Los borradores se conservan.
7. **Corregir o anular registros** (Registros > botones en cada registro):
   - Sin enviar: Corregir lo edita en su lugar; Anular lo quita del celular.
   - Ya enviado: Corregir crea el nuevo registro (columna `corrige_a`) y el original queda **ANULADO**; Anular pide un motivo obligatorio.
   - **Las filas nunca se borran de la hoja:** quedan con `estado_registro = ANULADO`, `anulado_por`, `anulado_en` y `motivo_anulacion`. Un evaluador solo anula los suyos; el administrador, cualquiera.
   - **Para Power BI / SQL: filtra `estado_registro` distinto de "ANULADO".**
   - Una reserva anulada libera la regla "una reserva por placa y día".
8. **Supervisión** (solo administrador): mosaico nuevo en Inicio. Muestra registros por evaluador (último registro), por cartilla, anulados y evaluadores **sin actividad**, para hoy, ayer o 7 días.

### Para actualizar (versión 10)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia). Las hojas ganan solas las columnas nuevas al primer envío.
2. Sube a GitHub `index.html` y `sw.js` (revisa tu URL `/exec` en `const SYNC`). Los celulares verán el aviso de nueva versión.
3. Nota: cambiar la clave no cierra las sesiones ya abiertas en otros celulares del mismo usuario; si alguien sospecha que su clave se filtró, usa Administración > Usuarios para poner una clave nueva.

---

## (versión anterior)
# Puesta en marcha — versión 9 (fundo > sub fundo, áreas, una hoja por cartilla)

## Qué trae la versión 9 (novedades sobre la 8)

1. **Jerarquía Sede > Fundo > Sub fundo.** La **sede es la unidad de negocio** (se eliminó la pantalla y la hoja "Unidades de negocio"). En Agrícola > Fundos cada fila es un sub fundo dentro de su fundo
   (ej. fundo POM con sub fundos POM1 y POM2) y lleva su **centro de costo**. Un sub fundo solo puede pertenecer a un fundo, y un fundo a una sola sede.
2. **Placas:** el campo Fundo pasa a **Sub fundo** y se agrega **Área**. El centro de costo sale del sub fundo.
3. **Áreas** (Soporte > Áreas): lista nueva con las áreas de trabajo (Cosecha, Riego…). Si renombras un área, las placas la siguen.
4. **Reserva de combustible:** la fecha de abastecimiento **no puede ser anterior a hoy** (se valida en el celular y en el servidor); se elige **Sub fundo** (jala el centro de costo) y **Área**, que se puede cambiar
   aunque la placa tenga otra asignada. La hoja `Reservas_Combustible` trae las columnas `sub_fundo` y `area`.
5. **Desactivar cartillas:** en Administración > Plantillas cada cartilla tiene el botón **Desactivar / Activar**. Una cartilla inactiva deja de aparecer a los evaluadores; lo que ya registraron sigue llegando.
6. **Programa (maestra):** Cultivo, Variedad, Fundo y Sub fundo son **listas desplegables** que salen de las maestras de Variedades y de Fundos (la variedad depende del cultivo; el sub fundo, del fundo; el fundo, de la sede).
   El servidor también valida contra esas maestras (si ya hay datos cargados). **PEP = Fundo-Módulo-Lote** (con guion). En la hoja Maestra, Fundo va antes que Sub_Fundo.
7. **Una hoja por cartilla:** cada cartilla guarda en su propia hoja, llamada `<Módulo> - <nombre de la cartilla>` (por ejemplo `Riego - Humedad del suelo`), creada sola con el primer registro y con solo las columnas de esa cartilla.
   Si cambias el nombre de la cartilla en la app, su hoja cambia de nombre sola: **no renombres estas hojas a mano**.

### Para actualizar (versión 9)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia).
2. Al primer uso las hojas se convierten solas, y antes de hacerlo guardan una copia: `Maestra_respaldo_v8`, `Fundos_respaldo_v8`, `Placas_respaldo_v8`.
   - **Maestra:** se intercambian las columnas Sub_Fundo y Fundo y se recalcula el PEP con guion.
   - **Fundos:** se quita la unidad de negocio y queda la sede. Los fundos antiguos quedan con el nombre que tenían; si tu "Fundo" antiguo era en realidad un sub fundo (POM1), ajústalo en la pantalla Fundos.
   - **Placas:** se conserva el valor antiguo de Fundo como sub fundo solo si coincide con un sub fundo existente; el **Área queda vacía**.
   - **Registros ya enviados:** si el módulo tenía una sola cartilla, su hoja vieja pasa a ser la hoja de la cartilla (con sus datos). Si tenía varias, la hoja vieja se conserva como historial y las nuevas van a hojas separadas.
3. Sube a GitHub `index.html` y `sw.js`, y revisa tu URL `/exec` en `const SYNC`.
4. **Completa los datos, en este orden:** Fundos (sede, fundo, sub fundo, centro de costo) → Áreas → Placas (sub fundo y área de cada una). Las placas sin sub fundo o área no se pueden guardar ni aparecen bien en la reserva hasta completarlas.
   Al editar un programa antiguo, si su fundo o sub fundo no está en la maestra de Fundos, la app lo marca "(fuera de la maestra)" y el servidor te pedirá corregirlo.
5. Para Power BI / SQL: cada hoja de cartilla es una tabla con `id` único por registro, fechas en formato año-mes-día y columnas base iguales en todas las cartillas.

---

# Puesta en marcha — versión 8 (combustible con fundo, centro de costo y tipo de combustible)

## Qué trae la versión 8 (novedades sobre la 7)

- **Fundos con Centro de costo** (Agrícola > Fundos): campo nuevo. Si cambias el nombre o el centro de costo de un fundo, las placas de ese fundo se actualizan solas.
- **Maestra de placas ampliada** (Soporte > Placas): tipo de combustible (Gasolina regular / Gasolina 95 / Petróleo diesel 2), código SAP del combustible,
  fundo, centro de costo (se muestra según el fundo, no se escribe) y capacidad máxima en galones. Todos son obligatorios.
  Un mismo combustible tiene **un solo código SAP**: si cambias el código en una placa, se actualiza en todas las de ese combustible.
- **Reserva de combustible:** el kilometraje ahora es **opcional** (vehículos averiados); se elige el **fundo** (por defecto el de la placa) y se jala el **centro de costo**;
  se indica el **tipo de combustible** a abastecer (por defecto el de la placa); no se puede pedir más galones que la capacidad máxima de la placa.
- **Una placa no puede tener 2 reservas el mismo día de abastecimiento.** Se valida en el celular y también en el servidor (por si dos celulares la registran).
  Si el servidor rechaza una reserva, queda marcada como "rechazado" con el motivo, no cuenta como pendiente y no sale en el CSV; se elimina y se registra de nuevo si corresponde.
- Hoja `Reservas_Combustible` con columnas nuevas: fundo, centro_costo, tipo_combustible, cod_sap. Ícono de **arándano** para Calidad.

### Para actualizar (versión 8)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia). Las hojas `Fundos` y `Placas` se convierten solas al primer uso (columnas nuevas vacías).
2. Sube a GitHub `index.html` y `sw.js` (y el resto), y revisa tu URL `/exec` en `const SYNC` (el archivo viene con la URL vacía).
3. **Completa los datos:** primero el centro de costo de cada fundo (Agrícola > Fundos) y luego, en cada placa existente, combustible, código SAP, fundo y capacidad (Soporte > Placas).
   Hasta entonces no se pueden guardar cambios en esas placas, y los fundos sin centro de costo no aparecen para reservar.
4. Si cambias el encabezado de `Reservas_Combustible` en una hoja ya existente, Apps Script agrega las columnas nuevas al final; si prefieres el orden nuevo, renombra la hoja vieja y deja que se cree otra.

---

# Puesta en marcha — versión 7 (Soporte: reserva de combustible, placas y variedades)

## Qué trae la versión 7 (novedades sobre la 6)

- **Módulo Soporte — Reserva de combustible.** El usuario elige la **placa** y se completan el conductor (se puede cambiar) y el tipo de unidad.
  Luego indica kilometraje, fecha de abastecimiento y cantidad en galones. Funciona sin señal y se envía solo al volver internet.
  Avisa si el kilometraje es menor al último registrado de esa placa en ese celular, y si la reserva parece repetida.
- **Maestra de placas** (Soporte > Placas, solo administrador): placa, chofer, tipo de unidad y estado.
- **Maestra de variedades por cultivo** (Agrícola > Variedades): si un cultivo tiene variedades registradas, el programa de producción
  (formulario e importación) solo acepta esas, sin importar mayúsculas o tildes. Un cultivo sin variedades registradas acepta lo escrito.
- Hoja nueva **`Reservas_Combustible`** con sus propias columnas, y hojas `Placas` y `Variedades`.

### Cómo se da acceso a Soporte
La reserva de combustible aparece como una carilla más ("Soporte · Reserva de combustible") en **Administración > Usuarios**.
Márcala a quien deba reservar combustible. No necesita Sub fundos. El administrador ve Soporte siempre.

### Para actualizar (versión 7)
1. Pega el nuevo `Code.gs` en Apps Script y publica **Nueva versión** (la URL no cambia).
2. Sube a GitHub `index.html`, `sw.js`, `manifest.webmanifest` e íconos, y revisa tu URL `/exec` en `const SYNC` (el archivo viene con la URL vacía).
3. Primero crea las placas (Soporte > Placas) y luego asigna la carilla a los usuarios.

---

## Qué cambió en la versión 6 (respecto a la 5)

- **Pantalla de inicio con módulos.** Fitosanidad, Riego, Fenología y Calidad (evaluación en campo), **Soporte** y, solo para el administrador,
  **Agrícola** y **Administración**. Cada evaluador ve únicamente los módulos en los que tiene carillas asignadas.
  Si solo tiene un módulo, la app lo abre directo.
- **Módulo Agrícola (administrador):** Programa de producción (lotes y válvulas), **Fundos**, **Unidades de negocio**, **Variedades** y **Umbrales**.
- **Administración (administrador):** Usuarios y Plantillas. Cada plantilla pertenece a un módulo (se elige al crearla y ya no cambia).
- **Una hoja de registros por módulo** en tu Google Sheet: `Registros_Fitosanidad`, `Registros_Riego`, `Registros_Fenología`, `Registros_Calidad`.
  Cada una tiene sus propias columnas, listas para descargar como Excel/CSV.
- **Modo claro / oscuro:** botón ☀️/🌙 arriba, o en Ajustes (Automática, Clara u Oscura). Colores nuevos en azul oscuro.

## Parte 1. Actualizar la hoja central

1. Google Sheets > **Extensiones > Apps Script**. Borra TODO y pega el nuevo `Code.gs`. Guarda.
2. **Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.** La URL NO cambia.
3. Abre la app como administrador (con internet). Se convierte sola la hoja y no se pierde nada:
   - `Registros` pasa a llamarse **`Registros_Fitosanidad`** (con todos sus datos).
   - `Plantillas` recibe una columna "Módulo de evaluación" y todas las plantillas existentes quedan en Fitosanidad.
   - Aparecen las hojas nuevas `Fundos` y `Unidades de negocio`.
4. Administra todo desde la app, no escribiendo en las hojas. Si editas una hoja a mano, usa el menú
   **Evaluaciones > Forzar actualización en los celulares**.

## Parte 2. Subir la app a GitHub

Reemplaza en tu repositorio: `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png` e `icon-512.png`.
Revisa que `index.html` siga con tu URL `/exec` (busca `const SYNC`, cerca de la línea 400): este archivo viene con la URL vacía.
Espera 1–2 minutos. Después, en cada celular abre la app con internet; si sigue la versión anterior, cierra y abre la app dos veces
(o borra los datos del sitio en Chrome, si no tiene registros sin enviar).
El ícono de la app cambió de color; en un celular donde ya está instalada puede tardar en actualizarse o requerir reinstalar.

## Parte 3. Primer uso

1. **Agrícola > Unidades:** crea tus unidades de negocio.
2. **Agrícola > Fundos:** agrega cada fundo con su unidad, sede y sub fundo.
3. **Agrícola > Programa:** tu programa de producción (los nombres de sub fundo y fundo se sugieren desde la maestra de fundos).
4. **Administración > Plantillas:** crea las plantillas de cada módulo. Riego, Fenología y Calidad empiezan sin plantillas.
5. **Administración > Usuarios:** al evaluador le marcas sus Sub fundos y sus carillas. El módulo se le abre por tener carillas en él.

## Cosas a tener en cuenta

- El acceso a un módulo se da **por sus carillas (plantillas)**: no hay un permiso aparte por módulo.
- Fundos y Unidades de negocio **son catálogos**: por ahora sirven de referencia (sugerencias al escribir en el programa), pero no obligan ni validan el programa.
- Una unidad de negocio con fundos no se puede eliminar; si la renombras, sus fundos la siguen.
- Los registros hechos con la versión 5 y aún sin enviar llegan a Fitosanidad.
- Los umbrales siguen sin generar alertas en las evaluaciones.
- Las placas son un catálogo: si cambias el chofer de una placa, las reservas ya enviadas conservan el chofer de ese momento.
- La reserva de combustible no pasa por aprobación: queda registrada y se descarga como cualquier otro módulo.
