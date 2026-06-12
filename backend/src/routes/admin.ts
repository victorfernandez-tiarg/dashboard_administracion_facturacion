import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { getPool } from "../db";

export const adminRouter = Router();
adminRouter.use(requireAdmin as any);

// Listar usuarios
adminRouter.get("/usuarios", async (_req: AuthRequest, res: Response) => {
  const db = getPool();
  const { rows } = await db.query("SELECT id, username, role, restricciones, created_at FROM usuarios ORDER BY id");
  res.json(rows);
});

// Crear usuario
adminRouter.post("/usuarios", async (req: AuthRequest, res: Response) => {
  const { username, password, role, restricciones } = req.body as { username: string; password: string; role: string; restricciones?: any };
  if (!username || !password) { res.status(400).json({ error: "username y password requeridos" }); return; }
  try {
    const db = getPool();
    const hash = await bcrypt.hash(password, 12);
    const restr = {
      cc: Array.isArray(restricciones?.cc) ? restricciones.cc : [],
      dv: Array.isArray(restricciones?.dv) ? restricciones.dv : [],
      clientes: Array.isArray(restricciones?.clientes) ? restricciones.clientes : [],
      empresas: Array.isArray(restricciones?.empresas) ? restricciones.empresas : [],
    };
    const { rows } = await db.query(
      "INSERT INTO usuarios (username, password_hash, role, restricciones) VALUES ($1, $2, $3, $4) RETURNING id, username, role, restricciones",
      [username.trim(), hash, role || "user", JSON.stringify(restr)]
    );
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "El usuario ya existe" }); return; }
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// Actualizar restricciones
adminRouter.put("/usuarios/:id/restricciones", async (req: AuthRequest, res: Response) => {
  const { restricciones } = req.body as { restricciones: { cc: string[]; dv: string[]; clientes: string[]; empresas: string[] } };
  if (!restricciones) { res.status(400).json({ error: "restricciones requeridas" }); return; }
  const restr = {
    cc: Array.isArray(restricciones.cc) ? restricciones.cc : [],
    dv: Array.isArray(restricciones.dv) ? restricciones.dv : [],
    clientes: Array.isArray(restricciones.clientes) ? restricciones.clientes : [],
    empresas: Array.isArray(restricciones.empresas) ? restricciones.empresas : [],
  };
  const db = getPool();
  await db.query("UPDATE usuarios SET restricciones = $1 WHERE id = $2", [JSON.stringify(restr), req.params.id]);
  res.json({ ok: true });
});

// Cambiar contraseña
adminRouter.put("/usuarios/:id/password", async (req: AuthRequest, res: Response) => {
  const { password } = req.body as { password: string };
  if (!password) { res.status(400).json({ error: "password requerido" }); return; }
  const db = getPool();
  const hash = await bcrypt.hash(password, 12);
  await db.query("UPDATE usuarios SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);
  res.json({ ok: true });
});

// Eliminar usuario
adminRouter.delete("/usuarios/:id", async (req: AuthRequest, res: Response) => {
  const db = getPool();
  await db.query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// Obtener permisos
adminRouter.get("/permisos", async (_req: AuthRequest, res: Response) => {
  const db = getPool();
  const { rows } = await db.query("SELECT data FROM permisos LIMIT 1");
  res.json(rows[0]?.data || { superusers: ["admin"], users: {} });
});

// Guardar permisos
adminRouter.put("/permisos", async (req: AuthRequest, res: Response) => {
  const db = getPool();
  const exists = await db.query("SELECT COUNT(*) FROM permisos");
  if (parseInt(exists.rows[0].count) > 0) {
    await db.query("UPDATE permisos SET data = $1", [JSON.stringify(req.body)]);
  } else {
    await db.query("INSERT INTO permisos (data) VALUES ($1)", [JSON.stringify(req.body)]);
  }
  res.json({ ok: true });
});
