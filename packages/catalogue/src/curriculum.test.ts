import { describe, expect, it } from 'vitest';
import {
  type Curriculum,
  type CurriculumModule,
  choosesCredits,
  curriculumProblems,
  curriculumSchema,
} from './curriculum';

/** A synthetic first year (hard rule 4): TEST codes, made-up names. */
const mod = (
  code: string,
  credits: number,
  compulsory: boolean,
  semester: CurriculumModule['semester'] = 'S1',
): CurriculumModule => ({ code, name: `Test ${code}`, semester, credits, compulsory });

const CURRICULUM: Curriculum = {
  sourceUrl: 'https://www.wits.ac.za/test-rules.pdf',
  academicYear: 2027,
  programmeId: 'wits-bsc-computer-science',
  programmeCode: 'TSTPROG1',
  yearOfStudy: 1,
  modules: [
    mod('TEST101', 36, true, 'Y'),
    mod('TEST102', 18, true, 'S1'),
    mod('TEST103', 18, true, 'either'),
    mod('ELEC201', 18, false, 'S1'),
    mod('ELEC202', 18, false, 'S2'),
    mod('ELEC203', 36, false, 'Y'),
    mod('OPTN301', 12, false, 'Q1'),
    mod('OPTN302', 12, false, 'Q2'),
  ],
  electiveGroups: [
    {
      label: 'Choose 36 credits',
      choose: { credits: 36 },
      from: ['ELEC201', 'ELEC202', 'ELEC203'],
    },
    { label: 'Choose one', choose: { count: 1 }, from: ['optn 301', 'OPTN302'] },
  ],
  totalCredits: { min: 144, max: 156 },
};

const variant = (over: Partial<Curriculum>) => ({ ...CURRICULUM, ...over });

describe('curriculumSchema', () => {
  it('accepts a consistent first year', () => {
    expect(curriculumProblems(CURRICULUM)).toEqual([]);
    expect(curriculumSchema.safeParse(CURRICULUM).success).toBe(true);
  });

  it('refuses a curriculum without a source, or for a later year of study', () => {
    const { sourceUrl: _omitted, ...rest } = CURRICULUM;
    expect(curriculumSchema.safeParse(rest).success).toBe(false);
    expect(curriculumSchema.safeParse(variant({ yearOfStudy: 2 as 1 })).success).toBe(false);
  });

  it('refuses a code listed twice, even in another case or spacing', () => {
    const modules = [...CURRICULUM.modules, mod('test 101', 36, true)];
    expect(curriculumProblems(variant({ modules }))).toEqual(['Module test 101 is listed twice']);
    expect(curriculumSchema.safeParse(variant({ modules })).success).toBe(false);
  });

  it('accepts a module whose term the rule book doesn’t print (no semester at all)', () => {
    const { semester: _unprinted, ...noTerm } = mod('TEST101', 36, true, 'Y');
    const modules = [noTerm, ...CURRICULUM.modules.slice(1)];
    expect(curriculumSchema.safeParse(variant({ modules })).success).toBe(true);
  });

  it('refuses an unknown semester, negative credits and an empty module list', () => {
    const bad = [mod('TEST101', 36, true, 'S3' as never)];
    expect(curriculumSchema.safeParse(variant({ modules: bad })).success).toBe(false);
    const negative = [mod('TEST101', -1, true)];
    expect(curriculumSchema.safeParse(variant({ modules: negative })).success).toBe(false);
    expect(curriculumSchema.safeParse(variant({ modules: [] })).success).toBe(false);
  });

  it('refuses a group naming a module that isn’t listed, or one that is compulsory', () => {
    const electiveGroups = [
      { label: 'Choose one', choose: { count: 1 }, from: ['NOPE999', 'TEST102', 'OPTN301'] },
    ];
    expect(curriculumProblems(variant({ electiveGroups }))).toEqual([
      '“Choose one” names NOPE999, which isn’t in the modules',
      '“Choose one” names TEST102, which is compulsory',
      // OPTN302 and the ELEC modules are now in no group: allowed (an optional extra).
    ]);
  });

  it('refuses a module named twice in a group, or in two groups', () => {
    const twice = [{ label: 'Choose one', choose: { count: 1 }, from: ['OPTN301', 'optn301'] }];
    expect(curriculumProblems(variant({ electiveGroups: twice }))).toEqual([
      '“Choose one” names a module twice',
      'optn301 is in more than one elective group',
    ]);
    const overlap = [
      ...CURRICULUM.electiveGroups,
      { label: 'Or this', choose: { count: 1 }, from: ['OPTN302'] },
    ];
    expect(curriculumProblems(variant({ electiveGroups: overlap }))).toContain(
      'OPTN302 is in more than one elective group',
    );
  });

  it('refuses a group that can’t be satisfied', () => {
    const credits = [{ label: 'Too many', choose: { credits: 100 }, from: ['ELEC201'] }];
    expect(curriculumProblems(variant({ electiveGroups: credits }))).toContain(
      '“Too many” can’t reach 100 credits',
    );
    const count = [{ label: 'Too many', choose: { count: 3 }, from: ['OPTN301', 'OPTN302'] }];
    expect(curriculumProblems(variant({ electiveGroups: count }))).toContain(
      '“Too many” has fewer than 3 modules',
    );
  });

  it('refuses a group asking for both credits and a count, or neither', () => {
    const both = [{ label: 'Both', choose: { credits: 12, count: 1 }, from: ['OPTN301'] }];
    expect(curriculumSchema.safeParse(variant({ electiveGroups: both as never })).success).toBe(
      false,
    );
    const neither = [{ label: 'Neither', choose: {}, from: ['OPTN301'] }];
    expect(curriculumSchema.safeParse(variant({ electiveGroups: neither as never })).success).toBe(
      false,
    );
  });

  it('refuses totals no registration could meet', () => {
    // Compulsory 72 + 36 credits + the cheapest one of two 12-credit modules = 120.
    expect(curriculumProblems(variant({ totalCredits: { min: 100, max: 119 } }))).toEqual([
      'The compulsory modules and the least the elective groups ask for come to 120 credits, above the published maximum of 119',
    ]);
    // Everything listed: 72 + 72 + 24 = 168.
    expect(curriculumProblems(variant({ totalCredits: { min: 169, max: 200 } }))).toEqual([
      'Every module listed comes to 168 credits, below the published minimum of 169',
    ]);
    expect(curriculumProblems(variant({ totalCredits: { min: 150, max: 140 } }))).toContain(
      'The credit total’s minimum is above its maximum',
    );
  });

  it('accepts a module printed under alternative codes, and a group naming it by either code', () => {
    const modules = [
      ...CURRICULUM.modules.slice(0, 2),
      { ...mod('TEST103F', 18, true, 'either'), alternativeCodes: ['TEST103S'] },
      ...CURRICULUM.modules.slice(3, 6),
      { ...mod('OPTN301F', 12, false, 'either'), alternativeCodes: ['optn 301s'] },
      ...CURRICULUM.modules.slice(7),
    ];
    for (const named of ['OPTN301F', 'OPTN301S']) {
      const electiveGroups = [
        ...CURRICULUM.electiveGroups.slice(0, 1),
        { label: 'Choose one', choose: { count: 1 }, from: [named, 'OPTN302'] },
      ];
      expect(curriculumProblems(variant({ modules, electiveGroups }))).toEqual([]);
      expect(curriculumSchema.safeParse(variant({ modules, electiveGroups })).success).toBe(true);
    }
  });

  it('refuses an alternative code that repeats a code already in the curriculum', () => {
    const asOtherModule = [
      ...CURRICULUM.modules.slice(0, 2),
      { ...mod('TEST103', 18, true, 'either'), alternativeCodes: ['test 102'] },
      ...CURRICULUM.modules.slice(3),
    ];
    expect(curriculumProblems(variant({ modules: asOtherModule }))).toEqual([
      'Module test 102 is listed twice',
    ]);
    const twice = [
      ...CURRICULUM.modules.slice(0, 2),
      { ...mod('TEST103', 18, true, 'either'), alternativeCodes: ['TEST104', 'TEST104'] },
      ...CURRICULUM.modules.slice(3),
    ];
    expect(curriculumProblems(variant({ modules: twice }))).toEqual([
      'Module TEST104 is listed twice',
    ]);
    expect(curriculumSchema.safeParse(variant({ modules: twice })).success).toBe(false);
  });

  it('refuses a group naming one module by both of its codes', () => {
    const modules = [
      ...CURRICULUM.modules.slice(0, 6),
      { ...mod('OPTN301F', 12, false, 'either'), alternativeCodes: ['OPTN301S'] },
      ...CURRICULUM.modules.slice(7),
    ];
    const electiveGroups = [
      ...CURRICULUM.electiveGroups.slice(0, 1),
      { label: 'Choose one', choose: { count: 1 }, from: ['OPTN301F', 'OPTN301S', 'OPTN302'] },
    ];
    expect(curriculumProblems(variant({ modules, electiveGroups }))).toEqual([
      '“Choose one” names a module twice',
      'OPTN301S is in more than one elective group',
    ]);
  });

  it('tells a credits group from a count group', () => {
    expect(CURRICULUM.electiveGroups.map(choosesCredits)).toEqual([true, false]);
  });
});

/** "Either a) ELEC201 and ELEC202 or b) ELEC203" (A13-05): one whole set, never a mix. */
const SETS: Curriculum['electiveGroups'][number] = {
  label: 'Either a) ELEC201 and ELEC202 or b) ELEC203',
  choose: { oneSetOf: [['ELEC201', 'ELEC202'], ['ELEC203']] },
  from: ['ELEC201', 'ELEC202', 'ELEC203'],
};

describe('an elective group of alternative sets (A13-05)', () => {
  it('accepts one set or the other, and counts its cheapest set towards the totals', () => {
    const electiveGroups = [SETS, CURRICULUM.electiveGroups[1] as Curriculum['electiveGroups'][0]];
    expect(curriculumProblems(variant({ electiveGroups }))).toEqual([]);
    expect(curriculumSchema.safeParse(variant({ electiveGroups })).success).toBe(true);
    expect(choosesCredits(SETS)).toBe(false);
    // Compulsory 72 + the cheapest set (36) + the cheapest option (12) = 120.
    expect(
      curriculumProblems(variant({ electiveGroups, totalCredits: { min: 100, max: 119 } })),
    ).toEqual([
      'The compulsory modules and the least the elective groups ask for come to 120 credits, above the published maximum of 119',
    ]);
  });

  it('refuses fewer than two sets, an empty set, or sets that don’t match the group’s modules', () => {
    const one = { ...SETS, choose: { oneSetOf: [['ELEC201', 'ELEC202', 'ELEC203']] } };
    expect(curriculumSchema.safeParse(variant({ electiveGroups: [one] })).success).toBe(false);
    const empty = { ...SETS, choose: { oneSetOf: [['ELEC201', 'ELEC202', 'ELEC203'], []] } };
    expect(curriculumSchema.safeParse(variant({ electiveGroups: [empty] })).success).toBe(false);
    const missing = { ...SETS, choose: { oneSetOf: [['ELEC201'], ['ELEC203']] } };
    expect(curriculumProblems(variant({ electiveGroups: [missing] }))).toEqual([
      `“${SETS.label}” lists ELEC202, which is in none of its sets`,
    ]);
    const stray = {
      ...SETS,
      choose: {
        oneSetOf: [
          ['ELEC201', 'ELEC202'],
          ['ELEC203', 'OPTN301'],
        ],
      },
    };
    expect(curriculumProblems(variant({ electiveGroups: [stray] }))).toEqual([
      `“${SETS.label}” has OPTN301 in a set but not in its modules`,
    ]);
    const shared = {
      ...SETS,
      choose: {
        oneSetOf: [
          ['ELEC201', 'ELEC202'],
          ['elec 202', 'ELEC203'],
        ],
      },
    };
    expect(curriculumProblems(variant({ electiveGroups: [shared] }))).toEqual([
      `“${SETS.label}” has elec 202 in more than one set`,
    ]);
  });
});

describe('open electives (A1-27)', () => {
  /** Wits-LLB-shaped: the listed modules, plus 36 credits from any other faculty. */
  const OPEN = variant({
    modules: CURRICULUM.modules.slice(0, 3),
    electiveGroups: [],
    openElectiveCredits: {
      credits: 36,
      note: 'Courses from any other faculty to the value of 36 credits',
    },
    totalCredits: { min: 108, max: 108 },
  });

  it('accepts open credits, and counts them towards the most a registration can reach', () => {
    // The listed modules come to 72; with the 36 open credits, 108 is reachable.
    expect(curriculumProblems(OPEN)).toEqual([]);
    expect(curriculumSchema.safeParse(OPEN).success).toBe(true);
    const { openElectiveCredits: _open, ...closed } = OPEN;
    expect(curriculumProblems(closed)).toEqual([
      'Every module listed comes to 72 credits, below the published minimum of 108',
    ]);
  });

  it('refuses open credits without a positive number or the rule book’s words', () => {
    for (const openElectiveCredits of [
      { credits: 0, note: 'Any other faculty' },
      { credits: 36, note: '' },
      { credits: 36 },
    ]) {
      expect(
        curriculumSchema.safeParse({ ...OPEN, openElectiveCredits }).success,
        JSON.stringify(openElectiveCredits),
      ).toBe(false);
    }
  });
});
