import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { DEFAULT_HUMANIZATION_SETTINGS, PLAN_LIMITS } from "@humanizer/shared";
import { config } from "../config.js";
import { store } from "../db/store.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  acceptOrRejectEdit,
  getCachedAnalysis,
  getCachedQuality,
  getFileForDownload,
  getParsed,
  handleAgentMessage,
  restoreOriginal,
  restoreVersion,
  runAnalysis,
  runHumanize,
  runQuality,
  saveUploadedDocx,
} from "../services/documents.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx");
    if (!ok) return cb(new Error("Only DOCX files are supported in this release"));
    cb(null, true);
  },
});

documentsRouter.get("/", async (req: AuthedRequest, res) => {
  const docs = await store.listDocuments(req.user!.id);
  res.json({ documents: docs });
});

documentsRouter.get("/dashboard", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const docs = await store.listDocuments(userId);
  const sub = await store.getSubscription(userId);
  const plan = sub?.plan ?? "free";
  const wordsUsedThisMonth = await store.usageThisMonth(userId);
  const totalWordsHumanized = await store.totalWordsProcessed(userId);
  res.json({
    stats: {
      totalDocuments: docs.length,
      totalWordsHumanized,
      wordsUsedThisMonth,
      wordAllowance: PLAN_LIMITS[plan].monthlyWordAllowance,
      plan,
    },
    recentDocuments: docs.slice(0, 8),
  });
});

documentsRouter.post("/upload", upload.single("file"), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File required" });
    const doc = await saveUploadedDocx({
      userId: req.user!.id,
      filename: req.file.originalname,
      buffer: req.file.buffer,
    });
    res.status(201).json({ document: doc });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

documentsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const doc = await store.getDocument(req.params.id, req.user!.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  const versions = await store.listVersions(doc.id, req.user!.id);
  const edits = await store.listEdits(doc.id);
  const jobs = await store.listJobs(doc.id, req.user!.id);
  const chat = await store.getChat(doc.id);
  let paragraphs = null;
  try {
    paragraphs = (await getParsed(doc.id, req.user!.id)).parsed.paragraphs;
  } catch {
    /* ignore */
  }
  res.json({
    document: doc,
    versions,
    edits,
    jobs,
    chat,
    paragraphs,
    analysis: getCachedAnalysis(doc.id),
    quality: getCachedQuality(doc.id),
    settings: DEFAULT_HUMANIZATION_SETTINGS,
  });
});

documentsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const deleted = await store.deleteDocument(req.params.id, req.user!.id);
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

documentsRouter.get("/:id/file", async (req: AuthedRequest, res) => {
  try {
    const which = req.query.which === "original" ? "original" : "current";
    const { buffer, filename } = await getFileForDownload(req.params.id, req.user!.id, which);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${which === "original" ? "original-" : ""}${filename}"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

documentsRouter.post("/:id/analyze", async (req: AuthedRequest, res) => {
  try {
    const result = await runAnalysis(req.params.id, req.user!.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Analyze failed" });
  }
});

documentsRouter.post("/:id/humanize", async (req: AuthedRequest, res) => {
  const schema = z.object({
    settings: z.record(z.any()).optional(),
    instruction: z.string().optional(),
    sectionId: z.string().optional(),
    paragraphIds: z.array(z.string()).optional(),
    selectionText: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await runHumanize(req.params.id, req.user!.id, parsed.data as never);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Humanize failed" });
  }
});

documentsRouter.post("/:id/quality", async (req: AuthedRequest, res) => {
  try {
    const report = await runQuality(req.params.id, req.user!.id);
    res.json({ report });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Quality check failed" });
  }
});

documentsRouter.post("/:id/edits/:editId", async (req: AuthedRequest, res) => {
  const status = req.body?.status;
  if (status !== "accepted" && status !== "rejected") {
    return res.status(400).json({ error: "status must be accepted or rejected" });
  }
  try {
    const edit = await acceptOrRejectEdit(req.params.id, req.user!.id, req.params.editId, status);
    res.json({ edit });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

documentsRouter.post("/:id/restore-original", async (req: AuthedRequest, res) => {
  try {
    const doc = await restoreOriginal(req.params.id, req.user!.id);
    res.json({ document: doc });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Restore failed" });
  }
});

documentsRouter.post("/:id/versions/:versionId/restore", async (req: AuthedRequest, res) => {
  try {
    const version = await restoreVersion(req.params.id, req.user!.id, req.params.versionId);
    res.json({ version });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Restore failed" });
  }
});

documentsRouter.get("/:id/chat", async (req: AuthedRequest, res) => {
  const doc = await store.getDocument(req.params.id, req.user!.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json({ messages: await store.getChat(doc.id) });
});

documentsRouter.post("/:id/chat", async (req: AuthedRequest, res) => {
  const message = z.string().min(1).max(4000).safeParse(req.body?.message);
  if (!message.success) return res.status(400).json({ error: "message required" });
  try {
    const result = await handleAgentMessage(
      req.params.id,
      req.user!.id,
      message.data,
      req.body?.settings,
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Chat failed" });
  }
});

documentsRouter.get("/:id/jobs/:jobId", async (req: AuthedRequest, res) => {
  const job = await store.getJob(req.params.jobId, req.user!.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json({ job });
});
