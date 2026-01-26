export type Channel = "whatsapp" | "instagram" | "messenger";

export type ConversationMode = "BOT_ON" | "HUMAN";
export type ConversationStatus = "open" | "closed";

export type MessageType = "text" | "image" | "audio" | "doc";

export type NormalizedInboundMessage = {
  tenantId: string;
  channel: Channel;
  externalThreadId: string;   // remote_jid / ig_thread_id / psid
  externalMessageId: string;  // for dedupe
  fromMe: boolean;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mimeType?: string;
  ts: number;                 // epoch ms
  raw?: any;
};
