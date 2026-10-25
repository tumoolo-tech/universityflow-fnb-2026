import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoOutlinesSource } from './module-outline';

/**
 * `pnpm --filter @universityflow/results-generator demo-outlines`: writes judge demo mode's
 * SAMPLE module outlines into the web app (apps/web/lib/server/demo/sample-outlines.ts).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../../../apps/web/lib/server/demo/sample-outlines.ts');

async function main() {
  await mkdir(dirname(TARGET), { recursive: true });
  await writeFile(TARGET, demoOutlinesSource());
  process.stdout.write(`Wrote ${TARGET}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
