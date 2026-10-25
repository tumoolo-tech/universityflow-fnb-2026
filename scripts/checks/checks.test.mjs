import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import * as actionsPinned from './actions-pinned.mjs';
import * as envDocumented from './env-documented.mjs';
import * as nativeListsDeps from './native-lists-workspace-deps.mjs';
import * as nativeNoBarrel from './native-no-catalogue-barrel.mjs';
import * as nativeNoContentBarrel from './native-no-content-barrel.mjs';
import * as noAppImports from './no-app-imports-in-packages.mjs';
import * as noDomInShared from './no-dom-in-shared-packages.mjs';
import * as noRawDesignValues from './no-raw-design-values.mjs';
import { looksLikeSaId, luhnValid, run as runNoRealPii } from './no-real-pii.mjs';
import * as oneZod from './one-zod.mjs';
import * as toolsStayPrivate from './tools-stay-private.mjs';

/**
 * Every guard proven on a broken example (Phase 0 definition of done). Each test builds a tiny
 * throwaway repo in a temp dir, so nothing broken, and no ID-shaped number, is ever committed.
 */

let root;

function repo(files) {
  root = mkdtempSync(join(tmpdir(), 'uf-checks-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

/** A synthetic SA ID: a real date, citizen digits, and a computed Luhn check digit. */
function syntheticId(dateDigits = '050612') {
  // Six date digits, four sequence digits, citizenship 0, then 8: twelve digits before the check.
  const body = `${dateDigits}000108`;
  for (let check = 0; check <= 9; check++) {
    if (luhnValid(`${body}${check}`)) return `${body}${check}`;
  }
  throw new Error('unreachable: one check digit always satisfies Luhn');
}

describe('no-app-imports-in-packages (rule 1)', () => {
  it('flags a package importing an app', () => {
    const findings = noAppImports.run(
      repo({ 'packages/agent/src/a.ts': "import { x } from '@universityflow/web/lib';\n" }),
    );
    assert.equal(findings.length, 1);
  });

  it('flags a relative path into apps/', () => {
    const findings = noAppImports.run(
      repo({ 'packages/agent/src/a.ts': "import { x } from '../../../apps/web/lib';\n" }),
    );
    assert.equal(findings.length, 1);
  });

  it('allows package-to-package imports', () => {
    const findings = noAppImports.run(
      repo({ 'packages/agent/src/a.ts': "import { en } from '@universityflow/content';\n" }),
    );
    assert.equal(findings.length, 0);
  });
});

describe('no-dom-in-shared-packages (rule 11)', () => {
  it('flags a DOM global in a shared package', () => {
    const findings = noDomInShared.run(
      repo({ 'packages/content/src/a.ts': 'export const w = window.innerWidth;\n' }),
    );
    assert.equal(findings.length, 1);
  });

  it('flags a Node built-in in a shared package', () => {
    const findings = noDomInShared.run(
      repo({ 'packages/admissions/src/a.ts': "import { readFileSync } from 'node:fs';\n" }),
    );
    assert.equal(findings.length, 1);
  });

  it('allows Node in a server-only package and in shared-package tests', () => {
    const findings = noDomInShared.run(
      repo({
        'packages/db/src/a.ts': "import { readFileSync } from 'node:fs';\n",
        'packages/content/src/a.test.ts': "import { readFileSync } from 'node:fs';\n",
      }),
    );
    assert.equal(findings.length, 0);
  });
});

describe('no-raw-design-values (rule 8)', () => {
  it('flags a hex colour in an app', () => {
    const findings = noRawDesignValues.run(
      repo({ 'apps/web/app/x.tsx': "const style = { color: '#ff7a2f' };\n" }),
    );
    assert.equal(findings.length, 1);
  });

  it('flags an rgb() colour in app CSS', () => {
    const findings = noRawDesignValues.run(
      repo({ 'apps/web/app/x.css': 'a { color: rgb(255 0 0); }\n' }),
    );
    assert.equal(findings.length, 1);
  });

  it('honours check-ignore', () => {
    const findings = noRawDesignValues.run(
      repo({ 'apps/web/app/x.tsx': "const c = '#fff'; // check-ignore: reason\n" }),
    );
    assert.equal(findings.length, 0);
  });

  it('flags a raw border width in a native style (A2-05)', () => {
    const findings = noRawDesignValues.run(
      repo({ 'apps/native/components/x.tsx': '  card: { borderWidth: 2 },\n' }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /borderWidth/);
  });

  it('flags raw sizes, spacing and type in native styles, including inside a ternary', () => {
    const findings = noRawDesignValues.run(
      repo({
        'apps/native/app/x.tsx': [
          '    padding: 13,',
          '    paddingHorizontal: 12,',
          '    marginTop: -4,',
          '    gap: 8,',
          '    borderRadius: 6,',
          '    fontSize: 15.5,',
          '    lineHeight: 22,',
          '    minHeight: 44,',
          '    width: 20,',
          '    borderBottomWidth: selected ? 2 : 1,',
          '',
        ].join('\n'),
      }),
    );
    assert.equal(findings.length, 10);
  });

  it('allows tokens, zero, percentages and check-ignore in native styles, and leaves the web to Tailwind', () => {
    const findings = noRawDesignValues.run(
      repo({
        'apps/native/components/x.tsx': [
          "    padding: theme.space['4'],",
          '    borderWidth: theme.border.thin,',
          '    margin: 0,',
          "    width: '100%',",
          '    flex: 1,',
          '    opacity: 0.6,',
          '    imageWidth: 200,',
          '    hitSlop: 8, // not a style',
          '    borderWidth: StyleSheet.hairlineWidth,',
          '    height: 1, // check-ignore: a measured layout value, not a design one',
          '',
        ].join('\n'),
        'apps/web/app/x.tsx': 'const style = { width: 1 };\n',
        'apps/native/__tests__/x.test.tsx': 'const style = { padding: 3 };\n',
      }),
    );
    assert.deepEqual(findings, []);
  });

  it('flags a raw Tailwind border width in the web app (A2-17)', () => {
    const findings = noRawDesignValues.run(
      repo({
        'apps/web/components/x.tsx': [
          '<blockquote className="border-l-4 border-line-strong p-3">',
          "const field = 'rounded-md border-2 border-line-strong';",
          '<a className={cn("border-b-4", on && "hover:border-x-2")}>',
          '<div className="border-[3px]" />',
          '',
        ].join('\n'),
      }),
    );
    assert.equal(findings.length, 4);
    assert.match(findings[0].message, /border-l-4/);
    assert.match(findings[0].message, /border-thin|border-thick|border-l-rule/);
  });

  it('allows the token border classes, colours, a reset and plain `border` on the web', () => {
    const findings = noRawDesignValues.run(
      repo({
        'apps/web/components/x.tsx': [
          '<blockquote className="border-l-rule border-line-strong p-3">',
          "const field = 'rounded-md border-thick border-brand aria-[invalid=true]:border-danger';",
          '<div className="border border-line border-b-thin border-0 border-t-0" />',
          'const width = "var(--border-width-thick)";',
          '',
        ].join('\n'),
        'apps/web/app/globals.css': '  --border-width-thick: var(--uf-border-thick);\n',
        'apps/web/test/x.test.tsx': '<div className="border-2" />\n',
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('native-lists-workspace-deps (gotcha 14)', () => {
  const pkg = (name, deps = []) =>
    JSON.stringify({
      name: `@universityflow/${name}`,
      dependencies: Object.fromEntries(deps.map((d) => [`@universityflow/${d}`, 'workspace:*'])),
    });

  it('flags a package the app reaches through a shared package but does not list', () => {
    const findings = nativeListsDeps.run(
      repo({
        'apps/native/package.json': pkg('native', ['admissions']),
        'packages/admissions/package.json': pkg('admissions', ['catalogue']),
        'packages/catalogue/package.json': pkg('catalogue'),
      }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'packages/admissions/package.json');
  });

  it('follows the chain more than one level deep', () => {
    const findings = nativeListsDeps.run(
      repo({
        'apps/native/package.json': pkg('native', ['admissions', 'catalogue']),
        'packages/admissions/package.json': pkg('admissions', ['catalogue']),
        'packages/catalogue/package.json': pkg('catalogue', ['content']),
        'packages/content/package.json': pkg('content'),
      }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /@universityflow\/content/);
  });

  it('passes when the app lists everything it reaches', () => {
    const findings = nativeListsDeps.run(
      repo({
        'apps/native/package.json': pkg('native', ['admissions', 'catalogue']),
        'packages/admissions/package.json': pkg('admissions', ['catalogue']),
        'packages/catalogue/package.json': pkg('catalogue'),
        'packages/db/package.json': pkg('db', ['agent']),
      }),
    );
    assert.equal(findings.length, 0);
  });
});

describe('native-no-catalogue-barrel (A4-13)', () => {
  it('flags a native component importing the catalogue barrel (the A4-04 regression)', () => {
    const findings = nativeNoBarrel.run(
      repo({
        'apps/native/components/x.tsx': "import { subject } from '@universityflow/catalogue';\n",
      }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'apps/native/components/x.tsx');
    assert.match(findings[0].message, /catalogue\/client/);
  });

  it('flags a multi-line import, an inline type import, a re-export, require, import() and a deep path', () => {
    const findings = nativeNoBarrel.run(
      repo({
        'apps/native/app/a.tsx': [
          'import {',
          '  subject,',
          '  SUBJECTS,',
          "} from '@universityflow/catalogue';",
          '',
        ].join('\n'),
        // `import { type X }` keeps an empty `import {}` under verbatimModuleSyntax: it loads.
        'apps/native/lib/b.ts': "import { type Programme } from '@universityflow/catalogue';\n",
        'apps/native/lib/c.ts': "export { subject } from '@universityflow/catalogue';\n",
        'apps/native/lib/d.js': "const c = require('@universityflow/catalogue');\n",
        'apps/native/lib/e.ts': "const c = await import('@universityflow/catalogue');\n",
        'apps/native/lib/f.ts': "import { x } from '@universityflow/catalogue/src/index';\n",
        'apps/native/lib/g.ts': "import '../../../packages/catalogue/src/index';\n",
      }),
    );
    assert.deepEqual(findings.map((f) => `${f.file}:${f.line}`).sort(), [
      'apps/native/app/a.tsx:4',
      'apps/native/lib/b.ts:1',
      'apps/native/lib/c.ts:1',
      'apps/native/lib/d.js:1',
      'apps/native/lib/e.ts:1',
      'apps/native/lib/f.ts:1',
      'apps/native/lib/g.ts:1',
    ]);
  });

  it('allows the client entry, type-only imports, and the barrel outside the app', () => {
    const findings = nativeNoBarrel.run(
      repo({
        'apps/native/components/x.tsx': [
          "import { SUBJECTS } from '@universityflow/catalogue/client';",
          "import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue/client';",
          "import type { Programme } from '@universityflow/catalogue';",
          'import type {',
          '  University,',
          "} from '@universityflow/catalogue';",
          "export type { Paper } from '@universityflow/catalogue';",
          "// import { subject } from '@universityflow/catalogue';",
          '',
        ].join('\n'),
        'apps/web/lib/x.ts': "import { subject } from '@universityflow/catalogue';\n",
        'packages/admissions/src/x.ts': "import { subject } from '@universityflow/catalogue';\n",
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('native-no-content-barrel (A4-18)', () => {
  const nativePackage = JSON.stringify({
    name: '@universityflow/native',
    dependencies: { '@universityflow/content': 'workspace:*', '@universityflow/ui': 'workspace:*' },
  });

  it('flags a native screen importing the content barrel (the A4-18 regression)', () => {
    const findings = nativeNoContentBarrel.run(
      repo({
        'apps/native/package.json': nativePackage,
        'apps/native/app/x.tsx': "import { en } from '@universityflow/content';\n",
      }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'apps/native/app/x.tsx');
    assert.match(findings[0].message, /content\/app/);
  });

  it('flags a bundled package importing the barrel, and every import form and deep path', () => {
    const findings = nativeNoContentBarrel.run(
      repo({
        'apps/native/package.json': nativePackage,
        'packages/ui/package.json': JSON.stringify({ name: '@universityflow/ui' }),
        'packages/ui/src/home.ts': "import { dashboard } from '@universityflow/content';\n",
        'apps/native/app/a.tsx': [
          'import {',
          '  common,',
          '  en,',
          "} from '@universityflow/content';",
          '',
        ].join('\n'),
        'apps/native/lib/b.ts': "import { type AppScreen } from '@universityflow/content';\n",
        'apps/native/lib/c.ts': "export { en } from '@universityflow/content';\n",
        'apps/native/lib/d.js': "const c = require('@universityflow/content');\n",
        'apps/native/lib/e.ts': "const c = await import('@universityflow/content');\n",
        'apps/native/lib/f.ts':
          "import { privacyPage } from '@universityflow/content/src/en/privacy-page';\n",
        'apps/native/lib/g.ts': "import '../../../packages/content/src/index';\n",
      }),
    );
    assert.deepEqual(findings.map((f) => `${f.file}:${f.line}`).sort(), [
      'apps/native/app/a.tsx:4',
      'apps/native/lib/b.ts:1',
      'apps/native/lib/c.ts:1',
      'apps/native/lib/d.js:1',
      'apps/native/lib/e.ts:1',
      'apps/native/lib/f.ts:1',
      'apps/native/lib/g.ts:1',
      'packages/ui/src/home.ts:1',
    ]);
  });

  it('allows the app entry, type-only imports, tests of bundled packages, and packages the app does not list', () => {
    const findings = nativeNoContentBarrel.run(
      repo({
        'apps/native/package.json': nativePackage,
        'apps/native/components/x.tsx': [
          "import { en, SAFETY_TIPS } from '@universityflow/content/app';",
          "import { common, type AppScreen } from '@universityflow/content/app';",
          "import type { Strings } from '@universityflow/content';",
          'import type {',
          '  ReplyReportReason,',
          "} from '@universityflow/content';",
          "export type { HelplineCover } from '@universityflow/content';",
          "// import { en } from '@universityflow/content';",
          '',
        ].join('\n'),
        'packages/ui/package.json': JSON.stringify({ name: '@universityflow/ui' }),
        'packages/ui/src/home.test.ts': "import { dashboard } from '@universityflow/content';\n",
        'packages/agent/package.json': JSON.stringify({ name: '@universityflow/agent' }),
        'packages/agent/src/runner.ts': "import { en } from '@universityflow/content';\n",
        'packages/content/package.json': JSON.stringify({ name: '@universityflow/content' }),
        'packages/content/src/app.ts': "export { en } from './app-en';\n",
        'apps/web/lib/x.ts': "import { en } from '@universityflow/content';\n",
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('no-real-pii (rule 4)', () => {
  it('recognises a well-formed ID and rejects a broken check digit', () => {
    const id = syntheticId();
    assert.equal(looksLikeSaId(id), true);
    const broken = `${id.slice(0, 12)}${(Number(id[12]) + 1) % 10}`;
    assert.equal(looksLikeSaId(broken), false);
  });

  it('does not mistake a millisecond timestamp for an ID', () => {
    assert.equal(looksLikeSaId(String(Date.UTC(2027, 9, 20))), false);
  });

  it('flags an ID-shaped number in a test fixture', () => {
    const findings = runNoRealPii(
      repo({
        'packages/evals/src/fixture.ts': `export const learner = { id: '${syntheticId()}' };\n`,
      }),
    );
    assert.equal(findings.length, 1);
  });

  it('flags a cellphone number, in local and +27 form', () => {
    const local = `0${'82'}${'5550123'}`;
    const intl = `+27${'72'}${'5550123'}`;
    const findings = runNoRealPii(
      repo({
        'apps/web/app/a.ts': `const a = '${local}';\n`,
        'apps/web/app/b.ts': `const b = '${intl}';\n`,
      }),
    );
    assert.equal(findings.length, 2);
  });

  it('scans tools/ too: the results generator writes synthetic learners (§18.7)', () => {
    const findings = runNoRealPii(
      repo({
        'tools/results-generator/src/names.ts': `export const id = '${syntheticId()}';\n`,
      }),
    );
    assert.equal(findings.length, 1);
  });

  it('leaves toll-free helplines alone', () => {
    const findings = runNoRealPii(
      repo({ 'packages/agent/src/help.ts': `const helpline = '0${'800'}${'567567'}';\n` }),
    );
    assert.equal(findings.length, 0);
  });
});

describe('tools-stay-private (§18.8)', () => {
  const tool = {
    'tools/results-generator/package.json': JSON.stringify({
      name: '@universityflow/results-generator',
    }),
  };

  it('flags an app that lists a tool as a dependency', () => {
    const findings = toolsStayPrivate.run(
      repo({
        ...tool,
        'apps/web/package.json': JSON.stringify({
          name: '@universityflow/web',
          devDependencies: { '@universityflow/results-generator': 'workspace:*' },
        }),
      }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /results-generator/);
  });

  it('flags a package that imports a tool, by name or by a relative path', () => {
    const findings = toolsStayPrivate.run(
      repo({
        ...tool,
        'packages/documents/src/a.ts': "import { x } from '@universityflow/results-generator';\n",
        'apps/native/src/b.ts': "import { y } from '../../../tools/results-generator/src/pdf';\n",
      }),
    );
    assert.equal(findings.length, 2);
  });

  it('passes when tools depend on packages and nothing depends on the tools', () => {
    const findings = toolsStayPrivate.run(
      repo({
        ...tool,
        'packages/documents/package.json': JSON.stringify({ name: '@universityflow/documents' }),
        'packages/documents/src/a.ts': '// made by tools/results-generator\nexport const a = 1;\n',
      }),
    );
    assert.equal(findings.length, 0);
  });
});

describe('one-zod (A4-02)', () => {
  /** A tiny pnpm-lock.yaml: each importer's zod, then each library's. */
  const lock = (importers, libraries = {}) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      ...Object.entries(importers).flatMap(([path, version]) => [
        `  ${path}:`,
        '    dependencies:',
        '      zod:',
        `        specifier: ^${version}`,
        `        version: ${version}`,
        '',
      ]),
      'packages:',
      '',
      'snapshots:',
      '',
      ...Object.entries(libraries).flatMap(([name, version]) => [
        `  '${name}':`,
        '    dependencies:',
        `      zod: ${version}`,
        '',
      ]),
    ].join('\n');

  it('flags two workspace packages resolving different zods (the A4-02 regression)', () => {
    const findings = oneZod.run(
      repo({ 'pnpm-lock.yaml': lock({ 'apps/web': '4.6.7', 'packages/catalogue': '4.6.5' }) }),
    );
    assert.equal(findings.length, 2);
    assert.match(findings[1].message, /zod 4\.6\.5 resolves for packages\/catalogue/);
  });

  it('flags a library that brings its own zod into a bundle', () => {
    const findings = oneZod.run(
      repo({
        'pnpm-lock.yaml': lock({ 'apps/web': '4.6.7' }, { '@anthropic-ai/sdk@1.0.0': '4.6.5' }),
      }),
    );
    assert.equal(findings.length, 2);
  });

  it('passes one zod, and lets a command-line tool keep its own', () => {
    const findings = oneZod.run(
      repo({
        'pnpm-lock.yaml': lock(
          { 'apps/web': '4.6.7', 'packages/catalogue': '4.6.7' },
          { '@expo/cli@57.0.27(expo@57.0.25)': '3.25.76', '@anthropic-ai/sdk@1.0.0': '4.6.7' },
        ),
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('env-documented (A1-17)', () => {
  const example = '# Comment\nDATABASE_URL=postgres://x\n# UF_S3_BUCKET=\n';

  it('flags a variable the app reads but .env.example does not document (the A1-17 regression)', () => {
    const findings = envDocumented.run(
      repo({
        '.env.example': example,
        'apps/native/app.config.ts': "const projectId = process.env['UF_EAS_PROJECT_ID'];\n",
      }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /UF_EAS_PROJECT_ID/);
  });

  it('sees dot reads and reads through an env parameter', () => {
    const findings = envDocumented.run(
      repo({
        '.env.example': example,
        'apps/native/lib/a.ts': 'const a = process.env.EXPO_PUBLIC_NEW;\n',
        'apps/web/lib/server/config.ts': "const b = env['UF_NEW_THING'];\n",
      }),
    );
    assert.deepEqual(findings.map((f) => f.message.split(' ')[0]).sort(), [
      'EXPO_PUBLIC_NEW',
      'UF_NEW_THING',
    ]);
  });

  it('passes documented (even commented-out) and platform-provided names, and skips tests', () => {
    const findings = envDocumented.run(
      repo({
        '.env.example': example,
        'apps/web/lib/a.ts':
          "const a = process.env['DATABASE_URL'] ?? env['UF_S3_BUCKET'] ?? process.env.NODE_ENV;\n",
        'apps/web/test/harness.ts': "process.env['UF_ONLY_IN_TESTS'] = '1';\n",
        'packages/db/src/x.test.ts': "const t = process.env['TEST_ONLY'];\n",
        'apps/web/e2e/helpers.ts': "const e = process.env['UF_E2E_ONLY'];\n",
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('actions-pinned (A8-03)', () => {
  const sha = 'a'.repeat(40);
  const workflow = (steps) =>
    ['jobs:', '  build:', '    runs-on: ubuntu-latest', '    steps:', ...steps].join('\n');

  it('flags an action on a moving tag (the A8-03 regression)', () => {
    const findings = actionsPinned.run(
      repo({ '.github/workflows/ci.yml': workflow(['      - uses: actions/checkout@v7']) }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /actions\/checkout@v7/);
  });

  it('flags another repository checked out at a branch', () => {
    const findings = actionsPinned.run(
      repo({
        '.github/workflows/audits.yml': workflow([
          `      - uses: actions/checkout@${sha} # v7.0.1`,
          '        with:',
          '          repository: tumoolo-tech/tumoOLO_Audits',
          '          ref: main',
        ]),
      }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /checked out at main/);
  });

  it('passes SHA pins, local actions, and a ref on this repository', () => {
    const findings = actionsPinned.run(
      repo({
        '.github/workflows/ci.yml': workflow([
          `      - uses: actions/checkout@${sha} # v7.0.1`,
          '        with:',
          '          ref: main',
          '      - uses: ./.github/actions/setup',
          `      - uses: tumoolo-tech/x@${sha}`,
          '        with:',
          '          repository: tumoolo-tech/tumoOLO_Audits',
          `          ref: ${sha}`,
        ]),
      }),
    );
    assert.deepEqual(findings, []);
  });
});
