import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The browser only ever talks to the Node API — never to RunPod.
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
