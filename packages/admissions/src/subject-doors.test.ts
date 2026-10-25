import {
  type CatalogueView,
  catalogueView,
  ENGLISH,
  either,
  otherSubjects,
  type Programme,
  requires,
  type SubjectId,
  type UniversityId,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { subjectDoors, swapChoices, trySwap } from './subject-doors';

const TODAY = new Date('2026-10-22T08:00:00Z');
const DRAFTS = catalogueView(TODAY, { includeDrafts: true });
const VERIFIED_ONLY = catalogueView(TODAY, { includeDrafts: false });

function programme(id: string, overrides: Partial<Programme> = {}): Programme {
  return {
    id,
    universityId: 'wits' as UniversityId,
    name: id,
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

const view = (...programmes: Programme[]): CatalogueView => ({
  ...VERIFIED_ONLY,
  programmes,
});

const MATHS_LIT_LEARNER: SubjectId[] = [
  'english-hl',
  'isizulu-fal',
  'mathematical-literacy',
  'life-sciences',
  'geography',
  'history',
  'life-orientation',
];
const MATHS_LEARNER: SubjectId[] = [
  'english-hl',
  'isizulu-fal',
  'mathematics',
  'physical-sciences',
  'life-sciences',
  'geography',
  'life-orientation',
];

const ENGINEERING = programme('engineering', {
  subjectRequirements: [
    requires([...ENGLISH], { level: 5 }),
    requires(['mathematics'], { level: 5 }),
    requires(['physical-sciences'], { level: 5 }),
  ],
});
const COMMERCE = programme('commerce', {
  subjectRequirements: [
    requires([...ENGLISH], { level: 4 }),
    requires(['mathematics'], { level: 4 }),
  ],
});
const ARTS = programme('arts', {
  subjectRequirements: [requires([...ENGLISH], { level: 4 }), otherSubjects(4, { level: 4 })],
});
const DIPLOMA = programme('diploma', {
  universityId: 'tut' as UniversityId,
  qualification: 'diploma',
  subjectRequirements: [
    either(
      requires(['mathematics', 'technical-mathematics'], { level: 4 }),
      requires(['mathematical-literacy'], { level: 6 }),
    ),
  ],
});
const HIGHER_SCORE = programme('higher-score', {
  universityId: 'tut' as UniversityId,
  minimumScore: 24,
  minimumScoreWithMathematicalLiteracy: 26,
  subjectRequirements: [requires([...ENGLISH], { level: 4 })],
});

describe('subjectDoors: which courses a learner’s subjects keep open (G10-4)', () => {
  it('closes a course whose required subject the learner doesn’t take, whatever the marks', () => {
    const doors = subjectDoors(view(ENGINEERING, COMMERCE, ARTS), MATHS_LIT_LEARNER);
    expect(doors.status).toBe('some-closed');
    expect(doors.checked).toBe(3);
    expect(doors.open).toBe(1);
    expect(doors.closed).toBe(2);
  });

  it('groups closed courses by the subject that would open them, the biggest group first', () => {
    const doors = subjectDoors(view(ENGINEERING, COMMERCE, ARTS), MATHS_LIT_LEARNER);
    expect(doors.groups.map((g) => [g.subjects, g.programmes.map((p) => p.id)])).toEqual([
      [['mathematics'], ['commerce', 'engineering']],
      [['physical-sciences'], ['engineering']],
    ]);
  });

  it('keeps a course open when another option is a subject the learner takes', () => {
    const doors = subjectDoors(view(DIPLOMA), MATHS_LIT_LEARNER);
    expect(doors.status).toBe('open');
    expect(doors.closed).toBe(0);
  });

  it('notes an open course whose bar is higher through the subject taken', () => {
    // TUT's Mathematical Literacy at 6 instead of Mathematics at 4, and its higher score.
    const lit = subjectDoors(view(DIPLOMA, HIGHER_SCORE, ARTS), MATHS_LIT_LEARNER);
    expect(lit.higherBar.map((p) => p.id)).toEqual(['diploma', 'higher-score']);
    const maths = subjectDoors(view(DIPLOMA, HIGHER_SCORE, ARTS), MATHS_LEARNER);
    expect(maths.higherBar).toEqual([]);
  });

  it('keeps every door open for a learner who takes what each course names', () => {
    const doors = subjectDoors(view(ENGINEERING, COMMERCE, ARTS, DIPLOMA), MATHS_LEARNER);
    expect(doors).toMatchObject({ status: 'open', checked: 4, open: 4, closed: 0, groups: [] });
  });

  it('never says doors are open when there are no courses to check against', () => {
    // In production nothing reaches a learner until it is verified (hard rule 3).
    expect(subjectDoors(view(), MATHS_LIT_LEARNER)).toMatchObject({
      status: 'unknown',
      checked: 0,
    });
    expect(subjectDoors(VERIFIED_ONLY, MATHS_LIT_LEARNER).status).toBe(
      VERIFIED_ONLY.programmes.length === 0 ? 'unknown' : expect.any(String),
    );
  });

  it('has nothing to check without subjects', () => {
    expect(subjectDoors(view(ENGINEERING), []).status).toBe('unknown');
  });

  it('says when the courses it counted are drafts', () => {
    expect(subjectDoors(view(ENGINEERING), MATHS_LIT_LEARNER).draft).toBe(false);
    const doors = subjectDoors(DRAFTS, MATHS_LIT_LEARNER);
    expect(doors.draft).toBe(true);
    expect(doors.status).toBe('some-closed');
  });

  it('on the draft catalogue, Mathematical Literacy closes most science and commerce degrees', () => {
    const doors = subjectDoors(DRAFTS, MATHS_LIT_LEARNER);
    const maths = doors.groups.find((g) => g.subjects.includes('mathematics'));
    expect(maths).toBeDefined();
    expect(maths?.programmes.some((p) => /engineering/i.test(p.name))).toBe(true);
    expect(subjectDoors(DRAFTS, MATHS_LEARNER).closed).toBeLessThan(doors.closed);
  });
});

/**
 * The My subjects redesign (G10-4, round 2): the numbers behind "By university", "also needs",
 * the higher bar's reason and the what-if, worked out here so no page or prompt decides them
 * (hard rule 2). Content only formats them.
 */
describe('subjectDoors: per university, per course, and why a bar is higher', () => {
  const UJ_COMMERCE = programme('uj-commerce', {
    universityId: 'uj' as UniversityId,
    subjectRequirements: [requires(['mathematics'], { level: 4 })],
  });

  it('counts the courses checked and closed at each university, by university', () => {
    const doors = subjectDoors(
      view(ENGINEERING, COMMERCE, ARTS, DIPLOMA, HIGHER_SCORE, UJ_COMMERCE),
      MATHS_LIT_LEARNER,
    );
    expect(doors.byUniversity).toEqual([
      { universityId: 'tut', checked: 2, closed: 0 },
      { universityId: 'uj', checked: 1, closed: 1 },
      { universityId: 'wits', checked: 3, closed: 2 },
    ]);
    // The rows add up to the verdict: a course is counted once, at its own university.
    expect(doors.byUniversity.reduce((n, u) => n + u.checked, 0)).toBe(doors.checked);
    expect(doors.byUniversity.reduce((n, u) => n + u.closed, 0)).toBe(doors.closed);
  });

  it('has no university rows when there is nothing to check', () => {
    expect(subjectDoors(view(ENGINEERING), []).byUniversity).toEqual([]);
  });

  it('lists every subject a closed course still needs, one set per requirement it misses', () => {
    const doors = subjectDoors(view(ENGINEERING, COMMERCE, ARTS), MATHS_LIT_LEARNER);
    expect(doors.closedCourses.map((c) => [c.programme.id, c.missing])).toEqual([
      ['commerce', [['mathematics']]],
      ['engineering', [['mathematics'], ['physical-sciences']]],
    ]);
    expect(doors.closedCourses).toHaveLength(doors.closed);
  });

  it('gives the reason a bar is higher, in the catalogue’s own numbers', () => {
    const doors = subjectDoors(view(DIPLOMA, HIGHER_SCORE, ARTS), MATHS_LIT_LEARNER);
    expect(doors.higherBarReasons.map((h) => h.programme.id)).toEqual(
      doors.higherBar.map((p) => p.id),
    );
    const [diploma, higherScore] = doors.higherBarReasons;
    // TUT's Mathematical Literacy at level 6, where Mathematics or Technical Mathematics needs 4.
    expect(diploma?.reasons).toEqual([
      {
        kind: 'option',
        yours: { subjects: ['mathematical-literacy'], minLevel: 6 },
        lowest: { subjects: ['mathematics', 'technical-mathematics'], minLevel: 4 },
      },
    ]);
    // A score of 26 with Mathematical Literacy, not 24.
    expect(higherScore?.reasons).toEqual([
      { kind: 'score', subject: 'mathematical-literacy', score: 26, otherwise: 24 },
    ]);
  });

  it('gives no reason for a course whose bar is not higher', () => {
    const doors = subjectDoors(view(DIPLOMA, HIGHER_SCORE, ARTS), MATHS_LEARNER);
    expect(doors.higherBarReasons).toEqual([]);
  });
});

describe('swapChoices and trySwap: “what if I took another subject?” (G10-4)', () => {
  const ALL = view(ENGINEERING, COMMERCE, ARTS, DIPLOMA);

  it('offers to swap any subject taken but Life Orientation, for a subject a closed course names', () => {
    const doors = subjectDoors(ALL, MATHS_LIT_LEARNER);
    const choices = swapChoices(doors, MATHS_LIT_LEARNER);
    expect(choices.drop).toEqual(MATHS_LIT_LEARNER.filter((s) => s !== 'life-orientation'));
    // Only the subjects the closed courses' requirements name, never every NSC subject.
    expect(choices.take).toEqual(['mathematics', 'physical-sciences']);
  });

  it('has nothing to take when every door is open', () => {
    const doors = subjectDoors(ALL, MATHS_LEARNER);
    expect(swapChoices(doors, MATHS_LEARNER).take).toEqual([]);
  });

  it('works out what would open and what would close, without changing the subjects given', () => {
    const subjects = [...MATHS_LIT_LEARNER];
    const swap = trySwap(ALL, subjects, 'mathematical-literacy', 'mathematics');
    expect(subjects).toEqual(MATHS_LIT_LEARNER);
    expect(swap?.drop).toBe('mathematical-literacy');
    expect(swap?.take).toBe('mathematics');
    // Commerce opens; engineering still needs Physical Sciences.
    expect(swap?.opened.map((p) => p.id)).toEqual(['commerce']);
    // The diploma took Mathematical Literacy at 6; it takes Mathematics at 4 now, so stays open.
    expect(swap?.closes).toEqual([]);
    expect(swap?.doors.closed).toBe(1);
  });

  it('says which courses a swap would close', () => {
    // Dropping English closes the open course that names it (arts); the diploma doesn't name it.
    const swap = trySwap(ALL, MATHS_LIT_LEARNER, 'english-hl', 'physical-sciences');
    expect(swap?.closes.map((p) => p.id)).toEqual(['arts']);
    expect(swap?.opened).toEqual([]);
  });

  it('refuses anything it doesn’t offer: no throw, nothing echoed back', () => {
    expect(trySwap(ALL, MATHS_LIT_LEARNER, 'life-orientation', 'mathematics')).toBeNull();
    expect(trySwap(ALL, MATHS_LIT_LEARNER, 'mathematics', 'mathematics')).toBeNull();
    expect(trySwap(ALL, MATHS_LIT_LEARNER, 'mathematical-literacy', 'dance-studies')).toBeNull();
    expect(trySwap(ALL, MATHS_LIT_LEARNER, '<script>', 'mathematics')).toBeNull();
    expect(trySwap(ALL, MATHS_LIT_LEARNER, '', '')).toBeNull();
    expect(trySwap(view(), MATHS_LIT_LEARNER, 'mathematical-literacy', 'mathematics')).toBeNull();
  });
});
