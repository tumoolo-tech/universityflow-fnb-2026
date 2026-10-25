import {
  changeDeadlinesFor,
  compareRegistration,
  type RegisteredModule,
  type RegistrationComparison,
  type RegistrationDifference,
} from '@universityflow/admissions';
import {
  type CatalogueView,
  type CurriculumModule,
  curriculumFor,
  facultyOfficeFor,
  isDraft,
  MODULE_TERMS,
  type ModuleTerm,
  normaliseModuleCode,
  type OfferedTerm,
  registrationCalendarFor,
  type UniversityId,
} from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import type { ModuleDifference, MyModulesArtifact } from '@universityflow/ui';

/**
 * My modules (Phase 5c), built from tested code only (hard rule 2): the agent's
 * `compare_registration` tool, the web page and the app's API all use this, so the chat and the
 * screens can't disagree.
 *
 * Every difference is `compareRegistration`'s; who to see is the faculty office record; the last
 * day to change is the registration calendar's; the explanations and the suggested message are
 * packages/content's words with the module codes and the programme filled in here, never by the
 * AI. No verdict without a curriculum record (planning.md §11, definition of done).
 */

/** A registration as the learner confirmed it (packages/db `RegistrationRecord`, the parts used). */
export interface AgentRegistration {
  readonly id: string;
  readonly universityId: string;
  readonly programmeId: string;
  readonly academicYear: number;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<{
    readonly code: string;
    readonly name: string | null;
    readonly term: string | null;
    readonly credits: number | null;
  }>;
  readonly confirmedAt: Date;
  readonly reminder: { readonly status: string; readonly desiredAt: Date } | null;
}

const m = en.modules;

const asTerm = (term: string | null): ModuleTerm | null =>
  term !== null && (MODULE_TERMS as ReadonlyArray<string>).includes(term)
    ? (term as ModuleTerm)
    : null;

/** "TEST101 (Synthetic module)", or the code alone when there is no name. */
export function moduleLabel(code: string, name: string | null | undefined): string {
  return name ? `${code} (${name})` : code;
}

/** When a curriculum module runs, in words; "term not printed" when the rule book gives none. */
const termWords = (term: OfferedTerm | undefined): string =>
  term ? m.terms[term] : m.termNotPrinted;

/** A group's alternative sets of codes in content's words: "A and B, or C" (A13-05). */
const setsInWords = (sets: ReadonlyArray<ReadonlyArray<string>>): string =>
  sets.map((set) => set.join(m.setJoin.and)).join(m.setJoin.or);

/** Every code a curriculum module may be registered under, compared after normalising. */
const codesOf = (c: CurriculumModule): string[] =>
  [c.code, ...(c.alternativeCodes ?? [])].map(normaliseModuleCode);

/** The plain explanation of one difference: content's wording for its kind, filled by code. */
export function explainDifference(d: RegistrationDifference): string {
  switch (d.kind) {
    case 'missing-compulsory':
      return m.differences['missing-compulsory'](moduleLabel(d.module.code, d.module.name));
    case 'wrong-semester':
      return m.differences['wrong-semester'](
        moduleLabel(d.module.code, d.module.name),
        m.terms[d.registered.semester],
        termWords(d.module.semester),
      );
    case 'not-in-curriculum':
      return m.differences['not-in-curriculum'](d.registered.code);
    case 'registered-twice':
      return m.differences['registered-twice'](d.code, d.registered.length);
    case 'elective-group-unsatisfied':
      if ('oneSetOf' in d.short) {
        return m.differences['elective-group-set'](d.group.label, setsInWords(d.short.oneSetOf));
      }
      return 'credits' in d.short
        ? m.differences['elective-group-credits'](d.group.label, d.short.credits)
        : m.differences['elective-group-count'](d.group.label, d.short.count);
    case 'credits-short':
      return m.differences['credits-short'](d.registered, d.min);
    case 'credits-over':
      return m.differences['credits-over'](d.registered, d.max);
  }
}

/** One line of the suggested message, in the learner's own voice. */
function messageLine(d: RegistrationDifference): string {
  const lines = m.message.lines;
  switch (d.kind) {
    case 'missing-compulsory':
      return lines['missing-compulsory'](moduleLabel(d.module.code, d.module.name));
    case 'wrong-semester':
      return lines['wrong-semester'](
        moduleLabel(d.module.code, d.module.name),
        m.terms[d.registered.semester],
        termWords(d.module.semester),
      );
    case 'not-in-curriculum':
      return lines['not-in-curriculum'](moduleLabel(d.registered.code, d.registered.name));
    case 'registered-twice':
      return lines['registered-twice'](d.code);
    case 'elective-group-unsatisfied':
      if ('oneSetOf' in d.short)
        return lines['elective-group-set'](d.group.label, setsInWords(d.short.oneSetOf));
      return 'credits' in d.short
        ? lines['elective-group-credits'](d.group.label, d.short.credits)
        : lines['elective-group-count'](d.group.label, d.short.count);
    case 'credits-short':
      return lines['credits-short'](d.registered, d.min);
    case 'credits-over':
      return lines['credits-over'](d.registered, d.max);
  }
}

/**
 * The message the learner can send the faculty office: content's template, filled by code with
 * the programme, the university, the year and one line per difference. Null with nothing to fix.
 * It never holds the student number or the learner's name: the learner adds those (we keep
 * neither).
 */
export function suggestedMessage(
  programme: { readonly name: string; readonly universityName: string },
  academicYear: number,
  differences: ReadonlyArray<RegistrationDifference>,
): string | null {
  if (differences.length === 0) return null;
  return [
    m.message.greeting,
    '',
    m.message.intro(programme.name, programme.universityName, academicYear),
    ...differences.map((d) => `- ${messageLine(d)}`),
    '',
    m.message.ask,
    '',
    m.message.thanks,
  ].join('\n');
}

/** The learner's confirmed modules as the comparison takes them (hard rule 6: confirmed only). */
export function registeredModules(registration: AgentRegistration): RegisteredModule[] {
  return registration.modules.map((r) => {
    const term = asTerm(r.term);
    return {
      code: r.code,
      ...(r.name ? { name: r.name } : {}),
      ...(term ? { semester: term } : {}),
      ...(r.credits !== null ? { credits: r.credits } : {}),
    };
  });
}

/** The My modules artifact for a confirmed registration, as of `now`. */
export function myModules(
  view: CatalogueView,
  registration: AgentRegistration,
  now: Date,
): MyModulesArtifact {
  const programme = view.programmes.find((p) => p.id === registration.programmeId) ?? null;
  const university = view.universities.find((u) => u.id === registration.universityId);
  const universityName = university?.shortName ?? registration.universityId.toUpperCase();
  // The rule book for the registration's own year, never another year's (A1-26): without one,
  // no verdict (`no-curriculum`), the same rule as the change deadlines below.
  const curriculum = programme
    ? curriculumFor(view, programme.id, registration.academicYear)
    : undefined;
  const status: MyModulesArtifact['status'] = !programme
    ? 'no-programme'
    : registration.yearOfStudy !== null && registration.yearOfStudy > 1
      ? 'not-first-year'
      : curriculum
        ? 'checked'
        : 'no-curriculum';
  const comparison: RegistrationComparison | null =
    status === 'checked' && curriculum
      ? compareRegistration(registeredModules(registration), curriculum)
      : null;

  const listed = new Set(curriculum?.modules.flatMap(codesOf) ?? []);
  // Modules counted against the curriculum's open elective credits (A1-27): allowed, not listed.
  const open = new Set((comparison?.openElectives ?? []).map((r) => normaliseModuleCode(r.code)));
  const taken = new Set(registration.modules.map((r) => normaliseModuleCode(r.code)));
  const office = programme ? facultyOfficeFor(view, programme) : undefined;
  // A university id the view doesn't hold finds no calendar.
  const calendar = registrationCalendarFor(
    view,
    registration.universityId as UniversityId,
    registration.academicYear,
  );
  const deadlines = changeDeadlinesFor(
    comparison ?? { differences: [] },
    calendar,
    registration.academicYear,
    now,
  );
  const differences: ModuleDifference[] = (comparison?.differences ?? []).map((difference) => ({
    difference,
    text: explainDifference(difference),
  }));
  const calendarShown = deadlines.status === 'published' && calendar !== undefined;
  const drafts = [
    programme ? isDraft(programme) : false,
    curriculum && comparison ? isDraft(curriculum) : false,
    office ? isDraft(office) : false,
    calendarShown ? isDraft(calendar) : false,
  ];

  return {
    kind: 'my-modules',
    registrationId: registration.id,
    academicYear: registration.academicYear,
    yearOfStudy: registration.yearOfStudy,
    confirmedAt: registration.confirmedAt.toISOString(),
    programme: programme
      ? {
          id: programme.id,
          name: programme.name,
          faculty: programme.faculty,
          universityId: programme.universityId,
          universityName,
          sourceUrl: programme.sourceUrl,
          academicYear: programme.academicYear,
          draft: isDraft(programme),
        }
      : null,
    status,
    curriculum:
      curriculum && comparison
        ? {
            academicYear: curriculum.academicYear,
            sourceUrl: curriculum.sourceUrl,
            draft: isDraft(curriculum),
          }
        : null,
    registered: registration.modules.map((r) => {
      const code = normaliseModuleCode(r.code);
      const openElective = comparison !== null && !listed.has(code) && open.has(code);
      return {
        code: r.code,
        name: r.name,
        term: asTerm(r.term),
        credits: r.credits,
        inCurriculum: comparison ? listed.has(code) || openElective : null,
        ...(openElective ? { openElective: true as const } : {}),
      };
    }),
    expected:
      curriculum && comparison
        ? curriculum.modules.map((c) => ({
            code: c.code,
            ...(c.alternativeCodes ? { alternativeCodes: [...c.alternativeCodes] } : {}),
            name: c.name,
            ...(c.semester ? { semester: c.semester } : {}),
            credits: c.credits,
            compulsory: c.compulsory,
            registered: codesOf(c).some((code) => taken.has(code)),
          }))
        : [],
    differences,
    credits: comparison?.credits ?? null,
    office: office
      ? {
          faculty: office.faculty,
          where: office.where,
          contactUrl: office.contactUrl,
          email: office.email ?? null,
          phone: office.phone ?? null,
          hours: office.hours ?? null,
          sourceUrl: office.sourceUrl,
          draft: isDraft(office),
        }
      : null,
    deadlines: {
      ...deadlines,
      sourceUrl: calendarShown ? calendar.sourceUrl : null,
      draft: calendarShown ? isDraft(calendar) : false,
    },
    reminderAt:
      registration.reminder?.status === 'scheduled'
        ? registration.reminder.desiredAt.toISOString()
        : null,
    message:
      programme && comparison
        ? suggestedMessage(
            { name: programme.name, universityName: university?.name ?? universityName },
            registration.academicYear,
            comparison.differences,
          )
        : null,
    includesDrafts: drafts.some(Boolean),
  };
}
