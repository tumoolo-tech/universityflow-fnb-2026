import {
  type CatalogueView,
  catalogueView,
  ENGLISH,
  either,
  type Programme,
  requires,
  type UniversityId,
} from '@universityflow/catalogue';
import type { ConfirmedReport } from '@universityflow/db';
import { describe, expect, it } from 'vitest';
import { subjectsResponse } from '@/lib/server/subjects';

/**
 * What My subjects is built from (G10-4, round 2): `subjectsResponse` puts `subjectDoors` and
 * `trySwap` (packages/admissions, where the rules are tested) into the shape both apps read, by
 * name. It decides nothing itself. Synthetic records only.
 */

const NOW = new Date('2026-10-22T08:00:00Z');
const PREVIEW = catalogueView(NOW, { includeDrafts: true });
const PRODUCTION = catalogueView(NOW, { includeDrafts: false });

function programme(id: string, overrides: Partial<Programme> = {}): Programme {
  return {
    id,
    universityId: 'wits' as UniversityId,
    name: `Sample ${id}`,
    faculty: 'Test',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: null,
    requiredPass: 'bachelor',
    subjectRequirements: [],
    nbt: 'none',
    selection: null,
    closesOn: null,
    sourceUrl: 'https://www.example.ac.za/p.pdf',
    academicYear: 2027,
    ...overrides,
  };
}

const ENGINEERING = programme('engineering', {
  subjectRequirements: [
    requires([...ENGLISH], { level: 5 }),
    requires(['mathematics'], { level: 5 }),
    requires(['physical-sciences'], { level: 5 }),
  ],
});
const COMMERCE = programme('commerce', {
  universityId: 'uj' as UniversityId,
  subjectRequirements: [requires(['mathematics'], { level: 4 })],
});
const ARTS = programme('arts', {
  subjectRequirements: [requires([...ENGLISH], { level: 4 })],
});
const DIPLOMA = programme('diploma', {
  universityId: 'tut' as UniversityId,
  qualification: 'diploma',
  minimumScore: 24,
  minimumScoreWithMathematicalLiteracy: 26,
  subjectRequirements: [
    either(
      requires(['mathematics', 'technical-mathematics'], { level: 4 }),
      requires(['mathematical-literacy'], { level: 6 }),
    ),
  ],
});

const view = (base: CatalogueView, ...programmes: Programme[]): CatalogueView => ({
  ...base,
  programmes,
});
const ALL = view(PREVIEW, ENGINEERING, COMMERCE, ARTS, DIPLOMA);

const report = (subjects: string[]): ConfirmedReport => ({
  id: 'report-1',
  kind: 'grade-10-final',
  confirmedAt: NOW,
  marks: subjects.map((subject) => ({ subject, percent: 60 })),
});
const MATHS_LIT = report([
  'english-hl',
  'isizulu-fal',
  'mathematical-literacy',
  'life-sciences',
  'geography',
  'life-orientation',
]);

const nameOf = (v: CatalogueView, id: string) => v.universities.find((u) => u.id === id)?.name;

describe('subjectsResponse (G10-4)', () => {
  it('checks nothing without a confirmed report, and says nothing else either', () => {
    expect(subjectsResponse(ALL, null)).toEqual({ report: null, subjects: [], doors: null });
    expect(
      subjectsResponse(ALL, null, { goalId: 'commerce', drop: 'english-hl', take: 'mathematics' }),
    ).toEqual({ report: null, subjects: [], doors: null });
  });

  it('passes the open count through, for the verdict’s meter', () => {
    const doors = subjectsResponse(ALL, MATHS_LIT).doors;
    expect(doors).toMatchObject({ status: 'some-closed', checked: 4, open: 2, closed: 2 });
  });

  it('counts each university by its full name, sorted by name', () => {
    const doors = subjectsResponse(ALL, MATHS_LIT).doors;
    const rows = [
      { id: 'tut', name: nameOf(ALL, 'tut'), shortName: 'TUT', checked: 1, closed: 0 },
      { id: 'uj', name: nameOf(ALL, 'uj'), shortName: 'UJ', checked: 1, closed: 1 },
      { id: 'wits', name: nameOf(ALL, 'wits'), shortName: 'Wits', checked: 2, closed: 1 },
    ].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    expect(doors?.byUniversity).toEqual(rows);
    for (const row of rows) expect(row.name).toMatch(/University/);
  });

  it('says what else a closed course needs, beyond its group’s subject', () => {
    const doors = subjectsResponse(ALL, MATHS_LIT).doors;
    const maths = doors?.groups.find((g) => g.subjects.includes('Mathematics'));
    expect(maths?.programmes.map((p) => [p.id, p.alsoNeeds])).toEqual([
      ['commerce', []],
      ['engineering', [['Physical Sciences']]],
    ]);
    const physics = doors?.groups.find((g) => g.subjects.includes('Physical Sciences'));
    expect(physics?.programmes.map((p) => [p.id, p.alsoNeeds])).toEqual([
      ['engineering', [['Mathematics']]],
    ]);
    expect(maths?.programmes[0]).toMatchObject({
      universityId: 'uj',
      universityName: nameOf(ALL, 'uj'),
    });
  });

  it('gives each higher bar its reasons by name', () => {
    const doors = subjectsResponse(ALL, MATHS_LIT).doors;
    expect(doors?.higherBar.map((c) => [c.id, c.reasons])).toEqual([
      [
        'diploma',
        [
          { kind: 'score', subject: 'Mathematical Literacy', score: 26, otherwise: 24 },
          {
            kind: 'option',
            yours: { subjects: ['Mathematical Literacy'], level: 6, percent: null },
            lowest: { subjects: ['Mathematics', 'Technical Mathematics'], level: 4, percent: null },
          },
        ],
      ],
    ]);
  });

  it('links a course to What I need only when What I need can show it (hard rule 3)', () => {
    const preview = subjectsResponse(ALL, MATHS_LIT).doors;
    expect(preview?.groups.flatMap((g) => g.programmes).every((p) => p.linkable)).toBe(true);
    // In production every score method is still unverified, so What I need shows none of them.
    const production = subjectsResponse(view(PRODUCTION, COMMERCE), MATHS_LIT).doors;
    expect(production?.groups[0]?.programmes[0]?.linkable).toBe(false);
  });

  it('reports the goal course open, open with a higher bar, or closed with what it needs', () => {
    const closed = subjectsResponse(ALL, MATHS_LIT, { goalId: 'engineering' }).doors?.goal;
    expect(closed).toMatchObject({
      course: { id: 'engineering', universityName: nameOf(ALL, 'wits') },
      status: 'closed',
      needs: [['Mathematics'], ['Physical Sciences']],
    });
    expect(subjectsResponse(ALL, MATHS_LIT, { goalId: 'arts' }).doors?.goal).toMatchObject({
      status: 'open',
      needs: [],
    });
    expect(subjectsResponse(ALL, MATHS_LIT, { goalId: 'diploma' }).doors?.goal?.status).toBe(
      'higher-bar',
    );
  });

  it('has no goal row without a goal, or for a goal the learner may not see', () => {
    expect(subjectsResponse(ALL, MATHS_LIT).doors?.goal).toBeNull();
    expect(subjectsResponse(ALL, MATHS_LIT, { goalId: 'not-a-course' }).doors?.goal).toBeNull();
  });

  it('offers the what-if’s subjects by name: out, every one taken but Life Orientation; in, short', () => {
    const swap = subjectsResponse(ALL, MATHS_LIT).doors?.swap;
    expect(swap?.drop.map((s) => s.id)).not.toContain('life-orientation');
    expect(swap?.drop).toContainEqual({
      id: 'mathematical-literacy',
      name: 'Mathematical Literacy',
    });
    expect(swap?.take).toEqual([
      { id: 'mathematics', name: 'Mathematics' },
      { id: 'physical-sciences', name: 'Physical Sciences' },
    ]);
  });

  it('answers a what-if from the address, without changing the real verdict', () => {
    const data = subjectsResponse(ALL, MATHS_LIT, {
      drop: 'mathematical-literacy',
      take: 'mathematics',
    });
    expect(data.doors).toMatchObject({ checked: 4, closed: 2 });
    expect(data.subjects.map((s) => s.id)).toContain('mathematical-literacy');
    expect(data.doors?.whatIf).toMatchObject({
      drop: { id: 'mathematical-literacy', name: 'Mathematical Literacy' },
      take: { id: 'mathematics', name: 'Mathematics' },
      checked: 4,
      closed: 1,
      closes: [],
    });
    expect(data.doors?.whatIf?.opened.map((c) => c.id)).toEqual(['commerce']);
  });

  it('ignores a what-if it doesn’t offer: no throw, nothing echoed back', () => {
    for (const [drop, take] of [
      ['life-orientation', 'mathematics'],
      ['mathematical-literacy', '<b>maths</b>'],
      ['', ''],
      [null, 'mathematics'],
    ] as const) {
      const data = subjectsResponse(ALL, MATHS_LIT, { drop, take });
      expect(data.doors?.whatIf).toBeNull();
      expect(JSON.stringify(data)).not.toContain('<b>');
    }
  });
});
