import { MODULE_TERMS } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { documentType } from './document-types';
import {
  confirmedRegistrationSchema,
  draftFromRegistration,
  type ExtractedRegistration,
  extractedRegistrationSchema,
  MAX_MODULES,
  termFromPrinted,
} from './registration';
import { SAMPLE_REGISTRATION, SampleRegistrationReader } from './registration-reader';

/** Synthetic proofs only (hard rule 4): no real learner, no real programme's modules. */
const proof = (overrides: Partial<ExtractedRegistration> = {}): ExtractedRegistration => ({
  isProofOfRegistration: true,
  programmeCodeAsPrinted: 'TEST-PROG',
  yearOfStudy: 1,
  modules: [
    { code: 'TEST101', name: 'Synthetic module one', termAsPrinted: 'S1', credits: 16 },
    { code: 'test 102', name: 'Synthetic module two', termAsPrinted: 'Semester 2', credits: 12 },
  ],
  partlyUnreadable: false,
  ...overrides,
});

/** Every key in a JSON value, at any depth. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]);
  }
  return [];
}

describe('proof-of-registration extraction', () => {
  it('is the proof-of-registration document type', () => {
    expect(documentType.options).toContain('proof-of-registration');
  });

  it('drafts a synthetic proof as printed, each term placed by code', () => {
    expect(draftFromRegistration(proof())).toEqual({
      programmeCode: 'TEST-PROG',
      yearOfStudy: 1,
      modules: [
        {
          code: 'TEST101',
          name: 'Synthetic module one',
          term: 'S1',
          termAsPrinted: 'S1',
          credits: 16,
        },
        {
          code: 'test 102',
          name: 'Synthetic module two',
          term: 'S2',
          termAsPrinted: 'Semester 2',
          credits: 12,
        },
      ],
      warnings: [],
    });
  });

  it('places the ways a term is printed, and never guesses one it can’t place', () => {
    const placed: Array<[string, string]> = [
      ['S1', 'S1'],
      ['sem 1', 'S1'],
      ['First Semester', 'S1'],
      ['1st sem', 'S1'],
      ['SEMESTER 2', 'S2'],
      ['2nd semester', 'S2'],
      ['Year', 'Y'],
      ['Full year', 'Y'],
      ['year-long', 'Y'],
      ['Q3', 'Q3'],
      ['Quarter 4', 'Q4'],
    ];
    for (const [printed, term] of placed) expect(termFromPrinted(printed), printed).toBe(term);
    for (const printed of ['Term 1', 'Block 2', 'B', 'H1', '', '   ', 'semester']) {
      expect(termFromPrinted(printed), printed).toBeNull();
    }
    expect(termFromPrinted(null)).toBeNull();

    const draft = draftFromRegistration(
      proof({
        modules: [{ code: 'TEST101', name: null, termAsPrinted: 'Block 2', credits: null }],
      }),
    );
    expect(draft.modules[0]).toMatchObject({ term: null, termAsPrinted: 'Block 2' });
    expect(draft.warnings).toContain('term-unclear');
    // None printed is not unclear: the learner just leaves it, or chooses.
    const none = draftFromRegistration(
      proof({ modules: [{ code: 'TEST101', name: null, termAsPrinted: null, credits: null }] }),
    );
    expect(none.warnings).toEqual([]);
  });

  it('tidies each row onto one line, drops empty rows, and flags a code that can’t be compared', () => {
    const draft = draftFromRegistration(
      proof({
        modules: [
          {
            code: '  TEST\n101 ',
            name: ' Synthetic\u0007 one ',
            termAsPrinted: ' S1 ',
            credits: 16,
          },
          { code: '   ', name: 'Nothing', termAsPrinted: null, credits: 8 },
          { code: '*?', name: null, termAsPrinted: null, credits: 300 },
        ],
      }),
    );
    expect(draft.modules).toEqual([
      { code: 'TEST 101', name: 'Synthetic one', term: 'S1', termAsPrinted: 'S1', credits: 16 },
      { code: '*?', name: null, term: null, termAsPrinted: null, credits: null },
    ]);
    expect(draft.warnings).toEqual(['code-unclear']);
  });

  it('caps how many modules are kept, and says so', () => {
    const many = draftFromRegistration(
      proof({
        modules: Array.from({ length: MAX_MODULES + 2 }, (_, i) => ({
          code: `TEST${100 + i}`,
          name: null,
          termAsPrinted: null,
          credits: null,
        })),
      }),
    );
    expect(many.modules).toHaveLength(MAX_MODULES);
    expect(many.warnings).toContain('modules-cut');
  });

  it('warns when it isn’t a proof, parts couldn’t be read, or no module was found', () => {
    const draft = draftFromRegistration(
      proof({ isProofOfRegistration: false, partlyUnreadable: true, modules: [] }),
    );
    expect(draft.warnings).toEqual(['not-a-proof', 'partly-unreadable', 'no-modules']);
  });

  it('keeps a year of study only when it is a plausible whole number', () => {
    for (const bad of [0, 2.5, 11, -1, Number.NaN]) {
      expect(
        draftFromRegistration(proof({ yearOfStudy: bad })).yearOfStudy,
        String(bad),
      ).toBeNull();
    }
    expect(draftFromRegistration(proof({ yearOfStudy: 2 })).yearOfStudy).toBe(2);
  });

  it('has no place for the student number, ID number, name, address or fees (D4, minimisation)', () => {
    const top = Object.keys(extractedRegistrationSchema.shape);
    expect(top.sort()).toEqual(
      [
        'isProofOfRegistration',
        'modules',
        'partlyUnreadable',
        'programmeCodeAsPrinted',
        'yearOfStudy',
      ].sort(),
    );
    // `name` exists only on a module row: the module's name, never the learner's.
    const all = keysOf(extractedRegistrationSchema.toJSONSchema()).join(' ');
    expect(all).not.toMatch(/student|idNumber|identity|surname|address|fee|amount|balance|bank/i);
    expect(Object.keys(draftFromRegistration(proof()))).not.toContain('name');
  });
});

describe('confirmedRegistrationSchema (hard rule 6: only what the learner confirmed is saved)', () => {
  const ok = {
    programmeId: 'up-bsc-test',
    academicYear: 2027,
    yearOfStudy: 1,
    modules: [
      { code: 'TEST101', name: 'Synthetic one', term: 'S1', credits: 16 },
      { code: 'TEST102', name: null, term: null, credits: null },
    ],
  };

  it('accepts a confirmed registration, from a proof or typed in', () => {
    expect(confirmedRegistrationSchema.safeParse(ok).success).toBe(true);
    const parsed = confirmedRegistrationSchema.parse({
      ...ok,
      yearOfStudy: null,
      documentId: null,
      modules: [{ code: ' TEST101 ', name: '  ', term: 'Y', credits: 0 }],
    });
    expect(parsed.modules[0]).toEqual({ code: 'TEST101', name: null, term: 'Y', credits: 0 });
  });

  it('takes the catalogue’s terms, no more', () => {
    for (const term of MODULE_TERMS) {
      const modules = [{ code: 'TEST101', name: null, term, credits: null }];
      expect(confirmedRegistrationSchema.safeParse({ ...ok, modules }).success, term).toBe(true);
    }
  });

  it.each([
    [{ ...ok, programmeId: 'BSc at UP' }],
    [{ ...ok, academicYear: 27 }],
    [{ ...ok, yearOfStudy: 0 }],
    [{ ...ok, modules: [] }],
    [{ ...ok, modules: [{ code: '*?', name: null, term: null, credits: null }] }],
    [{ ...ok, modules: [{ code: 'TEST101', name: null, term: 'either', credits: null }] }],
    [{ ...ok, modules: [{ code: 'TEST101', name: null, term: null, credits: 300 }] }],
    [{ ...ok, modules: [{ code: 'TEST101', name: 'x'.repeat(161), term: null, credits: null }] }],
    [
      {
        ...ok,
        modules: Array.from({ length: MAX_MODULES + 1 }, (_, i) => ({
          code: `TEST${100 + i}`,
          name: null,
          term: null,
          credits: null,
        })),
      },
    ],
    [{ ...ok, studentNumber: '12345678' }],
    [{ ...ok, modules: [{ ...ok.modules[0], fees: 1000 }] }],
    [{ ...ok, documentId: 'not-a-uuid' }],
  ])('refuses %j', (registration) => {
    expect(confirmedRegistrationSchema.safeParse(registration).success).toBe(false);
  });
});

describe('SampleRegistrationReader (the local stand-in)', () => {
  it('says it is a sample, returns a fresh copy, and holds no real programme’s modules', async () => {
    const reader = new SampleRegistrationReader();
    expect(reader.isSample).toBe(true);
    const first = await reader.read();
    first.modules.pop();
    expect((await reader.read()).modules).toHaveLength(SAMPLE_REGISTRATION.modules.length);
    expect(SAMPLE_REGISTRATION.modules.every((m) => m.code.startsWith('TEST'))).toBe(true);
    expect(SAMPLE_REGISTRATION.modules.every((m) => /^Sample /.test(m.name ?? ''))).toBe(true);
    expect(draftFromRegistration(SAMPLE_REGISTRATION).warnings).toEqual([]);
  });
});
