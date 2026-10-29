import { cn } from "@/lib/utils";

export function UploadAnimation({
  filename,
  className,
}: {
  filename?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)} aria-live="polite">
      <div className="upload-scene relative h-28 w-28">
        <div className="upload-glow absolute inset-0 rounded-full bg-violet-500/20 blur-2xl" />

        {/* Orbit ring */}
        <div className="upload-ring absolute inset-2 rounded-full border border-violet-400/20" />
        <div className="upload-ring-spin absolute inset-2 rounded-full border-2 border-transparent border-t-violet-400 border-r-fuchsia-400" />

        {/* Folder / tray */}
        <div className="absolute inset-x-0 bottom-3 mx-auto h-12 w-16">
          <div className="absolute inset-x-1 top-0 h-2 rounded-t-md bg-violet-400/80" />
          <div className="absolute inset-x-0 top-1.5 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_8px_24px_rgba(139,92,246,0.45)]" />
          <div className="absolute inset-x-2 top-3 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Floating document pages */}
        <div className="upload-page upload-page-1 absolute left-1/2 top-2 h-10 w-8 -translate-x-1/2 rounded-md border border-white/20 bg-white shadow-lg">
          <div className="mt-2 space-y-1 px-1.5">
            <div className="h-0.5 w-full rounded bg-violet-300/80" />
            <div className="h-0.5 w-4/5 rounded bg-violet-200/70" />
            <div className="h-0.5 w-full rounded bg-violet-200/60" />
          </div>
        </div>
        <div className="upload-page upload-page-2 absolute left-1/2 top-2 h-10 w-8 -translate-x-1/2 rounded-md border border-white/15 bg-violet-50 shadow-md">
          <div className="mt-2 space-y-1 px-1.5">
            <div className="h-0.5 w-full rounded bg-fuchsia-300/70" />
            <div className="h-0.5 w-3/5 rounded bg-fuchsia-200/60" />
          </div>
        </div>
        <div className="upload-page upload-page-3 absolute left-1/2 top-2 h-10 w-8 -translate-x-1/2 rounded-md border border-white/10 bg-white/90 shadow">
          <div className="mt-2 space-y-1 px-1.5">
            <div className="h-0.5 w-full rounded bg-violet-200/80" />
            <div className="h-0.5 w-4/5 rounded bg-violet-100/70" />
          </div>
        </div>

        {/* Rising particles */}
        <span className="upload-dot upload-dot-1" />
        <span className="upload-dot upload-dot-2" />
        <span className="upload-dot upload-dot-3" />
      </div>

      <p className="mt-5 text-base font-medium text-white">Uploading document…</p>
      {filename && (
        <p className="mt-1 max-w-xs truncate text-sm text-violet-300/90" title={filename}>
          {filename}
        </p>
      )}
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="upload-progress h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-400" />
      </div>
      <p className="mt-3 text-sm text-white/45">
        Preserving formatting, headings, tables, and styles
      </p>
    </div>
  );
}
