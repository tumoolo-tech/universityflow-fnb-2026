import { describe, expect, it } from 'vitest';
import { holdsPersonalNumber, isContactPhone, isEmail, isPlainText, safeLinkProblem } from './text';

/**
 * The text rules both sides enforce (§3.2): no ID or student number shapes, plain text only,
 * https links that point nowhere private. Synthetic values only; numbers are built at runtime so
 * no literal looks like a real one (hard rule 4).
 */

const thirteen = () => ['0', '1', '0', '2', '0', '3', '5', '0', '0', '0', '0', '8', '7'].join('');
const sevenPlus = () => '20'.concat('41', '777');

describe('holdsPersonalNumber (A11-17, the same rule as packages/db)', () => {
  it('finds an ID number, grouped or not', () => {
    const id = thirteen();
    expect(holdsPersonalNumber(`My ID ${id}`)).toBe(true);
    expect(holdsPersonalNumber(`${id.slice(0, 6)} ${id.slice(6, 10)} ${id.slice(10)}`)).toBe(true);
  });

  it('finds a student number after a word that names one', () => {
    expect(holdsPersonalNumber(`student number ${sevenPlus()}`)).toBe(true);
    expect(holdsPersonalNumber(`Ref: ${sevenPlus()}`)).toBe(true);
  });

  it('leaves module codes, marks, years and short numbers alone', () => {
    for (const text of ['CSC1A10', 'Mathematics 78%', '2026 to 2027', 'Top 10 in Grade 11']) {
      expect(holdsPersonalNumber(text)).toBe(false);
    }
  });
});

describe('isPlainText (§3.2: no HTML, no control characters)', () => {
  it('takes ordinary words, punctuation and other scripts', () => {
    for (const text of ['C# and C++', 'Ngiyabonga — 100%', 'A & B', '5 < 7 marks']) {
      expect(isPlainText(text)).toBe(true);
    }
  });

  it('refuses tags, comments and control characters', () => {
    for (const text of ['<b>bold</b>', 'x<script>', '<!-- c -->', 'a\u0000b', 'line\u0007']) {
      expect(isPlainText(text)).toBe(false);
    }
  });
});

describe('safeLinkProblem (§3.2: https only, nothing private, never fetched)', () => {
  it('takes a public https link', () => {
    expect(safeLinkProblem('https://github.com/example/bus-tracker')).toBeNull();
  });

  it.each([
    ['http://github.com/x', 'not-https'],
    ['javascript:alert(1)', 'not-https'],
    ['https://user:pass@github.com/x', 'credentials'],
    ['https://192.0.2.10/x', 'ip-host'],
    ['https://[2001:db8::1]/x', 'ip-host'],
    ['https://localhost/x', 'private-host'],
    ['https://printer.local/x', 'private-host'],
    ['not a link', 'invalid'],
  ])('refuses %s (%s)', (url, problem) => {
    expect(safeLinkProblem(url)).toBe(problem);
  });

  it('refuses a link longer than 500 characters', () => {
    expect(safeLinkProblem(`https://example.org/${'a'.repeat(500)}`)).toBe('too-long');
  });

  // CV-A5 A5-20: a fully qualified name ends in a dot and names the same host.
  it.each([
    ['https://localhost./x', 'private-host'],
    ['https://LOCALHOST../x', 'private-host'],
    ['https://build.internal./x', 'private-host'],
    ['https://printer.local./x', 'private-host'],
    ['https://./x', 'invalid'],
  ])('refuses %s, a private name written with a trailing dot (%s)', (url, problem) => {
    expect(safeLinkProblem(url)).toBe(problem);
  });

  it('still takes a public name written with a trailing dot', () => {
    expect(safeLinkProblem('https://github.com./example/bus')).toBeNull();
  });
});

describe('contact details the learner typed (D9)', () => {
  it('takes an e-mail address', () => {
    expect(isEmail('naledi@example.org')).toBe(true);
    expect(isEmail('not an address')).toBe(false);
  });

  it('takes a phone number, never something shaped like an ID number', () => {
    expect(isContactPhone(`080 ${'555'} ${'0101'}`)).toBe(true);
    expect(isContactPhone(`+27 80 ${'555'} ${'0101'}`)).toBe(true);
    expect(isContactPhone(thirteen())).toBe(false);
    expect(isContactPhone('call me')).toBe(false);
  });
});
