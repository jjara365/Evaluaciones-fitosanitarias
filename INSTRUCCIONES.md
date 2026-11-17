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
