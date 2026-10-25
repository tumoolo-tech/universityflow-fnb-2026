import { catalogueView, type ReportKind } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { SubjectMark } from './marks';
import { compareResults, recheck } from './recheck';
import { assessAll, type ProgrammeResult, type Results } from './results';

const DRAFTS = catalogueView(new Date('2026-10-13T08:00:00Z'), { includeDrafts: true });

const marks = (entries: Record<string, number>, kind: ReportKind = 'grade-11-final') => ({
  kind,
  marks: Object.entries(entries).map(([subject, percent]) => ({
    subject,
    percent,
  })) as SubjectMark[],
});

const GRADE_11 = marks({
  'english-fal': 62,
  'isizulu-hl': 74,
  mathematics: 58,
  'physical-sciences': 55,
  'life-sciences': 66,
  geography: 61,
  'life-orientation': 80,
});

const JUNE_BETTER = marks(
  {
    'english-fal': 72,
    'isizulu-hl': 80,
    mathematics: 71,
    'physical-sciences': 68,
    'life-sciences': 74,
    geography: 70,
    'life-orientation': 80,
  },
  'grade-12-june',
);

const row = (programmeId: string): ProgrammeResult => ({ programmeId }) as ProgrammeResult;
const results = (
  groups: Partial<Record<'qualifyNow' | 'onTrack' | 'close' | 'planB', string[]>>,
): Results => ({
  basis: groups.onTrack ? 'progress' : 'admission',
  passProjected: 'bachelor',
  qualifyNow: (groups.qualifyNow ?? []).map(row),
  onTrack: (groups.onTrack ?? []).map(row),
  close: (groups.close ?? []).map(row),
  planB: (groups.planB ?? []).map(row),
  checked: 10,
  includesDrafts: false,
});

describe('compareResults', () => {
  it('records every move between groups, ups first, with its direction', () => {
    const summary = compareResults(
      results({ qualifyNow: ['a', 'b'], close: ['c', 'd'], planB: ['e'] }),
      results({ qualifyNow: ['a', 'c'], close: ['b', 'f'], planB: ['d'] }),
    );
    expect(summary.moves).toEqual([
      { programmeId: 'c', from: 'close', to: 'qualify-now', direction: 'up' },
      { programmeId: 'd', from: 'close', to: 'plan-b', direction: 'up' },
      { programmeId: 'f', from: 'not-yet', to: 'close', direction: 'up' },
      { programmeId: 'b', from: 'qualify-now', to: 'close', direction: 'down' },
      { programmeId: 'e', from: 'plan-b', to: 'not-yet', direction: 'down' },
    ]);
    expect(summary.counts).toEqual({
      qualifyNow: { before: 2, after: 2 },
      onTrack: { before: 0, after: 0 },
      close: { before: 2, after: 2 },
      planB: { before: 1, after: 1 },
    });
    expect(summary.includesDrafts).toBe(false);
  });

  it('has no moves when nothing changed', () => {
    const same = results({ qualifyNow: ['a'], close: ['b'] });
    expect(compareResults(same, same).moves).toEqual([]);
  });
});

describe('recheck', () => {
  it('a better June report moves programmes up, and agrees with assessAll on both reports', () => {
    const summary = recheck(DRAFTS, GRADE_11, JUNE_BETTER);
    const before = assessAll(DRAFTS, GRADE_11);
    const after = assessAll(DRAFTS, JUNE_BETTER);
    expect(summary.counts.qualifyNow).toEqual({
      before: before.qualifyNow.length,
      after: after.qualifyNow.length,
    });
    expect(summary.counts.qualifyNow.after).toBeGreaterThan(summary.counts.qualifyNow.before);
    expect(summary.moves.length).toBeGreaterThan(0);
    expect(summary.moves.every((m) => m.direction === 'up')).toBe(true);
    for (const move of summary.moves.filter((m) => m.to === 'qualify-now')) {
      expect(after.qualifyNow.map((r) => r.programmeId)).toContain(move.programmeId);
    }
    expect(summary.includesDrafts).toBe(true);
  });

  it('a worse report moves programmes down', () => {
    const summary = recheck(DRAFTS, JUNE_BETTER, GRADE_11);
    expect(summary.moves.length).toBeGreaterThan(0);
    expect(summary.moves.every((m) => m.direction === 'down')).toBe(true);
  });

  it('the same marks change nothing', () => {
    expect(recheck(DRAFTS, GRADE_11, GRADE_11).moves).toEqual([]);
  });

  it('from Grade 10 to Grade 11 on the same marks, on track becomes qualify now: a move up (G10-3)', () => {
    const summary = recheck(DRAFTS, { ...GRADE_11, kind: 'grade-10-final' }, GRADE_11);
    expect(summary.counts.qualifyNow.before).toBe(0);
    expect(summary.counts.onTrack.before).toBeGreaterThan(0);
    const fromOnTrack = summary.moves.filter((m) => m.from === 'on-track');
    expect(fromOnTrack).toHaveLength(summary.counts.onTrack.before);
    expect(fromOnTrack.every((m) => m.direction === 'up')).toBe(true);
    expect(fromOnTrack.every((m) => m.to === 'qualify-now' || m.to === 'plan-b')).toBe(true);
  });
});
