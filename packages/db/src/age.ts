/** Ages are counted in South African calendar days, whatever the server's clock zone. */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Today's date in South Africa, as YYYY-MM-DD. */
export function sastDate(now: Date): string {
  return new Date(now.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole years between a date of birth and `on` (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number) as [number, number, number];
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export const AGE_OF_MAJORITY = 18;

/** How long before the 18th birthday the learner is told what changes (A11-25). */
export const TURNING_EIGHTEEN_NOTICE_DAYS = 30;

/**
 * The 18th birthday (YYYY-MM-DD) when it falls in the next 30 days, from tomorrow; else null
 * (A11-25). The day `ageOn` first says 18: born on 29 February, 1 March in a year without one.
 */
export function eighteenthBirthdaySoon(dateOfBirth: string, today: string): string | null {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number) as [number, number, number];
  const year = by + AGE_OF_MAJORITY;
  const exists = new Date(Date.UTC(year, bm - 1, bd)).getUTCDate() === bd;
  const birthday = exists
    ? `${year}-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}`
    : `${year}-03-01`;
  const days = (Date.parse(birthday) - Date.parse(today)) / 86_400_000;
  return days >= 1 && days <= TURNING_EIGHTEEN_NOTICE_DAYS ? birthday : null;
}

/** The youngest a learner may sign up (A11-24): the stores declare 13 and over (owner, 13+). */
export const MINIMUM_AGE = 13;
