import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.FRONTEND_PORT) || 5173,
    // Inside compose the backend always listens on 8000; the published
    // port only matters to the browser. The app calls VITE_API_URL
    // directly, so this proxy is a convenience for same-origin requests.
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://backend:8000',
    },
  },
});
