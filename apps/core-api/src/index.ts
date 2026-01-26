import express from "express";
import cors from "cors";
import http from "http";
import { env } from "./env.js";
import { initSocket } from "./socket.js";
import { inboundRouter } from "./routes/inbound.js";
import { apiRouter } from "./routes/api.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/inbound", inboundRouter);
app.use("/api", apiRouter);

const server = http.createServer(app);
initSocket(server, env.CORS_ORIGIN);

server.listen(env.PORT, () => {
  console.log(`core-api listening on :${env.PORT}`);
});
