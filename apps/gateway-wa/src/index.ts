import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { router } from "./routes.js";

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(router);

app.listen(env.PORT, () => {
  console.log(`gateway-wa listening on :${env.PORT}`);
});
