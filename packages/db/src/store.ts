import { createHmac, randomInt } from 'node:crypto';
import {
  currentGrade,
  type ExamSubjectChoice,
  gradeCheckDue,
  isSubjectId,
  MODULE_TERMS,
  REPORT_KINDS,
  SCHOOL_GRADES,
  schoolFinished,
  UNIVERSITY_IDS,
} from '@universityflow/catalogue';
import {
  type CvReportReason,
  isFirstWeekStep,
  isMessageTemplateId,
  isReplyReportReason,
  MESSAGE_CHANNELS,
  messageTemplate,
  type ReplyReportReason,
} from '@universityflow/content';
import type { CvEntryRecord, CvPurpose, CvSelection } from '@universityflow/cv';
import type { ConfirmedModuleOutline } from '@universityflow/documents';
import { isEntityId } from '@universityflow/jobs';
import { DEFAULT_WEEKLY_CAP, EXPO_PUSH_TOKEN, validWeeklyCap } from '@universityflow/messaging';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AGE_OF_MAJORITY, ageOn, MINIMUM_AGE, sastDate } from './age';
import { type Database, type Db, rowsOf } from './client';
import { hashOtp, hashToken, newOtp, newToken, sameHash, suppressionHash } from './crypto';
import {
  addCvEntry,
  type CvAccess,
  type CvConsentRecord,
  type CvContext,
  type CvDocumentRecord,
  type CvEntryInput,
  type CvEntryPatch,
  CvJobStore,
  type CvLinkRecord,
  type CvReportOutcome,
  type CvRequest,
  type CvResult,
  type CvShareRecord,
  type CvSubmission,
  confirmCvDocument,
  createCvShare,
  deleteCvDocument,
  deleteCvEntry,
  dropCvJobs,
  exportCv,
  markCvSubmitted,
  optInToCv,
  readCvConsent,
  readCvDocument,
  readCvDocuments,
  readCvEntries,
  readCvFile,
  readCvLink,
  readCvSelection,
  readCvShares,
  readCvSubmission,
  readReportedCvDocuments,
  reportCvDocument,
  requestCvDocument,
  revokeCvShare,
  saveCvSelection,
  storeCvResult,
  tombstoneCv,
  updateCvEntry,
  withdrawCv,
} from './cv';
import {
  AdultsOnlyError,
  ConsentOutdatedError,
  ConsentRequiredError,
  GuardianOptedOutError,
  InvalidCodeError,
  InvalidStateError,
  NotFoundError,
  OfferConflictError,
  PersonalNumberError,
  PhotoConsentError,
  PinLockedError,
  PushTokenHeldError,
  RateLimitedError,
  TooYoungError,
} from './errors';
import { scopeToLearner } from './learner';
import { MessagingStore } from './messaging';
import {
  deleteExpiredModuleMarks,
  exportModuleMarks,
  type ModuleMark,
  type ModuleMarkSheet,
  readModuleMarks,
  saveModuleMarks,
} from './module-marks';
import {
  assertOutlinesCovered,
  deleteModuleOutline,
  MODULE_OUTLINE_KIND,
  type ModuleOutlineRecord,
  type OutlineContext,
  readModuleOutlines,
  saveModuleOutline,
} from './module-outlines';
import { isTollFreeNumber, maskPhone, normalisePhone, normaliseTollFree } from './phone';
import {
  PHOTO_LIVE,
  type PhotoAccess,
  photoCovered,
  photoPreview,
  servablePhotoKey,
} from './photo';
import {
  addPlanNode,
  createPlanMap,
  deletePlanMap,
  deletePlanNode,
  exportPlanMaps,
  movePlanNode,
  type NewPlanNode,
  type PlanContext,
  type PlanMapRecord,
  type PlanNodePatch,
  type PlanNodeRecord,
  type PlanPartInput,
  type PlanWords,
  readPlanMap,
  readPlanMaps,
  savePlanNode,
  updatePlanMap,
} from './plan-maps';
import {
  type ApplicationStatus,
  type AuditActor,
  applications,
  auditLog,
  budgetEvents,
  type ConsentStatus,
  checklistItems,
  conversations,
  cvDocuments,
  type DocumentStatus,
  demoSignups,
  documents,
  examSubjectChoices,
  firstWeekSteps,
  type GuardianRelationship,
  goals,
  guardianConsents,
  LATEST_REPORT_FIRST,
  type MemoryKind,
  type MessagingChannel,
  memoryNotes,
  messages,
  messagingChannels,
  messagingPreferences,
  type OfferKind,
  type OfferSource,
  type OfferStatus,
  offers,
  otpChallenges,
  type PushPlatform,
  profiles,
  pushTokens,
  REPLY_PROVIDERS,
  type RecheckCounts,
  type RecheckMove,
  type RegistrationModuleRow,
  type ReminderRowStatus,
  type ReplyWriter,
  type ReportKind,
  rateEvents,
  rechecks,
  registrations,
  reminders,
  replyReports,
  reportMarks,
  reports,
  sessions,
  shortlist,
  students,
  uploadIntents,
} from './schema';

/**
 * The only way the apps touch the database.
 *
 * `Store` holds the few operations that run before a student is known (sign-in, the guardian's
 * consent link). Everything else goes through `forStudent(id)`, which runs each call in a
 * transaction as `uf_app` with the student's id set, so Postgres row-level security decides what
 * is visible, and refuses a minor's personal data until a guardian has consented (hard rule 5).
 *
 * Nothing here logs. Audit rows carry ids and action names only (hard rule 4).
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_PER_IP_PER_HOUR = 10;
/**
 * Wrong PINs in a row a number may have (A5-09, NIST SP 800-63B rev 4: a new PIN must not reset
 * the count, and at most 100 consecutive failures). They count across all its PINs for 24 hours,
 * and the owner signing in starts the count again (A1-36). Past it no PIN is sent or accepted
 * until a day after the last wrong one: at most 100 guesses a day where each new PIN used to give
 * five more (~1,440). Locking a stranger out takes 100 wrong PINs, 20 PINs over about 100
 * minutes, no easier than holding the number at its PIN-request limits (A1-05).
 */
export const OTP_MAX_WRONG_PINS = 100;
const OTP_WRONG_WINDOW_MS = 24 * 60 * 60 * 1000;
/** How many PINs a number can have refunded after a failed SMS in an hour (A1-11). */
export const OTP_REFUNDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Phones with notifications on, per learner, at most (A5-04). Each reminder goes to all of them,
 * so this bounds a reminder's fan-out; a sixth phone evicts the one registered longest ago.
 */
export const MAX_PUSH_DEVICES = 5;
export const CONSENT_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const CONSENT_REQUESTS_PER_DAY = 3;
/**
 * Judge demo mode (UF_DEPLOYMENT=demo): how long a judge's private copy of a made-up learner, and
 * its session, lasts before the sweep deletes it.
 */
export const DEMO_STUDENT_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * PIN requests an hour per address on a demo with the on-screen phone sign-up (a hackathon
 * exception the owner approved on 2026-10-24): a judging room behind one address. The per-number
 * limits and the wrong-PIN lockout are unchanged.
 */
export const DEMO_OTP_PER_IP_PER_HOUR = 100;
/** At most this many old demo copies are deleted per sweep, so a sweep stays quick. */
export const DEMO_SWEEP_BATCH = 50;
/**
 * The judge demo's real sign-up (a hackathon exception, docs/deploy/demo.md): an adult judge's own
 * account is deleted this long after it was made, with everything in it. Its sessions end then too.
 */
export const DEMO_SIGNUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A verified Firebase identity: all the demo's sign-up keeps from Google. */
export interface DemoSignupIdentity {
  readonly uid: string;
  readonly email: string;
}

/**
 * The store-review sign-in (audit A7-01, docs/store/review-notes.md option A): one number the
 * owner controls signs in to the synthetic review account with a fixed PIN, until a date. The web
 * app's config reads it from UF_REVIEW_PHONE, UF_REVIEW_PIN_HASH and UF_REVIEW_UNTIL; without all
 * three there is none, and the number is an ordinary one.
 */
export interface ReviewSignIn {
  /** The number, any common format; normalised to E.164. */
  readonly phone: string;
  /** `reviewPinHash(phone, pin, AUTH_SECRET)`: the PIN is never configured in the clear. */
  readonly pinHash: string;
  /** After this instant the fixed PIN is refused. */
  readonly until: Date;
}

export interface StoreOptions {
  /** Keys one-time PIN hashes. Required; from AUTH_SECRET. */
  readonly secret: string;
  readonly clock?: () => Date;
  /** The store-review sign-in, or none (the default). */
  readonly review?: ReviewSignIn | null;
  /** Where the store reports what the owner must see about the review sign-in. Ids only. */
  readonly reviewAlerts?: ReviewAlerts;
  /**
   * A judge demo deployment (UF_DEPLOYMENT=demo, synthetic data only): the only store that may open
   * a session without a PIN (openDemoSession) or sweep old learners (sweepDemoStudents).
   */
  readonly demo?: boolean;
  /**
   * A demo with the judges' on-screen phone sign-up on (a hackathon exception the owner approved
   * on 2026-10-24): `DEMO_OTP_PER_IP_PER_HOUR` PIN requests an hour per address, since a judging
   * room shares one. Only with `demo`; every other store keeps `OTP_PER_IP_PER_HOUR`.
   */
  readonly demoPhoneSignup?: boolean;
}

/**
 * What the store reports about the review sign-in (A1-19, A1-20), for the web app to log. The
 * store itself never logs (hard rule 4); these carry counts and ids only.
 */
export interface ReviewAlerts {
  /** A wrong review PIN: `failures` of `limit` in this configuration's window. */
  wrongPin(info: { readonly failures: number; readonly limit: number }): void;
  /** The window's wrong-PIN budget is spent: the review sign-in is refused until a new PIN. */
  locked(): void;
  /** UF_REVIEW_PHONE names an account that isn't the review account: it gets ordinary SMS. */
  misconfigured(info: { readonly studentId: string }): void;
}

const SILENT: ReviewAlerts = { wrongPin() {}, locked() {}, misconfigured() {} };

/**
 * Wrong review PINs allowed in one configuration's whole window, across every challenge and
 * every server (A1-19). Past it, the review sign-in is refused, even with the right PIN, until the
 * owner sets a new PIN hash (or another date). Kept in the database, so a restart doesn't reset
 * it. With a one-in-a-million PIN, ten guesses are a one-in-100,000 chance.
 */
export const REVIEW_MAX_WRONG_PINS = 10;

/**
 * The review PIN's hash: exactly the keyed hash the store keeps for every PIN it sends, so the
 * configured hash is checked by the same code, with the same attempt limit, in constant time.
 * HMAC-SHA256 under AUTH_SECRET of "<E.164 number>:<PIN>".
 */
export function reviewPinHash(phone: string, pin: string, secret: string): string {
  if (!/^\d{6}$/.test(pin)) throw new InvalidStateError('A PIN is six digits');
  return hashOtp(normalisePhone(phone), pin, secret);
}

/** The review account's date of birth: an adult, obviously synthetic. */
export const REVIEW_DATE_OF_BIRTH = '2000-01-01';

/**
 * The review account's marks: synthetic, typed by the owner's seed (never read from a document),
 * and saved as a confirmed report with an audit row naming the seed as who confirmed them
 * (hard rule 6). Chosen so a reviewer sees programmes in every group.
 */
export const REVIEW_MARKS: ReadonlyArray<Mark> = [
  { subject: 'english-hl', percent: 72 },
  { subject: 'afrikaans-fal', percent: 65 },
  { subject: 'mathematics', percent: 74 },
  { subject: 'physical-sciences', percent: 68 },
  { subject: 'life-sciences', percent: 70 },
  { subject: 'geography', percent: 66 },
  { subject: 'life-orientation', percent: 80 },
];

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface Account {
  readonly id: string;
  readonly phoneMasked: string;
  readonly dateOfBirth: string | null;
  readonly consentStatus: ConsentStatus;
  /**
   * True for an adult who hasn't yet agreed in their own name: a new learner aged 18 or older
   * (audit A7-04), or a minor whose guardian consented and who has now turned 18 (§8.1).
   */
  readonly needsAdultConsent: boolean;
}

/**
 * The guardian consent wording that first named messaging and the companies that deliver it
 * (packages/content `consent.version` v2, audit A11-01). A minor's opt-in to any channel needs a
 * granted guardian consent at this version or later.
 */
export const MESSAGING_CONSENT_VERSION = 2;

/** The number in a consent version such as `v2-2026-10`, or null when it has none. */
export function consentVersionNumber(version: string): number | null {
  const match = /^v(\d+)(?:-|$)/.exec(version.trim());
  return match ? Number(match[1]) : null;
}

/** The number in an adult agreement version such as `adult-v2-2026-10`, or null when it has none. */
export function adultConsentVersionNumber(version: string): number | null {
  const match = /^adult-v(\d+)(?:-|$)/.exec(version.trim());
  return match ? Number(match[1]) : null;
}

export {
  MODULE_OUTLINE_KIND,
  MODULE_OUTLINES_ADULT_CONSENT_VERSION,
  MODULE_OUTLINES_CONSENT_VERSION,
  type ModuleOutlineRecord,
} from './module-outlines';

/** The document kinds that go whole to the AI provider with an ID or student number on them. */
export const UNIVERSITY_DOCUMENT_KINDS: ReadonlyArray<string> = [
  'acceptance-letter',
  'proof-of-registration',
];

/**
 * The guardian consent wording that first named offer letters and proofs of registration, what
 * the AI provider sees on them and how long the file is kept (packages/content `consent.version`
 * v3, audit A11-13). Below it, the database refuses those uploads, and an offer or registration
 * read from one (migration 0021).
 */
export const UNIVERSITY_DOCUMENTS_CONSENT_VERSION = 3;

/**
 * The adult agreement that first named them (`adultConsent.version` adult-v2). An adult who
 * agreed to an older version is asked again (`needsAdultConsent`), as A7-04 asked adults with none.
 */
export const UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION = 2;

/**
 * The safety and scam guidance scheduled by push when an offer is accepted (Phase 5b, §8.6).
 * They go when no offer is accepted any more (audit A11-18 / A1-28).
 */
export const SAFETY_TEMPLATE_IDS: ReadonlyArray<string> = [
  'safety.offer-accepted',
  'safety.move-in',
];

/**
 * Whether free text holds what looks like an ID number or a student number (audit A11-17): 13
 * digits in a row, perhaps grouped by single spaces or hyphens (an SA ID number's shape), or a run
 * of 7 or more digits shortly after a word that names a number. Module codes, marks, dates and
 * phone numbers are none of those. Migration 0021's `uf_holds_personal_number` is the same rule.
 */
export function holdsPersonalNumber(text: string): boolean {
  return (
    /\d(?:[ -]?\d){12}/.test(text) ||
    /\b(?:student|applicant|application|reference|ref|id|identity|passport|no|nr|number|num)\b\D{0,12}\d{7,}/i.test(
      text,
    )
  );
}

export interface GuardianDetails {
  readonly name: string;
  readonly phone: string;
  readonly relationship: GuardianRelationship;
}

/**
 * A sign-in challenge. `id` names it, for `withdrawOtp` if the SMS fails. An ordinary one has a
 * PIN to send by SMS; the store-review number's has none: nothing is sent, and its PIN is the
 * configured one (A7-01).
 */
export type OtpChallenge =
  | {
      readonly id: string;
      readonly phone: string;
      readonly review: false;
      readonly code: string;
    }
  | {
      readonly id: string;
      readonly phone: string;
      readonly review: true;
    };

export interface ConsentRequestView {
  readonly status: 'open' | 'granted' | 'withdrawn' | 'expired';
  readonly guardianName: string;
  readonly relationship: GuardianRelationship;
  readonly learnerPhoneMasked: string;
}

export interface Mark {
  readonly subject: string;
  readonly percent: number;
}

export interface ConfirmedReport {
  readonly id: string;
  readonly kind: ReportKind;
  readonly confirmedAt: Date;
  readonly marks: ReadonlyArray<Mark>;
}

/** What changed between two confirmed reports (Phase 4c). Programme ids and groups only. */
export interface RecheckView {
  readonly id: string;
  readonly reportId: string;
  readonly reportKind: ReportKind;
  readonly previousReportId: string;
  readonly previousKind: ReportKind;
  readonly moves: ReadonlyArray<RecheckMove>;
  readonly counts: RecheckCounts;
  readonly includesDrafts: boolean;
  readonly createdAt: Date;
}

export interface ChannelChoice {
  readonly channel: MessagingChannel;
  readonly optedIn: boolean;
  readonly optedInAt: Date | null;
  readonly optedOutAt: Date | null;
  /** Who turned it off: the learner in the app, a STOP, or a guardian's withdrawal (A11-05). */
  readonly optOutSource: 'app' | 'stop' | 'consent-withdrawn' | null;
}

export interface MessagingPreferences {
  readonly channels: ReadonlyArray<ChannelChoice>;
  readonly maxPerWeek: number;
}

export interface ReminderView {
  readonly id: string;
  readonly templateId: string;
  readonly channel: MessagingChannel;
  readonly desiredAt: Date;
  readonly status: ReminderRowStatus;
  readonly outcomeReason: string | null;
  readonly sentAt: Date | null;
}

/** An offer the learner recorded (Phase 5a), with its reply-by reminder's state. */
export interface OfferRecord {
  readonly id: string;
  readonly universityId: string;
  readonly programmeId: string;
  readonly kind: OfferKind;
  readonly source: OfferSource;
  readonly documentId: string | null;
  readonly status: OfferStatus;
  /** YYYY-MM-DD, as the learner confirmed it. */
  readonly replyBy: string | null;
  /** As quoted from the letter, confirmed by the learner. */
  readonly conditions: ReadonlyArray<string>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly acceptedAt: Date | null;
  readonly declinedAt: Date | null;
  readonly reminder: OfferReminderState | null;
  /**
   * The registration-day reminder scheduled when the learner accepted it (5d, A1-33), with its
   * state; null if none was.
   */
  readonly registrationReminder: OfferReminderState | null;
}

/** One of an offer's reminders, and where it is in the pipeline. */
export interface OfferReminderState {
  readonly id: string;
  readonly status: ReminderRowStatus;
  readonly desiredAt: Date;
}

export interface NewOffer {
  readonly universityId: string;
  readonly programmeId: string;
  readonly kind: OfferKind;
  /** YYYY-MM-DD, or null. */
  readonly replyBy: string | null;
  readonly conditions: ReadonlyArray<string>;
  /** The letter the learner checked, when there was one. */
  readonly documentId?: string | null;
}

/** What changing an offer did: the reminder jobs the caller should cancel. */
export interface OfferChange {
  readonly jobIds: ReadonlyArray<string>;
  /**
   * Whether this change made the offer the accepted one (it wasn't before): only then is a
   * registration-day reminder scheduled for it, so accepting again never schedules a second.
   */
  readonly newlyAccepted: boolean;
}

export const OFFER_KINDS: ReadonlyArray<OfferKind> = [
  'provisional',
  'conditional',
  'final',
  'waitlist',
];

const UNIVERSITY_ID = /^[a-z]{2,10}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkOffer(input: NewOffer): void {
  if (!UNIVERSITY_ID.test(input.universityId)) throw new InvalidStateError('Invalid university');
  if (!PROGRAMME_ID.test(input.programmeId)) throw new InvalidStateError('Invalid programme');
  if (!input.programmeId.startsWith(`${input.universityId}-`)) {
    throw new InvalidStateError('The programme is at another university');
  }
  if (!OFFER_KINDS.includes(input.kind)) throw new InvalidStateError('Invalid offer kind');
  if (input.replyBy !== null && !ISO_DATE.test(input.replyBy)) {
    throw new InvalidStateError('Invalid reply-by date');
  }
  if (
    input.conditions.length > 20 ||
    input.conditions.some((c) => c.length < 1 || c.length > 500 || /\p{Cc}/u.test(c))
  ) {
    throw new InvalidStateError('Invalid conditions');
  }
  // A11-17: a quoted condition never keeps an ID or student number, even if the reader slipped.
  if (input.conditions.some(holdsPersonalNumber)) {
    throw new PersonalNumberError();
  }
}

/**
 * A registration the learner confirmed (Phase 5c): the programme, the academic year and every
 * module row as they checked it, with its change-deadline reminder's state. Nothing personal.
 */
export interface RegistrationRecord {
  readonly id: string;
  readonly universityId: string;
  readonly programmeId: string;
  readonly academicYear: number;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<RegistrationModuleRow>;
  /** The proof the rows were read from, while it is kept. */
  readonly documentId: string | null;
  readonly confirmedAt: Date;
  readonly updatedAt: Date;
  readonly reminder: {
    readonly id: string;
    readonly status: ReminderRowStatus;
    readonly desiredAt: Date;
  } | null;
}

export interface NewRegistration {
  readonly universityId: string;
  readonly programmeId: string;
  readonly academicYear: number;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<RegistrationModuleRow>;
  /** The proof the learner checked, when there was one. */
  readonly documentId?: string | null;
}

/** What saving or deleting a registration did: the replaced reminder's jobs to cancel. */
export interface RegistrationChange {
  readonly id: string;
  readonly jobIds: ReadonlyArray<string>;
}

/** The most module rows a registration holds (as `documents`' MAX_MODULES and migration 0020). */
export const MAX_REGISTRATION_MODULES = 40;
const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/;

function checkRegistration(input: NewRegistration): void {
  if (!UNIVERSITY_ID.test(input.universityId)) throw new InvalidStateError('Invalid university');
  if (!PROGRAMME_ID.test(input.programmeId)) throw new InvalidStateError('Invalid programme');
  if (!input.programmeId.startsWith(`${input.universityId}-`)) {
    throw new InvalidStateError('The programme is at another university');
  }
  if (
    !Number.isInteger(input.academicYear) ||
    input.academicYear < 2020 ||
    input.academicYear > 2100
  ) {
    throw new InvalidStateError('Invalid academic year');
  }
  const year = input.yearOfStudy;
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 10)) {
    throw new InvalidStateError('Invalid year of study');
  }
  const { modules } = input;
  if (modules.length < 1 || modules.length > MAX_REGISTRATION_MODULES) {
    throw new InvalidStateError('Invalid modules');
  }
  for (const m of modules) {
    const keys = Object.keys(m).filter((k) => !['code', 'name', 'term', 'credits'].includes(k));
    if (
      keys.length > 0 ||
      !MODULE_CODE.test(m.code) ||
      (m.name !== null && (m.name.length < 1 || m.name.length > 160 || /\p{Cc}/u.test(m.name))) ||
      (m.term !== null && !(MODULE_TERMS as ReadonlyArray<string>).includes(m.term)) ||
      (m.credits !== null && !(Number.isFinite(m.credits) && m.credits >= 0 && m.credits <= 240))
    ) {
      throw new InvalidStateError('Invalid modules');
    }
    // A11-17: no ID or student number in a module row, even if the reader slipped. A code is
    // checked for an ID number's shape only: codes are letters and digits by design.
    if (/\d(?:[ -]?\d){12}/.test(m.code) || (m.name !== null && holdsPersonalNumber(m.name))) {
      throw new PersonalNumberError();
    }
  }
}

export interface Goal {
  readonly programmeId: string;
  readonly setAt: Date;
  readonly updatedAt: Date;
}

export type { ExamSubjectChoice };

const PROGRAMME_ID = /^(?=.{3,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What a reminder may refer to: catalogue ids, never free text (hard rule 4). */
export const REMINDER_PARAM_KEYS: ReadonlySet<string> = new Set(['universityId', 'subjectId']);

/** A report of a reply, and who wrote that reply (A10-49), or null: not recorded. */
export interface ReplyReportOutcome {
  readonly status: 'reported' | 'already-reported';
  readonly writtenBy: ReplyWriter | null;
}

/** A model id as migration 0036 holds it: a short token that can never carry text. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,99}$/;

/**
 * A reply's writer as columns (A10-49). An unknown provider is refused; a model id that isn't one
 * is kept as not recorded (null) rather than losing the learner's reply over it; the system never
 * has a model id.
 */
function replyWriterColumns(writer: ReplyWriter): {
  replyProvider: ReplyWriter['provider'];
  replyModel: string | null;
} {
  if (!(REPLY_PROVIDERS as ReadonlyArray<string>).includes(writer.provider)) {
    throw new InvalidStateError('Not a provider that writes replies');
  }
  const model =
    writer.provider !== 'system' && writer.model && MODEL_ID.test(writer.model)
      ? writer.model
      : null;
  return { replyProvider: writer.provider, replyModel: model };
}

export class Store {
  readonly #db: Db;
  readonly #secret: string;
  readonly #clock: () => Date;
  readonly #review: ReviewSignIn | null;
  readonly #reviewAlerts: ReviewAlerts;
  readonly #demo: boolean;
  readonly #otpPerIpPerHour: number;

  constructor(database: Database, options: StoreOptions) {
    if (options.secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
    this.#demo = options.demo === true;
    if (options.demoPhoneSignup && !this.#demo) {
      throw new Error('Only a demo store takes the on-screen phone sign-up’s PIN limit');
    }
    this.#otpPerIpPerHour =
      this.#demo && options.demoPhoneSignup ? DEMO_OTP_PER_IP_PER_HOUR : OTP_PER_IP_PER_HOUR;
    this.#db = database.db;
    this.#secret = options.secret;
    this.#clock = options.clock ?? (() => new Date());
    this.#review = options.review ? validReview(options.review) : null;
    this.#reviewAlerts = options.reviewAlerts ?? SILENT;
  }

  /**
   * D10 (Phase 6c, migration 0041): deletes every learner's module marks and targets once their
   * academic year plus one has passed (from 1 January two years on, in South Africa). Returns how
   * many rows went, nothing else. A11-04's retention sweep runs it.
   */
  async deleteExpiredModuleMarks(now: Date = this.#clock()): Promise<number> {
    return deleteExpiredModuleMarks(this.#db, sastDate(now));
  }

  /**
   * A learner's or guardian's number: a cellphone number, and on a demo store also a made-up
   * toll-free one (080…), which the judge demo's on-screen sign-up takes (a hackathon exception,
   * 2026-10-24, docs/deploy/demo.md). Every other store takes cellphone numbers only.
   */
  #phone(input: string): string {
    if (this.#demo && isTollFreeNumber(input)) return normaliseTollFree(input);
    return normalisePhone(input);
  }

  /**
   * The key the window's wrong review PINs are counted under: this configuration (number, PIN
   * hash, last day), so a new PIN or a new date starts a fresh count. Stored only as an HMAC.
   */
  #reviewFailureKey(review: ReviewSignIn): string {
    return createHmac('sha256', this.#secret)
      .update(`review-wrong-pin:${review.phone}:${review.pinHash}:${review.until.toISOString()}`)
      .digest('hex');
  }

  /** The key a number's wrong PINs are counted under (SEC-04). Stored only as an HMAC (rule 4). */
  #wrongPinKey(phone: string): string {
    return createHmac('sha256', this.#secret).update(`otp-wrong-pin:${phone}`).digest('hex');
  }

  /** Wrong PINs for this number in the last 24 hours, under its lock (no race past the limit). */
  async #recentWrongPins(tx: Tx, phone: string, now: Date): Promise<number> {
    const keyHash = this.#wrongPinKey(phone);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp-wrong-pin:${keyHash}`}))`);
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(rateEvents)
      .where(
        and(
          eq(rateEvents.action, 'otp-wrong-pin'),
          eq(rateEvents.keyHash, keyHash),
          gt(rateEvents.at, new Date(now.getTime() - OTP_WRONG_WINDOW_MS)),
        ),
      );
    return Number(count?.n ?? 0);
  }

  async #reviewFailures(tx: Tx, review: ReviewSignIn): Promise<number> {
    const keyHash = this.#reviewFailureKey(review);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`review-wrong-pin:${keyHash}`}))`);
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(rateEvents)
      .where(and(eq(rateEvents.action, 'review-wrong-pin'), eq(rateEvents.keyHash, keyHash)));
    return Number(count?.n ?? 0);
  }

  /** The review sign-in when `phone` (E.164) is its number and its window is open at `now`. */
  #openReview(phone: string, now: Date): ReviewSignIn | null {
    const review = this.#review;
    if (!review || review.phone !== phone || now.getTime() > review.until.getTime()) return null;
    return review;
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────────────────────

  /**
   * Starts a sign-in. Returns the PIN for the caller to send by SMS; it is stored only hashed.
   *
   * Limits (audit 2026-10-13, finding 4): one PIN a minute and three in fifteen minutes per
   * number, and a cap per IP address so one caller can't spray PINs across many numbers. The
   * check and the insert run under a lock, so parallel requests can't slip past the count.
   *
   * The store-review number, while its window is open (A7-01), goes through the same limits, but
   * its challenge holds the configured PIN hash and there is nothing to send by SMS.
   *
   * If the configured number belongs to an account that isn't the review account (an owner's
   * typo naming a learner's number, A1-20), it is an ordinary number: the learner gets their SMS
   * PIN, and the misconfiguration is reported.
   */
  async requestOtp(
    phoneInput: string,
    options: { ip?: string | null } = {},
  ): Promise<OtpChallenge> {
    const phone = this.#phone(phoneInput);
    const now = this.#clock();
    const openReview = this.#openReview(phone, now);
    const code = newOtp();
    // Decided under the number's lock, from who holds the number (A1-20).
    const decided: { reviewHash: string | null; misconfigured: string | null } = {
      reviewHash: null,
      misconfigured: null,
    };
    let locked = false;
    const id = await this.#db.transaction(async (tx): Promise<string | null> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`);
      // A number locked by wrong PINs gets no PIN: one we pay for that could never work (A1-37).
      if (!openReview && (await this.#recentWrongPins(tx, phone, now)) >= OTP_MAX_WRONG_PINS) {
        locked = true;
        return null;
      }
      if (openReview) {
        const [holder] = await tx
          .select({ id: students.id, review: students.review })
          .from(students)
          .where(eq(students.phone, phone));
        if (holder && !holder.review) decided.misconfigured = holder.id;
        else decided.reviewHash = openReview.pinHash;
      }
      const [recent] = await tx
        .select({
          n: sql<number>`count(*)::int`,
          last: sql<Date | null>`max(${otpChallenges.createdAt})`,
        })
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.phone, phone),
            gt(otpChallenges.createdAt, new Date(now.getTime() - OTP_WINDOW_MS)),
          ),
        );
      if ((recent?.n ?? 0) >= OTP_MAX_PER_WINDOW) return null;
      const last = recent?.last ? new Date(recent.last) : null;
      if (last && now.getTime() - last.getTime() < OTP_COOLDOWN_MS) return null;
      if (
        options.ip &&
        !(await this.#take(tx, 'otp-ip', options.ip, this.#otpPerIpPerHour, HOUR_MS))
      ) {
        return null;
      }
      const [row] = await tx
        .insert(otpChallenges)
        .values({
          phone,
          codeHash: decided.reviewHash ?? hashOtp(phone, code, this.#secret),
          review: decided.reviewHash !== null,
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          createdAt: now,
        })
        .returning({ id: otpChallenges.id });
      return row?.id ?? null;
    });
    if (decided.misconfigured) {
      this.#reviewAlerts.misconfigured({ studentId: decided.misconfigured });
    }
    if (locked)
      throw new PinLockedError('Too many wrong PINs for this number. Try again tomorrow.');
    if (!id) throw new RateLimitedError('Too many PIN requests. Try again in a few minutes.');
    return decided.reviewHash !== null
      ? { id, phone, review: true }
      : { id, phone, review: false, code };
  }

  /**
   * Takes back a PIN whose SMS never went out (a provider error, or the global SMS budget
   * spent), so the learner isn't left with a PIN they never got and can ask again at once
   * (audit A1-11).
   *
   * The PIN always dies. Normally its challenge is deleted, which also hands back the number's
   * allowance (one a minute, three in fifteen minutes). Two things keep that from becoming a
   * way around the limits: the per-IP count taken by `requestOtp` is never refunded, so one
   * caller can't spray more requests by making sends fail; and a number gets only
   * `OTP_REFUNDS_PER_HOUR` refunds an hour, after which a failed PIN is voided but still counts,
   * in case a provider reports a failure for a message that did go out.
   */
  async withdrawOtp(challenge: {
    readonly id: string;
    readonly phone: string;
  }): Promise<'refunded' | 'voided' | 'missing'> {
    const phone = this.#phone(challenge.phone);
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`);
      const where = and(
        eq(otpChallenges.id, challenge.id),
        eq(otpChallenges.phone, phone),
        isNull(otpChallenges.consumedAt),
      );
      const [found] = await tx.select({ id: otpChallenges.id }).from(otpChallenges).where(where);
      if (!found) return 'missing';
      if (await this.#take(tx, 'otp-refund', phone, OTP_REFUNDS_PER_HOUR, HOUR_MS)) {
        await tx.delete(otpChallenges).where(where);
        return 'refunded';
      }
      await tx.update(otpChallenges).set({ consumedAt: now }).where(where);
      return 'voided';
    });
  }

  /**
   * A general quota: true (and counted) when `key` has done `action` fewer than `max` times in
   * `windowMs`. Used for per-learner limits on paid work like chat messages and report reading
   * (finding 6). The key is stored only as an HMAC.
   */
  async allow(action: string, key: string, max: number, windowMs: number): Promise<boolean> {
    return this.#db.transaction((tx) => this.#take(tx, action, key, max, windowMs));
  }

  /**
   * A global budget (the SMS budgets, open finding 1): records one event of `units` for `budget`
   * if every window has room for all of them, and says how many units each window holds. An SMS
   * costs its segments (A1-14). Check and record run under one lock, so every server instance
   * shares the count and two callers racing for the last units can't both get them. Events older
   * than the longest window are pruned as it goes.
   */
  async takeBudget(
    budget: string,
    windows: ReadonlyArray<{ readonly limit: number; readonly windowMs: number }>,
    units = 1,
  ): Promise<{ allowed: boolean; used: number[] }> {
    return this.#budget(budget, windows, units, true);
  }

  /**
   * Whether `budget` has room for `units` in every window, recording nothing. The store-review
   * number asks this so it fails like every number when the sign-in SMS budget is spent, without
   * spending it (A1-22).
   */
  async peekBudget(
    budget: string,
    windows: ReadonlyArray<{ readonly limit: number; readonly windowMs: number }>,
    units = 1,
  ): Promise<{ allowed: boolean; used: number[] }> {
    return this.#budget(budget, windows, units, false);
  }

  async #budget(
    budget: string,
    windows: ReadonlyArray<{ readonly limit: number; readonly windowMs: number }>,
    units: number,
    record: boolean,
  ): Promise<{ allowed: boolean; used: number[] }> {
    if (windows.length === 0) throw new Error('A budget needs at least one window');
    if (!Number.isInteger(units) || units < 1) throw new Error('A budget event is 1 unit or more');
    const now = this.#clock();
    const longest = Math.max(...windows.map((w) => w.windowMs));
    return this.#db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`budget:${budget}`}))`);
      await tx
        .delete(budgetEvents)
        .where(
          and(
            eq(budgetEvents.budget, budget),
            lte(budgetEvents.at, new Date(now.getTime() - longest)),
          ),
        );
      const used: number[] = [];
      for (const w of windows) {
        const [count] = await tx
          .select({ n: sql<number>`coalesce(sum(${budgetEvents.units}), 0)::int` })
          .from(budgetEvents)
          .where(
            and(
              eq(budgetEvents.budget, budget),
              gt(budgetEvents.at, new Date(now.getTime() - w.windowMs)),
            ),
          );
        used.push(Number(count?.n));
      }
      if (windows.some((w, i) => !(Number(used[i]) + units <= w.limit))) {
        return { allowed: false, used };
      }
      if (!record) return { allowed: true, used };
      await tx.insert(budgetEvents).values({ budget, at: now, units });
      return { allowed: true, used: used.map((n) => n + units) };
    });
  }

  async #take(
    tx: Tx,
    action: string,
    key: string,
    max: number,
    windowMs: number,
  ): Promise<boolean> {
    const keyHash = createHmac('sha256', this.#secret).update(`${action}:${key}`).digest('hex');
    const now = this.#clock();
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rate:${action}:${keyHash}`}))`);
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(rateEvents)
      .where(
        and(
          eq(rateEvents.action, action),
          eq(rateEvents.keyHash, keyHash),
          gt(rateEvents.at, new Date(now.getTime() - windowMs)),
        ),
      );
    if ((count?.n ?? 0) >= max) return false;
    await tx.insert(rateEvents).values({ action, keyHash, at: now });
    return true;
  }

  /**
   * Completes a sign-in, creating the account on first use.
   *
   * A store-review challenge (A7-01) is checked by the same code: the same five attempts, the
   * same constant-time comparison. It is refused once the review window has closed or the
   * configuration no longer names the number, and it opens only the seeded review account: it
   * never creates one. Every sign-in to the review account, by either kind of PIN, says so
   * (`review: true`) and writes its own audit row, so the caller can raise the alert.
   */
  async verifyOtp(
    phoneInput: string,
    code: string,
  ): Promise<{ studentId: string; token: string; isNewStudent: boolean; review: boolean }> {
    const phone = this.#phone(phoneInput);
    const now = this.#clock();
    const open = this.#openReview(phone, now);
    // A wrong PIN must count even though the sign-in fails, so the transaction commits and
    // reports the failure, and the error is raised after the commit. (Throwing inside it would
    // roll the attempt back, and the five-attempt lock would never trigger.)
    const outcome = await this.#db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.phone, phone),
            isNull(otpChallenges.consumedAt),
            gt(otpChallenges.expiresAt, now),
          ),
        )
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1)
        .for('update');
      if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) return 'expired' as const;
      // The fixed PIN lives only as long as the configuration that allowed it (guard 4).
      const review = challenge.review ? open : null;
      if (challenge.review && !review) return 'expired' as const;
      // The whole window's wrong-PIN budget, across challenges and restarts (A1-19).
      const failures = review ? await this.#reviewFailures(tx, review) : 0;
      if (review && failures >= REVIEW_MAX_WRONG_PINS) return 'locked' as const;
      // Every other number: its wrong PINs across all its PINs in the last day (SEC-04).
      if (!review && (await this.#recentWrongPins(tx, phone, now)) >= OTP_MAX_WRONG_PINS) {
        return 'throttled' as const;
      }
      if (
        !/^\d{6}$/.test(code) ||
        !sameHash(challenge.codeHash, hashOtp(phone, code, this.#secret))
      ) {
        await tx
          .update(otpChallenges)
          .set({ attempts: challenge.attempts + 1 })
          .where(eq(otpChallenges.id, challenge.id));
        if (!review) {
          await tx
            .insert(rateEvents)
            .values({ action: 'otp-wrong-pin', keyHash: this.#wrongPinKey(phone), at: now });
          return 'wrong' as const;
        }
        await tx.insert(rateEvents).values({
          action: 'review-wrong-pin',
          keyHash: this.#reviewFailureKey(review),
          at: now,
        });
        return { wrongReview: failures + 1 };
      }
      let [student] = await tx.select().from(students).where(eq(students.phone, phone));
      // The fixed PIN opens only the seeded synthetic account, and never creates one (guard 3).
      if (challenge.review && !student?.review) return 'expired' as const;
      // The review account is usable only while a review window is open, by any PIN (A1-18).
      if (student?.review && !open) return 'expired' as const;
      await tx
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(eq(otpChallenges.id, challenge.id));
      // The owner is in: the count is of wrong PINs in a row (A1-36), so it starts again.
      if (!review) {
        await tx
          .delete(rateEvents)
          .where(
            and(
              eq(rateEvents.action, 'otp-wrong-pin'),
              eq(rateEvents.keyHash, this.#wrongPinKey(phone)),
            ),
          );
      }

      const isNewStudent = !student;
      if (!student) {
        // On a demo the account's age is the store's own clock, as the sweep reads it.
        [student] = await tx
          .insert(students)
          .values(this.#demo ? { phone, createdAt: now } : { phone })
          .returning();
      }
      if (!student) throw new Error('Could not create the account');

      const token = newToken();
      // A review session ends with the review window (A1-18). On a demo, every learner is deleted
      // 24 hours after it was made (the sweep), so its sessions end then too.
      const lasts = this.#demo
        ? Math.min(
            now.getTime() + SESSION_TTL_MS,
            student.createdAt.getTime() + DEMO_STUDENT_TTL_MS,
          )
        : now.getTime() + SESSION_TTL_MS;
      await tx.insert(sessions).values({
        studentId: student.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(open && student.review ? Math.min(lasts, open.until.getTime()) : lasts),
        createdAt: now,
        lastSeenAt: now,
      });
      await tx.insert(auditLog).values({
        actorType: 'student',
        actorId: student.id,
        studentId: student.id,
        action: student.review
          ? 'auth.review-signed-in'
          : isNewStudent
            ? 'account.created'
            : 'auth.signed-in',
      });
      return { studentId: student.id, token, isNewStudent, review: student.review };
    });
    if (outcome === 'locked') this.#reviewAlerts.locked();
    if (outcome === 'throttled') {
      throw new PinLockedError('Too many wrong PINs for this number. Try again tomorrow.');
    }
    if (outcome === 'expired' || outcome === 'locked')
      throw new InvalidCodeError('That PIN has expired. Ask for a new one.');
    if (outcome === 'wrong') throw new InvalidCodeError('That PIN is not right.');
    if ('wrongReview' in outcome) {
      this.#reviewAlerts.wrongPin({ failures: outcome.wrongReview, limit: REVIEW_MAX_WRONG_PINS });
      throw new InvalidCodeError('That PIN is not right.');
    }
    return outcome;
  }

  /**
   * The student a session token belongs to, or null when it's unknown or expired. A session on
   * the store-review account works only while a review window for its number is open (A1-18).
   */
  async sessionStudent(token: string): Promise<string | null> {
    const now = this.#clock();
    const [found] = await this.#db
      .select({ session: sessions, phone: students.phone, review: students.review })
      .from(sessions)
      .innerJoin(students, eq(students.id, sessions.studentId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)));
    if (!found) return null;
    if (found.review && !this.#openReview(found.phone, now)) return null;
    const { session } = found;
    if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await this.#db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, session.id));
    }
    return session.studentId;
  }

  async signOut(token: string): Promise<void> {
    await this.#db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  /**
   * Deletes every session that can no longer be used (audit A11-03), run daily by the
   * `session.sweep` job: those past their end, and the store-review account's once its review
   * window has closed (A1-18: they stop working then, whatever their end date). Each push token
   * hangs off its session, so a learner who just stops using the app keeps no device identifier
   * on file: the tokens go first, each with an audit row (ids only), then the sessions.
   */
  async sweepExpiredSessions(): Promise<{
    readonly sessions: number;
    readonly pushTokens: number;
  }> {
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      const reviewers = await tx
        .select({ id: students.id, phone: students.phone })
        .from(students)
        .where(eq(students.review, true));
      const closed = reviewers.filter((r) => !this.#openReview(r.phone, now)).map((r) => r.id);
      const ended = or(
        lte(sessions.expiresAt, now),
        closed.length > 0 ? inArray(sessions.studentId, closed) : sql`false`,
      );
      const tokens = await tx
        .delete(pushTokens)
        .where(
          inArray(pushTokens.sessionId, tx.select({ id: sessions.id }).from(sessions).where(ended)),
        )
        .returning({ studentId: pushTokens.studentId });
      for (const { studentId } of tokens) {
        await tx.insert(auditLog).values({
          actorType: 'system',
          studentId,
          action: 'push.token-expired',
        });
      }
      const gone = await tx.delete(sessions).where(ended).returning({ id: sessions.id });
      return { sessions: gone.length, pushTokens: tokens.length };
    });
  }

  // ── Account and consent ────────────────────────────────────────────────────────────────────

  async account(studentId: string): Promise<Account> {
    const [student] = await this.#db.select().from(students).where(eq(students.id, studentId));
    if (!student) throw new NotFoundError('No such account');
    const adult =
      student.dateOfBirth !== null &&
      ageOn(student.dateOfBirth, sastDate(this.#clock())) >= AGE_OF_MAJORITY;
    return {
      id: student.id,
      phoneMasked: maskPhone(student.phone),
      dateOfBirth: student.dateOfBirth,
      consentStatus: student.consentStatus,
      // An adult who agreed to wording older than adult-v2 is asked again (audit A11-13), as one
      // who agreed to none was (A7-04).
      needsAdultConsent:
        adult &&
        (student.consentStatus === 'granted' ||
          (student.consentStatus === 'not-required' &&
            (adultConsentVersionNumber(student.adultConsentVersion ?? '') ?? 0) <
              UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION)),
    };
  }

  /**
   * The first question at sign-up. An adult agrees in their own name next (`consentAsAdult`,
   * audit A7-04); a minor needs a guardian's consent before anything else is collected
   * (planning.md §8.1).
   */
  async setDateOfBirth(studentId: string, dateOfBirth: string): Promise<ConsentStatus> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth))) {
      throw new InvalidStateError('Not a date');
    }
    const age = ageOn(dateOfBirth, sastDate(this.#clock()));
    if (age > 100) throw new InvalidStateError('That date of birth looks wrong');
    // Before anything is read or written (A11-24): a refused date leaves no trace.
    if (age < MINIMUM_AGE) throw new TooYoungError();
    // The judge demo's real sign-up is adults only (docs/deploy/demo.md): refused before anything
    // is written, whatever the deployment, so the rule lives where the data does.
    if (age < AGE_OF_MAJORITY && (await this.isDemoSignup(studentId))) {
      throw new AdultsOnlyError();
    }
    const account = await this.account(studentId);
    // Set once. Allowing a change while waiting for a guardian let a minor re-declare as an
    // adult and skip consent (audit 2026-10-13, finding 1). A genuine mistake is corrected by a
    // person, not by the learner alone.
    if (account.consentStatus !== 'unknown') {
      throw new InvalidStateError('Date of birth is already set');
    }
    const status: ConsentStatus = age >= AGE_OF_MAJORITY ? 'not-required' : 'pending';
    await this.#db
      .update(students)
      .set({ dateOfBirth, consentStatus: status })
      .where(eq(students.id, studentId));
    await this.#audit('student', studentId, studentId, 'account.date-of-birth-set');
    return status;
  }

  /**
   * Records who to ask, and returns the link token for the caller to send to the guardian, with
   * the request's id (a queued SMS's job carries only that, A12-04). A number that replied STOP
   * to an SMS is never asked: nothing is recorded and the learner is told (A12-04).
   */
  async requestGuardianConsent(
    studentId: string,
    guardian: GuardianDetails,
    consentVersion: string,
  ): Promise<{ token: string; guardianPhone: string; consentId: string }> {
    const account = await this.account(studentId);
    if (account.consentStatus !== 'pending' && account.consentStatus !== 'withdrawn') {
      throw new InvalidStateError('This account does not need guardian consent');
    }
    const guardianPhone = this.#phone(guardian.phone);
    if (await this.messaging().isSuppressed('sms', guardianPhone)) {
      throw new GuardianOptedOutError();
    }
    const [student] = await this.#db
      .select({ phone: students.phone })
      .from(students)
      .where(eq(students.id, studentId));
    if (student?.phone === guardianPhone) {
      throw new InvalidStateError("A guardian's number must be different from yours");
    }
    const now = this.#clock();
    const [recent] = await this.#db
      .select({ n: sql<number>`count(*)::int` })
      .from(guardianConsents)
      .where(
        and(
          eq(guardianConsents.studentId, studentId),
          gt(guardianConsents.requestedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        ),
      );
    if ((recent?.n ?? 0) >= CONSENT_REQUESTS_PER_DAY) {
      throw new RateLimitedError('Too many consent requests today. Try again tomorrow.');
    }
    const token = newToken();
    const [row] = await this.#db
      .insert(guardianConsents)
      .values({
        studentId,
        guardianName: guardian.name.trim(),
        guardianPhone,
        relationship: guardian.relationship,
        tokenHash: hashToken(token),
        consentVersion,
        requestedAt: now,
        expiresAt: new Date(now.getTime() + CONSENT_LINK_TTL_MS),
      })
      .returning({ id: guardianConsents.id });
    if (!row) throw new Error('Could not record the consent request');
    await this.#db
      .update(students)
      .set({ consentStatus: 'pending' })
      .where(eq(students.id, studentId));
    await this.#audit('student', studentId, studentId, 'consent.requested');
    return { token, guardianPhone, consentId: row.id };
  }

  /**
   * A consent SMS held for the morning (quiet hours, A12-04) is about to go: a fresh link for
   * the request `consentId`, valid for the full time from now, with the number to send it to.
   * The token made at request time was never sent and stops working. Null when there is nothing
   * to send any more: the request was answered, expired or superseded by the learner moving on,
   * the account is gone, or the number has since replied STOP.
   */
  async guardianLinkToSend(
    consentId: string,
  ): Promise<{ token: string; guardianPhone: string } | null> {
    if (!isEntityId(consentId)) return null;
    const now = this.#clock();
    const [row] = await this.#db
      .select()
      .from(guardianConsents)
      .where(eq(guardianConsents.id, consentId));
    if (!row || row.grantedAt || row.withdrawnAt || row.expiresAt <= now) return null;
    const [student] = await this.#db
      .select({ consent: students.consentStatus })
      .from(students)
      .where(eq(students.id, row.studentId));
    if (student?.consent !== 'pending') return null;
    if (await this.messaging().isSuppressed('sms', row.guardianPhone)) return null;
    const token = newToken();
    await this.#db
      .update(guardianConsents)
      .set({
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + CONSENT_LINK_TTL_MS),
      })
      .where(eq(guardianConsents.id, row.id));
    return { token, guardianPhone: row.guardianPhone };
  }

  /** What a guardian sees when they open the link. Never the learner's name or details. */
  async consentRequest(token: string): Promise<ConsentRequestView> {
    const row = await this.#consentRow(token);
    const [student] = await this.#db
      .select({ phone: students.phone })
      .from(students)
      .where(eq(students.id, row.studentId));
    const status = row.withdrawnAt
      ? 'withdrawn'
      : row.grantedAt
        ? 'granted'
        : row.expiresAt <= this.#clock()
          ? 'expired'
          : 'open';
    return {
      status,
      guardianName: row.guardianName,
      relationship: row.relationship,
      learnerPhoneMasked: maskPhone(student?.phone ?? ''),
    };
  }

  /**
   * The guardian agrees through the link. `shownVersion` is the consent wording the page shows
   * now; when given, it replaces the version recorded at request time, so the record names the
   * wording the guardian actually agreed to even if it changed while the link was open.
   */
  async grantConsent(token: string, shownVersion?: string): Promise<void> {
    const row = await this.#consentRow(token);
    const now = this.#clock();
    if (row.grantedAt || row.withdrawnAt || row.expiresAt <= now) {
      throw new InvalidStateError('This consent link can no longer be used');
    }
    // A link only answers the request that is still open: never one the learner has moved past
    // (audit 2026-10-13, finding 3).
    if ((await this.account(row.studentId)).consentStatus !== 'pending') {
      throw new InvalidStateError('This consent link can no longer be used');
    }
    await this.#db.transaction(async (tx) => {
      await tx
        .update(guardianConsents)
        .set(
          shownVersion?.trim()
            ? { grantedAt: now, consentVersion: shownVersion.trim() }
            : { grantedAt: now },
        )
        .where(eq(guardianConsents.id, row.id));
      await tx
        .update(students)
        .set({ consentStatus: 'granted' })
        .where(eq(students.id, row.studentId));
      await tx.insert(auditLog).values({
        actorType: 'guardian',
        studentId: row.studentId,
        action: 'consent.granted',
      });
    });
  }

  /**
   * A guardian can withdraw at any time. Processing stops at once: the database refuses the
   * learner's personal data again, and every session ends. Messaging ends with it (A11-05): every
   * channel the learner had on is turned off (`consent-withdrawn`), so a later consent, even a
   * different guardian's, never resumes messages until the learner opts in again; and every
   * scheduled reminder is dropped (`no-consent`) and its queued job cancelled. Returns those
   * jobs' ids so the caller cancels them in a hosted scheduler too. The profile photo goes at once
   * (A11-31, the owner's "used for nothing else"): its key is returned in `fileKeys` so the caller
   * deletes the file.
   */
  async withdrawConsent(
    token: string,
  ): Promise<{ readonly jobIds: string[]; readonly fileKeys: string[] }> {
    const row = await this.#consentRow(token);
    if (!row.grantedAt || row.withdrawnAt) {
      throw new InvalidStateError('There is no consent to withdraw on this link');
    }
    // Once the learner has consented as an adult, a guardian's old link has no say
    // (audit 2026-10-13, finding 3).
    if ((await this.account(row.studentId)).consentStatus !== 'granted') {
      throw new InvalidStateError('There is no consent to withdraw on this link');
    }
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      await tx
        .update(guardianConsents)
        .set({ withdrawnAt: now })
        .where(eq(guardianConsents.id, row.id));
      await tx
        .update(students)
        .set({ consentStatus: 'withdrawn' })
        .where(eq(students.id, row.studentId));
      await tx.delete(sessions).where(eq(sessions.studentId, row.studentId));
      // As the owner, filtered to this learner: their own role may no longer touch these rows.
      // A channel already off keeps the reason it went off (a STOP stays a STOP).
      await tx
        .update(messagingChannels)
        .set({
          optedIn: false,
          optedOutAt: now,
          optOutSource: 'consent-withdrawn',
          updatedAt: now,
        })
        .where(
          and(eq(messagingChannels.studentId, row.studentId), eq(messagingChannels.optedIn, true)),
        );
      // A reminder a runner holds right now (`sending`) is left to it: the channel's last-moment
      // check now refuses it.
      const dropped = await tx
        .update(reminders)
        .set({ status: 'dropped', sentAt: null, outcomeReason: 'no-consent', updatedAt: now })
        .where(and(eq(reminders.studentId, row.studentId), eq(reminders.status, 'scheduled')))
        .returning({ jobId: reminders.jobId });
      const jobIds = dropped.flatMap((r) => (r.jobId ? [r.jobId] : []));
      if (jobIds.length > 0) {
        await tx.execute(sql`
          update jobs set status = 'cancelled', finished_at = ${now.toISOString()}::timestamptz
          where status = 'pending'
            and id::text in (${sql.join(
              jobIds.map((id) => sql`${id}`),
              sql`, `,
            )})`);
      }
      // My CV (§7.3, §11): processing stops, and the deletion goes to Mmereko by a tombstone the
      // caller schedules (Store.cvJobs().deletionsToSchedule). Any share link goes at once.
      await tombstoneCv(tx, row.studentId, now);
      // The profile photo (A11-31): deleted, not just hidden. Clearing is never refused (0037).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`photo:${row.studentId}`}))`);
      const photos = await tx
        .select({ key: profiles.photoKey })
        .from(profiles)
        .where(and(eq(profiles.studentId, row.studentId), isNotNull(profiles.photoKey)));
      if (photos.length > 0) {
        await tx
          .update(profiles)
          .set({ photoKey: null, updatedAt: now })
          .where(eq(profiles.studentId, row.studentId));
      }
      await tx.insert(auditLog).values({
        actorType: 'guardian',
        studentId: row.studentId,
        action: 'consent.withdrawn',
      });
      return { jobIds, fileKeys: photos.flatMap((p) => (p.key ? [p.key] : [])) };
    });
  }

  /**
   * An adult agrees in their own name, to `consentVersion` of the wording (packages/content
   * `adultConsent.version`): a new learner aged 18 or older (audit A7-04), or, at 18, a learner
   * whose guardian consented (§8.1). Recorded with its version and time; the web layer refuses
   * chat and uploads until it is (`needsAdultConsent`).
   */
  async consentAsAdult(studentId: string, consentVersion: string): Promise<void> {
    const version = consentVersion.trim();
    if (version.length === 0 || version.length > 40) {
      throw new InvalidStateError('A consent needs the version of the wording agreed to');
    }
    const account = await this.account(studentId);
    if (!account.needsAdultConsent) throw new InvalidStateError('Not needed for this account');
    await this.#db
      .update(students)
      .set({
        consentStatus: 'not-required',
        adultConsentVersion: version,
        adultConsentedAt: this.#clock(),
      })
      .where(eq(students.id, studentId));
    await this.#audit('student', studentId, studentId, 'consent.adult');
  }

  /**
   * Creates the synthetic store-review account for `phone` (A7-01), for the owner to run before a
   * submission (`pnpm --filter @universityflow/db review:seed`). Idempotent: an existing review
   * account is left as it is. Never takes over a number that belongs to anyone else.
   *
   * The account is an adult born on `REVIEW_DATE_OF_BIRTH`, flagged `review` (the database then
   * refuses a guardian request and any SMS or WhatsApp opt-in), with one Grade 11 report of
   * `REVIEW_MARKS`. Those marks are typed here, read from no document, and confirmed by this seed:
   * the audit log records `report.confirmed` by `staff` with the reason `review-seed`, so hard
   * rule 6's "confirmed before any calculation uses it" holds and says who confirmed. The adult's
   * own agreement (A7-04) is left for the reviewer to give in the app, so they see the disclosure.
   */
  async seedReviewAccount(phoneInput: string): Promise<{ studentId: string; created: boolean }> {
    const phone = normalisePhone(phoneInput);
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: students.id, review: students.review })
        .from(students)
        .where(eq(students.phone, phone));
      if (existing && !existing.review) {
        // Usually someone signed in to the company SIM by SMS outside a review window, often after
        // a reviewer deleted the review account (A1-24). Never taken over: it may be a learner's.
        throw new InvalidStateError(
          `That number belongs to an ordinary account (${existing.id}), not the review account. ` +
            'If the number is the company SIM, sign in to it by SMS and Delete that account ' +
            '(About me → Delete my account), then seed again. If it is a learner’s number, ' +
            'UF_REVIEW_PHONE is wrong: fix it.',
        );
      }
      if (existing) return { studentId: existing.id, created: false };
      const [created] = await tx
        .insert(students)
        .values({
          phone,
          review: true,
          dateOfBirth: REVIEW_DATE_OF_BIRTH,
          consentStatus: 'not-required',
          createdAt: now,
        })
        .returning({ id: students.id });
      if (!created) throw new Error('Could not create the review account');
      const studentId = created.id;
      await tx
        .insert(auditLog)
        .values({ actorType: 'staff', studentId, action: 'account.review-seeded' });
      const [report] = await tx
        .insert(reports)
        .values({ studentId, kind: 'grade-11-final', documentId: null, confirmedAt: now })
        .returning({ id: reports.id });
      if (!report) throw new Error('Could not save the review marks');
      await tx
        .insert(reportMarks)
        .values(REVIEW_MARKS.map((m) => ({ reportId: report.id, studentId, ...m })));
      await tx.insert(auditLog).values({
        actorType: 'staff',
        studentId,
        action: 'report.confirmed',
        reason: 'review-seed',
      });
      return { studentId, created: true };
    });
  }

  // ── Judge demo mode (UF_DEPLOYMENT=demo) ────────────────────────────────────────────────────

  #requireDemo(): void {
    if (!this.#demo) throw new Error('Only a demo deployment opens demo sessions or sweeps');
  }

  /**
   * A session for a judge's private copy of a made-up learner (docs/deploy/demo.md): no phone, no
   * PIN. Only a store built with `demo: true`, which the web app builds only on a demo deployment
   * (synthetic data only). Lasts as long as the copy itself.
   */
  async openDemoSession(studentId: string): Promise<string> {
    this.#requireDemo();
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      const [student] = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.id, studentId));
      if (!student) throw new NotFoundError('No such student');
      const token = newToken();
      await tx.insert(sessions).values({
        studentId,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + DEMO_STUDENT_TTL_MS),
        createdAt: now,
        lastSeenAt: now,
      });
      await tx.insert(auditLog).values({
        actorType: 'student',
        actorId: studentId,
        studentId,
        action: 'auth.demo-signed-in',
      });
      return token;
    });
  }

  /**
   * Deletes the demo copies made more than `maxAgeMs` ago, each through `deleteAccount` (so
   * everything attached goes, and the audit row is written), at most `DEMO_SWEEP_BATCH` a call.
   * Returns the storage keys of their files for the caller to delete. Demo deployments only: on
   * one, every learner is a judge's copy (phone sign-in is off there).
   */
  async sweepDemoStudents(
    maxAgeMs: number = DEMO_STUDENT_TTL_MS,
  ): Promise<{ readonly students: number; readonly fileKeys: string[] }> {
    this.#requireDemo();
    const cutoff = new Date(this.#clock().getTime() - maxAgeMs);
    // A judge's own account (the real sign-up) keeps its 30 days: `sweepDemoSignups` takes it.
    const old = await this.#db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          lte(students.createdAt, cutoff),
          sql`not exists (select 1 from demo_signups d where d.student_id = ${students.id})`,
        ),
      )
      .orderBy(asc(students.createdAt))
      .limit(DEMO_SWEEP_BATCH);
    const fileKeys: string[] = [];
    for (const { id } of old) fileKeys.push(...(await this.forStudent(id).deleteAccount()));
    return { students: old.length, fileKeys };
  }

  /**
   * The judge demo's real sign-up (a hackathon exception the owner approved on 2026-10-23,
   * docs/deploy/demo.md). The caller has verified the Firebase ID token; this finds the account
   * for that uid, or makes one, and opens a session. Only the uid and the email are kept (the email
   * kept current). The account's phone is a random synthetic one, never messaged (a demo has no
   * SMS): the table requires one. A session ends when the account does, 30 days after it was made.
   */
  async signInDemoSignup(
    identity: DemoSignupIdentity,
  ): Promise<{ studentId: string; token: string; isNewStudent: boolean }> {
    this.#requireDemo();
    const uid = identity.uid.trim();
    const email = identity.email.trim().toLowerCase();
    if (!/^[A-Za-z0-9:_.-]{1,128}$/.test(uid)) throw new InvalidStateError('Not a sign-in id');
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      throw new InvalidStateError('Not an email address');
    }
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      const [found] = await tx
        .select({ studentId: demoSignups.studentId, createdAt: demoSignups.createdAt })
        .from(demoSignups)
        .where(eq(demoSignups.firebaseUid, uid))
        .for('update');
      let studentId: string;
      let createdAt: Date;
      if (found) {
        if (found.createdAt.getTime() + DEMO_SIGNUP_TTL_MS <= now.getTime()) {
          // Past its 30 days and not yet swept: it is no longer usable.
          throw new InvalidStateError('This demo account has ended');
        }
        studentId = found.studentId;
        createdAt = found.createdAt;
        await tx.update(demoSignups).set({ email }).where(eq(demoSignups.studentId, studentId));
      } else {
        let phone = '';
        for (let attempt = 0; attempt < 10 && !phone; attempt++) {
          const candidate = `+2783${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
          const [taken] = await tx
            .select({ id: students.id })
            .from(students)
            .where(eq(students.phone, candidate));
          if (!taken) phone = candidate;
        }
        if (!phone) throw new Error('Could not create the account');
        const [student] = await tx
          .insert(students)
          .values({ phone, createdAt: now })
          .returning({ id: students.id });
        if (!student) throw new Error('Could not create the account');
        studentId = student.id;
        createdAt = now;
        await tx.insert(demoSignups).values({ studentId, firebaseUid: uid, email, createdAt: now });
      }
      const token = newToken();
      await tx.insert(sessions).values({
        studentId,
        tokenHash: hashToken(token),
        expiresAt: new Date(
          Math.min(now.getTime() + SESSION_TTL_MS, createdAt.getTime() + DEMO_SIGNUP_TTL_MS),
        ),
        createdAt: now,
        lastSeenAt: now,
      });
      await tx.insert(auditLog).values({
        actorType: 'student',
        actorId: studentId,
        studentId,
        action: found ? 'auth.demo-signup-signed-in' : 'account.demo-signup-created',
      });
      return { studentId, token, isNewStudent: !found };
    });
  }

  /**
   * The judge demo's on-screen phone sign-up (a hackathon exception, 2026-10-24): whether a
   * made-up toll-free number already has an account, so the screen shows its PIN only to the
   * browser that made it. Demo stores only.
   */
  async demoPhoneHasAccount(phoneInput: string): Promise<boolean> {
    this.#requireDemo();
    const phone = this.#phone(phoneInput);
    const [row] = await this.#db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.phone, phone));
    return Boolean(row);
  }

  /** True for a judge's own account made by the demo's real sign-up (never a made-up learner). */
  async isDemoSignup(studentId: string): Promise<boolean> {
    const [row] = await this.#db
      .select({ id: demoSignups.studentId })
      .from(demoSignups)
      .where(eq(demoSignups.studentId, studentId));
    return Boolean(row);
  }

  /**
   * Deletes the judges' own accounts made more than `maxAgeMs` ago (30 days), each through
   * `deleteAccount`, at most `DEMO_SWEEP_BATCH` a call. Returns their files' storage keys for the
   * caller to delete. Demo deployments only.
   */
  async sweepDemoSignups(
    maxAgeMs: number = DEMO_SIGNUP_TTL_MS,
  ): Promise<{ readonly students: number; readonly fileKeys: string[] }> {
    this.#requireDemo();
    const cutoff = new Date(this.#clock().getTime() - maxAgeMs);
    const old = await this.#db
      .select({ id: demoSignups.studentId })
      .from(demoSignups)
      .where(lte(demoSignups.createdAt, cutoff))
      .orderBy(asc(demoSignups.createdAt))
      .limit(DEMO_SWEEP_BATCH);
    const fileKeys: string[] = [];
    for (const { id } of old) fileKeys.push(...(await this.forStudent(id).deleteAccount()));
    return { students: old.length, fileKeys };
  }

  forStudent(studentId: string): StudentStore {
    return new StudentStore(this.#db, studentId, this.#clock);
  }

  /** My CV without a learner's request: the CV jobs, the webhook, the share page (ids only). */
  cvJobs(): CvJobStore {
    return new CvJobStore(this.#db, this.#clock);
  }

  /** Messaging without a learner's request: the reminder job, the channels' gate, inbound. */
  messaging(): MessagingStore {
    return new MessagingStore(
      this.#db,
      (phone) => suppressionHash(this.#secret, phone),
      this.#clock,
    );
  }

  async #consentRow(token: string) {
    const [row] = await this.#db
      .select()
      .from(guardianConsents)
      .where(eq(guardianConsents.tokenHash, hashToken(token)));
    if (!row) throw new NotFoundError('Unknown consent link');
    return row;
  }

  async #audit(actorType: AuditActor, actorId: string | null, studentId: string, action: string) {
    await this.#db.insert(auditLog).values({ actorType, actorId, studentId, action });
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** A reminder to record: a template, a channel, a time, and catalogue ids only. */
export interface NewReminder {
  readonly templateId: string;
  readonly channel: MessagingChannel;
  readonly desiredAt: Date;
  readonly params?: Readonly<Record<string, string>>;
}

/** Refuses a reminder the database must never hold (hard rule 4: ids only in its params). */
function checkReminder(input: NewReminder): void {
  if (!isMessageTemplateId(input.templateId)) throw new InvalidStateError('Unknown template');
  if (!messageTemplate(input.templateId).channels.includes(input.channel)) {
    throw new InvalidStateError('That template does not go out on that channel');
  }
  if (!(input.desiredAt instanceof Date) || Number.isNaN(input.desiredAt.getTime())) {
    throw new InvalidStateError('Not a time');
  }
  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (!REMINDER_PARAM_KEYS.has(key) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
      throw new InvalidStateError('A reminder refers to the catalogue by id only');
    }
  }
}

/** A first-week checklist is kept per catalogue university, by id only. */
function checkFirstWeekUniversity(universityId: string): void {
  if (!(UNIVERSITY_IDS as ReadonlyArray<string>).includes(universityId)) {
    throw new InvalidStateError('Not a university');
  }
}

/** A review configuration the store can trust: a mobile number, a PIN hash, a real date. */
function validReview(review: ReviewSignIn): ReviewSignIn {
  if (!SHA256_HEX.test(review.pinHash)) {
    throw new InvalidStateError('The review PIN must be configured as its hash (64 hex digits)');
  }
  if (Number.isNaN(review.until.getTime())) {
    throw new InvalidStateError('The review window needs a real end date');
  }
  return { phone: normalisePhone(review.phone), pinHash: review.pinHash, until: review.until };
}

/**
 * Everything a signed-in student can do with their own data. Each call is one transaction as
 * `uf_app`, scoped to this student by row-level security.
 */
export class StudentStore {
  readonly #db: Db;
  readonly #studentId: string;
  readonly #clock: () => Date;

  constructor(db: Db, studentId: string, clock: () => Date = () => new Date()) {
    this.#db = db;
    this.#studentId = studentId;
    this.#clock = clock;
  }

  get studentId(): string {
    return this.#studentId;
  }

  /**
   * Runs `fn` as this student. `personal` adds the consent check (hard rule 5). `asOwner` runs
   * first in the same transaction, before dropping to `uf_app`, for checks on rows the learner's
   * role can't read (the guardian's consent record).
   */
  async #as<T>(
    fn: (tx: Tx) => Promise<T>,
    personal = true,
    asOwner?: (tx: Tx) => Promise<void>,
  ): Promise<T> {
    return this.#db.transaction(async (tx) => {
      if (asOwner) await asOwner(tx);
      await scopeToLearner(tx, this.#studentId, this.#clock());
      await tx.execute(sql`set local role uf_app`);
      if (personal && !(await this.#mayProcessIn(tx))) throw new ConsentRequiredError();
      return fn(tx);
    });
  }

  async #mayProcessIn(tx: Tx): Promise<boolean> {
    const rows = rowsOf<{ ok: boolean }>(
      await tx.execute(sql`select uf_may_process(${this.#studentId}::uuid) as ok`),
    );
    return rows[0]?.ok === true;
  }

  async #audit(tx: Tx, action: string, reason?: string) {
    await tx.insert(auditLog).values({
      actorType: 'student',
      actorId: this.#studentId,
      studentId: this.#studentId,
      action,
      reason: reason ?? null,
    });
  }

  /** Whether the database will process this student's personal data right now. */
  async mayProcess(): Promise<boolean> {
    try {
      await this.#as(async () => undefined);
      return true;
    } catch (error) {
      if (error instanceof ConsentRequiredError) return false;
      throw error;
    }
  }

  // ── Profile ────────────────────────────────────────────────────────────────────────────────

  /**
   * The learner's profile, with the grade they are in today: the grade they gave, a year higher
   * for each school year since (G10-1). `gradeCheckDue`: ask them to confirm it this January.
   */
  async profile() {
    return this.#as(async (tx) => {
      const [row] = await tx.select().from(profiles).where(eq(profiles.studentId, this.#studentId));
      return row ? this.#withCurrentGrade(row) : null;
    });
  }

  #withCurrentGrade({ photoKey, ...row }: typeof profiles.$inferSelect) {
    const record = { grade: row.grade, givenOn: row.gradeGivenOn };
    const today = this.#clock();
    return {
      ...row,
      // Only whether there is a photo (0029): its key never leaves the server.
      hasPhoto: photoKey !== null,
      grade: currentGrade(record, today),
      gradeCheckDue: gradeCheckDue(record, today),
      // Past matric (A10-38, A11-27): "Grade 12" no longer describes them.
      schoolFinished: schoolFinished(record, today),
    };
  }

  /**
   * The profile as stored (the grade as given and its date), and beside it what the app shows now:
   * the grade moved up each school year, and whether school is finished (A11-27), so an export
   * explains itself.
   */
  #exportedProfile(row: typeof profiles.$inferSelect | undefined) {
    if (!row) return null;
    const shown = this.#withCurrentGrade(row);
    const { photoKey: _key, ...stored } = row;
    return {
      ...stored,
      hasPhoto: shown.hasPhoto,
      currentGrade: shown.grade,
      schoolFinished: shown.schoolFinished,
    };
  }

  /** Giving the grade (or confirming it) records today's date with it, for `currentGrade`. */
  async updateProfile(patch: {
    displayName?: string | null;
    grade?: number | null;
    schoolName?: string | null;
    province?: string | null;
    goal?: string | null;
    /** The look (0028): ids the API has checked against the lists; the database checks shape. */
    theme?: string;
    avatar?: string;
    taglineId?: string | null;
    badgeIds?: string[];
  }) {
    // Only the grades UniversityFlow serves (A1-39): the database's CHECK holds the same.
    if (
      patch.grade !== undefined &&
      patch.grade !== null &&
      !(SCHOOL_GRADES as ReadonlyArray<number>).includes(patch.grade)
    ) {
      throw new InvalidStateError('Not a grade UniversityFlow serves');
    }
    return this.#as(async (tx) => {
      const values = {
        ...patch,
        ...(patch.grade === undefined
          ? {}
          : { gradeGivenOn: patch.grade === null ? null : sastDate(this.#clock()) }),
        updatedAt: new Date(),
      };
      const [row] = await tx
        .insert(profiles)
        .values({ studentId: this.#studentId, ...values })
        .onConflictDoUpdate({ target: profiles.studentId, set: values })
        .returning();
      await this.#audit(tx, 'profile.updated');
      return row ? this.#withCurrentGrade(row) : row;
    });
  }

  // ── The profile photo (migration 0029, profile-look-proposal §5.3) ─────────────────────────

  /**
   * Whether the learner's consent names the photo now (A11-31, migration 0037: guardian v4,
   * adult-v3), or the owner's preview stands in for that wording. Before consent at all, refused
   * (ConsentRequiredError, hard rule 5).
   */
  async photoAllowed(access: PhotoAccess = PHOTO_LIVE): Promise<boolean> {
    return this.#as(async (tx) => {
      await photoPreview(tx, access);
      return photoCovered(tx, this.#studentId);
    });
  }

  /**
   * The photo's storage key, for the server alone (serving it to its owner): null when there is
   * none, and null too when the learner's consent doesn't name the photo (0037), so a photo kept
   * under older wording is never shown.
   */
  async photoKey(access: PhotoAccess = PHOTO_LIVE): Promise<string | null> {
    return this.#as(async (tx) => {
      await photoPreview(tx, access);
      return servablePhotoKey(tx, this.#studentId);
    });
  }

  /**
   * The key of the photo held for the learner, whatever the wording: for their own export only
   * (POPIA s23: what is held is theirs), never to show it. Needs consent (hard rule 5).
   */
  async heldPhotoKey(): Promise<string | null> {
    return this.#as(async (tx) => {
      const [row] = await tx
        .select({ key: profiles.photoKey })
        .from(profiles)
        .where(eq(profiles.studentId, this.#studentId));
      return row?.key ?? null;
    });
  }

  /**
   * Keeps `key` as the learner's photo and returns the one it replaces, or null, so the caller
   * deletes that file. The file is already stored, checked and stripped (packages/documents).
   * Refused (PhotoConsentError) unless the consent names the photo (A11-31); the database refuses
   * it too (0037).
   */
  async setPhoto(key: string, access: PhotoAccess = PHOTO_LIVE): Promise<string | null> {
    return this.#as(async (tx) => {
      await photoPreview(tx, access);
      if (!(await photoCovered(tx, this.#studentId))) throw new PhotoConsentError();
      // One change to a learner's photo at a time, so two uploads can't both keep the old key.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`photo:${this.#studentId}`}))`);
      const [before] = await tx
        .select({ key: profiles.photoKey })
        .from(profiles)
        .where(eq(profiles.studentId, this.#studentId));
      await tx
        .insert(profiles)
        .values({ studentId: this.#studentId, photoKey: key, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: profiles.studentId,
          set: { photoKey: key, updatedAt: new Date() },
        });
      await this.#audit(tx, 'profile.photo-set');
      return before?.key ?? null;
    });
  }

  /** Forgets the photo ("Remove photo") and returns its key, or null when there was none. */
  async removePhoto(): Promise<string | null> {
    // Allowed with or without consent (A11-32), like deleting the account: a learner whose
    // consent was withdrawn or lapsed at 18 can still take their photo back. Only this one row,
    // only to clear it; nothing is read or kept. Run as the owner, filtered to this learner, since
    // without consent row-level security hides the profile.
    return this.#db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`photo:${this.#studentId}`}))`);
      const [before] = await tx
        .select({ key: profiles.photoKey })
        .from(profiles)
        .where(eq(profiles.studentId, this.#studentId));
      if (!before?.key) return null;
      await tx
        .update(profiles)
        .set({ photoKey: null, updatedAt: new Date() })
        .where(eq(profiles.studentId, this.#studentId));
      await this.#audit(tx, 'profile.photo-removed');
      return before.key;
    });
  }

  // ── Reports (marks the student confirmed: hard rule 6) ─────────────────────────────────────

  async saveConfirmedReport(input: {
    kind: ReportKind;
    marks: ReadonlyArray<Mark>;
    documentId?: string | null;
  }): Promise<string> {
    if (input.marks.length === 0) throw new InvalidStateError('A report needs at least one mark');
    return this.#as(async (tx) => {
      // Confirmations are strictly ordered: "the latest report" and a re-check's "previous
      // report" must never depend on two confirmations landing in the same millisecond.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`reports:${this.#studentId}`}))`,
      );
      const [last] = await tx.select({ at: max(reports.confirmedAt) }).from(reports);
      const now = new Date();
      const lastAt = last?.at ? new Date(last.at).getTime() : 0;
      const [report] = await tx
        .insert(reports)
        .values({
          studentId: this.#studentId,
          kind: input.kind,
          documentId: input.documentId ?? null,
          confirmedAt: now.getTime() > lastAt ? now : new Date(lastAt + 1),
        })
        .returning({ id: reports.id });
      if (!report) throw new Error('Could not save the report');
      await tx.insert(reportMarks).values(
        input.marks.map((m) => ({
          reportId: report.id,
          studentId: this.#studentId,
          subject: m.subject,
          percent: m.percent,
        })),
      );
      if (input.documentId) {
        await tx
          .update(documents)
          .set({ status: 'confirmed' })
          .where(eq(documents.id, input.documentId));
      }
      await this.#audit(tx, 'report.confirmed');
      return report.id;
    });
  }

  /** The most recently confirmed report, which every calculation uses. */
  async latestReport(): Promise<ConfirmedReport | null> {
    return (await this.recentReports(1))[0] ?? null;
  }

  /**
   * The latest confirmed reports, newest first, with their marks. A re-check compares the two
   * newest. Only confirmed reports exist here: a document's extraction is never a report until
   * the learner confirms it (hard rule 6). A Grade 10 report comes after every Grade 11 and 12
   * one, however recently it was confirmed: a learner adding their old Grade 10 report to their
   * record must not have their results scored on it (G10-3).
   */
  async recentReports(limit = 2): Promise<ConfirmedReport[]> {
    return this.#as(async (tx) => {
      const rows = await tx.select().from(reports).orderBy(LATEST_REPORT_FIRST).limit(limit);
      const out: ConfirmedReport[] = [];
      for (const report of rows) {
        const marks = await tx
          .select({ subject: reportMarks.subject, percent: reportMarks.percent })
          .from(reportMarks)
          .where(eq(reportMarks.reportId, report.id))
          .orderBy(asc(reportMarks.subject));
        out.push({ id: report.id, kind: report.kind, confirmedAt: report.confirmedAt, marks });
      }
      return out;
    });
  }

  /**
   * The school record's reports (planning.md §18.7 C2): the newest confirmed report of each kind
   * (a second one of a kind is a correction, made by confirming the report again), oldest kind
   * first in the order the school year runs. Only confirmed reports exist here (hard rule 6).
   */
  async schoolRecordReports(): Promise<ConfirmedReport[]> {
    const all = await this.recentReports(Number.MAX_SAFE_INTEGER);
    const newest = new Map<ReportKind, ConfirmedReport>();
    for (const report of all) {
      const seen = newest.get(report.kind);
      if (!seen || report.confirmedAt > seen.confirmedAt) newest.set(report.kind, report);
    }
    return REPORT_KINDS.flatMap((kind) => newest.get(kind) ?? []);
  }

  // ── Re-checks after a new report (Phase 4c) ────────────────────────────────────────────────

  /** Records what changed between two of the learner's confirmed reports. */
  async saveRecheck(input: {
    readonly reportId: string;
    readonly previousReportId: string;
    readonly moves: ReadonlyArray<RecheckMove>;
    readonly counts: RecheckCounts;
    readonly includesDrafts: boolean;
  }): Promise<string> {
    const now = this.#clock();
    return this.#as(async (tx) => {
      const [row] = await tx
        .insert(rechecks)
        .values({
          studentId: this.#studentId,
          reportId: input.reportId,
          previousReportId: input.previousReportId,
          // Exactly the four fields the database accepts, whatever the caller's objects carry.
          moves: input.moves.map(({ programmeId, from, to, direction }) => ({
            programmeId,
            from,
            to,
            direction,
          })),
          counts: input.counts,
          includesDrafts: input.includesDrafts,
          createdAt: now,
        })
        .returning({ id: rechecks.id });
      if (!row) throw new Error('Could not save the re-check');
      await this.#audit(tx, 'report.rechecked');
      return row.id;
    });
  }

  /** The newest re-check, with both reports' kinds ("Since your June report…"), or null. */
  async latestRecheck(): Promise<RecheckView | null> {
    return this.#as(async (tx) => {
      const [row] = await tx.select().from(rechecks).orderBy(desc(rechecks.createdAt)).limit(1);
      if (!row) return null;
      const kinds = await tx
        .select({ id: reports.id, kind: reports.kind })
        .from(reports)
        .where(inArray(reports.id, [row.reportId, row.previousReportId]));
      const kindOf = (id: string) => kinds.find((k) => k.id === id)?.kind as ReportKind;
      return {
        id: row.id,
        reportId: row.reportId,
        reportKind: kindOf(row.reportId),
        previousReportId: row.previousReportId,
        previousKind: kindOf(row.previousReportId),
        moves: row.moves,
        // A re-check saved before migration 0024 has no on-track count: there was none.
        counts: {
          ...row.counts,
          onTrack: (row.counts.onTrack as RecheckCounts['onTrack'] | undefined) ?? {
            before: 0,
            after: 0,
          },
        },
        includesDrafts: row.includesDrafts,
        createdAt: row.createdAt,
      };
    });
  }

  // ── Offers (Phase 5a) ──────────────────────────────────────────────────────────────────────

  /**
   * Every offer the learner recorded, oldest first, each with its reply-by reminder's state. Only
   * what the learner confirmed is here: a letter's extraction is never an offer until they check
   * it (hard rule 6).
   */
  async offers(): Promise<OfferRecord[]> {
    return this.#as(async (tx) => {
      const registrationReminders = alias(reminders, 'registration_reminders');
      const rows = await tx
        .select({
          offer: offers,
          reminderStatus: reminders.status,
          reminderAt: reminders.desiredAt,
          registrationStatus: registrationReminders.status,
          registrationAt: registrationReminders.desiredAt,
        })
        .from(offers)
        .leftJoin(reminders, eq(reminders.id, offers.reminderId))
        .leftJoin(
          registrationReminders,
          eq(registrationReminders.id, offers.registrationReminderId),
        )
        .orderBy(asc(offers.createdAt), asc(offers.id));
      return rows.map(
        ({ offer, reminderStatus, reminderAt, registrationStatus, registrationAt }) => ({
          id: offer.id,
          universityId: offer.universityId,
          programmeId: offer.programmeId,
          kind: offer.kind,
          source: offer.source,
          documentId: offer.documentId,
          status: offer.status,
          replyBy: offer.replyBy,
          conditions: offer.conditions,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
          acceptedAt: offer.acceptedAt,
          declinedAt: offer.declinedAt,
          reminder:
            offer.reminderId && reminderStatus && reminderAt
              ? { id: offer.reminderId, status: reminderStatus, desiredAt: reminderAt }
              : null,
          registrationReminder:
            offer.registrationReminderId && registrationStatus && registrationAt
              ? {
                  id: offer.registrationReminderId,
                  status: registrationStatus,
                  desiredAt: registrationAt,
                }
              : null,
        }),
      );
    });
  }

  /**
   * Records an offer the learner confirmed: from a letter they checked field by field, or their
   * own word. One per programme (`offer-exists`). A letter it came from is marked confirmed.
   */
  async addOffer(input: NewOffer): Promise<string> {
    checkOffer(input);
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        if (input.documentId) await this.#assertCoversUniversityDocuments(tx);
        const [existing] = await tx
          .select({ id: offers.id })
          .from(offers)
          .where(eq(offers.programmeId, input.programmeId));
        if (existing) throw new OfferConflictError('offer-exists');
        // Strictly ordered, as reports are: the list never depends on two offers landing in the
        // same millisecond.
        const [last] = await tx.select({ at: max(offers.createdAt) }).from(offers);
        const lastAt = last?.at ? new Date(last.at).getTime() : 0;
        const createdAt = now.getTime() > lastAt ? now : new Date(lastAt + 1);
        const [row] = await tx
          .insert(offers)
          .values({
            studentId: this.#studentId,
            universityId: input.universityId,
            programmeId: input.programmeId,
            kind: input.kind,
            source: input.documentId ? 'letter' : 'learner',
            documentId: input.documentId ?? null,
            replyBy: input.replyBy,
            conditions: [...input.conditions],
            createdAt,
            updatedAt: now,
          })
          .returning({ id: offers.id });
        if (!row) throw new Error('Could not save the offer');
        if (input.documentId) {
          await tx
            .update(documents)
            .set({ status: 'confirmed' })
            .where(eq(documents.id, input.documentId));
        }
        await this.#audit(tx, 'offer.added', input.documentId ? 'letter' : 'learner');
        return row.id;
      },
      true,
      (tx) => this.#lockOffers(tx),
    );
  }

  /** Records the reply-by reminder now waiting for an offer. */
  async setOfferReminder(offerId: string, reminderId: string): Promise<void> {
    await this.#as(async (tx) => {
      const [row] = await tx
        .update(offers)
        .set({ reminderId, updatedAt: this.#clock() })
        .where(eq(offers.id, offerId))
        .returning({ id: offers.id });
      if (!row) throw new NotFoundError('No such offer');
      await this.#audit(tx, 'offer.reminder-set');
    });
  }

  /**
   * Records the registration-day reminder now waiting for the accepted offer (5d, A1-33), in place
   * of one still waiting (dropped as `replaced`). If the offer is no longer the accepted one by
   * now (declined or deleted since the accept, or not the learner's), the reminder is dropped as
   * `offer-closed` instead, never kept. Either way, the jobs of what was dropped come back for the
   * caller to cancel; a job that runs anyway finds its reminder no longer waiting.
   */
  async setOfferRegistrationReminder(
    offerId: string,
    reminderId: string,
  ): Promise<{ readonly jobIds: ReadonlyArray<string>; readonly kept: boolean }> {
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        const [row] = await tx.select().from(offers).where(eq(offers.id, offerId));
        if (row?.status !== 'accepted') {
          // Only the learner's own reminder: another learner's is refused, not touched.
          const [own] = await tx
            .select({ id: reminders.id })
            .from(reminders)
            .where(eq(reminders.id, reminderId));
          if (!own) throw new NotFoundError('No such reminder');
          return {
            jobIds: await this.#dropReminder(tx, reminderId, 'offer-closed', now),
            kept: false,
          };
        }
        const jobIds =
          row.registrationReminderId && row.registrationReminderId !== reminderId
            ? await this.#dropReminder(tx, row.registrationReminderId, 'replaced', now)
            : [];
        await tx
          .update(offers)
          .set({ registrationReminderId: reminderId, updatedAt: now })
          .where(eq(offers.id, offerId));
        await this.#audit(tx, 'offer.registration-reminder-set');
        return { jobIds, kept: true };
      },
      true,
      (tx) => this.#lockOffers(tx),
    );
  }

  /**
   * The learner accepted this offer. At most one accepted offer (`another-accepted`; the database
   * holds it to that too, migration 0018). Its reply-by reminder is dropped: the jobs come back
   * for the caller to cancel.
   */
  async acceptOffer(id: string): Promise<OfferChange> {
    return this.#changeOffer(id, 'accepted');
  }

  /** The learner declined this offer (or changed their mind about accepting it). */
  async declineOffer(id: string): Promise<OfferChange> {
    return this.#changeOffer(id, 'declined');
  }

  /**
   * Deletes an offer; its waiting reminder is dropped with it, and so are the safety pushes if it
   * was the accepted one (A11-18).
   */
  async deleteOffer(id: string): Promise<OfferChange> {
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        const [row] = await tx.select().from(offers).where(eq(offers.id, id));
        if (!row) throw new NotFoundError('No such offer');
        const jobIds = await this.#dropOfferReminders(tx, row, now);
        if (row.status === 'accepted') {
          jobIds.push(...(await this.#dropSafetyReminders(tx, id, now)));
        }
        await tx.delete(offers).where(eq(offers.id, id));
        await this.#audit(tx, 'offer.deleted');
        return { jobIds, newlyAccepted: false };
      },
      true,
      (tx) => this.#lockOffers(tx),
    );
  }

  async #changeOffer(id: string, to: 'accepted' | 'declined'): Promise<OfferChange> {
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        const [row] = await tx.select().from(offers).where(eq(offers.id, id));
        if (!row) throw new NotFoundError('No such offer');
        if (to === 'accepted' && row.status !== 'accepted') {
          const [other] = await tx
            .select({ id: offers.id })
            .from(offers)
            .where(and(eq(offers.status, 'accepted'), ne(offers.id, id)));
          if (other) throw new OfferConflictError('another-accepted');
        }
        const jobIds = await this.#dropReminder(tx, row.reminderId, 'offer-closed', now);
        if (row.status === 'accepted' && to === 'declined') {
          // No longer the accepted place: its registration day and safety pushes go (A1-33,
          // A11-18).
          jobIds.push(
            ...(await this.#dropReminder(tx, row.registrationReminderId, 'offer-closed', now)),
            ...(await this.#dropSafetyReminders(tx, id, now)),
          );
        }
        if (row.status !== to) {
          await tx
            .update(offers)
            .set({
              status: to,
              acceptedAt: to === 'accepted' ? now : null,
              declinedAt: to === 'declined' ? now : null,
              updatedAt: now,
            })
            .where(eq(offers.id, id));
          await this.#audit(tx, to === 'accepted' ? 'offer.accepted' : 'offer.declined');
        }
        return { jobIds, newlyAccepted: to === 'accepted' && row.status !== 'accepted' };
      },
      true,
      (tx) => this.#lockOffers(tx),
    );
  }

  /** One change to a learner's offers at a time, so two accepts can't both pass the check. */
  async #lockOffers(tx: Tx): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`offers:${this.#studentId}`}))`);
  }

  /** A deleted offer's reply-by and registration-day reminders, if still waiting, are dropped. */
  async #dropOfferReminders(
    tx: Tx,
    offer: { reminderId: string | null; registrationReminderId: string | null },
    now: Date,
  ): Promise<string[]> {
    return [
      ...(await this.#dropReminder(tx, offer.reminderId, 'offer-closed', now)),
      ...(await this.#dropReminder(tx, offer.registrationReminderId, 'offer-closed', now)),
    ];
  }

  /**
   * One of an offer's reminders (reply-by or registration day), if still waiting, is dropped with
   * `reason`. Its job comes back for the caller to cancel; a job that runs anyway finds it no
   * longer waiting. The audit row names the template, never the learner's data.
   */
  async #dropReminder(
    tx: Tx,
    reminderId: string | null,
    reason: 'offer-closed' | 'replaced',
    now: Date,
  ): Promise<string[]> {
    if (!reminderId) return [];
    const dropped = await tx
      .update(reminders)
      .set({ status: 'dropped', outcomeReason: reason, updatedAt: now })
      .where(and(eq(reminders.id, reminderId), eq(reminders.status, 'scheduled')))
      .returning({ jobId: reminders.jobId, templateId: reminders.templateId });
    for (const r of dropped) await this.#audit(tx, 'reminder.cancelled', r.templateId);
    return dropped.flatMap((r) => (r.jobId ? [r.jobId] : []));
  }

  /**
   * The accepted offer `closingId` is being declined or deleted (A11-18 / A1-28): unless another
   * offer is still accepted, the waiting safety pushes ("before you arrive", "looking for a
   * room?") are about a place the learner no longer has, so they are dropped as `offer-closed`.
   * Their jobs come back for the caller to cancel.
   */
  async #dropSafetyReminders(tx: Tx, closingId: string, now: Date): Promise<string[]> {
    const [other] = await tx
      .select({ id: offers.id })
      .from(offers)
      .where(and(eq(offers.status, 'accepted'), ne(offers.id, closingId)));
    if (other) return [];
    const dropped = await tx
      .update(reminders)
      .set({ status: 'dropped', outcomeReason: 'offer-closed', updatedAt: now })
      .where(
        and(
          eq(reminders.status, 'scheduled'),
          inArray(reminders.templateId, [...SAFETY_TEMPLATE_IDS]),
        ),
      )
      .returning({ jobId: reminders.jobId, templateId: reminders.templateId });
    for (const r of dropped) await this.#audit(tx, 'reminder.cancelled', r.templateId);
    return dropped.flatMap((r) => (r.jobId ? [r.jobId] : []));
  }

  /**
   * Hard rule 5 for offer letters and proofs of registration (audit A11-13): the learner's
   * recorded consent must name them (guardian v3, adult-v2). Said here first, with a reason the
   * app can explain; migration 0021 refuses it in the database too.
   */
  async #assertCoversUniversityDocuments(tx: Tx): Promise<void> {
    const rows = rowsOf<{ ok: boolean }>(
      await tx.execute(
        sql`select uf_may_process_university_documents(${this.#studentId}::uuid) as ok`,
      ),
    );
    if (rows[0]?.ok !== true) throw new ConsentOutdatedError('university-documents');
  }

  // ── Registrations (Phase 5c) ────────────────────────────────────────────────────────────────

  /**
   * The learner's latest confirmed registration (the newest academic year), with its
   * change-deadline reminder's state, or null. Only what the learner confirmed is here: a proof's
   * extraction is never a registration until they check it row by row (hard rule 6).
   */
  async registration(): Promise<RegistrationRecord | null> {
    return this.#as(async (tx) => {
      const [row] = await tx
        .select({
          registration: registrations,
          reminderStatus: reminders.status,
          reminderAt: reminders.desiredAt,
        })
        .from(registrations)
        .leftJoin(reminders, eq(reminders.id, registrations.reminderId))
        .orderBy(desc(registrations.academicYear))
        .limit(1);
      if (!row) return null;
      const { registration: r, reminderStatus, reminderAt } = row;
      return {
        id: r.id,
        universityId: r.universityId,
        programmeId: r.programmeId,
        academicYear: r.academicYear,
        yearOfStudy: r.yearOfStudy,
        modules: r.modules,
        documentId: r.documentId,
        confirmedAt: r.confirmedAt,
        updatedAt: r.updatedAt,
        reminder:
          r.reminderId && reminderStatus && reminderAt
            ? { id: r.reminderId, status: reminderStatus, desiredAt: reminderAt }
            : null,
      };
    });
  }

  /**
   * Records a registration the learner confirmed: one per academic year, so confirming again
   * replaces that year's (the programme, the rows, the proof). The replaced registration's
   * waiting change-deadline reminder is dropped as `registration-changed` and its jobs come back
   * for the caller to cancel; the caller schedules a new one only if there is still something to
   * fix. A proof it came from is marked confirmed.
   */
  async saveRegistration(input: NewRegistration): Promise<RegistrationChange> {
    checkRegistration(input);
    const now = this.#clock();
    const modules = input.modules.map(({ code, name, term, credits }) => ({
      code,
      name,
      term,
      credits,
    }));
    return this.#as(
      async (tx) => {
        if (input.documentId) await this.#assertCoversUniversityDocuments(tx);
        const [existing] = await tx
          .select({ id: registrations.id, reminderId: registrations.reminderId })
          .from(registrations)
          .where(eq(registrations.academicYear, input.academicYear));
        const values = {
          universityId: input.universityId,
          programmeId: input.programmeId,
          yearOfStudy: input.yearOfStudy,
          modules,
          documentId: input.documentId ?? null,
          reminderId: null,
          confirmedAt: now,
          updatedAt: now,
        };
        let id: string;
        let jobIds: string[] = [];
        if (existing) {
          jobIds = await this.#dropRegistrationReminder(tx, existing.reminderId, now);
          await tx.update(registrations).set(values).where(eq(registrations.id, existing.id));
          id = existing.id;
        } else {
          const [row] = await tx
            .insert(registrations)
            .values({ studentId: this.#studentId, academicYear: input.academicYear, ...values })
            .returning({ id: registrations.id });
          if (!row) throw new Error('Could not save the registration');
          id = row.id;
        }
        if (input.documentId) {
          await tx
            .update(documents)
            .set({ status: 'confirmed' })
            .where(eq(documents.id, input.documentId));
        }
        await this.#audit(tx, 'registration.confirmed', input.documentId ? 'proof' : 'learner');
        return { id, jobIds };
      },
      true,
      (tx) => this.#lockRegistrations(tx),
    );
  }

  /** Records the change-deadline reminder now waiting for a registration. */
  async setRegistrationReminder(registrationId: string, reminderId: string): Promise<void> {
    await this.#as(async (tx) => {
      const [row] = await tx
        .update(registrations)
        .set({ reminderId, updatedAt: this.#clock() })
        .where(eq(registrations.id, registrationId))
        .returning({ id: registrations.id });
      if (!row) throw new NotFoundError('No such registration');
      await this.#audit(tx, 'registration.reminder-set');
    });
  }

  /** Deletes a registration; its waiting reminder is dropped with it. */
  async deleteRegistration(id: string): Promise<RegistrationChange> {
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        const [row] = await tx.select().from(registrations).where(eq(registrations.id, id));
        if (!row) throw new NotFoundError('No such registration');
        const jobIds = await this.#dropRegistrationReminder(tx, row.reminderId, now);
        await tx.delete(registrations).where(eq(registrations.id, id));
        await this.#audit(tx, 'registration.deleted');
        return { id, jobIds };
      },
      true,
      (tx) => this.#lockRegistrations(tx),
    );
  }

  /** One change to a learner's registrations at a time (two confirms can't both insert). */
  async #lockRegistrations(tx: Tx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`registrations:${this.#studentId}`}))`,
    );
  }

  /** A registration's change-deadline reminder, if still waiting, is dropped. */
  async #dropRegistrationReminder(tx: Tx, reminderId: string | null, now: Date): Promise<string[]> {
    if (!reminderId) return [];
    const dropped = await tx
      .update(reminders)
      .set({ status: 'dropped', outcomeReason: 'registration-changed', updatedAt: now })
      .where(and(eq(reminders.id, reminderId), eq(reminders.status, 'scheduled')))
      .returning({ jobId: reminders.jobId, templateId: reminders.templateId });
    for (const r of dropped) await this.#audit(tx, 'reminder.cancelled', r.templateId);
    return dropped.flatMap((r) => (r.jobId ? [r.jobId] : []));
  }

  // ── Documents ──────────────────────────────────────────────────────────────────────────────

  async addDocument(input: {
    kind: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    return this.#as(async (tx) => {
      if (UNIVERSITY_DOCUMENT_KINDS.includes(input.kind)) {
        await this.#assertCoversUniversityDocuments(tx);
      }
      // A module outline needs the wording that names it (D9, migration 0040).
      if (input.kind === MODULE_OUTLINE_KIND) await assertOutlinesCovered(tx, this.#studentId);
      const [row] = await tx
        .insert(documents)
        .values({ studentId: this.#studentId, ...input })
        .returning();
      await this.#audit(tx, 'document.uploaded', input.kind);
      return row;
    });
  }

  async document(id: string) {
    return this.#as(async (tx) => {
      const [row] = await tx.select().from(documents).where(eq(documents.id, id));
      if (!row) throw new NotFoundError('No such document');
      return row;
    });
  }

  async documents() {
    return this.#as((tx) => tx.select().from(documents).orderBy(desc(documents.createdAt)));
  }

  async setExtraction(id: string, extraction: unknown, status: DocumentStatus) {
    return this.#as(async (tx) => {
      const [row] = await tx
        .update(documents)
        .set({ extraction, status })
        .where(eq(documents.id, id))
        .returning();
      if (!row) throw new NotFoundError('No such document');
      return row;
    });
  }

  /** Deletes a document record and returns its storage key, so the caller removes the file. */
  async deleteDocument(id: string): Promise<string> {
    return this.#as(async (tx) => {
      const [row] = await tx.delete(documents).where(eq(documents.id, id)).returning();
      if (!row) throw new NotFoundError('No such document');
      await this.#audit(tx, 'document.deleted');
      return row.storageKey;
    });
  }

  // ── Module outlines (Phase 6b, migration 0040) ─────────────────────────────────────────────

  /** What an outline call needs from this learner's transaction (module-outlines.ts). */
  #outline(tx: Tx): OutlineContext {
    return {
      tx,
      studentId: this.#studentId,
      now: this.#clock(),
      audit: (action, reason) => this.#audit(tx, action, reason),
    };
  }

  /** The learner's confirmed module outlines, by year and module. */
  async moduleOutlines(): Promise<ModuleOutlineRecord[]> {
    return this.#as((tx) => readModuleOutlines(tx));
  }

  /**
   * Records an outline the learner confirmed section by section (hard rule 6), replacing that
   * module's for that year. Read from an uploaded outline, the upload is deleted (D10) and its
   * storage key returned for the caller to delete the file.
   */
  async saveModuleOutline(
    input: ConfirmedModuleOutline,
  ): Promise<{ readonly id: string; readonly fileKey: string | null }> {
    return this.#as(
      (tx) => saveModuleOutline(this.#outline(tx), input),
      true,
      (tx) => this.#lockOutlines(tx),
    );
  }

  async deleteModuleOutline(id: string): Promise<void> {
    await this.#as((tx) => deleteModuleOutline(this.#outline(tx), id));
  }

  /** One change to a learner's outlines at a time (two confirms can't both insert). */
  async #lockOutlines(tx: Tx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`module-outlines:${this.#studentId}`}))`,
    );
  }

  // ── Module marks (Phase 6c, migration 0041) ────────────────────────────────────────────────

  /** The learner's own marks and target for one module and year (the mark calculator's). */
  async moduleMarks(
    academicYear: number,
    moduleCode: string,
  ): Promise<{ marks: ModuleMark[]; target: number | null }> {
    return this.#as((tx) => readModuleMarks(tx, academicYear, moduleCode));
  }

  /**
   * Replaces the learner's marks and target for one module and year with the ones they typed
   * (hard rule 6). A mark outside 0–100 is refused (`InvalidStateError`), never repaired.
   */
  async saveModuleMarks(sheet: ModuleMarkSheet): Promise<void> {
    await this.#as(
      (tx) =>
        saveModuleMarks(
          {
            tx,
            studentId: this.#studentId,
            now: this.#clock(),
            audit: (action, reason) => this.#audit(tx, action, reason),
          },
          sheet,
        ),
      true,
      (tx) => this.#lockModuleMarks(tx),
    );
  }

  /** One save of a learner's marks at a time (two saves can't interleave their rows). */
  async #lockModuleMarks(tx: Tx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`module-marks:${this.#studentId}`}))`,
    );
  }

  // ── Direct uploads (open finding 3) ────────────────────────────────────────────────────────

  /** Records that this student may upload one file of `mimeType` to `storageKey` until then. */
  async createUploadIntent(input: {
    storageKey: string;
    mimeType: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.#as(async (tx) => {
      const [row] = await tx
        .insert(uploadIntents)
        .values({ studentId: this.#studentId, ...input })
        .returning({ id: uploadIntents.id });
      if (!row) throw new Error('Could not record the upload');
      return row;
    });
  }

  /**
   * Claims an upload intent, once: the caller then checks what arrived. A second claim, an
   * expired intent, or another student's intent is NotFound, so a ticket can't be completed
   * twice or by anyone else.
   */
  async claimUploadIntent(
    id: string,
    now = new Date(),
  ): Promise<{
    storageKey: string;
    mimeType: string;
  }> {
    return this.#as(async (tx) => {
      const [row] = await tx
        .update(uploadIntents)
        .set({ claimedAt: now })
        .where(
          and(
            eq(uploadIntents.id, id),
            isNull(uploadIntents.claimedAt),
            gt(uploadIntents.expiresAt, now),
          ),
        )
        .returning({ storageKey: uploadIntents.storageKey, mimeType: uploadIntents.mimeType });
      if (!row) throw new NotFoundError('No such upload');
      return row;
    });
  }

  // ── Conversations ──────────────────────────────────────────────────────────────────────────

  /** The student's conversation, created on first use. One running conversation per student. */
  async conversationId(): Promise<string> {
    return this.#as(async (tx) => {
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .orderBy(desc(conversations.createdAt))
        .limit(1);
      if (existing) return existing.id;
      const [created] = await tx
        .insert(conversations)
        .values({ studentId: this.#studentId })
        .returning({ id: conversations.id });
      if (!created) throw new Error('Could not start a conversation');
      return created.id;
    });
  }

  /**
   * `writtenBy`: who wrote an AI reply (A10-49, migration 0036), a provider name and a model id
   * only. Left out, it is not recorded (null). Never on the learner's own message.
   */
  async appendMessage(input: {
    conversationId: string;
    role: 'student' | 'assistant';
    content: string;
    artifacts?: unknown[];
    crisis?: boolean;
    writtenBy?: ReplyWriter | null;
  }) {
    const writer = input.writtenBy ? replyWriterColumns(input.writtenBy) : null;
    if (writer && input.role !== 'assistant') {
      throw new InvalidStateError('Only a reply has a writer');
    }
    return this.#as(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          studentId: this.#studentId,
          role: input.role,
          content: input.content,
          artifacts: input.artifacts ?? [],
          crisis: input.crisis ?? false,
          ...(writer ?? {}),
        })
        .returning();
      return row;
    });
  }

  /** The last `limit` messages, oldest first. */
  async history(conversationId: string, limit = 40) {
    return this.#as(async (tx) => {
      const rows = await tx
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      return rows.reverse();
    });
  }

  // ── Memory the student can see and edit (§4.5) ─────────────────────────────────────────────

  async memory() {
    return this.#as((tx) => tx.select().from(memoryNotes).orderBy(asc(memoryNotes.createdAt)));
  }

  async remember(kind: MemoryKind, body: string) {
    return this.#as(async (tx) => {
      const [row] = await tx
        .insert(memoryNotes)
        .values({ studentId: this.#studentId, kind, body: body.trim() })
        .returning();
      return row;
    });
  }

  async forget(id: string) {
    return this.#as(async (tx) => {
      const [row] = await tx.delete(memoryNotes).where(eq(memoryNotes.id, id)).returning();
      if (!row) throw new NotFoundError('No such note');
      await this.#audit(tx, 'memory.deleted');
    });
  }

  // ── Shortlist, applications and checklists (Stage 2) ───────────────────────────────────────

  async shortlist() {
    return this.#as((tx) => tx.select().from(shortlist).orderBy(asc(shortlist.rank)));
  }

  async addToShortlist(programmeId: string) {
    return this.#as(async (tx) => {
      const [top] = await tx.select({ rank: max(shortlist.rank) }).from(shortlist);
      await tx
        .insert(shortlist)
        .values({ studentId: this.#studentId, programmeId, rank: (top?.rank ?? 0) + 1 })
        .onConflictDoNothing();
    });
  }

  async removeFromShortlist(programmeId: string) {
    return this.#as(async (tx) => {
      await tx.delete(shortlist).where(eq(shortlist.programmeId, programmeId));
    });
  }

  async applications() {
    return this.#as((tx) => tx.select().from(applications).orderBy(asc(applications.universityId)));
  }

  async updateApplication(
    universityId: string,
    patch: { status?: ApplicationStatus; reference?: string | null; submittedOn?: string | null },
  ) {
    return this.#as(async (tx) => {
      const values = { ...patch, updatedAt: new Date() };
      const [row] = await tx
        .insert(applications)
        .values({ studentId: this.#studentId, universityId, ...values })
        .onConflictDoUpdate({
          target: [applications.studentId, applications.universityId],
          set: values,
        })
        .returning();
      await this.#audit(tx, 'application.updated', universityId);
      return row;
    });
  }

  async checklist(scope: string) {
    return this.#as((tx) =>
      tx.select().from(checklistItems).where(eq(checklistItems.scope, scope)),
    );
  }

  async setChecklistItem(scope: string, item: string, done: boolean) {
    return this.#as(async (tx) => {
      const doneAt = done ? new Date() : null;
      await tx
        .insert(checklistItems)
        .values({ studentId: this.#studentId, scope, item, doneAt })
        .onConflictDoUpdate({
          target: [checklistItems.studentId, checklistItems.scope, checklistItems.item],
          set: { doneAt },
        });
    });
  }

  // ── Reports of AI replies (A10-35, migration 0026) ─────────────────────────────────────────

  /**
   * The learner reports one of the AI's replies to them, for a person to look at: by its id, with
   * a reason from the fixed list, once (hard rule 4: no text of its own). Only their own replies
   * are reachable (row-level security), and nothing before consent (hard rule 5).
   */
  async reportReply(messageId: string, reason: ReplyReportReason): Promise<ReplyReportOutcome> {
    if (!isReplyReportReason(reason)) throw new InvalidStateError('Not a reason to report');
    return this.#as(async (tx) => {
      if (!isEntityId(messageId)) throw new NotFoundError('No such reply');
      const [message] = await tx
        .select({
          role: messages.role,
          replyProvider: messages.replyProvider,
          replyModel: messages.replyModel,
        })
        .from(messages)
        .where(eq(messages.id, messageId));
      if (!message) throw new NotFoundError('No such reply');
      if (message.role !== 'assistant') throw new InvalidStateError('Only a reply can be reported');
      // The report says which provider wrote the reply on its own (A10-49, migration 0036).
      const writtenBy: ReplyWriter | null = message.replyProvider
        ? { provider: message.replyProvider, model: message.replyModel }
        : null;
      const added = await tx
        .insert(replyReports)
        .values({
          studentId: this.#studentId,
          messageId,
          reason,
          replyProvider: message.replyProvider,
          replyModel: message.replyModel,
        })
        .onConflictDoNothing()
        .returning({ id: replyReports.id });
      if (added.length === 0) return { status: 'already-reported', writtenBy };
      await this.#audit(tx, 'reply.reported', reason);
      return { status: 'reported', writtenBy };
    });
  }

  /** The ids of the replies the learner has reported, so the chat can show them as reported. */
  async reportedReplies(): Promise<string[]> {
    return this.#as(async (tx) =>
      (
        await tx
          .select({ messageId: replyReports.messageId })
          .from(replyReports)
          .orderBy(asc(replyReports.createdAt))
      ).map((r) => r.messageId),
    );
  }

  // ── The first-week checklist (Phase 5b, migration 0019) ────────────────────────────────────

  /** The first-week steps the learner ticked for a university, with when, in no set order. */
  async firstWeekSteps(universityId: string): Promise<Array<{ step: string; doneAt: Date }>> {
    checkFirstWeekUniversity(universityId);
    return this.#as((tx) =>
      tx
        .select({ step: firstWeekSteps.step, doneAt: firstWeekSteps.doneAt })
        .from(firstWeekSteps)
        .where(eq(firstWeekSteps.universityId, universityId)),
    );
  }

  /**
   * Ticks (`true`) or unticks (`false`) one first-week step for a university. Only content's
   * steps and catalogue university ids (hard rule 4: ids only). Ticking a ticked step keeps its
   * first time. Consent-gated like all personal data (hard rule 5).
   */
  async setFirstWeekStep(universityId: string, step: string, done: boolean): Promise<void> {
    checkFirstWeekUniversity(universityId);
    if (!isFirstWeekStep(step)) throw new InvalidStateError('Not a first-week step');
    const now = this.#clock();
    await this.#as(async (tx) => {
      const changed = done
        ? await tx
            .insert(firstWeekSteps)
            .values({ studentId: this.#studentId, universityId, step, doneAt: now })
            .onConflictDoNothing()
            .returning({ step: firstWeekSteps.step })
        : await tx
            .delete(firstWeekSteps)
            .where(
              and(eq(firstWeekSteps.universityId, universityId), eq(firstWeekSteps.step, step)),
            )
            .returning({ step: firstWeekSteps.step });
      if (changed.length > 0) {
        await this.#audit(tx, done ? 'first-week.ticked' : 'first-week.unticked', step);
      }
    });
  }

  // ── Goal and exams (Phase 4b) ──────────────────────────────────────────────────────────────

  /** The learner's target programme (a catalogue id), or null. */
  async goal(): Promise<Goal | null> {
    return this.#as(async (tx) => {
      const [row] = await tx.select().from(goals);
      return row
        ? { programmeId: row.programmeId, setAt: row.setAt, updatedAt: row.updatedAt }
        : null;
    });
  }

  /**
   * Sets (or changes) the learner's goal. A catalogue id only: whether the programme exists and
   * may be shown is the caller's check against the catalogue, and is checked again on every read.
   */
  async setGoal(programmeId: string): Promise<Goal> {
    if (!PROGRAMME_ID.test(programmeId)) throw new InvalidStateError('Not a programme id');
    const now = this.#clock();
    return this.#as(async (tx) => {
      const [row] = await tx
        .insert(goals)
        .values({ studentId: this.#studentId, programmeId, setAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: goals.studentId, set: { programmeId, updatedAt: now } })
        .returning();
      if (!row) throw new Error('Could not save the goal');
      await this.#audit(tx, 'goal.set');
      return { programmeId: row.programmeId, setAt: row.setAt, updatedAt: row.updatedAt };
    });
  }

  async clearGoal(): Promise<void> {
    await this.#as(async (tx) => {
      const rows = await tx.delete(goals).returning({ id: goals.studentId });
      if (rows.length > 0) await this.#audit(tx, 'goal.cleared');
    });
  }

  /** The learner's own changes to which subjects they write. */
  async examSubjectChoices(): Promise<ExamSubjectChoice[]> {
    return this.#as(async (tx) =>
      (
        await tx
          .select({ subject: examSubjectChoices.subject, included: examSubjectChoices.included })
          .from(examSubjectChoices)
          .orderBy(asc(examSubjectChoices.subject))
      ).flatMap((r) =>
        isSubjectId(r.subject) ? [{ subjectId: r.subject, included: r.included }] : [],
      ),
    );
  }

  /**
   * Adds (`true`) or removes (`false`) a subject from the ones the learner writes, or forgets the
   * change (`null`), so their report decides again.
   */
  async setExamSubjectChoice(subjectId: string, included: boolean | null): Promise<void> {
    if (!isSubjectId(subjectId)) throw new InvalidStateError('Not an NSC subject');
    const now = this.#clock();
    await this.#as(async (tx) => {
      if (included === null) {
        await tx.delete(examSubjectChoices).where(eq(examSubjectChoices.subject, subjectId));
      } else {
        await tx
          .insert(examSubjectChoices)
          .values({ studentId: this.#studentId, subject: subjectId, included, updatedAt: now })
          .onConflictDoUpdate({
            target: [examSubjectChoices.studentId, examSubjectChoices.subject],
            set: { included, updatedAt: now },
          });
      }
      await this.#audit(tx, 'exams.subjects-changed');
    });
  }

  // ── Messaging: per-channel opt-in, the weekly cap, reminders (planning.md §7) ──────────────

  /**
   * The learner's messaging choices: every channel (opted in or not, and when) and their cap.
   * Consent-gated like all personal data: for a minor, a guardian's consent covers it (§7.1).
   */
  async messagingPreferences(): Promise<MessagingPreferences> {
    return this.#as(async (tx) => {
      const rows = await tx.select().from(messagingChannels);
      const [prefs] = await tx.select().from(messagingPreferences);
      return {
        channels: MESSAGE_CHANNELS.map((channel) => {
          const row = rows.find((r) => r.channel === channel);
          return {
            channel,
            optedIn: row?.optedIn ?? false,
            optedInAt: row?.optedInAt ?? null,
            optedOutAt: row?.optedOutAt ?? null,
            optOutSource: row?.optOutSource ?? null,
          };
        }),
        maxPerWeek: prefs?.maxPerWeek ?? DEFAULT_WEEKLY_CAP,
      };
    });
  }

  /**
   * Opts in to, or out of, one channel, with a time stamp and an audit row.
   *
   * For a minor, the guardian's consent covers messaging (§7.1) only if the wording they agreed
   * to named it: version `MESSAGING_CONSENT_VERSION` or later (audit A11-01). An older consent
   * refuses every opt-in with `ConsentOutdatedError`. Opting out is always allowed.
   */
  async setChannelOptIn(channel: MessagingChannel, optedIn: boolean): Promise<void> {
    if (!(MESSAGE_CHANNELS as readonly string[]).includes(channel)) {
      throw new InvalidStateError('Not a channel');
    }
    const now = this.#clock();
    const coveredByConsent = optedIn
      ? async (tx: Tx) => {
          // The store-review account is never messaged by SMS or WhatsApp (A7-01); the database
          // refuses it too (migration 0010). Said here first, so the learner gets a clear refusal.
          if (channel !== 'push' && (await this.#isReview(tx))) {
            throw new InvalidStateError('The review account can only turn on push notifications');
          }
          await this.#assertConsentCoversMessaging(tx);
        }
      : undefined;
    await this.#as(
      async (tx) => {
        const change = optedIn
          ? { optedIn: true, optedInAt: now, updatedAt: now }
          : { optedIn: false, optedOutAt: now, optOutSource: 'app' as const, updatedAt: now };
        await tx
          .insert(messagingChannels)
          .values({ studentId: this.#studentId, channel, ...change })
          .onConflictDoUpdate({
            target: [messagingChannels.studentId, messagingChannels.channel],
            set: change,
          });
        // Off is off on every phone: the tokens go too (data minimisation). A phone that turns
        // notifications on again registers its token again.
        if (!optedIn && channel === 'push') await tx.delete(pushTokens);
        await this.#audit(tx, optedIn ? 'messaging.opted-in' : 'messaging.opted-out', channel);
      },
      true,
      coveredByConsent,
    );
  }

  /** Whether this is the synthetic store-review account (A7-01): it is offered push only. */
  async isReviewAccount(): Promise<boolean> {
    return this.#as((tx) => this.#isReview(tx), false);
  }

  async #isReview(tx: Tx): Promise<boolean> {
    const rows = rowsOf<{ review: boolean }>(
      await tx.execute(sql`select uf_is_review(${this.#studentId}::uuid) as review`),
    );
    return rows[0]?.review === true;
  }

  /**
   * As the owner: a learner whose consent came from a guardian may be messaged only under a
   * granted, not withdrawn, consent at `MESSAGING_CONSENT_VERSION` or later. An adult's own
   * consent (`not-required`) covers it; any other status is left to the consent gate.
   */
  async #assertConsentCoversMessaging(tx: Tx): Promise<void> {
    const [student] = await tx
      .select({ consentStatus: students.consentStatus })
      .from(students)
      .where(eq(students.id, this.#studentId));
    if (student?.consentStatus !== 'granted') return;
    const [consent] = await tx
      .select({ version: guardianConsents.consentVersion })
      .from(guardianConsents)
      .where(
        and(
          eq(guardianConsents.studentId, this.#studentId),
          isNotNull(guardianConsents.grantedAt),
          isNull(guardianConsents.withdrawnAt),
        ),
      )
      .orderBy(desc(guardianConsents.grantedAt))
      .limit(1);
    const version = consent ? consentVersionNumber(consent.version) : null;
    if (version === null || version < MESSAGING_CONSENT_VERSION) throw new ConsentOutdatedError();
  }

  // ── Push tokens: the app on each phone (Phase 4d, migration 0008) ─────────────────────────

  /**
   * Records this phone's Expo push token against the learner and the session that sent it, so
   * signing out removes it. A token belongs to one learner. If another learner holds it and is
   * still signed in on it, it stays theirs (`PushTokenHeldError`, A5-05): nothing proves this
   * phone made it, and a token learned some other way must not take their reminders. If their
   * session is over (they signed in on this phone before, and left), it moves here, and they no
   * longer get notifications on a phone they've left; signing out deletes it anyway.
   * Consent-gated (hard rule 5): nothing is written for a minor without it.
   *
   * Bounded (A5-04): one token per session, so a new token on the same session replaces the old
   * one, and at most `MAX_PUSH_DEVICES` per learner, the least recently registered evicted.
   */
  async registerPushToken(input: {
    readonly token: string;
    readonly platform: PushPlatform;
    /** The bearer token of the request: the session the push token hangs off. */
    readonly sessionToken: string;
  }): Promise<void> {
    if (!EXPO_PUSH_TOKEN.test(input.token)) throw new InvalidStateError('Not a push token');
    if (input.platform !== 'ios' && input.platform !== 'android') {
      throw new InvalidStateError('Not a platform');
    }
    const now = this.#clock();
    await this.#db.transaction(async (tx) => {
      // As the owner first: the session (read by its hash, never stored in the clear) and any
      // other learner holding this token, whom row-level security would hide.
      const [session] = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, hashToken(input.sessionToken)),
            eq(sessions.studentId, this.#studentId),
            gt(sessions.expiresAt, now),
          ),
        );
      if (!session) throw new NotFoundError('No such session');
      await scopeToLearner(tx, this.#studentId, now);
      if (!(await this.#mayProcessIn(tx))) throw new ConsentRequiredError();
      // Held by another learner whose session is still live (A5-05): nothing proves this phone
      // made the token, so it stays theirs. Locked, so a sign-in racing this can't slip between.
      const [held] = await tx
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .innerJoin(sessions, eq(sessions.id, pushTokens.sessionId))
        .where(
          and(
            eq(pushTokens.token, input.token),
            ne(pushTokens.studentId, this.#studentId),
            gt(sessions.expiresAt, now),
          ),
        )
        .for('update');
      if (held) throw new PushTokenHeldError();
      const moved = await tx
        .delete(pushTokens)
        .where(
          and(
            eq(pushTokens.token, input.token),
            sql`${pushTokens.studentId} <> ${this.#studentId}::uuid`,
          ),
        )
        .returning({ studentId: pushTokens.studentId });
      for (const previous of moved) {
        await tx.insert(auditLog).values({
          actorType: 'system',
          studentId: previous.studentId,
          action: 'push.token-moved',
        });
      }
      // Then as the learner: row-level security and the consent gate decide the write.
      await tx.execute(sql`set local role uf_app`);
      // One token per session (A5-04): a session is one phone, so a new token from it replaces
      // the old one (a unique index holds the database to it).
      await tx
        .delete(pushTokens)
        .where(and(eq(pushTokens.sessionId, session.id), ne(pushTokens.token, input.token)));
      await tx
        .insert(pushTokens)
        .values({
          token: input.token,
          studentId: this.#studentId,
          sessionId: session.id,
          platform: input.platform,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: pushTokens.token,
          set: { sessionId: session.id, platform: input.platform, updatedAt: now },
        });
      // At most `MAX_PUSH_DEVICES` phones per learner (A5-04): beyond that, the ones registered
      // longest ago go. Never the one registering now.
      const evicted = rowsOf<{ token: string }>(
        await tx.execute(sql`
          delete from push_tokens where token in (
            select token from push_tokens
            where student_id = ${this.#studentId}::uuid and token <> ${input.token}
            order by updated_at desc, created_at desc, token desc
            offset ${MAX_PUSH_DEVICES - 1})
          returning token`),
      );
      for (const _ of evicted) await this.#audit(tx, 'push.token-evicted');
      await this.#audit(tx, 'push.token-registered', input.platform);
    });
  }

  /**
   * Takes a phone's token off the account (sign-out, or notifications turned off on that phone).
   * Allowed with or without consent: removing data is always allowed. True if it was there.
   */
  async removePushToken(token: string): Promise<boolean> {
    if (typeof token !== 'string' || !EXPO_PUSH_TOKEN.test(token)) return false;
    // As the owner, filtered to this learner: it must work after a guardian withdrew consent.
    return this.#db.transaction(async (tx) => {
      const removed = await tx
        .delete(pushTokens)
        .where(and(eq(pushTokens.token, token), eq(pushTokens.studentId, this.#studentId)))
        .returning({ token: pushTokens.token });
      if (removed.length === 0) return false;
      await tx.insert(auditLog).values({
        actorType: 'student',
        actorId: this.#studentId,
        studentId: this.#studentId,
        action: 'push.token-removed',
      });
      return true;
    });
  }

  /** How many phones have notifications on for this learner (no tokens leave this method). */
  async pushDeviceCount(): Promise<number> {
    return this.#as(
      async (tx) => (await tx.select({ t: pushTokens.token }).from(pushTokens)).length,
    );
  }

  /** The learner's own cap: messages we start in any seven days, 1 to 7. */
  async setMessagesPerWeek(maxPerWeek: number): Promise<void> {
    if (!validWeeklyCap(maxPerWeek)) throw new InvalidStateError('A weekly cap is 1 to 7');
    const now = this.#clock();
    await this.#as(async (tx) => {
      await tx
        .insert(messagingPreferences)
        .values({ studentId: this.#studentId, maxPerWeek, updatedAt: now })
        .onConflictDoUpdate({
          target: messagingPreferences.studentId,
          set: { maxPerWeek, updatedAt: now },
        });
      await this.#audit(tx, 'messaging.cap-set');
    });
  }

  /**
   * Records a reminder to send from a template at a time, on a channel. Returns its id; the
   * caller puts its job on the schedule (`scheduleReminderJob`) and records it on the reminder.
   * Nothing is checked about opt-in or cadence here: that happens when it is due.
   */
  async createReminder(input: NewReminder): Promise<string> {
    checkReminder(input);
    const now = this.#clock();
    return this.#as((tx) => this.#insertReminder(tx, input, now));
  }

  /**
   * Records a reminder that takes the place of this learner's waiting one from the same template
   * (audit A1-12): a newer re-check replaces the `recheck.changed` still waiting, rather than
   * adding another reminder and job each time a report is confirmed. The waiting one is dropped
   * as `replaced`; its job comes back for the caller to cancel (a job that runs anyway finds its
   * reminder no longer waiting, and sends nothing). One reminder already sending or sent is left
   * alone: the new one is a new message. For `recheck.changed` a unique index holds the database
   * to one waiting (migration 0016); a lock per learner keeps parallel calls from meeting it.
   */
  async replaceWaitingReminder(
    input: NewReminder,
  ): Promise<{ id: string; replacedJobIds: string[] }> {
    checkReminder(input);
    const now = this.#clock();
    return this.#as(
      async (tx) => {
        const replaced = await tx
          .update(reminders)
          .set({ status: 'dropped', outcomeReason: 'replaced', updatedAt: now })
          .where(
            and(
              eq(reminders.studentId, this.#studentId),
              eq(reminders.templateId, input.templateId),
              eq(reminders.status, 'scheduled'),
            ),
          )
          .returning({ jobId: reminders.jobId });
        for (const _ of replaced) await this.#audit(tx, 'reminder.replaced', input.templateId);
        const id = await this.#insertReminder(tx, input, now);
        return { id, replacedJobIds: replaced.flatMap((r) => (r.jobId ? [r.jobId] : [])) };
      },
      true,
      async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`reminder-replace:${this.#studentId}`}))`,
        );
      },
    );
  }

  async #insertReminder(tx: Tx, input: NewReminder, now: Date): Promise<string> {
    const [row] = await tx
      .insert(reminders)
      .values({
        studentId: this.#studentId,
        templateId: input.templateId,
        channel: input.channel,
        params: { ...(input.params ?? {}) },
        desiredAt: input.desiredAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: reminders.id });
    if (!row) throw new Error('Could not save the reminder');
    await this.#audit(tx, 'reminder.created', input.templateId);
    return row.id;
  }

  /** The learner's reminders, newest first. */
  async reminders(limit = 50): Promise<ReminderView[]> {
    return this.#as((tx) =>
      tx
        .select({
          id: reminders.id,
          templateId: reminders.templateId,
          channel: reminders.channel,
          desiredAt: reminders.desiredAt,
          status: reminders.status,
          outcomeReason: reminders.outcomeReason,
          sentAt: reminders.sentAt,
        })
        .from(reminders)
        .orderBy(desc(reminders.createdAt))
        .limit(limit),
    );
  }

  /** Records which job carries a new reminder. */
  async setReminderJob(reminderId: string, jobId: string): Promise<void> {
    await this.#as(async (tx) => {
      await tx
        .update(reminders)
        .set({ jobId, updatedAt: this.#clock() })
        .where(eq(reminders.id, reminderId));
    });
  }

  /**
   * The scheduled jobs that still carry this learner's reminders, so account deletion can
   * cancel them in a hosted scheduler too: a waiting reminder's send, and a sent push reminder's
   * receipt check while its delivery is unknown (A11-11). Read as the owner, filtered to this
   * student: it must work after a guardian has withdrawn consent.
   */
  async scheduledJobIds(): Promise<string[]> {
    const rows = await this.#db
      .select({ jobId: reminders.jobId })
      .from(reminders)
      .where(
        and(
          eq(reminders.studentId, this.#studentId),
          or(
            inArray(reminders.status, ['scheduled', 'sending']),
            and(
              eq(reminders.status, 'sent'),
              eq(reminders.channel, 'push'),
              eq(reminders.deliveryStatus, 'accepted'),
            ),
          ),
        ),
      );
    return rows.flatMap((r) => (r.jobId ? [r.jobId] : []));
  }

  // ── My plan maps (migration 0030, docs/design/plan-maps-proposal.md) ───────────────────────

  /** What a plan-map call needs from this learner's transaction (plan-maps.ts). */
  #plan(tx: Tx): PlanContext {
    return {
      tx,
      studentId: this.#studentId,
      now: this.#clock(),
      audit: (action, reason) => this.#audit(tx, action, reason),
    };
  }

  /** The learner's maps, oldest first, each with its parts. */
  async planMaps(): Promise<PlanMapRecord[]> {
    return this.#as((tx) => readPlanMaps(tx));
  }

  /** One of the learner's maps, or null: another learner's map is simply not there. */
  async planMap(id: string): Promise<PlanMapRecord | null> {
    return this.#as((tx) => readPlanMap(tx, id));
  }

  /** A new map from a template's parts (`packages/ui` templateSeed): no words, all Planned. */
  async createPlanMap(input: {
    readonly templateId: string;
    readonly linksGoal: boolean;
    readonly parts: ReadonlyArray<PlanPartInput>;
  }): Promise<PlanMapRecord> {
    return this.#as((tx) => createPlanMap(this.#plan(tx), input));
  }

  /** The title (the learner's words: `words` is the owner's switch, D2) and the goal link. */
  async updatePlanMap(
    id: string,
    patch: { readonly title?: string | null | undefined; readonly linksGoal?: boolean | undefined },
    options: PlanWords,
  ): Promise<PlanMapRecord> {
    return this.#as((tx) => updatePlanMap(this.#plan(tx), id, patch, options));
  }

  async deletePlanMap(id: string): Promise<void> {
    await this.#as((tx) => deletePlanMap(this.#plan(tx), id));
  }

  /** A part, last under its parent: a template stop put back, or the learner's own. */
  async addPlanNode(
    mapId: string,
    input: NewPlanNode,
    options: PlanWords,
  ): Promise<PlanNodeRecord> {
    return this.#as((tx) => addPlanNode(this.#plan(tx), mapId, input, options));
  }

  /** A part's words, status and target. Words need the owner's switch (D2); the rest never does. */
  async savePlanNode(
    mapId: string,
    nodeId: string,
    patch: PlanNodePatch,
    options: PlanWords,
  ): Promise<PlanNodeRecord> {
    return this.#as((tx) => savePlanNode(this.#plan(tx), mapId, nodeId, patch, options));
  }

  async movePlanNode(
    mapId: string,
    nodeId: string,
    to: { readonly parentId: string; readonly position: number },
  ): Promise<void> {
    await this.#as((tx) => movePlanNode(this.#plan(tx), mapId, nodeId, to));
  }

  async deletePlanNode(mapId: string, nodeId: string): Promise<void> {
    await this.#as((tx) => deletePlanNode(this.#plan(tx), mapId, nodeId));
  }

  // ── My CV (migration 0035, docs/design/mmereko-api-proposal.md) ──────────────────────────────

  /** What a CV call needs from this learner's transaction (cv.ts). */
  #cv(tx: Tx): CvContext {
    return {
      tx,
      studentId: this.#studentId,
      now: this.#clock(),
      audit: (action, reason) => this.#audit(tx, action, reason),
    };
  }

  /** The learner's live CV opt-in, or null. */
  async cvLink(): Promise<CvLinkRecord | null> {
    return this.#as((tx) => readCvLink(tx));
  }

  /**
   * Whether the learner's wording names Mmereko now (or the preview stands in for it), whether
   * they opted in, and whether they may share (an adult in their own name, under adult-v3).
   */
  async cvState(access: CvAccess): Promise<{
    readonly wordingCovers: boolean;
    readonly link: CvLinkRecord | null;
    readonly mayShare: boolean;
  }> {
    return this.#as(async (tx) => {
      if (access.preview) await tx.execute(sql`select set_config('uf.cv', 'preview', true)`);
      const [row] = rowsOf<{ covers: boolean; share: boolean }>(
        await tx.execute(
          sql`select uf_cv_allowed(${this.#studentId}::uuid, null::text) as covers,
                     uf_cv_may_share(${this.#studentId}::uuid) as share`,
        ),
      );
      return {
        wordingCovers: row?.covers === true,
        link: await readCvLink(tx),
        mayShare: row?.share === true,
      };
    });
  }

  /** The learner's own CV opt-in (§9.1 item 3), or a change to its purposes. */
  async cvOptIn(
    input: { readonly version: string; readonly purposes: ReadonlyArray<CvPurpose> },
    access: CvAccess,
  ): Promise<CvLinkRecord> {
    return this.#as((tx) => optInToCv(this.#cv(tx), input, access));
  }

  /**
   * "Stop using Mmereko" (D15): links off, a tombstone for Mmereko's deletion, UniversityFlow's own
   * CV data deleted. Works with or without consent: a learner can always take their data back.
   */
  async cvWithdraw(): Promise<{ readonly fileKeys: string[]; readonly deletionIds: string[] }> {
    return withdrawCv(this.#db, this.#studentId, this.#clock());
  }

  async cvEntries(): Promise<CvEntryRecord[]> {
    return this.#as((tx) => readCvEntries(tx));
  }

  async addCvEntry(input: CvEntryInput, access: CvAccess): Promise<CvEntryRecord> {
    return this.#as((tx) => addCvEntry(this.#cv(tx), input, access));
  }

  async updateCvEntry(id: string, patch: CvEntryPatch, access: CvAccess): Promise<CvEntryRecord> {
    return this.#as((tx) => updateCvEntry(this.#cv(tx), id, patch, access));
  }

  async deleteCvEntry(id: string): Promise<void> {
    await this.#as((tx) => deleteCvEntry(this.#cv(tx), id));
  }

  async cvSelection(): Promise<CvSelection> {
    return this.#as((tx) => readCvSelection(tx));
  }

  async saveCvSelection(selection: CvSelection, access: CvAccess): Promise<CvSelection> {
    return this.#as((tx) => saveCvSelection(this.#cv(tx), selection, access));
  }

  async cvDocuments(): Promise<CvDocumentRecord[]> {
    return this.#as((tx) => readCvDocuments(tx));
  }

  async cvDocument(id: string): Promise<CvDocumentRecord | null> {
    return this.#as((tx) => readCvDocument(tx, id));
  }

  /** A ready CV's file key, for the server alone. */
  async cvFile(
    id: string,
  ): Promise<{ readonly fileKey: string; readonly sha256: string | null } | null> {
    return this.#as((tx) => readCvFile(tx, id));
  }

  /** Queues a base or tailored CV: one at a time. The caller schedules `cv.submit` with its id. */
  async requestCvDocument(input: CvRequest, access: CvAccess): Promise<CvDocumentRecord> {
    return this.#as((tx) => requestCvDocument(this.#cv(tx), input, access));
  }

  async confirmCvDocument(id: string, access: CvAccess): Promise<CvDocumentRecord> {
    return this.#as((tx) => confirmCvDocument(this.#cv(tx), id, access));
  }

  /** What `cv.submit` sends, read under consent when the job runs; null when nothing waits. */
  async cvSubmission(id: string, access: CvAccess): Promise<CvSubmission | null> {
    return this.#as((tx) => readCvSubmission(this.#cv(tx), id, access));
  }

  /** The consent half of an engine envelope for `purpose` (an ATS scan, made in the request). */
  async cvConsent(purpose: CvPurpose, access: CvAccess): Promise<CvConsentRecord> {
    return this.#as((tx) => readCvConsent(this.#cv(tx), purpose, access));
  }

  async markCvSubmitted(id: string, engineJobId: string, access: CvAccess): Promise<void> {
    await this.#as((tx) => markCvSubmitted(this.#cv(tx), id, engineJobId, access));
  }

  /** Keeps a finished CV; false when it was already kept (collect is idempotent). */
  async storeCvResult(id: string, result: CvResult, access: CvAccess): Promise<boolean> {
    return this.#as((tx) => storeCvResult(this.#cv(tx), id, result, access));
  }

  async cvShares(): Promise<CvShareRecord[]> {
    return this.#as((tx) => readCvShares(tx));
  }

  /** A recruiter link (18+, adult-v3, a checked CV). The token is returned once, never kept. */
  async createCvShare(
    documentId: string,
    days: number,
    access: CvAccess,
  ): Promise<{ readonly share: CvShareRecord; readonly token: string }> {
    return this.#as((tx) => createCvShare(this.#cv(tx), documentId, days, access));
  }

  async revokeCvShare(id: string): Promise<void> {
    await this.#as((tx) => revokeCvShare(this.#cv(tx), id));
  }
  /** "Report this CV" (A10-58): a fitted CV, by id and a reason from the fixed list, once. */
  async reportCvDocument(id: string, reason: CvReportReason): Promise<CvReportOutcome> {
    return this.#as((tx) => reportCvDocument(this.#cv(tx), id, reason));
  }

  /** The ids of the CVs the learner has reported. */
  async reportedCvDocuments(): Promise<string[]> {
    return this.#as((tx) => readReportedCvDocuments(tx));
  }

  /**
   * Deletes one CV (A11-38, D13), with or without consent: a learner can always take their data
   * back. Returns the PDF's key for the caller to delete the file.
   */
  async deleteCvDocument(id: string): Promise<{ readonly fileKey: string | null }> {
    return deleteCvDocument(this.#db, this.#studentId, id);
  }

  // ── The student's rights: see, export and delete (§8.1) ────────────────────────────────────

  /**
   * Everything held about the student, as plain data ("What does UniversityFlow know about me?").
   * Works with or without consent, so a learner can always see and take their data.
   *
   * The account part carries the learner's opt-outs (`messagingOptOuts`) whether or not their
   * data may be processed (A11-08). A STOP is recorded even before a guardian consents, because
   * an objection (POPIA s11(3)) is always honoured, and what is kept to honour it is theirs to
   * see (s23). Read as the owner, since row-level security hides it without consent.
   */
  async exportAll() {
    const readOptOuts = (tx: Tx) =>
      tx
        .select({
          channel: messagingChannels.channel,
          optedOutAt: messagingChannels.optedOutAt,
          optOutSource: messagingChannels.optOutSource,
          lastInboundAt: messagingChannels.lastInboundAt,
        })
        .from(messagingChannels)
        .where(
          and(
            eq(messagingChannels.studentId, this.#studentId),
            eq(messagingChannels.optedIn, false),
            isNotNull(messagingChannels.optedOutAt),
          ),
        )
        .orderBy(asc(messagingChannels.channel));
    let optOuts: Awaited<ReturnType<typeof readOptOuts>> = [];
    return this.#as(
      async (tx) => {
        const [row] = await tx
          .select({
            dateOfBirth: students.dateOfBirth,
            consentStatus: students.consentStatus,
            adultConsentVersion: students.adultConsentVersion,
            adultConsentedAt: students.adultConsentedAt,
            createdAt: students.createdAt,
          })
          .from(students);
        const account = row ? { ...row, messagingOptOuts: optOuts } : undefined;
        const mayProcess = await this.#mayProcessIn(tx);
        const personal = mayProcess
          ? {
              profile: this.#exportedProfile((await tx.select().from(profiles))[0]),
              reports: await tx.select().from(reports),
              marks: await tx.select().from(reportMarks),
              rechecks: await tx.select().from(rechecks).orderBy(asc(rechecks.createdAt)),
              offers: await tx.select().from(offers).orderBy(asc(offers.createdAt)),
              registrations: await tx
                .select()
                .from(registrations)
                .orderBy(asc(registrations.academicYear)),
              documents: (await tx.select().from(documents)).map(({ storageKey: _key, ...d }) => d),
              // Module outlines as confirmed (migration 0040), lecturers' work details included.
              moduleOutlines: await readModuleOutlines(tx),
              // The marks and targets the learner typed per module (migration 0041).
              moduleMarks: await exportModuleMarks(tx),
              messages: await tx.select().from(messages).orderBy(asc(messages.createdAt)),
              replyReports: await tx
                .select()
                .from(replyReports)
                .orderBy(asc(replyReports.createdAt)),
              memory: await tx.select().from(memoryNotes),
              shortlist: await tx.select().from(shortlist),
              applications: await tx.select().from(applications),
              checklists: await tx.select().from(checklistItems),
              firstWeek: await tx
                .select()
                .from(firstWeekSteps)
                .orderBy(asc(firstWeekSteps.universityId), asc(firstWeekSteps.doneAt)),
              goal: (await tx.select().from(goals))[0] ?? null,
              // My plan maps (migration 0030): each with its parts, the learner's words verbatim.
              planMaps: await exportPlanMaps(tx),
              // My CV (migration 0035): the opt-in, entries, ticks, CVs and links, as stored,
              // without the PDFs' keys or the links' token hashes.
              cv: await exportCv(tx),
              examSubjectChoices: await tx.select().from(examSubjectChoices),
              messaging: {
                channels: await tx.select().from(messagingChannels),
                preferences: (await tx.select().from(messagingPreferences))[0] ?? null,
                reminders: await tx.select().from(reminders).orderBy(asc(reminders.createdAt)),
                // The phones with notifications on. The session it hangs off is ours, not theirs.
                pushTokens: (
                  await tx.select().from(pushTokens).orderBy(asc(pushTokens.createdAt))
                ).map(({ sessionId: _session, ...t }) => t),
              },
            }
          : null;
        const history = await tx.select().from(auditLog).orderBy(asc(auditLog.at));
        await this.#audit(tx, 'data.exported');
        return { account, personal, accessHistory: history };
      },
      false,
      async (tx) => {
        optOuts = await readOptOuts(tx);
      },
    );
  }

  /**
   * Deletes the account and everything attached to it. Returns the storage keys of uploaded
   * files so the caller deletes those too. The audit trail keeps ids only.
   */
  async deleteAccount(): Promise<string[]> {
    // Read as the owner, filtered to this student: the keys must be found even when consent
    // has been withdrawn and row-level security hides the documents themselves.
    const docs = await this.#db
      .select({ key: documents.storageKey })
      .from(documents)
      .where(eq(documents.studentId, this.#studentId));
    // Direct uploads never completed may still have left a file behind.
    const unclaimed = await this.#db
      .select({ key: uploadIntents.storageKey })
      .from(uploadIntents)
      .where(and(eq(uploadIntents.studentId, this.#studentId), isNull(uploadIntents.claimedAt)));
    // The profile photo (0029), found the same way.
    const photo = await this.#db
      .select({ key: profiles.photoKey })
      .from(profiles)
      .where(and(eq(profiles.studentId, this.#studentId), isNotNull(profiles.photoKey)));
    // The CVs' PDFs (0035), found the same way.
    const cvs = await this.#db
      .select({ key: cvDocuments.fileKey })
      .from(cvDocuments)
      .where(and(eq(cvDocuments.studentId, this.#studentId), isNotNull(cvDocuments.fileKey)));
    await this.#db.transaction(async (tx) => {
      // My CV (§7.3): a tombstone per live Mmereko reference, so the deletion reaches the operator
      // after the student row is gone, and the CV jobs go with the account (ids in payloads).
      await tombstoneCv(tx, this.#studentId, this.#clock());
      await dropCvJobs(tx, this.#studentId);
      // The learner's scheduled jobs go with the account, in the same transaction (POPIA): the
      // queue is the owner's table, so this runs before dropping to the learner's role. A job
      // a runner already holds finds its reminder gone and sends nothing.
      await tx.execute(sql`
        delete from jobs
        where payload ->> 'studentId' = ${this.#studentId}
          or payload ->> 'reminderId' in (
            select id::text from reminders where student_id = ${this.#studentId}::uuid)`);
      await scopeToLearner(tx, this.#studentId, this.#clock());
      await tx.execute(sql`set local role uf_app`);
      await this.#audit(tx, 'account.deleted');
      // Reminders, channel opt-ins, preferences, push tokens, the goal, exam choices,
      // re-checks, offers, first-week steps and registrations cascade with the student.
      await tx.delete(students).where(eq(students.id, this.#studentId));
    });
    return [...docs, ...unclaimed, ...photo, ...cvs].flatMap((d) => (d.key ? [d.key] : []));
  }
}
