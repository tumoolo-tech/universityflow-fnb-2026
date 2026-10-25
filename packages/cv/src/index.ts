/**
 * The CV engine behind an interface (docs/design/mmereko-api-proposal.md §10.1): the
 * `uf-cv-profile/1` schema and its rules, the profile built from a learner's confirmed rows, the
 * engine interface and its in-memory fake, and Mmereko's webhook scheme. Server-only: the mobile
 * app never imports it (it never holds keys or calls Mmereko). The contract suite is
 * `@universityflow/cv/contract`, kept out of this entry so an app bundle never reaches vitest.
 */
export {
  type BuiltCvProfile,
  buildCvProfile,
  type CatalogueName,
  type CvEntryRecord,
  type CvEvidence,
  type CvMark,
  type CvModuleSource,
  type CvOfferSource,
  type CvOmission,
  type CvRegistrationSource,
  type CvReportSource,
  type CvSelection,
  type CvSources,
  EMPTY_SELECTION,
} from './build';
export {
  type AtsResult,
  type CvAtsScanRequest,
  type CvConsent,
  type CvDeletion,
  type CvDraftRequest,
  type CvEngine,
  CvEngineError,
  type CvJob,
  type CvJobKind,
  type CvJobResult,
  type CvJobStatus,
  type CvLearnerExport,
  type CvRender,
  type CvSubmitted,
  type CvTailorRequest,
  type CvWebhookEvent,
  type CvWebhookType,
  checkAtsScanRequest,
  checkDraftRequest,
  checkIdempotencyKey,
  checkTailorRequest,
  DEFAULT_RENDER,
  ENGINE_ID,
  isProblemCode,
  type JobAdvert,
  jobAdvertSchema,
  PROBLEM_CODES,
  type ProblemCode,
  type ProblemPath,
  type VerifiedCvWebhook,
  WEBHOOK_TYPES,
  type WebhookHeaders,
} from './engine';
export {
  AGE_BANDS,
  type AgeBand,
  CV_ENTRY_KINDS,
  CV_LIMITS,
  CV_PURPOSES,
  CV_SCHEMA_VERSION,
  type CvEntryKind,
  type CvPurpose,
  EVIDENCE_KINDS,
  type EvidenceKind,
} from './limits';
export {
  type CvWebhookDelivery,
  FAKE_PDF_LINK_MS,
  MemoryCvEngine,
  type MemoryCvEngineOptions,
} from './memory';
export {
  type CvProfile,
  cvProfileJsonSchema,
  cvProfileSchema,
  jsonPointer,
  PROFILE_PROBLEMS,
  type ProfileCheck,
  type ProfileIssue,
  type ProfileProblem,
  problemsOf,
  validateCvProfile,
} from './profile';
export { renderCvMarkdown, renderTinyPdf, scoreAts } from './render';
export {
  holdsIdNumber,
  holdsPersonalNumber,
  holdsStudentNumber,
  isContactPhone,
  isEmail,
  isPlainText,
  type LinkProblem,
  safeLinkProblem,
} from './text';
export {
  CV_WEBHOOK_REPLAY_WINDOW_MS,
  canonicalJson,
  MAX_CV_WEBHOOK_BYTES,
  MMEREKO_CHANNEL,
  MMEREKO_EVENT_ID_HEADER,
  MMEREKO_EVENT_TYPE_HEADER,
  MMEREKO_SIGNATURE_HEADER,
  parseCvWebhookEvent,
  signCvWebhook,
  verifyCvWebhook,
} from './webhook';
