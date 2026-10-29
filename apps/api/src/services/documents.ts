import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  DEFAULT_HUMANIZATION_SETTINGS,
  PLAN_LIMITS,
  type DocumentAnalysisProfile,
  type HumanizationSettings,
  type WritingQualityReport,
} from "@humanizer/shared";
import { store } from "../db/store.js";
import {
  applyParagraphReplacements,
  countWords,
  parseDocx,
} from "./docx/parser.js";
import {
  agentReply,
  analyzeDocument,
  evaluateQuality,
  humanizeParagraphs,
} from "./ai/provider.js";

const analysisCache = new Map<string, DocumentAnalysisProfile>();
const qualityCache = new Map<string, WritingQualityReport>();
const paragraphCache = new Map<string, Awaited<ReturnType<typeof parseDocx>>>();

async function readDocBuffer(relativePath: string) {
  return fs.readFile(store.storagePath(relativePath));
}

async function writeDocBuffer(relativePath: string, buffer: Buffer) {
  const full = store.storagePath(relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

export async function saveUploadedDocx(input: {
  userId: string;
  filename: string;
  buffer: Buffer;
}) {
  const sub = await store.getSubscription(input.userId);
  const plan = sub?.plan ?? "free";
  const limits = PLAN_LIMITS[plan];
  const docs = await store.listDocuments(input.userId);
  if (docs.length >= limits.maxDocuments) {
    throw new Error(`Document limit reached for ${plan} plan (${limits.maxDocuments})`);
  }

  const parsed = await parseDocx(input.buffer);
  const docId = nanoid();
  const originalRel = path.join(input.userId, docId, "original.docx");
  const currentRel = path.join(input.userId, docId, "current.docx");
  await writeDocBuffer(originalRel, input.buffer);
  await writeDocBuffer(currentRel, input.buffer);

  const doc = await store.createDocument({
    id: docId,
    userId: input.userId,
    originalFilename: input.filename,
    storagePath: path.join(input.userId, docId),
    originalDocumentPath: originalRel,
    currentDocumentPath: currentRel,
    wordCount: parsed.wordCount,
    processingStatus: "ready",
  });

  await store.createVersion({
    documentId: doc.id,
    userId: input.userId,
    versionNumber: 1,
    storagePath: originalRel,
    changeDescription: "Original upload",
  });

  paragraphCache.set(doc.id, parsed);
  return doc;
}

export async function getParsed(documentId: string, userId: string) {
  const doc = await store.getDocument(documentId, userId);
  if (!doc) throw new Error("Document not found");
  const cached = paragraphCache.get(documentId);
  if (cached) return { doc, parsed: cached };
  const buffer = await readDocBuffer(doc.currentDocumentPath);
  const parsed = await parseDocx(buffer);
  paragraphCache.set(documentId, parsed);
  return { doc, parsed };
}

export async function runAnalysis(documentId: string, userId: string) {
  const job = await store.createJob({
    documentId,
    userId,
    jobType: "analyze",
    status: "running",
    progress: 10,
  });
  try {
    await store.updateDocument(documentId, userId, { processingStatus: "analyzing" });
    const { doc, parsed } = await getParsed(documentId, userId);
    await store.updateJob(job.id, { progress: 40 });
    const analysis = await analyzeDocument(parsed.paragraphs);
    const profile: DocumentAnalysisProfile = {
      documentId,
      topic: analysis.topic,
      audience: analysis.audience,
      writingStyle: analysis.writingStyle,
      sectionCount: new Set(parsed.paragraphs.map((p) => p.sectionId)).size,
      paragraphCount: parsed.paragraphs.filter((p) => p.kind === "paragraph").length,
      sentenceCount: parsed.paragraphs.reduce(
        (n, p) => n + (p.text.match(/[.!?]+/g)?.length ?? 0),
        0,
      ),
      repetitiveExpressions: analysis.repetitiveExpressions,
      technicalSections: analysis.technicalSections,
      citationCount: analysis.citationCount,
      tableCount: parsed.tableCount,
      summary: analysis.summary,
      createdAt: new Date().toISOString(),
    };
    analysisCache.set(documentId, profile);
    await store.updateDocument(documentId, userId, { processingStatus: "ready" });
    await store.updateJob(job.id, {
      status: "completed",
      progress: 100,
      completedAt: new Date().toISOString(),
    });
    await store.appendChat(documentId, {
      role: "assistant",
      content: `Analysis complete. Topic: ${profile.topic}. ${profile.summary}`,
    });
    return { profile, jobId: job.id, filename: doc.originalFilename };
  } catch (err) {
    await store.updateJob(job.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Analysis failed",
      completedAt: new Date().toISOString(),
    });
    await store.updateDocument(documentId, userId, { processingStatus: "failed" });
    throw err;
  }
}

function resolveTargets(
  parsed: Awaited<ReturnType<typeof parseDocx>>,
  options: { sectionId?: string; paragraphIds?: string[]; selectionText?: string },
) {
  let paragraphs = parsed.paragraphs;
  if (options.paragraphIds?.length) {
    paragraphs = paragraphs.filter((p) => options.paragraphIds!.includes(p.id));
  } else if (options.sectionId) {
    paragraphs = paragraphs.filter((p) => p.sectionId === options.sectionId);
  } else if (options.selectionText) {
    const sel = options.selectionText.trim();
    paragraphs = paragraphs.filter((p) => p.text.includes(sel));
  }
  return paragraphs;
}

export async function runHumanize(
  documentId: string,
  userId: string,
  options: {
    settings?: Partial<HumanizationSettings>;
    instruction?: string;
    sectionId?: string;
    paragraphIds?: string[];
    selectionText?: string;
  } = {},
) {
  const settings: HumanizationSettings = {
    ...DEFAULT_HUMANIZATION_SETTINGS,
    ...options.settings,
  };
  const sub = await store.getSubscription(userId);
  const plan = sub?.plan ?? "free";
  const limits = PLAN_LIMITS[plan];
  const used = await store.usageThisMonth(userId);

  const job = await store.createJob({
    documentId,
    userId,
    jobType: options.paragraphIds?.length || options.sectionId || options.selectionText
      ? "humanize_section"
      : "humanize_full",
    status: "running",
    progress: 5,
  });

  try {
    await store.updateDocument(documentId, userId, { processingStatus: "humanizing" });
    const { doc, parsed } = await getParsed(documentId, userId);
    const targets = resolveTargets(parsed, options);
    const targetWords = targets.reduce((n, p) => n + countWords(p.text), 0);
    if (used + targetWords > limits.monthlyWordAllowance) {
      throw new Error(
        `Monthly word allowance exceeded (${used}/${limits.monthlyWordAllowance} for ${plan})`,
      );
    }

    await store.updateJob(job.id, { progress: 25 });
    const result = await humanizeParagraphs({
      paragraphs: targets,
      settings,
      instruction: options.instruction,
      selectionIds: targets.map((p) => p.id),
    });

    await store.updateJob(job.id, { progress: 60 });
    const buffer = await readDocBuffer(doc.currentDocumentPath);
    const { buffer: nextBuffer, flagged } = await applyParagraphReplacements(
      buffer,
      result.replacements.map((r) => ({ index: r.index, newText: r.modifiedText })),
    );

    const versions = await store.listVersions(documentId, userId);
    const versionNumber = (versions[0]?.versionNumber ?? 1) + 1;
    const versionRel = path.join(userId, documentId, `v${versionNumber}.docx`);
    await writeDocBuffer(versionRel, nextBuffer);
    await writeDocBuffer(doc.currentDocumentPath, nextBuffer);

    const version = await store.createVersion({
      documentId,
      userId,
      versionNumber,
      storagePath: versionRel,
      changeDescription: result.summary,
    });

    const edits = await store.createEdits(
      result.replacements.map((r) => {
        const flag = flagged.find((f) => f.index === r.index);
        return {
          documentId,
          versionId: version.id,
          originalText: r.originalText,
          modifiedText: r.modifiedText,
          paragraphIdentifier: r.id,
          editStatus: "pending" as const,
          ...(flag ? {} : {}),
        };
      }),
    );

    // Annotate flagged paragraphs in cache
    for (const f of flagged) {
      const p = parsed.paragraphs.find((x) => x.index === f.index);
      if (p) {
        p.flaggedForReview = true;
        p.reviewReason = f.reason;
      }
    }

    // Refresh paragraph cache from new buffer
    paragraphCache.set(documentId, await parseDocx(nextBuffer));
    analysisCache.delete(documentId);
    qualityCache.delete(documentId);

    const words = result.replacements.reduce((n, r) => n + countWords(r.modifiedText), 0);
    await store.addUsage({
      userId,
      documentId,
      wordsProcessed: words || targetWords,
      operationType: job.jobType,
    });

    await store.updateDocument(documentId, userId, {
      processingStatus: "completed",
      wordCount: (await parseDocx(nextBuffer)).wordCount,
    });
    await store.updateJob(job.id, {
      status: "completed",
      progress: 100,
      completedAt: new Date().toISOString(),
    });

    const flagNote =
      flagged.length > 0
        ? ` ${flagged.length} paragraph(s) flagged for formatting review.`
        : "";
    await store.appendChat(documentId, {
      role: "assistant",
      content: `${result.summary}${flagNote} Review and accept or reject each change.`,
    });

    return { version, edits, flagged, summary: result.summary, jobId: job.id };
  } catch (err) {
    await store.updateJob(job.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Humanization failed",
      completedAt: new Date().toISOString(),
    });
    await store.updateDocument(documentId, userId, { processingStatus: "failed" });
    throw err;
  }
}

export async function acceptOrRejectEdit(
  documentId: string,
  userId: string,
  editId: string,
  status: "accepted" | "rejected",
) {
  const doc = await store.getDocument(documentId, userId);
  if (!doc) throw new Error("Document not found");
  const edit = await store.updateEdit(editId, documentId, { editStatus: status });
  if (!edit) throw new Error("Edit not found");

  if (status === "rejected") {
    // Re-apply original text for that paragraph into current doc
    const { parsed } = await getParsed(documentId, userId);
    // Find by matching modified text / identifier is fragile after reparse — use original from edit
    const buffer = await readDocBuffer(doc.currentDocumentPath);
    const current = await parseDocx(buffer);
    const match = current.paragraphs.find(
      (p) => p.text === edit.modifiedText || p.text.includes(edit.modifiedText.slice(0, 40)),
    );
    if (match) {
      const { buffer: next } = await applyParagraphReplacements(buffer, [
        { index: match.index, newText: edit.originalText },
      ]);
      await writeDocBuffer(doc.currentDocumentPath, next);
      paragraphCache.set(documentId, await parseDocx(next));
    }
  }
  return edit;
}

export async function restoreOriginal(documentId: string, userId: string) {
  const doc = await store.getDocument(documentId, userId);
  if (!doc) throw new Error("Document not found");
  const original = await readDocBuffer(doc.originalDocumentPath);
  await writeDocBuffer(doc.currentDocumentPath, original);
  const versions = await store.listVersions(documentId, userId);
  const versionNumber = (versions[0]?.versionNumber ?? 1) + 1;
  const versionRel = path.join(userId, documentId, `v${versionNumber}-restored.docx`);
  await writeDocBuffer(versionRel, original);
  await store.createVersion({
    documentId,
    userId,
    versionNumber,
    storagePath: versionRel,
    changeDescription: "Restored original document",
  });
  paragraphCache.set(documentId, await parseDocx(original));
  await store.updateDocument(documentId, userId, {
    processingStatus: "ready",
    wordCount: (await parseDocx(original)).wordCount,
  });
  await store.appendChat(documentId, {
    role: "assistant",
    content: "Restored the original uploaded document.",
  });
  return doc;
}

export async function restoreVersion(documentId: string, userId: string, versionId: string) {
  const doc = await store.getDocument(documentId, userId);
  if (!doc) throw new Error("Document not found");
  const versions = await store.listVersions(documentId, userId);
  const version = versions.find((v) => v.id === versionId);
  if (!version) throw new Error("Version not found");
  const buffer = await readDocBuffer(version.storagePath);
  await writeDocBuffer(doc.currentDocumentPath, buffer);
  paragraphCache.set(documentId, await parseDocx(buffer));
  await store.updateDocument(documentId, userId, {
    wordCount: (await parseDocx(buffer)).wordCount,
    processingStatus: "ready",
  });
  return version;
}

export async function runQuality(documentId: string, userId: string) {
  const { parsed } = await getParsed(documentId, userId);
  const scores = await evaluateQuality(parsed.paragraphs);
  const report: WritingQualityReport = {
    documentId,
    ...scores,
    createdAt: new Date().toISOString(),
    // Optional detector slot — never fabricate third-party scores
    aiDetection: undefined,
  };
  qualityCache.set(documentId, report);
  return report;
}

export function getCachedAnalysis(documentId: string) {
  return analysisCache.get(documentId) ?? null;
}

export function getCachedQuality(documentId: string) {
  return qualityCache.get(documentId) ?? null;
}

export async function handleAgentMessage(
  documentId: string,
  userId: string,
  message: string,
  settings?: Partial<HumanizationSettings>,
) {
  await store.appendChat(documentId, { role: "user", content: message });
  const { parsed } = await getParsed(documentId, userId);
  const analysis = analysisCache.get(documentId);
  const summary = analysis?.summary ?? `Document has ${parsed.paragraphs.length} paragraphs, ${parsed.wordCount} words.`;

  const lower = message.toLowerCase();
  let actionResult: unknown = null;

  if (/\banalyze\b/.test(lower)) {
    actionResult = await runAnalysis(documentId, userId);
    return { messages: await store.getChat(documentId), actionResult };
  }
  if (/\brestore original\b|\brevert to original\b/.test(lower)) {
    actionResult = await restoreOriginal(documentId, userId);
    return { messages: await store.getChat(documentId), actionResult };
  }
  if (/\bhumanize\b|\brewrite\b|\bimprove\b|\bnatural\b|\breadability\b|\bgrammar\b/.test(lower)) {
    let sectionId: string | undefined;
    if (/\bintroduction\b|\bintro\b/.test(lower)) {
      sectionId = parsed.paragraphs.find((p) => p.sectionId)?.sectionId;
      const intro = parsed.paragraphs.find(
        (p) => /intro/i.test(p.text) || (p.kind === "heading" && /intro/i.test(p.text)),
      );
      if (intro?.sectionId) sectionId = intro.sectionId;
      // Prefer first content section
      sectionId = "section-0";
      const firstHeading = parsed.paragraphs.find((p) => p.kind === "heading");
      if (firstHeading) sectionId = firstHeading.sectionId;
    }
    if (/\bconclusion\b/.test(lower)) {
      const conc = [...parsed.paragraphs]
        .reverse()
        .find((p) => p.kind === "heading" && /conclu/i.test(p.text));
      sectionId = conc?.sectionId ?? parsed.paragraphs.at(-1)?.sectionId;
    }

    const intensity = /\blight\b/.test(lower)
      ? "light"
      : /\bdeep\b/.test(lower)
        ? "deep"
        : settings?.intensity;
    const tone = /\bconversational\b/.test(lower)
      ? "conversational"
      : /\bprofessional\b/.test(lower)
        ? "professional"
        : /\bacademic\b/.test(lower)
          ? "academic"
          : /\bformal\b/.test(lower)
            ? "formal"
            : /\bsimple\b/.test(lower)
              ? "simple"
              : settings?.tone;

    actionResult = await runHumanize(documentId, userId, {
      settings: { ...settings, ...(intensity ? { intensity } : {}), ...(tone ? { tone } : {}) },
      instruction: message,
      sectionId,
    });
    return { messages: await store.getChat(documentId), actionResult };
  }

  const reply = await agentReply({ message, documentSummary: summary });
  await store.appendChat(documentId, { role: "assistant", content: reply });
  return { messages: await store.getChat(documentId), actionResult };
}

export async function getFileForDownload(
  documentId: string,
  userId: string,
  which: "current" | "original",
) {
  const doc = await store.getDocument(documentId, userId);
  if (!doc) throw new Error("Document not found");
  const rel = which === "original" ? doc.originalDocumentPath : doc.currentDocumentPath;
  const buffer = await readDocBuffer(rel);
  return { buffer, filename: doc.originalFilename, doc };
}
