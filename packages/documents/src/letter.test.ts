import { describe, expect, it } from 'vitest';
import { documentType } from './document-types';
import {
  confirmedOfferSchema,
  draftFromLetter,
  type ExtractedLetter,
  isIsoDate,
  LETTER_OFFER_KINDS,
  MAX_CONDITION_LENGTH,
  MAX_CONDITIONS,
} from './letter';
import { SAMPLE_LETTER, SampleLetterReader } from './letter-reader';

/** Synthetic letters only (hard rule 4): no real learner, no real offer's terms. */
const letter = (overrides: Partial<ExtractedLetter> = {}): ExtractedLetter => ({
  isAcceptanceLetter: true,
  universityAsPrinted: 'University of Johannesburg',
  programmeAsPrinted: 'BEng Civil Engineering',
  offerKind: 'provisional',
  conditions: ['Synthetic condition one.', 'Synthetic condition two.'],
  replyBy: '2027-12-15',
  partlyUnreadable: false,
  ...overrides,
});

describe('acceptance-letter extraction', () => {
  it('is the acceptance-letter document type', () => {
    expect(documentType.options).toContain('acceptance-letter');
  });

  it.each(LETTER_OFFER_KINDS)('drafts a synthetic %s letter as printed', (kind) => {
    const draft = draftFromLetter(letter({ offerKind: kind }));
    expect(draft).toEqual({
      universityAsPrinted: 'University of Johannesburg',
      programmeAsPrinted: 'BEng Civil Engineering',
      kind,
      conditions: ['Synthetic condition one.', 'Synthetic condition two.'],
      replyBy: '2027-12-15',
      warnings: [],
    });
  });

  it('a letter that doesn’t say which kind leaves the choice to the learner', () => {
    const draft = draftFromLetter(letter({ offerKind: 'unclear' }));
    expect(draft.kind).toBeNull();
    expect(draft.warnings).toContain('kind-unclear');
  });

  it('keeps conditions word for word, only tidying whitespace onto one line', () => {
    const draft = draftFromLetter(
      letter({ conditions: ['  Obtain the\nrequired   pass.  ', '', '   ', 'Second\u0007 one'] }),
    );
    expect(draft.conditions).toEqual(['Obtain the required pass.', 'Second one']);
  });

  it('caps how many conditions are kept, and how long, and says so', () => {
    const many = draftFromLetter(
      letter({ conditions: Array.from({ length: MAX_CONDITIONS + 3 }, (_, i) => `c${i}`) }),
    );
    expect(many.conditions).toHaveLength(MAX_CONDITIONS);
    expect(many.warnings).toContain('conditions-cut');
    const long = draftFromLetter(letter({ conditions: ['x'.repeat(MAX_CONDITION_LENGTH + 10)] }));
    expect(long.conditions[0]).toHaveLength(MAX_CONDITION_LENGTH);
    expect(long.warnings).toContain('conditions-cut');
  });

  it('never invents a reply-by date: one that isn’t a real date is dropped, with a warning', () => {
    for (const bad of ['15 December', '2027-02-30', '2027-13-01', 'soon']) {
      const draft = draftFromLetter(letter({ replyBy: bad }));
      expect(draft.replyBy, bad).toBeNull();
      expect(draft.warnings, bad).toContain('reply-by-unreadable');
    }
    const none = draftFromLetter(letter({ replyBy: null }));
    expect(none.replyBy).toBeNull();
    expect(none.warnings).toEqual([]);
  });

  it('warns when it isn’t a letter, or parts couldn’t be read', () => {
    const draft = draftFromLetter(letter({ isAcceptanceLetter: false, partlyUnreadable: true }));
    expect(draft.warnings).toEqual(['not-a-letter', 'partly-unreadable']);
  });

  it('has no place for the learner’s name, ID, student number or address (minimisation)', () => {
    const fields = Object.keys(letter()).join(' ');
    expect(fields).not.toMatch(/name|idNumber|student|address|phone|email|reference/i);
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2028-01-31')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2028-1-31')).toBe(false);
  });
});

describe('confirmedOfferSchema (hard rule 6: only what the learner confirmed is saved)', () => {
  const ok = {
    programmeId: 'uj-beng-civil',
    kind: 'conditional',
    replyBy: '2027-12-15',
    conditions: ['Synthetic condition.'],
  };

  it('accepts a confirmed offer, from a letter or not', () => {
    expect(confirmedOfferSchema.safeParse(ok).success).toBe(true);
    expect(
      confirmedOfferSchema.safeParse({ ...ok, replyBy: null, conditions: [], documentId: null })
        .success,
    ).toBe(true);
  });

  it.each([
    [{ ...ok, programmeId: 'Civil Engineering at UJ' }],
    [{ ...ok, kind: 'accepted' }],
    [{ ...ok, replyBy: '15/12/2027' }],
    [{ ...ok, conditions: ['   '] }],
    [{ ...ok, conditions: ['x'.repeat(MAX_CONDITION_LENGTH + 1)] }],
    [{ ...ok, conditions: Array.from({ length: MAX_CONDITIONS + 1 }, () => 'c') }],
    [{ ...ok, studentNumber: '12345678' }],
    [{ ...ok, documentId: 'not-a-uuid' }],
  ])('refuses %j', (offer) => {
    expect(confirmedOfferSchema.safeParse(offer).success).toBe(false);
  });
});

describe('SampleLetterReader (the local stand-in)', () => {
  it('says it is a sample, returns a fresh copy, and holds no real offer’s terms', async () => {
    const reader = new SampleLetterReader();
    expect(reader.isSample).toBe(true);
    const first = await reader.read();
    first.conditions.pop();
    expect((await reader.read()).conditions).toHaveLength(SAMPLE_LETTER.conditions.length);
    // No mark, date or requirement a learner could mistake for a real offer's (hard rule 2).
    expect(JSON.stringify(SAMPLE_LETTER)).not.toMatch(/\d/);
    expect(SAMPLE_LETTER.conditions.every((c) => /sample/i.test(c))).toBe(true);
  });
});
