import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Loads the catalogue straight from its TypeScript source, read-only.
 *
 * Node 24 strips TypeScript types natively, but the packages import each other without file
 * extensions (`./data/wits`), which Node's ESM resolver refuses. This hook adds `.ts` to a
 * relative specifier from a `.ts` file when that file exists. It changes nothing on disk: the
 * catalogue is only ever imported, never written.
 */

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromTs = context.parentURL?.endsWith('.ts');
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (fromTs && relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      const candidate = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const at = (path) => pathToFileURL(resolve(ROOT, path)).href;

/** The data files a record can live in, repo-relative, for file:line references. */
export const SOURCE_FILES = {
  wits: 'packages/catalogue/src/data/wits.ts',
  uj: 'packages/catalogue/src/data/uj.ts',
  up: 'packages/catalogue/src/data/up.ts',
  uct: 'packages/catalogue/src/data/uct.ts',
  tut: 'packages/catalogue/src/data/tut.ts',
  ukzn: 'packages/catalogue/src/data/ukzn.ts',
  support: 'packages/catalogue/src/data/support.ts',
  bursaries: 'packages/catalogue/src/data/bursaries.ts',
  exams: 'packages/catalogue/src/data/nsc-exams-2026.ts',
  practice: 'packages/catalogue/src/data/siyavula.ts',
  methods: 'packages/admissions/src/universities/methods.ts',
  // Phase 5: each university's campus and registration records, and its curricula.
  ...Object.fromEntries(
    ['wits', 'uj', 'up', 'uct', 'tut', 'ukzn'].flatMap((id) => [
      [`${id}-orientation`, `packages/catalogue/src/data/${id}-orientation.ts`],
      [`${id}-curricula`, `packages/catalogue/src/data/${id}-curricula.ts`],
    ]),
  ),
  // Phase 6d: free books, their curated matches and the library searches.
  books: 'packages/catalogue/src/data/open-books.ts',
  // Public TVET colleges (planning.md §19.1): one data file per research group, and the register.
  ...Object.fromEntries(
    [
      'eastern-cape',
      'fs-nc-nw',
      'gauteng',
      'kwazulu-natal',
      'limpopo-mpumalanga',
      'western-cape',
      'register',
    ].map((group) => [`colleges-${group}`, `packages/catalogue/src/data/colleges/${group}.ts`]),
  ),
  // Phase 6a: each university's assessment rules, module schemes and exam calendar.
  ...Object.fromEntries(
    ['wits', 'uj', 'up', 'uct', 'tut', 'ukzn']
      .map((id) => [`${id}-assessment`, `packages/catalogue/src/data/${id}-assessment.ts`])
      .filter(([, path]) => existsSync(resolve(ROOT, path))),
  ),
  // Phase 5e-3: each university's safety notes, once it has a file of them.
  ...Object.fromEntries(
    ['wits', 'uj', 'up', 'uct', 'tut', 'ukzn']
      .map((id) => [`${id}-safety`, `packages/catalogue/src/data/${id}-safety.ts`])
      .filter(([, path]) => existsSync(resolve(ROOT, path))),
  ),
};

/**
 * Everything the checklists are built from: every catalogue record (drafts included), the NSC
 * subject names, the score methods, and the text of each data file (for line numbers).
 */
export async function loadCatalogue() {
  const catalogue = await import(at('packages/catalogue/src/catalogue.ts'));
  const subjects = await import(at('packages/catalogue/src/subjects.ts'));
  const basics = await import(at('packages/catalogue/src/basics.ts'));
  const methods = await import(at('packages/admissions/src/universities/methods.ts'));
  // Phase 6d: the free-book records live beside the catalogue (books.ts), not in RAW_CATALOGUE.
  const books = await import(at('packages/catalogue/src/books.ts'));
  // Public TVET colleges load through their own entry, not RAW_CATALOGUE.
  const colleges = await import(at('packages/catalogue/src/colleges-catalogue.ts'));
  const sources = Object.fromEntries(
    Object.entries(SOURCE_FILES).map(([key, path]) => [
      key,
      { path, lines: readFileSync(resolve(ROOT, path), 'utf8').split(/\r?\n/) },
    ]),
  );
  return {
    raw: {
      ...catalogue.RAW_CATALOGUE,
      ...books.FREE_BOOKS_RAW,
      colleges: colleges.RAW_COLLEGES.colleges,
      collegeProgrammes: colleges.RAW_COLLEGES.programmes,
      teachOutNotices: colleges.RAW_COLLEGES.notices ?? [],
    },
    /** The provinces, in order: one college checklist each. */
    provinces: basics.PROVINCES,
    /** The free-book allow-list (D5), so the checklist names each link's provider. */
    oerHosts: books.OER_HOSTS,
    subjects: subjects.SUBJECTS,
    languages: subjects.OFFICIAL_LANGUAGES,
    methods: [...methods.METHODS.values()],
    defaultMethod: methods.DEFAULT_METHOD,
    /** The "open in maps" link a learner gets, so the verifier opens the same one. */
    mapsLink: basics.mapsLink,
    /** "Walk there" and "See it" (5e-1), the same links a learner gets. */
    walkingLink: basics.walkingLink,
    streetViewLink: basics.streetViewLink,
    safetyPlaceKinds: basics.SAFETY_PLACE_KINDS,
    sources,
  };
}
