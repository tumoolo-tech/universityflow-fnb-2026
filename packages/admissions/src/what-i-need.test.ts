import {
  catalogueView,
  ENGLISH,
  otherSubjects,
  type Programme,
  requires,
  type UniversityId,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { checkProgramme } from './eligibility';
import type { SubjectMark } from './marks';
import type { ScoreMethod } from './scoring/engine';
import {
  methodFor,
  tutAps,
  uctFps,
  uctFpsScience,
  ujAps,
  ukznAps,
  ukznMbchbAverage,
  upAps,
  witsAps,
} from './universities/methods';
import { type WhatINeedPlan, whatINeed, whatINeedFor } from './what-i-need';

const TODAY = new Date('2026-10-13T08:00:00Z');
const DRAFTS = catalogueView(TODAY, { includeDrafts: true });
const VERIFIED_ONLY = catalogueView(TODAY, { includeDrafts: false });

const marks = (entries: Record<string, number>) =>
  Object.entries(entries).map(([subject, percent]) => ({ subject, percent })) as SubjectMark[];

function programme(universityId: UniversityId, overrides: Partial<Programme> = {}): Programme {
  return {
    id: `${universityId}-test`,
    universityId,
    name: 'Test programme',
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

/** Targets as a plain record, for readable expectations. */
const targets = (plan: WhatINeedPlan) =>
  Object.fromEntries(plan.subjects.map((s) => [s.subject, s.target]));
const raised = (plan: WhatINeedPlan) =>
  Object.fromEntries(plan.subjects.filter((s) => s.gap > 0).map((s) => [s.subject, s.target]));

/** The plan's targets really do qualify, under the programme's own check. */
function qualifiesAtTarget(p: Programme, plan: WhatINeedPlan, method: ScoreMethod): boolean {
  return (
    checkProgramme(
      p,
      plan.subjects.map((s) => ({ subject: s.subject, percent: s.target })),
      method,
    ).verdict === 'qualifies'
  );
}

describe('whatINeed: worked examples, one per university method', () => {
  it('UP (best six on the NSC table, LO left out): minimums first, then the nearest next level', () => {
    // APS now: English 4, Afrikaans 5, Maths 4, Physical Sciences 3, Life Sciences 5,
    // Geography 5 = 26. Maths and English must reach 60% (level 5): that makes 28.
    // Then, nearest next level first: Geography 69→70 (1 mark), Physical Sciences 48→50 (2),
    // Life Sciences 64→70 (6), Afrikaans 62→70 (8): 32.
    const p = programme('up', {
      minimumScore: 32,
      subjectRequirements: [
        requires(['mathematics'], { level: 5 }),
        requires([...ENGLISH], { level: 5 }),
      ],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 58,
        'afrikaans-fal': 62,
        mathematics: 55,
        'physical-sciences': 48,
        'life-sciences': 64,
        geography: 69,
        'life-orientation': 85,
      }),
      upAps,
    );
    expect(plan.status).toBe('reachable');
    expect(plan.verdictNow).toBe('not-yet');
    expect(targets(plan)).toEqual({
      'english-hl': 60,
      'afrikaans-fal': 70,
      mathematics: 60,
      'physical-sciences': 50,
      'life-sciences': 70,
      geography: 70,
      'life-orientation': 85,
    });
    expect(plan.totalGap).toBe(24);
    expect(plan.score).toMatchObject({ label: 'APS', now: 26, atTarget: 32, required: 32 });
    // Biggest gap first; Life Orientation, which UP doesn't count, never rises.
    expect(plan.subjects.map((s) => s.subject)).toEqual([
      'afrikaans-fal',
      'life-sciences',
      'mathematics',
      'english-hl',
      'physical-sciences',
      'geography',
      'life-orientation',
    ]);
    const bySubject = Object.fromEntries(plan.subjects.map((s) => [s.subject, s]));
    expect(bySubject['mathematics']).toMatchObject({
      current: 55,
      target: 60,
      gap: 5,
      reasons: ['subject-minimum'],
      requiredByProgramme: true,
    });
    expect(bySubject['geography']?.reasons).toEqual(['score']);
    expect(bySubject['life-orientation']).toMatchObject({ gap: 0, reasons: [] });
    expect(qualifiesAtTarget(p, plan, upAps)).toBe(true);
  });

  it('UJ (best six, LO not counted): a Life Orientation of 95% earns nothing, so it is never the answer', () => {
    // APS 4+4+4+4+4+4 = 24, needs 26. Every subject is 1 mark from level 5 except Geography;
    // the nearest are raised first, and the alphabet breaks the tie.
    const p = programme('uj', { minimumScore: 26 });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 59,
        'sesotho-fal': 59,
        mathematics: 59,
        accounting: 59,
        'business-studies': 59,
        geography: 55,
        'life-orientation': 95,
      }),
      ujAps,
    );
    expect(raised(plan)).toEqual({ accounting: 60, 'business-studies': 60 });
    expect(plan.score.atTarget).toBe(26);
    expect(qualifiesAtTarget(p, plan, ujAps)).toBe(true);
  });

  it('Wits (best seven, LO on its own table, +2 for English and Maths at 60%): the bonus is the cheapest path', () => {
    // English 58 and Maths 57 each earn 4; at 60% they earn 7, a jump of 3 points.
    // APS now 4+4+5+5+4+4+2 = 28, needs 34: English 58→60 (+3), Maths 57→60 (+3).
    const p = programme('wits', {
      minimumScore: 34,
      subjectRequirements: [requires([...ENGLISH], { level: 4 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 58,
        mathematics: 57,
        'physical-sciences': 66,
        'life-sciences': 61,
        geography: 55,
        'afrikaans-fal': 52,
        'life-orientation': 75,
      }),
      witsAps,
    );
    expect(plan.score.now).toBe(28);
    expect(raised(plan)).toEqual({ 'english-hl': 60, mathematics: 60 });
    expect(plan.totalGap).toBe(5);
    expect(qualifiesAtTarget(p, plan, witsAps)).toBe(true);
  });

  it('Wits with Maths Literacy: no bonus, so the work spreads, and Life Orientation can count', () => {
    // Same learner, Mathematical Literacy instead: 57→60 is worth 1 point, not 3.
    // English 58→60 (+3) = 31, Maths Lit 57→60 (+1), Physical Sciences 66→70 (+1), then a
    // five-mark tie between Geography 55→60 and LO 75→80 goes to the lower mark: 34.
    const p = programme('wits', {
      minimumScore: 34,
      subjectRequirements: [requires([...ENGLISH], { level: 4 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 58,
        'mathematical-literacy': 57,
        'physical-sciences': 66,
        'life-sciences': 61,
        geography: 55,
        'afrikaans-fal': 52,
        'life-orientation': 75,
      }),
      witsAps,
    );
    expect(raised(plan)).toEqual({
      'english-hl': 60,
      'mathematical-literacy': 60,
      'physical-sciences': 70,
      geography: 60,
    });
    expect(qualifiesAtTarget(p, plan, witsAps)).toBe(true);
  });

  it('UCT FPS (percentages added): the weakest counted subject rises first, so the work is shared', () => {
    // English + the best five others: 65 + 70 + 62 + 60 + 60 + 55 = 372 once Maths reaches
    // its 60% minimum; 400 needs 28 more. History rises to 60, then the lowest marks level up
    // together, ending with five subjects at 66.
    const p = programme('uct', {
      minimumScore: 400,
      subjectRequirements: [requires(['mathematics'], { level: 5 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 65,
        mathematics: 58,
        'physical-sciences': 62,
        'life-sciences': 70,
        geography: 60,
        history: 55,
        'life-orientation': 90,
      }),
      uctFps,
    );
    expect(targets(plan)).toEqual({
      'english-hl': 66,
      mathematics: 66,
      'physical-sciences': 66,
      'life-sciences': 70,
      geography: 66,
      history: 66,
      'life-orientation': 90,
    });
    expect(plan.score.atTarget).toBe(400);
    expect(plan.subjects.find((s) => s.subject === 'mathematics')?.reasons).toEqual([
      'subject-minimum',
      'score',
    ]);
    expect(qualifiesAtTarget(p, plan, uctFps)).toBe(true);
  });

  it('UCT Science (Maths and Physical Sciences doubled): the doubled subjects go first', () => {
    // FPS (Science) now: 70 + 2×64 + 2×62 + 68 + 66 + 60 = 516; 526 needs 10 more, which
    // five marks in the doubled subjects give, the lower one first.
    const p = programme('uct', {
      minimumScore: 526,
      scoreMethod: 'uct-fps-science',
      subjectRequirements: [requires(['mathematics'], { level: 5 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 70,
        mathematics: 64,
        'physical-sciences': 62,
        'life-sciences': 68,
        geography: 66,
        history: 60,
        'life-orientation': 80,
      }),
      uctFpsScience,
    );
    expect(plan.score.now).toBe(516);
    expect(raised(plan)).toEqual({ mathematics: 66, 'physical-sciences': 65 });
    expect(plan.score.atTarget).toBe(526);
  });

  it('UKZN (90% earns 8): a mark near 90 is worth pushing over the line', () => {
    // APS now 5+7+4+4+5+3 = 28, needs 33. Physical Sciences 59→60, English 68→70 and isiZulu
    // 88→90 (2 marks, but the lower mark first), then Geography 45→50 and Life Sciences 64→70.
    const p = programme('ukzn', {
      minimumScore: 33,
      subjectRequirements: [requires(['mathematics'], { level: 4 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-fal': 68,
        'isizulu-hl': 88,
        mathematics: 52,
        'physical-sciences': 59,
        'life-sciences': 64,
        geography: 45,
        'life-orientation': 70,
      }),
      ukznAps,
    );
    expect(plan.score.now).toBe(28);
    expect(raised(plan)).toEqual({
      'physical-sciences': 60,
      'english-fal': 70,
      'isizulu-hl': 90,
      geography: 50,
      'life-sciences': 70,
    });
    expect(plan.totalGap).toBe(16);
    expect(qualifiesAtTarget(p, plan, ukznAps)).toBe(true);
  });

  it('UKZN Medicine (an average of six, to one decimal): levels the lowest marks up to 65.0', () => {
    const p = programme('ukzn', {
      minimumScore: 65,
      scoreMethod: 'ukzn-mbchb-average',
      subjectRequirements: [
        requires(['mathematics'], { level: 5 }),
        requires(['physical-sciences'], { level: 5 }),
        requires(['life-sciences'], { level: 5 }),
      ],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 66,
        mathematics: 63,
        'physical-sciences': 60,
        'life-sciences': 64,
        geography: 62,
        history: 58,
        'life-orientation': 90,
      }),
      ukznMbchbAverage,
    );
    expect(plan.score.now).toBe(62.2);
    expect(plan.score.atTarget).toBe(65);
    expect(targets(plan)).toMatchObject({
      'english-hl': 66,
      mathematics: 65,
      'physical-sciences': 65,
      'life-sciences': 65,
      geography: 65,
      history: 64,
    });
  });

  it('TUT: a Maths Literacy learner meets the higher Maths Literacy minimums', () => {
    // tut-dip-computer-science: APS 26, or 28 with Mathematical Literacy; Maths 5 or Maths Lit 7.
    const p = DRAFTS.programmes.find((x) => x.id === 'tut-dip-computer-science') as Programme;
    const learner = {
      'isizulu-hl': 70,
      'english-fal': 52,
      'business-studies': 58,
      geography: 48,
      history: 61,
      'life-orientation': 80,
    };
    const literacy = whatINeed(p, marks({ ...learner, 'mathematical-literacy': 74 }), tutAps);
    expect(literacy.score.required).toBe(28);
    expect(raised(literacy)).toEqual({ 'mathematical-literacy': 80 });
    expect(literacy.subjects[0]?.reasons).toEqual(['subject-minimum']);
    expect(literacy.score.atTarget).toBe(29);

    // The same marks with Mathematics: level 6 meets Maths 5, and 26 is the minimum.
    const maths = whatINeed(p, marks({ ...learner, mathematics: 74 }), tutAps);
    expect(maths.status).toBe('qualifies');
    expect(maths.score.required).toBe(26);
  });
});

describe('whatINeed: edge cases', () => {
  const STRONG = marks({
    'english-hl': 85,
    'afrikaans-fal': 80,
    mathematics: 88,
    'physical-sciences': 84,
    'life-sciences': 82,
    geography: 86,
    'life-orientation': 90,
  });

  it('already qualifies: nothing changes', () => {
    const p = programme('up', {
      minimumScore: 30,
      subjectRequirements: [requires(['mathematics'], { level: 6 })],
    });
    const plan = whatINeed(p, STRONG, upAps);
    expect(plan.status).toBe('qualifies');
    expect(plan.verdictNow).toBe('qualifies');
    expect(plan.totalGap).toBe(0);
    expect(plan.subjects.every((s) => s.gap === 0 && s.reasons.length === 0)).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.score.atTarget).toBe(plan.score.now);
  });

  it('impossible: a required subject the learner does not take', () => {
    const p = programme('up', {
      subjectRequirements: [requires(['physical-sciences'], { level: 5 })],
    });
    const plan = whatINeed(
      p,
      STRONG.filter((m) => m.subject !== 'physical-sciences'),
      upAps,
    );
    expect(plan.status).toBe('unreachable');
    expect(plan.blockers).toEqual([{ kind: 'subject-not-taken', subjects: ['physical-sciences'] }]);
  });

  it('impossible: Maths Literacy where only Mathematics is accepted', () => {
    const p = programme('wits', {
      subjectRequirements: [requires(['mathematics'], { level: 5 })],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 80,
        'mathematical-literacy': 95,
        geography: 80,
        history: 80,
        'business-studies': 80,
        'isizulu-fal': 80,
        'life-orientation': 80,
      }),
      witsAps,
    );
    expect(plan.status).toBe('unreachable');
    expect(plan.blockers).toEqual([{ kind: 'subject-not-taken', subjects: ['mathematics'] }]);
  });

  it('impossible: a score that 100% everywhere would not reach, with the best possible', () => {
    // Five 20-credit subjects: at most 35 on UP's scale.
    const p = programme('up', { minimumScore: 40, requiredPass: 'diploma' });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 70,
        mathematics: 60,
        geography: 60,
        history: 60,
        'life-sciences': 60,
        'life-orientation': 70,
      }),
      upAps,
    );
    expect(plan.status).toBe('unreachable');
    expect(plan.blockers).toEqual([{ kind: 'score-out-of-reach', best: 35, required: 40 }]);
    // Nothing is raised towards a target that can't be met.
    expect(plan.totalGap).toBe(0);
  });

  it('impossible: "any N other subjects" with too few subjects left', () => {
    const p = programme('up', {
      requiredPass: 'higher-certificate',
      subjectRequirements: [
        requires(['mathematics'], { level: 4 }),
        otherSubjects(4, { level: 4 }),
      ],
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 45,
        mathematics: 55,
        geography: 45,
        history: 41,
        'life-orientation': 70,
      }),
      upAps,
    );
    expect(plan.status).toBe('unreachable');
    expect(plan.blockers).toContainEqual({ kind: 'not-enough-subjects', needed: 4, available: 3 });
    // The ones there are still get their target.
    expect(raised(plan)).toMatchObject({ 'english-hl': 50, geography: 50, history: 50 });
  });

  it('impossible: no English, or no home language, for the pass', () => {
    const p = programme('up', { requiredPass: 'bachelor' });
    const plan = whatINeed(
      p,
      marks({
        'afrikaans-fal': 60,
        'sesotho-fal': 60,
        mathematics: 45,
        geography: 45,
        history: 45,
        accounting: 45,
        'life-orientation': 70,
      }),
      upAps,
    );
    expect(plan.status).toBe('unreachable');
    expect(plan.blockers).toEqual(
      expect.arrayContaining([{ kind: 'no-home-language' }, { kind: 'no-english' }]),
    );
  });

  it('the pass: raises the fourth-best 20-credit subject to 50% for a bachelor’s pass', () => {
    const p = programme('up', { requiredPass: 'bachelor' });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 62,
        mathematics: 48,
        'physical-sciences': 45,
        'life-sciences': 55,
        geography: 70,
        history: 38,
        'life-orientation': 60,
      }),
      upAps,
    );
    expect(plan.pass).toEqual({ required: 'bachelor', now: 'diploma', atTarget: 'bachelor' });
    expect(raised(plan)).toEqual({ mathematics: 50 });
    expect(plan.subjects[0]?.reasons).toEqual(['pass']);
  });

  it('the pass: an NSC needs a home language at 40% and five more at 40/30', () => {
    const p = programme('up', {
      requiredPass: 'higher-certificate',
      qualification: 'higher-certificate',
    });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 35,
        mathematics: 41,
        geography: 38,
        history: 28,
        accounting: 25,
        'life-sciences': 20,
        'life-orientation': 50,
      }),
      upAps,
    );
    expect(plan.status).toBe('reachable');
    // The home language to 40%; Life Orientation and Maths are already the two at 40%; the next
    // three (Geography is there already) to 30%.
    expect(raised(plan)).toEqual({ 'english-hl': 40, history: 30, accounting: 30 });
    expect(plan.pass.atTarget).toBe('higher-certificate');
  });

  it('marks never go above 100, and never down', () => {
    const p = programme('uct', { minimumScore: 590 });
    const plan = whatINeed(
      p,
      marks({
        'english-hl': 96,
        mathematics: 97,
        'physical-sciences': 98,
        'life-sciences': 99,
        geography: 95,
        history: 94,
        'life-orientation': 50,
      }),
      uctFps,
    );
    expect(plan.status).toBe('reachable');
    for (const s of plan.subjects) {
      expect(s.target).toBeLessThanOrEqual(100);
      expect(s.target).toBeGreaterThanOrEqual(s.current);
    }
    expect(plan.score.atTarget).toBe(590);
  });

  it('refuses marks that are not valid, as every calculator does', () => {
    expect(() => whatINeed(programme('up'), marks({ mathematics: 101 }), upAps)).toThrow();
  });
});

describe('whatINeed across the whole catalogue', () => {
  const PROFILES = {
    strong: marks({
      'english-hl': 85,
      'afrikaans-fal': 80,
      mathematics: 88,
      'physical-sciences': 84,
      'life-sciences': 82,
      geography: 86,
      'life-orientation': 90,
    }),
    middling: marks({
      'english-fal': 62,
      'isizulu-hl': 74,
      mathematics: 58,
      'physical-sciences': 55,
      'life-sciences': 66,
      geography: 61,
      'life-orientation': 80,
    }),
    literacy: marks({
      'isizulu-hl': 66,
      'english-fal': 58,
      'mathematical-literacy': 72,
      geography: 55,
      history: 60,
      'business-studies': 52,
      'life-orientation': 75,
    }),
    struggling: marks({
      'english-hl': 44,
      'sepedi-fal': 51,
      mathematics: 33,
      'physical-sciences': 31,
      'life-sciences': 47,
      geography: 39,
      'life-orientation': 62,
    }),
  };

  for (const [name, learner] of Object.entries(PROFILES)) {
    it(`keeps every promise for the ${name} learner, on every programme`, () => {
      for (const p of DRAFTS.programmes) {
        const method = methodFor(p);
        const plan = whatINeed(p, learner, method);
        const label = `${name} → ${p.id}`;
        for (const s of plan.subjects) {
          expect(s.target, label).toBeLessThanOrEqual(100);
          expect(s.target, label).toBeGreaterThanOrEqual(s.current);
          expect(s.gap, label).toBe(s.target - s.current);
          expect(s.gap > 0, label).toBe(s.reasons.length > 0);
        }
        if (plan.status === 'qualifies') expect(plan.totalGap, label).toBe(0);
        if (plan.status === 'reachable') {
          expect(qualifiesAtTarget(p, plan, method), label).toBe(true);
          expect(plan.blockers, label).toEqual([]);
        }
        if (plan.status === 'unreachable') expect(plan.blockers.length, label).toBeGreaterThan(0);
      }
      // Every programme, step by step: ~60 ms each for a struggling learner, so the whole sweep
      // runs close to vitest's 5 s default on a busy CI runner. It's a sweep, not a slow path.
    }, 30_000);
  }
});

describe('whatINeedFor: Grade 10 marks are on track, never "qualifies" (G10-3)', () => {
  const strong = marks({
    'english-hl': 85,
    'afrikaans-fal': 80,
    mathematics: 88,
    'physical-sciences': 84,
    'life-sciences': 82,
    geography: 86,
    'life-orientation': 90,
  });

  it('says on-track where a Grade 11 report says qualifies, with the same targets', () => {
    const g11 = whatINeedFor(DRAFTS, 'uj-bcom-accounting', {
      kind: 'grade-11-final',
      marks: strong,
    });
    const g10 = whatINeedFor(DRAFTS, 'uj-bcom-accounting', {
      kind: 'grade-10-final',
      marks: strong,
    });
    expect(g11?.plan.status).toBe('qualifies');
    expect(g11?.plan.verdictNow).toBe('qualifies');
    expect(g10?.plan.status).toBe('on-track');
    expect(g10?.plan.verdictNow).toBe('on-track');
    expect(g10?.plan.subjects).toEqual(g11?.plan.subjects);
  });

  it('keeps a plan still to reach as it is', () => {
    const weak = marks({ 'english-hl': 55, mathematics: 45, 'life-orientation': 70 });
    const g10 = whatINeedFor(DRAFTS, 'uj-bcom-accounting', { kind: 'grade-10-final', marks: weak });
    expect(g10?.plan.status).not.toBe('qualifies');
    expect(g10?.plan.status).not.toBe('on-track');
    expect(g10?.plan.verdictNow).not.toBe('qualifies');
  });
});

describe('whatINeedFor: drafts exactly as assessAll treats them', () => {
  const learner = {
    kind: 'grade-11-final',
    marks: marks({
      'english-hl': 62,
      'afrikaans-fal': 60,
      mathematics: 58,
      'physical-sciences': 55,
      'life-sciences': 66,
      geography: 61,
      'life-orientation': 80,
    }),
  } as const;

  it('labels a plan from preview data as a draft', () => {
    const result = whatINeedFor(DRAFTS, 'uj-bcom-accounting', learner);
    expect(result?.draft).toBe(true);
    expect(result?.universityName).toBe('UJ');
    expect(result?.methodSourceUrl).toMatch(/^https:\/\/www\.uj\.ac\.za\//);
    expect(result?.plan.score.label).toBe('APS');
  });

  it('shows nothing from unverified data when drafts are off, or for an unknown programme', () => {
    expect(whatINeedFor(VERIFIED_ONLY, 'uj-bcom-accounting', learner)).toBeNull();
    expect(whatINeedFor(DRAFTS, 'nope', learner)).toBeNull();
  });

  describe('a verified programme scored by a draft method', () => {
    const signed = { verifiedOn: '2026-11-01', verifiedBy: 'Test Verifier' };
    const p = DRAFTS.programmes.find((x) => x.id === 'uj-bcom-accounting') as Programme;
    const university = DRAFTS.universities.find((u) => u.id === 'uj');
    const view = (includeDrafts: boolean) => ({
      ...DRAFTS,
      universities: university ? [{ ...university, ...signed }] : [],
      programmes: [{ ...p, ...signed }],
      includesDrafts: includeDrafts,
    });

    it('is hidden when drafts are off', () => {
      expect(whatINeedFor(view(false), 'uj-bcom-accounting', learner)).toBeNull();
    });

    it('is labelled a draft when drafts are shown', () => {
      expect(whatINeedFor(view(true), 'uj-bcom-accounting', learner)?.draft).toBe(true);
    });

    it('falls back to the university id when the view has no record of the university', () => {
      const bare = { ...view(true), universities: [] };
      expect(whatINeedFor(bare, 'uj-bcom-accounting', learner)?.universityName).toBe('uj');
    });
  });
});
