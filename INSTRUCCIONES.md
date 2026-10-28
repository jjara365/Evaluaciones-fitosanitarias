# Puesta en marcha — versión 4 (maestra, plantilla y cierre de lotes)

## Qué cambió respecto a la versión 3

- El **administrador** carga la **tabla maestra** (campaña, fundo, módulo, lote, turno, válvula, área, plantas,
  fecha de poda, inicio de cosecha) y **cierra lotes** al terminar la campaña.
- El **administrador** crea la **plantilla** (los campos del formulario y su tipo de dato).
- El **evaluador** ya no escribe fundo ni lote: elige en listas encadenadas
  (campaña > fundo > módulo > lote > turno > válvula) y llena el formulario que definió la plantilla.

## Parte 1. Actualizar la hoja central

1. Abre tu hoja de Google Sheets.
2. **Extensiones > Apps Script**. Borra TODO el contenido y pega el nuevo `Code.gs`. Guarda.
3. **Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.**
   La URL NO cambia, así que no hay que tocar `index.html` si ya tenías la URL puesta.
4. Si ya habías hecho pruebas con la versión 3, **borra la pestaña `Registros`** (eran datos de prueba).
   Así la hoja nace con el orden de columnas nuevo. Se vuelve a crear sola al llegar el primer dato.
   **No borres la pestaña `Usuarios`.**
5. Aparecerán solas las pestañas `Maestra` y `Plantillas`.
   **Adminístralas desde la app, no escribiendo en la hoja**: la app valida duplicados, fechas y tipos.
   (Si igual editas la hoja a mano, usa el menú **Evaluaciones > Forzar actualización en los celulares**.)

## Parte 2. Subir la app

Reemplaza los 7 archivos en GitHub (Add file > Upload files, mismo nombre) y espera 1 o 2 minutos.
Los celulares se actualizan al abrir la app con internet. Si no cambia, ciérrala por completo y ábrela otra vez.

## Parte 3. Orden recomendado para configurar (como administrador, con internet)

1. **Pestaña Maestra.** Dos formas de cargarla:
   - **Importar desde Excel** (recomendado): toca *Descargar formato (CSV)*, llénalo en Excel, copia las filas
     con los títulos y pégalas en el cuadro (o sube el CSV) > *Revisar e importar*.
     Acepta fechas como 15/06/2026 o 2026-06-15, y área con coma o punto.
     La app te dice cuántas filas entraron y cuáles tienen error (con el número de fila de tu Excel).
     Si importas de nuevo una válvula que ya existe en esa campaña, se **actualiza** (no se duplica).
   - **Una por una:** formulario *Agregar válvula*. Al guardar, conserva campaña, fundo, módulo, lote y fechas
     para que cargues rápido las demás válvulas del mismo lote.
2. **Pestaña Plantilla.** Ya viene una plantilla inicial de plagas. Edítala o crea otra:
   - Cada campo tiene: nombre, **tipo de dato**, grupo (sección en pantalla), obligatorio, mínimo/máximo,
     valor por defecto, unidad, texto de ayuda y si **recuerda el valor** entre plantas.
   - Tipos disponibles: **Conteo** (botones + y −, desde 0), **Número entero**, **Número decimal**,
     **Texto**, **Lista de opciones**, **Sí / No** y **Fecha**.
   - Cada campo se vuelve **una columna** en el Excel. El nombre de la columna se crea solo a partir del nombre
     del campo (por ejemplo «Mosca blanca» > `mosca_blanca`) y **no cambia aunque luego renombres el campo**.
   - Un campo ya guardado **no se borra ni cambia de tipo**: desmarca *Visible* para dejar de usarlo.
     Así nunca se rompen los datos históricos.
   - Al guardar, la plantilla sube de versión y cada registro lleva la versión con que se hizo.
3. **Pestaña Usuarios.** Crea a los evaluadores y entrégales usuario y clave en persona.

## Cerrar lotes al terminar la campaña

Pestaña **Maestra** > sección **Lotes** > **Cerrar lote**. Pasa por Cerrados y puedes **Reabrir** si te equivocaste.
- Un lote cerrado desaparece de las listas de los evaluadores en cuanto su celular se actualice.
- Los datos ya registrados **no se tocan**.
- Si un evaluador tenía elegido el lote que cierras, la app le **avisa y deja la selección en blanco**
  (no lo cambia a otro lote en silencio).
- Un celular que estuvo sin señal y aún no se actualizó puede registrar un par de plantas en un lote que ya
  cerraste; esos datos igual llegan a la hoja (no se pierden) y los puedes filtrar por fecha.

## Cómo se actualizan los celulares

La maestra y la plantilla se descargan solas al ingresar, al volver la señal y al abrir la app
(como máximo cada 1 minuto). En *Ajustes > Actualizar configuración ahora* se fuerza.
Sin señal se usa la última configuración descargada.

## Qué verá cada evaluador al guardar una planta

- La app calcula sola los **días desde la poda** y la guarda en cada registro.
- Valida según el tipo: obligatorios, números enteros o decimales, mínimo y máximo.
- Avisa si repite la misma planta de la misma válvula el mismo día, o si el número de planta supera las plantas
  de la válvula, o si algún conteo pasa de 100 (cuando el campo no tiene un máximo propio).
- Recuerda por válvula cuál era la siguiente planta.

## Para probar antes de salir a campo

1. Como administrador: importa 3 o 4 válvulas, revisa la plantilla y crea un usuario evaluador de prueba.
2. Ingresa como ese evaluador en otro celular (con internet). Debe ver las listas encadenadas y el formulario.
3. Guarda 2 o 3 plantas > *Registros > Enviar ahora* > revisa la hoja `Registros`.
4. Cierra el lote desde la cuenta de administrador y actualiza el celular del evaluador: el lote debe desaparecer.
5. Prueba sin señal: ingresa en modo avión, guarda una planta, vuelve la señal y verifica que se envía sola.

## Límites a tener presentes

- Formato numérico de pantalla: punto decimal (estilo Perú).
- Si dos válvulas se llaman igual dentro del mismo turno, lote, módulo, fundo y campaña, la app las trata como la
  misma. Usa nombres únicos por válvula.
- La clave de cada usuario viaja por https y la valida el servidor; la entrada sin señal solo protege contra
  uso casual del celular.
- La hoja de Google tiene un límite de 10 millones de celdas: con decenas de miles de registros conviene
  descargar y archivar por campaña.
