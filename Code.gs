/**
 * RECEPTOR CENTRAL de evaluaciones de campo (versión 4).
 * Se pega en Google Sheets: Extensiones > Apps Script.
 *
 * Hojas que maneja (se crean solas):
 *   - "Usuarios":   cuentas (usuario, nombre, rol, clave cifrada, activo)
 *   - "Maestra":    fundo / módulo / lote / turno / válvula, con área, plantas, poda, cosecha y campaña
 *   - "Plantillas": formularios de evaluación definidos por el administrador
 *   - "Registros":  evaluaciones enviadas desde los celulares
 *
 * Roles: "admin" (administra usuarios, maestra y plantillas) y "evaluador" (solo evalúa).
 * IMPORTANTE: administra Maestra y Plantillas desde la app, no editando las hojas a mano.
 */

const HOJA      = "Registros";
const HOJA_USR  = "Usuarios";
const HOJA_MAE  = "Maestra";
const HOJA_PLA  = "Plantillas";

// Columnas fijas de Registros. Los campos de la plantilla se agregan solos a la derecha.
const BASE = ["id","fecha","hora","usuario","evaluador","plantilla","version_plantilla","campana",
              "fundo","modulo","lote","turno","valvula","planta","dias_desde_poda",
              "latitud","longitud","precision_m","total_conteos","observaciones",
              "enviado_por","recibido"];
const RESERVADAS = BASE.concat(["maestra_id","plantilla_id"]);
const USR_COLS = ["usuario","nombre","rol","salt","hash","activo","creado"];
const MAE_COLS = ["id","campana","fundo","modulo","lote","turno","valvula","area_ha","plantas",
                  "fecha_poda","inicio_cosecha","estado","fecha_cierre"];
const PLA_COLS = ["id","nombre","version","activa","campos","actualizado"];
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

// Úsalo si cambiaste algo directamente en las hojas Maestra o Plantillas.
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
  const usuario = pedir("Usuario del administrador (minúsculas, sin espacios, ej. jhony)");
  if (usuario === null) return;
  const nombre = pedir("Nombre completo");
  if (nombre === null) return;
  const clave = pedir("Clave (mínimo " + MIN_CLAVE + " caracteres)");
  if (clave === null) return;
  const res = crearUsuario_(usuario, nombre, "admin", clave);
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
      case "usuario_crear":
      case "usuario_estado":
      case "usuario_clave":
      case "maestra_guardar":
      case "maestra_importar":
      case "lote_estado":
      case "plantilla_guardar":
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
function tz_() { return Session.getScriptTimeZone(); }
function hoy_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd"); }
function fechaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), "yyyy-MM-dd");
  return limpiar_(v);
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

// Devuelve el usuario si el token es válido Y la cuenta sigue activa (se consulta la hoja cada vez).
function autenticar_(token) {
  const t = leerToken_(token);
  if (!t) return null;
  const us = usuarios_().find(x => x.usuario === t.u);
  return us && us.activo ? us : null;
}

/* ============================ USUARIOS ============================ */

function hojaUsuarios_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_USR);
  if (!sh) {
    sh = ss.insertSheet(HOJA_USR);
    sh.getRange(1, 1, 1, USR_COLS.length).setValues([USR_COLS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:E").setNumberFormat("@");   // texto: evita que Sheets convierta claves cifradas en números
  }
  return sh;
}

function usuarios_() {
  const sh = hojaUsuarios_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, USR_COLS.length).getValues().map((f, i) => ({
    fila: i + 2,
    usuario: String(f[0]).trim().toLowerCase(),
    nombre: String(f[1]),
    rol: String(f[2]),
    salt: String(f[3]),
    hash: String(f[4]),
    activo: String(f[5]).trim().toUpperCase() === "SI"
  }));
}

function crearUsuario_(usuario, nombre, rol, clave) {
  usuario = String(usuario || "").trim().toLowerCase();
  nombre = String(nombre || "").trim();
  clave = String(clave || "");
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return { ok: false, error: "Usuario no válido: usa 3 a 30 letras minúsculas, números, punto, guion o guion bajo" };
  if (!nombre) return { ok: false, error: "Falta el nombre completo" };
  if (rol !== "admin" && rol !== "evaluador") return { ok: false, error: "Rol no válido" };
  if (clave.length < MIN_CLAVE) return { ok: false, error: "La clave debe tener al menos " + MIN_CLAVE + " caracteres" };
  if (usuarios_().some(x => x.usuario === usuario)) return { ok: false, error: "Ese usuario ya existe" };

  const salt = Utilities.getUuid().replace(/-/g, "");
  const sh = hojaUsuarios_();
  asegurarTamano_(sh, sh.getLastRow() + 1, USR_COLS.length);
  sh.appendRow([usuario, nombre, rol, salt, hashClave_(clave, salt), "SI", new Date()]);
  return { ok: true };
}

function login_(d) {
  const u = String(d.usuario || "").trim().toLowerCase();
  const clave = String(d.clave || "");
  const cache = CacheService.getScriptCache();
  const kf = "fallos_" + u;
  if (Number(cache.get(kf) || 0) >= MAX_FALLOS) return { ok: false, error: "bloqueado" };

  const us = usuarios_().find(x => x.usuario === u);
  if (!us || !us.activo || hashClave_(clave, us.salt) !== us.hash) {
    cache.put(kf, String(Number(cache.get(kf) || 0) + 1), BLOQUEO_SEG);
    return { ok: false, error: "credenciales" };
  }
  cache.remove(kf);
  return { ok: true, usuario: us.usuario, nombre: us.nombre, rol: us.rol, token: crearToken_(us.usuario, us.rol) };
}

/* ============================ MAESTRA ============================ */

function hojaMaestra_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_MAE);
  if (!sh) {
    sh = ss.insertSheet(HOJA_MAE);
    sh.getRange(1, 1, 1, MAE_COLS.length).setValues([MAE_COLS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:G").setNumberFormat("@");      // textos (ej. un lote "001" no pierde sus ceros)
    sh.getRange("J:M").setNumberFormat("@");      // fechas y estado como texto AAAA-MM-DD
  }
  return sh;
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
  return sh.getRange(2, 1, n - 1, MAE_COLS.length).getValues()
    .filter(f => String(f[0]) !== "")
    .map(f => ({
      id: String(f[0]),
      campana: limpiar_(f[1]), fundo: limpiar_(f[2]), modulo: limpiar_(f[3]),
      lote: limpiar_(f[4]), turno: limpiar_(f[5]), valvula: limpiar_(f[6]),
      area_ha: f[7] === "" ? "" : Number(f[7]),
      plantas: f[8] === "" ? "" : Number(f[8]),
      fecha_poda: fechaTxt_(f[9]), inicio_cosecha: fechaTxt_(f[10]),
      estado: String(f[11] || "ABIERTO").trim().toUpperCase() === "CERRADO" ? "CERRADO" : "ABIERTO",
      fecha_cierre: fechaTxt_(f[12])
    }));
}

function maestraEscribir_(lista) {
  const sh = hojaMaestra_();
  asegurarTamano_(sh, lista.length + 1, MAE_COLS.length);
  const m = lista.map(o => MAE_COLS.map(c => o[c] === undefined ? "" : o[c]));
  if (m.length) sh.getRange(2, 1, m.length, MAE_COLS.length).setValues(m);
}

function fechaValida_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validarFila_(o) {
  const f = {
    campana: limpiar_(o.campana), fundo: limpiar_(o.fundo), modulo: limpiar_(o.modulo),
    lote: limpiar_(o.lote), turno: limpiar_(o.turno), valvula: limpiar_(o.valvula),
    fecha_poda: fechaTxt_(o.fecha_poda), inicio_cosecha: fechaTxt_(o.inicio_cosecha)
  };
  const nombres = { campana: "campaña", fundo: "fundo", modulo: "módulo", lote: "lote", turno: "turno", valvula: "válvula" };
  const falta = Object.keys(nombres).filter(k => !f[k]).map(k => nombres[k]);
  if (falta.length) return { error: "Falta: " + falta.join(", ") };

  const num = v => (v === "" || v === undefined || v === null) ? "" : Number(v);
  f.area_ha = num(o.area_ha);
  f.plantas = num(o.plantas);
  if (f.area_ha !== "" && (isNaN(f.area_ha) || f.area_ha < 0)) return { error: "Área no válida" };
  if (f.plantas !== "" && (isNaN(f.plantas) || f.plantas < 0 || Math.floor(f.plantas) !== f.plantas)) return { error: "Plantas debe ser un número entero" };
  if (f.fecha_poda && !fechaValida_(f.fecha_poda)) return { error: "Fecha de poda no válida (usa AAAA-MM-DD)" };
  if (f.inicio_cosecha && !fechaValida_(f.inicio_cosecha)) return { error: "Fecha de inicio de cosecha no válida (usa AAAA-MM-DD)" };
  if (f.fecha_poda && f.inicio_cosecha && f.inicio_cosecha < f.fecha_poda) return { error: "La cosecha no puede iniciar antes de la poda" };
  return { fila: f };
}

function maestraGuardar_(o) {
  const v = validarFila_(o || {});
  if (v.error) return { ok: false, error: v.error };
  const f = v.fila, k = claveFila_(f);
  const lista = maestra_();
  if (o.id) {
    const i = lista.findIndex(x => x.id === String(o.id));
    if (i < 0) return { ok: false, error: "La fila ya no existe" };
    if (lista.some((x, j) => j !== i && claveFila_(x) === k)) return { ok: false, error: "Ya existe esa válvula en esa campaña" };
    f.id = lista[i].id; f.estado = lista[i].estado; f.fecha_cierre = lista[i].fecha_cierre;
    lista[i] = f;
  } else {
    if (lista.some(x => claveFila_(x) === k)) return { ok: false, error: "Ya existe esa válvula en esa campaña" };
    f.id = Utilities.getUuid(); f.estado = "ABIERTO"; f.fecha_cierre = "";
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
    const v = validarFila_(o);
    if (v.error) { errores.push({ n: o._n || n + 1, error: v.error }); return; }
    const f = v.fila, k = claveFila_(f);
    if (k in idx) {
      const i = idx[k];
      f.id = lista[i].id; f.estado = lista[i].estado; f.fecha_cierre = lista[i].fecha_cierre;
      lista[i] = f; actualizados++;
    } else {
      f.id = Utilities.getUuid(); f.estado = "ABIERTO"; f.fecha_cierre = "";
      idx[k] = lista.length; lista.push(f); nuevos++;
    }
  });
  if (nuevos || actualizados) maestraEscribir_(lista);
  return { ok: true, nuevos: nuevos, actualizados: actualizados, errores: errores,
           version: (nuevos || actualizados) ? subirVersion_() : versionCfg_() };
}

// Cierra o reabre TODAS las válvulas de un lote (dentro de una campaña).
function loteEstado_(d) {
  const estado = d.estado === "CERRADO" ? "CERRADO" : "ABIERTO";
  const k = claveLote_(d);
  const lista = maestra_();
  let n = 0;
  lista.forEach(x => {
    if (claveLote_(x) === k) {
      x.estado = estado;
      x.fecha_cierre = estado === "CERRADO" ? hoy_() : "";
      n++;
    }
  });
  if (!n) return { ok: false, error: "Lote no encontrado" };
  maestraEscribir_(lista);
  return { ok: true, filas: n, version: subirVersion_() };
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
                  JSON.stringify(plantillaInicial_()), new Date()]);
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
      return { fila: i + 2, id: String(f[0]), nombre: String(f[1]), version: Number(f[2]) || 1,
               activa: String(f[3]).trim().toUpperCase() === "SI", campos: campos };
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
    if (RESERVADAS.indexOf(c.clave) >= 0) return { error: "El nombre interno «" + c.clave + "» está reservado; cambia el nombre del campo" };
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
    if (!previa) return { ok: false, error: "La plantilla ya no existe" };
  }
  const v = validarPlantilla_(p, previa);
  if (v.error) return { ok: false, error: v.error };
  if (lista.some(x => (!previa || x.id !== previa.id) && x.nombre.toLowerCase() === v.nombre.toLowerCase()))
    return { ok: false, error: "Ya existe una plantilla con ese nombre" };

  const sh = hojaPlantillas_();
  const activa = p.activa === false ? "NO" : "SI";
  const json = JSON.stringify(v.campos);
  if (previa) {
    sh.getRange(previa.fila, 1, 1, PLA_COLS.length)
      .setValues([[previa.id, v.nombre, previa.version + 1, activa, json, new Date()]]);
    return { ok: true, id: previa.id, plantilla_version: previa.version + 1, version: subirVersion_() };
  }
  const id = Utilities.getUuid();
  asegurarTamano_(sh, sh.getLastRow() + 1, PLA_COLS.length);
  sh.appendRow([id, v.nombre, 1, activa, json, new Date()]);
  return { ok: true, id: id, plantilla_version: 1, version: subirVersion_() };
}

/* ============================ CONFIGURACIÓN PARA LOS CELULARES ============================ */

// Los evaluadores reciben solo lo abierto y activo; el administrador recibe todo.
function configObtener_(d, us) {
  const v = versionCfg_();
  if (Number(d.version) === v) return { ok: true, cambio: false, version: v };
  let maestra = maestra_();
  let pl = plantillas_().map(p => ({ id: p.id, nombre: p.nombre, version: p.version, activa: p.activa, campos: p.campos }));
  if (us.rol !== "admin") {
    maestra = maestra.filter(x => x.estado === "ABIERTO");
    pl = pl.filter(p => p.activa).map(p => {
      p.campos = p.campos.filter(c => c.activo !== false);
      return p;
    });
  }
  return { ok: true, cambio: true, version: v, maestra: maestra, plantillas: pl };
}

function accionAdmin_(d, admin) {
  switch (d.accion) {
    case "usuario_listar":
      return { ok: true, usuarios: usuarios_().map(x => ({ usuario: x.usuario, nombre: x.nombre, rol: x.rol, activo: x.activo })) };

    case "usuario_crear":
      return crearUsuario_(d.usuario, d.nombre, d.rol, d.clave);

    case "usuario_estado": {
      const u = usuarios_().find(x => x.usuario === String(d.usuario || "").toLowerCase());
      if (!u) return { ok: false, error: "Usuario no encontrado" };
      if (u.usuario === admin.usuario) return { ok: false, error: "No puedes desactivar tu propia cuenta" };
      hojaUsuarios_().getRange(u.fila, 6).setValue(d.activo ? "SI" : "NO");
      return { ok: true };
    }

    case "usuario_clave": {
      const u = usuarios_().find(x => x.usuario === String(d.usuario || "").toLowerCase());
      if (!u) return { ok: false, error: "Usuario no encontrado" };
      const clave = String(d.clave || "");
      if (clave.length < MIN_CLAVE) return { ok: false, error: "La clave debe tener al menos " + MIN_CLAVE + " caracteres" };
      const salt = Utilities.getUuid().replace(/-/g, "");
      hojaUsuarios_().getRange(u.fila, 4, 1, 2).setValues([[salt, hashClave_(clave, salt)]]);
      CacheService.getScriptCache().remove("fallos_" + u.usuario);
      return { ok: true };
    }

    case "maestra_guardar":   return maestraGuardar_(d.fila);
    case "maestra_importar":  return maestraImportar_(d.filas);
    case "lote_estado":       return loteEstado_(d);
    case "plantilla_guardar": return plantillaGuardar_(d.plantilla);
  }
  return { ok: false, error: "acción desconocida" };
}

/* ============================ REGISTROS ============================ */

function sync_(d, us) {
  const regs = Array.isArray(d.registros) ? d.registros : [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.getRange(1, 1, 1, BASE.length).setValues([BASE]).setFontWeight("bold");
    sh.setFrozenRows(1);
    // Texto en id/fecha/hora y en campaña…válvula: así "01" o "1-2" no se convierten en número o fecha
    sh.getRange("A:C").setNumberFormat("@");
    sh.getRange("H:M").setNumberFormat("@");
  }

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
    const valores = {
      id: r.id, fecha: r.fecha, hora: r.hora, usuario: r.usuario || "", evaluador: r.evaluador,
      plantilla: r.plantilla_nombre || "", version_plantilla: r.plantilla_version || "",
      campana: r.campana || "", fundo: r.fundo, modulo: r.modulo || "", lote: r.lote,
      turno: r.turno || "", valvula: r.valvula || "", planta: r.planta,
      dias_desde_poda: r.dias_poda === undefined ? "" : r.dias_poda,
      latitud: r.lat, longitud: r.lon, precision_m: r.prec,
      total_conteos: r.total_conteos !== undefined ? r.total_conteos : (r.total === undefined ? "" : r.total),
      observaciones: r.obs, enviado_por: us.usuario, recibido: ahora
    };
    Object.keys(vals).forEach(p => valores[p] = vals[p]);
    filas.push(cab.map(c => valores[c] === undefined ? "" : valores[c]));
  });

  if (filas.length) {
    const desde = sh.getLastRow() + 1;
    asegurarTamano_(sh, desde + filas.length - 1, cab.length);
    sh.getRange(desde, 1, filas.length, cab.length).setValues(filas);
  }
  // Token renovado: mientras el celular envíe datos, la sesión no vence
  return { ok: true, ids: ids, nuevos: filas.length, token: crearToken_(us.usuario, us.rol) };
}
