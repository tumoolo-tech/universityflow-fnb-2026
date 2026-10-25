import type { ReportKind } from '@universityflow/catalogue/client';
import { subjects as t } from '@universityflow/content/app';

/**
 * My subjects (G10-4): what `GET /api/me/subjects` returns and the web's page renders, so the two
 * apps read one shape. Built on the server from `subjectDoors` and `trySwap`
 * (packages/admissions); types only here (hard rule 11). Subjects and universities arrive by name:
 * the words around them are packages/content's.
 */

export interface SubjectsCourse {
  readonly id: string;
  readonly name: string;
  readonly universityId: string;
  /** The full name ("University of Johannesburg"), the owner's rule for course lists. */
  readonly universityName: string;
  /** The short name ("UJ"), for the university's mark beside the full name. */
  readonly universityShortName?: string;
  /** What I need has a page for it (`/results/what-i-need/<id>`): only courses it scores. */
  readonly linkable: boolean;
}

export interface SubjectsClosedCourse extends SubjectsCourse {
  /** The other requirements it misses, beyond its group's: one list of subject names each. */
  readonly alsoNeeds: ReadonlyArray<ReadonlyArray<string>>;
}

/** A subject option's bar: by name, at a level and/or a percentage (null when not set). */
export interface SubjectsBar {
  readonly subjects: ReadonlyArray<string>;
  readonly level: number | null;
  readonly percent: number | null;
}

/** Why a bar is higher, in the catalogue's numbers (`HigherBarReason` in packages/admissions). */
export type SubjectsHigherReason =
  | {
      readonly kind: 'score';
      readonly subject: string;
      readonly score: number;
      readonly otherwise: number | null;
    }
  | { readonly kind: 'option'; readonly yours: SubjectsBar; readonly lowest: SubjectsBar };

export interface SubjectsHigherCourse extends SubjectsCourse {
  readonly reasons: ReadonlyArray<SubjectsHigherReason>;
}

export interface SubjectsSubject {
  readonly id: string;
  readonly name: string;
}

/** "Try a different subject": the swap asked for, and what it would change. */
export interface SubjectsWhatIf {
  readonly drop: SubjectsSubject;
  readonly take: SubjectsSubject;
  readonly checked: number;
  readonly closed: number;
  /** Closed now, open after the swap. */
  readonly opened: ReadonlyArray<SubjectsCourse>;
  /** Open now, closed after the swap. */
  readonly closes: ReadonlyArray<SubjectsCourse>;
}

export interface SubjectsResponse {
  /** The report the subjects come from; null with no confirmed report (nothing is checked). */
  readonly report: { readonly kind: ReportKind } | null;
  readonly subjects: ReadonlyArray<SubjectsSubject>;
  readonly doors: {
    /** `unknown`: no course the learner may see, so no verdict (never "all open"). */
    readonly status: 'unknown' | 'open' | 'some-closed';
    readonly checked: number;
    readonly open: number;
    readonly closed: number;
    readonly draft: boolean;
    /** Each university with a course checked: by full name. */
    readonly byUniversity: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      /** The short name ("UJ"), for the university's mark. */
      readonly shortName?: string;
      readonly checked: number;
      readonly closed: number;
    }>;
    readonly groups: ReadonlyArray<{
      /** The subjects, one of which would meet the requirement these courses miss, by name. */
      readonly subjects: ReadonlyArray<string>;
      readonly programmes: ReadonlyArray<SubjectsClosedCourse>;
    }>;
    /** Open, but with a higher mark or score through the subjects taken. */
    readonly higherBar: ReadonlyArray<SubjectsHigherCourse>;
    /**
     * The learner's goal course, when they have one they may see: open, open with a higher bar, or
     * closed with the subjects it needs (one list per requirement missed).
     */
    readonly goal: {
      readonly course: SubjectsCourse;
      readonly status: 'open' | 'higher-bar' | 'closed';
      readonly needs: ReadonlyArray<ReadonlyArray<string>>;
    } | null;
    /** What "Try a different subject" may swap: out, any taken but Life Orientation; in, short. */
    readonly swap: {
      readonly drop: ReadonlyArray<SubjectsSubject>;
      readonly take: ReadonlyArray<SubjectsSubject>;
    };
    /** The what-if asked for (`?drop=&take=`), or null when none was, or it wasn't offered. */
    readonly whatIf: SubjectsWhatIf | null;
  } | null;
}

export type SubjectsDoors = NonNullable<SubjectsResponse['doors']>;
export type SubjectsGoal = NonNullable<SubjectsDoors['goal']>;

/*
 * Shared by the web page and the app's screen, so they say the same thing: pure functions that
 * put the server's numbers into content's words. Nothing here decides admission.
 */

/** "Mathematics or Technical Mathematics at level 4": an option's bar, as the catalogue sets it. */
export function barText(bar: SubjectsBar): string {
  const names = bar.subjects.join(t.or);
  if (bar.level !== null && bar.percent !== null) {
    return t.atBar(names, t.levelAndPercent(bar.level, bar.percent));
  }
  if (bar.level !== null) return t.atBar(names, t.level(bar.level));
  if (bar.percent !== null) return t.atBar(names, t.percent(bar.percent));
  return names;
}

/** Why a course's bar is higher through the subjects taken. */
export function higherBarText(reason: SubjectsHigherReason): string {
  if (reason.kind === 'option') {
    return t.higherOption(barText(reason.yours), barText(reason.lowest));
  }
  return reason.otherwise === null
    ? t.higherScoreOnly(reason.subject, reason.score)
    : t.higherScore(reason.subject, reason.score, reason.otherwise);
}

/** One subject from each list: the lists joined with "and", a list's subjects with "or". */
export function needsText(lists: ReadonlyArray<ReadonlyArray<string>>): string {
  return lists.map((names) => names.join(t.or)).join(t.and);
}

/** Where the goal course stands with the learner's subjects. */
export function goalStatusText(goal: SubjectsGoal): string {
  if (goal.status === 'open') return t.goalOpen;
  if (goal.status === 'higher-bar') return t.goalHigher;
  return t.goalNeeds(needsText(goal.needs));
}

/** Courses under their university's full name, the universities by name. */
export function universityGroups<C extends SubjectsCourse>(
  courses: ReadonlyArray<C>,
): Array<{ universityName: string; courses: C[] }> {
  const groups = new Map<string, C[]>();
  for (const course of courses) {
    groups.set(course.universityName, [...(groups.get(course.universityName) ?? []), course]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([universityName, list]) => ({ universityName, courses: list }));
}

/**
 * "Show courses at": the closed groups and the higher bar at one university, each group keeping
 * its whole count (`total`), groups with nothing there left out. An unknown id shows everything.
 * The verdict and "By university" are never filtered: the page's answer doesn't change.
 */
export function filterDoors(
  doors: SubjectsDoors,
  universityId: string | null | undefined,
): {
  university: { id: string; name: string } | null;
  groups: Array<SubjectsDoors['groups'][number] & { total: number }>;
  higherBar: ReadonlyArray<SubjectsHigherCourse>;
} {
  const row = doors.byUniversity.find((u) => u.id === universityId);
  const at = <C extends SubjectsCourse>(courses: ReadonlyArray<C>) =>
    row ? courses.filter((c) => c.universityId === row.id) : [...courses];
  return {
    university: row ? { id: row.id, name: row.name } : null,
    groups: doors.groups
      .map((g) => ({
        subjects: g.subjects,
        programmes: at(g.programmes),
        total: g.programmes.length,
      }))
      .filter((g) => g.programmes.length > 0),
    higherBar: at(doors.higherBar),
  };
}
