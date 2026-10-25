import {
  isOptionsRequirement,
  LIFE_ORIENTATION,
  type OptionsRequirement,
  type OtherSubjectsRequirement,
  type Programme,
  type RequiredPass,
  type SubjectId,
  type SubjectOption,
  type SubjectRequirement,
} from '@universityflow/catalogue';
import { type LevelledMark, type SubjectMark, validateMarks } from './marks';
import { type AchievementLevel, LEVEL_FLOOR } from './nsc-levels';
import { meetsPass, nscPass, type PassOutcome, passRank } from './pass-type';
import type { ScoreMethod, ScoreResult } from './scoring/engine';

/**
 * Does a learner meet a programme's published minimums, and if not, how far off are they?
 *
 * This is the calculation behind Stage 1's three groups (planning.md §3): **Qualify now**,
 * **Close** and **Plan B**. It is deterministic and tested; the agent only explains its output
 * (hard rule 2). Meeting every minimum is *eligibility*, never a promise of a place: many
 * programmes select from eligible applicants, and the interface says so (planning.md §8.5).
 */

export type Verdict = 'qualifies' | 'close' | 'not-yet';

/** How many NSC levels short a requirement can be and still count as "close". */
export const CLOSE_LEVELS = 2;

export interface OptionCheck {
  readonly option: SubjectOption;
  /** The learner's best mark among the option's subjects, or null when they take none of them. */
  readonly best: LevelledMark | null;
  /** The percentage that meets the option: the stricter of its level and percentage. */
  readonly targetPercent: number;
  readonly met: boolean;
  /** Percentage points still needed; 0 when met, null when the learner doesn't take the subject. */
  readonly shortBy: number | null;
}

export interface RequirementCheck {
  readonly requirement: SubjectRequirement;
  readonly met: boolean;
  /** The option to show: the one that is met, or the one the learner is closest to. */
  readonly closest: OptionCheck;
  readonly options: ReadonlyArray<OptionCheck>;
}

export interface ProgrammeCheck {
  readonly programme: Programme;
  readonly verdict: Verdict;
  readonly score: ScoreResult;
  readonly requiredScore: number | null;
  /** Points still needed; 0 when the minimum is met or there is none. */
  readonly scoreGap: number;
  readonly requirements: ReadonlyArray<RequirementCheck>;
  readonly pass: {
    readonly required: RequiredPass;
    readonly projected: PassOutcome;
    readonly met: boolean;
  };
}

export function targetPercent(option: SubjectOption): number {
  // The schema bounds minLevel to 1–7.
  const fromLevel =
    option.minLevel === undefined ? 0 : LEVEL_FLOOR[option.minLevel as AchievementLevel];
  return Math.max(fromLevel, option.minPercent ?? 0);
}

function checkOption(option: SubjectOption, marks: ReadonlyArray<LevelledMark>): OptionCheck {
  const target = targetPercent(option);
  const best =
    marks
      .filter((m) => option.subjects.includes(m.subject))
      .sort((a, b) => b.percent - a.percent)[0] ?? null;
  if (!best) return { option, best: null, targetPercent: target, met: false, shortBy: null };
  const shortBy = Math.max(0, target - best.percent);
  return { option, best, targetPercent: target, met: shortBy === 0, shortBy };
}

function checkOptions(
  requirement: OptionsRequirement,
  marks: ReadonlyArray<LevelledMark>,
): RequirementCheck {
  const options = requirement.options.map((option) => checkOption(option, marks));
  const ranked = [...options].sort(
    (a, b) => (a.shortBy ?? Number.POSITIVE_INFINITY) - (b.shortBy ?? Number.POSITIVE_INFINITY),
  );
  // `options` is non-empty (the schema requires one), so `ranked[0]` exists.
  const closest = ranked[0] as OptionCheck;
  return { requirement, met: closest.met, closest, options };
}

/**
 * "Any N other subjects at a level": counts subjects not already used for another requirement,
 * never Life Orientation. The check reports the N-th best of them, the one that decides it.
 */
function checkOthers(
  requirement: OtherSubjectsRequirement,
  marks: ReadonlyArray<LevelledMark>,
  used: ReadonlySet<SubjectId>,
): RequirementCheck {
  const { count, minLevel, minPercent } = requirement.otherSubjects;
  const pool = marks.filter((m) => m.subject !== LIFE_ORIENTATION && !used.has(m.subject));
  const option: SubjectOption = {
    subjects: pool.map((m) => m.subject),
    ...(minLevel === undefined ? {} : { minLevel }),
    ...(minPercent === undefined ? {} : { minPercent }),
  };
  const target = targetPercent(option);
  const deciding = [...pool].sort((a, b) => b.percent - a.percent)[count - 1] ?? null;
  const shortBy = deciding === null ? null : Math.max(0, target - deciding.percent);
  const closest: OptionCheck = {
    option,
    best: deciding,
    targetPercent: target,
    met: shortBy === 0,
    shortBy,
  };
  return { requirement, met: closest.met, closest, options: [closest] };
}

function checkRequirements(
  requirements: ReadonlyArray<SubjectRequirement>,
  marks: ReadonlyArray<LevelledMark>,
): RequirementCheck[] {
  const named = requirements.map((r) => (isOptionsRequirement(r) ? checkOptions(r, marks) : null));
  const used = new Set<SubjectId>(
    named.flatMap((c) => (c?.closest.best ? [c.closest.best.subject] : [])),
  );
  return requirements.map(
    (r, i) => named[i] ?? checkOthers(r as OtherSubjectsRequirement, marks, used),
  );
}

/** Within reach: the subject is taken, and no more than two levels short. */
function withinReach(check: RequirementCheck): boolean {
  return check.closest.shortBy !== null && check.closest.shortBy <= CLOSE_LEVELS * 10;
}

const MATHEMATICS: ReadonlyArray<SubjectId> = ['mathematics', 'technical-mathematics'];

/**
 * The programme's minimum for this learner: some universities publish a higher one for learners
 * who offer Mathematical Literacy instead of Mathematics (TUT).
 */
export function minimumScoreFor(
  programme: Programme,
  marks: ReadonlyArray<SubjectMark>,
): number | null {
  const literacyOnly =
    marks.some((m) => m.subject === 'mathematical-literacy') &&
    !marks.some((m) => MATHEMATICS.includes(m.subject));
  return literacyOnly && programme.minimumScoreWithMathematicalLiteracy !== undefined
    ? programme.minimumScoreWithMathematicalLiteracy
    : programme.minimumScore;
}

/** The subjects a programme names, as "one of these" groups, for methods that count them. */
export function requiredGroups(programme: Programme): SubjectId[][] {
  return programme.subjectRequirements
    .filter(isOptionsRequirement)
    .map((r) => [...new Set(r.options.flatMap((o) => o.subjects))]);
}

export function checkProgramme(
  programme: Programme,
  input: ReadonlyArray<SubjectMark>,
  method: ScoreMethod,
): ProgrammeCheck {
  if (method.universityId !== programme.universityId) {
    throw new RangeError(
      `${programme.id} is at ${programme.universityId}, but the score method is ${method.id}`,
    );
  }
  const marks = validateMarks(input);
  const score = method.score(marks, { requiredGroups: requiredGroups(programme) });
  const required = minimumScoreFor(programme, marks);
  const scoreGap = required === null ? 0 : Math.max(0, required - score.total);
  const requirements = checkRequirements(programme.subjectRequirements, marks);
  const projected = nscPass(marks);
  const passMet = meetsPass(projected, programme.requiredPass);

  const qualifies = scoreGap === 0 && passMet && requirements.every((r) => r.met);
  const close =
    !qualifies &&
    scoreGap <= method.closeMargin &&
    passRank(projected) >= passRank(programme.requiredPass) - 1 &&
    requirements.every((r) => r.met || withinReach(r));

  return {
    programme,
    verdict: qualifies ? 'qualifies' : close ? 'close' : 'not-yet',
    score,
    requiredScore: required,
    scoreGap,
    requirements,
    pass: { required: programme.requiredPass, projected, met: passMet },
  };
}

export interface ResultsGroups {
  /** Degrees the learner meets every minimum for. */
  readonly qualifyNow: ReadonlyArray<ProgrammeCheck>;
  /** Programmes within reach, with what to improve. */
  readonly close: ReadonlyArray<ProgrammeCheck>;
  /** Extended programmes, diplomas and higher certificates the learner meets. Never hidden. */
  readonly planB: ReadonlyArray<ProgrammeCheck>;
  /** Every programme the learner meets, degree or not: Grade 10's one group of them (G10-3). */
  readonly onTrack: ReadonlyArray<ProgrammeCheck>;
}

const DEGREES = new Set(['degree']);

/**
 * Sorts checks into Stage 1's three groups. A qualifying diploma or extended programme always
 * appears in Plan B, so a learner who doesn't qualify for a degree leaves with options, not a
 * dead end (planning.md §2.4).
 */
export function groupResults(checks: ReadonlyArray<ProgrammeCheck>): ResultsGroups {
  const byMargin = (a: ProgrammeCheck, b: ProgrammeCheck) =>
    a.scoreGap - b.scoreGap || a.programme.name.localeCompare(b.programme.name);
  return {
    qualifyNow: checks
      .filter((c) => c.verdict === 'qualifies' && DEGREES.has(c.programme.qualification))
      .sort(byMargin),
    close: checks.filter((c) => c.verdict === 'close').sort(byMargin),
    planB: checks
      .filter((c) => c.verdict === 'qualifies' && !DEGREES.has(c.programme.qualification))
      .sort(byMargin),
    onTrack: checks.filter((c) => c.verdict === 'qualifies').sort(byMargin),
  };
}
