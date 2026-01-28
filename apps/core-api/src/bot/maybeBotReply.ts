import { prisma } from "../prisma.js";
import { io } from "../socket.js";
import { BOT_ENABLED, env } from "../env.js";
import { shouldHandoffToHuman } from "./rules.js";
import { generateBotReply } from "./openai.js";
import axios from "axios";

export async function maybeBotReply(args: {
  tenantId: string;
  conversationId: string;
  channel: "whatsapp" | "instagram" | "messenger";
  externalThreadId: string;
  latestUserText: string;
}) {
  if (!BOT_ENABLED) return;

  const convo = await prisma.conversation.findFirst({ where: { id: args.conversationId, tenantId: args.tenantId } });
  if (!convo) return;
  if (convo.mode !== "BOT_ON") return;

  if (shouldHandoffToHuman(args.latestUserText)) {
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { mode: "HUMAN" }
    });
    io.to(args.tenantId).emit("conversation_updated", { tenantId: args.tenantId, conversationId: convo.id });
    return;
  }

  // naive rate limit: max replies/hour per conversation (MVP)
  const oneHourAgo = new Date(Date.now() - 60*60*1000);
  const count = await prisma.message.count({
    where: { tenantId: args.tenantId, conversationId: args.conversationId, fromMe: true, createdAt: { gte: oneHourAgo } }
  });
  if (count >= env.BOT_MAX_AUTO_REPLIES_PER_HOUR) return;

  const system = "Sos un asistente de ventas. Respuestas cortas, claras. Si falta info, pedí 1 pregunta. Si el usuario quiere un humano, derivá.";
  const reply = await generateBotReply({ system, user: args.latestUserText });
  if (!reply) return;

  // Send through gateway
  const base = args.channel === "whatsapp" ? env.GATEWAY_WA_URL : env.GATEWAY_META_URL;
  if (args.channel === "whatsapp") {
    await axios.post(`${base}/send/text`, { tenant_id: args.tenantId, to: args.externalThreadId, text: reply });
  } else {
    await axios.post(`${base}/send`, { tenant_id: args.tenantId, channel: args.channel, to: args.externalThreadId, text: reply });
  }

  // Persist as fromMe
  const msg = await prisma.message.create({
    data: {
      tenantId: args.tenantId,
      conversationId: args.conversationId,
      channel: args.channel,
      externalMessageId: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fromMe: true,
      type: "text",
      text: reply,
      ts: BigInt(Date.now()),
    }
  });

  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { lastMessageAt: new Date() }
  });

  io.to(args.tenantId).emit("message_created", { tenantId: args.tenantId, conversationId: args.conversationId, messageId: msg.id });
  io.to(args.tenantId).emit("conversation_updated", { tenantId: args.tenantId, conversationId: args.conversationId });
}

