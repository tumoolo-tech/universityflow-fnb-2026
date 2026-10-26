import { describe, expect, it } from 'vitest';
import {
  type ConfirmedModuleOutline,
  confirmedModuleOutlineSchema,
  dateFromPrinted,
  draftFromModuleOutline,
  type ExtractedModuleOutline,
  extractedModuleOutlineSchema,
  holdsMobileNumber,
  isbnFromPrinted,
  isMobileNumber,
  isPersonalEmail,
  looksLikePersonalNumber,
  percentFromPrinted,
  weightsTotal,
} from './module-outline';
import { SAMPLE_MODULE_OUTLINE } from './module-outline-reader';

/**
 * Reading a module outline (Phase 6b, docs/plans/phase-6-proposal.md): extract → draft with
 * warnings → the learner confirms section by section (components, dates, books, people; "not in my
 * outline" is a valid answer) → a strict confirmed schema (hard rule 6). Percentages, terms and
 * dates are converted here, in tested code, never by the AI. Every outline here is synthetic.
 */

/** A synthetic mobile number, built at runtime (hard rule 4: the guard rejects a literal). */
const mobile = (spaced = false) => {
  const digits = ['0', '8', '2', '5', '5', '5', '0', '1', '2', '3'];
  return spaced
    ? `${digits.slice(0, 3).join('')} ${digits.slice(3, 6).join('')} ${digits.slice(6).join('')}`
    : digits.join('');
};
/** A synthetic 13-digit number with an ID number's shape, built at runtime. */
const idShaped = () => ['9001', '0150', '0908', '7'].join('');

const EXTRACTED: ExtractedModuleOutline = structuredClone(SAMPLE_MODULE_OUTLINE);

const CONFIRMED: ConfirmedModuleOutline = {
  moduleCode: 'DEMO1001',
  moduleName: 'Sample module 1 (demo)',
  academicYear: 2027,
  term: 'S1',
  components: {
    status: 'confirmed',
    items: [
      { name: 'Test 1', kind: 'test', weight: 20, subminimum: null },
      { name: 'Assignment', kind: 'assignment', weight: 20, subminimum: null },
      { name: 'Final exam', kind: 'exam', weight: 60, subminimum: 40 },
    ],
    dpRequirement: {
      percent: 40,
      quote: 'A year mark of at least 40% and every assignment submitted.',
    },
    examSubminimum: 40,
    supplementaryQuote: null,
  },
  dates: {
    status: 'confirmed',
    items: [{ label: 'Test 1', date: '2027-03-15' }],
  },
  books: {
    status: 'confirmed',
    items: [
      {
        role: 'prescribed',
        title: 'Sample Studies: A Made-up Textbook',
        authors: 'A. Author',
        edition: '2nd',
        isbn: '9780306406157',
      },
    ],
  },
  people: {
    status: 'confirmed',
    items: [
      {
        name: 'Dr A. Sample',
        role: 'Lecturer',
        email: 'a.sample@example.org',
        phone: null,
        office: 'Room S-101',
        consultationTimes: 'Tuesdays 10:00 to 12:00',
      },
    ],
  },
};

describe('conversions in code, never by the AI', () => {
  it.each([
    ['40%', 40],
    ['40 %', 40],
    ['40', 40],
    ['  12.5%', 12.5],
    ['12,5%', 12.5],
    ['100%', 100],
    ['0%', 0],
    ['40 percent', 40],
  ])('reads %s as %s', (printed, percent) => {
    expect(percentFromPrinted(printed)).toBe(percent);
  });

  it.each([['101%'], ['-5%'], ['forty'], ['2/5'], ['40-50%'], [''], ['%']])(
    'reads %s as nothing, never a guess',
    (printed) => {
      expect(percentFromPrinted(printed)).toBeNull();
    },
  );

  it.each([
    ['2027-03-15', '2027-03-15'],
    ['15 March 2027', '2027-03-15'],
    ['15 Mar 2027', '2027-03-15'],
    ['Monday, 15 March 2027', '2027-03-15'],
    ['15/03/2027', '2027-03-15'],
    ['2027/03/15', '2027-03-15'],
    ['1 Sept 2027', '2027-09-01'],
  ])('reads the date %s as %s', (printed, iso) => {
    expect(dateFromPrinted(printed)).toBe(iso);
  });

  it.each([['15 March'], ['Week 7'], ['31 February 2027'], ['03/15/2027'], ['TBC'], ['']])(
    'leaves the date %s for the learner to set',
    (printed) => {
      expect(dateFromPrinted(printed)).toBeNull();
    },
  );

  it('keeps an ISBN only when its check digit is right, without hyphens', () => {
    expect(isbnFromPrinted('978-0-306-40615-7')).toBe('9780306406157');
    expect(isbnFromPrinted('0-306-40615-2')).toBe('0306406152');
    expect(isbnFromPrinted('978-0-306-40615-8')).toBeNull();
    expect(isbnFromPrinted('not an isbn')).toBeNull();
  });

  it('knows a mobile number from an office line (D3)', () => {
    expect(isMobileNumber(mobile())).toBe(true);
    expect(isMobileNumber(mobile(true))).toBe(true);
    expect(isMobileNumber(`+27${mobile().slice(1)}`)).toBe(true);
    expect(isMobileNumber('011 000 0000')).toBe(false);
    expect(isMobileNumber('0800 000 000')).toBe(false);
  });

  it('finds a mobile number anywhere in a line of text, not in a date or a time (D3)', () => {
    expect(holdsMobileNumber(`Call me on ${mobile(true)} after hours`)).toBe(true);
    expect(holdsMobileNumber(`WhatsApp ${mobile()}`)).toBe(true);
    expect(holdsMobileNumber('Tuesdays 10:00 to 12:00, 2027-03-15')).toBe(false);
    expect(holdsMobileNumber('Office 010 000 0000')).toBe(false);
  });

  it('knows a personal email address from a work one (D3)', () => {
    expect(isPersonalEmail('someone@gmail.com')).toBe(true);
    expect(isPersonalEmail('Someone@Yahoo.co.za')).toBe(true);
    expect(isPersonalEmail('a.sample@example.org')).toBe(false);
  });

  it('spots an ID or student number, as packages/db does', () => {
    expect(looksLikePersonalNumber(`ID ${idShaped()}`)).toBe(true);
    expect(looksLikePersonalNumber('Student no: 2027123')).toBe(true);
    expect(looksLikePersonalNumber('Test 1 on 15 March, 20%')).toBe(false);
  });

  it('adds the weights, or says it can’t when one is missing', () => {
    expect(weightsTotal([20, 20, 60])).toBe(100);
    expect(weightsTotal([10.1, 20.2, 69.7])).toBe(100);
    expect(weightsTotal([20, null])).toBeNull();
  });
});

describe('the extraction schema', () => {
  it('has no place for a class list, a student number or a personal detail', () => {
    const parsed = extractedModuleOutlineSchema.parse({
      ...EXTRACTED,
      classList: ['Sample Student A', 'Sample Student B'],
      studentNumber: '2027123',
    });
    expect(parsed).not.toHaveProperty('classList');
    expect(parsed).not.toHaveProperty('studentNumber');
    expect(JSON.stringify(Object.keys(extractedModuleOutlineSchema.shape))).not.toMatch(
      /student|class|idNumber|address|surname/i,
    );
  });
});

describe('draftFromModuleOutline', () => {
  it('turns the sample into a draft with percentages, a term and dates converted', () => {
    const draft = draftFromModuleOutline(EXTRACTED);
    expect(draft.moduleCode).toBe('DEMO1001');
    expect(draft.term).toBe('S1');
    expect(draft.components.map((c) => c.weight)).toEqual([15, 15, 10, 60]);
    expect(draft.weightsTotal).toBe(100);
    expect(draft.dpPercent).toBe(40);
    expect(draft.examSubminimum).toBe(40);
    expect(draft.dates.every((d) => d.date !== null)).toBe(true);
    expect(draft.books[0]?.isbn).toBe('9780306406157');
    expect(draft.warnings).toEqual([]);
  });

  it('flags weights that don’t add up, and changes none of them', () => {
    const draft = draftFromModuleOutline({
      ...EXTRACTED,
      components: [
        { name: 'Test 1', kind: 'test', weightAsPrinted: '30%', subminimumAsPrinted: null },
        { name: 'Exam', kind: 'exam', weightAsPrinted: '60%', subminimumAsPrinted: null },
      ],
    });
    expect(draft.components.map((c) => c.weight)).toEqual([30, 60]);
    expect(draft.weightsTotal).toBe(90);
    expect(draft.warnings).toContain('weights-dont-add-up');
  });

  it('flags a weight it can’t read, and leaves it for the learner', () => {
    const draft = draftFromModuleOutline({
      ...EXTRACTED,
      components: [
        { name: 'Test 1', kind: 'test', weightAsPrinted: 'see below', subminimumAsPrinted: null },
      ],
    });
    expect(draft.components[0]?.weight).toBeNull();
    expect(draft.components[0]?.weightAsPrinted).toBe('see below');
    expect(draft.weightsTotal).toBeNull();
    expect(draft.warnings).toContain('weight-unclear');
  });

  it('drops a personal mobile number and a personal email, keeping the work contact (D3)', () => {
    const draft = draftFromModuleOutline({
      ...EXTRACTED,
      people: [
        {
          name: 'Dr A. Sample',
          roleAsPrinted: 'Lecturer',
          email: 'a.sample.home@gmail.com',
          phone: mobile(true),
          office: 'Room S-101',
          consultationTimes: 'Tuesdays 10:00 to 12:00',
        },
        {
          name: 'Mr B. Sample',
          roleAsPrinted: 'Tutor',
          email: 'b.sample@example.org',
          phone: '010 000 0000',
          office: null,
          consultationTimes: null,
        },
      ],
    });
    expect(draft.people[0]).toMatchObject({ email: null, phone: null, office: 'Room S-101' });
    expect(draft.people[1]).toMatchObject({ email: 'b.sample@example.org', phone: '010 000 0000' });
    expect(draft.warnings).toContain('personal-contact-dropped');
    expect(JSON.stringify(draft)).not.toContain(mobile());
    expect(JSON.stringify(draft)).not.toContain('gmail');
  });

  it('drops any text holding an ID or student number', () => {
    const draft = draftFromModuleOutline({
      ...EXTRACTED,
      people: [
        {
          name: `Student no 2027123`,
          roleAsPrinted: null,
          email: null,
          phone: null,
          office: null,
          consultationTimes: null,
        },
      ],
      supplementaryQuote: `Contact the office, ID ${idShaped()}`,
    });
    expect(draft.people).toEqual([]);
    expect(draft.supplementaryQuote).toBeNull();
    expect(draft.warnings).toContain('personal-number-dropped');
  });

  it('warns about a document that isn’t an outline, an unreadable part, an unclear date or ISBN', () => {
    const draft = draftFromModuleOutline({
      ...EXTRACTED,
      isModuleOutline: false,
      partlyUnreadable: true,
      dates: [{ whatAsPrinted: 'Test 2', dateAsPrinted: 'Week 9' }],
      books: [{ role: 'prescribed', title: 'A book', authors: null, edition: null, isbn: '123' }],
    });
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        'not-an-outline',
        'partly-unreadable',
        'date-unclear',
        'isbn-unclear',
      ]),
    );
    expect(draft.dates[0]).toEqual({ label: 'Test 2', date: null, dateAsPrinted: 'Week 9' });
    expect(draft.books[0]?.isbnAsPrinted).toBe('123');
  });
});

describe('confirmedModuleOutlineSchema (hard rule 6)', () => {
  it('accepts an outline confirmed section by section', () => {
    expect(confirmedModuleOutlineSchema.parse(CONFIRMED)).toEqual(CONFIRMED);
  });

  it('accepts "not in my outline" for every section', () => {
    const none = { status: 'not-in-outline' } as const;
    const outline = { ...CONFIRMED, components: none, dates: none, books: none, people: none };
    expect(confirmedModuleOutlineSchema.parse(outline)).toEqual(outline);
  });

  it('refuses weights that don’t add up to 100, and never rescales them', () => {
    const result = confirmedModuleOutlineSchema.safeParse({
      ...CONFIRMED,
      components: {
        ...CONFIRMED.components,
        items: [
          { name: 'Test 1', kind: 'test', weight: 30, subminimum: null },
          { name: 'Exam', kind: 'exam', weight: 60, subminimum: null },
        ],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('weights-dont-add-up');
  });

  // A1-81: the same rule as admissions' resolveScheme (catalogue weightingProblems), so an
  // outline confirmed here is never one the module card has to leave out.
  it('refuses weights that only round to 100 (33.333 × 3), as resolveScheme does', () => {
    const third = (name: string, kind: 'test' | 'exam') => ({
      name,
      kind,
      weight: 33.333,
      subminimum: null,
    });
    const result = confirmedModuleOutlineSchema.safeParse({
      ...CONFIRMED,
      components: {
        ...CONFIRMED.components,
        items: [third('Test 1', 'test'), third('Test 2', 'test'), third('Exam', 'exam')],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('weights-dont-add-up');
  });

  it('takes weights whose sum is 100 but for float noise (33.3 + 33.3 + 33.4)', () => {
    const result = confirmedModuleOutlineSchema.safeParse({
      ...CONFIRMED,
      components: {
        ...CONFIRMED.components,
        items: [
          { name: 'Test 1', kind: 'test', weight: 33.3, subminimum: null },
          { name: 'Test 2', kind: 'test', weight: 33.3, subminimum: null },
          { name: 'Exam', kind: 'exam', weight: 33.4, subminimum: null },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('refuses two components with one name (case and spacing aside), as resolveScheme does', () => {
    const result = confirmedModuleOutlineSchema.safeParse({
      ...CONFIRMED,
      components: {
        ...CONFIRMED.components,
        items: [
          { name: 'Test', kind: 'test', weight: 20, subminimum: null },
          { name: ' test ', kind: 'test', weight: 20, subminimum: null },
          { name: 'Exam', kind: 'exam', weight: 60, subminimum: null },
        ],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain('duplicate-component-names');
  });

  it('refuses a percentage outside 0–100 and a component with no weight', () => {
    const bad = (item: unknown) =>
      confirmedModuleOutlineSchema.safeParse({
        ...CONFIRMED,
        components: { ...CONFIRMED.components, items: [item] },
      }).success;
    expect(bad({ name: 'Exam', kind: 'exam', weight: 100, subminimum: 101 })).toBe(false);
    expect(bad({ name: 'Exam', kind: 'exam', weight: null, subminimum: null })).toBe(false);
    expect(bad({ name: 'Exam', kind: 'exam', weight: 100, subminimum: null })).toBe(true);
  });

  it('refuses a personal mobile number, a personal email and an ID or student number', () => {
    const person = CONFIRMED.people.status === 'confirmed' ? CONFIRMED.people.items[0] : null;
    const withPerson = (patch: object) =>
      confirmedModuleOutlineSchema.safeParse({
        ...CONFIRMED,
        people: { status: 'confirmed', items: [{ ...person, ...patch }] },
      }).success;
    expect(withPerson({ phone: mobile() })).toBe(false);
    expect(withPerson({ email: 'someone@gmail.com' })).toBe(false);
    expect(withPerson({ office: `ID ${idShaped()}` })).toBe(false);
    expect(withPerson({ consultationTimes: `Or call ${mobile(true)}` })).toBe(false);
    expect(withPerson({ phone: '010 000 0000' })).toBe(true);
  });

  it('refuses a date that isn’t real, an ISBN that doesn’t check, and unknown fields', () => {
    expect(
      confirmedModuleOutlineSchema.safeParse({
        ...CONFIRMED,
        dates: { status: 'confirmed', items: [{ label: 'Test', date: '2027-02-30' }] },
      }).success,
    ).toBe(false);
    const book = CONFIRMED.books.status === 'confirmed' ? CONFIRMED.books.items[0] : null;
    expect(
      confirmedModuleOutlineSchema.safeParse({
        ...CONFIRMED,
        books: { status: 'confirmed', items: [{ ...book, isbn: '9780306406158' }] },
      }).success,
    ).toBe(false);
    expect(
      confirmedModuleOutlineSchema.safeParse({ ...CONFIRMED, studentNumber: '2027123' }).success,
    ).toBe(false);
  });

  it('upper-cases the module code, so one module has one outline a year', () => {
    expect(
      confirmedModuleOutlineSchema.parse({ ...CONFIRMED, moduleCode: ' demo1001 ' }).moduleCode,
    ).toBe('DEMO1001');
  });
});
