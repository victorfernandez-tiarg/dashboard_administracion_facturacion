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
  if (val instanceof Date) return val;
  if (typeof val === "number") return XLSX.SSF.parse_date_code(val) ? new Date((val - 25569) * 86400 * 1000) : null;
  const d = new Date(String(val));
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

  const db = getPool();
  await db.query("TRUNCATE TABLE facturas");

  const insert = `
    INSERT INTO facturas
      (documento, fecha, cliente, empresa, razon_social, moneda_iso, es_nota_credito,
       monto_total_ars, monto_neto_ars, monto_usd, linea_negocio, condicion_pago,
       producto, importe_pendiente, anio, mes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  `;

  let count = 0;
  for (const r of rows) {
    const doc = String(r["Documento"] ?? "").trim();
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
