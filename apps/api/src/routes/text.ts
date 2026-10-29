import { Router } from "express";
import { z } from "zod";
import { DEFAULT_HUMANIZATION_SETTINGS } from "@humanizer/shared";
import { humanizePlainText } from "../services/ai/provider.js";

export const textRouter = Router();

textRouter.post("/humanize", async (req, res) => {
  const schema = z.object({
    text: z.string().min(1).max(20_000),
    settings: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "text is required" });

  try {
    const settings = { ...DEFAULT_HUMANIZATION_SETTINGS, ...parsed.data.settings };
    const output = await humanizePlainText(parsed.data.text, settings);
    res.json({
      input: parsed.data.text,
      output,
      wordCount: parsed.data.text.trim().split(/\s+/).length,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Humanize failed" });
  }
});
