import {
  type CatalogueView,
  isDraft,
  type Programme,
  type QualificationType,
  type RequiredPass,
  type ScoreBand,
  type SubjectId,
  type UniversityId,
} from '@universityflow/catalogue';
import { type MarksBasis, marksBasis, type ScoredReport } from './basis';
import { checkProgramme, groupResults, type ProgrammeCheck, type Verdict } from './eligibility';
import { nscPass, type PassOutcome } from './pass-type';
import type { Bonus, ScoreLine } from './scoring/engine';
import { methodFor } from './universities/methods';

/**
 * A learner's results across every programme in the catalogue, as plain data. The agent's
 * results tool and the web results page both use this, so the AI and the screen always agree,
 * and neither can compute a different answer (hard rule 2).
 */

/**
 * A verdict as a learner sees it: on Grade 10 marks, "qualifies" is `on-track` (`marksBasis`), so
 * no screen or tool can say "Qualify now" two years before anyone applies (G10-3).
 */
export type ResultVerdict = Verdict | 'on-track';

export function shownVerdict(verdict: ResultVerdict, basis: MarksBasis): ResultVerdict {
  return basis === 'progress' && verdict === 'qualifies' ? 'on-track' : verdict;
}

export interface Shortfall {
  /** The subjects that could meet it (one option), or the "other subjects" pool. */
  readonly subjects: ReadonlyArray<SubjectId>;
  readonly kind: 'subject' | 'other-subjects';
  /** How many are needed, for "any N other subjects". */
  readonly count: number;
  readonly targetPercent: number;
  /** The learner's mark in the closest subject, or null when they don't take it. */
  readonly percent: number | null;
  readonly subject: SubjectId | null;
  readonly shortBy: number | null;
}

export interface ProgrammeResult {
  readonly programmeId: string;
  readonly universityId: UniversityId;
  readonly universityName: string;
  readonly name: string;
  readonly faculty: string;
  readonly qualification: QualificationType;
  readonly durationYears: number | null;
  readonly verdict: ResultVerdict;
  readonly score: number;
  readonly scoreLabel: string;
  readonly scoreUnit: 'points' | 'percent';
  readonly scoreMaximum: number;
  readonly requiredScore: number | null;
  readonly scoreGap: number;
  readonly scoreBands: ReadonlyArray<ScoreBand>;
  readonly shortfalls: ReadonlyArray<Shortfall>;
  readonly passRequired: RequiredPass;
  readonly passProjected: PassOutcome;
  readonly passMet: boolean;
  readonly nbt: Programme['nbt'];
  readonly selection: string | null;
  readonly closesOn: string | null;
  readonly sourceUrl: string;
  readonly academicYear: number;
  /** True while nobody has verified the record (only ever shown outside production). */
  readonly draft: boolean;
}

export interface ScoreBreakdown {
  readonly programmeId: string;
  readonly label: string;
  readonly unit: 'points' | 'percent';
  readonly total: number;
  readonly maximum: number;
  readonly required: number | null;
  readonly lines: ReadonlyArray<ScoreLine>;
  readonly bonuses: ReadonlyArray<Bonus>;
  readonly incomplete: boolean;
  readonly methodSourceUrl: string;
}

export interface Results {
  /** `progress` on Grade 10 marks: `qualifyNow` and `planB` are then always empty. */
  readonly basis: MarksBasis;
  readonly passProjected: PassOutcome;
  readonly qualifyNow: ReadonlyArray<ProgrammeResult>;
  /** On Grade 10 marks, every programme the marks would meet, degree or not. Else empty. */
  readonly onTrack: ReadonlyArray<ProgrammeResult>;
  readonly close: ReadonlyArray<ProgrammeResult>;
  readonly planB: ReadonlyArray<ProgrammeResult>;
  /** How many programmes were checked, so "nothing found" can't hide an empty catalogue. */
  readonly checked: number;
  readonly includesDrafts: boolean;
}

function shortfalls(check: ProgrammeCheck): Shortfall[] {
  return check.requirements
    .filter((r) => !r.met)
    .map((r) => ({
      subjects: r.closest.option.subjects,
      kind: 'otherSubjects' in r.requirement ? ('other-subjects' as const) : ('subject' as const),
      count: 'otherSubjects' in r.requirement ? r.requirement.otherSubjects.count : 1,
      targetPercent: r.closest.targetPercent,
      percent: r.closest.best?.percent ?? null,
      subject: r.closest.best?.subject ?? null,
      shortBy: r.closest.shortBy,
    }));
}

export function summarise(
  check: ProgrammeCheck,
  universityName: string,
  basis: MarksBasis,
): ProgrammeResult {
  const { programme: p } = check;
  const method = methodFor(p);
  return {
    programmeId: p.id,
    universityId: p.universityId,
    universityName,
    name: p.name,
    faculty: p.faculty,
    qualification: p.qualification,
    durationYears: p.durationYears,
    verdict: shownVerdict(check.verdict, basis),
    score: check.score.total,
    scoreLabel: method.label,
    scoreUnit: method.unit,
    scoreMaximum: method.maximum,
    requiredScore: check.requiredScore,
    scoreGap: check.scoreGap,
    scoreBands: p.scoreBands ?? [],
    shortfalls: shortfalls(check),
    passRequired: check.pass.required,
    passProjected: check.pass.projected,
    passMet: check.pass.met,
    nbt: p.nbt,
    selection: p.selection,
    closesOn: p.closesOn,
    sourceUrl: p.sourceUrl,
    academicYear: p.academicYear,
    draft: isDraft(p) || isDraft(method.source),
  };
}

/**
 * The programmes a learner may be scored against. The catalogue view already hides unverified
 * records; a verified record scored by an unverified method is still unverified, because the
 * score is the fact a learner acts on (hard rule 3). Drafts stay visible only in preview.
 */
export function scorable(view: CatalogueView): ReadonlyArray<Programme> {
  if (view.includesDrafts) return view.programmes;
  return view.programmes.filter((p) => !isDraft(methodFor(p).source));
}

function nameOf(view: CatalogueView, id: UniversityId): string {
  return view.universities.find((u) => u.id === id)?.shortName ?? id;
}

/**
 * Every programme the catalogue shows, checked against a confirmed report. On Grade 10 marks the
 * groups are On track and Close: never Qualify now or Plan B (G10-3, `marksBasis`).
 */
export function assessAll(view: CatalogueView, report: ScoredReport): Results {
  const { marks } = report;
  const basis = marksBasis(report.kind);
  const checks = scorable(view).map((p) => checkProgramme(p, marks, methodFor(p)));
  const groups = groupResults(checks);
  const map = (list: ReadonlyArray<ProgrammeCheck>) =>
    list.map((c) => summarise(c, nameOf(view, c.programme.universityId), basis));
  const progress = basis === 'progress';
  return {
    basis,
    passProjected: nscPass(marks),
    qualifyNow: progress ? [] : map(groups.qualifyNow),
    onTrack: progress ? map(groups.onTrack) : [],
    close: map(groups.close),
    planB: progress ? [] : map(groups.planB),
    checked: checks.length,
    includesDrafts: view.includesDrafts,
  };
}

/** One programme in detail: the result and why the score is what it is. */
export function assessOne(
  view: CatalogueView,
  programmeId: string,
  report: ScoredReport,
): { result: ProgrammeResult; breakdown: ScoreBreakdown } | null {
  const programme = scorable(view).find((p) => p.id === programmeId);
  if (!programme) return null;
  const method = methodFor(programme);
  const check = checkProgramme(programme, report.marks, method);
  return {
    result: summarise(check, nameOf(view, programme.universityId), marksBasis(report.kind)),
    breakdown: {
      programmeId,
      label: method.label,
      unit: method.unit,
      total: check.score.total,
      maximum: method.maximum,
      required: check.requiredScore,
      lines: check.score.lines,
      bonuses: check.score.bonuses,
      incomplete: check.score.incomplete,
      methodSourceUrl: method.source.sourceUrl,
    },
  };
}
