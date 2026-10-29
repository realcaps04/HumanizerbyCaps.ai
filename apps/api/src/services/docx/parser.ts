/**
 * OOXML paragraph extraction and formatting-preserving text replacement.
 * Operates on the existing document.xml — never rebuilds the DOCX from plain text.
 */
import JSZip from "jszip";
import { nanoid } from "nanoid";
import type { ParagraphBlock } from "@humanizer/shared";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function decodeXmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXmlEntities(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractTextFromParagraphXml(pXml: string): string {
  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pXml))) {
    texts.push(decodeXmlEntities(m[1]));
  }
  return texts.join("");
}

function headingLevel(pXml: string): number | undefined {
  const style = pXml.match(/<w:pStyle\s+[^>]*w:val="([^"]+)"/);
  if (!style) return undefined;
  const val = style[1];
  const match = val.match(/Heading(\d)/i) || val.match(/heading\s*(\d)/i);
  if (match) return Number(match[1]);
  if (/Title/i.test(val)) return 1;
  return undefined;
}

function paragraphKind(pXml: string, text: string): ParagraphBlock["kind"] {
  const level = headingLevel(pXml);
  if (level) return "heading";
  if (/<w:numPr[\s>]/.test(pXml)) return "list-item";
  if (!text.trim()) return "other";
  return "paragraph";
}

export interface ParsedDocument {
  paragraphs: ParagraphBlock[];
  wordCount: number;
  tableCount: number;
  /** Raw paragraph XML slices in document order (body only). */
  paragraphXml: string[];
}

/** Split document.xml body into top-level <w:p> elements (non-nested in tables still counted). */
function extractBodyParagraphs(documentXml: string): string[] {
  const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return [];
  const body = bodyMatch[1];
  const paragraphs: string[] = [];
  // Match paragraphs that are direct-ish in body or inside table cells
  const re = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    paragraphs.push(m[0]);
  }
  return paragraphs;
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid DOCX: missing word/document.xml");
  const documentXml = await docFile.async("string");
  const paragraphXml = extractBodyParagraphs(documentXml);

  const paragraphs: ParagraphBlock[] = [];
  let wordCount = 0;
  let sectionId = "section-0";
  let sectionCounter = 0;

  for (let i = 0; i < paragraphXml.length; i++) {
    const xml = paragraphXml[i];
    const text = extractTextFromParagraphXml(xml);
    const level = headingLevel(xml);
    if (level && level <= 2) {
      sectionCounter += 1;
      sectionId = `section-${sectionCounter}`;
    }
    const kind = paragraphKind(xml, text);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount += words;
    paragraphs.push({
      id: `p-${i}-${nanoid(6)}`,
      index: i,
      text,
      kind,
      headingLevel: level,
      sectionId,
    });
  }

  const tableCount = (documentXml.match(/<w:tbl[\s>]/g) || []).length;

  return { paragraphs, wordCount, tableCount, paragraphXml };
}

/**
 * Replace text inside a paragraph XML while preserving the first run's formatting
 * for the full new text when multi-run merge is needed. Flags complex paragraphs.
 */
export function replaceParagraphText(
  pXml: string,
  newText: string,
): { xml: string; flagged: boolean; reason?: string } {
  const runMatches = [...pXml.matchAll(/<w:r[\s>][\s\S]*?<\/w:r>/g)];
  if (runMatches.length === 0) {
    // Insert a simple run before </w:p>
    const simpleRun = `<w:r><w:t xml:space="preserve">${encodeXmlEntities(newText)}</w:t></w:r>`;
    return { xml: pXml.replace(/<\/w:p>/, `${simpleRun}</w:p>`), flagged: false };
  }

  const hasHyperlink = /<w:hyperlink[\s>]/.test(pXml);
  const hasDrawing = /<w:drawing[\s>]/.test(pXml) || /<w:pict[\s>]/.test(pXml);
  const hasFldChar = /<w:fldChar[\s>]/.test(pXml);

  if (hasHyperlink || hasDrawing || hasFldChar) {
    // Soft replace: only swap text nodes if total length similar strategy fails → flag
    const texts = [...pXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
    if (texts.length === 1) {
      const updated = pXml.replace(
        /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/,
        `$1${encodeXmlEntities(newText)}$3`,
      );
      return {
        xml: updated,
        flagged: true,
        reason: hasHyperlink
          ? "Paragraph contains hyperlink — verify link text"
          : "Paragraph contains special fields or media",
      };
    }
    return {
      xml: pXml,
      flagged: true,
      reason: "Complex paragraph with multiple special runs — skipped to protect formatting",
    };
  }

  // Preserve rPr from the first text-bearing run
  const firstTextRun = runMatches.find((r) => /<w:t[\s>]/.test(r[0])) ?? runMatches[0];
  const rPr = firstTextRun[0].match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${encodeXmlEntities(newText)}</w:t></w:r>`;

  // Remove all existing text runs; keep non-text runs (breaks, tabs) carefully —
  // for integrity we replace the whole set of text runs with one formatted run.
  let result = pXml;
  let firstReplaced = false;
  for (const run of runMatches) {
    if (!/<w:t[\s>]/.test(run[0])) continue;
    if (!firstReplaced) {
      result = result.replace(run[0], newRun);
      firstReplaced = true;
    } else {
      result = result.replace(run[0], "");
    }
  }

  if (!firstReplaced) {
    result = pXml.replace(/<\/w:p>/, `${newRun}</w:p>`);
  }

  const multiStyle = runMatches.filter((r) => /<w:t[\s>]/.test(r[0])).length > 1;
  return {
    xml: result,
    flagged: multiStyle,
    reason: multiStyle
      ? "Multiple text styles in paragraph — consolidated onto first run style"
      : undefined,
  };
}

export async function applyParagraphReplacements(
  buffer: Buffer,
  replacements: Array<{ index: number; newText: string }>,
): Promise<{ buffer: Buffer; flagged: Array<{ index: number; reason: string }> }> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid DOCX");
  let documentXml = await docFile.async("string");
  const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) throw new Error("Invalid DOCX body");

  const paragraphs = extractBodyParagraphs(documentXml);
  const flagged: Array<{ index: number; reason: string }> = [];
  const map = new Map(replacements.map((r) => [r.index, r.newText]));

  for (const [index, newText] of map) {
    if (index < 0 || index >= paragraphs.length) continue;
    const { xml, flagged: isFlagged, reason } = replaceParagraphText(paragraphs[index], newText);
    paragraphs[index] = xml;
    if (isFlagged && reason) flagged.push({ index, reason });
  }

  // Rebuild body by sequential replacement of paragraph occurrences
  let body = bodyMatch[1];
  let searchFrom = 0;
  const rebuiltParts: string[] = [];
  let cursor = 0;
  let pIdx = 0;

  const re = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    rebuiltParts.push(body.slice(cursor, m.index));
    rebuiltParts.push(paragraphs[pIdx] ?? m[0]);
    cursor = m.index + m[0].length;
    pIdx += 1;
  }
  rebuiltParts.push(body.slice(cursor));
  const newBody = rebuiltParts.join("");
  documentXml = documentXml.replace(bodyMatch[0], bodyMatch[0].replace(bodyMatch[1], newBody));

  zip.file("word/document.xml", documentXml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: out, flagged };
}

export function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

// Silence unused import warning for namespace constant reserved for future DOM parsing
void W_NS;
