import { useEffect, useRef, useState } from "react";
import {
  AI_DETECTION_MAX_PERCENT,
  DEFAULT_HUMANIZATION_SETTINGS,
  type DocumentAnalysisProfile,
  type DocumentEdit,
  type HumanizationSettings,
  type WritingQualityReport,
} from "@humanizer/shared";
import {
  Check,
  Loader2,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface Props {
  messages: Message[];
  edits: DocumentEdit[];
  analysis: DocumentAnalysisProfile | null;
  quality: WritingQualityReport | null;
  settings: HumanizationSettings;
  busy: boolean;
  onSettingsChange: (s: HumanizationSettings) => void;
  onSend: (message: string) => Promise<void>;
  onQuick: (action: "analyze" | "humanize" | "quality" | "restore") => Promise<void>;
  onEditDecision: (editId: string, status: "accepted" | "rejected") => Promise<void>;
}

const PROMPT_EXAMPLES = [
  "Humanize the entire document",
  "Humanize the introduction",
  "Make this more professional",
  "Improve readability",
  "Restore original",
] as const;

function useTypingPlaceholder(examples: readonly string[], active: boolean) {
  const [text, setText] = useState(examples[0] ?? "");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setText(examples[indexRef.current] ?? examples[0] ?? "");
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setText(examples[0] ?? "");
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, ms);
      });

    const typeLoop = async () => {
      while (!cancelled) {
        const full = examples[indexRef.current] ?? "";
        for (let i = 1; i <= full.length; i++) {
          if (cancelled) return;
          setText(full.slice(0, i));
          await wait(36);
        }
        await wait(1600);
        for (let i = full.length; i >= 0; i--) {
          if (cancelled) return;
          setText(full.slice(0, i));
          await wait(22);
        }
        await wait(350);
        indexRef.current = (indexRef.current + 1) % examples.length;
      }
    };

    void typeLoop();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, examples]);

  return text || examples[0] || "";
}

export function AgentPanel({
  messages,
  edits,
  analysis,
  quality,
  settings,
  busy,
  onSettingsChange,
  onSend,
  onQuick,
  onEditDecision,
}: Props) {
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = edits.filter((e) => e.editStatus === "pending");
  const placeholder = useTypingPlaceholder(PROMPT_EXAMPLES, !input && !inputFocused && !busy);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending.length]);

  async function sendPrompt(msg: string) {
    const text = msg.trim();
    if (!text || busy) return;
    setInput("");
    await onSend(text);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await sendPrompt(input);
  }

  return (
    <div className="flex h-full flex-col border-l border-white/10 bg-[#0b0b12] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Agent</div>
            <div className="text-[11px] text-white/40">Context-aware humanization</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Settings"
          className="rounded-full p-2 text-white/50 hover:bg-white/5 hover:text-white"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {showSettings && (
        <div className="space-y-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium text-white/45">Writing tone</div>
            <select
              className="h-8 w-full rounded-lg border border-white/10 bg-[#12121a] px-2 text-sm text-white"
              value={settings.tone}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  tone: e.target.value as HumanizationSettings["tone"],
                })
              }
            >
              {["natural", "conversational", "professional", "academic", "formal", "simple"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t === "simple" ? "Simple and clear" : t[0].toUpperCase() + t.slice(1)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-white/45">Intensity</div>
            <div className="flex gap-1">
              {(["light", "balanced", "deep"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, intensity: level })}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize",
                    settings.intensity === level
                      ? "border-violet-500/50 bg-violet-600/20 text-violet-200"
                      : "border-white/10 bg-[#12121a] text-white/50",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ["preserveTechnicalTerms", "Preserve technical terminology"],
              ["preserveCitations", "Preserve citations"],
              ["doNotModifyNumbers", "Do not modify numerical data"],
              ["preserveStyle", "Preserve original writing style"],
              ["avoidVocabChanges", "Avoid unnecessary vocabulary changes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => onSettingsChange({ ...settings, [key]: e.target.checked })}
                className="accent-violet-500"
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            className="text-xs text-violet-300 underline"
            onClick={() => onSettingsChange(DEFAULT_HUMANIZATION_SETTINGS)}
          >
            Reset to defaults
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-3 py-2">
        <QuickBtn disabled={busy} onClick={() => onQuick("analyze")}>
          Analyze
        </QuickBtn>
        <QuickBtn disabled={busy} onClick={() => onQuick("humanize")}>
          Humanize
        </QuickBtn>
        <QuickBtn disabled={busy} onClick={() => onQuick("quality")}>
          Quality
        </QuickBtn>
        <QuickBtn disabled={busy} onClick={() => onQuick("restore")}>
          Original
        </QuickBtn>
      </div>

      <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
        {analysis && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="font-medium text-violet-200">Analysis profile</div>
            <p className="mt-1 text-white/55">{analysis.summary}</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-white/40">
              <span>Topic: {analysis.topic}</span>
              <span>Style: {analysis.writingStyle}</span>
              <span>Paragraphs: {analysis.paragraphCount}</span>
              <span>Citations: {analysis.citationCount}</span>
            </div>
          </div>
        )}

        {quality && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="font-medium text-violet-200">Writing quality</div>
            {typeof quality.aiDetection?.score === "number" && (
              <div
                className={cn(
                  "mt-2 rounded-lg border px-2.5 py-2",
                  quality.aiDetection.classification === "pass"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-rose-500/40 bg-rose-500/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white/80">AI detection</span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      quality.aiDetection.classification === "pass"
                        ? "text-emerald-300"
                        : "text-rose-300",
                    )}
                  >
                    {quality.aiDetection.score}%
                    {quality.aiDetection.classification === "pass" ? " · pass" : " · fail"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-white/45">
                  Pass requires under {AI_DETECTION_MAX_PERCENT}%. {quality.aiDetection.disclaimer}
                </p>
              </div>
            )}
            <div className="mt-2 space-y-1">
              {(
                [
                  ["Naturalness", quality.naturalness],
                  ["Readability", quality.readability],
                  ["Sentence variation", quality.sentenceVariation],
                  ["Grammar", quality.grammarQuality],
                  ["Repetitive language", quality.repetitiveLanguage],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-32 text-white/45">{label}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-white/70">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-sm text-white/45">
            Ask the agent to analyze the document, humanize a section, or improve selected writing.
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                : "mr-4 border border-white/10 bg-white/[0.04] text-white/85",
            )}
          >
            {m.content}
          </div>
        ))}

        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.slice(0, 12).map((edit) => (
              <div key={edit.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-xs">
                <div className="text-white/35 line-through">{edit.originalText.slice(0, 140)}</div>
                <div className="mt-1 text-violet-100">{edit.modifiedText.slice(0, 140)}</div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEditDecision(edit.id, "accepted")}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600/80 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEditDecision(edit.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-white/10 p-3">
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {PROMPT_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={busy}
              onClick={() => void sendPrompt(example)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] font-medium leading-tight text-white/70 transition hover:border-violet-500/45 hover:bg-violet-600/15 hover:text-white disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={placeholder}
            className="h-10 flex-1 rounded-full border border-white/10 bg-[#12121a] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-500/60"
            disabled={busy}
            aria-label="Ask the AI agent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuickBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/75 hover:border-violet-500/40 hover:bg-violet-600/15 hover:text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
