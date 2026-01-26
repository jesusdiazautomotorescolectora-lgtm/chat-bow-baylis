import express from "express";
import cors from "cors";
import axios from "axios";
import { z } from "zod";
import { env } from "./env.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Phase 2: Meta webhook verification (GET) + receiving events (POST).
app.get("/webhooks/meta", (req, res) => {
  // TODO: implement verify using hub.mode, hub.verify_token, hub.challenge
  return res.status(501).json({ ok: false, todo: "Implement Meta webhook verification in Phase 2" });
});

app.post("/webhooks/meta", async (req, res) => {
  // TODO: map real Meta payload -> normalized inbound_message and forward to core-api
  // await axios.post(`${env.CORE_API_URL}/inbound/events`, {...})
  return res.json({ ok: true, received: true, todo: "Map Meta payloads in Phase 2" });
});

app.post("/send", async (req, res) => {
  const body = z.object({
    tenant_id: z.string().uuid(),
    channel: z.enum(["instagram", "messenger"]),
    to: z.string().min(3),
    text: z.string().optional(),
    image_url: z.string().url().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: body.error.flatten() });

  // TODO: send via Graph API
  return res.status(501).json({ ok: false, todo: "Implement Graph API send in Phase 2" });
});

app.listen(env.PORT, () => {
  console.log(`gateway-meta listening on :${env.PORT}`);
});
