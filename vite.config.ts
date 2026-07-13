import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
  },
  build: {
    // The main bundle is already reported by size; skipping duplicate gzip
    // computation keeps Windows CI and low-memory developer machines stable.
    reportCompressedSize: false,
  },
});
