# Puesta en marcha — versión 5 (maestra nueva, usuarios con accesos y umbrales)

## Qué cambió respecto a la versión 4

- **Maestra (programa de producción)** con las 19 columnas, en este orden: Sede, Cultivo, Sub_Fundo, Fundo, Módulo, Lote, Turno,
  Válvula, Área, Plantas, Densidad, Variedad, Etapa, Inicio de campaña, Inicio de cosecha, Cierre de campaña, Campaña, PEP, Estado Campaña.
  - Sede: CARAZ, ICA, NEPEÑA, NAZCA o CASCAS. Etapa: M o I. Estado: ACTIVO o CERRADO.
  - **Densidad** (plantas ÷ área) y **PEP** (Fundo/Módulo/Lote) los calcula la app; no hace falta escribirlos.
- **Usuarios**: DNI (8 dígitos), nombre completo, rol, usuario abreviado, clave y estatus (ACTIVO/CERRADO).
  Cada evaluador solo ve los **Sub fundos** y las **carillas de evaluación (plantillas)** que el administrador le marque.
  El administrador tiene permiso para todo.
- **Umbrales** (pestaña nueva, solo administrador): Grupo (Benéficos, Plagas, Enfermedades), Variable, Ítem, Umbral (número),
  Órgano evaluado (Brote, Planta, Flores, Baya, Cobertura), Semana de cultivo (número) y Campaña. Se agregan uno a uno o se importan desde Excel/CSV.
- Cada registro guarda además: sede, cultivo, sub fundo, PEP, variedad, etapa y los días desde el inicio de campaña.

## Parte 1. Actualizar la hoja central

1. Abre tu hoja de Google Sheets > **Extensiones > Apps Script**. Borra TODO y pega el nuevo `Code.gs`. Guarda.
2. **Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.** La URL NO cambia.
3. Abre la app como administrador (con internet). **Al primer ingreso se convierten solas las hojas `Usuarios` y `Maestra`**
   y quedan copias de seguridad: `Usuarios_respaldo_v4` y `Maestra_respaldo_v4`.
4. Después de la conversión:
   - Todos los evaluadores quedan **sin accesos** hasta que entres a **Usuarios**, los edites y marques sus sub fundos y carillas.
   - Tu usuario conserva su clave; **edítalo y completa tu DNI**.
   - En la Maestra, la antigua fecha de poda pasó a **Inicio de campaña**; "ABIERTO" pasó a **ACTIVO**.
   - Las válvulas antiguas **no tienen Sede, Cultivo ni Sub fundo**: complétalas (editar o volver a importar con el nuevo formato).
     Mientras no tengan Sub fundo, los evaluadores no las verán.
5. Si la pestaña `Registros` solo tiene datos de prueba, bórrala; se crea sola con las columnas nuevas.
   Si tiene datos reales, déjala: las columnas nuevas se agregan al final.
6. Adminístralo todo desde la app, no escribiendo en las hojas. Si editas una hoja a mano, usa el menú
   **Evaluaciones > Forzar actualización en los celulares**.

## Parte 2. Subir la app a GitHub

Sube estos 7 archivos reemplazando los anteriores: `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`
(y guarda `Code.gs` e `INSTRUCCIONES.md` como respaldo). Si `index.html` ya no trae tu URL `/exec` en `const SYNC = { url: "" }`, vuelve a pegarla.
Espera 1–2 minutos. En cada celular, abre la app con internet: se actualiza sola (si no, cierra y abre la app dos veces).

## Parte 3. Primer uso (administrador)

1. **Maestra**: agrega válvulas con el formulario o importa Excel/CSV (botón "Descargar formato" trae las columnas en orden).
2. **Plantilla**: revisa o crea la carilla de evaluación.
3. **Usuarios**: crea a cada evaluador (DNI, nombre, rol, usuario, clave, estatus) y marca sus Sub fundos y carillas.
   Para quitar a alguien, ponlo en CERRADO (no se borra su historial).
4. **Umbrales**: cárgalos o impórtalos.
5. Al terminar una campaña, cierra lotes en Maestra (se pone la fecha de cierre).

## Cosas a tener en cuenta

- Si cambias los accesos de un evaluador, su celular lo recibe al reconectarse (como máximo en 1 minuto de uso con señal).
  Lo que ya registró sin señal **no se pierde**: llega marcado con `alerta_permiso = SI` en la hoja Registros para que lo revises.
- Los umbrales por ahora **solo se guardan y administran**; aún no generan alertas en las evaluaciones.
- Área se guarda como número (para poder calcular la densidad).
