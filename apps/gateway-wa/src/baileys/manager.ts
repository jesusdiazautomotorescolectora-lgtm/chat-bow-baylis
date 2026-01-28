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

function normalizeTsToMs(ts: any): number {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

function bufferToDataUrl(buf: Buffer, mimeType: string): string {
  const b64 = buf.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}


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

    // MVP+: download image media and forward as data URL (keeps stack self-contained).
    if (type === "imageMessage") {
      mimeType = message.imageMessage?.mimetype || "image/jpeg";
      try {
        const buf = await downloadMediaMessage(
          msg,
          "buffer",
          {},
          {
            logger,
            reuploadRequest: sock?.updateMediaMessage,
          } as any
        );

        if (Buffer.isBuffer(buf)) {
          if (buf.length <= 3 * 1024 * 1024) {
            mediaUrl = bufferToDataUrl(buf, mimeType ?? "image/jpeg");
          } else {
            logger.warn({ size: buf.length }, "image too large; skipping mediaUrl");
          }
        }
      } catch (e: any) {
        logger.error({ err: String(e) }, "download image failed");
      }
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
          ts: normalizeTsToMs(msg.messageTimestamp ?? Date.now()),
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
