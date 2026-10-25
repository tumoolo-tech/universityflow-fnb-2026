import { isQuietHour, nextSendableAt } from './quiet-hours';

/**
 * How often we may start a conversation with a learner (planning.md §7.2), as pure code:
 *
 * - **Normal weeks: at most 2 messages** in any seven days.
 * - **Exam periods: up to 1 a day** (7 in any seven days). A learner is in an exam period from
 *   a week before a paper until that paper ends.
 * - **Never above the learner's own cap** (1–7 a week), whatever the period.
 * - **At most one a day** (South African calendar day), even in exam periods.
 * - **Never in quiet hours** (21:00–07:00 SAST, quiet-hours.ts).
 * - **Never during a paper**, from an hour before it starts (travelling, settling in) until half
 *   an hour after it ends.
 *
 * Every week limit is over a rolling seven days, so it holds for any seven days you pick, not
 * just Monday to Sunday. Messages we start count towards it, whatever the channel; a reply to a
 * learner's own message (STOP's confirmation) is not one we started.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
export const NORMAL_WEEK_LIMIT = 2;
export const EXAM_WEEK_LIMIT = 7;
export const MIN_WEEKLY_CAP = 1;
export const MAX_WEEKLY_CAP = 7;
export const DEFAULT_WEEKLY_CAP = 2;
/** An exam period starts this long before a paper. */
export const EXAM_PERIOD_LEAD_MS = WEEK_MS;
export const PAPER_BUFFER_BEFORE_MS = 60 * 60 * 1000;
export const PAPER_BUFFER_AFTER_MS = 30 * 60 * 1000;
/** We look this far ahead for a slot; past it, the message is not worth sending. */
export const CADENCE_HORIZON_MS = 28 * DAY_MS;

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const QUIET_END_HOUR_MS = 7 * 60 * 60 * 1000;

/**
 * One paper the learner sits, or may sit. Phase 4b fills these from the NSC timetable matched to
 * the learner's subjects (packages/db `TimetablePaperSlots`).
 */
export interface PaperSlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
  /**
   * True for a paper we only suspect (an unverified date, a guessed exam year, every session
   * when we don't know the learner's subjects): it holds messages like any paper, but never
   * opens an exam period, so it can only make us quieter, never let more messages through.
   */
  readonly holdOnly?: boolean;
}

export interface CadenceInput {
  /** The moment of asking. */
  readonly now: Date;
  /** The earliest the message should go (a reminder's time). Default `now`. */
  readonly notBefore?: Date | undefined;
  /** The learner's own cap: messages in any seven days, 1–7. */
  readonly maxPerWeek: number;
  /** When messages we started were sent (or are being sent), any channel. */
  readonly recentSends: ReadonlyArray<Date>;
  readonly papers: ReadonlyArray<PaperSlot>;
}

export type CadenceDecision =
  | { readonly kind: 'now' }
  | { readonly kind: 'later'; readonly at: Date }
  | { readonly kind: 'never'; readonly reason: 'horizon' };

export class InvalidCadenceError extends Error {
  override readonly name = 'InvalidCadenceError';
}

export function validWeeklyCap(cap: unknown): cap is number {
  return (
    Number.isInteger(cap) && (cap as number) >= MIN_WEEKLY_CAP && (cap as number) <= MAX_WEEKLY_CAP
  );
}

/** True from a week before any paper until it ends. A hold-only paper never counts. */
export function inExamPeriod(at: Date, papers: ReadonlyArray<PaperSlot>): boolean {
  const t = at.getTime();
  return papers.some(
    (p) =>
      p.holdOnly !== true &&
      t >= p.startsAt.getTime() - EXAM_PERIOD_LEAD_MS &&
      t <= p.endsAt.getTime(),
  );
}

/** The most messages allowed in the seven days ending at `at`. */
export function weeklyLimit(
  at: Date,
  maxPerWeek: number,
  papers: ReadonlyArray<PaperSlot>,
): number {
  const period = inExamPeriod(at, papers) ? EXAM_WEEK_LIMIT : NORMAL_WEEK_LIMIT;
  return Math.min(maxPerWeek, period);
}

/** The paper (with its buffer) that `at` falls in, if any. */
export function paperAt(at: Date, papers: ReadonlyArray<PaperSlot>): PaperSlot | undefined {
  const t = at.getTime();
  return papers.find(
    (p) =>
      t >= p.startsAt.getTime() - PAPER_BUFFER_BEFORE_MS &&
      t < p.endsAt.getTime() + PAPER_BUFFER_AFTER_MS,
  );
}

/** The South African calendar day of an instant, as a day number. */
export function sastDay(at: Date): number {
  return Math.floor((at.getTime() + SAST_OFFSET_MS) / DAY_MS);
}

function nextSastMorning(at: Date): Date {
  return new Date((sastDay(at) + 1) * DAY_MS - SAST_OFFSET_MS + QUIET_END_HOUR_MS);
}

function checkInput(input: CadenceInput): void {
  const valid = (d: unknown) => d instanceof Date && !Number.isNaN(d.getTime());
  if (!valid(input.now)) throw new InvalidCadenceError('now must be a valid date');
  if (input.notBefore !== undefined && !valid(input.notBefore)) {
    throw new InvalidCadenceError('notBefore must be a valid date');
  }
  if (!validWeeklyCap(input.maxPerWeek)) {
    throw new InvalidCadenceError(
      `A weekly cap is a whole number from ${MIN_WEEKLY_CAP} to ${MAX_WEEKLY_CAP}`,
    );
  }
  if (!input.recentSends.every(valid)) throw new InvalidCadenceError('Send times must be dates');
  for (const p of input.papers) {
    if (!valid(p.startsAt) || !valid(p.endsAt) || p.endsAt < p.startsAt) {
      throw new InvalidCadenceError('A paper ends after it starts');
    }
  }
}

/**
 * When may the next message go? `now` (send it), a later time (try again then), or never within
 * the horizon (drop it). Each step only moves the candidate time forward, past the rule it
 * broke, so the answer is the earliest time that breaks none of them.
 */
export function nextAllowedSend(input: CadenceInput): CadenceDecision {
  checkInput(input);
  const { now, maxPerWeek, papers } = input;
  const sends = input.recentSends.map((d) => d.getTime()).sort((a, b) => a - b);
  const sendDays = new Set(input.recentSends.map(sastDay));
  const horizon = now.getTime() + CADENCE_HORIZON_MS;
  let t = new Date(Math.max(now.getTime(), input.notBefore?.getTime() ?? now.getTime()));

  for (;;) {
    if (t.getTime() > horizon) return { kind: 'never', reason: 'horizon' };
    if (isQuietHour(t)) {
      t = nextSendableAt(t);
      continue;
    }
    const paper = paperAt(t, papers);
    if (paper) {
      t = new Date(paper.endsAt.getTime() + PAPER_BUFFER_AFTER_MS);
      continue;
    }
    if (sendDays.has(sastDay(t))) {
      t = nextSastMorning(t);
      continue;
    }
    const limit = weeklyLimit(t, maxPerWeek, papers);
    const inWindow = sends.filter((s) => s > t.getTime() - WEEK_MS && s <= t.getTime());
    if (inWindow.length >= limit) {
      // Wait until enough of the oldest fall out of the seven days.
      t = new Date((inWindow[inWindow.length - limit] as number) + WEEK_MS);
      continue;
    }
    return t.getTime() <= now.getTime() ? { kind: 'now' } : { kind: 'later', at: t };
  }
}
