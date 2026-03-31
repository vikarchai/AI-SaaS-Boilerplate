import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  plugins: [react(), tailwindcss()],
  server: {
    middlewareMode: true,
    // Host is the public tunnel domain (e.g. *.ngrok-free.app), not localhost
    allowedHosts: [".ngrok-free.app", ".ngrok.io", "localhost", ".localhost", "127.0.0.1"],
  },
  appType: "spa",
  build: {
    outDir: path.resolve(import.meta.dirname, "client/dist"),
    emptyOutDir: true,
  },
});
