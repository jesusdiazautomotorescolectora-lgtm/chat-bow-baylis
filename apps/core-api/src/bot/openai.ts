import OpenAI from "openai";
import { env } from "../env.js";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY || undefined });

export async function generateBotReply(opts: { system: string; user: string }): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return "No tengo configurada la IA todavía. En un momento te atiende un vendedor.";
  }
  const resp = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: 0.2,
  });
  return resp.choices?.[0]?.message?.content?.trim() || "";
}
