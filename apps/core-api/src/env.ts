import 'dotenv/config';
import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(10),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  GATEWAY_WA_URL: z.string().default("http://localhost:4010"),
  GATEWAY_META_URL: z.string().default("http://localhost:4020"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  BOT_ENABLED: z.string().default("true"),
  BOT_MAX_AUTO_REPLIES_PER_HOUR: z.coerce.number().default(6),
});

export const env = Env.parse(process.env);
export const BOT_ENABLED = env.BOT_ENABLED.toLowerCase() === "true";
