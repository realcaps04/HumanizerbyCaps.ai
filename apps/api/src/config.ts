import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(root, ".env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "humanizer-dev-secret",
  dataDir: path.resolve(root, process.env.DATA_DIR ?? "data"),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  aiProvider: (process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "mock")) as
    | "openai"
    | "mock",
  maxUploadBytes: 25 * 1024 * 1024,
};
