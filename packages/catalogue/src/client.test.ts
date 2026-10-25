import { describe, expect, it, vi } from 'vitest';

/**
 * Audit A4-02: `@universityflow/catalogue/client` is what browsers and the phone app load. It
 * must never bring zod (and its ~40 locales) or a catalogue record with it. Each module that
 * would is replaced by one that fails the moment it loads.
 */
const { loaded } = vi.hoisted(() => ({
  loaded: (name: string) => () => {
    throw new Error(`the client entry loaded ${name}`);
  },
}));
vi.mock('zod', loaded('zod'));
vi.mock('./catalogue', loaded('the catalogue records'));
vi.mock('./records', loaded('the record schemas'));
vi.mock('./provenance', loaded('the provenance schemas'));
vi.mock('./exams', loaded('the exam timetable'));
vi.mock('./practice', loaded('the practice resources'));
vi.mock('./subject-schema', loaded('the subject schema'));
vi.mock('./campus', loaded('the campus schemas'));
vi.mock('./curriculum', loaded('the curriculum schema'));
vi.mock('./integrity', loaded('the integrity checks'));
vi.mock('./safety', loaded('the safety note schema'));
vi.mock('./books', loaded('the free-book schemas'));
vi.mock('./book-links', loaded('the free-book hosts and rules'));
vi.mock('./data/open-books', loaded('the free-book records'));

describe('@universityflow/catalogue/client', () => {
  it('loads without zod or any catalogue record', async () => {
    const client = await import('./client');
    expect(client.subject('mathematics').name).toBe('Mathematics');
    expect(client.SUBJECTS.length).toBeGreaterThan(30);
    expect(client.PROVINCES).toContain('Gauteng');
    expect(client.dialable('0800 567 567')).toBe('0800567567');
  });

  it('carries the Phase 5 plain values: place kinds, the maps link, module codes and terms', async () => {
    const client = await import('./client');
    expect(client.PLACE_KINDS).toContain('clinic');
    expect(client.isSafetyPlaceKind('security')).toBe(true);
    expect(client.mapsLink({ query: 'Test Hall' })).toMatch(/^https:\/\/www\.google\.com\/maps\//);
    expect(client.appleMapsLink({ query: 'Test Hall' })).toMatch(/^https:\/\/maps\.apple\.com\//);
    // Walk there and See it (5e-1).
    expect(client.walkingLink({ query: 'Test Hall' })).toMatch(/travelmode=walking/);
    expect(client.appleWalkingLink({ query: 'Test Hall' })).toMatch(/mode=walking/);
    expect(client.streetViewLink({ coordinates: { lat: -26.19, lng: 28.03 } })).toMatch(/pano/);
    expect(client.normaliseModuleCode('test 101')).toBe('TEST101');
    expect(client.offeredIn('either', 'S2')).toBe(true);
    expect(client.MODULE_TERMS).toContain('Y');
    expect(client.OFFERED_TERMS).toContain('either');
    expect(client.SAFETY_ADVICE_KINDS).toContain('walk-in-groups');
  });

  it('carries the report kinds, so both apps pick from the one list (G10-2)', async () => {
    const client = await import('./client');
    expect(client.REPORT_KINDS[0]).toBe('grade-10-june');
    expect(client.isAdmissionReport('grade-11-june')).toBe(false);
    expect(client.reportGrade('grade-12-june')).toBe(12);
    // And the grade's own rule (G10-1), for the report picker's default.
    expect(client.currentGrade({ grade: 10, givenOn: '2026-02-01' }, new Date('2027-03-01'))).toBe(
      11,
    );
  });

  it('carries none of the free-book rules (6d): the server works a card’s books out (A4-13)', async () => {
    const client = (await import('./client')) as Record<string, unknown>;
    for (const name of [
      'OER_HOSTS',
      'OER_PROVIDERS',
      'DENIED_BOOK_HOSTS',
      'isAllowedBookUrl',
      'freeBooksFor',
      'matchPrescribedBook',
      'librarySearchLink',
      'SUBJECT_AREAS',
    ]) {
      expect(client[name], name).toBeUndefined();
    }
  });

  it('is exported as a subpath', async () => {
    const pkg = (await import('../package.json')).default as {
      exports: Record<string, string>;
      sideEffects: boolean;
    };
    expect(pkg.exports['./client']).toBe('./src/client.ts');
    expect(pkg.sideEffects).toBe(false);
  });
});
