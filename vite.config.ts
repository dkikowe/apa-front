import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: "web",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api":
          process.env.API_PROXY_TARGET ||
          env.API_PROXY_TARGET ||
          "http://127.0.0.1:3001",
      },
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ["recharts"],
            forms: ["react-hook-form", "@hookform/resolvers/zod", "zod"],
            react: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
  };
});
