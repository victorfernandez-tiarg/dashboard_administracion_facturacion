import * as XLSX from "xlsx";
import { getPool } from "../../db";

const MAPA_MONEDA: Record<string, string> = { Pesos: "ARS", Dólares: "USD", Dollars: "USD" };
const MAPA_EMPRESA: Record<string, string> = { "TIARG S.A.": "Local", "TIARG LLC": "Internacional" };
const NOTAS_CREDITO = [
  "Nota de Crédito de Ventas Electrónica",
  "FCE Nota de Crédito de Ventas Electrónica MIPymes",
];

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    const d = new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate(), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") {
    if (!XLSX.SSF.parse_date_code(val)) return null;
    const raw = new Date((val - 25569) * 86400 * 1000);
    const d = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(Date.UTC(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? "0").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export async function procesarFacturas(buffer: Buffer): Promise<{ filas: number }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames.find((s) => s.toLowerCase() === "hoja1") ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

  if (rows.length === 0) throw new Error("El archivo no contiene datos");

  // Log de columnas para diagnóstico
  console.log("Columnas Excel facturas:", Object.keys(rows[0]));

  const db = getPool();
  await db.query("TRUNCATE TABLE facturas");

  const insert = `
    INSERT INTO facturas
      (documento, fecha, cliente, empresa, razon_social, moneda_iso, es_nota_credito,
       monto_total_ars, monto_neto_ars, monto_usd, linea_negocio, condicion_pago,
       producto, importe_pendiente, anio, mes, dim_valor, numero)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
  `;

  let count = 0;
  // Detectar columna número de comprobante por nombre o posición (3ra columna)
  const colKeys = Object.keys(rows[0]);
  const NUMERO_KEYS = ["Comprobante", "Número", "Numero", "Nro. comprobante", "N° comprobante", "Nro", "N°", "numero"];
  const numeroKey = colKeys.find((k) => NUMERO_KEYS.some((n) => k.trim().toLowerCase() === n.toLowerCase()))
    ?? colKeys[2]; // fallback: 3ra columna
  console.log("Columna número detectada:", numeroKey);

  for (const r of rows) {
    const doc = String(r["Documento"] ?? "").trim();
    const numero = String(r[numeroKey] ?? "").trim();
    const fecha = parseDate(r["Fecha"]);
    const cliente = String(r["Cliente"] ?? "").trim();
    const empresa = String(r["Empresa"] ?? "").trim();
    const moneda = String(r["Moneda"] ?? "").trim();
    const esNC = NOTAS_CREDITO.includes(doc);
    const totalArs = toNum(r["Importe mon. principal"]);
    const netoArs = toNum(r["Gravado"]) + toNum(r["No gravado"]);
    const usd = toNum(r["Imp. usd"]);

    await db.query(insert, [
      doc,
      fecha,
      cliente,
      empresa,
      MAPA_EMPRESA[empresa] ?? empresa,
      MAPA_MONEDA[moneda] ?? moneda,
      esNC,
      totalArs,
      netoArs,
      usd,
      String(r["Nivel 1 dimensión"] ?? "").trim(),
      String(r["Condición pago"] ?? "").trim(),
      String(r["Producto"] ?? "").trim(),
      toNum(r["Importenetopendiente"]),
      fecha ? fecha.getFullYear() : null,
      fecha ? fecha.getMonth() + 1 : null,
      String(r["Dim. valor"] ?? r["Dim valor"] ?? r["dim_valor"] ?? "").trim(),
      numero,
    ]);
    count++;
  }

  // Actualizar meta
  await db.query(
    `INSERT INTO etl_meta (key, value, updated_at) VALUES ('facturas_ultima_actualizacion', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify({ filas: count, timestamp: new Date().toISOString() })]
  );

  return { filas: count };
}
