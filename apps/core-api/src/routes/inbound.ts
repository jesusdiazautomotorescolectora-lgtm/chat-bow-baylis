import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { io } from "../socket.js";
import { maybeBotReply } from "../bot/maybeBotReply.js";

export const inboundRouter = Router();

function normalizeTsToMs(ts: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return Date.now();
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}


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
    mediaUrl: z.string().optional().refine((v) => {
      if (!v) return true;
      return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:");
    }, { message: "mediaUrl must be http(s) URL or data URL" }),
    mimeType: z.string().optional(),
    ts: z.number().int(),
    raw: z.any().optional(),
  }),
});

inboundRouter.post("/events", async (req, res) => {
  const parsed = InboundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { tenantId, channel, externalThreadId, externalMessageId, fromMe, type, text, mediaUrl, mimeType, ts, raw } = parsed.data.payload;
  const tsMs = normalizeTsToMs(ts);


  // upsert conversation
  const convo = await prisma.conversation.upsert({
    where: { tenantId_channel_externalThreadId: { tenantId, channel, externalThreadId } },
    create: {
      tenantId,
      channel,
      externalThreadId,
      mode: "BOT_ON",
      status: "open",
      lastMessageAt: new Date(tsMs),
    },
    update: {
      lastMessageAt: new Date(tsMs),
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
        ts: BigInt(tsMs),
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
    // Only treat unique constraint as dedupe; anything else should surface.
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      return res.json({ ok: true, deduped: true, conversationId: convo.id });
    }
    console.error("inbound/events failed", e);
    return res.status(500).json({ ok: false, error: "inbound/events failed" });
  }
});
