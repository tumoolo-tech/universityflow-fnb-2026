import { describe, expect, it } from 'vitest';
import {
  CADENCE_HORIZON_MS,
  type CadenceInput,
  DAY_MS,
  InvalidCadenceError,
  inExamPeriod,
  nextAllowedSend,
  PAPER_BUFFER_AFTER_MS,
  PAPER_BUFFER_BEFORE_MS,
  type PaperSlot,
  paperAt,
  sastDay,
  validWeeklyCap,
  WEEK_MS,
  weeklyLimit,
} from './cadence';
import { isQuietHour } from './quiet-hours';

/** 10:00 on a Tuesday in South Africa (08:00 UTC). */
const TUESDAY = new Date('2026-10-13T08:00:00Z');
const HOUR = 60 * 60 * 1000;
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

function input(overrides: Partial<CadenceInput> = {}): CadenceInput {
  return { now: TUESDAY, maxPerWeek: 2, recentSends: [], papers: [], ...overrides };
}

describe('nextAllowedSend: one rule at a time', () => {
  it('sends now when nothing stands in the way', () => {
    expect(nextAllowedSend(input())).toEqual({ kind: 'now' });
  });

  it('waits for the time asked for', () => {
    const later = at(TUESDAY, 3 * HOUR);
    expect(nextAllowedSend(input({ notBefore: later }))).toEqual({ kind: 'later', at: later });
    // A time already past is now.
    expect(nextAllowedSend(input({ notBefore: at(TUESDAY, -HOUR) }))).toEqual({ kind: 'now' });
  });

  it('never in quiet hours: 22:00 waits for 07:00', () => {
    const night = new Date('2026-10-13T20:00:00Z'); // 22:00 SAST
    expect(nextAllowedSend(input({ now: night }))).toEqual({
      kind: 'later',
      at: new Date('2026-10-14T05:00:00Z'),
    });
  });

  it('never during a paper, from an hour before until half an hour after', () => {
    const paper = { startsAt: at(TUESDAY, 30 * 60 * 1000), endsAt: at(TUESDAY, 3.5 * HOUR) };
    expect(paperAt(TUESDAY, [paper])).toBe(paper);
    expect(nextAllowedSend(input({ papers: [paper] }))).toEqual({
      kind: 'later',
      at: at(paper.endsAt, PAPER_BUFFER_AFTER_MS),
    });
    expect(paperAt(at(paper.startsAt, -PAPER_BUFFER_BEFORE_MS - 1), [paper])).toBeUndefined();
    expect(paperAt(at(paper.endsAt, PAPER_BUFFER_AFTER_MS), [paper])).toBeUndefined();
  });

  it('a paper that ends late pushes the message past quiet hours too', () => {
    const paper = { startsAt: at(TUESDAY, HOUR), endsAt: new Date('2026-10-13T18:45:00Z') };
    // Ends 20:45 SAST, buffer to 21:15, which is quiet: the next morning.
    expect(nextAllowedSend(input({ papers: [paper] }))).toEqual({
      kind: 'later',
      at: new Date('2026-10-14T05:00:00Z'),
    });
  });

  it('at most one a day: a second waits for tomorrow morning', () => {
    const sentThisMorning = new Date('2026-10-13T05:30:00Z');
    expect(nextAllowedSend(input({ recentSends: [sentThisMorning] }))).toEqual({
      kind: 'later',
      at: new Date('2026-10-14T05:00:00Z'),
    });
  });

  it('normal weeks: two in seven days, then wait for the oldest to fall out', () => {
    const sends = [at(TUESDAY, -6 * DAY_MS), at(TUESDAY, -2 * DAY_MS)];
    expect(nextAllowedSend(input({ recentSends: sends, maxPerWeek: 7 }))).toEqual({
      kind: 'later',
      at: at(TUESDAY, DAY_MS),
    });
  });

  it("never above the learner's own cap", () => {
    const sends = [at(TUESDAY, -3 * DAY_MS)];
    expect(nextAllowedSend(input({ recentSends: sends, maxPerWeek: 1 }))).toEqual({
      kind: 'later',
      at: at(TUESDAY, 4 * DAY_MS),
    });
  });

  it('exam periods: up to one a day, but still never above the cap', () => {
    const paper = { startsAt: at(TUESDAY, 5 * DAY_MS), endsAt: at(TUESDAY, 5 * DAY_MS + 3 * HOUR) };
    const sends = [1, 2, 3, 4].map((d) => at(TUESDAY, -d * DAY_MS));
    expect(inExamPeriod(TUESDAY, [paper])).toBe(true);
    expect(nextAllowedSend(input({ recentSends: sends, maxPerWeek: 7, papers: [paper] }))).toEqual({
      kind: 'now',
    });
    expect(
      nextAllowedSend(input({ recentSends: sends, maxPerWeek: 3, papers: [paper] })).kind,
    ).toBe('later');
    expect(weeklyLimit(TUESDAY, 7, [paper])).toBe(7);
    expect(weeklyLimit(TUESDAY, 3, [paper])).toBe(3);
    expect(weeklyLimit(TUESDAY, 7, [])).toBe(2);
  });

  it('a hold-only paper (a draft, a guessed year) keeps us quiet but never opens an exam period', () => {
    // Staying quiet for a paper we only suspect is safe; sending more because of it is not.
    const paper = {
      startsAt: at(TUESDAY, 5 * DAY_MS),
      endsAt: at(TUESDAY, 5 * DAY_MS + 3 * HOUR),
      holdOnly: true,
    };
    const sends = [1, 2].map((d) => at(TUESDAY, -d * DAY_MS));
    expect(inExamPeriod(TUESDAY, [paper])).toBe(false);
    expect(weeklyLimit(TUESDAY, 7, [paper])).toBe(2);
    expect(
      nextAllowedSend(input({ recentSends: sends, maxPerWeek: 7, papers: [paper] })).kind,
    ).toBe('later');
    // It still holds a message during the paper.
    expect(paperAt(at(paper.startsAt, HOUR), [paper])).toBe(paper);
  });

  it('the exam period ends with the last paper', () => {
    const paper = { startsAt: at(TUESDAY, -3 * HOUR), endsAt: at(TUESDAY, -HOUR) };
    expect(inExamPeriod(at(TUESDAY, -HOUR), [paper])).toBe(true);
    expect(inExamPeriod(TUESDAY, [paper])).toBe(false);
    expect(inExamPeriod(at(paper.startsAt, -WEEK_MS - 1), [paper])).toBe(false);
  });

  it('gives up past the horizon rather than queue a stale message', () => {
    const paper = { startsAt: TUESDAY, endsAt: at(TUESDAY, CADENCE_HORIZON_MS + DAY_MS) };
    expect(nextAllowedSend(input({ papers: [paper] }))).toEqual({
      kind: 'never',
      reason: 'horizon',
    });
  });

  it.each([
    ['a cap of 0', { maxPerWeek: 0 }],
    ['a cap of 8', { maxPerWeek: 8 }],
    ['a fractional cap', { maxPerWeek: 1.5 }],
    ['an invalid now', { now: new Date(Number.NaN) }],
    ['an invalid notBefore', { notBefore: new Date(Number.NaN) }],
    ['an invalid send time', { recentSends: [new Date(Number.NaN)] }],
    [
      'a paper that ends before it starts',
      { papers: [{ startsAt: TUESDAY, endsAt: at(TUESDAY, -1) }] },
    ],
  ])('refuses %s', (_label, overrides) => {
    expect(() => nextAllowedSend(input(overrides as Partial<CadenceInput>))).toThrow(
      InvalidCadenceError,
    );
  });

  it('knows a valid cap', () => {
    expect([0, 1, 7, 8, 2.5, '2'].map(validWeeklyCap)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

/** A small seeded random generator, so a failing year can be replayed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A year's papers: a June series and an October–November series, at 09:00 or 14:00 SAST. */
function examYear(random: () => number): PaperSlot[] {
  const papers: PaperSlot[] = [];
  const series = [
    ['2027-05-24', 26, 12],
    ['2027-10-20', 36, 22],
  ] as const;
  for (const [start, days, count] of series) {
    const first = new Date(`${start}T00:00:00Z`).getTime();
    for (let i = 0; i < count; i++) {
      const day = Math.floor(random() * days);
      const hourUtc = random() < 0.5 ? 7 : 12;
      const startsAt = new Date(first + day * DAY_MS + hourUtc * HOUR);
      papers.push({ startsAt, endsAt: new Date(startsAt.getTime() + (2 + random()) * HOUR) });
    }
  }
  return papers;
}

/**
 * A year of simulated weeks (planning.md §11, Phase 4 tests): a scheduler that wants to message
 * the learner every 47 minutes, asking `nextAllowedSend` each time and sending whenever it says
 * now. Whatever it wants, the rules must hold for every message that went.
 */
function simulateYear(seed: number, maxPerWeek: number) {
  const random = mulberry32(seed);
  const papers = examYear(random);
  const sends: Date[] = [];
  const laterAnswers: Array<{ asked: Date; at: Date; sendsThen: Date[] }> = [];
  const start = new Date('2027-01-01T00:00:00Z').getTime();
  const end = new Date('2028-01-01T00:00:00Z').getTime();
  for (let t = start; t < end; t += 47 * 60 * 1000) {
    const now = new Date(t);
    // Like the database, pass only the last eight days of sends.
    const recentSends = sends.filter((s) => s.getTime() > t - 8 * DAY_MS);
    const notBefore = random() < 0.2 ? new Date(t + random() * 3 * DAY_MS) : undefined;
    const decision = nextAllowedSend({ now, notBefore, maxPerWeek, recentSends, papers });
    if (decision.kind === 'now') sends.push(now);
    else if (decision.kind === 'later' && laterAnswers.length < 400 && random() < 0.05) {
      laterAnswers.push({ asked: now, at: decision.at, sendsThen: recentSends });
    }
  }
  return { papers, sends, laterAnswers };
}

describe('a simulated year, every cap from 1 to 7 (property tests)', () => {
  const cases = [1, 2, 3, 4, 5, 6, 7].flatMap((cap) => [
    [cap, 11 * cap],
    [cap, 1000 + cap],
  ]);

  it.each(cases)(
    'cap %i, seed %i: never above the cap, in quiet hours or during a paper',
    (cap, seed) => {
      const { papers, sends, laterAnswers } = simulateYear(seed, cap);
      const times = sends.map((s) => s.getTime());

      for (const send of sends) {
        expect(isQuietHour(send), `quiet hours: ${send.toISOString()}`).toBe(false);
        expect(paperAt(send, papers), `during a paper: ${send.toISOString()}`).toBeUndefined();
        // Any seven days starting at a send hold no more than the cap, and no more than two
        // outside an exam period.
        const week = times.filter((t) => t >= send.getTime() && t < send.getTime() + WEEK_MS);
        expect(week.length, `week from ${send.toISOString()}`).toBeLessThanOrEqual(cap);
        const before = times.filter((t) => t > send.getTime() - WEEK_MS && t <= send.getTime());
        if (!inExamPeriod(send, papers)) {
          expect(before.length, `normal week to ${send.toISOString()}`).toBeLessThanOrEqual(2);
        }
      }
      // One a day at most.
      expect(new Set(sends.map(sastDay)).size).toBe(sends.length);

      // And it isn't silent: at least one a week all year, and more in exam periods when allowed.
      expect(sends.length).toBeGreaterThanOrEqual(52 * Math.min(cap, 1));
      const busiest = Math.max(
        ...sends.map(
          (s) => times.filter((t) => t >= s.getTime() && t < s.getTime() + WEEK_MS).length,
        ),
      );
      expect(busiest).toBe(Math.min(cap, 7));

      // Every "later" answer names a time that would itself be allowed.
      for (const { asked, at: when, sendsThen } of laterAnswers) {
        expect(when.getTime()).toBeGreaterThan(asked.getTime());
        expect(
          nextAllowedSend({ now: when, maxPerWeek: cap, recentSends: sendsThen, papers }),
        ).toEqual({ kind: 'now' });
      }
    },
  );
});
