import { RAW_CATALOGUE, UNIVERSITY_IDS } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { checkProgramme } from '../eligibility';
import type { SubjectMark } from '../marks';
import {
  DEFAULT_METHOD,
  METHODS,
  methodFor,
  tutAps,
  uctFps,
  uctFpsScience,
  ujAps,
  ukznAps,
  ukznMbchbAverage,
  upAps,
  witsAps,
} from './methods';

/**
 * Each university's method, tested against the worked example its own prospectus prints where
 * there is one, and against the published rules otherwise. These are the tests a verifier
 * re-runs after checking a method against its source.
 */

const marks = (entries: Record<string, number>) =>
  Object.entries(entries).map(([subject, percent]) => ({ subject, percent })) as SubjectMark[];

describe('UJ APS', () => {
  it("reproduces the prospectus' worked example: 35", () => {
    // 2027 prospectus p.16: First language 65% (5), Additional language 71% (6), Maths 61% (5),
    // Accounting 68% (5), History 81% (7), Geography 86% (7) = 35.
    const result = ujAps.score(
      marks({
        'isizulu-hl': 65,
        'english-fal': 71,
        mathematics: 61,
        accounting: 68,
        history: 81,
        geography: 86,
        'life-orientation': 90,
      }),
    );
    expect(result.total).toBe(35);
    expect(result.maximum).toBe(42);
  });

  it('gives a level-1 mark 1 point', () => {
    expect(ujAps.score(marks({ 'english-hl': 20 })).total).toBe(1);
  });
});

describe('UKZN APS', () => {
  it("reproduces the prospectus' worked example: 35", () => {
    // 2027 prospectus p.17: HL 5 + FAL 6 + LO 4 (no points) + Maths 5 + Accounting 6 +
    // Business Studies 6 + CAT 7 = 35.
    const result = ukznAps.score(
      marks({
        'isizulu-hl': 65,
        'english-fal': 75,
        'life-orientation': 55,
        mathematics: 65,
        accounting: 75,
        'business-studies': 75,
        'computer-applications-technology': 85,
      }),
    );
    expect(result.total).toBe(35);
  });

  it('awards 8 points at 90–100%, for a maximum of 48', () => {
    const all = ukznAps.score(
      marks({
        'english-hl': 95,
        'isizulu-fal': 95,
        mathematics: 95,
        'physical-sciences': 95,
        'life-sciences': 95,
        geography: 95,
      }),
    );
    expect(all.total).toBe(48);
  });

  it('always counts English and Mathematics when there are more than six subjects', () => {
    const result = ukznAps.score(
      marks({
        'english-fal': 41,
        'isizulu-hl': 90,
        'mathematical-literacy': 45,
        history: 85,
        geography: 85,
        'religion-studies': 85,
        'visual-arts': 85,
        tourism: 85,
      }),
    );
    expect(result.lines.find((l) => l.subject === 'english-fal')?.counted).toBe(true);
    expect(result.lines.find((l) => l.subject === 'mathematical-literacy')?.counted).toBe(true);
  });

  it('ranks Medicine on a six-subject average including the four key subjects', () => {
    const result = ukznMbchbAverage.score(
      marks({
        'english-fal': 70,
        mathematics: 72,
        'physical-sciences': 68,
        'life-sciences': 74,
        'isizulu-hl': 80,
        geography: 60,
        'life-orientation': 95,
      }),
    );
    expect(result.total).toBe(Math.round(((70 + 72 + 68 + 74 + 80 + 60) / 6) * 10) / 10);
    expect(result.lines.find((l) => l.subject === 'life-orientation')?.counted).toBe(false);
  });
});

describe('UP APS', () => {
  it('adds the best six on the 1–7 scale, without Life Orientation', () => {
    const result = upAps.score(
      marks({
        'english-hl': 72,
        'afrikaans-fal': 55,
        mathematics: 81,
        'physical-sciences': 68,
        'life-sciences': 49,
        geography: 63,
        'life-orientation': 92,
      }),
    );
    expect(result.total).toBe(6 + 4 + 7 + 5 + 3 + 5);
  });
});

describe('TUT APS', () => {
  it('counts a level-1 mark as nothing', () => {
    expect(tutAps.score(marks({ 'english-fal': 25 })).total).toBe(0);
  });

  it('always includes English', () => {
    const result = tutAps.score(
      marks({
        'english-fal': 45,
        'sepedi-hl': 80,
        mathematics: 80,
        'physical-sciences': 80,
        'life-sciences': 80,
        geography: 80,
        history: 80,
      }),
    );
    expect(result.lines.find((l) => l.subject === 'english-fal')?.counted).toBe(true);
    expect(result.total).toBe(3 + 5 * 7);
  });
});

describe('Wits APS', () => {
  it('adds 2 for English and Mathematics at 60% and above, and caps Life Orientation at 4', () => {
    const result = witsAps.score(
      marks({
        'english-hl': 92, // 10
        'isizulu-fal': 75, // 6
        mathematics: 65, // 7
        'physical-sciences': 55, // 4
        'life-sciences': 45, // 3
        geography: 85, // 7
        'life-orientation': 95, // 4
      }),
    );
    expect(result.total).toBe(10 + 6 + 7 + 4 + 3 + 7 + 4);
  });

  it('scores nothing below 40%, and no bonus below 60%', () => {
    const result = witsAps.score(marks({ 'english-fal': 59, mathematics: 35 }));
    expect(result.total).toBe(4);
  });

  it('reaches 56 at 90%+ in seven subjects', () => {
    const result = witsAps.score(
      marks({
        'english-hl': 95,
        'isizulu-fal': 95,
        mathematics: 95,
        'physical-sciences': 95,
        'life-sciences': 95,
        geography: 95,
        'life-orientation': 95,
      }),
    );
    expect(result.total).toBe(56);
  });
});

describe('UCT FPS', () => {
  const learner = marks({
    'english-fal': 70,
    'isixhosa-hl': 85,
    mathematics: 75,
    'physical-sciences': 65,
    'life-sciences': 55,
    geography: 39,
    'life-orientation': 90,
  });

  it('adds English and the best five other percentages, ignoring anything under 40%', () => {
    const result = uctFps.score(learner);
    expect(result.total).toBe(70 + 85 + 75 + 65 + 55 + 0);
    expect(result.maximum).toBe(600);
  });

  it('counts the programme’s required subjects first', () => {
    const result = uctFps.score(
      marks({
        'english-hl': 60,
        'isizulu-fal': 90,
        history: 90,
        geography: 90,
        'religion-studies': 90,
        tourism: 90,
        mathematics: 50,
      }),
      { requiredGroups: [['mathematics']] },
    );
    expect(result.lines.find((l) => l.subject === 'mathematics')?.counted).toBe(true);
    expect(result.total).toBe(60 + 50 + 90 * 4);
  });

  it('doubles Mathematics and Physical Sciences for Science, out of 800', () => {
    const result = uctFpsScience.score(learner, {
      requiredGroups: [['mathematics'], ['physical-sciences']],
    });
    expect(result.total).toBe(70 + 85 + 75 * 2 + 65 * 2 + 55 + 0);
    expect(result.maximum).toBe(800);
  });
});

describe('the catalogue and the methods agree', () => {
  it('gives every university a default method that exists', () => {
    for (const id of UNIVERSITY_IDS) {
      expect(METHODS.get(DEFAULT_METHOD[id])?.universityId).toBe(id);
    }
  });

  it('resolves every programme to a method of its own university', () => {
    for (const programme of RAW_CATALOGUE.programmes) {
      expect(methodFor(programme).universityId).toBe(programme.universityId);
    }
  });

  it('refuses an unknown method', () => {
    expect(() => methodFor({ universityId: 'uj', scoreMethod: 'made-up' })).toThrow(RangeError);
  });

  it('keeps every published minimum within its method’s maximum', () => {
    for (const programme of RAW_CATALOGUE.programmes) {
      const method = methodFor(programme);
      if (programme.minimumScore !== null) {
        expect(programme.minimumScore).toBeLessThanOrEqual(method.maximum);
      }
    }
  });

  it('checks every programme against a typical report without throwing', () => {
    const report = marks({
      'english-fal': 62,
      'isizulu-hl': 74,
      mathematics: 58,
      'physical-sciences': 55,
      'life-sciences': 66,
      geography: 61,
      'life-orientation': 80,
    });
    for (const programme of RAW_CATALOGUE.programmes) {
      const check = checkProgramme(programme, report, methodFor(programme));
      expect(['qualifies', 'close', 'not-yet']).toContain(check.verdict);
    }
  });
});
