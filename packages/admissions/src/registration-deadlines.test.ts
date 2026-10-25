import type {
  CurriculumModule,
  ElectiveGroup,
  RegistrationCalendar,
} from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { RegistrationDifference } from './registration';
import { changeDeadlinesFor, termsOfDifference } from './registration-deadlines';

/**
 * The change deadlines for a registration's differences (planning.md §11, Phase 5c). Synthetic
 * calendars and modules only (hard rule 4): TEST codes, made-up dates.
 */

const mod = (code: string, semester: CurriculumModule['semester']): CurriculumModule => ({
  code,
  name: `Test ${code}`,
  semester,
  credits: 16,
  compulsory: true,
});

const missing = (semester: CurriculumModule['semester']): RegistrationDifference => ({
  kind: 'missing-compulsory',
  module: mod('TEST101', semester),
});

const GROUP: ElectiveGroup = { label: 'Choose one', choose: { count: 1 }, from: ['TEST201'] };

const CALENDAR: RegistrationCalendar = {
  sourceUrl: 'https://www.up.ac.za/test-calendar.pdf',
  academicYear: 2027,
  universityId: 'up',
  firstYearRegistration: { to: '2027-01-30' },
  changeDeadlines: [
    { appliesTo: 'S1', lastDay: '2027-02-19' },
    { appliesTo: 'S2', lastDay: '2027-07-30' },
    { appliesTo: 'Q1', lastDay: '2027-02-19' },
  ],
};

const NOW = new Date('2027-02-01T08:00:00Z');

describe('termsOfDifference', () => {
  it('is every term for a module whose term the rule book does not print (#71)', () => {
    expect(termsOfDifference(missing(undefined))).toBe('all');
    expect(
      termsOfDifference({
        kind: 'wrong-semester',
        module: mod('TEST101', undefined),
        registered: { code: 'TEST101', semester: 'S2' },
      }),
    ).toEqual(['S2']);
  });

  it('is the module’s term, both semesters for "either", and every term for the whole registration', () => {
    expect(termsOfDifference(missing('S2'))).toEqual(['S2']);
    expect(termsOfDifference(missing('either'))).toEqual(['S1', 'S2']);
    expect(
      termsOfDifference({
        kind: 'wrong-semester',
        module: mod('TEST101', 'S1'),
        registered: { code: 'TEST101', semester: 'S2' },
      }),
    ).toEqual(['S2', 'S1']);
    expect(
      termsOfDifference({ kind: 'not-in-curriculum', registered: { code: 'X101', semester: 'Y' } }),
    ).toEqual(['Y']);
    expect(termsOfDifference({ kind: 'not-in-curriculum', registered: { code: 'X101' } })).toBe(
      'all',
    );
    expect(
      termsOfDifference({
        kind: 'registered-twice',
        code: 'TEST101',
        registered: [
          { code: 'TEST101', semester: 'S1' },
          { code: 'test101', semester: 'S1' },
        ],
      }),
    ).toEqual(['S1']);
    expect(
      termsOfDifference({
        kind: 'registered-twice',
        code: 'TEST101',
        registered: [{ code: 'TEST101', semester: 'S1' }, { code: 'TEST101' }],
      }),
    ).toBe('all');
    for (const d of [
      {
        kind: 'elective-group-unsatisfied',
        group: GROUP,
        groupIndex: 0,
        chosen: [],
        short: { count: 1 },
      },
      { kind: 'credits-short', registered: 100, min: 120, short: 20 },
      { kind: 'credits-over', registered: 160, max: 144, over: 16 },
    ] as RegistrationDifference[]) {
      expect(termsOfDifference(d), d.kind).toBe('all');
    }
  });
});

describe('changeDeadlinesFor', () => {
  it('gives the deadline for the term of each difference, with the days left', () => {
    const result = changeDeadlinesFor({ differences: [missing('S2')] }, CALENDAR, 2027, NOW);
    expect(result).toEqual({
      status: 'published',
      deadlines: [{ appliesTo: 'S2', lastDay: '2027-07-30', daysLeft: 179 }],
      unpublishedTerms: [],
      next: { appliesTo: 'S2', lastDay: '2027-07-30', daysLeft: 179 },
    });
  });

  it('lists every published deadline, earliest first, when the whole registration is at issue', () => {
    const result = changeDeadlinesFor(
      { differences: [{ kind: 'credits-short', registered: 100, min: 120, short: 20 }] },
      CALENDAR,
      2027,
      NOW,
    );
    expect(result.deadlines.map((d) => [d.appliesTo, d.lastDay])).toEqual([
      ['S1', '2027-02-19'],
      ['Q1', '2027-02-19'],
      ['S2', '2027-07-30'],
    ]);
    // A university without year-module dates isn't said to hide them when nobody asked.
    expect(result.unpublishedTerms).toEqual([]);
    expect(result.next?.lastDay).toBe('2027-02-19');
  });

  it('says honestly which terms have no published deadline, never a nearby date', () => {
    const result = changeDeadlinesFor(
      { differences: [missing('Y'), missing('S1')] },
      CALENDAR,
      2027,
      NOW,
    );
    expect(result.deadlines.map((d) => d.appliesTo)).toEqual(['S1']);
    expect(result.unpublishedTerms).toEqual(['Y']);

    const onlyYear = changeDeadlinesFor({ differences: [missing('Y')] }, CALENDAR, 2027, NOW);
    expect(onlyYear).toEqual({
      status: 'none',
      deadlines: [],
      unpublishedTerms: ['Y'],
      next: null,
    });
  });

  it('uses a deadline for every module when that is what the university publishes', () => {
    const one: RegistrationCalendar = {
      ...CALENDAR,
      changeDeadlines: [{ appliesTo: 'all', lastDay: '2027-02-26' }],
    };
    const result = changeDeadlinesFor({ differences: [missing('Y')] }, one, 2027, NOW);
    expect(result.deadlines).toEqual([{ appliesTo: 'all', lastDay: '2027-02-26', daysLeft: 25 }]);
    expect(result.unpublishedTerms).toEqual([]);
    const whole = changeDeadlinesFor({ differences: [] }, one, 2027, NOW);
    expect(whole.deadlines.map((d) => d.appliesTo)).toEqual(['all']);
  });

  it('gives no date at all without a calendar, or with one for another academic year', () => {
    const none = { status: 'none', deadlines: [], unpublishedTerms: [], next: null };
    expect(changeDeadlinesFor({ differences: [missing('S1')] }, undefined, 2027, NOW)).toEqual(
      none,
    );
    expect(changeDeadlinesFor({ differences: [missing('S1')] }, CALENDAR, 2028, NOW)).toEqual(none);
  });

  it('counts today as still to come, and a passed deadline as passed', () => {
    const today = changeDeadlinesFor(
      { differences: [missing('S1')] },
      CALENDAR,
      2027,
      new Date('2027-02-19T20:00:00Z'),
    );
    expect(today.next).toEqual({ appliesTo: 'S1', lastDay: '2027-02-19', daysLeft: 0 });
    const after = changeDeadlinesFor(
      { differences: [missing('S1')] },
      CALENDAR,
      2027,
      new Date('2027-02-20T08:00:00Z'),
    );
    expect(after.deadlines[0]?.daysLeft).toBe(-1);
    expect(after.next).toBeNull();
    expect(after.status).toBe('published');
  });
});
