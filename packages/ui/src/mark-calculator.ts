import {
  dpStatus,
  finalMark,
  type LearnerMarks,
  type MarkNeeded,
  markNeeded,
  type NeededResult,
  percentFromScore,
  type ResolvedScheme,
  supplementaryOutlook,
  type Target,
  yearMark,
} from '@universityflow/admissions/client';
import type { moduleCard } from '@universityflow/content/app';

/**
 * The module card's mark calculator (Phase 6c, D11, D13): what the learner sees as they type their
 * marks, worked out by packages/admissions on their own device (the browser, or the app with no
 * data): no round trip. It is given the scheme the server resolved, never catalogue records, and
 * imports the mark maths from `@universityflow/admissions/client`, so it fits a client chunk and
 * both app bundles.
 *
 * Its words are the content's own (`en.moduleCard.calculator`, hard rule 8), passed in as
 * `{0}`-templates so a browser component can receive them as props (a function can't be one): this
 * module never imports the copy. Every number comes from admissions; a rule the scheme doesn't have
 * is "not published", never a default (gotcha 40). A bad mark is refused, never repaired.
 *
 * Plain TypeScript, no DOM or Node (hard rule 11).
 */

// ── Templates ────────────────────────────────────────────────────────────────────────────────

/** A section of the content with every function replaced by its `{0}`, `{1}`… template. */
export type Templates<T> = {
  readonly [K in keyof T]: T[K] extends (...args: never[]) => string
    ? string
    : T[K] extends string
      ? string
      : Templates<T[K]>;
};

const MARKERS = ['{0}', '{1}', '{2}', '{3}'] as const;

/** Calls each of the content's functions with `{0}`, `{1}`… so its words become a template. */
export function asTemplates<T extends object>(value: T): Templates<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      typeof v === 'function'
        ? (v as (...args: string[]) => string)(...MARKERS)
        : typeof v === 'object' && v !== null
          ? asTemplates(v as object)
          : v,
    ]),
  ) as Templates<T>;
}

/** A template's `{n}` markers replaced by the values, in order. */
export function fill(template: string, ...values: ReadonlyArray<string | number>): string {
  return template.replace(/\{(\d)\}/g, (marker, i: string) => {
    const value = values[Number(i)];
    return value === undefined ? marker : String(value);
  });
}

/** The calculator's words, as the browser and the app receive them. */
export type CalculatorWords = Templates<typeof moduleCard.calculator>;

// ── Input ────────────────────────────────────────────────────────────────────────────────────

/** A mark as stored: the component's name as the scheme names it, and which attempt. */
export interface SavedMark {
  readonly component: string;
  readonly attempt: number;
  readonly percent: number;
}

/** The component name a year mark is kept under, for a scheme printed as "year mark X, exam Y". */
export const YEAR_MARK_COMPONENT = 'year mark';

export interface CalculatorField {
  /** Unique in the form: the component's place and the attempt. */
  readonly key: string;
  /** The component's name as the scheme names it (`YEAR_MARK_COMPONENT` for a year mark). */
  readonly component: string;
  readonly attempt: number;
  readonly label: string;
}

export type CalculatorMode = 'components' | 'year-mark' | 'unknown';

const isExam = (kind: string) => kind === 'exam';
const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * What the learner can type: a mark for each coursework component (one per attempt for "the best
 * 2 of 3"), or one year mark for a scheme printed only as a year mark and an exam; nothing when the
 * weighting isn't published. The exam is never typed: the calculator works out what it needs.
 */
export function calculatorFields(
  scheme: ResolvedScheme,
  words: CalculatorWords,
): {
  readonly mode: CalculatorMode;
  readonly fields: ReadonlyArray<CalculatorField>;
  readonly examNotes: ReadonlyArray<string>;
} {
  const weighting = scheme.weighting?.value;
  if (!weighting) return { mode: 'unknown', fields: [], examNotes: [] };
  if (weighting.components === undefined) {
    return {
      mode: 'year-mark',
      fields: [
        { key: 'year', component: YEAR_MARK_COMPONENT, attempt: 1, label: words.yearMarkLabel },
      ],
      examNotes: [],
    };
  }
  const fields: CalculatorField[] = [];
  const examNotes: string[] = [];
  weighting.components.forEach((c, index) => {
    if (isExam(c.kind)) {
      examNotes.push(fill(words.examNote, c.name));
      return;
    }
    const attempts = c.bestOf?.of ?? 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      fields.push({
        key: `${index}:${attempt}`,
        component: c.name,
        attempt,
        label:
          attempts > 1 ? fill(words.attemptLabel, c.name, attempt) : fill(words.markLabel, c.name),
      });
    }
  });
  return { mode: 'components', fields, examNotes };
}

/** A whole or decimal number as typed back: at most two decimals, no trailing zeros. */
const typedBack = (n: number) => String(Math.round(n * 100) / 100);

/** The form's starting values: the learner's saved marks in their fields, the rest empty. */
export function initialValues(
  fields: ReadonlyArray<CalculatorField>,
  saved: ReadonlyArray<SavedMark>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const mark = saved.find(
      (m) => nameKey(m.component) === nameKey(f.component) && m.attempt === f.attempt,
    );
    values[f.key] = mark ? typedBack(mark.percent) : '';
  }
  return values;
}

const PERCENT = /^(\d{1,3}(?:[.,]\d{1,2})?)\s*%?$/;
const SCORE = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*\/\s*(\d{1,4}(?:[.,]\d{1,2})?)$/;
const num = (s: string) => Number(s.replace(',', '.'));

/**
 * A typed mark as a percentage: "62", "62.5", "62,5", "62%", or a score "18/24" converted in code
 * (`percentFromScore`). Empty is null (not written yet); anything else, or out of 0–100, is
 * `invalid`: refused, never repaired.
 */
export function parseMark(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (t === '') return null;
  const p = PERCENT.exec(t);
  if (p?.[1]) {
    const value = num(p[1]);
    return value >= 0 && value <= 100 ? value : 'invalid';
  }
  const s = SCORE.exec(t);
  if (s?.[1] && s[2]) {
    try {
      return percentFromScore(num(s[1]), num(s[2]));
    } catch {
      return 'invalid';
    }
  }
  return 'invalid';
}

/** The typed values as marks to save (empty fields left out). Refuses an invalid one. */
export function marksFrom(
  fields: ReadonlyArray<CalculatorField>,
  values: Readonly<Record<string, string>>,
): SavedMark[] {
  const marks: SavedMark[] = [];
  for (const f of fields) {
    const value = parseMark(values[f.key] ?? '');
    if (value === 'invalid') throw new Error(`Not a mark: ${f.key}`);
    if (value !== null) marks.push({ component: f.component, attempt: f.attempt, percent: value });
  }
  return marks;
}

// ── The result ───────────────────────────────────────────────────────────────────────────────

export interface ReadingView {
  /** Which reading of the outstanding coursework this assumes, in words. */
  readonly label: string;
  readonly kind: NeededResult['kind'];
  readonly lines: ReadonlyArray<string>;
}

export interface NeededView {
  readonly title: string;
  /** Said instead of any number when a rule it needs isn't published. */
  readonly text?: string;
  readonly readings: ReadonlyArray<ReadingView>;
}

export type CalculatorView =
  | { readonly kind: 'no-weighting'; readonly summary: string }
  | {
      readonly kind: 'invalid';
      /** The keys of the fields that aren't marks. */
      readonly invalid: ReadonlyArray<string>;
      readonly targetInvalid: boolean;
      readonly summary: string;
    }
  | {
      readonly kind: 'result';
      readonly yearMark: string;
      readonly outstanding: string | null;
      readonly dp: {
        readonly status: string;
        readonly text: string;
        readonly conditions: ReadonlyArray<string>;
      };
      readonly pass: NeededView;
      /** Null until the learner sets a target. */
      readonly target: NeededView | null;
      readonly supplementary: ReadonlyArray<string>;
      /** One short paragraph for the polite live region: what changed. */
      readonly summary: string;
    };

/** A percentage for reading: one decimal at most ("66.3", "56"). */
const shown = (n: number) => String(Math.round(n * 10) / 10);

export function calculate(
  input: {
    readonly scheme: ResolvedScheme;
    readonly values: Readonly<Record<string, string>>;
    readonly target: string;
  },
  words: CalculatorWords,
): CalculatorView {
  const { scheme } = input;
  const { mode, fields } = calculatorFields(scheme, words);
  if (mode === 'unknown') return { kind: 'no-weighting', summary: words.noWeighting };

  const invalid = fields.filter((f) => parseMark(input.values[f.key] ?? '') === 'invalid');
  const target = parseMark(input.target);
  const targetInvalid = target === 'invalid' || input.target.includes('/');
  if (invalid.length > 0 || targetInvalid) {
    return {
      kind: 'invalid',
      invalid: invalid.map((f) => f.key),
      targetInvalid,
      summary: words.fixFirst,
    };
  }

  const saved = marksFrom(fields, input.values);
  const marks: LearnerMarks =
    mode === 'year-mark'
      ? saved[0]
        ? { yearMark: saved[0].percent }
        : {}
      : { components: saved.map((m) => ({ component: m.component, percent: m.percent })) };

  try {
    return result(scheme, marks, typeof target === 'number' ? target : null, words);
  } catch {
    // admissions refused the marks (it never repairs them): the learner fixes them first.
    return { kind: 'invalid', invalid: [], targetInvalid: false, summary: words.fixFirst };
  }
}

function result(
  scheme: ResolvedScheme,
  marks: LearnerMarks,
  target: number | null,
  words: CalculatorWords,
): CalculatorView {
  const y = yearMark(scheme, marks);
  if (y.kind === 'unknown') return { kind: 'no-weighting', summary: words.noWeighting };
  const yearMarkLine =
    y.yearMark === undefined ? words.nothingYet : fill(words.yearMarkSoFar, shown(y.yearMark));
  const outstanding =
    y.outstanding.length > 0 && y.yearMark !== undefined
      ? fill(words.stillToWrite, y.outstanding.join(', '))
      : null;

  const dp = dpStatus(scheme, marks);
  const term = scheme.examAdmission?.value.term ?? words.admissionTerm;
  const dpText =
    dp.status === 'unknown'
      ? fill(words.dp[dp.reason ?? 'not-published'], term)
      : fill(words.dp[dp.status], term, dp.minimumYearMark ?? '');

  const best = finalMark(scheme, marks, 100);
  const pass = neededView(
    words.passTitle,
    markNeeded(scheme, marks, { kind: 'pass-mark' }),
    scheme,
    best,
    words,
  );
  const own: Target | null = target === null ? null : { kind: 'own', percent: target };
  const targetView = own
    ? neededView(
        fill(words.targetTitle, shown(target as number)),
        markNeeded(scheme, marks, own),
        scheme,
        best,
        words,
      )
    : null;

  const firstLine = (v: NeededView | null) => v?.text ?? v?.readings[0]?.lines[0];
  const summary = [yearMarkLine, dpText, firstLine(pass), firstLine(targetView)]
    .filter((s): s is string => typeof s === 'string')
    .join(' ');
  return {
    kind: 'result',
    yearMark: yearMarkLine,
    outstanding,
    dp: { status: dp.status, text: dpText, conditions: dp.conditions },
    pass,
    target: targetView,
    supplementary: supplementaryLines(scheme, words),
    summary,
  };
}

function neededView(
  title: string,
  needed: MarkNeeded,
  scheme: ResolvedScheme,
  best: number | undefined,
  words: CalculatorWords,
): NeededView {
  const [only] = needed.readings;
  if (only?.result.kind === 'unknown') {
    // Gotcha 40: no pass mark (or no weighting) means no number at all, never a usual 50.
    return {
      title,
      text:
        only.result.reason === 'pass-mark-not-published'
          ? words.passNotPublished
          : words.noWeighting,
      readings: [],
    };
  }
  return {
    title,
    readings: needed.readings.map(({ reading, result }) => ({
      label: words.readings[reading],
      kind: result.kind,
      lines: resultLines(result, reading === 'all-remaining', needed, scheme, best, words),
    })),
  };
}

function resultLines(
  result: NeededResult,
  noExam: boolean,
  needed: MarkNeeded,
  scheme: ResolvedScheme,
  best: number | undefined,
  words: CalculatorWords,
): string[] {
  switch (result.kind) {
    case 'needed': {
      const lines = [fill(noExam ? words.neededAverage : words.needed, result.shown)];
      // D13: a needed mark rounded up says so.
      if (result.roundedUp) lines.push(fill(words.roundedUp, shown(result.exact)));
      if (result.bindsOn === 'subminimum' && typeof needed.examSubminimum === 'number') {
        lines.push(fill(words.bindsSubminimum, needed.examSubminimum));
      }
      return lines;
    }
    case 'already-secured':
      // A1-82: admissions says what the exam may still hold; "whatever your exam mark" only
      // when nothing about it is unpublished or unmet.
      if (result.examAdmission === 'not-met') return [words.securedDpNotMet];
      if (result.examSubminimum === 'not-published') return [words.securedSubminimumNotPublished];
      return [words.secured];
    case 'blocked':
      return [fill(words.blocked, result.components.join(', '))];
    case 'impossible': {
      const lines = [words.impossible, words.impossibleNext];
      if (best !== undefined) {
        lines.push(fill(words.bestFinal, shown(best)));
        const outlook = supplementaryOutlook(scheme, Math.min(100, Math.max(0, best)));
        if (outlook.kind === 'may-qualify') lines.push(words.bestFinalMayQualify);
        if (outlook.kind === 'below-range') lines.push(words.bestFinalBelow);
      }
      return lines;
    }
    case 'unknown':
      return [
        result.reason === 'pass-mark-not-published' ? words.passNotPublished : words.noWeighting,
      ];
  }
}

/** What the rules say about a supplementary exam, in words, or that they say nothing. */
function supplementaryLines(scheme: ResolvedScheme, words: CalculatorWords): string[] {
  const rule = scheme.supplementary?.value;
  if (!rule) return [words.supplementaryNotPublished];
  if (rule.offered === false) return [words.supplementaryNotOffered];
  const range = rule.eligibleFinalMark;
  if (!range) return [words.supplementaryNoRange];
  const outlook = supplementaryOutlook(scheme, range.from);
  if (outlook.kind !== 'may-qualify') return [words.supplementaryNoRange];
  const passMark = scheme.passMark?.value;
  const lines = [
    range.to === undefined
      ? fill(words.supplementaryBelowPass, range.from, passMark ?? '')
      : fill(words.supplementaryRange, range.from, range.to),
  ];
  const r = outlook.result;
  if (!r) lines.push(words.supplementaryResultNotPublished);
  else if (r.kind === 'capped-at') lines.push(fill(words.supplementaryCapped, r.cap));
  else lines.push(words.supplementaryResults[r.kind]);
  return lines;
}
