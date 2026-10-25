import { describe, expect, it } from 'vitest';
import { en } from './en';
import { freeBooks } from './sections';

/**
 * The words around free books on a module card (Phase 6d; D5–D7). The books themselves are
 * catalogue records (titles, authors, links); these strings only label them. The label for a
 * book that isn't the prescribed one is the approved plan's own wording.
 */
describe('freeBooks', () => {
  it('is composed into en like every section, after the sections that were there before it', () => {
    expect(en.freeBooks).toBe(freeBooks);
    const keys = Object.keys(en);
    expect(keys.indexOf('freeBooks')).toBeGreaterThan(keys.indexOf('demoPhoneSignup'));
  });

  it('labels every book that isn’t the prescribed one exactly as the plan says', () => {
    expect(freeBooks.notPrescribed).toBe('Not your prescribed book: check with your lecturer');
  });

  it('names every open licence and every allow-listed provider the catalogue may hold', () => {
    expect(Object.keys(freeBooks.licences).sort()).toEqual(
      [
        'cc-by-4.0',
        'cc-by-3.0',
        'cc-by-sa-4.0',
        'cc-by-nc-4.0',
        'cc-by-nc-sa-4.0',
        'cc0-1.0',
      ].sort(),
    );
    expect(Object.keys(freeBooks.providers).sort()).toEqual(
      [
        'openstax',
        'siyavula',
        'open-uct',
        'wits-wiredspace',
        'up-upspace',
        'uj-ujcontent',
        'tut-tutdor',
        'ukzn-researchspace',
      ].sort(),
    );
  });

  it('never promises a library copy, and says where a link goes', () => {
    expect(freeBooks.searchLibrary('UCT Libraries')).toBe('Search UCT Libraries for it');
    expect(freeBooks.libraryNote).toContain('doesn’t tell us whether a copy is there');
    for (const text of [freeBooks.libraryNote, freeBooks.searchLibrary('X'), freeBooks.noLibrary]) {
      expect(text).not.toMatch(/\b(available|in stock|on the shelf now)\b/i);
    }
    expect(freeBooks.openOn('Chemistry 2e', 'OpenStax')).toBe('Open Chemistry 2e on OpenStax');
  });
});
