/**
 * The shared limits of `uf-cv-profile/1` (docs/design/mmereko-api-proposal.md §2, §3.2). Mmereko
 * enforces the same numbers on its side; packages/db holds the learner's entries to them too, so
 * nothing saved can later fail to send.
 */
export const CV_LIMITS = {
  /** `basics.name`, and any other name (an organisation, a project, an institution). */
  name: 80,
  label: 120,
  summary: 600,
  description: 600,
  highlight: 200,
  highlights: 5,
  keyword: 40,
  keywords: 15,
  title: 120,
  /** Entries in any one section. */
  entries: 40,
  url: 500,
  evidence: 5,
  evidenceLabel: 60,
  profiles: 6,
  linkedModules: 10,
  modules: 40,
  subjects: 12,
  /** A job advert's text (`/tailorings`). */
  advert: 20_000,
  /** A request body, in bytes. */
  bodyBytes: 256 * 1024,
} as const;

/** What a learner adds in their own words (`cv_entries.kind`). */
export const CV_ENTRY_KINDS = [
  'project',
  'skill',
  'work',
  'volunteer',
  'award',
  'language',
  'certificate',
] as const;
export type CvEntryKind = (typeof CV_ENTRY_KINDS)[number];

/** The kinds of evidence link a project may carry: printed as links, never fetched (D10). */
export const EVIDENCE_KINDS = ['repository', 'demo', 'document', 'video', 'other'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * What a learner's CV opt-in may cover. `cv.share` (a recruiter link) only from 18, in the
 * learner's own name (§9.3): the database refuses it for anyone younger, and so does Mmereko.
 */
export const CV_PURPOSES = ['cv.draft', 'cv.tailor', 'cv.ats', 'cv.share'] as const;
export type CvPurpose = (typeof CV_PURPOSES)[number];

/** `ageBand` in the envelope: no date of birth is ever sent (§2). */
export const AGE_BANDS = ['under-18', '18-plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** The schema version UniversityFlow sends. Mmereko accepts `1.x`. */
export const CV_SCHEMA_VERSION = 'uf-cv-profile/1.0';
