/** Shared types — designed to map cleanly onto Convex tables later. */

export type SubscriptionPlan = "free" | "pro" | "business";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export type ProcessingStatus =
  | "uploaded"
  | "analyzing"
  | "ready"
  | "humanizing"
  | "verifying"
  | "completed"
  | "failed";

export type JobType =
  | "analyze"
  | "humanize_full"
  | "humanize_section"
  | "humanize_selection"
  | "verify"
  | "export";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export type EditStatus = "pending" | "accepted" | "rejected";

export type WritingTone =
  | "natural"
  | "conversational"
  | "professional"
  | "academic"
  | "formal"
  | "simple";

export type HumanizationIntensity = "light" | "balanced" | "deep";

export interface HumanizationSettings {
  tone: WritingTone;
  intensity: HumanizationIntensity;
  preserveStyle: boolean;
  preserveTechnicalTerms: boolean;
  preserveCitations: boolean;
  preserveParagraphLength: boolean;
  avoidVocabChanges: boolean;
  doNotModifyNumbers: boolean;
  onlySelectedContent: boolean;
}

export const DEFAULT_HUMANIZATION_SETTINGS: HumanizationSettings = {
  tone: "natural",
  intensity: "balanced",
  preserveStyle: true,
  preserveTechnicalTerms: true,
  preserveCitations: true,
  preserveParagraphLength: true,
  avoidVocabChanges: false,
  doNotModifyNumbers: true,
  onlySelectedContent: false,
};

/** Humanize succeeds only when estimated AI-detection % is strictly below this. */
export const AI_DETECTION_MAX_PERCENT = 15;

/** How many escalate-and-retry passes runHumanize may attempt before failing. */
export const HUMANIZE_MAX_ATTEMPTS = 3;

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  originalFilename: string;
  storagePath: string;
  originalDocumentPath: string;
  currentDocumentPath: string;
  wordCount: number;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  userId: string;
  versionNumber: number;
  storagePath: string;
  changeDescription: string;
  createdAt: string;
}

export interface DocumentEdit {
  id: string;
  documentId: string;
  versionId?: string;
  originalText: string;
  modifiedText: string;
  paragraphIdentifier: string;
  editStatus: EditStatus;
  createdAt: string;
}

export interface ProcessingJob {
  id: string;
  documentId: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  documentId?: string;
  wordsProcessed: number;
  operationType: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingProvider?: string;
  subscriptionReference?: string;
  createdAt: string;
  updatedAt: string;
}

/** Plan limits — single source of truth; swap values later without code changes. */
export interface PlanLimits {
  plan: SubscriptionPlan;
  monthlyWordAllowance: number;
  maxDocuments: number;
  maxFileSizeMb: number;
  versionHistory: boolean;
  advancedControls: boolean;
  teamAccess: boolean;
  priorityProcessing: boolean;
}

/** No page/word caps in local product mode — humanize every page of any document. */
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    plan: "free",
    monthlyWordAllowance: Number.MAX_SAFE_INTEGER,
    maxDocuments: Number.MAX_SAFE_INTEGER,
    maxFileSizeMb: 100,
    versionHistory: true,
    advancedControls: true,
    teamAccess: false,
    priorityProcessing: false,
  },
  pro: {
    plan: "pro",
    monthlyWordAllowance: Number.MAX_SAFE_INTEGER,
    maxDocuments: Number.MAX_SAFE_INTEGER,
    maxFileSizeMb: 100,
    versionHistory: true,
    advancedControls: true,
    teamAccess: false,
    priorityProcessing: false,
  },
  business: {
    plan: "business",
    monthlyWordAllowance: Number.MAX_SAFE_INTEGER,
    maxDocuments: Number.MAX_SAFE_INTEGER,
    maxFileSizeMb: 100,
    versionHistory: true,
    advancedControls: true,
    teamAccess: true,
    priorityProcessing: true,
  },
};

export interface DocumentAnalysisProfile {
  documentId: string;
  topic?: string;
  audience?: string;
  writingStyle?: string;
  sectionCount: number;
  paragraphCount: number;
  sentenceCount: number;
  repetitiveExpressions: string[];
  technicalSections: string[];
  citationCount: number;
  tableCount: number;
  summary: string;
  createdAt: string;
}

export interface ParagraphBlock {
  id: string;
  index: number;
  text: string;
  kind: "heading" | "paragraph" | "list-item" | "table-cell" | "other";
  headingLevel?: number;
  sectionId?: string;
  flaggedForReview?: boolean;
  reviewReason?: string;
}

export interface WritingQualityReport {
  documentId: string;
  naturalness: number;
  readability: number;
  sentenceVariation: number;
  grammarQuality: number;
  repetitiveLanguage: number;
  aiDetection?: {
    service: string;
    /** Estimated AI probability 0–100. Pass requires score < AI_DETECTION_MAX_PERCENT. */
    score?: number;
    classification?: "pass" | "fail" | string;
    analyzedAt: string;
    disclaimer: string;
    attempts?: number;
  };
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  actions?: AgentAction[];
}

export type AgentActionType =
  | "analyze"
  | "humanize_document"
  | "humanize_selection"
  | "rewrite_paragraph"
  | "improve_grammar"
  | "improve_readability"
  | "restore_original"
  | "explain_changes";

export interface AgentAction {
  type: AgentActionType;
  label: string;
  payload?: Record<string, unknown>;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface DashboardStats {
  totalDocuments: number;
  totalWordsHumanized: number;
  wordsUsedThisMonth: number;
  wordAllowance: number;
  plan: SubscriptionPlan;
}
