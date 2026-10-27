import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so a `vite build` in dist/ can also be
// opened from a plain static file server, not just the project root.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 4321,
    open: true,
    // Forward the run-control API to the runner server (dashboard/server/runner.mjs).
    // `npm run dev:all` starts both; the proxy is why the UI can POST /api/runner/start
    // without caring which port the runner listens on.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.RUNNER_PORT ?? 4322}`,
        changeOrigin: true,
      },
    },
  },
});
