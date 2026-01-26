import 'dotenv/config';
import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(4020),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  CORE_API_URL: z.string().default("http://localhost:4000"),
  META_VERIFY_TOKEN: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional().default(""),
});

export const env = Env.parse(process.env);
