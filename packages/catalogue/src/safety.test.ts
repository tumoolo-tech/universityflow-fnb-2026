import { describe, expect, it } from 'vitest';
import type { Campus, Place } from './campus';
import { type CatalogueRecords, catalogueViewOf, RAW_CATALOGUE, safetyAdviceOn } from './catalogue';
import { SAFETY_ADVICE_KINDS as CLIENT_KINDS } from './client';
import { catalogueProblems } from './integrity';
import {
  adviceValidity,
  isAdviceCurrent,
  isAdviceExpired,
  SAFETY_ADVICE_HORIZON_DAYS,
  SAFETY_ADVICE_KINDS,
  type SafetyAdvice,
  safetyAdviceSchema,
} from './safety';

/**
 * Safety notes (planning.md §11, Phase 5e-3): a university's own safety advice, quoted, dated and
 * expiring. Synthetic records only (hard rule 4): made-up wording, test pages.
 */

const SOURCE = { sourceUrl: 'https://www.wits.ac.za/test-safety/', academicYear: 2027 } as const;
const VERIFIED = { verifiedOn: '2026-12-01', verifiedBy: 'Test Verifier' } as const;
const verified = <T>(r: T): T => ({ ...r, ...VERIFIED });

const NOTE: SafetyAdvice = {
  ...SOURCE,
  id: 'wits-test-walk-in-groups',
  universityId: 'wits',
  kind: 'walk-in-groups',
  quote: 'Test advice, quoted exactly as the page prints it.',
  ...adviceValidity('2026-11-20'),
};

const CAMPUS: Campus = {
  ...SOURCE,
  id: 'wits-test-campus',
  universityId: 'wits',
  name: 'Test Campus',
  city: 'Testville',
};
const SECURITY: Place = {
  ...SOURCE,
  id: 'wits-test-security',
  campusId: CAMPUS.id,
  kind: 'security',
  name: 'Test Security',
  phone: '011 000 0000',
};

describe('a safety note’s schema', () => {
  it('accepts a sourced, quoted note that expires', () => {
    expect(safetyAdviceSchema.safeParse(NOTE).success).toBe(true);
    const full = {
      ...NOTE,
      campusId: CAMPUS.id,
      placeId: SECURITY.id,
      area: 'Test Park / Test Hill',
      days: 'Monday to Friday',
      hours: '18:00 – 06:00',
      publishedOn: '2026-11-01',
      note: 'Research note for the verifier.',
    };
    expect(safetyAdviceSchema.safeParse(full).success).toBe(true);
  });

  it('requires the university’s own words', () => {
    const { quote: _, ...unquoted } = NOTE;
    expect(safetyAdviceSchema.safeParse(unquoted).success).toBe(false);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, quote: '  ' }).success).toBe(false);
  });

  it('requires an expiry date after it starts, never more than the horizon away', () => {
    const { validUntil: _, ...open } = NOTE;
    expect(safetyAdviceSchema.safeParse(open).success).toBe(false);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, validUntil: NOTE.validFrom }).success).toBe(
      false,
    );
    expect(safetyAdviceSchema.safeParse({ ...NOTE, validUntil: '2026-11-01' }).success).toBe(false);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, validUntil: '2099-01-01' }).success).toBe(false);
  });

  it('expires 90 days after the day it was read, by the helper the data files use', () => {
    expect(SAFETY_ADVICE_HORIZON_DAYS).toBe(90);
    expect(adviceValidity('2026-10-17')).toEqual({
      validFrom: '2026-10-17',
      validUntil: '2027-01-15',
    });
    // Across a leap day.
    expect(adviceValidity('2027-12-31').validUntil).toBe('2028-03-30');
    expect(() => adviceValidity('17 October 2026')).toThrow(RangeError);
  });

  it('cites the university’s own site, never another', () => {
    expect(
      safetyAdviceSchema.safeParse({ ...NOTE, sourceUrl: 'https://www.uj.ac.za/test/' }).success,
    ).toBe(false);
    expect(
      safetyAdviceSchema.safeParse({ ...NOTE, sourceUrl: 'https://news.example.com/robbery/' })
        .success,
    ).toBe(false);
  });

  it('has no severity, danger level or zone: an extra field is refused', () => {
    for (const extra of [{ severity: 'high' }, { dangerLevel: 3 }, { zone: [[0, 0]] }]) {
      expect(safetyAdviceSchema.safeParse({ ...NOTE, ...extra }).success).toBe(false);
    }
    expect(Object.keys(safetyAdviceSchema.shape)).not.toContain('severity');
  });

  it('names its own university in its id and campus, and a publication date before reading', () => {
    expect(safetyAdviceSchema.safeParse({ ...NOTE, id: 'uj-test' }).success).toBe(false);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, campusId: 'uj-apk' }).success).toBe(false);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, publishedOn: '2026-12-01' }).success).toBe(
      false,
    );
  });

  it('knows its kinds, from the client entry too', () => {
    expect(SAFETY_ADVICE_KINDS).toEqual([
      'avoid-after-dark',
      'walk-in-groups',
      'escort-available',
      'shuttle-stop',
      'safe-route',
      'emergency-point',
      'incident-advisory',
      'general-tip',
    ]);
    expect(CLIENT_KINDS).toBe(SAFETY_ADVICE_KINDS);
    expect(safetyAdviceSchema.safeParse({ ...NOTE, kind: 'red-zone' }).success).toBe(false);
  });
});

describe('when a note is current (South African days)', () => {
  it('is current from the day it was read to its last day, then expired', () => {
    const at = (iso: string) => new Date(iso);
    expect(isAdviceCurrent(NOTE, at('2026-11-19T21:59:00Z'))).toBe(false);
    expect(isAdviceCurrent(NOTE, at('2026-11-19T22:00:00Z'))).toBe(true); // 00:00 SAST on the 20th
    expect(isAdviceCurrent(NOTE, at('2027-02-18T21:59:00Z'))).toBe(true); // its last day
    expect(isAdviceExpired(NOTE, at('2027-02-18T21:59:00Z'))).toBe(false);
    expect(isAdviceCurrent(NOTE, at('2027-02-18T22:00:00Z'))).toBe(false);
    expect(isAdviceExpired(NOTE, at('2027-02-18T22:00:00Z'))).toBe(true);
  });
});

describe('the catalogue view of safety notes', () => {
  const wits = verified(RAW_CATALOGUE.universities.find((u) => u.id === 'wits'));
  if (!wits) throw new Error('fixture university missing');
  const TODAY = new Date('2026-12-10T08:00:00Z');
  const records = (safetyAdvice: SafetyAdvice[], over: Partial<CatalogueRecords> = {}) => ({
    ...RAW_CATALOGUE,
    universities: [wits],
    campuses: [verified(CAMPUS)],
    places: [verified(SECURITY)],
    safetyAdvice,
    ...over,
  });
  const ids = (view: ReturnType<typeof catalogueViewOf>) => view.safetyAdvice.map((n) => n.id);

  it('shows a learner a verified, current note', () => {
    const view = catalogueViewOf(records([verified(NOTE)]), TODAY, { includeDrafts: false });
    expect(ids(view)).toEqual([NOTE.id]);
  });

  it('hides a draft from learners, and shows it only in preview', () => {
    const all = records([NOTE]);
    expect(ids(catalogueViewOf(all, TODAY, { includeDrafts: false }))).toEqual([]);
    expect(ids(catalogueViewOf(all, TODAY, { includeDrafts: true }))).toEqual([NOTE.id]);
  });

  it('hides an expired note, even verified and even in preview, and one not yet current', () => {
    const expired = { ...verified(NOTE), id: 'wits-test-expired', ...adviceValidity('2026-08-01') };
    const later = { ...verified(NOTE), id: 'wits-test-later', ...adviceValidity('2027-01-01') };
    for (const includeDrafts of [false, true]) {
      const view = catalogueViewOf(records([expired, later, verified(NOTE)]), TODAY, {
        includeDrafts,
      });
      expect(ids(view)).toEqual([NOTE.id]);
    }
    // The clock moves on: the same note is gone the day after its last day.
    const after = new Date('2027-02-19T08:00:00Z');
    expect(ids(catalogueViewOf(records([verified(NOTE)]), after, { includeDrafts: true }))).toEqual(
      [],
    );
  });

  it('shows a note only with its university and its campus', () => {
    const onCampus = { ...verified(NOTE), id: 'wits-test-on-campus', campusId: CAMPUS.id };
    const elsewhere = { ...verified(NOTE), id: 'wits-test-elsewhere', campusId: 'wits-elsewhere' };
    const all = records([verified(NOTE), onCampus, elsewhere]);
    expect(ids(catalogueViewOf(all, TODAY, { includeDrafts: false }))).toEqual([
      NOTE.id,
      onCampus.id,
    ]);
    const closed = { ...all, universities: [] };
    expect(ids(catalogueViewOf(closed, TODAY, { includeDrafts: true }))).toEqual([]);
  });

  it('reads a campus’s notes, or the university-wide ones', () => {
    const onCampus = { ...verified(NOTE), id: 'wits-test-on-campus', campusId: CAMPUS.id };
    const view = catalogueViewOf(records([verified(NOTE), onCampus]), TODAY, {
      includeDrafts: false,
    });
    expect(safetyAdviceOn(view, 'wits', CAMPUS.id).map((n) => n.id)).toEqual([onCampus.id]);
    expect(safetyAdviceOn(view, 'wits', null).map((n) => n.id)).toEqual([NOTE.id]);
    expect(safetyAdviceOn(view, 'uj', null)).toEqual([]);
  });
});

describe('catalogueProblems over safety notes', () => {
  const plus = (safetyAdvice: SafetyAdvice[]): CatalogueRecords => ({
    ...RAW_CATALOGUE,
    campuses: [...RAW_CATALOGUE.campuses, CAMPUS],
    places: [...RAW_CATALOGUE.places, SECURITY],
    safetyAdvice,
  });

  it('finds every note in the data files sound, each living exactly the horizon', () => {
    expect(catalogueProblems(RAW_CATALOGUE)).toEqual([]);
    expect(catalogueProblems(plus([NOTE]))).toEqual([]);
    expect(RAW_CATALOGUE.safetyAdvice.length).toBeGreaterThan(0);
    for (const a of RAW_CATALOGUE.safetyAdvice) {
      expect(a.validUntil, a.id).toBe(adviceValidity(a.validFrom).validUntil);
    }
  });

  it('catches a note that doesn’t validate, or appears twice', () => {
    expect(catalogueProblems(plus([{ ...NOTE, quote: '' }])).join()).toMatch(
      /^safety advice wits-test-walk-in-groups doesn't validate/,
    );
    expect(catalogueProblems(plus([NOTE, NOTE]))).toEqual([
      'safety advice wits-test-walk-in-groups appears twice',
    ]);
  });

  it('catches a note for a university, campus or place that doesn’t exist', () => {
    expect(catalogueProblems({ ...plus([NOTE]), universities: [] })).toContain(
      'safety advice wits-test-walk-in-groups: no university wits',
    );
    expect(catalogueProblems(plus([{ ...NOTE, campusId: 'wits-nowhere' }]))).toEqual([
      'safety advice wits-test-walk-in-groups: no wits campus wits-nowhere',
    ]);
    expect(catalogueProblems(plus([{ ...NOTE, placeId: 'wits-nowhere' }]))).toEqual([
      'safety advice wits-test-walk-in-groups: no wits place wits-nowhere',
    ]);
    // A place on another campus than the note's.
    expect(
      catalogueProblems(
        plus([{ ...NOTE, campusId: 'wits-braamfontein-east', placeId: SECURITY.id }]),
      ).join(),
    ).toMatch(/place wits-test-security is not on wits-braamfontein-east/);
  });
});
