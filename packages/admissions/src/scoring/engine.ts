import {
  LIFE_ORIENTATION,
  type Provenance,
  type SubjectId,
  type UniversityId,
} from '@universityflow/catalogue';
import { byPercentDescending, type LevelledMark, type SubjectMark, validateMarks } from '../marks';

/**
 * The shared machinery behind every university's admission score.
 *
 * No two launch universities score the same way (planning.md §2.3), but every method so far is
 * "take the best N subjects, turn each percentage into points, add them up", varied by: the
 * points table, how Life Orientation is treated, which subjects must be among the N, and bonus
 * points. Each university's module states those choices as data with its source; this file
 * applies them. The AI never computes a score (hard rule 2).
 */

/** One row of a points table: a percentage at or above `min` earns `points`. */
export interface PointsBand {
  readonly min: number;
  readonly points: number;
}

/** Highest band first. Anything below the last band earns 0. */
export type PointsTable = ReadonlyArray<PointsBand>;

export function pointsFor(table: PointsTable, percent: number): number {
  for (const band of table) {
    if (percent >= band.min) return band.points;
  }
  return 0;
}

export type LifeOrientationRule =
  /** LO never counts. */
  | { readonly mode: 'excluded' }
  /** LO competes for a place among the counted subjects, scored on its own table. */
  | { readonly mode: 'own-table'; readonly table: PointsTable }
  /** LO is always added, on its own table, on top of the counted subjects. */
  | { readonly mode: 'added'; readonly table: PointsTable };

/** Why a subject was or wasn't counted. The interface turns these into words (hard rule 8). */
export type LineReason =
  | 'counted'
  | 'required-subject'
  | 'not-in-best'
  | 'life-orientation-excluded'
  | 'life-orientation-added';

export interface ScoreLine {
  readonly subject: SubjectId;
  readonly percent: number;
  readonly points: number;
  readonly counted: boolean;
  readonly reason: LineReason;
}

export interface Bonus {
  /** A stable id for the rule, so the score breakdown can explain it. */
  readonly rule: string;
  readonly subject: SubjectId;
  readonly points: number;
}

export interface ScoreResult {
  readonly methodId: string;
  readonly total: number;
  readonly maximum: number;
  readonly lines: ReadonlyArray<ScoreLine>;
  readonly bonuses: ReadonlyArray<Bonus>;
  /** True when fewer subjects were available than the method counts. */
  readonly incomplete: boolean;
}

export interface ScoreMethod {
  readonly id: string;
  readonly universityId: UniversityId;
  /** The university's own name for it: "APS", "FPS". */
  readonly label: string;
  readonly unit: 'points' | 'percent';
  readonly maximum: number;
  /**
   * How far below a programme's minimum still counts as "close" (planning.md §3, Stage 1).
   * A product choice, not an admission fact: it decides which courses we suggest working
   * towards, never whether a learner qualifies.
   */
  readonly closeMargin: number;
  /** Where the method is published (hard rule 3). */
  readonly source: Provenance;
  score(marks: ReadonlyArray<SubjectMark>, options?: ScoreOptions): ScoreResult;
}

export interface ScoreOptions {
  /**
   * The programme's required subjects, as groups (each group is "one of these"). Methods that
   * count a programme's required subjects first (UCT: "including any other required subject(s)
   * for the relevant programme") use them; others ignore them.
   */
  readonly requiredGroups?: ReadonlyArray<ReadonlyArray<SubjectId>>;
}

export interface BestOfConfig {
  readonly id: string;
  readonly universityId: UniversityId;
  readonly label: string;
  readonly subjectsCounted: number;
  /** Turns a percentage into points. Omit to add raw percentages (UCT's FPS). */
  readonly table?: PointsTable;
  readonly lifeOrientation: LifeOrientationRule;
  /** Groups of subjects one of which must be among the counted ones (e.g. English). */
  readonly mustInclude?: ReadonlyArray<ReadonlyArray<SubjectId>>;
  /** Count the programme's required subjects first (see `ScoreOptions`). */
  readonly includesProgrammeSubjects?: boolean;
  /** With raw percentages: a percentage below this scores nothing (UCT: below 40%). */
  readonly percentFloor?: number;
  /** Multiply a subject's points (UCT Science doubles Mathematics and Physical Sciences). */
  readonly weights?: Readonly<Partial<Record<SubjectId, number>>>;
  /** A subject's own points table, replacing `table` for it (Wits' English and Mathematics). */
  readonly subjectTables?: Readonly<Partial<Record<SubjectId, PointsTable>>>;
  /** Report the average of the counted subjects instead of their sum. */
  readonly average?: boolean;
  readonly bonus?: (marks: ReadonlyArray<LevelledMark>) => ReadonlyArray<Bonus>;
  readonly maximum: number;
  readonly closeMargin: number;
  readonly source: Provenance;
}

export function bestOfMethod(config: BestOfConfig): ScoreMethod {
  const toPoints = (subject: SubjectId, percent: number) => {
    const table = config.subjectTables?.[subject] ?? config.table;
    const raw = table
      ? pointsFor(table, percent)
      : percent < (config.percentFloor ?? 0)
        ? 0
        : percent;
    return raw * (config.weights?.[subject] ?? 1);
  };

  return {
    id: config.id,
    universityId: config.universityId,
    label: config.label,
    unit: config.table ? 'points' : 'percent',
    maximum: config.maximum,
    closeMargin: config.closeMargin,
    source: config.source,

    score(input, options = {}) {
      const marks = validateMarks(input);
      const lo = marks.find((m) => m.subject === LIFE_ORIENTATION);
      const rule = config.lifeOrientation;

      const loPoints = lo && rule.mode !== 'excluded' ? pointsFor(rule.table, lo.percent) : 0;
      const candidates = marks
        .filter((m) => m.subject !== LIFE_ORIENTATION)
        .map((m) => ({ mark: m, points: toPoints(m.subject, m.percent) }));
      if (lo && rule.mode === 'own-table') candidates.push({ mark: lo, points: loPoints });

      // Required subjects go in first, each the learner's best match for its group.
      const chosen = new Map<SubjectId, LineReason>();
      const groups = [
        ...(config.mustInclude ?? []),
        ...(config.includesProgrammeSubjects ? (options.requiredGroups ?? []) : []),
      ];
      for (const group of groups) {
        if (chosen.size >= config.subjectsCounted) break;
        const best = byPercentDescending(candidates.map((c) => c.mark)).find(
          (m) => group.includes(m.subject) && !chosen.has(m.subject),
        );
        if (best && !group.some((s) => chosen.has(s))) chosen.set(best.subject, 'required-subject');
      }
      // Then the highest-scoring of the rest. Points decide, not percentages: under a capped
      // LO table, an LO of 95% can be worth less than a 65% elsewhere.
      const rest = candidates
        .filter((c) => !chosen.has(c.mark.subject))
        .sort((a, b) => b.points - a.points || b.mark.percent - a.mark.percent);
      for (const c of rest) {
        if (chosen.size >= config.subjectsCounted) break;
        chosen.set(c.mark.subject, 'counted');
      }

      const lines: ScoreLine[] = candidates.map(({ mark, points }) => {
        const reason = chosen.get(mark.subject);
        return {
          subject: mark.subject,
          percent: mark.percent,
          points,
          counted: reason !== undefined,
          reason: reason ?? 'not-in-best',
        };
      });
      if (lo && rule.mode === 'excluded') {
        lines.push({
          subject: lo.subject,
          percent: lo.percent,
          points: 0,
          counted: false,
          reason: 'life-orientation-excluded',
        });
      }
      if (lo && rule.mode === 'added') {
        lines.push({
          subject: lo.subject,
          percent: lo.percent,
          points: loPoints,
          counted: true,
          reason: 'life-orientation-added',
        });
      }

      const bonuses = config.bonus?.(marks) ?? [];
      const sum =
        lines.filter((l) => l.counted).reduce((acc, l) => acc + l.points, 0) +
        bonuses.reduce((acc, b) => acc + b.points, 0);
      // An average is reported to one decimal place, as universities print them.
      const total = config.average ? Math.round((sum / config.subjectsCounted) * 10) / 10 : sum;

      return {
        methodId: config.id,
        total,
        maximum: config.maximum,
        lines: [...lines].sort((a, b) => Number(b.counted) - Number(a.counted)),
        bonuses,
        incomplete: chosen.size < config.subjectsCounted,
      };
    },
  };
}

/** The standard NSC 7-point table (levels 1–7), which most APS methods use as their points. */
export const NSC_LEVEL_TABLE: PointsTable = [
  { min: 80, points: 7 },
  { min: 70, points: 6 },
  { min: 60, points: 5 },
  { min: 50, points: 4 },
  { min: 40, points: 3 },
  { min: 30, points: 2 },
  { min: 0, points: 1 },
];
