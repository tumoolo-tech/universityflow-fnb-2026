import { en } from '@universityflow/content/app';
import { fetch } from 'expo/fetch';
import { apiUrl, ConfigError } from './config';
import { createNdjsonDecoder } from './ndjson';
import { clearToken, readToken } from './session';
import type { ChatEvent } from './types';

/**
 * The app's only way to the server. Every request says it is the app (`x-uf-client: native`),
 * carries the bearer token when there is one, and never sends or keeps cookies. Errors arrive as
 * `{ error: code }` and become a sentence from packages/content; a 401 signs the app out.
 */

export const CLIENT_HEADER = { 'x-uf-client': 'native' } as const;

export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string | null = null,
  ) {
    super(code);
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly json?: unknown;
  /**
   * A body already encoded (a multipart upload), sent with its own content type. Bytes, so the
   * request carries a Content-Length, which the upload route requires.
   */
  readonly raw?: { readonly body: Uint8Array; readonly contentType: string };
  readonly signal?: AbortSignal;
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

/** Sends a request and returns the raw response once it is known to be a success. */
async function send(path: string, options: RequestOptions = {}): Promise<FetchResponse> {
  const token = await readToken();
  const headers: Record<string, string> = { ...CLIENT_HEADER, accept: 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (options.json !== undefined) headers['content-type'] = 'application/json';
  if (options.raw) headers['content-type'] = options.raw.contentType;
  const payload =
    options.json !== undefined ? JSON.stringify(options.json) : (options.raw?.body ?? undefined);

  // Outside the `try`: a release build with no API URL, or a plain-http one, is the build's
  // fault, not the network's. It throws its own ConfigError, never "you're offline" (A7-05).
  const base = apiUrl();
  let response: FetchResponse;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? (payload === undefined ? 'GET' : 'POST'),
      headers,
      // No cookies, ever: a phone's native cookie jar would otherwise replay one.
      credentials: 'omit',
      ...(payload === undefined ? {} : { body: payload }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'network');
  }

  if (response.ok) return response;
  const body = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    detail?: unknown;
  };
  const code = typeof body.error === 'string' ? body.error : 'server';
  if (response.status === 401) {
    // The token is gone or revoked: forget it, and the auth gate returns to sign-in.
    await clearToken();
  }
  throw new ApiError(response.status, code, typeof body.detail === 'string' ? body.detail : null);
}

/** A JSON request. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return (await response.json()) as T;
}

/** A request whose answer is bytes (Read aloud's audio), with the same session and errors. */
export async function apiBytes(path: string, options: RequestOptions = {}): Promise<Uint8Array> {
  const response = await send(path, options);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Sends one chat message and calls `onEvent` for each line of the streamed reply. Resolves when
 * the stream ends. An `error` line is passed on like any other event.
 */
export async function streamChat(
  message: string,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await send('/api/chat', {
    method: 'POST',
    json: { message },
    ...(signal ? { signal } : {}),
  });
  const decoder = createNdjsonDecoder<ChatEvent>();
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(response.status, 'server');
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) for (const event of decoder.push(value)) onEvent(event);
  }
  for (const event of decoder.end()) onEvent(event);
}

/** The sentence to show for an error, from packages/content. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConfigError) return en.errors.appConfig;
  if (!(error instanceof ApiError)) return en.errors.generic;
  switch (error.code) {
    case 'network':
      return en.errors.offline;
    case 'phone':
      return en.auth.errors.phone;
    case 'pin':
      return en.auth.errors.pin;
    case 'expired':
      return en.auth.errors.expired;
    case 'rate-limited':
      return en.auth.errors.rateLimited;
    case 'pin-locked':
      return en.auth.errors.pinLocked;
    case 'signed-out':
      return en.errors.signedOut;
    case 'consent':
      return en.errors.consent;
    case 'consent-outdated':
      // Which purpose the consent didn't cover: offer letters and proofs (A11-13), or messaging.
      return error.detail === 'university-documents'
        ? en.errors.consentOutdatedDocuments
        : en.errors.consentOutdated;
    case 'not-found':
      return en.errors.notFound;
    case 'sms-unavailable':
      return en.errors.smsUnavailable;
    case 'guardian-opted-out':
      return en.errors.guardianOptedOut;
    case 'state': {
      // A date of birth under 13 (A11-24).
      if (error.detail === 'too-young') return en.errors.tooYoung;
      // A report from a grade above theirs (A1-35).
      if (error.detail === 'report-above-grade') return en.errors.reportAboveGrade;
      // An offer the learner's other offers rule out (Phase 5a).
      const reasons = en.offers.errors as Record<string, string>;
      return error.detail && Object.hasOwn(reasons, error.detail)
        ? (reasons[error.detail] as string)
        : en.errors.generic;
    }
    case 'upload': {
      const reasons = en.documents.errors as Record<string, string>;
      return error.detail && Object.hasOwn(reasons, error.detail)
        ? (reasons[error.detail] as string)
        : en.documents.errors['not-received'];
    }
    default:
      return en.errors.generic;
  }
}
