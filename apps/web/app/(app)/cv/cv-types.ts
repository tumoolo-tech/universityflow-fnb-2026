/**
 * My CV's shapes as the browser sees them: the CV API's answers (docs/design/mmereko-api-proposal.md
 * §10.3) with dates as ISO strings. Types only, so nothing server-side reaches the page's bundle.
 */

export type CvEntryKind =
  | 'project'
  | 'skill'
  | 'work'
  | 'volunteer'
  | 'award'
  | 'language'
  | 'certificate';
export type EvidenceKind = 'repository' | 'demo' | 'document' | 'video' | 'other';

export interface CvEvidence {
  readonly kind: EvidenceKind;
  readonly url: string;
  readonly label: string | null;
}

export interface CvEntry {
  readonly id: string;
  readonly kind: CvEntryKind;
  readonly title: string;
  readonly organisation: string | null;
  readonly role: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly description: string | null;
  readonly highlights: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<CvEvidence>;
  readonly linkedModules: ReadonlyArray<string>;
  readonly position: number;
}

/** What goes on the CV: the body of PUT /api/me/cv/selection. */
export interface CvSelection {
  readonly surname: string | null;
  readonly label: string | null;
  readonly summary: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly includeSchool: boolean;
  readonly subjectIds: ReadonlyArray<string>;
  readonly includeOffer: boolean;
  readonly moduleCodes: ReadonlyArray<string>;
  readonly entryIds: ReadonlyArray<string>;
}

/** What can be ticked, each from its own place. */
export interface CvAvailable {
  readonly school: { readonly name: string; readonly endYear: number | null } | null;
  readonly subjects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly percent: number;
  }>;
  readonly offer: { readonly university: string | null; readonly course: string | null } | null;
  readonly modules: ReadonlyArray<{
    readonly code: string;
    readonly name: string | null;
    readonly year: number;
  }>;
  readonly entries: ReadonlyArray<{
    readonly id: string;
    readonly kind: CvEntryKind;
    readonly title: string;
  }>;
}

export interface CvOmission {
  readonly source: 'report' | 'offer' | 'registration' | 'module';
  readonly reason: 'unconfirmed' | 'unverified';
}

/** GET /api/me/cv/selection, less the profile itself (the CV's text shows what it makes). */
export interface CvSelectionView {
  readonly selection: CvSelection;
  readonly available: CvAvailable;
  readonly ready: boolean;
  readonly missing: ReadonlyArray<'name' | 'education'>;
  readonly omitted: ReadonlyArray<CvOmission>;
}

export type CvStatus = 'queued' | 'submitted' | 'ready' | 'failed';

export interface CvDocument {
  readonly id: string;
  readonly kind: 'draft' | 'tailored';
  readonly status: CvStatus;
  readonly problem: string | null;
  readonly advertTitle: string | null;
  readonly advertCompany: string | null;
  readonly markdown: string | null;
  readonly gaps: ReadonlyArray<string>;
  readonly atsCoverage: number | null;
  readonly atsMatched: ReadonlyArray<string>;
  readonly atsMissing: ReadonlyArray<string>;
  readonly atsMissingMust: ReadonlyArray<string>;
  readonly hasPdf: boolean;
  readonly bytes: number | null;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

export interface CvShare {
  readonly id: string;
  readonly documentId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly viewCount: number;
}

export interface CvOptIn {
  readonly optedInAt: string;
  readonly version: string;
  readonly purposes: ReadonlyArray<string>;
}

/** Everything the page reads on the server, for the client to start from. */
export interface CvInitial {
  readonly optIn: CvOptIn | null;
  /** The live wording names Mmereko (or the owner's preview stands in for it). */
  readonly wordingCovers: boolean;
  /** An adult answering for themselves: the only learner offered sharing (§9.3, D6). */
  readonly canShare: boolean;
  readonly entries: ReadonlyArray<CvEntry>;
  readonly view: CvSelectionView;
  readonly documents: ReadonlyArray<CvDocument>;
  readonly shares: ReadonlyArray<CvShare>;
  /** The ids of the CVs the learner reported (A10-58); none when left out. */
  readonly reported?: ReadonlyArray<string>;
  /**
   * The judge demo's built-in stand-in makes the CVs (a hackathon exception, 2026-10-24): no AI
   * fits them, so the page says nothing of one. Absent or false everywhere else.
   */
  readonly standIn?: boolean;
}

/** A CV still being made. */
export const pending = (d: CvDocument) => d.status === 'queued' || d.status === 'submitted';
