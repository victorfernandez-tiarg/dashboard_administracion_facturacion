import * as XLSX from "xlsx";
import { getPool } from "../../db";

const AGING_LABELS = ["Al día", "1–30 días", "31–60 días", "61–90 días", "+90 días"];

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date((val - 25569) * 86400 * 1000);
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? "0").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function calcAging(diasVencido: number): string {
  if (diasVencido <= 0) return "Al día";
  if (diasVencido <= 30) return "1–30 días";
  if (diasVencido <= 60) return "31–60 días";
  if (diasVencido <= 90) return "61–90 días";
  return "+90 días";
}

function normalizarNombre(nombre: string): string {
  return nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

interface ProcessCCOptions { isComposicion?: boolean }

export async function procesarCC(buffer: Buffer, opts: ProcessCCOptions = {}): Promise<{ filas: number }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const db = getPool();
  const hoy = new Date();

  if (opts.isComposicion) {
    // Procesar archivo de composición de saldos
    return await procesarComposicion(wb, db, hoy);
  }

  // Detectar tipo de archivo: movimientos vs saldos
  const sheet1 = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet1);

  if (rows.length === 0) throw new Error("El archivo no contiene datos");

  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map((k) => k.toLowerCase());
  const hasMovimientos = keys.some((k) => k.includes("debe") || k.includes("haber"));

  if (hasMovimientos) {
    return await procesarMovimientos(rows, db);
  } else {
    return await procesarSaldos(rows, db, hoy);
  }
}

async function procesarSaldos(rows: Record<string, unknown>[], db: ReturnType<typeof getPool>, hoy: Date): Promise<{ filas: number }> {
  await db.query("TRUNCATE TABLE cc_saldos");

  const insert = `
    INSERT INTO cc_saldos (cliente, saldo_actual, saldo_vencido, dias_vencido, aging, centro_costo_principal)
    VALUES ($1,$2,$3,$4,$5,$6)
  `;

  let count = 0;
  for (const r of rows) {
    const cliente = String(r["Cliente"] ?? r["cliente"] ?? "").trim();
    if (!cliente) continue;

    const saldoActual = toNum(r["Saldo actual"] ?? r["saldo_actual"] ?? r["Saldo"] ?? 0);
    const fechaVenc = parseDate(r["Fecha vencimiento"] ?? r["fecha_vencimiento"]);
    const diasVencido = fechaVenc ? Math.max(0, Math.floor((hoy.getTime() - fechaVenc.getTime()) / 86400000)) : 0;
    const saldoVencido = diasVencido > 0 ? saldoActual : 0;
    const aging = calcAging(saldoVencido > 0 ? diasVencido : 0);
    const centro = String(r["Centro de costo"] ?? r["centro_costo"] ?? r["Nivel 1 dimensión"] ?? "").trim();

    await db.query(insert, [cliente, saldoActual, saldoVencido, diasVencido, aging, centro]);
    count++;
  }

  await db.query(
    `INSERT INTO etl_meta (key, value, updated_at) VALUES ('cc_ultima_actualizacion', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify({ filas: count, timestamp: new Date().toISOString() })]
  );

  return { filas: count };
}

async function procesarMovimientos(rows: Record<string, unknown>[], db: ReturnType<typeof getPool>): Promise<{ filas: number }> {
  await db.query("TRUNCATE TABLE cc_movimientos");

  const insert = `
    INSERT INTO cc_movimientos (cliente, tipo, fecha, fecha_vencimiento, documento, debe_ppal, haber_ppal, saldo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `;

  let count = 0;
  for (const r of rows) {
    const cliente = String(r["Cliente"] ?? "").trim();
    if (!cliente) continue;
    await db.query(insert, [
      cliente,
      String(r["Tipo"] ?? r["tipo"] ?? "").trim(),
      parseDate(r["Fecha"] ?? r["fecha"]),
      parseDate(r["Fecha vencimiento"] ?? r["fecha_vencimiento"]),
      String(r["Documento"] ?? "").trim(),
      toNum(r["Debe ppal"] ?? r["debe_ppal"] ?? 0),
      toNum(r["Haber ppal"] ?? r["haber_ppal"] ?? 0),
      toNum(r["Saldo"] ?? r["saldo"] ?? 0),
    ]);
    count++;
  }
  return { filas: count };
}

async function procesarComposicion(wb: XLSX.WorkBook, db: ReturnType<typeof getPool>, hoy: Date): Promise<{ filas: number }> {
  await db.query("TRUNCATE TABLE cc_composicion");
  let count = 0;

  const insert = `
    INSERT INTO cc_composicion (cliente, cliente_norm, centro_costo, saldo_abierto, venc_comp, documento_ref, dias_vencido_item)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `;

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
    for (const r of rows) {
      const clienteKey = Object.keys(r).find((k) => k.toLowerCase().includes("cliente") || k.toLowerCase().includes("razon"));
      const saldoKey = Object.keys(r).find((k) => k.toLowerCase().includes("saldo") || k.toLowerCase().includes("pendiente") || k.toLowerCase().includes("importe"));
      if (!clienteKey || !saldoKey) continue;

      const cliente = String(r[clienteKey] ?? "").trim();
      const saldo = toNum(r[saldoKey]);
      if (!cliente || saldo <= 0) continue;

      const vencKey = Object.keys(r).find((k) => k.toLowerCase().includes("venc"));
      const venc = vencKey ? parseDate(r[vencKey]) : null;
      const dias = venc ? Math.max(0, Math.floor((hoy.getTime() - venc.getTime()) / 86400000)) : 0;
      const centroKey = Object.keys(r).find((k) => k.toLowerCase().includes("centro") || k.toLowerCase().includes("nivel"));
      const docKey = Object.keys(r).find((k) => k.toLowerCase().includes("doc") || k.toLowerCase().includes("comprobante"));

      await db.query(insert, [
        cliente,
        normalizarNombre(cliente),
        centroKey ? String(r[centroKey] ?? "").trim() : "Sin centro",
        saldo,
        venc,
        docKey ? String(r[docKey] ?? "").trim() : "",
        dias,
      ]);
      count++;
    }
  }

  await db.query(
    `INSERT INTO etl_meta (key, value, updated_at) VALUES ('composicion_ultima_actualizacion', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify({ filas: count, timestamp: new Date().toISOString() })]
  );

  return { filas: count };
}
