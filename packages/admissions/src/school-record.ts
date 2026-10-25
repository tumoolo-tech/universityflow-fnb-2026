import { REPORT_KINDS, type ReportKind, type SubjectId } from '@universityflow/catalogue';
import { type SubjectMark, validateMarks } from './marks';
import { type AchievementLevel, LEVEL_FLOOR } from './nsc-levels';
import { nscPass, type PassOutcome } from './pass-type';

/**
 * The school record on *My results* (planning.md §18.7 C2): every report the learner confirmed,
 * from Grade 10 to the NSC, side by side; each subject's percentage and NSC achievement level; the
 * change since the earliest report; and the pass each report's marks would give (`nscPass`).
 *
 * Only confirmed reports reach this (hard rule 6): the caller passes the store's confirmed ones.
 * Every mark says who entered it. Today that is always the learner; official final NSC results
 * (C4, later) will be a second source, read-only, so the shape carries it from the start.
 *
 * Plain TypeScript with no DOM or Node (hard rule 11): both apps render this, the web on the
 * server and the app from `GET /api/results`, and neither works anything out (hard rule 2).
 */

/** Who entered a mark. `learner`: typed or read from their document, then confirmed by them. */
export type MarkSource = 'learner';

export interface SchoolRecordInput {
  readonly kind: ReportKind;
  readonly confirmedAt: Date;
  readonly marks: ReadonlyArray<SubjectMark>;
}

export interface SchoolRecordReport {
  readonly kind: ReportKind;
  /** ISO 8601, so the record travels as JSON unchanged. */
  readonly confirmedAt: string;
  readonly source: MarkSource;
  /** The pass these marks would give. Only the final NSC results earn one. */
  readonly pass: PassOutcome;
}

export interface SchoolRecordMark {
  readonly percent: number;
  readonly level: AchievementLevel;
  readonly source: MarkSource;
}

export interface SchoolRecordRow {
  readonly subject: SubjectId;
  /** One per report, in the reports' order; null where the report has no mark for the subject. */
  readonly marks: ReadonlyArray<SchoolRecordMark | null>;
  /** Newest minus earliest mark, in percentage points; null when only one report has it. */
  readonly change: number | null;
}

export interface SchoolRecord {
  readonly reports: ReadonlyArray<SchoolRecordReport>;
  readonly rows: ReadonlyArray<SchoolRecordRow>;
  /** The key to the levels, highest first, from the one table (`LEVEL_FLOOR`). */
  readonly levels: ReadonlyArray<{
    readonly level: AchievementLevel;
    readonly from: number;
    readonly to: number;
  }>;
}

const LEVELS_HIGH_FIRST: ReadonlyArray<AchievementLevel> = [7, 6, 5, 4, 3, 2, 1];

const LEVEL_KEY: SchoolRecord['levels'] = LEVELS_HIGH_FIRST.map((level) => ({
  level,
  from: LEVEL_FLOOR[level],
  to: level === 7 ? 100 : LEVEL_FLOOR[(level + 1) as AchievementLevel] - 1,
}));

export function schoolRecord(input: ReadonlyArray<SchoolRecordInput>): SchoolRecord {
  // The newest of each kind: confirming a report again is how a learner corrects it.
  const newest = new Map<ReportKind, SchoolRecordInput>();
  for (const report of input) {
    const seen = newest.get(report.kind);
    if (!seen || report.confirmedAt.getTime() > seen.confirmedAt.getTime()) {
      newest.set(report.kind, report);
    }
  }
  const chosen = REPORT_KINDS.flatMap((kind) => newest.get(kind) ?? []);
  // Every mark checked before it is shown: whole percentages from 0 to 100, known subjects.
  const levelled = chosen.map((r) => validateMarks(r.marks));

  const subjects: SubjectId[] = [];
  for (const marks of [...levelled].reverse()) {
    for (const m of marks) if (!subjects.includes(m.subject)) subjects.push(m.subject);
  }

  const rows = subjects.map((subject): SchoolRecordRow => {
    const marks = levelled.map((list): SchoolRecordMark | null => {
      const m = list.find((x) => x.subject === subject);
      return m ? { percent: m.percent, level: m.level, source: 'learner' } : null;
    });
    const held = marks.filter((m): m is SchoolRecordMark => m !== null);
    const first = held[0];
    const last = held[held.length - 1];
    return {
      subject,
      marks,
      change: held.length > 1 && first && last ? last.percent - first.percent : null,
    };
  });

  return {
    reports: chosen.map((r, i) => ({
      kind: r.kind,
      confirmedAt: r.confirmedAt.toISOString(),
      source: 'learner',
      pass: nscPass(levelled[i] ?? []),
    })),
    rows,
    levels: LEVEL_KEY,
  };
}
