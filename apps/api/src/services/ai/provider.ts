import { OpenAI } from "openai";
import { config } from "../../config.js";
import type { HumanizationSettings, ParagraphBlock } from "@humanizer/shared";

function createOpenAIClient() {
  return new OpenAI({ apiKey: config.openaiApiKey });
}

export interface HumanizeRequest {
  paragraphs: ParagraphBlock[];
  settings: HumanizationSettings;
  instruction?: string;
  selectionIds?: string[];
}

export interface HumanizeResult {
  replacements: Array<{ id: string; index: number; originalText: string; modifiedText: string }>;
  summary: string;
}

export interface AnalysisResult {
  topic: string;
  audience: string;
  writingStyle: string;
  repetitiveExpressions: string[];
  technicalSections: string[];
  citationCount: number;
  summary: string;
}

export interface QualityResult {
  naturalness: number;
  readability: number;
  sentenceVariation: number;
  grammarQuality: number;
  repetitiveLanguage: number;
}

async function chat(system: string, user: string): Promise<string> {
  if (config.aiProvider === "mock" || !config.openaiApiKey) {
    return mockRespond(system, user);
  }
  const client = createOpenAIClient();
  const res = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  return res.choices[0]?.message?.content ?? "{}";
}

function mockRespond(system: string, user: string): string {
  if (system.includes("analysis")) {
    const paras = extractSample(user);
    return JSON.stringify({
      topic: "Document content",
      audience: "General professional readers",
      writingStyle: "Neutral professional prose",
      repetitiveExpressions: findRepetitive(paras),
      technicalSections: [],
      citationCount: (user.match(/\(\d{4}\)|\[\d+\]/g) || []).length,
      summary:
        "The document uses mostly clear language with occasional formulaic phrasing typical of AI-assisted drafts. Structure is intact; flow can be improved in transitional sentences.",
    });
  }
  if (system.includes("quality")) {
    return JSON.stringify({
      naturalness: 62,
      readability: 71,
      sentenceVariation: 55,
      grammarQuality: 84,
      repetitiveLanguage: 38,
    });
  }
  if (system.includes("humaniz")) {
    try {
      const parsed = JSON.parse(user) as {
        paragraphs: Array<{ id: string; index: number; text: string }>;
        settings: HumanizationSettings;
        instruction?: string;
      };
      // Process every non-empty paragraph in this batch (no page/length skip beyond empty)
      const replacements = parsed.paragraphs
        .filter((p) => p.text.trim().length > 0)
        .map((p) => ({
          id: p.id,
          index: p.index,
          originalText: p.text,
          modifiedText: mockHumanize(p.text, parsed.settings),
        }))
        .filter((r) => r.modifiedText !== r.originalText);
      return JSON.stringify({
        replacements,
        summary: `Humanized ${replacements.length} paragraph(s) with ${parsed.settings.intensity} intensity (${parsed.settings.tone} tone).`,
      });
    } catch {
      return JSON.stringify({ replacements: [], summary: "No changes applied." });
    }
  }
  return JSON.stringify({ reply: "I can analyze, humanize, or improve selected sections of your document." });
}

function extractSample(user: string) {
  return user.slice(0, 4000);
}

function findRepetitive(text: string): string[] {
  const phrases = ["In conclusion", "It is important to note", "Furthermore", "In today's world", "Moreover"];
  return phrases.filter((p) => text.toLowerCase().includes(p.toLowerCase()));
}

function mockHumanize(text: string, settings: HumanizationSettings): string {
  let out = text;
  const swaps: Array<[RegExp, string]> = [
    [/\bin conclusion,?\s*/gi, "Overall, "],
    [/\bit is important to note that\s*/gi, ""],
    [/\bfurthermore,?\s*/gi, "Also, "],
    [/\bmoreover,?\s*/gi, "Beyond that, "],
    [/\bin today's world,?\s*/gi, "today "],
    [/\bin summary,?\s*/gi, "Put simply, "],
    [/\btherefore,?\s*/gi, "So "],
    [/\butilize\b/gi, "use"],
    [/\bleverage\b/gi, "use"],
    [/\brobust\b/gi, "strong"],
    [/\bdelve into\b/gi, "look at"],
    [/\bcomprehensive\b/gi, "thorough"],
    [/\bfacilitate\b/gi, "help"],
    [/\bin order to\b/gi, "to"],
    [/\bcutting-edge\b/gi, "modern"],
    [/\bgroundbreaking\b/gi, "notable"],
    [/\brevolutionize\b/gi, "change"],
    [/\ba wide variety of\b/gi, "many"],
    [/\bvery unique\b/gi, "distinct"],
    [/\bsubsequently\b/gi, "then"],
  ];

  for (const [re, rep] of swaps) out = out.replace(re, rep);

  // Capitalize sentence starts after phrase removals
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
  out = out.replace(/\s{2,}/g, " ");

  if (settings.tone === "simple") {
    out = out.replace(/\bapproximately\b/gi, "about");
  }

  // Introduce sentence-length variety + contractions (helps detection heuristic)
  if (settings.intensity !== "light" && out.length > 80) {
    const parts = out.split(/(?<=\.)\s+/);
    if (parts.length > 2) {
      const mid = Math.floor(parts.length / 2);
      if ((parts[mid] ?? "").split(/\s+/).length > 18) {
        parts[mid] = (parts[mid] ?? "")
          .replace(/,\s+/, ". ")
          .replace(/^([a-z])/, (c) => c.toUpperCase());
      }
      out = parts.join(" ");
    }
    out = out.replace(/^The\s+/, "This ").replace(/^This document\s+/i, "The piece ");
  }

  if (settings.intensity === "deep") {
    out = out
      .replace(/\bThis is\b/g, "Here's")
      .replace(/\bThere are\b/g, "You'll find")
      .replace(/\bIt is\b/g, "It's")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bAlso,\s*/gi, "")
      .replace(/\bBeyond that,\s*/gi, "And ")
      .replace(/\bOverall,\s*/gi, "");
    // Mix a short clause into longer runs for rhythm
    const bits = out.split(/(?<=\.)\s+/);
    if (bits.length >= 3) {
      bits.splice(1, 0, "That matters.");
      out = bits.join(" ");
    }
  }

  return out.trim().replace(/\s{2,}/g, " ");
}

export async function humanizePlainText(
  text: string,
  settings: HumanizationSettings = {
    tone: "natural",
    intensity: "balanced",
    preserveStyle: true,
    preserveTechnicalTerms: true,
    preserveCitations: true,
    preserveParagraphLength: true,
    avoidVocabChanges: false,
    doNotModifyNumbers: true,
    onlySelectedContent: false,
  },
): Promise<string> {
  if (!text.trim()) return text;
  if (config.aiProvider === "mock" || !config.openaiApiKey) {
    return mockHumanize(text, settings);
  }
  const client = createOpenAIClient();
  const res = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "Rewrite the user's text so it sounds natural and human. Preserve meaning, facts, numbers, names, and citations. Return only the rewritten text, no JSON or commentary.",
      },
      {
        role: "user",
        content: `Tone: ${settings.tone}. Intensity: ${settings.intensity}.\n\n${text}`,
      },
    ],
  });
  return (res.choices[0]?.message?.content ?? text).trim();
}

export async function analyzeDocument(paragraphs: ParagraphBlock[]): Promise<AnalysisResult> {
  const sample = paragraphs
    .filter((p) => p.text.trim())
    .slice(0, 40)
    .map((p) => `[${p.kind}${p.headingLevel ? ` h${p.headingLevel}` : ""}] ${p.text}`)
    .join("\n");

  const raw = await chat(
    "You are a document analysis engine. Return JSON only with keys: topic, audience, writingStyle, repetitiveExpressions (string[]), technicalSections (string[]), citationCount (number), summary (string).",
    sample,
  );
  const parsed = JSON.parse(raw) as AnalysisResult;
  return {
    topic: parsed.topic ?? "Unknown",
    audience: parsed.audience ?? "General",
    writingStyle: parsed.writingStyle ?? "Neutral",
    repetitiveExpressions: parsed.repetitiveExpressions ?? [],
    technicalSections: parsed.technicalSections ?? [],
    citationCount: parsed.citationCount ?? 0,
    summary: parsed.summary ?? "",
  };
}

const HUMANIZE_BATCH_SIZE = 20;

function isHumanizableParagraph(p: ParagraphBlock) {
  if (!p.text.trim()) return false;
  // Keep headings as structural anchors; humanize body, lists, table cells, and other prose.
  if (p.kind === "heading") return false;
  return true;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function humanizeParagraphs(
  req: HumanizeRequest & {
    onBatchProgress?: (done: number, total: number) => void | Promise<void>;
  },
): Promise<HumanizeResult> {
  const scoped = req.selectionIds?.length
    ? req.paragraphs.filter((p) => req.selectionIds!.includes(p.id))
    : req.paragraphs;

  // Full document: every page's body paragraphs, in document order — no page cap.
  const editable = scoped.filter(isHumanizableParagraph);
  const batches = chunk(editable, HUMANIZE_BATCH_SIZE);
  const allReplacements: HumanizeResult["replacements"] = [];

  const system = `You are a professional humanization engine for Word documents.
Rewrite unnatural or robotic prose across the FULL document batch provided.
PRIMARY GOAL: make the writing read as human so AI-detection likelihood stays under 15%.
Vary sentence length and openings, remove formulaic transitions, avoid buzzwords
(delve, leverage, robust, comprehensive, furthermore, moreover, in today's world).
Preserve meaning, facts, numbers, names, citations, terminology, and paragraph identity.
Return JSON: { "replacements": [{ "id", "index", "originalText", "modifiedText" }], "summary": string }.
Include every paragraph you change. Do not skip paragraphs because the document is long.
Intensity: ${req.settings.intensity}. Tone: ${req.settings.tone}.`;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const payload = JSON.stringify({
      settings: req.settings,
      instruction:
        req.instruction ??
        "Humanize the entire document so it sounds naturally human (AI detection target under 15%). Preserve meaning, numbers, names, citations, and technical terms. Process every paragraph in this batch.",
      batch: `${i + 1}/${batches.length}`,
      paragraphs: batch.map((p) => ({
        id: p.id,
        index: p.index,
        text: p.text,
        kind: p.kind,
      })),
    });

    try {
      const raw = await chat(system, payload);
      let parsed: HumanizeResult;
      try {
        parsed = JSON.parse(raw) as HumanizeResult;
      } catch {
        parsed = { replacements: [], summary: "" };
      }

      for (const r of parsed.replacements ?? []) {
        if (r.modifiedText && r.originalText && r.modifiedText !== r.originalText) {
          allReplacements.push(r);
        }
      }
    } catch (err) {
      console.error(`Humanize batch ${i + 1}/${batches.length} failed:`, err);
    }

    // Ensure every paragraph in the batch was considered (covers mock + partial LLM responses)
    const covered = new Set(
      allReplacements.filter((r) => batch.some((p) => p.id === r.id)).map((r) => r.id),
    );
    for (const p of batch) {
      if (covered.has(p.id)) continue;
      const modified = mockHumanize(p.text, req.settings);
      if (modified !== p.text) {
        allReplacements.push({
          id: p.id,
          index: p.index,
          originalText: p.text,
          modifiedText: modified,
        });
      }
    }

    await req.onBatchProgress?.(i + 1, batches.length);
  }

  // Deduplicate by paragraph id (last write wins)
  const byId = new Map<string, HumanizeResult["replacements"][number]>();
  for (const r of allReplacements) byId.set(r.id, r);
  const replacements = [...byId.values()].sort((a, b) => a.index - b.index);

  return {
    replacements,
    summary: `Humanized ${replacements.length} of ${editable.length} paragraph(s) across ${batches.length} batch(es) — full document, no page limit (${req.settings.intensity}, ${req.settings.tone}).`,
  };
}

export async function evaluateQuality(paragraphs: ParagraphBlock[]): Promise<QualityResult> {
  const sample = paragraphs
    .filter((p) => p.text.trim())
    .slice(0, 30)
    .map((p) => p.text)
    .join("\n");
  const raw = await chat(
    "You are a writing quality evaluator. Return JSON with numeric scores 0-100: naturalness, readability, sentenceVariation, grammarQuality, repetitiveLanguage.",
    sample,
  );
  const parsed = JSON.parse(raw) as QualityResult;
  return {
    naturalness: clamp(parsed.naturalness ?? 60),
    readability: clamp(parsed.readability ?? 65),
    sentenceVariation: clamp(parsed.sentenceVariation ?? 55),
    grammarQuality: clamp(parsed.grammarQuality ?? 80),
    repetitiveLanguage: clamp(parsed.repetitiveLanguage ?? 40),
  };
}

export async function agentReply(input: {
  message: string;
  documentSummary: string;
}): Promise<string> {
  if (config.aiProvider === "mock" || !config.openaiApiKey) {
    const m = input.message.toLowerCase();
    if (m.includes("analyze")) return "I'll analyze the document structure, style, and unnatural phrasing next.";
    if (m.includes("humanize") && m.includes("introduction"))
      return "I'll humanize the introduction while preserving meaning and formatting.";
    if (m.includes("humanize")) return "I'll humanize the document with your current settings and show changes for review.";
    if (m.includes("grammar")) return "I'll improve grammar without altering meaning.";
    if (m.includes("restore") || m.includes("original")) return "I can restore the original uploaded document.";
    return "I can analyze the document, humanize all or part of it, improve readability, or restore the original. What would you like to do?";
  }
  const client = createOpenAIClient();
  const res = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "You are HumanizerbyCaps.ai's writing agent. Be concise, professional, and focused on document editing. Never claim detector scores you cannot verify.",
      },
      { role: "user", content: `Document context:\n${input.documentSummary}\n\nUser: ${input.message}` },
    ],
  });
  return res.choices[0]?.message?.content ?? "How can I help with this document?";
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
