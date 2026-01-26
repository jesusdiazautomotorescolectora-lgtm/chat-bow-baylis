import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage
} from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs";
import pino from "pino";
import qrcode from "qrcode";
import axios from "axios";
import { env, FORWARD_INBOUND } from "../env.js";

type TenantState = {
  status: "disconnected" | "connecting" | "needs_qr" | "connected";
  qrDataUrl: string | null;
  sock: any | null;
};

const logger = pino({ level: "info" });

const tenants = new Map<string, TenantState>();

function ensureTenant(tenantId: string): TenantState {
  const existing = tenants.get(tenantId);
  if (existing) return existing;
  const state: TenantState = { status: "disconnected", qrDataUrl: null, sock: null };
  tenants.set(tenantId, state);
  return state;
}

export function getTenantState(tenantId: string) {
  return ensureTenant(tenantId);
}

export async function startTenantSession(tenantId: string) {
  const state = ensureTenant(tenantId);
  if (state.status === "connected" || state.status === "connecting" || state.status === "needs_qr") return;

  state.status = "connecting";
  const authDir = path.join(env.DATA_DIR, "auth", tenantId);
  fs.mkdirSync(authDir, { recursive: true });

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
  });

  state.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u: any) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      state.qrDataUrl = await qrcode.toDataURL(qr);
      state.status = "needs_qr";
    }

    if (connection === "open") {
      state.qrDataUrl = null;
      state.status = "connected";
    }

    if (connection === "close") {
      state.status = "disconnected";
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startTenantSession(tenantId).catch(() => {}), 1500);
      }
    }
  });

  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages?.[0];
    if (!msg) return;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    const message = msg.message || {};
    const type = Object.keys(message)[0] || "unknown";

    let text: string | undefined;
    if (typeof message.conversation === "string") text = message.conversation;
    else if (typeof message.extendedTextMessage?.text === "string") text = message.extendedTextMessage.text;
    else if (typeof message.imageMessage?.caption === "string") text = message.imageMessage.caption;

    let mediaUrl: string | undefined;
    let mimeType: string | undefined;

    // MVP: media download is optional; we forward raw and let core decide.
    if (type === "imageMessage") {
      mimeType = message.imageMessage?.mimetype;
      // TODO: implement storage upload; for now we skip mediaUrl.
      // const buf = await downloadMediaMessage(msg, "buffer", {}, { logger } as any);
      // upload -> mediaUrl
    }

    if (FORWARD_INBOUND) {
      await axios.post(`${env.CORE_API_URL}/inbound/events`, {
        type: "inbound_message",
        payload: {
          tenantId,
          channel: "whatsapp",
          externalThreadId: remoteJid,
          externalMessageId: msg.key.id || `${Date.now()}`,
          fromMe: !!msg.key.fromMe,
          type: type === "imageMessage" ? "image" : "text",
          text,
          mediaUrl,
          mimeType,
          ts: Number(msg.messageTimestamp || Date.now()),
          raw: msg,
        }
      }).catch((e) => {
        logger.error({ err: String(e) }, "forward inbound failed");
      });
    }
  });
}

export async function sendText(tenantId: string, to: string, text: string) {
  const st = ensureTenant(tenantId);
  if (!st.sock) throw new Error("Session not started. Call /session/start first.");
  await st.sock.sendMessage(to, { text });
}

export async function sendImageFromUrl(tenantId: string, to: string, imageUrl: string, caption?: string) {
  const st = ensureTenant(tenantId);
  if (!st.sock) throw new Error("Session not started. Call /session/start first.");

  const resp = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(resp.data);

  await st.sock.sendMessage(to, { image: buffer, caption: caption || "" });
}
