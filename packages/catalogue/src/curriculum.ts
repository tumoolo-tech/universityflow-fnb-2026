import { z } from 'zod';
import { normaliseModuleCode, OFFERED_TERMS } from './basics';
import { sourced } from './provenance';

/**
 * A programme's published first-year curriculum (planning.md §11, Phase 5c): the modules a
 * first-year registers for, which are compulsory, the elective groups ("choose 36 credits from"),
 * the semesters, and the credit totals, all as the faculty rule book prints them.
 *
 * `packages/admissions` compares a learner's confirmed registration with this record
 * (`compareRegistration`): code decides what is missing or wrong, the AI only explains it (hard
 * rule 2). A programme with no curriculum record gets no registration check, and says so.
 *
 * `academicYear` is the year the rule book is for. Research drafts from the current rule book and
 * labels it with that year; a newer book is a new record, not an edit. A registration is checked
 * only against the record for its own year (`curriculumFor`), never an older or newer book.
 *
 * Pure data only: the mobile app imports this (hard rule 11).
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
/** A module code as printed, e.g. "COMS1018A" or "WTW 114". Compared after `normaliseModuleCode`. */
const moduleCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/, 'a module code as printed');

export const curriculumModuleSchema = z.object({
  code: moduleCode,
  /** The module's name as printed. */
  name: z.string().trim().min(2),
  /**
   * When it runs: S1, S2, Y (year-long), Q1–Q4, or `either` semester. Left out when the rule book
   * prints no term; never filled with a guess (the registration check then says nothing about it).
   */
  semester: z.enum(OFFERED_TERMS).optional(),
  /** The credits the rule book gives it (some compulsory modules carry none). */
  credits: z.number().min(0).max(240),
  /** Every first-year takes it. A non-compulsory module is an elective, listed in a group. */
  compulsory: z.boolean(),
  /**
   * The same module under another printed code. UCT prints "ECO1010F/S" for a course offered in
   * either semester, and the suffix is part of the code a registration shows: recorded as code
   * "ECO1010F" with alternative "ECO1010S" (semester `either`). A registration matches either code.
   */
  alternativeCodes: z.array(moduleCode).min(1).optional(),
});
export type CurriculumModule = z.infer<typeof curriculumModuleSchema>;

/**
 * "Choose 36 credits from …", "choose two of …", or "either a) these or b) those". The modules are
 * listed by code and must be electives in this curriculum. Groups don't share modules, so a module
 * counts towards one group.
 */
export const electiveGroupSchema = z.object({
  /** The group's heading as printed, e.g. "Choose one of the following". */
  label: z.string().trim().min(3),
  /**
   * At least this many credits, or at least this many modules, from the group; or `oneSetOf`:
   * every module of exactly one set and none of the others, for a rule book that prints
   * "ECON1012A and ECON1014A or ECON1016A and ECON1018A" (A13-05). Each set's codes are among
   * `from`, and `from` lists every set's modules.
   */
  choose: z.union([
    z.strictObject({ credits: z.number().positive() }),
    z.strictObject({ count: z.int().positive() }),
    z.strictObject({ oneSetOf: z.array(z.array(moduleCode).min(1)).min(2) }),
  ]),
  from: z.array(moduleCode).min(1),
});
export type ElectiveGroup = z.infer<typeof electiveGroupSchema>;

/** Whether a group asks for credits (rather than a number of modules or one set). */
export function choosesCredits(
  group: Pick<ElectiveGroup, 'choose'>,
): group is ElectiveGroup & { choose: { credits: number } } {
  return 'credits' in group.choose;
}

/**
 * Credits a first-year may take from modules no list can hold, as the rule book says: "courses
 * from any other Faculty in the University to the value of 36 LLB credits" (Wits LLB), or "any
 * Level 1 elective" (UKZN BSc CS&IT) (A1-27). A registered module the curriculum doesn't list
 * counts against these credits before it is called "not in the curriculum".
 */
export const openElectiveCreditsSchema = z.strictObject({
  /** The most credits open electives may fill, as printed (or the sum of the printed slots). */
  credits: z.number().positive().max(240),
  /** What the rule book says about the allowance, its words quoted, for the verifier. */
  note: z.string().trim().min(3),
});
export type OpenElectiveCredits = z.infer<typeof openElectiveCreditsSchema>;

export const curriculumSchema = sourced({
  /** The programme it is for: a catalogue `Programme.id` (a test holds every one to one). */
  programmeId: slug,
  /** The programme code as printed on registration documents, when the rule book gives it. */
  programmeCode: z.string().trim().min(2).optional(),
  /** Only the first year is recorded for now. */
  yearOfStudy: z.literal(1),
  modules: z.array(curriculumModuleSchema).min(1),
  electiveGroups: z.array(electiveGroupSchema),
  /** Free-choice credits outside the listed modules, when the rule book allows them. */
  openElectiveCredits: openElectiveCreditsSchema.optional(),
  /** The year's credit total as published: a range, or the same number twice. */
  totalCredits: z.object({ min: z.number().min(0), max: z.number().min(0) }),
  /** Something research could not settle, shown to the verifier. */
  note: z.string().min(3).optional(),
}).superRefine((c, ctx) => {
  for (const message of curriculumProblems(c)) ctx.addIssue({ code: 'custom', message });
});
export type Curriculum = z.infer<typeof curriculumSchema>;

type CurriculumShape = Pick<Curriculum, 'modules' | 'electiveGroups' | 'totalCredits'> &
  Partial<Pick<Curriculum, 'openElectiveCredits'>>;

const sum = (values: ReadonlyArray<number>) => values.reduce((a, b) => a + b, 0);

/**
 * What doesn't add up in a curriculum, as messages for the researcher (empty when it is
 * consistent): duplicate codes, groups naming modules that aren't electives here, groups that
 * can't be satisfied, and totals no registration could meet.
 */
export function curriculumProblems(c: CurriculumShape): string[] {
  const problems: string[] = [];
  // Every printed code, alternatives included, to its module: no code may name two modules.
  const byCode = new Map<string, CurriculumModule>();
  for (const m of c.modules) {
    for (const printed of [m.code, ...(m.alternativeCodes ?? [])]) {
      const code = normaliseModuleCode(printed);
      if (byCode.has(code)) problems.push(`Module ${printed} is listed twice`);
      byCode.set(code, m);
    }
  }
  const grouped = new Set<string>();
  let groupMinimum = 0;
  for (const g of c.electiveGroups) {
    groupMinimum += groupProblems(g, byCode, grouped, problems);
  }
  problems.push(...totalProblems(c, groupMinimum));
  return problems;
}

/** Checks one elective group, adding to `problems`. Returns the fewest credits it can be met with. */
function groupProblems(
  g: ElectiveGroup,
  byCode: ReadonlyMap<string, CurriculumModule>,
  grouped: Set<string>,
  problems: string[],
): number {
  // A group may name a module by any of its codes; each module is keyed by its primary code.
  const codes = g.from.map((printed) => {
    const code = normaliseModuleCode(printed);
    const m = byCode.get(code);
    return m ? normaliseModuleCode(m.code) : code;
  });
  if (new Set(codes).size !== codes.length) problems.push(`“${g.label}” names a module twice`);
  const members: CurriculumModule[] = [];
  for (const [i, code] of codes.entries()) {
    const m = byCode.get(code);
    if (!m) problems.push(`“${g.label}” names ${g.from[i]}, which isn’t in the modules`);
    else if (m.compulsory) problems.push(`“${g.label}” names ${m.code}, which is compulsory`);
    else members.push(m);
    if (grouped.has(code)) problems.push(`${g.from[i]} is in more than one elective group`);
    grouped.add(code);
  }
  const { choose } = g;
  if ('oneSetOf' in choose) return setProblems(g, choose.oneSetOf, codes, byCode, problems);
  if ('credits' in choose) {
    if (sum(members.map((m) => m.credits)) < choose.credits) {
      problems.push(`“${g.label}” can’t reach ${choose.credits} credits`);
    }
    return choose.credits;
  }
  if (members.length < choose.count) {
    problems.push(`“${g.label}” has fewer than ${choose.count} modules`);
  }
  const cheapest = members.map((m) => m.credits).sort((a, b) => a - b);
  return sum(cheapest.slice(0, choose.count));
}

/**
 * Checks a group's alternative sets against its modules (`codes`, each a primary code): every
 * module in exactly one set, every set's codes among the group's. Returns the cheapest set's
 * credits, the least the group can be met with.
 */
function setProblems(
  g: ElectiveGroup,
  sets: ReadonlyArray<ReadonlyArray<string>>,
  codes: ReadonlyArray<string>,
  byCode: ReadonlyMap<string, CurriculumModule>,
  problems: string[],
): number {
  const primary = (printed: string) => {
    const code = normaliseModuleCode(printed);
    const m = byCode.get(code);
    return m ? normaliseModuleCode(m.code) : code;
  };
  const inGroup = new Set(codes);
  const seen = new Set<string>();
  const totals = sets.map((set) => {
    let credits = 0;
    for (const printed of set) {
      const code = primary(printed);
      if (!inGroup.has(code))
        problems.push(`“${g.label}” has ${printed} in a set but not in its modules`);
      else if (seen.has(code)) problems.push(`“${g.label}” has ${printed} in more than one set`);
      seen.add(code);
      credits += byCode.get(code)?.credits ?? 0;
    }
    return credits;
  });
  for (const [i, code] of codes.entries()) {
    if (!seen.has(code))
      problems.push(`“${g.label}” lists ${g.from[i]}, which is in none of its sets`);
  }
  return Math.min(...totals);
}

/** Whether a registration that follows the rules could land inside the published total. */
function totalProblems(c: CurriculumShape, groupMinimum: number): string[] {
  const problems: string[] = [];
  const { min, max } = c.totalCredits;
  if (min > max) problems.push('The credit total’s minimum is above its maximum');
  const least = sum(c.modules.filter((m) => m.compulsory).map((m) => m.credits)) + groupMinimum;
  if (least > max) {
    problems.push(
      `The compulsory modules and the least the elective groups ask for come to ${least} credits, above the published maximum of ${max}`,
    );
  }
  // Open electives (A1-27) are credits a registration can add beyond the listed modules.
  const listed = sum(c.modules.map((m) => m.credits));
  const everything = listed + (c.openElectiveCredits?.credits ?? 0);
  if (everything < min) {
    problems.push(
      c.openElectiveCredits
        ? `Every module listed and the open electives come to ${everything} credits, below the published minimum of ${min}`
        : `Every module listed comes to ${everything} credits, below the published minimum of ${min}`,
    );
  }
  return problems;
}
