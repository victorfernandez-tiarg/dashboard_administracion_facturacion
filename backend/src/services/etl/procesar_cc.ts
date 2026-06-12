import * as XLSX from "xlsx";
import { getPool } from "../../db";

const AGING_LABELS = ["Al día", "1–30 días", "31–60 días", "61–90 días", "+90 días"];

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    // cellDates:true devuelve Date en UTC medianoche — ajustar para evitar desfase de zona horaria
    const d = new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate(), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") {
    // Serial de Excel: días desde 1900-01-00 (con el bug del año bisiesto de Lotus)
    const ms = (val - 25569) * 86400 * 1000;
    const raw = new Date(ms);
    // Reconstruir como mediodía UTC para evitar desfase
    const d = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate(), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  // Formato dd/mm/yyyy (Finnegans)
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(Date.UTC(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  // Si SheetJS ya devolvió un número JS, usarlo directo
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  // Si es string con formato argentino (1.234,56) → convertir
  const s = String(val).trim().replace(/[$ ]/g, "");
  // Detectar si usa coma como decimal: "198,20" o "1.234,56"
  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  if (hasCommaDecimal) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  // Formato estándar con punto decimal o sin decimales
  const n = parseFloat(s.replace(/,/g, ""));
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

/** Busca en un objeto la primera clave cuyo nombre (en minúsculas) sea IGUAL o contenga alguna de las palabras clave.
 * Primero prueba coincidencia exacta, luego parcial. */
function normColName(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCol(row: Record<string, unknown>, ...keywords: string[]): string | undefined {
  const keys = Object.keys(row);
  const normKeys = keys.map((k) => ({ raw: k, norm: normColName(k) }));
  const normKeywords = keywords.map((kw) => normColName(kw));
  // Primero: coincidencia exacta (ignorando mayúsculas/espacios)
  for (const kw of normKeywords) {
    const found = normKeys.find((k) => k.norm === kw);
    if (found) return found.raw;
  }
  // Luego: coincidencia parcial
  for (const kw of normKeywords) {
    const found = normKeys.find((k) => k.norm.includes(kw));
    if (found) return found.raw;
  }
  return undefined;
}

interface ProcessCCOptions { isComposicion?: boolean }

export async function procesarCC(buffer: Buffer, opts: ProcessCCOptions = {}): Promise<{ filas: number }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const db = getPool();
  const hoy = new Date();

  if (opts.isComposicion) {
    return await procesarComposicion(wb, db, hoy);
  }

  // Leer la primera hoja con datos
  let rows: Record<string, unknown>[] = [];
  for (const sheetName of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
    if (r.length > 0) { rows = r; break; }
  }

  if (rows.length === 0) throw new Error("El archivo no contiene datos");

  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map((k) => k.toLowerCase());

  // Detectar tipo: movimientos tienen columnas debe/haber
  const hasMovimientos = keys.some((k) => k.includes("debe") || k.includes("haber"));

  if (hasMovimientos) {
    return await procesarMovimientos(rows, db);
  } else {
    return await procesarSaldos(rows, db, hoy, Object.keys(firstRow));
  }
}

async function procesarSaldos(
  rows: Record<string, unknown>[],
  db: ReturnType<typeof getPool>,
  hoy: Date,
  columnasEncontradas: string[]
): Promise<{ filas: number }> {
  await db.query("TRUNCATE TABLE cc_saldos");

  const insert = `
    INSERT INTO cc_saldos (cliente, saldo_actual, saldo_vencido, dias_vencido, aging, centro_costo_principal)
    VALUES ($1,$2,$3,$4,$5,$6)
  `;

  let count = 0;
  for (const r of rows) {
    // Cliente: buscar por variantes comunes de Finnegans
    const clienteCol = findCol(r, "cliente", "razón social", "razon social", "nombre");
    const cliente = clienteCol ? String(r[clienteCol] ?? "").trim() : "";
    if (!cliente) continue;

    // Saldo actual
    const saldoCol = findCol(r, "saldo actual", "saldo corriente", "saldo_actual", "saldo");
    const saldoActual = saldoCol ? toNum(r[saldoCol]) : 0;

    // Saldo vencido explícito (si existe en el archivo)
    const saldoVencCol = findCol(r, "saldo vencido", "vencido", "deuda vencida");
    let saldoVencido = saldoVencCol ? toNum(r[saldoVencCol]) : 0;

    // Calcular por fecha si no hay columna explícita
    let diasVencido = 0;
    if (!saldoVencCol) {
      const fechaVencCol = findCol(r, "vencimiento", "fecha venc", "venc");
      const fechaVenc = fechaVencCol ? parseDate(r[fechaVencCol]) : null;
      diasVencido = fechaVenc ? Math.max(0, Math.floor((hoy.getTime() - fechaVenc.getTime()) / 86400000)) : 0;
      saldoVencido = diasVencido > 0 ? saldoActual : 0;
    } else {
      // Si hay columna explícita de días vencidos
      const diasCol = findCol(r, "días vencido", "dias vencido", "días de mora");
      diasVencido = diasCol ? Math.max(0, toNum(r[diasCol])) : (saldoVencido > 0 ? 1 : 0);
    }

    const aging = calcAging(saldoVencido > 0 ? (diasVencido || 1) : 0);
    const centroCol = findCol(r, "centro de costo", "centro_costo", "nivel 1", "linea", "línea");
    const centro = centroCol ? String(r[centroCol] ?? "").trim() : "";

    await db.query(insert, [cliente, saldoActual, saldoVencido, diasVencido, aging, centro]);
    count++;
  }

  if (count === 0) {
    throw new Error(
      `No se encontraron filas válidas. Columnas detectadas en el archivo: [${columnasEncontradas.join(", ")}]. ` +
      `Se esperan columnas con "cliente" y "saldo".`
    );
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
    const clienteCol = findCol(r, "cliente", "razón social", "razon social");
    const cliente = clienteCol ? String(r[clienteCol] ?? "").trim() : "";
    if (!cliente) continue;

    const tipoCol = findCol(r, "tipo", "comprobante");
    const fechaCol = findCol(r, "fecha emision", "fecha_emision") ??
      Object.keys(r).find((k) => k.toLowerCase().trim() === "fecha");
    const fechaVencCol = findCol(r, "vencimiento", "fecha venc", "fecha_vencimiento");
    const docCol = findCol(r, "número", "nro", "número doc", "documento");
    const debeCol = findCol(r, "debe");
    const haberCol = findCol(r, "haber");
    const saldoCol = findCol(r, "saldo");

    await db.query(insert, [
      cliente,
      tipoCol ? String(r[tipoCol] ?? "").trim() : "",
      fechaCol ? parseDate(r[fechaCol]) : null,
      fechaVencCol ? parseDate(r[fechaVencCol]) : null,
      docCol ? String(r[docCol] ?? "").trim() : "",
      debeCol ? toNum(r[debeCol]) : 0,
      haberCol ? toNum(r[haberCol]) : 0,
      saldoCol ? toNum(r[saldoCol]) : 0,
    ]);
    count++;
  }

  if (count === 0) {
    const cols = Object.keys(rows[0] ?? {});
    throw new Error(
      `No se encontraron movimientos válidos. Columnas detectadas: [${cols.join(", ")}]`
    );
  }

  await db.query(
    `INSERT INTO etl_meta (key, value, updated_at) VALUES ('cc_movimientos_ultima_actualizacion', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify({ filas: count, timestamp: new Date().toISOString() })]
  );

  // Calcular saldos agregados por cliente y poblar cc_saldos
  await db.query("TRUNCATE TABLE cc_saldos");
  await db.query(`
    INSERT INTO cc_saldos (cliente, saldo_actual, saldo_vencido, dias_vencido, aging, centro_costo_principal)
    SELECT
      cliente,
      GREATEST(SUM(debe_ppal) - SUM(haber_ppal), 0)::numeric AS saldo_actual,
      SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
               THEN GREATEST(debe_ppal - haber_ppal, 0) ELSE 0 END)::numeric AS saldo_vencido,
      COALESCE(MAX(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
                        THEN EXTRACT(DAY FROM NOW() - fecha_vencimiento) ELSE NULL END), 0)::int AS dias_vencido,
      CASE
        WHEN COALESCE(MAX(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
                               THEN EXTRACT(DAY FROM NOW() - fecha_vencimiento) ELSE NULL END), 0) <= 0 THEN 'Al día'
        WHEN COALESCE(MAX(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
                               THEN EXTRACT(DAY FROM NOW() - fecha_vencimiento) ELSE NULL END), 0) <= 30 THEN '1–30 días'
        WHEN COALESCE(MAX(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
                               THEN EXTRACT(DAY FROM NOW() - fecha_vencimiento) ELSE NULL END), 0) <= 60 THEN '31–60 días'
        WHEN COALESCE(MAX(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()
                               THEN EXTRACT(DAY FROM NOW() - fecha_vencimiento) ELSE NULL END), 0) <= 90 THEN '61–90 días'
        ELSE '+90 días'
      END AS aging,
      NULL AS centro_costo_principal
    FROM cc_movimientos
    GROUP BY cliente
    HAVING GREATEST(SUM(debe_ppal) - SUM(haber_ppal), 0) > 0
  `);

  return { filas: count };
}

async function procesarComposicion(wb: XLSX.WorkBook, db: ReturnType<typeof getPool>, hoy: Date): Promise<{ filas: number }> {
  await db.query("TRUNCATE TABLE cc_composicion");
  let count = 0;

  // Cuentas que NO son deuda de clientes (diferencia de cambio, bancos, etc.)
  const CUENTAS_EXCLUIR = ["diferencia", "dif. cbio", "dif cbio", "banco", "caja", "proveedores/deudores dif"];

  const insert = `
    INSERT INTO cc_composicion (cliente, cliente_norm, centro_costo, saldo_abierto, fecha_emision_comp, venc_comp, documento_ref, dias_vencido_item)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `;

  // Acumular todas las filas por cliente para calcular saldo neto
  const porCliente: Record<string, { rows: any[]; saldoNeto: number }> = {};

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
    if (rows.length === 0) continue;

    console.log("Columnas composicion:", Object.keys(rows[0]));
    if (rows[0]) {
      const sampleDocCol = Object.keys(rows[0]).find((k) => k.trim().toLowerCase() === "comprobante");
      console.log("docCol detectado:", sampleDocCol, "→ valor[0]:", rows[0][sampleDocCol ?? ""]);
    }

    for (const r of rows) {
      const clienteCol = findCol(r, "cliente", "razón social", "razon social", "nombre", "cuenta");
      const saldoCol = findCol(r, "importe", "saldo", "pendiente", "abierto");
      if (!clienteCol || !saldoCol) continue;

      const cliente = String(r[clienteCol] ?? "").trim();
      if (!cliente) continue;

      // Excluir filas de cuentas de diferencia de cambio / no-clientes
      const cuentaCol = findCol(r, "cuenta");
      const cuenta = cuentaCol ? String(r[cuentaCol] ?? "").toLowerCase() : "";
      if (CUENTAS_EXCLUIR.some((exc) => cuenta.includes(exc))) continue;

      const saldo = toNum(r[saldoCol]);

      const vencCol = findCol(
        r,
        "vencimiento",
        "fecha vencimiento",
        "fecha de vencimiento",
        "fecha_vencimiento",
        "fecha venc",
        "vto",
        "vto.",
        "venc"
      );
      const diasCol = findCol(r, "dias vencido", "días vencido", "dias de mora", "mora");
      const diasArchivo = diasCol ? Math.max(0, toNum(r[diasCol])) : 0;

      let venc = vencCol ? parseDate(r[vencCol]) : null;
      if (!venc && diasArchivo > 0) {
        // Fallback: si el archivo trae solo días vencidos, derivar fecha estimada de vencimiento.
        const base = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 12, 0, 0));
        base.setUTCDate(base.getUTCDate() - diasArchivo);
        venc = base;
      }
      const emisionCol = findCol(
        r,
        "fecha emision",
        "fecha de emision",
        "fecha emisión",
        "fecha de emisión",
        "fecha_emision",
        "fecha comprobante",
        "fch emision",
        "emision"
      );
      const fechaEmision = emisionCol ? parseDate(r[emisionCol]) : null;
      const dias = venc
        ? Math.max(0, Math.floor((hoy.getTime() - venc.getTime()) / 86400000))
        : diasArchivo;
      const centroCol = findCol(r, "dimension valor", "dimensión valor", "centro", "nivel 1", "linea", "línea");

      // Buscar columna de número de comprobante (evitar columnas de fecha)
      const docColExact = Object.keys(r).find((k) => k.trim().toLowerCase() === "comprobante");
      const docColFallback = findCol(r, "número comprobante", "nro. comprobante", "documento");
      const docCol = docColExact ?? docColFallback;

      // Guard: si el valor es una fecha JS (SheetJS parseó como Date), descartarlo
      const rawDoc = docCol ? r[docCol] : undefined;
      const docStr = (rawDoc instanceof Date || !rawDoc)
        ? ""
        : String(rawDoc).trim();

      if (!porCliente[cliente]) porCliente[cliente] = { rows: [], saldoNeto: 0 };
      porCliente[cliente].saldoNeto += saldo;
      porCliente[cliente].rows.push({
        cliente,
        saldo,
        fechaEmision,
        venc,
        dias,
        centro: centroCol ? String(r[centroCol] ?? "").trim() : "",
        doc: docStr,
      });
    }
  }

  // Solo insertar clientes con saldo neto > 0 (tienen deuda real)
  for (const { saldoNeto, rows: clienteRows } of Object.values(porCliente)) {
    if (saldoNeto <= 0) continue; // cliente saldado, ignorar

    for (const item of clienteRows) {
      if (item.saldo <= 0) continue; // solo filas positivas (facturas abiertas)
      await db.query(insert, [
        item.cliente,
        normalizarNombre(item.cliente),
        item.centro || "Sin centro",
        item.saldo,
        item.fechaEmision,
        item.venc,
        item.doc,
        item.dias,
      ]);
      count++;
    }
  }

  if (count === 0) {
    const allKeys = Object.keys(Object.values(porCliente)[0]?.rows[0] ?? {});
    throw new Error(`No se encontraron deudas. Clientes procesados: ${Object.keys(porCliente).length}. Filas con saldo neto > 0: 0.`);
  }

  await db.query(
    `INSERT INTO etl_meta (key, value, updated_at) VALUES ('composicion_ultima_actualizacion', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify({ filas: count, timestamp: new Date().toISOString() })]
  );

  return { filas: count };
}

