import {
  type AssessmentComponent,
  type AssessmentRules,
  assessmentRulesFor,
  type CatalogueView,
  isDraft,
  isPublishable,
  type ModuleAssessment,
  moduleAssessmentFor,
  normaliseModuleCode,
  provenanceSchema,
  type RoundingMethod,
  type SupplementaryResult,
  type SupplementaryRule,
  type UniversityId,
  type Weighting,
  weightingProblems,
} from '@universityflow/catalogue';

/**
 * How marks work for one module (planning.md §3 Stage 6; docs/plans/phase-6-proposal.md, "The rule
 * model"): `resolveScheme` takes each rule from the most specific source that prints it, for the
 * learner's own academic year only:
 *
 *   the learner's confirmed module outline (Tier B) → the module's published scheme →
 *   the faculty's rules → the university's rules.
 *
 * Every resolved field carries where it came from (`FieldSource`). A field nobody prints is absent:
 * there is no default pass mark, subminimum, DP or cap anywhere in this code (gotcha 40, hard rule
 * 2). When the learner's outline and a published record disagree, the outline's value is used and
 * the published one is carried beside it as a `conflict` the card shows (D2): surfaced, never
 * settled silently.
 *
 * Pure, no I/O, React-Native-safe (hard rule 11): the app's calculator runs offline.
 */

/** Where a rule came from, most specific first. */
export const SCHEME_LEVELS = ['outline', 'module', 'faculty', 'university'] as const;
export type SchemeLevel = (typeof SCHEME_LEVELS)[number];

export interface FieldSource {
  readonly level: SchemeLevel;
  /** The academic year of the record or outline (always the learner's own). */
  readonly academicYear: number;
  /** The catalogue record's page (catalogue levels only). */
  readonly sourceUrl?: string;
  /** The record's id (rules) or module code (module scheme). */
  readonly recordId?: string;
  /** The words the value is printed in, when the record quotes them. */
  readonly quote?: string;
  readonly page?: string;
  /** The day the learner confirmed their outline (outline only), for "confirmed by you on …". */
  readonly confirmedOn?: string;
  /**
   * Not yet verified by a person: only ever present in preview, and labelled as unverified
   * wherever it is shown (A10-13, hard rule 3). Always false for the learner's own outline.
   */
  readonly draft: boolean;
}

export interface Resolved<T> {
  readonly value: T;
  readonly source: FieldSource;
  /** D2: a published record says something else. The outline's value is used; this is shown beside it. */
  readonly conflict?: { readonly value: T; readonly source: FieldSource };
}

/** Exam admission (DP, "predicate mark"): code judges only the number; the conditions are the learner's checklist. */
export interface ExamAdmissionRule {
  readonly term?: string;
  readonly minimumYearMark?: number;
  readonly conditions: ReadonlyArray<string>;
}

export interface ComponentSubminimumRule {
  readonly value: number;
  /** Only components worth at least this share of the final mark. */
  readonly fromWeight?: number;
}

/** The learner's confirmed outline's supplementary note, as they confirmed it. */
export interface OutlineSupplementary {
  readonly eligibleFinalMark?: { readonly from: number; readonly to?: number };
  readonly result?: SupplementaryResult;
  readonly quote?: string;
}

/**
 * The scheme a learner confirmed from their own module outline (Tier B, hard rule 6): the input
 * shape `packages/documents` (6b) maps a confirmed outline into, and `db` stores. Weights are shares
 * of the final mark, as printed; every field optional ("not in my outline" is a valid answer).
 * Nothing in it is ever used before the learner confirmed it.
 */
export interface ConfirmedOutlineScheme {
  readonly moduleCode: string;
  readonly academicYear: number;
  /** ISO date the learner confirmed it. */
  readonly confirmedOn: string;
  readonly components?: ReadonlyArray<AssessmentComponent>;
  readonly yearMarkWeight?: number;
  readonly examWeight?: number;
  readonly passMark?: number;
  readonly dpRequirement?: {
    readonly minimumYearMark?: number;
    readonly conditions?: ReadonlyArray<string>;
  };
  readonly examSubminimum?: number;
  readonly supplementary?: OutlineSupplementary;
  /** Other rules the outline prints, quoted. */
  readonly otherRules?: ReadonlyArray<string>;
}

/** A supplementary rule as resolved: the catalogue's, or the outline's (which has no quote rules). */
export type ResolvedSupplementary = Omit<SupplementaryRule, 'quote' | 'page'>;

export interface ResolvedScheme {
  readonly universityId: UniversityId;
  readonly moduleCode: string;
  readonly academicYear: number;
  readonly weighting?: Resolved<Weighting>;
  readonly passMark?: Resolved<number>;
  readonly examAdmission?: Resolved<ExamAdmissionRule>;
  readonly examSubminimum?: Resolved<number>;
  readonly componentSubminimum?: Resolved<ComponentSubminimumRule>;
  readonly supplementary?: Resolved<ResolvedSupplementary>;
  /** Deferred (special, aegrotat) exams, quoted. */
  readonly deferredExam?: Resolved<string>;
  /** The university's own printed rounding of a final mark (D13). */
  readonly rounding?: Resolved<RoundingMethod>;
  readonly distinction?: Resolved<number>;
  /** Rules from every level that code doesn't apply, quoted, for the card. */
  readonly otherRules: ReadonlyArray<{ readonly quote: string; readonly source: FieldSource }>;
  /** True when any field came from a draft record (preview only). */
  readonly includesDrafts: boolean;
}

export interface ResolveInput {
  /** The learner's registered module and their academic year. */
  readonly module: {
    readonly universityId: UniversityId;
    readonly code: string;
    readonly academicYear: number;
  };
  /** The learner's programme's faculty, as `Programme.faculty` spells it. */
  readonly faculty: string;
  /** The learner's confirmed outline for this module and year, when they have one. */
  readonly outline?: ConfirmedOutlineScheme;
  /** The catalogue's records: a `CatalogueView` (already gated) or the raw records. */
  readonly records: Pick<CatalogueView, 'assessmentRules' | 'moduleAssessments'>;
  readonly today: Date;
  /** Preview only: include records nobody has verified yet, flagged as drafts. */
  readonly includeDrafts: boolean;
}

export class InvalidSchemeError extends Error {
  override readonly name = 'InvalidSchemeError';
}

/** One level's offer for a field, before resolution. */
interface Offer<T> {
  readonly value: T | undefined;
  readonly source: FieldSource;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The most specific offer with a value; the outline's disagreements with the records carried. */
function resolve<T>(offers: ReadonlyArray<Offer<T>>): Resolved<T> | undefined {
  const present = offers.filter((o): o is Offer<T> & { value: T } => o.value !== undefined);
  const [first, ...rest] = present;
  if (!first) return undefined;
  const published = first.source.level === 'outline' ? rest[0] : undefined;
  if (published && !same(published.value, first.value)) {
    return {
      value: first.value,
      source: first.source,
      conflict: { value: published.value, source: published.source },
    };
  }
  return { value: first.value, source: first.source };
}

function recordSource(
  level: Exclude<SchemeLevel, 'outline'>,
  record: AssessmentRules | ModuleAssessment,
  quoted?: { quote?: string | undefined; page?: string | undefined },
): FieldSource {
  const recordId = 'id' in record ? record.id : record.code;
  const page = quoted?.page ?? ('page' in record ? record.page : undefined);
  const quote =
    quoted?.quote ??
    ('quote' in record && typeof record.quote === 'string' ? record.quote : undefined);
  return {
    level,
    academicYear: record.academicYear,
    sourceUrl: record.sourceUrl,
    recordId,
    ...(quote === undefined ? {} : { quote }),
    ...(page === undefined ? {} : { page }),
    draft: isDraft(record),
  };
}

function weightingOf(w: Weighting): Weighting | undefined {
  const out: { -readonly [K in keyof Weighting]: Weighting[K] } = {};
  if (w.components !== undefined) out.components = w.components;
  if (w.yearMarkWeight !== undefined) out.yearMarkWeight = w.yearMarkWeight;
  if (w.examWeight !== undefined) out.examWeight = w.examWeight;
  return Object.keys(out).length === 0 ? undefined : out;
}

function admissionOf(a: {
  term?: string | undefined;
  minimumYearMark?: number | undefined;
  conditions?: ReadonlyArray<string> | undefined;
}): ExamAdmissionRule {
  return {
    ...(a.term === undefined ? {} : { term: a.term }),
    ...(a.minimumYearMark === undefined ? {} : { minimumYearMark: a.minimumYearMark }),
    conditions: a.conditions ?? [],
  };
}

function supplementaryOf(s: SupplementaryRule | OutlineSupplementary): ResolvedSupplementary {
  const { quote: _q, ...rest } = s as SupplementaryRule;
  const { page: _p, ...rule } = rest as SupplementaryRule & { page?: string };
  return rule;
}

/** Checks the learner's outline is for this module and year and its weights add up; refused otherwise. */
function checkOutline(outline: ConfirmedOutlineScheme, module: ResolveInput['module']): void {
  if (normaliseModuleCode(outline.moduleCode) !== normaliseModuleCode(module.code)) {
    throw new InvalidSchemeError(`The outline is for ${outline.moduleCode}, not ${module.code}`);
  }
  if (outline.academicYear !== module.academicYear) {
    throw new InvalidSchemeError(
      `The outline is for ${outline.academicYear}, but the module is registered for ${module.academicYear}`,
    );
  }
  const problems = weightingProblems(outline);
  if (problems.length > 0) throw new InvalidSchemeError(problems.join('; '));
  const percents = [
    outline.passMark,
    outline.examSubminimum,
    outline.dpRequirement?.minimumYearMark,
    ...(outline.components ?? []).map((c) => c.subminimum),
  ];
  for (const p of percents) {
    if (p !== undefined && !(Number.isFinite(p) && p >= 0 && p <= 100)) {
      throw new InvalidSchemeError(`A percentage must be from 0 to 100, got ${p}`);
    }
  }
}

/**
 * Resolves a module's scheme, field by field (see the file comment). Refuses an outline for
 * another module or year, or one whose weights don't add up (never rescaled).
 */
export function resolveScheme(input: ResolveInput): ResolvedScheme {
  const { module, faculty, outline, today, includeDrafts } = input;
  if (outline) checkOutline(outline, module);
  const allowed = <T extends AssessmentRules | ModuleAssessment>(r: T) =>
    isPublishable(r, today) || (includeDrafts && provenanceSchema.safeParse(r).success);
  const records = {
    assessmentRules: input.records.assessmentRules.filter(allowed),
    moduleAssessments: input.records.moduleAssessments.filter(allowed),
  };
  const rules = assessmentRulesFor(
    records,
    { universityId: module.universityId, faculty },
    module.academicYear,
  );
  const scheme = moduleAssessmentFor(
    records,
    module.universityId,
    module.code,
    module.academicYear,
    faculty,
  );
  const levels = [
    ...(rules.faculty ? [{ level: 'faculty' as const, record: rules.faculty }] : []),
    ...(rules.university ? [{ level: 'university' as const, record: rules.university }] : []),
  ];
  const outlineSource: FieldSource | undefined = outline && {
    level: 'outline',
    academicYear: outline.academicYear,
    confirmedOn: outline.confirmedOn,
    draft: false,
  };
  const fromOutline = <T>(value: T | undefined): Array<Offer<T>> =>
    outlineSource ? [{ value, source: outlineSource }] : [];
  const fromModule = <T>(value: T | undefined): Array<Offer<T>> =>
    scheme ? [{ value, source: recordSource('module', scheme) }] : [];
  const fromRules = <T>(
    pick: (
      r: AssessmentRules,
    ) => { value: T; quote?: string | undefined; page?: string | undefined } | undefined,
  ): Array<Offer<T>> =>
    levels.map(({ level, record }) => {
      const picked = pick(record);
      return { value: picked?.value, source: recordSource(level, record, picked) };
    });

  const resolved = {
    weighting: resolve<Weighting>([
      ...fromOutline(outline && weightingOf(outline)),
      ...fromModule(scheme && weightingOf(scheme)),
    ]),
    passMark: resolve<number>([
      ...fromOutline(outline?.passMark),
      ...fromModule(scheme?.passMark),
      ...fromRules((r) => r.passMark),
    ]),
    examAdmission: resolve<ExamAdmissionRule>([
      ...fromOutline(outline?.dpRequirement && admissionOf(outline.dpRequirement)),
      ...fromModule(scheme?.dpRequirement && admissionOf(scheme.dpRequirement)),
      ...fromRules(
        (r) => r.examAdmission && { ...r.examAdmission, value: admissionOf(r.examAdmission) },
      ),
    ]),
    examSubminimum: resolve<number>([
      ...fromOutline(outline?.examSubminimum),
      ...fromModule(scheme?.examSubminimum),
      ...fromRules((r) => r.examSubminimum),
    ]),
    componentSubminimum: resolve<ComponentSubminimumRule>(
      fromRules((r) => {
        const c = r.componentSubminimum;
        return (
          c && {
            ...c,
            value: {
              value: c.value,
              ...(c.fromWeight === undefined ? {} : { fromWeight: c.fromWeight }),
            },
          }
        );
      }),
    ),
    supplementary: resolve<ResolvedSupplementary>([
      ...fromOutline(outline?.supplementary && supplementaryOf(outline.supplementary)),
      ...fromRules(
        (r) => r.supplementary && { ...r.supplementary, value: supplementaryOf(r.supplementary) },
      ),
    ]),
    deferredExam: resolve<string>(
      fromRules((r) => r.deferredExam && { ...r.deferredExam, value: r.deferredExam.quote }),
    ),
    rounding: resolve<RoundingMethod>(
      fromRules((r) => r.rounding && { ...r.rounding, value: r.rounding.method }),
    ),
    distinction: resolve<number>(fromRules((r) => r.distinction)),
  };
  const otherRules = [
    ...(outlineSource
      ? (outline?.otherRules ?? []).map((quote) => ({ quote, source: outlineSource }))
      : []),
    ...(scheme
      ? (scheme.otherRules ?? []).map((quote) => ({
          quote,
          source: recordSource('module', scheme),
        }))
      : []),
    ...levels.flatMap(({ level, record }) =>
      (record.otherRules ?? []).map((q) => ({
        quote: q.quote,
        source: recordSource(level, record, q),
      })),
    ),
  ];
  const present = Object.fromEntries(
    Object.entries(resolved).filter(([, v]) => v !== undefined),
  ) as {
    -readonly [K in keyof typeof resolved]?: NonNullable<(typeof resolved)[K]>;
  };
  const sources = [
    ...Object.values(present).flatMap((r) => [
      r.source,
      ...(r.conflict ? [r.conflict.source] : []),
    ]),
    ...otherRules.map((r) => r.source),
  ];
  return {
    universityId: module.universityId,
    moduleCode: module.code,
    academicYear: module.academicYear,
    ...present,
    otherRules,
    includesDrafts: sources.some((s) => s.draft),
  };
}
