# Puesta en marcha (aprox. 30 minutos, una sola vez)

La idea: los evaluadores abren la app y trabajan. Los datos se envían solos a UNA hoja central
cuando hay señal. Una persona descarga el Excel de esa hoja.

## Parte 1. Crear la hoja central

1. Usa una cuenta de Google **dedicada al proyecto** (idealmente creada por la empresa, no una cuenta personal).
2. Crea una hoja de cálculo nueva en Google Sheets. Llámala `Evaluaciones de campo`.
3. Menú **Extensiones > Apps Script**. Borra el contenido y pega todo el archivo `Code.gs`.
4. Cambia `CAMBIA_ESTA_CLAVE` por una clave tuya (letras y números, por ejemplo `plg-8472-kx`). Guarda.
5. Botón **Implementar > Nueva implementación**.
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
6. Autoriza los permisos que pida Google (aparece un aviso de "app no verificada": entra a *Avanzado* y continúa; es tu propio código).
7. Copia la **URL de la aplicación web** (termina en `/exec`).

## Parte 2. Conectar la app

1. Abre `index.html` con el Bloc de notas.
2. Al inicio del script, busca el bloque `SYNC` y completa:
   ```
   const SYNC = {
     url:   "https://script.google.com/macros/s/XXXX/exec",
     clave: "plg-8472-kx"
   };
   ```
3. Guarda y sube los archivos a tu hosting (GitHub Pages u otro con https), reemplazando los anteriores.

## Parte 3. Instalar en los celulares

1. Envía el enlace de la app por WhatsApp o como código QR.
2. En Chrome: **⋮ > Instalar aplicación** y aceptar el permiso de ubicación (con internet, una sola vez).
3. Desde ahí, todo se envía automáticamente al volver la señal. Arriba se ve cuántos registros faltan por enviar.

## Para quien descarga los datos

En la hoja central: **Archivo > Descargar > Microsoft Excel (.xlsx)** o **Valores separados por comas (.csv)**.
Cada registro tiene un ID único, así que no se duplican aunque el celular reintente.

## Para probarlo antes de salir a campo

1. Abre la app, llena 2 o 3 plantas y toca **Registros > Enviar ahora**.
2. Revisa que aparezcan las filas en la hoja `Registros`.
3. Prueba en modo avión: guarda un registro, apaga el modo avión y verifica que se envía solo.

## Importante

- Si cambias `Code.gs` después, hay que hacer **Implementar > Administrar implementaciones > Editar > Nueva versión**.
- La clave va dentro de la app; protege contra envíos casuales, no contra alguien que inspeccione el código. No guardes datos muy sensibles aquí.
- Si tu empresa exige que los datos no salgan a Google, avísame: la app puede enviar al mismo formato a otro destino (por ejemplo Power Automate con tu OneDrive).
