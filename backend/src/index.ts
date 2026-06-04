import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./routes/auth";
import { dataRouter } from "./routes/data";
import { etlRouter } from "./routes/etl";
import { adminRouter } from "./routes/admin";
import { initDb } from "./db";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/data", dataRouter);
app.use("/api/etl", etlRouter);
app.use("/api/admin", adminRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Servir el build de React en producción
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

(async () => {
  await initDb();
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
})();
