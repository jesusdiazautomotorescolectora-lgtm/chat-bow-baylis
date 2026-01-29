import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { io } from "../socket.js";
import { maybeBotReply } from "../bot/maybeBotReply.js";

export const inboundRouter = Router();

/**
 * Normalize timestamps to milliseconds.
 * - Accepts seconds (10 digits) or milliseconds (13 digits).
 * - Falls back to Date.now() for invalid values.
 */
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
    mediaUrl: z
      .string()
      .optional()
      .refine(
        (v) => {
          if (!v) return true;
          return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:");
        },
        { message: "mediaUrl must be http(s) URL or data URL" }
      ),
    mimeType: z.string().optional(),
    ts: z.number().int(),
    raw: z.any().optional(),
  }),
});

inboundRouter.post("/events", async (req, res) => {
  const parsed = InboundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const {
    tenantId,
    channel,
    externalThreadId,
    externalMessageId,
    fromMe,
    type,
    text,
    mediaUrl,
    mimeType,
    ts,
    raw,
  } = parsed.data.payload;

  try {
    // Guard: tenant must exist (avoid FK 500 -> return a clear 400)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return res.status(400).json({ ok: false, error: "Invalid tenantId (tenant not found)" });
    }

    const tsMs = normalizeTsToMs(ts);

    // Transaction: upsert conversation + create message (with dedupe)
    // Note: If message is deduped (unique constraint), we do NOT bump lastMessageAt again.
    const { convoId, msgId, deduped } = await prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.upsert({
        where: {
          tenantId_channel_externalThreadId: { tenantId, channel, externalThreadId },
        },
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
        select: { id: true },
      });

      try {
        const msg = await tx.message.create({
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
          },
          select: { id: true },
        });

        return { convoId: convo.id, msgId: msg.id, deduped: false as const };
      } catch (e: any) {
        // Deduplication: unique constraint on (tenantId, channel, externalMessageId)
        if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
          return { convoId: convo.id, msgId: null as string | null, deduped: true as const };
        }
        throw e;
      }
    });

    // Socket events
    if (!deduped && msgId) {
      io.to(tenantId).emit("message_created", {
        tenantId,
        conversationId: convoId,
        messageId: msgId,
      });
    }
    io.to(tenantId).emit("conversation_updated", {
      tenantId,
      conversationId: convoId,
    });

    // Bot reply
    if (!deduped && !fromMe && (type === "text" || type === "image")) {
      const latestText = (text || "").trim();
      if (latestText) {
        void maybeBotReply({
          tenantId,
          conversationId: convoId,
          channel,
          externalThreadId,
          latestUserText: latestText,
        });
      }
    }

    return res.json({ ok: true, deduped, conversationId: convoId, messageId: msgId });
  } catch (e: any) {
    console.error("inbound/events failed", e);

    if (e instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ ok: false, error: e.message });
    }

    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
