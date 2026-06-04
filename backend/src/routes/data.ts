import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getPool } from "../db";

export const dataRouter = Router();
dataRouter.use(requireAuth as any);

dataRouter.get("/facturas", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query("SELECT * FROM facturas ORDER BY fecha DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener facturas" });
  }
});

dataRouter.get("/cc-saldos", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query("SELECT * FROM cc_saldos ORDER BY saldo_actual DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener saldos" });
  }
});

dataRouter.get("/cc-movimientos", async (req: AuthRequest, res: Response) => {
  const { cliente } = req.query;
  try {
    const db = getPool();
    let query = "SELECT * FROM cc_movimientos ORDER BY fecha DESC";
    const params: string[] = [];
    if (cliente) {
      query = "SELECT * FROM cc_movimientos WHERE cliente = $1 ORDER BY fecha DESC";
      params.push(cliente as string);
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener movimientos" });
  }
});

dataRouter.get("/cc-composicion", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query("SELECT * FROM cc_composicion ORDER BY saldo_abierto DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener composición" });
  }
});

dataRouter.get("/kpis", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();

    const [factRes, saldosRes, vencRes] = await Promise.all([
      db.query(`
        SELECT
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as total_facturado,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as total_usd,
          COUNT(DISTINCT cliente) as total_clientes,
          SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as total_nc
        FROM facturas
        WHERE fecha >= NOW() - INTERVAL '90 days'
      `),
      db.query(`SELECT SUM(saldo_actual) as deuda_total FROM cc_saldos`),
      db.query(`SELECT SUM(saldo_vencido) as deuda_vencida FROM cc_saldos WHERE saldo_vencido > 0`),
    ]);

    const fact = factRes.rows[0];
    const deuda_total = parseFloat(saldosRes.rows[0].deuda_total || "0");
    const deuda_vencida = parseFloat(vencRes.rows[0].deuda_vencida || "0");
    const fact_90d = parseFloat(fact.total_facturado || "0");
    const venta_diaria = fact_90d / 90;
    const dso = venta_diaria > 0 ? deuda_total / venta_diaria : 0;

    res.json({
      total_facturado: fact_90d,
      total_usd: parseFloat(fact.total_usd || "0"),
      total_clientes: parseInt(fact.total_clientes || "0"),
      total_nc: parseFloat(fact.total_nc || "0"),
      deuda_total,
      deuda_vencida,
      overdue_ratio: deuda_total > 0 ? (deuda_vencida / deuda_total) * 100 : 0,
      dso: Math.round(dso),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular KPIs" });
  }
});

dataRouter.get("/facturacion-mensual", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        TO_CHAR(fecha, 'YYYY-MM') as mes,
        moneda_iso,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE -monto_total_ars END) as total,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE -monto_usd END) as total_usd,
        COUNT(*) as cantidad
      FROM facturas
      WHERE fecha IS NOT NULL
      GROUP BY mes, moneda_iso
      ORDER BY mes ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener facturación mensual" });
  }
});

dataRouter.get("/facturacion-por-cliente", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        cliente,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE -monto_total_ars END) as total_ars,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE -monto_usd END) as total_usd,
        COUNT(*) as cantidad_facturas,
        razon_social
      FROM facturas
      GROUP BY cliente, razon_social
      ORDER BY total_ars DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener facturación por cliente" });
  }
});

dataRouter.get("/aging-summary", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT aging, COUNT(*) as clientes, SUM(saldo_actual) as total
      FROM cc_saldos
      WHERE saldo_actual > 0
      GROUP BY aging
      ORDER BY aging
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener aging" });
  }
});

dataRouter.get("/meta", async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { rows } = await db.query("SELECT key, value, updated_at FROM etl_meta");
    const meta: Record<string, unknown> = {};
    rows.forEach((r) => { meta[r.key] = r.value; });
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener meta" });
  }
});
