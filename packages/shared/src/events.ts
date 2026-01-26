import type { NormalizedInboundMessage } from "./types.js";

export type CoreEvent =
  | { type: "inbound_message"; payload: NormalizedInboundMessage }
  | { type: "conversation_updated"; payload: { tenantId: string; conversationId: string } }
  | { type: "message_created"; payload: { tenantId: string; conversationId: string; messageId: string } };

export function isInboundMessageEvent(x: any): x is { type: "inbound_message"; payload: NormalizedInboundMessage } {
  return x?.type === "inbound_message" && typeof x?.payload?.tenantId === "string";
}
