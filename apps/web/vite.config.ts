import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@humanizer/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Local: browser calls /api → Express on :4000
      // Production (Vercel): same /api paths are rewritten to the `api` service
      "/api": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});

