import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ quoteStyle: 'single' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:9900',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9900',
        ws: true,
      },
      '/docs': {
        target: 'http://localhost:9900',
        changeOrigin: true,
      },
    },
  },
})
