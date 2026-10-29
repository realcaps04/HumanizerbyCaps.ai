import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  revision: number;
  which?: "current" | "original";
  highlightTexts?: string[];
  className?: string;
}

export function DocxViewer({
  documentId,
  revision,
  which = "current",
  highlightTexts = [],
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hostRef.current) return;
      setLoading(true);
      setError(null);
      hostRef.current.innerHTML = "";
      try {
        const blob = await api.fetchDocxBlob(documentId, which);
        if (cancelled || !hostRef.current) return;
        // Preserve original fonts, alignment, page size, and margins from the DOCX.
        await renderAsync(blob, hostRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
        isolateDocxTypography(hostRef.current);
        if (highlightTexts.length && hostRef.current) {
          highlightInDom(hostRef.current, highlightTexts);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [documentId, revision, which, highlightTexts.join("|")]);

  return (
    <div className={cn("docx-desk relative h-full overflow-auto", className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#14141c]/90 text-sm text-white/60">
          Rendering document…
        </div>
      )}
      {error && (
        <div className="p-8 text-sm text-rose-300">
          {error}
          <p className="mt-2 text-white/45">
            The file may be corrupt or use unsupported Word features.
          </p>
        </div>
      )}
      {/* Document pages stay white with original DOCX margins — only the desk around them is themed. */}
      <div ref={hostRef} className="docx-host min-h-full" />
    </div>
  );
}

/** Prevent app chrome CSS from leaking into Word content. */
function isolateDocxTypography(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("section.docx").forEach((page) => {
    // Keep only page chrome from our CSS; typography stays from docx-preview inline styles.
    page.style.setProperty("font-family", "");
    page.style.setProperty("font-size", "");
    page.style.setProperty("line-height", "");
    page.style.setProperty("text-align", "");
    page.style.setProperty("letter-spacing", "");
  });
}

function highlightInDom(root: HTMLElement, texts: string[]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim()) nodes.push(node as Text);
  }
  for (const text of texts) {
    const needle = text.trim().slice(0, 80);
    if (!needle) continue;
    for (const textNode of nodes) {
      const content = textNode.textContent ?? "";
      const idx = content.indexOf(needle.slice(0, Math.min(40, needle.length)));
      if (idx === -1) continue;
      const range = document.createRange();
      try {
        range.setStart(textNode, idx);
        range.setEnd(textNode, Math.min(content.length, idx + needle.length));
        const mark = document.createElement("mark");
        mark.className = "humanized-highlight";
        range.surroundContents(mark);
      } catch {
        /* skip overlapping highlights */
      }
      break;
    }
  }
}
