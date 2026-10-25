import type { ResultsPeriod } from '@universityflow/documents';
import { generateLearner } from './learners';
import { statementPdf } from './statement';

/**
 * The SAMPLE statements judge demo mode offers as "Use a sample report" (docs/deploy/demo.md):
 * one for each school grade, from a learner in that grade this year (2026), and a final Grade 12
 * statement for the university years. Deterministic: each has its own seed.
 *
 * The web app can't depend on a tool, so `demo-statements-cli.ts` writes them, base64, into
 * apps/web/lib/server/demo/sample-statements.ts; demo-statements.test.ts keeps it current.
 */

export interface DemoStatement {
  readonly key: 'grade-10' | 'grade-11' | 'grade-12' | 'school-finished';
  readonly period: ResultsPeriod;
  /** The calendar year of the learner's Grade 10. */
  readonly firstYear: number;
}

export const DEMO_STATEMENTS: ReadonlyArray<DemoStatement> = [
  { key: 'grade-10', period: 'grade-10-september', firstYear: 2026 },
  { key: 'grade-11', period: 'grade-11-september', firstYear: 2025 },
  { key: 'grade-12', period: 'grade-12-september', firstYear: 2024 },
  { key: 'school-finished', period: 'grade-12-final', firstYear: 2023 },
];

export function demoStatementPdf(statement: DemoStatement): Uint8Array {
  const learner = generateLearner({
    seed: `universityflow-demo-v1:${statement.key}`,
    subjectCount: 7,
    firstYear: statement.firstYear,
  });
  const report = learner.reports.find((r) => r.period === statement.period);
  if (!report) throw new Error(`No ${statement.period} report`);
  return statementPdf(learner, report);
}

/** The web module's source, exactly. */
export function demoStatementsSource(): string {
  const entries = DEMO_STATEMENTS.map((s) => {
    const base64 = Buffer.from(demoStatementPdf(s)).toString('base64');
    return `  '${s.key}': {\n    period: '${s.period}',\n    base64:\n      '${base64}',\n  },\n`;
  }).join('');
  return `// Written by tools/results-generator (pnpm --filter @universityflow/results-generator demo-statements).
// Do not edit: tools/results-generator/src/demo-statements.test.ts fails if this differs.
import 'server-only';

/**
 * The results generator's SAMPLE statements that judge demo mode offers as "Use a sample report"
 * (docs/deploy/demo.md): one per school grade, and a final Grade 12 one for the university years.
 * Synthetic learners only; every page says SAMPLE.
 */
export const SAMPLE_STATEMENTS = {
${entries}} as const;

export type SampleStatementKey = keyof typeof SAMPLE_STATEMENTS;
`;
}
