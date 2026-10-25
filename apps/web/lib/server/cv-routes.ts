import 'server-only';
import {
  buildCvProfile,
  CV_ENTRY_KINDS,
  CV_LIMITS,
  type CvEngine,
  type CvEntryRecord,
  type CvProfile,
  type CvSelection,
  EVIDENCE_KINDS,
} from '@universityflow/cv';
import {
  type Account,
  AGE_OF_MAJORITY,
  ageOn,
  type StudentStore,
  sastDate,
} from '@universityflow/db';
import { z } from 'zod';
import { cvSources, scheduleCvDeletions } from './cv';
import { HttpError } from './http';
import { careForStudent, writtenCare } from './plan-care';
import { getServices, type Services } from './services';

/**
 * What the CV routes share (docs/design/mmereko-api-proposal.md §10.3): the switch, the request
 * shapes, and the "what goes on my CV" view. Strings are never built here: errors carry reasons
 * the page maps to `packages/content` `cv.errors`.
 */

/** The services, with the CV on and an engine to make it; otherwise 404 (D8). */
export async function cvOn(): Promise<Services & { readonly cv: CvEngine }> {
  const services = await getServices();
  if (!services.config.cv || !services.cv) throw new HttpError(404, 'not-found');
  return services as Services & { readonly cv: CvEngine };
}

/** An adult answering for themselves: the only learner who may add sharing (§9.3). */
export function adultInOwnName(account: Account, now: Date = new Date()): boolean {
  return Boolean(
    account.dateOfBirth &&
      ageOn(account.dateOfBirth, sastDate(now)) >= AGE_OF_MAJORITY &&
      account.consentStatus === 'not-required',
  );
}

const words = (max: number) => z.string().max(max * 2);
const month = z.string().regex(/^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/);

export const EntryBody = z
  .object({
    kind: z.enum(CV_ENTRY_KINDS),
    title: words(CV_LIMITS.title),
    organisation: words(CV_LIMITS.title).nullable(),
    role: words(CV_LIMITS.title).nullable(),
    startDate: month.nullable(),
    endDate: month.nullable(),
    description: words(CV_LIMITS.description).nullable(),
    highlights: z.array(words(CV_LIMITS.highlight)).max(CV_LIMITS.highlights),
    keywords: z.array(words(CV_LIMITS.keyword)).max(CV_LIMITS.keywords),
    evidence: z
      .array(
        z
          .object({
            kind: z.enum(EVIDENCE_KINDS),
            // https only, checked again (public host, no credentials) by the data layer.
            url: z
              .string()
              .max(CV_LIMITS.url)
              .regex(/^https:\/\//),
            label: words(CV_LIMITS.evidenceLabel).nullable(),
          })
          .strict(),
      )
      .max(CV_LIMITS.evidence),
    linkedModules: z.array(z.string().max(24)).max(CV_LIMITS.linkedModules),
  })
  .strict();

export const EntryPatch = EntryBody.omit({ kind: true }).partial().strict();

export const SelectionBody = z
  .object({
    surname: words(CV_LIMITS.name).nullable(),
    label: words(CV_LIMITS.label).nullable(),
    summary: words(CV_LIMITS.summary).nullable(),
    email: z.string().max(120).nullable(),
    phone: z.string().max(20).nullable(),
    city: words(CV_LIMITS.name).nullable(),
    region: words(CV_LIMITS.name).nullable(),
    includeSchool: z.boolean(),
    subjectIds: z.array(z.string().max(40)).max(12),
    includeOffer: z.boolean(),
    moduleCodes: z.array(z.string().max(24)).max(CV_LIMITS.modules),
    entryIds: z.array(z.string().uuid()).max(280),
  })
  .strict();

export const AdvertBody = z
  .object({
    title: words(CV_LIMITS.title),
    company: words(CV_LIMITS.title).nullable(),
    text: z.string().min(1).max(CV_LIMITS.advert),
  })
  .strict();

/** The crisis check on the learner's own words (§7.5), as plan maps do: saved anyway. */
export async function careFor(
  student: StudentStore,
  services: Services,
  texts: ReadonlyArray<string | null | undefined>,
) {
  return careForStudent(student, services.catalogue(), { texts });
}

/**
 * Every word of an entry the learner wrote, for the crisis check on save (A10-54): its keywords
 * and its links' labels too, which go on the CV as they are.
 */
export function entryTexts(entry: CvEntryRecord): ReadonlyArray<string | null> {
  return [
    entry.title,
    entry.organisation,
    entry.role,
    entry.description,
    ...entry.highlights,
    ...entry.keywords,
    ...entry.evidence.map((e) => e.label),
  ];
}

/** The words typed on the CV page itself (A10-54): the surname, town and province too. */
export function selectionTexts(selection: CvSelection): ReadonlyArray<string | null> {
  return [selection.surname, selection.label, selection.summary, selection.city, selection.region];
}

/** Keys whose strings are codes, dates or links the learner didn't write as words. */
const NOT_WORDS = new Set([
  'schemaVersion',
  'countryCode',
  'xSource',
  'startDate',
  'endDate',
  'date',
  'kind',
  'url',
  'email',
  'phone',
  'code',
  'term',
]);

function stringsOf(value: unknown, into: string[]): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsOf(v, into);
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) if (!NOT_WORDS.has(key)) stringsOf(v, into);
  }
  return into;
}

/**
 * The words that would leave for the engine, in the groups they were written in (A10-56): the
 * page's own lines, then each school, project, job, award and so on, each read as one piece as on
 * save, so words from two entries never run together into one sentence.
 */
export function profileWordGroups(profile: CvProfile): ReadonlyArray<ReadonlyArray<string>> {
  const { schemaVersion: _version, basics, ...sections } = profile;
  return [
    stringsOf(basics, []),
    ...Object.values(sections).flatMap((list) =>
      Array.isArray(list) ? list.map((item) => stringsOf(item, [])) : [],
    ),
  ];
}

/**
 * The crisis check on everything that would leave UniversityFlow for a CV (A10-55, A10-56): the
 * profile the ticks make now and any advert the learner pasted. The care for the most worrying
 * group (a crisis before a concern), or null; a setback is no reason to say anything here.
 */
export async function careForLeaving(
  student: StudentStore,
  services: Services,
  groups: ReadonlyArray<ReadonlyArray<string | null | undefined>>,
) {
  const view = services.catalogue();
  let worst: {
    texts: ReadonlyArray<string | null | undefined>;
    level: 'crisis' | 'concern';
  } | null = null;
  for (const texts of groups) {
    const care = writtenCare({ texts }, view.helplines);
    if (care?.level === 'crisis') {
      worst = { texts, level: 'crisis' };
      break;
    }
    if (care?.level === 'concern' && worst === null) worst = { texts, level: 'concern' };
  }
  return worst ? careForStudent(student, view, { texts: worst.texts }) : null;
}

/**
 * "Make my CV", "Fit it to a job" and the ATS scan (A10-55, A10-56): `sendAnyway` is the learner's
 * second press after the crisis card, when the words belong on their CV (a helpline they
 * volunteered for). The body is optional: an empty one is no second press.
 */
export const SendBody = z.object({ sendAnyway: z.boolean().optional() }).strict();

export async function optionalBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const text = await request.text();
  let body: unknown = {};
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'invalid');
    }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'invalid');
  return parsed.data;
}

/**
 * "What goes on my CV" (§10.5): what was ticked and typed, what can be ticked (each with where it
 * came from), and the profile it makes now, with what's missing and what was left off (an
 * unverified name, an unconfirmed row). Names from the catalogue only when verified (hard rule 3).
 */
export async function selectionView(student: StudentStore, services: Services) {
  const now = new Date();
  const [selection, sources] = await Promise.all([
    student.cvSelection(),
    cvSources(student, services.catalogue(now), now),
  ]);
  return { selection, ...viewOf(selection, sources) };
}

function viewOf(selection: CvSelection, sources: Awaited<ReturnType<typeof cvSources>>) {
  const built = buildCvProfile(sources, selection);
  const verified = (name: { name: string; verified: boolean } | null) =>
    name?.verified ? name.name : null;
  return {
    available: {
      school: sources.schoolName
        ? { name: sources.schoolName, endYear: sources.schoolEndYear }
        : null,
      subjects: (sources.report?.marks ?? []).map((m) => ({
        id: m.subjectId,
        name: m.subjectName,
        percent: m.percent,
      })),
      offer: sources.acceptedOffer
        ? {
            university: verified(sources.acceptedOffer.institution),
            course: verified(sources.acceptedOffer.programme),
          }
        : null,
      modules: sources.registrations.flatMap((r) =>
        r.modules.map((m) => ({
          code: m.code,
          name: m.name ?? verified(m.catalogueName),
          year: r.academicYear,
        })),
      ),
      entries: sources.entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title })),
    },
    profile: built.profile,
    ready: built.ready,
    missing: built.missing,
    omitted: built.omitted,
  };
}

/** After a withdrawal or a deletion: the tombstones go to the engine (§7.3). */
export async function sendCvDeletions(services: Services): Promise<void> {
  if (!services.cv) return;
  try {
    await scheduleCvDeletions({ store: services.store, scheduler: services.cvScheduler });
  } catch (error) {
    // The server start schedules any left behind. The error's name only.
    console.error(`cv deletions: could not schedule (${(error as Error)?.name ?? 'Error'})`);
  }
}
