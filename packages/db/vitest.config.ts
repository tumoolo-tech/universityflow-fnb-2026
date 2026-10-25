import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Starting embedded Postgres takes a few seconds, longer when the whole gate runs in parallel.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
