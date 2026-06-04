import { Pool } from "pg";

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "";
    pool = new Pool({
      connectionString: url.replace("postgres://", "postgresql://"),
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS facturas (
      id SERIAL PRIMARY KEY,
      documento TEXT, fecha DATE, cliente TEXT, empresa TEXT,
      razon_social TEXT, moneda_iso TEXT, es_nota_credito BOOLEAN,
      monto_total_ars NUMERIC, monto_neto_ars NUMERIC, monto_usd NUMERIC,
      linea_negocio TEXT, condicion_pago TEXT, producto TEXT,
      importe_pendiente NUMERIC, anio INT, mes INT
    );
    CREATE TABLE IF NOT EXISTS cc_saldos (
      id SERIAL PRIMARY KEY,
      cliente TEXT, saldo_actual NUMERIC, saldo_vencido NUMERIC,
      dias_vencido INT, aging TEXT, centro_costo_principal TEXT,
      saldo_composicion NUMERIC
    );
    CREATE TABLE IF NOT EXISTS cc_movimientos (
      id SERIAL PRIMARY KEY,
      cliente TEXT, tipo TEXT, fecha DATE, fecha_vencimiento DATE,
      documento TEXT, debe_ppal NUMERIC, haber_ppal NUMERIC, saldo NUMERIC
    );
    CREATE TABLE IF NOT EXISTS cc_composicion (
      id SERIAL PRIMARY KEY,
      cliente TEXT, cliente_norm TEXT, centro_costo TEXT,
      saldo_abierto NUMERIC, venc_comp DATE,
      documento_ref TEXT, dias_vencido_item INT
    );
    CREATE TABLE IF NOT EXISTS permisos (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ui_state (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS etl_meta (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Insertar fila inicial de permisos si no existe
  await db.query(`INSERT INTO permisos (data) SELECT '{"superusers":["admin"],"users":{}}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM permisos)`);

  console.log("✓ Base de datos inicializada");
}
