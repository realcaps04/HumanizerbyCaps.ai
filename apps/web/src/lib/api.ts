import type {
  DashboardStats,
  DocumentEdit,
  DocumentRecord,
  DocumentVersion,
  HumanizationSettings,
  ParagraphBlock,
  ProcessingJob,
  WritingQualityReport,
  DocumentAnalysisProfile,
} from "@humanizer/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText ?? "Request failed");
  return data as T;
}

export const api = {
  humanizeText(text: string, settings?: Partial<HumanizationSettings>) {
    return request<{ input: string; output: string; wordCount: number }>("/api/text/humanize", {
      method: "POST",
      body: JSON.stringify({ text, settings }),
    });
  },
  dashboard() {
    return request<{ stats: DashboardStats; recentDocuments: DocumentRecord[] }>(
      "/api/documents/dashboard",
    );
  },
  listDocuments() {
    return request<{ documents: DocumentRecord[] }>("/api/documents");
  },
  uploadDocument(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ document: DocumentRecord }>("/api/documents/upload", {
      method: "POST",
      body: form,
    });
  },
  getDocument(id: string) {
    return request<{
      document: DocumentRecord;
      versions: DocumentVersion[];
      edits: DocumentEdit[];
      jobs: ProcessingJob[];
      chat: Array<{
        id: string;
        role: "user" | "assistant" | "system";
        content: string;
        createdAt: string;
      }>;
      paragraphs: ParagraphBlock[] | null;
      analysis: DocumentAnalysisProfile | null;
      quality: WritingQualityReport | null;
      settings: HumanizationSettings;
    }>(`/api/documents/${id}`);
  },
  deleteDocument(id: string) {
    return request<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" });
  },
  async fetchDocxBlob(id: string, which: "current" | "original" = "current") {
    const res = await fetch(`${API_URL}/api/documents/${id}/file?which=${which}`);
    if (!res.ok) throw new Error("Failed to load document file");
    return res.blob();
  },
  analyze(id: string) {
    return request<{ profile: DocumentAnalysisProfile }>(`/api/documents/${id}/analyze`, {
      method: "POST",
    });
  },
  humanize(
    id: string,
    body: {
      settings?: Partial<HumanizationSettings>;
      instruction?: string;
      sectionId?: string;
      paragraphIds?: string[];
      selectionText?: string;
    } = {},
  ) {
    return request<{
      summary: string;
      edits: DocumentEdit[];
      flagged: Array<{ index: number; reason: string }>;
    }>(`/api/documents/${id}/humanize`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  quality(id: string) {
    return request<{ report: WritingQualityReport }>(`/api/documents/${id}/quality`, {
      method: "POST",
    });
  },
  updateEdit(id: string, editId: string, status: "accepted" | "rejected") {
    return request<{ edit: DocumentEdit }>(`/api/documents/${id}/edits/${editId}`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },
  restoreOriginal(id: string) {
    return request<{ document: DocumentRecord }>(`/api/documents/${id}/restore-original`, {
      method: "POST",
    });
  },
  restoreVersion(id: string, versionId: string) {
    return request<{ version: DocumentVersion }>(
      `/api/documents/${id}/versions/${versionId}/restore`,
      { method: "POST" },
    );
  },
  chat(id: string, message: string, settings?: Partial<HumanizationSettings>) {
    return request<{
      messages: Array<{
        id: string;
        role: "user" | "assistant" | "system";
        content: string;
        createdAt: string;
      }>;
      actionResult: unknown;
    }>(`/api/documents/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, settings }),
    });
  },
};
