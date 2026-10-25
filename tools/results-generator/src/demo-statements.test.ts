import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isGeneratedSamplePdf, SAMPLE_PDF_PRODUCER } from '@universityflow/documents';
import { describe, expect, it } from 'vitest';
import { DEMO_STATEMENTS, demoStatementPdf, demoStatementsSource } from './demo-statements';
import { generateCohort } from './learners';
import { statementPdf } from './statement';
import { STATEMENT } from './strings';

/**
 * Judge demo mode (docs/deploy/demo.md) accepts only this tool's SAMPLE statements, and offers
 * one per grade as "Use a sample report". The web app can't depend on a tool, so the statements
 * are committed into it (`pnpm --filter @universityflow/results-generator demo-statements`); this
 * keeps that file exactly what the generator makes.
 */

const WEB_MODULE = fileURLToPath(
  new URL('../../../apps/web/lib/server/demo/sample-statements.ts', import.meta.url),
);

describe('the demo sample statements', () => {
  it('every statement the generator writes is recognised as a generated sample', () => {
    const learner = generateCohort().learners[0];
    if (!learner) throw new Error('no learner');
    for (const report of learner.reports) {
      expect(isGeneratedSamplePdf(statementPdf(learner, report)), report.period).toBe(true);
    }
  });

  it('names the producer from packages/documents, the one the demo checks', () => {
    expect(STATEMENT.producer).toBe(SAMPLE_PDF_PRODUCER);
  });

  it('has one statement for each school grade and one for after school', () => {
    expect(DEMO_STATEMENTS.map((s) => s.key)).toEqual([
      'grade-10',
      'grade-11',
      'grade-12',
      'school-finished',
    ]);
    for (const s of DEMO_STATEMENTS) expect(isGeneratedSamplePdf(demoStatementPdf(s))).toBe(true);
  });

  it('the web app holds exactly what the generator makes', () => {
    expect(readFileSync(WEB_MODULE, 'utf8')).toBe(demoStatementsSource());
  });
});
