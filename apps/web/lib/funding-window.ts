import { daysBetween } from '@universityflow/ui';

/**
 * Where a bursary's application window stands today (RT-05), from the record's own dates only
 * (hard rule 2: the record is the fact, this code decides; nothing is guessed). `today` is the
 * day in South Africa (YYYY-MM-DD, `sastDateOf`). Open runs from the opening day to the closing
 * day, both included; a window with no published closing day is `unknown`.
 */
export type FundingWindow =
  | {
      readonly state: 'open';
      readonly opensOn: string | null;
      readonly closesOn: string;
      readonly daysLeft: number;
    }
  | {
      readonly state: 'upcoming';
      readonly opensOn: string;
      readonly closesOn: string;
      readonly daysToOpen: number;
    }
  | { readonly state: 'closed'; readonly closesOn: string }
  | { readonly state: 'unknown' };

export function fundingWindow(
  record: { readonly opensOn: string | null; readonly closesOn: string | null },
  today: string,
): FundingWindow {
  const { opensOn, closesOn } = record;
  if (!closesOn) return { state: 'unknown' };
  const daysLeft = daysBetween(today, closesOn);
  if (daysLeft < 0) return { state: 'closed', closesOn };
  if (opensOn && daysBetween(today, opensOn) > 0) {
    return { state: 'upcoming', opensOn, closesOn, daysToOpen: daysBetween(today, opensOn) };
  }
  return { state: 'open', opensOn, closesOn, daysLeft };
}
