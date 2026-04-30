import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json' with { type: 'json' };

// `URL.pathname` keeps percent-encoded spaces, which break filesystem path
// resolution when the repo path contains spaces. decodeURIComponent restores
// a real OS path without pulling in `node:url` (and thus `@types/node`).
const srcDir = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  server: {
    port: 5179,
    strictPort: false,
    hmr: {
      port: 5179,
    },
  },
});
