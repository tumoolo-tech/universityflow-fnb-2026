import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateCohort } from './learners';

/**
 * The fake ResultsSource reads `packages/documents/fixtures/sample-results.json`, which this tool
 * writes (`pnpm --filter @universityflow/results-generator generate`). If the generator changes,
 * the committed file must be regenerated, or the fake would serve stale learners.
 */
const FIXTURE = fileURLToPath(
  new URL('../../../packages/documents/fixtures/sample-results.json', import.meta.url),
);

describe('the committed sample results', () => {
  it('are exactly what the generator makes from its default seed', () => {
    const committed = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    expect(committed).toEqual(generateCohort());
  });
});
