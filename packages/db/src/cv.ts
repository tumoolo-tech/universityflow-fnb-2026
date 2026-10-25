import { type CvReportReason, isCvReportReason } from '@universityflow/content';
import {
  CV_ENTRY_KINDS,
  CV_LIMITS,
  CV_PURPOSES,
  type CvEntryKind,
  type CvEntryRecord,
  type CvPurpose,
  type CvSelection,
  EMPTY_SELECTION,
  EVIDENCE_KINDS,
  isContactPhone,
  isEmail,
  isPlainText,
  safeLinkProblem,
} from '@universityflow/cv';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AGE_OF_MAJORITY, ageOn, sastDate } from './age';
import { type Db, rowsOf } from './client';
import { hashToken, newToken } from './crypto';
import {
  CvBusyError,
  CvConsentError,
  CvShareError,
  CvStateError,
  InvalidStateError,
  NotFoundError,
  PersonalNumberError,
} from './errors';
import {
  auditLog,
  type CvDocumentKind,
  type CvDocumentStatus,
  type CvEvidenceRow,
  cvDeletions,
  cvDocuments,
  cvEntries,
  cvLinks,
  cvReports,
  cvSelections,
  cvShares,
  students,
} from './schema';
import { holdsPersonalNumber } from './store';

/**
 * My CV (migration 0035, docs/design/mmereko-api-proposal.md §9, §10.4). `StudentStore` runs the
 * learner's calls in their own transaction (row-level security and the consent gate, hard rule 5);
 * `CvJobStore` is what the jobs, the webhook and the public share page use, by id, as the owner.
 *
 * Nothing about a CV is written until the learner's consent wording names Mmereko (guardian v4,
 * adult-v3) and they opted in to the purpose themselves: checked here first, with a reason, and by
 * the database whatever the code does. The owner's preview (`CvAccess.preview`, UF_CV=1 while the
 * live wording is older) stands in for the wording only; never for the opt-in, and never for the
 * age rules. Audit rows carry fixed words and ids only (hard rule 4; §7.6).
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The guardian consent wording that first names Mmereko (D8). Not live yet. */
export const CV_CONSENT_VERSION = 4;
/** The adult agreement that first names Mmereko and recruiter sharing (D8). Not live yet. */
export const CV_ADULT_CONSENT_VERSION = 3;
/** At most this many entries of a kind (§2's per-section cap). */
export const CV_ENTRY_LIMIT = CV_LIMITS.entries;
/** A recruiter link lasts 7 to 90 days, 30 unless the learner chooses (§9.3). */
export const CV_SHARE_DAYS = { min: 7, max: 90, default: 30 } as const;

/** Whether the owner's preview stands in for the wording (UF_CV=1 while it is older). */
export interface CvAccess {
  readonly preview: boolean;
}

export interface CvLinkRecord {
  readonly id: string;
  readonly optedInAt: Date;
  readonly consentVersion: string;
  readonly purposes: ReadonlyArray<CvPurpose>;
}

export interface CvEntryInput {
  readonly kind: CvEntryKind;
  readonly title: string;
  readonly organisation: string | null;
  readonly role: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly description: string | null;
  readonly highlights: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<CvEvidenceRow>;
  readonly linkedModules: ReadonlyArray<string>;
}

/** A change to an entry: a field left out (or undefined) stays as it is. */
export type CvEntryPatch = {
  readonly [K in keyof Omit<CvEntryInput, 'kind'>]?: Omit<CvEntryInput, 'kind'>[K] | undefined;
};

export interface CvAdvert {
  readonly title: string;
  readonly company: string | null;
  readonly text: string;
}

export type CvRequest =
  | { readonly kind: 'draft' }
  | { readonly kind: 'tailored'; readonly advert: CvAdvert };

/** A CV as the learner sees it: never its file key or the advert's text. */
export interface CvDocumentRecord {
  readonly id: string;
  readonly kind: CvDocumentKind;
  readonly status: CvDocumentStatus;
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
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}

export interface CvShareRecord {
  readonly id: string;
  readonly documentId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly viewCount: number;
}

/** What a `cv.submit` job needs about the CV and the learner's opt-in, ids and words only. */
export interface CvSubmission {
  readonly document: {
    readonly id: string;
    readonly kind: CvDocumentKind;
    readonly status: CvDocumentStatus;
    readonly engineJobId: string | null;
  };
  readonly advert: {
    readonly title: string;
    readonly company: string | null;
    readonly description: string;
  } | null;
  readonly link: {
    readonly id: string;
    readonly learnerRef: string;
    readonly consentVersion: string;
    readonly purposes: ReadonlyArray<CvPurpose>;
  };
  readonly ageBand: 'under-18' | '18-plus';
}

export interface CvResult {
  readonly markdown: string;
  readonly gaps: ReadonlyArray<string>;
  readonly ats: {
    readonly coveragePct: number;
    readonly matched: ReadonlyArray<string>;
    readonly missing: ReadonlyArray<string>;
    readonly missingMustHaves: ReadonlyArray<string>;
    readonly flags: ReadonlyArray<string>;
  } | null;
  readonly fileKey: string;
  readonly sha256: string;
  readonly bytes: number;
}

/** What each call needs from the learner's transaction. */
export interface CvContext {
  readonly tx: Tx;
  readonly studentId: string;
  readonly now: Date;
  audit(action: string, reason?: string): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/;
const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,23}$/;
const SUBJECT_ID = /^[a-z0-9-]{1,40}$/;
const VERSION = /^[a-z0-9-]{1,40}$/;
const ENGINE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_KEY = /^cv-[0-9a-f]{32}$/;

async function lock(tx: Tx, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

/**
 * Refuses with a reason unless the learner's wording names Mmereko (or the preview stands in for
 * it) and, for `purpose`, they opted in to it. When the preview is on, the database is told so
 * for this one transaction (`uf.cv`), so its own check agrees.
 */
async function requireCv(ctx: CvContext, access: CvAccess, purpose: CvPurpose | null) {
  if (access.preview) await ctx.tx.execute(sql`select set_config('uf.cv', 'preview', true)`);
  const [row] = rowsOf<{ ok: boolean }>(
    await ctx.tx.execute(sql`select uf_cv_allowed(${ctx.studentId}::uuid, ${purpose}::text) as ok`),
  );
  if (row?.ok !== true) throw new CvConsentError();
}

// ── Checking what the learner wrote (§3.2) ────────────────────────────────────────────────────

/** Empty or blank is nothing. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function checkText(value: string | null, max: number): string | null {
  if (value === null) return null;
  if (value.length > max) throw new InvalidStateError(`At most ${max} characters`);
  if (!isPlainText(value)) throw new InvalidStateError('Plain text only');
  if (holdsPersonalNumber(value)) throw new PersonalNumberError();
  return value;
}

function checkList(values: ReadonlyArray<string>, maxItems: number, max: number): string[] {
  const out = values.map(clean).filter((v): v is string => v !== null);
  if (out.length > maxItems) throw new InvalidStateError(`At most ${maxItems} items`);
  return out.map((v) => checkText(v, max) as string);
}

function checkDate(value: string | null | undefined): string | null {
  const date = clean(value);
  if (date !== null && !DATE.test(date)) throw new InvalidStateError('A date is YYYY-MM or YYYY');
  return date;
}

function checkEvidence(values: ReadonlyArray<CvEvidenceRow>): CvEvidenceRow[] {
  if (values.length > CV_LIMITS.evidence) throw new InvalidStateError('At most 5 links');
  return values.map((e) => {
    if (!(EVIDENCE_KINDS as ReadonlyArray<string>).includes(e.kind)) {
      throw new InvalidStateError('Not a kind of evidence');
    }
    if (safeLinkProblem(e.url) !== null) throw new InvalidStateError('Not a public https link');
    return { kind: e.kind, url: e.url, label: checkText(clean(e.label), CV_LIMITS.evidenceLabel) };
  });
}

function checkModules(values: ReadonlyArray<string>): string[] {
  const out = values.map((v) => v.trim()).filter((v) => v !== '');
  if (out.length > CV_LIMITS.linkedModules) throw new InvalidStateError('At most 10 modules');
  for (const code of out) {
    if (!MODULE_CODE.test(code)) throw new InvalidStateError('Not a module code');
    if (holdsPersonalNumber(code)) throw new PersonalNumberError();
  }
  return out;
}

function checkEntry(input: CvEntryInput) {
  if (!(CV_ENTRY_KINDS as ReadonlyArray<string>).includes(input.kind)) {
    throw new InvalidStateError('Not a kind of CV entry');
  }
  const title = checkText(clean(input.title), CV_LIMITS.title);
  if (title === null) throw new InvalidStateError('An entry needs a title');
  return {
    kind: input.kind,
    title,
    organisation: checkText(clean(input.organisation), CV_LIMITS.title),
    role: checkText(clean(input.role), CV_LIMITS.title),
    startDate: checkDate(input.startDate),
    endDate: checkDate(input.endDate),
    description: checkText(clean(input.description), CV_LIMITS.description),
    highlights: checkList(input.highlights, CV_LIMITS.highlights, CV_LIMITS.highlight),
    keywords: checkList(input.keywords, CV_LIMITS.keywords, CV_LIMITS.keyword),
    evidence: checkEvidence(input.evidence),
    linkedModules: checkModules(input.linkedModules),
  };
}

type EntryRow = typeof cvEntries.$inferSelect;

function toEntry(row: EntryRow): CvEntryRecord {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    organisation: row.organisation,
    role: row.role,
    startDate: row.startDate,
    endDate: row.endDate,
    description: row.description,
    highlights: row.highlights,
    keywords: row.keywords,
    evidence: row.evidence,
    linkedModules: row.linkedModules,
    position: row.position,
  };
}

type DocumentRow = typeof cvDocuments.$inferSelect;

function toDocument(row: DocumentRow): CvDocumentRecord {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    problem: row.problem,
    advertTitle: row.advertTitle,
    advertCompany: row.advertCompany,
    markdown: row.markdown,
    gaps: row.gaps,
    atsCoverage: row.atsCoverage,
    atsMatched: row.atsMatched,
    atsMissing: row.atsMissing,
    atsMissingMust: row.atsMissingMust,
    hasPdf: row.fileKey !== null,
    bytes: row.bytes,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

function toShare(row: typeof cvShares.$inferSelect): CvShareRecord {
  return {
    id: row.id,
    documentId: row.documentId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    viewCount: row.viewCount,
  };
}

function toLink(row: typeof cvLinks.$inferSelect): CvLinkRecord {
  return {
    id: row.id,
    optedInAt: row.optedInAt,
    consentVersion: row.consentVersion,
    purposes: row.purposes as CvPurpose[],
  };
}

async function activeLink(tx: Tx) {
  const [row] = await tx.select().from(cvLinks).where(isNull(cvLinks.withdrawnAt));
  return row ?? null;
}

/** Whether the learner is an adult answering for themselves (the share rules' first half). */
async function adultInOwnName(ctx: CvContext): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ dob: students.dateOfBirth, status: students.consentStatus })
    .from(students)
    .where(eq(students.id, ctx.studentId));
  return Boolean(
    row?.dob &&
      ageOn(row.dob, sastDate(ctx.now)) >= AGE_OF_MAJORITY &&
      row.status === 'not-required',
  );
}

// ── The opt-in (§9.1 item 3) ────────────────────────────────────────────────────────────────────

export async function readCvLink(tx: Tx): Promise<CvLinkRecord | null> {
  const row = await activeLink(tx);
  return row ? toLink(row) : null;
}

/**
 * The learner's CV opt-in, to `version` of the opt-in wording and `purposes`. Given again, it
 * replaces the purposes (sharing, added at 18). Sharing only for an adult in their own name.
 */
export async function optInToCv(
  ctx: CvContext,
  input: { readonly version: string; readonly purposes: ReadonlyArray<CvPurpose> },
  access: CvAccess,
): Promise<CvLinkRecord> {
  const purposes = [...new Set(input.purposes)];
  if (
    !VERSION.test(input.version) ||
    purposes.length === 0 ||
    !purposes.every((p) => (CV_PURPOSES as ReadonlyArray<string>).includes(p)) ||
    !purposes.includes('cv.draft')
  ) {
    throw new InvalidStateError('Not an opt-in');
  }
  await lock(ctx.tx, `cv:${ctx.studentId}`);
  await requireCv(ctx, access, null);
  if (purposes.includes('cv.share') && !(await adultInOwnName(ctx))) {
    throw new CvShareError('cv-share-age');
  }
  const existing = await activeLink(ctx.tx);
  let row: typeof cvLinks.$inferSelect | undefined;
  if (existing) {
    [row] = await ctx.tx
      .update(cvLinks)
      .set({ purposes, consentVersion: input.version, optedInAt: ctx.now })
      .where(eq(cvLinks.id, existing.id))
      .returning();
  } else {
    [row] = await ctx.tx
      .insert(cvLinks)
      .values({
        studentId: ctx.studentId,
        optedInAt: ctx.now,
        consentVersion: input.version,
        purposes,
      })
      .returning();
  }
  if (!row) throw new Error('Could not record the opt-in');
  await ctx.audit('cv.opt-in');
  return toLink(row);
}

// ── Entries ─────────────────────────────────────────────────────────────────────────────────────

export async function readCvEntries(tx: Tx): Promise<CvEntryRecord[]> {
  const rows = await tx
    .select()
    .from(cvEntries)
    .orderBy(asc(cvEntries.position), asc(cvEntries.createdAt), asc(cvEntries.id));
  return rows.map(toEntry);
}

export async function addCvEntry(
  ctx: CvContext,
  input: CvEntryInput,
  access: CvAccess,
): Promise<CvEntryRecord> {
  const entry = checkEntry(input);
  await lock(ctx.tx, `cv-entries:${ctx.studentId}`);
  await requireCv(ctx, access, 'cv.draft');
  const [n] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(cvEntries)
    .where(eq(cvEntries.kind, entry.kind));
  if ((n?.n ?? 0) >= CV_ENTRY_LIMIT) throw new CvStateError('cv-limit');
  // Last, after every entry the learner has: the order they added them in.
  const [last] = await ctx.tx
    .select({ at: sql<number | null>`max(${cvEntries.position})::int` })
    .from(cvEntries);
  const [row] = await ctx.tx
    .insert(cvEntries)
    .values({
      ...entry,
      studentId: ctx.studentId,
      position: Math.min(279, (last?.at ?? -1) + 1),
      createdAt: ctx.now,
      updatedAt: ctx.now,
    })
    .returning();
  if (!row) throw new Error('Could not save the entry');
  await ctx.audit('cv.entry-saved', entry.kind);
  return toEntry(row);
}

export async function updateCvEntry(
  ctx: CvContext,
  id: string,
  patch: CvEntryPatch,
  access: CvAccess,
): Promise<CvEntryRecord> {
  if (!UUID.test(id)) throw new NotFoundError('No such CV entry');
  const [current] = await ctx.tx.select().from(cvEntries).where(eq(cvEntries.id, id));
  if (!current) throw new NotFoundError('No such CV entry');
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const merged = checkEntry({ ...toEntry(current), ...given, kind: current.kind });
  await requireCv(ctx, access, 'cv.draft');
  const [row] = await ctx.tx
    .update(cvEntries)
    .set({ ...merged, updatedAt: ctx.now })
    .where(eq(cvEntries.id, id))
    .returning();
  if (!row) throw new NotFoundError('No such CV entry');
  await ctx.audit('cv.entry-saved', current.kind);
  return toEntry(row);
}

export async function deleteCvEntry(ctx: CvContext, id: string): Promise<void> {
  if (!UUID.test(id)) throw new NotFoundError('No such CV entry');
  const rows = await ctx.tx
    .delete(cvEntries)
    .where(eq(cvEntries.id, id))
    .returning({ id: cvEntries.id });
  if (rows.length === 0) throw new NotFoundError('No such CV entry');
  await ctx.audit('cv.entry-deleted');
}

// ── What is ticked (D9, D11) ────────────────────────────────────────────────────────────────────

export async function readCvSelection(tx: Tx): Promise<CvSelection> {
  const [row] = await tx.select().from(cvSelections);
  if (!row) return EMPTY_SELECTION;
  const { studentId: _s, updatedAt: _u, ...selection } = row;
  return selection;
}

export async function saveCvSelection(
  ctx: CvContext,
  input: CvSelection,
  access: CvAccess,
): Promise<CvSelection> {
  const email = clean(input.email);
  const phone = clean(input.phone);
  if (email !== null && (!isEmail(email) || holdsPersonalNumber(email))) {
    throw new InvalidStateError('Not an e-mail address');
  }
  if (phone !== null && !isContactPhone(phone)) throw new InvalidStateError('Not a phone number');
  const subjectIds = [...new Set(input.subjectIds)];
  const moduleCodes = [...new Set(input.moduleCodes.map((c) => c.trim()))];
  const entryIds = [...new Set(input.entryIds)];
  if (subjectIds.length > 12 || !subjectIds.every((s) => SUBJECT_ID.test(s))) {
    throw new InvalidStateError('Not a subject');
  }
  if (moduleCodes.length > CV_LIMITS.modules || !moduleCodes.every((c) => MODULE_CODE.test(c))) {
    throw new InvalidStateError('Not a module code');
  }
  if (entryIds.length > 280 || !entryIds.every((id) => UUID.test(id))) {
    throw new InvalidStateError('Not an entry');
  }
  const values = {
    surname: checkText(clean(input.surname), CV_LIMITS.name),
    label: checkText(clean(input.label), CV_LIMITS.label),
    summary: checkText(clean(input.summary), CV_LIMITS.summary),
    email,
    phone,
    city: checkText(clean(input.city), CV_LIMITS.name),
    region: checkText(clean(input.region), CV_LIMITS.name),
    includeSchool: input.includeSchool,
    subjectIds,
    includeOffer: input.includeOffer,
    moduleCodes,
    entryIds,
    updatedAt: ctx.now,
  };
  await requireCv(ctx, access, 'cv.draft');
  await ctx.tx
    .insert(cvSelections)
    .values({ studentId: ctx.studentId, ...values })
    .onConflictDoUpdate({ target: cvSelections.studentId, set: values });
  await ctx.audit('cv.selection-saved');
  return readCvSelection(ctx.tx);
}

// ── CVs (§5.3) ──────────────────────────────────────────────────────────────────────────────────

export async function readCvDocuments(tx: Tx): Promise<CvDocumentRecord[]> {
  const rows = await tx
    .select()
    .from(cvDocuments)
    .orderBy(desc(cvDocuments.createdAt), desc(cvDocuments.id));
  return rows.map(toDocument);
}

export async function readCvDocument(tx: Tx, id: string): Promise<CvDocumentRecord | null> {
  if (!UUID.test(id)) return null;
  const [row] = await tx.select().from(cvDocuments).where(eq(cvDocuments.id, id));
  return row ? toDocument(row) : null;
}

/** The PDF's key and hash, for the server alone (serving it to its owner, a share link). */
export async function readCvFile(
  tx: Tx,
  id: string,
): Promise<{ readonly fileKey: string; readonly sha256: string | null } | null> {
  if (!UUID.test(id)) return null;
  const [row] = await tx
    .select({ fileKey: cvDocuments.fileKey, sha256: cvDocuments.sha256 })
    .from(cvDocuments)
    .where(and(eq(cvDocuments.id, id), eq(cvDocuments.status, 'ready')));
  return row?.fileKey ? { fileKey: row.fileKey, sha256: row.sha256 } : null;
}

function checkAdvert(advert: CvAdvert) {
  const title = checkText(clean(advert.title), CV_LIMITS.title);
  if (title === null) throw new InvalidStateError('An advert needs a title');
  const text = advert.text.trim();
  if (text.length === 0 || text.length > CV_LIMITS.advert) {
    throw new InvalidStateError('An advert is 1 to 20,000 characters');
  }
  // The advert is someone else's text, kept only until the job ends (D13), but an ID number
  // pasted into it is still never stored.
  if (holdsPersonalNumber(text)) throw new PersonalNumberError();
  return { title, company: checkText(clean(advert.company), CV_LIMITS.title), text };
}

/** Queues a CV: one at a time (§11). The job carries this row's id only. */
export async function requestCvDocument(
  ctx: CvContext,
  input: CvRequest,
  access: CvAccess,
): Promise<CvDocumentRecord> {
  const advert = input.kind === 'tailored' ? checkAdvert(input.advert) : null;
  await lock(ctx.tx, `cv-documents:${ctx.studentId}`);
  await requireCv(ctx, access, input.kind === 'tailored' ? 'cv.tailor' : 'cv.draft');
  const [busy] = await ctx.tx
    .select({ id: cvDocuments.id })
    .from(cvDocuments)
    .where(inArray(cvDocuments.status, ['queued', 'submitted']));
  if (busy) throw new CvBusyError();
  const [row] = await ctx.tx
    .insert(cvDocuments)
    .values({
      studentId: ctx.studentId,
      kind: input.kind,
      status: 'queued',
      advertTitle: advert?.title ?? null,
      advertCompany: advert?.company ?? null,
      advertText: advert?.text ?? null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    })
    .returning();
  if (!row) throw new Error('Could not queue the CV');
  await ctx.audit(input.kind === 'tailored' ? 'cv.tailor.requested' : 'cv.draft.requested');
  return toDocument(row);
}

/** "Every line is true" (§10.6): needed before a CV can be shared. */
export async function confirmCvDocument(
  ctx: CvContext,
  id: string,
  access: CvAccess,
): Promise<CvDocumentRecord> {
  const doc = await readCvDocument(ctx.tx, id);
  if (!doc) throw new NotFoundError('No such CV');
  if (doc.status !== 'ready') throw new CvStateError('cv-not-ready');
  await requireCv(ctx, access, doc.kind === 'tailored' ? 'cv.tailor' : 'cv.draft');
  const [row] = await ctx.tx
    .update(cvDocuments)
    .set({ confirmedAt: ctx.now, updatedAt: ctx.now })
    .where(eq(cvDocuments.id, id))
    .returning();
  await ctx.audit('cv.confirmed');
  return toDocument(row as DocumentRow);
}

/**
 * What `cv.submit` sends, read under the learner's consent at the moment the job runs (§5.3): a
 * learner deleted, past consent or withdrawn yields nothing to send. Null for a CV that isn't
 * waiting to be sent.
 */
export async function readCvSubmission(
  ctx: CvContext,
  id: string,
  access: CvAccess,
): Promise<CvSubmission | null> {
  if (!UUID.test(id)) return null;
  const [row] = await ctx.tx.select().from(cvDocuments).where(eq(cvDocuments.id, id));
  if (!row || (row.status !== 'queued' && row.status !== 'submitted')) return null;
  await requireCv(ctx, access, row.kind === 'tailored' ? 'cv.tailor' : 'cv.draft');
  const link = await activeLink(ctx.tx);
  if (!link) throw new CvConsentError();
  const [student] = await ctx.tx
    .select({ dob: students.dateOfBirth })
    .from(students)
    .where(eq(students.id, ctx.studentId));
  const adult = student?.dob ? ageOn(student.dob, sastDate(ctx.now)) >= AGE_OF_MAJORITY : false;
  return {
    document: { id: row.id, kind: row.kind, status: row.status, engineJobId: row.engineJobId },
    advert:
      row.kind === 'tailored' && row.advertTitle && row.advertText
        ? { title: row.advertTitle, company: row.advertCompany, description: row.advertText }
        : null,
    link: {
      id: link.id,
      learnerRef: link.learnerRef,
      consentVersion: link.consentVersion,
      // Sharing is never sent for an under-18 (§9.3), whatever the row says.
      purposes: (link.purposes as CvPurpose[]).filter((p) => adult || p !== 'cv.share'),
    },
    ageBand: adult ? '18-plus' : 'under-18',
  };
}

/** The consent half of an engine envelope, for a call made in the learner's request (an ATS scan). */
export interface CvConsentRecord {
  readonly ref: string;
  readonly learnerRef: string;
  readonly version: string;
  readonly purposes: ReadonlyArray<CvPurpose>;
  readonly ageBand: 'under-18' | '18-plus';
}

export async function readCvConsent(
  ctx: CvContext,
  purpose: CvPurpose,
  access: CvAccess,
): Promise<CvConsentRecord> {
  await requireCv(ctx, access, purpose);
  const link = await activeLink(ctx.tx);
  if (!link) throw new CvConsentError();
  const [student] = await ctx.tx
    .select({ dob: students.dateOfBirth })
    .from(students)
    .where(eq(students.id, ctx.studentId));
  const adult = student?.dob ? ageOn(student.dob, sastDate(ctx.now)) >= AGE_OF_MAJORITY : false;
  return {
    ref: link.id,
    learnerRef: link.learnerRef,
    version: link.consentVersion,
    purposes: (link.purposes as CvPurpose[]).filter((p) => adult || p !== 'cv.share'),
    ageBand: adult ? '18-plus' : 'under-18',
  };
}

export async function markCvSubmitted(
  ctx: CvContext,
  id: string,
  engineJobId: string,
  access: CvAccess,
): Promise<void> {
  if (!UUID.test(id) || !ENGINE_ID.test(engineJobId)) throw new InvalidStateError('Not an id');
  const [row] = await ctx.tx.select().from(cvDocuments).where(eq(cvDocuments.id, id));
  if (!row) throw new NotFoundError('No such CV');
  await requireCv(ctx, access, row.kind === 'tailored' ? 'cv.tailor' : 'cv.draft');
  await ctx.tx
    .update(cvDocuments)
    .set({ status: 'submitted', engineJobId, updatedAt: ctx.now })
    .where(and(eq(cvDocuments.id, id), eq(cvDocuments.status, 'queued')));
}

/**
 * Keeps a finished CV (the collect job, §5.3): its text, gaps, ATS numbers and the PDF's key and
 * hash, and lets go of the advert's text (D13). Idempotent: a CV already kept is left as it is,
 * and false says so (the webhook and the poll may both collect).
 */
export async function storeCvResult(
  ctx: CvContext,
  id: string,
  result: CvResult,
  access: CvAccess,
): Promise<boolean> {
  if (!FILE_KEY.test(result.fileKey)) throw new InvalidStateError('Not a CV file key');
  const [row] = await ctx.tx.select().from(cvDocuments).where(eq(cvDocuments.id, id));
  if (!row) throw new NotFoundError('No such CV');
  if (row.status === 'ready' || row.status === 'failed') return false;
  await requireCv(ctx, access, row.kind === 'tailored' ? 'cv.tailor' : 'cv.draft');
  const words = (list: ReadonlyArray<string>) => list.slice(0, 200).map((w) => w.slice(0, 80));
  await ctx.tx
    .update(cvDocuments)
    .set({
      status: 'ready',
      markdown: result.markdown.slice(0, 40_000),
      gaps: result.gaps.slice(0, 20).map((g) => g.slice(0, 300)),
      atsCoverage: result.ats
        ? Math.max(0, Math.min(100, Math.round(result.ats.coveragePct)))
        : null,
      atsMatched: words(result.ats?.matched ?? []),
      atsMissing: words(result.ats?.missing ?? []),
      atsMissingMust: words(result.ats?.missingMustHaves ?? []),
      fileKey: result.fileKey,
      sha256: result.sha256,
      bytes: result.bytes,
      advertText: null,
      finishedAt: ctx.now,
      updatedAt: ctx.now,
    })
    .where(eq(cvDocuments.id, id));
  await ctx.audit('cv.collected');
  return true;
}

// ── Recruiter links (§9.3) ──────────────────────────────────────────────────────────────────────

export async function readCvShares(tx: Tx): Promise<CvShareRecord[]> {
  const rows = await tx.select().from(cvShares).orderBy(desc(cvShares.createdAt));
  return rows.map(toShare);
}

export async function createCvShare(
  ctx: CvContext,
  documentId: string,
  days: number,
  access: CvAccess,
): Promise<{ readonly share: CvShareRecord; readonly token: string }> {
  if (!Number.isInteger(days) || days < CV_SHARE_DAYS.min || days > CV_SHARE_DAYS.max) {
    throw new InvalidStateError('A link lasts 7 to 90 days');
  }
  if (access.preview) await ctx.tx.execute(sql`select set_config('uf.cv', 'preview', true)`);
  const [may] = rowsOf<{ ok: boolean }>(
    await ctx.tx.execute(sql`select uf_cv_may_share(${ctx.studentId}::uuid) as ok`),
  );
  if (may?.ok !== true) throw new CvShareError('cv-share-age');
  const doc = await readCvDocument(ctx.tx, documentId);
  if (!doc) throw new NotFoundError('No such CV');
  if (doc.status !== 'ready' || doc.confirmedAt === null) {
    throw new CvShareError('cv-share-unchecked');
  }
  const token = newToken();
  const [row] = await ctx.tx
    .insert(cvShares)
    .values({
      studentId: ctx.studentId,
      documentId,
      tokenHash: hashToken(token),
      createdAt: ctx.now,
      expiresAt: new Date(ctx.now.getTime() + days * 24 * 60 * 60 * 1000),
    })
    .returning();
  await ctx.audit('cv.share.created');
  return { share: toShare(row as typeof cvShares.$inferSelect), token };
}

export async function revokeCvShare(ctx: CvContext, id: string): Promise<void> {
  if (!UUID.test(id)) throw new NotFoundError('No such link');
  const rows = await ctx.tx
    .update(cvShares)
    .set({ revokedAt: ctx.now })
    .where(and(eq(cvShares.id, id), isNull(cvShares.revokedAt)))
    .returning({ id: cvShares.id });
  if (rows.length === 0) throw new NotFoundError('No such link');
  await ctx.audit('cv.share.revoked');
}

// ── Reports of a fitted CV (A10-58, migration 0039) ────────────────────────────────────────────

export type CvReportOutcome = { readonly status: 'reported' | 'already-reported' };

/**
 * The learner reports one of their fitted CVs, which an AI wrote, for a person to look at (§11,
 * A10-35's pattern): by its id, with a reason from the fixed list, once (hard rule 4: no text of
 * its own). A base CV has no AI in it (D7), and a CV still being made has nothing to report yet.
 * Only their own CVs are reachable (row-level security), and nothing before consent (hard rule 5).
 */
export async function reportCvDocument(
  ctx: CvContext,
  id: string,
  reason: CvReportReason,
): Promise<CvReportOutcome> {
  if (!isCvReportReason(reason)) throw new InvalidStateError('Not a reason to report');
  const doc = await readCvDocument(ctx.tx, id);
  if (!doc) throw new NotFoundError('No such CV');
  if (doc.kind !== 'tailored') throw new InvalidStateError('Only a fitted CV can be reported');
  if (doc.status !== 'ready') throw new CvStateError('cv-not-ready');
  const added = await ctx.tx
    .insert(cvReports)
    .values({ studentId: ctx.studentId, documentId: id, reason })
    .onConflictDoNothing()
    .returning({ id: cvReports.id });
  if (added.length === 0) return { status: 'already-reported' };
  await ctx.audit('cv.reported', reason);
  return { status: 'reported' };
}

/** The ids of the CVs the learner has reported, so the page can show them as reported. */
export async function readReportedCvDocuments(tx: Tx): Promise<string[]> {
  const rows = await tx
    .select({ documentId: cvReports.documentId })
    .from(cvReports)
    .orderBy(asc(cvReports.createdAt));
  return rows.map((r) => r.documentId);
}

/** Every CV table as stored, for Download my data (POPIA s23): no file key, no token hash. */
export async function exportCv(tx: Tx) {
  const links = await tx.select().from(cvLinks).orderBy(asc(cvLinks.optedInAt));
  const entries = await tx.select().from(cvEntries).orderBy(asc(cvEntries.createdAt));
  const selection = (await tx.select().from(cvSelections))[0] ?? null;
  const documents = (await tx.select().from(cvDocuments).orderBy(asc(cvDocuments.createdAt))).map(
    ({ fileKey: _key, ...d }) => d,
  );
  const shares = (await tx.select().from(cvShares).orderBy(asc(cvShares.createdAt))).map(
    ({ tokenHash: _hash, ...s }) => s,
  );
  // Reports of a fitted CV (0039): ids and reasons.
  const reports = await tx.select().from(cvReports).orderBy(asc(cvReports.createdAt));
  return { links, entries, selection, documents, shares, reports };
}

// ── As the owner: withdrawal, deletion and the jobs (§7.3) ─────────────────────────────────────

/**
 * Inside an owner transaction: switches the learner's live opt-in off, drops their share links
 * at once, and leaves a tombstone per reference so the deletion reaches Mmereko after the student
 * row is gone. Returns the tombstones' ids.
 */
export async function tombstoneCv(tx: Tx, studentId: string, now: Date): Promise<string[]> {
  const ended = await tx
    .update(cvLinks)
    .set({ withdrawnAt: now })
    .where(and(eq(cvLinks.studentId, studentId), isNull(cvLinks.withdrawnAt)))
    .returning({ learnerRef: cvLinks.learnerRef });
  await tx.delete(cvShares).where(eq(cvShares.studentId, studentId));
  if (ended.length === 0) return [];
  const rows = await tx
    .insert(cvDeletions)
    .values(ended.map(({ learnerRef }) => ({ learnerRef, requestedAt: now })))
    .returning({ id: cvDeletions.id });
  return rows.map((r) => r.id);
}

/** Drops the queued CV jobs of these documents (owner's table): ids in payloads only. */
export async function dropCvJobs(tx: Tx, studentId: string): Promise<void> {
  await tx.execute(sql`
    delete from jobs
    where payload ->> 'cvDocumentId' in (
      select id::text from cv_documents where student_id = ${studentId}::uuid)`);
}

/**
 * "Stop using Mmereko" (§7.3, D15): every share link off at once, the deletion sent to Mmereko by
 * a tombstone, then UniversityFlow's own CV data deleted: entries, ticks, CVs. The opt-in row
 * stays, withdrawn, as the record of it (no CV content). Runs as the owner, filtered to the
 * learner: a learner whose consent lapsed can still withdraw. Returns the PDFs' keys (the caller
 * deletes the files) and the tombstones' ids (the caller schedules them).
 */
export async function withdrawCv(
  db: Db,
  studentId: string,
  now: Date,
): Promise<{ readonly fileKeys: string[]; readonly deletionIds: string[] }> {
  return db.transaction(async (tx) => {
    await lock(tx, `cv:${studentId}`);
    const deletionIds = await tombstoneCv(tx, studentId, now);
    await dropCvJobs(tx, studentId);
    const files = await tx
      .delete(cvDocuments)
      .where(eq(cvDocuments.studentId, studentId))
      .returning({ key: cvDocuments.fileKey });
    await tx.delete(cvEntries).where(eq(cvEntries.studentId, studentId));
    await tx.delete(cvSelections).where(eq(cvSelections.studentId, studentId));
    await tx.insert(auditLog).values({
      actorType: 'student',
      actorId: studentId,
      studentId,
      action: 'cv.opt-out',
    });
    return {
      fileKeys: files.flatMap((f) => (f.key ? [f.key] : [])),
      deletionIds,
    };
  });
}

/**
 * Deletes one of the learner's CVs (A11-38; D13: "the CVs until the learner deletes them"): its
 * text, gaps, ATS numbers, a fitted CV's advert title and company, and, by cascade, its share
 * links (off at once) and its report. Runs as the owner, filtered to the learner, as withdrawal
 * does: a learner whose consent lapsed can still take their data back. A CV still being made is
 * refused (its job holds the id; Mmereko deletes its own copy within the day, §7.2). Returns the
 * PDF's key, or null: the caller deletes the file.
 */
export async function deleteCvDocument(
  db: Db,
  studentId: string,
  id: string,
): Promise<{ readonly fileKey: string | null }> {
  if (!UUID.test(id)) throw new NotFoundError('No such CV');
  return db.transaction(async (tx) => {
    await lock(tx, `cv-documents:${studentId}`);
    const [row] = await tx
      .select({ status: cvDocuments.status })
      .from(cvDocuments)
      .where(and(eq(cvDocuments.id, id), eq(cvDocuments.studentId, studentId)));
    if (!row) throw new NotFoundError('No such CV');
    if (row.status === 'queued' || row.status === 'submitted') throw new CvBusyError();
    const [gone] = await tx
      .delete(cvDocuments)
      .where(and(eq(cvDocuments.id, id), eq(cvDocuments.studentId, studentId)))
      .returning({ key: cvDocuments.fileKey });
    await tx.insert(auditLog).values({
      actorType: 'student',
      actorId: studentId,
      studentId,
      action: 'cv.deleted',
    });
    return { fileKey: gone?.key ?? null };
  });
}

export interface CvDeletionRecord {
  readonly id: string;
  readonly learnerRef: string;
  readonly requestedAt: Date;
  readonly engineDeletionId: string | null;
  readonly confirmedAt: Date | null;
}

/**
 * What the CV jobs, the webhook and the public share page use, by id, as the owner: never a
 * learner's request. Ids in, ids and states out.
 */
export class CvJobStore {
  readonly #db: Db;
  readonly #clock: () => Date;

  constructor(db: Db, clock: () => Date) {
    this.#db = db;
    this.#clock = clock;
  }

  /** The learner a CV belongs to, or null (deleted, or never there). */
  async ownerOfDocument(documentId: string): Promise<string | null> {
    if (!UUID.test(documentId)) return null;
    const [row] = await this.#db
      .select({ studentId: cvDocuments.studentId })
      .from(cvDocuments)
      .where(eq(cvDocuments.id, documentId));
    return row?.studentId ?? null;
  }

  /** A CV's state, as the jobs see it (no consent needed to know a row's state): ids and codes. */
  async stateOf(documentId: string): Promise<{
    readonly status: CvDocumentStatus;
    readonly problem: string | null;
    readonly engineJobId: string | null;
  } | null> {
    if (!UUID.test(documentId)) return null;
    const [row] = await this.#db
      .select({
        status: cvDocuments.status,
        problem: cvDocuments.problem,
        engineJobId: cvDocuments.engineJobId,
      })
      .from(cvDocuments)
      .where(eq(cvDocuments.id, documentId));
    return row ?? null;
  }

  /** A ready CV's PDF key, for the signed-link route (the link was checked first), or null. */
  async fileOf(documentId: string): Promise<string | null> {
    if (!UUID.test(documentId)) return null;
    const [row] = await this.#db
      .select({ fileKey: cvDocuments.fileKey })
      .from(cvDocuments)
      .where(and(eq(cvDocuments.id, documentId), eq(cvDocuments.status, 'ready')));
    return row?.fileKey ?? null;
  }

  /** The CV an engine job is for, or null: an unknown job id is ignored (§11). */
  async documentForEngineJob(engineJobId: string): Promise<string | null> {
    if (!ENGINE_ID.test(engineJobId)) return null;
    const [row] = await this.#db
      .select({ id: cvDocuments.id })
      .from(cvDocuments)
      .where(eq(cvDocuments.engineJobId, engineJobId));
    return row?.id ?? null;
  }

  /**
   * "Couldn't be made": the CV fails with a problem code and lets go of the advert (D13). Needs no
   * consent, so a job that finds consent gone can still close it. A finished CV is left alone.
   */
  async closeDocument(documentId: string, problem: string): Promise<void> {
    if (!UUID.test(documentId)) return;
    const code = /^[a-z_]{1,40}$/.test(problem) ? problem : 'server_error';
    await this.#db
      .update(cvDocuments)
      .set({ status: 'failed', problem: code, advertText: null, finishedAt: this.#clock() })
      .where(
        and(eq(cvDocuments.id, documentId), inArray(cvDocuments.status, ['queued', 'submitted'])),
      );
  }

  /**
   * The CV behind a share link, counting the view, or null: no such token, switched off, expired,
   * or its learner may no longer share (under 18 is impossible; consent gone, opt-in withdrawn).
   */
  async openShare(
    token: string,
    access: CvAccess = { preview: false },
  ): Promise<{ readonly documentId: string; readonly fileKey: string } | null> {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
    const now = this.#clock();
    return this.#db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.today', ${sastDate(now)}, true)`);
      if (access.preview) await tx.execute(sql`select set_config('uf.cv', 'preview', true)`);
      const [share] = await tx
        .select()
        .from(cvShares)
        .where(and(eq(cvShares.tokenHash, hashToken(token)), isNull(cvShares.revokedAt)));
      if (!share || share.expiresAt.getTime() <= now.getTime()) return null;
      const [allowed] = rowsOf<{ ok: boolean }>(
        await tx.execute(sql`select uf_cv_share_allowed(${share.studentId}::uuid) as ok`),
      );
      if (allowed?.ok !== true) return null;
      const [doc] = await tx
        .select({ fileKey: cvDocuments.fileKey })
        .from(cvDocuments)
        .where(and(eq(cvDocuments.id, share.documentId), eq(cvDocuments.status, 'ready')));
      if (!doc?.fileKey) return null;
      await tx
        .update(cvShares)
        .set({ viewCount: sql`${cvShares.viewCount} + 1` })
        .where(eq(cvShares.id, share.id));
      await tx.insert(auditLog).values({
        actorType: 'system',
        studentId: share.studentId,
        action: 'cv.share.viewed',
      });
      return { documentId: share.documentId, fileKey: doc.fileKey };
    });
  }

  async deletion(id: string): Promise<CvDeletionRecord | null> {
    if (!UUID.test(id)) return null;
    const [row] = await this.#db.select().from(cvDeletions).where(eq(cvDeletions.id, id));
    if (!row) return null;
    return {
      id: row.id,
      learnerRef: row.learnerRef,
      requestedAt: row.requestedAt,
      engineDeletionId: row.engineDeletionId,
      confirmedAt: row.confirmedAt,
    };
  }

  /**
   * The tombstones no job has been scheduled for yet, marked as scheduled in the same statement:
   * the caller schedules `cv.delete-learner` for each (after an account deletion, a withdrawal,
   * a guardian's withdrawal, and at server start).
   */
  async deletionsToSchedule(): Promise<string[]> {
    const rows = await this.#db
      .update(cvDeletions)
      .set({ scheduledAt: this.#clock() })
      .where(and(isNull(cvDeletions.scheduledAt), isNull(cvDeletions.confirmedAt)))
      .returning({ id: cvDeletions.id });
    return rows.map((r) => r.id);
  }

  async noteDeletionRequested(id: string, engineDeletionId: string): Promise<void> {
    if (!UUID.test(id) || !ENGINE_ID.test(engineDeletionId)) return;
    await this.#db.update(cvDeletions).set({ engineDeletionId }).where(eq(cvDeletions.id, id));
  }

  /** The operator confirmed it: the tombstone is the record that the deletion reached it. */
  async confirmDeletion(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.#db
      .update(cvDeletions)
      .set({ confirmedAt: this.#clock() })
      .where(and(eq(cvDeletions.id, id), isNull(cvDeletions.confirmedAt)));
  }
}
