import { otherSubjects, type Programme, requires } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { checkProgramme, groupResults, minimumScoreFor, targetPercent } from './eligibility';
import type { SubjectMark } from './marks';
import { bestOfMethod, NSC_LEVEL_TABLE } from './scoring/engine';

const METHOD = bestOfMethod({
  id: 'test-aps',
  universityId: 'up',
  label: 'APS',
  subjectsCounted: 6,
  table: NSC_LEVEL_TABLE,
  lifeOrientation: { mode: 'excluded' },
  maximum: 42,
  closeMargin: 3,
  source: { sourceUrl: 'https://www.example.ac.za/p.pdf', academicYear: 2027 },
});

function programme(overrides: Partial<Programme> = {}): Programme {
  return {
    id: 'bsc-test',
    universityId: 'up',
    name: 'BSc Test',
    faculty: 'Natural Sciences',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [requires(['mathematics'], { level: 5 })],
    nbt: 'none',
    selection: null,
    closesOn: null,
    sourceUrl: 'https://www.example.ac.za/p.pdf',
    academicYear: 2027,
    ...overrides,
  };
}

// APS (best 6, no LO): 7 + 6 + 5 + 5 + 4 + 3 = 30. A bachelor pass.
const MARKS: SubjectMark[] = [
  { subject: 'english-hl', percent: 72 },
  { subject: 'afrikaans-fal', percent: 55 },
  { subject: 'mathematics', percent: 81 },
  { subject: 'physical-sciences', percent: 68 },
  { subject: 'life-sciences', percent: 49 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 92 },
];

describe('targetPercent', () => {
  it('turns a level into the lowest percentage that reaches it', () => {
    expect(targetPercent({ subjects: ['mathematics'], minLevel: 5 })).toBe(60);
  });

  it('takes the stricter of a level and a percentage', () => {
    expect(targetPercent({ subjects: ['mathematics'], minLevel: 5, minPercent: 65 })).toBe(65);
    expect(targetPercent({ subjects: ['mathematics'], minLevel: 6, minPercent: 65 })).toBe(70);
  });
});

describe('checkProgramme', () => {
  it('qualifies when the score, the subjects and the pass all meet the minimums', () => {
    const check = checkProgramme(programme(), MARKS, METHOD);
    expect(check.verdict).toBe('qualifies');
    expect(check.scoreGap).toBe(0);
    expect(check.pass).toEqual({ required: 'bachelor', projected: 'bachelor', met: true });
  });

  it('is close when the score is within the margin', () => {
    const check = checkProgramme(programme({ minimumScore: 33 }), MARKS, METHOD);
    expect(check.verdict).toBe('close');
    expect(check.scoreGap).toBe(3);
  });

  it('is not yet when the score is beyond the margin', () => {
    expect(checkProgramme(programme({ minimumScore: 34 }), MARKS, METHOD).verdict).toBe('not-yet');
  });

  it('says exactly how far short a subject is', () => {
    const check = checkProgramme(
      programme({ subjectRequirements: [requires(['physical-sciences'], { level: 7 })] }),
      MARKS,
      METHOD,
    );
    expect(check.verdict).toBe('close');
    expect(check.requirements[0]?.closest).toMatchObject({ targetPercent: 80, shortBy: 12 });
  });

  it('is not yet when a subject is more than two levels short', () => {
    const check = checkProgramme(
      programme({ subjectRequirements: [requires(['life-sciences'], { level: 7 })] }),
      MARKS,
      METHOD,
    );
    expect(check.requirements[0]?.closest.shortBy).toBe(31);
    expect(check.verdict).toBe('not-yet');
  });

  it('is not yet when the learner does not take a required subject at all', () => {
    const check = checkProgramme(
      programme({ subjectRequirements: [requires(['accounting'], { level: 4 })] }),
      MARKS,
      METHOD,
    );
    expect(check.requirements[0]?.closest).toMatchObject({ best: null, shortBy: null });
    expect(check.verdict).toBe('not-yet');
  });

  it('meets a requirement through whichever option the learner satisfies', () => {
    // English HL 4 or FAL 5: this learner takes English HL at 72%.
    const english = {
      options: [
        { subjects: ['english-hl' as const], minLevel: 4 },
        { subjects: ['english-fal' as const], minLevel: 5 },
      ],
    };
    const check = checkProgramme(programme({ subjectRequirements: [english] }), MARKS, METHOD);
    expect(check.requirements[0]?.met).toBe(true);
    expect(check.requirements[0]?.closest.option.subjects).toEqual(['english-hl']);
  });

  it('counts Maths Literacy as Maths only when the programme says so', () => {
    const lit: SubjectMark[] = MARKS.map((m) =>
      m.subject === 'mathematics' ? { subject: 'mathematical-literacy', percent: 81 } : m,
    );
    expect(checkProgramme(programme(), lit, METHOD).verdict).toBe('not-yet');
    const accepting = programme({
      subjectRequirements: [requires(['mathematics', 'mathematical-literacy'], { level: 5 })],
    });
    expect(checkProgramme(accepting, lit, METHOD).verdict).toBe('qualifies');
  });

  it('is close, not qualified, one pass type below the requirement', () => {
    const diplomaMarks: SubjectMark[] = MARKS.map((m) => ({
      ...m,
      percent: m.subject === 'mathematics' ? 81 : Math.min(m.percent, 45),
    }));
    const check = checkProgramme(
      programme({ minimumScore: 20, subjectRequirements: [] }),
      diplomaMarks,
      METHOD,
    );
    expect(check.pass).toMatchObject({ projected: 'diploma', met: false });
    expect(check.verdict).toBe('close');
  });

  it('treats a programme with no minimum score as score-met', () => {
    const check = checkProgramme(programme({ minimumScore: null }), MARKS, METHOD);
    expect(check.requiredScore).toBeNull();
    expect(check.scoreGap).toBe(0);
  });

  it('refuses a score method from another university', () => {
    expect(() => checkProgramme(programme({ universityId: 'uct' }), MARKS, METHOD)).toThrow(
      RangeError,
    );
  });
});

describe('other-subject requirements ("any three additional subjects at level 4")', () => {
  const needThree = programme({
    subjectRequirements: [requires(['mathematics'], { level: 5 }), otherSubjects(3, { level: 4 })],
  });

  it('counts subjects not used elsewhere, never Life Orientation', () => {
    // Maths is used by the first requirement; the next three best are 72, 68, 63.
    const check = checkProgramme(needThree, MARKS, METHOD);
    expect(check.requirements[1]).toMatchObject({ met: true });
    expect(check.requirements[1]?.closest.best?.subject).toBe('geography');
  });

  it('reports the subject that decides it when short', () => {
    const check = checkProgramme(
      programme({ subjectRequirements: [otherSubjects(5, { level: 4 })] }),
      MARKS,
      METHOD,
    );
    // Five best non-LO: 81, 72, 68, 63, 55 → all ≥ 50: met. Six would need Life Sciences (49).
    expect(check.requirements[0]?.met).toBe(true);
    const six = checkProgramme(
      programme({ subjectRequirements: [otherSubjects(6, { level: 4 })] }),
      MARKS,
      METHOD,
    );
    expect(six.requirements[0]?.closest).toMatchObject({ shortBy: 1, met: false });
    expect(six.requirements[0]?.closest.best?.subject).toBe('life-sciences');
  });

  it('is unmet, with no subject to point to, when the learner has too few', () => {
    const check = checkProgramme(
      programme({ subjectRequirements: [otherSubjects(3, { level: 4 })] }),
      MARKS.slice(0, 2),
      METHOD,
    );
    expect(check.requirements[0]?.closest).toMatchObject({ best: null, shortBy: null });
  });
});

describe('minimumScoreFor (a higher minimum with Mathematical Literacy)', () => {
  const withLiteracyMinimum = programme({
    minimumScore: 26,
    minimumScoreWithMathematicalLiteracy: 28,
    subjectRequirements: [],
  });

  it('uses the standard minimum for a learner taking Mathematics', () => {
    expect(minimumScoreFor(withLiteracyMinimum, MARKS)).toBe(26);
  });

  it('uses the higher minimum for a learner taking Mathematical Literacy instead', () => {
    const lit = MARKS.map((m) =>
      m.subject === 'mathematics' ? { subject: 'mathematical-literacy' as const, percent: 81 } : m,
    );
    expect(minimumScoreFor(withLiteracyMinimum, lit)).toBe(28);
    expect(checkProgramme(withLiteracyMinimum, lit, METHOD).requiredScore).toBe(28);
  });

  it('falls back to the standard minimum when no literacy minimum is published', () => {
    const lit = MARKS.map((m) =>
      m.subject === 'mathematics' ? { subject: 'mathematical-literacy' as const, percent: 81 } : m,
    );
    expect(minimumScoreFor(programme(), lit)).toBe(30);
  });
});

describe('groupResults', () => {
  it('sorts degrees, close programmes and Plan B into their groups', () => {
    const checks = [
      checkProgramme(programme({ id: 'degree-ok' }), MARKS, METHOD),
      checkProgramme(programme({ id: 'degree-close', minimumScore: 32 }), MARKS, METHOD),
      checkProgramme(programme({ id: 'degree-far', minimumScore: 40 }), MARKS, METHOD),
      checkProgramme(
        programme({ id: 'diploma-ok', qualification: 'diploma', requiredPass: 'diploma' }),
        MARKS,
        METHOD,
      ),
      checkProgramme(
        programme({ id: 'extended-ok', qualification: 'extended-degree', minimumScore: 25 }),
        MARKS,
        METHOD,
      ),
    ];
    const groups = groupResults(checks);
    expect(groups.qualifyNow.map((c) => c.programme.id)).toEqual(['degree-ok']);
    expect(groups.close.map((c) => c.programme.id)).toEqual(['degree-close']);
    expect(groups.planB.map((c) => c.programme.id).sort()).toEqual(['diploma-ok', 'extended-ok']);
  });
});
