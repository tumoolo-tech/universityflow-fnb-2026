/**
 * Quiet hours: no message we start is delivered between 21:00 and 07:00 South African time
 * (planning.md §7.2). A reminder that wakes a learner the night before an exam does harm.
 *
 * Everything runs in Africa/Johannesburg regardless of where the server is, because the rule
 * is about the student's evening, not the server's.
 */

export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 7;

const TIME_ZONE = 'Africa/Johannesburg';

/** South Africa has no daylight saving, so the offset is fixed. */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

const hourFormat = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

function sastHour(instant: Date): number {
  return Number(hourFormat.format(instant));
}

/** True when `instant` falls inside quiet hours in South Africa. */
export function isQuietHour(instant: Date): boolean {
  const hour = sastHour(instant);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * The earliest moment at or after `instant` when a message may be sent: `instant` itself
 * outside quiet hours, otherwise the next 07:00 in South Africa.
 */
export function nextSendableAt(instant: Date): Date {
  if (!isQuietHour(instant)) return instant;

  const sast = new Date(instant.getTime() + SAST_OFFSET_MS);
  const morning = Date.UTC(
    sast.getUTCFullYear(),
    sast.getUTCMonth(),
    sast.getUTCDate() + (sastHour(instant) >= QUIET_START_HOUR ? 1 : 0),
    QUIET_END_HOUR,
  );
  return new Date(morning - SAST_OFFSET_MS);
}
