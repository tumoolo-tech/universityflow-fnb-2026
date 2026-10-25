import { describe, expect, it } from 'vitest';
import {
  applicationWindowSchema,
  dialable,
  either,
  helplineSchema,
  isOptionsRequirement,
  otherSubjects,
  programmeSchema,
  requires,
  subjectRequirementSchema,
} from './records';
import { isHomeLanguage, isLanguage, isSubjectId, SUBJECTS, subject } from './subjects';

const SOURCE = { sourceUrl: 'https://www.example.ac.za/p.pdf', academicYear: 2027 };

const PROGRAMME = {
  ...SOURCE,
  id: 'bsc-computer-science',
  universityId: 'wits',
  name: 'BSc Computer Science',
  faculty: 'Science',
  qualification: 'degree',
  durationYears: 3,
  minimumScore: 42,
  requiredPass: 'bachelor',
  subjectRequirements: [requires(['mathematics'], { level: 6 })],
  nbt: 'required',
  selection: null,
  closesOn: null,
};

describe('subjects', () => {
  it('lists every official language at HL and FAL level', () => {
    expect(isSubjectId('isizulu-hl')).toBe(true);
    expect(isSubjectId('tshivenda-fal')).toBe(true);
    expect(SUBJECTS.filter((s) => 'language' in s)).toHaveLength(22);
  });

  it('gives Life Orientation 10 credits and every other subject 20', () => {
    expect(subject('life-orientation').credits).toBe(10);
    expect(SUBJECTS.filter((s) => s.credits !== 20).map((s) => s.id)).toEqual(['life-orientation']);
  });

  it('refuses an unknown subject', () => {
    expect(isSubjectId('astrology')).toBe(false);
    expect(() => subject('astrology' as never)).toThrow(RangeError);
  });
});

describe('programmeSchema', () => {
  it('accepts a sourced programme', () => {
    expect(programmeSchema.safeParse(PROGRAMME).success).toBe(true);
  });

  it('refuses a programme without a source (hard rule 3)', () => {
    const { sourceUrl: _omitted, ...rest } = PROGRAMME;
    expect(programmeSchema.safeParse(rest).success).toBe(false);
  });

  it('refuses an unknown subject in a requirement', () => {
    const bad = {
      ...PROGRAMME,
      subjectRequirements: [requires(['astrology' as never], { level: 4 })],
    };
    expect(programmeSchema.safeParse(bad).success).toBe(false);
  });

  it('refuses an id that is not a slug', () => {
    expect(programmeSchema.safeParse({ ...PROGRAMME, id: 'BSc CS' }).success).toBe(false);
  });
});

describe('subjectRequirementSchema', () => {
  it('needs a level or a percentage', () => {
    expect(
      subjectRequirementSchema.safeParse({ options: [{ subjects: ['mathematics'] }] }).success,
    ).toBe(false);
  });

  it('needs at least one option', () => {
    expect(subjectRequirementSchema.safeParse({ options: [] }).success).toBe(false);
  });

  it('builds the common single-option form', () => {
    expect(requires(['mathematics'], { level: 5, percent: 65 })).toEqual({
      options: [{ subjects: ['mathematics'], minLevel: 5, minPercent: 65 }],
    });
    expect(requires(['mathematics'], { percent: 65 })).toEqual({
      options: [{ subjects: ['mathematics'], minPercent: 65 }],
    });
  });
});

describe('requirement builders', () => {
  it('joins single-option requirements into one either/or requirement', () => {
    expect(
      either(requires(['english-hl'], { level: 5 }), requires(['english-fal'], { level: 6 })),
    ).toEqual({
      options: [
        { subjects: ['english-hl'], minLevel: 5 },
        { subjects: ['english-fal'], minLevel: 6 },
      ],
    });
  });

  it('builds an other-subjects requirement by level or percentage', () => {
    expect(otherSubjects(3, { level: 4 })).toEqual({ otherSubjects: { count: 3, minLevel: 4 } });
    expect(otherSubjects(2, { percent: 60 })).toEqual({
      otherSubjects: { count: 2, minPercent: 60 },
    });
    expect(isOptionsRequirement(otherSubjects(2, { level: 4 }))).toBe(false);
    expect(isOptionsRequirement(requires(['mathematics'], { level: 4 }))).toBe(true);
  });

  it('refuses an other-subjects requirement with no minimum', () => {
    expect(subjectRequirementSchema.safeParse({ otherSubjects: { count: 2 } }).success).toBe(false);
  });
});

describe('language subjects', () => {
  it('tells home languages from additional languages', () => {
    expect(isHomeLanguage('isizulu-hl')).toBe(true);
    expect(isHomeLanguage('isizulu-fal')).toBe(false);
    expect(isHomeLanguage('mathematics')).toBe(false);
    expect(isLanguage(subject('setswana-fal'))).toBe(true);
    expect(isLanguage(subject('history'))).toBe(false);
  });
});

describe('applicationWindowSchema', () => {
  const window = {
    ...SOURCE,
    universityId: 'uj',
    opensOn: '2026-04-01',
    closesOn: '2026-10-31',
    earlierClosings: [],
    grade11ResultsAccepted: true,
    feeZar: 0,
    feeNote: null,
  };

  it('accepts a window that opens before it closes', () => {
    expect(applicationWindowSchema.safeParse(window).success).toBe(true);
  });

  it('refuses a window that closes before it opens', () => {
    expect(applicationWindowSchema.safeParse({ ...window, opensOn: '2026-11-01' }).success).toBe(
      false,
    );
  });
});

describe('helplines', () => {
  it('refuses a number with letters in it', () => {
    const line = {
      ...SOURCE,
      id: 'test-line',
      name: 'Test line',
      numbers: [{ kind: 'call', value: '0800 HELP' }],
      hours: '24 hours',
      purpose: 'Testing',
      topics: ['distress'],
    };
    expect(helplineSchema.safeParse(line).success).toBe(false);
  });

  it('turns a printed number into one a phone can dial', () => {
    expect(dialable('0800 36 36 36')).toBe('0800363636');
    expect(dialable('+27 11 234 4837')).toBe('+27112344837');
  });
});
