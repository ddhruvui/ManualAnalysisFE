import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The browser only ever talks to the Node API — never to RunPod. In dev /api is
    // proxied to a local backend; a build calls VITE_API_BASE directly instead.
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
});
