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
