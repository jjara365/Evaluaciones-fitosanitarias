/**
 * RECEPTOR CENTRAL de evaluaciones de campo (versión 12: cartillas por capas, recepción de envíos, caché de configuración).
 * Se pega en Google Sheets: Extensiones > Apps Script.
 *
 * Hojas que maneja (se crean solas):
 *   - "Usuarios":   DNI, nombre, rol, usuario, clave cifrada, estatus y accesos (sub fundos y plantillas)
 *   - "Maestra":    programa de producción (sede, cultivo, sub fundo, fundo, módulo, lote, turno, válvula...)
 *   - "Umbrales":   maestra de umbrales (cultivo, grupo, variable, ítem, umbral, órgano, semana de cultivo, campaña)
 *   - "Plantillas": formularios de evaluación definidos por el administrador (cada uno pertenece a un módulo)
 *   - "Fundos" (sede, fundo, sub fundo, centro de costo) y "Variedades": catálogos del módulo Agrícola
 *   - "Placas" y "Áreas": catálogos del módulo Soporte
 *   - "Reservas_Combustible": reservas de combustible enviadas desde los celulares
 *   - Una hoja por cartilla de evaluación, llamada "<Módulo> - <nombre de la cartilla>" (se crea sola con el primer registro).
 *     Si cambias el nombre de la cartilla en la app, su hoja cambia de nombre sola: no renombres estas hojas a mano.
 *
 * Roles: "admin" (todos los permisos) y "evaluador" (solo los sub fundos y plantillas que se le asignen).
 * IMPORTANTE: administra Usuarios, Maestra, Umbrales y Plantillas desde la app, no editando las hojas a mano.
 *
 * Si vienes de la versión 4, las hojas Usuarios y Maestra se convierten solas al nuevo formato
 * la primera vez que se usa esta versión (queda una copia de respaldo de cada una).
 */

const HOJA_VIEJA = "Registros";   // hasta la versión 5 todo iba aquí; pasa a ser la hoja de Fitosanidad
const HOJA_USR  = "Usuarios";
const HOJA_MAE  = "Maestra";
const HOJA_PLA  = "Plantillas";
const HOJA_UMB  = "Umbrales";
const HOJA_ARE  = "Áreas";
const HOJA_FUN  = "Fundos";
const HOJA_VAR  = "Variedades";
const HOJA_PLC  = "Placas";

// Módulo Soporte: la "Reserva de combustible" es una carilla fija del sistema (no se edita en Plantillas).
// El administrador la asigna a los usuarios igual que cualquier plantilla.
const COMB_ID = "combustible";
const COMB_BASE = ["id","fecha_registro","hora","usuario","registrado_por","placa","conductor","tipo_unidad","sub_fundo","area","centro_costo",
                   "tipo_combustible","cod_sap","km","fecha_abastecimiento","galones","observaciones","alerta_permiso","enviado_por","recibido",
                   "latitud","longitud","precision_m","estado_registro","corrige_a","anulado_por","anulado_en","motivo_anulacion"];
const COMB_TEXTO = ["placa","conductor","tipo_unidad","sub_fundo","area","centro_costo","tipo_combustible","cod_sap"];   // siempre como texto (ceros a la izquierda)
const PLA_COMBUSTIBLE = { id: COMB_ID, nombre: "Reserva de combustible", version: 1, activa: true, campos: [], mod_eval: "soporte", fija: true };

// Módulos de evaluación (el módulo "Agrícola" es de administración y no recibe registros)
const MODULOS = [
  { id: "fitosanidad", nombre: "Fitosanidad", hoja: "Registros_Fitosanidad" },
  { id: "riego",       nombre: "Riego",       hoja: "Registros_Riego" },
  { id: "fenologia",   nombre: "Fenología",   hoja: "Registros_Fenología" },
  { id: "calidad",     nombre: "Calidad",     hoja: "Registros_Calidad" },
  { id: "soporte",     nombre: "Soporte",     hoja: "Reservas_Combustible", base: COMB_BASE, texto: ["A:C", "F:M", "O:O"], fija: true }
];
function modulo_(id) {
  const n = normTxt_(id);
  for (let i = 0; i < MODULOS.length; i++) if (normTxt_(MODULOS[i].id) === n || normTxt_(MODULOS[i].nombre) === n) return MODULOS[i];
  return null;
}

// Catálogos del módulo Agrícola
const FUN_HEAD = ["Sede","Fundo","Sub_Fundo","Centro de costo","Estado","id"];
const ARE_HEAD = ["Área","Estado","id"];
const VAR_HEAD = ["Cultivo","Variedad","Estado","id"];
const PLC_HEAD = ["Placa","Chofer","Tipo de unidad","Tipo de combustible","Cód. SAP combustible","Sub Fundo","Área","Centro de costo","Capacidad máx. (gal)","Estado","id"];
const COMBUSTIBLES = ["Gasolina regular", "Gasolina 95", "Petróleo diesel 2"];


// Columnas fijas de Registros. Los campos de la plantilla se agregan solos a la derecha.
const BASE = ["id","fecha","hora","usuario","evaluador","plantilla","version_plantilla","campana",
              "sede","cultivo","fundo","sub_fundo","modulo","lote","turno","valvula","pep","variedad","etapa",
              "planta","dias_desde_inicio_campana","semana_cultivo","latitud","longitud","precision_m","total_conteos",
              "observaciones","alerta_permiso","enviado_por","recibido",
              "estado_registro","corrige_a","anulado_por","anulado_en","motivo_anulacion"];
const RESERVADAS = BASE.concat(["maestra_id","plantilla_id"]);

// Usuarios: DNI, nombre completo, rol, usuario abreviado, clave (salt+hash), estatus, accesos
const USR_COLS = ["DNI","Nombre completo","Rol","Usuario","salt","hash","Estatus","Sub fundos","Plantillas","Creado"];
const ESTATUS  = ["ACTIVO","CERRADO"];

// Maestra (programa de producción): este es el orden de las columnas; "id" va al final (uso interno de la app)
const MAE_HEAD = ["Sede","Cultivo","Fundo","Sub_Fundo","Módulo","Lote","Turno","Válvula","Área","Plantas","Densidad",
                  "Variedad","Etapa","Inicio de campaña","Inicio de cosecha","Cierre de campaña","Campaña","PEP",
                  "Estado Campaña","id"];
const MAE_KEYS = ["sede","cultivo","fundo","sub_fundo","modulo","lote","turno","valvula","area","plantas","densidad",
                  "variedad","etapa","inicio_campana","inicio_cosecha","cierre_campana","campana","pep",
                  "estado","id"];
const SEDES   = ["CARAZ","ICA","NEPEÑA","NAZCA","CASCAS"];
const ETAPAS  = ["M","I"];
const ESTADOS = ["ACTIVO","CERRADO"];

// Umbrales
const UMB_HEAD = ["Cultivo","Grupo","Variable","Ítem","Umbral","Órgano evaluado","Semana de cultivo","Campaña","id"];
const GRUPOS   = ["Benéficos","Plagas","Enfermedades"];
const ORGANOS  = ["Brote","Planta","Flores","Baya","Cobertura"];

// Plantillas
let _VAR = null;   // variedades leídas en esta ejecución
const PLA_COLS = ["id","nombre","version","activa","campos","actualizado","Módulo de evaluación","Configuración"];
const PLA_COL_MOD = 7, PLA_COL_CFG = 8;      // la columna de configuración (encabezado, capas…) se agregó en la versión 12
const TIPOS = ["conteo","entero","decimal","texto","lista","si_no","fecha","calculado"];
const OPS_FORMULA = ["suma","resta","producto","division","porcentaje","promedio"];
const HOJA_REC = "Recepcion";

const DIAS_TOKEN  = 30;     // la sesión se renueva sola cada vez que el celular envía datos
const MAX_FALLOS  = 5;      // intentos fallidos antes de bloquear
const BLOQUEO_SEG = 600;    // 10 minutos
const ITERACIONES = 500;    // rondas de cifrado de la clave
const MIN_CLAVE   = 6;

/* ============================ MENÚ DE LA HOJA ============================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Evaluaciones")
    .addItem("Crear administrador", "crearAdministrador")
    .addItem("Forzar actualización en los celulares", "forzarActualizacion")
    .addItem("Procesar recepción ahora", "procesarRecepcionAhora")
    .addToUi();
}

// Úsalo si cambiaste algo directamente en las hojas (Maestra, Usuarios, Plantillas, Umbrales).
function forzarActualizacion() {
  subirVersion_();
  SpreadsheetApp.getUi().alert("Listo. Los celulares descargarán los cambios la próxima vez que se conecten.");
}

// Se usa UNA vez, para crear la primera cuenta de administrador.
function crearAdministrador() {
  const ui = SpreadsheetApp.getUi();
  const pedir = (texto) => {
    const r = ui.prompt(texto);
    return r.getSelectedButton() === ui.Button.OK ? r.getResponseText() : null;
  };
  const dni = pedir("DNI (8 dígitos)");
  if (dni === null) return;
  const usuario = pedir("Usuario abreviado (minúsculas, sin espacios, ej. jhony)");
  if (usuario === null) return;
  const nombre = pedir("Nombre completo");
  if (nombre === null) return;
  const clave = pedir("Clave (mínimo " + MIN_CLAVE + " caracteres)");
  if (clave === null) return;
  const res = usuarioGuardar_({ dni: dni, usuario: usuario, nombre: nombre, rol: "admin", clave: clave, estatus: "ACTIVO" }, null);
  ui.alert(res.ok ? "Administrador creado. Ya puedes ingresar a la app." : res.error);
}

/* ============================ ENTRADA ============================ */

function doGet() {
  return salida({ ok: true, mensaje: "Receptor activo" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);                       // evita choques si varios envían a la vez
  try {
    const d = JSON.parse(e.postData.contents);
    _VAR = null;

    if (d.accion === "login") return salida(login_(d));

    const us = autenticar_(d.token);
    if (!us) return salida({ ok: false, error: "sesion" });

    switch (d.accion) {
      case "sync":
        return salida(sync_(d, us));
      case "config_obtener":
        return salida(configObtener_(d, us));
      case "clave_cambiar":
        return salida(claveCambiar_(d, us));
      case "usuario_listar":
      case "usuario_guardar":
      case "usuario_estado":
      case "maestra_guardar":
      case "maestra_importar":
      case "lote_estado":
      case "plantilla_guardar":
      case "umbral_guardar":
      case "umbral_importar":
      case "umbral_eliminar":
      case "area_guardar":
      case "area_eliminar":
      case "plantilla_estado":
      case "fundo_guardar":
      case "fundo_eliminar":
      case "variedad_guardar":
      case "variedad_eliminar":
      case "placa_guardar":
      case "placa_eliminar":
      case "supervision":
      case "exportar":
        if (us.rol !== "admin") return salida({ ok: false, error: "No tienes permiso para esta acción" });
        return salida(accionAdmin_(d, us));
      default:
        return salida({ ok: false, error: "acción desconocida" });
    }
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================ UTILIDADES ============================ */

function limpiar_(s) {
  return String(s === undefined || s === null ? "" : s).replace(/\s+/g, " ").trim();
}
// Texto sin tildes ni mayúsculas, para comparar ("NEPEÑA" = "nepena", "Benéficos" = "beneficos")
function normTxt_(s) {
  return String(s === undefined || s === null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
// Devuelve el valor oficial de la lista, "" si viene vacío, o null si no está en la lista.
function canon_(v, lista) {
  const n = normTxt_(v);
  if (!n) return "";
  for (let i = 0; i < lista.length; i++) if (normTxt_(lista[i]) === n) return lista[i];
  return null;
}
function numTxt_(v) {
  return String(v === undefined || v === null ? "" : v).replace(/\s/g, "").replace(",", ".");
}
function fallo_(msg) { return { ok: false, error: msg }; }
function tz_() { return Session.getScriptTimeZone(); }
function hoy_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd"); }
function fechaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), "yyyy-MM-dd");
  return limpiar_(v);
}
function fechaValida_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
// Las hojas nuevas tienen 1000 filas y 26 columnas: hay que ampliarlas antes de escribir más allá.
function asegurarTamano_(sh, filas, cols) {
  if (sh.getMaxRows() < filas) sh.insertRowsAfter(sh.getMaxRows(), filas - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}
function versionCfg_() {
  return Number(PropertiesService.getScriptProperties().getProperty("CFG_VERSION") || 1);
}
function subirVersion_() {
  const v = versionCfg_() + 1;
  PropertiesService.getScriptProperties().setProperty("CFG_VERSION", String(v));
  return v;
}
function listaTexto_(v) {
  const a = Array.isArray(v) ? v : [];
  const out = [];
  a.forEach(x => { const s = limpiar_(x); if (s && out.indexOf(s) < 0) out.push(s); });
  return out;
}
function listaJson_(v) {
  try { const a = JSON.parse(String(v || "[]")); return Array.isArray(a) ? a.map(String) : []; }
  catch (e) { return []; }
}
function respaldo_(sh, nombre) {
  try {
    const copia = sh.copyTo(SpreadsheetApp.getActiveSpreadsheet());
    copia.setName(nombre);
  } catch (e) { /* si ya existe un respaldo con ese nombre, se sigue igual */ }
}

/* ============================ CIFRADO Y TOKENS ============================ */

function secreto_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty("SECRETO");
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty("SECRETO", s);
  }
  return s;
}

function hex_(bytes) {
  return bytes.map(b => ("0" + (b & 255).toString(16)).slice(-2)).join("");
}

function hashClave_(clave, salt) {
  let h = salt + clave;
  for (let i = 0; i < ITERACIONES; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function firmar_(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secreto_()));
}

function crearToken_(usuario, rol) {
  const cuerpo = Utilities.base64EncodeWebSafe(
    JSON.stringify({ u: usuario, r: rol, exp: Date.now() + DIAS_TOKEN * 86400000 }));
  return cuerpo + "." + firmar_(cuerpo);
}

function leerToken_(token) {
  if (!token || String(token).indexOf(".") < 0) return null;
  const partes = String(token).split(".");
  if (firmar_(partes[0]) !== partes[1]) return null;
  try {
    const d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString());
    return d.exp > Date.now() ? d : null;
  } catch (e) {
    return null;
  }
}

// Devuelve el usuario si el token es válido Y la cuenta sigue ACTIVA (se consulta la hoja cada vez,
// así un cambio de rol, de estatus o de accesos rige de inmediato en el servidor).
function autenticar_(token) {
  const t = leerToken_(token);
  if (!t) return null;
  const us = usuariosAuth_().find(x => x.usuario === t.u);
  return us && us.activo ? us : null;
}

/* ============================ USUARIOS ============================ */

function formatoUsuarios_(sh) {
  sh.getRange("A:F").setNumberFormat("@");    // texto: el DNI no pierde ceros y las claves cifradas no se vuelven números
  sh.getRange(1, 1, 1, USR_COLS.length).setValues([USR_COLS]).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function hojaUsuarios_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_USR);
  if (!sh) {
    sh = ss.insertSheet(HOJA_USR);
    formatoUsuarios_(sh);
    return sh;
  }
  // Formato de la versión 4: la primera columna era "usuario"
  if (normTxt_(sh.getRange(1, 1, 1, 1).getValues()[0][0]) === "usuario") migrarUsuarios_(sh);
  return sh;
}

function migrarUsuarios_(sh) {
  const n = sh.getLastRow();
  const viejos = n > 1 ? sh.getRange(2, 1, n - 1, 7).getValues() : [];
  respaldo_(sh, "Usuarios_respaldo_v4");
  sh.clear();
  formatoUsuarios_(sh);
  const filas = viejos.filter(f => String(f[0]) !== "").map(f => [
    "", String(f[1]), String(f[2]), String(f[0]).trim().toLowerCase(), String(f[3]), String(f[4]),
    String(f[5]).trim().toUpperCase() === "SI" ? "ACTIVO" : "CERRADO", "[]", "[]", f[6]
  ]);
  if (filas.length) {
    asegurarTamano_(sh, filas.length + 1, USR_COLS.length);
    sh.getRange(2, 1, filas.length, USR_COLS.length).setValues(filas);
  }
  subirVersion_();     // los celulares deben volver a descargar su configuración
}

function usuarios_() {
  const sh = hojaUsuarios_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, USR_COLS.length).getValues()
    .map((f, i) => ({
      fila: i + 2,
      dni: String(f[0]).trim(),
      nombre: String(f[1]),
      rol: String(f[2]),
      usuario: String(f[3]).trim().toLowerCase(),
      salt: String(f[4]),
      hash: String(f[5]),
      estatus: String(f[6]).trim().toUpperCase() === "ACTIVO" ? "ACTIVO" : "CERRADO",
      subfundos: listaJson_(f[7]),
      plantillas: listaJson_(f[8]),
      creado: f[9]
    }))
    .filter(x => x.usuario !== "")
    .map(x => { x.activo = x.estatus === "ACTIVO"; return x; });
}

// Crea o actualiza un usuario. Si el usuario ya existe, la clave en blanco significa "no cambiar".
function usuarioGuardar_(d, admin) {
  const usuario = String(d.usuario || "").trim().toLowerCase();
  const dni = String(d.dni || "").replace(/\s/g, "");
  const nombre = limpiar_(d.nombre);
  const rol = String(d.rol || "");
  const estatus = canon_(String(d.estatus || "").trim() === "" ? "ACTIVO" : d.estatus, ESTATUS);
  const clave = String(d.clave || "");

  const lista = usuarios_();
  const previo = lista.find(x => x.usuario === usuario) || null;

  if (!previo && !/^[a-z0-9._-]{3,30}$/.test(usuario)) return fallo_("Usuario no válido: usa 3 a 30 letras minúsculas, números, punto, guion o guion bajo");
  if (!/^\d{8}$/.test(dni)) return fallo_("El DNI debe tener 8 dígitos");
  if (!nombre) return fallo_("Falta el nombre completo");
  if (rol !== "admin" && rol !== "evaluador") return fallo_("Rol no válido");
  if (!estatus) return fallo_("Estatus no válido (usa ACTIVO o CERRADO)");
  if (!previo && clave.length < MIN_CLAVE) return fallo_("La clave debe tener al menos " + MIN_CLAVE + " caracteres");
  if (previo && clave && clave.length < MIN_CLAVE) return fallo_("La clave debe tener al menos " + MIN_CLAVE + " caracteres");
  if (lista.some(x => x.dni === dni && x.usuario !== usuario)) return fallo_("Ese DNI ya está registrado con otro usuario");
  if (admin && previo && previo.usuario === admin.usuario) {
    if (rol !== "admin") return fallo_("No puedes quitarte a ti mismo el rol de administrador");
    if (estatus !== "ACTIVO") return fallo_("No puedes cerrar tu propia cuenta");
  }

  // El administrador tiene todos los permisos: no necesita accesos asignados
  const subfundos = rol === "admin" ? [] : listaTexto_(d.subfundos);
  const plantillas = rol === "admin" ? [] : listaTexto_(d.plantillas);

  const sh = hojaUsuarios_();
  const salt = clave ? Utilities.getUuid().replace(/-/g, "") : (previo ? previo.salt : "");
  const hash = clave ? hashClave_(clave, salt) : (previo ? previo.hash : "");
  const fila = [dni, nombre, rol, usuario, salt, hash, estatus, JSON.stringify(subfundos), JSON.stringify(plantillas),
                previo ? previo.creado : new Date()];
  if (previo) {
    sh.getRange(previo.fila, 1, 1, USR_COLS.length).setValues([fila]);
    if (clave) CacheService.getScriptCache().remove("fallos_" + usuario);
  } else {
    asegurarTamano_(sh, sh.getLastRow() + 1, USR_COLS.length);
    sh.appendRow(fila);
  }
  return { ok: true, version: subirVersion_() };
}

function login_(d) {
  const u = String(d.usuario || "").trim().toLowerCase();
  const clave = String(d.clave || "");
  const cache = CacheService.getScriptCache();
  const kf = "fallos_" + u;
  if (Number(cache.get(kf) || 0) >= MAX_FALLOS) return { ok: false, error: "bloqueado" };

  const us = usuarios_().find(x => x.usuario === u);
  if (!us || !us.activo || !us.hash || hashClave_(clave, us.salt) !== us.hash) {
    cache.put(kf, String(Number(cache.get(kf) || 0) + 1), BLOQUEO_SEG);
    return { ok: false, error: "credenciales" };
  }
  cache.remove(kf);
  return { ok: true, usuario: us.usuario, nombre: us.nombre, rol: us.rol, token: crearToken_(us.usuario, us.rol) };
}

// Cambio de clave por el propio usuario (necesita su clave actual). Los intentos fallidos cuentan para el bloqueo.
function claveCambiar_(d, us) {
  us = usuarios_().find(x => x.usuario === us.usuario) || us;      // la copia de autenticar_ no trae la clave cifrada: se lee fresca
  const actual = String(d.clave_actual || ""), nueva = String(d.clave_nueva || "");
  const cache = CacheService.getScriptCache();
  const kf = "fallos_" + us.usuario;
  if (Number(cache.get(kf) || 0) >= MAX_FALLOS) return fallo_("Demasiados intentos. Espera 10 minutos.");
  if (!us.hash || hashClave_(actual, us.salt) !== us.hash) {
    cache.put(kf, String(Number(cache.get(kf) || 0) + 1), BLOQUEO_SEG);
    return fallo_("La clave actual no es correcta");
  }
  if (nueva.length < MIN_CLAVE) return fallo_("La clave nueva debe tener al menos " + MIN_CLAVE + " caracteres");
  if (nueva === actual) return fallo_("La clave nueva debe ser distinta de la actual");
  cache.remove(kf);
  const salt = Utilities.getUuid().replace(/-/g, "");
  hojaUsuarios_().getRange(us.fila, 5, 1, 2).setValues([[salt, hashClave_(nueva, salt)]]);
  return { ok: true, token: crearToken_(us.usuario, us.rol) };
}

/* ============================ MAESTRA (PROGRAMA DE PRODUCCIÓN) ============================ */

function formatoMaestra_(sh) {
  sh.getRange("A:H").setNumberFormat("@");      // sede...válvula como texto (un lote "001" no pierde sus ceros)
  sh.getRange("L:T").setNumberFormat("@");      // variedad...id como texto; las fechas quedan AAAA-MM-DD
  sh.getRange(1, 1, 1, MAE_HEAD.length).setValues([MAE_HEAD]).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function hojaMaestra_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_MAE);
  if (!sh) {
    sh = ss.insertSheet(HOJA_MAE);
    formatoMaestra_(sh);
    return sh;
  }
  // Formato de la versión 4: la primera columna era "id"
  if (normTxt_(sh.getRange(1, 1, 1, 1).getValues()[0][0]) === "id") migrarMaestra_(sh);
  // Hasta la versión 8 Sub_Fundo iba antes que Fundo y el PEP se unía con "/"
  else if (String(sh.getRange(1, 3, 1, 1).getValues()[0][0]) === "Sub_Fundo") migrarMaestraV9_(sh);
  return sh;
}
function migrarMaestraV9_(sh) {
  const n = sh.getLastRow();
  const filas = n > 1 ? sh.getRange(2, 1, n - 1, MAE_HEAD.length).getValues() : [];
  respaldo_(sh, "Maestra_respaldo_v8");
  sh.getRange(1, 1, 1, MAE_HEAD.length).setValues([MAE_HEAD]).setFontWeight("bold");
  if (filas.length) {
    sh.getRange(2, 1, filas.length, MAE_HEAD.length).setValues(filas.map(f => {
      const g = f.slice();
      g[2] = f[3]; g[3] = f[2];                                            // intercambia Sub_Fundo y Fundo (cada dato conserva su campo)
      if (String(f[19]) !== "") g[17] = [g[2], g[4], g[5]].map(limpiar_).join("-");   // PEP = Fundo-Módulo-Lote
      return g;
    }));
  }
  subirVersion_();
}

// v4: id, campana, fundo, modulo, lote, turno, valvula, area_ha, plantas, fecha_poda, inicio_cosecha, estado, fecha_cierre
function migrarMaestra_(sh) {
  const n = sh.getLastRow();
  const viejas = n > 1 ? sh.getRange(2, 1, n - 1, 13).getValues() : [];
  respaldo_(sh, "Maestra_respaldo_v4");
  sh.clear();
  formatoMaestra_(sh);
  const num = v => (v === "" || v === undefined || v === null) ? "" : Number(v);
  const filas = viejas.filter(f => String(f[0]) !== "").map(f => {
    const o = {
      sede: "", cultivo: "", sub_fundo: "",
      fundo: limpiar_(f[2]), modulo: limpiar_(f[3]), lote: limpiar_(f[4]), turno: limpiar_(f[5]), valvula: limpiar_(f[6]),
      area: num(f[7]), plantas: num(f[8]), variedad: "", etapa: "",
      inicio_campana: fechaTxt_(f[9]),            // la fecha de poda pasa a "Inicio de campaña"
      inicio_cosecha: fechaTxt_(f[10]), cierre_campana: fechaTxt_(f[12]),
      campana: limpiar_(f[1]),
      estado: String(f[11]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO",
      id: String(f[0])
    };
    completarCalculados_(o);
    return MAE_KEYS.map(k => o[k] === undefined ? "" : o[k]);
  });
  if (filas.length) {
    asegurarTamano_(sh, filas.length + 1, MAE_KEYS.length);
    sh.getRange(2, 1, filas.length, MAE_KEYS.length).setValues(filas);
  }
  subirVersion_();     // los celulares deben volver a descargar su configuración
}

// Densidad = plantas entre área; PEP = Fundo-Módulo-Lote
function completarCalculados_(o) {
  o.densidad = (o.area !== "" && o.area > 0 && o.plantas !== "") ? Math.round(o.plantas / o.area * 100) / 100 : "";
  o.pep = [o.fundo, o.modulo, o.lote].join("-");
  return o;
}

function claveFila_(o) {
  return [o.campana, o.fundo, o.modulo, o.lote, o.turno, o.valvula].map(x => limpiar_(x).toLowerCase()).join("|");
}
function claveLote_(o) {
  return [o.campana, o.fundo, o.modulo, o.lote].map(x => limpiar_(x).toLowerCase()).join("|");
}

function maestra_() {
  const sh = hojaMaestra_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  const num = v => (v === "" || v === undefined || v === null) ? "" : Number(v);
  return sh.getRange(2, 1, n - 1, MAE_KEYS.length).getValues()
    .filter(f => String(f[19]) !== "")
    .map(f => ({
      sede: limpiar_(f[0]), cultivo: limpiar_(f[1]), fundo: limpiar_(f[2]), sub_fundo: limpiar_(f[3]),
      modulo: limpiar_(f[4]), lote: limpiar_(f[5]), turno: limpiar_(f[6]), valvula: limpiar_(f[7]),
      area: num(f[8]), plantas: num(f[9]), densidad: num(f[10]),
      variedad: limpiar_(f[11]), etapa: limpiar_(f[12]),
      inicio_campana: fechaTxt_(f[13]), inicio_cosecha: fechaTxt_(f[14]), cierre_campana: fechaTxt_(f[15]),
      campana: limpiar_(f[16]), pep: limpiar_(f[17]),
      estado: String(f[18]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO",
      id: String(f[19])
    }));
}

function maestraEscribir_(lista) {
  const sh = hojaMaestra_();
  asegurarTamano_(sh, lista.length + 1, MAE_KEYS.length);
  const m = lista.map(o => MAE_KEYS.map(k => o[k] === undefined ? "" : o[k]));
  if (m.length) sh.getRange(2, 1, m.length, MAE_KEYS.length).setValues(m);
}

function validarFila_(o, previo) {
  const f = {};
  const sede = canon_(o.sede, SEDES);
  if (sede === null) return { error: "Sede no válida (usa: " + SEDES.join(", ") + ")" };
  f.sede = sede;
  ["cultivo", "sub_fundo", "fundo", "modulo", "lote", "turno", "valvula", "variedad", "campana"]
    .forEach(k => { f[k] = limpiar_(o[k]); });
  const req = { sede: "sede", cultivo: "cultivo", sub_fundo: "sub fundo", fundo: "fundo", modulo: "módulo",
                lote: "lote", turno: "turno", valvula: "válvula", campana: "campaña" };
  const falta = Object.keys(req).filter(k => !f[k]).map(k => req[k]);
  if (falta.length) return { error: "Falta: " + falta.join(", ") };

  const area = numTxt_(o.area);
  f.area = area === "" ? "" : Number(area);
  if (f.area !== "" && (isNaN(f.area) || f.area < 0)) return { error: "Área no válida" };
  const pl = numTxt_(o.plantas);
  f.plantas = pl === "" ? "" : Number(pl);
  if (f.plantas !== "" && (isNaN(f.plantas) || f.plantas < 0 || Math.floor(f.plantas) !== f.plantas)) return { error: "Plantas debe ser un número entero" };

  // Fundo y sub fundo deben existir en la maestra de Fundos (si ya hay fundos cargados), con la sede que les corresponde
  const catF = fundos_();
  if (catF.length) {
    const rf = catF.find(x => normTxt_(x.fundo) === normTxt_(f.fundo) && normTxt_(x.sub_fundo) === normTxt_(f.sub_fundo));
    if (!rf) return { error: "El fundo «" + f.fundo + "» con sub fundo «" + f.sub_fundo + "» no existe en la maestra de Fundos" };
    if (rf.sede !== f.sede) return { error: "El sub fundo " + rf.sub_fundo + " pertenece a la sede " + rf.sede };
    f.fundo = rf.fundo; f.sub_fundo = rf.sub_fundo;
  }
  // Cultivo y variedad deben existir en la maestra de Variedades (si ya hay variedades cargadas)
  const catV = variedades_();
  if (catV.length) {
    const rc = catV.find(x => normTxt_(x.cultivo) === normTxt_(f.cultivo));
    if (!rc) return { error: "El cultivo «" + f.cultivo + "» no existe en la maestra de Variedades" };
    f.cultivo = rc.cultivo;
  }
  const vc = variedadCanon_(f.cultivo, f.variedad);
  if (!vc.ok) return { error: vc.error };
  f.variedad = vc.valor;

  const etapa = canon_(o.etapa, ETAPAS);
  if (etapa === null) return { error: "Etapa no válida (usa M o I)" };
  f.etapa = etapa;

  const fechas = { inicio_campana: "Inicio de campaña", inicio_cosecha: "Inicio de cosecha", cierre_campana: "Cierre de campaña" };
  for (const k of Object.keys(fechas)) {
    f[k] = fechaTxt_(o[k]);
    if (f[k] && !fechaValida_(f[k])) return { error: fechas[k] + " no válida (usa AAAA-MM-DD)" };
  }
  if (f.inicio_campana && f.inicio_cosecha && f.inicio_cosecha < f.inicio_campana) return { error: "El inicio de cosecha no puede ser antes del inicio de campaña" };
  if (f.inicio_campana && f.cierre_campana && f.cierre_campana < f.inicio_campana) return { error: "El cierre de campaña no puede ser antes del inicio" };

  const vacio = o.estado === undefined || o.estado === null || String(o.estado).trim() === "";
  const est = canon_(vacio ? (previo ? previo.estado : "ACTIVO") : o.estado, ESTADOS);
  if (!est) return { error: "Estado de campaña no válido (usa ACTIVO o CERRADO)" };
  f.estado = est;
  if (est === "CERRADO" && !f.cierre_campana) f.cierre_campana = hoy_();

  completarCalculados_(f);
  return { fila: f };
}

function maestraGuardar_(o) {
  o = o || {};
  const lista = maestra_();
  const previo = o.id ? (lista.find(x => x.id === String(o.id)) || null) : null;
  if (o.id && !previo) return fallo_("La fila ya no existe");
  const v = validarFila_(o, previo);
  if (v.error) return fallo_(v.error);
  const f = v.fila, k = claveFila_(f);
  if (lista.some(x => (!previo || x.id !== previo.id) && claveFila_(x) === k)) return fallo_("Ya existe esa válvula en esa campaña");
  if (previo) {
    f.id = previo.id;
    lista[lista.findIndex(x => x.id === previo.id)] = f;
  } else {
    f.id = Utilities.getUuid();
    lista.push(f);
  }
  maestraEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}

function maestraImportar_(filas) {
  const lista = maestra_();
  const idx = {};
  lista.forEach((x, i) => idx[claveFila_(x)] = i);
  let nuevos = 0, actualizados = 0;
  const errores = [];
  (filas || []).forEach((o, n) => {
    const i0 = idx[claveFila_(o)];
    const v = validarFila_(o, i0 === undefined ? null : lista[i0]);
    if (v.error) { errores.push({ n: o._n || n + 1, error: v.error }); return; }
    const f = v.fila, k = claveFila_(f);
    if (k in idx) {
      f.id = lista[idx[k]].id;
      lista[idx[k]] = f; actualizados++;
    } else {
      f.id = Utilities.getUuid();
      idx[k] = lista.length; lista.push(f); nuevos++;
    }
  });
  if (nuevos || actualizados) maestraEscribir_(lista);
  return { ok: true, nuevos: nuevos, actualizados: actualizados, errores: errores,
           version: (nuevos || actualizados) ? subirVersion_() : versionCfg_() };
}

// Cierra o reabre TODAS las válvulas de un lote (dentro de una campaña).
function loteEstado_(d) {
  const estado = canon_(d.estado, ESTADOS);
  if (!estado) return fallo_("Estado no válido");
  const k = claveLote_(d);
  const lista = maestra_();
  let n = 0;
  lista.forEach(x => {
    if (claveLote_(x) === k) {
      x.estado = estado;
      if (estado === "CERRADO") { if (!x.cierre_campana) x.cierre_campana = hoy_(); }
      else x.cierre_campana = "";
      n++;
    }
  });
  if (!n) return fallo_("Lote no encontrado");
  maestraEscribir_(lista);
  return { ok: true, filas: n, version: subirVersion_() };
}

/* ============================ UMBRALES ============================ */

function formatoUmbrales_(sh) {
  sh.getRange("A:D").setNumberFormat("@");
  sh.getRange("F:F").setNumberFormat("@");
  sh.getRange("H:I").setNumberFormat("@");
  sh.getRange(1, 1, 1, UMB_HEAD.length).setValues([UMB_HEAD]).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function hojaUmbrales_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_UMB);
  if (!sh) {
    sh = ss.insertSheet(HOJA_UMB);
    formatoUmbrales_(sh);
  } else if (String(sh.getRange(1, 1, 1, 1).getValues()[0][0]) === "Grupo") {
    migrarUmbralesV11_(sh);
  }
  return sh;
}

// Hasta la versión 10 la hoja no tenía la columna Cultivo (la primera era Grupo).
// Se guarda una copia de respaldo. Si la maestra de Variedades tiene un solo cultivo, se asigna a los umbrales existentes;
// si tiene varios (o ninguno), quedan en blanco y el administrador los completa al editarlos.
function migrarUmbralesV11_(sh) {
  const n = sh.getLastRow();
  const viejas = n > 1 ? sh.getRange(2, 1, n - 1, 8).getValues().filter(f => String(f[7]) !== "") : [];
  const cult = [...new Set(variedades_().map(x => x.cultivo).filter(Boolean))];
  const unico = cult.length === 1 ? cult[0] : "";
  respaldo_(sh, "Umbrales_respaldo_v10");
  const nuevas = viejas.map(f => [unico, f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]]);
  sh.clear();
  formatoUmbrales_(sh);
  asegurarTamano_(sh, Math.max(nuevas.length + 1, 2), UMB_HEAD.length);
  if (nuevas.length) sh.getRange(2, 1, nuevas.length, UMB_HEAD.length).setValues(nuevas);
  subirVersion_();
}

function umbrales_() {
  const sh = hojaUmbrales_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, UMB_HEAD.length).getValues()
    .filter(f => String(f[8]) !== "")
    .map(f => ({
      cultivo: limpiar_(f[0]), grupo: limpiar_(f[1]), variable: limpiar_(f[2]), item: limpiar_(f[3]),
      umbral: f[4] === "" ? "" : Number(f[4]), organo: limpiar_(f[5]),
      semana: f[6] === "" ? "" : Number(f[6]), campana: limpiar_(f[7]), id: String(f[8])
    }));
}

function umbralesEscribir_(lista) {
  const sh = hojaUmbrales_();
  const previas = Math.max(sh.getLastRow() - 1, 0);
  asegurarTamano_(sh, Math.max(lista.length, previas) + 1, UMB_HEAD.length);
  const m = lista.map(o => [o.cultivo, o.grupo, o.variable, o.item, o.umbral, o.organo, o.semana, o.campana, o.id]);
  // si hay menos filas que antes (se eliminó alguna), se limpian las que sobran
  for (let i = lista.length; i < previas; i++) m.push(["", "", "", "", "", "", "", "", ""]);
  if (m.length) sh.getRange(2, 1, m.length, UMB_HEAD.length).setValues(m);
}

function claveUmb_(o) {
  return [o.cultivo, o.grupo, o.variable, o.item, o.organo, o.semana, o.campana].map(x => limpiar_(x).toLowerCase()).join("|");
}

function validarUmbral_(o) {
  const grupo = canon_(o.grupo, GRUPOS);
  if (grupo === null) return { error: "Grupo no válido (usa: " + GRUPOS.join(", ") + ")" };
  const organo = canon_(o.organo, ORGANOS);
  if (organo === null) return { error: "Órgano evaluado no válido (usa: " + ORGANOS.join(", ") + ")" };
  const f = { cultivo: limpiar_(o.cultivo), grupo: grupo, variable: limpiar_(o.variable), item: limpiar_(o.item), organo: organo, campana: limpiar_(o.campana) };
  const um = numTxt_(o.umbral), se = numTxt_(o.semana);
  const falta = [];
  if (!f.cultivo) falta.push("cultivo");
  if (!f.grupo) falta.push("grupo");
  if (!f.variable) falta.push("variable");
  if (!f.item) falta.push("ítem");
  if (um === "") falta.push("umbral");
  if (!f.organo) falta.push("órgano evaluado");
  if (se === "") falta.push("semana de cultivo");
  if (!f.campana) falta.push("campaña");
  if (falta.length) return { error: "Falta: " + falta.join(", ") };
  // el cultivo debe existir en la maestra de Variedades (si ya hay variedades cargadas)
  const catV = variedades_();
  if (catV.length) {
    const rc = catV.find(x => normTxt_(x.cultivo) === normTxt_(f.cultivo));
    if (!rc) return { error: "El cultivo «" + f.cultivo + "» no existe en la maestra de Variedades" };
    f.cultivo = rc.cultivo;
  }
  f.umbral = Number(um);
  if (isNaN(f.umbral) || f.umbral < 0) return { error: "Umbral no válido (debe ser un número desde 0)" };
  f.semana = Number(se);
  if (isNaN(f.semana) || Math.floor(f.semana) !== f.semana || f.semana < 0 || f.semana > 100) return { error: "Semana de cultivo no válida (entero entre 0 y 100)" };
  return { fila: f };
}

function umbralGuardar_(o) {
  o = o || {};
  const lista = umbrales_();
  const previo = o.id ? (lista.find(x => x.id === String(o.id)) || null) : null;
  if (o.id && !previo) return fallo_("El umbral ya no existe");
  const v = validarUmbral_(o);
  if (v.error) return fallo_(v.error);
  const f = v.fila, k = claveUmb_(f);
  if (lista.some(x => (!previo || x.id !== previo.id) && claveUmb_(x) === k)) return fallo_("Ya existe un umbral igual (mismo cultivo, grupo, variable, ítem, órgano, semana y campaña)");
  if (previo) { f.id = previo.id; lista[lista.findIndex(x => x.id === previo.id)] = f; }
  else { f.id = Utilities.getUuid(); lista.push(f); }
  umbralesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}

function umbralImportar_(filas) {
  const lista = umbrales_();
  const idx = {};
  lista.forEach((x, i) => idx[claveUmb_(x)] = i);
  let nuevos = 0, actualizados = 0;
  const errores = [];
  (filas || []).forEach((o, n) => {
    const v = validarUmbral_(o);
    if (v.error) { errores.push({ n: o._n || n + 1, error: v.error }); return; }
    const f = v.fila, k = claveUmb_(f);
    if (k in idx) { f.id = lista[idx[k]].id; lista[idx[k]] = f; actualizados++; }
    else { f.id = Utilities.getUuid(); idx[k] = lista.length; lista.push(f); nuevos++; }
  });
  if (nuevos || actualizados) umbralesEscribir_(lista);
  return { ok: true, nuevos: nuevos, actualizados: actualizados, errores: errores,
           version: (nuevos || actualizados) ? subirVersion_() : versionCfg_() };
}

function umbralEliminar_(id) {
  const lista = umbrales_();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("El umbral ya no existe");
  lista.splice(i, 1);
  umbralesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}


/* ============================ CATÁLOGOS DEL MÓDULO AGRÍCOLA ============================ */

function hojaCat_(nombre, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange("A:" + String.fromCharCode(64 + head.length)).setNumberFormat("@");
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
function catLeer_(nombre, head) {
  const sh = hojaCat_(nombre, head);
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, head.length).getValues().filter(f => String(f[head.length - 1]) !== "");
}
function catEscribir_(nombre, head, matriz) {
  const sh = hojaCat_(nombre, head);
  const previas = Math.max(sh.getLastRow() - 1, 0);
  asegurarTamano_(sh, Math.max(matriz.length, previas) + 1, head.length);
  const vacia = head.map(() => "");
  const m = matriz.slice();
  for (let i = matriz.length; i < previas; i++) m.push(vacia);
  if (m.length) sh.getRange(2, 1, m.length, head.length).setValues(m);
}

function migrarFundos_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_FUN);
  if (!sh) return;
  const h0 = String(sh.getRange(1, 1, 1, 1).getValues()[0][0]);
  if (h0 !== "Unidad de negocio") return;                  // formato anterior (v8): unidad de negocio, sede, sub fundo, fundo, centro de costo
  const n = sh.getLastRow();
  const k = String(sh.getRange(1, 5, 1, 1).getValues()[0][0]) === "Estado" ? 0 : 1;   // v7 no tenía centro de costo
  const viejas = n > 1 ? sh.getRange(2, 1, n - 1, 7).getValues() : [];
  const nuevas = viejas.map(f => k ? [f[1], f[3], f[2], f[4], f[5], f[6]] : [f[1], f[3], f[2], "", f[4], f[5]]).filter(f => String(f[5]) !== "");
  respaldo_(sh, "Fundos_respaldo_v8");
  sh.clear();
  sh.getRange("A:F").setNumberFormat("@");
  asegurarTamano_(sh, Math.max(nuevas.length + 1, 2), FUN_HEAD.length);
  sh.getRange(1, 1, 1, FUN_HEAD.length).setValues([FUN_HEAD]).setFontWeight("bold");
  if (nuevas.length) sh.getRange(2, 1, nuevas.length, FUN_HEAD.length).setValues(nuevas);
  subirVersion_();
}
function fundos_() {
  migrarFundos_();
  return catLeer_(HOJA_FUN, FUN_HEAD).map(f => ({
    sede: limpiar_(f[0]), fundo: limpiar_(f[1]), sub_fundo: limpiar_(f[2]), centro_costo: limpiar_(f[3]),
    estado: String(f[4]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[5]) }));
}
function fundosEscribir_(l) { catEscribir_(HOJA_FUN, FUN_HEAD, l.map(x => [x.sede, x.fundo, x.sub_fundo, x.centro_costo || "", x.estado, x.id])); }

// Jerarquía: sede > fundo > sub fundo (cada fila es un sub fundo). El centro de costo es del sub fundo.
function fundoGuardar_(f) {
  f = f || {};
  const lista = fundos_();
  const previo = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previo) return fallo_("El fundo ya no existe");
  const sede = canon_(f.sede, SEDES);
  if (sede === null) return fallo_("Sede no válida (usa: " + SEDES.join(", ") + ")");
  const estado = canon_(f.estado || "ACTIVO", ESTADOS);
  if (!estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  const o = { sede: sede, fundo: limpiar_(f.fundo), sub_fundo: limpiar_(f.sub_fundo), centro_costo: limpiar_(f.centro_costo), estado: estado };
  const falta = [];
  if (!o.sede) falta.push("sede");
  if (!o.fundo) falta.push("fundo");
  if (!o.sub_fundo) falta.push("sub fundo");
  if (falta.length) return fallo_("Falta: " + falta.join(", "));
  if (o.centro_costo && !/^[A-Za-z0-9._\-\/]{1,20}$/.test(o.centro_costo)) return fallo_("Centro de costo no válido (letras, números, guion o punto; máximo 20)");
  const otras = lista.filter(x => !previo || x.id !== previo.id);
  const mismo = otras.find(x => normTxt_(x.sub_fundo) === normTxt_(o.sub_fundo));
  if (mismo) return fallo_(normTxt_(mismo.fundo) === normTxt_(o.fundo) && mismo.sede === o.sede ? "Ya existe ese sub fundo en ese fundo" : "El sub fundo " + mismo.sub_fundo + " ya pertenece al fundo " + mismo.fundo + " (" + mismo.sede + ")");
  // un mismo fundo pertenece a una sola sede
  const otraSede = otras.find(x => normTxt_(x.fundo) === normTxt_(o.fundo) && x.sede !== o.sede);
  if (otraSede) return fallo_("El fundo " + otraSede.fundo + " ya está en la sede " + otraSede.sede);
  if (previo) { o.id = previo.id; lista[lista.findIndex(x => x.id === previo.id)] = o; }
  else { o.id = Utilities.getUuid(); lista.push(o); }
  fundosEscribir_(lista);
  // las placas de este sub fundo siguen su nombre y su centro de costo
  if (previo && (previo.sub_fundo !== o.sub_fundo || previo.centro_costo !== o.centro_costo)) {
    const pl = placas_(true);
    let cambio = false;
    pl.forEach(x => { if (x.sub_fundo === previo.sub_fundo) { x.sub_fundo = o.sub_fundo; x.centro_costo = o.centro_costo; cambio = true; } });
    if (cambio) placasEscribir_(pl);
  }
  return { ok: true, version: subirVersion_() };
}
function fundoEliminar_(id) {
  const lista = fundos_();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("El fundo ya no existe");
  if (placas_(true).some(p => p.sub_fundo === lista[i].sub_fundo))
    return fallo_("Hay placas asignadas a este sub fundo: cámbialas primero");
  lista.splice(i, 1);
  fundosEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}

/* ---------- Áreas (módulo Soporte) ---------- */
function areas_() {
  return catLeer_(HOJA_ARE, ARE_HEAD).map(f => ({
    nombre: limpiar_(f[0]), estado: String(f[1]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[2]) }));
}
function areasEscribir_(l) { catEscribir_(HOJA_ARE, ARE_HEAD, l.map(x => [x.nombre, x.estado, x.id])); }
function areaGuardar_(f) {
  f = f || {};
  const lista = areas_();
  const previa = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previa) return fallo_("El área ya no existe");
  const nombre = limpiar_(f.nombre);
  if (!nombre) return fallo_("Falta: área");
  const estado = canon_(f.estado || "ACTIVO", ESTADOS);
  if (!estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  if (lista.some(x => (!previa || x.id !== previa.id) && normTxt_(x.nombre) === normTxt_(nombre))) return fallo_("Ya existe esa área");
  if (previa) {
    lista[lista.findIndex(x => x.id === previa.id)] = { nombre: nombre, estado: estado, id: previa.id };
    if (previa.nombre !== nombre) {          // las placas siguen al área si se le cambia el nombre
      const pl = placas_(true);
      let cambio = false;
      pl.forEach(x => { if (x.area === previa.nombre) { x.area = nombre; cambio = true; } });
      if (cambio) placasEscribir_(pl);
    }
  } else lista.push({ nombre: nombre, estado: estado, id: Utilities.getUuid() });
  areasEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}
function areaEliminar_(id) {
  const lista = areas_();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("El área ya no existe");
  if (placas_(true).some(p => p.area === lista[i].nombre)) return fallo_("Hay placas en esta área: cámbialas primero");
  lista.splice(i, 1);
  areasEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}


/* ---------- Variedades por cultivo (módulo Agrícola) ---------- */
function variedades_() {
  if (_VAR) return _VAR;
  _VAR = catLeer_(HOJA_VAR, VAR_HEAD).map(f => ({
    cultivo: limpiar_(f[0]), variedad: limpiar_(f[1]),
    estado: String(f[2]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[3]) }));
  return _VAR;
}
function variedadesEscribir_(l) { _VAR = null; catEscribir_(HOJA_VAR, VAR_HEAD, l.map(x => [x.cultivo, x.variedad, x.estado, x.id])); }
function variedadGuardar_(f) {
  f = f || {};
  const lista = variedades_().slice();
  const previa = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previa) return fallo_("La variedad ya no existe");
  const o = { cultivo: limpiar_(f.cultivo), variedad: limpiar_(f.variedad), estado: canon_(f.estado || "ACTIVO", ESTADOS) };
  if (!o.cultivo) return fallo_("Falta: cultivo");
  if (!o.variedad) return fallo_("Falta: variedad");
  if (!o.estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  const k = x => normTxt_(x.cultivo) + "|" + normTxt_(x.variedad);
  if (lista.some(x => (!previa || x.id !== previa.id) && k(x) === k(o))) return fallo_("Ya existe esa variedad en ese cultivo");
  // un mismo cultivo se escribe siempre igual: se toma la escritura de la variedad ya registrada
  const mismo = lista.find(x => normTxt_(x.cultivo) === normTxt_(o.cultivo) && (!previa || x.id !== previa.id));
  if (mismo) o.cultivo = mismo.cultivo;
  if (previa) { o.id = previa.id; lista[lista.findIndex(x => x.id === previa.id)] = o; }
  else { o.id = Utilities.getUuid(); lista.push(o); }
  variedadesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}
function variedadEliminar_(id) {
  const lista = variedades_().slice();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("La variedad ya no existe");
  lista.splice(i, 1);
  variedadesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}
// Si el cultivo tiene variedades en la maestra, la variedad del programa debe ser una de ellas (sin importar tildes ni mayúsculas).
// Si el cultivo no tiene variedades registradas, se acepta lo escrito.
function variedadCanon_(cultivo, variedad) {
  const v = limpiar_(variedad);
  if (!v) return { ok: true, valor: "" };
  const del = variedades_().filter(x => x.estado === "ACTIVO" && normTxt_(x.cultivo) === normTxt_(cultivo));
  if (!del.length) return { ok: true, valor: v };
  const h = del.find(x => normTxt_(x.variedad) === normTxt_(v));
  return h ? { ok: true, valor: h.variedad }
           : { ok: false, error: "Variedad no válida para " + cultivo + " (usa: " + del.map(x => x.variedad).join(", ") + ")" };
}

/* ---------- Placas (módulo Soporte) ---------- */
const normPlaca_ = s => String(s === undefined || s === null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
function migrarPlacas_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PLC);
  if (!sh) return;
  const h = [3, 5, 6].map(c => String(sh.getRange(1, c + 1, 1, 1).getValues()[0][0]));
  const v7 = h[0] === "Estado", v8 = h[1] === "Fundo";
  if (!v7 && !v8) return;                                  // ya está en el formato actual
  const n = sh.getLastRow();
  const cols = v7 ? 5 : 10;
  const viejas = n > 1 ? sh.getRange(2, 1, n - 1, cols).getValues().filter(f => String(f[cols - 1]) !== "") : [];
  const subs = {};
  fundos_().forEach(x => { subs[normTxt_(x.sub_fundo)] = x; });
  const nuevas = viejas.map(f => {
    if (v7) return [f[0], f[1], f[2], "", "", "", "", "", "", f[3], f[4]];
    const sf = subs[normTxt_(f[5])];                       // el "fundo" de la v8 solo se conserva si coincide con un sub fundo
    return [f[0], f[1], f[2], f[3], f[4], sf ? sf.sub_fundo : "", "", sf ? sf.centro_costo : "", f[7], f[8], f[9]];
  });
  respaldo_(sh, "Placas_respaldo_v8");
  sh.clear();
  asegurarTamano_(sh, Math.max(nuevas.length + 1, 2), PLC_HEAD.length);
  sh.getRange("A:I").setNumberFormat("@");
  sh.getRange(1, 1, 1, PLC_HEAD.length).setValues([PLC_HEAD]).setFontWeight("bold");
  if (nuevas.length) sh.getRange(2, 1, nuevas.length, PLC_HEAD.length).setValues(nuevas);
  subirVersion_();
}
// El centro de costo siempre es el actual del sub fundo (salvo que se pida solo lo guardado, para reescribir la hoja)
function placas_(crudo) {
  migrarPlacas_();
  const cc = {};
  if (!crudo) fundos_().forEach(f => { cc[f.sub_fundo] = f.centro_costo; });
  return catLeer_(HOJA_PLC, PLC_HEAD).map(f => {
    const sub = limpiar_(f[5]);
    const cap = Number(f[8]);
    return { placa: limpiar_(f[0]).toUpperCase(), chofer: limpiar_(f[1]), tipo_unidad: limpiar_(f[2]), tipo_combustible: limpiar_(f[3]),
      cod_sap: limpiar_(f[4]), sub_fundo: sub, area: limpiar_(f[6]),
      centro_costo: crudo ? limpiar_(f[7]) : (cc[sub] !== undefined ? cc[sub] : limpiar_(f[7])),
      capacidad: (f[8] === "" || isNaN(cap)) ? "" : cap,
      estado: String(f[9]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[10]) };
  });
}
function placasEscribir_(l) {
  const sh = hojaCat_(HOJA_PLC, PLC_HEAD);
  catEscribir_(HOJA_PLC, PLC_HEAD, l.map(x => [x.placa, x.chofer, x.tipo_unidad, x.tipo_combustible || "", x.cod_sap || "", x.sub_fundo || "", x.area || "", x.centro_costo || "", x.capacidad === undefined ? "" : x.capacidad, x.estado, x.id]));
  sh.getRange("A:I").setNumberFormat("@");
}
function placaGuardar_(f) {
  f = f || {};
  const lista = placas_(true);
  const previa = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previa) return fallo_("La placa ya no existe");
  const comb = canon_(f.tipo_combustible, COMBUSTIBLES);
  if (comb === null) return fallo_("Tipo de combustible no válido (usa: " + COMBUSTIBLES.join(", ") + ")");
  const capT = numTxt_(f.capacidad);
  const o = { placa: limpiar_(f.placa).toUpperCase(), chofer: limpiar_(f.chofer), tipo_unidad: limpiar_(f.tipo_unidad), tipo_combustible: comb,
              cod_sap: limpiar_(f.cod_sap), sub_fundo: limpiar_(f.sub_fundo), area: limpiar_(f.area),
              capacidad: capT === "" ? "" : Number(capT), estado: canon_(f.estado || "ACTIVO", ESTADOS) };
  const falta = [];
  if (!o.placa) falta.push("placa");
  if (!o.chofer) falta.push("chofer");
  if (!o.tipo_unidad) falta.push("tipo de unidad");
  if (!o.tipo_combustible) falta.push("tipo de combustible");
  if (!o.cod_sap) falta.push("código SAP del combustible");
  if (!o.sub_fundo) falta.push("sub fundo");
  if (!o.area) falta.push("área");
  if (o.capacidad === "") falta.push("capacidad máxima");
  if (falta.length) return fallo_("Falta: " + falta.join(", "));
  if (normPlaca_(o.placa).length < 5) return fallo_("Placa no válida");
  if (!/^[A-Za-z0-9._\-\/]{1,20}$/.test(o.cod_sap)) return fallo_("Código SAP no válido (letras, números, guion o punto; máximo 20)");
  if (isNaN(o.capacidad) || o.capacidad <= 0 || o.capacidad > 2000) return fallo_("Capacidad máxima no válida (galones, mayor que 0)");
  if (!o.estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  const fu = fundos_().find(x => normTxt_(x.sub_fundo) === normTxt_(o.sub_fundo));
  if (!fu) return fallo_("El sub fundo no existe: agrégalo primero en Agrícola > Fundos");
  o.sub_fundo = fu.sub_fundo;
  if (!fu.centro_costo) return fallo_("El sub fundo " + fu.sub_fundo + " no tiene centro de costo: agrégalo en Agrícola > Fundos");
  o.centro_costo = fu.centro_costo;
  const ar = areas_().find(x => normTxt_(x.nombre) === normTxt_(o.area));
  if (!ar) return fallo_("El área no existe: agrégala primero en Soporte > Áreas");
  o.area = ar.nombre;
  if (lista.some(x => (!previa || x.id !== previa.id) && normPlaca_(x.placa) === normPlaca_(o.placa))) return fallo_("Ya existe esa placa");
  // Un mismo tipo de combustible tiene un único código SAP: al crear una placa o cambiar su combustible debe coincidir;
  // al cambiar el código sin cambiar el combustible, se actualiza en todas las placas de ese combustible.
  const otras = lista.filter(x => (!previa || x.id !== previa.id) && x.tipo_combustible === o.tipo_combustible && x.cod_sap);
  const distinto = otras.filter(x => x.cod_sap !== o.cod_sap);
  let actualizadas = 0;
  if (distinto.length) {
    if (previa && previa.tipo_combustible === o.tipo_combustible && previa.cod_sap !== o.cod_sap) {
      lista.forEach(x => { if (x.tipo_combustible === o.tipo_combustible && x.id !== previa.id && x.cod_sap !== o.cod_sap) { x.cod_sap = o.cod_sap; actualizadas++; } });
    } else {
      return fallo_(o.tipo_combustible + " ya usa el código SAP " + distinto[0].cod_sap + " en otras placas. Para cambiarlo, edita una de esas placas.");
    }
  }
  if (previa) { o.id = previa.id; lista[lista.findIndex(x => x.id === previa.id)] = o; }
  else { o.id = Utilities.getUuid(); lista.push(o); }
  placasEscribir_(lista);
  return { ok: true, version: subirVersion_(), actualizadas: actualizadas };
}
function placaEliminar_(id) {
  const lista = placas_(true);
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("La placa ya no existe");
  lista.splice(i, 1);
  placasEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}

/* ============================ PLANTILLAS ============================ */

function campoInicial_(clave, nombre, tipo, grupo, extra) {
  return Object.assign({ clave: clave, nombre: nombre, tipo: tipo, grupo: grupo, obligatorio: true,
    min: "", max: "", defecto: "", opciones: [], ayuda: "", unidad: "", recordar: false, activo: true }, extra || {});
}

function plantillaInicial_() {
  const g = "Plagas";
  return [
    campoInicial_("organo_evaluado", "Órgano evaluado", "lista", "Datos de la evaluación",
      { opciones: ["Hoja", "Brote", "Flor", "Fruto"], recordar: true }),
    campoInicial_("mosca_blanca", "Mosca blanca", "conteo", g, { min: 0, defecto: 0 }),
    campoInicial_("trips", "Trips", "conteo", g, { min: 0, defecto: 0 }),
    campoInicial_("aranita_roja", "Arañita roja", "conteo", g, { min: 0, defecto: 0 }),
    campoInicial_("pulgon", "Pulgón", "conteo", g, { min: 0, defecto: 0 }),
    campoInicial_("minador_hoja", "Minador de hoja", "conteo", g, { min: 0, defecto: 0 }),
    campoInicial_("cochinilla", "Cochinilla", "conteo", g, { min: 0, defecto: 0 })
  ];
}

function hojaPlantillas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_PLA);
  if (!sh) {
    sh = ss.insertSheet(HOJA_PLA);
    sh.getRange(1, 1, 1, PLA_COLS.length).setValues([PLA_COLS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:E").setNumberFormat("@");
    sh.appendRow(["fitosanidad", "Evaluación fitosanitaria - Plagas", 1, "SI",
                  JSON.stringify(plantillaInicial_()), new Date(), "fitosanidad"]);
  } else {
    if (String(sh.getRange(1, PLA_COL_MOD, 1, 1).getValues()[0][0]) === "") {
      // Hoja de la versión 5: se agrega la columna del módulo y todo lo existente es de Fitosanidad
      const n = sh.getLastRow();
      sh.getRange(1, PLA_COL_MOD, 1, 1).setValues([[PLA_COLS[PLA_COL_MOD - 1]]]).setFontWeight("bold");
      if (n > 1) {
        const col = [];
        for (let i = 2; i <= n; i++) col.push(["fitosanidad"]);
        sh.getRange(2, PLA_COL_MOD, n - 1, 1).setValues(col);
      }
      subirVersion_();
    }
    if (sh.getMaxColumns() < PLA_COL_CFG) asegurarTamano_(sh, 1, PLA_COL_CFG);
    if (String(sh.getRange(1, PLA_COL_CFG, 1, 1).getValues()[0][0]) === "") {
      // Hoja de la versión 11 o anterior: columna de configuración (vacía = encabezado completo hasta válvula, sin capas)
      sh.getRange(1, PLA_COL_CFG, 1, 1).setValues([[PLA_COLS[PLA_COL_CFG - 1]]]).setFontWeight("bold");
      subirVersion_();
    }
  }
  return sh;
}

function plantillas_() {
  const sh = hojaPlantillas_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PLA_COLS.length).getValues()
    .filter(f => String(f[0]) !== "")
    .map((f, i) => {
      let campos = [];
      try { campos = JSON.parse(String(f[4])); } catch (e) { campos = []; }
      const m = modulo_(f[6]);
      let cfg = {};
      try { cfg = f[7] ? JSON.parse(String(f[7])) : {}; } catch (e) { cfg = {}; }
      return { fila: i + 2, id: String(f[0]), nombre: String(f[1]), version: Number(f[2]) || 1,
               activa: String(f[3]).trim().toUpperCase() === "SI", campos: campos,
               mod_eval: m ? m.id : "fitosanidad", cfg: normCfg_(cfg) };
    });
}

function normCampo_(c) {
  const numero = v => (v === "" || v === undefined || v === null) ? "" : Number(v);
  return {
    clave: String(c.clave || "").trim(), nombre: limpiar_(c.nombre), tipo: String(c.tipo || ""),
    grupo: limpiar_(c.grupo), obligatorio: !!c.obligatorio,
    min: numero(c.min), max: numero(c.max),
    defecto: (c.defecto === undefined || c.defecto === null) ? "" : c.defecto,
    opciones: (Array.isArray(c.opciones) ? c.opciones : []).map(limpiar_).filter(Boolean),
    ayuda: limpiar_(c.ayuda), unidad: limpiar_(c.unidad), recordar: !!c.recordar, activo: c.activo !== false,
    capa: limpiar_(c.capa), contador: !!c.contador,
    formula: c.formula && typeof c.formula === "object"
      ? { op: String(c.formula.op || ""), campos: (Array.isArray(c.formula.campos) ? c.formula.campos : []).map(x => String(x)) }
      : null
  };
}

// Configuración de la cartilla: hasta qué nivel llega el encabezado, fecha editable, semana de cultivo y capas de evaluación.
function normCfg_(c) {
  c = c || {};
  const nivel = ["lote", "turno", "valvula"].indexOf(c.nivel) >= 0 ? c.nivel : "valvula";
  let turno = ["no", "opcional", "si"].indexOf(c.turno) >= 0 ? c.turno : "si";
  if (nivel === "lote") turno = "no";
  if (nivel === "turno" && turno === "no") turno = "si";
  const capas = [];
  (Array.isArray(c.capas) ? c.capas : []).forEach(x => { const t = limpiar_(x); if (t && capas.indexOf(t) < 0) capas.push(t); });
  return { nivel: nivel, turno: turno, fecha_editable: !!c.fecha_editable, semana_cultivo: !!c.semana_cultivo, capas: capas.slice(0, 4) };
}

// Fórmulas de los campos calculados (la app hace la misma cuenta en el celular; el servidor la repite para que el dato sea confiable)
function calcFormula_(f, vals) {
  if (!f || OPS_FORMULA.indexOf(f.op) < 0 || !Array.isArray(f.campos) || !f.campos.length) return "";
  const xs = [];
  for (let i = 0; i < f.campos.length; i++) {
    const v = vals[f.campos[i]];
    if (v === "" || v === undefined || v === null) { if (f.op === "suma") { xs.push(0); continue; } return ""; }
    if (isNaN(Number(v))) return "";
    xs.push(Number(v));
  }
  let r;
  switch (f.op) {
    case "suma": r = xs.reduce((a, b) => a + b, 0); break;
    case "resta": r = xs.slice(1).reduce((a, b) => a - b, xs[0]); break;
    case "producto": r = xs.reduce((a, b) => a * b, 1); break;
    case "promedio": r = xs.reduce((a, b) => a + b, 0) / xs.length; break;
    case "division": if (!xs[1]) return ""; r = xs[0] / xs[1]; break;
    default: if (!xs[1]) return ""; r = xs[0] / xs[1] * 100;     // porcentaje
  }
  return Math.round(r * 100) / 100;
}

function validarPlantilla_(p, previa) {
  const nombre = limpiar_(p.nombre);
  if (!nombre) return { error: "Falta el nombre de la plantilla" };
  const campos = (Array.isArray(p.campos) ? p.campos : []).map(normCampo_);
  if (!campos.length) return { error: "La plantilla debe tener al menos un campo" };
  const cfg = normCfg_(p.cfg);
  const contadores = {};
  const vistas = {};
  for (let i = 0; i < campos.length; i++) {
    const c = campos[i];
    if (!c.nombre) return { error: "Hay un campo sin nombre" };
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(c.clave)) return { error: "Nombre interno no válido en «" + c.nombre + "»" };
    const yaExistia = previa && previa.campos.some(a => a.clave === c.clave);
    if (RESERVADAS.indexOf(c.clave) >= 0 && !yaExistia) return { error: "El nombre interno «" + c.clave + "» está reservado; cambia el nombre del campo" };
    if (vistas[c.clave]) return { error: "Campo repetido: " + c.nombre };
    vistas[c.clave] = 1;
    if (TIPOS.indexOf(c.tipo) < 0) return { error: "Tipo no válido en «" + c.nombre + "»" };
    if (c.tipo === "lista" && c.opciones.length < 2) return { error: "La lista «" + c.nombre + "» necesita al menos 2 opciones" };
    if ((c.min !== "" && isNaN(c.min)) || (c.max !== "" && isNaN(c.max))) return { error: "Mínimo o máximo no válido en «" + c.nombre + "»" };
    if (c.min !== "" && c.max !== "" && c.min > c.max) return { error: "En «" + c.nombre + "» el mínimo es mayor que el máximo" };
    if (c.defecto !== "" && (c.tipo === "conteo" || c.tipo === "entero" || c.tipo === "decimal") && isNaN(Number(c.defecto)))
      return { error: "Valor por defecto no válido en «" + c.nombre + "»" };
    // El tipo de dato se puede cambiar: lo ya guardado no se toca y los registros nuevos usan el tipo nuevo.
    if (cfg.capas.length) {
      if (c.capa && cfg.capas.indexOf(c.capa) < 0) return { error: "«" + c.nombre + "» está en una capa que no existe: " + c.capa };
    } else { c.capa = ""; c.contador = false; }
    if (c.contador) {
      if (!c.capa) return { error: "«" + c.nombre + "»: el contador debe pertenecer a una capa" };
      if (c.tipo !== "conteo" && c.tipo !== "entero") return { error: "«" + c.nombre + "»: el contador de una capa debe ser de tipo conteo o número entero" };
      if (contadores[c.capa]) return { error: "La capa «" + c.capa + "» tiene dos contadores; deja solo uno" };
      contadores[c.capa] = 1;
    }
    if (c.tipo === "calculado") {
      const f = c.formula;
      if (!f || OPS_FORMULA.indexOf(f.op) < 0) return { error: "Elige la operación del campo calculado «" + c.nombre + "»" };
      const dos = f.op === "resta" || f.op === "division" || f.op === "porcentaje";
      if ((dos && f.campos.length !== 2) || (!dos && f.campos.length < 2)) return { error: "El cálculo de «" + c.nombre + "» necesita " + (dos ? "exactamente 2" : "al menos 2") + " campos" };
      c.obligatorio = false; c.min = ""; c.max = ""; c.defecto = ""; c.recordar = false; c.contador = false;
    } else c.formula = null;
  }
  for (let i = 0; i < campos.length; i++) {
    const c = campos[i];
    if (c.tipo !== "calculado") continue;
    for (let k = 0; k < c.formula.campos.length; k++) {
      const r = campos.find(x => x.clave === c.formula.campos[k]);
      if (!r || r.clave === c.clave) return { error: "El cálculo de «" + c.nombre + "» usa un campo que no existe" };
      if (["conteo", "entero", "decimal"].indexOf(r.tipo) < 0) return { error: "El cálculo de «" + c.nombre + "» solo puede usar campos numéricos (" + r.nombre + " no lo es)" };
    }
  }
  if (cfg.capas.length) {
    const prof = cfg.capas[cfg.capas.length - 1];
    if (!campos.some(c => c.activo && c.capa === prof && c.tipo !== "calculado")) return { error: "La última capa («" + prof + "») debe tener al menos un campo para llenar" };
  }
  if (previa) {
    const faltan = previa.campos.filter(a => !campos.some(c => c.clave === a.clave));
    if (faltan.length) return { error: "No se pueden eliminar campos ya guardados (ocúltalos): " + faltan.map(x => x.nombre).join(", ") };
  }
  if (!campos.some(c => c.activo)) return { error: "Debe haber al menos un campo visible" };
  return { nombre: nombre, campos: campos, cfg: cfg };
}

function plantillaGuardar_(p) {
  p = p || {};
  const lista = plantillas_();
  let previa = null;
  if (p.id) {
    previa = lista.find(x => x.id === String(p.id)) || null;
    if (!previa) return fallo_("La plantilla ya no existe");
  }
  const v = validarPlantilla_(p, previa);
  if (v.error) return fallo_(v.error);
  // El módulo no se cambia después de crear la plantilla: los registros ya guardados están en la hoja de ese módulo
  const mo = previa ? modulo_(previa.mod_eval) : modulo_(p.mod_eval);
  if (!mo || mo.fija) return fallo_("Elige el módulo de la plantilla (" + MODULOS.filter(x => !x.fija).map(x => x.nombre).join(", ") + ")");
  if (lista.some(x => (!previa || x.id !== previa.id) && x.nombre.toLowerCase() === v.nombre.toLowerCase()))
    return fallo_("Ya existe una plantilla con ese nombre");

  const sh = hojaPlantillas_();
  const activa = p.activa === false ? "NO" : "SI";
  const json = JSON.stringify(v.campos);
  if (previa) {
    sh.getRange(previa.fila, 1, 1, PLA_COLS.length)
      .setValues([[previa.id, v.nombre, previa.version + 1, activa, json, new Date(), mo.id, JSON.stringify(v.cfg)]]);
    if (previa.nombre !== v.nombre) renombrarHojaCartilla_(previa.id, mo, v.nombre);
    return { ok: true, id: previa.id, plantilla_version: previa.version + 1, version: subirVersion_() };
  }
  const id = Utilities.getUuid();
  asegurarTamano_(sh, sh.getLastRow() + 1, PLA_COLS.length);
  sh.appendRow([id, v.nombre, 1, activa, json, new Date(), mo.id, JSON.stringify(v.cfg)]);
  return { ok: true, id: id, plantilla_version: 1, version: subirVersion_() };
}

// Activar o desactivar una cartilla sin tocar sus campos: los evaluadores dejan de verla, y lo ya registrado se sigue recibiendo.
function plantillaEstado_(id, activa) {
  const p = plantillas_().find(x => x.id === String(id || ""));
  if (!p) return fallo_("La plantilla ya no existe");
  hojaPlantillas_().getRange(p.fila, 4, 1, 1).setValues([[activa === false || activa === "false" ? "NO" : "SI"]]);
  return { ok: true, version: subirVersion_() };
}

/* ============================ CARTILLA "Eval. de Poda" (módulo Calidad) ============================ */

// Se crea una sola vez (la marca queda en las propiedades del script). Si luego la desactivas o la editas, no se vuelve a crear.
// Fecha, cultivo, campaña, sub fundo, módulo, lote y válvula ya vienen del encabezado de la app.
const PODA_NOMBRE = "Eval. de Poda";
const PODA_CAMPOS = [
  ["supervisor", "Supervisor", "texto", "Datos generales"],
  ["podador", "Podador", "texto", "Datos generales"],
  ["n_ramas", "N° de ramas", "entero", "Datos a evaluar"],
  ["n_ramas_menor_6mm", "N° ramas < 6 mm", "entero", "Datos a evaluar"],
  ["n_ramas_mayor_16mm", "N° ramas > 16 mm", "entero", "Datos a evaluar"],
  ["n_ramas_lignificadas", "N° ramas lignificadas", "entero", "Datos a evaluar"],
  ["n_ramas_herbaceas", "N° ramas herbáceas", "entero", "Datos a evaluar"],
  ["n_ramas_cruzadas", "N° ramas cruzadas", "entero", "Datos a evaluar"],
  ["n_ramas_altura_indicada", "N° ramas con altura indicada", "entero", "Datos a evaluar"],
  ["n_ramas_debajo_altura", "N° ramas debajo de altura indicada", "entero", "Datos a evaluar"],
  ["n_ramas_encima_altura", "N° ramas encima de altura indicada", "entero", "Datos a evaluar"],
  ["n_ramas_3_flujos", "N° ramas c/3 flujos", "entero", "Datos a evaluar"],
  ["n_tirasavias", "N° tirasavias", "entero", "Datos a evaluar"],
  ["n_ramas_dano_corte", "N° ramas con daño por corte", "entero", "Datos a evaluar"],
  ["n_ramas_corte_recto", "N° ramas con corte recto", "entero", "Datos a evaluar"],
  ["n_ramas_mal_corte", "N° ramas con mal corte", "entero", "Datos a evaluar"],
  ["categoria", "Categoría", "entero", "Datos a evaluar"],
  ["n_ramas_altura_30_35", "N° ramas con altura de 30 a 35", "entero", "Datos a evaluar"],
  ["n_ramas_altura_menor_30", "N° ramas con altura menor a 30", "entero", "Datos a evaluar"]
];
function sembrarPlantillaPoda_() {
  const pr = PropertiesService.getScriptProperties();
  if (pr.getProperty("SEMILLA_PODA_V11")) return;
  const hay = plantillas_().some(x => x.nombre.toLowerCase() === PODA_NOMBRE.toLowerCase());
  if (!hay) {
    const campos = PODA_CAMPOS.map(c => normCampo_({
      clave: c[0], nombre: c[1], tipo: c[2], grupo: c[3],
      obligatorio: true, min: c[2] === "entero" ? 0 : "", activo: true
    }));
    const sh = hojaPlantillas_();
    asegurarTamano_(sh, sh.getLastRow() + 1, PLA_COLS.length);
    sh.appendRow([Utilities.getUuid(), PODA_NOMBRE, 1, "SI", JSON.stringify(campos), new Date(), "calidad"]);
    subirVersion_();
  }
  pr.setProperty("SEMILLA_PODA_V11", "1");
}

/* ============================ CARTILLA "Eval. Axilas" (módulo Fenología) ============================ */

// Evaluación por capas: Planta > Rama > Brote. Cada brote es una fila; la planta y la rama se repiten en sus filas.
// Se crea una sola vez (la marca queda en las propiedades del script); después se puede editar o desactivar.
const AXILAS_NOMBRE = "Eval. Axilas";
function sembrarPlantillaAxilas_() {
  const pr = PropertiesService.getScriptProperties();
  if (pr.getProperty("SEMILLA_AXILAS_V12")) return;
  if (!plantillas_().some(x => x.nombre.toLowerCase() === AXILAS_NOMBRE.toLowerCase())) {
    const G = "Datos generales";
    const conteo = (clave, nombre, capa, defecto, extra) => Object.assign({ clave: clave, nombre: nombre, tipo: "conteo", grupo: capa || G, capa: capa, obligatorio: true, min: 0, defecto: defecto, activo: true }, extra || {});
    const campos = [
      { clave: "tipo_poda", nombre: "Tipo de poda", tipo: "lista", grupo: G, capa: "", obligatorio: true, opciones: ["Normal", "Adelanta", "Traspaso", "Siembra", "Ensayo", "Otro"], activo: true },
      conteo("num_planta", "N° de planta", "Planta", 1, { min: 1, contador: true }),
      { clave: "categoria_planta", nombre: "Categoría de la planta", tipo: "lista", grupo: "Planta", capa: "Planta", obligatorio: true, opciones: ["Normal", "Pequeña", "Enferma"], activo: true },
      conteo("n_ramas", "N° de rama", "Rama", 1, { min: 1, contador: true }),
      conteo("num_brote", "N° de brote", "Brote", 1, { min: 1, contador: true }),
      conteo("axilas_vegetativo", "Axilas vegetativo", "Brote", 0),
      conteo("axilas_veg_organos", "Axilas veg. órganos", "Brote", 0),
      conteo("axilas_yemas", "Axilas yemas", "Brote", 0),
      conteo("axilas_productivos", "Axilas productivos", "Brote", 0),
      conteo("axilas_falso_cargador", "Axilas falso cargador", "Brote", 0),
      { clave: "total_axilas", nombre: "Total axilas", tipo: "calculado", grupo: "Brote", capa: "Brote", obligatorio: false,
        formula: { op: "suma", campos: ["axilas_vegetativo", "axilas_veg_organos", "axilas_yemas", "axilas_productivos", "axilas_falso_cargador"] }, activo: true }
    ].map(normCampo_);
    const cfg = normCfg_({ nivel: "valvula", turno: "opcional", fecha_editable: true, semana_cultivo: true, capas: ["Planta", "Rama", "Brote"] });
    const sh = hojaPlantillas_();
    asegurarTamano_(sh, sh.getLastRow() + 1, PLA_COLS.length);
    sh.appendRow([Utilities.getUuid(), AXILAS_NOMBRE, 1, "SI", JSON.stringify(campos), new Date(), "fenologia", JSON.stringify(cfg)]);
    subirVersion_();
  }
  pr.setProperty("SEMILLA_AXILAS_V12", "1");
}

/* ============================ CACHÉ (para que 80 celulares no lean las hojas una y otra vez) ============================ */

// Guarda en la memoria de Google el resultado de leer una hoja. La clave incluye la versión de la configuración:
// cualquier cambio hecho desde la app sube la versión y la copia vieja deja de usarse sola.
// Si editas las hojas a mano, usa el menú Evaluaciones > Forzar actualización (o espera unos minutos).
const CACHE_SEG = 600;
function cacheJson_(clave, fn) {
  const cache = CacheService.getScriptCache();
  const k = clave + ":" + versionCfg_();
  try {
    const n = cache.get(k + ":n");
    if (n !== null && n !== undefined) {
      let txt = "", ok = true;
      for (let i = 0; i < Number(n); i++) {
        const p = cache.get(k + ":" + i);
        if (p === null || p === undefined) { ok = false; break; }
        txt += p;
      }
      if (ok) return JSON.parse(txt);
    }
  } catch (e) {}
  const v = fn();
  try {
    const txt = JSON.stringify(v), TAM = 30000, partes = Math.ceil(txt.length / TAM) || 1;
    if (partes <= 40) {
      for (let i = 0; i < partes; i++) cache.put(k + ":" + i, txt.substr(i * TAM, TAM), CACHE_SEG);
      cache.put(k + ":n", String(partes), CACHE_SEG);
    }
  } catch (e) {}
  return v;
}
function plantillasCache_() { return cacheJson_("pl", plantillas_); }
function maestraCache_()    { return cacheJson_("ma", maestra_); }
function fundosCache_()     { return cacheJson_("fu", fundos_); }
function areasCache_()      { return cacheJson_("ar", areas_); }
function placasCache_()     { return cacheJson_("pc", () => placas_()); }
// Usuarios sin la clave cifrada: solo para reconocer quién envía (el login sigue leyendo la hoja)
function usuariosAuth_() {
  return cacheJson_("ua", () => usuarios_().map(u => { const c = Object.assign({}, u); delete c.salt; delete c.hash; return c; }));
}

/* ============================ HOJA DE RECEPCIÓN ============================ */

// Los envíos de evaluaciones caen primero en la hoja «Recepcion» (rápido, sin leer las hojas grandes) y un proceso
// los pasa por lotes a la hoja de cada cartilla. Las reservas de combustible siguen guardándose al instante.
const REC_COLS = ["id", "recibido", "usuario", "plantilla_id", "modulo", "json"];
const REC_MAX_POR_CORRIDA = 1500;
const REC_ESPERA_MS = 90000;

function recepcionActiva_() { return PropertiesService.getScriptProperties().getProperty("RECEPCION") !== "NO"; }

function hojaRecepcion_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_REC);
  if (!sh) {
    sh = ss.insertSheet(HOJA_REC);
    asegurarTamano_(sh, 2, REC_COLS.length);
    sh.getRange(1, 1, 1, REC_COLS.length).setValues([REC_COLS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("@");
  }
  return sh;
}

function recepcionAgregar_(regs, us, modId) {
  const sh = hojaRecepcion_();
  const ultima = sh.getLastRow();
  const ya = new Set();
  if (ultima > 1) sh.getRange(2, 1, ultima - 1, 1).getValues().forEach(f => ya.add(String(f[0])));
  const ids = [], filas = [];
  const ahora = new Date().toISOString();
  const quien = { usuario: us.usuario, rol: us.rol, subfundos: us.subfundos || [], plantillas: us.plantillas || [] };
  regs.forEach(r => {
    ids.push(r.id);                         // se confirma siempre (si ya está pendiente o ya se procesó, se descarta al procesar)
    if (ya.has(String(r.id))) return;
    ya.add(String(r.id));
    filas.push([String(r.id), ahora, us.usuario, String(r.plantilla_id || ""), modId, JSON.stringify({ r: r, us: quien })]);
  });
  if (filas.length) {
    const desde = ultima + 1;
    asegurarTamano_(sh, desde + filas.length - 1, REC_COLS.length);
    sh.getRange(desde, 1, filas.length, REC_COLS.length).setValues(filas);
  }
  return { ids: ids, nuevos: filas.length };
}

function recepcionEstado_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_REC);
  if (!sh) return { n: 0, masVieja: 0 };
  const ultima = sh.getLastRow();
  if (ultima < 2) return { n: 0, masVieja: 0 };
  const t = Date.parse(String(sh.getRange(2, 2, 1, 1).getValues()[0][0]));
  return { n: ultima - 1, masVieja: isNaN(t) ? 0 : t };
}

// Pasa lo recibido a las hojas de cada cartilla. Debe llamarse con el candado tomado.
function procesarRecepcion_(max) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_REC);
  if (!sh) return { procesados: 0, pendientes: 0 };
  const ultima = sh.getLastRow();
  if (ultima < 2) return { procesados: 0, pendientes: 0 };
  const n = Math.min(ultima - 1, max || REC_MAX_POR_CORRIDA);
  const filas = sh.getRange(2, 1, n, REC_COLS.length).getValues();
  const pls = {};
  plantillasCache_().forEach(p => pls[p.id] = p);
  const grupos = {}, ilegibles = [];
  filas.forEach((f, i) => {
    let o = null;
    try { o = JSON.parse(String(f[5])); } catch (e) { o = null; }
    if (!o || !o.r) { ilegibles.push(f); return; }
    const pid = String(o.r.plantilla_id || "");
    const p = pls[pid] || null;
    const m = modulo_(p ? p.mod_eval : o.r.mod_eval) || MODULOS[0];
    const k = p ? "p:" + p.id : "m:" + m.id;
    const g = (grupos[k] = grupos[k] || { mod: m, p: p, regs: [], filas: [] });
    const r = o.r;
    r._us = o.us; r._recibido = String(f[1]);
    g.regs.push(r); g.filas.push(f);
  });
  const fallidas = [];
  let procesados = 0;
  Object.keys(grupos).forEach(k => {
    const g = grupos[k];
    try {
      const hoja = g.p ? hojaCartilla_(g.p, g.mod) : hojaRegistros_(g.mod);
      const us0 = g.regs[0]._us;
      syncHoja_(hoja, g.regs, us0, g.mod, g.p ? g.p.campos.map(c => c.clave) : [], g.p ? g.p.campos : []);
      procesados += g.regs.length;
    } catch (e) {
      g.filas.forEach(f => fallidas.push(f));
    }
  });
  if (ilegibles.length) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let eh = ss.getSheetByName("Recepcion_errores");
    if (!eh) { eh = ss.insertSheet("Recepcion_errores"); asegurarTamano_(eh, 2, REC_COLS.length); eh.getRange(1, 1, 1, REC_COLS.length).setValues([REC_COLS]); }
    const d = eh.getLastRow() + 1;
    asegurarTamano_(eh, d + ilegibles.length - 1, REC_COLS.length);
    eh.getRange(d, 1, ilegibles.length, REC_COLS.length).setValues(ilegibles);
  }
  const resto = ultima - 1 > n ? sh.getRange(n + 2, 1, ultima - 1 - n, REC_COLS.length).getValues() : [];
  const quedan = fallidas.concat(resto);
  sh.getRange(2, 1, ultima - 1, REC_COLS.length).clearContent();
  if (quedan.length) sh.getRange(2, 1, quedan.length, REC_COLS.length).setValues(quedan);
  return { procesados: procesados, pendientes: quedan.length };
}

// Para el activador de tiempo (cada minuto): Apps Script > Activadores > Añadir > procesarRecepcionAuto
function procesarRecepcionAuto() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try { _VAR = null; procesarRecepcion_(); } finally { lock.releaseLock(); }
}
function procesarRecepcionAhora() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let r;
  try { _VAR = null; r = procesarRecepcion_(); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert("Procesados: " + r.procesados + ". Pendientes en recepción: " + r.pendientes + ".");
}

/* ============================ CONFIGURACIÓN PARA LOS CELULARES ============================ */

// El administrador recibe todo. El evaluador recibe solo las válvulas ACTIVAS de los sub fundos
// que se le asignaron y solo las plantillas activas que se le asignaron.
function configObtener_(d, us) {
  sembrarPlantillaPoda_();
  sembrarPlantillaAxilas_();
  const v = versionCfg_();
  if (Number(d.version) === v) return { ok: true, cambio: false, version: v };
  let maestra = maestraCache_();
  let pl = plantillasCache_().concat([PLA_COMBUSTIBLE]).map(p => ({ id: p.id, nombre: p.nombre, version: p.version, activa: p.activa, campos: p.campos, mod_eval: p.mod_eval, fija: !!p.fija, cfg: p.cfg || normCfg_({}) }));
  let umb = [], fun = [], vars = [], plc = [], are = [];
  if (us.rol === "admin") {
    umb = umbrales_();
    fun = fundos_();
    vars = variedades_();
    plc = placas_();
    are = areas_();
  } else {
    if (us.plantillas.indexOf(COMB_ID) >= 0) {       // Soporte necesita las placas, las áreas y los sub fundos con centro de costo
      plc = placasCache_().filter(x => x.estado === "ACTIVO");
      are = areasCache_().filter(x => x.estado === "ACTIVO");
      fun = fundosCache_().filter(x => x.estado === "ACTIVO" && x.centro_costo).map(x => ({ sede: x.sede, fundo: x.fundo, sub_fundo: x.sub_fundo, centro_costo: x.centro_costo, id: x.id }));
    }
    maestra = maestra.filter(x => x.estado === "ACTIVO" && us.subfundos.indexOf(x.sub_fundo) >= 0);
    pl = pl.filter(p => p.activa && us.plantillas.indexOf(p.id) >= 0).map(p => {
      p = Object.assign({}, p);
      p.campos = p.campos.filter(c => c.activo !== false);
      return p;
    });
  }
  return { ok: true, cambio: true, version: v, maestra: maestra, plantillas: pl, umbrales: umb, fundos: fun, variedades: vars, placas: plc, areas: are };
}

function accionAdmin_(d, admin) {
  switch (d.accion) {
    case "usuario_listar":
      return { ok: true, usuarios: usuarios_().map(x => ({
        dni: x.dni, nombre: x.nombre, rol: x.rol, usuario: x.usuario, estatus: x.estatus,
        subfundos: x.subfundos, plantillas: x.plantillas })) };

    case "usuario_guardar":
      return usuarioGuardar_(d.usuario_datos || {}, admin);

    case "usuario_estado": {
      const u = usuarios_().find(x => x.usuario === String(d.usuario || "").toLowerCase());
      if (!u) return fallo_("Usuario no encontrado");
      const st = canon_(d.estatus, ESTATUS);
      if (!st) return fallo_("Estatus no válido (usa ACTIVO o CERRADO)");
      if (u.usuario === admin.usuario && st !== "ACTIVO") return fallo_("No puedes cerrar tu propia cuenta");
      hojaUsuarios_().getRange(u.fila, 7).setValue(st);
      return { ok: true, version: subirVersion_() };
    }

    case "maestra_guardar":   return maestraGuardar_(d.fila);
    case "maestra_importar":  return maestraImportar_(d.filas);
    case "lote_estado":       return loteEstado_(d);
    case "plantilla_guardar": return plantillaGuardar_(d.plantilla);
    case "plantilla_estado":  return plantillaEstado_(d.id, d.activa);
    case "umbral_guardar":    return umbralGuardar_(d.umbral);
    case "umbral_importar":   return umbralImportar_(d.filas);
    case "umbral_eliminar":   return umbralEliminar_(d.id);
    case "area_guardar":      return areaGuardar_(d.fila);
    case "area_eliminar":     return areaEliminar_(d.id);
    case "fundo_guardar":     return fundoGuardar_(d.fila);
    case "fundo_eliminar":    return fundoEliminar_(d.id);
    case "variedad_guardar":  return variedadGuardar_(d.fila);
    case "variedad_eliminar": return variedadEliminar_(d.id);
    case "placa_guardar":     return placaGuardar_(d.fila);
    case "placa_eliminar":    return placaEliminar_(d.id);
    case "supervision":       return supervision_(d);
    case "exportar":          return exportar_(d);
  }
  return fallo_("acción desconocida");
}

/* ============================ REGISTROS ============================ */

// Hoja de registros de un módulo de evaluación. La hoja "Registros" de la versión 5 pasa a ser la de Fitosanidad.
function hojaRegistros_(mod) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(mod.hoja);
  if (sh) return sh;
  const vieja = ss.getSheetByName(HOJA_VIEJA);
  if (vieja && mod.id === "fitosanidad") { vieja.setName(mod.hoja); return vieja; }
  const base = mod.base || BASE;
  sh = ss.insertSheet(mod.hoja);
  asegurarTamano_(sh, 2, base.length);   // una hoja nueva trae 26 columnas y aquí hay más
  sh.getRange(1, 1, 1, base.length).setValues([base]).setFontWeight("bold");
  sh.setFrozenRows(1);
  // Texto en id/fecha/hora y en campaña…etapa (o placa/conductor): así "01" o "1-2" no se convierten en número o fecha
  (mod.texto || ["A:C", "H:S"]).forEach(r => sh.getRange(r).setNumberFormat("@"));
  return sh;
}

// Una hoja por cartilla: "<Módulo> - <nombre de la cartilla>". La hoja se recuerda por el id de la cartilla,
// así que renombrar la cartilla desde la app renombra su hoja (no la renombres a mano).
function nombreHojaCartilla_(mod, nombre) {
  return (mod.nombre + " - " + nombre).replace(/[\[\]*?:\/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
function nombreHojaLibre_(ss, base, propia) {
  let n = base, k = 2;
  while (ss.getSheetByName(n) && ss.getSheetByName(n) !== propia) { n = base.slice(0, 94) + " (" + k + ")"; k++; }
  return n;
}
function hojaCartilla_(p, mod) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty("hoja_" + p.id);
  if (guardada) { const sh0 = ss.getSheetByName(guardada); if (sh0) return sh0; }
  const nombre = nombreHojaLibre_(ss, nombreHojaCartilla_(mod, p.nombre), null);
  // Si el módulo tenía una sola hoja de la versión 8 y solo hay una cartilla, esa hoja pasa a ser la de la cartilla
  let vieja = ss.getSheetByName(mod.hoja);
  if (!vieja && mod.id === "fitosanidad") vieja = ss.getSheetByName(HOJA_VIEJA);
  if (vieja && plantillas_().filter(x => x.mod_eval === mod.id).length === 1) {
    vieja.setName(nombre);
    props.setProperty("hoja_" + p.id, nombre);
    return vieja;
  }
  const sh = ss.insertSheet(nombre);
  asegurarTamano_(sh, 2, BASE.length);
  sh.getRange(1, 1, 1, BASE.length).setValues([BASE]).setFontWeight("bold");
  sh.setFrozenRows(1);
  ["A:C", "H:S"].forEach(r => sh.getRange(r).setNumberFormat("@"));
  props.setProperty("hoja_" + p.id, nombre);
  return sh;
}
function renombrarHojaCartilla_(id, mod, nombreNuevo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty("hoja_" + id);
  const sh = guardada ? ss.getSheetByName(guardada) : null;
  if (!sh) return;
  const n = nombreHojaLibre_(ss, nombreHojaCartilla_(mod, nombreNuevo), sh);
  if (n !== guardada) { sh.setName(n); props.setProperty("hoja_" + id, n); }
}

// Hoja donde está (o estaría) una cartilla, sin crearla.
function hojaExistente_(p, mod) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (p && !mod.fija) {
    const g = PropertiesService.getScriptProperties().getProperty("hoja_" + p.id);
    const sh0 = g ? ss.getSheetByName(g) : null;
    if (sh0) return sh0;
  }
  let sh = ss.getSheetByName(mod.hoja);
  if (!sh && mod.id === "fitosanidad") sh = ss.getSheetByName(HOJA_VIEJA);
  return sh || null;
}

// Agrega a una hoja las columnas que le falten y devuelve los encabezados actuales.
function asegurarColumnas_(sh, cols) {
  let cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const nuevas = cols.filter(c => cab.indexOf(c) === -1);
  if (nuevas.length) {
    asegurarTamano_(sh, 2, cab.length + nuevas.length);
    sh.getRange(1, cab.length + 1, 1, nuevas.length).setValues([nuevas]).setFontWeight("bold");
    cab = cab.concat(nuevas);
  }
  return cab;
}

// Anula registros ya enviados: la fila NO se borra, queda marcada como ANULADO con quién, cuándo y por qué.
// Un evaluador solo puede anular los suyos; el administrador, cualquiera.
function anular_(lista, us) {
  const pls = {};
  plantillas_().forEach(p => pls[p.id] = p);
  const hechas = [], rechazadas = [];
  const ahora = new Date();
  (Array.isArray(lista) ? lista : []).forEach(a => {
    const id = String(a.id || "");
    if (!id) return;
    const pid = String(a.plantilla_id || "");
    const p = pid === COMB_ID ? PLA_COMBUSTIBLE : (pls[pid] || null);
    const m = modulo_(p ? p.mod_eval : a.mod_eval) || MODULOS[0];
    const sh = hojaExistente_(p && !m.fija ? p : null, m);
    if (!sh || sh.getLastRow() < 2) { hechas.push(id); return; }          // no existe en el servidor: nada que anular
    const n = sh.getLastRow();
    const ids = sh.getRange(2, 1, n - 1, 1).getValues();
    let fila = 0;
    for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { fila = i + 2; break; }
    if (!fila) { hechas.push(id); return; }
    const cab = asegurarColumnas_(sh, (m.base || BASE));
    const col = c => cab.indexOf(c) + 1;
    const dueno = String(sh.getRange(fila, col("usuario"), 1, 1).getValues()[0][0]).trim().toLowerCase();
    if (us.rol !== "admin" && dueno !== us.usuario) { rechazadas.push({ id: id, motivo: "Solo puedes anular tus propios registros" }); return; }
    if (String(sh.getRange(fila, col("estado_registro"), 1, 1).getValues()[0][0]) === "ANULADO") { hechas.push(id); return; }
    sh.getRange(fila, col("estado_registro")).setValue("ANULADO");
    sh.getRange(fila, col("anulado_por")).setValue(us.usuario);
    sh.getRange(fila, col("anulado_en")).setValue(ahora);
    sh.getRange(fila, col("motivo_anulacion")).setValue(limpiar_(a.motivo).slice(0, 200));
    hechas.push(id);
  });
  return { anuladas: hechas, anul_rechazadas: rechazadas };
}

// Cada registro va a la hoja de su cartilla (el servidor decide, no el celular).
function sync_(d, us) {
  if (Array.isArray(d.anulaciones) && d.anulaciones.length) procesarRecepcion_();     // lo recién enviado debe estar en su hoja para poder anularlo
  const an = anular_(d.anulaciones, us);       // primero las anulaciones: así una corrección puede reemplazar a su original
  const regs = Array.isArray(d.registros) ? d.registros : [];
  const pls = {};
  plantillasCache_().forEach(p => pls[p.id] = p);
  const grupos = {};
  regs.forEach(r => {
    const pid = String(r.plantilla_id || "");
    const p = pid === COMB_ID ? PLA_COMBUSTIBLE : (pls[pid] || null);
    const m = modulo_(p ? p.mod_eval : r.mod_eval) || MODULOS[0];
    const propia = p && !m.fija ? p : null;
    const k = propia ? "p:" + propia.id : "m:" + m.id;
    (grupos[k] = grupos[k] || { mod: m, p: propia, regs: [] }).regs.push(r);
  });
  const ids = [], rechazados = [];
  let nuevos = 0;
  const usarRec = recepcionActiva_();
  Object.keys(grupos).forEach(k => {
    const gr = grupos[k];
    let g;
    if (usarRec && gr.mod.id !== "soporte") {
      g = recepcionAgregar_(gr.regs, us, gr.mod.id);              // evaluaciones: a la hoja de recepción
      g.rechazados = [];
    } else {                                                       // reservas de combustible: se validan y guardan al instante
      const sh = gr.p ? hojaCartilla_(gr.p, gr.mod) : hojaRegistros_(gr.mod);
      g = syncHoja_(sh, gr.regs, us, gr.mod, gr.p ? gr.p.campos.map(c => c.clave) : [], gr.p ? gr.p.campos : []);
    }
    g.ids.forEach(x => ids.push(x));
    g.rechazados.forEach(x => rechazados.push(x));
    nuevos += g.nuevos;
  });
  if (usarRec) {                                  // si el activador de tiempo no corre, el siguiente envío vacía la recepción
    const e = recepcionEstado_();
    if (e.n && Date.now() - e.masVieja > REC_ESPERA_MS) procesarRecepcion_();
  }
  // Token renovado: mientras el celular envíe datos, la sesión no vence
  return { ok: true, ids: ids, nuevos: nuevos, rechazados: rechazados, anuladas: an.anuladas, anul_rechazadas: an.anul_rechazadas, token: crearToken_(us.usuario, us.rol) };
}

function syncHoja_(sh, regs, us0, mod, claves, campos) {
  const base = (mod && mod.base) || BASE;
  // IDs ya recibidos (para no duplicar si la app reintenta)
  const ultima = sh.getLastRow();
  const existentes = new Set();
  if (ultima > 1) {
    sh.getRange(2, 1, ultima - 1, 1).getValues().forEach(f => existentes.add(String(f[0])));
  }

  // Encabezados actuales; se agregan las columnas base que falten y los campos nuevos de la plantilla
  let cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const nuevas = [];
  base.forEach(c => { if (cab.indexOf(c) === -1 && nuevas.indexOf(c) === -1) nuevas.push(c); });
  (claves || []).forEach(c => { if (cab.indexOf(c) === -1 && nuevas.indexOf(c) === -1) nuevas.push(c); });   // los campos de la cartilla, en su orden
  regs.forEach(r => Object.keys(r.valores || r.conteos || {}).forEach(p => {
    if (cab.indexOf(p) === -1 && nuevas.indexOf(p) === -1) nuevas.push(p);
  }));
  if (nuevas.length) {
    asegurarTamano_(sh, 2, cab.length + nuevas.length);
    sh.getRange(1, cab.length + 1, 1, nuevas.length).setValues([nuevas]).setFontWeight("bold");
    cab = cab.concat(nuevas);
  }

  const ahora = new Date();
  const calculados = (campos || []).filter(c => c.tipo === "calculado" && c.formula);
  const filas = [];
  const ids = [];
  const rechazados = [];
  // Reservas ya registradas (placa + fecha de abastecimiento), solo para el módulo Soporte
  const reservadas = new Set();
  if (mod && mod.id === "soporte" && ultima > 1) {
    const ip = cab.indexOf("placa"), ifa = cab.indexOf("fecha_abastecimiento"), ier = cab.indexOf("estado_registro");
    if (ip >= 0 && ifa >= 0) {
      const tz = Session.getScriptTimeZone();
      const fx = v => v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : String(v);
      sh.getRange(2, 1, ultima - 1, cab.length).getValues().forEach(f => { if (ier < 0 || String(f[ier]) !== "ANULADO") reservadas.add(normPlaca_(f[ip]) + "|" + fx(f[ifa])); });
    }
  }
  regs.forEach(r => {
    const us = r._us || us0;                     // si viene de la recepción, se usan los permisos del evaluador que envió
    ids.push(r.id);                              // se confirma siempre, aunque ya existiera
    if (existentes.has(String(r.id))) return;
    existentes.add(String(r.id));
    if (mod && mod.id === "soporte") {              // reserva de combustible: columnas propias
      const nm = x => (x === undefined || x === null || x === "" || isNaN(Number(x))) ? (x === undefined ? "" : x) : Number(x);
      // La fecha de abastecimiento no puede ser anterior a la fecha de registro
      const ISO = /^\d{4}-\d{2}-\d{2}$/;
      if (ISO.test(String(r.fecha || "")) && ISO.test(String(r.fecha_abastecimiento || "")) && String(r.fecha_abastecimiento) < String(r.fecha)) {
        existentes.delete(String(r.id));
        ids.pop();
        rechazados.push({ id: r.id, motivo: "La fecha de abastecimiento (" + r.fecha_abastecimiento + ") no puede ser anterior a la fecha de registro (" + r.fecha + ")" });
        return;
      }
      // Una misma placa no puede tener dos reservas el mismo día (sin importar quién la registre ni desde qué celular)
      const clave = normPlaca_(r.placa) + "|" + String(r.fecha_abastecimiento || "");
      if (reservadas.has(clave)) {
        existentes.delete(String(r.id));
        ids.pop();                                  // no se confirma como guardada
        rechazados.push({ id: r.id, motivo: "La placa " + r.placa + " ya tiene una reserva para el " + r.fecha_abastecimiento });
        return;
      }
      reservadas.add(clave);
      const v = {
        id: r.id, fecha_registro: r.fecha, hora: r.hora, usuario: r.usuario || "", registrado_por: r.evaluador || "",
        placa: r.placa || "", conductor: r.conductor || "", tipo_unidad: r.tipo_unidad || "",
        sub_fundo: r.sub_fundo || "", area: r.area || "", centro_costo: r.centro_costo || "", tipo_combustible: r.tipo_combustible || "", cod_sap: r.cod_sap || "",
        km: nm(r.km),
        fecha_abastecimiento: r.fecha_abastecimiento || "", galones: nm(r.galones), observaciones: r.obs || "",
        latitud: r.lat === undefined ? "" : r.lat, longitud: r.lon === undefined ? "" : r.lon, precision_m: r.prec === undefined ? "" : r.prec, corrige_a: r.corrige_a || "",
        alerta_permiso: (us.rol === "admin" || us.plantillas.indexOf(COMB_ID) >= 0) ? "" : "SI",
        enviado_por: us.usuario, recibido: ahora
      };
      filas.push(cab.map(c => v[c] === undefined ? "" : v[c]));
      return;
    }
    const vals = r.valores || r.conteos || {};
    calculados.forEach(c => { vals[c.clave] = calcFormula_(c.formula, vals); });      // el servidor repite la cuenta: el dato no depende del celular
    // Los datos nunca se pierden: si el registro es de un sub fundo o plantilla sin permiso
    // (por ejemplo, se quitó el acceso mientras el celular estaba sin señal), se guarda y se marca.
    // Un registro guardado en el celular por la versión anterior (sin sub fundo) no se marca.
    const permitido = us.rol === "admin" || r.sub_fundo === undefined ||
      (us.subfundos.indexOf(String(r.sub_fundo || "")) >= 0 && us.plantillas.indexOf(String(r.plantilla_id || "")) >= 0);
    const valores = {
      id: r.id, fecha: r.fecha, hora: r.hora, usuario: r.usuario || "", evaluador: r.evaluador,
      plantilla: r.plantilla_nombre || "", version_plantilla: r.plantilla_version || "",
      campana: r.campana || "", sede: r.sede || "", cultivo: r.cultivo || "", sub_fundo: r.sub_fundo || "",
      fundo: r.fundo, modulo: r.modulo || "", lote: r.lote, turno: r.turno || "", valvula: r.valvula || "",
      pep: r.pep || "", variedad: r.variedad || "", etapa: r.etapa || "", planta: r.planta,
      dias_desde_inicio_campana: r.dias_campana === undefined ? "" : r.dias_campana,
      semana_cultivo: r.semana_cultivo === undefined ? "" : r.semana_cultivo,
      latitud: r.lat, longitud: r.lon, precision_m: r.prec,
      total_conteos: r.total_conteos !== undefined ? r.total_conteos : (r.total === undefined ? "" : r.total),
      observaciones: r.obs, alerta_permiso: permitido ? "" : "SI", enviado_por: us.usuario, recibido: r._recibido ? new Date(r._recibido) : ahora,
      corrige_a: r.corrige_a || ""
    };
    Object.keys(vals).forEach(p => valores[p] = vals[p]);
    filas.push(cab.map(c => valores[c] === undefined ? "" : valores[c]));
  });

  if (filas.length) {
    const desde = sh.getLastRow() + 1;
    asegurarTamano_(sh, desde + filas.length - 1, cab.length);
    if (mod && mod.id === "soporte") {      // placa, fundo, centro de costo, código SAP…: texto, para no perder ceros ni convertir fechas
      COMB_TEXTO.concat(["fecha_abastecimiento"]).forEach(c => { const k = cab.indexOf(c); if (k >= 0) sh.getRange(desde, k + 1, filas.length, 1).setNumberFormat("@"); });
    }
    sh.getRange(desde, 1, filas.length, cab.length).setValues(filas);
  }
  return { ids: ids, nuevos: filas.length, rechazados: rechazados };
}

/* ============================ DESCARGA POR RANGO DE FECHAS ============================ */

// Devuelve las filas de UNA cartilla entre dos fechas (inclusive) para que la app arme el CSV.
// d: { plantilla_id, desde, hasta, anulados (true para incluir las ANULADAS) }
const MAX_EXPORTAR = 20000;
function valorExportar_(v) {
  if (v instanceof Date) {
    return v.getFullYear() < 1950 ? Utilities.formatDate(v, tz_(), "HH:mm:ss") : Utilities.formatDate(v, tz_(), "yyyy-MM-dd");
  }
  return v === null || v === undefined ? "" : String(v);
}
function exportar_(d) {
  d = d || {};
  procesarRecepcion_();            // lo recién enviado debe estar ya en la hoja de la cartilla
  const desde = fechaValida_(String(d.desde || "")) ? String(d.desde) : "";
  const hasta = fechaValida_(String(d.hasta || "")) ? String(d.hasta) : "";
  if (!desde || !hasta) return fallo_("Indica la fecha desde y hasta");
  if (hasta < desde) return fallo_("La fecha hasta no puede ser anterior a la fecha desde");
  const pid = String(d.plantilla_id || "");
  const p = pid === COMB_ID ? PLA_COMBUSTIBLE : (plantillas_().find(x => x.id === pid) || null);
  if (!p) return fallo_("La cartilla ya no existe");
  const mod = modulo_(p.mod_eval) || MODULOS[0];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = null, propia = false;
  if (!mod.fija) {
    const g = PropertiesService.getScriptProperties().getProperty("hoja_" + p.id);
    sh = g ? ss.getSheetByName(g) : null;
    propia = !!sh;
  }
  if (!sh) sh = hojaExistente_(p, mod);
  if (!sh || sh.getLastRow() < 2) return { ok: true, cabecera: [], filas: [], total: 0, cartilla: p.nombre, modulo: mod.nombre, desde: desde, hasta: hasta, sin_hoja: !sh };
  const n = sh.getLastRow(), nc = sh.getLastColumn();
  const cab = sh.getRange(1, 1, 1, nc).getValues()[0].map(String);
  const sop = mod.id === "soporte";
  const iF = cab.indexOf(sop ? "fecha_registro" : "fecha");
  if (iF < 0) return fallo_("La hoja de la cartilla no tiene columna de fecha");
  const iE = cab.indexOf("estado_registro"), iP = cab.indexOf("plantilla");
  // 1) se lee solo la columna de fechas para ubicar las filas del rango
  const fechas = sh.getRange(2, iF + 1, n - 1, 1).getValues();
  let a = -1, b = -1;
  for (let i = 0; i < fechas.length; i++) {
    const fe = fechaTxt_(fechas[i][0]);
    if (fe >= desde && fe <= hasta) { if (a < 0) a = i; b = i; }
  }
  if (a < 0) return { ok: true, cabecera: cab, filas: [], total: 0, cartilla: p.nombre, modulo: mod.nombre, desde: desde, hasta: hasta };
  // 2) se leen solo las filas entre la primera y la última coincidencia
  const bloque = sh.getRange(2 + a, 1, b - a + 1, nc).getValues();
  const filas = [];
  let anulados = 0;
  for (let i = 0; i < bloque.length; i++) {
    const f = bloque[i], fe = fechaTxt_(f[iF]);
    if (fe < desde || fe > hasta) continue;
    if (!propia && !sop && iP >= 0 && f[iP] !== "" && normTxt_(f[iP]) !== normTxt_(p.nombre)) continue;   // hoja compartida por varias cartillas (versión 8)
    if (iE >= 0 && String(f[iE]) === "ANULADO") { anulados++; if (!d.anulados) continue; }
    filas.push(f.map(valorExportar_));
  }
  const truncado = filas.length > MAX_EXPORTAR;
  if (truncado) return fallo_("El rango tiene " + filas.length + " registros (máximo " + MAX_EXPORTAR + " por descarga). Elige un rango más corto.");
  return { ok: true, cabecera: cab, filas: filas, total: filas.length, anulados_omitidos: d.anulados ? 0 : anulados,
           cartilla: p.nombre, modulo: mod.nombre, desde: desde, hasta: hasta };
}

/* ============================ SUPERVISIÓN ============================ */

// Resumen de actividad entre dos fechas (por defecto, hoy): quién registró, cuánto, a qué hora y en qué cartilla.
// Lee solo el final de cada hoja (las últimas 4000 filas) para no demorar.
function supervision_(d) {
  procesarRecepcion_();
  const hoy = hoy_();
  const desde = fechaValida_(String(d.desde || "")) ? String(d.desde) : hoy;
  let hasta = fechaValida_(String(d.hasta || "")) ? String(d.hasta) : hoy;
  if (hasta < desde) hasta = desde;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const fuentes = [];
  const agregar = (sh, mod) => { if (sh && !fuentes.some(x => x.sh === sh)) fuentes.push({ sh: sh, mod: mod }); };
  plantillas_().forEach(p => {
    const g = props.getProperty("hoja_" + p.id);
    if (g) agregar(ss.getSheetByName(g), modulo_(p.mod_eval) || MODULOS[0]);
  });
  MODULOS.forEach(m => {
    let sh = ss.getSheetByName(m.hoja);
    if (!sh && m.id === "fitosanidad") sh = ss.getSheetByName(HOJA_VIEJA);
    agregar(sh, m);
  });
  const porUsuario = {}, porCartilla = {};
  let total = 0, anulados = 0, alertas = 0, truncado = false;
  fuentes.forEach(fu => {
    const sh = fu.sh, n = sh.getLastRow();
    if (n < 2) return;
    const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const ix = c => cab.indexOf(c);
    const sop = fu.mod.id === "soporte";
    const iF = ix(sop ? "fecha_registro" : "fecha"), iU = ix("usuario"), iN = ix(sop ? "registrado_por" : "evaluador");
    const iH = ix("hora"), iE = ix("estado_registro"), iP = ix("plantilla"), iA = ix("alerta_permiso");
    if (iF < 0 || iU < 0) return;
    const ini = Math.max(2, n - 3999);
    const filas = sh.getRange(ini, 1, n - ini + 1, cab.length).getValues();
    if (ini > 2 && filas.length && fechaTxt_(filas[0][iF]) > desde) truncado = true;
    filas.forEach(f => {
      const fe = fechaTxt_(f[iF]);
      if (fe < desde || fe > hasta) return;
      if (iE >= 0 && String(f[iE]) === "ANULADO") { anulados++; return; }
      const u = String(f[iU]).trim().toLowerCase();
      const cart = fu.mod.nombre + " - " + (sop ? "Reserva de combustible" : (iP >= 0 && f[iP] ? String(f[iP]) : "Sin cartilla"));
      const x = porUsuario[u] = porUsuario[u] || { usuario: u, nombre: iN >= 0 ? String(f[iN]) : u, registros: 0, ultima: "", cartillas: {} };
      x.registros++;
      x.cartillas[cart] = (x.cartillas[cart] || 0) + 1;
      const marca = fe + " " + (iH >= 0 ? String(f[iH]).slice(0, 5) : "");
      if (marca > x.ultima) x.ultima = marca;
      porCartilla[cart] = (porCartilla[cart] || 0) + 1;
      if (iA >= 0 && String(f[iA]) === "SI") alertas++;
      total++;
    });
  });
  const activos = usuarios_().filter(u => u.activo && u.rol === "evaluador");
  return {
    ok: true, desde: desde, hasta: hasta, total: total, anulados: anulados, alertas: alertas, truncado: truncado,
    por_usuario: Object.keys(porUsuario).map(k => porUsuario[k]).sort((a, b) => b.registros - a.registros),
    por_cartilla: Object.keys(porCartilla).map(k => ({ cartilla: k, registros: porCartilla[k] })).sort((a, b) => b.registros - a.registros),
    sin_actividad: activos.filter(u => !porUsuario[u.usuario]).map(u => ({ usuario: u.usuario, nombre: u.nombre })),
    evaluadores_activos: activos.length,
    recepcion_pendientes: recepcionEstado_().n
  };
}
