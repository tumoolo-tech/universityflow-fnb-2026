import { describe, expect, it } from 'vitest';
import * as app from './app';
import { en } from './en';
import { planMapsApp } from './sections';

/**
 * The phone app's own plan-map words (RT-06, 2026-10-25): a section of `en` the app bundles,
 * holding no admission fact (hard rule 2, as plan-maps.test.ts holds for `en.planMaps`) and no
 * shaming word (planning.md §4.1).
 */

function strings(value: unknown, path = 'planMapsApp'): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const out = (value as (...args: unknown[]) => unknown)('x', 'x', 'x');
    return strings(out, `${path}()`);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  }
  return [];
}

describe('the app’s plan-map words', () => {
  it('are a section of en, after the sections that were there before, and reach the app', () => {
    expect(en.planMapsApp).toBe(planMapsApp);
    const keys = Object.keys(en);
    expect(keys.indexOf('planMapsApp')).toBeGreaterThan(keys.indexOf('planMaps'));
    expect(app.en.planMapsApp).toBe(planMapsApp);
    expect(app.planMapsApp).toBe(planMapsApp);
  });

  it('name a map in the learner’s words, and say which template lays it out', () => {
    expect(planMapsApp.naming.needed.length).toBeGreaterThan(0);
    expect(planMapsApp.naming.layout('Staircase')).toBe('Layout: Staircase');
    expect(planMapsApp.naming.renameFor('My climb')).toMatch(/^Rename map/);
    expect(planMapsApp.hub.progress(4, 6)).toBe('4 of 6 achieved');
  });

  it('hold no admission fact and no shaming word', () => {
    for (const [path, text] of strings(planMapsApp)) {
      expect(text, path).not.toMatch(/\d|%|\bAPS\b/);
      expect(text, path).not.toMatch(/\bfail(ed|ure)?\b|should have|why did you/i);
    }
  });
});
