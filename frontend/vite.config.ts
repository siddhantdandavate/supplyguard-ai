import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API target for the dev/preview proxy. Override with VITE_API_TARGET (e.g. http://127.0.0.1:8001).
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/docs': { target: apiTarget, changeOrigin: true },
      '/openapi.json': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/docs': { target: apiTarget, changeOrigin: true },
      '/openapi.json': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
