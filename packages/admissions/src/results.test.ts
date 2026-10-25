import { catalogueView, type ReportKind } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import type { ScoredReport } from './basis';
import type { SubjectMark } from './marks';
import { assessAll, assessOne } from './results';

const TODAY = new Date('2026-10-13T08:00:00Z');
const DRAFTS = catalogueView(TODAY, { includeDrafts: true });
const VERIFIED_ONLY = catalogueView(TODAY, { includeDrafts: false });

/** A confirmed final Grade 11 report, unless another kind is given. */
const marks = (entries: Record<string, number>, kind: ReportKind = 'grade-11-final') => ({
  kind,
  marks: Object.entries(entries).map(([subject, percent]) => ({
    subject,
    percent,
  })) as SubjectMark[],
});
const asKind = (report: ScoredReport, kind: ReportKind): ScoredReport => ({ ...report, kind });

const STRONG = marks({
  'english-hl': 85,
  'afrikaans-fal': 80,
  mathematics: 88,
  'physical-sciences': 84,
  'life-sciences': 82,
  geography: 86,
  'life-orientation': 90,
});

const MATHS_LIT = marks({
  'isizulu-hl': 66,
  'english-fal': 58,
  'mathematical-literacy': 72,
  geography: 55,
  history: 60,
  'business-studies': 52,
  'life-orientation': 75,
});

describe('assessAll', () => {
  it('finds many degrees for a strong learner, every one with all minimums met', () => {
    const results = assessAll(DRAFTS, STRONG);
    expect(results.passProjected).toBe('bachelor');
    expect(results.qualifyNow.length).toBeGreaterThan(20);
    for (const r of results.qualifyNow) {
      expect(r.verdict).toBe('qualifies');
      expect(r.qualification).toBe('degree');
      expect(r.scoreGap).toBe(0);
      expect(r.shortfalls).toEqual([]);
    }
    expect(results.checked).toBe(DRAFTS.programmes.length);
  });

  it('never offers a Maths Literacy learner a programme that needs Mathematics', () => {
    const results = assessAll(DRAFTS, MATHS_LIT);
    const offered = [...results.qualifyNow, ...results.planB].map((r) => r.programmeId);
    for (const id of [
      'wits-bsceng-civil',
      'up-bsc-computer-science',
      'uct-mbchb',
      'uj-bcom-accounting-ca',
    ]) {
      expect(offered).not.toContain(id);
    }
    // But it does find programmes that accept Maths Literacy, so there's no dead end.
    expect(offered.length).toBeGreaterThan(0);
  });

  it('labels every result as a draft while nobody has verified it', () => {
    const results = assessAll(DRAFTS, STRONG);
    expect(results.includesDrafts).toBe(true);
    expect([...results.qualifyNow, ...results.close, ...results.planB].every((r) => r.draft)).toBe(
      true,
    );
  });

  it('shows nothing from unverified data when drafts are off', () => {
    const results = assessAll(VERIFIED_ONLY, STRONG);
    expect(results.checked).toBe(0);
    expect(results.qualifyNow).toEqual([]);
  });

  describe('a verified programme scored by a draft method', () => {
    // The owner verifies records and methods separately. Until both are verified, the score is
    // a draft: an unverified formula must never reach a learner as fact (hard rule 3).
    const signed = { verifiedOn: '2026-11-01', verifiedBy: 'Test Verifier' };
    const programme = DRAFTS.programmes.find((p) => p.id === 'uj-bcom-accounting');
    const university = DRAFTS.universities.find((u) => u.id === 'uj');
    if (!programme || !university) throw new Error('fixture programme missing');
    const view = (includeDrafts: boolean) => ({
      ...DRAFTS,
      universities: [{ ...university, ...signed }],
      programmes: [{ ...programme, ...signed }],
      includesDrafts: includeDrafts,
    });

    it('is left out when drafts are off', () => {
      expect(assessAll(view(false), STRONG).checked).toBe(0);
      expect(assessOne(view(false), 'uj-bcom-accounting', STRONG)).toBeNull();
    });

    it('is labelled a draft when drafts are shown', () => {
      const results = assessAll(view(true), STRONG);
      expect(results.checked).toBe(1);
      expect([...results.qualifyNow, ...results.close, ...results.planB][0]?.draft).toBe(true);
      expect(assessOne(view(true), 'uj-bcom-accounting', STRONG)?.result.draft).toBe(true);
    });
  });

  it('says exactly what a close learner must improve', () => {
    const almost = marks({
      'english-fal': 62,
      'isizulu-hl': 74,
      mathematics: 58,
      'physical-sciences': 55,
      'life-sciences': 66,
      geography: 61,
      'life-orientation': 80,
    });
    const results = assessAll(DRAFTS, almost);
    const withSubjectGaps = results.close.find((r) => r.shortfalls.length > 0);
    expect(withSubjectGaps).toBeDefined();
    for (const s of withSubjectGaps?.shortfalls ?? []) {
      expect(s.targetPercent).toBeGreaterThan(s.percent ?? -1);
    }
  });
});

describe('Grade 10 marks (planning.md §18.3, G10-3): never Qualify now', () => {
  const grade10 = asKind(STRONG, 'grade-10-final');

  it('puts every programme the marks meet under On track, and nothing under Qualify now or Plan B', () => {
    const results = assessAll(DRAFTS, grade10);
    const admission = assessAll(DRAFTS, STRONG);
    expect(results.basis).toBe('progress');
    expect(results.qualifyNow).toEqual([]);
    expect(results.planB).toEqual([]);
    // The same calculation: what would qualify on a Grade 11 report is on track on a Grade 10 one.
    expect(results.onTrack.map((r) => r.programmeId).sort()).toEqual(
      [...admission.qualifyNow, ...admission.planB].map((r) => r.programmeId).sort(),
    );
    expect(results.close.map((r) => r.programmeId)).toEqual(
      admission.close.map((r) => r.programmeId),
    );
  });

  it('never gives any programme the verdict "qualifies"', () => {
    const results = assessAll(DRAFTS, grade10);
    const all = [...results.onTrack, ...results.close];
    expect(all.length).toBeGreaterThan(20);
    expect(all.some((r) => r.verdict === 'qualifies')).toBe(false);
    expect(results.onTrack.every((r) => r.verdict === 'on-track')).toBe(true);
    expect(assessOne(DRAFTS, 'uj-bcom-accounting', grade10)?.result.verdict).toBe('on-track');
  });

  it('treats every interim report below Grade 12 the same: Grade 10 June, Grade 11 June and September (§18.7 C2)', () => {
    for (const kind of ['grade-10-june', 'grade-11-june', 'grade-11-september'] as const) {
      const results = assessAll(DRAFTS, asKind(STRONG, kind));
      expect(results.basis, kind).toBe('progress');
      expect(results.qualifyNow, kind).toEqual([]);
      expect(results.planB, kind).toEqual([]);
      expect(results.onTrack.length, kind).toBeGreaterThan(20);
      expect(assessOne(DRAFTS, 'uj-bcom-accounting', asKind(STRONG, kind))?.result.verdict).toBe(
        'on-track',
      );
    }
  });

  it('leaves Grade 11 and Grade 12 reports as they were', () => {
    for (const kind of [
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
      'grade-12-final',
    ] as const) {
      const results = assessAll(DRAFTS, asKind(STRONG, kind));
      expect(results.basis).toBe('admission');
      expect(results.onTrack).toEqual([]);
      expect(results.qualifyNow.length).toBeGreaterThan(20);
      expect(assessOne(DRAFTS, 'uj-bcom-accounting', asKind(STRONG, kind))?.result.verdict).toBe(
        'qualifies',
      );
    }
  });
});

describe('assessOne', () => {
  it('explains a score line by line, with the method’s source', () => {
    const detail = assessOne(DRAFTS, 'uj-bcom-accounting', STRONG);
    expect(detail?.breakdown.label).toBe('APS');
    expect(detail?.breakdown.lines.filter((l) => l.counted)).toHaveLength(6);
    expect(detail?.breakdown.methodSourceUrl).toMatch(/^https:\/\/www\.uj\.ac\.za\//);
    expect(detail?.result.universityName).toBe('UJ');
  });

  it('returns null for a programme the view does not show', () => {
    expect(assessOne(VERIFIED_ONLY, 'uj-bcom-accounting', STRONG)).toBeNull();
    expect(assessOne(DRAFTS, 'nope', STRONG)).toBeNull();
  });
});
