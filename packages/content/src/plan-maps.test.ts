import { describe, expect, it } from 'vitest';
import { en } from './en';
import { planMaps } from './sections';

/**
 * The plan maps' words (docs/design/plan-maps-proposal.md). Templates name stages only (§6): a
 * requirement, a score, a fee or a date is never in a template, a placeholder or a hint, so a fact
 * can't slip into a learner's map from here (hard rule 2). The links to the pages that compute
 * them are `packages/ui`'s.
 */

/** Every string in a section: plain strings, and each function's output for placeholder words. */
function strings(value: unknown, path = 'planMaps'): Array<[string, string]> {
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

const MONTHS =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;

/** Why a string reads like an admission fact, or null. */
function factIn(text: string): string | null {
  // Grades 10, 11 and 12 are stage names; any other number is a fact (a score, a fee, a date).
  const digits = text.replace(/\b1[012]\b/g, '');
  if (/\d/.test(digits)) return 'a number';
  if (/%/.test(text)) return 'a percentage';
  if (/\bAPS\b/.test(text)) return 'an APS';
  if (/\bR\s?\d/.test(text)) return 'a rand amount';
  if (MONTHS.test(text)) return 'a month';
  return null;
}

describe('the plan maps’ words', () => {
  it('are a section of en', () => {
    expect(en.planMaps).toBe(planMaps);
  });

  it('name five templates, each with a name, a line and a centre', () => {
    expect(Object.keys(planMaps.templates)).toEqual([
      'six-stops',
      'thinking-cloud',
      'staircase',
      'life-map',
      'the-road',
    ]);
    for (const t of Object.values(planMaps.templates)) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.line.length).toBeGreaterThan(0);
      expect(t.centre.heading.length).toBeGreaterThan(0);
      expect(t.centre.hint.length).toBeGreaterThan(0);
    }
  });

  it('gives every status a word, and "Not achieved" is not a failure word (D7)', () => {
    expect(planMaps.status).toEqual({
      planned: 'Planned',
      achieved: 'Achieved',
      'not-achieved': 'Not achieved',
    });
    // The charter: no "you should have", no "why did you fail" (planning.md §4.1).
    for (const [path, text] of strings(planMaps)) {
      expect(text, path).not.toMatch(/\bfail(ed|ure)?\b|should have|why did you/i);
    }
  });

  it('holds no admission fact: stage names only (hard rule 2, proposal §6)', () => {
    const found = strings(planMaps).flatMap(([path, text]) => {
      const fact = factIn(text);
      return fact ? [`${path}: ${fact} in “${text}”`] : [];
    });
    expect(found).toEqual([]);
  });

  it('the no-facts check catches each kind of fact', () => {
    expect(factIn('Grade 10, Grade 11 and Grade 12')).toBeNull();
    expect(factIn('You need 30 points')).toBe('a number');
    expect(factIn('Apply by 30 September')).toBe('a number');
    expect(factIn('Get sixty % for maths')).toBe('a percentage');
    expect(factIn('A good APS')).toBe('an APS');
    expect(factIn('The fee is R 200')).toBe('a number');
    expect(factIn('Apply in September')).toBe('a month');
  });

  it('keeps the draft consent line apart, marked as owed legal review, and out of the live wording', () => {
    expect(planMaps.consentDraft.status).toMatch(/draft/i);
    expect(planMaps.consentDraft.status).toMatch(/legal review/i);
    const live = JSON.stringify(en.consent);
    expect(live).not.toContain(planMaps.consentDraft.guardianLine);
    expect(JSON.stringify(en.adultConsent)).not.toContain(planMaps.consentDraft.adultLine);
  });
});
