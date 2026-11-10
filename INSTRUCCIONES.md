# Puesta en marcha — versión 6 (módulos, Agrícola y apariencia azul)

## Qué cambió respecto a la versión 5

- **Pantalla de inicio con módulos.** Fitosanidad, Riego, Fenología y Calidad (evaluación en campo) y, solo para el administrador,
  **Agrícola** y **Administración**. Cada evaluador ve únicamente los módulos en los que tiene carillas asignadas.
  Si solo tiene un módulo, la app lo abre directo.
- **Módulo Agrícola (administrador):** Programa de producción (lotes y válvulas), **Fundos**, **Unidades de negocio** y **Umbrales**.
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
