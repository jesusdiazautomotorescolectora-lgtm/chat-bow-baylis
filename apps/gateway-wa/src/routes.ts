import { Router } from "express";
import { z } from "zod";
import { getTenantId } from "./tenancy.js";
import { getTenantState, sendImageFromUrl, sendText, startTenantSession } from "./baileys/manager.js";

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/session/start", async (req, res) => {
  const tenantId = getTenantId(req);
  await startTenantSession(tenantId);
  res.json({ ok: true });
});

router.get("/session/status", (req, res) => {
  const tenantId = getTenantId(req);
  const st = getTenantState(tenantId);
  res.json({ ok: true, status: st.status });
});

router.get("/session/qr", (req, res) => {
  const tenantId = getTenantId(req);
  const st = getTenantState(tenantId);
  res.json({ ok: true, status: st.status, qr: st.qrDataUrl });
});

router.post("/send/text", async (req, res) => {
  const tenantId = getTenantId(req);
  const body = z.object({
    to: z.string().min(3),
    text: z.string().min(1),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: body.error.flatten() });

  await sendText(tenantId, body.data.to, body.data.text);
  res.json({ ok: true });
});

router.post("/send/image", async (req, res) => {
  const tenantId = getTenantId(req);
  const body = z.object({
    to: z.string().min(3),
    image_url: z.string().url(),
    caption: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: body.error.flatten() });

  await sendImageFromUrl(tenantId, body.data.to, body.data.image_url, body.data.caption);
  res.json({ ok: true });
});
