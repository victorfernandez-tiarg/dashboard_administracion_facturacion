import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface Restricciones {
  cc: string[];       // linea_negocio permitidos (vacío = todos)
  dv: string[];       // dim_valor permitidos (vacío = todos)
  clientes: string[]; // clientes permitidos (vacío = todos)
  empresas: string[]; // empresas permitidas (vacío = todas)
}

export interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string; restricciones: Restricciones };
}

const defaultRestricciones = (): Restricciones => ({ cc: [], dv: [], clientes: [], empresas: [] });

function normalizeRestricciones(r?: Partial<Restricciones> | null): Restricciones {
  return {
    cc: Array.isArray(r?.cc) ? r!.cc : [],
    dv: Array.isArray(r?.dv) ? r!.dv : [],
    clientes: Array.isArray(r?.clientes) ? r!.clientes : [],
    empresas: Array.isArray(r?.empresas) ? r!.empresas : [],
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token requerido" });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
      id: number; username: string; role: string; restricciones?: Restricciones;
    };
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      restricciones: normalizeRestricciones(payload.restricciones || defaultRestricciones()),
    };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }
    next();
  });
}
