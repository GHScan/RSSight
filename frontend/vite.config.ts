import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendPort = Number(process.env.BACKEND_PORT) || 8000;
const backendOrigin = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT) || 5173,
    proxy: {
      "/api": backendOrigin,
      "/healthz": backendOrigin
    }
  }
});
