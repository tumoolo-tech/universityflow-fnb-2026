import { describe, expect, it } from 'vitest';
import { en } from './en';
import { safetyNotes } from './sections';

/**
 * The words around a university's safety notes (Phase 5e-3). The notes themselves are the
 * university's, quoted from the catalogue; these strings only frame them, say what to do and
 * who to call. They never call a place safe or unsafe (planning.md §11, Phase 5e).
 */
describe('safetyNotes', () => {
  it('is composed into en like every section', () => {
    expect(en.safetyNotes).toBe(safetyNotes);
  });

  it('says plainly that no warning is not a promise', () => {
    expect(safetyNotes.noWarning).toBe('No warning here doesn’t mean it’s safe.');
  });

  it('says what to do for every kind of note, in a sentence or two', () => {
    expect(Object.keys(safetyNotes.whatToDo).sort()).toEqual(
      [
        'avoid-after-dark',
        'walk-in-groups',
        'escort-available',
        'shuttle-stop',
        'safe-route',
        'emergency-point',
        'incident-advisory',
        'general-tip',
      ].sort(),
    );
    for (const text of Object.values(safetyNotes.whatToDo)) {
      expect(text.length).toBeGreaterThan(20);
      expect(text.length).toBeLessThan(200);
    }
  });

  it('never judges a place: no "safe", "unsafe" or "dangerous" outside the disclaimer', () => {
    const words = [
      safetyNotes.lead,
      safetyNotes.wholeUniversity,
      safetyNotes.whatToDoTitle,
      safetyNotes.whoToCallTitle,
      safetyNotes.notCheckedYet,
      ...Object.values(safetyNotes.whatToDo),
      safetyNotes.title('Test University'),
      safetyNotes.campusTitle('Test Campus'),
      safetyNotes.says('Test University'),
      safetyNotes.area('Test Park'),
    ];
    for (const text of words) expect(text).not.toMatch(/\b(?:safe|unsafe|dangerous|danger)\b/i);
  });

  it('frames the university’s words and dates without changing them', () => {
    expect(safetyNotes.says('UJ')).toBe('UJ says:');
    expect(safetyNotes.area('Test Park / Test Hill')).toBe(
      'Area, in the university’s words: Test Park / Test Hill',
    );
    expect(safetyNotes.lastChecked('1 Dec 2026')).toBe('Last checked 1 Dec 2026');
    expect(safetyNotes.publishedOn('1 Nov 2026')).toBe('The university’s date: 1 Nov 2026');
    expect(safetyNotes.when('Monday to Friday', '18:00 – 06:00')).toBe(
      'When: Monday to Friday, 18:00 – 06:00',
    );
    expect(safetyNotes.when(null, '18:00 – 06:00')).toBe('When: 18:00 – 06:00');
    expect(safetyNotes.call('011 000 0000')).toBe('Call 011 000 0000');
  });
});
