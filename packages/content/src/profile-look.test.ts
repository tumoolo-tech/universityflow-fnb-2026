import { describe, expect, it } from 'vitest';
import { en } from './en';

/**
 * The About me card's words (docs/design/profile-look-proposal.md): fixed lists, never free text
 * (D3), one set for everyone (D2). `packages/ui` takes its ids from these keys.
 */
describe('the profile look’s words', () => {
  const look = en.profileLook;

  it('names seven themes, twelve icons and six patterns', () => {
    expect(Object.keys(look.themes)).toHaveLength(7);
    expect(Object.keys(look.icons)).toHaveLength(12);
    expect(Object.keys(look.patterns)).toHaveLength(6);
  });

  it('offers about a dozen taglines and about thirty words, none twice', () => {
    for (const list of [look.taglines, look.badges, look.themes, look.icons, look.patterns]) {
      const words = Object.values(list).map((w) => w.toLowerCase());
      expect(new Set(words).size).toBe(words.length);
    }
    expect(Object.keys(look.taglines).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(look.badges).length).toBeGreaterThanOrEqual(24);
  });

  it('keeps every id a short kebab-case word, safe to store', () => {
    for (const list of [look.taglines, look.badges, look.themes, look.icons, look.patterns]) {
      for (const id of Object.keys(list)) expect(id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
    }
  });

  it('is written for every learner: no gendered word (D2)', () => {
    const all = [look.taglines, look.badges, look.themes, look.icons, look.patterns].flatMap(
      Object.values,
    );
    for (const text of all) {
      expect(text).not.toMatch(
        /\b(he|she|him|his|her|hers|boys?|girls?|man|men|woman|women|king|queen|prince|princess|bro|sis)\b/i,
      );
    }
  });

  it('keeps a chip short enough for a phone', () => {
    for (const text of Object.values(look.badges)) expect(text.length).toBeLessThanOrEqual(26);
    for (const text of Object.values(look.taglines)) expect(text.length).toBeLessThanOrEqual(40);
  });

  it('says how many words are chosen, and why another can’t be', () => {
    expect(look.wordsChosen(2, 3)).toBe('2 of 3 chosen');
    expect(look.wordsFull(3)).toMatch(/\b3\b.*[Uu]ntick/);
  });

  it('says the app’s poster in one line after the name: the grade, then the words (A2-35)', () => {
    expect(look.posterSummary('Grade 10', ['Future engineer', 'Loves maths'])).toBe(
      'Grade 10. My words: Future engineer, Loves maths.',
    );
    expect(look.posterSummary(null, ['Curious'])).toBe('My words: Curious.');
    expect(look.posterSummary('Grade 11', [])).toBe('Grade 11.');
    expect(look.posterSummary(null, [])).toBe('');
  });

  it('says the photo’s zoom as a percentage (A2-42)', () => {
    expect(en.profilePhoto.zoomValue(125)).toBe('125%');
  });
});
