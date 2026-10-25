/**
 * A date typed on the number pad, as My offers asks for the date to reply by (by hand, or checked
 * from a letter). Pure, so both forms share it.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The date as it is typed: digits only, with the dashes written in (20261030 becomes 2026-10-30),
 * so no learner has to find "-" on a phone keyboard (A7-15). Deleting works: a dash is only added
 * before a digit that follows it.
 */
export function typedDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
}

/** A real calendar date written as YYYY-MM-DD (as packages/documents' isIsoDate). */
export const isDate = (value: string) =>
  ISO_DATE.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
