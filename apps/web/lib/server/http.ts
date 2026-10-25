import 'server-only';
import { CvEngineError } from '@universityflow/cv';
import {
  AdultsOnlyError,
  ConsentOutdatedError,
  ConsentRequiredError,
  CvConsentError,
  CvShareError,
  CvStateError,
  GuardianOptedOutError,
  InvalidCodeError,
  InvalidPhoneError,
  InvalidStateError,
  NotFoundError,
  OfferConflictError,
  PersonalNumberError,
  PhotoConsentError,
  PinLockedError,
  PlanMapLimitError,
  PlanWordsError,
  RateLimitedError,
  TooYoungError,
} from '@universityflow/db';
import { InvalidPhotoError, InvalidUploadError } from '@universityflow/documents';
import { SmsBudgetExceededError } from '@universityflow/messaging';
import type { z } from 'zod';
import { stagingGate } from '../staging-gate';
import { ConfigError, isDemo, isProduction, logConfigRefusal } from './config';
import { currentStudent, isReady, type Signed } from './session';

/**
 * Route handler plumbing: one error shape, the same-origin check, and the auth guards.
 * Errors carry a code the client maps to a string in packages/content; nothing is logged with
 * personal data (hard rule 4).
 */

export type ErrorCode =
  | 'invalid'
  | 'phone'
  | 'pin'
  | 'expired'
  | 'rate-limited'
  | 'pin-locked'
  | 'signed-out'
  | 'consent'
  | 'consent-outdated'
  | 'not-found'
  | 'state'
  | 'upload'
  | 'sms-unavailable'
  | 'guardian-opted-out'
  | 'speech-unavailable'
  | 'cv-unavailable'
  // A demo whose configuration the server refuses (503): its pages say it isn't set up yet.
  | 'not-set-up'
  | 'forbidden'
  | 'server';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly detail?: string,
    /** The refused value's path in the request body (A2-52), never the value. */
    readonly field?: string,
  ) {
    super(code);
  }
}

/** A path like `description`, `advert.text` or `evidence.0.label`: nothing else is passed on. */
const FIELD_PATH = /^[A-Za-z][A-Za-z0-9]{0,39}(?:\.(?:[A-Za-z][A-Za-z0-9]{0,39}|\d{1,3})){0,3}$/;

/**
 * The field a refusal is about, when the check that refused it says (A2-52, WCAG 3.3.1): its
 * `field`, if that is a plain path. The page puts the message on that field.
 */
function fieldOf(error: unknown): string | undefined {
  const field = error instanceof Error ? (error as { field?: unknown }).field : undefined;
  return typeof field === 'string' && FIELD_PATH.test(field) ? field : undefined;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
  });
}

function toHttp(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof InvalidPhoneError) return new HttpError(400, 'phone');
  if (error instanceof InvalidCodeError) {
    return new HttpError(400, error.message.includes('expired') ? 'expired' : 'pin');
  }
  if (error instanceof PinLockedError) return new HttpError(429, 'pin-locked');
  if (error instanceof RateLimitedError) return new HttpError(429, 'rate-limited');
  if (error instanceof ConsentRequiredError) return new HttpError(403, 'consent');
  // The consent was given to wording that didn't cover this (messaging, A11-01; offer letters and
  // proofs of registration, A11-13): the app says why, and the detail says which.
  if (error instanceof ConsentOutdatedError) {
    return error.purpose === 'messaging'
      ? new HttpError(403, 'consent-outdated')
      : new HttpError(403, 'consent-outdated', error.purpose);
  }
  if (error instanceof NotFoundError) return new HttpError(404, 'not-found');
  // An offer the learner's other offers rule out (Phase 5a): the reason says which.
  if (error instanceof OfferConflictError) return new HttpError(409, 'state', error.reason);
  // An ID or student number in a condition or a module row (A11-17): never stored, and the
  // learner is told what to take out.
  if (error instanceof PersonalNumberError) return new HttpError(409, 'state', error.reason);
  // A date of birth under 13 (A11-24): the learner is told why.
  if (error instanceof TooYoungError) return new HttpError(409, 'state', error.reason);
  // The judge demo's real sign-up is adults only (a hackathon exception, docs/deploy/demo.md).
  if (error instanceof AdultsOnlyError) return new HttpError(409, 'state', error.reason);
  // My plan maps: a limit (D8), or words that wait for the consent wording (D2): the reason says
  // which, so the page explains it.
  if (error instanceof PlanMapLimitError) return new HttpError(409, 'state', error.reason);
  if (error instanceof PlanWordsError) return new HttpError(409, 'state', error.reason);
  // My CV (packages/content `cv.errors`): wording that doesn't name Mmereko yet, or no opt-in for
  // this; a share an under-18 (or an unchecked CV) may not have; a CV's state.
  if (error instanceof CvConsentError) return new HttpError(403, 'consent-outdated', error.reason);
  // The profile photo (A11-31): wording that doesn't name it yet (packages/content profilePhoto).
  if (error instanceof PhotoConsentError) {
    return new HttpError(403, 'consent-outdated', error.reason);
  }
  if (error instanceof CvShareError) return new HttpError(403, 'forbidden', error.reason);
  if (error instanceof CvStateError) return new HttpError(409, 'state', error.reason);
  // The CV engine couldn't answer (an ATS scan, made in the request): its problem code only.
  if (error instanceof CvEngineError) return new HttpError(503, 'cv-unavailable', error.code);
  if (error instanceof InvalidStateError) return new HttpError(409, 'state');
  if (error instanceof InvalidUploadError) return new HttpError(400, 'upload', error.reason);
  // A profile photo refused (too big, not a JPEG or PNG, a HEIC, a bad crop): the reason says which.
  if (error instanceof InvalidPhotoError) return new HttpError(400, 'upload', error.reason);
  // The global SMS budget is spent (open finding 1): fail closed, with a sentence that doesn't
  // blame the learner's number.
  if (error instanceof SmsBudgetExceededError) return new HttpError(503, 'sms-unavailable');
  // The guardian's number replied STOP (A12-04): the learner is told plainly, and can name another.
  if (error instanceof GuardianOptedOutError) return new HttpError(409, 'guardian-opted-out');
  return new HttpError(500, 'server');
}

/**
 * Wraps a handler: maps known errors to responses; unknown ones become a bare 500. On a staging
 * site it first needs the access gate's password (A5-10): every API route but /api/health goes
 * through here (staging-gate.test.ts holds them to it).
 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const shut = stagingGate(args[0] instanceof Request ? args[0] : null);
    if (shut) return shut;
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ConfigError) {
        // The server refused its configuration: one line that says why, for the owner (variable
        // names only). A demo's pages explain "not set up yet"; production answers as before.
        logConfigRefusal(error);
        if (isDemo()) return json({ error: 'not-set-up', detail: null }, { status: 503 });
        return json({ error: 'server', detail: null }, { status: 500 });
      }
      const http = toHttp(error);
      if (http.status === 500) {
        // The error name only: messages and stacks can carry personal data (hard rule 4).
        // UF_DEBUG_ERRORS=1 prints the whole error, for local debugging with synthetic data;
        // never on the deployed site.
        const debug = process.env['UF_DEBUG_ERRORS'] === '1' && !isProduction();
        console.error(
          'request failed:',
          debug ? error : error instanceof Error ? error.name : 'unknown',
        );
      }
      const field = http.status < 500 ? (http.field ?? fieldOf(error)) : undefined;
      return json(
        { error: http.code, detail: http.detail ?? null, ...(field ? { field } : {}) },
        { status: http.status },
      );
    }
  };
}

/** The mobile app identifies itself with this header (and asks for its token at sign-in). */
export const NATIVE_CLIENT_HEADER = 'x-uf-client';

/**
 * A request from the mobile app before it has a token (request-pin, verify-pin): it says so, and
 * it carries neither an Origin nor a Cookie. CSRF needs a browser that attaches ambient cookies,
 * and browsers always send Origin on a cross-site POST, so a request with neither can't be a
 * forged one riding a learner's session. A page script can set the header, but not remove the
 * Origin its browser adds; anything with a Cookie still has to prove its origin.
 */
function isNativePreAuth(request: Request): boolean {
  return (
    request.headers.get(NATIVE_CLIENT_HEADER) === 'native' &&
    !request.headers.has('origin') &&
    !request.headers.has('cookie')
  );
}

/**
 * Cookie-authenticated writes must come from our own pages (CSRF). Requests carrying a bearer
 * token (the mobile app) can't be forged by another site, so they are exempt, and so is the
 * mobile app's sign-in before it has a token (`isNativePreAuth`).
 */
export function assertSameOrigin(request: Request): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  if (request.headers.get('authorization')?.startsWith('Bearer ')) return;
  if (isNativePreAuth(request)) return;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    // "null" and other unparseable origins are refused like a missing one (finding 8).
  }
  if (!originHost || !host || originHost !== host) throw new HttpError(403, 'forbidden');
}

/** The caller's IP, from the platform's proxy header. Used only as a hashed rate-limit key. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}

/**
 * Per-learner limits on paid work (model calls and document reading, finding 6), and on reports
 * of AI replies (A10-35), each of which a person reads: plenty for real use, not a flood.
 */
export const QUOTAS = {
  chat: { max: 60, windowMs: 60 * 60 * 1000 },
  upload: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  replyReport: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  // Read aloud (2026-10-22): each request counts, a byte range included (a phone or Safari asks
  // for one audio file in two or three), so this is about 40 places read an hour.
  speech: { max: 120, windowMs: 60 * 60 * 1000 },
  // Profile photos (profile-look-proposal §5.3): each one is decoded and re-encoded.
  photo: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  // My CV (§5.2): our own per-learner limits, in front of Mmereko's, so a learner sees our
  // message long before Mmereko's limit.
  cvDraft: { max: 5, windowMs: 24 * 60 * 60 * 1000 },
  cvTailor: { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  cvAts: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  // "Report this CV" (A10-58): a person reads each, as a reported reply.
  cvReport: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
  // Recruiter links made (CV-A5 A5-21): each is a row; one per application is far below this.
  cvShare: { max: 20, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'invalid');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'invalid');
  return parsed.data;
}

/** Any signed-in student, ready or not (onboarding, export, delete). */
export async function requireSignedIn(request: Request): Promise<Signed> {
  assertSameOrigin(request);
  const signed = await currentStudent();
  if (!signed) throw new HttpError(401, 'signed-out');
  return signed;
}

/** A signed-in student whose data may be processed (hard rule 5). */
export async function requireReady(request: Request): Promise<Signed> {
  const signed = await requireSignedIn(request);
  if (!isReady(signed.account)) throw new HttpError(403, 'consent');
  return signed;
}
