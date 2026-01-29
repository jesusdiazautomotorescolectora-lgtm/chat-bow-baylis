import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./env.js";
import { requireAuth, requireTenant, setUtf8 } from "./middleware.js";
import { getInbox, getMessages, postReply } from "./routes.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(setUtf8);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth, requireTenant);

app.get("/api/inbox", getInbox);
app.get("/api/inbox/:id/messages", getMessages);
app.post("/api/inbox/:id/reply", postReply);

app.listen(env.PORT, () => {
  console.log(`panel-api listening on :${env.PORT}`);
});
