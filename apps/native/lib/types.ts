import type { Results, SchoolRecord, WhatINeedResult } from '@universityflow/admissions';
import type { ModuleTerm } from '@universityflow/catalogue/client';
import type {
  Artifact,
  CampusTourArtifact,
  ChatWelcome,
  ExamCountdownArtifact,
  FirstWeekArtifact,
  GoalCardArtifact,
  MyModulesArtifact,
  OfferCardArtifact,
  PracticeArtifact,
} from '@universityflow/ui';

/** The shapes the web app's API returns (apps/web/app/api). */

/** A university the learner may choose to look around (Phase 5b). */
export interface UniversityOption {
  readonly id: string;
  readonly name: string;
}

/** GET /api/campus (Phase 5b). */
export interface CampusResponse {
  readonly tour: CampusTourArtifact | null;
  readonly accepted: string | null;
  readonly options: ReadonlyArray<UniversityOption>;
}

/** GET/PUT /api/first-week (Phase 5b). */
export interface FirstWeekResponse {
  readonly checklist: FirstWeekArtifact | null;
  readonly accepted: string | null;
  readonly options: ReadonlyArray<UniversityOption>;
}

export type ConsentStatus = 'unknown' | 'not-required' | 'pending' | 'granted' | 'withdrawn';

export interface Account {
  readonly id: string;
  readonly phoneMasked: string;
  readonly dateOfBirth: string | null;
  readonly consentStatus: ConsentStatus;
  readonly needsAdultConsent: boolean;
}

export interface Profile {
  readonly displayName: string | null;
  /** The grade the learner is in today (G10-1); null until they give it. */
  readonly grade: number | null;
  /** Past matric: "Grade 12" no longer describes them (A10-38), so the card has no sticker. */
  readonly schoolFinished?: boolean;
  /** The About me card's look (migration 0028), resolved by the API: ids from fixed lists. */
  readonly theme?: string;
  readonly avatar?: string;
  readonly taglineId?: string | null;
  readonly badgeIds?: ReadonlyArray<string>;
}

/** GET /api/me */
export interface Me {
  readonly account: Account;
  readonly profile: Profile | null;
  readonly ready: boolean;
  /**
   * The profile photo (profile-look-proposal §5.3): null or absent when none is offered (the
   * server's switch is off, or before consent); otherwise its version, or null for none.
   */
  readonly photo?: { readonly version: string | null } | null;
}

/** GET /api/results */
export type ResultsResponse =
  | { readonly report: null; readonly results: null }
  | {
      readonly report: { readonly kind: string; readonly confirmedAt: string };
      readonly results: Results;
      readonly shortlist: ReadonlyArray<string>;
      /** Every report the learner confirmed, side by side (§18.7 C2). Absent from an older server. */
      readonly record?: SchoolRecord;
    };

/** GET/PUT/DELETE /api/me/goal */
export interface GoalResponse {
  readonly goalId: string | null;
  readonly card: GoalCardArtifact | null;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly universityName: string;
  }>;
}

/** GET/POST /api/offers, PATCH/DELETE /api/offers/:id (Phase 5a). */
export interface OffersResponse {
  readonly offers: ReadonlyArray<OfferCardArtifact>;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly universityName: string;
  }>;
  /** Whether a reply-by reminder can reach the learner on a channel they opted in to. */
  readonly remindersOn: boolean;
}

/** GET/PUT /api/registration, DELETE /api/registration/:id (Phase 5c, My modules). */
export interface RegistrationResponse {
  /** The check of the learner's confirmed registration, or null before they confirm one. */
  readonly modules: MyModulesArtifact | null;
  /** The course of the offer they accepted, chosen for them in the confirm form. */
  readonly acceptedProgrammeId: string | null;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly universityName: string;
  }>;
  /** Whether a change-deadline reminder can reach the learner on a channel they opted in to. */
  readonly remindersOn: boolean;
  /** The academic year the confirm form starts on. */
  readonly defaultYear: number;
}

/** The body of PUT /api/registration (packages/documents' confirmedRegistrationSchema). */
export interface ConfirmedRegistration {
  readonly programmeId: string;
  readonly academicYear: number;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<{
    readonly code: string;
    readonly name: string | null;
    readonly term: ModuleTerm | null;
    readonly credits: number | null;
  }>;
  readonly documentId: string | null;
}

/** What the reader found on a proof of registration (packages/documents' warnings, mirrored). */
export type RegistrationWarning =
  | 'not-a-proof'
  | 'partly-unreadable'
  | 'no-modules'
  | 'modules-cut'
  | 'term-unclear'
  | 'code-unclear';

/** A proof of registration as the server read it (packages/documents' RegistrationDraft). */
export interface RegistrationDraft {
  readonly programmeCode: string | null;
  readonly yearOfStudy: number | null;
  readonly modules: ReadonlyArray<{
    readonly code: string;
    readonly name: string | null;
    readonly term: ModuleTerm | null;
    readonly termAsPrinted: string | null;
    readonly credits: number | null;
  }>;
  readonly warnings: ReadonlyArray<RegistrationWarning>;
}

/** POST /api/documents (kind=proof-of-registration) and its direct-to-storage completion. */
export interface ProofUploadResult {
  readonly documentId: string;
  /** Null when the proof couldn't be read: the learner types their modules in instead. */
  readonly registration: RegistrationDraft | null;
  readonly sample: boolean;
}

/** What the reader found on an offer letter (packages/documents' LetterWarning, mirrored). */
export type LetterWarning =
  | 'not-a-letter'
  | 'partly-unreadable'
  | 'kind-unclear'
  | 'reply-by-unreadable'
  | 'conditions-cut';

/** An offer letter as the server read it (packages/documents' LetterDraft, mirrored). */
export interface LetterDraft {
  readonly universityAsPrinted: string | null;
  readonly programmeAsPrinted: string | null;
  /** Null when the letter didn't say plainly: the learner chooses. */
  readonly kind: OfferCardArtifact['offerKind'] | null;
  readonly conditions: ReadonlyArray<string>;
  /** YYYY-MM-DD, or null when none was printed or it couldn't be read as a date. */
  readonly replyBy: string | null;
  readonly warnings: ReadonlyArray<LetterWarning>;
}

/** POST /api/documents (kind=acceptance-letter) and its direct-to-storage completion. */
export interface LetterUploadResult {
  readonly documentId: string;
  /** Null when the letter couldn't be read: the learner adds the offer by hand instead. */
  readonly letter: LetterDraft | null;
  /** Courses matched from the letter: offered first, never chosen for the learner. */
  readonly candidates: ReadonlyArray<string>;
  readonly sample: boolean;
}

/** The body of POST /api/offers (apps/web/lib/server/offers.ts). */
export interface ConfirmedOffer {
  readonly programmeId: string;
  readonly kind: OfferCardArtifact['offerKind'];
  readonly replyBy: string | null;
  readonly conditions: ReadonlyArray<string>;
  readonly documentId?: string;
}

/** GET/PUT /api/me/exams */
export interface ExamsResponse {
  readonly countdown: ExamCountdownArtifact;
  readonly subjects: ReadonlyArray<{
    readonly subjectId: string;
    readonly name: string;
    readonly onReport: boolean;
    readonly writes: boolean;
    readonly changed: boolean;
  }>;
}

/** GET /api/me/practice: free practice for the subjects that matter (Phase 4e). */
export type PracticeResponse = PracticeArtifact;

/** GET /api/what-i-need/:programmeId */
export type WhatINeedResponse =
  | { readonly report: null; readonly result: null }
  | {
      readonly report: { readonly kind: string; readonly confirmedAt: string };
      readonly result: WhatINeedResult;
    };

export type Standing = 'qualify-now' | 'on-track' | 'close' | 'plan-b' | 'not-yet';

/** GET /api/rechecks: what changed with the learner's current report (Phase 4c). */
export interface RecheckResponse {
  readonly recheck: null | {
    readonly reportKind: string;
    readonly previousKind: string;
    readonly createdAt: string;
    readonly includesDrafts: boolean;
    readonly moves: ReadonlyArray<{
      readonly programmeId: string;
      readonly name: string;
      readonly universityName: string;
      readonly from: Standing;
      readonly to: Standing;
      readonly direction: 'up' | 'down';
    }>;
  };
}

/** GET/PUT /api/me/messaging (the parts the app reads). */
export interface MessagingResponse {
  readonly channels: ReadonlyArray<{
    readonly channel: 'sms' | 'whatsapp' | 'push';
    readonly optedIn: boolean;
  }>;
  readonly offeredChannels: ReadonlyArray<'sms' | 'whatsapp' | 'push'>;
}

/** A report row as the server read it (packages/documents' DraftRow, mirrored). */
export type DraftIssue = 'unknown-subject' | 'missing-percent' | 'out-of-range' | 'duplicate';
export type DraftWarning = 'not-a-report' | 'partly-unreadable' | 'not-grade-11' | 'few-subjects';

export interface ReportDraft {
  readonly rows: ReadonlyArray<{
    readonly nameAsPrinted: string;
    readonly subject: string | null;
    readonly percent: number | null;
    readonly issue: DraftIssue | null;
  }>;
  readonly warnings: ReadonlyArray<DraftWarning>;
  /** The report the document prints, when settled (A1-35); checked with `isReportKind`. */
  readonly printedKind?: string | null;
}

/** POST /api/documents and POST /api/documents/uploads/:id: the upload, read into a draft. */
export interface UploadResult {
  readonly documentId: string;
  /** Null when the report couldn't be read: the learner types their marks instead. */
  readonly draft: ReportDraft | null;
  readonly sample: boolean;
}

/** POST /api/documents/uploads: a ticket to post one file straight to storage. */
export interface UploadTicket {
  readonly uploadId: string;
  readonly url: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: 'student' | 'assistant';
  readonly content: string;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly crisis: boolean;
  /** The learner reported this reply (A10-35). */
  readonly reported?: boolean;
}

/** GET /api/chat */
export interface ChatHistory {
  readonly sample: boolean;
  readonly messages: ReadonlyArray<ChatMessage>;
  /** The empty chat's welcome for where the learner is (A2-66). Absent from an older server. */
  readonly welcome?: ChatWelcome;
}

/** One line of POST /api/chat's NDJSON stream. */
export type ChatEvent =
  | { readonly type: 'text'; readonly delta: string }
  | { readonly type: 'artifact'; readonly artifact: Artifact }
  /** `messageId`: the stored reply, which can then be reported (A10-35). */
  | { readonly type: 'done'; readonly crisis: boolean; readonly messageId?: string }
  | { readonly type: 'error' };
