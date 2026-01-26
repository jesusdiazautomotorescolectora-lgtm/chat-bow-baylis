import 'dotenv/config';
import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(4010),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  CORE_API_URL: z.string().default("http://localhost:4000"),
  DATA_DIR: z.string().default("./data"),
  FORWARD_INBOUND: z.string().default("true"),
});

export const env = Env.parse(process.env);
export const FORWARD_INBOUND = env.FORWARD_INBOUND.toLowerCase() === "true";
