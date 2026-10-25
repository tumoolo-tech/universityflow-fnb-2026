import { describe, expect, it } from 'vitest';
import { isQuietHour, nextSendableAt } from './quiet-hours';

/** Builds an instant from a South African wall-clock time (UTC+2, no daylight saving). */
const sast = (iso: string) => new Date(`${iso}+02:00`);

describe('isQuietHour', () => {
  it.each([
    ['2027-10-20T20:59:59', false],
    ['2027-10-20T21:00:00', true],
    ['2027-10-20T23:30:00', true],
    ['2027-10-21T00:00:00', true],
    ['2027-10-21T06:59:59', true],
    ['2027-10-21T07:00:00', false],
    ['2027-10-21T12:00:00', false],
  ])('%s SAST quiet: %s', (time, quiet) => {
    expect(isQuietHour(sast(time))).toBe(quiet);
  });

  it('judges by South African time, not the server clock', () => {
    // 19:30 UTC is 21:30 in Johannesburg: quiet, although it's early evening in UTC.
    expect(isQuietHour(new Date('2027-10-20T19:30:00Z'))).toBe(true);
  });
});

describe('nextSendableAt', () => {
  it('sends straight away outside quiet hours', () => {
    const noon = sast('2027-10-20T12:00:00');
    expect(nextSendableAt(noon)).toEqual(noon);
  });

  it('holds an evening message until 07:00 the next morning', () => {
    expect(nextSendableAt(sast('2027-10-20T22:15:00'))).toEqual(sast('2027-10-21T07:00:00'));
  });

  it('holds an early-morning message until 07:00 the same morning', () => {
    expect(nextSendableAt(sast('2027-10-21T05:00:00'))).toEqual(sast('2027-10-21T07:00:00'));
  });

  it('rolls over the end of a month and a year', () => {
    expect(nextSendableAt(sast('2027-12-31T23:00:00'))).toEqual(sast('2028-01-01T07:00:00'));
  });
});
