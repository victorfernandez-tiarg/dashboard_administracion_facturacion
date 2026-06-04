import { Router, Response } from "express";
import multer from "multer";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { procesarFacturas } from "../services/etl/procesar";
import { procesarCC } from "../services/etl/procesar_cc";
import { sincronizarDrive } from "../services/drive";

export const etlRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

etlRouter.post(
  "/upload/facturacion",
  requireAuth as any,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "Archivo requerido" }); return; }
    try {
      const result = await procesarFacturas(req.file.buffer);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

etlRouter.post(
  "/upload/cc",
  requireAuth as any,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "Archivo requerido" }); return; }
    try {
      const result = await procesarCC(req.file.buffer);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

etlRouter.post(
  "/upload/composicion",
  requireAuth as any,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "Archivo requerido" }); return; }
    try {
      // Composición se procesa junto con CC
      const result = await procesarCC(req.file.buffer, { isComposicion: true });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

etlRouter.post(
  "/sync-drive",
  requireAdmin as any,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await sincronizarDrive();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
