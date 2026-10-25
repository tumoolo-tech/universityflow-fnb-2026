import { catalogueViewOf } from '@universityflow/catalogue';
import type { CampusTourArtifact, FirstWeekArtifact } from '@universityflow/ui';
import { describe, expect, it } from 'vitest';
import { campusTour, firstWeek } from './campus';
import { SAFETY_ADVICE_GUIDANCE } from './charter';
import { SAFETY_ADVICE_RULES } from './safety-notes';
import { systemPrompt } from './system-prompt';
import {
  acceptedOffer,
  CAMPUS_TEST_TODAY,
  fakeContext,
  SAFETY_TEST_NOTES,
  safetyTestRecords,
  safetyTestView,
} from './testing';
import { runTool } from './tools';

/**
 * Safety notes on the campus tour, the first-week checklist and the campus_tour tool (Phase 5e-3).
 * Synthetic records only (hard rule 4).
 */

const tourOf = (includeDrafts: boolean) =>
  campusTour(safetyTestView(includeDrafts), 'wits', 'chosen') as CampusTourArtifact;
const campusNotes = (tour: CampusTourArtifact) =>
  tour.campuses.flatMap((c) => c.safetyNotes ?? []).map((n) => n.id);
const universityNotes = (tour: CampusTourArtifact) =>
  (tour.universitySafetyNotes ?? []).map((n) => n.id);

describe('safety notes on the campus tour', () => {
  it('shows a learner verified, current notes: per campus, and the university-wide ones once', () => {
    const tour = tourOf(false);
    expect(campusNotes(tour)).toEqual([SAFETY_TEST_NOTES.campus]);
    expect(universityNotes(tour)).toEqual([SAFETY_TEST_NOTES.university]);
    const [note] = tour.campuses[0]?.safetyNotes ?? [];
    expect(note).toMatchObject({
      kind: 'walk-in-groups',
      quote: 'Test campus advice, quoted exactly.',
      area: null,
      days: 'Monday to Friday',
      hours: '18:00 – 06:00',
      publishedOn: '2027-11-01',
      checkedOn: '2027-11-30',
      sourceUrl: 'https://www.wits.ac.za/test-safety/',
      draft: false,
    });
  });

  it('carries the campus’s verified security line and the two emergency numbers with every note', () => {
    const tour = tourOf(false);
    const all = [...(tour.universitySafetyNotes ?? []), ...(tour.campuses[0]?.safetyNotes ?? [])];
    for (const note of all) {
      expect(note.security.map((l) => [l.id, l.phone])).toEqual([
        ['wits-test-security', '011 000 0000'],
      ]);
      expect(note.emergency.map((l) => l.phone)).toEqual(['10111', '112']);
    }
    // A draft security place never: the draft campus's security is a draft.
    expect(JSON.stringify(tour)).not.toContain('wits-test-draft-campus-security');
  });

  it('shows a draft note only in preview, labelled and never "checked", and an expired one never', () => {
    expect(campusNotes(tourOf(false))).not.toContain(SAFETY_TEST_NOTES.draft);
    const preview = tourOf(true);
    expect(campusNotes(preview)).toContain(SAFETY_TEST_NOTES.draft);
    const draft = preview.campuses.flatMap((c) => c.safetyNotes ?? []).find((n) => n.draft);
    expect(draft?.checkedOn).toBeNull();
    for (const tour of [tourOf(false), preview]) {
      expect([...campusNotes(tour), ...universityNotes(tour)]).not.toContain(
        SAFETY_TEST_NOTES.expired,
      );
    }
  });

  it('shows no note without campus security to call, or without the emergency numbers', () => {
    const records = safetyTestRecords();
    const noSecurity = catalogueViewOf(
      { ...records, places: records.places.filter((p) => p.kind !== 'security') },
      CAMPUS_TEST_TODAY,
      { includeDrafts: false },
    );
    const without = campusTour(noSecurity, 'wits', 'chosen') as CampusTourArtifact;
    expect(campusNotes(without)).toEqual([]);
    expect(universityNotes(without)).toEqual([]);
    const noEmergency = catalogueViewOf(
      { ...records, helplines: records.helplines.filter((h) => h.id !== 'mobile-emergency') },
      CAMPUS_TEST_TODAY,
      { includeDrafts: false },
    );
    const silent = campusTour(noEmergency, 'wits', 'chosen') as CampusTourArtifact;
    expect([...campusNotes(silent), ...universityNotes(silent)]).toEqual([]);
  });

  it('puts every note the tour shows in the first-week checklist too', () => {
    const list = firstWeek(
      safetyTestView(false),
      'wits',
      'chosen',
      [],
      null,
      2028,
    ) as FirstWeekArtifact;
    expect((list.safetyNotes ?? []).map((n) => n.id)).toEqual([
      SAFETY_TEST_NOTES.university,
      SAFETY_TEST_NOTES.campus,
    ]);
  });
});

describe('the campus_tour tool and safety', () => {
  it('gives the model the stored notes, quoted, and who to call, with the rule never to judge a place', async () => {
    const { context } = fakeContext({
      today: CAMPUS_TEST_TODAY,
      catalogue: safetyTestView(false),
      offers: [acceptedOffer('wits')],
    });
    const result = await runTool(context, 'campus_tour', {});
    const advice = (
      result.forModel as {
        safety_advice: { rules: unknown; notes: unknown; who_to_call: unknown };
      }
    ).safety_advice;
    expect(advice.rules).toBe(SAFETY_ADVICE_RULES);
    expect(advice.notes).toEqual([
      expect.objectContaining({
        quote: 'Test university-wide advice, quoted exactly.',
        area: 'Test Park / Test Hill',
        campus: 'every campus',
        last_checked: '2027-11-30',
        unverified_preview: false,
      }),
      expect.objectContaining({
        quote: 'Test campus advice, quoted exactly.',
        campus: 'Test Campus',
        when: 'Monday to Friday, 18:00 – 06:00',
        university_date: '2027-11-01',
      }),
    ]);
    expect(advice.who_to_call).toEqual([
      { name: 'Test security security', campus: 'Test Campus', number: '011 000 0000' },
      { name: 'South African Police Service', campus: null, number: '10111' },
      { name: 'Emergency from a cell phone', campus: null, number: '112' },
    ]);
    expect(result.forModel).toMatchObject({ unverified_preview_data: false });
    const text = JSON.stringify(result.forModel);
    expect(text).not.toContain(SAFETY_TEST_NOTES.expired);
    expect(text).not.toContain('Test draft advice');
    expect(text).not.toContain('Test expired advice');
  });

  it('says plainly when no advice is stored: that is not a promise of safety', async () => {
    const { context } = fakeContext({
      today: CAMPUS_TEST_TODAY,
      catalogue: catalogueViewOf({ ...safetyTestRecords(), safetyAdvice: [] }, CAMPUS_TEST_TODAY, {
        includeDrafts: false,
      }),
      offers: [acceptedOffer('wits')],
    });
    const result = await runTool(context, 'campus_tour', {});
    expect(result.forModel).toMatchObject({
      safety_advice: { notes: [], none_stored: expect.stringMatching(/does not mean/) },
    });
  });

  it('carries the preview flag when a draft note is shown (A10-13)', async () => {
    const { context } = fakeContext({ catalogue: safetyTestView(true) });
    const result = await runTool(context, 'campus_tour', { university_id: 'wits' });
    expect(result.forModel).toMatchObject({ unverified_preview_data: true });
    const notes = (result.forModel as { safety_advice: { notes: Array<{ quote: string }> } })
      .safety_advice.notes;
    expect(notes.find((n) => n.quote === 'Test draft advice, quoted exactly.')).toMatchObject({
      unverified_preview: true,
      last_checked: 'not checked yet',
    });
  });
});

describe('the charter on safety', () => {
  it('never lets the AI judge a place safe or unsafe: it relays the university’s words and who to call', () => {
    expect(SAFETY_ADVICE_GUIDANCE.guidance).toMatch(/never say or suggest that a place/i);
    expect(SAFETY_ADVICE_GUIDANCE.guidance).toMatch(/safe or unsafe/);
    expect(SAFETY_ADVICE_GUIDANCE.guidance).toMatch(/campus_tour/);
    expect(SAFETY_ADVICE_GUIDANCE.principles).toContain('knows-limits');
    expect(systemPrompt()).toContain(SAFETY_ADVICE_GUIDANCE.guidance);
    // No number in the prompt: numbers come only from tools.
    expect(SAFETY_ADVICE_GUIDANCE.guidance).not.toMatch(/\d{3}/);
    expect(SAFETY_ADVICE_RULES).toMatch(/never say or suggest that a place/i);
  });
});
