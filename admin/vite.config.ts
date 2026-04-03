import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiTarget = process.env.ADMIN_API_PROXY_TARGET ?? "http://localhost:9900"
const nominatimTarget = process.env.ADMIN_NOMINATIM_PROXY_TARGET ?? "https://nominatim.openstreetmap.org"
const osrmTarget = process.env.ADMIN_OSRM_PROXY_TARGET ?? "https://router.project-osrm.org"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: apiTarget.replace(/^http/, "ws"),
        ws: true,
      },
      "/nominatim": {
        target: nominatimTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
      },
      "/osrm": {
        target: osrmTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm/, ""),
      },
    },
  },
})
