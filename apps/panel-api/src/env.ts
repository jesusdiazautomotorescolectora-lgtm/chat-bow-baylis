import dotenv from "dotenv";

dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  BOT_ADMIN_TOKEN: process.env.BOT_ADMIN_TOKEN ?? "",
  BOT_API_URL: process.env.BOT_API_URL ?? "",
  PORT: Number(process.env.PORT ?? 3000),
};

if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
}
if (!env.BOT_ADMIN_TOKEN) {
  console.error("Missing BOT_ADMIN_TOKEN (used as x-panel-token)");
}
