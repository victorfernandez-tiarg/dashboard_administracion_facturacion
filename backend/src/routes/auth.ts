import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../db";

export const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: "Usuario y contraseña requeridos" });
    return;
  }
  try {
    const db = getPool();
    const result = await db.query("SELECT * FROM usuarios WHERE username = $1", [username.trim()]);
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "12h" }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

authRouter.post("/setup", async (req: Request, res: Response) => {
  // Solo funciona si no hay usuarios → primer setup
  try {
    const db = getPool();
    const existing = await db.query("SELECT COUNT(*) FROM usuarios");
    if (parseInt(existing.rows[0].count) > 0) {
      res.status(403).json({ error: "Setup ya completado" });
      return;
    }
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: "Username y password requeridos" });
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    await db.query("INSERT INTO usuarios (username, password_hash, role) VALUES ($1, $2, 'admin')", [
      username.trim(), hash,
    ]);
    res.json({ ok: true, message: "Admin creado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});
