import { Router, Response } from "express";
import { requireAuth, AuthRequest, Restricciones } from "../middleware/auth";
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

dataRouter.get("/cc-movimientos-clientes", async (req: AuthRequest, res: Response) => {
  const { cc_incluir, cc_excluir, dv_incluir, dv_excluir, cliente_incluir, cliente_excluir } = req.query;
  const r = req.user!.restricciones;
  try {
    const db = getPool();
    const conditions: string[] = [];
    const params: any[] = [];

    // Restricciones del usuario (siempre se aplican)
    if (r.cc.length) { params.push(r.cc); conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`) }
    if (r.dv.length) { params.push(r.dv); conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`) }
    if (r.clientes.length) { params.push(r.clientes); conditions.push(`cliente = ANY($${params.length}::text[])`) }

    if (cc_incluir) {
      params.push((cc_incluir as string).split(","));
      conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`);
    }
    if (cc_excluir) {
      params.push((cc_excluir as string).split(","));
      conditions.push(`cliente NOT IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`);
    }
    if (dv_incluir) {
      params.push((dv_incluir as string).split(","));
      conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`);
    }
    if (dv_excluir) {
      params.push((dv_excluir as string).split(","));
      conditions.push(`cliente NOT IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`);
    }
    if (cliente_incluir) {
      params.push((cliente_incluir as string).split(","));
      conditions.push(`cliente = ANY($${params.length}::text[])`);
    }
    if (cliente_excluir) {
      params.push((cliente_excluir as string).split(","));
      conditions.push(`cliente != ALL($${params.length}::text[])`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await db.query(`
      SELECT DISTINCT ON (cliente) cliente, saldo
      FROM cc_movimientos
      ${where}
      ORDER BY cliente ASC, fecha DESC, id DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes" });
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

dataRouter.get("/cc-composicion", async (req: AuthRequest, res: Response) => {
  const { cc_incluir, cc_excluir, dv_incluir, dv_excluir, cliente_incluir, cliente_excluir } = req.query;
  const r = req.user!.restricciones;
  try {
    const db = getPool();
    const conditions: string[] = [];
    const params: any[] = [];

    // Restricciones del usuario (siempre se aplican)
    if (r.cc.length) { params.push(r.cc); conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`) }
    if (r.dv.length) { params.push(r.dv); conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`) }
    if (r.clientes.length) { params.push(r.clientes); conditions.push(`cliente = ANY($${params.length}::text[])`) }

    if (cc_incluir) {
      params.push((cc_incluir as string).split(","));
      conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`);
    }
    if (cc_excluir) {
      params.push((cc_excluir as string).split(","));
      conditions.push(`cliente NOT IN (SELECT DISTINCT cliente FROM facturas WHERE linea_negocio = ANY($${params.length}))`);
    }
    if (dv_incluir) {
      params.push((dv_incluir as string).split(","));
      conditions.push(`cliente IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`);
    }
    if (dv_excluir) {
      params.push((dv_excluir as string).split(","));
      conditions.push(`cliente NOT IN (SELECT DISTINCT cliente FROM facturas WHERE dim_valor = ANY($${params.length}))`);
    }
    if (cliente_incluir) {
      params.push((cliente_incluir as string).split(","));
      conditions.push(`cliente = ANY($${params.length}::text[])`);
    }
    if (cliente_excluir) {
      params.push((cliente_excluir as string).split(","));
      conditions.push(`cliente != ALL($${params.length}::text[])`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await db.query(
      `SELECT * FROM cc_composicion ${where} ORDER BY saldo_abierto DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener composición" });
  }
});

dataRouter.get("/dim-valores", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const r = req.user!.restricciones;
    const conditions = ["dim_valor IS NOT NULL", "dim_valor != ''"];
    const params: any[] = [];
    if (r.dv.length > 0) { conditions.push(`dim_valor = ANY($1::text[])`); params.push(r.dv); }
    if (r.clientes.length > 0) { conditions.push(`cliente = ANY($${params.length + 1}::text[])`); params.push(r.clientes); }
    if (r.cc.length > 0) { conditions.push(`linea_negocio = ANY($${params.length + 1}::text[])`); params.push(r.cc); }
    const { rows } = await db.query(`SELECT DISTINCT dim_valor FROM facturas WHERE ${conditions.join(" AND ")} ORDER BY dim_valor`, params);
    res.json(rows.map((row: any) => row.dim_valor));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener dimensiones" });
  }
});

dataRouter.get("/centros-costo", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const r = req.user!.restricciones;
    const conditions = ["linea_negocio IS NOT NULL", "linea_negocio != ''"];
    const params: any[] = [];
    if (r.cc.length > 0) { conditions.push(`linea_negocio = ANY($1::text[])`); params.push(r.cc); }
    if (r.clientes.length > 0) { conditions.push(`cliente = ANY($${params.length + 1}::text[])`); params.push(r.clientes); }
    if (r.dv.length > 0) { conditions.push(`dim_valor = ANY($${params.length + 1}::text[])`); params.push(r.dv); }
    const { rows } = await db.query(`SELECT DISTINCT linea_negocio FROM facturas WHERE ${conditions.join(" AND ")} ORDER BY linea_negocio`, params);
    res.json(rows.map((row: any) => row.linea_negocio));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener centros de costo" });
  }
});

dataRouter.get("/clientes", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const r = req.user!.restricciones;
    const conditions = ["cliente IS NOT NULL", "cliente != ''"];
    const params: any[] = [];
    if (r.clientes.length > 0) { conditions.push(`cliente = ANY($1::text[])`); params.push(r.clientes); }
    if (r.cc.length > 0) { conditions.push(`linea_negocio = ANY($${params.length + 1}::text[])`); params.push(r.cc); }
    if (r.dv.length > 0) { conditions.push(`dim_valor = ANY($${params.length + 1}::text[])`); params.push(r.dv); }
    const { rows } = await db.query(`SELECT DISTINCT cliente FROM facturas WHERE ${conditions.join(" AND ")} ORDER BY cliente`, params);
    res.json(rows.map((row: any) => row.cliente));
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

function buildFacturasWhere(
  query: Record<string, any>,
  baseConditions: string[] = [],
  restricciones?: Restricciones
): { where: string; params: any[] } {
  const conditions = [...baseConditions];
  const params: any[] = [];
  let i = 1;

  // Aplicar restricciones del usuario primero (siempre se cumplen)
  const r = restricciones;
  if (r?.cc.length) { conditions.push(`linea_negocio = ANY($${i++}::text[])`); params.push(r.cc); }
  if (r?.dv.length) { conditions.push(`dim_valor = ANY($${i++}::text[])`); params.push(r.dv); }
  if (r?.clientes.length) { conditions.push(`cliente = ANY($${i++}::text[])`); params.push(r.clientes); }

  if (query.fecha_desde) {
    conditions.push(`fecha >= $${i++}::date`);
    params.push(`${query.fecha_desde}-01`);
  }
  if (query.fecha_hasta) {
    conditions.push(`fecha < ($${i++}::date + INTERVAL '1 month')`);
    params.push(`${query.fecha_hasta}-01`);
  }
  if (query.cc_incluir) {
    const list = (query.cc_incluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`linea_negocio = ANY($${i++}::text[])`);
      params.push(list);
    }
  }
  if (query.cc_excluir) {
    const list = (query.cc_excluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`(linea_negocio IS NULL OR linea_negocio != ALL($${i++}::text[]))`);
      params.push(list);
    }
  }
  if (query.dv_incluir) {
    const list = (query.dv_incluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`dim_valor = ANY($${i++}::text[])`);
      params.push(list);
    }
  }
  if (query.dv_excluir) {
    const list = (query.dv_excluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`(dim_valor IS NULL OR dim_valor != ALL($${i++}::text[]))`);
      params.push(list);
    }
  }
  if (query.cliente_incluir) {
    const list = (query.cliente_incluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`cliente = ANY($${i++}::text[])`);
      params.push(list);
    }
  }
  if (query.cliente_excluir) {
    const list = (query.cliente_excluir as string).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (list.length) {
      conditions.push(`(cliente IS NULL OR cliente != ALL($${i++}::text[]))`);
      params.push(list);
    }
  }
  if (query.cliente) {
    conditions.push(`cliente = $${i++}`);
    params.push(query.cliente as string);
  }
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

dataRouter.get("/kpis", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { where, params } = buildFacturasWhere(req.query as any, [], req.user?.restricciones);

    const [factRes, saldosRes, vencRes] = await Promise.all([
      db.query(`
        SELECT
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as total_facturado,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as total_usd,
          SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as total_nc,
          SUM(importe_pendiente) as pendiente_total
        FROM facturas ${where}
      `, params),
      db.query(`SELECT SUM(saldo_actual) as deuda_total FROM cc_saldos`),
      db.query(`SELECT SUM(saldo_vencido) as deuda_vencida FROM cc_saldos WHERE saldo_vencido > 0`),
    ]);

    const fact = factRes.rows[0];
    const deuda_total = parseFloat(saldosRes.rows[0].deuda_total || "0");
    const deuda_vencida = parseFloat(vencRes.rows[0].deuda_vencida || "0");
    const total_facturado = parseFloat(fact.total_facturado || "0");

    res.json({
      total_facturado,
      total_usd: parseFloat(fact.total_usd || "0"),
      total_nc: parseFloat(fact.total_nc || "0"),
      pendiente_total: parseFloat(fact.pendiente_total || "0"),
      deuda_total,
      deuda_vencida,
      overdue_ratio: deuda_total > 0 ? (deuda_vencida / deuda_total) * 100 : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular KPIs" });
  }
});

dataRouter.get("/facturacion-mix-cc", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { where, params } = buildFacturasWhere(req.query as any, ["fecha IS NOT NULL", "NOT es_nota_credito"], req.user?.restricciones);
    const { rows } = await db.query(`
      SELECT
        TO_CHAR(fecha, 'YYYY-MM') as mes,
        COALESCE(NULLIF(linea_negocio, ''), 'Sin clasificar') as linea_negocio,
        SUM(monto_total_ars) as total_ars
      FROM facturas
      ${where}
      GROUP BY TO_CHAR(fecha, 'YYYY-MM'), COALESCE(NULLIF(linea_negocio, ''), 'Sin clasificar')
      ORDER BY 1, 3 DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener mix por CC" });
  }
});

dataRouter.get("/facturacion-mensual", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { where, params } = buildFacturasWhere(req.query as any, ["fecha IS NOT NULL"], req.user?.restricciones);
    const { rows } = await db.query(`
      SELECT
        TO_CHAR(fecha, 'YYYY-MM') as mes,
        empresa,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as facturado_ars,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as facturado_usd,
        SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as nc_ars,
        COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as cantidad_facturas
      FROM facturas
      ${where}
      GROUP BY TO_CHAR(fecha, 'YYYY-MM'), empresa
      ORDER BY 1, 2
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener facturación mensual" });
  }
});

dataRouter.get("/facturacion-detalle-mes", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { mes, empresa, cc_incluir, cc_excluir, dv_incluir, dv_excluir } = req.query as Record<string, string>;
    if (!mes || !empresa) {
      return res.status(400).json({ error: "Parámetros requeridos: mes, empresa" });
    }

    const baseParams: any[] = [mes, empresa];
    let baseWhere = `TO_CHAR(fecha, 'YYYY-MM') = $1 AND empresa = $2`;
    if (cc_incluir) {
      const list = cc_incluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        baseWhere += ` AND linea_negocio = ANY($${baseParams.length + 1}::text[])`;
        baseParams.push(list);
      }
    } else if (cc_excluir) {
      const list = cc_excluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        baseWhere += ` AND (linea_negocio IS NULL OR linea_negocio != ALL($${baseParams.length + 1}::text[]))`;
        baseParams.push(list);
      }
    }
    if (dv_incluir) {
      const list = dv_incluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        baseWhere += ` AND dim_valor = ANY($${baseParams.length + 1}::text[])`;
        baseParams.push(list);
      }
    } else if (dv_excluir) {
      const list = dv_excluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        baseWhere += ` AND (dim_valor IS NULL OR dim_valor != ALL($${baseParams.length + 1}::text[]))`;
        baseParams.push(list);
      }
    }
    const { cliente: clienteMes } = req.query as Record<string, string>;
    if (clienteMes) {
      baseWhere += ` AND cliente = $${baseParams.length + 1}`;
      baseParams.push(clienteMes);
    }

    const [resumenRes, clientesRes, lineaRes] = await Promise.all([
      db.query(`
        SELECT
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as facturado_ars,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as facturado_usd,
          SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as nc_ars,
          SUM(importe_pendiente) as pendiente,
          COUNT(DISTINCT CASE WHEN NOT es_nota_credito THEN cliente END) as clientes_activos,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as cantidad_facturas
        FROM facturas WHERE ${baseWhere}
      `, baseParams),
      db.query(`
        SELECT
          cliente,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as ars,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as usd,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as facturas,
          SUM(importe_pendiente) as pendiente
        FROM facturas WHERE ${baseWhere}
        GROUP BY cliente ORDER BY ars DESC LIMIT 10
      `, baseParams),
      db.query(`
        SELECT
          COALESCE(NULLIF(linea_negocio, ''), 'Sin clasificar') as linea_negocio,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as ars,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as facturas
        FROM facturas WHERE ${baseWhere}
        GROUP BY COALESCE(NULLIF(linea_negocio, ''), 'Sin clasificar')
        ORDER BY ars DESC
      `, baseParams),
    ]);

    res.json({
      resumen: resumenRes.rows[0],
      top_clientes: clientesRes.rows,
      por_linea: lineaRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener detalle de mes" });
  }
});

dataRouter.get("/facturacion-cliente", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { cliente, fecha_desde, fecha_hasta, cc_incluir, cc_excluir, dv_incluir, dv_excluir } = req.query as Record<string, string>;
    if (!cliente) return res.status(400).json({ error: "Parámetro requerido: cliente" });

    const params: any[] = [cliente];
    let where = `cliente = $1`;
    let i = 2;
    if (fecha_desde) { where += ` AND fecha >= $${i++}::date`; params.push(`${fecha_desde}-01`); }
    if (fecha_hasta) { where += ` AND fecha < ($${i++}::date + INTERVAL '1 month')`; params.push(`${fecha_hasta}-01`); }
    if (cc_incluir) {
      const list = cc_incluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) { where += ` AND linea_negocio = ANY($${i++}::text[])`; params.push(list); }
    } else if (cc_excluir) {
      const list = cc_excluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) { where += ` AND (linea_negocio IS NULL OR linea_negocio != ALL($${i++}::text[]))`; params.push(list); }
    }
    if (dv_incluir) {
      const list = dv_incluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) { where += ` AND dim_valor = ANY($${i++}::text[])`; params.push(list); }
    } else if (dv_excluir) {
      const list = dv_excluir.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) { where += ` AND (dim_valor IS NULL OR dim_valor != ALL($${i++}::text[]))`; params.push(list); }
    }

    const [resumenRes, mensualRes, lineaRes, facturasRes] = await Promise.all([
      db.query(`
        SELECT
          empresa, razon_social,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as facturado_ars,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as facturado_usd,
          SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as nc_ars,
          SUM(importe_pendiente) as pendiente,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as cantidad_facturas
        FROM facturas WHERE ${where}
        GROUP BY empresa, razon_social ORDER BY facturado_ars DESC
      `, params),
      db.query(`
        SELECT
          TO_CHAR(fecha, 'YYYY-MM') as mes,
          empresa,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as facturado_ars,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE 0 END) as facturado_usd,
          SUM(CASE WHEN es_nota_credito THEN monto_total_ars ELSE 0 END) as nc_ars,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as cantidad_facturas
        FROM facturas WHERE ${where} AND fecha IS NOT NULL
        GROUP BY TO_CHAR(fecha, 'YYYY-MM'), empresa ORDER BY 1, 2
      `, params),
      db.query(`
        SELECT
          COALESCE(NULLIF(linea_negocio,''), 'Sin clasificar') as linea_negocio,
          SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE 0 END) as ars,
          COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as facturas
        FROM facturas WHERE ${where}
        GROUP BY COALESCE(NULLIF(linea_negocio,''), 'Sin clasificar')
        ORDER BY ars DESC
      `, params),
      db.query(`
        SELECT
          documento, numero, fecha, linea_negocio, dim_valor, condicion_pago, empresa,
          monto_total_ars, monto_usd, importe_pendiente, es_nota_credito, moneda_iso
        FROM facturas WHERE ${where}
        ORDER BY fecha DESC LIMIT 200
      `, params),
    ]);

    res.json({
      resumen: resumenRes.rows,
      mensual: mensualRes.rows,
      por_linea: lineaRes.rows,
      facturas: facturasRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener detalle de cliente" });
  }
});

dataRouter.get("/facturacion-por-cliente", async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { where, params } = buildFacturasWhere(req.query as any, [], req.user?.restricciones);
    const { rows } = await db.query(`
      SELECT
        cliente,
        empresa,
        razon_social,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_total_ars ELSE -monto_total_ars END) as total_ars,
        SUM(CASE WHEN NOT es_nota_credito THEN monto_usd ELSE -monto_usd END) as total_usd,
        COUNT(CASE WHEN NOT es_nota_credito THEN 1 END) as cantidad_facturas
      FROM facturas
      ${where}
      GROUP BY cliente, empresa, razon_social
      ORDER BY total_ars DESC
      LIMIT 50
    `, params);
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
