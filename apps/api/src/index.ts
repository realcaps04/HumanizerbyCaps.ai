import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { documentsRouter } from "./routes/documents.js";
import { textRouter } from "./routes/text.js";
import { store } from "./db/store.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "humanizer-api", aiProvider: config.aiProvider });
});

app.use("/api/text", textRouter);
app.use("/api/documents", documentsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Server error";
  if (message.includes("Only DOCX")) return res.status(400).json({ error: message });
  if (message.includes("File too large")) return res.status(400).json({ error: "File too large" });
  console.error(err);
  res.status(500).json({ error: message });
});

await store.ensureLocalUser();

app.listen(config.port, () => {
  console.log(`HumanizerbyCaps.ai API on http://localhost:${config.port} (AI: ${config.aiProvider}, auth: off)`);
});
