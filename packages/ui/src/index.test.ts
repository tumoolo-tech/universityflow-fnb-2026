import { type SubjectMark, whatINeedFor } from '@universityflow/admissions';
import { catalogueView, SAFETY_ADVICE_KINDS } from '@universityflow/catalogue';
import { safetyNotes } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import {
  type Artifact,
  type CampusPlaceView,
  type CampusSafetyLine,
  PLANNED_ARTIFACT_KINDS,
  type SafetyNoteView,
  type WhatINeedArtifact,
} from './index';

describe('PLANNED_ARTIFACT_KINDS', () => {
  it('has no duplicates, so a kind maps to exactly one component', () => {
    expect(new Set(PLANNED_ARTIFACT_KINDS).size).toBe(PLANNED_ARTIFACT_KINDS.length);
  });

  it('includes what-i-need (Phase 4c)', () => {
    expect(PLANNED_ARTIFACT_KINDS).toContain('what-i-need');
  });
});

describe('WhatINeedArtifact', () => {
  it('survives a round trip through JSON, as a saved chat message does', () => {
    const view = catalogueView(new Date('2026-10-13T08:00:00Z'), { includeDrafts: true });
    const marks: SubjectMark[] = [
      { subject: 'english-hl', percent: 58 },
      { subject: 'afrikaans-fal', percent: 62 },
      { subject: 'mathematics', percent: 55 },
      { subject: 'physical-sciences', percent: 48 },
      { subject: 'life-sciences', percent: 64 },
      { subject: 'geography', percent: 69 },
      { subject: 'life-orientation', percent: 85 },
    ];
    const result = whatINeedFor(view, 'uj-bcom-accounting', { kind: 'grade-12-june', marks });
    if (!result) throw new Error('fixture programme missing');
    const artifact: Artifact = {
      kind: 'what-i-need',
      result,
      reportKind: 'grade-12-june',
      confirmedAt: '2027-07-01T10:00:00.000Z',
    } satisfies WhatINeedArtifact;
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
    expect(result.draft).toBe(true);
  });
});

describe('a safety note on the campus tour (Phase 5e-3)', () => {
  it('survives a round trip through JSON, nulls included, as a saved chat message does', () => {
    // Synthetic (hard rule 4).
    const note = {
      id: 'wits-test-walk-in-groups',
      kind: 'walk-in-groups',
      quote: 'Test advice, quoted exactly.',
      area: null,
      days: null,
      hours: null,
      publishedOn: null,
      checkedOn: '2026-12-01',
      sourceUrl: 'https://www.wits.ac.za/test-safety/',
      draft: false,
      security: [
        {
          id: 'wits-test-security',
          name: 'Test Security',
          campusName: 'Test Campus',
          phone: '011 000 0000',
        },
      ],
      emergency: [{ id: 'saps-emergency', name: 'Test Police', campusName: null, phone: '10111' }],
    } satisfies SafetyNoteView;
    expect(JSON.parse(JSON.stringify(note))).toEqual(note);
  });

  it('has words for what to do for every kind of note the catalogue holds', () => {
    for (const kind of SAFETY_ADVICE_KINDS) {
      expect(safetyNotes.whatToDo[kind], kind).toMatch(/\w/);
    }
  });
});

describe('a campus place whose source prints no building or location (A13-11)', () => {
  it('says so with null, which a saved chat message keeps (undefined would vanish)', () => {
    // Synthetic (hard rule 4). Before A13-11 these types refused null: typecheck failed here.
    const place = {
      id: 'wits-test-clinic',
      kind: 'clinic',
      name: 'Test Clinic',
      where: null,
      hours: null,
      phone: '011 000 0000',
      mapsUrl: null,
      appleMapsUrl: null,
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      draft: true,
    } satisfies CampusPlaceView;
    const line = {
      id: place.id,
      kind: 'clinic',
      name: place.name,
      campusName: 'Test Campus',
      where: null,
      hours: null,
      phone: place.phone,
    } satisfies CampusSafetyLine;
    expect(JSON.parse(JSON.stringify(place))).toEqual(place);
    expect(JSON.parse(JSON.stringify(line))).toEqual(line);
  });
});
