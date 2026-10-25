import type { ProgrammeResult } from '@universityflow/admissions';
import type { HomeData } from '@universityflow/ui';
import type { Account, Me } from '../lib/types';

/** Synthetic data only (hard rule 4): no real names, numbers or IDs. */

/** A synthetic cellphone number, built at runtime so no literal looks real. */
export const syntheticPhone = (n: number) => ['082', String(n).padStart(7, '0')].join('');

/** A learner; once `ready`, in Grade 11 unless `grade` says otherwise (null: not given yet). */
export function me(account: Partial<Account> = {}, ready = false, grade: number | null = 11): Me {
  return {
    account: {
      id: 'student-1',
      phoneMasked: '082 *** 0001',
      dateOfBirth: null,
      consentStatus: 'unknown',
      needsAdultConsent: false,
      ...account,
    },
    profile: ready ? { displayName: null, grade } : null,
    ready,
  };
}

/** A learner's home (`GET /api/home`): a Grade 11 learner with nothing yet, unless overridden. */
export function home(overrides: Partial<HomeData> = {}): HomeData {
  return {
    stage: 'grade-11',
    name: null,
    qualify: null,
    nextPaperDays: null,
    subjects: null,
    gradeCheck: null,
    turningEighteen: null,
    goalProgrammeId: null,
    shortlist: [],
    applications: [],
    universityYear: null,
    offers: [],
    registration: null,
    firstWeek: null,
    modules: null,
    marks: [],
    subjectNames: {},
    look: { theme: 'mauve', avatar: 'initials' },
    next: { id: 'add-report', href: '/documents' },
    ...overrides,
  };
}

export function programme(overrides: Partial<ProgrammeResult> = {}): ProgrammeResult {
  return {
    programmeId: 'wits-bsc-eng',
    universityId: 'wits',
    universityName: 'Wits',
    name: 'BSc Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    verdict: 'qualifies',
    score: 42,
    scoreLabel: 'APS',
    scoreUnit: 'points',
    scoreMaximum: 56,
    requiredScore: 42,
    scoreGap: 0,
    scoreBands: [],
    shortfalls: [],
    passRequired: 'bachelor',
    passProjected: 'bachelor',
    passMet: true,
    nbt: 'not-required',
    selection: null,
    closesOn: null,
    sourceUrl: 'https://www.wits.ac.za/',
    academicYear: 2027,
    draft: false,
    ...overrides,
  } as ProgrammeResult;
}
