import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  History,
  Loader2,
  Redo2,
  Undo2,
  Columns2,
} from "lucide-react";
import {
  DEFAULT_HUMANIZATION_SETTINGS,
  type DocumentAnalysisProfile,
  type DocumentEdit,
  type DocumentRecord,
  type DocumentVersion,
  type HumanizationSettings,
  type WritingQualityReport,
} from "@humanizer/shared";
import { api } from "@/lib/api";
import { AgentPanel } from "@/components/AgentPanel";
import { DocxViewer } from "@/components/DocxViewer";
import { Logo } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export function WorkspacePage() {
  const { id = "" } = useParams();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [edits, setEdits] = useState<DocumentEdit[]>([]);
  const [chat, setChat] = useState<
    Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>
  >([]);
  const [analysis, setAnalysis] = useState<DocumentAnalysisProfile | null>(null);
  const [quality, setQuality] = useState<WritingQualityReport | null>(null);
  const [settings, setSettings] = useState<HumanizationSettings>(DEFAULT_HUMANIZATION_SETTINGS);
  const [view, setView] = useState<"current" | "original" | "compare">("current");
  const [showVersions, setShowVersions] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [agentWidth, setAgentWidth] = useState(360);
  const dragging = useRef(false);
  const versionCursor = useRef(0);

  const reload = useCallback(async () => {
    const data = await api.getDocument(id);
    setDoc(data.document);
    setVersions(data.versions);
    setEdits(data.edits);
    setChat(data.chat);
    setAnalysis(data.analysis);
    setQuality(data.quality);
    setSettings(data.settings ?? DEFAULT_HUMANIZATION_SETTINGS);
    setRevision((r) => r + 1);
    versionCursor.current = 0;
  }, [id]);

  useEffect(() => {
    void reload().catch(console.error);
  }, [reload]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const next = Math.min(520, Math.max(280, window.innerWidth - e.clientX));
      setAgentWidth(next);
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const highlights = useMemo(
    () => edits.filter((e) => e.editStatus === "pending").map((e) => e.modifiedText),
    [edits],
  );

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setSaveLabel("Working…");
    try {
      await fn();
      setSaveLabel("Saved");
    } catch (err) {
      setSaveLabel("Error");
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function download(which: "current" | "original") {
    const blob = await api.fetchDocxBlob(id, which);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${which === "original" ? "original-" : ""}${doc?.originalFilename ?? "document.docx"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function undoVersion() {
    if (versions.length < 2) return;
    const idx = Math.min(versionCursor.current + 1, versions.length - 1);
    const target = versions[idx];
    if (!target) return;
    await withBusy(async () => {
      await api.restoreVersion(id, target.id);
      versionCursor.current = idx;
      await reload();
    });
  }

  async function redoVersion() {
    if (versionCursor.current <= 0) return;
    const idx = versionCursor.current - 1;
    const target = versions[idx];
    if (!target) return;
    await withBusy(async () => {
      await api.restoreVersion(id, target.id);
      versionCursor.current = idx;
      await reload();
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#07070b] text-white">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b0b12]/95 px-3 backdrop-blur">
        <Link to="/app" className="shrink-0">
          <Logo dark className="text-sm" />
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white/90">
            {doc?.originalFilename ?? "Loading…"}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            saveLabel === "Saved" && "bg-emerald-500/15 text-emerald-300",
            saveLabel === "Error" && "bg-rose-500/15 text-rose-300",
            saveLabel === "Working…" && "bg-violet-500/15 text-violet-300",
          )}
        >
          {saveLabel}
        </span>
        <ToolBtn disabled={busy} onClick={() => void undoVersion()} title="Undo">
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn disabled={busy} onClick={() => void redoVersion()} title="Redo">
          <Redo2 className="h-4 w-4" />
        </ToolBtn>
        <ViewTab active={view === "original"} onClick={() => setView("original")}>
          Original
        </ViewTab>
        <ViewTab active={view === "current"} onClick={() => setView("current")}>
          Humanized
        </ViewTab>
        <ToolBtn
          active={view === "compare"}
          onClick={() => setView("compare")}
          title="Compare"
        >
          <Columns2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={showVersions} onClick={() => setShowVersions((v) => !v)} title="History">
          <History className="h-4 w-4" />
        </ToolBtn>
        <button
          type="button"
          onClick={() => void download("current")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-xs font-semibold text-white hover:from-violet-500 hover:to-fuchsia-500"
        >
          <Download className="h-3.5 w-3.5" />
          Export DOCX
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {view === "compare" ? (
            <div className="grid h-full grid-cols-2">
              <div className="border-r border-white/10">
                <div className="border-b border-white/10 bg-[#0b0b12] px-3 py-1.5 text-xs text-white/45">
                  Original
                </div>
                <DocxViewer
                  documentId={id}
                  revision={revision}
                  which="original"
                  className="h-[calc(100%-28px)]"
                />
              </div>
              <div>
                <div className="border-b border-white/10 bg-[#0b0b12] px-3 py-1.5 text-xs text-white/45">
                  Current
                </div>
                <DocxViewer
                  documentId={id}
                  revision={revision}
                  which="current"
                  highlightTexts={highlights}
                  className="h-[calc(100%-28px)]"
                />
              </div>
            </div>
          ) : (
            <DocxViewer
              documentId={id}
              revision={revision}
              which={view}
              highlightTexts={view === "current" ? highlights : []}
            />
          )}
        </div>

        <div
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-violet-500/40"
          onMouseDown={() => {
            dragging.current = true;
          }}
        />

        <div style={{ width: agentWidth }} className="shrink-0">
          <AgentPanel
            messages={chat}
            edits={edits}
            analysis={analysis}
            quality={quality}
            settings={settings}
            busy={busy}
            onSettingsChange={setSettings}
            onSend={async (message) => {
              await withBusy(async () => {
                await api.chat(id, message, settings);
                await reload();
              });
            }}
            onQuick={async (action) => {
              await withBusy(async () => {
                if (action === "analyze") await api.analyze(id);
                if (action === "humanize") await api.humanize(id, { settings });
                if (action === "quality") await api.quality(id);
                if (action === "restore") await api.restoreOriginal(id);
                await reload();
              });
            }}
            onEditDecision={async (editId, status) => {
              await withBusy(async () => {
                await api.updateEdit(id, editId, status);
                setEdits((prev) =>
                  prev.map((e) => (e.id === editId ? { ...e, editStatus: status } : e)),
                );
                await reload();
              });
            }}
            onEditDecisionAll={async (status) => {
              await withBusy(async () => {
                await api.updateAllEdits(id, status);
                setEdits((prev) =>
                  prev.map((e) =>
                    e.editStatus === "pending" ? { ...e, editStatus: status } : e,
                  ),
                );
                await reload();
              });
            }}
          />
        </div>

        {showVersions && (
          <div
            className="absolute right-[calc(var(--w)+8px)] top-2 z-20 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] shadow-[0_0_40px_rgba(109,40,217,0.2)]"
            style={{ ["--w" as string]: `${agentWidth}px` }}
          >
            <div className="border-b border-white/10 px-3 py-2 text-sm font-medium">
              Version history
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="mb-1 w-full rounded-xl px-2 py-2 text-left text-xs hover:bg-white/5"
                  disabled={busy}
                  onClick={() =>
                    void withBusy(async () => {
                      await api.restoreVersion(id, v.id);
                      await reload();
                      setShowVersions(false);
                    })
                  }
                >
                  <div className="font-medium text-violet-300">v{v.versionNumber}</div>
                  <div className="text-white/55">{v.changeDescription}</div>
                  <div className="text-white/35">{formatDate(v.createdAt)}</div>
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 p-2">
              <button
                type="button"
                onClick={() => void download("original")}
                className="w-full rounded-full border border-white/15 py-2 text-xs font-medium text-white/80 hover:bg-white/5"
              >
                Download original
              </button>
            </div>
          </div>
        )}

        {busy && (
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#12121a]/95 px-3 py-1.5 text-xs shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
            Processing…
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  disabled,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-40",
        active && "bg-violet-600/30 text-violet-200",
      )}
    >
      {children}
    </button>
  );
}

function ViewTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hidden h-8 rounded-full px-3 text-xs font-medium sm:inline-flex sm:items-center",
        active
          ? "bg-violet-600/30 text-violet-200"
          : "text-white/55 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
