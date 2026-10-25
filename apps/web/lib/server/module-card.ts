import 'server-only';
import {
  type ConfirmedOutlineScheme,
  InvalidSchemeError,
  type ResolvedScheme,
  resolveScheme,
} from '@universityflow/admissions';
import {
  academicCalendarFor,
  type CatalogueView,
  facultyOfficeFor,
  freeBooksFor,
  freeBooksView,
  isDraft,
  libraryFor,
  librarySearchLink,
  MODULE_TERMS,
  type ModuleTerm,
  normaliseModuleCode,
  type OpenBook,
  oerProviderOf,
  programmeById,
  type SubjectArea,
  sastDateOf,
  type UniversityId,
} from '@universityflow/catalogue';
import type { ModuleOutlineRecord, StudentStore } from '@universityflow/db';
import {
  type CardCalendar,
  type CardOutline,
  type CardRecordInfo,
  type ModuleCardData,
  YEAR_MARK_COMPONENT,
} from '@universityflow/ui';
import { z } from 'zod';
import { demoModuleSubjectAreas, isDemoSampleModule } from './demo/module-cards';
import { HttpError } from './http';
import { type CardFreeBook, cardBooks } from './module-card-books';

/**
 * A module card's data (Phase 6c; docs/plans/phase-6-proposal.md), for the web page and the app's
 * API (`GET /api/modules/:registrationId/:code`). Only a module on the learner's own latest
 * confirmed registration has one (row-level security reads only theirs; the id and the code are
 * checked here too): anything else is "not found".
 *
 * Code decides (hard rule 2): `admissions.resolveScheme` resolves how the marks work from the
 * learner's confirmed outline (hard rule 6), the module's published scheme and the faculty's and
 * university's rules, for the learner's own academic year; the free books come from the
 * catalogue's `freeBooksFor` on the server (the book rules stay here, A4-13). Only the resolved
 * scheme goes to the browser and the app, never catalogue records.
 */

const uuid = z.uuid();

/**
 * The learner's confirmed outline as the scheme input `resolveScheme` takes: the components and
 * their weights as confirmed, the DP's number and the exam subminimum. The DP's words and the
 * supplementary note are quoted as "other rules": code judges numbers only, and quoted words never
 * outweigh a published rule's (a quote is not a rule the calculator can apply).
 */
export function outlineScheme(record: ModuleOutlineRecord): ConfirmedOutlineScheme {
  const base = {
    moduleCode: record.moduleCode,
    academicYear: record.academicYear,
    confirmedOn: sastDateOf(record.confirmedAt),
  };
  const c = record.outline.components;
  if (c.status !== 'confirmed') return base;
  const quotes = [c.dpRequirement.quote, c.supplementaryQuote].filter(
    (q): q is string => typeof q === 'string' && q.trim() !== '',
  );
  return {
    ...base,
    components: c.items.map((i) => ({
      name: i.name,
      kind: i.kind,
      weight: i.weight,
      ...(i.subminimum === null ? {} : { subminimum: i.subminimum }),
    })),
    ...(c.dpRequirement.percent === null
      ? {}
      : { dpRequirement: { minimumYearMark: c.dpRequirement.percent } }),
    ...(c.examSubminimum === null ? {} : { examSubminimum: c.examSubminimum }),
    ...(quotes.length > 0 ? { otherRules: quotes } : {}),
  };
}

function cardOutline(record: ModuleOutlineRecord): CardOutline {
  const { dates, books, people } = record.outline;
  return {
    confirmedOn: sastDateOf(record.confirmedAt),
    dates:
      dates.status === 'confirmed'
        ? { status: 'confirmed', items: dates.items.map((d) => ({ label: d.label, date: d.date })) }
        : { status: 'not-in-outline' },
    books:
      books.status === 'confirmed'
        ? {
            status: 'confirmed',
            items: books.items.map((b) => ({
              role: b.role,
              title: b.title,
              authors: b.authors,
              edition: b.edition,
              isbn: b.isbn,
            })),
          }
        : { status: 'not-in-outline' },
    people:
      people.status === 'confirmed'
        ? {
            status: 'confirmed',
            items: people.items.map((p) => ({
              name: p.name,
              role: p.role,
              email: p.email,
              phone: p.phone,
              office: p.office,
              consultationTimes: p.consultationTimes,
            })),
          }
        : { status: 'not-in-outline' },
  };
}

function cardCalendar(
  view: CatalogueView,
  universityId: UniversityId,
  academicYear: number,
): CardCalendar | null {
  const c = academicCalendarFor(view, universityId, academicYear);
  if (!c) return null;
  const ranged = (xs?: ReadonlyArray<{ label: string; dates: { from: string; to: string } }>) =>
    (xs ?? []).map((x) => ({ label: x.label, from: x.dates.from, to: x.dates.to }));
  return {
    academicYear: c.academicYear,
    sourceUrl: c.sourceUrl,
    draft: isDraft(c),
    ...(c.verifiedOn ? { verifiedOn: c.verifiedOn } : {}),
    examPeriods: ranged(c.examPeriods),
    supplementaryExams: ranged(c.supplementaryExams),
    supplementaryRegistration: (c.supplementaryRegistration ?? []).map((d) => ({ ...d })),
    dpLists: (c.dpLists ?? []).map((d) => ({ ...d })),
  };
}

/** The titles and verification dates of the records a scheme's fields came from (by record id). */
function recordInfo(view: CatalogueView, universityId: UniversityId) {
  const info: Record<string, CardRecordInfo> = {};
  for (const r of view.assessmentRules) {
    if (r.universityId !== universityId) continue;
    info[r.id] = { title: r.title, ...(r.verifiedOn ? { verifiedOn: r.verifiedOn } : {}) };
  }
  for (const m of view.moduleAssessments) {
    if (m.universityId !== universityId) continue;
    info[m.code] = m.verifiedOn ? { verifiedOn: m.verifiedOn } : {};
  }
  return info;
}

function cardBook(book: OpenBook, kind: CardFreeBook['kind']): CardFreeBook {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    url: book.url,
    provider: oerProviderOf(book.url),
    licence: book.licence,
    level: book.level,
    kind,
    draft: isDraft(book),
  };
}

/** The learner's module: on their latest confirmed registration, by id and code; else not found. */
async function registeredModule(student: StudentStore, registrationId: string, code: string) {
  if (!uuid.safeParse(registrationId).success) throw new HttpError(404, 'not-found');
  const registration = await student.registration();
  if (!registration || registration.id !== registrationId) throw new HttpError(404, 'not-found');
  const wanted = normaliseModuleCode(code);
  const registered = registration.modules.find((m) => normaliseModuleCode(m.code) === wanted);
  if (!registered) throw new HttpError(404, 'not-found');
  return { registration, registered };
}

export interface CardOptions {
  /** Judge demo mode: a DEMO module's card is the SAMPLE outline's, and says so. */
  readonly demo: boolean;
  readonly now?: Date;
}

/** One confirmed module's card (see the file comment). */
export async function moduleCardData(
  student: StudentStore,
  view: CatalogueView,
  target: { readonly registrationId: string; readonly code: string },
  options: CardOptions,
): Promise<ModuleCardData> {
  const now = options.now ?? new Date();
  const { registration, registered } = await registeredModule(
    student,
    target.registrationId,
    target.code,
  );
  const wanted = normaliseModuleCode(registered.code);
  const [outlines, sheet] = await Promise.all([
    student.moduleOutlines(),
    student.moduleMarks(registration.academicYear, registered.code),
  ]);
  const outline = outlines.find(
    (o) =>
      o.academicYear === registration.academicYear && normaliseModuleCode(o.moduleCode) === wanted,
  );
  const universityId = registration.universityId as UniversityId;
  const programme = programmeById(view, registration.programmeId);
  const university = view.universities.find((u) => u.id === universityId);
  const scheme = resolve(view, {
    universityId,
    code: registered.code,
    academicYear: registration.academicYear,
    faculty: programme?.faculty ?? '',
    outline: outline ? outlineScheme(outline) : undefined,
    now,
  });

  const books = freeBooksView(now, { includeDrafts: view.includesDrafts });
  const outlineBooks =
    outline?.outline.books.status === 'confirmed' ? outline.outline.books.items : [];
  const sample = options.demo && isDemoSampleModule(registered.code);
  const subjectAreas: ReadonlyArray<SubjectArea> = sample
    ? demoModuleSubjectAreas(registration.programmeId)
    : [];
  const free = freeBooksFor(books, {
    universityId,
    moduleCode: registered.code,
    subjectAreas,
    prescribed: outlineBooks
      .filter((b) => b.role === 'prescribed')
      .map((b) => ({ title: b.title, edition: b.edition, isbn: b.isbn })),
  });
  const library = libraryFor(books, universityId);
  const office = programme ? facultyOfficeFor(view, programme) : undefined;

  return {
    registrationId: registration.id,
    module: {
      code: registered.code,
      name: registered.name,
      term:
        registered.term && (MODULE_TERMS as ReadonlyArray<string>).includes(registered.term)
          ? (registered.term as ModuleTerm)
          : null,
      academicYear: registration.academicYear,
      universityName: university?.shortName ?? universityId.toUpperCase(),
    },
    sample,
    scheme,
    records: recordInfo(view, universityId),
    outline: outline ? cardOutline(outline) : null,
    calendar: cardCalendar(view, universityId, registration.academicYear),
    // In words here, on the server (module-card-books.ts, A4-13).
    books: cardBooks({
      free: [
        ...free.prescribedOpen.map((p) => cardBook(p.book, 'prescribed')),
        ...free.similar.map((s) => cardBook(s.book, 'similar')),
      ],
      library: library
        ? {
            name: library.name,
            draft: isDraft(library),
            links: outlineBooks.flatMap((b) => {
              const link = librarySearchLink(library, { isbn: b.isbn, title: b.title });
              return link ? [{ title: b.title, url: link.url }] : [];
            }),
          }
        : null,
      outlineBooks: outlineBooks.length,
    }),
    office: office
      ? {
          faculty: office.faculty,
          where: office.where,
          hours: office.hours ?? null,
          email: office.email ?? null,
          phone: office.phone ?? null,
          contactUrl: office.contactUrl,
          draft: isDraft(office),
        }
      : null,
    marks: sheet.marks,
    target: sheet.target,
    today: sastDateOf(now),
  };
}

function resolve(
  view: CatalogueView,
  input: {
    universityId: UniversityId;
    code: string;
    academicYear: number;
    faculty: string;
    outline: ConfirmedOutlineScheme | undefined;
    now: Date;
  },
): ResolvedScheme {
  const base = {
    module: {
      universityId: input.universityId,
      code: input.code,
      academicYear: input.academicYear,
    },
    faculty: input.faculty,
    records: view,
    today: input.now,
    includeDrafts: view.includesDrafts,
  };
  if (!input.outline) return resolveScheme(base);
  try {
    return resolveScheme({ ...base, outline: input.outline });
  } catch (error) {
    // The database holds only confirmed outlines whose weights add up; one that can't be used is
    // left out (never repaired), and the published rules are used alone.
    if (error instanceof InvalidSchemeError) return resolveScheme(base);
    throw error;
  }
}

/** What a learner saves from the calculator: their marks and target, as percentages. */
export const markSheetBody = z.strictObject({
  marks: z
    .array(
      z.strictObject({
        component: z.string().min(1).max(160),
        attempt: z.int().min(1).max(20),
        percent: z.number().min(0).max(100),
      }),
    )
    .max(60),
  target: z.number().min(0).max(100).nullable(),
});
export type MarkSheetBody = z.infer<typeof markSheetBody>;

/**
 * Saves the learner's marks for one of their modules, then returns its card. Only a coursework
 * component of the module's resolved scheme takes a mark (never the exam: the calculator works
 * out what it needs), and no more attempts than it has; anything else is refused, never repaired.
 */
export async function saveCardMarks(
  student: StudentStore,
  view: CatalogueView,
  target: { readonly registrationId: string; readonly code: string },
  body: MarkSheetBody,
  options: CardOptions,
): Promise<ModuleCardData> {
  const card = await moduleCardData(student, view, target, options);
  const weighting = card.scheme.weighting?.value;
  if (!weighting) throw new HttpError(409, 'state', 'weighting-not-published');
  const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const m of body.marks) {
    if (weighting.components) {
      const c = weighting.components.find((x) => key(x.name) === key(m.component));
      if (!c || c.kind === 'exam' || m.attempt > (c.bestOf?.of ?? 1)) {
        throw new HttpError(400, 'invalid', 'not-a-component');
      }
    } else if (key(m.component) !== YEAR_MARK_COMPONENT || m.attempt !== 1) {
      throw new HttpError(400, 'invalid', 'not-a-component');
    }
  }
  await student.saveModuleMarks({
    academicYear: card.module.academicYear,
    moduleCode: card.module.code,
    marks: body.marks,
    target: body.target,
  });
  return moduleCardData(student, view, target, options);
}
