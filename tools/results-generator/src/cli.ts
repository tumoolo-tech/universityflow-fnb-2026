import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCohort } from './learners';
import { statementPdf } from './statement';

/**
 * `pnpm --filter @universityflow/results-generator generate [-- --out <dir>]`
 *
 * Writes the default cohort to packages/documents/fixtures/sample-results.json (what the fake
 * ResultsSource reads; fixture.test.ts fails if it goes stale) and one SAMPLE statement PDF per
 * learner and report to <dir> (default tools/results-generator/out, git-ignored).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../../../packages/documents/fixtures/sample-results.json');

async function main(argv: ReadonlyArray<string>) {
  const outFlag = argv.indexOf('--out');
  const out = resolve(outFlag >= 0 ? (argv[outFlag + 1] ?? 'out') : resolve(HERE, '../out'));

  const cohort = generateCohort();
  await mkdir(dirname(FIXTURE), { recursive: true });
  await writeFile(FIXTURE, `${JSON.stringify(cohort, null, 2)}\n`);

  await mkdir(out, { recursive: true });
  let pdfs = 0;
  for (const learner of cohort.learners) {
    for (const report of learner.reports) {
      await writeFile(
        join(out, `${learner.examNumber}-${report.period}.pdf`),
        statementPdf(learner, report),
      );
      pdfs += 1;
    }
  }
  process.stdout.write(`Wrote ${FIXTURE} and ${pdfs} sample statements to ${out}\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
