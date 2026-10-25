import type { Provenance } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { SubjectMark } from '../marks';
import { bestOfMethod, NSC_LEVEL_TABLE, type PointsTable, pointsFor } from './engine';

const SOURCE: Provenance = {
  sourceUrl: 'https://www.example.ac.za/prospectus.pdf',
  academicYear: 2027,
};

const MARKS: SubjectMark[] = [
  { subject: 'english-hl', percent: 72 },
  { subject: 'afrikaans-fal', percent: 55 },
  { subject: 'mathematics', percent: 81 },
  { subject: 'physical-sciences', percent: 68 },
  { subject: 'life-sciences', percent: 49 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 92 },
];

describe('pointsFor', () => {
  it('maps every percentage onto the NSC level table', () => {
    expect(pointsFor(NSC_LEVEL_TABLE, 100)).toBe(7);
    expect(pointsFor(NSC_LEVEL_TABLE, 80)).toBe(7);
    expect(pointsFor(NSC_LEVEL_TABLE, 79)).toBe(6);
    expect(pointsFor(NSC_LEVEL_TABLE, 30)).toBe(2);
    expect(pointsFor(NSC_LEVEL_TABLE, 29)).toBe(1);
    expect(pointsFor(NSC_LEVEL_TABLE, 0)).toBe(1);
  });

  it('gives 0 below the lowest band of a table that stops above 0', () => {
    expect(pointsFor([{ min: 40, points: 3 }], 39)).toBe(0);
  });
});

describe('bestOfMethod', () => {
  const base = {
    id: 'test-aps',
    universityId: 'up',
    label: 'APS',
    table: NSC_LEVEL_TABLE,
    maximum: 42,
    closeMargin: 3,
    source: SOURCE,
  } as const;

  it('adds the best six excluding Life Orientation', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'excluded' },
    });
    const result = method.score(MARKS);
    // 81→7, 72→6, 68→5, 63→5, 55→4, 49→3
    expect(result.total).toBe(30);
    expect(result.lines.filter((l) => l.counted)).toHaveLength(6);
    expect(result.lines.find((l) => l.subject === 'life-orientation')).toMatchObject({
      counted: false,
      reason: 'life-orientation-excluded',
    });
    expect(result.incomplete).toBe(false);
  });

  it('leaves the weakest subject out when there are more than six', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 5,
      lifeOrientation: { mode: 'excluded' },
    });
    const result = method.score(MARKS);
    expect(result.lines.find((l) => l.subject === 'life-sciences')).toMatchObject({
      counted: false,
      reason: 'not-in-best',
    });
    expect(result.total).toBe(27);
  });

  it('lets a capped Life Orientation compete, but only for what its points are worth', () => {
    const capped: PointsTable = [
      { min: 90, points: 4 },
      { min: 80, points: 3 },
      { min: 70, points: 2 },
      { min: 60, points: 1 },
    ];
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 7,
      lifeOrientation: { mode: 'own-table', table: capped },
    });
    const result = method.score(MARKS);
    // LO at 92% earns 4: it counts as the 7th subject.
    expect(result.lines.find((l) => l.subject === 'life-orientation')).toMatchObject({
      counted: true,
      points: 4,
    });
    expect(result.total).toBe(34);
  });

  it('prefers a stronger subject over LO when LO is worth fewer points', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'own-table', table: [{ min: 90, points: 1 }] },
    });
    const result = method.score(MARKS);
    expect(result.lines.find((l) => l.subject === 'life-orientation')?.counted).toBe(false);
    expect(result.total).toBe(30);
  });

  it('can add Life Orientation on top of the counted subjects', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'added', table: [{ min: 50, points: 1 }] },
    });
    const result = method.score(MARKS);
    expect(result.total).toBe(31);
    expect(result.lines.find((l) => l.subject === 'life-orientation')?.reason).toBe(
      'life-orientation-added',
    );
  });

  it('forces a required subject in even when it is not among the best', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 5,
      lifeOrientation: { mode: 'excluded' },
      mustInclude: [['life-sciences']],
    });
    const result = method.score(MARKS);
    expect(result.lines.find((l) => l.subject === 'life-sciences')).toMatchObject({
      counted: true,
      reason: 'required-subject',
    });
    // 49→3 replaces 55→4.
    expect(result.total).toBe(26);
  });

  it('adds raw percentages when there is no table', () => {
    const { table: _table, ...withoutTable } = base;
    const method = bestOfMethod({
      ...withoutTable,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'excluded' },
      maximum: 600,
    });
    const result = method.score(MARKS);
    expect(method.unit).toBe('percent');
    expect(result.total).toBe(81 + 72 + 68 + 63 + 55 + 49);
  });

  it('adds bonus points from the method rule', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'excluded' },
      bonus: (marks) =>
        marks
          .filter((m) => m.subject === 'mathematics' && m.percent >= 80)
          .map((m) => ({ rule: 'maths-80', subject: m.subject, points: 2 })),
    });
    const result = method.score(MARKS);
    expect(result.bonuses).toEqual([{ rule: 'maths-80', subject: 'mathematics', points: 2 }]);
    expect(result.total).toBe(32);
  });

  it('flags an incomplete report rather than inventing missing subjects', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'excluded' },
    });
    const result = method.score(MARKS.slice(0, 3));
    expect(result.incomplete).toBe(true);
    expect(result.total).toBe(6 + 4 + 7);
  });

  it('refuses invalid marks', () => {
    const method = bestOfMethod({
      ...base,
      subjectsCounted: 6,
      lifeOrientation: { mode: 'excluded' },
    });
    expect(() => method.score([{ subject: 'mathematics', percent: 120 }])).toThrow();
  });
});
