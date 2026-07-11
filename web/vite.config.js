import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = env.VITE_API_TARGET || "http://localhost:8080";
  const wsTarget = env.VITE_WS_TARGET || "ws://localhost:8080";

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/ws": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});