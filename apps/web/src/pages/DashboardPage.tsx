import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  FileUp,
  Loader2,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { DashboardStats, DocumentRecord } from "@humanizer/shared";
import { api } from "@/lib/api";
import { Logo } from "@/components/ui";
import { UploadAnimation } from "@/components/UploadAnimation";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export function DashboardPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api.dashboard();
    setStats(data.stats);
    setDocs(data.recentDocuments);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only DOCX files are supported right now. PDF/DOC import comes later.");
      return;
    }
    setUploading(true);
    setUploadName(file.name);
    setError(null);
    try {
      const res = await api.uploadDocument(file);
      navigate(`/app/documents/${res.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setUploadName(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await api.deleteDocument(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const unlimited =
    !!stats &&
    (stats.wordAllowance >= Number.MAX_SAFE_INTEGER / 2 || !Number.isFinite(stats.wordAllowance));
  const usagePct =
    stats && stats.wordAllowance > 0 && !unlimited
      ? Math.min(100, Math.round((stats.wordsUsedThisMonth / stats.wordAllowance) * 100))
      : 0;

  return (
    <div className="min-h-full bg-[#07070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#5b21b640,transparent_55%),radial-gradient(ellipse_at_bottom_left,#312e8140,transparent_40%)]" />

      <header className="relative z-20 border-b border-white/10 bg-[#07070b]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo dark />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/#tool"
              className="hidden rounded-full px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              Text tool
            </Link>
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              New document
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <input
          ref={fileRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-violet-300">Document workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Welcome to HumanizerbyCaps.ai
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              Upload a Word document to humanize writing in place while keeping formatting intact.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={FileText}
            label="Documents"
            value={stats ? formatNumber(stats.totalDocuments) : "—"}
          />
          <StatCard
            icon={Wand2}
            label="Words humanized"
            value={stats ? formatNumber(stats.totalWordsHumanized) : "—"}
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/45">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              Monthly usage
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {stats
                ? unlimited
                  ? `${formatNumber(stats.wordsUsedThisMonth)} / Unlimited`
                  : `${formatNumber(stats.wordsUsedThisMonth)} / ${formatNumber(stats.wordAllowance)}`
                : "—"}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: unlimited ? "100%" : `${usagePct}%` }}
              />
            </div>
            <p className="mt-2 text-xs capitalize text-white/40">
              {stats?.plan ?? "pro"} plan · {unlimited ? "unlimited" : "free"}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-8 rounded-2xl border border-dashed px-6 py-12 text-center transition",
            uploading &&
              "border-violet-400/50 bg-violet-600/10 shadow-[0_0_80px_rgba(139,92,246,0.28)]",
            !uploading &&
              (dragOver
                ? "border-violet-400 bg-violet-600/20 shadow-[0_0_60px_rgba(139,92,246,0.25)]"
                : "border-white/15 bg-white/[0.03] hover:border-violet-500/40"),
          )}
          onDragOver={(e) => {
            if (uploading) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!uploading) void handleFiles(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <UploadAnimation filename={uploadName} />
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-300">
                <FileUp className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base font-medium">Drop a .docx file here</p>
              <p className="mt-1 text-sm text-white/45">
                Formatting, headings, tables, and styles are preserved.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                <FileUp className="h-4 w-4" />
                Browse files
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Recent documents</h2>
            {docs.length > 0 && (
              <span className="text-xs text-white/40">{docs.length} file{docs.length === 1 ? "" : "s"}</span>
            )}
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-white/45">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              Loading documents…
            </div>
          ) : docs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-white/25" />
              <p className="mt-3 text-sm text-white/55">No documents yet</p>
              <p className="mt-1 text-xs text-white/35">
                Upload a DOCX to start humanizing with full formatting support.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-500/40 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/app/documents/${doc.id}`}
                        className="block truncate text-sm font-medium text-white hover:text-violet-300"
                      >
                        {doc.originalFilename}
                      </Link>
                      <p className="mt-1 text-xs text-white/40">{formatDate(doc.updatedAt)}</p>
                    </div>
                    <StatusPill status={doc.processingStatus} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs text-white/45">
                      {formatNumber(doc.wordCount)} words
                    </span>
                    <div className="flex gap-1.5">
                      <Link
                        to={`/app/documents/${doc.id}`}
                        className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(doc)}
                        className="rounded-full border border-white/10 p-1.5 text-white/40 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !deleting && setPendingDelete(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-[0_0_60px_rgba(109,40,217,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 id="delete-dialog-title" className="mt-4 text-center text-lg font-semibold">
              Delete this document and its versions?
            </h2>
            <p className="mt-2 text-center text-sm text-white/55">
              <span className="font-medium text-white/80">{pendingDelete.originalFilename}</span>{" "}
              will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="h-11 flex-1 rounded-full border border-white/15 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/45">
        <Icon className="h-3.5 w-3.5 text-violet-300" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "ready"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "failed"
        ? "bg-amber-500/15 text-amber-300"
        : status.includes("ing")
          ? "bg-violet-500/15 text-violet-300"
          : "bg-white/10 text-white/50";

  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", tone)}>
      {status}
    </span>
  );
}
