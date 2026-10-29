import { Link } from "react-router-dom";
import { Logo } from "@/components/ui";

export function SettingsPage() {
  return (
    <div className="min-h-full bg-[#07070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#5b21b640,transparent_55%)]" />
      <header className="relative z-20 border-b border-white/10 bg-[#07070b]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo dark />
          </Link>
          <Link
            to="/app"
            className="rounded-full border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">Mode</div>
            <div className="mt-1 text-sm font-medium">Local workspace (no sign-in)</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">AI provider</div>
            <div className="mt-1 text-sm font-medium">
              Configured via API <code className="text-violet-300">.env</code> (
              <code className="text-violet-300">AI_PROVIDER</code>)
            </div>
          </div>
          <p className="text-xs text-white/40">
            Documents are stored under <code className="text-white/55">data/storage</code>. Convex
            can be added later if needed.
          </p>
        </div>
      </main>
    </div>
  );
}
