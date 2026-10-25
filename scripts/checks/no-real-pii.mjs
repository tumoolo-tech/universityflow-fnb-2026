import { join } from 'node:path';
import { isExempt, readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: no real-looking South African ID numbers or cellphone numbers in code, tests or
 * fixtures (hard rule 4). Our users start as children (planning.md §8.1); a real learner's ID
 * pasted into a test fixture is a POPIA breach committed to git history forever.
 *
 * - ID numbers: 13 digits whose first six are a real date and whose last is a valid Luhn check
 *   digit. That is what distinguishes an ID from a timestamp or an arbitrary long number.
 * - Cellphones: +27 or 0, then a mobile prefix (06x, 071-079, 081-084), then seven digits.
 *   Toll-free (080x) and landline numbers are not flagged: helplines are public on purpose.
 *
 * Fixtures build synthetic IDs at runtime (see checks.test.mjs) rather than as literals.
 * Escape hatch: `check-ignore` in a comment on the line, with a reason.
 */

const THIRTEEN_DIGITS = /(?<!\d)(\d{13})(?!\d)/g;
const CELLPHONE = /(?<![\d+])(?:\+27|0)(?:6\d|7[1-9]|8[1-4])\d{7}(?!\d)/;

/** Luhn check over a string of digits, as used by the SA ID number's final digit. */
export function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** True when a 13-digit string has the shape of a real SA ID number. */
export function looksLikeSaId(digits) {
  if (!/^\d{13}$/.test(digits)) return false;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const citizenship = digits[10];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (citizenship !== '0' && citizenship !== '1') return false;
  return luhnValid(digits);
}

export function run(root) {
  const findings = [];

  // tools/: the results generator makes synthetic learners (planning.md §18.7).
  for (const dir of ['apps', 'packages', 'scripts', 'tools']) {
    for (const file of walk(join(root, dir), ['.ts', '.tsx', '.mjs', '.js', '.json'])) {
      const relative = rel(root, file);
      readLines(file).forEach((line, index) => {
        if (line.includes('check-ignore')) return;
        const trimmed = line.trim();

        for (const match of line.matchAll(THIRTEEN_DIGITS)) {
          if (match[1] && looksLikeSaId(match[1])) {
            findings.push({
              file: relative,
              line: index + 1,
              message: 'looks like a real SA ID number. Generate synthetic IDs at runtime',
              snippet: trimmed,
            });
          }
        }
        if (!isExempt(line) && CELLPHONE.test(line)) {
          findings.push({
            file: relative,
            line: index + 1,
            message: 'looks like a real SA cellphone number. Use an obviously fake one',
            snippet: trimmed,
          });
        }
      });
    }
  }

  return findings;
}

export const meta = {
  id: 'no-real-pii',
  description: 'no real-looking SA ID or cellphone numbers in code or fixtures (CLAUDE.md rule 4)',
};
