// Separate config so vitest does not load the CRXJS plugin from
// vite.config.ts (which expects a real manifest + browser target). The
// `decodeURIComponent` dance matches vite.config.ts: the repo path
// `OptiTalent Nan V1/clipcv` contains a space, and `URL.pathname`
// returns the `%20`-encoded form which Rolldown / vite resolve cannot
// follow.

import { defineConfig } from 'vitest/config';

const srcDir = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
