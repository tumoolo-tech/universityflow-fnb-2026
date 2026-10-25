/** Errors the data layer raises on purpose. The web layer maps each to a status and a message. */

export class RateLimitedError extends Error {
  override readonly name = 'RateLimitedError';
}

/**
 * A number with too many wrong PINs in a row (A5-09): no PIN is sent or accepted until a day
 * after the last wrong one. Its own error, so the learner is told so, not "wait a few minutes".
 */
export class PinLockedError extends Error {
  override readonly name = 'PinLockedError';
}

export class InvalidCodeError extends Error {
  override readonly name = 'InvalidCodeError';
}

/** Hard rule 5: a minor's personal data can't be touched before a guardian consents. */
export class ConsentRequiredError extends Error {
  override readonly name = 'ConsentRequiredError';
  constructor() {
    super('Guardian consent is required before this student’s data can be processed');
  }
}

/**
 * What a consent version may not cover: `messaging` (added in guardian consent v2, audit A11-01),
 * or `university-documents`, offer letters and proofs of registration and what is read from them
 * (added in guardian consent v3 and adult agreement adult-v2, audit A11-13).
 */
export type ConsentPurpose = 'messaging' | 'university-documents' | 'module-outlines';

const OUTDATED: Readonly<Record<ConsentPurpose, string>> = {
  messaging: 'The guardian’s consent was given to wording that does not cover messaging',
  'university-documents':
    'The consent was given to wording that does not cover offer letters and proofs of registration',
  'module-outlines': 'The consent was given to wording that does not cover module outlines',
};

/**
 * Audits A11-01 and A11-13: the learner's consent was given to wording that didn't cover this
 * purpose, so it can't be done until the current wording is agreed to.
 */
export class ConsentOutdatedError extends Error {
  override readonly name = 'ConsentOutdatedError';
  constructor(readonly purpose: ConsentPurpose = 'messaging') {
    super(OUTDATED[purpose]);
  }
}

/**
 * Audit A12-04: the guardian's number replied STOP to us, so we send it nothing, not even a
 * consent request. The learner is told so, and can name another guardian.
 */
export class GuardianOptedOutError extends Error {
  override readonly name = 'GuardianOptedOutError';
  constructor() {
    super('That number has asked us not to message it');
  }
}

export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}

export class InvalidStateError extends Error {
  override readonly name: string = 'InvalidStateError';
}

/**
 * Phase 5a: an offer change the learner's other offers rule out. `offer-exists`: they already
 * have an offer for that programme. `another-accepted`: one offer is accepted already, and a
 * learner holds at most one (decline that one first).
 */
export class OfferConflictError extends InvalidStateError {
  override readonly name = 'OfferConflictError';
  constructor(readonly reason: 'offer-exists' | 'another-accepted') {
    super(reason);
  }
}

/**
 * Audit A11-17: a quoted offer condition or a confirmed module row holds what looks like an ID
 * number or a student number. It is never stored; the learner takes it out and saves again.
 */
export class PersonalNumberError extends InvalidStateError {
  override readonly name = 'PersonalNumberError';
  readonly reason = 'personal-number';
  constructor() {
    super('An offer condition or a module holds an ID or student number');
  }
}

/**
 * Audit A5-05: the push token is registered to another learner who is still signed in on it.
 * Nothing proves this phone made it, so it doesn't move; it moves once their session is over
 * (signing out on a shared phone deletes the session and the token with it).
 */
/**
 * A date of birth under 13 (A11-24): the stores declare 13 and over, so sign-up refuses it, and
 * nothing is recorded. Its own reason, so the learner is told why.
 */
export class TooYoungError extends InvalidStateError {
  override readonly name = 'TooYoungError';
  readonly reason = 'too-young';
  constructor() {
    super('UniversityFlow is for learners aged 13 and over');
  }
}

/**
 * The judge demo's real sign-up is for adults only (the owner's approval of 2026-10-23,
 * docs/deploy/demo.md): a date of birth under 18 on a sign-up account is refused, recording
 * nothing. Its own reason, so the person is told why (and the web app deletes the account).
 */
export class AdultsOnlyError extends InvalidStateError {
  override readonly name = 'AdultsOnlyError';
  readonly reason = 'adults-only';
  constructor() {
    super('The demo sign-up is for adults only');
  }
}

export class PushTokenHeldError extends InvalidStateError {
  override readonly name = 'PushTokenHeldError';
  constructor() {
    super('That phone is registered to another learner who is still signed in');
  }
}

/**
 * My plan maps (migration 0030): a change that would break one of the limits (D8). The reason
 * says which, so the learner is told what to do.
 */
export class PlanMapLimitError extends InvalidStateError {
  override readonly name = 'PlanMapLimitError';
  constructor(
    readonly reason: 'too-many-maps' | 'too-many-nodes' | 'too-many-children' | 'too-deep',
  ) {
    super(reason);
  }
}

/**
 * My plan maps: the learner's own words wait for consent wording that names them (guardian v4,
 * adult-v3, owed legal review). Until then only the owner's preview switch lets them through
 * (D2); ticking, ordering and targets are never refused for this.
 */
export class PlanWordsError extends InvalidStateError {
  override readonly name = 'PlanWordsError';
  readonly reason = 'plan-words';
  constructor() {
    super('Writing in a plan map waits for consent wording that names it');
  }
}

/**
 * My CV (migration 0035): the learner's consent wording doesn't name Mmereko yet (guardian v4,
 * adult-v3; D8), or they haven't opted in to this purpose themselves. Nothing is written.
 */
export class CvConsentError extends Error {
  override readonly name = 'CvConsentError';
  readonly reason = 'cv-consent';
  constructor() {
    super('The learner’s consent does not cover this CV');
  }
}

/**
 * My CV: a recruiter link that isn't allowed (§9.3). `cv-share-age`: only an adult, in their own
 * name, under adult-v3, with an opt-in that names sharing. `cv-share-unchecked`: only a CV the
 * learner checked line by line ("Every line is true").
 */
export class CvShareError extends InvalidStateError {
  override readonly name = 'CvShareError';
  constructor(readonly reason: 'cv-share-age' | 'cv-share-unchecked') {
    super(reason);
  }
}

/**
 * My CV: a change the CV's state rules out. `cv-busy`: a CV is still being made (one at a time,
 * §11). `cv-limit`: at most 40 entries of a kind. `cv-opted-in`: there is an opt-in already.
 * `cv-not-ready`: only a finished CV can be checked or shared.
 */
export class CvStateError extends InvalidStateError {
  override readonly name: string = 'CvStateError';
  constructor(readonly reason: 'cv-busy' | 'cv-limit' | 'cv-opted-in' | 'cv-not-ready') {
    super(reason);
  }
}

/** One CV at a time: another is still being made (§11). */
export class CvBusyError extends CvStateError {
  override readonly name = 'CvBusyError';
  constructor() {
    super('cv-busy');
  }
}

/**
 * The profile photo (A11-31, migration 0037): the learner's consent wording doesn't name the photo
 * yet (guardian v4, adult-v3, owed legal review). Nothing is kept. Removing a photo is never refused.
 */
export class PhotoConsentError extends Error {
  override readonly name = 'PhotoConsentError';
  readonly reason = 'photo-consent';
  constructor() {
    super('The learner’s consent does not name the profile photo');
  }
}
