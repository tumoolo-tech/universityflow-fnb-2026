import {
  type CatalogueView,
  isDraft,
  isOptionsRequirement,
  LIFE_ORIENTATION,
  type Programme,
  type SubjectId,
  type SubjectOption,
  type UniversityId,
} from '@universityflow/catalogue';
import { minimumScoreFor, targetPercent } from './eligibility';

/**
 * "Do my subjects keep doors open?" (planning.md §9 item 7, §18.3 G10-4): for the subjects a
 * learner takes, which courses no marks could open, because a requirement names only subjects
 * they don't take. Marks play no part: this is the Grade 9–10 subject-choice warning
 * ("Mathematical Literacy closes most science and commerce degrees"), worked out from the
 * catalogue's own requirements (hard rule 2), never from the model.
 *
 * The courses are those in the view, so in production only verified ones (hard rule 3). With no
 * course or no subject to check, the answer is `unknown`, never "every door is open".
 */

export interface DoorGroup {
  /** Taking one of these subjects would meet the requirement that closes these courses. */
  readonly subjects: ReadonlyArray<SubjectId>;
  /** By university, then name. */
  readonly programmes: ReadonlyArray<Programme>;
}

export interface SubjectDoors {
  readonly status: 'unknown' | 'open' | 'some-closed';
  /** Courses checked. */
  readonly checked: number;
  readonly open: number;
  /** Courses closed by at least one requirement (each counted once). */
  readonly closed: number;
  /** Closed courses by the subject that would open them, the biggest group first. */
  readonly groups: ReadonlyArray<DoorGroup>;
  /**
   * Open courses whose bar is higher through the subjects taken: a requirement met only by an
   * option with a higher minimum than another (Mathematical Literacy at 6 for Mathematics at 4),
   * or a higher minimum score (TUT's with Mathematical Literacy).
   */
  readonly higherBar: ReadonlyArray<Programme>;
  /** Some course counted is a draft (a preview, never production). */
  readonly draft: boolean;
  /** Courses checked and closed at each university, by university id ("By university"). */
  readonly byUniversity: ReadonlyArray<UniversityDoors>;
  /**
   * Each closed course with every requirement it misses, as the subjects that would meet it: a
   * course closed by two requirements "also needs" the other one. By university, then name.
   */
  readonly closedCourses: ReadonlyArray<ClosedCourse>;
  /** Why each `higherBar` course's bar is higher, in the catalogue's own numbers; same order. */
  readonly higherBarReasons: ReadonlyArray<HigherBarCourse>;
}

export interface UniversityDoors {
  readonly universityId: UniversityId;
  readonly checked: number;
  readonly closed: number;
}

export interface ClosedCourse {
  readonly programme: Programme;
  /** One set per requirement missed: taking one subject of each set would meet it. */
  readonly missing: ReadonlyArray<ReadonlyArray<SubjectId>>;
}

/**
 * `score`: a higher minimum score with this subject (`minimumScoreWithMathematicalLiteracy`), and
 * the one otherwise (null when the course sets none otherwise). `option`: the requirement is met
 * only by an option with a higher minimum (`yours`) than its lowest (`lowest`).
 */
export type HigherBarReason =
  | {
      readonly kind: 'score';
      readonly subject: SubjectId;
      readonly score: number;
      readonly otherwise: number | null;
    }
  | { readonly kind: 'option'; readonly yours: SubjectOption; readonly lowest: SubjectOption };

export interface HigherBarCourse {
  readonly programme: Programme;
  readonly reasons: ReadonlyArray<HigherBarReason>;
}

const byUniversityThenName = (a: Programme, b: Programme) =>
  a.universityId.localeCompare(b.universityId) || a.name.localeCompare(b.name);

/** The option with the lowest bar; the first such, as the catalogue lists them. */
function easiest(options: ReadonlyArray<SubjectOption>): SubjectOption | undefined {
  return options.reduce<SubjectOption | undefined>(
    (best, o) => (best === undefined || targetPercent(o) < targetPercent(best) ? o : best),
    undefined,
  );
}

/** One course against the subjects taken: the requirements it misses, and why its bar is higher. */
function checkCourse(
  programme: Programme,
  subjects: ReadonlyArray<SubjectId>,
  taken: ReadonlySet<SubjectId>,
): { missing: SubjectId[][]; reasons: HigherBarReason[] } {
  const missing: SubjectId[][] = [];
  const reasons: HigherBarReason[] = [];
  const score = minimumScoreFor(
    programme,
    subjects.map((subject) => ({ subject, percent: 0 })),
  );
  if (score !== programme.minimumScore && score !== null) {
    // `minimumScoreFor` is higher only for Mathematical Literacy without Mathematics (TUT).
    reasons.push({
      kind: 'score',
      subject: 'mathematical-literacy',
      score,
      otherwise: programme.minimumScore,
    });
  }
  for (const requirement of programme.subjectRequirements.filter(isOptionsRequirement)) {
    const options = requirement.options.filter((o) => o.subjects.some((s) => taken.has(s)));
    const lowest = easiest(requirement.options);
    const yours = easiest(options);
    if (!yours) {
      missing.push([...new Set(requirement.options.flatMap((o) => o.subjects))].sort());
    } else if (lowest && targetPercent(yours) > targetPercent(lowest)) {
      reasons.push({ kind: 'option', yours, lowest });
    }
  }
  return { missing, reasons };
}

export function subjectDoors(
  view: CatalogueView,
  subjects: ReadonlyArray<SubjectId>,
): SubjectDoors {
  const taken = new Set(subjects);
  const programmes = taken.size === 0 ? [] : view.programmes;
  const groups = new Map<string, { subjects: SubjectId[]; programmes: Programme[] }>();
  const higherBar: HigherBarCourse[] = [];
  const closedCourses: ClosedCourse[] = [];
  const universities = new Map<UniversityId, { checked: number; closed: number }>();

  for (const programme of programmes) {
    const { missing, reasons } = checkCourse(programme, subjects, taken);
    for (const needed of missing) {
      const key = needed.join('|');
      const group = groups.get(key) ?? { subjects: needed, programmes: [] };
      group.programmes.push(programme);
      groups.set(key, group);
    }
    const tally = universities.get(programme.universityId) ?? { checked: 0, closed: 0 };
    tally.checked += 1;
    if (missing.length > 0) {
      tally.closed += 1;
      closedCourses.push({ programme, missing });
    } else if (reasons.length > 0) {
      higherBar.push({ programme, reasons });
    }
    universities.set(programme.universityId, tally);
  }

  const checked = programmes.length;
  const closed = closedCourses.length;
  const higherBarReasons = higherBar.sort((a, b) => byUniversityThenName(a.programme, b.programme));
  return {
    status: checked === 0 ? 'unknown' : closed > 0 ? 'some-closed' : 'open',
    checked,
    open: checked - closed,
    closed,
    groups: [...groups.values()]
      .map((g) => ({ subjects: g.subjects, programmes: g.programmes.sort(byUniversityThenName) }))
      .sort(
        (a, b) =>
          b.programmes.length - a.programmes.length ||
          (a.subjects[0] ?? '').localeCompare(b.subjects[0] ?? ''),
      ),
    higherBar: higherBarReasons.map((h) => h.programme),
    draft: view.includesDrafts && programmes.some(isDraft),
    byUniversity: [...universities.entries()]
      .map(([universityId, tally]) => ({ universityId, ...tally }))
      .sort((a, b) => a.universityId.localeCompare(b.universityId)),
    closedCourses: closedCourses.sort((a, b) => byUniversityThenName(a.programme, b.programme)),
    higherBarReasons,
  };
}

/**
 * "Try a different subject" (G10-4): the subjects a learner may swap out (every one they take
 * but Life Orientation, which every learner takes) and the ones they may swap in: only the
 * subjects a closed course's requirement names (the owner's decision 3), so the list is short
 * and comes from the catalogue. Whether a school allows the combination is not known here (the
 * catalogue has no subject-combination rules), so a page must say it is a what-if.
 */
export function swapChoices(
  doors: SubjectDoors,
  subjects: ReadonlyArray<SubjectId>,
): { readonly drop: ReadonlyArray<SubjectId>; readonly take: ReadonlyArray<SubjectId> } {
  const taken = new Set(subjects);
  return {
    drop: subjects.filter((s) => s !== LIFE_ORIENTATION),
    take: [...new Set(doors.groups.flatMap((g) => g.subjects))].filter((s) => !taken.has(s)).sort(),
  };
}

export interface SubjectSwap {
  readonly drop: SubjectId;
  readonly take: SubjectId;
  /** The check on the swapped subjects. */
  readonly doors: SubjectDoors;
  /** Closed now, open after the swap. By university, then name. */
  readonly opened: ReadonlyArray<Programme>;
  /** Open now, closed after the swap. By university, then name. */
  readonly closes: ReadonlyArray<Programme>;
}

/**
 * The what-if: the same check on the subjects with `drop` swapped for `take`. Null for anything
 * `swapChoices` doesn't offer (an unknown id, Life Orientation, a subject already taken), so a
 * value from an address is never echoed back. The learner's own subjects are never changed.
 */
export function trySwap(
  view: CatalogueView,
  subjects: ReadonlyArray<SubjectId>,
  drop: string,
  take: string,
): SubjectSwap | null {
  const before = subjectDoors(view, subjects);
  const choices = swapChoices(before, subjects);
  const dropId = choices.drop.find((s) => s === drop);
  const takeId = choices.take.find((s) => s === take);
  if (!dropId || !takeId) return null;
  const doors = subjectDoors(view, [...subjects.filter((s) => s !== dropId), takeId]);
  const closedBefore = new Set(before.closedCourses.map((c) => c.programme.id));
  const closedAfter = new Set(doors.closedCourses.map((c) => c.programme.id));
  return {
    drop: dropId,
    take: takeId,
    doors,
    opened: before.closedCourses
      .filter((c) => !closedAfter.has(c.programme.id))
      .map((c) => c.programme),
    closes: doors.closedCourses
      .filter((c) => !closedBefore.has(c.programme.id))
      .map((c) => c.programme),
  };
}
