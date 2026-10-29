/**
 * Local JSON persistence layer.
 * Swap this module for Convex mutations/queries later without changing route handlers.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  DocumentEdit,
  DocumentRecord,
  DocumentVersion,
  ProcessingJob,
  Subscription,
  UsageRecord,
  UserProfile,
} from "@humanizer/shared";
import { config } from "../config.js";

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  subscriptionPlan: UserProfile["subscriptionPlan"];
  createdAt: string;
  passwordHash: string;
  emailVerified: boolean;
}

interface Database {
  users: AuthUser[];
  documents: DocumentRecord[];
  versions: DocumentVersion[];
  edits: DocumentEdit[];
  jobs: ProcessingJob[];
  usage: UsageRecord[];
  subscriptions: Subscription[];
  chat: Record<string, Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>>;
}

const emptyDb = (): Database => ({
  users: [],
  documents: [],
  versions: [],
  edits: [],
  jobs: [],
  usage: [],
  subscriptions: [],
  chat: {},
});

let cache: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDirs() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(path.join(config.dataDir, "storage"), { recursive: true });
}

function dbPath() {
  return path.join(config.dataDir, "db.json");
}

async function load(): Promise<Database> {
  if (cache) return cache;
  await ensureDirs();
  try {
    const raw = await fs.readFile(dbPath(), "utf8");
    cache = { ...emptyDb(), ...JSON.parse(raw) } as Database;
  } catch {
    cache = emptyDb();
    await persist();
  }
  return cache!;
}

async function persist() {
  if (!cache) return;
  await ensureDirs();
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(dbPath(), snapshot, "utf8"));
  await writeQueue;
}

function now() {
  return new Date().toISOString();
}

const LOCAL_USER_ID = "local-user";

export const store = {
  async ensureLocalUser(): Promise<UserProfile> {
    const db = await load();
    const existing = db.users.find((u) => u.id === LOCAL_USER_ID);
    if (existing) return this.toPublicUser(existing);

    const user: AuthUser = {
      id: LOCAL_USER_ID,
      fullName: "Local User",
      email: "local@humanizerbycaps.ai",
      passwordHash: "",
      emailVerified: true,
      subscriptionPlan: "pro",
      createdAt: now(),
    };
    db.users.push(user);
    db.subscriptions.push({
      id: nanoid(),
      userId: user.id,
      plan: "pro",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    });
    await persist();
    return this.toPublicUser(user);
  },

  async getUserByEmail(email: string) {
    const db = await load();
    return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  },

  async getUserById(id: string) {
    const db = await load();
    return db.users.find((u) => u.id === id) ?? null;
  },

  toPublicUser(user: AuthUser): UserProfile {
    const { passwordHash: _, emailVerified: __, ...profile } = user;
    return profile;
  },

  async listDocuments(userId: string) {
    const db = await load();
    return db.documents
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getDocument(id: string, userId: string) {
    const db = await load();
    const doc = db.documents.find((d) => d.id === id && d.userId === userId);
    return doc ?? null;
  },

  async createDocument(
    doc: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) {
    const db = await load();
    const record: DocumentRecord = {
      ...doc,
      id: doc.id ?? nanoid(),
      createdAt: now(),
      updatedAt: now(),
    };
    db.documents.push(record);
    await persist();
    return record;
  },

  async updateDocument(id: string, userId: string, patch: Partial<DocumentRecord>) {
    const db = await load();
    const idx = db.documents.findIndex((d) => d.id === id && d.userId === userId);
    if (idx < 0) return null;
    db.documents[idx] = { ...db.documents[idx], ...patch, updatedAt: now() };
    await persist();
    return db.documents[idx];
  },

  async deleteDocument(id: string, userId: string) {
    const db = await load();
    const doc = db.documents.find((d) => d.id === id && d.userId === userId);
    if (!doc) return false;
    db.documents = db.documents.filter((d) => d.id !== id);
    db.versions = db.versions.filter((v) => v.documentId !== id);
    db.edits = db.edits.filter((e) => e.documentId !== id);
    db.jobs = db.jobs.filter((j) => j.documentId !== id);
    delete db.chat[id];
    await persist();
    return doc;
  },

  async listVersions(documentId: string, userId: string) {
    const db = await load();
    return db.versions
      .filter((v) => v.documentId === documentId && v.userId === userId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },

  async createVersion(input: Omit<DocumentVersion, "id" | "createdAt">) {
    const db = await load();
    const version: DocumentVersion = { ...input, id: nanoid(), createdAt: now() };
    db.versions.push(version);
    await persist();
    return version;
  },

  async listEdits(documentId: string) {
    const db = await load();
    return db.edits
      .filter((e) => e.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createEdits(edits: Array<Omit<DocumentEdit, "id" | "createdAt">>) {
    const db = await load();
    const created = edits.map((e) => ({ ...e, id: nanoid(), createdAt: now() }));
    db.edits.push(...created);
    await persist();
    return created;
  },

  async updateEdit(id: string, documentId: string, patch: Partial<DocumentEdit>) {
    const db = await load();
    const idx = db.edits.findIndex((e) => e.id === id && e.documentId === documentId);
    if (idx < 0) return null;
    db.edits[idx] = { ...db.edits[idx], ...patch };
    await persist();
    return db.edits[idx];
  },

  async createJob(input: Omit<ProcessingJob, "id" | "createdAt" | "progress" | "status"> & Partial<ProcessingJob>) {
    const db = await load();
    const job: ProcessingJob = {
      id: nanoid(),
      progress: 0,
      status: "queued",
      createdAt: now(),
      ...input,
    };
    db.jobs.push(job);
    await persist();
    return job;
  },

  async updateJob(id: string, patch: Partial<ProcessingJob>) {
    const db = await load();
    const idx = db.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return null;
    db.jobs[idx] = { ...db.jobs[idx], ...patch };
    await persist();
    return db.jobs[idx];
  },

  async getJob(id: string, userId: string) {
    const db = await load();
    return db.jobs.find((j) => j.id === id && j.userId === userId) ?? null;
  },

  async listJobs(documentId: string, userId: string) {
    const db = await load();
    return db.jobs
      .filter((j) => j.documentId === documentId && j.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addUsage(record: Omit<UsageRecord, "id" | "createdAt">) {
    const db = await load();
    const row: UsageRecord = { ...record, id: nanoid(), createdAt: now() };
    db.usage.push(row);
    await persist();
    return row;
  },

  async usageThisMonth(userId: string) {
    const db = await load();
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return db.usage
      .filter((u) => u.userId === userId && new Date(u.createdAt) >= start)
      .reduce((sum, u) => sum + u.wordsProcessed, 0);
  },

  async totalWordsProcessed(userId: string) {
    const db = await load();
    return db.usage.filter((u) => u.userId === userId).reduce((sum, u) => sum + u.wordsProcessed, 0);
  },

  async getSubscription(userId: string) {
    const db = await load();
    return db.subscriptions.find((s) => s.userId === userId) ?? null;
  },

  async getChat(documentId: string) {
    const db = await load();
    return db.chat[documentId] ?? [];
  },

  async appendChat(
    documentId: string,
    message: { role: "user" | "assistant" | "system"; content: string },
  ) {
    const db = await load();
    if (!db.chat[documentId]) db.chat[documentId] = [];
    const row = { id: nanoid(), ...message, createdAt: now() };
    db.chat[documentId].push(row);
    await persist();
    return row;
  },

  storagePath(...parts: string[]) {
    return path.join(config.dataDir, "storage", ...parts);
  },
};
