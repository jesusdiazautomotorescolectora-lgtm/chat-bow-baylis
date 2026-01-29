// src/index.ts
import "dotenv/config";

import express from "express";
import cors from "cors";
import http from "http";

import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { initSocket } from "./socket.js";
import { inboundRouter } from "./routes/inbound.js";
import { apiRouter } from "./routes/api.js";

const app = express();

// Body
app.use(express.json({ limit: "10mb" }));

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Health
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// DB ping (para diagnosticar Prisma/DB sin colgarte en /inbound/events)
app.get("/dbping", async (_req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    return res.status(200).json({ ok: true, result });
  } catch (e: any) {
    console.error("dbping failed", e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
});

// Routers
app.use("/inbound", inboundRouter);
app.use("/api", apiRouter);

// Default routes (evita “Cannot GET /” y “Cannot GET /api”)
app.get("/", (_req, res) => res.status(200).json({ ok: true, service: "omnicore-api" }));
app.get("/api", (_req, res) => res.status(200).json({ ok: true, service: "omnicore-api", scope: "api" }));

// Server + sockets
const server = http.createServer(app);
initSocket(server, env.CORS_ORIGIN);

// Listen (Railway)
const port = Number(env.PORT || process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`core-api listening on :${port}`);
});

// Optional: log shutdown (útil en Railway)
process.on("SIGTERM", async () => {
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
});
process.on("SIGINT", async () => {
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
});
