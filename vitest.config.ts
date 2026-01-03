import { defineConfig } from 'vitest/config';

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
