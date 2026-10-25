import 'server-only';
import type { SubjectArea } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import {
  type ConfirmedModuleOutline,
  draftFromModuleOutline,
  SAMPLE_OUTLINE_YEARS,
  type SampleOutlineYear,
  sampleModuleOutline,
} from '@universityflow/documents';

/**
 * The judge demo's module cards (Phase 6c, UF_DEPLOYMENT=demo). The demo's made-up university
 * learners are registered for made-up DEMO modules, which no university publishes a scheme for, so
 * each learner's first module gets the results generator's SAMPLE outline (Phase 6b's, the same one
 * "Use a sample module outline" reads) as if they had typed it in, and a few made-up marks, so a
 * judge sees the calculator working at once. The card says it is a SAMPLE, and its rules say they
 * come from the SAMPLE outline.
 *
 * Nothing here is real or about a real person (hard rule 4): the module, lecturer, book and marks
 * are made up, written at runtime when a judge starts a learner. Only in demo mode.
 */

/** A demo module's code: `DEMO` and the year of study, never a real-looking code (personas.ts). */
export const isDemoSampleModule = (code: string) => /^DEMO\d{4}$/.test(code.trim().toUpperCase());

/**
 * Which subject areas' curated "covers similar ground" books a demo module shows (D6): the
 * made-up module stands in for a first module of its learner's course, so it takes that course's
 * field. A demo-only curation, made here in code; a real module's areas come from a person.
 */
const DEMO_AREAS: Readonly<Record<string, ReadonlyArray<SubjectArea>>> = {
  'uj-bsc-it-computer-science': ['computer-science'],
  'wits-bcom': ['economics'],
  'uct-bsc-computer-science': ['computer-science'],
};

export function demoModuleSubjectAreas(programmeId: string): ReadonlyArray<SubjectArea> {
  return DEMO_AREAS[programmeId] ?? [];
}

/**
 * The made-up marks a demo learner starts with, by year of study: a first year has a test and the
 * assignment back; a later year, in their second semester, has all their coursework back.
 */
function sampleMarks(year: SampleOutlineYear) {
  return year === 1
    ? [
        { component: 'Test 1', attempt: 1, percent: 62 },
        { component: 'Assignment', attempt: 1, percent: 70 },
      ]
    : [
        { component: 'Test 1', attempt: 1, percent: 58 },
        { component: 'Test 2', attempt: 1, percent: 66 },
        { component: 'Assignment', attempt: 1, percent: 72 },
      ];
}

const asYear = (yearOfStudy: number): SampleOutlineYear =>
  (SAMPLE_OUTLINE_YEARS as ReadonlyArray<number>).includes(yearOfStudy)
    ? (yearOfStudy as SampleOutlineYear)
    : yearOfStudy > 3
      ? 3
      : 1;

/**
 * The SAMPLE outline for `yearOfStudy`, confirmed for the learner's own module and academic year:
 * read by Phase 6b's own code (`draftFromModuleOutline`), every part kept as read, its dates moved
 * into the registration's year.
 */
export function sampleConfirmedOutline(
  yearOfStudy: number,
  moduleCode: string,
  academicYear: number,
): ConfirmedModuleOutline {
  const draft = draftFromModuleOutline(sampleModuleOutline(asYear(yearOfStudy)));
  const inYear = (date: string) => `${academicYear}${date.slice(4)}`;
  return {
    moduleCode,
    moduleName: draft.moduleName,
    academicYear,
    term: draft.term,
    components: {
      status: 'confirmed',
      items: draft.components.map((c) => ({
        name: c.name,
        kind: c.kind ?? 'other',
        weight: c.weight ?? 0,
        subminimum: c.subminimum,
      })),
      dpRequirement: { percent: draft.dpPercent, quote: draft.dpQuote },
      examSubminimum: draft.examSubminimum,
      supplementaryQuote: draft.supplementaryQuote,
    },
    dates: {
      status: 'confirmed',
      items: draft.dates.flatMap((d) => (d.date ? [{ label: d.label, date: inYear(d.date) }] : [])),
    },
    books: {
      status: 'confirmed',
      items: draft.books.map((b) => ({
        role: b.role ?? 'prescribed',
        title: b.title,
        authors: b.authors,
        edition: b.edition,
        isbn: b.isbn,
      })),
    },
    people: { status: 'confirmed', items: draft.people.map((p) => ({ ...p })) },
    documentId: null,
  };
}

/** Gives a demo learner's first module its SAMPLE outline and made-up marks (see above). */
export async function seedDemoModuleCard(
  student: StudentStore,
  registration: {
    readonly academicYear: number;
    readonly yearOfStudy: number;
    readonly code: string;
  },
): Promise<void> {
  const { academicYear, yearOfStudy, code } = registration;
  await student.saveModuleOutline(sampleConfirmedOutline(yearOfStudy, code, academicYear));
  await student.saveModuleMarks({
    academicYear,
    moduleCode: code,
    marks: sampleMarks(asYear(yearOfStudy)),
    target: null,
  });
}
