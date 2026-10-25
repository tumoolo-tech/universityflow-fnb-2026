import { describe, expect, it } from 'vitest';
import { currentGrade, gradeCheckDue, schoolFinished } from './grades';

const on = (iso: string) => new Date(iso);

describe('currentGrade (G10-1): the grade moves up each school year', () => {
  it('is the grade given, the same calendar year', () => {
    expect(currentGrade({ grade: 10, givenOn: '2026-03-02' }, on('2026-12-31T21:00:00Z'))).toBe(10);
  });

  it('goes up on 1 January in South Africa, not in UTC', () => {
    // 31 December 22:30 UTC is already 1 January 00:30 in South Africa.
    expect(currentGrade({ grade: 10, givenOn: '2026-03-02' }, on('2026-12-31T22:30:00Z'))).toBe(11);
    expect(currentGrade({ grade: 10, givenOn: '2026-03-02' }, on('2026-12-31T21:30:00Z'))).toBe(10);
  });

  it('takes a Grade 10 learner to matric two years on, and stops at 12', () => {
    const record = { grade: 10, givenOn: '2026-02-01' };
    expect(currentGrade(record, on('2027-06-01T08:00:00Z'))).toBe(11);
    expect(currentGrade(record, on('2028-06-01T08:00:00Z'))).toBe(12);
    expect(currentGrade(record, on('2030-06-01T08:00:00Z'))).toBe(12);
  });

  it('says nothing without a grade, and keeps a grade with no date as given', () => {
    expect(currentGrade({ grade: null, givenOn: null }, on('2027-01-10T08:00:00Z'))).toBeNull();
    expect(currentGrade({ grade: 11, givenOn: null }, on('2030-01-10T08:00:00Z'))).toBe(11);
  });
});

describe('gradeCheckDue: "Are you in Grade N now?" each new school year', () => {
  it('is not due the year the grade was given or confirmed', () => {
    expect(gradeCheckDue({ grade: 10, givenOn: '2026-11-20' }, on('2026-12-01T08:00:00Z'))).toBe(
      false,
    );
  });

  it('is due once a new year has started, until the learner confirms it', () => {
    expect(gradeCheckDue({ grade: 10, givenOn: '2026-11-20' }, on('2027-01-05T08:00:00Z'))).toBe(
      true,
    );
    // Confirmed in January: given afresh, so not due again until next year.
    expect(gradeCheckDue({ grade: 11, givenOn: '2027-01-05' }, on('2027-08-01T08:00:00Z'))).toBe(
      false,
    );
  });

  it('never asks about a grade past matric', () => {
    expect(gradeCheckDue({ grade: 12, givenOn: '2026-02-01' }, on('2027-01-10T08:00:00Z'))).toBe(
      false,
    );
    expect(gradeCheckDue({ grade: 11, givenOn: '2026-02-01' }, on('2028-01-10T08:00:00Z'))).toBe(
      false,
    );
    expect(gradeCheckDue({ grade: 11, givenOn: '2026-02-01' }, on('2027-01-10T08:00:00Z'))).toBe(
      true,
    );
  });

  it('is never due without a grade', () => {
    expect(gradeCheckDue({ grade: null, givenOn: null }, on('2027-01-10T08:00:00Z'))).toBe(false);
  });
});

describe('schoolFinished (A10-38, A11-27): past matric, the grade no longer describes them', () => {
  it('is true once the yearly rise would pass Grade 12, in South African years', () => {
    const matric = { grade: 12, givenOn: '2026-02-01' };
    expect(schoolFinished(matric, on('2026-12-31T21:00:00Z'))).toBe(false); // 23:00 SAST
    expect(schoolFinished(matric, on('2026-12-31T22:30:00Z'))).toBe(true); // 2027 in SA
    expect(schoolFinished({ grade: 10, givenOn: '2026-10-13' }, on('2028-06-01T08:00:00Z'))).toBe(
      false,
    );
    expect(schoolFinished({ grade: 10, givenOn: '2026-10-13' }, on('2029-01-10T08:00:00Z'))).toBe(
      true,
    );
  });

  it('is never true without a grade, or a grade with no date', () => {
    expect(schoolFinished({ grade: null, givenOn: null }, on('2030-01-10T08:00:00Z'))).toBe(false);
    expect(schoolFinished({ grade: 12, givenOn: null }, on('2030-01-10T08:00:00Z'))).toBe(false);
  });
});
