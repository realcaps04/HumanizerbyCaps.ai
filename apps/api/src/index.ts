import path from "node:path";
import fs from "node:fs";
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

// Vercel ignores express.static() — serve the Vite build ourselves from ./public
// (copied into the function bundle via includeFiles).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function resolvePublicDir() {
  const candidates = [
    path.join(process.cwd(), "public"),
    path.resolve(__dirname, "../public"),
    path.resolve(__dirname, "public"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) ?? null;
}

app.get(/^(?!\/api(?:\/|$)|\/health$).*/, (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const publicDir = resolvePublicDir();
  if (!publicDir) {
    return res
      .status(503)
      .type("text")
      .send("Web UI bundle missing (public/index.html). Check the Vercel build copy step.");
  }

  const rel = req.path === "/" ? "index.html" : req.path.replace(/^\/+/, "");
  const absolute = path.normalize(path.join(publicDir, rel));
  if (!absolute.startsWith(path.normalize(publicDir))) {
    return res.status(400).end();
  }

  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    return res.sendFile(absolute);
  }

  return res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Server error";
  if (message.includes("Only DOCX")) return res.status(400).json({ error: message });
  if (message.includes("File too large")) return res.status(400).json({ error: "File too large" });
  console.error(err);
  res.status(500).json({ error: message });
});

if (!config.isVercel) {
  app.listen(config.port, () => {
    console.log(
      `HumanizerbyCaps.ai API on http://localhost:${config.port} (AI: ${config.aiProvider}, auth: off)`,
    );
  });
}

export default app;
