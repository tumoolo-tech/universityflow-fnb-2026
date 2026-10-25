import { describe, expect, it } from 'vitest';
import { en } from './en';
import { cvMmereko } from './en/cv-mmereko';
import { privacyPage } from './en/privacy-page';

/**
 * "Open Mmereko" on My CV (the owner's decision of 2026-10-24): the canvas's words, and the
 * privacy page's line about it. Mmereko is a separate service with its own account, and the words
 * say plainly that UniversityFlow sends it nothing.
 */

describe('cvMmereko', () => {
  it('is wired into en, after the sections that were there before it', () => {
    expect(en.cvMmereko).toBe(cvMmereko);
    const keys = Object.keys(en);
    // Appended: after every section before it. Later sections may follow it (gotcha 48).
    expect(keys.indexOf('cvMmereko')).toBeGreaterThan(keys.indexOf('moduleOutline'));
    expect(keys.indexOf('cvMmereko')).toBeGreaterThan(keys.indexOf('cv'));
  });

  it('has every word the canvas shows, each a plain string', () => {
    for (const key of [
      'open',
      'lead',
      'title',
      'separate',
      'siteLink',
      'newTab',
      'newTabHint',
      'close',
      'frameTitle',
    ] as const) {
      expect(typeof cvMmereko[key], key).toBe('string');
      expect(cvMmereko[key], key).toMatch(/\S/);
    }
  });

  it('says Mmereko is separate, with its own account, terms and privacy, and gets nothing from us', () => {
    expect(cvMmereko.separate).toMatch(/separate service by Tumoolo/);
    expect(cvMmereko.separate).toMatch(/own account, terms and privacy/);
    expect(cvMmereko.separate).toMatch(/sends it nothing about you/);
  });

  it('gives the privacy page a line naming Mmereko as a separate service we send nothing', () => {
    const { separateTitle, separate } = privacyPage.sections.operators;
    expect(separateTitle).toMatch(/\S/);
    expect(separate.join(' ')).toMatch(/Mmereko/);
    expect(separate.join(' ')).toMatch(/separate service run by Tumoolo/);
    expect(separate.join(' ')).toMatch(/UniversityFlow sends it nothing/);
    // Not an operator: Mmereko processes nothing for us.
    expect(privacyPage.sections.operators.items.map((o) => o.id)).not.toContain('mmereko');
  });
});
