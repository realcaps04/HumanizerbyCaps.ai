import { OpenAI } from "openai";
import { AI_DETECTION_MAX_PERCENT } from "@humanizer/shared";
import { config } from "../../config.js";

const AI_TELLS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bit is important to note\b/gi, weight: 8 },
  { re: /\bin conclusion\b/gi, weight: 6 },
  { re: /\bin today's world\b/gi, weight: 8 },
  { re: /\bfurthermore\b/gi, weight: 4 },
  { re: /\bmoreover\b/gi, weight: 4 },
  { re: /\bdelve into\b/gi, weight: 7 },
  { re: /\bleverage\b/gi, weight: 5 },
  { re: /\brobust\b/gi, weight: 4 },
  { re: /\bcomprehensive\b/gi, weight: 3 },
  { re: /\bfacilitate\b/gi, weight: 4 },
  { re: /\bin order to\b/gi, weight: 3 },
  { re: /\ba wide variety of\b/gi, weight: 5 },
  { re: /\bcutting-edge\b/gi, weight: 5 },
  { re: /\bgroundbreaking\b/gi, weight: 5 },
  { re: /\brevolutionize\b/gi, weight: 6 },
  { re: /\butilize\b/gi, weight: 4 },
  { re: /\bsubsequent(?:ly)?\b/gi, weight: 3 },
  { re: /\btherefore\b/gi, weight: 2 },
  { re: /\bin summary\b/gi, weight: 4 },
  { re: /\bas an ai\b/gi, weight: 20 },
];

function sentenceStats(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) {
    return { count: 0, meanLen: 0, variance: 0, burstiness: 0 };
  }
  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(lengths.length, 1);
  // Higher burstiness (variation) looks more human
  const burstiness = mean > 0 ? Math.sqrt(variance) / mean : 0;
  return { count: sentences.length, meanLen: mean, variance, burstiness };
}

/**
 * Local heuristic AI-likelihood score (0–100).
 * Higher = more AI-like. Used for gating and as a fallback when no OpenAI key.
 */
export function heuristicAiScore(text: string): number {
  const sample = text.trim();
  if (!sample) return 0;

  let score = 8; // low baseline — natural prose should land under the 15% pass line

  for (const { re, weight } of AI_TELLS) {
    const matches = sample.match(re);
    if (matches?.length) score += Math.min(matches.length, 4) * weight;
  }

  const { count, meanLen, burstiness } = sentenceStats(sample);
  if (count >= 3) {
    // Uniform *long* sentences are the classic AI tell — short punchy prose is fine
    if (meanLen >= 16) {
      if (burstiness < 0.22) score += 16;
      else if (burstiness < 0.35) score += 8;
    } else if (burstiness > 0.55) {
      score -= 4;
    }

    if (meanLen > 22 && meanLen < 28 && burstiness < 0.3) score += 6;
  }

  // Heavy formulaic openers
  const openerHits = (sample.match(/\b(This|It|There)\s+(is|are|was|were|has|have)\b/gi) || [])
    .length;
  score += Math.min(openerHits, 5) * 2;

  // Contractions and short asides tend to read more human
  const contractions = (sample.match(/\b\w+'(?:s|re|ll|ve|d|t)\b/gi) || []).length;
  score -= Math.min(contractions, 6);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface AiDetectionResult {
  score: number;
  service: string;
  classification: "pass" | "fail";
  disclaimer: string;
  analyzedAt: string;
}

function classify(score: number): "pass" | "fail" {
  return score < AI_DETECTION_MAX_PERCENT ? "pass" : "fail";
}

/**
 * Estimate AI-detection probability for document text.
 * Prefer OpenAI when configured; always blend with heuristic so the gate stays grounded.
 */
export async function detectAiProbability(text: string): Promise<AiDetectionResult> {
  const heuristic = heuristicAiScore(text);
  const analyzedAt = new Date().toISOString();
  const disclaimer =
    `Internal AI-likelihood estimate (pass requires < ${AI_DETECTION_MAX_PERCENT}%). ` +
    "Not a certified third-party detector score.";

  if (config.aiProvider === "mock" || !config.openaiApiKey) {
    return {
      score: heuristic,
      service: "humanizer-heuristic",
      classification: classify(heuristic),
      disclaimer,
      analyzedAt,
    };
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const sample = text.slice(0, 12000);
    const res = await client.chat.completions.create({
      model: config.openaiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You estimate how likely a text would be flagged as AI-written by common detectors. " +
            'Return JSON: { "score": number 0-100 } where 0 is clearly human and 100 is clearly AI. ' +
            "Penalize formulaic transitions, uniform sentence rhythm, buzzwords, and generic filler.",
        },
        { role: "user", content: sample },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { score?: number };
    const llm = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || heuristic)));
    // Blend so neither signal can fully ignore the other
    const score = Math.round(heuristic * 0.45 + llm * 0.55);
    return {
      score,
      service: "humanizer-hybrid",
      classification: classify(score),
      disclaimer,
      analyzedAt,
    };
  } catch (err) {
    console.error("AI detection LLM fallback to heuristic:", err);
    return {
      score: heuristic,
      service: "humanizer-heuristic",
      classification: classify(heuristic),
      disclaimer,
      analyzedAt,
    };
  }
}

export function paragraphsToDetectionText(
  paragraphs: Array<{ text: string; kind?: string }>,
): string {
  return paragraphs
    .filter((p) => p.text.trim() && p.kind !== "heading")
    .map((p) => p.text.trim())
    .join("\n\n");
}
