import { Request } from "express";

export function getTenantId(req: Request): string {
  const h = req.header("x-tenant-id") || req.query.tenant_id || (req.body?.tenant_id as string | undefined);
  if (!h || typeof h !== "string") {
    throw new Error("Missing tenant_id. Provide x-tenant-id header (recommended).");
  }
  return h;
}
