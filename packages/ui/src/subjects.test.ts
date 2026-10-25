import { subjects as t } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  barText,
  filterDoors,
  goalStatusText,
  higherBarText,
  needsText,
  type SubjectsCourse,
  type SubjectsResponse,
  universityGroups,
} from './subjects';

/**
 * My subjects' shared wording and filtering (G10-4, round 2): the web page and the app's screen
 * say the same thing from the same data. Nothing here decides admission: the numbers come from
 * packages/admissions; these only put them into content's words. Synthetic data only.
 */

const course = (id: string, universityId: string, universityName: string): SubjectsCourse => ({
  id,
  name: `Sample ${id}`,
  universityId,
  universityName,
  linkable: true,
});

const doors: NonNullable<SubjectsResponse['doors']> = {
  status: 'some-closed',
  checked: 6,
  open: 3,
  closed: 3,
  draft: false,
  byUniversity: [
    { id: 'a', name: 'A University', checked: 3, closed: 2 },
    { id: 'b', name: 'B University', checked: 3, closed: 1 },
  ],
  groups: [
    {
      subjects: ['Mathematics'],
      programmes: [
        { ...course('one', 'a', 'A University'), alsoNeeds: [] },
        { ...course('two', 'b', 'B University'), alsoNeeds: [] },
      ],
    },
    {
      subjects: ['Physical Sciences'],
      programmes: [{ ...course('three', 'a', 'A University'), alsoNeeds: [] }],
    },
  ],
  higherBar: [{ ...course('four', 'b', 'B University'), reasons: [] }],
  goal: null,
  swap: { drop: [], take: [] },
  whatIf: null,
};

describe('My subjects: shared wording', () => {
  it('says a bar with its level, its percentage, or both', () => {
    expect(barText({ subjects: ['Mathematics'], level: 4, percent: null })).toBe(
      t.atBar('Mathematics', t.level(4)),
    );
    expect(barText({ subjects: ['Mathematics'], level: null, percent: 50 })).toBe(
      t.atBar('Mathematics', t.percent(50)),
    );
    expect(
      barText({ subjects: ['Mathematics', 'Technical Mathematics'], level: 5, percent: 55 }),
    ).toBe(t.atBar(`Mathematics${t.or}Technical Mathematics`, t.levelAndPercent(5, 55)));
    expect(barText({ subjects: ['Mathematics'], level: null, percent: null })).toBe('Mathematics');
  });

  it('says why a bar is higher', () => {
    expect(
      higherBarText({ kind: 'score', subject: 'Mathematical Literacy', score: 26, otherwise: 24 }),
    ).toBe(t.higherScore('Mathematical Literacy', 26, 24));
    expect(
      higherBarText({
        kind: 'score',
        subject: 'Mathematical Literacy',
        score: 26,
        otherwise: null,
      }),
    ).toBe(t.higherScoreOnly('Mathematical Literacy', 26));
    expect(
      higherBarText({
        kind: 'option',
        yours: { subjects: ['Mathematical Literacy'], level: 6, percent: null },
        lowest: { subjects: ['Mathematics'], level: 4, percent: null },
      }),
    ).toBe(
      t.higherOption(
        t.atBar('Mathematical Literacy', t.level(6)),
        t.atBar('Mathematics', t.level(4)),
      ),
    );
  });

  it('joins what is needed: one of each list (or), every list (and)', () => {
    expect(needsText([['Mathematics', 'Technical Mathematics'], ['Physical Sciences']])).toBe(
      `Mathematics${t.or}Technical Mathematics${t.and}Physical Sciences`,
    );
  });

  it('says where the goal stands', () => {
    const goal = course('one', 'a', 'A University');
    expect(goalStatusText({ course: goal, status: 'open', needs: [] })).toBe(t.goalOpen);
    expect(goalStatusText({ course: goal, status: 'higher-bar', needs: [] })).toBe(t.goalHigher);
    expect(
      goalStatusText({ course: goal, status: 'closed', needs: [['Mathematics'], ['Physics']] }),
    ).toBe(t.goalNeeds(`Mathematics${t.and}Physics`));
  });
});

describe('My subjects: courses by university, and the university filter', () => {
  it('groups courses under their university, by name', () => {
    expect(
      universityGroups([
        course('x', 'b', 'B University'),
        course('y', 'a', 'A University'),
        course('z', 'b', 'B University'),
      ]).map((g) => [g.universityName, g.courses.map((c) => c.id)]),
    ).toEqual([
      ['A University', ['y']],
      ['B University', ['x', 'z']],
    ]);
  });

  it('shows everything with no filter, or with one it doesn’t know', () => {
    for (const id of [null, 'nowhere']) {
      const shown = filterDoors(doors, id);
      expect(shown.university).toBeNull();
      expect(shown.groups.map((g) => [g.programmes.length, g.total])).toEqual([
        [2, 2],
        [1, 1],
      ]);
      expect(shown.higherBar).toHaveLength(1);
    }
  });

  it('narrows the groups and the higher bar to one university, keeping each group’s total', () => {
    const shown = filterDoors(doors, 'b');
    expect(shown.university).toEqual({ id: 'b', name: 'B University' });
    expect(shown.groups.map((g) => [g.subjects, g.programmes.map((p) => p.id), g.total])).toEqual([
      [['Mathematics'], ['two'], 2],
    ]);
    expect(shown.higherBar.map((c) => c.id)).toEqual(['four']);
    expect(filterDoors(doors, 'a').higherBar).toEqual([]);
  });
});
