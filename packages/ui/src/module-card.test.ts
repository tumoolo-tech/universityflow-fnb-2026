import type { FieldSource, ResolvedScheme } from '@universityflow/admissions';
import { moduleCard, modules } from '@universityflow/content/app';
import { describe, expect, it } from 'vitest';
import {
  type CardBooks,
  calculatorWords,
  type ModuleCardData,
  moduleCardView,
} from './module-card';

/**
 * The module card's view model (Phase 6c): every section, what isn't published, drafts and
 * conflicts. Every record and value here is synthetic (hard rule 4).
 */

const t = moduleCard;
const how = t.how;
const formatDate = (iso: string) => `date(${iso})`;

/** The free books and library as the server words them (apps/web module-card-books.ts). */
const BOOKS: CardBooks = {
  free: {
    title: 'Free books (test)',
    lead: 'Lead (test)',
    books: [
      {
        label: 'Not your prescribed book (test)',
        title: 'Open Test Book',
        link: 'Open Open Test Book (test)',
        url: 'https://openstax.org/details/books/test',
        details: ['First-year level (test)'],
        draft: true,
      },
    ],
    none: null,
    onlyLegal: 'Only legal (test)',
  },
  library: {
    links: [{ label: 'Search the library (test)', url: 'https://library.example.ac.za/?q=1' }],
    note: 'Library note (test)',
    draft: false,
  },
  noLibrary: null,
};

const outlineSource: FieldSource = {
  level: 'outline',
  academicYear: 2027,
  confirmedOn: '2027-02-03',
  draft: false,
};
const moduleSource: FieldSource = {
  level: 'module',
  academicYear: 2027,
  recordId: 'TST1000F',
  sourceUrl: 'https://uct.ac.za/handbook.pdf',
  draft: true,
};
const rulesSource: FieldSource = {
  level: 'university',
  academicYear: 2027,
  recordId: 'uct-general-rules',
  sourceUrl: 'https://uct.ac.za/rules.pdf',
  draft: false,
};

function scheme(extra: Partial<ResolvedScheme> = {}): ResolvedScheme {
  return {
    universityId: 'uct',
    moduleCode: 'TST1000F',
    academicYear: 2027,
    weighting: {
      value: {
        components: [
          { name: 'Tests', kind: 'test', weight: 40, bestOf: { count: 2, of: 3 } },
          { name: 'Exam', kind: 'exam', weight: 60, subminimum: 40 },
        ],
      },
      source: outlineSource,
    },
    passMark: { value: 50, source: rulesSource },
    examAdmission: {
      value: { term: 'DP', minimumYearMark: 40, conditions: ['Attend the practicals'] },
      source: outlineSource,
    },
    otherRules: [{ quote: 'No supplementary on a supplementary.', source: rulesSource }],
    includesDrafts: false,
    ...extra,
  };
}

function data(extra: Partial<ModuleCardData> = {}): ModuleCardData {
  return {
    registrationId: '00000000-0000-4000-8000-000000000001',
    module: {
      code: 'TST1000F',
      name: 'Sample module',
      term: 'S1',
      academicYear: 2027,
      universityName: 'Test University',
    },
    sample: false,
    scheme: scheme(),
    records: {
      'uct-general-rules': { title: 'General Rules (test)', verifiedOn: '2026-11-02' },
    },
    outline: {
      confirmedOn: '2027-02-03',
      dates: {
        status: 'confirmed',
        items: [
          { label: 'Test 2', date: '2027-04-20' },
          { label: 'Test 1', date: '2027-03-01' },
        ],
      },
      books: {
        status: 'confirmed',
        items: [
          {
            role: 'prescribed',
            title: 'Sample Studies',
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
    },
    calendar: {
      academicYear: 2027,
      sourceUrl: 'https://uct.ac.za/calendar.pdf',
      draft: true,
      examPeriods: [{ label: 'June exams', from: '2027-05-28', to: '2027-06-20' }],
      supplementaryExams: [],
      supplementaryRegistration: [{ label: 'Apply', date: '2027-06-25' }],
      dpLists: [],
    },
    books: BOOKS,
    office: {
      faculty: 'Faculty of Testing',
      where: 'Building T, room 1',
      hours: null,
      email: 'office@example.ac.za',
      phone: null,
      contactUrl: 'https://uct.ac.za/office',
      draft: false,
    },
    marks: [],
    target: null,
    today: '2027-03-10',
    ...extra,
  };
}

const row = (view: ReturnType<typeof moduleCardView>, id: string) =>
  view.how.rows.find((r) => r.id === id);

describe('How marks work', () => {
  it('words every resolved rule, each with where it came from and its date', () => {
    const view = moduleCardView(data(), formatDate);
    expect(row(view, 'weighting')).toMatchObject({
      label: how.labels.weighting,
      lines: [
        `${how.component('Tests', 40)} (${how.bestOf(2, 3)})`,
        `${how.component('Exam', 60)} (${how.componentOwnSubminimum(40)})`,
      ],
      source: { text: t.sources.outline('date(2027-02-03)'), url: null, draft: false },
      conflict: null,
    });
    expect(row(view, 'passMark')).toMatchObject({
      lines: [how.percent(50)],
      source: {
        text: t.sources.rules('General Rules (test)', 2027),
        url: 'https://uct.ac.za/rules.pdf',
        checked: t.sources.checkedOn('date(2026-11-02)'),
        draft: false,
      },
    });
    expect(row(view, 'examAdmission')?.lines).toEqual([
      how.admissionNumber('DP', 40),
      `${how.conditionsTitle}: Attend the practicals`,
    ]);
    expect(view.how.otherRules).toEqual([
      {
        quote: 'No supplementary on a supplementary.',
        source: expect.objectContaining({ text: t.sources.rules('General Rules (test)', 2027) }),
      },
    ]);
  });

  it('says what isn’t published and who to ask, never a usual number (gotcha 40)', () => {
    const { passMark: _p, weighting: _w, ...rest } = scheme();
    const view = moduleCardView(data({ scheme: rest as ResolvedScheme }), formatDate);
    expect(row(view, 'passMark')).toEqual({
      id: 'passMark',
      label: how.labels.passMark,
      lines: [how.notPublishedOffice],
      source: null,
      conflict: null,
    });
    expect(row(view, 'weighting')?.lines).toEqual([how.notPublishedLecturer]);
    expect(row(view, 'examSubminimum')?.lines).toEqual([how.notPublishedLecturer]);
    expect(row(view, 'supplementary')?.lines).toEqual([how.notPublishedOffice]);
    // Rules many modules don't have are left off rather than "not published".
    expect(row(view, 'rounding')).toBeUndefined();
    const unpublished = view.how.rows.filter((r) => r.source === null);
    expect(unpublished.map((r) => r.id)).toEqual([
      'weighting',
      'passMark',
      'examSubminimum',
      'supplementary',
    ]);
    expect(JSON.stringify(unpublished)).not.toMatch(/\d/);
  });

  it('labels a draft as a preview', () => {
    const view = moduleCardView(
      data({
        scheme: scheme({
          examSubminimum: { value: 40, source: moduleSource },
          includesDrafts: true,
        }),
      }),
      formatDate,
    );
    expect(row(view, 'examSubminimum')?.source).toMatchObject({
      text: t.sources.module('TST1000F', 2027),
      draft: true,
      checked: null,
    });
    expect(view.previewNotice).toBe(t.previewNote);
  });

  it('shows a conflict with the published value beside the outline’s (D2)', () => {
    const view = moduleCardView(
      data({
        scheme: scheme({
          examSubminimum: {
            value: 40,
            source: outlineSource,
            conflict: { value: 35, source: moduleSource },
          },
        }),
      }),
      formatDate,
    );
    expect(row(view, 'examSubminimum')).toMatchObject({
      lines: [how.percent(40)],
      conflict: {
        text: how.conflict,
        other: how.conflictOther(t.sources.module('TST1000F', 2027), how.percent(35)),
        source: { draft: true },
      },
    });
  });

  it('words a supplementary rule, capped, and one that isn’t offered', () => {
    const capped = moduleCardView(
      data({
        scheme: scheme({
          supplementary: {
            value: {
              eligibleFinalMark: { from: 45, to: 49 },
              result: { kind: 'capped-at', cap: 50 },
              notWhen: ['continuously assessed modules'],
            },
            source: rulesSource,
          },
        }),
      }),
      formatDate,
    );
    expect(row(capped, 'supplementary')?.lines).toEqual([
      how.supplementaryRange(45, 49),
      how.supplementaryCapped(50),
      how.notWhen('continuously assessed modules'),
    ]);
    const none = moduleCardView(
      data({
        scheme: scheme({ supplementary: { value: { offered: false }, source: rulesSource } }),
      }),
      formatDate,
    );
    expect(row(none, 'supplementary')?.lines).toEqual([how.supplementaryNotOffered]);
  });

  it('names the judge demo’s SAMPLE outline as its source, and says the card is a sample', () => {
    const view = moduleCardView(data({ sample: true }), formatDate);
    expect(view.sampleNotice).toBe(t.demoSample);
    expect(row(view, 'weighting')?.source?.text).toBe(t.sources.sampleOutline('date(2027-02-03)'));
  });
});

describe('Dates', () => {
  it('lists the outline’s dates in order, marks the past ones, and adds the calendar’s', () => {
    const view = moduleCardView(data(), formatDate);
    expect(view.dates.outline?.items).toEqual([
      { label: 'Test 1', date: 'date(2027-03-01)', past: true },
      { label: 'Test 2', date: 'date(2027-04-20)', past: false },
    ]);
    expect(view.dates.calendar).toEqual({
      source: {
        text: t.dates.fromCalendar('Test University', 2027),
        url: 'https://uct.ac.za/calendar.pdf',
        checked: null,
        draft: true,
      },
      groups: [
        {
          label: t.dates.examPeriods,
          items: [`June exams: ${t.dates.range('date(2027-05-28)', 'date(2027-06-20)')}`],
        },
        { label: t.dates.supplementaryRegistration, items: ['Apply: date(2027-06-25)'] },
      ],
    });
    expect(view.dates.none).toBeNull();
  });

  it('says none are published when neither the outline nor the calendar has any', () => {
    const view = moduleCardView(data({ outline: null, calendar: null }), formatDate);
    expect(view.dates).toMatchObject({ outline: null, calendar: null, none: t.dates.none });
  });
});

describe('Books', () => {
  it('lists the outline’s books, and the free ones and the library as the server worded them', () => {
    const view = moduleCardView(data(), formatDate);
    expect(view.books.outline).toEqual([
      {
        role: t.books.prescribed,
        title: 'Sample Studies',
        details: [t.books.by('A. Author'), t.books.edition('2nd'), t.books.isbn('9780306406157')],
      },
    ]);
    expect(view.books.free).toEqual(BOOKS.free);
    expect(view.books.library).toEqual(BOOKS.library);
    // A draft free book makes the card a preview.
    expect(view.previewNotice).toBe(t.previewNote);
  });

  it('asks for the outline when there is none', () => {
    const view = moduleCardView(data({ outline: null }), formatDate);
    expect(view.books).toMatchObject({
      outline: [],
      outlineNote: t.books.noOutline,
      addOutline: t.books.addOutline,
    });
  });
});

describe('Who teaches it', () => {
  it('shows the outline’s lecturers, work details only, and the faculty office', () => {
    const view = moduleCardView(data(), formatDate);
    expect(view.people.people).toEqual([
      {
        name: 'Dr A. Sample',
        role: 'Lecturer',
        details: [
          {
            label: t.people.email,
            value: 'a.sample@example.org',
            href: 'mailto:a.sample@example.org',
          },
          { label: t.people.office, value: 'Room S-101', href: null },
          { label: t.people.consultation, value: 'Tuesdays 10:00 to 12:00', href: null },
        ],
      },
    ]);
    expect(view.people.source).toBe(t.people.fromOutline);
    expect(view.people.askOffice).toBe(t.people.askOffice('Faculty of Testing'));
  });

  it('says it isn’t published, and who to ask, without an outline', () => {
    const view = moduleCardView(data({ outline: null, office: null }), formatDate);
    expect(view.people).toMatchObject({
      people: [],
      notPublished: t.people.notPublished,
      askOffice: null,
      noOffice: modules.noOffice,
    });
  });
});

describe('the card as a whole', () => {
  it('has the module’s code, name, term and year, and the calculator’s words as templates', () => {
    const view = moduleCardView(data(), formatDate);
    expect(view).toMatchObject({
      code: 'TST1000F',
      name: 'Sample module',
      subtitle: t.termAndYear(modules.terms.S1, 2027),
      sampleNotice: null,
    });
    expect(calculatorWords().needed).toBe(t.calculator.needed('{0}' as unknown as number));
  });

  it('survives a round trip through JSON, as the app receives it', () => {
    const d = data();
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });
});
