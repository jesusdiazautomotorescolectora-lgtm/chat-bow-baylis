import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-panel-token") ?? "";
  if (!token || token !== env.BOT_ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.header("x-tenant-id") ?? "";
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "Missing x-tenant-id" });
  }
  // Attach to req for convenience
  (req as any).tenantId = tenantId;
  next();
}

export function setUtf8(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
}
