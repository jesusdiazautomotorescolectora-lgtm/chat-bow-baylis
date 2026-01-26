export type Conversation = {
  id: string;
  tenantId: string;
  channel: "whatsapp" | "instagram" | "messenger";
  externalThreadId: string;
  mode: "BOT_ON" | "HUMAN";
  status: "open" | "closed";
  assignedUserId: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  fromMe: boolean;
  type: "text" | "image" | "audio" | "doc";
  text: string | null;
  mediaUrl: string | null;
  createdAt: string;
};
