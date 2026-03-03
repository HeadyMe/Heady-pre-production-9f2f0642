import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      "/api": "http://api.headysystems.com:3300",
    },
  },
  build: {
    outDir: "dist",
  },
});
