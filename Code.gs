/**
 * RECEPTOR CENTRAL de evaluaciones de campo.
 * Se pega en Google Sheets: Extensiones > Apps Script.
 * Recibe los registros que envía la app, evita duplicados por ID
 * y los agrega a la hoja "Registros".
 */

// Debe ser IGUAL a la clave que pongas en index.html (SYNC.clave).
const CLAVE = "CAMBIA_ESTA_CLAVE";
const HOJA  = "Registros";

// Columnas fijas. Las plagas se agregan solas a la derecha, una columna por plaga.
const BASE = ["id","fecha","hora","evaluador","fundo","lote","organo","planta",
              "latitud","longitud","precision_m","total_individuos","observaciones","recibido"];

function doGet() {
  return salida({ ok: true, mensaje: "Receptor activo" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);                       // evita choques si varios envían a la vez
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida({ ok: false, error: "clave incorrecta" });
    const regs = Array.isArray(d.registros) ? d.registros : [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(HOJA);
    if (!sh) {
      sh = ss.insertSheet(HOJA);
      sh.getRange(1, 1, 1, BASE.length).setValues([BASE]).setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.getRange("B:C").setNumberFormat("@");   // fecha y hora como texto, para que Excel no las cambie
    }

    // IDs ya recibidos (para no duplicar si la app reintenta)
    const ultima = sh.getLastRow();
    const existentes = new Set();
    if (ultima > 1) {
      sh.getRange(2, 1, ultima - 1, 1).getValues().forEach(f => existentes.add(String(f[0])));
    }

    // Encabezados actuales, agregando columnas nuevas de plagas si aparecen
    let cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const nuevas = [];
    regs.forEach(r => Object.keys(r.conteos || {}).forEach(p => {
      if (cab.indexOf(p) === -1 && nuevas.indexOf(p) === -1) nuevas.push(p);
    }));
    if (nuevas.length) {
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
      const valores = {
        id: r.id, fecha: r.fecha, hora: r.hora, evaluador: r.evaluador, fundo: r.fundo,
        lote: r.lote, organo: r.organo, planta: r.planta, latitud: r.lat, longitud: r.lon,
        precision_m: r.prec, total_individuos: r.total, observaciones: r.obs, recibido: ahora
      };
      Object.keys(r.conteos || {}).forEach(p => valores[p] = r.conteos[p]);
      filas.push(cab.map(c => valores[c] === undefined ? "" : valores[c]));
    });

    if (filas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, filas.length, cab.length).setValues(filas);
    }
    return salida({ ok: true, ids: ids, nuevos: filas.length });
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
