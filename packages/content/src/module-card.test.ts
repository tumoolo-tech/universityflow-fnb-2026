import { describe, expect, it } from 'vitest';
import * as app from './app';
import { en } from './en';
import { moduleCard } from './sections';

/**
 * The module card's words (Phase 6c). The section sits after the sections that were there before
 * it (gotcha 48: other agents append after it), the app carries it (its module screen), and it
 * never states a pass mark, DP, subminimum or cap of its own (hard rule 2, gotcha 40).
 */

describe('en.moduleCard', () => {
  it('is appended after the sections that were there before it', () => {
    const keys = Object.keys(en);
    expect(keys.indexOf('moduleCard')).toBeGreaterThan(keys.indexOf('moduleOutline'));
    expect(en.moduleCard).toBe(moduleCard);
  });

  it('is in the app’s entry, and the free-book words are not (the server words them, A4-13)', () => {
    expect(app.en.moduleCard).toBe(en.moduleCard);
    expect(app.moduleCard).toBe(en.moduleCard);
    // The providers ("Siyavula") would land in both app bundles and in every web page that
    // reaches the app's `en` (ui's speech): the native-bundle and client-chunk budgets refuse them.
    expect(app.en).not.toHaveProperty('freeBooks');
    expect(app).not.toHaveProperty('freeBooks');
  });

  it('never states a mark of its own: every percentage is a value it is given', () => {
    const words = JSON.stringify(moduleCard);
    expect(words).not.toMatch(/\b(?:35|40|45|50|60)\s?%/);
  });

  it('labels a rounded needed mark and says when a target can’t be reached', () => {
    const c = moduleCard.calculator;
    expect(c.needed(44)).toBe('You need 44% in the exam.');
    expect(c.roundedUp('43.3')).toBe('Rounded up from 43.3%.');
    expect(c.impossible).toMatch(/can’t be reached any more/);
    expect(c.impossibleNext).toMatch(/^What happens next/);
  });

  it('says a missing rule is not published and who to ask', () => {
    expect(moduleCard.calculator.passNotPublished).toMatch(/isn’t published/);
    expect(moduleCard.calculator.passNotPublished).toMatch(/lecturer or the faculty office/);
    expect(moduleCard.how.notPublishedOffice).toBe('Not published. Ask the faculty office.');
  });

  it('turns into `{0}`-templates for the browser: no calculator function branches on its values', () => {
    const fns: Array<(...a: string[]) => string> = [];
    const walk = (v: unknown) => {
      if (typeof v === 'function') fns.push(v as (...a: string[]) => string);
      else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
    };
    walk(moduleCard.calculator);
    expect(fns.length).toBeGreaterThan(10);
    for (const fn of fns) {
      const template = fn('{0}', '{1}');
      for (let i = 0; i < fn.length; i++) expect(template).toContain(`{${i}}`);
    }
  });

  it('names the Stage 6 step as an action', () => {
    expect(moduleCard.journeyStep).toBe('Set up your semester');
  });
});
