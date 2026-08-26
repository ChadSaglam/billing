import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Port block: 9200 frontend · 9201 API · 9202 Postgres. See CLAUDE.md.
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 9200);
// Inside docker-compose the API is reachable as the `backend` service on 8000;
// running bare metal it's on localhost:9201.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:9201';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: FRONTEND_PORT, strictPort: true },
});
