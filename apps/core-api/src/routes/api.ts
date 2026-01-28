import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { getTenantId } from "../tenancy.js";
import { env } from "../env.js";
import axios from "axios";
import { io } from "../socket.js";

export const apiRouter = Router();

apiRouter.get("/inbox", async (req, res) => {
  const tenantId = getTenantId(req);
  const status = (req.query.status as string | undefined) ?? "open";
  const convos = await prisma.conversation.findMany({
    where: { tenantId, status: status as any },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
  res.json(convos);
});

apiRouter.get("/conversations/:id/messages", async (req, res) => {
  const tenantId = getTenantId(req);
  const convoId = req.params.id;
  const msgs = await prisma.message.findMany({
    where: { tenantId, conversationId: convoId },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  res.json(msgs);
});

const ReplySchema = z.object({
  text: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  // accept camelCase too (some clients send this)
  imageUrl: z.string().url().optional(),
  caption: z.string().optional(),
}).transform((v) => ({
  ...v,
  image_url: v.image_url ?? v.imageUrl,
}));

apiRouter.post("/conversations/:id/reply", async (req, res) => {
  const tenantId = getTenantId(req);
  const convoId = req.params.id;
  const body = ReplySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: body.error.flatten() });

  const convo = await prisma.conversation.findFirst({ where: { id: convoId, tenantId } });
  if (!convo) return res.status(404).json({ ok: false, error: "Conversation not found" });

  if (!body.data.text && !body.data.image_url) {
    return res.status(400).json({ ok: false, error: "Provide text or image_url" });
  }

  // Send
  if (convo.channel === "whatsapp") {
    if (body.data.image_url) {
      await axios.post(`${env.GATEWAY_WA_URL}/send/image`, {
        tenant_id: tenantId,
        to: convo.externalThreadId,
        image_url: body.data.image_url,
        caption: body.data.caption || body.data.text || "",
      });
    } else if (body.data.text) {
      await axios.post(`${env.GATEWAY_WA_URL}/send/text`, {
        tenant_id: tenantId,
        to: convo.externalThreadId,
        text: body.data.text,
      });
    }
  } else {
    await axios.post(`${env.GATEWAY_META_URL}/send`, {
      tenant_id: tenantId,
      channel: convo.channel,
      to: convo.externalThreadId,
      text: body.data.text || body.data.caption || "",
      image_url: body.data.image_url,
    });
  }

  const msg = await prisma.message.create({
    data: {
      tenantId,
      conversationId: convo.id,
      channel: convo.channel,
      externalMessageId: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fromMe: true,
      type: body.data.image_url ? "image" : "text",
      text: body.data.text || body.data.caption || null,
      mediaUrl: body.data.image_url || null,
      ts: BigInt(Date.now()),
    }
  });

  await prisma.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date() } });

  io.to(tenantId).emit("message_created", { tenantId, conversationId: convo.id, messageId: msg.id });
  io.to(tenantId).emit("conversation_updated", { tenantId, conversationId: convo.id });

  res.json({ ok: true, messageId: msg.id });
});

apiRouter.post("/conversations/:id/takeover", async (req, res) => {
  const tenantId = getTenantId(req);
  const convoId = req.params.id;
  const convo = await prisma.conversation.update({ where: { id: convoId }, data: { mode: "HUMAN" } });
  io.to(tenantId).emit("conversation_updated", { tenantId, conversationId: convo.id });
  res.json({ ok: true });
});

apiRouter.post("/conversations/:id/return-to-bot", async (req, res) => {
  const tenantId = getTenantId(req);
  const convoId = req.params.id;
  const convo = await prisma.conversation.update({ where: { id: convoId }, data: { mode: "BOT_ON" } });
  io.to(tenantId).emit("conversation_updated", { tenantId, conversationId: convo.id });
  res.json({ ok: true });
});

apiRouter.post("/conversations/:id/assign", async (req, res) => {
  const tenantId = getTenantId(req);
  const convoId = req.params.id;
  const body = z.object({ user_id: z.string().uuid().nullable() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: body.error.flatten() });

  const convo = await prisma.conversation.update({ where: { id: convoId }, data: { assignedUserId: body.data.user_id } });
  io.to(tenantId).emit("conversation_updated", { tenantId, conversationId: convo.id });
  res.json({ ok: true });
});
