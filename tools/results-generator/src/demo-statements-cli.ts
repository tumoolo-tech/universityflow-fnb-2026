import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoStatementsSource } from './demo-statements';

/**
 * `pnpm --filter @universityflow/results-generator demo-statements`: writes judge demo mode's
 * sample statements into the web app (apps/web/lib/server/demo/sample-statements.ts).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../../../apps/web/lib/server/demo/sample-statements.ts');

async function main() {
  await mkdir(dirname(TARGET), { recursive: true });
  await writeFile(TARGET, demoStatementsSource());
  process.stdout.write(`Wrote ${TARGET}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
