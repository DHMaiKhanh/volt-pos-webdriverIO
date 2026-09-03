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
  },
});
