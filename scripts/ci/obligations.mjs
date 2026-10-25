#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * What a change owes before it can merge, read from the diff.
 *
 * Some obligations CI enforces on its own (the crisis red-team, the guards). Others only a person
 * can meet: a first-language speaker reading changed crisis phrases, the owner re-verifying a
 * catalogue record, an AI-safety audit after a model change. A diff written by an agent looks
 * finished whether or not those happened, so this lists them on every PR, where the reviewer
 * can't miss them. It reports; it never fails the build. The reviewer ticks them off.
 *
 *   node scripts/ci/obligations.mjs [--base <ref>]   writes Markdown to stdout and, in Actions,
 *                                                     to the job summary
 */

/**
 * Each rule: which paths trigger it, optionally which added lines, and what it owes.
 * `who` is 'ci' when a CI job already enforces it, otherwise the person or audit that must act.
 */
export const RULES = [
  {
    id: 'red-team',
    paths: [/^packages\/(agent|content)\//],
    who: 'ci',
    owes: 'Crisis red-team at 100% (hard rule 7). Enforced by the "Crisis red-team" job',
  },
  {
    id: 'crisis-language-review',
    paths: [/^packages\/agent\/src\/crisis\.ts$/],
    who: 'first-language speakers',
    owes: 'Changed crisis phrases reviewed by first-language speakers (isiZulu, isiXhosa, Sesotho, Setswana, Afrikaans) before release',
  },
  {
    id: 'catalogue-verification',
    paths: [/^packages\/catalogue\/src\/data\//],
    who: 'owner',
    owes: 'Every changed record re-checked against its source. An edited record loses its verifiedOn/verifiedBy until a person re-verifies it (hard rule 3). Audit A13',
  },
  {
    id: 'human-attestation',
    added: [/\bverified(On|By)\s*:/],
    // The records, not the schema that defines the fields or its tests.
    paths: [/^packages\/catalogue\/src\/data\//, /^packages\/admissions\/src\/universities\//],
    who: 'owner',
    owes: 'This diff adds verifiedOn/verifiedBy. Confirm a named person checked each record against its source: an agent must never add these (hard rule 3)',
  },
  {
    id: 'score-methods',
    paths: [/^packages\/admissions\/src\/(universities|scoring)\//],
    who: 'owner',
    owes: 'A university score method changed: re-check the rule against the prospectus and keep its worked-example test (docs/data-verification.md step 5). Audit A13',
  },
  {
    id: 'ai-safety',
    paths: [
      /^packages\/agent\/src\/(system-prompt|charter|tools|runner|model|context)\.ts$/,
      /^packages\/documents\/src\/reader/,
    ],
    who: 'audit A10',
    owes: "The agent's prompt, tools or model wiring changed: A10 (AI safety and tone) is owed before the phase closes",
  },
  {
    id: 'model-change',
    added: [/claude-[a-z]+-\d/, /ANTHROPIC_MODEL/],
    paths: [/^(apps|packages)\//, /^\.env\.example$/],
    who: 'audit A10',
    owes: 'A model id or the model setting changed: A10 runs on every model change (planning.md §12.2), with the red-team and evals on the new model',
  },
  {
    id: 'privacy',
    paths: [
      // Schema, migrations, consent and sign-in all live in packages/db/src.
      /^packages\/db\/src\/(?!.*\.test\.ts$).+\.ts$/,
      /^apps\/web\/app\/api\/(me|consent)\//,
    ],
    who: 'audit A11',
    owes: 'Consent, personal data or the schema changed: A11 (privacy and POPIA) is owed. Minors stay gated in the data layer (hard rule 5)',
  },
  {
    id: 'messaging',
    paths: [/^packages\/messaging\//],
    who: 'audit A12',
    owes: 'Messaging changed: A12 (opt-in, opt-out, quiet hours, cost cap) is owed',
  },
  {
    id: 'documents',
    paths: [/^packages\/documents\//],
    who: 'reviewer',
    owes: 'Document reading or storage changed: every value read is still confirmed by the student before use (hard rule 6)',
  },
  {
    id: 'pipeline',
    paths: [/^\.github\//, /^lefthook\.yml$/, /^scripts\/(checks|ci)\//, /^audits\.config\.json$/],
    who: 'owner',
    owes: 'The pipeline or its guards changed: the owner reviews it (CODEOWNERS). A weaker check is a silent regression',
  },
];

/** The obligations a set of changed files and added lines trigger. Pure, so it can be tested. */
export function obligations(files, addedLines = []) {
  const owed = [];
  for (const rule of RULES) {
    const hits = files.filter((f) => rule.paths.some((re) => re.test(f)));
    if (!hits.length) continue;
    if (rule.added) {
      const lines = addedLines.filter(
        (l) => hits.includes(l.file) && rule.added.some((re) => re.test(l.text)),
      );
      if (!lines.length) continue;
      owed.push({ ...rule, files: [...new Set(lines.map((l) => l.file))] });
      continue;
    }
    owed.push({ ...rule, files: hits });
  }
  return owed;
}

export function toMarkdown(owed) {
  if (!owed.length) return '## Owed checks\n\nNothing beyond the standard gate.\n';
  const people = owed.filter((o) => o.who !== 'ci');
  const rows = owed.map((o) => {
    const sample = o.files
      .slice(0, 3)
      .map((f) => `\`${f}\``)
      .join(', ');
    const more = o.files.length > 3 ? ` +${o.files.length - 3} more` : '';
    const box = o.who === 'ci' ? '✅ CI' : '☐';
    return `| ${box} | ${o.who} | ${o.owes} | ${sample}${more} |`;
  });
  return [
    '## Owed checks',
    '',
    people.length
      ? `This change owes **${people.length}** check${people.length === 1 ? '' : 's'} that only a person or an audit can meet. Tick them in the PR before merging.`
      : 'Everything this change owes is enforced by CI.',
    '',
    '| | Who | What | Files |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

/** Added lines per file from a unified diff with zero context. */
export function parseAdded(diff) {
  const added = [];
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6) : null;
    } else if (file && line.startsWith('+')) {
      added.push({ file, text: line.slice(1) });
    }
  }
  return added;
}

function main() {
  const i = process.argv.indexOf('--base');
  const base = i === -1 ? 'origin/main' : process.argv[i + 1];
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  const range = `${base}...HEAD`;
  const files = git('diff', '--name-only', range).split('\n').filter(Boolean);
  const added = parseAdded(git('diff', '--unified=0', '--no-color', range));
  const md = toMarkdown(obligations(files, added));
  process.stdout.write(md);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: set by GitHub Actions; not a Turbo task input
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, md);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
