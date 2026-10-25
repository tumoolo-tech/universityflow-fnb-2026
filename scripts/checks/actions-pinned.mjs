import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readLines } from './lib/walk.mjs';

/**
 * Guard: every GitHub Action, and every other repository a workflow checks out, is pinned to a
 * full commit SHA (audit A8-03). A tag (`@v7`) or a branch (`ref: main`) can be moved to new
 * code, which then runs in jobs holding ANTHROPIC_API_KEY or `pull-requests: write`.
 *
 * `uses: ./local-action` and `docker://` images are not checked here. Dependabot keeps the SHAs
 * and their `# vX.Y.Z` comments current.
 */

const SHA = /^[0-9a-f]{40}$/;
const WORKFLOWS = '.github/workflows';

export function run(root) {
  let files;
  try {
    files = readdirSync(join(root, WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f));
  } catch {
    return [];
  }
  const findings = [];
  for (const name of files) {
    const file = `${WORKFLOWS}/${name}`;
    const lines = readLines(join(root, file));
    let otherRepository = false;
    lines.forEach((line, index) => {
      const hash = line.indexOf(' #');
      const code = hash === -1 ? line : line.slice(0, hash);
      if (/^\s*-\s/.test(code)) otherRepository = false; // a new step
      if (/^\s*repository:\s*\S/.test(code)) otherRepository = true;

      const uses = code.match(/^[\s-]*uses:[ ]*['"]?([^'"\s]+)/);
      if (uses && !uses[1].startsWith('./') && !uses[1].startsWith('docker://')) {
        const ref = uses[1].split('@')[1] ?? '';
        if (!SHA.test(ref)) {
          findings.push({
            file,
            line: index + 1,
            message: `${uses[1]} is not pinned to a full commit SHA`,
            snippet: line.trim(),
          });
        }
      }

      const ref = code.match(/^[ ]*ref:[ ]*['"]?([^'"\s]+)/);
      if (ref && otherRepository && !SHA.test(ref[1]) && !ref[1].includes('${{')) {
        findings.push({
          file,
          line: index + 1,
          message: `another repository is checked out at ${ref[1]}, not a full commit SHA`,
          snippet: line.trim(),
        });
      }
    });
  }
  return findings;
}

export const meta = {
  id: 'actions-pinned',
  description: 'workflow actions and checked-out repositories are pinned by commit SHA (A8-03)',
};
