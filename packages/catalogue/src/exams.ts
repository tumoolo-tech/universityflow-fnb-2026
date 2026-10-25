import { z } from 'zod';
import { sourced } from './provenance';
import { subjectId } from './subject-schema';
import type { SubjectId } from './subjects';

/**
 * The National Senior Certificate exam timetable, as sourced catalogue records (planning.md §11,
 * Phase 4b). A wrong exam date is as harmful as a wrong deadline, so every paper carries the
 * Department of Basic Education's (or a provincial department's) published timetable as its
 * source, and stays a draft until a person has checked it (hard rule 3).
 *
 * Times are South African Standard Time (Africa/Johannesburg, UTC+2 all year: South Africa has no
 * daylight saving), written as the timetable prints them. `paperSlot` turns one into instants.
 *
 * Pure data and arithmetic only: the mobile app imports this (hard rule 11).
 */

export const EXAM_SESSIONS = ['morning', 'afternoon'] as const;
export type ExamSession = (typeof EXAM_SESSIONS)[number];

/** The official sources a timetable may come from: the DBE, or a provincial department. */
export const EXAM_SOURCE_DOMAINS = [
  'education.gov.za',
  'dbe.gov.za',
  'education.gpg.gov.za',
  'wcedonline.westerncape.gov.za',
  'kzneducation.gov.za',
  'ecdoe.gov.za',
  'edu.limpopo.gov.za',
  'nwdoe.gov.za',
  'ncedu.ncape.gov.za',
  'fsdoe.fs.gov.za',
] as const;

/** Whether a source URL is on one of `EXAM_SOURCE_DOMAINS` (or a subdomain of one). */
export function isOfficialExamSource(sourceUrl: string): boolean {
  const host = new URL(sourceUrl).hostname;
  return EXAM_SOURCE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

const isoDate = z.iso.date();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'a 24-hour time, HH:MM');

export const examPaperSchema = sourced({
  id: slug,
  /** Which sitting: the final (October/November) NSC examination. */
  examination: z.enum(['nsc-final']),
  subjectId,
  /** Paper 1, 2 or 3, as the timetable numbers them. */
  paper: z.int().min(1).max(3),
  /** The day it is written, in South Africa. */
  date: isoDate,
  session: z.enum(EXAM_SESSIONS),
  /** Start time in SAST, as printed. */
  startsAt: clock,
  /** Writing time, as printed (reading time, if any, is included when the source includes it). */
  durationMinutes: z.int().min(30).max(360),
  /** Something research could not settle about this paper, shown to the verifier and learner. */
  note: z.string().min(3).optional(),
})
  .refine((p) => Number(p.date.slice(0, 4)) === p.academicYear, {
    message: 'An NSC paper is written in its own academic year',
  })
  .refine((p) => (p.session === 'morning') === p.startsAt < '12:00', {
    message: 'A morning paper starts before noon; an afternoon one after',
  });
export type ExamPaper = z.infer<typeof examPaperSchema>;

const SAST_OFFSET = '+02:00';

/** The instants a paper starts and ends. */
export function paperSlot(paper: Pick<ExamPaper, 'date' | 'startsAt' | 'durationMinutes'>): {
  readonly startsAt: Date;
  readonly endsAt: Date;
} {
  const startsAt = new Date(`${paper.date}T${paper.startsAt}:00${SAST_OFFSET}`);
  return { startsAt, endsAt: new Date(startsAt.getTime() + paper.durationMinutes * 60_000) };
}

/**
 * The year a learner writes their final NSC exams: this year in Grade 12, next year in Grade 11
 * (or when we don't know the grade: the first cohort is Grade 11, D1), and a year earlier for
 * each grade before (Grade 9 gave next year until G10-1). Matches `targetIntakeFor` in
 * packages/agent, one year earlier.
 */
export function nscExamYear(grade: number | null, today: Date): number {
  const year = today.getUTCFullYear();
  if (grade === null || grade < 9 || grade > 12) return year + 1;
  return year + (12 - grade);
}

/**
 * The exam years to stay quiet in (A12-02), for a window from `from` to `to`: the year for the
 * grade given **and** for the grade after it, at either end of the window. A grade typed at
 * sign-up goes stale every January (a Grade 11 learner who never updates it is in matric the
 * next year), and staying quiet in one year too many is never harmful. For suppression only:
 * what a learner is *shown* (a countdown) still uses `nscExamYear` for their grade.
 */
export function suppressionExamYears(grade: number | null, from: Date, to: Date): Set<number> {
  // Unknown counts as Grade 11 (`nscExamYear`), so the grade after it is 12.
  const next = grade === null ? 12 : grade + 1;
  const years = new Set<number>();
  for (const at of [from, to]) {
    years.add(nscExamYear(grade, at));
    years.add(nscExamYear(next, at));
  }
  return years;
}

/**
 * Every NSC exam session of `examYear` as one window, from the earliest start to the latest end
 * of the papers written in it (one morning and one afternoon window per exam day, at most). This
 * is what a learner whose subjects we don't know is protected by (A12-03): they still write in
 * one of these, so we stay quiet through all of them. Only sessions the timetable holds a paper
 * for are known; for suppression only, never shown.
 */
export function nscSessionSlots(
  papers: ReadonlyArray<ExamPaper>,
  examYear: number,
): Array<{ readonly startsAt: Date; readonly endsAt: Date }> {
  const sessions = new Map<string, { startsAt: Date; endsAt: Date }>();
  for (const p of papers) {
    if (p.academicYear !== examYear) continue;
    const slot = paperSlot(p);
    const key = `${p.date}:${p.session}`;
    const seen = sessions.get(key);
    sessions.set(
      key,
      seen
        ? {
            startsAt: slot.startsAt < seen.startsAt ? slot.startsAt : seen.startsAt,
            endsAt: slot.endsAt > seen.endsAt ? slot.endsAt : seen.endsAt,
          }
        : { startsAt: slot.startsAt, endsAt: slot.endsAt },
    );
  }
  return [...sessions.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * The grade that decides the exam year: a confirmed Grade 12 report says more about this year
 * than a grade typed at sign-up.
 */
export function examGrade(
  profileGrade: number | null,
  latestReportKind: string | null,
): number | null {
  return latestReportKind?.startsWith('grade-12') ? 12 : profileGrade;
}

/** A learner's own change to which subjects they write (their school differs, say). */
export interface ExamSubjectChoice {
  readonly subjectId: SubjectId;
  /** True: they write it although it isn't on their report. False: they don't write it. */
  readonly included: boolean;
}

/**
 * The subjects a learner writes: their confirmed subjects (hard rule 6: never values nobody has
 * confirmed), less the ones they removed, plus the ones they added. Life Orientation has no final
 * written paper, so it never has any.
 */
export function examSubjects(
  confirmed: ReadonlyArray<string>,
  choices: ReadonlyArray<ExamSubjectChoice>,
): SubjectId[] {
  const set = new Set<string>(confirmed);
  for (const c of choices) {
    if (c.included) set.add(c.subjectId);
    else set.delete(c.subjectId);
  }
  return [...set].filter((s): s is SubjectId => subjectId.safeParse(s).success).sort();
}

/**
 * The papers a learner sits in `examYear`, earliest first. Only papers the caller was given (a
 * catalogue view's to show, so unverified ones only in preview; `examPapersForSuppression` to
 * stay quiet for) and only for subjects they write.
 */
export function papersFor(
  papers: ReadonlyArray<ExamPaper>,
  subjects: ReadonlyArray<SubjectId>,
  examYear: number,
): ExamPaper[] {
  const writes = new Set<string>(subjects);
  return papers
    .filter((p) => p.academicYear === examYear && writes.has(p.subjectId))
    .sort(
      (a, b) =>
        paperSlot(a).startsAt.getTime() - paperSlot(b).startsAt.getTime() ||
        a.id.localeCompare(b.id),
    );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The South African calendar date of an instant, YYYY-MM-DD. */
export function sastDateOf(at: Date): string {
  return new Date(at.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Whole South African calendar days from `today` to the paper's day: 0 on the day itself. */
export function daysUntil(paper: Pick<ExamPaper, 'date'>, today: Date): number {
  return Math.round(
    (Date.parse(`${paper.date}T00:00:00Z`) - Date.parse(`${sastDateOf(today)}T00:00:00Z`)) / DAY_MS,
  );
}
