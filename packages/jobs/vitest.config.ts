import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // The contract is measured through the suites that run it.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
