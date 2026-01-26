import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { io } from "../socket.js";
import { maybeBotReply } from "../bot/maybeBotReply.js";

export const inboundRouter = Router();

const InboundSchema = z.object({
  type: z.literal("inbound_message"),
  payload: z.object({
    tenantId: z.string().uuid(),
    channel: z.enum(["whatsapp", "instagram", "messenger"]),
    externalThreadId: z.string().min(3),
    externalMessageId: z.string().min(3),
    fromMe: z.boolean(),
    type: z.enum(["text", "image", "audio", "doc"]),
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mimeType: z.string().optional(),
    ts: z.number().int(),
    raw: z.any().optional(),
  }),
});

inboundRouter.post("/events", async (req, res) => {
  const parsed = InboundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { tenantId, channel, externalThreadId, externalMessageId, fromMe, type, text, mediaUrl, mimeType, ts, raw } = parsed.data.payload;

  // upsert conversation
  const convo = await prisma.conversation.upsert({
    where: { tenantId_channel_externalThreadId: { tenantId, channel, externalThreadId } },
    create: {
      tenantId,
      channel,
      externalThreadId,
      mode: "BOT_ON",
      status: "open",
      lastMessageAt: new Date(ts),
    },
    update: {
      lastMessageAt: new Date(ts),
    },
  });

  // dedupe by (tenantId, channel, externalMessageId)
  try {
    const msg = await prisma.message.create({
      data: {
        tenantId,
        conversationId: convo.id,
        channel,
        externalMessageId,
        fromMe,
        type,
        text,
        mediaUrl,
        mimeType,
        rawJson: raw ?? undefined,
        ts: BigInt(ts),
      }
    });

    io.to(tenantId).emit("message_created", { tenantId, conversationId: convo.id, messageId: msg.id });
    io.to(tenantId).emit("conversation_updated", { tenantId, conversationId: convo.id });

    if (!fromMe && (type === "text" || type === "image")) {
      const latestText = (text || "").trim();
      if (latestText) {
        void maybeBotReply({ tenantId, conversationId: convo.id, channel, externalThreadId, latestUserText: latestText });
      }
    }

    return res.json({ ok: true, conversationId: convo.id, messageId: msg.id });
  } catch (e: any) {
    // unique constraint means duplicate event
    return res.json({ ok: true, deduped: true, conversationId: convo.id });
  }
});
