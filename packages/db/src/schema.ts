import {
  ADMISSION_REPORT_KINDS,
  type ReportKind as CatalogueReportKind,
} from '@universityflow/catalogue';
import type { CvReportReason, ReplyReportReason } from '@universityflow/content';
import type { ConfirmedModuleOutline } from '@universityflow/documents';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Typed table definitions for queries. The schema itself (constraints, row-level security,
 * grants, the append-only audit trigger) is owned by the SQL migrations in ./migrations; the
 * schema test runs every table here against a migrated database, so the two can't drift.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const studentRef = () => uuid('student_id').notNull();

export type ConsentStatus = 'unknown' | 'not-required' | 'pending' | 'granted' | 'withdrawn';

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  dateOfBirth: date('date_of_birth'),
  consentStatus: text('consent_status').$type<ConsentStatus>().notNull().default('unknown'),
  /** The wording an adult agreed to in their own name, and when (migration 0009, A7-04). */
  adultConsentVersion: text('adult_consent_version'),
  adultConsentedAt: timestamp('adult_consented_at', { withTimezone: true }),
  /** The synthetic store-review account (migration 0010, A7-01). Set only by the owner's seed. */
  review: boolean('review').notNull().default(false),
  createdAt: createdAt(),
});

export type GuardianRelationship = 'parent' | 'legal-guardian' | 'other-caregiver';

export const guardianConsents = pgTable('guardian_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  guardianName: text('guardian_name').notNull(),
  guardianPhone: text('guardian_phone').notNull(),
  relationship: text('relationship').$type<GuardianRelationship>().notNull(),
  tokenHash: text('token_hash').notNull(),
  consentVersion: text('consent_version').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
});

export const otpChallenges = pgTable('otp_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  /** Holds the configured store-review PIN hash, not a PIN we sent (migration 0010, A7-01). */
  review: boolean('review').notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  tokenHash: text('token_hash').notNull(),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  studentId: uuid('student_id').primaryKey(),
  displayName: text('display_name'),
  grade: integer('grade'),
  /** The SAST date the grade was given or confirmed (migration 0025, G10-1). */
  gradeGivenOn: date('grade_given_on'),
  schoolName: text('school_name'),
  province: text('province'),
  goal: text('goal'),
  /**
   * The About me card's look (migration 0028): ids from the fixed lists in `packages/ui`
   * profile-look.ts, never free text. The database holds their shape and the three-word cap.
   */
  theme: text('theme').notNull().default('mauve'),
  avatar: text('avatar').notNull().default('initials'),
  taglineId: text('tagline_id'),
  badgeIds: text('badge_ids').array().notNull().default([]),
  /**
   * The profile photo's storage key (migration 0029), or null. Never leaves the server: `profile()`
   * says only whether there is one, and the photo is served to its owner by /api/me/photo.
   */
  photoKey: text('photo_key'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentStatus = 'uploaded' | 'extracted' | 'confirmed' | 'failed';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  kind: text('kind').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status').$type<DocumentStatus>().notNull().default('uploaded'),
  extraction: jsonb('extraction'),
  createdAt: createdAt(),
});

/** `REPORT_KINDS` (packages/catalogue): migration 0031's CHECK lists the same, held by a test. */
export type ReportKind = CatalogueReportKind;

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  kind: text('kind').$type<ReportKind>().notNull(),
  documentId: uuid('document_id'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** `ADMISSION_REPORT_KINDS` as an SQL list: a closed list of constants, never input. */
const ADMISSION_KINDS_SQL = sql.raw(ADMISSION_REPORT_KINDS.map((k) => `'${k}'`).join(', '));

/**
 * "The learner's latest report", for every reader of it (G10-3, A1-34, §18.7 C2): a report
 * universities admit on (`ADMISSION_REPORT_KINDS`) comes before every other, however recently the
 * other was confirmed; then a Grade 11 June or September report before any Grade 10 one; then
 * newest first. So a learner completing their school record never has their results scored on an
 * older report. One definition, so a reader can't drift from the others again.
 */
export const LATEST_REPORT_FIRST = sql`(reports.kind not in (${ADMISSION_KINDS_SQL})), (reports.kind like 'grade-10-%'), reports.confirmed_at desc, reports.created_at desc`;

export const reportMarks = pgTable(
  'report_marks',
  {
    reportId: uuid('report_id').notNull(),
    studentId: studentRef(),
    subject: text('subject').notNull(),
    percent: integer('percent').notNull(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.subject] })],
);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  createdAt: createdAt(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  studentId: studentRef(),
  role: text('role').$type<'student' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  artifacts: jsonb('artifacts').$type<unknown[]>().notNull().default([]),
  crisis: boolean('crisis').notNull().default(false),
  /** Who wrote an AI reply (A10-49, migration 0036); null: not recorded. */
  replyProvider: text('reply_provider').$type<ReplyProvider>(),
  replyModel: text('reply_model'),
  createdAt: createdAt(),
});

/**
 * Who wrote an AI reply (A10-49, migration 0036): a real provider, the scripted stand-in
 * ('local'), or 'system' when no model wrote anything the learner read (the crisis reply, our own
 * kind line). The same values as packages/agent's `ReplyProvider`.
 */
export const REPLY_PROVIDERS = ['anthropic', 'gemini', 'local', 'system'] as const;
export type ReplyProvider = (typeof REPLY_PROVIDERS)[number];

export interface ReplyWriter {
  readonly provider: ReplyProvider;
  /** The model id; always null for 'system', null too when not one we could vouch for. */
  readonly model: string | null;
}

/** A learner's report of an AI reply, for a person to look at (A10-35, migration 0026). */
export const replyReports = pgTable('reply_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  messageId: uuid('message_id').notNull(),
  reason: text('reason').$type<ReplyReportReason>().notNull(),
  /** The reported reply's writer, copied from it (A10-49, migration 0036); null: not recorded. */
  replyProvider: text('reply_provider').$type<ReplyProvider>(),
  replyModel: text('reply_model'),
  createdAt: createdAt(),
});

export type MemoryKind = 'goal' | 'preference' | 'note';

export const memoryNotes = pgTable('memory_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  kind: text('kind').$type<MemoryKind>().notNull(),
  body: text('body').notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shortlist = pgTable(
  'shortlist',
  {
    studentId: studentRef(),
    programmeId: text('programme_id').notNull(),
    rank: integer('rank').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.programmeId] })],
);

export const APPLICATION_STATUSES = [
  'planning',
  'in-progress',
  'submitted',
  'provisional-offer',
  'offer',
  'waitlisted',
  'unsuccessful',
  'declined',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  universityId: text('university_id').notNull(),
  status: text('status').$type<ApplicationStatus>().notNull().default('planning'),
  reference: text('reference'),
  submittedOn: date('submitted_on'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const checklistItems = pgTable(
  'checklist_items',
  {
    studentId: studentRef(),
    scope: text('scope').notNull(),
    item: text('item').notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.scope, t.item] })],
);

export const rateEvents = pgTable('rate_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  action: text('action').notNull(),
  keyHash: text('key_hash').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const uploadIntents = pgTable('upload_intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const budgetEvents = pgTable('budget_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  budget: text('budget').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  /** What the event cost: an SMS's segments (0011). */
  units: integer('units').notNull().default(1),
});

export type MessagingChannel = 'sms' | 'whatsapp' | 'push';

/** Numbers that said STOP, by HMAC only (migration 0013, audit A12-04). Owner-only. */
export const messagingSuppressions = pgTable(
  'messaging_suppressions',
  {
    channel: text('channel').$type<'sms' | 'whatsapp'>().notNull(),
    numberHash: text('number_hash').notNull(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.channel, t.numberHash] })],
);

export const messagingChannels = pgTable(
  'messaging_channels',
  {
    studentId: studentRef(),
    channel: text('channel').$type<MessagingChannel>().notNull(),
    optedIn: boolean('opted_in').notNull().default(false),
    optedInAt: timestamp('opted_in_at', { withTimezone: true }),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    optOutSource: text('opt_out_source').$type<'app' | 'stop' | 'consent-withdrawn'>(),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.channel] })],
);

export const messagingPreferences = pgTable('messaging_preferences', {
  studentId: uuid('student_id').primaryKey(),
  maxPerWeek: integer('max_per_week').notNull().default(2),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type ReminderRowStatus =
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'unconfirmed'
  | 'dropped'
  | 'failed';

export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  templateId: text('template_id').notNull(),
  channel: text('channel').$type<MessagingChannel>().notNull(),
  params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
  desiredAt: timestamp('desired_at', { withTimezone: true }).notNull(),
  status: text('status').$type<ReminderRowStatus>().notNull().default('scheduled'),
  outcomeReason: text('outcome_reason'),
  jobId: uuid('job_id'),
  reschedules: integer('reschedules').notNull().default(0),
  receiptId: text('receipt_id'),
  /** Every ticket of a push send, one per phone, the first being `receiptId` (0015, A11-07). */
  receiptIds: text('receipt_ids').array(),
  deliveryStatus: text('delivery_status').$type<'accepted' | 'delivered' | 'failed'>(),
  /** WhatsApp only: the category Meta billed the message as (0017, A12-09). */
  billedCategory: text('billed_category').$type<'utility' | 'marketing'>(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type PushPlatform = 'ios' | 'android';

/** The app's Expo push tokens, one per phone (migration 0008, Phase 4d). */
export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  studentId: studentRef(),
  sessionId: uuid('session_id').notNull(),
  platform: text('platform').$type<PushPlatform>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const goals = pgTable('goals', {
  studentId: uuid('student_id').primaryKey(),
  programmeId: text('programme_id').notNull(),
  setAt: timestamp('set_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const examSubjectChoices = pgTable(
  'exam_subject_choices',
  {
    studentId: studentRef(),
    subject: text('subject').notNull(),
    included: boolean('included').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.subject] })],
);

export type RecheckStanding = 'qualify-now' | 'on-track' | 'close' | 'plan-b' | 'not-yet';

export interface RecheckMove {
  readonly programmeId: string;
  readonly from: RecheckStanding;
  readonly to: RecheckStanding;
  readonly direction: 'up' | 'down';
}

export type RecheckCounts = Readonly<
  Record<
    'qualifyNow' | 'onTrack' | 'close' | 'planB',
    { readonly before: number; readonly after: number }
  >
>;

export const rechecks = pgTable('rechecks', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  reportId: uuid('report_id').notNull(),
  previousReportId: uuid('previous_report_id').notNull(),
  moves: jsonb('moves').$type<RecheckMove[]>().notNull(),
  counts: jsonb('counts').$type<RecheckCounts>().notNull(),
  includesDrafts: boolean('includes_drafts').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export type OfferKind = 'provisional' | 'conditional' | 'final' | 'waitlist';
export type OfferSource = 'letter' | 'learner';
export type OfferStatus = 'held' | 'accepted' | 'declined';

/** The places a learner has been offered (migration 0018, Phase 5a). */
export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  universityId: text('university_id').notNull(),
  programmeId: text('programme_id').notNull(),
  kind: text('kind').$type<OfferKind>().notNull(),
  source: text('source').$type<OfferSource>().notNull(),
  documentId: uuid('document_id'),
  status: text('status').$type<OfferStatus>().notNull().default('held'),
  replyBy: date('reply_by'),
  conditions: text('conditions').array().notNull().default([]),
  reminderId: uuid('reminder_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  /** The accepted offer's registration-day reminder (migration 0023, A1-33). */
  registrationReminderId: uuid('registration_reminder_id'),
});

/** The first-week steps a learner ticked, per university (migration 0019, Phase 5b). */
export const firstWeekSteps = pgTable(
  'first_week_steps',
  {
    studentId: studentRef(),
    universityId: text('university_id').notNull(),
    step: text('step').notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.universityId, t.step] })],
);

/** One module a learner confirmed from their proof of registration (Phase 5c). */
export interface RegistrationModuleRow {
  readonly code: string;
  readonly name: string | null;
  /** S1, S2, Y or Q1–Q4; null when the learner doesn't know. */
  readonly term: string | null;
  readonly credits: number | null;
}

/**
 * The modules a learner confirmed they are registered for (migration 0020, Phase 5c). No student
 * number, ID number, name, address or fees: the table has nowhere to put them (D4).
 */
export const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  universityId: text('university_id').notNull(),
  programmeId: text('programme_id').notNull(),
  academicYear: integer('academic_year').notNull(),
  yearOfStudy: integer('year_of_study'),
  modules: jsonb('modules').$type<RegistrationModuleRow[]>().notNull(),
  documentId: uuid('document_id'),
  reminderId: uuid('reminder_id'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type AuditActor = 'student' | 'guardian' | 'staff' | 'system';

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actorType: text('actor_type').$type<AuditActor>().notNull(),
  actorId: uuid('actor_id'),
  studentId: uuid('student_id'),
  action: text('action').notNull(),
  reason: text('reason'),
});

export type PlanNodeStatus = 'planned' | 'achieved' | 'not-achieved';

/** My plan maps (migration 0030): a template id and, at most, a title in the learner's words. */
export const planMaps = pgTable('plan_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  templateId: text('template_id').notNull(),
  title: text('title'),
  linksGoal: boolean('links_goal').notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A map's parts: a tree from one centre, three levels deep at most. */
export const planMapNodes = pgTable('plan_map_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id').notNull(),
  studentId: studentRef(),
  parentId: uuid('parent_id'),
  depth: smallint('depth').notNull(),
  position: smallint('position').notNull(),
  slotId: text('slot_id'),
  text: text('text'),
  status: text('status').$type<PlanNodeStatus>().notNull(),
  whyNot: text('why_not'),
  differently: text('differently'),
  targetMonth: date('target_month'),
  statusChangedOn: date('status_changed_on'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** Where the learner put the card on the canvas (migration 0043): null, the template's place. */
  placeX: smallint('place_x'),
  placeY: smallint('place_y'),
});

/**
 * The judge demo's real sign-up (migration 0034, a hackathon exception, docs/deploy/demo.md): the
 * Firebase uid and the email of an adult judge's own account, on a demo deployment only.
 */
export const demoSignups = pgTable('demo_signups', {
  studentId: uuid('student_id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull(),
  email: text('email').notNull(),
  createdAt: createdAt(),
});

// ── My CV (migration 0035, docs/design/mmereko-api-proposal.md §10.4) ───────────────────────────

/** The learner's CV opt-in, and their reference for Mmereko only (never the student id). */
export const cvLinks = pgTable('cv_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  learnerRef: uuid('learner_ref').notNull().defaultRandom(),
  optedInAt: timestamp('opted_in_at', { withTimezone: true }).notNull(),
  consentVersion: text('consent_version').notNull(),
  purposes: text('purposes').array().notNull(),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
});

/** One evidence link on a CV entry: printed, never fetched (D10). */
export interface CvEvidenceRow {
  readonly kind: 'repository' | 'demo' | 'document' | 'video' | 'other';
  readonly url: string;
  readonly label: string | null;
}

/** The learner's own entries: projects, skills, work, volunteering, awards, languages. */
export const cvEntries = pgTable('cv_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  kind: text('kind')
    .$type<'project' | 'skill' | 'work' | 'volunteer' | 'award' | 'language' | 'certificate'>()
    .notNull(),
  title: text('title').notNull(),
  organisation: text('organisation'),
  role: text('role'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  description: text('description'),
  highlights: text('highlights').array().notNull().default([]),
  keywords: text('keywords').array().notNull().default([]),
  evidence: jsonb('evidence').$type<CvEvidenceRow[]>().notNull().default([]),
  linkedModules: text('linked_modules').array().notNull().default([]),
  position: smallint('position').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** What is ticked for the CV, and the contact details the learner typed for it (D9). */
export const cvSelections = pgTable('cv_selections', {
  studentId: uuid('student_id').primaryKey(),
  surname: text('surname'),
  label: text('label'),
  summary: text('summary'),
  email: text('email'),
  phone: text('phone'),
  city: text('city'),
  region: text('region'),
  includeSchool: boolean('include_school').notNull().default(false),
  subjectIds: text('subject_ids').array().notNull().default([]),
  includeOffer: boolean('include_offer').notNull().default(false),
  moduleCodes: text('module_codes').array().notNull().default([]),
  entryIds: uuid('entry_ids').array().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CvDocumentKind = 'draft' | 'tailored';
export type CvDocumentStatus = 'queued' | 'submitted' | 'ready' | 'failed';

/** A CV made by the engine, kept by UniversityFlow (D2). The advert's text only while it runs. */
export const cvDocuments = pgTable('cv_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  kind: text('kind').$type<CvDocumentKind>().notNull(),
  status: text('status').$type<CvDocumentStatus>().notNull().default('queued'),
  engineJobId: text('engine_job_id'),
  problem: text('problem'),
  advertTitle: text('advert_title'),
  advertCompany: text('advert_company'),
  advertText: text('advert_text'),
  markdown: text('markdown'),
  gaps: text('gaps').array().notNull().default([]),
  atsCoverage: smallint('ats_coverage'),
  atsMatched: text('ats_matched').array().notNull().default([]),
  atsMissing: text('ats_missing').array().notNull().default([]),
  atsMissingMust: text('ats_missing_must').array().notNull().default([]),
  fileKey: text('file_key'),
  sha256: text('sha256'),
  bytes: integer('bytes'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

/** A recruiter link to one CV: 18+ only (§9.3), the token kept as a hash. */
export const cvShares = pgTable('cv_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  documentId: uuid('document_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  viewCount: integer('view_count').notNull().default(0),
});

/** A learner's report of a fitted CV (A10-58, migration 0039): ids and a reason, no CV text. */
export const cvReports = pgTable('cv_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  documentId: uuid('document_id').notNull(),
  reason: text('reason').$type<CvReportReason>().notNull(),
  createdAt: createdAt(),
});

/** That a deletion reached the operator (§7.3). No student link: it outlives the account. */
export const cvDeletions = pgTable('cv_deletions', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerRef: uuid('learner_ref').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  engineDeletionId: text('engine_deletion_id'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});

/**
 * A module outline as the learner confirmed it (Phase 6b, migration 0040): the module's name and
 * term and its four sections, each confirmed or "not-in-outline". The code and year are columns.
 */
export type StoredModuleOutline = Omit<
  ConfirmedModuleOutline,
  'moduleCode' | 'academicYear' | 'documentId'
>;

/**
 * Confirmed module outlines (migration 0040): one per learner, module and academic year. The
 * table's `keep_until` (the academic year plus one, D10; migration 0042) is generated by the
 * database and left out here, as module_marks' is.
 */
export const moduleOutlines = pgTable('module_outlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  moduleCode: text('module_code').notNull(),
  academicYear: smallint('academic_year').notNull(),
  outline: jsonb('outline').$type<StoredModuleOutline>().notNull(),
  fromDocument: boolean('from_document').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

/**
 * The learner's own marks per component (Phase 6c, migration 0041): one per component and
 * attempt, a percentage from 0 to 100 (two decimals, read back as a string). The table's
 * `keep_until` (the academic year plus one, D10) is generated by the database and left out here.
 */
export const moduleMarks = pgTable('module_marks', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: studentRef(),
  moduleCode: text('module_code').notNull(),
  academicYear: smallint('academic_year').notNull(),
  component: text('component').notNull(),
  attempt: smallint('attempt').notNull(),
  percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

/** The learner's own target per module and year (migration 0041). */
export const moduleTargets = pgTable(
  'module_targets',
  {
    studentId: studentRef(),
    moduleCode: text('module_code').notNull(),
    academicYear: smallint('academic_year').notNull(),
    percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.academicYear, t.moduleCode] })],
);
