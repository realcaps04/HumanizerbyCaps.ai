import { Router } from "express";
import { z } from "zod";
import {
  AI_DETECTION_MAX_PERCENT,
  DEFAULT_HUMANIZATION_SETTINGS,
  HUMANIZE_MAX_ATTEMPTS,
  type HumanizationIntensity,
  type HumanizationSettings,
} from "@humanizer/shared";
import { humanizePlainText } from "../services/ai/provider.js";
import { detectAiProbability } from "../services/ai/detect.js";

export const textRouter = Router();

function escalate(intensity: HumanizationIntensity): HumanizationIntensity {
  if (intensity === "light") return "balanced";
  return "deep";
}

textRouter.post("/humanize", async (req, res) => {
  const schema = z.object({
    text: z.string().min(1).max(20_000),
    settings: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "text is required" });

  try {
    let settings: HumanizationSettings = {
      ...DEFAULT_HUMANIZATION_SETTINGS,
      ...parsed.data.settings,
    };
    let output = parsed.data.text;
    let detection = await detectAiProbability(output);

    for (let attempt = 1; attempt <= HUMANIZE_MAX_ATTEMPTS; attempt++) {
      output = await humanizePlainText(parsed.data.text, settings);
      detection = await detectAiProbability(output);
      if (detection.classification === "pass") {
        return res.json({
          input: parsed.data.text,
          output,
          wordCount: parsed.data.text.trim().split(/\s+/).length,
          aiDetection: {
            score: detection.score,
            classification: detection.classification,
            service: detection.service,
            attempts: attempt,
            maxPercent: AI_DETECTION_MAX_PERCENT,
          },
        });
      }
      settings = {
        ...settings,
        intensity: escalate(settings.intensity),
        preserveStyle: false,
        avoidVocabChanges: false,
      };
    }

    return res.status(422).json({
      error: `Humanization failed: AI detection estimated at ${detection.score}% (required below ${AI_DETECTION_MAX_PERCENT}%).`,
      aiDetection: {
        score: detection.score,
        classification: detection.classification,
        service: detection.service,
        attempts: HUMANIZE_MAX_ATTEMPTS,
        maxPercent: AI_DETECTION_MAX_PERCENT,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Humanize failed" });
  }
});
