import { catalogueView, UNIVERSITY_IDS } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { SubjectMark } from './marks';
import {
  finalCheck,
  isFinalOffer,
  isOfferKind,
  normaliseTitle,
  OFFER_KINDS,
  programmeCandidates,
  replyByDaysLeft,
} from './offers';
import { assessAll } from './results';

const TODAY = new Date('2026-10-13T08:00:00Z');
const DRAFTS = catalogueView(TODAY, { includeDrafts: true });
const VERIFIED_ONLY = catalogueView(TODAY, { includeDrafts: false });

const all = (percent: number): SubjectMark[] =>
  (
    [
      'english-hl',
      'afrikaans-fal',
      'mathematics',
      'physical-sciences',
      'life-sciences',
      'accounting',
      'geography',
      'life-orientation',
    ] as const
  ).map((subject) => ({ subject, percent }));

describe('offer kinds', () => {
  it('are the four a letter can make, and only a final offer is final (§8.5)', () => {
    expect(OFFER_KINDS).toEqual(['provisional', 'conditional', 'final', 'waitlist']);
    expect(OFFER_KINDS.filter(isFinalOffer)).toEqual(['final']);
    expect(isOfferKind('final')).toBe(true);
    expect(isOfferKind('accepted')).toBe(false);
    expect(isOfferKind('toString')).toBe(false);
  });
});

describe('programmeCandidates: the letter’s words matched to catalogue programmes by code', () => {
  it('puts the programme named in the letter first, at the university named in the letter', () => {
    const found = programmeCandidates(DRAFTS, {
      university: 'University of Johannesburg',
      programme: 'BEng Civil Engineering',
    });
    expect(found[0]).toBe('uj-beng-civil');
    expect(found.length).toBeLessThanOrEqual(5);
    // Only that university's programmes.
    expect(found.every((id) => id.startsWith('uj-'))).toBe(true);
  });

  it('matches the exact name however it is printed (case, punctuation, "&")', () => {
    const found = programmeCandidates(DRAFTS, {
      university: 'UJ',
      programme: 'BACHELOR OF ENGINEERING IN CIVIL ENGINEERING.',
    });
    expect(found[0]).toBe('uj-beng-civil');
  });

  it('with no university it searches every university, best match first', () => {
    const found = programmeCandidates(DRAFTS, {
      university: null,
      programme: 'Bachelor of Engineering in Civil Engineering',
    });
    expect(found).toContain('uj-beng-civil');
  });

  it('returns nothing for words that match nothing, rather than a guess', () => {
    expect(programmeCandidates(DRAFTS, { university: null, programme: 'zzqx' })).toEqual([]);
    expect(programmeCandidates(DRAFTS, { university: null, programme: null })).toEqual([]);
    expect(programmeCandidates(DRAFTS, { university: 'UJ', programme: '   ' })).toEqual([]);
  });

  it('never offers a programme the learner may not see (hard rule 3)', () => {
    const shown = new Set(VERIFIED_ONLY.programmes.map((p) => p.id));
    const found = programmeCandidates(VERIFIED_ONLY, {
      university: 'University of Johannesburg',
      programme: 'Civil Engineering',
    });
    expect(found.every((id) => shown.has(id))).toBe(true);
  });

  it('normalises titles for comparison only', () => {
    expect(normaliseTitle(' B.Com (Accounting) & Finance ')).toBe('b com accounting and finance');
  });
});

describe('replyByDaysLeft', () => {
  it('counts South African calendar days, 0 on the day, negative once passed', () => {
    // 23:30 UTC on 13 October is already 14 October in South Africa.
    const late = new Date('2026-10-13T23:30:00Z');
    expect(replyByDaysLeft('2026-10-14', late)).toBe(0);
    expect(replyByDaysLeft('2026-10-20', TODAY)).toBe(7);
    expect(replyByDaysLeft('2026-10-12', TODAY)).toBe(-1);
  });
});

describe('finalCheck: the programme’s published requirements on the confirmed final results', () => {
  it('is met or not met on every university’s own method, with Plan B when not met', () => {
    for (const universityId of UNIVERSITY_IDS) {
      // A degree at this university that strong final results meet.
      const programme = DRAFTS.programmes.find(
        (p) =>
          p.universityId === universityId &&
          p.qualification === 'degree' &&
          finalCheck(DRAFTS, p.id, all(90)).status === 'met',
      );
      expect(programme, universityId).toBeDefined();
      const id = programme?.id ?? '';

      const met = finalCheck(DRAFTS, id, all(90));
      expect(met.status, universityId).toBe('met');
      expect(met.result?.verdict).toBe('qualifies');
      expect(met.planB).toEqual([]);

      const notMet = finalCheck(DRAFTS, id, all(35));
      expect(notMet.status, universityId).toBe('not-met');
      expect(notMet.result?.verdict).not.toBe('qualifies');
      // Plan B is Stage 1's own grouping on the same marks: nothing invented here.
      const planB = assessAll(DRAFTS, { kind: 'grade-12-final', marks: all(35) }).planB.map(
        (r) => r.programmeId,
      );
      expect(notMet.planB.map((r) => r.programmeId)).toEqual(planB.slice(0, notMet.planB.length));
    }
  });

  it('weak final results still leave Plan B options where the catalogue has them', () => {
    const notMet = finalCheck(DRAFTS, 'uj-beng-civil', all(52));
    expect(notMet.status).toBe('not-met');
    expect(notMet.planB.length).toBeGreaterThan(0);
    expect(notMet.planB.every((r) => r.verdict === 'qualifies')).toBe(true);
  });

  it('is unavailable, never a guess, when the programme or its score method can’t be shown', () => {
    expect(finalCheck(DRAFTS, 'no-such-programme', all(90))).toEqual({
      status: 'unavailable',
      result: null,
      planB: [],
    });
    // In production nothing unverified is scored (hard rule 3).
    const unverified = DRAFTS.programmes.find(
      (p) => !VERIFIED_ONLY.programmes.some((v) => v.id === p.id),
    );
    if (unverified) {
      expect(finalCheck(VERIFIED_ONLY, unverified.id, all(90)).status).toBe('unavailable');
    }
  });
});
