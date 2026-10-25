import { expect } from 'vitest';

/** A UUID, as the logs name learners and records by (hard rule 4: IDs only). */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Asserts that logged text carries no phone number (nine digits in a row). IDs are blanked
 * first: a random UUID's last group can hold nine digits by chance, which failed a run of
 * api-review.test.ts with no phone number in sight.
 */
export function expectNoPhoneNumber(text: string): void {
  expect(withoutIds(text)).not.toMatch(/\d{9}/);
}

/**
 * Text with every UUID blanked, for a check that a word is absent: a random UUID can spell "fee"
 * in hex, which failed a run of api-registration.test.ts with no fee in sight.
 */
export function withoutIds(text: string): string {
  return text.replace(UUID, '<id>');
}
