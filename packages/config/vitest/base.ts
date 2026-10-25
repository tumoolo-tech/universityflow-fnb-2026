import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest defaults for `packages/*`.
 *
 * Coverage thresholds are high on purpose: the packages that must never be wrong
 * (`admissions`, `catalogue`, `messaging`) are pure logic, where 90% is achievable and
 * meaningful. Apps override these.
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.config.*', '**/dist/**'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});

export default baseConfig;
