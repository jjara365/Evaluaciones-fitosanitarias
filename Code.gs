/**
 * RECEPTOR CENTRAL de evaluaciones de campo (versión 6: módulos).
 * Se pega en Google Sheets: Extensiones > Apps Script.
 *
 * Hojas que maneja (se crean solas):
 *   - "Usuarios":   DNI, nombre, rol, usuario, clave cifrada, estatus y accesos (sub fundos y plantillas)
 *   - "Maestra":    programa de producción (sede, cultivo, sub fundo, fundo, módulo, lote, turno, válvula...)
 *   - "Umbrales":   maestra de umbrales (grupo, variable, ítem, umbral, órgano, semana de cultivo, campaña)
 *   - "Plantillas": formularios de evaluación definidos por el administrador (cada uno pertenece a un módulo)
 *   - "Fundos" y "Unidades de negocio": catálogos del módulo Agrícola
 *   - "Registros_Fitosanidad", "Registros_Riego", "Registros_Fenología", "Registros_Calidad":
 *     evaluaciones enviadas desde los celulares, una hoja por módulo de evaluación
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
const HOJA_UNI  = "Unidades de negocio";
const HOJA_FUN  = "Fundos";

// Módulos de evaluación (el módulo "Agrícola" es de administración y no recibe registros)
const MODULOS = [
  { id: "fitosanidad", nombre: "Fitosanidad", hoja: "Registros_Fitosanidad" },
  { id: "riego",       nombre: "Riego",       hoja: "Registros_Riego" },
  { id: "fenologia",   nombre: "Fenología",   hoja: "Registros_Fenología" },
  { id: "calidad",     nombre: "Calidad",     hoja: "Registros_Calidad" }
];
function modulo_(id) {
  const n = normTxt_(id);
  for (let i = 0; i < MODULOS.length; i++) if (normTxt_(MODULOS[i].id) === n || normTxt_(MODULOS[i].nombre) === n) return MODULOS[i];
  return null;
}

// Catálogos del módulo Agrícola
const UNI_HEAD = ["Unidad de negocio","Estado","id"];
const FUN_HEAD = ["Unidad de negocio","Sede","Sub_Fundo","Fundo","Estado","id"];

// Columnas fijas de Registros. Los campos de la plantilla se agregan solos a la derecha.
const BASE = ["id","fecha","hora","usuario","evaluador","plantilla","version_plantilla","campana",
              "sede","cultivo","sub_fundo","fundo","modulo","lote","turno","valvula","pep","variedad","etapa",
              "planta","dias_desde_inicio_campana","latitud","longitud","precision_m","total_conteos",
              "observaciones","alerta_permiso","enviado_por","recibido"];
const RESERVADAS = BASE.concat(["maestra_id","plantilla_id"]);

// Usuarios: DNI, nombre completo, rol, usuario abreviado, clave (salt+hash), estatus, accesos
const USR_COLS = ["DNI","Nombre completo","Rol","Usuario","salt","hash","Estatus","Sub fundos","Plantillas","Creado"];
const ESTATUS  = ["ACTIVO","CERRADO"];

// Maestra (programa de producción): este es el orden de las columnas; "id" va al final (uso interno de la app)
const MAE_HEAD = ["Sede","Cultivo","Sub_Fundo","Fundo","Módulo","Lote","Turno","Válvula","Área","Plantas","Densidad",
                  "Variedad","Etapa","Inicio de campaña","Inicio de cosecha","Cierre de campaña","Campaña","PEP",
                  "Estado Campaña","id"];
const MAE_KEYS = ["sede","cultivo","sub_fundo","fundo","modulo","lote","turno","valvula","area","plantas","densidad",
                  "variedad","etapa","inicio_campana","inicio_cosecha","cierre_campana","campana","pep",
                  "estado","id"];
const SEDES   = ["CARAZ","ICA","NEPEÑA","NAZCA","CASCAS"];
const ETAPAS  = ["M","I"];
const ESTADOS = ["ACTIVO","CERRADO"];

// Umbrales
const UMB_HEAD = ["Grupo","Variable","Ítem","Umbral","Órgano evaluado","Semana de cultivo","Campaña","id"];
const GRUPOS   = ["Benéficos","Plagas","Enfermedades"];
const ORGANOS  = ["Brote","Planta","Flores","Baya","Cobertura"];

// Plantillas
const PLA_COLS = ["id","nombre","version","activa","campos","actualizado","Módulo de evaluación"];
const TIPOS = ["conteo","entero","decimal","texto","lista","si_no","fecha"];

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

    if (d.accion === "login") return salida(login_(d));

    const us = autenticar_(d.token);
    if (!us) return salida({ ok: false, error: "sesion" });

    switch (d.accion) {
      case "sync":
        return salida(sync_(d, us));
      case "config_obtener":
        return salida(configObtener_(d, us));
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
      case "unidad_guardar":
      case "unidad_eliminar":
      case "fundo_guardar":
      case "fundo_eliminar":
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
  const us = usuarios_().find(x => x.usuario === t.u);
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
  return sh;
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

// Densidad = plantas entre área; PEP = Fundo/Módulo/Lote
function completarCalculados_(o) {
  o.densidad = (o.area !== "" && o.area > 0 && o.plantas !== "") ? Math.round(o.plantas / o.area * 100) / 100 : "";
  o.pep = [o.fundo, o.modulo, o.lote].join("/");
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
      sede: limpiar_(f[0]), cultivo: limpiar_(f[1]), sub_fundo: limpiar_(f[2]), fundo: limpiar_(f[3]),
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
  sh.getRange("A:C").setNumberFormat("@");
  sh.getRange("E:E").setNumberFormat("@");
  sh.getRange("G:H").setNumberFormat("@");
  sh.getRange(1, 1, 1, UMB_HEAD.length).setValues([UMB_HEAD]).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function hojaUmbrales_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_UMB);
  if (!sh) {
    sh = ss.insertSheet(HOJA_UMB);
    formatoUmbrales_(sh);
  }
  return sh;
}

function umbrales_() {
  const sh = hojaUmbrales_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, UMB_HEAD.length).getValues()
    .filter(f => String(f[7]) !== "")
    .map(f => ({
      grupo: limpiar_(f[0]), variable: limpiar_(f[1]), item: limpiar_(f[2]),
      umbral: f[3] === "" ? "" : Number(f[3]), organo: limpiar_(f[4]),
      semana: f[5] === "" ? "" : Number(f[5]), campana: limpiar_(f[6]), id: String(f[7])
    }));
}

function umbralesEscribir_(lista) {
  const sh = hojaUmbrales_();
  const previas = Math.max(sh.getLastRow() - 1, 0);
  asegurarTamano_(sh, Math.max(lista.length, previas) + 1, UMB_HEAD.length);
  const m = lista.map(o => [o.grupo, o.variable, o.item, o.umbral, o.organo, o.semana, o.campana, o.id]);
  // si hay menos filas que antes (se eliminó alguna), se limpian las que sobran
  for (let i = lista.length; i < previas; i++) m.push(["", "", "", "", "", "", "", ""]);
  if (m.length) sh.getRange(2, 1, m.length, UMB_HEAD.length).setValues(m);
}

function claveUmb_(o) {
  return [o.grupo, o.variable, o.item, o.organo, o.semana, o.campana].map(x => limpiar_(x).toLowerCase()).join("|");
}

function validarUmbral_(o) {
  const grupo = canon_(o.grupo, GRUPOS);
  if (grupo === null) return { error: "Grupo no válido (usa: " + GRUPOS.join(", ") + ")" };
  const organo = canon_(o.organo, ORGANOS);
  if (organo === null) return { error: "Órgano evaluado no válido (usa: " + ORGANOS.join(", ") + ")" };
  const f = { grupo: grupo, variable: limpiar_(o.variable), item: limpiar_(o.item), organo: organo, campana: limpiar_(o.campana) };
  const um = numTxt_(o.umbral), se = numTxt_(o.semana);
  const falta = [];
  if (!f.grupo) falta.push("grupo");
  if (!f.variable) falta.push("variable");
  if (!f.item) falta.push("ítem");
  if (um === "") falta.push("umbral");
  if (!f.organo) falta.push("órgano evaluado");
  if (se === "") falta.push("semana de cultivo");
  if (!f.campana) falta.push("campaña");
  if (falta.length) return { error: "Falta: " + falta.join(", ") };
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
  if (lista.some(x => (!previo || x.id !== previo.id) && claveUmb_(x) === k)) return fallo_("Ya existe un umbral igual (mismo grupo, variable, ítem, órgano, semana y campaña)");
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

function unidades_() {
  return catLeer_(HOJA_UNI, UNI_HEAD).map(f => ({
    nombre: limpiar_(f[0]), estado: String(f[1]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[2]) }));
}
function unidadesEscribir_(l) { catEscribir_(HOJA_UNI, UNI_HEAD, l.map(x => [x.nombre, x.estado, x.id])); }
function fundos_() {
  return catLeer_(HOJA_FUN, FUN_HEAD).map(f => ({
    unidad: limpiar_(f[0]), sede: limpiar_(f[1]), sub_fundo: limpiar_(f[2]), fundo: limpiar_(f[3]),
    estado: String(f[4]).trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ACTIVO", id: String(f[5]) }));
}
function fundosEscribir_(l) { catEscribir_(HOJA_FUN, FUN_HEAD, l.map(x => [x.unidad, x.sede, x.sub_fundo, x.fundo, x.estado, x.id])); }

function unidadGuardar_(f) {
  f = f || {};
  const lista = unidades_();
  const previa = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previa) return fallo_("La unidad de negocio ya no existe");
  const nombre = limpiar_(f.nombre);
  if (!nombre) return fallo_("Falta: unidad de negocio");
  const estado = canon_(f.estado || "ACTIVO", ESTADOS);
  if (!estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  if (lista.some(x => (!previa || x.id !== previa.id) && normTxt_(x.nombre) === normTxt_(nombre)))
    return fallo_("Ya existe esa unidad de negocio");
  if (previa) {
    lista[lista.findIndex(x => x.id === previa.id)] = { nombre: nombre, estado: estado, id: previa.id };
    if (previa.nombre !== nombre) {          // los fundos siguen a su unidad si se le cambia el nombre
      const fl = fundos_();
      let cambio = false;
      fl.forEach(x => { if (x.unidad === previa.nombre) { x.unidad = nombre; cambio = true; } });
      if (cambio) fundosEscribir_(fl);
    }
  } else lista.push({ nombre: nombre, estado: estado, id: Utilities.getUuid() });
  unidadesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}
function unidadEliminar_(id) {
  const lista = unidades_();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("La unidad de negocio ya no existe");
  if (fundos_().some(x => x.unidad === lista[i].nombre)) return fallo_("Hay fundos con esta unidad de negocio: cámbialos o elimínalos primero");
  lista.splice(i, 1);
  unidadesEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}

function fundoGuardar_(f) {
  f = f || {};
  const lista = fundos_();
  const previo = f.id ? (lista.find(x => x.id === String(f.id)) || null) : null;
  if (f.id && !previo) return fallo_("El fundo ya no existe");
  const u = unidades_().find(x => normTxt_(x.nombre) === normTxt_(f.unidad));
  if (!limpiar_(f.unidad)) return fallo_("Falta: unidad de negocio");
  if (!u) return fallo_("La unidad de negocio no existe: créala primero");
  const sede = canon_(f.sede, SEDES);
  if (sede === null) return fallo_("Sede no válida (usa: " + SEDES.join(", ") + ")");
  const estado = canon_(f.estado || "ACTIVO", ESTADOS);
  if (!estado) return fallo_("Estado no válido (usa ACTIVO o CERRADO)");
  const o = { unidad: u.nombre, sede: sede, sub_fundo: limpiar_(f.sub_fundo), fundo: limpiar_(f.fundo), estado: estado };
  const falta = [];
  if (!o.sede) falta.push("sede");
  if (!o.sub_fundo) falta.push("sub fundo");
  if (!o.fundo) falta.push("fundo");
  if (falta.length) return fallo_("Falta: " + falta.join(", "));
  const k = x => [x.sede, x.sub_fundo, x.fundo].map(normTxt_).join("|");
  if (lista.some(x => (!previo || x.id !== previo.id) && k(x) === k(o))) return fallo_("Ya existe ese fundo en esa sede y sub fundo");
  if (previo) { o.id = previo.id; lista[lista.findIndex(x => x.id === previo.id)] = o; }
  else { o.id = Utilities.getUuid(); lista.push(o); }
  fundosEscribir_(lista);
  return { ok: true, version: subirVersion_() };
}
function fundoEliminar_(id) {
  const lista = fundos_();
  const i = lista.findIndex(x => x.id === String(id || ""));
  if (i < 0) return fallo_("El fundo ya no existe");
  lista.splice(i, 1);
  fundosEscribir_(lista);
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
  } else if (String(sh.getRange(1, PLA_COLS.length, 1, 1).getValues()[0][0]) === "") {
    // Hoja de la versión 5: se agrega la columna del módulo y todo lo existente es de Fitosanidad
    const n = sh.getLastRow();
    sh.getRange(1, PLA_COLS.length, 1, 1).setValues([[PLA_COLS[PLA_COLS.length - 1]]]).setFontWeight("bold");
    if (n > 1) {
      const col = [];
      for (let i = 2; i <= n; i++) col.push(["fitosanidad"]);
      sh.getRange(2, PLA_COLS.length, n - 1, 1).setValues(col);
    }
    subirVersion_();
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
      return { fila: i + 2, id: String(f[0]), nombre: String(f[1]), version: Number(f[2]) || 1,
               activa: String(f[3]).trim().toUpperCase() === "SI", campos: campos,
               mod_eval: m ? m.id : "fitosanidad" };
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
    ayuda: limpiar_(c.ayuda), unidad: limpiar_(c.unidad), recordar: !!c.recordar, activo: c.activo !== false
  };
}

function validarPlantilla_(p, previa) {
  const nombre = limpiar_(p.nombre);
  if (!nombre) return { error: "Falta el nombre de la plantilla" };
  const campos = (Array.isArray(p.campos) ? p.campos : []).map(normCampo_);
  if (!campos.length) return { error: "La plantilla debe tener al menos un campo" };
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
    if (previa) {
      const a = previa.campos.find(x => x.clave === c.clave);
      if (a && a.tipo !== c.tipo) return { error: "No se puede cambiar el tipo de «" + c.nombre + "»: ocúltalo y crea un campo nuevo" };
    }
  }
  if (previa) {
    const faltan = previa.campos.filter(a => !campos.some(c => c.clave === a.clave));
    if (faltan.length) return { error: "No se pueden eliminar campos ya guardados (ocúltalos): " + faltan.map(x => x.nombre).join(", ") };
  }
  if (!campos.some(c => c.activo)) return { error: "Debe haber al menos un campo visible" };
  return { nombre: nombre, campos: campos };
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
  if (!mo) return fallo_("Elige el módulo de la plantilla (" + MODULOS.map(x => x.nombre).join(", ") + ")");
  if (lista.some(x => (!previa || x.id !== previa.id) && x.nombre.toLowerCase() === v.nombre.toLowerCase()))
    return fallo_("Ya existe una plantilla con ese nombre");

  const sh = hojaPlantillas_();
  const activa = p.activa === false ? "NO" : "SI";
  const json = JSON.stringify(v.campos);
  if (previa) {
    sh.getRange(previa.fila, 1, 1, PLA_COLS.length)
      .setValues([[previa.id, v.nombre, previa.version + 1, activa, json, new Date(), mo.id]]);
    return { ok: true, id: previa.id, plantilla_version: previa.version + 1, version: subirVersion_() };
  }
  const id = Utilities.getUuid();
  asegurarTamano_(sh, sh.getLastRow() + 1, PLA_COLS.length);
  sh.appendRow([id, v.nombre, 1, activa, json, new Date(), mo.id]);
  return { ok: true, id: id, plantilla_version: 1, version: subirVersion_() };
}

/* ============================ CONFIGURACIÓN PARA LOS CELULARES ============================ */

// El administrador recibe todo. El evaluador recibe solo las válvulas ACTIVAS de los sub fundos
// que se le asignaron y solo las plantillas activas que se le asignaron.
function configObtener_(d, us) {
  const v = versionCfg_();
  if (Number(d.version) === v) return { ok: true, cambio: false, version: v };
  let maestra = maestra_();
  let pl = plantillas_().map(p => ({ id: p.id, nombre: p.nombre, version: p.version, activa: p.activa, campos: p.campos, mod_eval: p.mod_eval }));
  let umb = [], fun = [], uni = [];
  if (us.rol === "admin") {
    umb = umbrales_();
    fun = fundos_();
    uni = unidades_();
  } else {
    maestra = maestra.filter(x => x.estado === "ACTIVO" && us.subfundos.indexOf(x.sub_fundo) >= 0);
    pl = pl.filter(p => p.activa && us.plantillas.indexOf(p.id) >= 0).map(p => {
      p.campos = p.campos.filter(c => c.activo !== false);
      return p;
    });
  }
  return { ok: true, cambio: true, version: v, maestra: maestra, plantillas: pl, umbrales: umb, fundos: fun, unidades: uni };
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
    case "umbral_guardar":    return umbralGuardar_(d.umbral);
    case "umbral_importar":   return umbralImportar_(d.filas);
    case "umbral_eliminar":   return umbralEliminar_(d.id);
    case "unidad_guardar":    return unidadGuardar_(d.fila);
    case "unidad_eliminar":   return unidadEliminar_(d.id);
    case "fundo_guardar":     return fundoGuardar_(d.fila);
    case "fundo_eliminar":    return fundoEliminar_(d.id);
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
  sh = ss.insertSheet(mod.hoja);
  asegurarTamano_(sh, 2, BASE.length);   // una hoja nueva trae 26 columnas y aquí hay más
  sh.getRange(1, 1, 1, BASE.length).setValues([BASE]).setFontWeight("bold");
  sh.setFrozenRows(1);
  // Texto en id/fecha/hora y en campaña…etapa: así "01" o "1-2" no se convierten en número o fecha
  sh.getRange("A:C").setNumberFormat("@");
  sh.getRange("H:S").setNumberFormat("@");
  return sh;
}

// Cada registro va a la hoja del módulo de su plantilla (el servidor decide, no el celular).
function sync_(d, us) {
  const regs = Array.isArray(d.registros) ? d.registros : [];
  const pls = {};
  plantillas_().forEach(p => pls[p.id] = p.mod_eval);
  const grupos = {};
  regs.forEach(r => {
    const m = modulo_(pls[String(r.plantilla_id || "")] || r.mod_eval) || MODULOS[0];
    (grupos[m.id] = grupos[m.id] || { mod: m, regs: [] }).regs.push(r);
  });
  const ids = [];
  let nuevos = 0;
  Object.keys(grupos).forEach(k => {
    const g = syncHoja_(hojaRegistros_(grupos[k].mod), grupos[k].regs, us);
    g.ids.forEach(x => ids.push(x));
    nuevos += g.nuevos;
  });
  // Token renovado: mientras el celular envíe datos, la sesión no vence
  return { ok: true, ids: ids, nuevos: nuevos, token: crearToken_(us.usuario, us.rol) };
}

function syncHoja_(sh, regs, us) {
  // IDs ya recibidos (para no duplicar si la app reintenta)
  const ultima = sh.getLastRow();
  const existentes = new Set();
  if (ultima > 1) {
    sh.getRange(2, 1, ultima - 1, 1).getValues().forEach(f => existentes.add(String(f[0])));
  }

  // Encabezados actuales; se agregan las columnas base que falten y los campos nuevos de la plantilla
  let cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const nuevas = [];
  BASE.forEach(c => { if (cab.indexOf(c) === -1 && nuevas.indexOf(c) === -1) nuevas.push(c); });
  regs.forEach(r => Object.keys(r.valores || r.conteos || {}).forEach(p => {
    if (cab.indexOf(p) === -1 && nuevas.indexOf(p) === -1) nuevas.push(p);
  }));
  if (nuevas.length) {
    asegurarTamano_(sh, 2, cab.length + nuevas.length);
    sh.getRange(1, cab.length + 1, 1, nuevas.length).setValues([nuevas]).setFontWeight("bold");
    cab = cab.concat(nuevas);
  }

  const ahora = new Date();
  const filas = [];
  const ids = [];
  regs.forEach(r => {
    ids.push(r.id);                              // se confirma siempre, aunque ya existiera
    if (existentes.has(String(r.id))) return;
    existentes.add(String(r.id));
    const vals = r.valores || r.conteos || {};
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
      latitud: r.lat, longitud: r.lon, precision_m: r.prec,
      total_conteos: r.total_conteos !== undefined ? r.total_conteos : (r.total === undefined ? "" : r.total),
      observaciones: r.obs, alerta_permiso: permitido ? "" : "SI", enviado_por: us.usuario, recibido: ahora
    };
    Object.keys(vals).forEach(p => valores[p] = vals[p]);
    filas.push(cab.map(c => valores[c] === undefined ? "" : valores[c]));
  });

  if (filas.length) {
    const desde = sh.getLastRow() + 1;
    asegurarTamano_(sh, desde + filas.length - 1, cab.length);
    sh.getRange(desde, 1, filas.length, cab.length).setValues(filas);
  }
  return { ids: ids, nuevos: filas.length };
}
