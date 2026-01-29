import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "./db.js";

function tenantId(req: Request): string {
  return (req as any).tenantId as string;
}

export async function getInbox(req: Request, res: Response) {
  const tid = tenantId(req);
  const items = await prisma.conversation.findMany({
    where: { tenantId: tid },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      remoteJid: true,
      status: true,
      assignedUserId: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true, createdAt: true, direction: true, imageUrl: true }
      }
    }
  });

  const mapped = items.map((c) => ({
    id: c.id,
    remote_jid: c.remoteJid,
    status: c.status,
    assigned_user_id: c.assignedUserId,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    last_message: c.messages[0] ? {
      text: c.messages[0].text,
      direction: c.messages[0].direction,
      image_url: c.messages[0].imageUrl,
      created_at: c.messages[0].createdAt
    } : null
  }));

  return res.json({ ok: true, result: mapped });
}

export async function getMessages(req: Request, res: Response) {
  const tid = tenantId(req);
  const conversationId = req.params.id;

  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId: tid },
    select: { id: true, remoteJid: true, status: true }
  });
  if (!convo) return res.status(404).json({ ok: false, error: "Conversation not found" });

  const messages = await prisma.message.findMany({
    where: { tenantId: tid, conversationId },
    orderBy: { createdAt: "asc" },
    take: 500
  });

  return res.json({ ok: true, conversation: convo, messages: messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    text: m.text,
    image_url: m.imageUrl,
    created_at: m.createdAt
  })) });
}

const ReplySchema = z.object({
  text: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().min(1).url().optional(),
  image_url: z.string().trim().min(1).url().optional()
}).superRefine((val, ctx) => {
  const img = val.image_url ?? val.imageUrl;
  if (!val.text && !img) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide text or image_url" });
  }
});

export async function postReply(req: Request, res: Response) {
  const tid = tenantId(req);
  const conversationId = req.params.id;

  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId: tid },
    select: { id: true, remoteJid: true }
  });
  if (!convo) return res.status(404).json({ ok: false, error: "Conversation not found" });

  const parsed = ReplySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "ValidationError", details: parsed.error.flatten() });
  }

  const image_url = parsed.data.image_url ?? parsed.data.imageUrl;
  const text = parsed.data.text;

  const msg = await prisma.message.create({
    data: {
      tenantId: tid,
      conversationId,
      direction: "outbound",
      text: text ?? null,
      imageUrl: image_url ?? null
    }
  });

  // Touch conversation updatedAt
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  return res.json({ ok: true, result: { id: msg.id, text: msg.text, image_url: msg.imageUrl } });
}
