/**
 * Documents a student hands the agent: upload checks, storage, and reading them into drafts the
 * student confirms. Server-only.
 */
export {
  type Arrival,
  checkArrival,
  type DirectUploads,
  MemoryDirectUploads,
  SNIFF_BYTES,
  TicketRefusedError,
  type TicketRequest,
  UPLOAD_TICKET_TTL_SECONDS,
  type UploadTicket,
} from './direct-uploads';
export { type DocumentType, documentType } from './document-types';
export {
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  type PreparedDocument,
  prepareForReading,
} from './images';
export {
  type ConfirmedOffer,
  cleanCondition,
  confirmedOfferSchema,
  draftFromLetter,
  type ExtractedLetter,
  extractedLetterSchema,
  isIsoDate,
  LETTER_OFFER_KINDS,
  type LetterDraft,
  type LetterOfferKind,
  type LetterWarning,
  MAX_CONDITION_LENGTH,
  MAX_CONDITIONS,
} from './letter';
export {
  AnthropicLetterReader,
  type LetterReader,
  SAMPLE_LETTER,
  SampleLetterReader,
} from './letter-reader';
export {
  type ConfirmedModuleOutline,
  confirmedModuleOutlineSchema,
  type DraftOutlineBook,
  type DraftOutlineComponent,
  type DraftOutlineDate,
  type DraftOutlinePerson,
  dateFromPrinted,
  draftFromModuleOutline,
  type ExtractedModuleOutline,
  extractedModuleOutlineSchema,
  holdsMobileNumber,
  isbnFromPrinted,
  isMobileNumber,
  isPersonalEmail,
  looksLikePersonalNumber,
  type ModuleOutlineDraft,
  type ModuleOutlineWarning,
  OUTLINE_BOOK_ROLES,
  OUTLINE_COMPONENT_KINDS,
  OUTLINE_LIMITS,
  OUTLINE_SECTIONS,
  type OutlineBookRole,
  type OutlineComponent,
  type OutlineComponentKind,
  type OutlineSection,
  percentFromPrinted,
  weightsTotal,
} from './module-outline';
export {
  AnthropicModuleOutlineReader,
  type ModuleOutlineReader,
  SAMPLE_MODULE_OUTLINE,
  SAMPLE_OUTLINE_YEARS,
  SampleModuleOutlineReader,
  type SampleOutlineYear,
  sampleModuleOutline,
} from './module-outline-reader';
export {
  checkPhoto,
  cropPixels,
  heicDecodes,
  InvalidPhotoError,
  MAX_PHOTO_BYTES,
  PHOTO_EDGE,
  type PhotoCropBox,
  type PhotoRefusal,
  type PhotoType,
  type PreparedPhoto,
  prepareProfilePhoto,
  sniffPhotoType,
} from './profile-photo';
export {
  AnthropicReportReader,
  ReaderUnavailableError,
  type ReportReader,
  SAMPLE_REPORT,
  SampleReportReader,
} from './reader';
export {
  type ConfirmedModule,
  type ConfirmedRegistration,
  confirmedModuleSchema,
  confirmedRegistrationSchema,
  type DraftModule,
  draftFromRegistration,
  type ExtractedRegistration,
  extractedRegistrationSchema,
  MAX_MODULES,
  MODULE_CODE,
  type RegistrationDraft,
  type RegistrationWarning,
  termFromPrinted,
} from './registration';
export {
  AnthropicRegistrationReader,
  type RegistrationReader,
  SAMPLE_REGISTRATION,
  SampleRegistrationReader,
} from './registration-reader';
export {
  type ConfirmedMarks,
  confirmedMarksSchema,
  type DraftIssue,
  type DraftRow,
  draftFromExtraction,
  type ExtractedReport,
  extractedReportSchema,
  normaliseName,
  type ReportDraft,
  resolveSubject,
} from './report';
export {
  FakeResultsSource,
  InvalidExamNumberError,
  InvalidResultsFileError,
  isSampleExamNumber,
  RESULTS_ISSUERS,
  RESULTS_PERIODS,
  type ResultsIssuer,
  type ResultsPeriod,
  type ResultsSource,
  SAMPLE_EXAM_NUMBER_ALPHABET,
  SAMPLE_NOTICE,
  type SampleLearner,
  type SampleReport,
  type SampleResultsFile,
  type SourcedReport,
  type SourcedResults,
  type SourcedSubject,
  sampleResultsFileSchema,
} from './results-source';
export { DEFAULT_S3_REGION, S3FileStore, type S3FileStoreOptions } from './s3';
export { isGeneratedSamplePdf, SAMPLE_PDF_PRODUCER } from './sample-pdf';
export {
  isSamplePhotoId,
  prepareSamplePhoto,
  SAMPLE_MARK_BOX,
  SAMPLE_PHOTO_IDS,
  type SamplePhotoId,
  samplePhotoPng,
  samplePhotoSvg,
} from './sample-photos';
export {
  assertKey,
  DiskFileStore,
  type FileStore,
  InvalidKeyError,
  MemoryFileStore,
  type StoredFile,
} from './storage';
export {
  checkUpload,
  InvalidUploadError,
  MAX_UPLOAD_BYTES,
  sniffType,
  UPLOAD_TYPES,
  type UploadType,
} from './uploads';
