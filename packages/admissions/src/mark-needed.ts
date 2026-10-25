import type {
  AssessmentComponent,
  SupplementaryResult,
  Weighting,
} from '@universityflow/catalogue';
import type { ResolvedScheme, ResolvedSupplementary } from './assessment';

/**
 * The mark maths of a resolved scheme (planning.md §16.2: "mark maths (DP, subminimum,
 * weighting)"): the year mark so far, the DP status, the exam mark needed for a target, and the
 * supplementary outlook. Code decides; the AI only explains what these return (hard rule 2).
 *
 * Every mark here was typed or confirmed by the learner (hard rule 6). Bad input is refused, never
 * repaired (as `validateMarks`). A rule the scheme doesn't have makes the answer `unknown`, never a
 * default (gotcha 40). A needed mark is shown rounded **up** to a whole percent and labelled when it
 * was (D13); a university's own rounding of the final mark is applied only where it is printed.
 *
 * Pure, no I/O, React-Native-safe (hard rule 11).
 */

/** One mark the learner typed or confirmed for a component, as a percentage (decimals allowed). */
export interface ComponentMark {
  /** The component's name, as the scheme names it (case and spacing don't matter). */
  readonly component: string;
  readonly percent: number;
}

/**
 * The learner's marks so far. `components` for a scheme that lists its components (a best-of
 * component takes one mark per attempt); `yearMark` for a scheme printed only as "year mark X%,
 * exam Y%", where the learner types the year (class) mark they were given.
 */
export interface LearnerMarks {
  readonly components?: ReadonlyArray<ComponentMark>;
  readonly yearMark?: number;
}

export class InvalidAssessmentMarksError extends Error {
  override readonly name = 'InvalidAssessmentMarksError';
}

const isPercent = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

function checkPercent(n: number, what: string): void {
  if (!isPercent(n)) {
    throw new InvalidAssessmentMarksError(`${what}: a percentage must be from 0 to 100, got ${n}`);
  }
}

/** A raw score and its total ("18 out of 24") as a percentage, converted in code. */
export function percentFromScore(score: number, outOf: number): number {
  if (
    !(Number.isFinite(outOf) && outOf > 0) ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > outOf
  ) {
    throw new InvalidAssessmentMarksError(
      `A score must be from 0 to its total, got ${score} out of ${outOf}`,
    );
  }
  return (score / outOf) * 100;
}

const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const sum = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0);

export type YearMarkResult =
  | { readonly kind: 'unknown'; readonly reason: 'weighting-not-published' }
  | {
      readonly kind: 'known';
      /** Every coursework component written. */
      readonly complete: boolean;
      /** The year (class) mark so far: the weighted average of what is written. Absent before anything is. */
      readonly yearMark?: number;
      /** Points of the final mark earned so far from coursework. */
      readonly earned: number;
      /** Share of the final mark the written coursework carries. */
      readonly writtenWeight: number;
      /** Share of the final mark of coursework not yet written. */
      readonly outstandingWeight: number;
      /** Share of the final mark all coursework carries (100 minus the exam). */
      readonly yearWeight: number;
      /** The exam's share of the final mark (0 for a continuously assessed module). */
      readonly examWeight: number;
      /** Components not (fully) written yet, by name. */
      readonly outstanding: ReadonlyArray<string>;
      /** Written components below their subminimum: a pass is blocked whatever the total. */
      readonly belowSubminimum: ReadonlyArray<string>;
    };

const isExam = (c: AssessmentComponent) => c.kind === 'exam';

/** The subminimum a coursework component must reach: its own, or a university's component rule. */
function subminimumOf(scheme: ResolvedScheme, c: AssessmentComponent): number | undefined {
  if (c.subminimum !== undefined) return c.subminimum;
  const rule = scheme.componentSubminimum?.value;
  if (rule && c.weight >= (rule.fromWeight ?? 0)) return rule.value;
  return undefined;
}

/** Groups the learner's marks by component, refusing unknown, exam, out-of-range or extra marks. */
function marksByComponent(
  components: ReadonlyArray<AssessmentComponent>,
  marks: ReadonlyArray<ComponentMark>,
): Map<AssessmentComponent, number[]> {
  const byKey = new Map(components.map((c) => [key(c.name), c]));
  const out = new Map<AssessmentComponent, number[]>(components.map((c) => [c, []]));
  for (const m of marks) {
    const c = byKey.get(key(m.component));
    if (!c)
      throw new InvalidAssessmentMarksError(`No component called “${m.component}” in this module`);
    if (isExam(c)) {
      throw new InvalidAssessmentMarksError(
        `“${c.name}” is the exam: the calculator works out what it needs`,
      );
    }
    checkPercent(m.percent, c.name);
    const list = out.get(c) ?? [];
    list.push(m.percent);
    out.set(c, list);
    const allowed = c.bestOf?.of ?? 1;
    if (list.length > allowed) {
      throw new InvalidAssessmentMarksError(
        `“${c.name}” takes at most ${allowed} mark${allowed > 1 ? 's' : ''}`,
      );
    }
  }
  return out;
}

/** The weighted year mark so far, from the learner's confirmed marks; outstanding work reported, never assumed. */
export function yearMark(scheme: ResolvedScheme, marks: LearnerMarks): YearMarkResult {
  const weighting: Weighting | undefined = scheme.weighting?.value;
  if (!weighting) return { kind: 'unknown', reason: 'weighting-not-published' };
  const { components } = weighting;
  if (components === undefined) return fromYearMarkOnly(weighting, marks);
  if (marks.yearMark !== undefined) {
    throw new InvalidAssessmentMarksError(
      'This module lists its components: type a mark for each one',
    );
  }
  const examWeight = sum(components.filter(isExam).map((c) => c.weight));
  const byComponent = marksByComponent(components, marks.components ?? []);
  let earned = 0;
  let writtenWeight = 0;
  const outstanding: string[] = [];
  const belowSubminimum: string[] = [];
  for (const c of components.filter((x) => !isExam(x))) {
    const written = byComponent.get(c) ?? [];
    const count = c.bestOf?.count ?? 1;
    const counted = [...written].sort((a, b) => b - a).slice(0, count);
    const share = (c.weight * counted.length) / count;
    if (counted.length > 0) {
      const average = sum(counted) / counted.length;
      earned += (share * average) / 100;
      writtenWeight += share;
      const sub = subminimumOf(scheme, c);
      if (sub !== undefined && average < sub) belowSubminimum.push(c.name);
    }
    if (counted.length < count) outstanding.push(c.name);
  }
  const yearWeight = 100 - examWeight;
  return {
    kind: 'known',
    complete: outstanding.length === 0,
    ...(writtenWeight > 0 ? { yearMark: (earned / writtenWeight) * 100 } : {}),
    earned,
    writtenWeight,
    outstandingWeight: yearWeight - writtenWeight,
    yearWeight,
    examWeight,
    outstanding,
    belowSubminimum,
  };
}

/** A scheme printed only as "year mark X%, exam Y%": the learner types their year mark. */
function fromYearMarkOnly(weighting: Weighting, marks: LearnerMarks): YearMarkResult {
  if ((marks.components ?? []).length > 0) {
    throw new InvalidAssessmentMarksError(
      'This module prints only a year mark and an exam: type your year mark',
    );
  }
  const yearWeight = weighting.yearMarkWeight ?? 0;
  const examWeight = weighting.examWeight ?? 0;
  const base = { yearWeight, examWeight, belowSubminimum: [] };
  if (marks.yearMark === undefined) {
    return {
      kind: 'known',
      complete: false,
      earned: 0,
      writtenWeight: 0,
      outstandingWeight: yearWeight,
      outstanding: ['year mark'],
      ...base,
    };
  }
  checkPercent(marks.yearMark, 'year mark');
  return {
    kind: 'known',
    complete: true,
    yearMark: marks.yearMark,
    earned: (yearWeight * marks.yearMark) / 100,
    writtenWeight: yearWeight,
    outstandingWeight: 0,
    outstanding: [],
    ...base,
  };
}

export const DP_STATUSES = ['met', 'on-track', 'at-risk', 'not-met', 'unknown'] as const;
export type DpStatusKind = (typeof DP_STATUSES)[number];

export interface DpStatus {
  readonly status: DpStatusKind;
  /** Why it is unknown: no DP rule, a rule with no number, no weighting, or nothing written yet. */
  readonly reason?: 'not-published' | 'no-number' | 'weighting-not-published' | 'nothing-written';
  /** The year mark the rule asks for, when printed. */
  readonly minimumYearMark?: number;
  /** The printed conditions (attendance, submissions): the learner's own checklist, never judged. */
  readonly conditions: ReadonlyArray<string>;
}

/**
 * Whether the learner is on course for exam admission (DP), from the numeric part of the rule
 * only: `met`/`not-met` once all coursework is written; `on-track` (average so far reaches it),
 * `at-risk` (it doesn't yet, but still can) or `not-met` (it can't any more) before that.
 */
export function dpStatus(scheme: ResolvedScheme, marks: LearnerMarks): DpStatus {
  const rule = scheme.examAdmission?.value;
  if (!rule) return { status: 'unknown', reason: 'not-published', conditions: [] };
  const conditions = rule.conditions;
  const min = rule.minimumYearMark;
  if (min === undefined) return { status: 'unknown', reason: 'no-number', conditions };
  const y = yearMark(scheme, marks);
  if (y.kind === 'unknown')
    return {
      status: 'unknown',
      reason: 'weighting-not-published',
      minimumYearMark: min,
      conditions,
    };
  if (y.yearMark === undefined)
    return { status: 'unknown', reason: 'nothing-written', minimumYearMark: min, conditions };
  const at = { minimumYearMark: min, conditions };
  if (y.complete) return { status: y.yearMark >= min ? 'met' : 'not-met', ...at };
  if (y.yearMark >= min) return { status: 'on-track', ...at };
  const best = ((y.earned + y.outstandingWeight) / y.yearWeight) * 100;
  return { status: best >= min ? 'at-risk' : 'not-met', ...at };
}

/** What a target is: the resolved pass mark, or the learner's own. */
export type Target =
  | { readonly kind: 'pass-mark' }
  | { readonly kind: 'own'; readonly percent: number };

export type NeededResult =
  | {
      readonly kind: 'unknown';
      readonly reason: 'weighting-not-published' | 'pass-mark-not-published';
    }
  | { readonly kind: 'blocked'; readonly components: ReadonlyArray<string> }
  | { readonly kind: 'already-secured' }
  | { readonly kind: 'impossible'; readonly exact: number }
  | {
      readonly kind: 'needed';
      /** The exact mark needed (exam, or average over what's left when there is no exam). */
      readonly exact: number;
      /** Shown rounded up to a whole percent (D13). */
      readonly shown: number;
      /** True when `shown` was rounded up from `exact`: the card says so. */
      readonly roundedUp: boolean;
      /** What sets it: the target, or the exam subminimum. */
      readonly bindsOn: 'target' | 'subminimum';
    };

/**
 * Which reading of the outstanding coursework a result assumes: like the average so far, or
 * nothing more scored before the exam; `all-written` when nothing is outstanding; `all-remaining`
 * for a module with no exam (the average needed over everything still to write).
 */
export type Reading = 'remaining-like-average' | 'nothing-more' | 'all-written' | 'all-remaining';

export interface MarkNeeded {
  readonly readings: ReadonlyArray<{ readonly reading: Reading; readonly result: NeededResult }>;
  /** Whether an exam subminimum was applied, or none is published (the card says so). */
  readonly examSubminimum: number | 'not-published';
  /** The university's own rounding of the final mark, when printed and applied. */
  readonly rounding?: ResolvedScheme['rounding'];
}

/** D13: a needed mark rounded **up** to the next whole percent, and whether it was rounded. */
export function shownNeeded(exact: number): { shown: number; roundedUp: boolean } {
  // 1e-9 absorbs float noise in the weighted sums (43.0000000001 is 43), nothing more.
  const shown = Math.max(0, Math.ceil(exact - 1e-9));
  return { shown, roundedUp: shown - exact > 1e-9 };
}

/** The final mark a target asks for, after the university's printed rounding of final marks. */
function threshold(target: number, rounding: ResolvedScheme['rounding']): number {
  switch (rounding?.value) {
    case 'half-up':
      return target - 0.5;
    case 'up':
      return target - 1 + 1e-6;
    default:
      return target;
  }
}

/**
 * The exam mark needed for `target` (or the average over what's left, for a module with no exam),
 * with the exam subminimum applied. Two labelled readings while coursework is outstanding.
 */
export function markNeeded(
  scheme: ResolvedScheme,
  marks: LearnerMarks,
  target: Target,
): MarkNeeded {
  if (target.kind === 'own') checkPercent(target.percent, 'target');
  const subminimum = examSubminimumOf(scheme);
  const base = {
    examSubminimum: subminimum ?? ('not-published' as const),
    ...(scheme.rounding ? { rounding: scheme.rounding } : {}),
  };
  const single = (reading: Reading, result: NeededResult): MarkNeeded => ({
    readings: [{ reading, result }],
    ...base,
  });
  const y = yearMark(scheme, marks);
  if (y.kind === 'unknown') return single('all-written', { kind: 'unknown', reason: y.reason });
  const goal = target.kind === 'own' ? target.percent : scheme.passMark?.value;
  if (goal === undefined)
    return single('all-written', { kind: 'unknown', reason: 'pass-mark-not-published' });
  if (y.belowSubminimum.length > 0) {
    return single(y.complete ? 'all-written' : 'nothing-more', {
      kind: 'blocked',
      components: y.belowSubminimum,
    });
  }
  const t = threshold(goal, scheme.rounding);
  if (y.examWeight === 0)
    return single('all-remaining', continuous(t, y.earned, y.outstandingWeight));
  if (y.complete) return single('all-written', exam(t, y.earned, y.examWeight, subminimum));
  const readings: Array<{ reading: Reading; result: NeededResult }> = [];
  if (y.yearMark !== undefined) {
    const likeAverage = y.earned + (y.outstandingWeight * y.yearMark) / 100;
    readings.push({
      reading: 'remaining-like-average',
      result: exam(t, likeAverage, y.examWeight, subminimum),
    });
  }
  readings.push({ reading: 'nothing-more', result: exam(t, y.earned, y.examWeight, subminimum) });
  return { readings, ...base };
}

/** The highest exam subminimum that applies: the scheme's, or the exam components' own. */
function examSubminimumOf(scheme: ResolvedScheme): number | undefined {
  const own = (scheme.weighting?.value.components ?? []).filter(isExam).map((c) => c.subminimum);
  const all = [scheme.examSubminimum?.value, ...own].filter((x): x is number => x !== undefined);
  return all.length === 0 ? undefined : Math.max(...all);
}

function exam(
  threshold: number,
  earned: number,
  examWeight: number,
  subminimum: number | undefined,
): NeededResult {
  const forTarget = ((threshold - earned) * 100) / examWeight;
  const sub = subminimum ?? Number.NEGATIVE_INFINITY;
  const exact = Math.max(forTarget, sub);
  if (exact > 100) return { kind: 'impossible', exact };
  if (exact <= 0) return { kind: 'already-secured' };
  return {
    kind: 'needed',
    exact,
    ...shownNeeded(exact),
    bindsOn: forTarget >= sub ? 'target' : 'subminimum',
  };
}

function continuous(threshold: number, earned: number, outstandingWeight: number): NeededResult {
  if (earned >= threshold) return { kind: 'already-secured' };
  if (outstandingWeight <= 0) return { kind: 'impossible', exact: Number.POSITIVE_INFINITY };
  const exact = ((threshold - earned) * 100) / outstandingWeight;
  if (exact > 100) return { kind: 'impossible', exact };
  return { kind: 'needed', exact, ...shownNeeded(exact), bindsOn: 'target' };
}

/**
 * The final mark from the learner's coursework and an exam mark, or undefined when the weighting
 * isn't published or coursework is still outstanding (never assumed).
 */
export function finalMark(
  scheme: ResolvedScheme,
  marks: LearnerMarks,
  examPercent: number,
): number | undefined {
  checkPercent(examPercent, 'exam');
  const y = yearMark(scheme, marks);
  if (y.kind === 'unknown' || !y.complete) return undefined;
  return y.earned + (y.examWeight * examPercent) / 100;
}

export type SupplementaryOutlook =
  | {
      readonly kind: 'unknown';
      readonly reason: 'not-published' | 'range-not-published' | 'pass-mark-not-published';
      /** The rule's quoted conditions, when there is a rule. */
      readonly rule?: ResolvedSupplementary;
    }
  | { readonly kind: 'not-offered' }
  | {
      readonly kind: 'below-range' | 'above-range';
      readonly from: number;
      readonly upTo: number;
      readonly toIsPassMark: boolean;
    }
  | {
      /** "The rules say you may qualify; the faculty decides" (§8.5): never a promise. */
      readonly kind: 'may-qualify';
      /** What the result can be, when printed; absent means the card says it isn't published. */
      readonly result?: SupplementaryResult;
      readonly alsoWhen: ReadonlyArray<string>;
      readonly notWhen: ReadonlyArray<string>;
    };

/**
 * Whether a final mark falls where the resolved rules say a supplementary may follow, and what
 * its result can be. A range printed as "at least N" runs up to (not including) the pass mark.
 */
export function supplementaryOutlook(scheme: ResolvedScheme, final: number): SupplementaryOutlook {
  checkPercent(final, 'final mark');
  const rule = scheme.supplementary?.value;
  if (!rule) return { kind: 'unknown', reason: 'not-published' };
  if (rule.offered === false) return { kind: 'not-offered' };
  const range = rule.eligibleFinalMark;
  if (!range) return { kind: 'unknown', reason: 'range-not-published', rule };
  const passMark = scheme.passMark?.value;
  if (range.to === undefined && passMark === undefined) {
    return { kind: 'unknown', reason: 'pass-mark-not-published', rule };
  }
  const inRange = range.to === undefined ? final < (passMark as number) : final <= range.to;
  const bounds = {
    from: range.from,
    upTo: range.to ?? (passMark as number),
    toIsPassMark: range.to === undefined,
  };
  if (final < range.from) return { kind: 'below-range', ...bounds };
  if (!inRange) return { kind: 'above-range', ...bounds };
  return {
    kind: 'may-qualify',
    ...(rule.result ? { result: rule.result } : {}),
    alsoWhen: rule.alsoWhen ?? [],
    notWhen: rule.notWhen ?? [],
  };
}
