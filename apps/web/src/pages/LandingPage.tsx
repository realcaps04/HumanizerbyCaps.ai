import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Eraser,
  FileText,
  Loader2,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/utils";

const PRESS_LOGOS = [
  { name: "Forbes", src: "/press/forbes.svg", height: 22 },
  { name: "Business Insider", src: "/press/business-insider.svg", height: 18 },
  { name: "Yahoo", src: "/press/yahoo.svg", height: 24 },
  { name: "Product Hunt", src: "/press/product-hunt.svg", height: 26 },
  { name: "Medium", src: "/press/medium.svg", height: 24 },
  { name: "TechCrunch", src: "/press/techcrunch.svg", height: 20 },
  { name: "WIRED", src: "/press/wired.svg", height: 18 },
  { name: "The Verge", src: "/press/the-verge.svg", height: 20 },
  { name: "Mashable", src: "/press/mashable.svg", height: 20 },
  { name: "CNET", src: "/press/cnet.svg", height: 20 },
  { name: "Engadget", src: "/press/engadget.svg", height: 20 },
  { name: "Fast Company", src: "/press/fast-company.svg", height: 18 },
  { name: "Inc.", src: "/press/inc.svg", height: 22 },
  { name: "Hacker News", src: "/press/hacker-news.svg", height: 26 },
  { name: "Reddit", src: "/press/reddit.svg", height: 26 },
  { name: "Gizmodo", src: "/press/gizmodo.svg", height: 20 },
  { name: "Lifehacker", src: "/press/lifehacker.svg", height: 18 },
  { name: "VentureBeat", src: "/press/venturebeat.svg", height: 18 },
  { name: "ZDNET", src: "/press/zdnet.svg", height: 20 },
  { name: "Ars Technica", src: "/press/ars-technica.svg", height: 18 },
  { name: "Bloomberg", src: "/press/bloomberg.svg", height: 20 },
  { name: "Reuters", src: "/press/reuters.svg", height: 20 },
  { name: "Axios", src: "/press/axios.svg", height: 22 },
  { name: "POLITICO", src: "/press/politico.svg", height: 18 },
  { name: "The Atlantic", src: "/press/the-atlantic.svg", height: 18 },
  { name: "The Guardian", src: "/press/guardian.svg", height: 18 },
  { name: "BBC", src: "/press/bbc.svg", height: 22 },
  { name: "CNN", src: "/press/cnn.svg", height: 22 },
  { name: "The New York Times", src: "/press/nytimes.svg", height: 16 },
  { name: "WSJ", src: "/press/wsj.svg", height: 14 },
  { name: "Entrepreneur", src: "/press/entrepreneur.svg", height: 18 },
  { name: "Harvard Business Review", src: "/press/harvard-business-review.svg", height: 14 },
  { name: "MIT Technology Review", src: "/press/mit-technology-review.svg", height: 14 },
  { name: "Smashing Magazine", src: "/press/smashing-magazine.svg", height: 16 },
  { name: "CSS-Tricks", src: "/press/css-tricks.svg", height: 18 },
  { name: "DEV", src: "/press/devto.svg", height: 22 },
  { name: "Hashnode", src: "/press/hashnode.svg", height: 18 },
  { name: "Substack", src: "/press/substack.svg", height: 18 },
  { name: "GitHub", src: "/press/github.svg", height: 20 },
  { name: "Vercel", src: "/press/vercel.svg", height: 20 },
  { name: "OpenAI", src: "/press/openai.svg", height: 20 },
  { name: "Anthropic", src: "/press/anthropic.svg", height: 18 },
  { name: "Google", src: "/press/google.svg", height: 20 },
  { name: "Microsoft", src: "/press/microsoft.svg", height: 18 },
  { name: "Amazon", src: "/press/amazon.svg", height: 20 },
  { name: "Apple", src: "/press/apple.svg", height: 20 },
  { name: "LinkedIn", src: "/press/linkedin.svg", height: 18 },
  { name: "YouTube", src: "/press/youtube.svg", height: 18 },
  { name: "TikTok", src: "/press/tiktok.svg", height: 20 },
  { name: "Spotify", src: "/press/spotify.svg", height: 20 },
  { name: "Stripe", src: "/press/stripe.svg", height: 20 },
  { name: "Figma", src: "/press/figma.svg", height: 20 },
  { name: "Canva", src: "/press/canva.svg", height: 20 },
  { name: "Notion", src: "/press/notion.svg", height: 20 },
  { name: "Slack", src: "/press/slack.svg", height: 20 },
  { name: "Dropbox", src: "/press/dropbox.svg", height: 20 },
  { name: "Shopify", src: "/press/shopify.svg", height: 18 },
  { name: "HubSpot", src: "/press/hubspot.svg", height: 18 },
  { name: "Salesforce", src: "/press/salesforce.svg", height: 18 },
  { name: "Adobe", src: "/press/adobe.svg", height: 20 },
  { name: "Airbnb", src: "/press/airbnb.svg", height: 20 },
  { name: "Behance", src: "/press/behance.svg", height: 18 },
  { name: "Dribbble", src: "/press/dribbble.svg", height: 18 },
] as const;

const FEATURES = [
  {
    icon: Wand2,
    title: "Humanize AI Content",
    body: "Rewrite robotic AI drafts into natural, fluent writing that keeps your original meaning.",
  },
  {
    icon: ShieldCheck,
    title: "Meaning Preserved",
    body: "Facts, numbers, names, and citations stay intact while phrasing becomes more human.",
  },
  {
    icon: BadgeCheck,
    title: "Plagiarism Conscious",
    body: "Produce original wording instead of shallow synonym swaps that still sound synthetic.",
  },
  {
    icon: Sparkles,
    title: "Natural Flow",
    body: "Improve transitions, sentence variety, and readability without over-editing good prose.",
  },
  {
    icon: FileText,
    title: "DOCX Workspace",
    body: "Upload Word documents and humanize in place while preserving layout and formatting.",
  },
  {
    icon: Zap,
    title: "Fast Results",
    body: "Paste text or open a document and get refined writing in seconds, not hours.",
  },
  {
    icon: ClipboardPaste,
    title: "Paste & Go",
    body: "Drop AI-generated paragraphs into the editor and humanize with one click.",
  },
  {
    icon: Eraser,
    title: "Remove AI Tone",
    body: "Strip formulaic phrases, filler transitions, and repetitive structures.",
  },
  {
    icon: Check,
    title: "Export Ready",
    body: "Copy polished text instantly or continue in the DOCX workspace for full documents.",
  },
];

const STEPS = [
  {
    icon: ClipboardPaste,
    title: "Paste your text",
    body: "Drop AI-generated or awkward writing into the left panel.",
  },
  {
    icon: MousePointerClick,
    title: "Click Humanize",
    body: "We rewrite unnatural phrasing while preserving your intent.",
  },
  {
    icon: Sparkles,
    title: "Get human results",
    body: "Copy the polished output or open the full document workspace.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The dual editor is exactly what our content team needed. It cleans AI tone without killing the message.",
    name: "Ava Mitchell",
    role: "Content Lead",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    quote:
      "We switched to HumanizerbyCaps.ai for proposal drafts. The DOCX formatting stay intact is a huge win.",
    name: "Jordan Lee",
    role: "Operations Manager",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&h=160&q=80",
  },
  {
    quote:
      "Fast, clear, and natural. It finally feels like a real writing tool instead of a synonym spinner.",
    name: "Sam Rivera",
    role: "Freelance Writer",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&h=160&q=80",
  },
];

const FAQS = [
  {
    q: "What is HumanizerbyCaps.ai?",
    a: "HumanizerbyCaps.ai is an AI writing refinement platform that turns unnatural or AI-generated text into fluent human writing, with an optional Word document workspace that preserves formatting.",
  },
  {
    q: "Is it free to use?",
    a: "Yes. You can use the on-page humanizer and local document workspace without creating an account. Plan limits can be configured later for team deployments.",
  },
  {
    q: "Does it change my meaning?",
    a: "No. The engine is designed to preserve meaning, facts, numbers, names, citations, and technical terms while improving naturalness.",
  },
  {
    q: "Can I humanize Word documents?",
    a: "Yes. Open the workspace to upload a .docx file, humanize sections or the full document, review changes, and export a valid DOCX.",
  },
  {
    q: "Do I need to sign up?",
    a: "No. Sign-in is not required. Everything runs in a local workspace so you can start immediately.",
  },
  {
    q: "What AI detection target do you use?",
    a: "Every humanized document must score under 15% on our AI-likelihood check. If it cannot after retries, humanization is marked as failed.",
  },
];

const PLANS = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    features: ["1,000 words / run", "On-page humanizer", "Basic tone controls", "DOCX upload (limited)"],
  },
  {
    name: "Basic",
    monthly: 0,
    yearly: 0,
    features: ["10,000 words / month", "Faster processing", "Style presets", "Version history"],
  },
  {
    name: "Standard",
    monthly: 0,
    yearly: 0,
    highlight: true,
    features: ["50,000 words / month", "Full DOCX workspace", "Advanced controls", "Priority support"],
  },
  {
    name: "Pro",
    monthly: 0,
    yearly: 0,
    features: ["Unlimited soft cap", "Team-ready limits", "Export validation", "Best for heavy use"],
  },
];

export function LandingPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  const words = useMemo(() => {
    const t = input.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [input]);

  async function humanize() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.humanizeText(input);
      setOutput(res.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Humanize failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-full bg-[#07070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#5b21b640,transparent_55%),radial-gradient(ellipse_at_bottom_right,#312e8140,transparent_40%)]" />

      <header className="relative z-20 border-b border-white/10 bg-[#07070b]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo dark />
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#tool" className="hover:text-white">
              Tools
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
          </nav>
          <Link
            to="/app"
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Open Workspace
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section id="tool" className="mx-auto max-w-6xl px-6 pb-16 pt-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium text-violet-300">AI text & document humanizer</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Humanize AI writing with{" "}
              <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                HumanizerbyCaps.ai
              </span>
            </h1>
            <p className="mt-4 text-base text-white/60">
              Paste text below or open the Word workspace. Keep meaning intact. Make the writing sound human.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]/90 shadow-[0_0_80px_rgba(109,40,217,0.18)]">
            <div className="grid lg:grid-cols-2">
              <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
                <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                  <span>Input</span>
                  <span>{words} words</span>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter text here…"
                  className="h-64 w-full resize-none rounded-xl border border-white/10 bg-[#0b0b12] p-4 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-violet-500/60"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void humanize()}
                    disabled={busy || !input.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Humanize
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      setOutput("");
                      setError(null);
                    }}
                    className="h-11 rounded-full border border-white/15 px-4 text-sm text-white/70 hover:bg-white/5"
                  >
                    Clear
                  </button>
                  <Link to="/app" className="h-11 rounded-full px-4 text-sm leading-[2.75rem] text-violet-300 hover:text-white">
                    Or upload DOCX →
                  </Link>
                </div>
                {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                  <span>Output</span>
                  <button
                    type="button"
                    onClick={() => void copyOutput()}
                    disabled={!output}
                    className="inline-flex items-center gap-1 text-violet-300 disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="h-64 overflow-auto rounded-xl border border-white/10 bg-[#0b0b12] p-4 text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                  {output || <span className="text-white/30">Humanized text will appear here…</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14">
            <p className="text-center text-sm font-medium text-white/50">
              Built for professional AI text refinement
            </p>
            <div className="press-marquee mt-6 py-2" aria-label="Featured across popular brands">
              <div className="press-marquee-track">
                {[...PRESS_LOGOS, ...PRESS_LOGOS].map((brand, i) => (
                  <img
                    key={`${brand.name}-${i}`}
                    src={brand.src}
                    alt={brand.name}
                    title={brand.name}
                    height={Math.round(brand.height * 1.45)}
                    className="w-auto shrink-0 opacity-70"
                    style={{ height: Math.round(brand.height * 1.45) }}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#0a0a10] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Why choose HumanizerbyCaps.ai?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-white/55">
              A complete humanization toolkit for pasted text and real Word documents.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-500/40 hover:bg-white/[0.05]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 p-6">
              <div className="rounded-xl border border-white/10 bg-[#0b0b12] p-4 font-mono text-xs leading-6 text-violet-100/80">
                <div className="text-white/30">// before</div>
                <div>In today&apos;s world, it is important to note that…</div>
                <div className="mt-4 text-white/30">// after</div>
                <div className="text-emerald-300">Today, teams can focus on…</div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Humanize your AI text effortlessly
              </h2>
              <ul className="mt-6 space-y-4 text-sm text-white/65">
                {[
                  "Paste AI drafts and rewrite them into natural prose",
                  "Keep facts, numbers, and citations unchanged",
                  "Continue in the DOCX workspace when formatting matters",
                  "No account required — start immediately",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0a0a10] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Explore the excellence of HumanizerbyCaps.ai
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/25 to-transparent p-8">
                <h3 className="text-xl font-semibold">High Quality</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Context-aware rewriting improves flow, clarity, and authenticity without damaging your document structure.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
                <h3 className="text-xl font-semibold">Cost-Effective</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Start free with no signup. Scale later with configurable plans when your usage grows.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">3 steps to humanize</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-sm font-bold">
                    {i + 1}
                  </div>
                  <step.icon className="mx-auto mt-4 h-5 w-5 text-violet-300" />
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-white/55">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#0a0a10] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">What our clients say</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="text-amber-300">★★★★★</div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-5 flex items-center gap-3">
                    <img
                      src={t.image}
                      alt={t.name}
                      width={36}
                      height={36}
                      loading="lazy"
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-500/40"
                    />
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-white/45">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              HumanizerbyCaps.ai pricing & plans
            </h2>
            <p className="mt-3 text-center text-white/55">
              Configurable limits — no signup required to start.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <span className={cn(!yearly && "text-white", yearly && "text-white/45")}>Monthly</span>
              <button
                type="button"
                onClick={() => setYearly((v) => !v)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition",
                  yearly ? "bg-violet-600" : "bg-white/20",
                )}
                aria-label="Toggle yearly pricing"
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                    yearly ? "left-6" : "left-1",
                  )}
                />
              </button>
              <span className={cn(yearly && "text-white", !yearly && "text-white/45")}>Yearly</span>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((plan) => {
                const price = yearly ? plan.yearly : plan.monthly;
                return (
                  <div
                    key={plan.name}
                    className={cn(
                      "flex flex-col rounded-2xl border p-6",
                      plan.highlight
                        ? "border-violet-500 bg-violet-600/15 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
                        : "border-white/10 bg-white/[0.03]",
                    )}
                  >
                    <div className="text-sm font-medium text-violet-300">{plan.name}</div>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-3xl font-semibold">${price}</span>
                      <span className="pb-1 text-sm text-white/45">{yearly ? "/yr" : "/mo"}</span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-2 text-sm text-white/65">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/app"
                      className={cn(
                        "mt-6 block rounded-full py-2.5 text-center text-sm font-medium",
                        plan.highlight
                          ? "bg-violet-600 text-white hover:bg-violet-500"
                          : "border border-white/15 text-white hover:bg-white/5",
                      )}
                    >
                      Get started
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-white/10 bg-[#0a0a10] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {FAQS.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() => setOpenFaq(open ? null : idx)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{item.q}</span>
                      <ChevronDown
                        className={cn("mt-1 h-4 w-4 shrink-0 text-white/40 transition", open && "rotate-180")}
                      />
                    </div>
                    {open && <p className="mt-3 text-sm leading-relaxed text-white/60">{item.a}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-violet-700 p-10 text-center shadow-[0_0_60px_rgba(139,92,246,0.35)]">
            <h2 className="text-3xl font-semibold tracking-tight">
              Humanize AI with HumanizerbyCaps.ai
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              Start with the free on-page tool or open the full Word document workspace — no account needed.
            </p>
            <Link
              to="/app"
              className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
            >
              Get started for free
            </Link>
          </div>
        </section>
      </main>

      <footer id="contact" className="relative z-10 border-t border-white/10 bg-[#050508] py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo dark />
            <p className="mt-3 text-sm text-white/45">
              Intelligent AI document and text humanization.
            </p>
          </div>
          {[
            {
              title: "Tools",
              links: [
                { label: "Text humanizer", href: "#tool" },
                { label: "DOCX workspace", href: "/app" },
                { label: "Pricing", href: "#pricing" },
              ],
            },
            {
              title: "Product",
              links: [
                { label: "Features", href: "#tool" },
                { label: "FAQ", href: "#faq" },
                { label: "Workspace", href: "/app" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "Portfolio", href: "https://www.consoleprojectsbycaps.in/" },
                { label: "Contact", href: "mailto:hello@humanizerbycaps.ai" },
                { label: "Privacy", href: "#" },
                { label: "Terms", href: "#" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold">{col.title}</div>
              <ul className="mt-3 space-y-2 text-sm text-white/45">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") && !link.href.startsWith("//") ? (
                      <Link to={link.href} className="hover:text-white">
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="hover:text-white"
                        {...(link.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 px-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} HumanizerbyCaps.ai. All rights reserved.</span>
          <a
            href="https://www.consoleprojectsbycaps.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/45 hover:text-violet-300"
          >
            Built by Caps · consoleprojectsbycaps.in
          </a>
        </div>
      </footer>
    </div>
  );
}
