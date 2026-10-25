import {
  type Curriculum,
  type CurriculumModule,
  curriculumProblems,
  curriculumSchema,
  MODULE_TERMS,
  type ModuleTerm,
  OFFERED_TERMS,
  offeredIn,
  RAW_CATALOGUE,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import {
  compareRegistration,
  DIFFERENCE_KINDS,
  type RegisteredModule,
  type RegistrationDifference,
} from './registration';

/**
 * The registration check (planning.md §11, Phase 5c, "Tests"): worked examples on a synthetic
 * curriculum, then properties over generated curricula and registrations. Synthetic only (hard
 * rule 4): TEST codes, made-up names.
 */

const mod = (
  code: string,
  credits: number,
  compulsory: boolean,
  semester: CurriculumModule['semester'],
): CurriculumModule => ({ code, name: `Test ${code}`, semester, credits, compulsory });

/** Compulsory 72 credits; 36 credits from ELEC; one of OPTN; total 120–144. */
const CURRICULUM: Curriculum = {
  sourceUrl: 'https://www.wits.ac.za/test-rules.pdf',
  academicYear: 2027,
  programmeId: 'wits-test-programme',
  yearOfStudy: 1,
  modules: [
    mod('TEST101', 36, true, 'Y'),
    mod('TEST102', 18, true, 'S1'),
    mod('TEST103', 18, true, 'either'),
    mod('ELEC201', 18, false, 'S1'),
    mod('ELEC202', 18, false, 'S2'),
    mod('ELEC203', 36, false, 'Y'),
    mod('OPTN301', 12, false, 'Q1'),
    mod('OPTN302', 24, false, 'Q2'),
    mod('FREE401', 6, false, 'S2'),
  ],
  electiveGroups: [
    {
      label: 'Choose 36 credits',
      choose: { credits: 36 },
      from: ['ELEC201', 'ELEC202', 'ELEC203'],
    },
    { label: 'Choose one', choose: { count: 1 }, from: ['OPTN301', 'OPTN302'] },
  ],
  totalCredits: { min: 120, max: 144 },
};

const reg = (code: string, extra: Partial<RegisteredModule> = {}): RegisteredModule => ({
  code,
  ...extra,
});

/** A sound registration: the compulsory three, ELEC203 (36 credits), OPTN301. 120 credits. */
const SOUND = [
  reg('TEST101', { semester: 'Y' }),
  reg('TEST102', { semester: 'S1' }),
  reg('TEST103', { semester: 'S2' }),
  reg('ELEC203', { semester: 'Y' }),
  reg('OPTN301', { semester: 'Q1' }),
];

const kinds = (differences: ReadonlyArray<RegistrationDifference>) =>
  differences.map((d) => d.kind);

describe('compareRegistration: worked examples', () => {
  it('finds nothing wrong with a sound registration', () => {
    const result = compareRegistration(SOUND, CURRICULUM);
    expect(result.differences).toEqual([]);
    expect(result.matched.map((m) => m.module.code)).toEqual([
      'TEST101',
      'TEST102',
      'TEST103',
      'ELEC203',
      'OPTN301',
    ]);
    expect(result.credits).toEqual({ registered: 120, uncounted: [], min: 120, max: 144 });
    expect(result.programmeId).toBe('wits-test-programme');
    expect(result.academicYear).toBe(2027);
  });

  it('compares codes without case or spaces, and never compares names', () => {
    const typed = [
      reg('test 101', { name: 'Something else entirely' }),
      reg('Test102'),
      reg(' TEST 103 '),
      reg('elec203'),
      reg('optn301'),
    ];
    expect(compareRegistration(typed, CURRICULUM).differences).toEqual([]);
  });

  it('says which compulsory module is missing (and the credits it leaves short)', () => {
    const result = compareRegistration(
      SOUND.filter((r) => r.code !== 'TEST102'),
      CURRICULUM,
    );
    expect(result.differences).toEqual([
      { kind: 'missing-compulsory', module: CURRICULUM.modules[1] },
      { kind: 'credits-short', registered: 102, min: 120, short: 18 },
    ]);
  });

  it('reports a module the curriculum doesn’t list, counting its credits only if given', () => {
    const unknown = compareRegistration([...SOUND, reg('OTHR999')], CURRICULUM);
    expect(unknown.differences).toEqual([
      { kind: 'not-in-curriculum', registered: reg('OTHR999') },
    ]);
    expect(unknown.credits.uncounted).toEqual(['OTHR999']);

    const withCredits = compareRegistration(
      [...SOUND, reg('OTHR999', { credits: 30 })],
      CURRICULUM,
    );
    expect(withCredits.differences).toEqual([
      { kind: 'not-in-curriculum', registered: reg('OTHR999', { credits: 30 }) },
      { kind: 'credits-over', registered: 150, max: 144, over: 6 },
    ]);
  });

  it('flags a module in a term the curriculum doesn’t offer it in', () => {
    const result = compareRegistration(
      SOUND.map((r) => (r.code === 'TEST102' ? { ...r, semester: 'S2' as const } : r)),
      CURRICULUM,
    );
    expect(result.differences).toEqual([
      {
        kind: 'wrong-semester',
        module: CURRICULUM.modules[1],
        registered: reg('TEST102', { semester: 'S2' }),
      },
    ]);
  });

  it('accepts an either-semester module in S1 or S2, but not as year-long', () => {
    for (const semester of ['S1', 'S2'] as const) {
      const r = SOUND.map((x) => (x.code === 'TEST103' ? { ...x, semester } : x));
      expect(compareRegistration(r, CURRICULUM).differences).toEqual([]);
    }
    const year = SOUND.map((x) => (x.code === 'TEST103' ? { ...x, semester: 'Y' as const } : x));
    expect(kinds(compareRegistration(year, CURRICULUM).differences)).toEqual(['wrong-semester']);
  });

  it('says nothing about the term of a module whose rule book prints none', () => {
    const { semester: _unprinted, ...noTerm } = mod('TEST102', 18, true, 'S1');
    const curriculum = {
      ...CURRICULUM,
      modules: CURRICULUM.modules.map((m) => (m.code === 'TEST102' ? noTerm : m)),
    };
    const inS2 = SOUND.map((r) => (r.code === 'TEST102' ? { ...r, semester: 'S2' as const } : r));
    expect(compareRegistration(inS2, curriculum).differences).toEqual([]);
  });

  it('says nothing about a term the proof doesn’t give', () => {
    const bare = SOUND.map((r) => reg(r.code));
    expect(compareRegistration(bare, CURRICULUM).differences).toEqual([]);
  });

  it('says how many credits an elective group is short', () => {
    // ELEC201 (18) instead of ELEC203 (36): 18 short in the group, and 102 credits in all.
    const result = compareRegistration(
      [...SOUND.filter((r) => r.code !== 'ELEC203'), reg('ELEC201')],
      CURRICULUM,
    );
    expect(result.differences).toEqual([
      {
        kind: 'elective-group-unsatisfied',
        group: CURRICULUM.electiveGroups[0],
        groupIndex: 0,
        chosen: [CURRICULUM.modules[3]],
        short: { credits: 18 },
      },
      { kind: 'credits-short', registered: 102, min: 120, short: 18 },
    ]);
  });

  it('says how many modules a choose-N group is short', () => {
    const result = compareRegistration(
      [...SOUND.filter((r) => r.code !== 'OPTN301'), reg('FREE401'), reg('ELEC201')],
      CURRICULUM,
    );
    expect(result.differences).toEqual([
      {
        kind: 'elective-group-unsatisfied',
        group: CURRICULUM.electiveGroups[1],
        groupIndex: 1,
        chosen: [],
        short: { count: 1 },
      },
    ]);
    expect(result.credits.registered).toBe(132);
  });

  it('counts a module given twice once, and says so', () => {
    const twice = [...SOUND, reg('test101', { semester: 'Y' })];
    const result = compareRegistration(twice, CURRICULUM);
    expect(result.differences).toEqual([
      {
        kind: 'registered-twice',
        code: 'TEST101',
        registered: [reg('TEST101', { semester: 'Y' }), reg('test101', { semester: 'Y' })],
      },
    ]);
    expect(result.credits.registered).toBe(120);
    expect(result.matched).toHaveLength(5);
  });

  it('reports too many credits', () => {
    const result = compareRegistration([...SOUND, reg('ELEC201'), reg('OPTN302')], CURRICULUM);
    expect(result.differences).toEqual([
      { kind: 'credits-over', registered: 162, max: 144, over: 18 },
    ]);
  });

  it('won’t call credits short while a module’s credits are unknown', () => {
    const result = compareRegistration(
      [...SOUND.filter((r) => r.code !== 'ELEC203'), reg('ELEC201'), reg('OTHR999')],
      CURRICULUM,
    );
    expect(kinds(result.differences)).toEqual(['not-in-curriculum', 'elective-group-unsatisfied']);
    expect(result.credits).toMatchObject({ registered: 102, uncounted: ['OTHR999'] });
  });

  it('ignores a credit value that isn’t one', () => {
    for (const credits of [Number.NaN, -6, Number.POSITIVE_INFINITY]) {
      const result = compareRegistration([...SOUND, reg('OTHR999', { credits })], CURRICULUM);
      expect(result.credits).toMatchObject({ registered: 120, uncounted: ['OTHR999'] });
    }
  });

  it('lists everything wrong with an empty registration, in the documented order', () => {
    const result = compareRegistration([], CURRICULUM);
    expect(kinds(result.differences)).toEqual([
      'missing-compulsory',
      'missing-compulsory',
      'missing-compulsory',
      'elective-group-unsatisfied',
      'elective-group-unsatisfied',
      'credits-short',
    ]);
  });

  it('orders a mixed result as DIFFERENCE_KINDS does', () => {
    const messy = [
      reg('OTHR999', { credits: 60 }),
      reg('TEST101', { semester: 'S1' }),
      reg('TEST101'),
      reg('ELEC201'),
    ];
    const order = kinds(compareRegistration(messy, CURRICULUM).differences).map((k) =>
      DIFFERENCE_KINDS.indexOf(k),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(DIFFERENCE_KINDS.length - 1); // all but credits-over
  });
});

/**
 * A module printed under two codes (UCT's "TEST103F/S": the suffix is the semester and part of the
 * code a registration shows). Recorded as TEST103F with alternative TEST103S, offered in `either`.
 */
const ALTERNATIVES: Curriculum = {
  ...CURRICULUM,
  modules: CURRICULUM.modules.map((m) =>
    m.code === 'TEST103'
      ? { ...m, code: 'TEST103F', alternativeCodes: ['TEST103S'] }
      : m.code === 'OPTN301'
        ? { ...m, code: 'OPTN301F', semester: 'either', alternativeCodes: ['OPTN301S'] }
        : m,
  ),
  electiveGroups: [
    ...CURRICULUM.electiveGroups.slice(0, 1),
    { label: 'Choose one', choose: { count: 1 }, from: ['OPTN301F', 'OPTN302'] },
  ],
};

describe('compareRegistration: a module under alternative codes', () => {
  const sound = [
    reg('TEST101', { semester: 'Y' }),
    reg('TEST102', { semester: 'S1' }),
    reg('TEST103S', { semester: 'S2' }),
    reg('ELEC203', { semester: 'Y' }),
    reg('optn 301s', { semester: 'S2' }),
  ];

  it('is a curriculum the catalogue accepts', () => {
    expect(curriculumProblems(ALTERNATIVES)).toEqual([]);
  });

  it('matches a registered alternative code: nothing missing, nothing outside the curriculum', () => {
    const result = compareRegistration(sound, ALTERNATIVES);
    expect(result.differences).toEqual([]);
    expect(result.matched.map((m) => [m.module.code, m.registered.code])).toEqual([
      ['TEST101', 'TEST101'],
      ['TEST102', 'TEST102'],
      ['TEST103F', 'TEST103S'],
      ['ELEC203', 'ELEC203'],
      ['OPTN301F', 'optn 301s'],
    ]);
    expect(result.credits).toEqual({ registered: 120, uncounted: [], min: 120, max: 144 });
  });

  it('counts an alternative code towards its elective group', () => {
    const withoutOption = sound.filter((r) => r.code !== 'optn 301s');
    expect(kinds(compareRegistration(withoutOption, ALTERNATIVES).differences)).toEqual([
      'elective-group-unsatisfied',
      'credits-short',
    ]);
    expect(compareRegistration(sound, ALTERNATIVES).differences).toEqual([]);
  });

  it('still checks the term the registration gives', () => {
    const yearLong = sound.map((r) =>
      r.code === 'TEST103S' ? reg('TEST103S', { semester: 'Y' }) : r,
    );
    const result = compareRegistration(yearLong, ALTERNATIVES);
    expect(result.differences).toEqual([
      {
        kind: 'wrong-semester',
        module: ALTERNATIVES.modules[2],
        registered: reg('TEST103S', { semester: 'Y' }),
      },
    ]);
  });

  it('calls the primary and an alternative code together a module registered twice', () => {
    const both = [...sound, reg('TEST103F', { semester: 'S1' })];
    const result = compareRegistration(both, ALTERNATIVES);
    expect(result.differences).toEqual([
      {
        kind: 'registered-twice',
        code: 'TEST103F',
        registered: [reg('TEST103S', { semester: 'S2' }), reg('TEST103F', { semester: 'S1' })],
      },
    ]);
    expect(result.credits.registered).toBe(120);
    expect(result.matched).toHaveLength(5);
  });
});

/** "Either a) PAIR101 and PAIR102 or b) PAIR201 and PAIR202" (A13-05). Compulsory 36; total 72. */
const PAIRS: Curriculum = {
  sourceUrl: 'https://www.wits.ac.za/test-rules.pdf',
  academicYear: 2027,
  programmeId: 'wits-test-programme',
  yearOfStudy: 1,
  modules: [
    mod('TEST101', 36, true, 'Y'),
    mod('PAIR101', 18, false, 'S1'),
    mod('PAIR102', 18, false, 'S2'),
    mod('PAIR201', 18, false, 'S1'),
    mod('PAIR202', 18, false, 'S2'),
  ],
  electiveGroups: [
    {
      label: 'Either a) PAIR101 and PAIR102 or b) PAIR201 and PAIR202',
      choose: {
        oneSetOf: [
          ['PAIR101', 'PAIR102'],
          ['PAIR201', 'PAIR202'],
        ],
      },
      from: ['PAIR101', 'PAIR102', 'PAIR201', 'PAIR202'],
    },
  ],
  totalCredits: { min: 72, max: 72 },
};

describe('compareRegistration: one whole set or the other (A13-05)', () => {
  const with_ = (...codes: string[]) => [reg('TEST101'), ...codes.map((c) => reg(c))];
  const sets = [
    ['PAIR101', 'PAIR102'],
    ['PAIR201', 'PAIR202'],
  ];

  it('is a curriculum the catalogue accepts', () => {
    expect(curriculumProblems(PAIRS)).toEqual([]);
  });

  it('accepts either whole set', () => {
    expect(compareRegistration(with_('PAIR101', 'PAIR102'), PAIRS).differences).toEqual([]);
    expect(compareRegistration(with_('pair 201', 'PAIR202'), PAIRS).differences).toEqual([]);
  });

  it('a mixed pair is a difference, though its credits add up', () => {
    const result = compareRegistration(with_('PAIR101', 'PAIR202'), PAIRS);
    expect(result.differences).toEqual([
      {
        kind: 'elective-group-unsatisfied',
        group: PAIRS.electiveGroups[0],
        groupIndex: 0,
        chosen: [PAIRS.modules[1], PAIRS.modules[4]],
        short: { oneSetOf: sets },
      },
    ]);
    expect(result.credits.registered).toBe(72);
  });

  it('half a set, or both sets, is a difference too', () => {
    expect(kinds(compareRegistration(with_('PAIR101'), PAIRS).differences)).toEqual([
      'elective-group-unsatisfied',
      'credits-short',
    ]);
    expect(
      kinds(
        compareRegistration(with_('PAIR101', 'PAIR102', 'PAIR201', 'PAIR202'), PAIRS).differences,
      ),
    ).toEqual(['elective-group-unsatisfied', 'credits-over']);
    expect(kinds(compareRegistration(with_(), PAIRS).differences)).toEqual([
      'elective-group-unsatisfied',
      'credits-short',
    ]);
  });
});

/**
 * Wits-LLB-shaped (A1-27): four listed law modules (90 credits) and "courses from any other
 * faculty to the value of 36 credits", which no list can hold.
 */
const OPEN: Curriculum = {
  sourceUrl: 'https://www.wits.ac.za/test-rules.pdf',
  academicYear: 2027,
  programmeId: 'wits-test-programme',
  yearOfStudy: 1,
  modules: [
    mod('LAWT101', 18, true, undefined),
    mod('LAWT102', 36, true, undefined),
    mod('LAWT103', 36, true, undefined),
    mod('LAWT104', 0, true, undefined),
  ],
  electiveGroups: [],
  openElectiveCredits: {
    credits: 36,
    note: 'Courses from any other faculty to the value of 36 credits',
  },
  totalCredits: { min: 90, max: 126 },
};

describe('compareRegistration: open electives (A1-27)', () => {
  const LAW = ['LAWT101', 'LAWT102', 'LAWT103', 'LAWT104'].map((c) => reg(c));

  it('is a curriculum the catalogue accepts', () => {
    expect(curriculumProblems(OPEN)).toEqual([]);
  });

  it('counts a module from another faculty as an open elective, not "not in the curriculum"', () => {
    const result = compareRegistration([...LAW, reg('OTHR101', { credits: 36 })], OPEN);
    expect(result.differences).toEqual([]);
    expect(result.openElectives).toEqual([reg('OTHR101', { credits: 36 })]);
    expect(result.credits).toEqual({ registered: 126, uncounted: [], min: 90, max: 126 });
    // Two half courses fill the same 36 credits.
    const halves = [...LAW, reg('OTHR101', { credits: 18 }), reg('OTHR102', { credits: 18 })];
    expect(compareRegistration(halves, OPEN).differences).toEqual([]);
  });

  it('once the open credits are used, another unlisted module is "not in the curriculum"', () => {
    const extra = [...LAW, reg('OTHR101', { credits: 36 }), reg('OTHR102', { credits: 18 })];
    const result = compareRegistration(extra, OPEN);
    expect(result.openElectives.map((r) => r.code)).toEqual(['OTHR101']);
    expect(kinds(result.differences)).toEqual(['not-in-curriculum', 'credits-over']);
    expect(result.differences[0]).toMatchObject({ registered: { code: 'OTHR102' } });
  });

  it('a module whose credits the proof doesn’t give uses up what is left, and isn’t counted', () => {
    const unknown = [...LAW, reg('OTHR101'), reg('OTHR102', { credits: 18 })];
    const result = compareRegistration(unknown, OPEN);
    expect(result.openElectives.map((r) => r.code)).toEqual(['OTHR101']);
    expect(kinds(result.differences)).toEqual(['not-in-curriculum']);
    expect(result.credits.uncounted).toEqual(['OTHR101']);
  });

  it('a curriculum without open credits still reports every unlisted module', () => {
    const { openElectiveCredits: _open, ...closed } = OPEN;
    const result = compareRegistration([...LAW, reg('OTHR101', { credits: 36 })], closed);
    expect(kinds(result.differences)).toEqual(['not-in-curriculum']);
    expect(result.openElectives).toEqual([]);
  });
});

describe('compareRegistration on the researched records (drafts, as printed)', () => {
  const record = (programmeId: string): Curriculum => {
    const found = RAW_CATALOGUE.curricula.find((c) => c.programmeId === programmeId);
    if (!found) throw new Error(`no curriculum for ${programmeId}`);
    return found;
  };
  /** Every compulsory module, by its printed code. */
  const compulsory = (c: Curriculum) =>
    c.modules.filter((m) => m.compulsory).map((m) => reg(m.code));
  /** The registration with the curriculum's other groups satisfied by their first modules. */
  const otherGroups = (c: Curriculum, skip: number) =>
    c.electiveGroups.flatMap((g, i) => {
      if (i === skip) return [];
      if ('count' in g.choose) return g.from.slice(0, g.choose.count).map((code) => reg(code));
      return [];
    });

  it('Wits BCom: Economics IA+IB or Economic Theory IA+IB, never a mix (A13-05)', () => {
    const bcom = record('wits-bcom');
    const group = bcom.electiveGroups.findIndex((g) => g.from.includes('ECON1012A'));
    const base = [...compulsory(bcom), ...otherGroups(bcom, group)];
    const pair = (...codes: string[]) =>
      compareRegistration([...base, ...codes.map((c) => reg(c))], bcom).differences.filter(
        (d) => d.kind === 'elective-group-unsatisfied' && d.groupIndex === group,
      );
    expect(pair('ECON1012A', 'ECON1014A')).toEqual([]);
    expect(pair('ECON1016A', 'ECON1018A')).toEqual([]);
    expect(pair('ECON1012A', 'ECON1018A')).toHaveLength(1);
  });

  it('Wits BSW: the ANTH pair or the SASL pair, never a mix (A13-05)', () => {
    const bsw = record('wits-bsw');
    const result = (...codes: string[]) =>
      compareRegistration([...compulsory(bsw), ...codes.map((c) => reg(c))], bsw).differences;
    expect(result('ANTH1006A', 'ANTH1007A')).toEqual([]);
    expect(result('SASL1000A', 'SASL1001A')).toEqual([]);
    expect(kinds(result('ANTH1006A', 'SASL1001A'))).toEqual(['elective-group-unsatisfied']);
  });

  it('Wits LLB: 36 credits from any other faculty are open electives (A1-27)', () => {
    const llb = record('wits-llb');
    const result = compareRegistration(
      [...compulsory(llb), reg('ENGL1001A', { credits: 18 }), reg('POLS1007A', { credits: 18 })],
      llb,
    );
    expect(result.differences).toEqual([]);
    expect(result.openElectives.map((r) => r.code)).toEqual(['ENGL1001A', 'POLS1007A']);
  });

  it('UKZN BSc CS&IT: any Level 1 elective counts (A1-27)', () => {
    const csit = record('ukzn-bsc-computer-science-it');
    const result = compareRegistration(
      [...compulsory(csit), reg('ECON101'), reg('TEST120', { credits: 16 })],
      csit,
    );
    expect(result.differences).toEqual([]);
    expect(result.openElectives.map((r) => r.code)).toEqual(['TEST120']);
  });
});

/** A small seeded random generator, so a failing case can be replayed (as cadence.test.ts). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Case {
  readonly curriculum: Curriculum;
  /** A registration that follows the curriculum exactly: no differences expected. */
  readonly sound: RegisteredModule[];
}

/**
 * A random consistent curriculum and a sound registration for it. The credit range always
 * leaves room to drop any one compulsory module without going short, so "remove one" properties
 * isolate that one difference.
 */
function generate(seed: number): Case {
  const random = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = <T>(items: ReadonlyArray<T>): T => items[int(0, items.length - 1)] as T;
  const CREDITS = [6, 8, 12, 15, 16, 18, 24, 30, 32, 36];
  let n = 0;
  const code = () => `TEST${100 + n++}${pick(['', 'A', 'B'])}`;
  /** How a learner might type the code: any case, stray spaces. */
  const typed = (c: string) => {
    const cased = random() < 0.5 ? c.toLowerCase() : c;
    return random() < 0.3 ? `${cased.slice(0, 4)} ${cased.slice(4)}` : cased;
  };
  const termFor = (offered: CurriculumModule['semester']): ModuleTerm | undefined => {
    if (offered === undefined || random() < 0.25) return undefined;
    return offered === 'either' ? pick(['S1', 'S2'] as const) : offered;
  };

  const modules: CurriculumModule[] = [];
  const chosen: CurriculumModule[] = [];
  for (let i = int(1, 6); i > 0; i--) {
    const m = mod(code(), random() < 0.1 ? 0 : pick(CREDITS), true, pick(OFFERED_TERMS));
    modules.push(m);
    chosen.push(m);
  }
  const electiveGroups: Curriculum['electiveGroups'] = [];
  for (let g = int(0, 3); g > 0; g--) {
    const members = Array.from({ length: int(1, 4) }, () =>
      mod(code(), pick(CREDITS), false, pick(OFFERED_TERMS)),
    );
    modules.push(...members);
    const k = int(1, members.length);
    const picked = [...members].sort(() => random() - 0.5).slice(0, k);
    chosen.push(...picked);
    const byCredits = random() < 0.5;
    electiveGroups.push({
      label: `Test group ${electiveGroups.length + 1}`,
      choose: byCredits ? { credits: picked.reduce((s, m) => s + m.credits, 0) } : { count: k },
      from: members.map((m) => m.code),
    });
  }
  for (let f = int(0, 2); f > 0; f--) modules.push(mod(code(), pick(CREDITS), false, 'S1'));

  const total = chosen.reduce((s, m) => s + m.credits, 0);
  const heaviest = Math.max(...chosen.filter((m) => m.compulsory).map((m) => m.credits));
  const curriculum: Curriculum = {
    sourceUrl: 'https://www.wits.ac.za/test-rules.pdf',
    academicYear: 2027,
    programmeId: 'wits-test-programme',
    yearOfStudy: 1,
    modules: [...modules].sort(() => random() - 0.5),
    electiveGroups,
    totalCredits: { min: Math.max(0, total - heaviest - int(0, 20)), max: total + int(0, 40) },
  };
  const sound = [...chosen]
    .sort(() => random() - 0.5)
    .map((m) => {
      const semester = termFor(m.semester);
      return { code: typed(m.code), ...(semester ? { semester } : {}) };
    });
  return { curriculum, sound };
}

const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

describe('compareRegistration: properties over generated curricula', () => {
  it('generates only curricula the catalogue would accept', () => {
    for (const seed of SEEDS) {
      const { curriculum } = generate(seed);
      expect(curriculumProblems(curriculum), `seed ${seed}`).toEqual([]);
      expect(curriculumSchema.safeParse(curriculum).success, `seed ${seed}`).toBe(true);
    }
  });

  it('a registration that follows the curriculum has no differences', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      const result = compareRegistration(sound, curriculum);
      expect(result.differences, `seed ${seed}`).toEqual([]);
      expect(result.matched, `seed ${seed}`).toHaveLength(sound.length);
    }
  });

  it('removing any compulsory module yields exactly that difference', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      for (const module of curriculum.modules.filter((m) => m.compulsory)) {
        const without = sound.filter(
          (r) => r.code.replace(/\s/g, '').toUpperCase() !== module.code,
        );
        expect(compareRegistration(without, curriculum).differences, `seed ${seed}`).toEqual([
          { kind: 'missing-compulsory', module },
        ]);
      }
    }
  });

  it('adding a code the curriculum lacks yields exactly not-in-curriculum', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      const extra = { code: 'ZZZZ999' };
      const at = seed % (sound.length + 1);
      const added = [...sound.slice(0, at), extra, ...sound.slice(at)];
      expect(compareRegistration(added, curriculum).differences, `seed ${seed}`).toEqual([
        { kind: 'not-in-curriculum', registered: extra },
      ]);
    }
  });

  it('moving a module to a term it isn’t offered in yields exactly wrong-semester', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      const random = mulberry32(seed * 7919);
      const i = Math.floor(random() * sound.length);
      const target = sound[i] as RegisteredModule;
      const module = curriculum.modules.find(
        (m) => m.code === target.code.replace(/\s/g, '').toUpperCase(),
      ) as CurriculumModule;
      const offered = module.semester;
      if (offered === undefined) continue; // generated modules always have a term
      const wrong = MODULE_TERMS.filter((t) => !offeredIn(offered, t));
      const semester = wrong[Math.floor(random() * wrong.length)] as ModuleTerm;
      const moved = sound.map((r, j) => (j === i ? { ...r, semester } : r));
      expect(compareRegistration(moved, curriculum).differences, `seed ${seed}`).toEqual([
        { kind: 'wrong-semester', module, registered: { ...target, semester } },
      ]);
    }
  });

  it('giving a module twice yields exactly registered-twice, and the same credits', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      const first = sound[seed % sound.length] as RegisteredModule;
      const again = { ...first, code: first.code.toLowerCase() };
      const before = compareRegistration(sound, curriculum);
      const after = compareRegistration([...sound, again], curriculum);
      expect(kinds(after.differences), `seed ${seed}`).toEqual(['registered-twice']);
      expect(after.credits, `seed ${seed}`).toEqual(before.credits);
    }
  });

  it('dropping an elective a group needed leaves exactly that group short (and maybe credits)', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      curriculum.electiveGroups.forEach((group, groupIndex) => {
        const codes = new Set(group.from);
        const dropped = sound.find((r) => codes.has(r.code.replace(/\s/g, '').toUpperCase()));
        if (!dropped) return;
        const module = curriculum.modules.find(
          (m) => m.code === dropped.code.replace(/\s/g, '').toUpperCase(),
        ) as CurriculumModule;
        const result = compareRegistration(
          sound.filter((r) => r !== dropped),
          curriculum,
        );
        const groups = result.differences.filter((d) => d.kind === 'elective-group-unsatisfied');
        expect(groups, `seed ${seed}`).toHaveLength(1);
        expect(groups[0], `seed ${seed}`).toMatchObject({
          groupIndex,
          short: 'credits' in group.choose ? { credits: module.credits } : { count: 1 },
        });
        expect(
          result.differences.every(
            (d) => d.kind === 'elective-group-unsatisfied' || d.kind === 'credits-short',
          ),
          `seed ${seed}`,
        ).toBe(true);
      });
    }
  });

  it('the credits counted are the curriculum’s for every matched module', () => {
    for (const seed of SEEDS) {
      const { curriculum, sound } = generate(seed);
      const result = compareRegistration(sound, curriculum);
      const expected = result.matched.reduce((s, m) => s + m.module.credits, 0);
      expect(result.credits.registered, `seed ${seed}`).toBe(expected);
      expect(result.credits.registered).toBeGreaterThanOrEqual(curriculum.totalCredits.min);
      expect(result.credits.registered).toBeLessThanOrEqual(curriculum.totalCredits.max);
    }
  });
});
