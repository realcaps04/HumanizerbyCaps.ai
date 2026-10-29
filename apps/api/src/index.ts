import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { documentsRouter } from "./routes/documents.js";
import { textRouter } from "./routes/text.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "humanizer-api", aiProvider: config.aiProvider });
});

app.use("/api/text", textRouter);
app.use("/api/documents", documentsRouter);

// On Vercel, this Express service also serves the Vite build from ./public
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = [
  path.join(process.cwd(), "public"),
  path.resolve(__dirname, "../public"),
  path.resolve(__dirname, "public"),
].find((candidate) => existsSync(path.join(candidate, "index.html")));

if (publicDir) {
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api(?:\/|$)|\/health$).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Server error";
  if (message.includes("Only DOCX")) return res.status(400).json({ error: message });
  if (message.includes("File too large")) return res.status(400).json({ error: "File too large" });
  console.error(err);
  res.status(500).json({ error: message });
});

// Local/dev still listens on a port. Vercel uses the default export.
if (!config.isVercel) {
  app.listen(config.port, () => {
    console.log(
      `HumanizerbyCaps.ai API on http://localhost:${config.port} (AI: ${config.aiProvider}, auth: off)`,
    );
  });
}

export default app;
