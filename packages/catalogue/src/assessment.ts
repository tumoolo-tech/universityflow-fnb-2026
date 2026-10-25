import { z } from 'zod';
import { normaliseModuleCode } from './basics';
import { dateRangeSchema } from './campus';
import type { CatalogueView } from './catalogue';
import { sourced } from './provenance';
import { isUniversitySource, type Programme, type UniversityId, universityId } from './records';

/**
 * How marks work (planning.md §3 Stage 6; docs/plans/phase-6-proposal.md, "The rule model"):
 * the rules at the university and faculty levels (`assessmentRules`), a module's scheme where the
 * university itself prints one (`moduleAssessment`), and the exam and supplementary dates
 * (`academicCalendar`).
 *
 * No level prints every rule, so **every field is optional** (gotcha 40): a rule the source
 * doesn't print is left out, never filled with a "usual" 50% or 40%, and the learner is told it
 * isn't published. Every number carries the words it is printed in (`quote`) and where (`page`),
 * so a person can verify it quickly. `packages/admissions` resolves the levels and does the maths
 * (code decides, hard rule 2); nothing here computes a mark.
 *
 * Every record is a draft until a person verifies it (hard rule 3), and is sourced from the
 * university's own domain. Pure data and pure functions only: the app imports this (hard rule 11).
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const isoDate = z.iso.date();
const percent = z.number().min(0).max(100);
/** Words as the source prints them. */
const words = z.string().trim().min(3);
/** Where it is printed: a page or a rule number, e.g. "p. 31" or "Rule G13.5". */
const page = z.string().trim().min(1);
/** A module code as printed, e.g. "ECO1010F" or "SOWK 112". Compared after `normaliseModuleCode`. */
const moduleCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/, 'a module code as printed');

/** A rule as printed, for a person to read; code never judges it. */
export const quotedSchema = z.strictObject({ quote: words, page: page.optional() });
export type Quoted = z.infer<typeof quotedSchema>;

/** A printed percentage, with its words. */
export const printedPercentSchema = z.strictObject({
  value: percent,
  quote: words,
  page: page.optional(),
});
export type PrintedPercent = z.infer<typeof printedPercentSchema>;

/**
 * Admission to the exam: UCT's and UKZN's "DP" (duly performed), TUT's "predicate mark", Wits'
 * "eligibility for assessment". Code judges only `minimumYearMark`; the `conditions` (attendance,
 * submissions) are the learner's own checklist, never judged by code or AI.
 */
export const examAdmissionSchema = z.strictObject({
  /** The university's own word for it, e.g. "DP" or "predicate mark". */
  term: z.string().trim().min(2).optional(),
  /** The least year (class) mark that admits to the exam, only when printed as a number. */
  minimumYearMark: percent.optional(),
  /** Each condition quoted: "80% attendance at practicals". */
  conditions: z.array(words).min(1).optional(),
  quote: words,
  page: page.optional(),
});
export type ExamAdmission = z.infer<typeof examAdmissionSchema>;

/**
 * What a supplementary's result is, as printed: capped at a mark; it replaces the exam mark (the
 * year mark kept); it stands alone; or it is recorded only as a pass or a fail (Wits, UCT's
 * "unclassified pass").
 */
export const SUPPLEMENTARY_RESULTS = [
  'capped-at',
  'replaces-exam',
  'stands-alone',
  'recorded-pass-or-fail',
] as const;
export type SupplementaryResultKind = (typeof SUPPLEMENTARY_RESULTS)[number];

export const supplementaryResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('capped-at'), cap: percent }),
  z.strictObject({ kind: z.literal('replaces-exam') }),
  z.strictObject({ kind: z.literal('stands-alone') }),
  z.strictObject({ kind: z.literal('recorded-pass-or-fail') }),
]);
export type SupplementaryResult = z.infer<typeof supplementaryResultSchema>;

/** A final-mark range; `to` left out when the source prints only "at least N" (up to a fail). */
export const markRangeSchema = z
  .strictObject({ from: percent, to: percent.optional() })
  .refine((r) => r.to === undefined || r.from <= r.to, {
    message: 'A mark range starts at or below where it ends',
  });
export type MarkRange = z.infer<typeof markRangeSchema>;

export const supplementarySchema = z
  .strictObject({
    /**
     * `false` when the source says supplementaries are not (normally) offered: UCT Humanities'
     * "will not normally award", Wits Science. Left out when it is simply silent.
     */
    offered: z.boolean().optional(),
    /** The final marks that may lead to one, as printed (e.g. "45–49%", or "at least 40%"). */
    eligibleFinalMark: markRangeSchema.optional(),
    /** Other ways in, quoted: "passed but failed the subminimum". */
    alsoWhen: z.array(words).min(1).optional(),
    result: supplementaryResultSchema.optional(),
    /** When there is none, quoted: "continuously assessed modules". */
    notWhen: z.array(words).min(1).optional(),
    quote: words,
    page: page.optional(),
  })
  .refine(
    (s) => s.offered !== false || (s.eligibleFinalMark === undefined && s.result === undefined),
    {
      message: 'A supplementary that isn’t offered has no range and no result',
    },
  );
export type SupplementaryRule = z.infer<typeof supplementarySchema>;

/** How a final mark is rounded to a whole percent, only when a source prints it (D13). */
export const ROUNDING_METHODS = ['half-up', 'down', 'up'] as const;
export type RoundingMethod = (typeof ROUNDING_METHODS)[number];
export const roundingSchema = z.strictObject({
  method: z.enum(ROUNDING_METHODS),
  quote: words,
  page: page.optional(),
});
export type Rounding = z.infer<typeof roundingSchema>;

/**
 * A subminimum on components (Wits G7.10: "35 percent in each of the components … Such a
 * sub-minimum criterion applies only to components which contribute 25 percent or more").
 */
export const componentSubminimumSchema = z.strictObject({
  value: percent,
  /** Only components worth at least this share of the final mark, when printed. */
  fromWeight: percent.optional(),
  quote: words,
  page: page.optional(),
});
export type ComponentSubminimum = z.infer<typeof componentSubminimumSchema>;

const onOwnSite = (r: { universityId: UniversityId; sourceUrl: string }) =>
  isUniversitySource(r.universityId, r.sourceUrl);
const OWN_SITE = { message: 'A record cites a page on its university’s own domain' };

export const assessmentRulesSchema = sourced({
  /** Starts with the university id, e.g. `uct-general-rules` or `uct-commerce-rules`. */
  id: slug,
  universityId,
  /**
   * The faculty, spelled as the catalogue's programmes spell it (`Programme.faculty`). Left out
   * for the rules of the whole university.
   */
  faculty: z.string().trim().min(3).optional(),
  /** The document's title as printed, e.g. "2026 Handbook 3, General Rules and Policies". */
  title: words,
  passMark: printedPercentSchema.optional(),
  examAdmission: examAdmissionSchema.optional(),
  examSubminimum: printedPercentSchema.optional(),
  componentSubminimum: componentSubminimumSchema.optional(),
  supplementary: supplementarySchema.optional(),
  /** Deferred ("special", "aegrotat") exams: quoted for the learner, never judged. */
  deferredExam: quotedSchema.optional(),
  rounding: roundingSchema.optional(),
  /** A module passed "with distinction", only when a percentage is printed. */
  distinction: printedPercentSchema.optional(),
  /** Other rules a learner should read, quoted (e.g. "no supplementary on a supplementary"). */
  otherRules: z.array(quotedSchema).min(1).optional(),
  /**
   * What research could not read, and why ("the site refuses automated access: a person in a
   * browser"). The verifier fills it; the card says the rules aren't published here yet.
   */
  unread: words.optional(),
  /** Something research could not settle, shown to the verifier. */
  note: words.optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .refine((r) => r.id.startsWith(`${r.universityId}-`), {
    message: 'An assessment-rules id starts with its university id',
  })
  .refine(
    (r) =>
      r.unread !== undefined ||
      [
        r.passMark,
        r.examAdmission,
        r.examSubminimum,
        r.componentSubminimum,
        r.supplementary,
        r.deferredExam,
        r.rounding,
        r.distinction,
        r.otherRules,
      ].some((f) => f !== undefined),
    { message: 'A record holds at least one rule, or says what could not be read' },
  );
export type AssessmentRules = z.infer<typeof assessmentRulesSchema>;

/** What an assessment component is. */
export const ASSESSMENT_KINDS = [
  'test',
  'assignment',
  'practical',
  'tutorial',
  'exam',
  'project',
  'other',
] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

/**
 * One assessment component, weighted as a share of the **final** mark as printed. A component
 * counted as the best of several attempts ("best 2 of 3 tests") says so in `bestOf`.
 */
export const assessmentComponentSchema = z.strictObject({
  name: z.string().trim().min(2),
  kind: z.enum(ASSESSMENT_KINDS),
  weight: z.number().gt(0).max(100),
  subminimum: percent.optional(),
  bestOf: z.strictObject({ count: z.int().positive(), of: z.int().positive() }).optional(),
});
export type AssessmentComponent = z.infer<typeof assessmentComponentSchema>;

/** The weighting part of a scheme: the same shape for a published scheme and a learner's outline. */
export interface Weighting {
  readonly components?: ReadonlyArray<AssessmentComponent> | undefined;
  readonly yearMarkWeight?: number | undefined;
  readonly examWeight?: number | undefined;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const total = (cs: ReadonlyArray<AssessmentComponent>) => cs.reduce((s, c) => s + c.weight, 0);

/**
 * What doesn't add up in a weighting (empty when it is consistent): components that don't sum to
 * 100, a year/exam split that doesn't sum to 100 or doesn't match the components, an exam weight
 * with no exam component, a best-of that can't be met, two components with one name. A weighting
 * that doesn't add up is **refused, never rescaled**: a rescaled weight is a weight nobody printed.
 */
export function weightingProblems(w: Weighting): string[] {
  const problems: string[] = [];
  const { components, yearMarkWeight, examWeight } = w;
  if ((yearMarkWeight === undefined) !== (examWeight === undefined)) {
    problems.push('A year-mark weight comes with an exam weight, and the other way round');
  }
  if (yearMarkWeight !== undefined && examWeight !== undefined) {
    if (!near(yearMarkWeight + examWeight, 100)) {
      problems.push(`The year mark and the exam weigh ${yearMarkWeight + examWeight}%, not 100%`);
    }
  }
  if (components === undefined) return problems;
  if (components.length === 0) problems.push('A scheme with components lists at least one');
  if (!near(total(components), 100)) {
    problems.push(`The components weigh ${Number(total(components).toFixed(4))}%, not 100%`);
  }
  const names = new Set<string>();
  for (const c of components) {
    const key = c.name.trim().toLowerCase();
    if (names.has(key)) problems.push(`Two components are called “${c.name}”`);
    names.add(key);
    if (c.bestOf && c.bestOf.count > c.bestOf.of) {
      problems.push(`“${c.name}” counts the best ${c.bestOf.count} of only ${c.bestOf.of}`);
    }
  }
  if (examWeight !== undefined) {
    const exams = components.filter((c) => c.kind === 'exam');
    if (exams.length === 0) problems.push('An exam weight is printed but no exam component');
    else if (!near(total(exams), examWeight)) {
      problems.push(
        `The exam components weigh ${total(exams)}%, but the exam weight is ${examWeight}%`,
      );
    }
  }
  return problems;
}

export const moduleAssessmentSchema = sourced({
  universityId,
  code: moduleCode,
  /** The same module under another printed code (UCT's "F/S" pairs), as curricula record it. */
  alternativeCodes: z.array(moduleCode).min(1).optional(),
  name: z.string().trim().min(2).optional(),
  /**
   * The faculty whose handbook prints this entry, as `Programme.faculty` spells it, only when two
   * handbooks print the same module differently (UKZN's colleges print MATH130 with a 40% and a
   * 35% DP). A lookup then takes the learner's own faculty's entry, and none when it can't tell.
   */
  faculty: z.string().trim().min(3).optional(),
  page: page.optional(),
  components: z.array(assessmentComponentSchema).min(1).optional(),
  yearMarkWeight: percent.optional(),
  examWeight: percent.optional(),
  /** The module's own exam-admission (DP) rule. */
  dpRequirement: examAdmissionSchema.optional(),
  examSubminimum: percent.optional(),
  /** A module's own pass mark, when its entry prints one. */
  passMark: percent.optional(),
  /** The exam papers as printed, e.g. "one 3-hour paper". */
  examPapers: words.optional(),
  /** Rules in the entry that code can't apply (a combined subminimum, an exemption), quoted. */
  otherRules: z.array(words).min(1).optional(),
  /** The whole printed assessment and DP text, verbatim. */
  quote: words,
  note: words.optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .superRefine((m, ctx) => {
    for (const message of weightingProblems(m)) ctx.addIssue({ code: 'custom', message });
  });
export type ModuleAssessment = z.infer<typeof moduleAssessmentSchema>;

const datedLabel = z.strictObject({ label: words, date: isoDate });
const labelledRange = z.strictObject({ label: words, dates: dateRangeSchema });

/**
 * A university's exam and supplementary dates for one academic year (the registration calendar,
 * `registrationCalendar`, holds registration). Every field optional: a calendar that prints no
 * supplementary registration has none, and the learner is told it isn't published.
 */
export const academicCalendarSchema = sourced({
  universityId,
  /** The document's title as printed, when it has one. */
  title: words.optional(),
  semesters: z
    .array(z.strictObject({ term: z.enum(['S1', 'S2']), dates: dateRangeSchema }))
    .min(1)
    .optional(),
  /** Main exam periods, labelled as printed ("June examinations"). */
  examPeriods: z.array(labelledRange).min(1).optional(),
  /** Supplementary exam periods; a second semester's may fall in the next January or February. */
  supplementaryExams: z.array(labelledRange).min(1).optional(),
  /** The last day to register or apply for a supplementary, where the university requires it. */
  supplementaryRegistration: z.array(datedLabel).min(1).optional(),
  /** When the DP (exam admission) lists are published. */
  dpLists: z.array(datedLabel).min(1).optional(),
  unread: words.optional(),
  note: words.optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .refine(
    (c) =>
      c.unread !== undefined ||
      [
        c.semesters,
        c.examPeriods,
        c.supplementaryExams,
        c.supplementaryRegistration,
        c.dpLists,
      ].some((f) => f !== undefined),
    { message: 'A calendar holds at least one date, or says what could not be read' },
  )
  .refine((c) => calendarDatesProblems(c).length === 0, {
    message:
      'Dates fall in the academic year (supplementaries and their registration also in the next January or February)',
  });
export type AcademicCalendar = z.infer<typeof academicCalendarSchema>;

function calendarDatesProblems(c: {
  academicYear: number;
  semesters?: ReadonlyArray<{ dates: { from: string; to: string } }> | undefined;
  examPeriods?: ReadonlyArray<{ dates: { from: string; to: string } }> | undefined;
  supplementaryExams?: ReadonlyArray<{ dates: { from: string; to: string } }> | undefined;
  supplementaryRegistration?: ReadonlyArray<{ date: string }> | undefined;
  dpLists?: ReadonlyArray<{ date: string }> | undefined;
}): string[] {
  const inYear = (d: string) => Number(d.slice(0, 4)) === c.academicYear;
  const orEarlyNext = (d: string) =>
    inYear(d) || (Number(d.slice(0, 4)) === c.academicYear + 1 && d.slice(5, 7) <= '02');
  const ranges = (xs?: ReadonlyArray<{ dates: { from: string; to: string } }>) =>
    (xs ?? []).flatMap((x) => [x.dates.from, x.dates.to]);
  const strict = [
    ...ranges(c.semesters),
    ...ranges(c.examPeriods),
    ...(c.dpLists ?? []).map((d) => d.date),
  ];
  const lenient = [
    ...ranges(c.supplementaryExams),
    ...(c.supplementaryRegistration ?? []).map((d) => d.date),
  ];
  return [...strict.filter((d) => !inYear(d)), ...lenient.filter((d) => !orEarlyNext(d))];
}

/** One university's Phase 6a records: what each data/<id>-assessment.ts exports. */
export interface UniversityAssessment {
  readonly rules: ReadonlyArray<AssessmentRules>;
  readonly modules: ReadonlyArray<ModuleAssessment>;
  readonly calendars: ReadonlyArray<AcademicCalendar>;
}

/**
 * The rules that apply to a programme's learners in one academic year: the university's and the
 * programme's faculty's, each for that year only (as `curriculumFor`). Either may be missing.
 */
export function assessmentRulesFor(
  view: Pick<CatalogueView, 'assessmentRules'>,
  programme: Pick<Programme, 'universityId' | 'faculty'>,
  academicYear: number,
): { university?: AssessmentRules; faculty?: AssessmentRules } {
  const ofYear = view.assessmentRules.filter(
    (r) => r.universityId === programme.universityId && r.academicYear === academicYear,
  );
  const university = ofYear.find((r) => r.faculty === undefined);
  const faculty = ofYear.find((r) => r.faculty === programme.faculty);
  return { ...(university ? { university } : {}), ...(faculty ? { faculty } : {}) };
}

/**
 * A module's published scheme for one academic year, by any of its printed codes. When handbooks
 * print the module differently (`faculty` on the records), the learner's own faculty's entry; when
 * none of them is the learner's faculty's, none at all (a guess between two schemes is a guess).
 */
export function moduleAssessmentFor(
  view: Pick<CatalogueView, 'moduleAssessments'>,
  id: UniversityId,
  code: string,
  academicYear: number,
  faculty?: string,
): ModuleAssessment | undefined {
  const wanted = normaliseModuleCode(code);
  const found = view.moduleAssessments.filter(
    (m) =>
      m.universityId === id &&
      m.academicYear === academicYear &&
      [m.code, ...(m.alternativeCodes ?? [])].some((c) => normaliseModuleCode(c) === wanted),
  );
  const ownFaculty = found.find((m) => faculty !== undefined && m.faculty === faculty);
  if (ownFaculty) return ownFaculty;
  const general = found.filter((m) => m.faculty === undefined);
  return general.length === 1 ? general[0] : undefined;
}

/** A university's exam and supplementary dates for one academic year, never another year's. */
export function academicCalendarFor(
  view: Pick<CatalogueView, 'academicCalendars'>,
  id: UniversityId,
  academicYear: number,
): AcademicCalendar | undefined {
  return view.academicCalendars.find(
    (c) => c.universityId === id && c.academicYear === academicYear,
  );
}
